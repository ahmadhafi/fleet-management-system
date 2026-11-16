import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Crosshair, LocateFixed, Navigation2, Users, WifiOff, Layers, Map as MapIcon, Mountain } from 'lucide-react';
import { apiRequest } from '../api';
import { resolveCarAvatarKey, getCarFrontAvatarSvg, getDriverAvatarDataUri } from './CarAvatarArt';

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

export interface FleetVehiclePosition {
  id: number;
  registration_plate: string;
  plate_number?: string;
  make: string;
  model: string;
  model_name?: string;
  car_type: string;
  energy_type: string;
  status: string;
  battery_percent?: number | null;
  current_odometer?: number;
  latitude: number;
  longitude: number;
  lat?: number;
  lng?: number;
  location_label?: string;
  is_following_driver?: boolean;
  following_driver_name?: string | null;
  driver_name?: string;
  driver_phone?: string;
  driver_photo_url?: string | null;
  driver_licence_number?: string;
  driver_licence_expiry?: string;
  active_trip?: {
    id: number;
    purpose: string;
    origin?: string;
    destination: string;
    start_time: string;
    actual_start_time?: string;
    start_odometer?: number;
    start_odometer_photo_url?: string;
    start_odometer_time?: string;
    passenger_nickname?: string;
    passengers_json?: string;
    passenger_count?: number;
    requester_nickname?: string;
    requester_username?: string;
    requester_department?: string;
    ride_duration_formatted?: string;
  } | null;
}

const DEFAULT_CENTER: [number, number] = [-6.19834, 106.88873];

export type MapLayerKey = 'streets' | 'satellite' | 'terrain';

export const OSM_FALLBACK_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const SATELLITE_FALLBACK_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const TERRAIN_FALLBACK_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const MAP_LAYERS: Record<MapLayerKey, { name: string; url: string; options: L.TileLayerOptions }> = {
  streets: {
    name: 'Streets',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    options: {
      maxZoom: 20,
      subdomains: ['a', 'b', 'c', 'd'],
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 4,
      crossOrigin: true,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
    },
  },
  satellite: {
    name: 'Satellite',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    options: {
      maxZoom: 21,
      subdomains: ['0', '1', '2', '3'],
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 4,
      crossOrigin: true,
      attribution: 'Map &copy; Google Maps &mdash; Satellite Hybrid',
    },
  },
  terrain: {
    name: 'Terrain',
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    options: {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 4,
      crossOrigin: true,
      attribution: 'Map &copy; Google Maps &mdash; Topographic Terrain',
    },
  },
};

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

export function formatWhatsAppUrl(rawPhone: string): string {
  let clean = (rawPhone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (!clean.startsWith('62')) {
    clean = '62' + clean;
  }
  return `https://wa.me/+${clean}`;
}

export function formatPhoneCallUrl(rawPhone: string): string {
  let clean = (rawPhone || '').replace(/[^\d+]/g, '');
  if (clean.startsWith('0')) {
    clean = '+62' + clean.slice(1);
  } else if (!clean.startsWith('+')) {
    clean = '+62' + clean;
  }
  return `tel:${clean}`;
}

export interface RouteCalculationResult {
  distanceKm: number;
  durationMin: number;
  etaIso?: string;
  etaText?: string;
  geometry?: Array<[number, number]>;
}

interface MapViewProps {
  origin: string;
  destination: string;
  originCoords?: { lat: number; lon: number } | null;
  destCoords?: { lat: number; lon: number } | null;
  routeGeometry?: Array<[number, number]> | null;
  routeMetrics?: RouteCalculationResult | null;
  myCoords?: { lat: number; lon: number; accuracy?: number } | null;
  userPins?: UserLocationPin[];
  fleetPositions?: FleetVehiclePosition[];
  currentUserId?: number;
  onLocateMe?: () => void;
  locatingUser?: boolean;
  showRoute: boolean;
  pinMode: boolean;
  onPinMoveAddress?: (place: GeoPlace) => void;
  waitingRadar?: boolean;
  driverActive?: boolean;
  driverName?: string;
  driverCoords?: { lat: number; lon: number } | null;
  activeVehicleModel?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  isOffline?: boolean;
  focusedVehicleId?: number | null;
  onSelectVehicle?: (vehicle: FleetVehiclePosition) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  origin,
  destination,
  originCoords,
  destCoords,
  routeGeometry,
  routeMetrics,
  myCoords,
  userPins = [],
  fleetPositions,
  currentUserId,
  onLocateMe,
  locatingUser = false,
  showRoute,
  pinMode,
  onPinMoveAddress,
  waitingRadar = false,
  driverActive = false,
  driverName,
  driverCoords,
  activeVehicleModel,
  showBackButton = false,
  onBack,
  isOffline = false,
  focusedVehicleId,
  onSelectVehicle,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const pinsLayerRef = useRef<L.LayerGroup | null>(null);
  const fleetLayerRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<number, L.Marker>>(new Map());
  const hasCenteredOnMyCoordsRef = useRef<boolean>(false);
  const hasFittedFleetRef = useRef<boolean>(false);
  const routeActiveRef = useRef<boolean>(false);
  routeActiveRef.current = Boolean(routeGeometry && routeGeometry.length > 0);
  const onPinMoveRef = useRef(onPinMoveAddress);
  onPinMoveRef.current = onPinMoveAddress;
  const onSelectVehicleRef = useRef(onSelectVehicle);
  onSelectVehicleRef.current = onSelectVehicle;

  const [activeLayer, setActiveLayer] = useState<MapLayerKey>('streets');
  const [tilesLoading, setTilesLoading] = useState<boolean>(true);
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const [pinnedLabel, setPinnedLabel] = useState<string>('Move map to position pin');
  const reverseTimerRef = useRef<number | null>(null);
  const tileLoadSafetyTimerRef = useRef<number | null>(null);

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

  const metrics = useMemo(() => {
    if (routeMetrics && routeMetrics.distanceKm > 0 && routeMetrics.durationMin > 0) {
      const etaDate = routeMetrics.etaIso ? new Date(routeMetrics.etaIso) : new Date(Date.now() + routeMetrics.durationMin * 60_000);
      const etaText =
        routeMetrics.etaText ||
        etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        distanceKm: routeMetrics.distanceKm,
        durationMin: routeMetrics.durationMin,
        etaText,
      };
    }
    const est = estimateRouteMetrics(
      origin,
      destination,
      { lat: effOrigin[0], lon: effOrigin[1] },
      effDest ? { lat: effDest[0], lon: effDest[1] } : null
    );
    const etaDate = new Date(Date.now() + est.durationMin * 60_000);
    return {
      ...est,
      etaText: est.durationMin > 0 ? etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    };
  }, [routeMetrics, origin, destination, effOrigin, effDest]);

  const attachManagedTileLayer = (layerKey: MapLayerKey, map: L.Map): L.TileLayer => {
    const config = MAP_LAYERS[layerKey];
    let tileErrorCount = 0;
    let didFailover = false;

    const resetSafetyTimer = () => {
      if (tileLoadSafetyTimerRef.current) {
        window.clearTimeout(tileLoadSafetyTimerRef.current);
      }
      tileLoadSafetyTimerRef.current = window.setTimeout(() => {
        setTilesLoading(false);
      }, 2500);
    };

    setTilesLoading(true);
    resetSafetyTimer();

    const layer = L.tileLayer(config.url, config.options);
    layer.on('loading', () => {
      setTilesLoading(true);
      resetSafetyTimer();
    });
    layer.on('load', () => {
      if (tileLoadSafetyTimerRef.current) {
        window.clearTimeout(tileLoadSafetyTimerRef.current);
      }
      setTilesLoading(false);
    });
    layer.on('tileerror', () => {
      tileErrorCount += 1;
      if (!didFailover && tileErrorCount >= 3 && baseTileLayerRef.current === layer) {
        didFailover = true;
        map.removeLayer(layer);

        let fallbackUrl = OSM_FALLBACK_TILE_URL;
        let fallbackOptions: L.TileLayerOptions = {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
          updateWhenZooming: false,
          updateWhenIdle: true,
          keepBuffer: 4,
          crossOrigin: true,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        };

        if (layerKey === 'satellite') {
          fallbackUrl = SATELLITE_FALLBACK_TILE_URL;
          fallbackOptions = {
            maxZoom: 19,
            updateWhenZooming: false,
            updateWhenIdle: true,
            keepBuffer: 4,
            crossOrigin: true,
            attribution: 'Tiles &copy; Esri &mdash; World Imagery',
          };
        } else if (layerKey === 'terrain') {
          fallbackUrl = TERRAIN_FALLBACK_TILE_URL;
          fallbackOptions = {
            maxZoom: 19,
            subdomains: ['a', 'b', 'c'],
            updateWhenZooming: false,
            updateWhenIdle: true,
            keepBuffer: 4,
            crossOrigin: true,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
          };
        }

        const fallbackLayer = L.tileLayer(fallbackUrl, fallbackOptions);
        fallbackLayer.on('load', () => {
          if (tileLoadSafetyTimerRef.current) {
            window.clearTimeout(tileLoadSafetyTimerRef.current);
          }
          setTilesLoading(false);
        });
        fallbackLayer.addTo(map);
        fallbackLayer.bringToBack();
        baseTileLayerRef.current = fallbackLayer;
      }
    });

    layer.addTo(map);
    layer.bringToBack();
    return layer;
  };

  // Initialize Leaflet Map with Canvas renderer, ResizeObserver & automatic tile failover
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: effOrigin,
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });

    baseTileLayerRef.current = attachManagedTileLayer(activeLayer, map);

    const pinsLayer = L.layerGroup().addTo(map);
    const fleetLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    pinsLayerRef.current = pinsLayer;
    fleetLayerRef.current = fleetLayer;
    routeLayerRef.current = routeLayer;

    const initInvalidateTimer = window.setTimeout(() => {
      map.invalidateSize({ pan: false });
    }, 120);

    let rafId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (rafId) window.cancelAnimationFrame(rafId);
        rafId = window.requestAnimationFrame(() => {
          map.invalidateSize({ pan: false });
        });
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      window.clearTimeout(initInvalidateTimer);
      if (rafId) window.cancelAnimationFrame(rafId);
      if (tileLoadSafetyTimerRef.current) {
        window.clearTimeout(tileLoadSafetyTimerRef.current);
      }
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      baseTileLayerRef.current = null;
      pinsLayerRef.current = null;
      fleetLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  // Handle active tile layer swapping (Streets, Satellite, Terrain)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
    }
    baseTileLayerRef.current = attachManagedTileLayer(activeLayer, map);
  }, [activeLayer]);

  // Automatically fly to the user's detected GPS location the first time it arrives
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !myCoords || hasCenteredOnMyCoordsRef.current) return;
    hasCenteredOnMyCoordsRef.current = true;
    map.setView([myCoords.lat, myCoords.lon], 15, { animate: true });
  }, [myCoords]);

  // Handle Pin-on-Map Drag & Reverse Geocoding
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

    const renderedIds = new Set<number>();
    for (const pin of userPins) {
      if (!Number.isFinite(pin.latitude) || !Number.isFinite(pin.longitude)) continue;
      renderedIds.add(pin.user_id);

      const isMe = currentUserId !== undefined && pin.user_id === currentUserId;
      const isDriver = pin.role === 'DRV';
      const dotColor = isMe ? '#0072de' : isDriver ? '#258cfb' : '#334155';
      const ringColor = isMe ? 'rgba(0, 114, 222, 0.25)' : isDriver ? 'rgba(37, 140, 251, 0.22)' : 'rgba(51, 65, 85, 0.15)';
      const badgeLabel = isMe ? `You (${escapeHtml(pin.nickname)})` : `${escapeHtml(pin.nickname)} • ${escapeHtml(pin.role)}`;

      if (isMe && pin.accuracy_meters) {
        L.circle([pin.latitude, pin.longitude], {
          radius: Math.min(250, Math.max(25, Number(pin.accuracy_meters))),
          color: '#0072de',
          weight: 1.5,
          fillColor: '#0072de',
          fillOpacity: 0.12,
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

      let driverEtaSection = '';
      if (isDriver) {
        const poolLat = -6.19834;
        const poolLon = 106.88873;
        const etaPool = estimateRouteMetrics('Driver Position', 'HQ Pool', { lat: pin.latitude, lon: pin.longitude }, { lat: poolLat, lon: poolLon });

        const pickupTarget = originCoords || myCoords;
        let etaPickupHtml = '';
        if (pickupTarget) {
          const etaPickup = estimateRouteMetrics('Driver Position', 'Pickup Location', { lat: pin.latitude, lon: pin.longitude }, pickupTarget);
          etaPickupHtml = `
            <div style="background:#e0edff;color:#005bb5;border-radius:10px;padding:6px 10px;margin-top:6px;display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid #bfdbfe;">
              <span style="font-weight:700;font-size:12px;">ETA to Pickup:</span>
              <span style="font-weight:800;font-size:12.5px;">~${etaPickup.durationMin} min (${etaPickup.distanceKm} km)</span>
            </div>
          `;
        }

        const etaPoolHtml = `
          <div style="background:#f1f5f9;color:#334155;border-radius:10px;padding:6px 10px;margin-top:4px;display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid #e2e8f0;">
            <span style="font-weight:700;font-size:11.5px;">Arrival at HQ Pool:</span>
            <span style="font-weight:800;font-size:12px;">~${etaPool.durationMin} min (${etaPool.distanceKm} km)</span>
          </div>
        `;

        driverEtaSection = `
          <div style="margin-top:6px;border-top:1px solid #e2e8f0;padding-top:6px;">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Live Driver Estimates</div>
            ${etaPickupHtml}
            ${etaPoolHtml}
          </div>
        `;
      }

      marker.bindPopup(
        `<div style="font-family:inherit;font-size:12.5px;line-height:1.45;min-width:210px;padding:2px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;">
            <div style="font-weight:800;font-size:14px;color:#0f172a;">${escapeHtml(pin.nickname)}</div>
            <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:9999px;background:${isDriver ? '#e0edff' : '#f1f5f9'};color:${isDriver ? '#005bb5' : '#475569'};">${escapeHtml(pin.role)}</span>
          </div>
          <div style="color:#475569;font-size:12px;">
            <span class="notranslate" translate="no">${escapeHtml(pin.group_name || 'Fleet Group')}</span> • @${escapeHtml(pin.group_username)}
          </div>
          ${driverEtaSection}
          ${pin.address_label ? `<div style="margin-top:6px;font-size:11.5px;color:#334155;border-top:1px solid #e2e8f0;padding-top:4px;">📍 ${escapeHtml(pin.address_label)}</div>` : ''}
          <div style="margin-top:4px;font-family:monospace;font-size:11px;color:#94a3b8;">${Number(pin.latitude).toFixed(5)}, ${Number(pin.longitude).toFixed(5)}</div>
        </div>`
      );
    }

    if (myCoords && (!currentUserId || !renderedIds.has(currentUserId))) {
      L.circle([myCoords.lat, myCoords.lon], {
        radius: Math.min(250, Math.max(25, Number(myCoords.accuracy || 40))),
        color: '#0072de',
        weight: 1.5,
        fillColor: '#0072de',
        fillOpacity: 0.12,
      }).addTo(pinsLayer);

      const meIcon = L.divIcon({
        className: 'gf-leaflet-marker',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
            <div style="background:#0072de;color:#ffffff;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,114,222,0.3);margin-bottom:4px;">
              You
            </div>
            <div style="width:16px;height:16px;border-radius:9999px;background:#0072de;outline:3px solid #ffffff;box-shadow:0 0 0 6px rgba(0,114,222,0.25), 0 2px 6px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker([myCoords.lat, myCoords.lon], { icon: meIcon }).addTo(pinsLayer);
    }
  }, [userPins, currentUserId, myCoords, originCoords]);

  // Render Operational Fleet Vehicles (Admin Fleet Live Map)
  useEffect(() => {
    const fleetLayer = fleetLayerRef.current;
    const map = mapInstanceRef.current;
    if (!fleetLayer) return;

    fleetLayer.clearLayers();
    markerMapRef.current.clear();

    if (!fleetPositions || fleetPositions.length === 0) return;

    const bounds = L.latLngBounds([]);

    for (const v of fleetPositions) {
      if (!Number.isFinite(v.latitude) || !Number.isFinite(v.longitude)) continue;
      bounds.extend([v.latitude, v.longitude]);

      const isEv = v.energy_type === 'Electric';
      const isInTrip = v.status === 'IN_TRIP';
      const mainColor = isEv ? '#0072de' : '#0a0a0a';

      const avatarKey = resolveCarAvatarKey(v.model, v.make, v.energy_type);
      const carFrontSvg = getCarFrontAvatarSvg(avatarKey, isInTrip);
      const driverPhoto = getDriverAvatarDataUri(v.driver_name || 'Driver', v.driver_photo_url);

      const isFollowing = Boolean(v.is_following_driver);
      const carIcon = L.divIcon({
        className: 'gf-leaflet-marker',
        html: `
          <div class="gf-fleet-marker-wrap ${isInTrip ? 'is-driving' : ''}" style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);cursor:pointer;">
            <div style="background:#ffffff;color:#0f172a;padding:2px 8px;border-radius:9999px;font-size:10.5px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.24);margin-bottom:2px;border:1.5px solid ${isFollowing ? '#0072de' : mainColor};display:flex;align-items:center;gap:4px;">
              <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${isInTrip || isFollowing ? '#258cfb' : '#0072de'};"></span>
              <span>${escapeHtml(v.registration_plate)}</span>
              <span style="color:#64748b;font-weight:600;font-size:10px;">• ${escapeHtml(v.driver_name?.split(' ')[0] || 'Driver')}</span>
              <span style="font-size:10px;">${isEv ? '⚡' : '⛽'}</span>
            </div>

            <!-- Model-Specific Car Front Avatar -->
            <div style="position:relative;width:58px;height:42px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.32));">
              ${carFrontSvg}
              ${isInTrip ? `
                <div style="position:absolute;top:-4px;right:-4px;background:#258cfb;color:#ffffff;border-radius:9999px;padding:1px 5px;font-size:8px;font-weight:900;letter-spacing:0.02em;box-shadow:0 2px 6px rgba(37,140,251,0.5);border:1px solid #ffffff;">
                  DRIVING
                </div>
              ` : isFollowing ? `
                <div style="position:absolute;top:-4px;right:-4px;background:#0072de;color:#ffffff;border-radius:9999px;padding:1px 5px;font-size:8px;font-weight:900;letter-spacing:0.02em;box-shadow:0 2px 6px rgba(0,114,222,0.5);border:1px solid #ffffff;">
                  GPS LIVE
                </div>
              ` : ''}
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([v.latitude, v.longitude], { icon: carIcon }).addTo(fleetLayer);
      markerMapRef.current.set(v.id, marker);

      marker.on('click', () => {
        if (onSelectVehicleRef.current) {
          onSelectVehicleRef.current(v);
        }
      });

      const contactButtons = v.driver_phone ? `
        <div style="display:flex;gap:8px;margin-top:8px;">
          <a href="${formatWhatsAppUrl(v.driver_phone)}" target="_blank" rel="noreferrer" style="flex:1;background:#0a0a0a;color:#ffffff;text-decoration:none;padding:6px 10px;border-radius:8px;font-size:11.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px;box-shadow:0 2px 5px rgba(10,10,10,0.25);">
            <span>Chat Driver</span>
          </a>
          <a href="${formatPhoneCallUrl(v.driver_phone)}" style="flex:1;background:#0072de;color:#ffffff;text-decoration:none;padding:6px 10px;border-radius:8px;font-size:11.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px;box-shadow:0 2px 5px rgba(0,114,222,0.3);">
            <span>Call Driver</span>
          </a>
        </div>
      ` : '';

      let paxHtml = `<span style="color:#005bb5;">${escapeHtml(v.active_trip?.passenger_nickname || 'Employee')}</span>`;
      if (v.active_trip?.passengers_json) {
        try {
          const parsed = JSON.parse(v.active_trip.passengers_json);
          if (Array.isArray(parsed) && parsed.length > 0) {
            paxHtml = `<div style="display:flex;flex-direction:column;gap:1px;margin-top:2px;">${parsed
              .map((p: any, idx: number) => `<span style="color:#005bb5;font-weight:700;font-size:11.5px;">• Pax ${idx + 1}: ${escapeHtml(p.nickname || 'Guest')}</span>`)
              .join('')}</div>`;
          }
        } catch {}
      }

      const tripInfo = v.active_trip ? `
        <div style="background:#e0edff;border:1px solid #bfdbfe;border-radius:10px;padding:9px 11px;margin-top:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:10.5px;font-weight:800;color:#005bb5;text-transform:uppercase;letter-spacing:0.04em;">
              👤 Person Using This Car
            </span>
            ${v.active_trip.ride_duration_formatted ? `
              <span style="font-size:10px;font-weight:700;background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:9999px;">
                ⏱️ ${escapeHtml(v.active_trip.ride_duration_formatted)}
              </span>
            ` : ''}
          </div>
          
          <div style="font-size:12px;font-weight:800;color:#0f172a;">
            Passengers: ${paxHtml}
          </div>

          <div style="font-size:11.5px;color:#334155;margin-top:2px;">
            Booked By: <b>${escapeHtml(v.active_trip.requester_nickname || 'Lead Requester')}</b>
            ${v.active_trip.requester_department ? `<span class="notranslate" translate="no" style="color:#64748b;"> • ${escapeHtml(v.active_trip.requester_department)}</span>` : ''}
          </div>

          <div style="font-size:11.5px;color:#1e293b;margin-top:4px;font-weight:600;">
            📍 ${escapeHtml(v.active_trip.origin || 'HQ Tower')} ➔ 🎯 ${escapeHtml(v.active_trip.destination)}
          </div>

          <div style="font-size:11px;color:#64748b;margin-top:2px;">
            Purpose: ${escapeHtml(v.active_trip.purpose)}
          </div>

          ${v.active_trip.start_odometer_photo_url ? `
            <div style="margin-top:6px;padding:4px 6px;background:#ffffff;border-radius:6px;border:1px solid #bfdbfe;display:flex;align-items:center;gap:6px;">
              <img src="${v.active_trip.start_odometer_photo_url}" alt="Start Odometer" style="width:26px;height:26px;border-radius:4px;object-fit:cover;border:1px solid #cbd5e1;flex-shrink:0;" />
              <div style="font-size:10.5px;color:#1e293b;">
                Verified Start Odometer: <b>${v.active_trip.start_odometer ?? '—'} km</b>
              </div>
            </div>
          ` : ''}
        </div>
      ` : `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin-top:8px;font-size:11.5px;color:#475569;">
          <div>🅿️ Current Pool: <b>${escapeHtml(v.location_label || 'Central Fleet Pool')}</b></div>
          <div style="font-size:10.5px;color:#94a3b8;margin-top:2px;">Ready for immediate reservation or scheduled dispatch.</div>
        </div>
      `;

      marker.bindPopup(`
        <div style="font-family:inherit;font-size:12.5px;line-height:1.45;min-width:270px;max-width:310px;padding:4px;">
          <!-- Vehicle Header -->
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;">
            <div>
              <div style="font-weight:800;font-size:15px;color:#0f172a;letter-spacing:-0.2px;">${escapeHtml(v.registration_plate)}</div>
              <div style="font-size:12px;color:#64748b;font-weight:600;">${escapeHtml(v.make)} ${escapeHtml(v.model)}</div>
              <div style="font-size:11px;color:#94a3b8;">${escapeHtml(v.car_type)}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
              <span style="font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:9999px;background:${isEv ? '#ebf5ff' : '#f1f5f9'};color:${isEv ? '#0072de' : '#0f172a'};">
                ${isEv ? `⚡ EV ${v.battery_percent ?? 100}%` : '⛽ Gasoline'}
              </span>
              <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:9999px;background:${isInTrip ? '#fef3c7' : '#f1f5f9'};color:${isInTrip ? '#b45309' : '#475569'};">
                ${isInTrip ? '🚗 In Trip' : '🅿️ Standby'}
              </span>
            </div>
          </div>

          <!-- Driver Profile Card (With Driver Photo) -->
          <div style="display:flex;align-items:center;gap:10px;background:#f8fafc;padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:8px;">
            <div style="position:relative;width:44px;height:44px;border-radius:50%;overflow:hidden;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.15);border:2px solid #ffffff;">
              <img src="${driverPhoto}" alt="${escapeHtml(v.driver_name || 'Driver')}" style="width:100%;height:100%;object-fit:cover;display:block;" />
              <span style="position:absolute;bottom:0;right:0;width:10px;height:10px;background:${isInTrip ? '#258cfb' : '#0072de'};border-radius:50%;border:2px solid #ffffff;"></span>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:10px;text-transform:uppercase;font-weight:800;color:#64748b;letter-spacing:0.04em;">Assigned Driver</div>
              <div style="font-weight:800;font-size:13px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${escapeHtml(v.driver_name || 'Standby Driver')}
              </div>
              ${v.driver_licence_number ? `
                <div style="font-size:11px;color:#475569;font-family:monospace;">
                  ${escapeHtml(v.driver_licence_number)} ${v.driver_licence_expiry ? `<span style="color:#94a3b8;">(Exp ${escapeHtml(v.driver_licence_expiry)})</span>` : ''}
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Contact Driver Buttons -->
          ${contactButtons}

          <!-- Person Using This Car / Active Passenger Detail -->
          ${tripInfo}

          <!-- Footer Stats -->
          <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;display:flex;justify-content:space-between;align-items:center;">
            <span>Odo: <b>${Number(v.current_odometer || 0).toLocaleString()} km</b></span>
            <span style="font-family:monospace;color:#94a3b8;">${Number(v.latitude).toFixed(4)}, ${Number(v.longitude).toFixed(4)}</span>
          </div>
        </div>
      `);
    }

    if (map && bounds.isValid() && !routeActiveRef.current && !hasFittedFleetRef.current) {
      hasFittedFleetRef.current = true;
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [fleetPositions]);

  // Fly to focused vehicle when focusedVehicleId changes
  useEffect(() => {
    if (!focusedVehicleId) return;
    const map = mapInstanceRef.current;
    const target = fleetPositions?.find((p) => p.id === focusedVehicleId);
    const marker = markerMapRef.current.get(focusedVehicleId);
    if (map && target) {
      map.flyTo([target.latitude, target.longitude], 16, { animate: true, duration: 1.2 });
      if (marker) {
        window.setTimeout(() => {
          marker.openPopup();
        }, 400);
      }
    }
  }, [focusedVehicleId, fleetPositions]);

  // Render Route Pickup, Destination & Polyline whenever route coordinates or mode change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = routeLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (showRoute || Boolean(origin && origin.trim())) {
      const pickupIcon = L.divIcon({
        className: 'gf-leaflet-marker',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
            <div style="background:#ffffff;color:#0a0a0a;padding:4px 10px;border-radius:10px;font-size:10.5px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.22);margin-bottom:4px;border:1.5px solid #0072de;display:flex;align-items:center;gap:4px;">
              <span style="color:#0072de;">Pickup</span>
              <span style="color:#64748b;font-weight:600;">• Nearest spot</span>
            </div>
            <div style="width:24px;height:24px;border-radius:9999px;background:#0072de;color:#ffffff;outline:3px solid #ffffff;box-shadow:0 3px 10px rgba(0,114,222,0.45);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;line-height:1;">
              ↑
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(effOrigin, { icon: pickupIcon }).addTo(group);
    }

    if (showRoute && effDest && !pinMode) {
      const destIcon = L.divIcon({
        className: 'gf-leaflet-marker',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
            <div style="background:#0a0a0a;color:#ffffff;padding:4px 11px;border-radius:9999px;font-size:10.5px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.32);margin-bottom:4px;border:1.5px solid #ffffff;">
              ${metrics.etaText ? `ETA ${escapeHtml(metrics.etaText)} • ${metrics.durationMin} min` : 'Destination'}
            </div>
            <div style="width:22px;height:22px;border-radius:9999px;background:#0a0a0a;outline:3px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
              <span style="width:7px;height:7px;border-radius:9999px;background:#ffffff;display:block;"></span>
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(effDest, { icon: destIcon }).addTo(group);

      const hasFullGeometry = Array.isArray(routeGeometry) && routeGeometry.length >= 2;
      const midLat = (effOrigin[0] + effDest[0]) / 2 + (effDest[1] - effOrigin[1]) * 0.12;
      const midLon = (effOrigin[1] + effDest[1]) / 2 - (effDest[0] - effOrigin[0]) * 0.12;
      const latlngs: L.LatLngExpression[] = hasFullGeometry
        ? (routeGeometry as L.LatLngExpression[])
        : [effOrigin, [midLat, midLon], effDest];

      // Route Outer Glow Halo
      L.polyline(latlngs, {
        color: '#ffffff',
        weight: 9,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);

      // Signature Samsung Blue Route Line
      L.polyline(latlngs, {
        color: '#0072de',
        weight: 5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);

      if (driverActive) {
        const carPoint = (driverCoords && Number.isFinite(driverCoords.lat) && Number.isFinite(driverCoords.lon))
          ? [driverCoords.lat, driverCoords.lon] as [number, number]
          : hasFullGeometry
          ? routeGeometry![Math.floor(routeGeometry!.length / 2)]
          : ([midLat, midLon] as [number, number]);

        const avatarKey = resolveCarAvatarKey(activeVehicleModel || 'Stargazer', 'Hyundai', 'Gasoline');
        const carSvg = getCarFrontAvatarSvg(avatarKey, true);

        const drvIcon = L.divIcon({
          className: 'gf-leaflet-marker',
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);cursor:pointer;">
              <div style="background:#0f172a;color:#ffffff;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,0.3);margin-bottom:2px;display:flex;align-items:center;gap:4px;border:1.5px solid #258cfb;">
                <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#258cfb;animation:pulse 1.5s infinite;"></span>
                <span>${escapeHtml(driverName || 'Driver')} (Live Car)</span>
              </div>
              <div style="width:54px;height:38px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.3));">
                ${carSvg}
              </div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        L.marker(carPoint, { icon: drvIcon }).addTo(group);
      }

      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16 });
    }
  }, [effOrigin, effDest, routeGeometry, metrics.etaText, metrics.durationMin, showRoute, pinMode, driverActive, origin, driverCoords, driverName, activeVehicleModel]);

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
      aria-label={pinMode ? 'Interactive map. Drag or use arrow keys to position the pin.' : 'Route and live vehicle position view'}
      onKeyDown={handleKeyDown}
    >
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

      {/* Floating 3-Layer Map Switcher (Streets, Satellite, Terrain) */}
      <div
        className="gf-map-layer-switcher"
        style={{
          position: 'absolute',
          top: 'calc(74px + var(--safe-top))',
          left: showBackButton ? 'calc(var(--space-4) + 54px)' : 'var(--space-4)',
          zIndex: 455,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <div className="gf-map-layer-pill-group">
          <button
            type="button"
            className={`pressable gf-map-layer-btn ${activeLayer === 'streets' ? 'active' : ''}`}
            onClick={() => setActiveLayer('streets')}
            title="Standard street map layer"
          >
            <MapIcon size={13} />
            <span className="gf-map-layer-btn-label">Streets</span>
          </button>
          <button
            type="button"
            className={`pressable gf-map-layer-btn ${activeLayer === 'satellite' ? 'active' : ''}`}
            onClick={() => setActiveLayer('satellite')}
            title="High-resolution aerial satellite imagery"
          >
            <Layers size={13} />
            <span className="gf-map-layer-btn-label">Satellite</span>
          </button>
          <button
            type="button"
            className={`pressable gf-map-layer-btn ${activeLayer === 'terrain' ? 'active' : ''}`}
            onClick={() => setActiveLayer('terrain')}
            title="Topographic elevation terrain layer"
          >
            <Mountain size={13} />
            <span className="gf-map-layer-btn-label">Terrain</span>
          </button>
        </div>
      </div>

      {/* Top-Right Metrics / Badges / Locate Me GPS Button */}
      <div
        className="gf-map-overlay-actions"
        style={{
          position: 'absolute',
          top: 'calc(74px + var(--safe-top))',
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
              {metrics.distanceKm} km • ~{metrics.durationMin} min ride{metrics.etaText ? ` • ETA ${metrics.etaText}` : ''}
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
          {fleetPositions && fleetPositions.length > 0 && (
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
              title="Operational vehicles on live map"
            >
              <span className="gf-dot-green" />
              <span>{fleetPositions.length} Cars Live</span>
            </div>
          )}

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
              <Users size={13} />
              <span>{userPins.length} Users</span>
            </div>
          )}

          {onLocateMe && (
            <button
              id="map-locate-me-btn"
              type="button"
              className="pressable"
              style={{
                width: '50px',
                height: '50px',
                minWidth: '50px',
                minHeight: '50px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-bg-surface)',
                color: myCoords ? 'var(--color-green)' : 'var(--color-text-primary)',
                boxShadow: 'var(--shadow-floating)',
                border: '1px solid var(--color-divider)',
                cursor: 'pointer',
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
              <LocateFixed size={22} />
            </button>
          )}
        </div>
      </div>

      {/* Pulsing Green Radar Rings when Waiting for Approval */}
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

      {/* Top-Left Circular White Back Button */}
      {showBackButton && onBack && (
        <button
          id="map-back-btn"
          type="button"
          className="gf-map-back-btn pressable"
          style={{ zIndex: 460, top: 'calc(74px + var(--safe-top))' }}
          onClick={onBack}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
      )}

      {/* Non-blocking Tile Loading Indicator */}
      {tilesLoading && !isOffline && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(126px + var(--safe-top))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 455,
            background: 'var(--color-bg-surface)',
            color: '#0072de',
            border: '1px solid var(--color-divider)',
            padding: '5px 12px',
            borderRadius: 'var(--radius-pill)',
            boxShadow: 'var(--shadow-floating)',
            fontSize: '11.5px',
            fontWeight: 700,
            pointerEvents: 'none',
          }}
        >
          Loading map tiles...
        </div>
      )}

      {/* Connection Required Banner Pill */}
      {isOffline && (
        <div className="gf-map-offline-pill" style={{ zIndex: 460 }} role="alert">
          <WifiOff size={14} />
          Connection required (WEB-03)
        </div>
      )}
    </div>
  );
};
