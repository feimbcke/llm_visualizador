import { useEffect, useRef } from 'react';

interface Alt {
  token: string;
  prob: number;
}

interface TokenPopoverProps {
  /** Bounding rect of the clicked token, captured at click time. */
  anchor: DOMRect;
  token: string;
  /** linear probability 0–1 */
  prob: number;
  /** optional alternatives the model considered */
  alternatives?: Alt[];
  onClose: () => void;
}

const WIDTH = 224;

function pct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

function show(t: string): string {
  return t.replace(/\n/g, '↵');
}

/**
 * A small "what was the probability" window anchored to a token. Click-activated
 * (works on touch and desktop, unlike a hover title). Fixed-positioned so the
 * scrolling panes don't clip it; closes on outside click, scroll, resize or Esc.
 */
export function TokenPopover({ anchor, token, prob, alternatives, onClose }: TokenPopoverProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const close = () => onCloseRef.current();
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      // Don't close when clicking inside the popover or on another token chip
      // (so tapping a different token switches the selection in one tap).
      if (t && (t.closest('[data-token-popover]') || t.closest('[data-token-chip]'))) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('click', onDocClick);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - WIDTH - 8));
  const placeBelow = anchor.top < 170; // not enough room above → drop below
  const style: React.CSSProperties = placeBelow
    ? { position: 'fixed', top: anchor.bottom + 6, left, width: WIDTH }
    : { position: 'fixed', bottom: window.innerHeight - anchor.top + 6, left, width: WIDTH };

  return (
    <div
      data-token-popover
      style={style}
      className="z-50 rounded-lg border border-border bg-white shadow-lg p-3 text-xs"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-mono bg-surface border border-border rounded px-1 py-0.5 text-ink whitespace-pre">
          {show(token)}
        </span>
        <span className="font-semibold text-ink tabular-nums">{pct(prob)}</span>
      </div>
      {alternatives && alternatives.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted font-semibold">
            Alternativas que consideró
          </div>
          {alternatives.slice(0, 4).map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="font-mono text-ink whitespace-pre truncate max-w-[80px]">{show(a.token)}</span>
              <span className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                <span className="block h-full bg-brand-400" style={{ width: pct(a.prob) }} />
              </span>
              <span className="text-muted tabular-nums w-12 text-right">{pct(a.prob)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
