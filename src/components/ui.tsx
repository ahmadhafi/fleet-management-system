import React from 'react';
import { Check, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import { EmptyIllustration } from './VehicleArt';

/* ============================================================================
   Chip
   ============================================================================ */
interface ChipProps {
  children: React.ReactNode;
  active?: boolean;
  subtle?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  id?: string;
}

export const Chip: React.FC<ChipProps> = ({ children, active, subtle, onClick, icon, id }) => {
  if (onClick) {
    return (
      <button
        id={id}
        type="button"
        onClick={onClick}
        className={`gf-chip pressable ${active ? 'is-active' : ''} ${subtle ? 'gf-chip-subtle' : ''}`}
      >
        {icon}
        <span>{children}</span>
      </button>
    );
  }
  return (
    <span id={id} className={`gf-chip ${active ? 'is-active' : ''} ${subtle ? 'gf-chip-subtle' : ''}`} style={{ cursor: 'default' }}>
      {icon}
      <span>{children}</span>
    </span>
  );
};

/* ============================================================================
   StatusBadge (green, amber, red, blue, neutral)
   ============================================================================ */
type BadgeTone = 'green' | 'amber' | 'red' | 'blue' | 'neutral';

export const StatusBadge: React.FC<{ label: string; tone?: BadgeTone }> = ({ label, tone = 'neutral' }) => (
  <span className={`gf-badge gf-badge-${tone}`}>{label}</span>
);

export function toneFromStatus(status: string): BadgeTone {
  const s = (status || '').toUpperCase();
  if (s === 'APPROVED' || s === 'COMPLETED' || s === 'AVAILABLE' || s === 'ACTIVE' || s === 'RECENT') return 'green';
  if (s === 'PENDING_APPROVAL' || s === 'STALE' || s === 'STANDBY') return 'amber';
  if (s === 'IN_PROGRESS') return 'blue';
  if (s === 'REJECTED' || s === 'CANCELLED' || s === 'DEACTIVATED' || s === 'IN MAINTENANCE' || s === 'RETIRED') return 'red';
  return 'neutral';
}

/* ============================================================================
   Segmented
   ============================================================================ */
interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (val: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="gf-segmented" role="tablist" aria-label={ariaLabel || 'Options'}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`gf-segmented-btn pressable ${active ? 'is-active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
   ListRow
   ============================================================================ */
interface ListRowProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  tall?: boolean;
  danger?: boolean;
  onClick?: () => void;
  id?: string;
}

export const ListRow: React.FC<ListRowProps> = ({
  icon,
  title,
  subtitle,
  trailing,
  showChevron = false,
  tall = false,
  danger = false,
  onClick,
  id,
}) => {
  const content = (
    <>
      {icon && <div className="gf-circle-icon">{icon}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="type-body"
          style={{
            fontWeight: 600,
            color: danger ? 'var(--color-status-red-fg)' : 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            className="type-caption"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: '2px',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {trailing && <div style={{ flexShrink: 0 }}>{trailing}</div>}
      {showChevron && <ChevronRight size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
    </>
  );

  if (onClick) {
    return (
      <button
        id={id}
        type="button"
        onClick={onClick}
        className={`gf-list-row pressable ${tall ? 'gf-list-row-64' : ''}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div id={id} className={`gf-list-row ${tall ? 'gf-list-row-64' : ''}`} style={{ cursor: 'default' }}>
      {content}
    </div>
  );
};

/* ============================================================================
   OptionRow (Horizontal Vehicle Option Row 80-88px high)
   ============================================================================ */
interface OptionRowProps {
  leading: React.ReactNode;
  title: React.ReactNode;
  badge?: React.ReactNode;
  subtitle: React.ReactNode;
  rightMetric?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  id?: string;
}

export const OptionRow: React.FC<OptionRowProps> = ({
  leading,
  title,
  badge,
  subtitle,
  rightMetric,
  selected = false,
  disabled = false,
  onClick,
  id,
}) => (
  <button
    id={id}
    type="button"
    disabled={disabled}
    aria-pressed={selected}
    onClick={disabled ? undefined : onClick}
    className={`gf-option-row pressable ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}
  >
    <div style={{ flexShrink: 0 }}>{leading}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span className="type-body" style={{ fontWeight: 700 }}>
          {title}
        </span>
        {badge}
      </div>
      <div className="type-caption" style={{ marginTop: '2px' }}>
        {subtitle}
      </div>
    </div>
    {rightMetric && <div style={{ flexShrink: 0, textAlign: 'right' }}>{rightMetric}</div>}
    <div className={`gf-radio-circle ${selected ? 'is-checked' : ''}`} aria-hidden="true">
      {selected && <Check size={14} strokeWidth={3} />}
    </div>
  </button>
);

/* ============================================================================
   StickyActionBar
   ============================================================================ */
export const StickyActionBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="gf-sticky-bar">{children}</div>
);

/* ============================================================================
   Skeleton, EmptyState & ErrorState
   ============================================================================ */
export const Skeleton: React.FC<{ height?: number; width?: string; radius?: number }> = ({
  height = 20,
  width = '100%',
  radius,
}) => (
  <div
    className="gf-skeleton"
    style={{
      height: `${height}px`,
      width,
      ...(radius ? { borderRadius: `${radius}px` } : {}),
    }}
    aria-hidden="true"
  />
);

export const EmptyState: React.FC<{ message: string; action?: React.ReactNode }> = ({ message, action }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: 'var(--space-6) var(--space-4)',
      gap: 'var(--space-3)',
    }}
  >
    <EmptyIllustration />
    <p className="type-body" style={{ color: 'var(--color-text-secondary)' }}>
      {message}
    </p>
    {action}
  </div>
);

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div
    style={{
      borderRadius: 'var(--radius-card)',
      background: 'var(--color-status-red-bg)',
      color: 'var(--color-status-red-fg)',
      padding: 'var(--space-3) var(--space-4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-3)',
    }}
    role="alert"
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
      <AlertCircle size={18} style={{ flexShrink: 0 }} />
      <span className="type-body" style={{ color: 'var(--color-status-red-fg)', fontWeight: 600 }}>
        {message}
      </span>
    </div>
    {onRetry && (
      <button type="button" className="gf-btn gf-btn-secondary" style={{ minHeight: '38px', padding: '0 12px' }} onClick={onRetry}>
        <RefreshCw size={14} />
        Retry
      </button>
    )}
  </div>
);
