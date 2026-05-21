import { useState } from 'react';
import { LlmError } from '../lib/llm';
import { useApp } from '../state/AppContext';

export function Login() {
  const { login } = useApp();
  const [input, setInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const password = input.trim();
    if (!password) {
      setError('Ingresa la contraseña para continuar.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(password);
    } catch (err) {
      setError(err instanceof LlmError ? err.userMessage : 'No pude validar la contraseña.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white border border-border rounded-xl shadow-sm p-8">
        <p className="text-brand-700 text-sm font-medium mb-2">Taller interactivo</p>
        <h1 className="text-3xl font-bold text-ink mb-3">Modelos de Lenguaje en Salud</h1>
        <p className="text-body mb-6">
          En este taller vas a explorar — desde tu propio dispositivo — cómo funcionan los modelos
          de lenguaje (LLMs) que están entrando en la práctica clínica: cómo generan texto, cómo se
          equivocan, qué cosas pueden y qué cosas no.
        </p>

        <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 mb-6 text-sm text-ink">
          Para entrar necesitas la <strong>contraseña del taller</strong>. La compartimos al inicio
          de la sesión. No necesitas crear cuentas ni claves: todo funciona desde aquí.
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-ink">Contraseña del taller</span>
            <div className="mt-1 flex gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                inputMode="text"
                autoComplete="current-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escríbela aquí"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                disabled={submitting}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="px-3 py-2 rounded-lg border border-border text-muted hover:text-ink hover:bg-surface text-sm shrink-0"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>

          {error && (
            <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Validando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
