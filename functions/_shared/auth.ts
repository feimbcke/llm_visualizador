/**
 * HMAC-signed session tokens for the workshop password gate.
 *
 * Runs on the Cloudflare Workers runtime, so we use Web Crypto (crypto.subtle).
 * A token is `${expEpochMs}.${hmacHex}` where the HMAC is taken over the exp
 * string with a server-only secret. The browser can read the exp (to know when
 * to re-login) but cannot forge a token, because it never sees the secret.
 */

const enc = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time string comparison to avoid leaking match length via timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signToken(secret: string, ttlMs: number): Promise<{ token: string; exp: number }> {
  const exp = Date.now() + ttlMs;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(exp)));
  return { token: `${exp}.${toHex(sig)}`, exp };
}

export async function verifyToken(secret: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const expStr = token.slice(0, dot);
  const sigHex = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  const key = await hmacKey(secret);
  const expected = toHex(await crypto.subtle.sign('HMAC', key, enc.encode(expStr)));
  return timingSafeEqual(expected, sigHex);
}
