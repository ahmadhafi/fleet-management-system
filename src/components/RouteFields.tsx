import React from 'react';
import { ArrowUp, X } from 'lucide-react';

interface RouteFieldsProps {
  pickup: string;
  destination: string;
  onPickupChange: (v: string) => void;
  onDestinationChange: (v: string) => void;
  activeField: 'pickup' | 'destination';
  onFocusField: (f: 'pickup' | 'destination') => void;
  pickupPlaceholder?: string;
  destinationPlaceholder?: string;
}

export const RouteFields: React.FC<RouteFieldsProps> = ({
  pickup,
  destination,
  onPickupChange,
  onDestinationChange,
  activeField,
  onFocusField,
  pickupPlaceholder = 'Current pickup point',
  destinationPlaceholder = 'Where to?',
}) => {
  return (
    <div className="gf-route-box">
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
            aria-label="Pickup location"
            placeholder={pickupPlaceholder}
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
              aria-label="Clear pickup"
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
            aria-label="Destination location"
            placeholder={destinationPlaceholder}
            value={destination}
            onFocus={() => onFocusField('destination')}
            onChange={(e) => onDestinationChange(e.target.value)}
            autoFocus
          />
          {destination && (
            <button
              type="button"
              aria-label="Clear destination"
              onClick={() => onDestinationChange('')}
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
      </div>
    </div>
  );
};
