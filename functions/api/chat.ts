/**
 * POST /api/chat  ->  streamed OpenAI chat completion (SSE passthrough)
 *
 * This is the only place the OpenAI key is ever used. The key lives in the
 * OPENAI_API_KEY secret (Cloudflare dashboard / .dev.vars) and never reaches
 * the browser. Every request must carry a valid session token from /api/login.
 *
 * Defense in depth against a user who reads the network calls:
 *   - the model is clamped to a cheap-nano allowlist (no gpt-5-pro through our key)
 *   - output tokens are hard-capped server-side
 *   - reasoning models (gpt-5*) get max_completion_tokens + minimal effort and
 *     never receive a temperature (they only accept the default of 1)
 */
import { verifyToken } from '../_shared/auth';

interface Env {
  OPENAI_API_KEY: string;
  WORKSHOP_PASSWORD: string;
  SESSION_SECRET?: string;
}

const ALLOWED_MODELS = new Set(['gpt-5-nano', 'gpt-4.1-nano']);
const DEFAULT_MODEL = 'gpt-5-nano';
const MAX_OUTPUT_TOKENS = 2048;
const isReasoningModel = (m: string) => m.startsWith('gpt-5');

interface IncomingMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface IncomingBody {
  model?: string;
  messages?: IncomingMessage[];
  temperature?: number;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const secret = env.SESSION_SECRET ?? env.WORKSHOP_PASSWORD;

  if (!(await verifyToken(secret, token))) {
    return json({ error: { message: 'Sesión inválida o expirada.' } }, 401);
  }

  let body: IncomingBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: { message: 'JSON inválido.' } }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: { message: 'Faltan mensajes en la solicitud.' } }, 400);
  }

  const model = body.model && ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;

  const upstream: Record<string, unknown> = {
    model,
    messages: body.messages,
    stream: true,
  };

  if (isReasoningModel(model)) {
    upstream.max_completion_tokens = MAX_OUTPUT_TOKENS;
    upstream.reasoning_effort = 'minimal'; // keep streaming/latency demos snappy
  } else {
    upstream.max_tokens = MAX_OUTPUT_TOKENS;
    if (typeof body.temperature === 'number' && Number.isFinite(body.temperature)) {
      upstream.temperature = Math.max(0, Math.min(2, body.temperature));
    }
  }

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(upstream),
    });
  } catch {
    return json({ error: { message: 'No se pudo contactar al proveedor del modelo.' } }, 502);
  }

  // Pipe the upstream response straight back — streamed SSE on success, or the
  // provider's JSON error body (with its status) so the client can surface it.
  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'text/event-stream',
      'Cache-Control': 'no-store',
    },
  });
};
