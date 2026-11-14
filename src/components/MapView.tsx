import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, WifiOff, Navigation2, Crosshair } from 'lucide-react';

export interface MapHub {
  name: string;
  address: string;
  x: number; // 0..1000 SVG coordinate space
  y: number; // 0..700 SVG coordinate space
  category?: 'hq' | 'cbd' | 'airport' | 'tech' | 'logistics';
}

export const CORPORATE_HUBS: MapHub[] = [
  { name: 'HQ Tower Lobby', address: 'Jl. Jend. Sudirman Kav. 52, South Jakarta', x: 460, y: 360, category: 'hq' },
  { name: 'SCBD District 8', address: 'Senopati Suites, Kebayoran Baru', x: 415, y: 415, category: 'cbd' },
  { name: 'Kuningan Business District', address: 'Jl. H.R. Rasuna Said, South Jakarta', x: 540, y: 395, category: 'cbd' },
  { name: 'Data Center Cibitung', address: 'MM2100 Industrial Town, Bekasi', x: 820, y: 345, category: 'tech' },
  { name: 'Soekarno-Hatta Terminal 3', address: 'International Airport, Tangerang', x: 165, y: 175, category: 'airport' },
  { name: 'BSD Green Office Park', address: 'Jl. Grand Boulevard BSD City, Tangerang', x: 225, y: 530, category: 'cbd' },
  { name: 'Tangerang Logistics Hub', address: 'Karawaci Cargo Complex, Tangerang', x: 255, y: 325, category: 'logistics' },
  { name: 'Kemayoran Tech Park', address: 'Bandar Kemayoran Blok C, Central Jakarta', x: 565, y: 215, category: 'tech' },
];

export function resolvePlaceCoords(placeName: string): { x: number; y: number; label: string } {
  const lower = (placeName || '').toLowerCase().trim();
  const exact = CORPORATE_HUBS.find(
    (h) => h.name.toLowerCase() === lower || lower.includes(h.name.toLowerCase().split(' ')[0])
  );
  if (exact) return { x: exact.x, y: exact.y, label: exact.name };

  if (!lower) return { x: 460, y: 360, label: 'HQ Tower Lobby' };

  // Deterministic pseudo-coordinates from place name hash so every address sits cleanly on the road network
  let hash = 0;
  for (let i = 0; i < lower.length; i++) {
    hash = (hash * 31 + lower.charCodeAt(i)) >>> 0;
  }
  const x = 180 + (hash % 640);
  const y = 160 + ((hash >> 8) % 380);
  return { x, y, label: placeName };
}

export function estimateRouteMetrics(origin: string, destination: string): { distanceKm: number; durationMin: number } {
  if (!destination.trim()) return { distanceKm: 0, durationMin: 0 };
  const a = resolvePlaceCoords(origin);
  const b = resolvePlaceCoords(destination);
  const pxDist = Math.hypot(b.x - a.x, b.y - a.y);
  const km = Math.max(2.4, Number((pxDist * 0.068).toFixed(1)));
  const min = Math.max(9, Math.round(km * 2.15 + 4));
  return { distanceKm: km, durationMin: min };
}

interface MapViewProps {
  origin: string;
  destination: string;
  showRoute?: boolean;
  pinMode?: boolean;
  onPinMoveAddress?: (address: string) => void;
  waitingRadar?: boolean;
  driverActive?: boolean;
  driverName?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  isOffline?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  origin,
  destination,
  showRoute = false,
  pinMode = false,
  onPinMoveAddress,
  waitingRadar = false,
  driverActive = false,
  driverName,
  showBackButton = false,
  onBack,
  isOffline = false,
}) => {
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const pickupPt = useMemo(() => resolvePlaceCoords(origin || 'HQ Tower Lobby'), [origin]);
  const destPt = useMemo(() => (destination ? resolvePlaceCoords(destination) : null), [destination]);

  // Nearest hub to current center when panning in Pin on map mode
  const pinCenterX = 500 - panOffset.x;
  const pinCenterY = 340 - panOffset.y;

  const pinnedLabel = useMemo(() => {
    if (!pinMode) return '';
    let closest = CORPORATE_HUBS[0];
    let bestDist = Infinity;
    for (const h of CORPORATE_HUBS) {
      const d = Math.hypot(h.x - pinCenterX, h.y - pinCenterY);
      if (d < bestDist) {
        bestDist = d;
        closest = h;
      }
    }
    return bestDist < 120 ? closest.name : `Pinned Point (${( -6.18 - (pinCenterY - 350) * 0.0004).toFixed(4)}, ${(106.82 + (pinCenterX - 500) * 0.0004).toFixed(4)})`;
  }, [pinMode, pinCenterX, pinCenterY]);

  // Fit route cleanly inside upper-center / visible canvas
  const cameraTransform = useMemo(() => {
    if (pinMode) {
      return `translate(${panOffset.x}px, ${panOffset.y}px)`;
    }
    if (showRoute && destPt) {
      const midX = (pickupPt.x + destPt.x) / 2;
      const midY = (pickupPt.y + destPt.y) / 2;
      const shiftX = (500 - midX) * 0.45;
      const shiftY = (290 - midY) * 0.45;
      return `translate(${Math.round(shiftX)}px, ${Math.round(shiftY)}px)`;
    }
    const shiftX = (500 - pickupPt.x) * 0.3;
    const shiftY = (270 - pickupPt.y) * 0.3;
    return `translate(${Math.round(shiftX)}px, ${Math.round(shiftY)}px)`;
  }, [pinMode, panOffset, showRoute, destPt, pickupPt]);

  const metrics = useMemo(() => estimateRouteMetrics(origin, destination), [origin, destination]);

  const routePathD = useMemo(() => {
    if (!destPt) return '';
    const ctrlX = (pickupPt.x + destPt.x) / 2 + (destPt.y - pickupPt.y) * 0.16;
    const ctrlY = (pickupPt.y + destPt.y) / 2 - (destPt.x - pickupPt.x) * 0.12;
    return `M ${pickupPt.x} ${pickupPt.y} Q ${ctrlX} ${ctrlY} ${destPt.x} ${destPt.y}`;
  }, [pickupPt, destPt]);

  // Driver vehicle midpoint along curve
  const driverPt = useMemo(() => {
    if (!driverActive) return null;
    if (!destPt) return { x: pickupPt.x - 36, y: pickupPt.y - 24 };
    const t = 0.32;
    const ctrlX = (pickupPt.x + destPt.x) / 2 + (destPt.y - pickupPt.y) * 0.16;
    const ctrlY = (pickupPt.y + destPt.y) / 2 - (destPt.x - pickupPt.x) * 0.12;
    const x = (1 - t) * (1 - t) * pickupPt.x + 2 * (1 - t) * t * ctrlX + t * t * destPt.x;
    const y = (1 - t) * (1 - t) * pickupPt.y + 2 * (1 - t) * t * ctrlY + t * t * destPt.y;
    return { x, y };
  }, [driverActive, pickupPt, destPt]);

  const handleMapPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pinMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingMap(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
  };

  const handleMapPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pinMode || !isDraggingMap) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanOffset({
      x: Math.max(-280, Math.min(280, dragStartRef.current.ox + dx)),
      y: Math.max(-200, Math.min(200, dragStartRef.current.oy + dy)),
    });
  };

  const handleMapPointerUp = () => {
    if (!pinMode || !isDraggingMap) return;
    setIsDraggingMap(false);
    if (onPinMoveAddress) {
      onPinMoveAddress(pinnedLabel);
    }
  };

  const handleMapKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!pinMode) return;
    const step = 28;
    let nx = panOffset.x;
    let ny = panOffset.y;
    if (e.key === 'ArrowLeft') nx += step;
    else if (e.key === 'ArrowRight') nx -= step;
    else if (e.key === 'ArrowUp') ny += step;
    else if (e.key === 'ArrowDown') ny -= step;
    else return;
    e.preventDefault();
    const clamped = { x: Math.max(-280, Math.min(280, nx)), y: Math.max(-200, Math.min(200, ny)) };
    setPanOffset(clamped);
    if (onPinMoveAddress) onPinMoveAddress(pinnedLabel);
  };

  return (
    <div
      className="gf-map-stage"
      onPointerDown={handleMapPointerDown}
      onPointerMove={handleMapPointerMove}
      onPointerUp={handleMapPointerUp}
      onPointerCancel={handleMapPointerUp}
      onKeyDown={handleMapKeyDown}
      tabIndex={pinMode ? 0 : -1}
      aria-label={pinMode ? 'Interactive map: drag or use arrow keys to place pin' : 'Route map view'}
      style={{
        background: 'var(--color-map-land)',
        cursor: pinMode ? (isDraggingMap ? 'grabbing' : 'grab') : 'default',
        touchAction: pinMode ? 'none' : 'auto',
      }}
    >
      {/* Clean SVG Map Canvas */}
      <svg
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid slice"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          transform: cameraTransform,
          transition: isDraggingMap ? 'none' : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Water / Bay & River */}
        <path d="M 0 0 L 1000 0 L 1000 85 Q 720 120 500 72 Q 250 115 0 92 Z" fill="var(--color-map-water)" />
        <path d="M 520 85 Q 505 260 535 420 Q 550 560 515 700" fill="none" stroke="var(--color-map-water)" strokeWidth="16" />

        {/* Green Parks & Campuses */}
        <rect x="425" y="255" width="70" height="58" rx="14" fill="var(--color-map-park)" />
        <rect x="190" y="485" width="95" height="80" rx="18" fill="var(--color-map-park)" />
        <rect x="760" y="300" width="110" height="90" rx="16" fill="var(--color-map-park)" />

        {/* Minor Grid Streets */}
        <g stroke="var(--color-map-road-minor)" strokeWidth="5" fill="none">
          <path d="M 80 180 H 920" />
          <path d="M 80 280 H 920" />
          <path d="M 80 380 H 920" />
          <path d="M 80 480 H 920" />
          <path d="M 220 110 V 640" />
          <path d="M 360 110 V 640" />
          <path d="M 640 110 V 640" />
          <path d="M 780 110 V 640" />
        </g>

        {/* Arterial Roads & Ring Highway */}
        <path
          d="M 90 175 L 340 245 L 560 215 L 860 250"
          fill="none"
          stroke="var(--color-map-highway)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 140 530 Q 380 440 500 370 T 850 345"
          fill="none"
          stroke="var(--color-map-road)"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M 455 120 L 460 360 L 415 580"
          fill="none"
          stroke="var(--color-map-road)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 240 165 L 415 415 L 610 560"
          fill="none"
          stroke="var(--color-map-road)"
          strokeWidth="9"
          strokeLinecap="round"
        />

        {/* Subtle District Labels */}
        {CORPORATE_HUBS.map((hub) => (
          <g key={hub.name} transform={`translate(${hub.x}, ${hub.y})`}>
            <circle r="4" fill="var(--color-border)" />
            <text
              y="-10"
              textAnchor="middle"
              fill="var(--color-map-label)"
              fontSize="12"
              fontWeight="600"
              fontFamily="var(--font-sans)"
            >
              {hub.name.split(' ')[0]} {hub.name.split(' ')[1] || ''}
            </text>
          </g>
        ))}

        {/* Route Polyline (4px dark line + white outline) */}
        {showRoute && destPt && (
          <>
            <path
              d={routePathD}
              fill="none"
              stroke="var(--color-route-outline)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d={routePathD}
              fill="none"
              stroke="var(--color-route-line)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Pickup Marker (Green Dot) */}
        {!pinMode && (
          <g transform={`translate(${pickupPt.x}, ${pickupPt.y})`}>
            <circle r="14" fill="var(--color-green)" fillOpacity="0.2" />
            <circle r="8" fill="var(--color-green)" stroke="#ffffff" strokeWidth="3" />
          </g>
        )}

        {/* Destination Marker (Red Square) */}
        {!pinMode && showRoute && destPt && (
          <g transform={`translate(${destPt.x}, ${destPt.y})`}>
            <rect x="-11" y="-11" width="22" height="22" rx="6" fill="#ffffff" />
            <rect x="-7" y="-7" width="14" height="14" rx="3" fill="var(--color-status-red)" />
          </g>
        )}

        {/* Assigned Vehicle Marker */}
        {driverPt && (
          <g transform={`translate(${driverPt.x}, ${driverPt.y})`}>
            <circle r="18" fill="var(--color-bg-surface)" stroke="var(--color-green)" strokeWidth="3" />
            <path d="M0 -8 L7 7 L0 3 L-7 7 Z" fill="var(--color-green)" />
          </g>
        )}
      </svg>

      {/* Waiting Radar Rings centered on Pickup Screen Space */}
      {waitingRadar && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '36%',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <div className="gf-radar-ring" />
          <div className="gf-radar-ring" />
          <div className="gf-radar-ring" />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: 'translate(-50%, -50%)',
              width: '18px',
              height: '18px',
              borderRadius: '9999px',
              background: 'var(--color-green)',
              border: '3px solid #ffffff',
              boxShadow: 'var(--shadow-floating)',
            }}
          />
        </div>
      )}

      {/* Fixed Center Pin in "Pin on map" Mode */}
      {pinMode && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '40%',
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              background: 'var(--color-bg-surface)',
              color: 'var(--color-text-primary)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              boxShadow: 'var(--shadow-floating)',
              fontSize: 'var(--text-caption-size)',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              maxWidth: '240px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isDraggingMap ? 'Release to drop pin...' : pinnedLabel}
          </div>
          <div
            style={{
              transform: isDraggingMap ? 'translateY(-12px) scale(1.08)' : 'translateY(0)',
              transition: 'transform 160ms var(--ease-spring)',
              width: '40px',
              height: '40px',
              borderRadius: '9999px',
              background: 'var(--color-green)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-floating)',
              outline: '3px solid #ffffff',
            }}
          >
            <Crosshair size={20} />
          </div>
          <div
            style={{
              width: isDraggingMap ? '14px' : '8px',
              height: '4px',
              borderRadius: '9999px',
              background: 'rgba(17, 24, 39, 0.35)',
              transition: 'width 160ms var(--ease-spring)',
            }}
          />
        </div>
      )}

      {/* Distance & Duration Chip when Route is Drawn */}
      {showRoute && destPt && !pinMode && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(var(--space-4) + var(--safe-top))',
            right: 'var(--space-4)',
            zIndex: 'var(--z-map-overlay)',
            background: 'var(--color-bg-surface)',
            color: 'var(--color-text-primary)',
            padding: '8px 14px',
            borderRadius: 'var(--radius-pill)',
            boxShadow: 'var(--shadow-floating)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: 'var(--text-caption-size)',
            fontWeight: 700,
          }}
        >
          <Navigation2 size={14} style={{ color: 'var(--color-green)' }} />
          <span>
            {metrics.distanceKm} km • ~{metrics.durationMin} min
          </span>
        </div>
      )}

      {/* Driver Assigned Pill */}
      {driverActive && driverName && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(var(--space-4) + var(--safe-top))',
            right: 'var(--space-4)',
            zIndex: 'var(--z-map-overlay)',
            background: 'var(--color-bg-surface)',
            color: 'var(--color-text-primary)',
            padding: '8px 14px',
            borderRadius: 'var(--radius-pill)',
            boxShadow: 'var(--shadow-floating)',
            fontSize: 'var(--text-caption-size)',
            fontWeight: 700,
          }}
        >
          Driver en route • {driverName}
        </div>
      )}

      {/* Top-Left Circular White Back Button (44px, Floating Shadow) */}
      {showBackButton && onBack && (
        <button
          id="map-back-btn"
          type="button"
          className="gf-map-back-btn pressable"
          onClick={onBack}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
      )}

      {/* Connection Required Banner Pill (WEB-03) */}
      {isOffline && (
        <div className="gf-map-offline-pill" role="alert">
          <WifiOff size={14} />
          Connection required (WEB-03)
        </div>
      )}
    </div>
  );
};
