import React from 'react';
import { ArrowUp, Plus, X } from 'lucide-react';
import { useAppLanguage } from '../utils/i18n';

interface RouteFieldsProps {
  pickup: string;
  destination: string;
  onPickupChange: (v: string) => void;
  onDestinationChange: (v: string) => void;
  activeField: 'pickup' | 'destination';
  onFocusField: (f: 'pickup' | 'destination') => void;
  pickupPlaceholder?: string;
  destinationPlaceholder?: string;
  onAddStop?: () => void;
  multiStopToast?: string | null;
}

export const RouteFields: React.FC<RouteFieldsProps> = ({
  pickup,
  destination,
  onPickupChange,
  onDestinationChange,
  activeField,
  onFocusField,
  pickupPlaceholder,
  destinationPlaceholder,
  onAddStop,
  multiStopToast,
}) => {
  const { t } = useAppLanguage();

  const finalPickupPlaceholder = pickupPlaceholder || t('Current pickup point');
  const finalDestPlaceholder = destinationPlaceholder || t('Where to?');

  return (
    <div className="gf-route-box" style={{ position: 'relative' }}>
      {multiStopToast && (
        <div className="gf-multi-stop-toast" role="alert">
          {multiStopToast}
        </div>
      )}
      {/* Samsung Blue pickup up-arrow circle + vertical dotted line + Black/White destination ring-dot */}
      <div className="gf-route-track" aria-hidden="true">
        <span className="gf-pickup-up-circle">
          <ArrowUp size={13} strokeWidth={3} />
        </span>
        <span className="gf-route-dotted" />
        <span className="gf-dest-ring-dot" />
      </div>

      <div className="gf-route-inputs">
        <div className="gf-route-field">
          <input
            id="route-pickup-input"
            type="text"
            className="gf-route-input"
            aria-label={t('Pickup location')}
            placeholder={finalPickupPlaceholder}
            value={pickup}
            onFocus={() => onFocusField('pickup')}
            onChange={(e) => onPickupChange(e.target.value)}
            style={{
              color: activeField === 'pickup' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            }}
          />
          {pickup && (
            <button
              type="button"
              aria-label={t('Clear pickup')}
              onClick={() => onPickupChange('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                minWidth: '36px',
                minHeight: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="gf-route-field">
          <input
            id="route-destination-input"
            type="text"
            className="gf-route-input"
            aria-label={t('Destination location')}
            placeholder={finalDestPlaceholder}
            value={destination}
            onFocus={() => onFocusField('destination')}
            onChange={(e) => onDestinationChange(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {destination && (
              <button
                type="button"
                aria-label={t('Clear destination')}
                onClick={() => onDestinationChange('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  minWidth: '32px',
                  minHeight: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            )}
            {onAddStop && (
              <button
                id="route-add-stop-btn"
                type="button"
                className="gf-add-stop-btn pressable"
                onClick={onAddStop}
                aria-label={t('Add destination')}
                title={t('Add trip destination')}
              >
                <span className="gf-add-stop-icon-circle">
                  <Plus size={10} strokeWidth={3} />
                </span>
                <span>{t('Add')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
