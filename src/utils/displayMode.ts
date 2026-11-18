import { useSyncExternalStore } from 'react';

/**
 * Display Mode (Mobile Appearance vs Web Appearance)
 * ---------------------------------------------------------------------------
 * - 'mobile' (default): the app renders as a native-feeling phone app. On real
 *   phones it is edge-to-edge; on tablets/desktops it is centered inside a
 *   430px phone frame so the layout always uses the compact mobile proportions.
 * - 'web': the app renders the full responsive web/desktop layout (topbar nav,
 *   sidebar, side-by-side map panel, full data tables). On small phones the
 *   viewport is widened to 1280px (same behaviour as "Request desktop site").
 *
 * Layout CSS uses `@container gfapp (...)` queries against `#root`, so the
 * frame width (not the browser width) decides which layout rules apply.
 */
export type DisplayMode = 'mobile' | 'web';

export const DISPLAY_MODE_STORAGE_KEY = 'gf_display_mode';
export const DEFAULT_DISPLAY_MODE: DisplayMode = 'mobile';
export const MOBILE_FRAME_MAX_WIDTH = 430;
export const WEB_VIEWPORT_WIDTH = 1280;

const DEFAULT_VIEWPORT_CONTENT = 'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=5.0';

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

/** Applies the mode to <html data-display-mode> and adjusts the viewport meta for phones. */
export function applyDisplayMode(mode: DisplayMode = currentMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-display-mode', mode);

  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    const screenWidth = typeof window !== 'undefined' ? Math.min(window.screen?.width || 9999, window.screen?.height || 9999) : 9999;
    const isSmallDevice = screenWidth < 1024;
    const nextContent =
      mode === 'web' && isSmallDevice
        ? `width=${WEB_VIEWPORT_WIDTH}, viewport-fit=cover`
        : DEFAULT_VIEWPORT_CONTENT;
    if (meta.getAttribute('content') !== nextContent) meta.setAttribute('content', nextContent);
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

/** Width of the rendered app frame (#root) — use instead of window.innerWidth for layout decisions. */
export function getAppFrameWidth(): number {
  if (typeof document === 'undefined') return 1024;
  const root = document.getElementById('root');
  return root?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1024);
}
