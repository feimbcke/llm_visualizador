import { useEffect, useRef, useState } from 'react';
import { LlmError, streamTokens, type Content } from '../lib/llm';
import { useApp } from '../state/AppContext';
import type { ModuleProps } from './registry';

// gpt-4.1-nano (non-reasoning) is the only nano that exposes per-token
// logprobs, which this module uses to color tokens by probability.
const MODEL = 'gpt-4.1-nano';

interface Tok {
  text: string;
  /** linear probability 0–1 of this token */
  prob: number;
  alternatives: { token: string; prob: number }[];
  /** ms since this response's stream start */
  t: number;
}

interface Turn {
  question: string;
  tokens: Tok[];
  done: boolean;
  error?: string;
}

/** Rough visual approximation of how a tokenizer splits the user's text. */
function approximateTokens(text: string): string[] {
  return text.match(/\s*\S+/g) ?? [];
}

/** Probability → background/border color: red (improbable) → green (probable). */
function probStyle(prob: number): React.CSSProperties {
  const h = Math.max(0, Math.min(120, prob * 120));
  return {
    backgroundColor: `hsl(${h}, 85%, 90%)`,
    borderColor: `hsl(${h}, 55%, 70%)`,
  };
}

function show(token: string): string {
  return token.replace(/\n/g, '↵');
}

function tokenTitle(tok: Tok): string {
  const lines = [`"${show(tok.text)}" · ${(tok.prob * 100).toFixed(1)}% probable`];
  if (tok.alternatives.length > 0) {
    lines.push('Alternativas:');
    for (const a of tok.alternatives.slice(0, 3)) {
      lines.push(`  "${show(a.token)}" ${(a.prob * 100).toFixed(1)}%`);
    }
  }
  return lines.join('\n');
}

export function StreamingModule({ tab, module }: ModuleProps) {
  const { authed } = useApp();
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const vizScrollRef = useRef<HTMLDivElement | null>(null);

  const totalTokens = turns.reduce(
    (sum, t) => sum + approximateTokens(t.question).length + t.tokens.length,
    0,
  );

  useEffect(() => {
    if (vizScrollRef.current) {
      vizScrollRef.current.scrollTop = vizScrollRef.current.scrollHeight;
    }
  }, [totalTokens]);

  async function run(textArg?: string) {
    const prompt = (textArg ?? input).trim();
    if (!prompt || !authed || streaming) return;
    setInput('');
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Send the whole conversation so the model keeps context across turns.
    const contents: Content[] = [];
    for (const t of turns) {
      contents.push({ role: 'user', parts: [{ text: t.question }] });
      const response = t.tokens.map((tok) => tok.text).join('');
      if (response) contents.push({ role: 'model', parts: [{ text: response }] });
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    setTurns((prev) => [...prev, { question: prompt, tokens: [], done: false }]);

    const t0 = performance.now();
    try {
      for await (const ti of streamTokens({ model: MODEL, contents, signal: ctrl.signal })) {
        setTurns((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = {
            ...last,
            tokens: [
              ...last.tokens,
              {
                text: ti.token,
                prob: ti.prob,
                alternatives: ti.alternatives,
                t: performance.now() - t0,
              },
            ],
          };
          return next;
        });
      }
      setTurns((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], done: true };
        return next;
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = err instanceof LlmError ? err.userMessage : 'Algo falló al generar.';
        setTurns((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], done: true, error: msg };
          return next;
        });
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
    setTurns([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void run();
    }
  }

  const lastTokens = turns.length > 0 ? turns[turns.length - 1].tokens : [];
  const lastT = lastTokens.length > 0 ? lastTokens[lastTokens.length - 1].t : 0;
  const tokensPerSec = lastT > 0 ? (lastTokens.length / (lastT / 1000)).toFixed(1) : '0.0';

  const ChatPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <div className="font-semibold text-ink text-sm">Conversación</div>
          <div className="text-xs text-muted">Así la verías en un chat</div>
        </div>
        {turns.length > 0 && !streaming && (
          <button type="button" onClick={reset} className="text-xs text-muted hover:text-ink">
            Limpiar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {turns.length === 0 && !streaming && (
          <div className="text-center text-sm text-muted py-6 space-y-3">
            <p>Haz una pregunta y observa cómo se construye la respuesta token a token.</p>
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

        {turns.map((turn, i) => {
          const responseText = turn.tokens.map((tok) => tok.text).join('');
          return (
            <div key={i} className="space-y-2">
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-brand-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 whitespace-pre-wrap">
                  {turn.question}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-surface border border-border text-body rounded-2xl rounded-tl-sm px-4 py-2.5 whitespace-pre-wrap">
                  {turn.error ? (
                    <span className="text-red-700">{turn.error}</span>
                  ) : (
                    responseText || <span className="text-muted italic">…</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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
          <div className="font-semibold text-ink text-sm">Tokens</div>
          <div className="text-xs text-muted">Coloreados por probabilidad · pasa el cursor para ver alternativas</div>
        </div>
        <div className="text-xs text-muted tabular-nums text-right shrink-0">
          <div>
            <strong className="text-ink">{totalTokens}</strong> tokens
          </div>
          <div>
            {Math.round(lastT)} ms · {tokensPerSec}/s
          </div>
        </div>
      </div>

      <div ref={vizScrollRef} className="flex-1 overflow-y-auto p-4 min-h-0 space-y-4">
        {turns.length === 0 && !streaming && (
          <div className="text-center text-sm text-muted py-6">
            Aún no hay tokens. Envía una pregunta para verlos llegar uno a uno.
          </div>
        )}

        {turns.map((turn, ti) => {
          const questionTokens = approximateTokens(turn.question);
          return (
            <div key={ti} className="space-y-2">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1">
                  Tú · {questionTokens.length} tokens
                </div>
                <div className="flex flex-wrap gap-1 items-start content-start">
                  {questionTokens.map((tok, i) => (
                    <span
                      key={i}
                      className="inline-block px-1.5 py-0.5 rounded-md bg-surface border border-border text-ink text-xs font-mono whitespace-pre"
                    >
                      {show(tok)}
                    </span>
                  ))}
                </div>
              </div>

              {(turn.tokens.length > 0 || turn.error) && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1">
                    Modelo · {turn.tokens.length} tokens
                  </div>
                  {turn.error ? (
                    <div className="text-xs text-red-700">{turn.error}</div>
                  ) : (
                    <div className="flex flex-wrap gap-1 items-start content-start">
                      {turn.tokens.map((tok, i) => (
                        <span
                          key={i}
                          title={tokenTitle(tok)}
                          style={probStyle(tok.prob)}
                          className="inline-block px-1.5 py-0.5 rounded-md border text-ink text-xs font-mono whitespace-pre cursor-help"
                        >
                          {show(tok.text)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
          El color es la probabilidad que el modelo le dio a cada token al elegirlo. Pasa el cursor
          sobre un token para ver las alternativas que consideró. (Los tokens de tu pregunta son una
          aproximación.)
        </p>
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
