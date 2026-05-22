interface HeaderProps {
  onLogout?: () => void;
}

export function Header({ onLogout }: HeaderProps) {
  return (
    <header className="bg-white border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo.svg" alt="Clínica Alemana" className="h-10 w-auto shrink-0" />
          <div className="leading-tight min-w-0 border-l border-border pl-3">
            <div className="text-ink font-semibold truncate">Modelos de Lenguaje en Salud</div>
            <div className="text-muted text-xs truncate">Taller interactivo</div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface transition-colors text-sm"
              title="Salir del taller"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M16 13v-2H7V8l-5 4 5 4v-3h9zM20 3h-8a2 2 0 0 0-2 2v4h2V5h8v14h-8v-4h-2v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
              </svg>
              <span className="hidden sm:inline">Salir</span>
            </button>
          )}
          <div className="hidden sm:flex flex-col items-end gap-0.5">
            <a
              href="https://www.linkedin.com/in/fernando-eimbcke-bosch/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-brand-700 hover:bg-brand-50 transition-colors font-medium text-sm"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.59 0 4.27 2.36 4.27 5.43v6.31zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM3.56 20.45h3.55V9H3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
              </svg>
              Dr Fernando Eimbcke
            </a>
            <a
              href="https://www.linkedin.com/in/alejandromauro/?locale=es"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-brand-700 hover:bg-brand-50 transition-colors font-medium text-sm"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.59 0 4.27 2.36 4.27 5.43v6.31zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM3.56 20.45h3.55V9H3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
              </svg>
              Dr Alejandro Mauro
            </a>
          </div>
        </div>
      </div>
      <div className="sm:hidden border-t border-border divide-y divide-brand-100">
        <a
          href="https://www.linkedin.com/in/fernando-eimbcke-bosch/"
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-brand-50 text-brand-700 text-center text-sm font-medium py-2 hover:bg-brand-100 transition-colors"
        >
          Dr Fernando Eimbcke · LinkedIn ↗
        </a>
        <a
          href="https://www.linkedin.com/in/alejandromauro/?locale=es"
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-brand-50 text-brand-700 text-center text-sm font-medium py-2 hover:bg-brand-100 transition-colors"
        >
          Dr Alejandro Mauro · LinkedIn ↗
        </a>
      </div>
    </header>
  );
}
