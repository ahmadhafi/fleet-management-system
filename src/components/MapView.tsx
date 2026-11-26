import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Crosshair, LocateFixed, Navigation2, Users, WifiOff, Layers, Map as MapIcon, Mountain } from 'lucide-react';
import { apiRequest } from '../api';
import { getDriverAvatarDataUri, getVehiclePhotoIconUrl } from './CarAvatarArt';
import { useAppLanguage } from '../utils/i18n';

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

export const GOOGLE_MAPS_STREETS_URL = 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
export const GOOGLE_MAPS_SATELLITE_URL = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
export const GOOGLE_MAPS_TERRAIN_URL = 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
export const CARTO_VOYAGER_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
export const OSM_FALLBACK_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const SATELLITE_FALLBACK_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const TERRAIN_FALLBACK_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const MAP_LAYERS: Record<MapLayerKey, { name: string; url: string; fallbackUrl: string; options: L.TileLayerOptions; fallbackOptions: L.TileLayerOptions }> = {
  streets: {
    name: 'Streets',
    url: GOOGLE_MAPS_STREETS_URL,
    fallbackUrl: CARTO_VOYAGER_URL,
    options: {
      maxZoom: 21,
      subdomains: ['0', '1', '2', '3'],
      updateWhenZooming: false,
      updateWhenIdle: false,
      keepBuffer: 4,
      attribution: '&copy; <a href="https://www.google.com/maps" target="_blank" rel="noreferrer">Google Maps</a> &copy; <a href="https://carto.com/" target="_blank" rel="noreferrer">CARTO</a>',
    },
    fallbackOptions: {
      maxZoom: 20,
      subdomains: ['a', 'b', 'c', 'd'],
      updateWhenZooming: false,
      updateWhenIdle: false,
      keepBuffer: 4,
      attribution: '&copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    },
  },
  satellite: {
    name: 'Satellite',
    url: GOOGLE_MAPS_SATELLITE_URL,
    fallbackUrl: SATELLITE_FALLBACK_TILE_URL,
    options: {
      maxZoom: 21,
      subdomains: ['0', '1', '2', '3'],
      updateWhenZooming: false,
      updateWhenIdle: false,
      keepBuffer: 4,
      attribution: '&copy; <a href="https://www.google.com/maps" target="_blank" rel="noreferrer">Google Maps</a> &mdash; Satellite Hybrid',
    },
    fallbackOptions: {
      maxZoom: 19,
      updateWhenZooming: false,
      updateWhenIdle: false,
      keepBuffer: 4,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    },
  },
  terrain: {
    name: 'Terrain',
    url: GOOGLE_MAPS_TERRAIN_URL,
    fallbackUrl: TERRAIN_FALLBACK_TILE_URL,
    options: {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      updateWhenZooming: false,
      updateWhenIdle: false,
      keepBuffer: 4,
      attribution: '&copy; <a href="https://www.google.com/maps" target="_blank" rel="noreferrer">Google Maps</a> &mdash; Topographic Terrain',
    },
    fallbackOptions: {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      updateWhenZooming: false,
      updateWhenIdle: false,
      keepBuffer: 4,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
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
  driverToPickupEta?: { distanceKm: number; durationMin: number; etaText: string } | null;
  activeVehicleModel?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  isOffline?: boolean;
  focusedVehicleId?: number | null;
  onSelectVehicle?: (vehicle: FleetVehiclePosition) => void;
  hasDriverTopbar?: boolean;
  driverMapMode?: boolean;
  driverOnline?: boolean;
  driverVehicleModel?: string;
  driverVehicleEnergyType?: string;
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
  driverToPickupEta = null,
  activeVehicleModel,
  showBackButton = false,
  onBack,
  isOffline = false,
  focusedVehicleId,
  onSelectVehicle,
  hasDriverTopbar = false,
  driverMapMode = false,
  driverOnline = false,
  driverVehicleModel,
  driverVehicleEnergyType,
}) => {
  const { t } = useAppLanguage();
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
      }, 2000);
    };

    setTilesLoading(true);
    resetSafetyTimer();

    // Primary tile source: High-speed, 100% free Google Maps raster tiles (zero API key, zero cost)
    const primaryTileUrl = config.url;

    const layer = L.tileLayer(primaryTileUrl, {
      ...config.options,
      maxZoom: config.options.maxZoom || 20,
      updateWhenZooming: false,
      updateWhenIdle: false,
      keepBuffer: 4,
    });
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

        const fallbackLayer = L.tileLayer(config.fallbackUrl, {
          ...config.fallbackOptions,
          updateWhenZooming: false,
          updateWhenIdle: false,
          keepBuffer: 4,
        });
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

  // Initialize Leaflet Map with SVG renderer (immune to canvas clearRect crashes), ResizeObserver & automatic tile failover
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: effOrigin,
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: false,
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

    if (driverMapMode) {
      const drvLat = myCoords && Number.isFinite(myCoords.lat) ? myCoords.lat : effOrigin[0];
      const drvLon = myCoords && Number.isFinite(myCoords.lon) ? myCoords.lon : effOrigin[1];
      if (driverOnline) {
        L.circle([drvLat, drvLon], {
          radius: Math.min(260, Math.max(45, Number(myCoords?.accuracy || 60))),
          color: '#0072de',
          weight: 1.5,
          fillColor: '#0072de',
          fillOpacity: 0.14,
        }).addTo(pinsLayer);
      }

      const driverCarIconUrl = getVehiclePhotoIconUrl(driverVehicleModel || activeVehicleModel, driverVehicleEnergyType);
      const driverSelfCarIcon = L.divIcon({
        className: 'gf-leaflet-marker',
        html: `
          <div class="gf-driver-map-car-marker ${driverOnline ? 'is-online' : ''}" style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);cursor:pointer;">
            ${driverOnline ? `<div style="position:absolute;inset:-8px;border-radius:50%;background:rgba(0,114,222,0.22);animation:gfDriverCarPulse 2s ease-out infinite;"></div>` : ''}
            <div style="width:52px;height:52px;border-radius:50%;background:#ffffff;border:3px solid ${driverOnline ? '#0072de' : '#64748b'};box-shadow:0 4px 14px rgba(0,0,0,0.24);display:flex;align-items:center;justify-content:center;position:relative;z-index:2;padding:4px;overflow:hidden;">
              <img src="${driverCarIconUrl}" alt="Driver Vehicle" style="width:42px;height:42px;object-fit:contain;display:block;" />
            </div>
            <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${driverOnline ? '#0072de' : '#64748b'};margin-top:-2px;position:relative;z-index:2;"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker([drvLat, drvLon], { icon: driverSelfCarIcon, zIndexOffset: 900 }).addTo(pinsLayer);
    } else if (myCoords && (!currentUserId || !renderedIds.has(currentUserId))) {
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
  }, [userPins, currentUserId, myCoords, originCoords, driverMapMode, driverOnline, driverVehicleModel, driverVehicleEnergyType, activeVehicleModel, effOrigin]);

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

      const driverPhoto = getDriverAvatarDataUri(v.driver_name || 'Driver', v.driver_photo_url);

      const isFollowing = Boolean(v.is_following_driver);
      const fleetCarIconUrl = getVehiclePhotoIconUrl(`${v.make || ''} ${v.model || ''}`, v.energy_type);
      const carIcon = L.divIcon({
        className: 'gf-leaflet-marker',
        html: `
          <div class="gf-fleet-marker-wrap ${isInTrip ? 'is-driving' : ''}" style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);cursor:pointer;">
            <div style="background:#ffffff;color:#0f172a;padding:2px 8px;border-radius:9999px;font-size:10.5px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.24);margin-bottom:3px;border:1.5px solid ${isFollowing ? '#0072de' : mainColor};display:flex;align-items:center;gap:4px;">
              <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${isInTrip || isFollowing ? '#258cfb' : '#0072de'};"></span>
              <span>${escapeHtml(v.registration_plate)}</span>
              <span style="color:#64748b;font-weight:600;font-size:10px;">• ${escapeHtml(v.driver_name?.split(' ')[0] || 'Driver')}</span>
              <span style="font-size:10px;">${isEv ? '⚡' : '⛽'}</span>
            </div>

            <!-- Model-specific Car Icon Badge (Stargazer / Ioniq 5) -->
            <div style="position:relative;width:50px;height:50px;border-radius:50%;background:#ffffff;border:2.5px solid ${isInTrip || isFollowing ? '#0072de' : '#334155'};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.28);padding:4px;overflow:hidden;">
              <img src="${fleetCarIconUrl}" alt="${escapeHtml(v.model)}" style="width:40px;height:40px;object-fit:contain;display:block;" />
              ${isInTrip ? `
                <div style="position:absolute;top:-5px;right:-8px;background:#258cfb;color:#ffffff;border-radius:9999px;padding:1px 5px;font-size:8px;font-weight:900;letter-spacing:0.02em;box-shadow:0 2px 6px rgba(37,140,251,0.5);border:1px solid #ffffff;">
                  DRIVING
                </div>
              ` : isFollowing ? `
                <div style="position:absolute;top:-5px;right:-8px;background:#0072de;color:#ffffff;border-radius:9999px;padding:1px 5px;font-size:8px;font-weight:900;letter-spacing:0.02em;box-shadow:0 2px 6px rgba(0,114,222,0.5);border:1px solid #ffffff;">
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

          <!-- Real-Time ETA to Samsung Jababeka Location -->
          ${(() => {
            const distToSamsungKm = Math.max(0.5, Number((haversineKm(v.latitude, v.longitude, -6.287549, 107.1356063) * 1.28).toFixed(1)));
            const etaToSamsungMin = Math.max(3, Math.round(distToSamsungKm * 2.3 + 4));
            const arrivalTime = new Date(Date.now() + etaToSamsungMin * 60_000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
              <div style="background:#eff6ff;border:1.5px solid #0072de;border-radius:10px;padding:8px 10px;margin-top:8px;">
                <div style="font-size:10px;font-weight:900;color:#0072de;text-transform:uppercase;letter-spacing:0.04em;display:flex;align-items:center;justify-content:space-between;">
                  <span>🏢 Live ETA to Samsung Jababeka</span>
                  <span style="background:#0072de;color:#ffffff;padding:1px 6px;border-radius:9999px;font-size:9px;font-weight:800;">LIVE</span>
                </div>
                <div style="font-size:12.5px;font-weight:800;color:#0f172a;margin-top:2px;">
                  ~${etaToSamsungMin} min (${distToSamsungKm} km) • ETA ${arrivalTime}
                </div>
                <div style="font-size:10.5px;color:#475569;margin-top:1px;">
                  PT Samsung Electronics Indonesia, Cikarang Utara
                </div>
              </div>
            `;
          })()}

          <!-- Footer Stats -->
          <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;display:flex;justify-content:space-between;align-items:center;">
            <span>Odo: <b>${Number(v.current_odometer || 0).toLocaleString()} km</b></span>
            <span style="font-family:monospace;color:#94a3b8;">${Number(v.latitude).toFixed(4)}, ${Number(v.longitude).toFixed(4)}</span>
          </div>
        </div>
      `);
    }

    // Add Samsung Jababeka Plant Facility Marker to Fleet Live Map
    const samsungLat = -6.287549;
    const samsungLon = 107.1356063;
    bounds.extend([samsungLat, samsungLon]);

    const samsungIcon = L.divIcon({
      className: 'gf-leaflet-marker',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);cursor:pointer;z-index:850;">
          <div style="background:#0072de;color:#ffffff;padding:3px 9px;border-radius:9999px;font-size:10.5px;font-weight:900;white-space:nowrap;box-shadow:0 3px 12px rgba(0,114,222,0.45);margin-bottom:3px;border:1.5px solid #ffffff;display:flex;align-items:center;gap:4px;">
            <span>🏢 Samsung Jababeka (SEIN)</span>
          </div>
          <div style="width:28px;height:28px;border-radius:50%;background:#0072de;border:2.5px solid #ffffff;box-shadow:0 4px 12px rgba(0,114,222,0.5);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:900;font-size:13px;">
            📍
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const samsungMarker = L.marker([samsungLat, samsungLon], { icon: samsungIcon }).addTo(fleetLayer);
    samsungMarker.bindPopup(`
      <div style="font-family:inherit;font-size:12.5px;line-height:1.45;padding:4px;max-width:280px;">
        <div style="font-size:10px;text-transform:uppercase;font-weight:900;color:#0072de;letter-spacing:0.04em;">Samsung Corporate Facility</div>
        <div style="font-weight:800;font-size:14px;color:#0f172a;margin-top:2px;">PT Samsung Electronics Indonesia</div>
        <div style="font-size:11.5px;color:#475569;margin-top:3px;">
          Jl. Jababeka Raya Blok F. 29 No.31, Harja Mekar, Cikarang Utara, Kabupaten Bekasi, Jawa Barat 17530
        </div>
        <div style="margin-top:8px;">
          <a href="https://maps.app.goo.gl/3SNQBaMPZwVQCy857?g_st=ac" target="_blank" rel="noreferrer" style="font-size:11px;font-weight:700;color:#0072de;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
            Open in Google Maps ↗
          </a>
        </div>
      </div>
    `);

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

    if (showRoute || (!driverMapMode && Boolean(origin && origin.trim()))) {
      const shortOrig = (origin || 'Pickup').split(',')[0].slice(0, 22);
      const pickupIcon = L.divIcon({
        className: 'gf-leaflet-marker',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
            <div style="background:#ffffff;color:#0a0a0a;padding:4px 10px;border-radius:10px;font-size:10.5px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.22);margin-bottom:4px;border:1.5px solid #0072de;display:flex;align-items:center;gap:4px;">
              <span style="color:#0072de;">Pickup</span>
              <span style="color:#64748b;font-weight:600;">• ${escapeHtml(shortOrig)}</span>
            </div>
            <div style="width:24px;height:24px;border-radius:9999px;background:#0072de;color:#ffffff;outline:3px solid #ffffff;box-shadow:0 3px 10px rgba(0,114,222,0.45);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;line-height:1;">
              ↑
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(effOrigin, { icon: pickupIcon, zIndexOffset: 500 }).addTo(group);
    }

    if (showRoute && effDest && !pinMode) {
      const shortDest = (destination || 'Destination').split(',')[0].slice(0, 24);
      const destIcon = L.divIcon({
        className: 'gf-leaflet-marker',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
            <div style="background:#0a0a0a;color:#ffffff;padding:5px 12px;border-radius:9999px;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,0.34);margin-bottom:5px;border:1.5px solid #ffffff;display:flex;align-items:center;gap:5px;">
              <span>🎯 ${escapeHtml(shortDest)}</span>
              ${metrics.etaText ? `<span style="color:#93c5fd;">• ${metrics.durationMin} min (${metrics.distanceKm} km)</span>` : ''}
            </div>
            <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
              <div style="position:absolute;inset:-7px;border-radius:9999px;background:rgba(0,114,222,0.25);"></div>
              <div style="width:22px;height:22px;border-radius:9999px;background:#0a0a0a;outline:3px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.38);display:flex;align-items:center;justify-content:center;position:relative;z-index:2;">
                <span style="width:7px;height:7px;border-radius:9999px;background:#ffffff;display:block;"></span>
              </div>
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(effDest, { icon: destIcon, zIndexOffset: 600 }).addTo(group);

      const hasFullGeometry = Array.isArray(routeGeometry) && routeGeometry.length >= 2;
      const ctrlLat = (effOrigin[0] + effDest[0]) / 2 + (effDest[1] - effOrigin[1]) * 0.1;
      const ctrlLon = (effOrigin[1] + effDest[1]) / 2 - (effDest[0] - effOrigin[0]) * 0.1;
      const fallbackCurve: Array<[number, number]> = [];
      if (!hasFullGeometry) {
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const omt = 1 - t;
          fallbackCurve.push([
            omt * omt * effOrigin[0] + 2 * omt * t * ctrlLat + t * t * effDest[0],
            omt * omt * effOrigin[1] + 2 * omt * t * ctrlLon + t * t * effDest[1],
          ]);
        }
      }
      const rawPoints: Array<[number, number]> = hasFullGeometry
        ? (routeGeometry as Array<[number, number]>)
        : fallbackCurve;

      const latlngs: L.LatLngExpression[] = rawPoints.filter(
        (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])
      ) as L.LatLngExpression[];

      if (latlngs.length >= 2) {
        // Gojek-style Route Outer White Glow Halo (high contrast on all tile providers)
        L.polyline(latlngs, {
          color: '#ffffff',
          weight: 10,
          opacity: 0.96,
          lineCap: 'round',
          lineJoin: 'round',
          pane: 'overlayPane',
        }).addTo(group);

        // Signature Samsung Blue Route Line
        L.polyline(latlngs, {
          color: '#0072de',
          weight: 5.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
          pane: 'overlayPane',
        }).addTo(group);

        // Directional flow dashed accent overlay
        L.polyline(latlngs, {
          color: '#93c5fd',
          weight: 2.5,
          opacity: 0.9,
          dashArray: '8, 12',
          lineCap: 'round',
          lineJoin: 'round',
          pane: 'overlayPane',
        }).addTo(group);
      }

      const hasRealDriverCoords = Boolean(
        driverActive && driverCoords && Number.isFinite(driverCoords.lat) && Number.isFinite(driverCoords.lon)
      );
      const liveCarPoint: [number, number] | null = hasRealDriverCoords
        ? [driverCoords!.lat, driverCoords!.lon]
        : null;

      if (liveCarPoint) {
        // Subtle dashed approach line from assigned driver's live location to passenger pickup
        L.polyline([liveCarPoint, effOrigin], {
          color: '#258cfb',
          weight: 3.5,
          opacity: 0.85,
          dashArray: '6, 8',
          lineCap: 'round',
          pane: 'overlayPane',
        }).addTo(group);

        const activeCarIconUrl = getVehiclePhotoIconUrl(activeVehicleModel);
        const etaSuffix = driverToPickupEta
          ? `~${driverToPickupEta.durationMin} min (${driverToPickupEta.distanceKm} km) to pickup`
          : 'On the way';
        const drvIcon = L.divIcon({
          className: 'gf-leaflet-marker',
          html: `
            <div class="gf-assigned-driver-marker" style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);cursor:pointer;">
              <div style="background:#0f172a;color:#ffffff;padding:3px 10px;border-radius:9999px;font-size:10.5px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.34);margin-bottom:4px;display:flex;align-items:center;gap:5px;border:1.5px solid #258cfb;">
                <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#258cfb;animation:pulse 1.5s infinite;"></span>
                <span>${escapeHtml(driverName || 'Driver')}</span>
                <span style="color:#93c5fd;">• ${escapeHtml(etaSuffix)}</span>
              </div>
              <div style="width:50px;height:50px;border-radius:50%;background:#ffffff;border:2.5px solid #0072de;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,114,222,0.35);padding:4px;overflow:hidden;">
                <img src="${activeCarIconUrl}" alt="Assigned Driver Live Car" style="width:40px;height:40px;object-fit:contain;display:block;" />
              </div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        L.marker(liveCarPoint, { icon: drvIcon, zIndexOffset: 700 }).addTo(group);
      }

      const fitGojekRouteCamera = (animate: boolean) => {
        if (!mapInstanceRef.current || !mapContainerRef.current) return;
        const m = mapInstanceRef.current;
        m.invalidateSize({ pan: false });
        const boundPoints: L.LatLngExpression[] = [effOrigin, effDest, ...latlngs];
        if (liveCarPoint) boundPoints.push(liveCarPoint);
        const bounds = L.latLngBounds(boundPoints);
        if (!bounds.isValid()) return;
        const containerW = mapContainerRef.current.clientWidth || window.innerWidth || 390;
        const containerH = mapContainerRef.current.clientHeight || window.innerHeight || 640;
        const isMobileOverlaySheet = containerW < 768 && containerH > 460;
        if (isMobileOverlaySheet) {
          // Reserve lower half for the floating Gojek-style bottom sheet so route + destination zoom squarely into visible upper viewport
          const bottomSheetReserve = Math.min(Math.round(containerH * 0.48), 430);
          m.fitBounds(bounds, {
            paddingTopLeft: [44, 96],
            paddingBottomRight: [44, bottomSheetReserve],
            maxZoom: 16,
            animate,
            duration: 0.65,
          });
        } else {
          m.fitBounds(bounds, {
            padding: [72, 72],
            maxZoom: 16,
            animate,
            duration: 0.65,
          });
        }
      };

      fitGojekRouteCamera(true);
      const settleTimer = window.setTimeout(() => {
        fitGojekRouteCamera(true);
      }, 320);

      return () => {
        window.clearTimeout(settleTimer);
      };
    } else if (driverActive && driverCoords && Number.isFinite(driverCoords.lat) && Number.isFinite(driverCoords.lon) && !pinMode) {
      const liveCarPoint: [number, number] = [driverCoords.lat, driverCoords.lon];
      L.polyline([liveCarPoint, effOrigin], {
        color: '#258cfb',
        weight: 3.5,
        opacity: 0.85,
        dashArray: '6, 8',
        lineCap: 'round',
        pane: 'overlayPane',
      }).addTo(group);

      const activeCarIconUrl = getVehiclePhotoIconUrl(activeVehicleModel);
      const etaSuffix = driverToPickupEta
        ? `~${driverToPickupEta.durationMin} min (${driverToPickupEta.distanceKm} km) to pickup`
        : 'On the way';
      const drvIcon = L.divIcon({
        className: 'gf-leaflet-marker',
        html: `
          <div class="gf-assigned-driver-marker" style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);cursor:pointer;">
            <div style="background:#0f172a;color:#ffffff;padding:3px 10px;border-radius:9999px;font-size:10.5px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.34);margin-bottom:4px;display:flex;align-items:center;gap:5px;border:1.5px solid #258cfb;">
              <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#258cfb;animation:pulse 1.5s infinite;"></span>
              <span>${escapeHtml(driverName || 'Driver')}</span>
              <span style="color:#93c5fd;">• ${escapeHtml(etaSuffix)}</span>
            </div>
            <div style="width:50px;height:50px;border-radius:50%;background:#ffffff;border:2.5px solid #0072de;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,114,222,0.35);padding:4px;overflow:hidden;">
              <img src="${activeCarIconUrl}" alt="Assigned Driver Live Car" style="width:40px;height:40px;object-fit:contain;display:block;" />
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(liveCarPoint, { icon: drvIcon, zIndexOffset: 700 }).addTo(group);

      const bounds = L.latLngBounds([effOrigin, liveCarPoint]);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [72, 72], maxZoom: 16, animate: true });
      }
    } else if (Boolean(origin && origin.trim()) && !pinMode) {
      map.setView(effOrigin, 15, { animate: false });
    }
  }, [effOrigin, effDest, routeGeometry, metrics.etaText, metrics.durationMin, metrics.distanceKm, showRoute, pinMode, driverActive, origin, destination, driverCoords, driverName, driverToPickupEta, activeVehicleModel, driverMapMode]);

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
      className={`gf-map-stage ${hasDriverTopbar ? 'has-driver-topbar' : ''} ${driverMapMode ? 'is-driver-map-mode' : ''}`}
      tabIndex={pinMode ? 0 : -1}
      role={pinMode ? 'application' : undefined}
      aria-label={pinMode ? 'Interactive map. Drag or use arrow keys to position the pin.' : 'Route and live vehicle position view'}
      onKeyDown={handleKeyDown}
    >
      <div ref={mapContainerRef} id="map-container" style={{ width: '100%', height: '100%', zIndex: 1 }} />

      {/* Floating 3-Layer Map Switcher (Streets, Satellite, Terrain) — hidden in clean Gojek Driver Home mode */}
      {!driverMapMode && (
        <div className={`gf-map-layer-switcher ${showBackButton ? 'has-back-btn' : ''}`}>
          <div className="gf-map-layer-pill-group">
            <button
              type="button"
              className={`pressable gf-map-layer-btn ${activeLayer === 'streets' ? 'active' : ''}`}
              onClick={() => setActiveLayer('streets')}
              title={t('Streets')}
            >
              <MapIcon size={13} />
              <span className="gf-map-layer-btn-label">{t('Streets')}</span>
            </button>
            <button
              type="button"
              className={`pressable gf-map-layer-btn ${activeLayer === 'satellite' ? 'active' : ''}`}
              onClick={() => setActiveLayer('satellite')}
              title={t('Satellite')}
            >
              <Layers size={13} />
              <span className="gf-map-layer-btn-label">{t('Satellite')}</span>
            </button>
            <button
              type="button"
              className={`pressable gf-map-layer-btn ${activeLayer === 'terrain' ? 'active' : ''}`}
              onClick={() => setActiveLayer('terrain')}
              title={t('Terrain')}
            >
              <Mountain size={13} />
              <span className="gf-map-layer-btn-label">{t('Terrain')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Top-Right Metrics / Badges / Locate Me GPS Button */}
      {!driverMapMode && (
        <div className="gf-map-overlay-actions">
          {showRoute && effDest && !pinMode && !driverActive && (
            <div className="gf-map-metrics-pill">
              <Navigation2 size={13} style={{ color: 'var(--color-green)' }} />
              <span>
                {`${metrics.distanceKm} km • ~${metrics.durationMin} ${t('min ride')}${metrics.etaText ? ` • ETA ${metrics.etaText}` : ''}`}
              </span>
            </div>
          )}

          {driverActive && driverName && (
            <div className="gf-map-driver-pill">
              {t('Driver assigned')} • {driverName}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!driverActive && !showRoute && fleetPositions && fleetPositions.length > 0 && (
              <div className="gf-map-fleet-pill" title="Operational vehicles on live map">
                <span className="gf-dot-green" />
                <span>{fleetPositions.length} {t('Cars Live')}</span>
              </div>
            )}

            {!driverActive && !showRoute && userPins.length > 0 && (
              <div className="gf-map-users-pill" title="Active users sharing their live pinpoint on the map">
                <Users size={13} />
                <span>{userPins.length} {t('Users')}</span>
              </div>
            )}

            {onLocateMe && (
              <button
                id="map-locate-me-btn"
                type="button"
                className={`pressable ${myCoords ? 'is-located' : ''}`}
                onClick={() => {
                  onLocateMe();
                  if (myCoords && mapInstanceRef.current) {
                    mapInstanceRef.current.setView([myCoords.lat, myCoords.lon], 16, { animate: true });
                  }
                }}
                aria-label={t('Detect & center on my location')}
                title={locatingUser ? t('Detecting GPS location...') : t('Detect & center on my location')}
              >
                <LocateFixed size={20} />
              </button>
            )}
          </div>
        </div>
      )}

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

      {/* Top-Left Circular Back Button */}
      {showBackButton && onBack && (
        <button
          id="map-back-btn"
          type="button"
          className="gf-map-back-btn pressable"
          onClick={onBack}
          aria-label={t('Go back')}
        >
          <ArrowLeft size={18} />
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
