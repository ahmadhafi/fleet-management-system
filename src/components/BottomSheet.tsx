import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Car, Minimize2 } from 'lucide-react';
import { useAppLanguage } from '../utils/i18n';
import { getAppFrameWidth } from '../utils/displayMode';

export type SnapPoint = 'peek' | 'half' | 'full';

const SNAP_PERCENT: Record<SnapPoint, number> = {
  peek: 42,
  half: 70,
  full: 86,
};

interface BottomSheetProps {
  snap: SnapPoint;
  onSnapChange: (snap: SnapPoint) => void;
  onEscape?: () => void;
  hasBottomNav?: boolean;
  fullScreenPage?: boolean;
  stepKey?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  topNav?: React.ReactNode;
  desktopNav?: React.ReactNode;
  ariaLabel?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  snap,
  onSnapChange,
  onEscape,
  hasBottomNav = false,
  fullScreenPage = false,
  stepKey,
  children,
  footer,
  topNav,
  desktopNav,
  ariaLabel = 'Booking sheet',
}) => {
  const { t } = useAppLanguage();
  const [dragHeightPx, setDragHeightPx] = useState<number | null>(null);
  const [isManualCollapsed, setIsManualCollapsed] = useState(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const isCollapsed = isManualCollapsed;

  const handleExpand = () => {
    setIsManualCollapsed(false);
    onSnapChange('half');
  };

  const handleCollapse = () => {
    setIsManualCollapsed(true);
    onSnapChange('peek');
  };

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

  // Global Esc shortcut collapses the container to view full map
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onEscape) {
          onEscape();
        } else if (!isCollapsed) {
          handleCollapse();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEscape, isCollapsed, onSnapChange]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (getAppFrameWidth() >= 640) return;
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
    const next = Math.max(vh * 0.14, Math.min(vh * 0.94, startHeightRef.current + delta));
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
      setIsManualCollapsed(false);
      onSnapChange(snap === 'peek' ? 'half' : 'full');
      return;
    }
    if (v < -0.45) {
      if (snap === 'half') {
        setIsManualCollapsed(true);
        onSnapChange('peek');
      } else {
        onSnapChange('half');
      }
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
    if (best === 'peek') {
      setIsManualCollapsed(true);
    } else {
      setIsManualCollapsed(false);
    }
    onSnapChange(best);
  };

  const handleHandleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleExpand();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleCollapse();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isCollapsed) handleExpand();
      else handleCollapse();
    }
  };

  const computedHeight = fullScreenPage
    ? '100dvh'
    : dragHeightPx !== null
    ? `${Math.round(dragHeightPx)}px`
    : `${SNAP_PERCENT[snap]}dvh`;

  return (
    <>
      {/* Floating Expand Pill / Button when container is collapsed to maximize map */}
      {isCollapsed && !fullScreenPage && (
        <button
          type="button"
          id="gf-floating-expand-btn"
          className="gf-floating-expand-card pressable"
          onClick={handleExpand}
          title={t('Expand booking and operational container')}
          aria-label={t('Expand booking and operational container')}
        >
          <div className="gf-circle-icon is-green" style={{ width: '36px', height: '36px' }}>
            <Car size={20} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: '13.5px', lineHeight: 1.2 }}>{t('Open Fleet & Booking')}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t('Click to view forms & schedule')}</div>
          </div>
          <ChevronRight size={18} style={{ color: 'var(--color-green)' }} />
        </button>
      )}

      <section
        ref={sheetRef}
        role="region"
        aria-label={ariaLabel}
        className={`gf-sheet ${fullScreenPage ? 'is-fullscreen-page' : ''} ${isCollapsed && !fullScreenPage ? 'is-collapsed' : ''} ${dragHeightPx !== null ? 'is-dragging' : ''}`}
        style={{ height: computedHeight }}
      >
        {/* Top Controls Header on Desktop & Tablet: flexible collapse button */}
        {!fullScreenPage && (
          <div className="gf-sheet-top-controls">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-green)' }} />
              <span className="type-caption" style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                {t('Operations & Booking')}
              </span>
            </div>
            <button
              type="button"
              id="gf-container-collapse-btn"
              className="gf-btn gf-btn-secondary gf-btn-sm pressable"
              onClick={handleCollapse}
              title={t('Collapse container to view full map')}
              aria-label={t('Collapse container to view full map')}
              style={{ minHeight: '30px', padding: '0 10px', fontSize: '12px', gap: '5px' }}
            >
              <Minimize2 size={13} />
              <span>{t('Collapse to Map')}</span>
              <ChevronLeft size={14} />
            </button>
          </div>
        )}

        {/* Mobile Handle Area with Quick Collapse Button */}
        {!fullScreenPage && (
          <div className="gf-sheet-handle-area">
            <button
              type="button"
              className="gf-sheet-handle-pressable"
              aria-label={`Adjust sheet height (current: ${snap}). Press Up or Down arrow, or drag.`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onKeyDown={handleHandleKeyDown}
              onClick={() => {
                if (snap === 'peek') handleExpand();
              }}
            >
              <span className="gf-sheet-handle" />
            </button>
            {snap !== 'peek' ? (
              <button
                type="button"
                className="gf-sheet-quick-collapse-btn pressable"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCollapse();
                }}
                title="Collapse sheet to see full map"
                aria-label="Collapse sheet to see full map"
              >
                <ChevronDown size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="gf-sheet-quick-collapse-btn pressable"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExpand();
                }}
                title="Expand sheet"
                aria-label="Expand sheet"
              >
                <ChevronUp size={18} />
              </button>
            )}
          </div>
        )}

        {topNav}

        <div ref={bodyRef} tabIndex={-1} className={`gf-sheet-body ${hasBottomNav && !footer ? 'has-bottom-nav' : ''}`}>
          {children}
        </div>

        {footer && <div style={{ flexShrink: 0 }}>{footer}</div>}
        {desktopNav}
      </section>
    </>
  );
};
