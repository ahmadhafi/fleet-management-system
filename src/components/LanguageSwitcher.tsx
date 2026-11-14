import React, { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

export type SupportedLang = 'en' | 'id' | 'ko';

const LANGUAGES: Array<{ code: SupportedLang; short: string; label: string }> = [
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'id', short: 'ID', label: 'Indonesia' },
  { code: 'ko', short: 'KO', label: '한국어' },
];

function getInitialLanguage(): SupportedLang {
  try {
    const saved = localStorage.getItem('gf_lang') as SupportedLang | null;
    if (saved && ['en', 'id', 'ko'].includes(saved)) {
      return saved;
    }
    const match = document.cookie.match(/(?:^|;\s*)googtrans=\/en\/(en|id|ko)/);
    if (match && (match[1] === 'en' || match[1] === 'id' || match[1] === 'ko')) {
      return match[1];
    }
  } catch {
    // ignore storage access errors
  }
  return 'en';
}

function setGoogTransCookie(lang: SupportedLang) {
  try {
    const cookieVal = `/en/${lang}`;
    document.cookie = `googtrans=${cookieVal}; path=/; SameSite=Lax`;
    const host = window.location.hostname;
    if (host && host.includes('.')) {
      document.cookie = `googtrans=${cookieVal}; path=/; domain=${host}; SameSite=Lax`;
      const parts = host.split('.');
      if (parts.length >= 2) {
        const rootDomain = `.${parts.slice(-2).join('.')}`;
        document.cookie = `googtrans=${cookieVal}; path=/; domain=${rootDomain}; SameSite=Lax`;
      }
    }
  } catch {
    // ignore cookie errors
  }
}

function triggerGoogleTranslateCombo(lang: SupportedLang): boolean {
  const combo = document.querySelector('select.goog-te-combo') as HTMLSelectElement | null;
  if (!combo) return false;
  combo.value = lang;
  combo.dispatchEvent(new Event('change', { bubbles: true }));
  combo.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

export const LanguageSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [lang, setLang] = useState<SupportedLang>(() => getInitialLanguage());

  useEffect(() => {
    const initial = getInitialLanguage();
    if (initial !== 'en') {
      setGoogTransCookie(initial);
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        if (triggerGoogleTranslateCombo(initial) || attempts >= 15) {
          window.clearInterval(timer);
        }
      }, 300);
      return () => window.clearInterval(timer);
    }
  }, []);

  const handleSelectLanguage = (nextLang: SupportedLang) => {
    setLang(nextLang);
    try {
      localStorage.setItem('gf_lang', nextLang);
    } catch {
      // ignore
    }
    setGoogTransCookie(nextLang);
    document.documentElement.lang = nextLang;

    const triggered = triggerGoogleTranslateCombo(nextLang);
    if (!triggered) {
      // Retry shortly in case Google Translate widget is still initializing
      let tries = 0;
      const retry = window.setInterval(() => {
        tries += 1;
        if (triggerGoogleTranslateCombo(nextLang) || tries >= 8) {
          window.clearInterval(retry);
          if (tries >= 8 && nextLang !== 'en') {
            window.location.reload();
          }
        }
      }, 250);
    } else if (nextLang === 'en') {
      // Ensure switching back to English clears any residual translated DOM nodes if needed
      window.setTimeout(() => {
        triggerGoogleTranslateCombo('en');
      }, 150);
    }
  };

  return (
    <div
      className="notranslate"
      translate="no"
      role="group"
      aria-label="Language selector (Google Translate)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        padding: '3px',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--color-bg-subtle)',
        border: '1px solid var(--color-border-divider)',
      }}
    >
      <Globe
        size={15}
        style={{
          marginLeft: '8px',
          marginRight: '4px',
          color: 'var(--color-text-secondary)',
          flexShrink: 0,
        }}
      />
      {LANGUAGES.map((item) => {
        const active = lang === item.code;
        return (
          <button
            key={item.code}
            type="button"
            onClick={() => handleSelectLanguage(item.code)}
            title={`Translate app to ${item.label} (Google Translate)`}
            style={{
              border: 'none',
              cursor: 'pointer',
              padding: compact ? '4px 8px' : '6px 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: compact ? '12px' : '13px',
              fontWeight: 800,
              lineHeight: 1.2,
              background: active ? 'var(--color-green)' : 'transparent',
              color: active ? '#ffffff' : 'var(--color-text-secondary)',
              transition: 'all 140ms ease',
            }}
          >
            {compact ? item.short : `${item.short} ${item.label}`}
          </button>
        );
      })}
    </div>
  );
};
