import { useRef, useState } from 'react';
import { GeminiError, streamText } from '../lib/gemini';
import { useApp } from '../state/AppContext';
import type { ModuleProps } from './registry';

interface Turn {
  prompt: string;
  response: string;
  temperature: number;
}

interface CompareSlot {
  text: string;
  done: boolean;
  error?: string;
}

const TEMP_PRESETS = [
  { value: 0.0, label: '0.0', hint: 'Mínima — siempre lo más probable' },
  { value: 0.7, label: '0.7', hint: 'Equilibrada' },
  { value: 1.0, label: '1.0', hint: 'Por defecto' },
  { value: 1.5, label: '1.5', hint: 'Creativa' },
  { value: 2.0, label: '2.0', hint: 'Máxima — muy aleatoria' },
];

export function TemperatureModule({ tab, module }: ModuleProps) {
  const { apiKey } = useApp();
  const [input, setInput] = useState('');
  const [temperature, setTemperature] = useState(1.0);
  const [history, setHistory] = useState<Turn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  // 3-up comparison state
  const [compareRunning, setCompareRunning] = useState(false);
  const [comparePrompt, setComparePrompt] = useState('');
  const [compareTemp, setCompareTemp] = useState(1.0);
  const [compareSlots, setCompareSlots] = useState<CompareSlot[]>([]);
  const compareAbortRef = useRef<AbortController | null>(null);

  async function sendSingle(textArg?: string) {
    const prompt = (textArg ?? input).trim();
    if (!prompt || !apiKey || streaming) return;
    setInput('');
    setChatError(null);
    setHistory((h) => [...h, { prompt, response: '', temperature }]);
    setStreaming(true);
    const ctrl = new AbortController();
    chatAbortRef.current = ctrl;

    try {
      for await (const delta of streamText({
        apiKey,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature },
        signal: ctrl.signal,
      })) {
        setHistory((h) => {
          const next = [...h];
          next[next.length - 1] = {
            ...next[next.length - 1],
            response: next[next.length - 1].response + delta,
          };
          return next;
        });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setChatError(err instanceof GeminiError ? err.userMessage : 'Algo falló al generar.');
      }
    } finally {
      setStreaming(false);
      chatAbortRef.current = null;
    }
  }

  async function runCompare() {
    const prompt = comparePrompt.trim() || input.trim();
    if (!prompt || !apiKey || compareRunning) return;
    setComparePrompt(prompt);
    setCompareTemp(temperature);
    setCompareSlots([
      { text: '', done: false },
      { text: '', done: false },
      { text: '', done: false },
    ]);
    setCompareRunning(true);
    const ctrl = new AbortController();
    compareAbortRef.current = ctrl;

    async function runOne(slotIndex: number) {
      try {
        for await (const delta of streamText({
          apiKey: apiKey!,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature },
          signal: ctrl.signal,
        })) {
          setCompareSlots((s) => {
            const next = [...s];
            next[slotIndex] = { ...next[slotIndex], text: next[slotIndex].text + delta };
            return next;
          });
        }
        setCompareSlots((s) => {
          const next = [...s];
          next[slotIndex] = { ...next[slotIndex], done: true };
          return next;
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          const msg = err instanceof GeminiError ? err.userMessage : 'Error';
          setCompareSlots((s) => {
            const next = [...s];
            next[slotIndex] = { ...next[slotIndex], done: true, error: msg };
            return next;
          });
        }
      }
    }

    await Promise.all([runOne(0), runOne(1), runOne(2)]);
    setCompareRunning(false);
    compareAbortRef.current = null;
  }

  function stopAll() {
    chatAbortRef.current?.abort();
    compareAbortRef.current?.abort();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendSingle();
    }
  }

  const ChatPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-ink text-sm">Chat con temperatura</div>
          <div className="text-xs text-muted">
            Repite la misma pregunta para ver cuánto cambia la respuesta
          </div>
        </div>
        {history.length > 0 && !streaming && (
          <button
            type="button"
            onClick={() => setHistory([])}
            className="text-xs text-muted hover:text-ink shrink-0"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {history.length === 0 && !streaming && (
          <div className="text-center text-sm text-muted py-6 space-y-3">
            <p>Ajusta la temperatura y envía la misma pregunta varias veces.</p>
            {module.promptHint && (
              <button
                type="button"
                onClick={() => void sendSingle(module.promptHint!)}
                className="inline-block text-left px-3 py-2 rounded-lg bg-surface border border-border text-body italic hover:bg-brand-50 hover:border-brand-100 transition-colors"
              >
                "{module.promptHint}"
              </button>
            )}
          </div>
        )}

        {history.map((turn, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-end">
              <div className="max-w-[85%] bg-brand-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 whitespace-pre-wrap">
                {turn.prompt}
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-surface border border-border text-body rounded-2xl rounded-tl-sm px-4 py-2.5 whitespace-pre-wrap">
                <div className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1">
                  temperatura {turn.temperature.toFixed(1)}
                </div>
                {turn.response || <span className="text-muted italic">…</span>}
              </div>
            </div>
          </div>
        ))}

        {chatError && (
          <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {chatError}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3 bg-white shrink-0 space-y-2">
        <TemperatureSlider value={temperature} onChange={setTemperature} disabled={streaming} />
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
              onClick={stopAll}
              className="px-4 py-2 rounded-lg border border-border text-ink hover:bg-surface font-medium text-sm shrink-0"
            >
              Detener
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void sendSingle()}
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
          <div className="font-semibold text-ink text-sm">Tres respuestas, misma pregunta</div>
          <div className="text-xs text-muted">
            Cuánto se parecen depende de la temperatura
          </div>
        </div>
        <button
          type="button"
          onClick={compareRunning ? stopAll : runCompare}
          disabled={!input.trim() && !comparePrompt.trim() && !compareRunning}
          className={
            compareRunning
              ? 'px-3 py-1.5 rounded-lg border border-border text-ink hover:bg-surface text-sm font-medium shrink-0'
              : 'px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shrink-0'
          }
        >
          {compareRunning ? 'Detener' : 'Generar 3 respuestas'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-3">
        {compareSlots.length === 0 && (
          <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 text-sm text-ink">
            <p className="mb-2">
              <strong>La temperatura</strong> controla qué tan "creativo" es el modelo al elegir cada
              token. Con temperatura <strong>0</strong> casi siempre elige la palabra más probable;
              con temperatura <strong>2</strong> elige con mucha más aleatoriedad.
            </p>
            <p className="text-muted">
              Escribe una pregunta en el chat (o usa la sugerencia) y presiona "Generar 3
              respuestas" para comparar tres salidas independientes con la temperatura actual.
            </p>
          </div>
        )}

        {compareSlots.length > 0 && (
          <>
            <div className="text-xs text-muted">
              Pregunta: <span className="text-body">"{comparePrompt}"</span> · temperatura{' '}
              <strong className="text-ink">{compareTemp.toFixed(1)}</strong>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {compareSlots.map((slot, i) => (
                <div
                  key={i}
                  className="bg-surface border border-border rounded-lg p-3 text-sm text-body whitespace-pre-wrap"
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1.5">
                    Respuesta {i + 1}
                    {!slot.done && (
                      <span className="ml-2 text-brand-600 normal-case">generando…</span>
                    )}
                  </div>
                  {slot.error ? (
                    <div className="text-red-700">{slot.error}</div>
                  ) : (
                    slot.text || <span className="text-muted italic">…</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-border px-4 py-2 text-xs text-muted shrink-0">
        Las tres respuestas usan la misma pregunta y la misma temperatura. Las diferencias vienen
        del muestreo aleatorio al generar cada token.
      </div>
    </div>
  );

  return (
    <>
      <div className={tab === 'chat' ? 'block' : 'hidden lg:block'}>{ChatPane}</div>
      <div className={tab === 'viz' ? 'block' : 'hidden lg:block'}>{VizPane}</div>
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
