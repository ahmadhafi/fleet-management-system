import React, { useEffect } from 'react';
import { Globe } from 'lucide-react';
import {
  type SupportedLang,
  SUPPORTED_LANGUAGES,
  useAppLanguage,
  startDomTranslationObserver,
} from '../utils/i18n';

export type { SupportedLang };

export const LanguageSwitcher: React.FC<{ compact?: boolean; darkGlass?: boolean }> = ({
  compact = false,
  darkGlass = false,
}) => {
  const { lang, setLang } = useAppLanguage();

  useEffect(() => {
    startDomTranslationObserver();
  }, []);

  const handleSelectLanguage = (nextLang: SupportedLang) => {
    setLang(nextLang);
  };

  return (
    <div
      className={`gf-lang-switcher notranslate ${compact ? 'is-compact' : ''}`}
      translate="no"
      role="group"
      aria-label="Language selector"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        padding: compact ? '2px 3px' : '3px 4px',
        borderRadius: 'var(--radius-pill)',
        background: darkGlass ? 'rgba(255, 255, 255, 0.10)' : 'var(--color-bg-subtle)',
        border: darkGlass ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid var(--color-border)',
        backdropFilter: darkGlass ? 'blur(20px)' : undefined,
        WebkitBackdropFilter: darkGlass ? 'blur(20px)' : undefined,
        height: compact ? '32px' : '36px',
        maxWidth: '100%',
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <Globe
        size={13}
        className="gf-lang-globe"
        style={{
          marginLeft: compact ? '4px' : '6px',
          marginRight: '2px',
          color: darkGlass ? 'rgba(255, 255, 255, 0.85)' : 'var(--color-text-secondary)',
          flexShrink: 0,
        }}
      />
      {SUPPORTED_LANGUAGES.map((item) => {
        const active = lang === item.code;
        return (
          <button
            key={item.code}
            type="button"
            onClick={() => handleSelectLanguage(item.code)}
            title={`Translate app to ${item.label}`}
            aria-label={`Translate app to ${item.label}`}
            className={`gf-lang-btn pressable ${active ? 'is-active' : ''}`}
            style={{
              border: 'none',
              cursor: 'pointer',
              padding: compact ? '3px 6px' : '4px 8px',
              borderRadius: 'var(--radius-pill)',
              fontSize: compact ? '11px' : '12px',
              fontWeight: 800,
              lineHeight: 1.2,
              minWidth: compact ? '24px' : '30px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              background: active
                ? 'var(--color-samsung-blue, #0072de)'
                : 'transparent',
              color: active
                ? '#ffffff'
                : darkGlass
                ? 'rgba(255, 255, 255, 0.85)'
                : 'var(--color-text-secondary)',
              boxShadow: active
                ? '0 2px 6px rgba(0, 114, 222, 0.35)'
                : 'none',
              transition: 'all 140ms ease',
            }}
          >
            {compact ? (
              item.short
            ) : (
              <>
                <span>{item.short}</span>
                <span className="gf-lang-label-full"> {item.label}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
};
