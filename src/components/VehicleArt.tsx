import React from 'react';

interface VehicleArtProps {
  carType?: string;
  energyType?: string;
  size?: number;
}

export const VehicleArt: React.FC<VehicleArtProps> = ({ carType = 'Sedan', energyType = 'Gasoline', size = 64 }) => {
  const isEv = energyType === 'Electric';
  const lower = carType.toLowerCase();
  const isVanOrMpv = lower.includes('mpv') || lower.includes('van');
  const isSuv = lower.includes('suv') || lower.includes('crossover');

  return (
    <svg
      width={size}
      height={Math.round(size * 0.65)}
      viewBox="0 0 80 52"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {/* Ground shadow */}
      <ellipse cx="40" cy="44" rx="31" ry="4" fill="var(--color-bg-hover)" />
      {/* Body */}
      {isVanOrMpv ? (
        <path
          d="M10 35V25c0-4 2.5-9 6.5-11l8-3h29c5.5 0 11 4.5 14 11l3 5v8c0 2-1.5 3.5-3.5 3.5H13.5C11.5 38.5 10 37 10 35z"
          fill={isEv ? 'rgba(0, 114, 222, 0.12)' : 'var(--color-bg-subtle)'}
          stroke="var(--color-text-primary)"
          strokeWidth="2"
        />
      ) : isSuv ? (
        <path
          d="M9 35v-8c0-3 2-6 5-7.5l8-3.5 7-5.5h22c5 0 9.5 4 12.5 9.5l5 3c2 1.2 2.5 3.5 2.5 6v6c0 2-1.5 3.5-3.5 3.5H12.5C10.5 38.5 9 37 9 35z"
          fill={isEv ? 'rgba(0, 114, 222, 0.12)' : 'var(--color-bg-subtle)'}
          stroke="var(--color-text-primary)"
          strokeWidth="2"
        />
      ) : (
        <path
          d="M8 35v-6c0-2.5 2-5 5.5-6l9-2 8-8h20c4.5 0 9 3.5 12 8l6 3c2 1 3 3 3 5.5V35c0 2-1.5 3.5-3.5 3.5H11.5C9.5 38.5 8 37 8 35z"
          fill={isEv ? 'rgba(0, 114, 222, 0.12)' : 'var(--color-bg-subtle)'}
          stroke="var(--color-text-primary)"
          strokeWidth="2"
        />
      )}
      {/* Windows */}
      <path
        d={
          isVanOrMpv
            ? 'M20 22l4-8h24l7 8H20z'
            : 'M24 22l6-7.5h17l7.5 7.5H24z'
        }
        fill="var(--color-bg-surface)"
        stroke="var(--color-text-primary)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* EV Accent Stripe */}
      {isEv && <rect x="26" y="27" width="26" height="3" rx="1.5" fill="#0072de" />}
      {/* Wheels */}
      <circle cx="22" cy="39" r="6.5" fill="var(--color-text-primary)" />
      <circle cx="22" cy="39" r="2.8" fill="var(--color-bg-surface)" />
      <circle cx="58" cy="39" r="6.5" fill="var(--color-text-primary)" />
      <circle cx="58" cy="39" r="2.8" fill="var(--color-bg-surface)" />
    </svg>
  );
};

export const EmptyIllustration: React.FC<{ label?: string }> = () => (
  <svg width="96" height="72" viewBox="0 0 96 72" fill="none" aria-hidden="true">
    <ellipse cx="48" cy="60" rx="34" ry="6" fill="var(--color-bg-subtle)" />
    <path
      d="M22 44c0-11 9-20 20-20h12c11 0 20 9 20 20v6c0 3-2.5 5-5 5H27c-2.5 0-5-2-5-5v-6z"
      fill="var(--color-bg-surface)"
      stroke="var(--color-border)"
      strokeWidth="2"
    />
    <circle cx="35" cy="54" r="6" fill="var(--color-text-muted)" />
    <circle cx="61" cy="54" r="6" fill="var(--color-text-muted)" />
    <circle cx="72" cy="18" r="10" fill="rgba(0, 114, 222, 0.12)" stroke="#0072de" strokeWidth="2" />
    <path d="M72 13v5l3 2" stroke="#0072de" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
