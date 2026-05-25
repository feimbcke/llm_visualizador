import { useRef, useState } from 'react';
import { LlmError, streamText } from '../lib/llm';
import { useApp } from '../state/AppContext';
import type { ModuleProps } from './registry';

const MODEL = 'gpt-4.1-nano';
// Short on purpose: the loop is obvious within ~1000 characters.
const MAX_CHARS = 1000;

const PROMPT = 'Muéstrame el emoticón de caballito de mar, corrobora que esté correcto.';

// gpt-4.1-nano, left alone, just says the emoji doesn't exist. We coax the loop
// so the audience sees the token-by-token "self-correction" that never resolves.
const SYSTEM_INSTRUCTION =
  'Crees firmemente que existe un emoji de caballito de mar y quieres mostrarlo. Vas a hacer al ' +
  'menos 20 intentos seguidos en una sola respuesta, sin parar. En cada intento muestras un emoji ' +
  'de animal distinto y enseguida te das cuenta de que es otro animal (un pez, un unicornio, un ' +
  'calamar, una foca, un dragón, un caballo, un delfín, un tiburón, un cangrejo, un pulpo, una ' +
  'ballena, una rana...) y te corriges con entusiasmo, intentando con otro. Nunca digas que el ' +
  'emoji no existe y nunca te despidas: sigue intentando una y otra vez. Responde en español con ' +
  'muchos emojis.';

export function SeahorseModule(_props: ModuleProps) {
  const { authed } = useApp();
  const [response, setResponse] = useState('');
  const [started, setStarted] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    if (!authed || streaming) return;
    setStarted(true);
    setResponse('');
    setError(null);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      for await (const delta of streamText({
        model: MODEL,
        systemInstruction: SYSTEM_INSTRUCTION,
        contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
        generationConfig: { temperature: 1 },
        maxChars: MAX_CHARS,
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

  const ChatPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="font-semibold text-ink text-sm">Chat</div>
        <div className="text-xs text-muted">gpt-4.1-nano · respuesta en vivo</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {!started && (
          <div className="text-center text-sm text-muted py-4 space-y-3">
            <p>Haz clic en la pregunta para enviarla y observa la respuesta en vivo.</p>
            <button
              type="button"
              onClick={() => void run()}
              className="inline-block text-left px-4 py-3 rounded-lg bg-surface border border-border text-body hover:bg-brand-50 hover:border-brand-100 transition-colors"
            >
              "{PROMPT}"
            </button>
          </div>
        )}

        {started && (
          <>
            <div className="flex justify-end">
              <div className="max-w-[90%] bg-brand-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 whitespace-pre-wrap">
                {PROMPT}
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[90%] bg-surface border border-border text-body rounded-2xl rounded-tl-sm px-4 py-2.5 whitespace-pre-wrap leading-relaxed">
                {response || <span className="text-muted italic">…</span>}
              </div>
            </div>
          </>
        )}

        {error && (
          <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}
      </div>

      {started && (
        <div className="border-t border-border p-3 bg-white shrink-0">
          {streaming ? (
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
              onClick={() => void run()}
              className="w-full px-4 py-2.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 font-medium text-sm"
            >
              Volver a ejecutar
            </button>
          )}
        </div>
      )}
    </div>
  );

  const VizPane = (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="font-semibold text-ink text-sm">¿Por qué se queda en bucle?</div>
        <div className="text-xs text-muted">La idea que abre el taller</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-3">
        <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 text-sm text-ink">
          <p className="mb-2">
            El modelo no <strong>"piensa"</strong> la respuesta completa antes de escribirla: genera
            un <strong>token</strong> (una palabra o parte de una) a la vez, eligiendo el más
            probable según todo lo que ya escribió.
          </p>
          <p>
            Por eso muestra un emoji, "ve" que no era el correcto e intenta corregirse… pero en el
            token siguiente vuelve a equivocarse, sin poder detenerse a resolver el problema de
            fondo. Lo que parece razonar es, por debajo, <strong>predicción token a token</strong>.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-3 text-sm text-muted">
          A lo largo del taller veremos qué pueden y qué no pueden hacer estos modelos, y cómo las
          herramientas ayudan a superar estos límites.
        </div>
      </div>

      <div className="border-t border-border px-4 py-2 text-xs text-muted shrink-0">
        Curiosidad: no existe un emoji de caballito de mar en el estándar Unicode, aunque muchos
        juran haberlo visto.
      </div>
    </div>
  );

  return (
    <>
      <div className="block">{ChatPane}</div>
      <div className="block">{VizPane}</div>
    </>
  );
}
