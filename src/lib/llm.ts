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

/**
 * Default system prompt for modules that don't set their own. Keeps demo
 * answers short and readable on phones. The system-prompt module (Module 4)
 * deliberately passes its own instruction, so this never overrides it — that
 * module's whole point is that the visible system prompt is the only one.
 */
export const DEFAULT_SYSTEM_INSTRUCTION =
  'Eres un asistente para un taller sobre modelos de lenguaje en el ámbito de la salud. ' +
  'Responde de forma concisa y directa, en español, salvo que se te indique lo contrario.';

/**
 * Hard cap on characters emitted per response. When reached, streamText stops
 * consuming and cancels the network stream, so a runaway answer can't drag on.
 * Tighter and more predictable than the server-side token cap. Override per
 * call with StreamOptions.maxChars.
 */
export const MAX_RESPONSE_CHARS = 2000;

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
  /** Stop the stream after this many characters. Defaults to MAX_RESPONSE_CHARS. */
  maxChars?: number;
  /** Request per-token log-probabilities (non-reasoning models only). */
  logprobs?: boolean;
  /** How many alternative tokens to return per position (0–5). Implies logprobs. */
  topLogprobs?: number;
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

interface OpenAITokenLogprob {
  token: string;
  logprob: number;
  top_logprobs?: Array<{ token: string; logprob: number }>;
}

interface OpenAIChunk {
  choices?: Array<{
    delta?: { content?: string; role?: string };
    finish_reason?: string | null;
    logprobs?: { content?: OpenAITokenLogprob[] };
  }>;
}

/** A single generated token with its probability and the alternatives considered. */
export interface TokenInfo {
  token: string;
  /** Linear probability 0–1 of the chosen token. */
  prob: number;
  /** Alternatives at this position (linear prob), as returned by the model. */
  alternatives: { token: string; prob: number }[];
}

/**
 * Stream raw OpenAI-format chunks from our proxy. The OpenAI key never touches
 * this code — we send the session token; the Function injects the real key.
 */
export async function* streamGenerate(opts: StreamOptions): AsyncGenerator<OpenAIChunk> {
  const messages = toOpenAIMessages(
    opts.contents,
    opts.systemInstruction ?? DEFAULT_SYSTEM_INSTRUCTION,
  );

  const body: Record<string, unknown> = { messages, stream: true };
  if (opts.model) body.model = opts.model;
  if (opts.generationConfig?.temperature !== undefined) {
    body.temperature = opts.generationConfig.temperature;
  }
  if (opts.logprobs || opts.topLogprobs !== undefined) {
    body.logprobs = true;
    if (opts.topLogprobs !== undefined) body.top_logprobs = opts.topLogprobs;
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

  // finally{} runs when the consumer stops early (e.g. streamText hits its
  // char cap and returns), cancelling the network read so the request stops.
  try {
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
  } finally {
    reader.cancel().catch(() => {});
  }
}

/**
 * Convenience: yield only the text deltas as they arrive.
 */
export async function* streamText(opts: StreamOptions): AsyncGenerator<string> {
  const cap = opts.maxChars ?? MAX_RESPONSE_CHARS;
  let emitted = 0;
  for await (const chunk of streamGenerate(opts)) {
    const text = chunk.choices?.[0]?.delta?.content;
    if (!text) continue;
    const remaining = cap - emitted;
    if (text.length >= remaining) {
      // Last fragment: trim to the cap, emit it, then stop the whole stream.
      if (remaining > 0) yield text.slice(0, remaining);
      return;
    }
    emitted += text.length;
    yield text;
  }
}

/**
 * Stream real tokens with their probabilities. Requires a non-reasoning model
 * (the proxy drops logprobs for gpt-5*). Same char cap as streamText.
 */
export async function* streamTokens(opts: StreamOptions): AsyncGenerator<TokenInfo> {
  const cap = opts.maxChars ?? MAX_RESPONSE_CHARS;
  let emitted = 0;
  const withLogprobs: StreamOptions = { ...opts, logprobs: true, topLogprobs: opts.topLogprobs ?? 3 };
  for await (const chunk of streamGenerate(withLogprobs)) {
    const content = chunk.choices?.[0]?.logprobs?.content;
    if (!content) continue;
    for (const t of content) {
      const token = t.token ?? '';
      if (!token) continue;
      const info: TokenInfo = {
        token,
        prob: Math.exp(t.logprob),
        alternatives: (t.top_logprobs ?? []).map((a) => ({ token: a.token, prob: Math.exp(a.logprob) })),
      };
      const remaining = cap - emitted;
      if (token.length >= remaining) {
        if (remaining > 0) yield { ...info, token: token.slice(0, remaining) };
        return;
      }
      emitted += token.length;
      yield info;
    }
  }
}
