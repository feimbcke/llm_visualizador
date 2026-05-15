import { MODULES } from '../modules/registry';

interface StepperProps {
  currentId: string;
  onSelect: (id: string) => void;
  /** "top" sits under the header (desktop); "bottom" sits as a footer (mobile). */
  position?: 'top' | 'bottom';
}

export function Stepper({ currentId, onSelect, position = 'bottom' }: StepperProps) {
  const borderClass = position === 'top' ? 'border-b border-border' : 'border-t border-border';
  return (
    <nav
      aria-label="Módulos del taller"
      className={`bg-white ${borderClass}`}
    >
      <ol className="max-w-6xl mx-auto px-2 sm:px-4 py-3 flex gap-2 overflow-x-auto scrollbar-thin">
        {MODULES.map((m) => {
          const active = m.id === currentId;
          return (
            <li key={m.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(m.id)}
                aria-current={active ? 'step' : undefined}
                className={[
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-brand-500 text-white font-semibold'
                    : 'text-muted hover:text-ink hover:bg-surface',
                ].join(' ')}
                title={m.title}
              >
                <span
                  className={[
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
                    active
                      ? 'bg-white text-brand-700'
                      : 'bg-brand-50 text-brand-700',
                  ].join(' ')}
                >
                  {m.number}
                </span>
                <span className="hidden md:inline whitespace-nowrap">{m.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
