/**
 * Provider-agnostic LLM client. Backed by Groq's OpenAI-compatible API.
 *
 * Why Groq: free tier is 30 RPM / 14,400 RPD per user. Gemini's free tier
 * collapsed to ~20 RPD on Flash, which made the workshop unworkable. Groq's
 * Llama 3.3 70B Versatile is fast on LPU hardware and capable enough for
 * the clinical-reasoning demos.
 *
 * The external surface keeps Gemini-style `Content[]` to minimize churn
 * across the module code. Internal translation to OpenAI message format
 * lives in toOpenAIMessages().
 */

export const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const API_BASE = 'https://api.groq.com/openai/v1';

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
    return 'La clave no es válida. Crea una nueva en console.groq.com/keys y vuelve a pegarla.';
  }
  if (status === 403) {
    return detail
      ? `Acceso denegado: ${detail}`
      : 'La clave no tiene permisos para este modelo.';
  }
  if (status === 404) return 'El modelo solicitado no existe o no está disponible para tu clave.';
  if (status === 429) {
    return 'Superaste el límite de solicitudes por minuto. Espera unos segundos e intenta de nuevo.';
  }
  if (status >= 500) return 'El servicio está teniendo problemas. Intenta en un momento.';
  return detail ? `Error ${status}: ${detail}` : `Error ${status}: ${raw.slice(0, 200)}`;
}

/**
 * Validate the key with a minimal chat completion call. Costs a handful of
 * tokens but uses the same endpoint as every real request, so any auth /
 * model / region issue surfaces here instead of at first prompt.
 */
export async function validateApiKey(apiKey: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    });
  } catch {
    throw new LlmError(0, 'No pude conectar con el proveedor. Revisa tu conexión a internet.');
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new LlmError(res.status, userMessageForStatus(res.status, raw), raw);
  }
}

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
  apiKey: string;
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
 * Stream raw OpenAI-format chunks from the provider.
 */
export async function* streamGenerate(opts: StreamOptions): AsyncGenerator<OpenAIChunk> {
  const model = opts.model ?? DEFAULT_MODEL;
  const messages = toOpenAIMessages(opts.contents, opts.systemInstruction);

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
  };
  if (opts.generationConfig) {
    const g = opts.generationConfig;
    if (g.temperature !== undefined) body.temperature = g.temperature;
    if (g.topP !== undefined) body.top_p = g.topP;
    if (g.maxOutputTokens !== undefined) body.max_tokens = g.maxOutputTokens;
    if (g.candidateCount !== undefined) body.n = g.candidateCount;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new LlmError(0, 'No pude conectar con el proveedor. Revisa tu conexión a internet.');
  }

  if (!res.ok) {
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
