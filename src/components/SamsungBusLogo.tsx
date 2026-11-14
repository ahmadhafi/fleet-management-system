import React from 'react';

export interface SamsungFleetLogoProps {
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
 * Samsung-Style Dual Fleet Logo Component (EV & Gasoline Car)
 * Designed in strict accordance with Samsung One UI aesthetics:
 * - Continuous squircle container with vibrant Samsung signature blue gradient (#2a8eff -> #0072de -> #0052b4)
 * - Pure Blue and White color harmony with zero green
 * - Dual Fleet composition featuring:
 *   1. Modern Electric Vehicle (EV): Aerodynamic closed fascia, cyan/white parametric pixel LED lightbar,
 *      panoramic tinted canopy with white sheen, and central electric energy spark badge
 *   2. Executive Modern Gasoline Car: Sculpted aerodynamic hood, horizontal executive multi-slat chrome grille,
 *      and dual projector LED headlamps with ambient blue corona rings
 * - Scalable, pixel-perfect rendering from 24px navigation bar to 512px app icon
 */
export const SamsungFleetLogo: React.FC<SamsungFleetLogoProps> = ({
  size = 36,
  variant = 'squircle',
  className = '',
  style,
  title = 'GalaxyFleet Samsung EV & Gasoline Fleet Logo',
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
        <defs>
          <filter id="iconOnlyCarShadow" x="60" y="110" width="392" height="280" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#021024" floodOpacity="0.32" />
          </filter>
        </defs>

        <g filter="url(#iconOnlyCarShadow)">
          {/* Ground Shadows */}
          <ellipse cx="168" cy="358" rx="74" ry="10" fill="#061833" fillOpacity="0.25" />
          <ellipse cx="344" cy="358" rx="74" ry="10" fill="#061833" fillOpacity="0.25" />

          {/* ==================== LEFT CAR: ELECTRIC VEHICLE (EV) ==================== */}
          <g id="io-evCar">
            <rect x="104" y="322" width="22" height="30" rx="8" fill="#081b33" />
            <rect x="210" y="322" width="22" height="30" rx="8" fill="#081b33" />

            {/* EV Mirrors */}
            <path d="M96 238 L78 244 C74 246 72 250 72 254 C72 260 78 264 84 263 L96 260 Z" fill="#0072de" />
            <rect x="74" y="247" width="12" height="13" rx="3" fill="#071b36" />
            <path d="M240 238 L258 244 C262 246 264 250 264 254 C264 260 258 264 252 263 L240 260 Z" fill="#0072de" />
            <rect x="250" y="247" width="12" height="13" rx="3" fill="#071b36" />

            {/* EV Cabin / Tinted Windshield */}
            <path d="M126 236 L138 182 C141 172 150 167 160 167 L176 167 C186 167 195 172 198 182 L210 236 Z" fill="#081c36" />
            <path d="M142 232 L154 176 L170 176 L158 232 Z" fill="#ffffff" fillOpacity="0.28" />

            {/* EV Body Shell */}
            <rect x="96" y="232" width="144" height="104" rx="28" fill="#ffffff" stroke="#0072de" strokeWidth="4" />

            {/* EV Aerodynamic Hood Creases */}
            <path d="M116 232 L168 244 L220 232" stroke="#bcdcff" strokeWidth="2.5" fill="none" />

            {/* EV Closed Aerodynamic Fascia */}
            <rect x="108" y="264" width="120" height="20" rx="8" fill="#071b36" />

            {/* EV Parametric Pixel LED Lightbar in Cyan & White */}
            <rect x="114" y="269" width="24" height="10" rx="4" fill="#00e5ff" />
            <rect x="117" y="271" width="8" height="6" rx="2" fill="#ffffff" />
            <circle cx="146" cy="274" r="3.5" fill="#00e5ff" />
            <line x1="156" y1="274" x2="180" y2="274" stroke="#00e5ff" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="190" cy="274" r="3.5" fill="#00e5ff" />
            <rect x="198" y="269" width="24" height="10" rx="4" fill="#00e5ff" />
            <rect x="211" y="271" width="8" height="6" rx="2" fill="#ffffff" />

            {/* Central Electric Energy Badge */}
            <circle cx="168" cy="302" r="14" fill="#0072de" />
            <path d="M169 293 L162 302 L167 302 L165 311 L174 300 L169 300 Z" fill="#00e5ff" />

            {/* EV Lower Aero Intake Vents */}
            <rect x="126" y="322" width="84" height="10" rx="5" fill="#081b33" />
            <line x1="136" y1="327" x2="200" y2="327" stroke="#00e5ff" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* ==================== RIGHT CAR: GASOLINE CAR (EXECUTIVE) ==================== */}
          <g id="io-gasCar">
            <rect x="280" y="322" width="22" height="30" rx="8" fill="#081b33" />
            <rect x="386" y="322" width="22" height="30" rx="8" fill="#081b33" />

            {/* Gasoline Mirrors */}
            <path d="M272 238 L254 244 C250 246 248 250 248 254 C248 260 254 264 260 263 L272 260 Z" fill="#0072de" />
            <rect x="250" y="247" width="12" height="13" rx="3" fill="#071b36" />
            <path d="M416 238 L434 244 C438 246 440 250 440 254 C440 260 434 264 428 263 L416 260 Z" fill="#0072de" />
            <rect x="426" y="247" width="12" height="13" rx="3" fill="#071b36" />

            {/* Gasoline Cabin / Tinted Windshield */}
            <path d="M302 236 L314 182 C317 172 326 167 336 167 L352 167 C362 167 371 172 374 182 L386 236 Z" fill="#081c36" />
            <path d="M318 232 L330 176 L346 176 L334 232 Z" fill="#ffffff" fillOpacity="0.28" />

            {/* Gasoline Main Body Shell */}
            <rect x="272" y="232" width="144" height="104" rx="28" fill="#ffffff" stroke="#0072de" strokeWidth="4" />

            {/* Gasoline Hood Crease */}
            <path d="M292 232 L344 244 L396 232" stroke="#bcdcff" strokeWidth="2.5" fill="none" />

            {/* Gasoline Executive Multi-Slat Radiator Grille */}
            <rect x="304" y="278" width="80" height="36" rx="8" fill="#091d36" stroke="#0072de" strokeWidth="1.8" />
            <line x1="312" y1="285" x2="376" y2="285" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="312" y1="294" x2="376" y2="294" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="312" y1="303" x2="376" y2="303" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />

            {/* Gasoline Dual Projector Headlights with Blue Corona Ring */}
            <rect x="280" y="264" width="22" height="16" rx="6" fill="#0072de" />
            <circle cx="291" cy="272" r="5" fill="#ffffff" />
            <rect x="386" y="264" width="22" height="16" rx="6" fill="#0072de" />
            <circle cx="397" cy="272" r="5" fill="#ffffff" />
            <line x1="302" y1="272" x2="386" y2="272" stroke="#bcdcff" strokeWidth="2" strokeLinecap="round" />

            {/* Brand Emblem */}
            <circle cx="344" cy="268" r="6" fill="#0072de" />
            <circle cx="344" cy="268" r="3" fill="#ffffff" />

            {/* Lower Bumper & White Fog Lamps */}
            <rect x="302" y="322" width="84" height="10" rx="5" fill="#081b33" />
            <circle cx="290" cy="327" r="4" fill="#0072de" />
            <circle cx="398" cy="327" r="4" fill="#0072de" />
          </g>
        </g>
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
        <linearGradient id="samsungOneUiGradFleet" x1="40" y1="40" x2="472" y2="472" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2a8eff" />
          <stop offset="50%" stopColor="#0072de" />
          <stop offset="100%" stopColor="#0052b4" />
        </linearGradient>

        {/* Ambient Top Rim Highlight */}
        <linearGradient id="samsungRimGlowFleet" x1="256" y1="0" x2="256" y2="256" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Drop Shadow on Vehicle Bodies */}
        <filter id="carShadowFleet" x="60" y="110" width="392" height="280" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#031633" floodOpacity="0.38" />
        </filter>
      </defs>

      {/* Samsung One UI Continuous Curvature Squircle */}
      <rect width="512" height="512" rx="124" fill="url(#samsungOneUiGradFleet)" />

      {/* Subtle Inner Glass Border / Top Highlight */}
      <rect x="6" y="6" width="500" height="500" rx="120" stroke="url(#samsungRimGlowFleet)" strokeWidth="6" fill="none" />

      {/* Decorative Ambient Tech Wave/Rings (Samsung Mobility DNA) */}
      <circle cx="256" cy="256" r="215" stroke="#ffffff" strokeOpacity="0.10" strokeWidth="3" fill="none" />
      <circle cx="256" cy="256" r="185" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="2" fill="none" />

      {/* Top Badges Header: EV and GASOLINE Indicator Pills */}
      <g>
        {/* Left Pill: EV in Cyan & White */}
        <rect x="124" y="128" width="88" height="26" rx="13" fill="#071b36" fillOpacity="0.88" stroke="#00e5ff" strokeWidth="1.8" />
        <path d="M145 135 L140 142 L145 142 L143 148 L150 140 L146 140 Z" fill="#00e5ff" />
        <text x="168" y="145" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="11.5" fontWeight="800" fill="#ffffff" letterSpacing="1" textAnchor="middle">EV</text>

        {/* Right Pill: GASOLINE in White & Samsung Blue */}
        <rect x="300" y="128" width="88" height="26" rx="13" fill="#071b36" fillOpacity="0.88" stroke="#ffffff" strokeWidth="1.8" />
        <text x="344" y="145" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="11.5" fontWeight="800" fill="#ffffff" letterSpacing="1" textAnchor="middle">GAS</text>
      </g>

      <g filter="url(#carShadowFleet)">
        {/* Ground Contact Shadows */}
        <ellipse cx="168" cy="356" rx="74" ry="10" fill="#04142b" fillOpacity="0.4" />
        <ellipse cx="344" cy="356" rx="74" ry="10" fill="#04142b" fillOpacity="0.4" />

        {/* ==================== LEFT CAR: ELECTRIC VEHICLE (EV) ==================== */}
        <g id="evCar">
          {/* EV Tires */}
          <rect x="104" y="322" width="22" height="30" rx="8" fill="#081b33" />
          <rect x="210" y="322" width="22" height="30" rx="8" fill="#081b33" />

          {/* EV Aerodynamic Mirrors */}
          <path d="M96 238 L78 244 C74 246 72 250 72 254 C72 260 78 264 84 263 L96 260 Z" fill="#ffffff" />
          <rect x="74" y="247" width="12" height="13" rx="3" fill="#0c2340" />
          <path d="M240 238 L258 244 C262 246 264 250 264 254 C264 260 258 264 252 263 L240 260 Z" fill="#ffffff" />
          <rect x="250" y="247" width="12" height="13" rx="3" fill="#0c2340" />

          {/* EV Cabin / Tinted Windshield with Ambient Glass Reflections */}
          <path d="M126 236 L138 182 C141 172 150 167 160 167 L176 167 C186 167 195 172 198 182 L210 236 Z" fill="#081c36" />
          <path d="M142 232 L154 176 L170 176 L158 232 Z" fill="#ffffff" fillOpacity="0.22" />
          <path d="M178 232 L186 176 L194 176 L186 232 Z" fill="#ffffff" fillOpacity="0.12" />

          {/* EV Main Body Shell (Pure White Aerodynamic Crossover) */}
          <rect x="96" y="232" width="144" height="104" rx="28" fill="#ffffff" />

          {/* EV Sculpted Hood Crease */}
          <path d="M116 232 L168 244 L220 232" stroke="#bcdcff" strokeWidth="2.5" fill="none" />

          {/* EV Closed Aerodynamic Fascia in Deep Blue Gloss */}
          <rect x="108" y="264" width="120" height="20" rx="8" fill="#071b36" />

          {/* EV Parametric Pixel LED Lightbar in Cyan & White */}
          <rect x="114" y="269" width="24" height="10" rx="4" fill="#00e5ff" />
          <rect x="117" y="271" width="8" height="6" rx="2" fill="#ffffff" />
          <circle cx="146" cy="274" r="3.5" fill="#00e5ff" />
          <line x1="156" y1="274" x2="180" y2="274" stroke="#00e5ff" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="190" cy="274" r="3.5" fill="#00e5ff" />
          <rect x="198" y="269" width="24" height="10" rx="4" fill="#00e5ff" />
          <rect x="211" y="271" width="8" height="6" rx="2" fill="#ffffff" />

          {/* Central Electric Energy Badge */}
          <circle cx="168" cy="302" r="14" fill="#0072de" />
          <circle cx="168" cy="302" r="12" fill="#005bb5" />
          <path d="M169 293 L162 302 L167 302 L165 311 L174 300 L169 300 Z" fill="#00e5ff" />

          {/* EV Lower Aero Intake Vents */}
          <rect x="126" y="322" width="84" height="10" rx="5" fill="#081b33" />
          <line x1="136" y1="327" x2="200" y2="327" stroke="#00e5ff" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* ==================== RIGHT CAR: GASOLINE CAR (EXECUTIVE) ==================== */}
        <g id="gasCar">
          {/* Gasoline Tires */}
          <rect x="280" y="322" width="22" height="30" rx="8" fill="#081b33" />
          <rect x="386" y="322" width="22" height="30" rx="8" fill="#081b33" />

          {/* Gasoline Mirrors */}
          <path d="M272 238 L254 244 C250 246 248 250 248 254 C248 260 254 264 260 263 L272 260 Z" fill="#ffffff" />
          <rect x="250" y="247" width="12" height="13" rx="3" fill="#0c2340" />
          <path d="M416 238 L434 244 C438 246 440 250 440 254 C440 260 434 264 428 263 L416 260 Z" fill="#ffffff" />
          <rect x="426" y="247" width="12" height="13" rx="3" fill="#0c2340" />

          {/* Gasoline Cabin / Tinted Windshield with Reflections */}
          <path d="M302 236 L314 182 C317 172 326 167 336 167 L352 167 C362 167 371 172 374 182 L386 236 Z" fill="#081c36" />
          <path d="M318 232 L330 176 L346 176 L334 232 Z" fill="#ffffff" fillOpacity="0.22" />
          <path d="M354 232 L362 176 L370 176 L362 232 Z" fill="#ffffff" fillOpacity="0.12" />

          {/* Gasoline Main Body Shell (Pure White Executive Sedan) */}
          <rect x="272" y="232" width="144" height="104" rx="28" fill="#ffffff" />

          {/* Gasoline Hood Crease */}
          <path d="M292 232 L344 244 L396 232" stroke="#bcdcff" strokeWidth="2.5" fill="none" />

          {/* Gasoline Executive Multi-Slat Radiator Grille */}
          <rect x="304" y="278" width="80" height="36" rx="8" fill="#091d36" stroke="#0072de" strokeWidth="1.8" />
          <line x1="312" y1="285" x2="376" y2="285" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="312" y1="294" x2="376" y2="294" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="312" y1="303" x2="376" y2="303" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />

          {/* Gasoline Dual Projector Headlights with Blue Corona Ring */}
          <rect x="280" y="264" width="22" height="16" rx="6" fill="#0072de" />
          <circle cx="291" cy="272" r="5" fill="#ffffff" />
          <rect x="386" y="264" width="22" height="16" rx="6" fill="#0072de" />
          <circle cx="397" cy="272" r="5" fill="#ffffff" />
          <line x1="302" y1="272" x2="386" y2="272" stroke="#bcdcff" strokeWidth="2" strokeLinecap="round" />

          {/* Brand Emblem Above Grille */}
          <circle cx="344" cy="268" r="6" fill="#0072de" />
          <circle cx="344" cy="268" r="3" fill="#ffffff" />

          {/* Lower Bumper & White Fog Lamps */}
          <rect x="302" y="322" width="84" height="10" rx="5" fill="#081b33" />
          <circle cx="290" cy="327" r="4" fill="#ffffff" />
          <circle cx="398" cy="327" r="4" fill="#ffffff" />
        </g>
      </g>

      {/* Speed Lane Divider / Road Baseline */}
      <rect x="156" y="378" width="200" height="6" rx="3" fill="#ffffff" fillOpacity="0.25" />
      <rect x="220" y="378" width="72" height="6" rx="3" fill="#ffffff" />

      {/* Typography: Samsung One UI Mobility Branding */}
      <text x="256" y="420" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="21" fontWeight="900" fill="#ffffff" letterSpacing="4" textAnchor="middle">GALAXY FLEET</text>
      <text x="256" y="444" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="11.5" fontWeight="700" fill="#9ecaff" letterSpacing="2" textAnchor="middle">EV • GASOLINE MOBILITY</text>
    </svg>
  );
};

/** Backwards-compatible export alias for SamsungBusLogo */
export const SamsungBusLogo = SamsungFleetLogo;
