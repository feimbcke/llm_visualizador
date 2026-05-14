export const DEFAULT_MODEL = 'gemini-2.5-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiError extends Error {
  status: number;
  /** Spanish, user-facing */
  userMessage: string;
  constructor(status: number, userMessage: string, raw?: string) {
    super(raw ?? userMessage);
    this.status = status;
    this.userMessage = userMessage;
  }
}

function userMessageForStatus(status: number, raw: string): string {
  if (status === 400) return 'La solicitud tiene un formato inválido. Revisa la consola.';
  if (status === 401 || status === 403)
    return 'La clave de Gemini no es válida o no tiene permisos. Verificala en Google AI Studio.';
  if (status === 404) return 'El modelo solicitado no existe o no está disponible para tu clave.';
  if (status === 429)
    return 'Superaste el límite de solicitudes por minuto. Esperá unos segundos e intentá de nuevo.';
  if (status >= 500) return 'El servicio de Gemini está teniendo problemas. Intentá en un momento.';
  return `Error ${status}: ${raw.slice(0, 200)}`;
}

/**
 * Validate the key with a cheap GET to /models. Does not consume token quota.
 */
export async function validateApiKey(apiKey: string): Promise<void> {
  const url = `${API_BASE}/models?key=${encodeURIComponent(apiKey)}&pageSize=1`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new GeminiError(0, 'No pude conectar con Gemini. Revisá tu conexión a internet.');
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new GeminiError(res.status, userMessageForStatus(res.status, raw), raw);
  }
}

export interface Part {
  text?: string;
}

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

interface StreamChunk {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
}

/**
 * Stream raw SSE chunks from Gemini.
 */
export async function* streamGenerate(opts: StreamOptions): AsyncGenerator<StreamChunk> {
  const model = opts.model ?? DEFAULT_MODEL;
  const url = `${API_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(opts.apiKey)}`;
  const body: Record<string, unknown> = { contents: opts.contents };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }
  if (opts.generationConfig) body.generationConfig = opts.generationConfig;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new GeminiError(0, 'No pude conectar con Gemini. Revisá tu conexión a internet.');
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new GeminiError(res.status, userMessageForStatus(res.status, raw), raw);
  }
  if (!res.body) {
    throw new GeminiError(0, 'La respuesta de Gemini no contiene datos.');
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
        yield JSON.parse(data) as StreamChunk;
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
    const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) yield text;
  }
}
