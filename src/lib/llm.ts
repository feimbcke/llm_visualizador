/**
 * Client for the workshop's own backend proxy (Cloudflare Pages Function at
 * /api/chat), which holds the single shared OpenAI key server-side.
 *
 * Why a proxy instead of the old BYOK model: we now use one shared OpenAI key
 * for the whole room. A shared key can never live in client code — anything the
 * browser downloads, an attendee can read — so the key stays on the server and
 * the browser only ever holds a short-lived session token issued by /api/login
 * after the workshop password is entered.
 *
 * The external surface keeps the Gemini-style `Content[]` shape so the module
 * code didn't need rewriting across provider/architecture changes. Internal
 * translation to OpenAI message format lives in toOpenAIMessages().
 */
import { clearSessionToken, getSessionToken, setSessionToken } from './storage';

/** Default model for every module. Reasoning model: temperature is fixed at 1. */
export const DEFAULT_MODEL = 'gpt-5-nano';
/** Module 2 (temperatura) needs a model that accepts a custom temperature. */
export const TEMPERATURE_MODEL = 'gpt-4.1-nano';

export class LlmError extends Error {
  status: number;
  /** Spanish, user-facing */
  userMessage: string;
  constructor(status: number, userMessage: string, raw?: string) {
    super(raw ?? userMessage);
    this.status = status;
    this.userMessage = userMessage;
  }
}

interface ProviderErrorEnvelope {
  error?: { message?: string; code?: string; type?: string };
}

function extractProviderErrorMessage(raw: string): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProviderErrorEnvelope;
    return parsed.error?.message ?? null;
  } catch {
    return null;
  }
}

function userMessageForStatus(status: number, raw: string): string {
  const detail = extractProviderErrorMessage(raw);
  if (status === 400) {
    return detail
      ? `El proveedor rechazó la solicitud: ${detail}`
      : 'La solicitud tiene un formato inválido. Revisa la consola.';
  }
  if (status === 401) {
    return 'Tu sesión expiró. Recarga la página e ingresa la contraseña otra vez.';
  }
  if (status === 404) return 'El modelo solicitado no está disponible.';
  if (status === 429) {
    return 'Hay mucha demanda en este momento. Espera unos segundos e intenta de nuevo.';
  }
  if (status >= 500) return 'El servicio está teniendo problemas. Intenta en un momento.';
  return detail ? `Error ${status}: ${detail}` : `Error ${status}: ${raw.slice(0, 200)}`;
}

// ---------------------------------------------------------------------------
// Auth: workshop password gate
// ---------------------------------------------------------------------------

/** Fires when the proxy rejects our token (expired/invalid) so the UI can react. */
export const UNAUTHORIZED_EVENT = 'llmviz:unauthorized';

/** Token shape is `${expEpochMs}.${sig}`; we can read the exp client-side. */
export function isAuthenticated(): boolean {
  const token = getSessionToken();
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const exp = Number(token.slice(0, dot));
  return Number.isFinite(exp) && exp > Date.now();
}

/** Exchange the workshop password for a session token. Throws LlmError on failure. */
export async function login(password: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  } catch {
    throw new LlmError(0, 'No pude conectar con el servidor del taller. Revisa tu conexión.');
  }
  if (!res.ok) {
    if (res.status === 401) throw new LlmError(401, 'Contraseña incorrecta. Intenta de nuevo.');
    const raw = await res.text().catch(() => '');
    throw new LlmError(res.status, 'No pude validar la contraseña. Intenta de nuevo.', raw);
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new LlmError(0, 'Respuesta inesperada del servidor.');
  setSessionToken(data.token);
}

export function logout(): void {
  clearSessionToken();
}

function handleUnauthorized(): void {
  clearSessionToken();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface Part {
  text?: string;
}

/** Gemini-style message shape kept as the public API so modules need no rewrite. */
export interface Content {
  role: 'user' | 'model';
  parts: Part[];
}

export interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  candidateCount?: number;
}

export interface StreamOptions {
  /** Defaults to DEFAULT_MODEL server-side. Only allowlisted models are honored. */
  model?: string;
  contents: Content[];
  systemInstruction?: string;
  generationConfig?: GenerationConfig;
  signal?: AbortSignal;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function toOpenAIMessages(contents: Content[], systemInstruction?: string): OpenAIMessage[] {
  const msgs: OpenAIMessage[] = [];
  if (systemInstruction) msgs.push({ role: 'system', content: systemInstruction });
  for (const c of contents) {
    const content = c.parts.map((p) => p.text ?? '').join('');
    msgs.push({
      role: c.role === 'model' ? 'assistant' : 'user',
      content,
    });
  }
  return msgs;
}

interface OpenAIChunk {
  choices?: Array<{
    delta?: { content?: string; role?: string };
    finish_reason?: string | null;
  }>;
}

/**
 * Stream raw OpenAI-format chunks from our proxy. The OpenAI key never touches
 * this code — we send the session token; the Function injects the real key.
 */
export async function* streamGenerate(opts: StreamOptions): AsyncGenerator<OpenAIChunk> {
  const messages = toOpenAIMessages(opts.contents, opts.systemInstruction);

  const body: Record<string, unknown> = { messages, stream: true };
  if (opts.model) body.model = opts.model;
  if (opts.generationConfig?.temperature !== undefined) {
    body.temperature = opts.generationConfig.temperature;
  }

  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getSessionToken() ?? ''}`,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new LlmError(0, 'No pude conectar con el servidor del taller. Revisa tu conexión.');
  }

  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    const raw = await res.text().catch(() => '');
    throw new LlmError(res.status, userMessageForStatus(res.status, raw), raw);
  }
  if (!res.body) {
    throw new LlmError(0, 'La respuesta no contiene datos.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nlIndex: number;
    while ((nlIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nlIndex).trimEnd();
      buffer = buffer.slice(nlIndex + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        yield JSON.parse(data) as OpenAIChunk;
      } catch {
        /* skip malformed chunk */
      }
    }
  }
}

/**
 * Convenience: yield only the text deltas as they arrive.
 */
export async function* streamText(opts: StreamOptions): AsyncGenerator<string> {
  for await (const chunk of streamGenerate(opts)) {
    const text = chunk.choices?.[0]?.delta?.content;
    if (text) yield text;
  }
}
