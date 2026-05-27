import { useRef, useState } from 'react';
import { LlmError, streamText } from '../lib/llm';
import { useApp } from '../state/AppContext';
import type { ModuleProps } from './registry';

const MODEL = 'gpt-4.1-nano';
const NAIVE_SYSTEM = 'Eres un asistente clínico. Responde en español, de forma breve y directa.';

/** Cockcroft-Gault — a real calculation done on the frontend, our "tool". */
function cockcroftGault(age: number, weightKg: number, creat: number, female: boolean): number {
  return (((140 - age) * weightKg) / (72 * creat)) * (female ? 0.85 : 1);
}

// A long arithmetic expression, evaluated for real on the frontend (our "tool").
const COMPLEX_EXPR = '(3*4/6) + 2 - (9*34/5) - (6/2)';
const COMPLEX_RESULT = String(Number((((3 * 4) / 6) + 2 - ((9 * 34) / 5) - (6 / 2)).toFixed(4)));

interface Preset {
  id: string;
  label: string;
  /** Limitation this exposes, shown as a tag. */
  limit: string;
  question: string;
  /** Appended to the no-tool prompt to force the model to answer without the
   *  step-by-step that would otherwise let it calculate correctly. */
  naiveHint?: string;
  /** Optional hint shown under the question (e.g. the expected correct answer). */
  help?: string;
  toolName: string;
  toolArgs: string;
  /** Deterministic tool output computed/staged on the frontend. */
  toolResult: string;
}

const PRESETS: Preset[] = [
  {
    id: 'calc',
    label: 'Cálculo VFG',
    limit: 'No calcula con precisión',
    question:
      'Calcula el clearance de creatinina (Cockcroft-Gault) de un hombre de 72 años, 80 kg, creatinina 1.4 mg/dL.',
    naiveHint:
      'Responde de memoria, sin calcular paso a paso ni mostrar la fórmula: da solo el número final en mL/min.',
    toolName: 'calcular_clearance',
    toolArgs: 'edad=72, peso=80, creatinina=1.4, sexo=masculino',
    toolResult: `${cockcroftGault(72, 80, 1.4, false).toFixed(1)} mL/min`,
  },
  {
    id: 'arit',
    label: 'Operación larga',
    limit: 'No calcula con precisión',
    question: `Calcula exactamente, respetando el orden de las operaciones: ${COMPLEX_EXPR}`,
    naiveHint: 'Responde de memoria, sin calcular paso a paso: da solo el número final.',
    help: `Respuesta correcta: ${COMPLEX_RESULT}.`,
    toolName: 'calculadora',
    toolArgs: COMPLEX_EXPR,
    toolResult: COMPLEX_RESULT,
  },
  {
    id: 'lab',
    label: 'Dato en vivo',
    limit: 'No conoce datos actuales',
    question: '¿Cuál es el último valor de potasio de la paciente y qué conducta sugieres?',
    toolName: 'obtener_ultimo_examen',
    toolArgs: 'examen="potasio"',
    toolResult: 'Potasio 5.9 mEq/L — hoy 07:42 (referencia 3.5–5.1)',
  },
];

interface Answer {
  text: string;
  done: boolean;
  error?: string;
}

const EMPTY: Answer = { text: '', done: false };

export function ToolsModule({ tab, onMainAction }: ModuleProps) {
  const { authed } = useApp();
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [naive, setNaive] = useState<Answer | null>(null);
  const [augmented, setAugmented] = useState<Answer | null>(null);
  const [shownPresetId, setShownPresetId] = useState(PRESETS[0].id);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const shown = PRESETS.find((p) => p.id === shownPresetId) ?? PRESETS[0];

  async function compare() {
    if (!authed || running) return;
    onMainAction?.();
    setShownPresetId(preset.id);
    setNaive({ ...EMPTY });
    setAugmented({ ...EMPTY });
    setRunning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const augmentedPrompt =
      `${preset.question}\n\n[La herramienta ${preset.toolName} devolvió: ${preset.toolResult}]\n\n` +
      'Responde al usuario de forma breve usando exactamente ese resultado.';

    async function stream(
      userText: string,
      set: React.Dispatch<React.SetStateAction<Answer | null>>,
    ) {
      try {
        for await (const delta of streamText({
          model: MODEL,
          systemInstruction: NAIVE_SYSTEM,
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: { temperature: 0 },
          signal: ctrl.signal,
        })) {
          set((a) => ({ ...(a ?? EMPTY), text: (a?.text ?? '') + delta }));
        }
        set((a) => ({ ...(a ?? EMPTY), done: true }));
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          const msg = err instanceof LlmError ? err.userMessage : 'Error';
          set((a) => ({ ...(a ?? EMPTY), done: true, error: msg }));
        }
      }
    }

    const naivePrompt = preset.naiveHint
      ? `${preset.question}\n\n${preset.naiveHint}`
      : preset.question;

    await Promise.all([stream(naivePrompt, setNaive), stream(augmentedPrompt, setAugmented)]);
    setRunning(false);
    abortRef.current = null;
  }

  function stop() {
    abortRef.current?.abort();
  }

  const ControlsPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="font-semibold text-ink text-sm">Con y sin herramientas</div>
        <div className="text-xs text-muted">La misma pregunta, respondida de dos formas</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 text-sm text-ink">
          <p>
            Un modelo de lenguaje, por sí solo, <strong>no calcula con exactitud</strong> ni{' '}
            <strong>conoce datos actuales</strong> (laboratorios, fichas). Las{' '}
            <strong>herramientas</strong> resuelven esto: el modelo delega en una calculadora o en
            una consulta a la ficha, y luego responde con el resultado exacto.
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted font-semibold">Pregunta</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPresetId(p.id)}
                disabled={running}
                className={
                  'px-2.5 py-1 rounded-full border text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
                  (p.id === presetId
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-border text-ink hover:bg-brand-50 hover:border-brand-100')
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="bg-surface border border-border rounded-lg p-3 text-sm text-body">
            {preset.question}
          </div>
          <div className="mt-2">
            <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              Límite: {preset.limit}
            </span>
          </div>
          {preset.help && <p className="mt-2 text-xs text-muted">{preset.help}</p>}
        </div>
      </div>

      <div className="border-t border-border p-3 bg-white shrink-0">
        {running ? (
          <button
            type="button"
            onClick={stop}
            className="w-full px-4 py-2.5 rounded-lg border border-border text-ink hover:bg-surface font-medium text-sm"
          >
            Detener
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void compare()}
            className="w-full px-4 py-2.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 font-medium text-sm"
          >
            Comparar respuestas
          </button>
        )}
      </div>
    </div>
  );

  const ResultsPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="font-semibold text-ink text-sm">El modelo solo vs. con herramienta</div>
        <div className="text-xs text-muted">Mira la diferencia en la respuesta</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-3">
        {!naive && !augmented ? (
          <div className="text-center text-sm text-muted py-10">
            Elige una pregunta y presiona{' '}
            <strong className="text-ink">"Comparar respuestas"</strong>.
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-red-200 bg-red-50/40 p-3">
              <div className="text-xs font-semibold text-red-700 mb-1.5">Sin herramienta · el modelo solo</div>
              <div className="text-sm text-body whitespace-pre-wrap">
                {naive?.error ? (
                  <span className="text-red-700">{naive.error}</span>
                ) : (
                  naive?.text || <span className="text-muted italic">…</span>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3 space-y-2">
              <div className="text-xs font-semibold text-brand-700">Con herramienta</div>
              <div className="rounded-md bg-white border border-border p-2 font-mono text-xs">
                <div className="text-brand-700">🔧 {shown.toolName}({shown.toolArgs})</div>
                <div className="text-ink">→ {shown.toolResult}</div>
              </div>
              <div className="text-sm text-body whitespace-pre-wrap">
                {augmented?.error ? (
                  <span className="text-red-700">{augmented.error}</span>
                ) : (
                  augmented?.text || <span className="text-muted italic">…</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-border px-4 py-2 text-xs text-muted shrink-0">
        La herramienta está simulada en esta página, pero el flujo es real: el modelo delega el
        cálculo o la consulta y responde con el dato exacto.
      </div>
    </div>
  );

  return (
    <>
      <div className={tab === 'chat' ? 'block' : 'hidden lg:block'}>{ControlsPane}</div>
      <div className={tab === 'viz' ? 'block' : 'hidden lg:block'}>{ResultsPane}</div>
    </>
  );
}
