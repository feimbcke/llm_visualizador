import { useRef, useState } from 'react';
import { LlmError, streamTokens, TEMPERATURE_MODEL } from '../lib/llm';
import { useApp } from '../state/AppContext';
import { TokenPopover } from '../components/TokenPopover';
import type { ModuleProps } from './registry';

interface SlotToken {
  text: string;
  /** linear probability 0–1 the model gave this token */
  prob: number;
}

interface CompareSlot {
  tokens: SlotToken[];
  done: boolean;
  error?: string;
}

/** Probability → light background tint: red (improbable) → green (probable). */
function tint(prob: number): React.CSSProperties {
  const h = Math.max(0, Math.min(120, prob * 120));
  return { backgroundColor: `hsl(${h}, 85%, 90%)` };
}

const TEMP_PRESETS = [
  { value: 0.0, label: '0.0', hint: 'Mínima — siempre lo más probable' },
  { value: 0.7, label: '0.7', hint: 'Equilibrada' },
  { value: 1.0, label: '1.0', hint: 'Por defecto' },
  { value: 1.5, label: '1.5', hint: 'Creativa' },
  { value: 2.0, label: '2.0', hint: 'Máxima — muy aleatoria' },
];

export function TemperatureModule({ tab, module, onMainAction }: ModuleProps) {
  const { authed } = useApp();
  const [input, setInput] = useState('');
  const [temperature, setTemperature] = useState(1.0);
  const [running, setRunning] = useState(false);
  // What the currently shown results were generated with.
  const [resultPrompt, setResultPrompt] = useState('');
  const [resultTemp, setResultTemp] = useState(1.0);
  const [slots, setSlots] = useState<CompareSlot[]>([]);
  const [selected, setSelected] = useState<
    { key: string; rect: DOMRect; token: string; prob: number } | null
  >(null);
  const abortRef = useRef<AbortController | null>(null);

  function openToken(e: React.MouseEvent, key: string, tok: SlotToken) {
    const rect = e.currentTarget.getBoundingClientRect();
    setSelected((prev) => (prev?.key === key ? null : { key, rect, token: tok.text, prob: tok.prob }));
  }

  async function generate(textArg?: string) {
    const prompt = (textArg ?? input).trim();
    if (!prompt || !authed || running) return;
    onMainAction?.();
    setResultPrompt(prompt);
    setResultTemp(temperature);
    setSlots([
      { tokens: [], done: false },
      { tokens: [], done: false },
      { tokens: [], done: false },
    ]);
    setRunning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    async function runOne(slotIndex: number) {
      try {
        for await (const ti of streamTokens({
          model: TEMPERATURE_MODEL,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature },
          signal: ctrl.signal,
        })) {
          setSlots((s) => {
            const next = [...s];
            const slot = next[slotIndex];
            next[slotIndex] = {
              ...slot,
              tokens: [...slot.tokens, { text: ti.token, prob: ti.prob }],
            };
            return next;
          });
        }
        setSlots((s) => {
          const next = [...s];
          next[slotIndex] = { ...next[slotIndex], done: true };
          return next;
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          const msg = err instanceof LlmError ? err.userMessage : 'Error';
          setSlots((s) => {
            const next = [...s];
            next[slotIndex] = { ...next[slotIndex], done: true, error: msg };
            return next;
          });
        }
      }
    }

    await Promise.all([runOne(0), runOne(1), runOne(2)]);
    setRunning(false);
    abortRef.current = null;
  }

  function stop() {
    abortRef.current?.abort();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void generate();
    }
  }

  const ControlsPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="font-semibold text-ink text-sm">Prueba la temperatura</div>
        <div className="text-xs text-muted">
          Escribe una pregunta, ajusta la temperatura y genera tres respuestas
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {/* Help: what temperature actually does */}
        <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 text-sm text-ink">
          <p className="mb-2">
            <strong>¿Qué es la temperatura?</strong> Es cuánta aleatoriedad usa el modelo al elegir
            cada palabra. En cada paso el modelo tiene varias opciones posibles con distinta
            probabilidad.
          </p>
          <ul className="space-y-1 text-body list-disc list-inside marker:text-brand-500">
            <li>
              <strong>Temperatura 0:</strong> elige casi siempre la palabra más probable → respuestas
              muy parecidas entre sí.
            </li>
            <li>
              <strong>Temperatura 2</strong> (el máximo): reparte la elección entre más opciones →
              respuestas mucho más variadas e impredecibles.
            </li>
          </ul>
          <p className="text-muted mt-2">
            Genera tres respuestas a la misma pregunta y observa cuánto se parecen según la
            temperatura que elijas.
          </p>
        </div>

        {/* Question */}
        <div>
          <label htmlFor="temp-q" className="text-xs font-medium text-ink">
            Tu pregunta
          </label>
          <textarea
            id="temp-q"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta…"
            rows={3}
            className="mt-1 w-full resize-none px-3 py-2 rounded-lg border border-border bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
            disabled={running}
          />
          {module.promptHint && !input && (
            <button
              type="button"
              onClick={() => setInput(module.promptHint!)}
              className="mt-2 inline-block text-left px-3 py-2 rounded-lg bg-surface border border-border text-body italic text-sm hover:bg-brand-50 hover:border-brand-100 transition-colors"
            >
              "{module.promptHint}"
            </button>
          )}
        </div>

        {/* Temperature slider */}
        <TemperatureSlider value={temperature} onChange={setTemperature} disabled={running} />
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
            onClick={() => void generate()}
            disabled={!input.trim()}
            className="w-full px-4 py-2.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            Generar 3 respuestas con temperatura {temperature.toFixed(1)}
          </button>
        )}
      </div>
    </div>
  );

  const ResultsPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="font-semibold text-ink text-sm">Tres respuestas, misma pregunta</div>
        <div className="text-xs text-muted">Cuánto se parecen depende de la temperatura</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-3">
        {slots.length === 0 ? (
          <div className="text-center text-sm text-muted py-10">
            Escribe una pregunta y presiona <strong className="text-ink">"Generar 3 respuestas"</strong>{' '}
            para ver el efecto de la temperatura.
          </div>
        ) : (
          <>
            <div className="text-xs text-muted">
              Pregunta: <span className="text-body">"{resultPrompt}"</span> · temperatura{' '}
              <strong className="text-ink">{resultTemp.toFixed(1)}</strong>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {slots.map((slot, i) => (
                <div
                  key={i}
                  className="bg-surface border border-border rounded-lg p-3 text-sm text-body whitespace-pre-wrap"
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1.5">
                    Respuesta {i + 1}
                    {!slot.done && <span className="ml-2 text-brand-600 normal-case">generando…</span>}
                  </div>
                  {slot.error ? (
                    <div className="text-red-700">{slot.error}</div>
                  ) : slot.tokens.length > 0 ? (
                    slot.tokens.map((tok, k) => (
                      <span
                        key={k}
                        data-token-chip
                        onClick={(e) => openToken(e, `s${i}-${k}`, tok)}
                        style={tint(tok.prob)}
                        className="rounded-sm cursor-pointer"
                      >
                        {tok.text}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted italic">…</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-border px-4 py-2 shrink-0 space-y-1.5">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span>Improbable</span>
          <span
            className="h-2 flex-1 rounded-full"
            style={{ background: 'linear-gradient(90deg, hsl(0,85%,80%), hsl(60,85%,80%), hsl(120,85%,80%))' }}
          />
          <span>Probable</span>
        </div>
        <p className="text-xs text-muted">
          Cada token está teñido por la probabilidad que el modelo le dio; toca uno para ver el
          porcentaje. Con temperatura alta verás más tokens improbables (rojizos): por eso las
          respuestas divergen. Incluso en temperatura 0 pueden aparecer pequeñas diferencias: el
          servicio no es 100% determinista.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <div className={tab === 'chat' ? 'block' : 'hidden lg:block'}>{ControlsPane}</div>
      <div className={tab === 'viz' ? 'block' : 'hidden lg:block'}>{ResultsPane}</div>
      {selected && (
        <TokenPopover
          anchor={selected.rect}
          token={selected.token}
          prob={selected.prob}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function TemperatureSlider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor="temp" className="text-xs font-medium text-ink">
          Temperatura
        </label>
        <span className="text-xs text-muted tabular-nums">
          <strong className="text-ink">{value.toFixed(1)}</strong> / 2.0
        </span>
      </div>
      <input
        id="temp"
        type="range"
        min={0}
        max={2}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full accent-brand-500"
      />
      <div className="flex justify-between gap-1 mt-1">
        {TEMP_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            disabled={disabled}
            title={p.hint}
            className={
              'text-[10px] px-1.5 py-0.5 rounded ' +
              (Math.abs(value - p.value) < 0.05
                ? 'bg-brand-500 text-white font-semibold'
                : 'text-muted hover:text-ink hover:bg-surface')
            }
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
