import { useEffect, useState } from 'react';
import { MODULES, getModuleById } from '../modules/registry';
import { getLastModuleId, setLastModuleId } from '../lib/storage';
import { Stepper } from './Stepper';
import { ModuleChat } from './ModuleChat';
import { VisualizationPlaceholder } from './VisualizationPlaceholder';

type Tab = 'chat' | 'viz';

export function WorkshopShell() {
  const [currentId, setCurrentId] = useState<string>(() => {
    const saved = getLastModuleId();
    return saved && getModuleById(saved) ? saved : MODULES[0].id;
  });
  const [tab, setTab] = useState<Tab>('chat');

  useEffect(() => {
    setLastModuleId(currentId);
  }, [currentId]);

  const module = getModuleById(currentId) ?? MODULES[0];
  const idx = MODULES.findIndex((m) => m.id === module.id);
  const prev = idx > 0 ? MODULES[idx - 1] : null;
  const next = idx < MODULES.length - 1 ? MODULES[idx + 1] : null;

  function goTo(id: string) {
    setCurrentId(id);
    setTab('chat');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Module title banner */}
      <div className="bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-start sm:items-center gap-3 flex-col sm:flex-row sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-brand-700 uppercase tracking-wide">
              Módulo {module.number} de {MODULES.length}
            </div>
            <h1 className="text-xl font-bold text-ink truncate">{module.title}</h1>
            <p className="text-sm text-muted">{module.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              disabled={!prev}
              onClick={() => prev && goTo(prev.id)}
              className="px-3 py-1.5 rounded-lg border border-border text-ink hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >
              ← Anterior
            </button>
            <button
              type="button"
              disabled={!next}
              onClick={() => next && goTo(next.id)}
              className="px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >
              Siguiente →
            </button>
          </div>
        </div>
      </div>

      {/* Mobile tab switcher */}
      <div className="lg:hidden bg-white border-b border-border">
        <div
          role="tablist"
          aria-label="Vista"
          className="max-w-6xl mx-auto px-4 py-2 flex gap-1"
        >
          <button
            role="tab"
            aria-selected={tab === 'chat'}
            onClick={() => setTab('chat')}
            className={[
              'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === 'chat'
                ? 'bg-brand-500 text-white'
                : 'text-muted hover:text-ink hover:bg-surface',
            ].join(' ')}
          >
            Chat
          </button>
          <button
            role="tab"
            aria-selected={tab === 'viz'}
            onClick={() => setTab('viz')}
            className={[
              'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === 'viz'
                ? 'bg-brand-500 text-white'
                : 'text-muted hover:text-ink hover:bg-surface',
            ].join(' ')}
          >
            Visualización
          </button>
        </div>
      </div>

      {/* Main content area: split on lg+, single tab on mobile */}
      <div className="flex-1 min-h-0 max-w-6xl w-full mx-auto px-4 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 h-[calc(100vh-22rem)] min-h-[480px]">
          <div className={tab === 'chat' ? 'block' : 'hidden lg:block'}>
            <ModuleChat
              key={module.id} /* remount = isolated chat per module */
              moduleId={module.id}
              promptHint={module.promptHint}
            />
          </div>
          <div className={tab === 'viz' ? 'block' : 'hidden lg:block'}>
            <VisualizationPlaceholder module={module} />
          </div>
        </div>
      </div>

      {/* Bottom stepper */}
      <Stepper currentId={currentId} onSelect={goTo} />
    </div>
  );
}
