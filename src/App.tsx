export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              aria-hidden
              className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold shrink-0"
            >
              CA
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-ink font-semibold truncate">Modelos de Lenguaje en Salud</div>
              <div className="text-muted text-xs truncate">Clínica Alemana · Taller interactivo</div>
            </div>
          </div>
          <a
            href="https://www.linkedin.com/in/fernando-eimbcke-bosch/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-brand-700 hover:bg-brand-50 transition-colors font-medium text-sm shrink-0"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="w-4 h-4 fill-current"
            >
              <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.59 0 4.27 2.36 4.27 5.43v6.31zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM3.56 20.45h3.55V9H3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
            </svg>
            Dr Fernando Eimbcke
          </a>
        </div>
        <a
          href="https://www.linkedin.com/in/fernando-eimbcke-bosch/"
          target="_blank"
          rel="noopener noreferrer"
          className="sm:hidden block bg-brand-50 text-brand-700 text-center text-sm font-medium py-2 border-t border-border hover:bg-brand-100 transition-colors"
        >
          Dr Fernando Eimbcke · LinkedIn ↗
        </a>
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
