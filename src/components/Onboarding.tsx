import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { validateApiKey, GeminiError } from '../lib/gemini';
import { useApp } from '../state/AppContext';

const AI_STUDIO_URL = 'https://aistudio.google.com/apikey';

interface OnboardingProps {
  /** If true, we are re-entering onboarding from inside the app to change the key. */
  reentry?: boolean;
  onCancel?: () => void;
}

export function Onboarding({ reentry, onCancel }: OnboardingProps) {
  const { saveApiKey } = useApp();
  const [step, setStep] = useState<'intro' | 'key'>(reentry ? 'key' : 'intro');
  const [input, setInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qrDesktopRef = useRef<HTMLCanvasElement | null>(null);
  const qrMobileRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (step !== 'key') return;
    const opts = {
      width: 180,
      margin: 1,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    };
    for (const canvas of [qrDesktopRef.current, qrMobileRef.current]) {
      if (canvas) {
        QRCode.toCanvas(canvas, AI_STUDIO_URL, opts).catch(() => {
          /* QR rendering failure is non-fatal */
        });
      }
    }
  }, [step]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Pega tu clave para continuar.');
      return;
    }
    setValidating(true);
    setError(null);
    try {
      await validateApiKey(trimmed);
      saveApiKey(trimmed);
    } catch (err) {
      setError(err instanceof GeminiError ? err.userMessage : 'No pude validar la clave.');
    } finally {
      setValidating(false);
    }
  }

  if (step === 'intro') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white border border-border rounded-xl shadow-sm p-8">
          <p className="text-brand-700 text-sm font-medium mb-2">Taller interactivo</p>
          <h1 className="text-3xl font-bold text-ink mb-3">Modelos de Lenguaje en Salud</h1>
          <p className="text-body mb-6">
            En este taller vas a explorar — desde tu propio dispositivo — cómo funcionan los
            modelos de lenguaje (LLMs) que están entrando en la práctica clínica: cómo generan
            texto, cómo se equivocan, qué cosas pueden y qué cosas no.
          </p>

          <h2 className="text-lg font-semibold text-ink mb-2">¿Qué vas a necesitar?</h2>
          <ul className="text-body space-y-2 mb-6 list-disc list-inside marker:text-brand-500">
            <li>Una cuenta de Google.</li>
            <li>
              Una clave gratuita de <strong>Google AI Studio</strong> — la generamos juntos en el
              siguiente paso.
            </li>
            <li>Este dispositivo (computador o teléfono).</li>
          </ul>

          <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 mb-6 text-sm text-ink">
            <strong>Tu clave se guarda únicamente en este navegador.</strong> Nunca se envía a
            ningún servidor del taller. Solo viaja, cifrada, a Google cuando haces una consulta.
          </div>

          <button
            type="button"
            onClick={() => setStep('key')}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors"
          >
            Empecemos
          </button>
        </div>
      </div>
    );
  }

  // Step: key entry
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="bg-white border border-border rounded-xl shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-ink mb-2">Pega tu clave de Gemini</h1>
        <p className="text-body mb-6">
          Ve a Google AI Studio, crea una clave gratuita y pégala aquí abajo. Es un proceso de un
          minuto.
        </p>

        <div className="grid sm:grid-cols-[1fr_auto] gap-6 mb-6">
          <ol className="text-body space-y-3 list-decimal list-inside marker:text-brand-500 marker:font-semibold text-sm">
            <li>
              Abre{' '}
              <a
                href={AI_STUDIO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 underline hover:text-brand-700 break-all"
              >
                aistudio.google.com/apikey
              </a>{' '}
              en otra pestaña (o escanea el QR).
            </li>
            <li>Inicia sesión con tu cuenta de Google.</li>
            <li>
              Haz clic en <strong>"Crear clave de API"</strong> y acepta los términos.
            </li>
            <li>
              Copia la clave que aparece (empieza con <code>AIza…</code>) y pégala abajo.
            </li>
          </ol>
          <div className="hidden sm:flex flex-col items-center gap-2">
            <canvas ref={qrDesktopRef} className="rounded-md border border-border" aria-label="QR a Google AI Studio" />
            <span className="text-xs text-muted">Escanea para abrir</span>
          </div>
        </div>

        {/* Mobile QR (smaller, below the list) */}
        <div className="sm:hidden flex flex-col items-center gap-1 mb-6">
          <canvas ref={qrMobileRef} className="rounded-md border border-border" aria-label="QR a Google AI Studio" />
          <span className="text-xs text-muted">Escanea para abrir</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-ink">Tu clave</span>
            <div className="mt-1 flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="AIza..."
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono text-sm"
                disabled={validating}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="px-3 py-2 rounded-lg border border-border text-muted hover:text-ink hover:bg-surface text-sm shrink-0"
                aria-label={showKey ? 'Ocultar clave' : 'Mostrar clave'}
              >
                {showKey ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>

          {error && (
            <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="submit"
              disabled={validating}
              className="flex-1 px-4 py-2.5 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {validating ? 'Validando…' : 'Validar y guardar'}
            </button>
            {reentry && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 rounded-lg border border-border text-ink hover:bg-surface font-medium"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        <p className="text-xs text-muted mt-6">
          Tu clave se guarda en <code>localStorage</code> de este navegador. No se transmite a
          ningún servidor del taller, solo a Google cuando consultas el modelo.
        </p>
      </div>
    </div>
  );
}
