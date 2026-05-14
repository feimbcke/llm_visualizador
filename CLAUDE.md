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

- Default Gemini model: `gemini-2.5-flash`. Hardcoded in `src/lib/gemini.ts`.
- API key lives only in `localStorage`. Never send it anywhere except `generativelanguage.googleapis.com`.
- Brand colors in `src/index.css` (`--color-brand-*`). Don't introduce competing palettes.
- Mobile-first: every new component must work on a phone before being considered done.
- Dr Fernando Eimbcke's name with LinkedIn link must remain prominent in the header — see `src/components/Header.tsx`.
