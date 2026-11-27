import { useSyncExternalStore } from 'react';

/**
 * Display Mode (Mobile Appearance vs Web Appearance)
 * ---------------------------------------------------------------------------
 * - 'mobile' (default): the app renders as a full-width native-feeling mobile app.
 *   On mobile phones it is 100% edge-to-edge (no side gaps, no borders, no deadzones).
 *   Components, hero service cards, touch targets, and typography use comfortable,
 *   proportional Gojek-style mobile sizing.
 * - 'web': the app renders the responsive desktop/web layout (topbar navigation,
 *   admin sidebar, multi-column tables, widescreen panels).
 *
 * Switching modes updates <html data-display-mode="mobile|web"> and localStorage.
 * The viewport meta is kept native (width=device-width, initial-scale=1.0) so
 * mobile browsers NEVER get trapped in a zoomed-out desktop scale.
 */
export type DisplayMode = 'mobile' | 'web';

export const DISPLAY_MODE_STORAGE_KEY = 'gf_display_mode';
export const DEFAULT_DISPLAY_MODE: DisplayMode = 'mobile';
export const MOBILE_FRAME_MAX_WIDTH = 480;

const listeners = new Set<() => void>();

function readStoredMode(): DisplayMode {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(DISPLAY_MODE_STORAGE_KEY) : null;
    return saved === 'web' || saved === 'mobile' ? saved : DEFAULT_DISPLAY_MODE;
  } catch {
    return DEFAULT_DISPLAY_MODE;
  }
}

let currentMode: DisplayMode = readStoredMode();

export function getDisplayMode(): DisplayMode {
  return currentMode;
}

let resizeBound = false;
let currentZoomRatio = 1;

function syncMobileViewportZoom(mode: DisplayMode) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const root = document.documentElement;
  const screenShortSide = Math.min(window.screen?.width || 9999, window.screen?.height || 9999);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isPhoneDevice = screenShortSide <= 540 || /Android.*Mobile|iPhone|iPod/i.test(ua);

  // If a mobile browser (like Chrome Android with "Desktop site" active) forces a 980px layout viewport,
  // scale html via CSS zoom so the app renders at the exact 1:1 native phone width and proportions as Samsung Browser.
  // Because CSS 100dvh/100vh in Chromium is not divided by CSS zoom, we also publish --app-dvh and --app-dvh-unit
  // divided by zoomRatio so full-screen pages and bottom sheets never exceed the visible screen height.
  if (mode === 'mobile' && isPhoneDevice && window.innerWidth > 540) {
    const targetPhoneWidth = screenShortSide >= 320 && screenShortSide <= 480 ? screenShortSide : 412;
    const zoomRatio = Number((window.innerWidth / targetPhoneWidth).toFixed(4));
    currentZoomRatio = zoomRatio > 0 ? zoomRatio : 1;
    root.style.zoom = String(currentZoomRatio);
    root.setAttribute('data-forced-mobile-zoom', 'true');
    const rawVh = window.innerHeight || 844;
    const effectiveVhPx = Math.max(480, Math.round(rawVh / currentZoomRatio));
    root.style.setProperty('--app-dvh', `${effectiveVhPx}px`);
    root.style.setProperty('--app-dvh-unit', `${(effectiveVhPx / 100).toFixed(4)}px`);
  } else {
    currentZoomRatio = 1;
    root.style.zoom = '';
    root.removeAttribute('data-forced-mobile-zoom');
    root.style.setProperty('--app-dvh', '100dvh');
    root.style.setProperty('--app-dvh-unit', '1dvh');
  }
}

export function getAppFrameHeight(): number {
  if (typeof window === 'undefined') return 844;
  return Math.max(480, Math.round((window.innerHeight || 844) / (currentZoomRatio || 1)));
}

/** Applies the mode to <html data-display-mode="mobile|web"> */
export function applyDisplayMode(mode: DisplayMode = currentMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-display-mode', mode);
  if (root.getAttribute('data-theme') !== 'light') {
    root.setAttribute('data-theme', 'dark');
  }

  // Always enforce proper native mobile viewport scaling with zero zoom distortion
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute('content', 'width=device-width, initial-scale=1.0, minimum-scale=1.0, viewport-fit=cover, maximum-scale=5.0');
  }

  syncMobileViewportZoom(mode);

  if (typeof window !== 'undefined' && !resizeBound) {
    resizeBound = true;
    window.addEventListener('resize', () => {
      syncMobileViewportZoom(currentMode);
    });
  }

  // Leaflet maps & other size-aware widgets listen to resize to recompute layout.
  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
}

export function setDisplayMode(mode: DisplayMode) {
  currentMode = mode;
  try {
    localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, mode);
  } catch {
    /* storage unavailable (private mode) — keep in-memory only */
  }
  applyDisplayMode(mode);
  listeners.forEach((fn) => fn());
}

export function toggleDisplayMode() {
  setDisplayMode(currentMode === 'mobile' ? 'web' : 'mobile');
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useDisplayMode(): { mode: DisplayMode; setMode: (m: DisplayMode) => void; toggle: () => void; isMobile: boolean } {
  const mode = useSyncExternalStore(subscribe, getDisplayMode, () => DEFAULT_DISPLAY_MODE);
  return { mode, setMode: setDisplayMode, toggle: toggleDisplayMode, isMobile: mode === 'mobile' };
}

/** Width of the rendered app frame (#root) */
export function getAppFrameWidth(): number {
  if (typeof document === 'undefined') return 1024;
  const root = document.getElementById('root');
  return root?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1024);
}
