import { useEffect, useRef, useState } from 'react';
import { MODULES, getModuleById } from '../modules/registry';
import type { ModuleMeta } from '../modules/registry';
import { DefaultModule } from '../modules/_DefaultModule';
import { getLastModuleId, setLastModuleId } from '../lib/storage';
import { Stepper } from './Stepper';

type Tab = 'chat' | 'viz';

/** True at the desktop split breakpoint (lg). Drives a different chrome layout. */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export function WorkshopShell() {
  const [currentId, setCurrentId] = useState<string>(() => {
    const saved = getLastModuleId();
    return saved && getModuleById(saved) ? saved : MODULES[0].id;
  });
  const [tab, setTab] = useState<Tab>('chat');
  const isDesktop = useIsDesktop();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLastModuleId(currentId);
  }, [currentId]);

  const module = getModuleById(currentId) ?? MODULES[0];
  const idx = MODULES.findIndex((m) => m.id === module.id);
  const prev = idx > 0 ? MODULES[idx - 1] : null;
  const next = idx < MODULES.length - 1 ? MODULES[idx + 1] : null;
  const lastNumber = MODULES[MODULES.length - 1].number;
  const stacked = module.mobileLayout === 'stack';

  function goTo(id: string) {
    setCurrentId(id);
    setTab('chat');
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const banner = (
    <div className="bg-white border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-start sm:items-center gap-3 flex-col sm:flex-row sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-brand-700 uppercase tracking-wide">
            Módulo {module.number} de {lastNumber}
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
  );

  const tabSwitcher = (
    <div className="bg-white border-t border-border">
      <div role="tablist" aria-label="Vista" className="max-w-6xl mx-auto px-4 py-2 flex gap-1">
        <button
          role="tab"
          aria-selected={tab === 'chat'}
          onClick={() => setTab('chat')}
          className={[
            'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'chat' ? 'bg-brand-500 text-white' : 'text-muted hover:text-ink hover:bg-surface',
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
            tab === 'viz' ? 'bg-brand-500 text-white' : 'text-muted hover:text-ink hover:bg-surface',
          ].join(' ')}
        >
          Visualización
        </button>
      </div>
    </div>
  );

  // Single instance — placed in whichever layout is active.
  const body = (
    <ModuleBody key={module.id} module={module} tab={tab} onMainAction={() => setTab('viz')} />
  );

  if (isDesktop) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <Stepper currentId={currentId} onSelect={goTo} position="top" />
        {banner}
        <div className="flex-1 min-h-0 overflow-y-auto w-full max-w-6xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 gap-6 h-full min-h-[480px]">{body}</div>
        </div>
      </div>
    );
  }

  // Mobile (< lg): fixed header (App) + this scroll region + fixed bottom bar.
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <PresenterBar />
        {banner}
        <div className="w-full px-4 py-4">
          <div className="grid grid-cols-1 gap-4">{body}</div>
        </div>
      </div>
      <div className="shrink-0">
        {!stacked && tabSwitcher}
        <Stepper currentId={currentId} onSelect={goTo} position="bottom" />
      </div>
    </div>
  );
}

/** Presenter links, side by side. Scrolls with the content on mobile. */
function PresenterBar() {
  return (
    <div className="flex border-b border-border divide-x divide-brand-100">
      <a
        href="https://www.linkedin.com/in/fernando-eimbcke-bosch/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 bg-brand-50 text-brand-700 text-center text-xs font-medium py-2 hover:bg-brand-100 transition-colors"
      >
        Dr Fernando Eimbcke
      </a>
      <a
        href="https://www.linkedin.com/in/alejandromauro/?locale=es"
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 bg-brand-50 text-brand-700 text-center text-xs font-medium py-2 hover:bg-brand-100 transition-colors"
      >
        Dr Alejandro Mauro
      </a>
    </div>
  );
}

function ModuleBody({
  module,
  tab,
  onMainAction,
}: {
  module: ModuleMeta;
  tab: Tab;
  onMainAction: () => void;
}) {
  const Component = module.Component ?? DefaultModule;
  return <Component module={module} tab={tab} onMainAction={onMainAction} />;
}
