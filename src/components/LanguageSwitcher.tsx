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
      className="notranslate"
      translate="no"
      role="group"
      aria-label="Language selector"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: compact ? '3px 4px' : '4px 6px',
        borderRadius: 'var(--radius-pill)',
        background: darkGlass ? 'rgba(255, 255, 255, 0.10)' : 'var(--color-bg-subtle)',
        border: darkGlass ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid var(--color-border)',
        backdropFilter: darkGlass ? 'blur(20px)' : undefined,
        WebkitBackdropFilter: darkGlass ? 'blur(20px)' : undefined,
        height: compact ? '40px' : '44px',
        flexShrink: 0,
      }}
    >
      <Globe
        size={15}
        style={{
          marginLeft: compact ? '6px' : '8px',
          marginRight: '3px',
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
            className="pressable"
            style={{
              border: 'none',
              cursor: 'pointer',
              padding: compact ? '4px 9px' : '6px 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: compact ? '12px' : '13px',
              fontWeight: 800,
              lineHeight: 1.2,
              minWidth: compact ? '32px' : '40px',
              textAlign: 'center',
              background: active
                ? 'var(--color-samsung-blue, #0072de)'
                : 'transparent',
              color: active
                ? '#ffffff'
                : darkGlass
                ? 'rgba(255, 255, 255, 0.85)'
                : 'var(--color-text-secondary)',
              boxShadow: active
                ? '0 2px 8px rgba(0, 114, 222, 0.45)'
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
