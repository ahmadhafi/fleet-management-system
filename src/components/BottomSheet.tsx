import React, { useEffect, useRef, useState } from 'react';

export type SnapPoint = 'peek' | 'half' | 'full';

const SNAP_PERCENT: Record<SnapPoint, number> = {
  peek: 28,
  half: 60,
  full: 92,
};

interface BottomSheetProps {
  snap: SnapPoint;
  onSnapChange: (snap: SnapPoint) => void;
  onEscape?: () => void;
  hasBottomNav?: boolean;
  stepKey?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  desktopNav?: React.ReactNode;
  ariaLabel?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  snap,
  onSnapChange,
  onEscape,
  hasBottomNav = false,
  stepKey,
  children,
  footer,
  desktopNav,
  ariaLabel = 'Booking sheet',
}) => {
  const [dragHeightPx, setDragHeightPx] = useState<number | null>(null);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Move keyboard focus cleanly into sheet body when step changes
  useEffect(() => {
    if (!stepKey) return;
    bodyRef.current?.focus({ preventScroll: true });
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [stepKey]);

  // Respect short landscape orientation on mobile
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px) and (max-height: 520px) and (orientation: landscape)');
    const handleOrientation = () => {
      if (mq.matches && snap !== 'peek') {
        onSnapChange('peek');
      }
    };
    handleOrientation();
    mq.addEventListener('change', handleOrientation);
    return () => mq.removeEventListener('change', handleOrientation);
  }, [snap, onSnapChange]);

  // Global Esc shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onEscape) {
          onEscape();
        } else if (snap !== 'peek') {
          onSnapChange('peek');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEscape, snap, onSnapChange]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (window.innerWidth >= 640) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const vh = window.innerHeight || 800;
    const currentH = sheetRef.current?.getBoundingClientRect().height || (vh * SNAP_PERCENT[snap]) / 100;
    startYRef.current = e.clientY;
    lastYRef.current = e.clientY;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;
    startHeightRef.current = currentH;
    setDragHeightPx(currentH);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragHeightPx === null) return;
    const vh = window.innerHeight || 800;
    const now = performance.now();
    const dt = Math.max(8, now - lastTimeRef.current);
    velocityRef.current = (lastYRef.current - e.clientY) / dt; // positive = dragging up
    lastYRef.current = e.clientY;
    lastTimeRef.current = now;

    const delta = startYRef.current - e.clientY;
    const next = Math.max(vh * 0.22, Math.min(vh * 0.94, startHeightRef.current + delta));
    setDragHeightPx(next);
  };

  const handlePointerUp = () => {
    if (dragHeightPx === null) return;
    const vh = window.innerHeight || 800;
    const pct = (dragHeightPx / vh) * 100;
    const v = velocityRef.current;
    setDragHeightPx(null);

    // Flick detection
    if (v > 0.45) {
      onSnapChange(snap === 'peek' ? 'half' : 'full');
      return;
    }
    if (v < -0.45) {
      onSnapChange(snap === 'full' ? 'half' : 'peek');
      return;
    }

    // Nearest snap point
    const points: Array<{ key: SnapPoint; pct: number }> = [
      { key: 'peek', pct: SNAP_PERCENT.peek },
      { key: 'half', pct: SNAP_PERCENT.half },
      { key: 'full', pct: SNAP_PERCENT.full },
    ];
    let best: SnapPoint = 'half';
    let minDiff = Infinity;
    for (const p of points) {
      const diff = Math.abs(pct - p.pct);
      if (diff < minDiff) {
        minDiff = diff;
        best = p.key;
      }
    }
    onSnapChange(best);
  };

  const handleHandleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onSnapChange(snap === 'peek' ? 'half' : 'full');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onSnapChange(snap === 'full' ? 'half' : 'peek');
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSnapChange(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek');
    }
  };

  const computedHeight = dragHeightPx !== null ? `${Math.round(dragHeightPx)}px` : `${SNAP_PERCENT[snap]}dvh`;

  return (
    <section
      ref={sheetRef}
      role="region"
      aria-label={ariaLabel}
      className={`gf-sheet ${dragHeightPx !== null ? 'is-dragging' : ''}`}
      style={{ height: computedHeight }}
    >
      <button
        type="button"
        className="gf-sheet-handle-area"
        aria-label={`Adjust sheet height (current: ${snap}). Press Up or Down arrow, or drag.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleHandleKeyDown}
      >
        <span className="gf-sheet-handle" />
      </button>

      <div ref={bodyRef} tabIndex={-1} className={`gf-sheet-body ${hasBottomNav && !footer ? 'has-bottom-nav' : ''}`}>{children}</div>

      {footer && <div style={{ flexShrink: 0 }}>{footer}</div>}
      {desktopNav}
    </section>
  );
};
