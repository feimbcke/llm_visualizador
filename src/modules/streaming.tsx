import { useEffect, useRef, useState } from 'react';
import { GeminiError, streamText } from '../lib/gemini';
import { useApp } from '../state/AppContext';
import type { ModuleProps } from './registry';

interface Chunk {
  text: string;
  /** ms since stream start */
  t: number;
}

export function StreamingModule({ tab, module }: ModuleProps) {
  const { apiKey } = useApp();
  const [input, setInput] = useState('');
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const vizScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // auto-scroll the chip area as new fragments arrive
    if (vizScrollRef.current) {
      vizScrollRef.current.scrollTop = vizScrollRef.current.scrollHeight;
    }
  }, [chunks.length]);

  async function run(textArg?: string) {
    const prompt = (textArg ?? input).trim();
    if (!prompt || !apiKey || streaming) return;
    setInput('');
    setChunks([]);
    setError(null);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t0 = performance.now();
    try {
      for await (const delta of streamText({
        apiKey,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        signal: ctrl.signal,
      })) {
        setChunks((prev) => [...prev, { text: delta, t: performance.now() - t0 }]);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof GeminiError ? err.userMessage : 'Algo falló al generar.');
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
    setChunks([]);
    setError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void run();
    }
  }

  const fullText = chunks.map((c) => c.text).join('');
  const lastT = chunks.length > 0 ? chunks[chunks.length - 1].t : 0;
  const tokensPerSec = lastT > 0 ? (chunks.length / (lastT / 1000)).toFixed(1) : '0.0';

  const ChatPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <div className="font-semibold text-ink text-sm">Respuesta</div>
          <div className="text-xs text-muted">Así la verías en un chat</div>
        </div>
        {chunks.length > 0 && !streaming && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted hover:text-ink"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {chunks.length === 0 && !streaming && (
          <div className="text-center text-sm text-muted py-6 space-y-3">
            <p>Haz una pregunta y observa cómo se construye la respuesta fragmento a fragmento.</p>
            {module.promptHint && (
              <button
                type="button"
                onClick={() => void run(module.promptHint!)}
                className="inline-block text-left px-3 py-2 rounded-lg bg-surface border border-border text-body italic hover:bg-brand-50 hover:border-brand-100 transition-colors"
              >
                "{module.promptHint}"
              </button>
            )}
          </div>
        )}

        {(chunks.length > 0 || streaming) && (
          <div className="max-w-[90%] bg-surface border border-border text-body rounded-2xl rounded-tl-sm px-4 py-2.5 whitespace-pre-wrap">
            {fullText || <span className="text-muted italic">…</span>}
          </div>
        )}

        {error && (
          <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
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
          <div className="font-semibold text-ink text-sm">Fragmentos entrantes</div>
          <div className="text-xs text-muted">Cada paquete que envía el modelo</div>
        </div>
        <div className="text-xs text-muted tabular-nums text-right shrink-0">
          <div>
            <strong className="text-ink">{chunks.length}</strong> fragmentos
          </div>
          <div>
            {Math.round(lastT)} ms · {tokensPerSec}/s
          </div>
        </div>
      </div>

      <div ref={vizScrollRef} className="flex-1 overflow-y-auto p-4 min-h-0">
        {chunks.length === 0 && !streaming && (
          <div className="text-center text-sm text-muted py-6">
            Aún no hay fragmentos. Envía una pregunta para verlos llegar uno a uno.
          </div>
        )}

        {chunks.length > 0 && (
          <div className="flex flex-wrap gap-1 items-start content-start">
            {chunks.map((c, i) => {
              const prevT = i > 0 ? chunks[i - 1].t : 0;
              const delta = c.t - prevT;
              return (
                <span
                  key={i}
                  title={`#${i + 1} · +${Math.round(delta)} ms · ${c.text.length} caracteres`}
                  className="inline-block px-1.5 py-0.5 rounded-md bg-brand-50 border border-brand-100 text-brand-700 text-xs font-mono whitespace-pre"
                >
                  {c.text.replace(/\n/g, '↵')}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-border px-4 py-2 text-xs text-muted shrink-0">
        Los fragmentos del streaming aproximan los tokens reales del modelo. Cada chip representa
        el texto recibido en un paso del envío.
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
