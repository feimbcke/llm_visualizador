import type { ModuleMeta } from '../modules/registry';

export function VisualizationPlaceholder({ module }: { module: ModuleMeta }) {
  return (
    <div className="bg-white border border-border rounded-xl shadow-sm h-full min-h-[400px] flex flex-col">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="font-semibold text-ink">Visualización</div>
        <div className="text-xs text-muted">{module.title}</div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md mx-auto text-center pt-6">
          <div
            aria-hidden
            className="inline-flex w-12 h-12 rounded-full bg-brand-50 text-brand-600 items-center justify-center mb-4"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-ink mb-2">Próximamente</h3>
          <p className="text-sm text-body mb-6">{module.vizDescription}</p>

          <div className="text-left bg-surface border border-border rounded-lg p-4">
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
              Qué incluirá
            </p>
            <ul className="space-y-1.5 text-sm text-body">
              {module.vizFeatures.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden className="text-brand-500 shrink-0">
                    ◆
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted mt-6">
            Mientras tanto, puedes usar el chat para conversar libremente con el modelo y
            familiarizarte con su comportamiento.
          </p>
        </div>
      </div>
    </div>
  );
}
