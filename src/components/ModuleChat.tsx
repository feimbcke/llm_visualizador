import { useRef, useState } from 'react';
import { GeminiError, streamText, type Content } from '../lib/gemini';
import { useApp } from '../state/AppContext';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface ModuleChatProps {
  /** When this changes (e.g. you switch modules), the component remounts and chat resets. */
  moduleId: string;
  /** Optional Spanish suggestion shown when the chat is empty. */
  promptHint?: string;
}

export function ModuleChat({ promptHint }: ModuleChatProps) {
  const { apiKey } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || !apiKey || streaming) return;

    setError(null);
    setInput('');

    const nextMessages: Message[] = [
      ...messages,
      { role: 'user', text },
      { role: 'model', text: '' },
    ];
    setMessages(nextMessages);
    setStreaming(true);

    const contents: Content[] = nextMessages
      .slice(0, -1)
      .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      for await (const delta of streamText({ apiKey, contents, signal: ctrl.signal })) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, text: last.text + delta };
          return updated;
        });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(
          err instanceof GeminiError ? err.userMessage : 'Algo falló al generar la respuesta.',
        );
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'model' && last.text === '') return prev.slice(0, -1);
          return prev;
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
    setMessages([]);
    setError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <div className="font-semibold text-ink">Chat</div>
          <div className="text-xs text-muted">Gemini 2.5 Flash · respuesta en streaming</div>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={reset} className="text-sm text-muted hover:text-ink">
            Limpiar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted py-6 space-y-3">
            <p>Escribe un mensaje para empezar.</p>
            {promptHint && (
              <button
                type="button"
                onClick={() => void send(promptHint)}
                className="inline-block text-left px-3 py-2 rounded-lg bg-surface border border-border text-body italic hover:bg-brand-50 hover:border-brand-100 transition-colors"
              >
                "{promptHint}"
              </button>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[85%] bg-brand-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 whitespace-pre-wrap'
                  : 'max-w-[85%] bg-surface border border-border text-body rounded-2xl rounded-tl-sm px-4 py-2.5 whitespace-pre-wrap'
              }
            >
              {m.text || <span className="text-muted italic">…</span>}
            </div>
          </div>
        ))}

        {error && (
          <div
            role="alert"
            className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3"
          >
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
              onClick={() => void send()}
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
}
