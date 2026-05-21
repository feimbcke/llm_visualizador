/**
 * POST /api/login  { password }  ->  { token, exp }
 *
 * Validates the workshop password (set as the WORKSHOP_PASSWORD secret in the
 * Cloudflare Pages dashboard, and in .dev.vars locally) and returns a short-
 * lived signed token. The password itself is never stored client-side beyond
 * the moment of entry; the browser keeps only the opaque token.
 */
import { signToken, timingSafeEqual } from '../_shared/auth';

interface Env {
  WORKSHOP_PASSWORD: string;
  SESSION_SECRET?: string;
}

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours — covers the whole event

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.WORKSHOP_PASSWORD) {
    return json({ error: 'El servidor no tiene contraseña configurada.' }, 500);
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Solicitud inválida.' }, 400);
  }

  const password = typeof body.password === 'string' ? body.password.trim() : '';
  if (!password || !timingSafeEqual(password, env.WORKSHOP_PASSWORD)) {
    return json({ error: 'Contraseña incorrecta.' }, 401);
  }

  const secret = env.SESSION_SECRET ?? env.WORKSHOP_PASSWORD;
  const { token, exp } = await signToken(secret, TOKEN_TTL_MS);
  return json({ token, exp });
};
