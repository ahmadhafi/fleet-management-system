import React, { useState } from 'react';

export interface CompanyCarIconProps {
  /** Dimension in pixels (width and height). Defaults to 36 */
  size?: number;
  /** Visual variant: 'transparent' (default, transparent background) or 'squircle' (dark background matching original image) */
  variant?: 'transparent' | 'squircle';
  /** Additional CSS class names */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** Accessible alt title */
  title?: string;
}

/**
 * Company Car Icon Component
 * Faithfully renders the user-specified company car icon (1795012438163.jpg)
 * in pure Samsung Blue (#0072de) with both transparent line-art and dark squircle presentation variants.
 */
export const CompanyCarIcon: React.FC<CompanyCarIconProps> = ({
  size = 36,
  variant = 'transparent',
  className = '',
  style,
  title = 'Company Car',
}) => {
  const [loadFailed, setLoadFailed] = useState(false);
  const src = variant === 'squircle' ? '/icons/company-car.png' : '/icons/company-car-transparent.png';

  if (!loadFailed) {
    return (
      <span
        className={`gf-company-car-icon-wrap ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          borderRadius: variant === 'squircle' ? `${Math.round(size * 0.24)}px` : undefined,
          overflow: 'hidden',
          flexShrink: 0,
          verticalAlign: 'middle',
          ...style,
        }}
        title={title}
        role="img"
        aria-label={title}
      >
        <img
          src={src}
          alt={title}
          width={size}
          height={size}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
          onError={() => setLoadFailed(true)}
        />
      </span>
    );
  }

  // High-fidelity vector SVG fallback
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-label={title}
      role="img"
    >
      <title>{title}</title>
      {variant === 'squircle' && (
        <rect width="512" height="512" rx="110" fill="#151c2a" />
      )}
      {/* Wheels */}
      <circle cx="164" cy="308" r="34" stroke="#0072de" strokeWidth="16" />
      <circle cx="164" cy="308" r="10" fill="#0072de" />
      <circle cx="352" cy="308" r="34" stroke="#0072de" strokeWidth="16" />
      <circle cx="352" cy="308" r="10" fill="#0072de" />

      {/* Body Silhouette */}
      <path
        d="M 102 300 C 94 296 90 286 90 270 L 90 252 C 90 236 98 220 110 206 L 140 178 C 150 168 166 162 186 162 L 272 162 C 286 162 298 168 310 178 L 358 220 C 372 232 388 238 410 244 L 416 246 C 426 250 430 260 430 274 L 430 292 C 430 304 420 312 408 312 L 396 312 C 392 284 372 264 352 264 C 332 264 312 284 308 312 L 208 312 C 204 284 184 264 164 264 C 144 264 124 284 120 312 L 110 312 C 106 312 104 308 102 300 Z"
        stroke="#0072de"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Windows */}
      <path
        d="M 148 224 L 172 184 C 174 180 178 178 184 178 L 224 178 L 224 224 Z"
        stroke="#0072de"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 240 178 L 274 178 C 282 178 290 182 296 188 L 332 224 L 240 224 Z"
        stroke="#0072de"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
