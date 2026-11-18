import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { t } from '../src/utils/i18n';
import { DEFAULT_DISPLAY_MODE, DISPLAY_MODE_STORAGE_KEY, MOBILE_FRAME_MAX_WIDTH } from '../src/utils/displayMode';

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

describe('Display Mode: Mobile appearance ⇄ Web appearance toggle', () => {
  it('defaults to mobile appearance and persists under gf_display_mode', () => {
    expect(DEFAULT_DISPLAY_MODE).toBe('mobile');
    expect(DISPLAY_MODE_STORAGE_KEY).toBe('gf_display_mode');
    expect(MOBILE_FRAME_MAX_WIDTH).toBe(430);
    const src = read('../src/utils/displayMode.ts');
    expect(src).toContain("setAttribute('data-display-mode'");
    expect(src).toContain('width=${WEB_VIEWPORT_WIDTH}');
  });

  it('applies the mode before first render and scrolls inside the #root app frame', () => {
    const main = read('../src/main.tsx');
    expect(main).toContain('applyDisplayMode()');
    expect(main).toContain('gf-app-scroller');
  });

  it('layout CSS is driven by the #root frame width via container queries', () => {
    const css = read('../src/styles/app.css');
    expect(css).toContain('container: gfapp / inline-size');
    expect(css).toContain('contain: layout');
    expect(css).toContain("html[data-display-mode='mobile'] #root");
    expect(css).toContain('max-width: 430px');
    // No viewport-width layout breakpoints remain (only prefers-color-scheme / print / landscape safeguard)
    const widthMedia = css.match(/@media \((?:min|max)-width:[^{]*\{/g) || [];
    expect(widthMedia.every((m) => m.includes('orientation') || m.includes("520px"))).toBe(true);
    expect(css).not.toMatch(/#0aa211|#09ba11|#0cb417|#059669|#10b981|#16a34a|#065f46|#166534|#f0fdf4|#dcfce7|#ecfdf5|#bbf7d0/i);
  });

  it('toggle is reachable from auth, topbars, admin, driver, home and profile screens', () => {
    const app = read('../src/App.tsx');
    const shell = read('../src/components/AppShell.tsx');
    for (const id of ['auth-display-mode-toggle', 'driver-display-mode-toggle', 'home-display-mode-toggle', 'profile-display-mode-toggle-0', 'profile-display-mode-toggle-1']) {
      expect(app).toContain(id);
    }
    for (const id of ['topbar-display-mode-toggle', 'admin-topbar-display-mode-toggle', 'desktop-header-display-mode-toggle']) {
      expect(shell).toContain(id);
    }
    // required booking DOM IDs preserved
    for (const id of ['home-where-to-btn', 'submit-booking-btn', 'confirm-prebooking-submit-btn', 'driver-online-toggle-sheet-btn']) {
      expect(app).toContain(id);
    }
  });

  it('translates toggle labels into Indonesian and Korean', () => {
    expect(t('Display Mode', 'id')).toBe('Mode Tampilan');
    expect(t('Mobile View', 'id')).toBe('Tampilan Seluler');
    expect(t('Web View', 'ko')).toBe('웹 보기');
    expect(t('Switch to Web View', 'id')).toBe('Beralih ke Tampilan Web');
  });
});
