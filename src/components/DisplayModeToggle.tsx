import React from 'react';
import { Smartphone, Monitor } from 'lucide-react';
import { useDisplayMode, type DisplayMode } from '../utils/displayMode';
import { useAppLanguage } from '../utils/i18n';

interface DisplayModeToggleProps {
  /** 'icon' = tiny single round button that flips mode; 'compact' = 2 icon segments; 'full' = 2 segments with labels */
  variant?: 'icon' | 'compact' | 'full';
  darkGlass?: boolean;
  id?: string;
}

const OPTIONS: Array<{ mode: DisplayMode; label: string; Icon: typeof Smartphone }> = [
  { mode: 'mobile', label: 'Mobile', Icon: Smartphone },
  { mode: 'web', label: 'Web', Icon: Monitor },
];

/**
 * One-tap switch between Mobile appearance (phone frame, compact) and
 * Web appearance (full responsive desktop layout). Persisted in localStorage.
 */
export const DisplayModeToggle: React.FC<DisplayModeToggleProps> = ({ variant = 'compact', darkGlass = false, id }) => {
  const { mode, setMode, toggle } = useDisplayMode();
  const { t } = useAppLanguage();

  if (variant === 'icon') {
    const NextIcon = mode === 'mobile' ? Monitor : Smartphone;
    const title = mode === 'mobile' ? t('Switch to Web View') : t('Switch to Mobile View');
    return (
      <button
        id={id}
        type="button"
        className={`gf-display-toggle-icon pressable ${darkGlass ? 'is-dark-glass' : ''}`}
        onClick={toggle}
        title={title}
        aria-label={title}
        data-display-mode-toggle={mode}
      >
        <NextIcon size={16} />
      </button>
    );
  }

  return (
    <div
      id={id}
      className={`gf-display-toggle ${variant === 'full' ? 'is-full' : ''} ${darkGlass ? 'is-dark-glass' : ''}`}
      role="radiogroup"
      aria-label={t('Display Mode')}
      data-display-mode-toggle={mode}
    >
      {OPTIONS.map(({ mode: m, label, Icon }) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            id={id ? `${id}-${m}` : undefined}
            className={`gf-display-toggle-btn pressable ${active ? 'is-active' : ''}`}
            onClick={() => setMode(m)}
            title={m === 'mobile' ? t('Mobile View') : t('Web View')}
          >
            <Icon size={variant === 'full' ? 15 : 13} />
            {variant === 'full' && <span>{m === 'mobile' ? t('Mobile View') : t('Web View')}</span>}
            {variant === 'compact' && <span className="gf-display-toggle-label">{t(label)}</span>}
          </button>
        );
      })}
    </div>
  );
};
