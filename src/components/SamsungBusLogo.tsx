import React from 'react';

interface SamsungBusLogoProps {
  /** Size in pixels (width & height). Defaults to 36 */
  size?: number;
  /** Visual variant: 'squircle' (with Samsung One UI blue gradient) or 'icon-only' (transparent) */
  variant?: 'squircle' | 'icon-only';
  /** Additional CSS class names */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** Accessible title description */
  title?: string;
}

/**
 * Samsung-Style Bus Logo Component
 * Designed in accordance with Samsung One UI aesthetics:
 * - Continuous squircle container with vibrant Samsung signature blue gradient
 * - Sleek, modern aerodynamic corporate coach/transit bus
 * - Panoramic tinted windshield with ambient glass reflection
 * - Cyan LED digital destination display header
 * - Signature Samsung LED horizontal headlight strip
 * - High-contrast, pixel-perfect rendering across 24px to 512px
 */
export const SamsungBusLogo: React.FC<SamsungBusLogoProps> = ({
  size = 36,
  variant = 'squircle',
  className = '',
  style,
  title = 'GalaxyFleet Samsung Bus Logo',
}) => {
  if (variant === 'icon-only') {
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
        <g filter="url(#busDropShadow)">
          {/* Ground contact shadow */}
          <ellipse cx="256" cy="414" rx="136" ry="12" fill="#061833" fillOpacity="0.25" />

          {/* Left & Right Front Tires */}
          <rect x="138" y="356" width="34" height="42" rx="10" fill="#0a192f" />
          <rect x="340" y="356" width="34" height="42" rx="10" fill="#0a192f" />

          {/* Aerodynamic Mirrors */}
          <path d="M120 184 L96 196 C90 199 86 206 86 214 C86 226 96 234 108 232 L120 226 Z" fill="#ffffff" />
          <rect x="90" y="200" width="16" height="28" rx="6" fill="#0c2340" />
          <path d="M392 184 L416 196 C422 199 426 206 426 214 C426 226 416 234 404 232 L392 226 Z" fill="#ffffff" />
          <rect x="406" y="200" width="16" height="28" rx="6" fill="#0c2340" />

          {/* Main Bus Body */}
          <rect x="120" y="108" width="272" height="268" rx="44" fill="#ffffff" />

          {/* Top Destination / Route LED Board */}
          <rect x="168" y="128" width="176" height="30" rx="8" fill="#091d36" />
          <rect x="182" y="139" width="48" height="8" rx="4" fill="#00e5ff" />
          <circle cx="242" cy="143" r="4" fill="#00e5ff" />
          <rect x="256" y="139" width="74" height="8" rx="4" fill="#00e5ff" />

          {/* Panoramic Windshield */}
          <path
            d="M142 170 C142 164 148 160 156 160 L356 160 C364 160 370 164 370 170 L370 252 C370 258 364 262 356 262 L156 262 C148 262 142 258 142 252 Z"
            fill="#0b2447"
          />
          {/* Glass Diagonal Sheen */}
          <path d="M164 164 L244 164 L196 258 L148 258 Z" fill="#ffffff" fillOpacity="0.16" />
          <path d="M262 164 L294 164 L252 258 L224 258 Z" fill="#ffffff" fillOpacity="0.10" />

          {/* Windshield Center Wiper Pillar */}
          <line x1="256" y1="236" x2="256" y2="260" stroke="#163866" strokeWidth="3" strokeLinecap="round" />

          {/* Middle Body Trim & Samsung Badge */}
          <rect x="144" y="278" width="224" height="6" rx="3" fill="#e1eeff" />
          <circle cx="256" cy="296" r="9" fill="#0072de" />
          <circle cx="256" cy="296" r="4" fill="#ffffff" />

          {/* Modern Headlight Strips */}
          <rect x="144" y="306" width="52" height="20" rx="8" fill="#0072de" />
          <rect x="148" y="310" width="44" height="12" rx="5" fill="#ffffff" />
          <rect x="316" y="306" width="52" height="20" rx="8" fill="#0072de" />
          <rect x="320" y="310" width="44" height="12" rx="5" fill="#ffffff" />
          <line x1="202" y1="316" x2="310" y2="316" stroke="#b4d7fe" strokeWidth="3.5" strokeLinecap="round" />

          {/* Lower Grille & Bumper */}
          <rect x="184" y="338" width="144" height="24" rx="8" fill="#091d36" />
          <rect x="202" y="344" width="108" height="3" rx="1.5" fill="#2b4c7e" />
          <rect x="212" y="351" width="88" height="3" rx="1.5" fill="#2b4c7e" />

          {/* Amber Fog Lamps */}
          <circle cx="156" cy="346" r="6" fill="#ffb300" />
          <circle cx="356" cy="346" r="6" fill="#ffb300" />
        </g>
        <defs>
          <filter id="busDropShadow" x="70" y="98" width="372" height="328" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#003166" floodOpacity="0.22" />
          </filter>
        </defs>
      </svg>
    );
  }

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

      <defs>
        {/* Signature Samsung One UI Vibrant Gradient */}
        <linearGradient id="samsungOneUiGrad" x1="40" y1="40" x2="472" y2="472" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2289ff" />
          <stop offset="55%" stopColor="#0072de" />
          <stop offset="100%" stopColor="#0056b8" />
        </linearGradient>

        {/* Ambient Top Rim Highlight */}
        <linearGradient id="samsungRimGlow" x1="256" y1="0" x2="256" y2="256" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Drop shadow on Bus Body */}
        <filter id="busShadow" x="70" y="92" width="372" height="332" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="#002959" floodOpacity="0.38" />
        </filter>
      </defs>

      {/* Samsung One UI Continuous Curvature Squircle */}
      <rect width="512" height="512" rx="124" fill="url(#samsungOneUiGrad)" />

      {/* Subtle Inner Glass Border / Top Highlight */}
      <rect x="5" y="5" width="502" height="502" rx="120" stroke="url(#samsungRimGlow)" strokeWidth="5" fill="none" />

      {/* Decorative Ambient Tech Wave/Rings (Samsung Mobility DNA) */}
      <circle cx="256" cy="256" r="198" stroke="#ffffff" strokeOpacity="0.10" strokeWidth="4" fill="none" />
      <circle cx="256" cy="256" r="230" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="2" fill="none" />

      <g filter="url(#busShadow)">
        {/* Ground Contact Shadow */}
        <ellipse cx="256" cy="414" rx="136" ry="12" fill="#04142b" fillOpacity="0.32" />

        {/* Left & Right Front Tires */}
        <rect x="138" y="356" width="34" height="42" rx="10" fill="#091b33" />
        <rect x="340" y="356" width="34" height="42" rx="10" fill="#091b33" />

        {/* Aerodynamic Mirrors */}
        <path d="M120 184 L96 196 C90 199 86 206 86 214 C86 226 96 234 108 232 L120 226 Z" fill="#ffffff" />
        <rect x="90" y="200" width="16" height="28" rx="6" fill="#0c2340" />
        <path d="M392 184 L416 196 C422 199 426 206 426 214 C426 226 416 234 404 232 L392 226 Z" fill="#ffffff" />
        <rect x="406" y="200" width="16" height="28" rx="6" fill="#0c2340" />

        {/* Main Bus Body */}
        <rect x="120" y="108" width="272" height="268" rx="44" fill="#ffffff" />

        {/* Top Destination / Route LED Board */}
        <rect x="168" y="128" width="176" height="30" rx="8" fill="#091d36" />
        <rect x="182" y="139" width="48" height="8" rx="4" fill="#00e5ff" />
        <circle cx="242" cy="143" r="4" fill="#00e5ff" />
        <rect x="256" y="139" width="74" height="8" rx="4" fill="#00e5ff" />

        {/* Panoramic Windshield */}
        <path
          d="M142 170 C142 164 148 160 156 160 L356 160 C364 160 370 164 370 170 L370 252 C370 258 364 262 356 262 L156 262 C148 262 142 258 142 252 Z"
          fill="#0b2447"
        />
        {/* Glass Diagonal Sheen */}
        <path d="M164 164 L244 164 L196 258 L148 258 Z" fill="#ffffff" fillOpacity="0.18" />
        <path d="M262 164 L294 164 L252 258 L224 258 Z" fill="#ffffff" fillOpacity="0.12" />

        {/* Center Wiper Pillar */}
        <line x1="256" y1="236" x2="256" y2="260" stroke="#163866" strokeWidth="3" strokeLinecap="round" />

        {/* Middle Body Trim & Samsung Badge */}
        <rect x="144" y="278" width="224" height="6" rx="3" fill="#e1eeff" />
        <circle cx="256" cy="296" r="9" fill="#0072de" />
        <circle cx="256" cy="296" r="4" fill="#ffffff" />

        {/* Modern Headlight Strips */}
        <rect x="144" y="306" width="52" height="20" rx="8" fill="#0072de" />
        <rect x="148" y="310" width="44" height="12" rx="5" fill="#ffffff" />
        <rect x="316" y="306" width="52" height="20" rx="8" fill="#0072de" />
        <rect x="320" y="310" width="44" height="12" rx="5" fill="#ffffff" />
        <line x1="202" y1="316" x2="310" y2="316" stroke="#b4d7fe" strokeWidth="3.5" strokeLinecap="round" />

        {/* Lower Grille & Bumper */}
        <rect x="184" y="338" width="144" height="24" rx="8" fill="#091d36" />
        <rect x="202" y="344" width="108" height="3" rx="1.5" fill="#2b4c7e" />
        <rect x="212" y="351" width="88" height="3" rx="1.5" fill="#2b4c7e" />

        {/* Amber Fog Lamps */}
        <circle cx="156" cy="346" r="6" fill="#ffb300" />
        <circle cx="356" cy="346" r="6" fill="#ffb300" />
      </g>
    </svg>
  );
};
