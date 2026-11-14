import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Crosshair, LocateFixed, Navigation2, Users, WifiOff } from 'lucide-react';
import { apiRequest } from '../api';

export interface GeoPlace {
  name: string;
  address: string;
  lat: number;
  lon: number;
}

export interface UserLocationPin {
  user_id: number;
  nickname: string;
  group_username: string;
  role: string;
  group_name?: string;
  latitude: number;
  longitude: number;
  accuracy_meters?: number | null;
  address_label?: string | null;
  updated_at: string;
}

const DEFAULT_CENTER: [number, number] = [-6.19834, 106.88873];
const MAPTILER_API_KEY = (import.meta as any).env?.VITE_MAPTILER_API_KEY || 'KHmsrWcJhgdZjirijNbw';
const MAPTILER_OUTDOOR_V4_TILE_URL = `https://api.maptiler.com/maps/outdoor-v4/256/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function estimateRouteMetrics(
  origin?: string,
  destination?: string,
  originCoords?: { lat: number; lon: number } | null,
  destCoords?: { lat: number; lon: number } | null
): { distanceKm: number; durationMin: number } {
  if (!destination || !destination.trim()) {
    return { distanceKm: 0, durationMin: 0 };
  }
  if (originCoords && destCoords) {
    const straightKm = haversineKm(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon);
    const roadKm = Math.max(0.8, Number((straightKm * 1.28).toFixed(1)));
    const durationMin = Math.max(4, Math.round(roadKm * 2.4 + 4));
    return { distanceKm: roadKm, durationMin };
  }
  const str = `${origin || ''}->${destination}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) % 1000;
  }
  const distanceKm = Number((2.5 + (h % 180) / 10).toFixed(1));
  const durationMin = Math.max(6, Math.round(distanceKm * 2.3 + 5));
  return { distanceKm, durationMin };
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface MapViewProps {
  origin: string;
  destination: string;
  originCoords?: { lat: number; lon: number } | null;
  destCoords?: { lat: number; lon: number } | null;
  myCoords?: { lat: number; lon: number; accuracy?: number } | null;
  userPins?: UserLocationPin[];
  currentUserId?: number;
  onLocateMe?: () => void;
  locatingUser?: boolean;
  showRoute: boolean;
  pinMode: boolean;
  onPinMoveAddress?: (place: GeoPlace) => void;
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
  originCoords,
  destCoords,
  myCoords,
  userPins = [],
  currentUserId,
  onLocateMe,
  locatingUser = false,
  showRoute,
  pinMode,
  onPinMoveAddress,
  waitingRadar = false,
  driverActive = false,
  driverName,
  showBackButton = false,
  onBack,
  isOffline = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const pinsLayerRef = useRef<L.LayerGroup | null>(null);
  const hasCenteredOnMyCoordsRef = useRef<boolean>(false);
  const onPinMoveRef = useRef(onPinMoveAddress);
  onPinMoveRef.current = onPinMoveAddress;

  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const [pinnedLabel, setPinnedLabel] = useState<string>('Move map to position pin');
  const reverseTimerRef = useRef<number | null>(null);

  const effOrigin = useMemo<[number, number]>(() => {
    if (originCoords && Number.isFinite(originCoords.lat) && Number.isFinite(originCoords.lon)) {
      return [originCoords.lat, originCoords.lon];
    }
    if (myCoords && Number.isFinite(myCoords.lat) && Number.isFinite(myCoords.lon)) {
      return [myCoords.lat, myCoords.lon];
    }
    return DEFAULT_CENTER;
  }, [originCoords, myCoords]);

  const effDest = useMemo<[number, number] | null>(() => {
    if (destCoords && Number.isFinite(destCoords.lat) && Number.isFinite(destCoords.lon)) {
      return [destCoords.lat, destCoords.lon];
    }
    if (destination && destination.trim()) {
      return [effOrigin[0] - 0.018, effOrigin[1] + 0.022];
    }
    return null;
  }, [destCoords, destination, effOrigin]);

  const metrics = useMemo(
    () =>
      estimateRouteMetrics(
        origin,
        destination,
        { lat: effOrigin[0], lon: effOrigin[1] },
        effDest ? { lat: effDest[0], lon: effDest[1] } : null
      ),
    [origin, destination, effOrigin, effDest]
  );

  // Initialize Leaflet Map with MapTiler outdoor-v4 tiles
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: effOrigin,
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer(MAPTILER_OUTDOOR_V4_TILE_URL, {
      maxZoom: 20,
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    const pinsLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    pinsLayerRef.current = pinsLayer;
    routeLayerRef.current = routeLayer;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      pinsLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  // Automatically fly to the user's detected GPS location the first time it arrives
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !myCoords || hasCenteredOnMyCoordsRef.current) return;
    hasCenteredOnMyCoordsRef.current = true;
    map.setView([myCoords.lat, myCoords.lon], 15, { animate: true });
  }, [myCoords]);

  // Handle Pin-on-Map Drag & Reverse Geocoding via MapTiler / Nominatim
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMoveStart = () => {
      if (pinMode) setIsDraggingMap(true);
    };

    const handleMoveEnd = () => {
      if (!pinMode) return;
      setIsDraggingMap(false);
      const center = map.getCenter();
      if (reverseTimerRef.current) {
        window.clearTimeout(reverseTimerRef.current);
      }
      reverseTimerRef.current = window.setTimeout(async () => {
        try {
          const res = await apiRequest(`/api/geocode/reverse?lat=${center.lat}&lon=${center.lng}`);
          const label = res.name || `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
          setPinnedLabel(label);
          if (onPinMoveRef.current) {
            onPinMoveRef.current({
              name: label,
              address: res.address || label,
              lat: center.lat,
              lon: center.lng,
            });
          }
        } catch {
          const fallback = `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
          setPinnedLabel(fallback);
          if (onPinMoveRef.current) {
            onPinMoveRef.current({
              name: fallback,
              address: `Pinned coordinates (${fallback})`,
              lat: center.lat,
              lon: center.lng,
            });
          }
        }
      }, 280);
    };

    map.on('movestart', handleMoveStart);
    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('movestart', handleMoveStart);
      map.off('moveend', handleMoveEnd);
    };
  }, [pinMode]);

  // Render All Users' Pinpoint Dots on the Map
  useEffect(() => {
    const pinsLayer = pinsLayerRef.current;
    if (!pinsLayer) return;

    pinsLayer.clearLayers();

    // Render all reported user locations
    const renderedIds = new Set<number>();
    for (const pin of userPins) {
      if (!Number.isFinite(pin.latitude) || !Number.isFinite(pin.longitude)) continue;
      renderedIds.add(pin.user_id);

      const isMe = currentUserId !== undefined && pin.user_id === currentUserId;
      const isDriver = pin.role === 'DRV';
      const dotColor = isMe ? '#00AA13' : isDriver ? '#00AA13' : '#111827';
      const ringColor = isMe ? 'rgba(0, 170, 19, 0.25)' : isDriver ? 'rgba(0, 170, 19, 0.18)' : 'rgba(17, 24, 39, 0.15)';
      const badgeLabel = isMe ? `You (${escapeHtml(pin.nickname)})` : `${escapeHtml(pin.nickname)} • ${escapeHtml(pin.role)}`;

      if (isMe && pin.accuracy_meters) {
        L.circle([pin.latitude, pin.longitude], {
          radius: Math.min(250, Math.max(25, Number(pin.accuracy_meters))),
          color: '#00AA13',
          weight: 1,
          fillColor: '#00AA13',
          fillOpacity: 0.1,
        }).addTo(pinsLayer);
      }

      const userDotIcon = L.divIcon({
        className: 'gf-leaflet-marker',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
            <div style="background:#ffffff;color:#111827;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.18);margin-bottom:4px;border:1.5px solid ${dotColor};">
              ${badgeLabel}
            </div>
            <div style="width:16px;height:16px;border-radius:9999px;background:${dotColor};outline:3px solid #ffffff;box-shadow:0 0 0 5px ${ringColor}, 0 2px 6px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([pin.latitude, pin.longitude], { icon: userDotIcon }).addTo(pinsLayer);
      marker.bindPopup(
        `<div style="font-family:inherit;font-size:12px;line-height:1.4;">
          <div style="font-weight:800;font-size:13px;">${escapeHtml(pin.nickname)} (@${escapeHtml(pin.group_username)})</div>
          <div style="color:#4B5563;">${escapeHtml(pin.group_name || 'Company Group')} • Role: <strong>${escapeHtml(pin.role)}</strong></div>
          ${pin.address_label ? `<div style="margin-top:4px;font-weight:600;">${escapeHtml(pin.address_label)}</div>` : ''}
          <div style="margin-top:2px;font-family:monospace;font-size:11px;color:#6B7280;">${Number(pin.latitude).toFixed(5)}, ${Number(pin.longitude).toFixed(5)}</div>
        </div>`
      );
    }

    // If current user's browser coordinates are known before the first server refresh finishes, render their dot immediately
    if (myCoords && (!currentUserId || !renderedIds.has(currentUserId))) {
      L.circle([myCoords.lat, myCoords.lon], {
        radius: Math.min(250, Math.max(25, Number(myCoords.accuracy || 40))),
        color: '#00AA13',
        weight: 1,
        fillColor: '#00AA13',
        fillOpacity: 0.1,
      }).addTo(pinsLayer);

      const meIcon = L.divIcon({
        className: 'gf-leaflet-marker',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
            <div style="background:#00AA13;color:#ffffff;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2);margin-bottom:4px;">
              You
            </div>
            <div style="width:16px;height:16px;border-radius:9999px;background:#00AA13;outline:3px solid #ffffff;box-shadow:0 0 0 6px rgba(0,170,19,0.25), 0 2px 6px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker([myCoords.lat, myCoords.lon], { icon: meIcon }).addTo(pinsLayer);
    }
  }, [userPins, currentUserId, myCoords]);

  // Render Route Pickup, Destination & Polyline whenever route coordinates or mode change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = routeLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (showRoute || Boolean(origin && origin.trim())) {
      const pickupIcon = L.divIcon({
        className: 'gf-leaflet-marker',
        html: `<div style="width:18px;height:18px;border-radius:9999px;background:#00AA13;outline:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.25);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker(effOrigin, { icon: pickupIcon }).addTo(group);
    }

    if (showRoute && effDest && !pinMode) {
      const destIcon = L.divIcon({
        className: 'gf-leaflet-marker',
        html: `<div style="width:18px;height:18px;border-radius:4px;background:#DC2626;outline:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.25);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker(effDest, { icon: destIcon }).addTo(group);

      const midLat = (effOrigin[0] + effDest[0]) / 2 + (effDest[1] - effOrigin[1]) * 0.12;
      const midLon = (effOrigin[1] + effDest[1]) / 2 - (effDest[0] - effOrigin[0]) * 0.12;
      const latlngs: L.LatLngExpression[] = [effOrigin, [midLat, midLon], effDest];

      L.polyline(latlngs, {
        color: '#ffffff',
        weight: 8,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);

      L.polyline(latlngs, {
        color: '#111827',
        weight: 4,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);

      if (driverActive) {
        const drvIcon = L.divIcon({
          className: 'gf-leaflet-marker',
          html: `<div style="width:26px;height:26px;border-radius:9999px;background:#111827;color:#ffffff;outline:3px solid #00AA13;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;">GF</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        L.marker([midLat, midLon], { icon: drvIcon }).addTo(group);
      }

      const bounds = L.latLngBounds([effOrigin, effDest]);
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16 });
    }
  }, [effOrigin, effDest, showRoute, pinMode, driverActive, origin]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!pinMode || !mapInstanceRef.current) return;
    const step = 60;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      mapInstanceRef.current.panBy([0, -step]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      mapInstanceRef.current.panBy([0, step]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      mapInstanceRef.current.panBy([-step, 0]);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      mapInstanceRef.current.panBy([step, 0]);
    }
  };

  return (
    <div
      className="gf-map-stage"
      tabIndex={pinMode ? 0 : -1}
      role={pinMode ? 'application' : undefined}
      aria-label={pinMode ? 'Interactive MapTiler map. Drag or use arrow keys to position the pin.' : 'MapTiler route and user location view'}
      onKeyDown={handleKeyDown}
    >
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

      {/* Active User Pinpoints Count Badge + Locate Me GPS Button */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(var(--space-4) + var(--safe-top))',
          right: 'var(--space-4)',
          zIndex: 455,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
        }}
      >
        {showRoute && effDest && !pinMode && (
          <div
            style={{
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

        {driverActive && driverName && (
          <div
            style={{
              background: 'var(--color-bg-surface)',
              color: 'var(--color-text-primary)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-pill)',
              boxShadow: 'var(--shadow-floating)',
              fontSize: 'var(--text-caption-size)',
              fontWeight: 700,
            }}
          >
            Driver assigned • {driverName}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {userPins.length > 0 && (
            <div
              style={{
                background: 'var(--color-bg-surface)',
                color: 'var(--color-text-primary)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                boxShadow: 'var(--shadow-floating)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: 'var(--text-caption-size)',
                fontWeight: 700,
              }}
              title="Active users sharing their live pinpoint on the map"
            >
              <span className="gf-dot-green" />
              <Users size={13} />
              <span>{userPins.length} live on map</span>
            </div>
          )}

          {onLocateMe && (
            <button
              id="map-locate-me-btn"
              type="button"
              className="gf-icon-btn-48 pressable"
              style={{
                width: '44px',
                height: '44px',
                minWidth: '44px',
                minHeight: '44px',
                background: 'var(--color-bg-surface)',
                color: myCoords ? 'var(--color-green)' : 'var(--color-text-primary)',
                boxShadow: 'var(--shadow-floating)',
                border: 'none',
              }}
              onClick={() => {
                onLocateMe();
                if (myCoords && mapInstanceRef.current) {
                  mapInstanceRef.current.setView([myCoords.lat, myCoords.lon], 16, { animate: true });
                }
              }}
              aria-label="Detect and center on my GPS location"
              title={locatingUser ? 'Detecting GPS location...' : 'Detect & center on my location'}
            >
              <LocateFixed size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Pulsing Green Radar Rings when Waiting for Approval (3 rings, 2s loop) */}
      {waitingRadar && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '38%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 400,
          }}
        >
          <span className="gf-radar-ring" />
          <span className="gf-radar-ring gf-radar-ring-2" />
          <span className="gf-radar-ring gf-radar-ring-3" />
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '9999px',
              background: 'var(--color-green)',
              outline: '3px solid #ffffff',
              transform: 'translate(-50%, -50%)',
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
            top: '42%',
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            zIndex: 450,
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
              maxWidth: '260px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isDraggingMap ? 'Release to set pin...' : pinnedLabel}
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

      {/* Top-Left Circular White Back Button (44px, Floating Shadow) */}
      {showBackButton && onBack && (
        <button
          id="map-back-btn"
          type="button"
          className="gf-map-back-btn pressable"
          style={{ zIndex: 460 }}
          onClick={onBack}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
      )}

      {/* Connection Required Banner Pill (WEB-03) */}
      {isOffline && (
        <div className="gf-map-offline-pill" style={{ zIndex: 460 }} role="alert">
          <WifiOff size={14} />
          Connection required (WEB-03)
        </div>
      )}
    </div>
  );
};
