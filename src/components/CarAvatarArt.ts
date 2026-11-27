/**
 * Car Avatar & Driver Character Artwork Helper
 * Generates custom, model-specific vehicle avatars (Hyundai Ioniq 5, Hyundai Stargazer, Innova Zenix, Camry, etc.)
 * and professional driver portraits for the Live Fleet Map.
 */

export type CarModelKey =
  | 'ioniq5'
  | 'stargazer'
  | 'innova'
  | 'camry'
  | 'crv'
  | 'xpander'
  | 'serena'
  | 'byd'
  | 'tesla'
  | 'ev_default'
  | 'gas_default';

/**
 * Resolves a vehicle model string into a distinct car avatar key
 */
export function resolveCarAvatarKey(modelName?: string, make?: string, energyType?: string): CarModelKey {
  const text = `${make || ''} ${modelName || ''}`.toLowerCase();

  if (text.includes('ioniq')) return 'ioniq5';
  if (text.includes('stargazer')) return 'stargazer';
  if (text.includes('innova') || text.includes('zenix')) return 'innova';
  if (text.includes('camry')) return 'camry';
  if (text.includes('cr-v') || text.includes('crv')) return 'crv';
  if (text.includes('xpander')) return 'xpander';
  if (text.includes('serena')) return 'serena';
  if (text.includes('atto') || text.includes('byd')) return 'byd';
  if (text.includes('model y') || text.includes('tesla') || text.includes('modely')) return 'tesla';

  return energyType === 'Electric' ? 'ev_default' : 'gas_default';
}

/**
 * Returns the real vehicle photo icon PNG path:
 * - Hyundai Ioniq 5 (/icons/car-ioniq5.png) for Ioniq 5 and Electric vehicles
 * - Hyundai Stargazer (/icons/car-stargazer.png) for Stargazer and Gasoline vehicles
 */
export function getVehiclePhotoIconUrl(modelName?: string, energyType?: string): string {
  const text = `${modelName || ''}`.toLowerCase();
  if (text.includes('ioniq') || energyType === 'Electric') {
    return '/icons/car-ioniq5.png';
  }
  return '/icons/car-stargazer.png';
}

/**
 * Computes compass heading bearing in degrees (0 = North/Up, 90 = East/Right)
 * so top-down map car icons align accurately along roads and active routes.
 */
export function computeMapBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLambda = toRad(lon2 - lon1);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const brng = toDeg(Math.atan2(y, x));
  return ((brng % 360) + 360) % 360;
}

let topDownSvgSeq = 0;

/**
 * Generates a Gojek-style pure top-down (bird's-eye) car icon SVG (no surrounding circle)
 * specifically styled as either Hyundai Ioniq 5 (EV) or Hyundai Stargazer (MPV).
 * Sized proportionally to map roads (19px x 40px / 19px x 42px) and rotated via CSS bearing.
 */
export function getTopDownMapCarSvg(
  modelName?: string,
  energyType?: string,
  headingDeg: number = 0
): string {
  const text = `${modelName || ''}`.toLowerCase();
  const isIoniq5 = text.includes('ioniq') || energyType === 'Electric';
  const uid = ++topDownSvgSeq;
  const safeDeg = Number.isFinite(headingDeg) ? Math.round(headingDeg * 10) / 10 : 0;

  if (isIoniq5) {
    // Hyundai Ioniq 5 (EV) — Top-down geometric crossover with clamshell hood, panoramic vision roof & Parametric Pixel lights
    return `
      <div class="gf-topdown-car gf-topdown-ioniq5" data-car-model="ioniq5" style="width:20px;height:40px;display:flex;align-items:center;justify-content:center;transform:rotate(${safeDeg}deg);transition:transform 0.4s ease;filter:drop-shadow(0 2px 3px rgba(15,23,42,0.45));pointer-events:auto;">
        <svg viewBox="0 0 40 80" width="20" height="40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Hyundai Ioniq 5">
          <defs>
            <linearGradient id="i5td_${uid}" x1="4" y1="4" x2="36" y2="76" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#38bdf8"/>
              <stop offset="45%" stop-color="#0072de"/>
              <stop offset="100%" stop-color="#004494"/>
            </linearGradient>
            <linearGradient id="i5gl_${uid}" x1="8" y1="22" x2="32" y2="62" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#1e293b"/>
              <stop offset="50%" stop-color="#0f172a"/>
              <stop offset="100%" stop-color="#1e293b"/>
            </linearGradient>
          </defs>
          <!-- Side Mirrors -->
          <path d="M5 25 L1.5 27.5 C1 28 1 29.5 2 30 L5.5 29.5 Z" fill="#005bb5" stroke="#08203e" stroke-width="0.8"/>
          <path d="M35 25 L38.5 27.5 C39 28 39 29.5 38 30 L34.5 29.5 Z" fill="#005bb5" stroke="#08203e" stroke-width="0.8"/>
          <!-- Main Geometric Crossover Body -->
          <path d="M9 5 C14 3 26 3 31 5 C34.5 6.5 36 10 36 15 L36 66 C36 72 34.2 75.5 30.5 76.5 C25 77.5 15 77.5 9.5 76.5 C5.8 75.5 4 72 4 66 L4 15 C4 10 5.5 6.5 9 5 Z" fill="url(#i5td_${uid})" stroke="#08203e" stroke-width="1.3"/>
          <!-- Clamshell Hood Crease Lines -->
          <path d="M9.5 8 L12.5 22 M30.5 8 L27.5 22" stroke="#93c5fd" stroke-width="0.9" stroke-opacity="0.7"/>
          <!-- Front Parametric Pixel LED Headlights -->
          <rect x="8.5" y="5.2" width="3.5" height="2" rx="0.5" fill="#e0f2fe"/>
          <rect x="13" y="5.2" width="3.5" height="2" rx="0.5" fill="#e0f2fe"/>
          <rect x="23.5" y="5.2" width="3.5" height="2" rx="0.5" fill="#e0f2fe"/>
          <rect x="28" y="5.2" width="3.5" height="2" rx="0.5" fill="#e0f2fe"/>
          <!-- Front Windshield -->
          <path d="M8.5 22 C13 19.5 27 19.5 31.5 22 L29.5 32.5 C25 31.2 15 31.2 10.5 32.5 Z" fill="url(#i5gl_${uid})" stroke="#38bdf8" stroke-width="0.6" stroke-opacity="0.5"/>
          <!-- Windshield Glare Highlight -->
          <path d="M10.5 23 L18 22 L14.5 31 L11 31 Z" fill="#ffffff" fill-opacity="0.18"/>
          <!-- Panoramic Vision Glass Roof -->
          <rect x="9.5" y="34" width="21" height="24" rx="3" fill="#0b172a" stroke="#38bdf8" stroke-width="0.7" stroke-opacity="0.45"/>
          <line x1="10.5" y1="36" x2="29.5" y2="36" stroke="#ffffff" stroke-opacity="0.14" stroke-width="1"/>
          <!-- Rear Hatchback Glass + Spoiler Lip -->
          <path d="M10.5 60 L29.5 60 L31 67.5 C26 69 14 69 9 67.5 Z" fill="#0f172a"/>
          <rect x="7.5" y="69" width="25" height="2.4" rx="1" fill="#004494" stroke="#93c5fd" stroke-opacity="0.4" stroke-width="0.5"/>
          <!-- Rear Parametric Pixel Tail Lights -->
          <rect x="8.5" y="73.2" width="3.2" height="1.8" rx="0.4" fill="#ef4444"/>
          <rect x="13" y="73.2" width="3.2" height="1.8" rx="0.4" fill="#ef4444"/>
          <rect x="18.4" y="73.2" width="3.2" height="1.8" rx="0.4" fill="#ef4444"/>
          <rect x="23.8" y="73.2" width="3.2" height="1.8" rx="0.4" fill="#ef4444"/>
          <rect x="28.3" y="73.2" width="3.2" height="1.8" rx="0.4" fill="#ef4444"/>
        </svg>
      </div>
    `;
  }

  // Hyundai Stargazer (MPV) — Top-down sleek "One-Curve" MPV with Horizon DRL lightbar, raked windshield & H-bar tail lamp
  return `
    <div class="gf-topdown-car gf-topdown-stargazer" data-car-model="stargazer" style="width:20px;height:42px;display:flex;align-items:center;justify-content:center;transform:rotate(${safeDeg}deg);transition:transform 0.4s ease;filter:drop-shadow(0 2px 3px rgba(15,23,42,0.42));pointer-events:auto;">
      <svg viewBox="0 0 40 84" width="20" height="42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Hyundai Stargazer">
        <defs>
          <linearGradient id="sgtd_${uid}" x1="4" y1="3" x2="36" y2="81" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="52%" stop-color="#e2e8f0"/>
            <stop offset="100%" stop-color="#94a3b8"/>
          </linearGradient>
          <linearGradient id="sggl_${uid}" x1="8" y1="18" x2="32" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <!-- Sleek MPV Side Mirrors -->
        <path d="M5 24 L1.5 26.5 C1 27 1 28.6 2 29 L5.5 28.5 Z" fill="#cbd5e1" stroke="#1e293b" stroke-width="0.8"/>
        <path d="M35 24 L38.5 26.5 C39 27 39 28.6 38 29 L34.5 28.5 Z" fill="#cbd5e1" stroke="#1e293b" stroke-width="0.8"/>
        <!-- Aerodynamic One-Curve MPV Body Shell -->
        <path d="M11 4.5 C16 2.5 24 2.5 29 4.5 C33.5 6.8 35.5 11.5 35.8 17.5 L35.8 68 C35.8 74.5 34 78.5 30 79.8 C24.5 81 15.5 81 10 79.8 C6 78.5 4.2 74.5 4.2 68 L4.2 17.5 C4.5 11.5 6.5 6.8 11 4.5 Z" fill="url(#sgtd_${uid})" stroke="#1e293b" stroke-width="1.35"/>
        <!-- Signature Seamless Horizontal Horizon DRL Lightbar -->
        <path d="M9 7.8 C15 5.8 25 5.8 31 7.8" stroke="#0072de" stroke-width="2.1" stroke-linecap="round"/>
        <path d="M9.5 7.5 C15 5.7 25 5.7 30.5 7.5" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round"/>
        <!-- Hood Contours -->
        <path d="M11 10.5 L12.5 19 M29 10.5 L27.5 19" stroke="#94a3b8" stroke-width="0.8"/>
        <!-- Deeply Raked Wide MPV Front Windshield -->
        <path d="M8 20 C13 17 27 17 32 20 L30 33.5 C25 32 15 32 10 33.5 Z" fill="url(#sggl_${uid})"/>
        <path d="M10.5 21 L19 19.5 L15 32 L11 32 Z" fill="#ffffff" fill-opacity="0.22"/>
        <!-- Elongated 3-Row MPV Roof + Side Roof Rails -->
        <rect x="9.5" y="34.5" width="21" height="29" rx="3.5" fill="#f1f5f9" stroke="#94a3b8" stroke-width="0.8"/>
        <line x1="11.2" y1="36.5" x2="11.2" y2="61.5" stroke="#64748b" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="28.8" y1="36.5" x2="28.8" y2="61.5" stroke="#64748b" stroke-width="1.1" stroke-linecap="round"/>
        <!-- Side Window Slivers -->
        <path d="M7.2 35 L8.6 36 L8.6 62 L7.2 63 Z" fill="#1e293b"/>
        <path d="M32.8 35 L31.4 36 L31.4 62 L32.8 63 Z" fill="#1e293b"/>
        <!-- Rear Tailgate Window -->
        <path d="M10 65 L30 65 L31.5 73 C26 74.5 14 74.5 8.5 73 Z" fill="#0f172a"/>
        <!-- Signature H-Style Red LED Rear Light Bar -->
        <path d="M8.5 76.5 L31.5 76.5" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
        <rect x="8" y="74.8" width="2.4" height="3.2" rx="0.6" fill="#ef4444"/>
        <rect x="29.6" y="74.8" width="2.4" height="3.2" rx="0.6" fill="#ef4444"/>
      </svg>
    </div>
  `;
}

/**
 * Generates the SVG string of the specific car model avatar front-fascia
 */
export function getCarFrontAvatarSvg(key: CarModelKey, isInTrip: boolean = false): string {
  const beamOpacity = isInTrip ? '0.85' : '0.2';
  const beamGlow = isInTrip ? 'filter="url(#headlightBeam)"' : '';

  switch (key) {
    case 'ioniq5':
      // Hyundai Ioniq 5: Parametric Pixel LEDs [■ ■] [■ ■], clamshell hood, futuristic cyber matte finish
      return `
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="i5Body" x1="0" y1="0" x2="100" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#4aa3df"/>
              <stop offset="60%" stop-color="#1f7ac5"/>
              <stop offset="100%" stop-color="#0f518a"/>
            </linearGradient>
            <filter id="headlightBeam" x="0" y="20" width="100" height="40" filterUnits="userSpaceOnUse">
              <feGaussianBlur stdDeviation="3" result="glow"/>
              <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <!-- Ground Shadow -->
          <ellipse cx="50" cy="65" rx="42" ry="5" fill="#000000" fill-opacity="0.35"/>
          <!-- Tires -->
          <rect x="12" y="48" width="12" height="18" rx="4" fill="#0f172a"/>
          <rect x="76" y="48" width="12" height="18" rx="4" fill="#0f172a"/>
          <!-- Mirrors -->
          <path d="M12 28 L4 31 C2 32 2 35 4 36 L12 35 Z" fill="#1f7ac5"/>
          <path d="M88 28 L96 31 C98 32 98 35 96 36 L88 35 Z" fill="#1f7ac5"/>
          <!-- Cabin / Windshield -->
          <path d="M22 28 L28 12 C30 8 35 6 42 6 L58 6 C65 6 70 8 72 12 L78 28 Z" fill="#0b1b33"/>
          <path d="M27 26 L31 14 C33 10 37 8 43 8 L57 8 C63 8 67 10 69 14 L73 26 Z" fill="#1e293b" opacity="0.7"/>
          <path d="M31 12 L45 12 L37 26 L26 26 Z" fill="#ffffff" fill-opacity="0.25"/>
          <!-- Main Body Shell (Geometric Crossover) -->
          <rect x="12" y="26" width="76" height="34" rx="8" fill="url(#i5Body)"/>
          <path d="M12 36 L50 38 L88 36" stroke="#ffffff" stroke-width="1" stroke-opacity="0.4"/>
          <!-- Clamshell Hood Crease -->
          <path d="M22 26 L50 30 L78 26" stroke="#7ec3f7" stroke-width="1.5"/>
          <!-- Center Black Gloss Fascia -->
          <rect x="20" y="36" width="60" height="14" rx="3" fill="#091424"/>
          <!-- Parametric Pixel Dual Headlights [■ ■] -->
          <g ${beamGlow}>
            <!-- Left Pixels -->
            <rect x="23" y="39" width="4" height="4" fill="#58ddff" opacity="${beamOpacity}"/>
            <rect x="29" y="39" width="4" height="4" fill="#58ddff" opacity="${beamOpacity}"/>
            <rect x="23" y="44" width="4" height="4" fill="#58ddff" opacity="${beamOpacity}"/>
            <rect x="29" y="44" width="4" height="4" fill="#58ddff" opacity="${beamOpacity}"/>
            <!-- Right Pixels -->
            <rect x="67" y="39" width="4" height="4" fill="#58ddff" opacity="${beamOpacity}"/>
            <rect x="73" y="39" width="4" height="4" fill="#58ddff" opacity="${beamOpacity}"/>
            <rect x="67" y="44" width="4" height="4" fill="#58ddff" opacity="${beamOpacity}"/>
            <rect x="73" y="44" width="4" height="4" fill="#58ddff" opacity="${beamOpacity}"/>
          </g>
          <!-- Active Lower Air Dam / Vents -->
          <rect x="30" y="52" width="40" height="6" rx="2" fill="#091424"/>
          <rect x="34" y="54" width="32" height="2" fill="#38bdf8"/>
          <!-- EV Emblem -->
          <circle cx="50" cy="43" r="3.5" fill="#38bdf8"/>
          <path d="M50 41 L49 43 L51 43 L50 45" stroke="#ffffff" stroke-width="1"/>
        </svg>
      `;

    case 'stargazer':
      // Hyundai Stargazer: Seamless horizontal Horizon DRL bar across the bonnet, large trapezoidal parametric grille, ice-cube vertical headlights
      return `
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="stargazerBody" x1="0" y1="0" x2="100" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#475569"/>
              <stop offset="60%" stop-color="#334155"/>
              <stop offset="100%" stop-color="#1e293b"/>
            </linearGradient>
            <filter id="headlightBeam" x="0" y="15" width="100" height="45" filterUnits="userSpaceOnUse">
              <feGaussianBlur stdDeviation="3" result="glow"/>
              <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <ellipse cx="50" cy="65" rx="42" ry="5" fill="#000000" fill-opacity="0.35"/>
          <rect x="13" y="48" width="11" height="18" rx="4" fill="#0f172a"/>
          <rect x="76" y="48" width="11" height="18" rx="4" fill="#0f172a"/>
          <!-- Curved One-Box MPV Cab -->
          <path d="M19 28 L27 10 C29 6 34 5 42 5 L58 5 C66 5 71 6 73 10 L81 28 Z" fill="#0b1b33"/>
          <path d="M29 9 L44 9 L35 26 L23 26 Z" fill="#ffffff" fill-opacity="0.22"/>
          <!-- Mirrors -->
          <rect x="6" y="27" width="8" height="6" rx="2" fill="#334155"/>
          <rect x="86" y="27" width="8" height="6" rx="2" fill="#334155"/>
          <!-- Aerodynamic Curvaceous MPV Body -->
          <rect x="12" y="25" width="76" height="35" rx="10" fill="url(#stargazerBody)"/>
          <!-- Signature Continuous Seamless Horizon DRL Lightbar -->
          <g ${beamGlow}>
            <rect x="16" y="28" width="68" height="4" rx="2" fill="#ffffff" opacity="${isInTrip ? '1' : '0.75'}"/>
            <rect x="18" y="29" width="64" height="2" fill="#38bdf8" opacity="${isInTrip ? '0.9' : '0.4'}"/>
          </g>
          <!-- Massive Parametric Honeycomb Front Grille -->
          <path d="M24 35 L76 35 L71 56 L29 56 Z" fill="#091424"/>
          <path d="M30 40 H70 M32 45 H68 M34 50 H66" stroke="#475569" stroke-width="1.2" stroke-dasharray="3 2"/>
          <!-- Vertical Ice-Cube Multi-Level LED Headlights -->
          <g ${beamGlow}>
            <!-- Left Vertical Stack -->
            <rect x="15" y="37" width="7" height="15" rx="2" fill="#1e293b"/>
            <rect x="16.5" y="39" width="4" height="3" rx="1" fill="#ffffff" opacity="${beamOpacity}"/>
            <rect x="16.5" y="43" width="4" height="3" rx="1" fill="#ffffff" opacity="${beamOpacity}"/>
            <rect x="16.5" y="47" width="4" height="3" rx="1" fill="#ffffff" opacity="${beamOpacity}"/>
            <!-- Right Vertical Stack -->
            <rect x="78" y="37" width="7" height="15" rx="2" fill="#1e293b"/>
            <rect x="79.5" y="39" width="4" height="3" rx="1" fill="#ffffff" opacity="${beamOpacity}"/>
            <rect x="79.5" y="43" width="4" height="3" rx="1" fill="#ffffff" opacity="${beamOpacity}"/>
            <rect x="79.5" y="47" width="4" height="3" rx="1" fill="#ffffff" opacity="${beamOpacity}"/>
          </g>
          <!-- Lower Silver Skid Garnish -->
          <rect x="36" y="57" width="28" height="4" rx="2" fill="#94a3b8"/>
        </svg>
      `;

    case 'innova':
      // Toyota Kijang Innova Zenix: Bold trapezoidal chrome grille, sharp bi-beam LED headlights, muscular crossover stance
      return `
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="zenixBody" x1="0" y1="0" x2="100" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#3b82f6"/>
              <stop offset="60%" stop-color="#1d4ed8"/>
              <stop offset="100%" stop-color="#172554"/>
            </linearGradient>
            <filter id="headlightBeam" x="0" y="20" width="100" height="40" filterUnits="userSpaceOnUse">
              <feGaussianBlur stdDeviation="3" result="glow"/>
              <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <ellipse cx="50" cy="65" rx="42" ry="5" fill="#000000" fill-opacity="0.35"/>
          <rect x="13" y="48" width="11" height="18" rx="4" fill="#0f172a"/>
          <rect x="76" y="48" width="11" height="18" rx="4" fill="#0f172a"/>
          <!-- Windshield & Roof Rails -->
          <path d="M22 28 L28 10 C30 7 35 6 42 6 L58 6 C65 6 70 7 72 10 L78 28 Z" fill="#0b1b33"/>
          <rect x="25" y="4" width="50" height="2" rx="1" fill="#94a3b8"/>
          <!-- Body Shell -->
          <rect x="12" y="26" width="76" height="34" rx="8" fill="url(#zenixBody)"/>
          <!-- Bi-Beam LED Headlights with Upper Brow -->
          <g ${beamGlow}>
            <polygon points="15,30 35,30 33,38 17,38" fill="#ffffff" opacity="${beamOpacity}"/>
            <polygon points="65,30 85,30 83,38 67,38" fill="#ffffff" opacity="${beamOpacity}"/>
            <line x1="15" y1="29" x2="35" y2="29" stroke="#93c5fd" stroke-width="2"/>
            <line x1="65" y1="29" x2="85" y2="29" stroke="#93c5fd" stroke-width="2"/>
          </g>
          <!-- Hexagonal Trapezoid Grille -->
          <polygon points="35,32 65,32 61,52 39,52" fill="#0a192f" stroke="#60a5fa" stroke-width="1.5"/>
          <line x1="38" y1="38" x2="62" y2="38" stroke="#475569" stroke-width="1.2"/>
          <line x1="40" y1="44" x2="60" y2="44" stroke="#475569" stroke-width="1.2"/>
          <!-- Fog Lamp Accents -->
          <circle cx="23" cy="46" r="3" fill="#facc15" opacity="0.8"/>
          <circle cx="77" cy="46" r="3" fill="#facc15" opacity="0.8"/>
          <!-- Lower Skid Garnish -->
          <rect x="36" y="55" width="28" height="4" rx="2" fill="#cbd5e1"/>
        </svg>
      `;

    case 'camry':
      // Toyota Camry: Sleek executive sedan, low wide aggressive multi-slat air dam, sharp dual projector headlights
      return `
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="camryBody" x1="0" y1="0" x2="100" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#1e293b"/>
              <stop offset="60%" stop-color="#0f172a"/>
              <stop offset="100%" stop-color="#020617"/>
            </linearGradient>
            <filter id="headlightBeam" x="0" y="20" width="100" height="40" filterUnits="userSpaceOnUse">
              <feGaussianBlur stdDeviation="3" result="glow"/>
              <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <ellipse cx="50" cy="65" rx="42" ry="5" fill="#000000" fill-opacity="0.35"/>
          <rect x="12" y="48" width="11" height="18" rx="4" fill="#0f172a"/>
          <rect x="77" y="48" width="11" height="18" rx="4" fill="#0f172a"/>
          <!-- Low-Slung Sedan Glasshouse -->
          <path d="M23 28 L30 11 C32 8 37 7 43 7 L57 7 C63 7 68 8 70 11 L77 28 Z" fill="#0b1b33"/>
          <path d="M31 10 L45 10 L37 26 L26 26 Z" fill="#ffffff" fill-opacity="0.22"/>
          <!-- Low Wide Body Shell -->
          <rect x="11" y="27" width="78" height="32" rx="7" fill="url(#camryBody)"/>
          <!-- Slim Triple-LED Headlights -->
          <g ${beamGlow}>
            <polygon points="14,31 34,32 31,38 16,37" fill="#ffffff" opacity="${beamOpacity}"/>
            <polygon points="66,32 86,31 84,37 69,38" fill="#ffffff" opacity="${beamOpacity}"/>
          </g>
          <!-- Upper Slim Wing -->
          <path d="M34 33 L50 35 L66 33" stroke="#64748b" stroke-width="2"/>
          <!-- Wide Multi-Slat Lower Air Dam -->
          <path d="M22 41 L78 41 L73 54 L27 54 Z" fill="#091424"/>
          <line x1="25" y1="44" x2="75" y2="44" stroke="#475569" stroke-width="1.2"/>
          <line x1="27" y1="47" x2="73" y2="47" stroke="#475569" stroke-width="1.2"/>
          <line x1="29" y1="50" x2="71" y2="50" stroke="#475569" stroke-width="1.2"/>
          <!-- Executive Chrome Lip -->
          <path d="M24 55 L76 55" stroke="#cbd5e1" stroke-width="1.5"/>
        </svg>
      `;

    case 'crv':
      // Honda CR-V: Upright honeycomb grille, solid wing chrome face, muscular SUV bumper
      return `
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="crvBody" x1="0" y1="0" x2="100" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#b91c1c"/>
              <stop offset="60%" stop-color="#991b1b"/>
              <stop offset="100%" stop-color="#450a0a"/>
            </linearGradient>
            <filter id="headlightBeam" x="0" y="20" width="100" height="40" filterUnits="userSpaceOnUse">
              <feGaussianBlur stdDeviation="3" result="glow"/>
              <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <ellipse cx="50" cy="65" rx="42" ry="5" fill="#000000" fill-opacity="0.35"/>
          <rect x="12" y="47" width="12" height="19" rx="4" fill="#0f172a"/>
          <rect x="76" y="47" width="12" height="19" rx="4" fill="#0f172a"/>
          <!-- High Stance SUV Glasshouse -->
          <path d="M22 28 L28 9 C30 6 35 5 42 5 L58 5 C65 5 70 6 72 9 L78 28 Z" fill="#0b1b33"/>
          <rect x="12" y="26" width="76" height="34" rx="8" fill="url(#crvBody)"/>
          <!-- Solid Wing Chrome Bar -->
          <rect x="22" y="29" width="56" height="4" rx="1.5" fill="#e2e8f0"/>
          <!-- Headlights -->
          <g ${beamGlow}>
            <polygon points="15,31 32,32 30,38 16,37" fill="#ffffff" opacity="${beamOpacity}"/>
            <polygon points="68,32 85,31 84,37 70,38" fill="#ffffff" opacity="${beamOpacity}"/>
          </g>
          <!-- Hexagonal Honeycomb Grille -->
          <polygon points="32,33 68,33 64,49 36,49" fill="#0a192f"/>
          <rect x="36" y="52" width="28" height="6" rx="2" fill="#cbd5e1"/>
          <!-- Fog Lamps -->
          <circle cx="22" cy="46" r="3" fill="#facc15" opacity="0.8"/>
          <circle cx="78" cy="46" r="3" fill="#facc15" opacity="0.8"/>
        </svg>
      `;

    default:
      // Generic / Electric / Clean Modern Fleet Vehicle
      return `
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="defBody" x1="0" y1="0" x2="100" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#0284c7"/>
              <stop offset="60%" stop-color="#0369a1"/>
              <stop offset="100%" stop-color="#075985"/>
            </linearGradient>
            <filter id="headlightBeam" x="0" y="20" width="100" height="40" filterUnits="userSpaceOnUse">
              <feGaussianBlur stdDeviation="3" result="glow"/>
              <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <ellipse cx="50" cy="65" rx="42" ry="5" fill="#000000" fill-opacity="0.35"/>
          <rect x="13" y="48" width="11" height="18" rx="4" fill="#0f172a"/>
          <rect x="76" y="48" width="11" height="18" rx="4" fill="#0f172a"/>
          <path d="M22 28 L28 11 C30 8 35 7 42 7 L58 7 C65 7 70 8 72 11 L78 28 Z" fill="#0b1b33"/>
          <rect x="12" y="27" width="76" height="33" rx="8" fill="url(#defBody)"/>
          <g ${beamGlow}>
            <rect x="16" y="32" width="16" height="6" rx="3" fill="#ffffff" opacity="${beamOpacity}"/>
            <rect x="68" y="32" width="16" height="6" rx="3" fill="#ffffff" opacity="${beamOpacity}"/>
          </g>
          <rect x="34" y="36" width="32" height="14" rx="3" fill="#091424"/>
          <rect x="38" y="52" width="24" height="4" rx="2" fill="#94a3b8"/>
        </svg>
      `;
  }
}

/**
 * Generates an SVG Data URI for realistic driver profile photos if none uploaded
 */
export function getDriverAvatarDataUri(name: string, photoUrl?: string | null): string {
  if (photoUrl && photoUrl.trim().length > 0) {
    return photoUrl;
  }

  // Consistent hash for driver initials and palette
  let hash = 0;
  for (let i = 0; i < (name || 'Driver').length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const colors = [
    { bg: '#0072de', cap: '#005bb5', skin: '#f6d1b1' },
    { bg: '#0f172a', cap: '#1e293b', skin: '#e5b894' },
    { bg: '#4f46e5', cap: '#3730a3', skin: '#fcd34d' },
    { bg: '#d97706', cap: '#b45309', skin: '#f6c39a' },
  ];
  const p = colors[Math.abs(hash) % colors.length];
  const initial = (name || 'D').trim().charAt(0).toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <circle cx="50" cy="50" r="48" fill="${p.bg}"/>
    <!-- Driver Shoulders & Driver Uniform -->
    <path d="M20 94 C20 74 34 68 50 68 C66 68 80 74 80 94 Z" fill="#0f172a"/>
    <!-- Collar & Tie -->
    <polygon points="50,68 44,78 50,88 56,78" fill="#ffffff"/>
    <polygon points="50,78 47,94 53,94" fill="#0072de"/>
    <!-- Neck & Face -->
    <rect x="44" y="54" width="12" height="16" rx="4" fill="${p.skin}"/>
    <ellipse cx="50" cy="46" rx="16" ry="18" fill="${p.skin}"/>
    <!-- Eyes & Smile -->
    <circle cx="44" cy="46" r="2" fill="#0f172a"/>
    <circle cx="56" cy="46" r="2" fill="#0f172a"/>
    <path d="M46 54 Q50 58 54 54" stroke="#0f172a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <!-- Professional Driver Cap with Gold Band -->
    <path d="M30 36 C30 24 70 24 70 36 Z" fill="${p.cap}"/>
    <rect x="28" y="34" width="44" height="4" rx="2" fill="#facc15"/>
    <path d="M26 38 C32 40 68 40 74 38 Z" fill="#0f172a"/>
    <!-- Driver Initial Gold Badge -->
    <circle cx="50" cy="30" r="5" fill="#facc15"/>
    <text x="50" y="33" font-size="6" font-family="sans-serif" font-weight="bold" fill="#0f172a" text-anchor="middle">${initial}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
