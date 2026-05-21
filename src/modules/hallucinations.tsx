import { useRef, useState } from 'react';
import { LlmError, streamText } from '../lib/llm';
import { useApp } from '../state/AppContext';
import type { ModuleProps } from './registry';

// gpt-5-nano (reasoning) tends to spend its budget "thinking" and return empty
// or hedge. gpt-4.1-nano confidently fabricates detailed citations — exactly
// the behavior this module is meant to expose.
const MODEL = 'gpt-4.1-nano';

// We deliberately tell the model not to hedge, to be brief, and to ALWAYS
// produce a concrete reference. That IS the lesson: asked to sound
// authoritative, a model invents specifics — authors, DOIs, registry numbers —
// that look entirely real but fail when checked. Without this, well-aligned
// models often refuse ("no encuentro información"), which hides the behavior.
const SYSTEM_INSTRUCTION =
  'Responde de forma muy breve y directa, sin explicaciones largas ni rodeos. Para CUALQUIER ' +
  'pregunta, asume que el artículo, ensayo o documento existe y entrégalo SIEMPRE con datos ' +
  'concretos: autores, revista, año, volumen, páginas y DOI (o número de registro NCT para un ' +
  'ensayo). Nunca respondas que no se encontró, que no existe, que no puedes verificarlo, ni ' +
  'pidas más datos. Responde con total seguridad y sin advertencias.';

interface Preset {
  label: string;
  prompt: string;
}

const PRESETS: Preset[] = [
  {
    label: 'Cita de revista',
    prompt:
      'Cítame un artículo del New England Journal of Medicine sobre el uso de inhibidores SGLT2 en cirrosis descompensada. Incluye autores, año, volumen, páginas y DOI.',
  },
  {
    label: 'Ensayo clínico',
    prompt:
      'Dame el nombre y el número de registro (NCT) del ensayo clínico fase 3 que evaluó la colchicina para prevenir la pericarditis recurrente, con el DOI de la publicación principal.',
  },
  {
    label: 'Guía clínica',
    prompt:
      'Dame la cita completa (autores, revista, año, volumen, páginas y DOI) de la guía 2022 de la Sociedad Chilena de Cardiología sobre anticoagulación en fibrilación auricular y enfermedad renal terminal.',
  },
];

// Patterns that look like verifiable scholarly identifiers — the scaffolding a
// model uses to make a fabrication sound authoritative.
const SUSPECT =
  /(10\.\d{4,9}\/[^\s,;)]+|PMID:?\s*\d+|NCT\d{8}|ISRCTN\d+|\b\d{1,4}\(\d+\):\s?\d+(?:[–-]\d+)?|\(\d{4}\)|\bet al\.)/gi;

function annotate(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  SUSPECT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SUSPECT.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <mark
        key={key++}
        title="Parece un dato verificable (cita, DOI, registro), pero probablemente fue inventado. Verifícalo en la fuente original."
        className="bg-red-100 text-red-800 rounded px-0.5 border-b-2 border-red-300"
      >
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
    if (m.index === SUSPECT.lastIndex) SUSPECT.lastIndex++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function countFlags(text: string): number {
  const matches = text.match(SUSPECT);
  return matches ? matches.length : 0;
}

export function HallucinationsModule(_props: ModuleProps) {
  const { authed } = useApp();
  const [input, setInput] = useState('');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run(textArg?: string) {
    const q = (textArg ?? input).trim();
    if (!q || !authed || streaming) return;
    setInput('');
    setPrompt(q);
    setResponse('');
    setError(null);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      for await (const delta of streamText({
        model: MODEL,
        systemInstruction: SYSTEM_INSTRUCTION,
        contents: [{ role: 'user', parts: [{ text: q }] }],
        signal: ctrl.signal,
      })) {
        setResponse((r) => r + delta);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof LlmError ? err.userMessage : 'Algo falló al generar.');
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function reset() {
    setResponse('');
    setPrompt('');
    setError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void run();
    }
  }

  const flags = countFlags(response);

  const Presets = (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => void run(p.prompt)}
          disabled={streaming}
          className="px-2.5 py-1 rounded-full border border-border text-xs text-ink hover:bg-brand-50 hover:border-brand-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  const ChatPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <div className="font-semibold text-ink text-sm">Chat</div>
          <div className="text-xs text-muted">gpt-4.1-nano · pídele datos difíciles de verificar</div>
        </div>
        {(response || prompt) && !streaming && (
          <button type="button" onClick={reset} className="text-xs text-muted hover:text-ink">
            Limpiar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted font-semibold">
            Pruebas sugeridas
          </div>
          {Presets}
        </div>

        {!prompt && !streaming && (
          <p className="text-center text-sm text-muted py-4">
            Elige una prueba o escribe tu propia pregunta. Observa con cuánta seguridad responde.
          </p>
        )}

        {prompt && (
          <div className="flex justify-end">
            <div className="max-w-[85%] bg-brand-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 whitespace-pre-wrap">
              {prompt}
            </div>
          </div>
        )}

        {(response || streaming) && (
          <div className="flex justify-start">
            <div className="max-w-[90%] bg-surface border border-border text-body rounded-2xl rounded-tl-sm px-4 py-2.5 whitespace-pre-wrap">
              {response || <span className="text-muted italic">…</span>}
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3 bg-white shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta…"
            rows={1}
            className="flex-1 resize-none px-3 py-2 rounded-lg border border-border bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm max-h-32"
            disabled={streaming}
          />
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              className="px-4 py-2 rounded-lg border border-border text-ink hover:bg-surface font-medium text-sm shrink-0"
            >
              Detener
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void run()}
              disabled={!input.trim()}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm shrink-0"
            >
              Enviar
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const VizPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-ink text-sm">Qué está inventando</div>
          <div className="text-xs text-muted">Datos que parecen verificables, resaltados</div>
        </div>
        {response && (
          <div className="text-xs tabular-nums text-right shrink-0">
            <strong className="text-red-700">{flags}</strong>{' '}
            <span className="text-muted">por verificar</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-3">
        <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 text-sm text-ink">
          <p className="mb-2">
            El modelo <strong>no consulta ninguna base de datos</strong>: predice el texto más
            probable, palabra por palabra. Una cita inventada se ve creíble — autores, año, DOI —
            porque imita la forma de miles de citas reales, pero nada garantiza que exista.
          </p>
          <p className="text-muted">
            Sin herramientas (búsqueda web o una base de datos), el modelo no distingue lo verdadero
            de lo <em>verosímil</em>. Aquí le pedimos que respondiera sin advertencias para que la
            invención quede a la vista.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
          <p className="mb-2">
            <strong>¿Por qué tu ChatGPT quizá no se equivoca así?</strong> Las aplicaciones como
            ChatGPT, Claude o Gemini hoy usan <strong>herramientas</strong>: buscan en la web y leen
            las fuentes antes de responder, por lo que suelen entregar citas reales y verificables.
          </p>
          <p>
            Este taller usa el modelo <em>"puro"</em>, sin esas herramientas, para mostrar lo que
            ocurre por debajo: cuando no puede buscar, inventa. Más adelante veremos cómo las
            herramientas corrigen justamente este problema.
          </p>
        </div>

        {!response && !streaming && (
          <div className="text-center text-sm text-muted py-6">
            Genera una respuesta para ver resaltados los datos que aparentan ser verificables.
          </div>
        )}

        {(response || streaming) && (
          <div>
            <div className="bg-surface border border-border rounded-lg p-3 text-sm text-body whitespace-pre-wrap leading-relaxed">
              {response ? annotate(response) : <span className="text-muted italic">…</span>}
            </div>
            {response && flags === 0 && !streaming && (
              <p className="text-xs text-muted mt-2">
                No se detectaron identificadores con formato de cita en esta respuesta. Prueba con
                "Cita de revista" o pídele un DOI o número de registro.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border px-4 py-2 text-xs text-muted shrink-0">
        Lo resaltado en rojo tiene formato de dato verificable (DOI, PMID, NCT, año, volumen). Es
        justo lo que más conviene comprobar: suele ser inventado.
      </div>
    </div>
  );

  // Stacked layout (set via mobileLayout: 'stack' in the registry): both panes
  // are always rendered — side by side on desktop (2-col grid), stacked with
  // the visualization below the chat on mobile (1-col grid).
  return (
    <>
      <div className="block">{ChatPane}</div>
      <div className="block">{VizPane}</div>
    </>
  );
}
