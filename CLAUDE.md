# Project: Modelos de Lenguaje en Salud

Interactive workshop site for Clínica Alemana, Chile. See `PLAN.md` for architecture and modules.

## Language: professional Chilean Spanish

All user-facing copy is in **Spanish, Chile, professional register**. Use the **tú** form with standard peninsular/neutral imperatives.

### Never use Argentinian voseo or modisms

Forbidden forms (Argentinian) → use these instead:

| ❌ Argentinian voseo | ✅ Chilean / neutral |
|---|---|
| andá, andate | ve, anda |
| pegá, pegala | pega, pégala |
| validá | valida |
| esperá | espera |
| intentá | intenta |
| revisá | revisa |
| escribí | escribe |
| hacé clic | haz clic |
| mirá | mira |
| dejame | déjame |
| poné | pon |
| dale | adelante / continúa |
| che | (omit) |
| acá | aquí (prefer for written/formal) |
| laburar | trabajar |
| pibe | (don't) |

Rule of thumb: if the imperative ends in an accented `-á / -é / -í` (vos form), it is wrong — convert to the unaccented `tú` form (`-a / -e / -e`).

### Tone

Professional, warm, clear. The audience is medical professionals. Medical examples should be accurate and respectful. Avoid colloquialisms in either direction.

## Other project conventions

- Provider: OpenAI, via a **single shared key** held server-side. Default model `gpt-5-nano` (cheapest GPT-5 family); the temperature module (Module 2) uses `gpt-4.1-nano` because `gpt-5-nano` is a reasoning model that rejects any temperature other than 1. Both constants live in `src/lib/llm.ts`; the server allowlist + token caps live in `functions/api/chat.ts`.
- **The OpenAI key must NEVER reach the browser or the repo.** It lives only in the `OPENAI_API_KEY` Cloudflare Pages secret (and locally in the gitignored `.dev.vars`). All model calls go through the Cloudflare Pages Function at `/api/chat`, which injects the key. The browser only ever holds a short-lived HMAC session token from `/api/login`.
- Site is password-gated: attendees enter `WORKSHOP_PASSWORD` (a Cloudflare secret) to get a token. We moved off per-user BYOK keys to one shared key to remove the "everyone needs a free key" friction; the password + server-side model allowlist + output-token cap contain abuse/cost. Set a hard budget limit in the OpenAI dashboard as a backstop.
- Local full-stack dev: `npm run dev:cf` (runs Vite under `wrangler pages dev` so `/api/*` works). `npm run dev` is frontend-only and can't reach the model.
- Brand colors in `src/index.css` (`--color-brand-*`). Don't introduce competing palettes.
- Mobile-first: every new component must work on a phone before being considered done.
- Dr Fernando Eimbcke's name with LinkedIn link must remain prominent in the header — see `src/components/Header.tsx`.
