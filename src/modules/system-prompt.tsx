import { useRef, useState } from 'react';
import { LlmError, streamText, type Content } from '../lib/llm';
import { useApp } from '../state/AppContext';
import type { ModuleProps } from './registry';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface ComparisonResult {
  presetLabel: string;
  systemPrompt: string;
  text: string;
  done: boolean;
  error?: string;
}

const PRESETS = [
  {
    id: 'cautious',
    label: 'Médico cauteloso',
    text:
      'Eres un médico internista con 20 años de experiencia. Respondes con rigor, citas niveles de evidencia cuando aplica, y eres explícito en señalar incertidumbre y limitaciones. Si el caso es complejo, recomiendas derivación o evaluación clínica directa.',
  },
  {
    id: 'student',
    label: 'Estudiante de medicina',
    text:
      'Eres un estudiante de medicina entusiasta de tercer año. Respondes con la lógica que aprendiste en las clases, mencionando lo que recuerdas de los apuntes. A veces te excedes en detalles teóricos y puedes mezclar conceptos.',
  },
  {
    id: 'concise',
    label: 'Asistente técnico conciso',
    text:
      'Responde de manera técnica y concisa, en máximo 3 oraciones, sin disclaimers innecesarios.',
  },
  {
    id: 'patient',
    label: 'Explicación al paciente',
    text:
      'Eres un médico explicando a un paciente sin formación clínica. Usa lenguaje sencillo, analogías y oraciones cortas. Evita la jerga; si la necesitas, defínela.',
  },
];

export function SystemPromptModule({ tab, module }: ModuleProps) {
  const { authed } = useApp();
  const [systemPrompt, setSystemPrompt] = useState(PRESETS[0].text);
  const [activePresetId, setActivePresetId] = useState<string | null>(PRESETS[0].id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  const [compareRunning, setCompareRunning] = useState(false);
  const [comparePrompt, setComparePrompt] = useState('');
  const [comparison, setComparison] = useState<ComparisonResult[]>([]);
  const compareAbortRef = useRef<AbortController | null>(null);

  function applyPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setSystemPrompt(p.text);
    setActivePresetId(id);
  }

  function onEditSystemPrompt(value: string) {
    setSystemPrompt(value);
    setActivePresetId(null);
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || !authed || streaming) return;
    setInput('');
    setChatError(null);
    const next: Message[] = [
      ...messages,
      { role: 'user', text },
      { role: 'model', text: '' },
    ];
    setMessages(next);
    setStreaming(true);
    const ctrl = new AbortController();
    chatAbortRef.current = ctrl;

    const contents: Content[] = next.slice(0, -1).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    try {
      for await (const delta of streamText({
        contents,
        systemInstruction: systemPrompt,
        signal: ctrl.signal,
      })) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, text: last.text + delta };
          return updated;
        });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setChatError(err instanceof LlmError ? err.userMessage : 'Algo falló al generar.');
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'model' && last.text === '') return prev.slice(0, -1);
          return prev;
        });
      }
    } finally {
      setStreaming(false);
      chatAbortRef.current = null;
    }
  }

  async function runCompare() {
    // Use the last user message if present, otherwise the input box
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.text;
    const text = (input.trim() || lastUser || '').trim();
    if (!text || !authed || compareRunning) return;
    setComparePrompt(text);
    const slots: ComparisonResult[] = PRESETS.map((p) => ({
      presetLabel: p.label,
      systemPrompt: p.text,
      text: '',
      done: false,
    }));
    setComparison(slots);
    setCompareRunning(true);
    const ctrl = new AbortController();
    compareAbortRef.current = ctrl;

    async function runOne(idx: number) {
      try {
        for await (const delta of streamText({
          contents: [{ role: 'user', parts: [{ text }] }],
          systemInstruction: slots[idx].systemPrompt,
          signal: ctrl.signal,
        })) {
          setComparison((s) => {
            const next = [...s];
            next[idx] = { ...next[idx], text: next[idx].text + delta };
            return next;
          });
        }
        setComparison((s) => {
          const next = [...s];
          next[idx] = { ...next[idx], done: true };
          return next;
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          const msg = err instanceof LlmError ? err.userMessage : 'Error';
          setComparison((s) => {
            const next = [...s];
            next[idx] = { ...next[idx], done: true, error: msg };
            return next;
          });
        }
      }
    }

    await Promise.all(PRESETS.map((_, i) => runOne(i)));
    setCompareRunning(false);
    compareAbortRef.current = null;
  }

  function stopAll() {
    chatAbortRef.current?.abort();
    compareAbortRef.current?.abort();
  }

  function reset() {
    setMessages([]);
    setChatError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const ChatPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-ink text-sm">Chat con prompt de sistema</div>
          <div className="text-xs text-muted truncate">
            Rol activo:{' '}
            <strong className="text-ink">
              {activePresetId ? PRESETS.find((p) => p.id === activePresetId)!.label : 'Personalizado'}
            </strong>
          </div>
        </div>
        {messages.length > 0 && !streaming && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted hover:text-ink shrink-0"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted py-6 space-y-3">
            <p>Edita el prompt de sistema en el panel de visualización y luego envía una pregunta.</p>
            {module.promptHint && (
              <button
                type="button"
                onClick={() => void send(module.promptHint!)}
                className="inline-block text-left px-3 py-2 rounded-lg bg-surface border border-border text-body italic hover:bg-brand-50 hover:border-brand-100 transition-colors"
              >
                "{module.promptHint}"
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

        {chatError && (
          <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {chatError}
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
              onClick={stopAll}
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

  const VizPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="font-semibold text-ink text-sm">Prompt de sistema</div>
        <div className="text-xs text-muted">El "rol" que le damos al modelo antes de hablar</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-4">
        <div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={
                  'text-xs px-2.5 py-1 rounded-full border transition-colors ' +
                  (activePresetId === p.id
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white text-body border-border hover:border-brand-500 hover:text-brand-700')
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          <textarea
            value={systemPrompt}
            onChange={(e) => onEditSystemPrompt(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm font-mono leading-relaxed resize-y"
            placeholder="Eres un asistente que..."
          />
          <p className="text-xs text-muted mt-1">
            Cambia el prompt y envía la misma pregunta para ver cómo cambia la respuesta.
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-semibold text-ink text-sm">Comparar los 4 roles</div>
              <div className="text-xs text-muted">Misma pregunta, distintos prompts de sistema</div>
            </div>
            <button
              type="button"
              onClick={compareRunning ? stopAll : runCompare}
              disabled={!compareRunning && !input.trim() && !messages.some((m) => m.role === 'user')}
              className={
                compareRunning
                  ? 'px-3 py-1.5 rounded-lg border border-border text-ink hover:bg-surface text-sm font-medium shrink-0'
                  : 'px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shrink-0'
              }
            >
              {compareRunning ? 'Detener' : 'Comparar'}
            </button>
          </div>

          {comparison.length === 0 ? (
            <p className="text-xs text-muted">
              Escribe una pregunta en el chat o envíala una vez, y luego presiona "Comparar" para
              ver cómo responde cada rol.
            </p>
          ) : (
            <>
              <div className="text-xs text-muted mb-2">
                Pregunta: <span className="text-body">"{comparePrompt}"</span>
              </div>
              <div className="space-y-2">
                {comparison.map((c, i) => (
                  <div key={i} className="bg-surface border border-border rounded-lg p-3 text-sm">
                    <div className="text-[10px] uppercase tracking-wide text-brand-700 font-semibold mb-1.5 flex items-center gap-2">
                      {c.presetLabel}
                      {!c.done && <span className="text-muted normal-case">generando…</span>}
                    </div>
                    {c.error ? (
                      <div className="text-red-700">{c.error}</div>
                    ) : (
                      <div className="text-body whitespace-pre-wrap">
                        {c.text || <span className="text-muted italic">…</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
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
