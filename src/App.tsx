export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold"
            >
              CA
            </div>
            <div className="leading-tight">
              <div className="text-ink font-semibold">Modelos de Lenguaje en Salud</div>
              <div className="text-muted text-xs">Clínica Alemana · Taller interactivo</div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="bg-white border border-border rounded-xl shadow-sm p-8">
            <h1 className="text-2xl font-semibold text-ink mb-2">Hola 👋</h1>
            <p className="text-body mb-6">
              El sitio del taller está en construcción. Pronto vas a poder explorar 8 módulos
              interactivos sobre cómo funcionan los modelos de lenguaje, usando tu propia clave
              gratuita de Gemini.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors"
              >
                Botón primario
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-white text-brand-500 font-medium border border-brand-500 hover:bg-brand-50 transition-colors"
              >
                Botón secundario
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-muted">
          Taller · Modelos de Lenguaje en Salud · Clínica Alemana
        </div>
      </footer>
    </div>
  );
}
