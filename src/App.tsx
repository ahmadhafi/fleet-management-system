import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Car,
  ShieldCheck,
  Bell,
  LogOut,
  Calendar,
  Navigation,
  CheckCircle2,
  Clock,
  AlertTriangle,
  BatteryCharging,
  Fuel,
  UserCheck,
  Users,
  MapPin,
  Upload,
  Edit3,
  Play,
  Search,
  Bookmark,
  Briefcase,
  StickyNote,
  Phone,
  MessageSquare,
  Share2,
  Star,
  Smartphone,
  ChevronRight,
  Lock,
  FileText,
  Plus,
  Trash2,
  Power,
  Camera,
  FileDown,
  Printer,
  BarChart3,
  ScrollText,
  Eye,
  EyeOff,
  User,
  RefreshCw,
  ArrowUp,
  ArrowRight,
  ArrowLeft,
  Bus,
  Info,
  X,
} from 'lucide-react';
import { apiRequest, getStoredToken, setStoredToken, urlBase64ToUint8Array } from './api';
import { AppShell, AdminShell, type NavSection, type AdminModule } from './components/AppShell';
import { BottomSheet, type SnapPoint } from './components/BottomSheet';
import {
  MapView,
  estimateRouteMetrics,
  type GeoPlace,
  type UserLocationPin,
  type RouteCalculationResult,
  type FleetVehiclePosition,
  formatWhatsAppUrl,
  formatPhoneCallUrl,
} from './components/MapView';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useAppLanguage, startDomTranslationObserver, type SupportedLang } from './utils/i18n';
import { SamsungBusLogo } from './components/SamsungBusLogo';
import { RouteFields } from './components/RouteFields';
import { VehicleArt } from './components/VehicleArt';
import { getDriverAvatarDataUri } from './components/CarAvatarArt';
import { triggerSystemNotification } from './utils/notification';
import { GojekWheelPicker, type DateOption } from './components/GojekWheelPicker';
import {
  Chip,
  StatusBadge,
  toneFromStatus,
  Segmented,
  ListRow,
  OptionRow,
  StickyActionBar,
  Skeleton,
  EmptyState,
  ErrorState,
} from './components/ui';

const FALLBACK_GROUPS = [
  { id: 1, name: 'Innovation G', code: 'INNOVATION_G' },
  { id: 2, name: 'Management Support G', code: 'MGMT_SUPPORT_G' },
  { id: 3, name: 'Utility & EHS G', code: 'UTILITY_EHS_G' },
  { id: 4, name: 'People G', code: 'PEOPLE_G' },
  { id: 5, name: 'Main Production G', code: 'MAIN_PROD_G' },
  { id: 6, name: 'SMD Production G', code: 'SMD_PROD_G' },
  { id: 7, name: 'CS G', code: 'CS_G' },
  { id: 8, name: 'PURCHASING G', code: 'PURCHASING_G' },
  { id: 9, name: 'BUSINESS SUPPORT G', code: 'BIZ_SUPPORT_G' },
  { id: 10, name: 'PE G', code: 'PE_G' },
  { id: 11, name: 'ME G', code: 'ME_G' },
  { id: 12, name: 'PRODUCTION CONTROL G', code: 'PROD_CONTROL_G' },
  { id: 13, name: 'Driver G', code: 'DRV' },
];

const QUICK_CORPORATE_POIS = [
  { label: '🏭 Plant 1 (Sunter)', name: 'Manufacturing Plant 1', address: 'Jl. Danau Sunter Barat No. 8, Sunter Jaya, Jakarta Utara', lat: -6.13842, lon: 106.88561 },
  { label: '🏭 Plant 2 (Karawang)', name: 'Manufacturing Plant 2', address: 'Kawasan Industri KIIC Lot A-1, Telukjambe Timur, Karawang Barat', lat: -6.34789, lon: 107.28912 },
  { label: '🚛 Central Pool', name: 'Central Fleet Pool & Operations Base', address: 'Jl. Rawa Gelam IV No. 2, Kawasan Industri Pulogadung, Jakarta Timur', lat: -6.19834, lon: 106.88873 },
  { label: '🏢 SCBD Head Office', name: 'Head Office - SCBD District 8', address: 'District 8 SCBD, Treasury Tower Lt. 35, Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan', lat: -6.22728, lon: 106.80816 },
  { label: '✈️ Soekarno-Hatta (CGK)', name: 'Bandara Internasional Soekarno-Hatta (CGK) - Terminal 3', address: 'Bandara Soekarno-Hatta Terminal 3 Ultimate, Benda, Kota Tangerang', lat: -6.12556, lon: 106.65589 },
  { label: '🚄 Whoosh Halim (KCIC)', name: 'Stasiun Kereta Cepat Whoosh Halim (KCIC)', address: 'Jl. Akses Stasiun Kereta Cepat Halim, Makasar, Jakarta Timur', lat: -6.24876, lon: 106.88765 },
  { label: '🏬 Cikarang Hub', name: 'Cikarang Assembly Plant', address: 'Greenland International Industrial Center (GIIC), Deltamas, Cikarang Pusat', lat: -6.37521, lon: 107.16834 },
];

type BookingStep = 'HOME' | 'ROUTE' | 'VEHICLE' | 'SUMMARY' | 'WAITING' | 'IN_TRIP' | 'SCHEDULE_VIEW';

function highlightQueryMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q || q.length < 2) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <span style={{ color: '#0072de', fontWeight: 800 }}>{match}</span>
      {after}
    </>
  );
}

function getWhatsAppUrl(phone: string, text?: string): string {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (!clean.startsWith('62')) {
    clean = '62' + clean;
  }
  const baseUrl = `https://wa.me/+${clean}`;
  return text ? `${baseUrl}?text=${encodeURIComponent(text)}` : baseUrl;
}

export const FLEET_HELPDESK_WHATSAPP_URL = 'https://wa.me/6281381016286';
export const FLEET_HELPDESK_PIC_LABEL = 'Riza (+62 813-8101-6286)';

export function getTimeGreeting(): string {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good morning';
  if (hr < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatIdr(amount: number | string | undefined | null): string {
  const num = Number(amount || 0);
  return `Rp ${Math.round(num).toLocaleString('id-ID')}`;
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatReservationModeLabel(reservationType?: string | null, returnPickupTime?: string | null): string | null {
  const mode = String(reservationType || 'ONE_WAY').toUpperCase();
  if (mode === 'FULL_DAY') return 'Full Day';
  if (mode === 'DROP_AND_PICKUP') {
    const rp = returnPickupTime
      ? ` • Pick-Up ${new Date(returnPickupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : '';
    return `Drop & Pick Up${rp}`;
  }
  return null;
}

export function computeTripDurationMinutes(t: any): number {
  if (!t) return 0;
  const startTime = t.actual_start_time || t.start_odometer_time || t.start_time;
  const endTime = t.actual_end_time || t.end_odometer_time || t.end_time;
  if (!startTime || !endTime) return 0;
  const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  if (diffMs <= 0) return 0;
  return Math.max(1, Math.round(diffMs / 60000));
}

export function formatDurationHuman(totalMinutes: number, lang: SupportedLang = 'id'): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (lang === 'en') {
    if (hours === 0) return `${mins} mins`;
    if (mins === 0) return `${hours} hrs`;
    return `${hours} hrs ${mins} mins`;
  }
  if (lang === 'ko') {
    if (hours === 0) return `${mins}분`;
    if (mins === 0) return `${hours}시간`;
    return `${hours}시간 ${mins}분`;
  }
  if (hours === 0) return `${mins} menit`;
  if (mins === 0) return `${hours} jam`;
  return `${hours} jam ${mins} menit`;
}

function roundUpTo5MinMs(ms: number): number {
  return Math.ceil(ms / 300000) * 300000;
}

function getSlotWindow(dateOrIso: string | Date): string {
  try {
    const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (Number.isNaN(d.getTime())) return '08:00 - 08:05';
    const pad = (n: number) => String(n).padStart(2, '0');
    const h1 = pad(d.getHours());
    const m1 = pad(d.getMinutes());
    const end = new Date(d.getTime() + 5 * 60000);
    const h2 = pad(end.getHours());
    const m2 = pad(end.getMinutes());
    return `${h1}:${m1} - ${h2}:${m2}`;
  } catch {
    return '08:00 - 08:05';
  }
}

function getScheduleSlotBrief(isoOrDateStr: string, targetLang?: SupportedLang): string {
  try {
    const d = new Date(isoOrDateStr);
    if (Number.isNaN(d.getTime())) return 'Jadwal khusus';
    const lang = targetLang || 'id';
    const locale = lang === 'en' ? 'en-US' : lang === 'ko' ? 'ko-KR' : 'id-ID';
    const dayName = d.toLocaleDateString(locale, { weekday: 'short' });
    const dateNum = d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const slot = getSlotWindow(d);
    return `${dayName}, ${dateNum} at ${slot}`;
  } catch {
    return 'Jadwal khusus';
  }
}

function getScheduleSlotDisplay(isoOrDateStr: string, targetLang?: SupportedLang): string {
  try {
    const d = new Date(isoOrDateStr);
    if (Number.isNaN(d.getTime())) return 'Jadwal khusus';
    const lang = targetLang || 'id';
    const locale = lang === 'en' ? 'en-US' : lang === 'ko' ? 'ko-KR' : 'id-ID';
    const dayName = d.toLocaleDateString(locale, { weekday: 'long' });
    const dateNum = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
    const slot = getSlotWindow(d);
    return `${dayName}, ${dateNum} • ${slot}`;
  } catch {
    return 'Jadwal khusus';
  }
}

function formatPassengersDisplay(passengersJson?: string | null, passengerNickname?: string | null): string {
  if (passengersJson) {
    try {
      const parsed = JSON.parse(passengersJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p: any, idx: number) => `${idx + 1}. ${p.nickname || p.name || p}`).join(', ');
      }
    } catch {}
  }
  return passengerNickname || 'Team';
}

function formatPassengersMultiLine(passengersJson?: string | null, passengerNickname?: string | null): string {
  if (passengersJson) {
    try {
      const parsed = JSON.parse(passengersJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p: any, idx: number) => `${idx + 1}. ${p.nickname || p.name || p}`).join('\n');
      }
    } catch {}
  }
  return passengerNickname || 'Team';
}

export function playNotificationChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // Harmonic crystalline dual chime (Note 1: E6 1318.51Hz, Note 2: B6 1975.53Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.51, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1975.53, now + 0.08);
    gain2.gain.setValueAtTime(0.2, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.6);
  } catch {
    // AudioContext blocked or unsupported in environment
  }
}

export function App() {
  const { lang, t } = useAppLanguage();

  useEffect(() => {
    startDomTranslationObserver();
  }, []);

  const [user, setUser] = useState<any | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState<string>('');
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  // Official Company Groups (13 Groups)
  const [groupsList, setGroupsList] = useState<Array<{ id: number; name: string; code?: string; is_active?: number }>>(FALLBACK_GROUPS);
  const activeGroups = useMemo(() => groupsList.filter((g) => g.is_active !== 0), [groupsList]);
  const driverGroupId = useMemo(() => {
    const pool = activeGroups.length > 0 ? activeGroups : groupsList;
    return pool.find((g) => ['DRV', 'DRIVER', 'DRIVER_G'].includes(String(g.code || '').toUpperCase()) || /driver/i.test(g.name))?.id || pool[0]?.id || 1;
  }, [activeGroups, groupsList]);

  // Theme preference (Light / Dark / System via tokens)
  const [themePref, setThemePref] = useState<'system' | 'light' | 'dark'>(() => {
    const saved = localStorage.getItem('gf_theme_pref');
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (themePref === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', themePref);
    }
    localStorage.setItem('gf_theme_pref', themePref);
  }, [themePref]);

  // Auth screen state (Pure Login vs Registration — Revision #2)
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regNickname, setRegNickname] = useState('');
  const [regDeptId, setRegDeptId] = useState(1);
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'EMP' | 'DRV'>('EMP');
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // PWA Install & Push Notification state (Revision #5)
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [pushSubscribed, setPushSubscribed] = useState<boolean>(false);
  const [showInstallGuideModal, setShowInstallGuideModal] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationPromptBanner, setShowNotificationPromptBanner] = useState<boolean>(false);

  // Navigation & Presentation State
  const [navSection, setNavSection] = useState<NavSection>('HOME');
  const [bookingStep, setBookingStep] = useState<BookingStep>('HOME');
  const [sheetSnap, setSheetSnap] = useState<SnapPoint>('full');
  const [adminModule, setAdminModule] = useState<AdminModule>('FLEET_MAP');
  const [fleetPositions, setFleetPositions] = useState<FleetVehiclePosition[]>([]);
  const [driverSearchQuery, setDriverSearchQuery] = useState<string>('');
  const [focusedVehicleId, setFocusedVehicleId] = useState<number | null>(null);
  const [fleetFilterMode, setFleetFilterMode] = useState<'ALL' | 'DRIVING' | 'GASOLINE' | 'ELECTRIC'>('ALL');
  const [showExecutiveReportModal, setShowExecutiveReportModal] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetMode, setResetMode] = useState<'OPERATIONS_ONLY' | 'FACTORY_RESET'>('OPERATIONS_ONLY');
  const [resetConfirmCode, setResetConfirmCode] = useState<string>('');
  const [resetVehicleOdometers, setResetVehicleOdometers] = useState<Record<number, string>>({});
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');
  const [startOdoPhoto, setStartOdoPhoto] = useState<Record<number, string>>({});
  const [startOdoTime, setStartOdoTime] = useState<Record<number, string>>({});
  const [endOdoPhoto, setEndOdoPhoto] = useState<Record<number, string>>({});
  const [endOdoTime, setEndOdoTime] = useState<Record<number, string>>({});
  const [statusBanner, setStatusBanner] = useState<{ type: 'info' | 'success' | 'warning' | 'danger'; text: string } | null>(null);

  // Profile modal and password change states
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [profileNickname, setProfileNickname] = useState<string>('');
  const [profileContactNumber, setProfileContactNumber] = useState<string>('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profileDepartmentId, setProfileDepartmentId] = useState<number>(1);
  const [profileTab, setProfileTab] = useState<'DETAILS' | 'PASSWORD'>('DETAILS');
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [profileSaving, setProfileSaving] = useState<boolean>(false);
  const [profileStatusBanner, setProfileStatusBanner] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  // Home / Route / Ride / Activity sub-states
  const [routeTab, setRouteTab] = useState<'RECENT' | 'SAVED' | 'PIN' | 'PICKUP'>('RECENT');
  const [selectedPickupSpot, setSelectedPickupSpot] = useState<'A' | 'B' | 'C'>('A');
  const [activeRouteField, setActiveRouteField] = useState<'pickup' | 'destination'>('destination');
  const [scheduleMode, setScheduleMode] = useState<'NOW' | 'SCHEDULE'>('NOW');
  const [showSchedulePicker, setShowSchedulePicker] = useState<boolean>(false);
  const [schedulePickerTab, setSchedulePickerTab] = useState<'TODAY' | 'TOMORROW' | 'DATE'>('TODAY');
  const [multiStopToast, setMultiStopToast] = useState<string | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState<'ALL' | 'Electric' | 'MPV'>('ALL');
  const [activityTab, setActivityTab] = useState<'ONGOING' | 'HISTORY'>('ONGOING');
  const [summaryPicker, setSummaryPicker] = useState<'PURPOSE' | 'PAX' | 'NOTES' | 'CHARGE' | null>(null);
  const [pickerValidationError, setPickerValidationError] = useState<string | null>(null);
  const [focusedTripId, setFocusedTripId] = useState<number | null>(null);
  const [driverSectionTab, setDriverSectionTab] = useState<'DISPATCH' | 'SCHEDULE'>('DISPATCH');
  const [customerHomeMode, setCustomerHomeMode] = useState<'SUPER_APP' | 'GOCAR_LANDING'>('SUPER_APP');
  const [driverTripLogTab, setDriverTripLogTab] = useState<'TRIPS' | 'EXPENSES'>('TRIPS');
  const [driverActivatingToast, setDriverActivatingToast] = useState<string | null>(null);

  // Live MapTiler Geocoding, User Location Detection, Route Calculation & All-User Pinpoint Dots
  const [originCoords, setOriginCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [destCoords, setDestCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [calculatedRoute, setCalculatedRoute] = useState<RouteCalculationResult | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState<boolean>(false);
  const [myCoords, setMyCoords] = useState<{ lat: number; lon: number; accuracy?: number } | null>(null);
  const [userPins, setUserPins] = useState<UserLocationPin[]>([]);
  const [locatingUser, setLocatingUser] = useState<boolean>(false);
  const [locationPermissionVerified, setLocationPermissionVerified] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('gf_loc_verified') === '1';
    } catch {
      return false;
    }
  });
  const [showLocationPermissionModal, setShowLocationPermissionModal] = useState<boolean>(false);
  const [pendingBookingAction, setPendingBookingAction] = useState<(() => void) | null>(null);
  const [geoResults, setGeoResults] = useState<GeoPlace[]>([]);
  const [geoLoading, setGeoLoading] = useState<boolean>(false);
  const [savedPlaces, setSavedPlaces] = useState<GeoPlace[]>(() => {
    try {
      const raw = localStorage.getItem('gf_saved_places');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const toggleSavePlace = (place: GeoPlace) => {
    setSavedPlaces((prev) => {
      const exists = prev.some((p) => p.name === place.name && p.address === place.address);
      const next = exists ? prev.filter((p) => !(p.name === place.name && p.address === place.address)) : [place, ...prev];
      localStorage.setItem('gf_saved_places', JSON.stringify(next));
      return next;
    });
  };

  // Core Application Data
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [evRecords, setEvRecords] = useState<any[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [_gpsLatest, setGpsLatest] = useState<any>(null);
  const [usageAnalytics, setUsageAnalytics] = useState<any>(null);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);

  // Booking Form State
  const defaultStartMs = roundUpTo5MinMs(Date.now() + 2 * 3600000);
  const defaultStart = toLocalDateTimeInput(new Date(defaultStartMs));
  const defaultEnd = toLocalDateTimeInput(new Date(defaultStartMs + 2 * 3600000));
  const [bookPurpose, setBookPurpose] = useState('');
  const [bookPassengerNickname, setBookPassengerNickname] = useState('');
  const [bookPassengers, setBookPassengers] = useState<Array<{ id: number; nickname: string }>>([
    { id: 1, nickname: '' },
  ]);
  const [bookOrigin, setBookOrigin] = useState('');
  const [bookDest, setBookDest] = useState('');
  const [bookStart, setBookStart] = useState(defaultStart);
  const [bookEnd, setBookEnd] = useState(defaultEnd);
  const [bookReservationType, setBookReservationType] = useState<'ONE_WAY' | 'DROP_AND_PICKUP' | 'FULL_DAY'>('ONE_WAY');
  const [bookReturnPickupTime, setBookReturnPickupTime] = useState<string>(() =>
    toLocalDateTimeInput(new Date(defaultStartMs + 3 * 3600000))
  );
  const [bookVehicleId, setBookVehicleId] = useState<number>(0);
  const [bookDriverId, setBookDriverId] = useState<string>('');
  const [bookPax, setBookPax] = useState<number>(1);
  const [bookNotes, setBookNotes] = useState('');
  const [bookUrgentReason, setBookUrgentReason] = useState<string>('');
  const [bookDurationHours, setBookDurationHours] = useState<number>(2);
  const [liveAvailability, setLiveAvailability] = useState<{ vehicles: any[]; drivers: any[] } | null>(null);
  const [scheduleFilterTab, setScheduleFilterTab] = useState<'ALL' | 'AVAILABLE' | 'BOOKED'>('ALL');

  // Driver Expense Reimbursement State
  const [showDriverExpenseModal, setShowDriverExpenseModal] = useState<boolean>(false);
  const [driverExpenseForm, setDriverExpenseForm] = useState({
    vehicle_id: 0,
    category: 'Toll',
    amount: '',
    description: '',
    receipt_name: '',
    receipt_base64: '',
    receipt_data_url: '',
    receipt_mime_type: '',
    receipt_size_bytes: 0,
  });
  const [viewingReceiptModal, setViewingReceiptModal] = useState<{
    url: string;
    title: string;
    filename?: string;
    mimeType?: string;
  } | null>(null);

  // Admin Modals & Creation State
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [vehicleDetail360, setVehicleDetail360] = useState<any | null>(null);
  const [dispatchModalTrip, setDispatchModalTrip] = useState<any | null>(null);
  const [dispatchVehicleId, setDispatchVehicleId] = useState<number>(0);
  const [dispatchDriverId, setDispatchDriverId] = useState<string>('');
  const [dispatchDecisionReason, setDispatchDecisionReason] = useState('');
  const [pendingRoleSelections, setPendingRoleSelections] = useState<Record<number, string>>({});
  const [pendingGroupSelections, setPendingGroupSelections] = useState<Record<number, number>>({});
  const [userFilterTab, setUserFilterTab] = useState<'ALL' | 'PENDING' | 'DRIVERS' | 'INACTIVE'>('ALL');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');

  // Admin New Vehicle Form
  const [newVehicleForm, setNewVehicleForm] = useState({
    registration_plate: '',
    make: '',
    model: '',
    car_type: 'MPV',
    year: String(new Date().getFullYear()),
    vin: '',
    energy_type: 'Gasoline' as 'Gasoline' | 'Electric',
    seats: '7',
    current_odometer: '0',
    battery_percent: '100',
    last_parking_spot: '',
    default_driver_id: '',
  });

  const [newDriverForm, setNewDriverForm] = useState({
    user_id: '',
    full_name: '',
    department_id: 13,
    licence_number: '',
    licence_class: 'A',
    licence_expiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    contact_number: '',
    availability_status: 'Active',
    photo_url: '',
  });

  // Admin Direct User Creation Form
  const [newUserForm, setNewUserForm] = useState({
    nickname: '',
    group_username: '',
    password: '',
    role: 'EMP',
    department_id: 1,
  });

  // Admin New Group Form
  const [newGroupName, setNewGroupName] = useState('');

  // Driver PWA GPS & Trip Action State
  const [gpsNoticeAccepted, setGpsNoticeAccepted] = useState<boolean>(false);
  const [gpsReportingActive, setGpsReportingActive] = useState<boolean>(false);
  const [gpsPermissionState, setGpsPermissionState] = useState<'GRANTED' | 'DENIED' | 'UNAVAILABLE'>('GRANTED');
  const [lastDriverGpsReport, setLastDriverGpsReport] = useState<any | null>(null);
  const [activeTripOdoInput, setActiveTripOdoInput] = useState<Record<number, string>>({});
  const [activeTripBatteryInput, setActiveTripBatteryInput] = useState<Record<number, string>>({});
  const [activeTripParkingInput, setActiveTripParkingInput] = useState<Record<number, string>>({});

  // Fleet Ops Sub-forms State
  const [opsSubTab, setOpsSubTab] = useState<'VEHICLES' | 'DRIVERS' | 'GROUPS' | 'FUEL_EV' | 'MAINTENANCE' | 'EXPENSES' | 'DOCUMENTS'>('VEHICLES');
  const [fuelForm, setFuelForm] = useState({ vehicle_id: 0, litres: '', cost: '', odometer_km: '', station: '', override_reason: '' });
  const [evForm, setEvForm] = useState({ vehicle_id: 0, kwh_added: '', cost: '', battery_start_pct: '20', battery_end_pct: '85', odometer_km: '', station: '' });
  const [maintForm, setMaintForm] = useState({
    vehicle_id: 0,
    maintenance_type: 'Periodic Service',
    applicable_energy_type: 'Both',
    service_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16),
    end_date: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 16),
    provider: '',
    cost: '',
    blocks_availability: true,
  });
  const [expForm, setExpForm] = useState({ vehicle_id: 0, category: 'Toll', amount: '', description: '' });
  const [docForm, setDocForm] = useState({ entity_type: 'VEHICLE', entity_id: 0, doc_type: 'Insurance', file_name: 'policy.pdf', expiry_date: '2027-12-31' });
  const [usagePeriod, setUsagePeriod] = useState<'day' | 'week' | 'month' | 'overall'>('month');

  const isPrivileged = user && ['ADM', 'FM', 'HWS'].includes(user.role);
  const isDriverOnly = Boolean(user && user.role === 'DRV' && !isPrivileged);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Load public groups for registration dropdown
    apiRequest('/api/public/groups')
      .then((res) => {
        if (Array.isArray(res.groups) && res.groups.length > 0) {
          setGroupsList(res.groups);
          setRegDeptId((prev) => (res.groups.some((g: any) => g.id === prev) ? prev : res.groups[0].id));
          const drvGrp = res.groups.find((g: any) => ['DRV', 'DRIVER', 'DRIVER_G'].includes(String(g.code || '').toUpperCase()) || /driver/i.test(g.name));
          if (drvGrp) {
            setNewDriverForm((prev) => (!prev.user_id && !prev.full_name ? { ...prev, department_id: drvGrp.id } : prev));
          }
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const loadAllData = useCallback(async (currentUser: any) => {
    setLoadingData(true);
    setDataError(null);
    try {
      const [vehRes, drvRes, trpRes, bkgRes, ntfRes, deptRes, pinRes] = await Promise.all([
        apiRequest('/api/vehicles'),
        apiRequest('/api/drivers'),
        apiRequest('/api/trips'),
        apiRequest('/api/bookings'),
        apiRequest('/api/notifications'),
        apiRequest('/api/departments'),
        apiRequest('/api/location/pins').catch(() => ({ pins: [] })),
      ]);
      const loadedVehicles = vehRes.vehicles || [];
      setVehicles(loadedVehicles);
      setDrivers(drvRes.drivers || []);
      setTrips(trpRes.trips || []);
      setBookings(bkgRes.bookings || []);
      setNotifications(ntfRes.notifications || []);
      setUserPins(pinRes.pins || []);
      if (Array.isArray(deptRes.departments) && deptRes.departments.length > 0) {
        setGroupsList(deptRes.departments);
        const drvGrp = deptRes.departments.find((g: any) => ['DRV', 'DRIVER', 'DRIVER_G'].includes(String(g.code || '').toUpperCase()) || /driver/i.test(g.name));
        if (drvGrp) {
          setNewDriverForm((prev) => (!prev.user_id && !prev.full_name ? { ...prev, department_id: drvGrp.id } : prev));
        }
      }
      setIsOffline(false);

      // Default sub-form vehicle IDs when vehicles exist
      if (loadedVehicles.length > 0) {
        const firstId = loadedVehicles[0].id;
        const firstEv = loadedVehicles.find((v: any) => v.energy_type === 'Electric')?.id || firstId;
        setFuelForm((prev) => ({ ...prev, vehicle_id: prev.vehicle_id || firstId }));
        setEvForm((prev) => ({ ...prev, vehicle_id: prev.vehicle_id || firstEv }));
        setMaintForm((prev) => ({ ...prev, vehicle_id: prev.vehicle_id || firstId }));
        setExpForm((prev) => ({ ...prev, vehicle_id: prev.vehicle_id || firstId }));
        setDocForm((prev) => ({ ...prev, entity_id: prev.entity_id || firstId }));
      }

      if (['DRV', 'ADM', 'FM'].includes(currentUser.role)) {
        const dspRes = await apiRequest('/api/driver/dispatches');
        setDispatches(dspRes.dispatches || []);
      }

      const [fuelRes, evRes, mntRes, expRes, docRes] = await Promise.all([
        apiRequest('/api/fuel'),
        apiRequest('/api/ev-charging'),
        apiRequest('/api/maintenance'),
        apiRequest('/api/expenses'),
        apiRequest('/api/documents'),
      ]);
      setFuelRecords(fuelRes.fuelRecords || []);
      setEvRecords(evRes.evRecords || []);
      setMaintenanceRecords(mntRes.maintenanceRecords || []);
      setExpenses(expRes.expenses || []);
      setDocuments(docRes.documents || []);

      if (['ADM', 'FM', 'HWS'].includes(currentUser.role)) {
        const [usrRes, gpsRes, anaRes, audRes, fleetRes] = await Promise.all([
          apiRequest('/api/users'),
          apiRequest('/api/gps/latest'),
          apiRequest('/api/analytics/usage'),
          apiRequest('/api/audit'),
          apiRequest('/api/admin/fleet-map-positions'),
        ]);
        setUsersList(usrRes.users || []);
        setGpsLatest(gpsRes);
        setUsageAnalytics(anaRes);
        setAuditEvents(audRes.auditEvents || []);
        setFleetPositions(fleetRes.fleetPositions || []);
      }
    } catch (err: any) {
      console.error('Failed loading dashboard data:', err);
      setDataError(err.message || 'Unable to load live fleet data.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Check existing session on mount
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoadingAuth(false);
      return;
    }
    apiRequest('/api/auth/me')
      .then((res) => {
        setUser(res.user);
        setVapidPublicKey(res.vapidPublicKey || '');
        if (res.user.role === 'DRV') {
          setNavSection('DRIVER');
          setSheetSnap('half');
        } else if (['ADM', 'FM', 'HWS'].includes(res.user.role)) {
          setNavSection('ADMIN');
          setAdminModule('ADMIN_DISPATCH');
        } else {
          setNavSection('HOME');
          setBookingStep('HOME');
        }
        return loadAllData(res.user);
      })
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => setLoadingAuth(false));
  }, [loadAllData]);

  // Live MapTiler / Nominatim / Photon / Indonesian POI address search when typing in RouteFields
  useEffect(() => {
    if (bookingStep !== 'ROUTE' || routeTab === 'PIN') return;
    const queryText = (activeRouteField === 'pickup' ? bookOrigin : bookDest).trim();
    if (queryText.length < 2) {
      setGeoResults([]);
      setGeoLoading(false);
      return;
    }
    let cancelled = false;
    setGeoLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiRequest(`/api/geocode/search?q=${encodeURIComponent(queryText)}`);
        if (cancelled) return;
        const items: GeoPlace[] = res.results || [];
        setGeoResults(items);
        // Automatically resolve coordinates for typed addresses so route path & ETA calculate immediately
        if (items.length > 0 && Number.isFinite(items[0].lat) && Number.isFinite(items[0].lon)) {
          if (activeRouteField === 'pickup') {
            setOriginCoords({ lat: items[0].lat, lon: items[0].lon });
          } else if (activeRouteField === 'destination') {
            setDestCoords({ lat: items[0].lat, lon: items[0].lon });
          }
        }
      } catch {
        if (!cancelled) setGeoResults([]);
      } finally {
        if (!cancelled) setGeoLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bookingStep, routeTab, activeRouteField, bookOrigin, bookDest]);

  // Calculate real road route path, distance (km), ride time (min), and arrival ETA whenever pickup & destination are set
  useEffect(() => {
    if (!user || !bookOrigin.trim() || !bookDest.trim()) {
      setCalculatedRoute(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setCalculatingRoute(true);
      try {
        let resolvedOrig = originCoords || (myCoords ? { lat: myCoords.lat, lon: myCoords.lon } : null);
        let resolvedDest = destCoords;

        if (!resolvedOrig && bookOrigin.trim().length >= 2) {
          const g1 = await apiRequest(`/api/geocode/search?q=${encodeURIComponent(bookOrigin.trim())}`).catch(() => null);
          if (g1?.results?.[0]) {
            resolvedOrig = { lat: Number(g1.results[0].lat), lon: Number(g1.results[0].lon) };
            if (!cancelled) setOriginCoords(resolvedOrig);
          }
        }
        if (!resolvedDest && bookDest.trim().length >= 2) {
          const g2 = await apiRequest(`/api/geocode/search?q=${encodeURIComponent(bookDest.trim())}`).catch(() => null);
          if (g2?.results?.[0]) {
            resolvedDest = { lat: Number(g2.results[0].lat), lon: Number(g2.results[0].lon) };
            if (!cancelled) setDestCoords(resolvedDest);
          }
        }

        const origLat = resolvedOrig?.lat ?? -6.19834;
        const origLon = resolvedOrig?.lon ?? 106.88873;
        const dstLat = resolvedDest?.lat ?? origLat - 0.018;
        const dstLon = resolvedDest?.lon ?? origLon + 0.022;
        const depTime = scheduleMode === 'SCHEDULE' && bookStart ? new Date(bookStart).toISOString() : new Date().toISOString();

        const routeRes = await apiRequest(
          `/api/route?originLat=${encodeURIComponent(origLat)}&originLon=${encodeURIComponent(origLon)}&destLat=${encodeURIComponent(dstLat)}&destLon=${encodeURIComponent(dstLon)}&departureTime=${encodeURIComponent(depTime)}`
        );

        if (!cancelled && routeRes) {
          const etaDate = routeRes.etaIso ? new Date(routeRes.etaIso) : new Date(Date.now() + Number(routeRes.durationMin || 10) * 60_000);
          setCalculatedRoute({
            distanceKm: Number(routeRes.distanceKm || 0),
            durationMin: Number(routeRes.durationMin || 0),
            etaIso: routeRes.etaIso,
            etaText: etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            geometry: Array.isArray(routeRes.geometry) ? routeRes.geometry : undefined,
          });
        }
      } catch {
        // Fallback handled by estimateRouteMetrics
      } finally {
        if (!cancelled) setCalculatingRoute(false);
      }
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user, bookOrigin, bookDest, originCoords, destCoords, myCoords, scheduleMode, bookStart]);

  // Live availability check when schedule dates change
  useEffect(() => {
    if (!user || !bookStart || !bookEnd) return;
    const sDate = new Date(bookStart);
    const eDate = new Date(bookEnd);
    if (Number.isNaN(sDate.getTime()) || Number.isNaN(eDate.getTime()) || eDate <= sDate) return;
    apiRequest(`/api/availability?start_time=${encodeURIComponent(sDate.toISOString())}&end_time=${encodeURIComponent(eDate.toISOString())}`)
      .then((res) => setLiveAvailability(res))
      .catch(() => {});
  }, [user, bookStart, bookEnd, scheduleMode, trips, bookings, vehicles]);

  // Periodic 20-Minute GPS Reporting + Screen WakeLock for Driver PWA
  const sendDriverLocationReport = useCallback(
    async (explicitState?: 'GRANTED' | 'DENIED' | 'UNAVAILABLE') => {
      if (!user) return;
      const targetState = explicitState || gpsPermissionState;

      if (targetState !== 'GRANTED') {
        const res = await apiRequest('/api/gps/report', {
          method: 'POST',
          body: JSON.stringify({
            permission_state: targetState,
            capture_time: new Date().toISOString(),
            phone_state: document.visibilityState === 'visible' ? 'FOREGROUND' : 'BACKGROUND',
          }),
        });
        setLastDriverGpsReport(res.report);
        return;
      }

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const res = await apiRequest('/api/gps/report', {
              method: 'POST',
              body: JSON.stringify({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy_meters: Math.round(pos.coords.accuracy),
                capture_time: new Date(pos.timestamp).toISOString(),
                permission_state: 'GRANTED',
                phone_state: document.visibilityState === 'visible' ? 'FOREGROUND' : 'BACKGROUND',
              }),
            });
            setLastDriverGpsReport(res.report);
            setGpsPermissionState('GRANTED');
          },
          async () => {
            const res = await apiRequest('/api/gps/report', {
              method: 'POST',
              body: JSON.stringify({
                permission_state: 'UNAVAILABLE',
                capture_time: new Date().toISOString(),
                phone_state: document.visibilityState === 'visible' ? 'FOREGROUND' : 'BACKGROUND',
              }),
            });
            setLastDriverGpsReport(res.report);
          },
          { enableHighAccuracy: true, timeout: 6000 }
        );
      }
    },
    [user, gpsPermissionState]
  );

  useEffect(() => {
    if (!gpsReportingActive || !gpsNoticeAccepted) return;
    let wakeLock: any = null;
    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock
        .request('screen')
        .then((wl: any) => {
          wakeLock = wl;
        })
        .catch(() => {});
    }

    sendDriverLocationReport('GRANTED');
    const intervalId = window.setInterval(() => {
      sendDriverLocationReport('GRANTED');
    }, 20 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
      if (wakeLock && wakeLock.release) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [gpsReportingActive, gpsNoticeAccepted, sendDriverLocationReport]);

  // Handlers: Login, Registration & Sign Out
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage(null);
    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ group_username: loginUsername, password: loginPassword }),
      });
      setStoredToken(res.token);
      setUser(res.user);
      setVapidPublicKey(res.vapidPublicKey || '');
      if (res.user.role === 'DRV') {
        setNavSection('DRIVER');
        setSheetSnap('half');
      } else if (['ADM', 'FM', 'HWS'].includes(res.user.role)) {
        setNavSection('ADMIN');
        setAdminModule('ADMIN_DISPATCH');
      } else {
        setNavSection('HOME');
        setBookingStep('HOME');
      }
      await loadAllData(res.user);
    } catch (err: any) {
      setAuthMessage({ type: 'error', text: err.message });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage(null);
    try {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          nickname: regNickname,
          department_id: regDeptId,
          group_username: regUsername,
          password: regPassword,
          requested_role: regRole,
        }),
      });
      setAuthMessage({
        type: 'success',
        text: res.message || 'Account registered! Waiting for Administrator approval before you can sign in.',
      });
      setRegNickname('');
      setRegUsername('');
      setRegPassword('');
      setAuthMode('LOGIN');
    } catch (err: any) {
      setAuthMessage({ type: 'error', text: err.message });
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
    setStatusBanner(null);
  };

  const handleInstallPwa = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
    } else {
      setShowInstallGuideModal(true);
    }
  };

  const handleEnablePushNotifications = async (silent: boolean | React.SyntheticEvent = false) => {
    if (!user) return;
    const isSilent = silent === true;
    try {
      if ('Notification' in window) {
        let perm = Notification.permission;
        if (perm !== 'granted') {
          perm = await Notification.requestPermission();
        }
        if (perm === 'granted') {
          setShowNotificationPromptBanner(false);
          if ('serviceWorker' in navigator && vapidPublicKey) {
            const reg = await navigator.serviceWorker.ready;
            if (reg.pushManager) {
              const sub = await reg.pushManager
                .subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
                })
                .catch(() => null);

              if (sub) {
                const subJson = sub.toJSON();
                await apiRequest('/api/notifications/subscribe', {
                  method: 'POST',
                  body: JSON.stringify(subJson),
                });
              }
            }
          }
        }
      }

      await apiRequest('/api/notifications/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: `https://push.galaxyfleet.internal/user-${user.id}`,
          keys: { p256dh: 'BOr9_push_p256dh_key', auth: 'push_auth_secret' },
        }),
      });

      setPushSubscribed(true);

      if (!isSilent) {
        await apiRequest('/api/notifications/test', {
          method: 'POST',
          body: JSON.stringify({
            body: `Push notifications enabled for ${user.nickname} (${user.role}). You will receive booking updates, reminders, and dispatch alerts.`,
          }),
        });

        await triggerSystemNotification('GalaxyFleet PWA Push Active', {
          body: 'You will now receive instant booking, reminder, and dispatch notifications.',
        });

        setStatusBanner({
          type: 'success',
          text: 'Push notifications active. Alerts will appear here and on your device.',
        });
        await loadAllData(user);
      }
    } catch (err: any) {
      if (!isSilent) {
        setStatusBanner({ type: 'danger', text: err.message });
      }
    }
  };

  const handleOpenProfileModal = () => {
    if (user) {
      setProfileNickname(user.nickname || '');
      setProfileContactNumber(user.contact_number || '');
      setProfilePhotoUrl(user.photo_url || null);
      setProfileDepartmentId(user.department_id || activeGroups[0]?.id || groupsList[0]?.id || 1);
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setProfileStatusBanner(null);
    setProfileTab('DETAILS');
    setShowProfileModal(true);
  };

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileStatusBanner({ type: 'danger', text: 'Please select an image file (PNG, JPG, SVG).' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setProfilePhotoUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfileDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileNickname.trim() || profileNickname.trim().length < 2) {
      setProfileStatusBanner({ type: 'danger', text: 'Nickname must be at least 2 characters long.' });
      return;
    }
    setProfileSaving(true);
    setProfileStatusBanner(null);
    try {
      const res = await apiRequest('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          nickname: profileNickname.trim(),
          contact_number: profileContactNumber.trim(),
          photo_url: profilePhotoUrl,
          ...(user?.role === 'ADM' && profileDepartmentId ? { department_id: Number(profileDepartmentId) } : {}),
        }),
      });
      if (res.user) {
        setUser((prev: any) => (prev ? { ...prev, ...res.user } : res.user));
      }
      setProfileStatusBanner({ type: 'success', text: 'Profile details saved successfully!' });
      if (user?.role === 'DRV') {
        setDrivers((prev: any[]) =>
          prev.map((d: any) =>
            d.user_id === user.id
              ? {
                  ...d,
                  full_name: profileNickname.trim(),
                  contact_number: profileContactNumber.trim(),
                  photo_url: profilePhotoUrl,
                }
              : d
          )
        );
      }
    } catch (err: any) {
      setProfileStatusBanner({ type: 'danger', text: err.message || 'Failed to update profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setProfileStatusBanner({ type: 'danger', text: 'Current password is required.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setProfileStatusBanner({ type: 'danger', text: 'New password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setProfileStatusBanner({ type: 'danger', text: 'New password and confirmation do not match.' });
      return;
    }
    if (currentPassword === newPassword) {
      setProfileStatusBanner({ type: 'danger', text: 'New password must be different from current password.' });
      return;
    }
    setProfileSaving(true);
    setProfileStatusBanner(null);
    try {
      await apiRequest('/api/user/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setProfileStatusBanner({ type: 'success', text: 'Password successfully changed! Your account is protected.' });
    } catch (err: any) {
      setProfileStatusBanner({ type: 'danger', text: err.message || 'Failed to change password.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const markLocationVerified = useCallback(() => {
    setLocationPermissionVerified(true);
    try {
      sessionStorage.setItem('gf_loc_verified', '1');
    } catch {
      // ignore storage errors
    }
  }, []);

  const detectAndReportUserLocation = useCallback(
    (fillActiveField: boolean = false, onSuccessCallback?: () => void) => {
      if (!user || !('geolocation' in navigator)) {
        if (fillActiveField) {
          setStatusBanner({ type: 'warning', text: 'Geolocation is not supported by your browser. Please search or pin on the map.' });
        }
        if (onSuccessCallback) {
          markLocationVerified();
          onSuccessCallback();
        }
        return;
      }
      setLocatingUser(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const accuracy = Math.round(pos.coords.accuracy || 25);
          setMyCoords({ lat, lon, accuracy });
          markLocationVerified();

          let resolvedLabel = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
          try {
            const rev = await apiRequest(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
            if (rev?.name) {
              resolvedLabel = rev.name;
            }
          } catch {
            // keep coordinate label
          }

          // Auto-fill pickup field if empty, or fill active route field when requested
          if (fillActiveField) {
            if (activeRouteField === 'pickup') {
              setBookOrigin(resolvedLabel);
              setOriginCoords({ lat, lon });
              setActiveRouteField('destination');
            } else {
              setBookDest(resolvedLabel);
              setDestCoords({ lat, lon });
            }
          } else {
            setBookOrigin((prev) => {
              if (!prev.trim()) {
                setOriginCoords({ lat, lon });
                return resolvedLabel;
              }
              return prev;
            });
          }

          // Send user's location to backend so their pinpoint dot appears on the map for all users
          try {
            await apiRequest('/api/location/ping', {
              method: 'POST',
              body: JSON.stringify({
                latitude: lat,
                longitude: lon,
                accuracy_meters: accuracy,
                address_label: resolvedLabel,
              }),
            });
            const pinRes = await apiRequest('/api/location/pins');
            setUserPins(pinRes.pins || []);
          } catch {
            // ignore transient network error
          } finally {
            setLocatingUser(false);
            if (onSuccessCallback) onSuccessCallback();
          }
        },
        () => {
          setLocatingUser(false);
          if (fillActiveField) {
            setStatusBanner({ type: 'warning', text: 'Unable to read GPS position. Type an address or use Pin on map.' });
          }
          if (onSuccessCallback) {
            markLocationVerified();
            onSuccessCallback();
          }
        },
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 15000 }
      );
    },
    [user, activeRouteField, markLocationVerified]
  );

  // Prompt user for Location Permission before using an operational car if not yet granted
  const requireLocationBeforeCarUse = useCallback(
    (nextAction: () => void) => {
      if (locationPermissionVerified || myCoords) {
        nextAction();
        return;
      }
      setPendingBookingAction(() => nextAction);
      setShowLocationPermissionModal(true);
    },
    [locationPermissionVerified, myCoords]
  );

  const handleGrantLocationFromModal = () => {
    const actionToRun = pendingBookingAction;
    setShowLocationPermissionModal(false);
    setPendingBookingAction(null);
    detectAndReportUserLocation(false, () => {
      if (actionToRun) actionToRun();
    });
  };

  // Automatically detect & share user location when logged in, prompt for notifications, and refresh all users' pins periodically
  useEffect(() => {
    if (!user) return;
    detectAndReportUserLocation(false);

    // If user hasn't chosen notification permission yet, proactively prompt them
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        setShowNotificationPromptBanner(true);
      } else if (Notification.permission === 'granted') {
        handleEnablePushNotifications(true);
      }
    }

    const locInterval = window.setInterval(() => {
      detectAndReportUserLocation(false);
    }, 45 * 1000);

    // Fast real-time trip & dispatch status synchronization poller (runs every 4 seconds)
    // Synchronizes booking approvals, driver assignments, trip starts, and completions across requester, driver, and admin
    const syncInterval = window.setInterval(async () => {
      try {
        const [trpRes, bkgRes] = await Promise.all([
          apiRequest('/api/trips'),
          apiRequest('/api/bookings'),
        ]);
        if (Array.isArray(trpRes.trips)) {
          setTrips(trpRes.trips);
        }
        if (Array.isArray(bkgRes.bookings)) {
          setBookings(bkgRes.bookings);
        }
        if (['DRV', 'ADM', 'FM'].includes(user.role)) {
          const dspRes = await apiRequest('/api/driver/dispatches').catch(() => ({ dispatches: [] }));
          if (Array.isArray(dspRes.dispatches)) {
            setDispatches(dspRes.dispatches);
          }
        }
      } catch {}
    }, 4 * 1000);

    // Real-time notification poller (delivers alerts to Driver, User, Admin, Head of WS Part, Fleet Operation PIC)
    const notifInterval = window.setInterval(async () => {
      try {
        const res = await apiRequest('/api/notifications');
        const list = res.notifications || [];
        setNotifications((prev) => {
          const prevIds = new Set(prev.map((n: any) => n.id));
          const newItems = list.filter((n: any) => !prevIds.has(n.id) && !n.is_read);
          if (newItems.length > 0) {
            // Immediately sync trips and bookings when an alert arrives
            apiRequest('/api/trips').then((r) => { if (r.trips) setTrips(r.trips); }).catch(() => {});
            apiRequest('/api/bookings').then((r) => { if (r.bookings) setBookings(r.bookings); }).catch(() => {});
            for (const item of newItems) {
              triggerSystemNotification(item.title, { body: item.body });
            }
          }
          return list;
        });
      } catch {}
    }, 10 * 1000);

    // Real-time Fleet Map GPS positions poller (updates vehicle markers to follow real drivers live)
    let fleetInterval: number | null = null;
    if (['ADM', 'FM', 'HWS'].includes(user.role)) {
      fleetInterval = window.setInterval(async () => {
        try {
          const res = await apiRequest('/api/admin/fleet-map-positions');
          if (res.fleetPositions) {
            setFleetPositions(res.fleetPositions);
          }
        } catch {}
      }, 10 * 1000);
    }

    // Ultra-low latency Real-Time Server-Sent Events (SSE) Stream (< 50ms push)
    let sseSource: EventSource | null = null;
    const authToken = getStoredToken();
    if (authToken && typeof EventSource !== 'undefined') {
      try {
        const streamUrl = `/api/live/stream?token=${encodeURIComponent(authToken)}`;
        sseSource = new EventSource(streamUrl);

        sseSource.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (!payload || !payload.type) return;

            if (
              [
                'TRIP_APPROVED',
                'TRIP_DECISION',
                'TRIP_STAGE_APPROVED',
                'TRIP_REJECTED',
                'TRIP_STARTED',
                'TRIP_COMPLETED',
                'TRIP_ACKNOWLEDGED',
                'TRIP_CREATED',
                'TRIP_RESUBMITTED',
                'TRIP_UPDATED',
              ].includes(payload.type)
            ) {
              const trip = payload.data?.trip;
              if (trip && trip.id) {
                setTrips((prev: any[]) => {
                  const idx = prev.findIndex((t: any) => t.id === trip.id);
                  if (idx >= 0) {
                    const nextList = [...prev];
                    nextList[idx] = { ...nextList[idx], ...trip };
                    return nextList;
                  }
                  return [trip, ...prev];
                });

                if (payload.type === 'TRIP_APPROVED') {
                  playNotificationChime();
                  triggerSystemNotification('Booking Approved & Dispatched!', {
                    body: `Driver ${trip.assigned_driver_name || 'Assigned'} has been dispatched with ${trip.make} ${trip.model} (${trip.registration_plate || 'Company Fleet'}).`,
                  });
                  setStatusBanner({
                    type: 'success',
                    text: `Booking Approved! Driver ${trip.assigned_driver_name || 'Assigned'} has been dispatched with ${trip.make} ${trip.model} (${trip.registration_plate || 'Company Fleet'}).`,
                  });
                } else if (payload.type === 'TRIP_STAGE_APPROVED') {
                  playNotificationChime();
                  const stageDesc =
                    payload.data?.stage === 'AWAITING_HWS'
                      ? 'Approved by Fleet Operation PIC, awaiting Head Of WS Part review.'
                      : 'Approved by Head Of WS Part, awaiting Fleet Operation PIC dispatch.';
                  setStatusBanner({
                    type: 'info',
                    text: `Booking Update: ${stageDesc}`,
                  });
                } else if (payload.type === 'TRIP_REJECTED') {
                  playNotificationChime();
                  const rejReason = trip.decisions?.find((d: any) => d.decision === 'REJECTED')?.reason || 'Booking request rejected';
                  setStatusBanner({
                    type: 'danger',
                    text: `Booking Rejected: ${rejReason}`,
                  });
                }

                // If user is driver or admin, also refresh dispatches immediately
                if (['DRV', 'ADM', 'FM'].includes(user.role)) {
                  apiRequest('/api/driver/dispatches')
                    .then((dsp) => {
                      if (Array.isArray(dsp.dispatches)) setDispatches(dsp.dispatches);
                    })
                    .catch(() => {});
                }
              }
            } else if (payload.type === 'NOTIFICATION') {
              const notif = payload.data;
              if (notif && notif.id) {
                setNotifications((prev: any[]) => {
                  if (prev.some((n: any) => n.id === notif.id)) return prev;
                  return [notif, ...prev];
                });
                playNotificationChime();
                triggerSystemNotification(notif.title, { body: notif.body });
                apiRequest('/api/trips').then((r) => { if (r.trips) setTrips(r.trips); }).catch(() => {});
                apiRequest('/api/bookings').then((r) => { if (r.bookings) setBookings(r.bookings); }).catch(() => {});
              }
            }
          } catch {}
        };
      } catch {}
    }

    return () => {
      if (sseSource) sseSource.close();
      window.clearInterval(locInterval);
      window.clearInterval(syncInterval);
      window.clearInterval(notifInterval);
      if (fleetInterval) window.clearInterval(fleetInterval);
    };
  }, [user]);

  const handleUseCurrentGpsForField = () => {
    detectAndReportUserLocation(true);
  };

  const handleAddStop = () => {
    if (scheduleMode === 'SCHEDULE') {
      setMultiStopToast('Cuma bisa jadwalin ke 1 tujuan');
      setTimeout(() => {
        setMultiStopToast((prev) => (prev === 'Cuma bisa jadwalin ke 1 tujuan' ? null : prev));
      }, 2500);
    } else {
      setStatusBanner({
        type: 'info',
        text: 'Multi-tujuan aktif: Masukkan titik singgah pada rute perjalanan.',
      });
    }
  };

  const dateList: DateOption[] = useMemo(() => {
    const dates: DateOption[] = [];
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const locale = lang === 'en' ? 'en-US' : lang === 'ko' ? 'ko-KR' : 'id-ID';
    dates.push({ id: 'TODAY', label: t('Today'), dateObj: today });
    dates.push({ id: 'TOMORROW', label: t('Tomorrow'), dateObj: tomorrow });

    for (let i = 2; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dayNum = d.getDate();
      const weekday = d.toLocaleDateString(locale, { weekday: 'short' });
      const id = d.toISOString().slice(0, 10);
      dates.push({
        id,
        label: lang === 'ko' ? `${d.getMonth() + 1}/${dayNum} (${weekday})` : `${dayNum} ${weekday}`,
        dateObj: d,
      });
    }
    return dates;
  }, [lang, t]);

  const all5MinSlots = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const slots: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 5) {
        const h1 = pad(h);
        const m1 = pad(m);
        const endM = (m + 5) % 60;
        const endH = m + 5 >= 60 ? (h + 1) % 24 : h;
        slots.push(`${h1}:${m1} - ${pad(endH)}:${pad(endM)}`);
      }
    }
    return slots;
  }, []);

  const selectedDateId = useMemo(() => {
    if (schedulePickerTab === 'TODAY') return 'TODAY';
    if (schedulePickerTab === 'TOMORROW') return 'TOMORROW';
    const d = new Date(bookStart);
    if (Number.isNaN(d.getTime())) return 'TODAY';
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'TODAY';
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return 'TOMORROW';
    return d.toISOString().slice(0, 10);
  }, [bookStart, schedulePickerTab]);

  const selectedTimeSlot = useMemo(() => {
    const d = new Date(bookStart);
    if (Number.isNaN(d.getTime())) return '08:00 - 08:05';
    const snapped = new Date(d);
    snapped.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
    return getSlotWindow(snapped);
  }, [bookStart]);

  const handleSelectSlot = (slotStr: string) => {
    const [startPart] = slotStr.split(' - ');
    const [hStr, mStr] = startPart.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const d = new Date(bookStart);
    if (Number.isNaN(d.getTime())) return;
    d.setHours(h, m, 0, 0);
    const sIso = toLocalDateTimeInput(d);
    setBookStart(sIso);
    const eMs = d.getTime() + bookDurationHours * 3600000;
    setBookEnd(toLocalDateTimeInput(new Date(eMs)));
    if (bookReservationType === 'DROP_AND_PICKUP') {
      setBookReturnPickupTime(toLocalDateTimeInput(new Date(eMs - 1800000)));
    }
  };

  const handleSelectDate = (dateOpt: DateOption) => {
    const curD = new Date(bookStart);
    const targetD = new Date(dateOpt.dateObj);
    if (!Number.isNaN(curD.getTime())) {
      targetD.setHours(curD.getHours(), curD.getMinutes(), 0, 0);
    }
    const sIso = toLocalDateTimeInput(targetD);
    setBookStart(sIso);
    const eMs = targetD.getTime() + bookDurationHours * 3600000;
    setBookEnd(toLocalDateTimeInput(new Date(eMs)));
    if (bookReservationType === 'DROP_AND_PICKUP') {
      setBookReturnPickupTime(toLocalDateTimeInput(new Date(eMs - 1800000)));
    }
    if (dateOpt.id === 'TODAY') {
      setSchedulePickerTab('TODAY');
    } else if (dateOpt.id === 'TOMORROW') {
      setSchedulePickerTab('TOMORROW');
    } else {
      setSchedulePickerTab('DATE');
    }
  };

  const handleDoneSummaryPicker = () => {
    if (summaryPicker === 'PURPOSE') {
      if (!bookPurpose.trim()) {
        setPickerValidationError('Tujuan perjalanan (Purpose) wajib diisi.');
        return;
      }
    } else if (summaryPicker === 'PAX') {
      const emptyIdx = bookPassengers.findIndex((p) => !p.nickname.trim());
      if (bookPassengers.length === 0) {
        setPickerValidationError('Minimal 1 penumpang wajib diisi.');
        return;
      }
      if (emptyIdx >= 0) {
        setPickerValidationError(`Nama panggilan untuk Penumpang ${emptyIdx + 1} wajib diisi.`);
        return;
      }
    }
    setPickerValidationError(null);
    setSummaryPicker(null);
  };

  const handleCreateTripBooking = async () => {
    setStatusBanner(null);
    if (!selectedVehicle) {
      setStatusBanner({ type: 'danger', text: 'Please select an available vehicle first.' });
      return;
    }
    if (!bookOrigin.trim() || !bookDest.trim()) {
      setStatusBanner({ type: 'danger', text: 'Please enter both pickup and destination locations.' });
      return;
    }
    if (!bookStart || !bookEnd) {
      setStatusBanner({ type: 'danger', text: 'Please select both departure and return dates/times.' });
      return;
    }
    const startMs = new Date(bookStart).getTime();
    const endMs = new Date(bookEnd).getTime();
    const nowMs = Date.now();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      setStatusBanner({ type: 'danger', text: 'Please enter valid departure and return dates/times.' });
      return;
    }
    if (startMs < nowMs - 60000) {
      setStatusBanner({ type: 'danger', text: 'Departure time cannot be in the past. Please select an upcoming departure time.' });
      return;
    }
    if (endMs <= startMs) {
      setStatusBanner({ type: 'danger', text: 'Return time must be after departure time.' });
      return;
    }

    let returnPickupIso: string | null = null;
    if (bookReservationType === 'DROP_AND_PICKUP') {
      const rpMs = bookReturnPickupTime ? new Date(bookReturnPickupTime).getTime() : NaN;
      if (!bookReturnPickupTime || Number.isNaN(rpMs)) {
        setStatusBanner({ type: 'danger', text: 'Please select a post-event pick-up time for Drop & Pick Up bookings.' });
        return;
      }
      if (rpMs <= startMs) {
        setStatusBanner({ type: 'danger', text: 'Post-event pick-up time must be after departure time.' });
        return;
      }
      if (endMs < rpMs) {
        setStatusBanner({ type: 'danger', text: 'Final return time must be at or after the post-event pick-up time.' });
        return;
      }
      returnPickupIso = new Date(rpMs).toISOString();
    }

    // 1. Mandatory Purpose Check: Cannot proceed without Purpose
    if (!bookPurpose.trim()) {
      setStatusBanner({
        type: 'danger',
        text: 'Tujuan perjalanan (Purpose) wajib diisi. Silakan pilih atau ketik tujuan perjalanan Anda sebelum memesan.',
      });
      setPickerValidationError('Tujuan perjalanan (Purpose) wajib diisi.');
      setSummaryPicker('PURPOSE');
      return;
    }

    // 2. Mandatory Passenger Check: Cannot proceed without Passenger nickname(s)
    const cleanPassengers = bookPassengers
      .map((p, idx) => ({ id: idx + 1, nickname: p.nickname.trim() }))
      .filter((p) => Boolean(p.nickname));

    if (cleanPassengers.length === 0 || bookPassengers.some((p) => !p.nickname.trim())) {
      const emptyIdx = bookPassengers.findIndex((p) => !p.nickname.trim());
      const paxErr =
        bookPassengers.length === 0 || cleanPassengers.length === 0
          ? 'Data penumpang (Passengers) wajib diisi. Masukkan minimal 1 nama panggilan penumpang.'
          : `Nama panggilan untuk Penumpang ${emptyIdx + 1} wajib diisi.`;
      setStatusBanner({
        type: 'danger',
        text: paxErr,
      });
      setPickerValidationError(paxErr);
      setSummaryPicker('PAX');
      return;
    }

    const leadTimeMin = Math.round((startMs - nowMs) / 60000);
    const isUrgent = leadTimeMin < 120;
    const effectivePurpose = bookPurpose.trim();

    if (isUrgent && !bookUrgentReason.trim() && !bookNotes.trim() && effectivePurpose.length < 5) {
      setStatusBanner({
        type: 'danger',
        text: 'This trip departs in less than 2 hours. Company policy requires an urgent justification for short-notice bookings.',
      });
      return;
    }

    const startIso = new Date(bookStart).toISOString();
    const endIso = new Date(bookEnd).toISOString();

    const formattedPaxNickname =
      cleanPassengers.length > 0
        ? cleanPassengers.map((p) => `${p.id}. ${p.nickname}`).join(', ')
        : bookPassengerNickname.trim();

    try {
      const created = await apiRequest('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          vehicle_id: Number(selectedVehicle.id),
          preferred_driver_id: bookDriverId ? Number(bookDriverId) : null,
          purpose: effectivePurpose,
          origin: bookOrigin.trim(),
          destination: bookDest.trim(),
          start_time: startIso,
          end_time: endIso,
          reservation_type: bookReservationType,
          return_pickup_time: returnPickupIso,
          passenger_count: Math.max(1, cleanPassengers.length || Number(bookPax)),
          passenger_nickname: formattedPaxNickname,
          passengers: cleanPassengers,
          notes: bookNotes,
          is_urgent: isUrgent ? 1 : 0,
          urgent_reason: isUrgent ? (bookUrgentReason.trim() || effectivePurpose) : null,
        }),
      });
      setBookPurpose('');
      setBookPassengerNickname('');
      setBookPassengers([{ id: 1, nickname: '' }]);
      setBookPax(1);
      setBookNotes('');
      setBookUrgentReason('');
      setBookReservationType('ONE_WAY');
      setFocusedTripId(created.tripId);
      setBookingStep('WAITING');
      setSheetSnap('half');
      setStatusBanner({
        type: 'success',
        text: 'Request sent! Vehicle schedule slot locked pending approval.',
      });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleCancelBookingRequest = async (trip: any) => {
    if (!trip?.booking_id) {
      setBookingStep('HOME');
      setSheetSnap('half');
      return;
    }
    try {
      await apiRequest(`/api/bookings/${trip.booking_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'CANCELLED',
          cancellation_reason: 'Cancelled by requester',
        }),
      });
      setFocusedTripId(null);
      setBookingStep('HOME');
      setSheetSnap('half');
      setStatusBanner({ type: 'info', text: 'Request cancelled and schedule slot released.' });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleApproveUser = async (targetUserId: number, approve: boolean, selectedRole: string, selectedDepartmentId?: number) => {
    try {
      await apiRequest(`/api/users/${targetUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          approval_status: approve ? 'APPROVED' : 'REJECTED',
          role: selectedRole,
          ...(selectedDepartmentId ? { department_id: Number(selectedDepartmentId) } : {}),
          rejection_reason: approve ? null : 'Declined by Administrator',
        }),
      });
      setStatusBanner({
        type: 'success',
        text: approve ? `User account #${targetUserId} approved as ${selectedRole}.` : `User account #${targetUserId} rejected.`,
      });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleToggleUserActive = async (targetUser: any) => {
    const nextActive = targetUser.is_active === 1 ? false : true;
    try {
      await apiRequest(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: nextActive }),
      });
      setStatusBanner({
        type: 'success',
        text: nextActive
          ? `User @${targetUser.group_username} reactivated.`
          : `User @${targetUser.group_username} deactivated and active sessions revoked.`,
      });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleDeleteUser = async (targetUser: any) => {
    if (targetUser.id === user.id) {
      setStatusBanner({ type: 'danger', text: 'Cannot delete your own active administrator account.' });
      return;
    }
    try {
      await apiRequest(`/api/users/${targetUser.id}`, {
        method: 'DELETE',
      });
      setStatusBanner({
        type: 'success',
        text: `User account ${targetUser.nickname} (@${targetUser.group_username}) deleted.`,
      });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleUpdateUserRoleOrGroup = async (targetUserId: number, updates: { role?: string; department_id?: number }) => {
    try {
      await apiRequest(`/api/users/${targetUserId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      setStatusBanner({ type: 'success', text: `User #${targetUserId} updated.` });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleAdminTripDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!dispatchModalTrip) return;
    try {
      const res = await apiRequest(`/api/trips/${dispatchModalTrip.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          reason: dispatchDecisionReason || (decision === 'APPROVED' ? `Approved by ${user.role}` : ''),
          vehicle_id: Number(dispatchVehicleId || dispatchModalTrip.vehicle_id),
          driver_profile_id: dispatchDriverId ? Number(dispatchDriverId) : null,
        }),
      });
      setDispatchModalTrip(null);
      setDispatchDecisionReason('');
      if (res.status === 'PENDING_APPROVAL') {
        setStatusBanner({
          type: 'success',
          text: `Trip #${dispatchModalTrip.id} approved by ${user.role === 'FM' ? 'Fleet Operation PIC' : 'Head Of WS Part'}! Awaiting second approval to finalize dispatch.`,
        });
      } else {
        setStatusBanner({
          type: 'success',
          text:
            decision === 'APPROVED'
              ? `Trip #${dispatchModalTrip.id} fully approved and dispatched!`
              : `Trip #${dispatchModalTrip.id} rejected and vehicle schedule slot released.`,
        });
      }
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          registration_plate: newVehicleForm.registration_plate.trim(),
          make: newVehicleForm.make.trim(),
          model: newVehicleForm.model.trim(),
          car_type: newVehicleForm.car_type.trim() || 'MPV',
          year: Number(newVehicleForm.year) || new Date().getFullYear(),
          vin: newVehicleForm.vin.trim() || `VIN-${Date.now()}`,
          energy_type: newVehicleForm.energy_type,
          seats: Number(newVehicleForm.seats) || 5,
          current_odometer: Number(newVehicleForm.current_odometer) || 0,
          battery_percent: newVehicleForm.energy_type === 'Electric' ? Number(newVehicleForm.battery_percent || 100) : null,
          last_parking_spot: newVehicleForm.last_parking_spot.trim() || 'Main Pool',
          default_driver_id: newVehicleForm.default_driver_id ? Number(newVehicleForm.default_driver_id) : null,
        }),
      });
      setNewVehicleForm({
        registration_plate: '',
        make: '',
        model: '',
        car_type: 'MPV',
        year: String(new Date().getFullYear()),
        vin: '',
        energy_type: 'Gasoline',
        seats: '7',
        current_odometer: '0',
        battery_percent: '100',
        last_parking_spot: '',
        default_driver_id: '',
      });
      setStatusBanner({ type: 'success', text: 'New vehicle registered in fleet.' });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleSaveVehicleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;
    try {
      await apiRequest(`/api/vehicles/${editingVehicle.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          registration_plate: editingVehicle.registration_plate,
          make: editingVehicle.make,
          model: editingVehicle.model,
          car_type: editingVehicle.car_type,
          energy_type: editingVehicle.energy_type,
          seats: Number(editingVehicle.seats),
          current_odometer: Number(editingVehicle.current_odometer),
          battery_percent: editingVehicle.energy_type === 'Electric' ? Number(editingVehicle.battery_percent ?? 80) : null,
          status: editingVehicle.status,
          standby_reason: editingVehicle.standby_reason || null,
          last_parking_spot: editingVehicle.last_parking_spot,
          default_driver_id: editingVehicle.default_driver_id ? Number(editingVehicle.default_driver_id) : null,
        }),
      });
      setEditingVehicle(null);
      setStatusBanner({ type: 'success', text: 'Vehicle specifications, license plate, and operational status updated.' });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleDeleteVehicle = async (veh: any) => {
    if (!window.confirm(`Are you sure you want to delete vehicle ${veh.registration_plate} (${veh.make} ${veh.model})? All pending bookings will be unassigned and the car retired.`)) {
      return;
    }
    try {
      await apiRequest(`/api/vehicles/${veh.id}`, { method: 'DELETE' });
      setStatusBanner({ type: 'success', text: `Vehicle ${veh.registration_plate} deleted successfully.` });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleDeleteDriver = async (drv: any) => {
    if (!window.confirm(`Are you sure you want to delete driver profile ${drv.full_name}?`)) {
      return;
    }
    try {
      await apiRequest(`/api/drivers/${drv.id}`, { method: 'DELETE' });
      setStatusBanner({ type: 'success', text: `Driver ${drv.full_name} profile deleted.` });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleSaveDriverProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/drivers', {
        method: 'POST',
        body: JSON.stringify({
          user_id: newDriverForm.user_id ? Number(newDriverForm.user_id) : null,
          full_name: newDriverForm.full_name.trim(),
          department_id: Number(newDriverForm.department_id) || driverGroupId,
          licence_number: newDriverForm.licence_number.trim(),
          licence_class: newDriverForm.licence_class.trim() || 'A',
          licence_expiry: newDriverForm.licence_expiry,
          contact_number: newDriverForm.contact_number.trim() || '-',
          availability_status: newDriverForm.availability_status,
          photo_url: newDriverForm.photo_url || null,
        }),
      });
      setNewDriverForm({
        user_id: '',
        full_name: '',
        department_id: driverGroupId,
        licence_number: '',
        licence_class: 'A',
        licence_expiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        contact_number: '',
        availability_status: 'Active',
        photo_url: '',
      });
      setStatusBanner({ type: 'success', text: 'Driver profile saved with group assignment.' });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleCreateUserByAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          nickname: newUserForm.nickname.trim(),
          group_username: newUserForm.group_username.trim(),
          password: newUserForm.password,
          role: newUserForm.role,
          department_id: Number(newUserForm.department_id),
        }),
      });
      setNewUserForm({
        nickname: '',
        group_username: '',
        password: '',
        role: 'EMP',
        department_id: activeGroups[0]?.id || groupsList[0]?.id || 1,
      });
      setStatusBanner({ type: 'success', text: 'Approved user account created.' });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      await apiRequest('/api/departments', {
        method: 'POST',
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      setNewGroupName('');
      setStatusBanner({ type: 'success', text: 'Group added.' });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const openVehicle360 = async (vehicleId: number) => {
    try {
      const detail = await apiRequest(`/api/vehicles/${vehicleId}`);
      setVehicleDetail360(detail);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  // Filtered availability vehicles & derived active trip
  const rawAvailVehicles = liveAvailability?.vehicles?.length ? liveAvailability.vehicles : vehicles;
  const filteredVehicles = useMemo(() => {
    if (vehicleFilter === 'Electric') return rawAvailVehicles.filter((v) => v.energy_type === 'Electric');
    if (vehicleFilter === 'MPV') return rawAvailVehicles.filter((v) => String(v.car_type).toLowerCase().includes('mpv') || v.seats >= 7);
    return rawAvailVehicles;
  }, [rawAvailVehicles, vehicleFilter]);

  const selectedVehicle = useMemo(
    () => rawAvailVehicles.find((v) => v.id === Number(bookVehicleId)) || filteredVehicles[0] || rawAvailVehicles[0] || null,
    [rawAvailVehicles, filteredVehicles, bookVehicleId]
  );

  // Auto-select first available vehicle when filtered list changes
  useEffect(() => {
    if (filteredVehicles.length > 0 && !filteredVehicles.some((v) => v.id === bookVehicleId)) {
      const firstAvail = filteredVehicles.find((v) => v.isAvailable !== false && v.status === 'Available') || filteredVehicles[0];
      if (firstAvail) setBookVehicleId(firstAvail.id);
    }
  }, [filteredVehicles, bookVehicleId]);

  const ongoingTrips = useMemo(
    () =>
      trips.filter(
        (t) =>
          (t.status === 'PENDING_APPROVAL' || t.status === 'APPROVED' || t.status === 'IN_PROGRESS') &&
          t.booking_status !== 'CANCELLED'
      ),
    [trips]
  );

  const historyTrips = useMemo(
    () =>
      trips.filter(
        (t) =>
          t.status === 'COMPLETED' ||
          t.status === 'REJECTED' ||
          t.status === 'CANCELLED' ||
          t.booking_status === 'CANCELLED'
      ),
    [trips]
  );

  const focusedTrip = useMemo(
    () => (focusedTripId ? trips.find((t) => t.id === focusedTripId) : null) || ongoingTrips[0] || null,
    [trips, focusedTripId, ongoingTrips]
  );

  const activeTripDriverCoords = useMemo(() => {
    if (!focusedTrip) return null;
    const carPos = fleetPositions.find((p) => p.id === focusedTrip.vehicle_id);
    if (carPos && Number.isFinite(carPos.latitude) && Number.isFinite(carPos.longitude)) {
      return { lat: carPos.latitude, lon: carPos.longitude };
    }
    const drvPin = userPins.find((p) =>
      (focusedTrip.assigned_driver_name && p.nickname.toLowerCase() === focusedTrip.assigned_driver_name.toLowerCase()) || p.role === 'DRV'
    );
    return drvPin ? { lat: drvPin.latitude, lon: drvPin.longitude } : null;
  }, [focusedTrip, fleetPositions, userPins]);

  // Auto-transition user view when trip status changes (e.g. Approved, Dispatched, In Progress, Completed, Rejected)
  useEffect(() => {
    if (!focusedTrip) return;

    if (bookingStep === 'WAITING') {
      if (focusedTrip.status === 'APPROVED' || focusedTrip.status === 'IN_PROGRESS') {
        setBookingStep('IN_TRIP');
        setSheetSnap('half');
        setStatusBanner({
          type: 'success',
          text: `Booking Approved! Driver ${focusedTrip.assigned_driver_name || 'Assigned'} has been dispatched with ${focusedTrip.make} ${focusedTrip.model} (${focusedTrip.registration_plate || 'Company Fleet'}).`,
        });
      } else if (focusedTrip.status === 'REJECTED') {
        const rejReason = focusedTrip.decisions?.find((d: any) => d.decision === 'REJECTED')?.reason;
        setStatusBanner({
          type: 'danger',
          text: `Your booking request was rejected${rejReason ? `: ${rejReason}` : '.'}`,
        });
      }
    } else if (bookingStep === 'IN_TRIP') {
      if (focusedTrip.status === 'COMPLETED') {
        setBookingStep('HOME');
        setSheetSnap('half');
        setStatusBanner({
          type: 'success',
          text: 'Trip completed! Thank you for using GalaxyFleet.',
        });
      } else if (focusedTrip.status === 'CANCELLED' || focusedTrip.status === 'REJECTED') {
        setBookingStep('HOME');
        setSheetSnap('half');
        setStatusBanner({
          type: 'warning',
          text: 'Trip was cancelled.',
        });
      }
    }
  }, [focusedTrip?.status, focusedTrip?.id, bookingStep]);

  // Real user recent destinations from their actual trip history (no dummy places)
  const recentDestinationChips = useMemo(() => {
    return Array.from(new Set(trips.map((t) => String(t.destination || '').trim()).filter(Boolean))).slice(0, 6);
  }, [trips]);

  const recentPlacesList = useMemo<GeoPlace[]>(() => {
    const map = new Map<string, GeoPlace>();
    for (const t of trips) {
      const dest = String(t.destination || '').trim();
      if (dest && !map.has(dest)) {
        map.set(dest, { name: dest, address: `Trip #${t.id} • ${t.purpose || 'Previous ride'}`, lat: -6.2088, lon: 106.8456 });
      }
      const orig = String(t.origin || '').trim();
      if (orig && !map.has(orig)) {
        map.set(orig, { name: orig, address: `Pickup • Trip #${t.id}`, lat: -6.2088, lon: 106.8456 });
      }
    }
    return Array.from(map.values());
  }, [trips]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const pendingUsers = usersList.filter((u) => u.approval_status === 'PENDING_APPROVAL');
  const pendingTrips = trips.filter((t) => t.status === 'PENDING_APPROVAL');

  // Loading auth screen
  if (loadingAuth) {
    return (
      <div className="gf-auth-screen">
        <div className="gf-auth-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Skeleton height={32} width="60%" />
          <Skeleton height={48} />
          <Skeleton height={48} />
        </div>
      </div>
    );
  }

  // ============================================================================
  // UNAUTHENTICATED SCREEN: PURE LOGIN & 4-FIELD REGISTRATION (Zero Dummy Data)
  // ============================================================================
  if (!user) {
    return (
      <div className="gf-auth-screen">
        <div className="gf-auth-card">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <LanguageSwitcher />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <SamsungBusLogo size={52} />
            <div>
              <h1 className="type-title">GalaxyFleet</h1>
              <p className="type-caption">{t('Internal Fleet Management System')}</p>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <Segmented
              ariaLabel="Authentication mode"
              value={authMode}
              onChange={(m) => {
                setAuthMode(m);
                setAuthMessage(null);
              }}
              options={[
                { value: 'LOGIN', label: t('Sign In') },
                { value: 'REGISTER', label: t('Register Account') },
              ]}
            />
          </div>

          {authMessage && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-control)',
                marginBottom: '16px',
                background: authMessage.type === 'error' ? 'var(--color-status-red-bg)' : 'var(--color-status-green-bg)',
                color: authMessage.type === 'error' ? 'var(--color-status-red-fg)' : 'var(--color-status-green-fg)',
                fontSize: 'var(--text-body-size)',
                fontWeight: 600,
              }}
            >
              {authMessage.text}
            </div>
          )}

          {authMode === 'LOGIN' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="type-caption" htmlFor="login-username" style={{ fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  {t('Username')}
                </label>
                <input
                  id="login-username"
                  className="gf-input"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder={t('Enter your username')}
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="type-caption" htmlFor="login-password" style={{ fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  {t('Password')}
                </label>
                <input
                  id="login-password"
                  className="gf-input"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder={t('Enter your password')}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
              <button id="login-submit-btn" type="submit" className="gf-btn gf-btn-primary gf-btn-full">
                {t('Sign In to GalaxyFleet')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-control)',
                  background: 'var(--color-bg-subtle)',
                  fontSize: 'var(--text-caption-size)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <strong>Account Registration:</strong> Enter your nickname, group, username & password. Administrator approval is required before sign-in.
              </div>

              <div>
                <label className="type-caption" htmlFor="reg-nickname" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  {t('Nickname')}
                </label>
                <input
                  id="reg-nickname"
                  className="gf-input"
                  type="text"
                  required
                  placeholder={t('Enter your nickname')}
                  value={regNickname}
                  onChange={(e) => setRegNickname(e.target.value)}
                />
              </div>

              <div>
                <label className="type-caption" htmlFor="reg-dept" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  {t('Group')}
                </label>
                <select id="reg-dept" className="gf-select notranslate" translate="no" value={regDeptId} onChange={(e) => setRegDeptId(Number(e.target.value))}>
                  {(activeGroups.length > 0 ? activeGroups : groupsList).map((g) => (
                    <option key={g.id} value={g.id} className="notranslate" translate="no">
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="type-caption" htmlFor="reg-username" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  {t('Username')}
                </label>
                <input
                  id="reg-username"
                  className="gf-input"
                  type="text"
                  required
                  placeholder={t('Enter your username')}
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="type-caption" htmlFor="reg-password" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  {t('Password')}
                </label>
                <input
                  id="reg-password"
                  className="gf-input"
                  type="password"
                  required
                  minLength={6}
                  placeholder={t('Minimum 6 characters')}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="type-caption" htmlFor="reg-role" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  {t('Account Type')}
                </label>
                <select
                  id="reg-role"
                  className="gf-select"
                  value={regRole}
                  onChange={(e) => {
                    const nextRole = e.target.value as 'EMP' | 'DRV';
                    setRegRole(nextRole);
                    const pool = activeGroups.length > 0 ? activeGroups : groupsList;
                    const defaultEmpGroup = pool.find((g) => g.id !== driverGroupId)?.id || pool[0]?.id || 1;
                    if (nextRole === 'DRV' && driverGroupId) {
                      setRegDeptId(driverGroupId);
                    } else if (nextRole === 'EMP' && regDeptId === driverGroupId && defaultEmpGroup !== driverGroupId) {
                      setRegDeptId(defaultEmpGroup);
                    }
                  }}
                >
                  <option value="EMP">{t('User / Employee (Book & Reserve Cars)')}</option>
                  <option value="DRV">{t('Company Driver (Receive Dispatch Orders)')}</option>
                </select>
              </div>

              <button id="register-submit-btn" type="submit" className="gf-btn gf-btn-primary gf-btn-full">
                {t('Submit Registration')}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // SHARED MODALS (Edit Vehicle, Dispatch Modal, 360° Record, PWA Guide)
  // ============================================================================
  const renderSharedModals = () => (
    <>
      {editingVehicle && (
        <div className="gf-modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit vehicle">
          <div className="gf-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="type-title">Edit Vehicle #{editingVehicle.id}</h3>
              <button type="button" className="gf-btn gf-btn-secondary" onClick={() => setEditingVehicle(null)}>
                Close
              </button>
            </div>
            <form onSubmit={handleSaveVehicleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>License Plate</label>
                <input
                  type="text"
                  className="gf-input"
                  required
                  value={editingVehicle.registration_plate}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, registration_plate: e.target.value })}
                />
              </div>
              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Car Type</label>
                <input
                  type="text"
                  className="gf-input"
                  required
                  value={editingVehicle.car_type}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, car_type: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Make</label>
                  <input
                    type="text"
                    className="gf-input"
                    required
                    value={editingVehicle.make}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, make: e.target.value })}
                  />
                </div>
                <div>
                  <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Model</label>
                  <input
                    type="text"
                    className="gf-input"
                    required
                    value={editingVehicle.model}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, model: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Operational Status</label>
                <select
                  className="gf-select"
                  value={editingVehicle.status}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, status: e.target.value })}
                >
                  <option value="Available">Available (Bookable)</option>
                  <option value="Standby">Standby (Reserved / Executive)</option>
                  <option value="Deactivated">Deactivated (Temporarily Offline)</option>
                  <option value="In Maintenance">In Maintenance</option>
                  <option value="Retired">Retired</option>
                </select>
              </div>
              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Standby / Deactivation Reason</label>
                <input
                  type="text"
                  className="gf-input"
                  placeholder="e.g., Reserved for VIP Visit"
                  value={editingVehicle.standby_reason || ''}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, standby_reason: e.target.value })}
                />
              </div>
              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Dedicated Driver (Fixed Car Assignment)</label>
                <select
                  className="gf-select"
                  value={editingVehicle.default_driver_id || 0}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, default_driver_id: Number(e.target.value) || null })}
                >
                  <option value={0}>No Dedicated Driver (Pool Driver)</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} ({d.contact_number || 'No Phone'})
                    </option>
                  ))}
                </select>
                <p className="type-caption" style={{ marginTop: '3px', color: 'var(--color-text-secondary)' }}>
                  Once assigned, this car keeps this dedicated driver unless changed by Admin.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="gf-btn gf-btn-secondary" style={{ flex: 1 }} onClick={() => setEditingVehicle(null)}>
                  Cancel
                </button>
                <button type="submit" className="gf-btn gf-btn-primary" style={{ flex: 1 }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dispatchModalTrip && (
        <div className="gf-modal-backdrop" role="dialog" aria-modal="true" aria-label="Dispatch approval">
          <div className="gf-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="type-title">Dispatch Trip #{dispatchModalTrip.id}</h3>
              <button type="button" className="gf-btn gf-btn-secondary" onClick={() => setDispatchModalTrip(null)}>
                Close
              </button>
            </div>
            <div style={{ padding: '12px', borderRadius: 'var(--radius-control)', background: 'var(--color-bg-subtle)', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div className="type-body" style={{ fontWeight: 700 }}>{dispatchModalTrip.purpose}</div>
                {formatReservationModeLabel(dispatchModalTrip.reservation_type, dispatchModalTrip.return_pickup_time) && (
                  <StatusBadge label={formatReservationModeLabel(dispatchModalTrip.reservation_type, dispatchModalTrip.return_pickup_time)!} tone="blue" />
                )}
              </div>
              <div className="type-caption">{dispatchModalTrip.origin} → {dispatchModalTrip.destination}</div>
              <div className="type-caption">{dispatchModalTrip.requester_name} ({dispatchModalTrip.department_name})</div>
              {dispatchModalTrip.start_time && dispatchModalTrip.end_time && (
                <div className="type-caption" style={{ marginTop: '4px', color: 'var(--color-text-secondary)' }}>
                  🕒 Schedule: {new Date(dispatchModalTrip.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} → {new Date(dispatchModalTrip.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              {dispatchModalTrip.reservation_type === 'DROP_AND_PICKUP' && dispatchModalTrip.return_pickup_time && (
                <div className="type-caption" style={{ marginTop: '3px', color: '#005bb5', fontWeight: 700 }}>
                  🔁 Post-Event Pick-Up: {new Date(dispatchModalTrip.return_pickup_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>

            {dispatchModalTrip.is_urgent === 1 && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#fef2f2', border: '1.5px solid #f87171', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <AlertTriangle size={15} style={{ color: '#dc2626' }} />
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase' }}>
                    🚨 Urgent Short-Notice Booking (&lt; 2h Departure)
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#7f1d1d' }}>
                  <strong>Mandatory Fleet Operation PIC Approval Required.</strong> This trip was booked with less than 2 hours lead time before departure.
                </div>
                {dispatchModalTrip.urgent_reason && (
                  <div style={{ fontSize: '11.5px', color: '#991b1b', marginTop: '4px' }}>
                    <strong>Justification:</strong> {dispatchModalTrip.urgent_reason}
                  </div>
                )}
              </div>
            )}

            {dispatchModalTrip.requires_dual_approval && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#eff6ff', border: '1.5px solid #bfdbfe', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', marginBottom: '4px' }}>Dual-Approval Requirement</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11.5px' }}>
                  <span style={{ color: dispatchModalTrip.pic_approved ? '#0072de' : '#64748b', fontWeight: 700 }}>
                    {dispatchModalTrip.pic_approved ? '✓ Fleet Operation PIC: Approved' : '⏳ Fleet Operation PIC: Pending'}
                  </span>
                  <span>•</span>
                  <span style={{ color: dispatchModalTrip.hws_approved ? '#0072de' : '#64748b', fontWeight: 700 }}>
                    {dispatchModalTrip.hws_approved ? '✓ Head Of WS Part: Approved' : '⏳ Head Of WS Part: Pending'}
                  </span>
                </div>
                {user.role === 'ADM' && (
                  <div style={{ fontSize: '11px', color: '#1e3a8a', marginTop: '4px', fontStyle: 'italic' }}>
                    Admin Delegation: Approving now immediately authorizes the trip and delegates for any pending approver.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Assigned Vehicle</label>
                <select className="gf-select" value={dispatchVehicleId} onChange={(e) => setDispatchVehicleId(Number(e.target.value))}>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registration_plate} — {v.make} {v.model} ({v.energy_type}, {v.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Assigned Driver</label>
                <select className="gf-select" value={dispatchDriverId} onChange={(e) => setDispatchDriverId(e.target.value)}>
                  <option value="">No driver assigned yet (Vehicle only / Assign later)</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.full_name} (Class {d.licence_class} • {d.availability_status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Approval Note / Rejection Reason</label>
                <input
                  type="text"
                  className="gf-input"
                  placeholder="Enter note or mandatory reason if rejecting"
                  value={dispatchDecisionReason}
                  onChange={(e) => setDispatchDecisionReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button type="button" className="gf-btn gf-btn-outline-danger" style={{ flex: 1 }} onClick={() => handleAdminTripDecision('REJECTED')}>
                  Reject
                </button>
                <button type="button" className="gf-btn gf-btn-primary" style={{ flex: 1 }} onClick={() => handleAdminTripDecision('APPROVED')}>
                  {user.role === 'ADM' && dispatchModalTrip.requires_dual_approval && (!dispatchModalTrip.pic_approved || !dispatchModalTrip.hws_approved)
                    ? 'Approve & Delegate as Admin'
                    : user.role === 'FM'
                    ? dispatchModalTrip.hws_approved
                      ? 'Complete Final Approval & Dispatch'
                      : 'Approve as Fleet Operation PIC'
                    : user.role === 'HWS'
                    ? dispatchModalTrip.pic_approved
                      ? 'Authorize & Finalize Dispatch'
                      : 'Approve as Head Of WS Part'
                    : 'Approve & Dispatch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {vehicleDetail360 && (
        <div className="gf-modal-backdrop" role="dialog" aria-modal="true" aria-label="Vehicle 360 detail">
          <div className="gf-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="type-title">
                {vehicleDetail360.vehicle.registration_plate} — {vehicleDetail360.vehicle.make} {vehicleDetail360.vehicle.model}
              </h3>
              <button type="button" className="gf-btn gf-btn-secondary" onClick={() => setVehicleDetail360(null)}>
                Close
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="type-body">
              <div><strong>Energy Type:</strong> {vehicleDetail360.vehicle.energy_type} • <strong>Odometer:</strong> {vehicleDetail360.vehicle.current_odometer} km</div>
              <div><strong>Bookings ({vehicleDetail360.bookings.length}):</strong> {vehicleDetail360.bookings.map((b: any) => `#${b.id} (${b.status})`).join(', ') || 'None'}</div>
              <div><strong>Assignments ({vehicleDetail360.assignments.length}):</strong> {vehicleDetail360.assignments.map((a: any) => `${a.driver_name} (${a.effective_start.slice(0, 10)})`).join(', ') || 'None'}</div>
              <div><strong>Maintenance:</strong> {vehicleDetail360.maintenanceRecords.length} • <strong>Expenses:</strong> {vehicleDetail360.expenses.length} • <strong>Docs:</strong> {vehicleDetail360.documents.length}</div>
            </div>
          </div>
        </div>
      )}

      {showInstallGuideModal && (
        <div className="gf-modal-backdrop" role="dialog" aria-modal="true" aria-label="Install GalaxyFleet PWA">
          <div className="gf-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <SamsungBusLogo size={40} />
                <div>
                  <h3 className="type-title" style={{ margin: 0 }}>Install GalaxyFleet App</h3>
                  <p className="type-caption" style={{ margin: 0 }}>Samsung Mobility Fleet PWA</p>
                </div>
              </div>
              <button type="button" className="gf-btn gf-btn-secondary" onClick={() => setShowInstallGuideModal(false)}>
                Close
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} className="type-body">
              <p>GalaxyFleet includes a full PWA manifest and service worker for standalone installation:</p>
              <div><strong>Android (Chrome):</strong> Tap the menu (⋮) and choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.</div>
              <div><strong>iOS (Safari):</strong> Tap <strong>Share</strong> then <strong>Add to Home Screen</strong>.</div>
              <div><strong>Desktop (Chrome / Edge):</strong> Click the <strong>Install</strong> button inside the address bar.</div>
            </div>
          </div>
        </div>
      )}

      {showLocationPermissionModal && (
        <div className="gf-modal-backdrop" role="dialog" aria-modal="true" aria-label="Location access required">
          <div className="gf-modal-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '9999px',
                  background: 'var(--color-green-tint)',
                  color: 'var(--color-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MapPin size={24} />
              </div>
              <div>
                <h3 className="type-title">Location Access Required</h3>
                <p className="type-caption">Required before using or dispatching a company operational car</p>
              </div>
            </div>

            <div
              className="type-body"
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-control)',
                background: 'var(--color-bg-subtle)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Please allow GalaxyFleet to access your device GPS location. This sets your accurate pickup point, calculates route ETA, and pins your live location dot on the map.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                id="allow-location-modal-btn"
                type="button"
                className="gf-btn gf-btn-primary gf-btn-full"
                onClick={handleGrantLocationFromModal}
              >
                <Navigation size={16} /> Allow Location Access & Continue
              </button>
              <button
                type="button"
                className="gf-btn gf-btn-ghost gf-btn-full"
                onClick={() => {
                  const actionToRun = pendingBookingAction;
                  markLocationVerified();
                  setShowLocationPermissionModal(false);
                  setPendingBookingAction(null);
                  if (actionToRun) actionToRun();
                }}
              >
                Continue & Pin Location Manually on Map
              </button>
            </div>
          </div>
        </div>
      )}

      {showDriverExpenseModal && (
        <div className="gf-modal-backdrop" role="dialog" aria-modal="true" aria-label="Upload Expense Receipt">
          <div className="gf-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 className="type-title">Upload Expense Receipt</h3>
                <p className="type-caption">Claim reimbursement for operational car expenses</p>
              </div>
              <button
                type="button"
                className="gf-btn gf-btn-ghost"
                onClick={() => setShowDriverExpenseModal(false)}
              >
                Cancel
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!driverExpenseForm.vehicle_id) {
                  setStatusBanner({ type: 'danger', text: 'Please select an operational vehicle.' });
                  return;
                }
                if (!driverExpenseForm.amount || Number(driverExpenseForm.amount) <= 0) {
                  setStatusBanner({ type: 'danger', text: 'Please enter a valid expense amount.' });
                  return;
                }
                try {
                  await apiRequest('/api/expenses', {
                    method: 'POST',
                    body: JSON.stringify({
                      vehicle_id: Number(driverExpenseForm.vehicle_id),
                      category: driverExpenseForm.category,
                      amount: Number(driverExpenseForm.amount),
                      description: (driverExpenseForm.description.trim() || `${driverExpenseForm.category} Receipt Claim`),
                      receipt_base64: driverExpenseForm.receipt_base64 || undefined,
                      receipt_data_url: driverExpenseForm.receipt_data_url || undefined,
                      receipt_filename: driverExpenseForm.receipt_name || undefined,
                      receipt_mime_type: driverExpenseForm.receipt_mime_type || undefined,
                    }),
                  });
                  setShowDriverExpenseModal(false);
                  setDriverExpenseForm({
                    vehicle_id: 0,
                    category: 'Toll',
                    amount: '',
                    description: '',
                    receipt_name: '',
                    receipt_base64: '',
                    receipt_data_url: '',
                    receipt_mime_type: '',
                    receipt_size_bytes: 0,
                  });
                  setStatusBanner({ type: 'success', text: 'Expense receipt successfully saved in database for reimbursement approval!' });
                  await loadAllData(user);
                } catch (err: any) {
                  setStatusBanner({ type: 'danger', text: err.message });
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Operational Vehicle
                </label>
                <select
                  className="gf-select"
                  required
                  value={driverExpenseForm.vehicle_id}
                  onChange={(e) => setDriverExpenseForm({ ...driverExpenseForm, vehicle_id: Number(e.target.value) })}
                >
                  <option value={0}>Select Vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registration_plate} — {v.make} {v.model} ({v.energy_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Expense Category
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(['Parking', 'Gas', 'Charging', 'Toll'] as const).map((cat) => (
                    <Chip
                      key={cat}
                      active={driverExpenseForm.category === cat}
                      onClick={() => setDriverExpenseForm({ ...driverExpenseForm, category: cat })}
                    >
                      {cat === 'Charging' ? 'Charging (EV)' : cat}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Amount (Rp)
                </label>
                <input
                  type="number"
                  className="gf-input"
                  required
                  min={1}
                  placeholder="e.g. 50000"
                  value={driverExpenseForm.amount}
                  onChange={(e) => setDriverExpenseForm({ ...driverExpenseForm, amount: e.target.value })}
                />
              </div>

              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Description / Location
                </label>
                <input
                  type="text"
                  className="gf-input"
                  placeholder="e.g. Gerbang Tol Cikarang Utama, Parkir Kantor Pusat"
                  value={driverExpenseForm.description}
                  onChange={(e) => setDriverExpenseForm({ ...driverExpenseForm, description: e.target.value })}
                />
              </div>

              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Receipt Photo / Document
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="gf-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 8 * 1024 * 1024) {
                        setStatusBanner({ type: 'danger', text: 'Receipt file exceeds 8 MB size limit.' });
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (loadEvt) => {
                        const dataUrl = loadEvt.target?.result as string;
                        setDriverExpenseForm((prev) => ({
                          ...prev,
                          receipt_name: file.name,
                          receipt_data_url: dataUrl,
                          receipt_base64: dataUrl,
                          receipt_mime_type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
                          receipt_size_bytes: file.size,
                        }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />

                {driverExpenseForm.receipt_data_url && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-control)',
                      background: 'rgba(0, 114, 222, 0.08)',
                      border: '1px solid rgba(0, 114, 222, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      {driverExpenseForm.receipt_mime_type?.startsWith('image') ? (
                        <img
                          src={driverExpenseForm.receipt_data_url}
                          alt="Receipt Preview"
                          style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                        />
                      ) : (
                        <FileText size={24} style={{ color: 'var(--color-primary)' }} />
                      )}
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div className="type-caption" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {driverExpenseForm.receipt_name}
                        </div>
                        <div className="type-caption" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          {(driverExpenseForm.receipt_size_bytes / 1024).toFixed(1)} KB • Verified & Ready
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="gf-btn gf-btn-outline-danger"
                      style={{ minHeight: '28px', padding: '0 8px', fontSize: '11px' }}
                      onClick={() =>
                        setDriverExpenseForm((prev) => ({
                          ...prev,
                          receipt_name: '',
                          receipt_data_url: '',
                          receipt_base64: '',
                          receipt_mime_type: '',
                          receipt_size_bytes: 0,
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                )}

                <p className="type-caption" style={{ marginTop: '4px', color: 'var(--color-text-secondary)' }}>
                  Take a photo of the receipt or attach PDF slip. Stored securely in database.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="gf-btn gf-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowDriverExpenseModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="gf-btn gf-btn-primary" style={{ flex: 1 }}>
                  Submit Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingReceiptModal && (
        <div
          className="gf-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Receipt Preview"
          style={{
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(0, 0, 0, 0.75)',
          }}
          onClick={() => setViewingReceiptModal(null)}
        >
          <div
            className="gf-modal-card"
            style={{
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="type-title" style={{ fontSize: '17px' }}>{viewingReceiptModal.title}</h3>
                {viewingReceiptModal.filename && (
                  <p className="type-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {viewingReceiptModal.filename}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="gf-btn gf-btn-ghost"
                style={{ minHeight: '36px', padding: '0 10px' }}
                onClick={() => setViewingReceiptModal(null)}
              >
                ✕ Close
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.04)',
                borderRadius: 'var(--radius-card)',
                padding: '12px',
                minHeight: '260px',
              }}
            >
              {viewingReceiptModal.url.startsWith('data:application/pdf') ? (
                <iframe
                  src={viewingReceiptModal.url}
                  title="Receipt PDF"
                  style={{ width: '100%', height: '420px', border: 'none', borderRadius: '8px' }}
                />
              ) : (
                <img
                  src={viewingReceiptModal.url}
                  alt="Receipt Preview"
                  style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '8px' }}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
              <a
                href={viewingReceiptModal.url}
                download={viewingReceiptModal.filename || 'receipt.jpg'}
                className="gf-btn gf-btn-secondary"
                style={{ minHeight: '36px', padding: '0 14px', fontSize: '13px', textDecoration: 'none' }}
              >
                Download Receipt
              </a>
              <button
                type="button"
                className="gf-btn gf-btn-primary"
                style={{ minHeight: '36px', padding: '0 16px', fontSize: '13px' }}
                onClick={() => setViewingReceiptModal(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showExecutiveReportModal && usageAnalytics && (
        <div className="gf-modal-backdrop gf-print-backdrop" role="dialog" aria-modal="true" aria-label="Executive Briefing Report">
          <div className="gf-modal-card gf-print-card" style={{ maxWidth: '1040px', width: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="gf-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#0072de', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '16px' }}>GF</div>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>GalaxyFleet Executive Management Report</h2>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Currency: Indonesian Rupiah (IDR) • Generated {new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="gf-btn gf-btn-primary pressable"
                  onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={16} /> Print / Save PDF
                </button>
                <button
                  type="button"
                  className="gf-btn gf-btn-secondary"
                  onClick={() => setShowExecutiveReportModal(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Header visible on paper printout */}
              <div className="gf-print-only" style={{ borderBottom: '2px solid #0072de', paddingBottom: '8px', marginBottom: '8px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0072de' }}>GALAXYFLEET EXECUTIVE MANAGEMENT REPORT</h1>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                  Official Fleet Operations & Financial Summary • Currency: Indonesian Rupiah (IDR) • Generated {new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}
                </div>
              </div>

              {/* 1. Operational & Financial KPI Overview */}
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', border: '1.5px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>1. Operational & Financial KPI Overview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                  <div className="gf-card-flat" style={{ padding: '8px 10px', background: '#ffffff' }}>
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Total Completed Trips</div>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#0072de' }}>{usageAnalytics.tripDurationSummary?.totalCompletedTrips || 0} Trips</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>Across {vehicles.length} Operational Vehicles</div>
                  </div>
                  <div className="gf-card-flat" style={{ padding: '8px 10px', background: '#ffffff' }}>
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Cumulative Trip Duration</div>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#005bb5' }}>{usageAnalytics.tripDurationSummary?.totalDurationFormatted || '0 Hours 0 Minutes'}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>Total Driver Road Time Logged</div>
                  </div>
                  <div className="gf-card-flat" style={{ padding: '8px 10px', background: '#ffffff' }}>
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Total Distance Traveled</div>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>{Number(usageAnalytics.combinedOverall?.allTime?.distanceKm || 0).toLocaleString('id-ID')} km</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>Verified Odometer Mileage</div>
                  </div>
                  <div className="gf-card-flat" style={{ padding: '8px 10px', background: '#ffffff' }}>
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Total Operational Cost</div>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#b45309' }}>{formatIdr(usageAnalytics.expensesBreakdownIdr?.total_operational_cost_idr || 0)}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>Fuel, EV, Toll, Parking & Maint</div>
                  </div>
                </div>
              </div>

              {/* 2. Vehicle Fleet & Energy Audit Summary */}
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>2. Vehicle Fleet & Energy Audit Summary</h3>
                <div className="gf-table-wrap">
                  <table className="gf-table" style={{ width: '100%', fontSize: '11px' }}>
                    <thead>
                      <tr>
                        <th>Plate Number</th>
                        <th>Make & Model</th>
                        <th>Energy Type</th>
                        <th style={{ textAlign: 'right' }}>Baseline Odo</th>
                        <th style={{ textAlign: 'right' }}>Current Odo</th>
                        <th style={{ textAlign: 'right' }}>Distance Traveled</th>
                        <th style={{ textAlign: 'center' }}>Trips</th>
                        <th style={{ textAlign: 'right' }}>Fuel / Energy</th>
                        <th style={{ textAlign: 'right' }}>Cost (IDR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageAnalytics.perVehicle && usageAnalytics.perVehicle.length > 0 ? (
                        usageAnalytics.perVehicle.map((v: any) => {
                          const dist = v.overall?.distanceKm || 0;
                          const baselineOdo = Math.max(0, (v.current_odometer || 0) - dist);
                          const isEv = v.energy_type === 'Electric';
                          const qty = isEv ? `${v.energy?.totalKwh || 0} kWh` : `${v.energy?.totalLitres || 0} L`;

                          return (
                            <tr key={v.vehicle_id}>
                              <td style={{ fontWeight: 800 }}>{v.registration_plate}</td>
                              <td>{v.make} {v.model}</td>
                              <td>
                                <span className={`gf-badge ${isEv ? 'gf-badge-blue' : 'gf-badge-neutral'}`} style={{ padding: '1px 6px', fontSize: '9.5px' }}>
                                  {isEv ? '⚡ Electric' : '⛽ Gasoline'}
                                </span>
                              </td>
                              <td className="mono" style={{ textAlign: 'right' }}>{baselineOdo.toLocaleString('id-ID')} km</td>
                              <td className="mono" style={{ textAlign: 'right' }}>{Number(v.current_odometer || 0).toLocaleString('id-ID')} km</td>
                              <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: '#0072de' }}>{dist.toLocaleString('id-ID')} km</td>
                              <td style={{ textAlign: 'center', fontWeight: 700 }}>{v.overall?.trips || 0}</td>
                              <td className="mono" style={{ textAlign: 'right' }}>{qty}</td>
                              <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatIdr(v.energy?.energyCost || 0)}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: '12px' }}>No vehicles registered yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Comprehensive Energy & Operating Expense Ledger in IDR */}
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>3. Comprehensive Energy & Operating Expense Ledger (IDR)</h3>
                <div className="gf-table-wrap">
                  <table className="gf-table" style={{ width: '100%', fontSize: '11px' }}>
                    <thead>
                      <tr>
                        <th>Expense Category</th>
                        <th>Usage / Verified Metrics</th>
                        <th>Description</th>
                        <th style={{ textAlign: 'right' }}>Total Cost (IDR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>⛽ Gasoline Fuel</strong></td>
                        <td className="mono">{Number(usageAnalytics.expensesBreakdownIdr?.gas_litres || 0).toFixed(1)} Litres</td>
                        <td>Gasoline fleet fuel refuel receipts</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatIdr(usageAnalytics.expensesBreakdownIdr?.gas_idr || 0)}</td>
                      </tr>
                      <tr>
                        <td><strong>⚡ Electric Charging (EV)</strong></td>
                        <td className="mono">{Number(usageAnalytics.expensesBreakdownIdr?.electric_kwh || 0).toFixed(1)} kWh</td>
                        <td>EV charging station kilowatt hours</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatIdr(usageAnalytics.expensesBreakdownIdr?.electric_idr || 0)}</td>
                      </tr>
                      <tr>
                        <td><strong>🛣️ Tollway Operational Fees</strong></td>
                        <td>Receipt Verified</td>
                        <td>Electronic highway toll card reimbursements</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatIdr(usageAnalytics.expensesBreakdownIdr?.toll_idr || 0)}</td>
                      </tr>
                      <tr>
                        <td><strong>🅿️ Facility & Parking Fees</strong></td>
                        <td>Receipt Verified</td>
                        <td>Official operational parking receipts</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatIdr(usageAnalytics.expensesBreakdownIdr?.parking_idr || 0)}</td>
                      </tr>
                      <tr>
                        <td><strong>🔧 Maintenance & Service</strong></td>
                        <td>Periodic Maintenance</td>
                        <td>Vehicle scheduled servicing, parts and repairs</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatIdr(usageAnalytics.expensesBreakdownIdr?.maint_idr || 0)}</td>
                      </tr>
                      <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                        <td colSpan={3}>GRAND TOTAL OPERATIONAL EXPENDITURE</td>
                        <td className="mono" style={{ textAlign: 'right', color: '#0072de', fontSize: '13px' }}>{formatIdr(usageAnalytics.expensesBreakdownIdr?.total_operational_cost_idr || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Digital Audit Certification (APPROVED BY SYSTEM) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '8px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ border: '1.5px solid #dbeafe', borderRadius: '8px', padding: '10px', textAlign: 'center', background: '#f8fafc' }}>
                  <div style={{ fontSize: '9.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Prepared & Dispatched By</div>
                  <div style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a', marginTop: '2px' }}>Fleet Operation PIC</div>
                  <div style={{ margin: '6px 0 2px 0' }}>
                    <span className="gf-badge" style={{ background: '#ebf5ff', color: '#005bb5', border: '1.5px solid #0072de', fontWeight: 800, padding: '3px 8px', fontSize: '10.5px' }}>
                      ✓ APPROVED BY SYSTEM
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }}>Digital Audit: SYS-PIC-CERTIFIED</div>
                </div>
                <div style={{ border: '1.5px solid #dbeafe', borderRadius: '8px', padding: '10px', textAlign: 'center', background: '#f8fafc' }}>
                  <div style={{ fontSize: '9.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Reviewed & Authorized By</div>
                  <div style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a', marginTop: '2px' }}>Head Of WS Part</div>
                  <div style={{ margin: '6px 0 2px 0' }}>
                    <span className="gf-badge" style={{ background: '#ebf5ff', color: '#005bb5', border: '1.5px solid #0072de', fontWeight: 800, padding: '3px 8px', fontSize: '10.5px' }}>
                      ✓ APPROVED BY SYSTEM
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }}>Digital Audit: SYS-HWS-CERTIFIED</div>
                </div>
                <div style={{ border: '1.5px solid #dbeafe', borderRadius: '8px', padding: '10px', textAlign: 'center', background: '#f8fafc' }}>
                  <div style={{ fontSize: '9.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Final Executive Sign-Off</div>
                  <div style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a', marginTop: '2px' }}>Executive General Manager</div>
                  <div style={{ margin: '6px 0 2px 0' }}>
                    <span className="gf-badge" style={{ background: '#ebf5ff', color: '#005bb5', border: '1.5px solid #0072de', fontWeight: 800, padding: '3px 8px', fontSize: '10.5px' }}>
                      ✓ APPROVED BY SYSTEM
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }}>Digital Audit: SYS-EGM-CERTIFIED</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
                CONFIDENTIAL — STRICTLY FOR INTERNAL CORPORATE EXECUTIVE MANAGEMENT REVIEW ONLY
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database & Operations Reset Modal */}
      {showResetModal && (
        <div className="gf-modal-backdrop" role="dialog" aria-modal="true" aria-label="Database & Operations Reset">
          <div className="gf-modal-card" style={{ maxWidth: '640px', width: '92vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '18px' }}>
                  ⚠️
                </div>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Database & Operations Reset</h2>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Wipe test operational data to insert real production fleet data</div>
                </div>
              </div>
              <button
                type="button"
                className="gf-btn gf-btn-secondary"
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmCode('');
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Reset Mode Choice */}
              <div>
                <label className="type-caption" style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                  Select Reset Mode:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: resetMode === 'OPERATIONS_ONLY' ? '2px solid #0072de' : '1px solid #cbd5e1',
                      background: resetMode === 'OPERATIONS_ONLY' ? '#f0f7ff' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="resetMode"
                      value="OPERATIONS_ONLY"
                      checked={resetMode === 'OPERATIONS_ONLY'}
                      onChange={() => setResetMode('OPERATIONS_ONLY')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>1. Reset Test Operations & Trips</span>
                        <span style={{ background: '#ebf5ff', color: '#005bb5', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '9999px' }}>
                          ✅ Recommended for Real Fleet Launch
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#0f172a', marginTop: '6px', lineHeight: 1.5, background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ color: '#0369a1', fontWeight: 700, marginBottom: '2px' }}>
                          🛡️ GUARANTEED NOT ERASED:
                        </div>
                        <div>• <strong>Vehicle License Plates & Specs:</strong> All plate numbers ({vehicles.map(v => v.registration_plate).slice(0, 5).join(', ')}{vehicles.length > 5 ? '...' : ''}), models, VINs remain fully intact.</div>
                        <div>• <strong>Driver Names & Phone Numbers:</strong> All driver profiles, contact phones, licenses, and photos remain fully intact.</div>
                        <div>• <strong>User Accounts & 13 Company Groups:</strong> All logins and department structures remain fully intact.</div>
                        <div style={{ color: '#b91c1c', fontWeight: 700, marginTop: '4px' }}>
                          🗑️ ERASED ONLY:
                        </div>
                        <div style={{ color: '#475569' }}>Test trip requests, bookings, driver dispatches, odometer logs, test receipts, and GPS breadcrumbs.</div>
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: resetMode === 'FACTORY_RESET' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                      background: resetMode === 'FACTORY_RESET' ? '#fef2f2' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="resetMode"
                      value="FACTORY_RESET"
                      checked={resetMode === 'FACTORY_RESET'}
                      onChange={() => setResetMode('FACTORY_RESET')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: '#dc2626' }}>
                        2. Complete Clean Factory Reset (Clean Production Slate)
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        Wipes all test vehicles, test drivers, test trips, bookings, expenses, and non-admin users. Returns system to clean production slate (13 official Groups and Admin account) so you can register real cars and drivers from scratch.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Vehicle Starting Odometers (Only in OPERATIONS_ONLY mode) */}
              {resetMode === 'OPERATIONS_ONLY' && vehicles.length > 0 && (
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', marginBottom: '8px' }}>
                    Set Real Initial Odometers for Registered Vehicles (km):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
                    {vehicles.map((v) => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: '12px' }}>
                          <strong>{v.registration_plate}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{v.make} {v.model}</div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="gf-input mono"
                          style={{ width: '90px', padding: '4px 8px', fontSize: '12px', textAlign: 'right' }}
                          placeholder="0"
                          value={resetVehicleOdometers[v.id] ?? String(v.current_odometer || 0)}
                          onChange={(e) => {
                            const val = e.target.value;
                            setResetVehicleOdometers((prev) => ({ ...prev, [v.id]: val }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Safeguard: Confirmation Keyword */}
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontWeight: 800, fontSize: '13px', color: '#92400e', marginBottom: '4px' }}>
                  🔒 Safety Confirmation
                </div>
                <div style={{ fontSize: '12px', color: '#78350f', marginBottom: '8px' }}>
                  This action permanently modifies the database. Type <strong style={{ color: '#dc2626' }}>RESET</strong> in the box below to unlock execution:
                </div>
                <input
                  type="text"
                  className="gf-input mono"
                  style={{ width: '100%', fontSize: '14px', fontWeight: 800, letterSpacing: '0.1em' }}
                  placeholder='Type "RESET" here'
                  value={resetConfirmCode}
                  onChange={(e) => setResetConfirmCode(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  className="gf-btn gf-btn-secondary"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetConfirmCode('');
                  }}
                  disabled={resetLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="gf-btn"
                  style={{
                    background: resetConfirmCode.trim() === 'RESET' ? '#dc2626' : '#94a3b8',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: resetConfirmCode.trim() === 'RESET' ? 'pointer' : 'not-allowed',
                  }}
                  disabled={resetConfirmCode.trim() !== 'RESET' || resetLoading}
                  onClick={async () => {
                    if (resetConfirmCode.trim() !== 'RESET') return;
                    setResetLoading(true);
                    try {
                      const payloadOdometers: Record<number, number> = {};
                      if (resetMode === 'OPERATIONS_ONLY') {
                        for (const v of vehicles) {
                          const valStr = resetVehicleOdometers[v.id] ?? String(v.current_odometer || 0);
                          const num = parseInt(valStr, 10);
                          payloadOdometers[v.id] = Number.isFinite(num) && num >= 0 ? num : 0;
                        }
                      }
                      const res = await apiRequest('/api/admin/system/reset-data', {
                        method: 'POST',
                        body: JSON.stringify({
                          mode: resetMode,
                          vehicle_odometers: payloadOdometers,
                          confirmation_code: 'RESET',
                        }),
                      });
                      setStatusBanner({ type: 'success', text: res.message || 'System data reset executed successfully.' });
                      setShowResetModal(false);
                      setResetConfirmCode('');
                      await loadAllData(user);
                    } catch (err: any) {
                      setStatusBanner({ type: 'danger', text: err.message || 'Failed to execute reset.' });
                    } finally {
                      setResetLoading(false);
                    }
                  }}
                >
                  {resetLoading ? 'Executing Reset...' : 'Execute Data Reset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div
          className="gf-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Account Profile & Password Settings"
          style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="gf-modal-card"
            style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'var(--color-samsung-blue)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                  }}
                >
                  <User size={20} />
                </div>
                <div>
                  <h2 className="type-title" style={{ margin: 0, fontSize: '18px' }}>Account Settings</h2>
                  <p className="type-caption" style={{ margin: 0 }}>@{user.group_username} • Role: {user.role}</p>
                </div>
              </div>
              <button
                type="button"
                className="gf-btn gf-btn-secondary"
                style={{ padding: '4px 10px', minHeight: '32px' }}
                onClick={() => setShowProfileModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {profileStatusBanner && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: profileStatusBanner.type === 'success' ? '#ebf5ff' : '#fef2f2',
                  color: profileStatusBanner.type === 'success' ? '#005bb5' : '#991b1b',
                  border: `1px solid ${profileStatusBanner.type === 'success' ? '#93c5fd' : '#fecaca'}`,
                }}
              >
                {profileStatusBanner.text}
              </div>
            )}

            {/* Tab navigation */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
              <button
                type="button"
                className={`gf-btn ${profileTab === 'DETAILS' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
                style={{ flex: 1, minHeight: '36px', fontSize: '13.5px' }}
                onClick={() => {
                  setProfileTab('DETAILS');
                  setProfileStatusBanner(null);
                }}
              >
                👤 {t('Profile Details')}
              </button>
              <button
                type="button"
                className={`gf-btn ${profileTab === 'PASSWORD' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
                style={{ flex: 1, minHeight: '36px', fontSize: '13.5px' }}
                onClick={() => {
                  setProfileTab('PASSWORD');
                  setProfileStatusBanner(null);
                }}
              >
                🔒 {t('Change Password')}
              </button>
            </div>

            {profileTab === 'DETAILS' ? (
              <form onSubmit={handleSaveProfileDetails} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--color-bg-subtle)', padding: '12px 14px', borderRadius: '10px' }}>
                  <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
                    {profilePhotoUrl ? (
                      <img
                        src={profilePhotoUrl}
                        alt={profileNickname}
                        style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-samsung-blue)' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '50%',
                          background: 'var(--color-samsung-blue)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '22px',
                          fontWeight: 800,
                        }}
                      >
                        {(profileNickname || user.nickname || 'U').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="gf-btn gf-btn-secondary" style={{ cursor: 'pointer', fontSize: '12px', padding: '6px 12px', minHeight: '32px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Camera size={14} /> {t('Upload New Photo')}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePhotoChange} />
                    </label>
                    {profilePhotoUrl && (
                      <button
                        type="button"
                        className="gf-btn gf-btn-ghost"
                        style={{ fontSize: '11px', color: '#dc2626', padding: '2px 6px', textAlign: 'left' }}
                        onClick={() => setProfilePhotoUrl(null)}
                      >
                        {t('Remove Photo')}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {t('Full Name / Display Nickname')} <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="gf-input"
                    required
                    value={profileNickname}
                    onChange={(e) => setProfileNickname(e.target.value)}
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div>
                  <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {t('Contact Phone Number (WhatsApp / Mobile)')}
                  </label>
                  <input
                    type="tel"
                    className="gf-input"
                    value={profileContactNumber}
                    onChange={(e) => setProfileContactNumber(e.target.value)}
                    placeholder="e.g. 081234567890"
                  />
                  <p className="type-caption" style={{ marginTop: '3px', color: 'var(--color-text-secondary)' }}>
                    Used for ride coordination, WhatsApp dispatch, and emergency contact.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>{t('System Role')}</label>
                    <input type="text" className="gf-input" disabled value={user.role} />
                  </div>
                  <div>
                    <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>{t('Assigned Group')}</label>
                    {user.role === 'ADM' ? (
                      <select
                        className="gf-select notranslate"
                        translate="no"
                        aria-label="Assigned Group"
                        value={profileDepartmentId}
                        onChange={(e) => setProfileDepartmentId(Number(e.target.value))}
                      >
                        {(activeGroups.length > 0 ? activeGroups : groupsList).map((g) => (
                          <option key={g.id} value={g.id} className="notranslate" translate="no">
                            {g.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="gf-input notranslate"
                        translate="no"
                        disabled
                        value={user.department_name || `Group #${user.department_id}`}
                      />
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="gf-btn gf-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setShowProfileModal(false)}
                    disabled={profileSaving}
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="gf-btn gf-btn-primary"
                    style={{ flex: 1 }}
                    disabled={profileSaving}
                  >
                    {profileSaving ? t('Saving...') : t('Save Profile')}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12.5px', color: '#475569' }}>
                  🔒 For your security, enter your current password to verify your identity before setting a new password (min. 6 characters).
                </div>

                <div>
                  <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {t('Current Password')} <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      className="gf-input"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={t('Enter current password')}
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {t('New Password')} <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className="gf-input"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('Enter new password')}
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {t('Confirm New Password')} <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="gf-input"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t('Confirm New Password')}
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="gf-btn gf-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setShowProfileModal(false)}
                    disabled={profileSaving}
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="gf-btn gf-btn-primary"
                    style={{ flex: 1 }}
                    disabled={profileSaving}
                  >
                    {profileSaving ? t('Updating...') : t('Update Password')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );

  // ============================================================================
  // ADMIN CONSOLE MODE (Left Sidebar + Clean Flat Tables)
  // ============================================================================
  if (navSection === 'ADMIN' && isPrivileged) {
    return (
      <>
        <AdminShell
          activeModule={adminModule}
          onSelectModule={setAdminModule}
          onSignOut={handleLogout}
          onOpenProfile={handleOpenProfileModal}
          pendingCount={pendingTrips.length + pendingUsers.length}
          userNickname={user.nickname}
          userRole={user.role}
          vehicleCount={vehicles.length}
          groupCount={groupsList.length}
        >
          {isOffline && <ErrorState message="Connection required (WEB-03). Fleet mutations require active network connectivity." />}
          {showNotificationPromptBanner && (
            <div
              style={{
                background: 'linear-gradient(135deg, #0072de, #0052b4)',
                color: '#ffffff',
                padding: '12px 16px',
                borderRadius: '12px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(0, 114, 222, 0.25)',
                marginBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 210px', minWidth: 0 }}>
                <Bell size={20} style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '13px' }}>{t('Enable Real-Time Notifications')}</div>
                  <div style={{ fontSize: '11.5px', opacity: 0.9, lineHeight: 1.35 }}>
                    {t('Get instant push alerts for car approvals, driver dispatches, and operations.')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  type="button"
                  className="gf-btn gf-alert-btn"
                  style={{ background: '#ffffff', color: '#0072de', fontWeight: 800, border: 'none', padding: '6px 12px', fontSize: '12px', minHeight: '34px' }}
                  onClick={() => handleEnablePushNotifications(false)}
                >
                  {t('Allow Alerts')}
                </button>
                <button
                  type="button"
                  className="gf-btn gf-alert-btn"
                  style={{ background: 'transparent', color: '#ffffff', border: '1px solid rgba(255,255,255,0.45)', padding: '6px 12px', fontSize: '11.5px', minHeight: '34px' }}
                  onClick={() => setShowNotificationPromptBanner(false)}
                >
                  {t('Dismiss')}
                </button>
              </div>
            </div>
          )}
          {statusBanner && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-control)',
                background: statusBanner.type === 'danger' ? 'var(--color-status-red-bg)' : 'var(--color-status-green-bg)',
                color: statusBanner.type === 'danger' ? 'var(--color-status-red-fg)' : 'var(--color-status-green-fg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <span className="type-body" style={{ fontWeight: 600 }}>{statusBanner.text}</span>
              <button type="button" className="gf-btn gf-btn-secondary" style={{ minHeight: '36px', padding: '0 12px' }} onClick={() => setStatusBanner(null)}>
                Dismiss
              </button>
            </div>
          )}

          {adminModule === 'FLEET_MAP' && (() => {
            const q = driverSearchQuery.trim().toLowerCase();
            const filteredFleetPositions = fleetPositions.filter((pos) => {
              const matchesFilter =
                fleetFilterMode === 'ALL'
                  ? true
                  : fleetFilterMode === 'DRIVING'
                  ? pos.status === 'IN_TRIP'
                  : fleetFilterMode === 'GASOLINE'
                  ? pos.energy_type === 'Gasoline'
                  : fleetFilterMode === 'ELECTRIC'
                  ? pos.energy_type === 'Electric'
                  : true;
              if (!matchesFilter) return false;
              if (!q) return true;
              const dName = (pos.driver_name || '').toLowerCase();
              const plate = (pos.registration_plate || '').toLowerCase();
              const model = `${pos.make} ${pos.model}`.toLowerCase();
              const pax = (pos.active_trip?.passenger_nickname || '').toLowerCase();
              const req = (pos.active_trip?.requester_nickname || '').toLowerCase();
              return dName.includes(q) || plate.includes(q) || model.includes(q) || pax.includes(q) || req.includes(q);
            });

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={20} style={{ color: 'var(--color-samsung-blue)' }} /> Overall Fleet Live Map
                    </h2>
                    <p className="type-caption">Live GPS positions, model-specific vehicle avatars, and driver profiles for all {fleetPositions.length} operational company vehicles.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="gf-badge" style={{ background: '#f1f5f9', color: '#0f172a', fontWeight: 700, padding: '4px 10px' }}>
                      ⛽ Gasoline: {fleetPositions.filter((p) => p.energy_type === 'Gasoline').length} Cars
                    </span>
                    <span className="gf-badge" style={{ background: '#ebf5ff', color: '#0072de', fontWeight: 700, padding: '4px 10px' }}>
                      ⚡ EV: {fleetPositions.filter((p) => p.energy_type === 'Electric').length} Cars
                    </span>
                    <span className="gf-badge" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 700, padding: '4px 10px' }}>
                      🚗 In Trip: {fleetPositions.filter((p) => p.status === 'IN_TRIP').length} Active
                    </span>
                  </div>
                </div>

                {/* Driver Name Search Bar & Quick Category Filters */}
                <div style={{ background: 'var(--color-bg-surface)', padding: '14px 16px', borderRadius: '14px', border: '1.5px solid var(--color-divider)', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        className="gf-input"
                        style={{ paddingLeft: '40px', paddingRight: driverSearchQuery ? '36px' : '14px', height: '44px', width: '100%', fontSize: '14px', borderRadius: '10px' }}
                        placeholder="Search driver position by name (e.g. Budi, Citra) or license plate (e.g. B 1024)..."
                        value={driverSearchQuery}
                        onChange={(e) => setDriverSearchQuery(e.target.value)}
                      />
                      {driverSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setDriverSearchQuery('')}
                          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '16px', padding: '4px' }}
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className="gf-btn gf-btn-secondary"
                      style={{ height: '44px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={async () => {
                        try {
                          const res = await apiRequest('/api/admin/fleet-map-positions');
                          setFleetPositions(res.fleetPositions || []);
                          setStatusBanner({ type: 'success', text: `Refreshed ${res.fleetPositions?.length || 0} vehicle GPS positions.` });
                        } catch (err: any) {
                          setStatusBanner({ type: 'danger', text: err.message || 'Failed to refresh GPS positions' });
                        }
                      }}
                      title="Refresh GPS positions"
                    >
                      <Clock size={16} /> Refresh
                    </button>
                  </div>

                  {/* Filter Chips */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginRight: '4px' }}>Filter:</span>
                    {[
                      { id: 'ALL', label: `All Vehicles (${fleetPositions.length})` },
                      { id: 'DRIVING', label: `🚗 Driving / In Trip (${fleetPositions.filter((p) => p.status === 'IN_TRIP').length})` },
                      { id: 'GASOLINE', label: `⛽ Gasoline (${fleetPositions.filter((p) => p.energy_type === 'Gasoline').length})` },
                      { id: 'ELECTRIC', label: `⚡ Electric EV (${fleetPositions.filter((p) => p.energy_type === 'Electric').length})` },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFleetFilterMode(f.id as any)}
                        className="gf-btn"
                        style={{
                          minHeight: '32px',
                          padding: '0 12px',
                          fontSize: '12px',
                          borderRadius: '9999px',
                          fontWeight: 700,
                          background: fleetFilterMode === f.id ? 'var(--color-samsung-blue)' : 'var(--color-bg-subtle)',
                          color: fleetFilterMode === f.id ? '#ffffff' : 'var(--color-text-primary)',
                          border: fleetFilterMode === f.id ? 'none' : '1px solid var(--color-divider)',
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Driver Quick Position Cards - Display ONLY when search query is typed */}
                {q.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="type-caption" style={{ fontWeight: 700, color: 'var(--color-samsung-blue)' }}>
                        🔍 Driver & Vehicle Search Results for &ldquo;{driverSearchQuery}&rdquo; ({filteredFleetPositions.length} found)
                      </span>
                      <button
                        type="button"
                        className="gf-btn gf-btn-ghost"
                        style={{ minHeight: '26px', padding: '0 8px', fontSize: '11.5px' }}
                        onClick={() => setDriverSearchQuery('')}
                      >
                        Clear search
                      </button>
                    </div>
                    {filteredFleetPositions.length === 0 ? (
                      <div className="gf-card-flat" style={{ padding: '14px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                        No driver or vehicle found matching &ldquo;{driverSearchQuery}&rdquo;. Try typing driver name or license plate.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                        {filteredFleetPositions.map((pos) => {
                          const isEv = pos.energy_type === 'Electric';
                          const isInTrip = pos.status === 'IN_TRIP';
                          const driverPhoto = getDriverAvatarDataUri(pos.driver_name || 'Driver', pos.driver_photo_url);
                          const isFocused = focusedVehicleId === pos.id;

                          return (
                            <div
                              key={pos.id}
                              className="gf-card-flat"
                              style={{
                                padding: '12px 14px',
                                border: isFocused ? '2px solid var(--color-samsung-blue)' : '1px solid var(--color-divider)',
                                background: isFocused ? '#f0f7ff' : 'var(--color-bg-surface)',
                                borderRadius: '12px',
                                boxShadow: isFocused ? '0 4px 14px rgba(0,114,222,0.18)' : 'var(--shadow-card)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                              }}
                            >
                              {/* Driver & Car Header */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ position: 'relative', width: '46px', height: '46px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid #ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.14)' }}>
                                  <img src={driverPhoto} alt={pos.driver_name || 'Driver'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  <span
                                    style={{
                                      position: 'absolute',
                                      bottom: '1px',
                                      right: '1px',
                                      width: '10px',
                                      height: '10px',
                                      borderRadius: '50%',
                                      background: isInTrip ? '#258cfb' : '#0072de',
                                      border: '2px solid #ffffff',
                                    }}
                                  />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '6px' }}>
                                    <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--color-text-primary)' }}>{pos.driver_name || 'Standby Driver'}</span>
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        fontWeight: 800,
                                        padding: '2px 6px',
                                        borderRadius: '9999px',
                                        background: isInTrip ? '#fef3c7' : '#ebf5ff',
                                        color: isInTrip ? '#b45309' : '#005bb5',
                                      }}
                                    >
                                      {isInTrip ? '🚗 Driving' : '🅿️ Standby'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-samsung-blue)' }}>
                                    {pos.registration_plate} • {pos.make} {pos.model}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', gap: '6px' }}>
                                    <span>{isEv ? `⚡ EV ${pos.battery_percent ?? 100}%` : '⛽ Gasoline'}</span>
                                    {pos.driver_licence_number && (
                                      <span>• SIM {pos.driver_licence_number}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Person Using This Car Section */}
                              {pos.active_trip ? (
                                <div style={{ background: '#e0edff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 10px', fontSize: '11.5px', color: '#1e293b' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: 800, color: '#005bb5', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.04em' }}>
                                      👤 Person Using This Car
                                    </span>
                                    {pos.active_trip.ride_duration_formatted && (
                                      <span style={{ fontSize: '10px', fontWeight: 700, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '9999px' }}>
                                        ⏱️ {pos.active_trip.ride_duration_formatted}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontWeight: 800, color: '#0f172a' }}>
                                    Pax: <span style={{ color: '#005bb5' }}>{pos.active_trip.passenger_nickname || 'Employee'}</span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#475569' }}>
                                    Booked By: <b>{pos.active_trip.requester_nickname || 'Requester'}</b>
                                    {pos.active_trip.requester_department && (
                                      <span className="notranslate" translate="no" style={{ color: '#64748b' }}> • {pos.active_trip.requester_department}</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '11px', marginTop: '2px', fontWeight: 600 }}>
                                    📍 {pos.active_trip.origin || 'HQ Pool'} ➔ 🎯 {pos.active_trip.destination}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ background: 'var(--color-bg-subtle)', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                  🅿️ Parked at: <b>{pos.location_label || 'Central Fleet Pool'}</b>
                                </div>
                              )}

                              {/* Action Buttons: Locate on Map, WhatsApp, Call */}
                              <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                                <button
                                  type="button"
                                  className="gf-btn gf-btn-primary"
                                  style={{ flex: 1, minHeight: '32px', padding: '0 8px', fontSize: '12px', fontWeight: 700 }}
                                  onClick={() => {
                                    setFocusedVehicleId(pos.id);
                                    document.getElementById('admin-fleet-map-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }}
                                >
                                  <Navigation size={13} style={{ marginRight: '4px' }} /> Locate Position
                                </button>
                                {pos.driver_phone && (
                                  <>
                                    <a
                                      href={formatWhatsAppUrl(pos.driver_phone)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="gf-btn gf-btn-secondary"
                                      style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px', background: '#ebf5ff', color: '#005bb5', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                                      title="WhatsApp Driver"
                                    >
                                      <MessageSquare size={13} />
                                    </a>
                                    <a
                                      href={formatPhoneCallUrl(pos.driver_phone)}
                                      className="gf-btn gf-btn-secondary"
                                      style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                                      title="Call Driver"
                                    >
                                      <Phone size={13} />
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Live Fleet Map Canvas */}
                <div id="admin-fleet-map-canvas" style={{ height: '560px', width: '100%', borderRadius: '16px', overflow: 'hidden', position: 'relative', border: '1px solid var(--color-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                  <MapView
                    origin=""
                    destination=""
                    showRoute={false}
                    pinMode={false}
                    fleetPositions={fleetPositions}
                    userPins={userPins}
                    currentUserId={user.id}
                    focusedVehicleId={focusedVehicleId}
                    onSelectVehicle={(veh) => setFocusedVehicleId(veh.id)}
                    onLocateMe={() => detectAndReportUserLocation(false)}
                  />
                </div>

                {/* Quick Fleet Position Directory Table */}
                <div className="gf-card-flat">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 className="type-title" style={{ fontSize: '15px' }}>Live Vehicle Status Directory</h3>
                    <span className="type-caption">Showing {filteredFleetPositions.length} of {fleetPositions.length} vehicles</span>
                  </div>
                  <div className="gf-table-wrap">
                    <table className="gf-table">
                      <thead>
                        <tr>
                          <th>Plate & Model</th>
                          <th>Energy / Battery</th>
                          <th>Assigned Driver</th>
                          <th>Status / Pax</th>
                          <th>Current Location / Pool</th>
                          <th>Locate & Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFleetPositions.map((pos) => {
                          const driverPhoto = getDriverAvatarDataUri(pos.driver_name || 'Driver', pos.driver_photo_url);

                          return (
                            <tr key={pos.id} style={{ background: focusedVehicleId === pos.id ? '#f0f7ff' : undefined }}>
                              <td>
                                <div style={{ fontWeight: 800 }}>{pos.registration_plate}</div>
                                <div className="type-caption">{pos.make} {pos.model} ({pos.car_type})</div>
                              </td>
                              <td>
                                <StatusBadge
                                  label={pos.energy_type === 'Electric' ? `EV ${pos.battery_percent ?? 100}%` : 'Gasoline'}
                                  tone={pos.energy_type === 'Electric' ? 'green' : 'neutral'}
                                />
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid #cbd5e1' }}>
                                    <img src={driverPhoto} alt={pos.driver_name || 'Driver'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 700 }}>{pos.driver_name}</div>
                                    {pos.driver_licence_number && <div className="type-caption mono">SIM: {pos.driver_licence_number}</div>}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <StatusBadge
                                  label={pos.status}
                                  tone={pos.status === 'IN_TRIP' ? 'blue' : pos.status === 'Active' ? 'green' : 'amber'}
                                />
                                {pos.active_trip && (
                                  <div className="type-caption" style={{ color: '#005bb5', marginTop: '2px' }}>
                                    Pax: <b>{pos.active_trip.passenger_nickname || 'Employee'}</b>
                                    <br />
                                    To: {pos.active_trip.destination}
                                  </div>
                                )}
                              </td>
                              <td style={{ fontSize: '13px' }}>{pos.location_label}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    className="gf-btn gf-btn-primary"
                                    style={{ minHeight: '32px', padding: '0 8px', fontSize: '12px' }}
                                    onClick={() => {
                                      setFocusedVehicleId(pos.id);
                                      document.getElementById('admin-fleet-map-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }}
                                    title="Locate Position on Map"
                                  >
                                    <Navigation size={12} style={{ marginRight: '4px' }} /> Locate
                                  </button>
                                  {pos.driver_phone && (
                                    <>
                                      <a
                                        href={formatWhatsAppUrl(pos.driver_phone)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="gf-btn gf-btn-secondary"
                                        style={{ minHeight: '32px', padding: '0 8px', fontSize: '12px', background: '#ebf5ff', color: '#005bb5', textDecoration: 'none' }}
                                        title="WhatsApp Chat"
                                      >
                                        WhatsApp
                                      </a>
                                      <a
                                        href={formatPhoneCallUrl(pos.driver_phone)}
                                        className="gf-btn gf-btn-secondary"
                                        style={{ minHeight: '32px', padding: '0 8px', fontSize: '12px', textDecoration: 'none' }}
                                        title="Phone Call"
                                      >
                                        Call
                                      </a>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {adminModule === 'ADMIN_DISPATCH' && (
            <>
              <section className="gf-card-flat">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserCheck size={18} /> {t('Pending Account Registrations')} ({pendingUsers.length})
                  </h2>
                  <button
                    type="button"
                    className="gf-btn gf-btn-primary"
                    onClick={async () => {
                      const res = await apiRequest('/api/notifications/send-reminders', { method: 'POST' });
                      setStatusBanner({ type: 'success', text: `Sent ${res.sentCount} booking & dispatch push reminders.` });
                      await loadAllData(user);
                    }}
                  >
                    <Bell size={16} /> {t('Send Upcoming Push Reminders')}
                  </button>
                </div>

                {pendingUsers.length === 0 ? (
                  <EmptyState message={t('All registered accounts have been reviewed.')} />
                ) : (
                  <>
                    <div className="gf-desktop-only-table">
                      <div className="gf-table-wrap">
                        <table className="gf-table">
                          <thead>
                            <tr>
                              <th>Nickname</th>
                              <th>Group Username</th>
                              <th>Group</th>
                              <th>Assign Role</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingUsers.map((u) => {
                              const roleVal = pendingRoleSelections[u.id] || u.role || 'EMP';
                              const groupVal = pendingGroupSelections[u.id] ?? u.department_id;
                              return (
                                <tr key={u.id}>
                                  <td style={{ fontWeight: 700 }}>{u.nickname}</td>
                                  <td className="mono">@{u.group_username}</td>
                                  <td>
                                    <select
                                      className="gf-select notranslate"
                                      translate="no"
                                      aria-label={`Assign group for ${u.nickname}`}
                                      style={{ minHeight: '38px', padding: '0 10px' }}
                                      value={groupVal}
                                      onChange={(e) =>
                                        setPendingGroupSelections({ ...pendingGroupSelections, [u.id]: Number(e.target.value) })
                                      }
                                    >
                                      {(activeGroups.length > 0 ? activeGroups : groupsList).map((g) => (
                                        <option key={g.id} value={g.id} className="notranslate" translate="no">
                                          {g.name}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td>
                                    <select
                                      className="gf-select"
                                      style={{ minHeight: '38px', padding: '0 10px' }}
                                      value={roleVal}
                                      onChange={(e) => {
                                        const nextRole = e.target.value;
                                        setPendingRoleSelections({ ...pendingRoleSelections, [u.id]: nextRole });
                                        if (nextRole === 'DRV' && driverGroupId) {
                                          setPendingGroupSelections({ ...pendingGroupSelections, [u.id]: driverGroupId });
                                        } else if (nextRole !== 'DRV' && groupVal === driverGroupId && u.department_id !== driverGroupId) {
                                          setPendingGroupSelections({ ...pendingGroupSelections, [u.id]: u.department_id });
                                        }
                                      }}
                                    >
                                      <option value="EMP">EMP (Employee)</option>
                                      <option value="DRV">DRV (Driver)</option>
                                      <option value="FM">FM (Fleet Operation PIC)</option>
                                      <option value="HWS">HWS (Head Of WS Part)</option>
                                      <option value="ADM">ADM (Admin)</option>
                                    </select>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <button type="button" className="gf-btn gf-btn-primary" onClick={() => handleApproveUser(u.id, true, roleVal, groupVal)}>
                                        Approve
                                      </button>
                                      <button type="button" className="gf-btn gf-btn-outline-danger" onClick={() => handleApproveUser(u.id, false, roleVal, groupVal)}>
                                        Reject
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="gf-mobile-only-cards">
                      {pendingUsers.map((u) => {
                        const roleVal = pendingRoleSelections[u.id] || u.role || 'EMP';
                        const groupVal = pendingGroupSelections[u.id] ?? u.department_id;
                        return (
                          <div key={u.id} className="gf-proto-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 800, fontSize: '14.5px' }}>{u.nickname}</span>
                              <span className="mono type-caption">@{u.group_username}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <select
                                className="gf-select notranslate"
                                translate="no"
                                aria-label={`Mobile group for ${u.nickname}`}
                                style={{ minHeight: '36px', padding: '0 8px', fontSize: '12.5px' }}
                                value={groupVal}
                                onChange={(e) =>
                                  setPendingGroupSelections({ ...pendingGroupSelections, [u.id]: Number(e.target.value) })
                                }
                              >
                                {(activeGroups.length > 0 ? activeGroups : groupsList).map((g) => (
                                  <option key={g.id} value={g.id} className="notranslate" translate="no">
                                    {g.name}
                                  </option>
                                ))}
                              </select>
                              <select
                                className="gf-select"
                                aria-label={`Mobile role for ${u.nickname}`}
                                style={{ minHeight: '36px', padding: '0 8px', fontSize: '12.5px' }}
                                value={roleVal}
                                onChange={(e) => {
                                  const nextRole = e.target.value;
                                  setPendingRoleSelections({ ...pendingRoleSelections, [u.id]: nextRole });
                                  if (nextRole === 'DRV' && driverGroupId) {
                                    setPendingGroupSelections({ ...pendingGroupSelections, [u.id]: driverGroupId });
                                  } else if (nextRole !== 'DRV' && groupVal === driverGroupId && u.department_id !== driverGroupId) {
                                    setPendingGroupSelections({ ...pendingGroupSelections, [u.id]: u.department_id });
                                  }
                                }}
                              >
                                <option value="EMP">EMP</option>
                                <option value="DRV">DRV</option>
                                <option value="FM">FM</option>
                                <option value="HWS">HWS</option>
                                <option value="ADM">ADM</option>
                              </select>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button type="button" className="gf-proto-btn gf-proto-btn-s pressable" style={{ flex: 1 }} onClick={() => handleApproveUser(u.id, true, roleVal, groupVal)}>
                                Approve
                              </button>
                              <button type="button" className="gf-proto-btn gf-proto-btn-r gf-proto-btn-s pressable" style={{ flex: 1 }} onClick={() => handleApproveUser(u.id, false, roleVal, groupVal)}>
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>

              <section className="gf-card-flat">
                <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <ShieldCheck size={18} /> {t('Vehicle Bookings & Dispatch Queue')} ({trips.length})
                </h2>
                {trips.length === 0 ? (
                  <EmptyState message={t('No vehicle bookings submitted yet.')} />
                ) : (
                  <>
                    <div className="gf-desktop-only-table">
                      <div className="gf-table-wrap">
                        <table className="gf-table">
                          <thead>
                            <tr>
                              <th>ID & Purpose</th>
                              <th>Requester & Group</th>
                              <th>Window</th>
                              <th>Vehicle & Driver</th>
                              <th>Status</th>
                              <th>Control</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trips.map((t) => (
                              <tr key={t.id}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700 }}>#{t.id} — {t.purpose}</span>
                                    {t.is_urgent === 1 && (
                                      <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', whiteSpace: 'nowrap' }}>
                                        🚨 URGENT (&lt; 2h)
                                      </span>
                                    )}
                                    {formatReservationModeLabel(t.reservation_type, t.return_pickup_time) && (
                                      <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#ebf5ff', color: '#005bb5', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>
                                        {formatReservationModeLabel(t.reservation_type, t.return_pickup_time)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="type-caption">{t.origin} → {t.destination} ({t.passenger_count} pax)</div>
                                  {t.urgent_reason && (
                                    <div className="type-caption" style={{ color: '#b91c1c', fontStyle: 'italic', marginTop: '2px' }}>
                                      Urgent Reason: {t.urgent_reason}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{t.requester_name}</div>
                                  <div className="type-caption">{t.department_name}</div>
                                </td>
                                <td className="mono type-caption">
                                  <div>{new Date(t.start_time).toLocaleString()}</div>
                                  <div>{new Date(t.end_time).toLocaleTimeString()}</div>
                                  {t.reservation_type === 'DROP_AND_PICKUP' && t.return_pickup_time && (
                                    <div style={{ color: '#005bb5', fontWeight: 700, marginTop: '2px' }}>
                                      Pick-Up: {new Date(t.return_pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <div style={{ fontWeight: 700 }}>{t.registration_plate}</div>
                                  <div className="type-caption">Driver: {t.assigned_driver_name || 'Unassigned'}</div>
                                </td>
                                <td>
                                  <StatusBadge label={t.status} tone={toneFromStatus(t.status)} />
                                  {t.status === 'PENDING_APPROVAL' && t.is_urgent === 1 && (
                                    <div style={{ marginTop: '3px', fontSize: '11px', fontWeight: 700, color: '#dc2626' }}>
                                      ⚠️ Requires Fleet Operation PIC Urgent Approval
                                    </div>
                                  )}
                                  {t.status === 'PENDING_APPROVAL' && t.requires_dual_approval && (
                                    <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: 600 }}>
                                      {t.pic_approved && !t.hws_approved ? (
                                        <span style={{ color: '#0072de' }}>✓ PIC Approved • Awaiting Head Of WS Part</span>
                                      ) : t.hws_approved && !t.pic_approved ? (
                                        <span style={{ color: '#005bb5' }}>✓ Head Of WS Part Approved • Awaiting PIC</span>
                                      ) : (
                                        <span style={{ color: '#d97706' }}>⏳ Pending PIC & Head Of WS Part</span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="gf-btn gf-btn-primary"
                                    onClick={() => {
                                      setDispatchModalTrip(t);
                                      setDispatchVehicleId(t.vehicle_id);
                                      const defaultDrv = t.driver_profile_id || t.preferred_driver_id || drivers[0]?.id || '';
                                      setDispatchDriverId(defaultDrv ? String(defaultDrv) : '');
                                      setDispatchDecisionReason('');
                                    }}
                                  >
                                    {t.status === 'PENDING_APPROVAL' ? 'Review & Dispatch' : 'Manage'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="gf-mobile-only-cards">
                      {trips.map((tr) => (
                        <div key={tr.id} className="gf-proto-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, fontSize: '14px' }}>#{tr.id} — {tr.purpose}</span>
                            <StatusBadge label={tr.status} tone={toneFromStatus(tr.status)} />
                          </div>

                          {(tr.is_urgent === 1 || formatReservationModeLabel(tr.reservation_type, tr.return_pickup_time)) && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {tr.is_urgent === 1 && (
                                <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}>
                                  🚨 URGENT (&lt; 2h)
                                </span>
                              )}
                              {formatReservationModeLabel(tr.reservation_type, tr.return_pickup_time) && (
                                <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#ebf5ff', color: '#005bb5', border: '1px solid #bfdbfe' }}>
                                  {formatReservationModeLabel(tr.reservation_type, tr.return_pickup_time)}
                                </span>
                              )}
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="gf-proto-pn" />
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{tr.origin}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="gf-proto-od" />
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{tr.destination}</span>
                          </div>

                          <div className="type-caption">
                            {new Date(tr.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – {new Date(tr.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {tr.passenger_count} pax · {tr.requester_name} ({tr.department_name})
                          </div>

                          {tr.urgent_reason && (
                            <div className="type-caption" style={{ color: '#b91c1c', fontStyle: 'italic' }}>
                              Urgent Reason: {tr.urgent_reason}
                            </div>
                          )}

                          {tr.status === 'PENDING_APPROVAL' && tr.requires_dual_approval && (
                            <div style={{ fontSize: '11.5px', fontWeight: 600 }}>
                              {tr.pic_approved && !tr.hws_approved ? (
                                <span style={{ color: '#0072de' }}>✓ PIC Approved • Awaiting Head Of WS Part</span>
                              ) : tr.hws_approved && !tr.pic_approved ? (
                                <span style={{ color: '#005bb5' }}>✓ Head Of WS Part Approved • Awaiting PIC</span>
                              ) : (
                                <span style={{ color: '#d97706' }}>⏳ Pending PIC & Head Of WS Part</span>
                              )}
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', paddingTop: '6px', borderTop: '1px solid var(--color-divider)' }}>
                            <div className="type-caption">
                              <strong className="mono">{tr.registration_plate || 'Pool'}</strong> · Driver: {tr.assigned_driver_name || 'Unassigned'}
                            </div>
                            <button
                              type="button"
                              className="gf-proto-btn gf-proto-btn-s pressable"
                              onClick={() => {
                                setDispatchModalTrip(tr);
                                setDispatchVehicleId(tr.vehicle_id);
                                const defaultDrv = tr.driver_profile_id || tr.preferred_driver_id || drivers[0]?.id || '';
                                setDispatchDriverId(defaultDrv ? String(defaultDrv) : '');
                                setDispatchDecisionReason('');
                              }}
                            >
                              {tr.status === 'PENDING_APPROVAL' ? t('Review & Dispatch') : t('Manage')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <section className="gf-card-flat">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <h2 className="type-section">{t('User Registry & Account Management')} ({usersList.length})</h2>
                    <p className="type-caption">Create approved accounts, assign groups (including Driver groups), deactivate/activate, or delete users</p>
                  </div>
                </div>

                <form onSubmit={handleCreateUserByAdmin} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: '10px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--color-divider)' }}>
                  <input
                    type="text"
                    className="gf-input"
                    required
                    placeholder="Nickname / Full Name"
                    value={newUserForm.nickname}
                    onChange={(e) => setNewUserForm({ ...newUserForm, nickname: e.target.value })}
                  />
                  <input
                    type="text"
                    className="gf-input"
                    required
                    placeholder="Group Username"
                    value={newUserForm.group_username}
                    onChange={(e) => setNewUserForm({ ...newUserForm, group_username: e.target.value })}
                  />
                  <input
                    type="password"
                    className="gf-input"
                    required
                    minLength={6}
                    placeholder="Password (min 6 chars)"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  />
                  <select
                    className="gf-select notranslate"
                    translate="no"
                    aria-label="User group"
                    value={newUserForm.department_id}
                    onChange={(e) => setNewUserForm({ ...newUserForm, department_id: Number(e.target.value) })}
                  >
                    {activeGroups.map((g) => (
                      <option key={g.id} value={g.id} className="notranslate" translate="no">{g.name}</option>
                    ))}
                  </select>
                  <select
                    className="gf-select"
                    aria-label="User role"
                    value={newUserForm.role}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      const defaultEmpGroup = activeGroups[0]?.id || groupsList[0]?.id || 1;
                      let nextDeptId = newUserForm.department_id;
                      if (nextRole === 'DRV' && driverGroupId) {
                        nextDeptId = driverGroupId;
                      } else if (nextRole !== 'DRV' && newUserForm.department_id === driverGroupId && defaultEmpGroup !== driverGroupId) {
                        nextDeptId = defaultEmpGroup;
                      }
                      setNewUserForm({ ...newUserForm, role: nextRole, department_id: nextDeptId });
                    }}
                  >
                    <option value="EMP">EMP (Employee)</option>
                    <option value="DRV">DRV (Driver Account)</option>
                    <option value="FM">FM (Fleet Operation PIC)</option>
                    <option value="HWS">HWS (Head Of WS Part)</option>
                    <option value="ADM">ADM (Admin)</option>
                  </select>
                  <button type="submit" className="gf-btn gf-btn-primary">
                    <Plus size={16} /> {t('Create User')}
                  </button>
                </form>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <Chip active={userFilterTab === 'ALL'} onClick={() => setUserFilterTab('ALL')}>
                      All ({usersList.length})
                    </Chip>
                    <Chip active={userFilterTab === 'PENDING'} onClick={() => setUserFilterTab('PENDING')}>
                      Pending ({pendingUsers.length})
                    </Chip>
                    <Chip active={userFilterTab === 'DRIVERS'} onClick={() => setUserFilterTab('DRIVERS')}>
                      Drivers ({usersList.filter((u) => u.role === 'DRV').length})
                    </Chip>
                    <Chip active={userFilterTab === 'INACTIVE'} onClick={() => setUserFilterTab('INACTIVE')}>
                      Deactivated ({usersList.filter((u) => u.is_active === 0).length})
                    </Chip>
                  </div>
                  <input
                    type="search"
                    className="gf-input"
                    style={{ maxWidth: '260px', minHeight: '38px' }}
                    placeholder="Search nickname or @username..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                  />
                </div>

                {(() => {
                  const filteredRegistryUsers = usersList.filter((u) => {
                    if (userFilterTab === 'PENDING' && u.approval_status !== 'PENDING_APPROVAL') return false;
                    if (userFilterTab === 'DRIVERS' && u.role !== 'DRV') return false;
                    if (userFilterTab === 'INACTIVE' && u.is_active !== 0) return false;
                    if (userSearchQuery.trim()) {
                      const q = userSearchQuery.trim().toLowerCase();
                      return (
                        String(u.nickname || '').toLowerCase().includes(q) ||
                        String(u.group_username || '').toLowerCase().includes(q) ||
                        String(u.department_name || '').toLowerCase().includes(q)
                      );
                    }
                    return true;
                  });

                  return (
                    <>
                      <div className="gf-desktop-only-table">
                        <div className="gf-table-wrap">
                          <table className="gf-table">
                            <thead>
                              <tr>
                                <th>Nickname & Username</th>
                                <th>Group (Department)</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Actions (Approve / Deactivate / Delete)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredRegistryUsers.map((u) => {
                                const isSelf = u.id === user.id;
                                return (
                                  <tr key={u.id} style={{ opacity: u.is_active === 0 ? 0.65 : 1 }}>
                                    <td>
                                      <div style={{ fontWeight: 700 }}>{u.nickname}</div>
                                      <div className="mono type-caption">@{u.group_username}</div>
                                    </td>
                                    <td>
                                      <select
                                        className="gf-select notranslate"
                                        translate="no"
                                        style={{ minHeight: '36px', padding: '0 8px' }}
                                        aria-label={`Group for ${u.nickname}`}
                                        value={u.department_id}
                                        onChange={(e) => handleUpdateUserRoleOrGroup(u.id, { department_id: Number(e.target.value) })}
                                      >
                                        {activeGroups.map((g) => (
                                          <option key={g.id} value={g.id} className="notranslate" translate="no">
                                            {g.name}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td>
                                      <select
                                        className="gf-select"
                                        style={{ minHeight: '36px', padding: '0 8px' }}
                                        aria-label={`Role for ${u.nickname}`}
                                        value={u.role}
                                        onChange={(e) => handleUpdateUserRoleOrGroup(u.id, { role: e.target.value })}
                                      >
                                        <option value="EMP">EMP (Employee)</option>
                                        <option value="DRV">DRV (Driver)</option>
                                        <option value="FM">FM (Fleet Operation PIC)</option>
                                        <option value="HWS">HWS (Head Of WS Part)</option>
                                        <option value="ADM">ADM (Admin)</option>
                                      </select>
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                        <StatusBadge label={u.approval_status} tone={toneFromStatus(u.approval_status)} />
                                        <StatusBadge label={u.is_active === 1 ? 'Active' : 'Deactivated'} tone={u.is_active === 1 ? 'green' : 'red'} />
                                      </div>
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {u.approval_status !== 'APPROVED' && (
                                          <button
                                            type="button"
                                            className="gf-btn gf-btn-primary"
                                            style={{ minHeight: '34px', padding: '0 10px' }}
                                            onClick={() => handleApproveUser(u.id, true, u.role, u.department_id)}
                                          >
                                            Approve
                                          </button>
                                        )}
                                        <button
                                          id={`toggle-user-active-${u.id}`}
                                          type="button"
                                          className="gf-btn gf-btn-secondary"
                                          style={{ minHeight: '34px', padding: '0 10px' }}
                                          disabled={isSelf}
                                          onClick={() => handleToggleUserActive(u)}
                                          title={u.is_active === 1 ? 'Deactivate user account' : 'Reactivate user account'}
                                        >
                                          <Power size={14} /> {u.is_active === 1 ? t('Deactivate') : t('Activate')}
                                        </button>
                                        <button
                                          id={`delete-user-${u.id}`}
                                          type="button"
                                          className="gf-btn gf-btn-outline-danger"
                                          style={{ minHeight: '34px', padding: '0 10px' }}
                                          disabled={isSelf}
                                          onClick={() => handleDeleteUser(u)}
                                          title="Permanently delete user account"
                                        >
                                          <Trash2 size={14} /> Delete
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="gf-mobile-only-cards">
                        {filteredRegistryUsers.map((u) => {
                          const isSelf = u.id === user.id;
                          return (
                            <div key={u.id} className="gf-proto-card" style={{ opacity: u.is_active === 0 ? 0.65 : 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '14.5px' }}>{u.nickname}</div>
                                  <div className="mono type-caption">@{u.group_username}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  <StatusBadge label={u.approval_status} tone={toneFromStatus(u.approval_status)} />
                                  <StatusBadge label={u.is_active === 1 ? 'Active' : 'Deactivated'} tone={u.is_active === 1 ? 'blue' : 'red'} />
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <select
                                  className="gf-select notranslate"
                                  translate="no"
                                  style={{ minHeight: '36px', padding: '0 8px', fontSize: '12.5px' }}
                                  aria-label={`Mobile group for ${u.nickname}`}
                                  value={u.department_id}
                                  onChange={(e) => handleUpdateUserRoleOrGroup(u.id, { department_id: Number(e.target.value) })}
                                >
                                  {activeGroups.map((g) => (
                                    <option key={g.id} value={g.id} className="notranslate" translate="no">
                                      {g.name}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  className="gf-select"
                                  style={{ minHeight: '36px', padding: '0 8px', fontSize: '12.5px' }}
                                  aria-label={`Mobile role for ${u.nickname}`}
                                  value={u.role}
                                  onChange={(e) => handleUpdateUserRoleOrGroup(u.id, { role: e.target.value })}
                                >
                                  <option value="EMP">EMP</option>
                                  <option value="DRV">DRV</option>
                                  <option value="FM">FM</option>
                                  <option value="HWS">HWS</option>
                                  <option value="ADM">ADM</option>
                                </select>
                              </div>

                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {u.approval_status !== 'APPROVED' && (
                                  <button
                                    type="button"
                                    className="gf-proto-btn gf-proto-btn-s pressable"
                                    onClick={() => handleApproveUser(u.id, true, u.role, u.department_id)}
                                  >
                                    Approve
                                  </button>
                                )}
                                <button
                                  id={`mobile-toggle-user-active-${u.id}`}
                                  type="button"
                                  className="gf-proto-btn gf-proto-btn-o gf-proto-btn-s pressable"
                                  disabled={isSelf}
                                  onClick={() => handleToggleUserActive(u)}
                                >
                                  <Power size={13} /> {u.is_active === 1 ? t('Deactivate') : t('Activate')}
                                </button>
                                <button
                                  id={`mobile-delete-user-${u.id}`}
                                  type="button"
                                  className="gf-proto-btn gf-proto-btn-r gf-proto-btn-s pressable"
                                  disabled={isSelf}
                                  onClick={() => handleDeleteUser(u)}
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </section>
            </>
          )}

          {adminModule === 'FLEET_OPS' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(['VEHICLES', 'DRIVERS', 'GROUPS', 'FUEL_EV', 'MAINTENANCE', 'EXPENSES', 'DOCUMENTS'] as const).map((sub) => (
                    <Chip key={sub} active={opsSubTab === sub} onClick={() => setOpsSubTab(sub)}>
                      {t(sub.replace('_', ' & '))}
                    </Chip>
                  ))}
                </div>
                {user?.role === 'ADM' && (
                  <button
                    type="button"
                    className="gf-btn pressable"
                    onClick={() => setShowResetModal(true)}
                    style={{ background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', fontWeight: 800, fontSize: '12px', minHeight: '34px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Reset test operational data to insert real data"
                  >
                    <Trash2 size={14} /> Reset Data / Production Setup
                  </button>
                )}
              </div>

              {opsSubTab === 'VEHICLES' && (
                <section className="gf-card-flat">
                  <h2 className="type-section" style={{ marginBottom: '12px' }}>Register New Vehicle</h2>
                  <form onSubmit={handleCreateVehicle} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--color-divider)' }}>
                    <input
                      type="text"
                      className="gf-input"
                      required
                      placeholder="License Plate (e.g. B 1001 GF)"
                      value={newVehicleForm.registration_plate}
                      onChange={(e) => setNewVehicleForm({ ...newVehicleForm, registration_plate: e.target.value })}
                    />
                    <input
                      type="text"
                      className="gf-input"
                      required
                      placeholder="Make (e.g. Toyota)"
                      value={newVehicleForm.make}
                      onChange={(e) => setNewVehicleForm({ ...newVehicleForm, make: e.target.value })}
                    />
                    <input
                      type="text"
                      className="gf-input"
                      required
                      placeholder="Model (e.g. Innova Zenix)"
                      value={newVehicleForm.model}
                      onChange={(e) => setNewVehicleForm({ ...newVehicleForm, model: e.target.value })}
                    />
                    <input
                      type="text"
                      className="gf-input"
                      required
                      placeholder="Car Type (MPV / SUV / Sedan)"
                      value={newVehicleForm.car_type}
                      onChange={(e) => setNewVehicleForm({ ...newVehicleForm, car_type: e.target.value })}
                    />
                    <select
                      className="gf-select"
                      value={newVehicleForm.energy_type}
                      onChange={(e) => setNewVehicleForm({ ...newVehicleForm, energy_type: e.target.value as 'Gasoline' | 'Electric' })}
                    >
                      <option value="Gasoline">Gasoline</option>
                      <option value="Electric">Electric (EV)</option>
                    </select>
                    <input
                      type="number"
                      className="gf-input"
                      min={1}
                      max={20}
                      placeholder="Seats"
                      value={newVehicleForm.seats}
                      onChange={(e) => setNewVehicleForm({ ...newVehicleForm, seats: e.target.value })}
                    />
                    <input
                      type="number"
                      className="gf-input"
                      min={0}
                      placeholder="Odometer (km)"
                      value={newVehicleForm.current_odometer}
                      onChange={(e) => setNewVehicleForm({ ...newVehicleForm, current_odometer: e.target.value })}
                    />
                    {newVehicleForm.energy_type === 'Electric' && (
                      <input
                        type="number"
                        className="gf-input"
                        min={0}
                        max={100}
                        placeholder="Battery %"
                        value={newVehicleForm.battery_percent}
                        onChange={(e) => setNewVehicleForm({ ...newVehicleForm, battery_percent: e.target.value })}
                      />
                    )}
                    <input
                      type="text"
                      className="gf-input"
                      placeholder="Parking Spot"
                      value={newVehicleForm.last_parking_spot}
                      onChange={(e) => setNewVehicleForm({ ...newVehicleForm, last_parking_spot: e.target.value })}
                    />
                    <select
                      className="gf-select"
                      value={newVehicleForm.default_driver_id}
                      onChange={(e) => setNewVehicleForm({ ...newVehicleForm, default_driver_id: e.target.value })}
                    >
                      <option value="">No Dedicated Driver (Pool Driver)</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name} ({d.contact_number || 'No Phone'})
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="gf-btn gf-btn-primary">
                      <Plus size={16} /> Add Vehicle
                    </button>
                  </form>

                  <h2 className="type-section" style={{ marginBottom: '12px' }}>Fleet Register ({vehicles.length} Cars — Edit Plate, Type & Standby)</h2>
                  {vehicles.length === 0 ? (
                    <EmptyState message="No vehicles in the fleet yet. Use the form above to add your first car." />
                  ) : (
                    <div className="gf-table-wrap">
                      <table className="gf-table">
                        <thead>
                          <tr>
                            <th>Plate</th>
                            <th>Model</th>
                            <th>Dedicated Driver</th>
                            <th>Type</th>
                            <th>Energy</th>
                            <th>Odometer</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vehicles.map((v) => (
                            <tr key={v.id}>
                              <td className="mono" style={{ fontWeight: 700 }}>{v.registration_plate}</td>
                              <td>
                                <div style={{ fontWeight: 700 }}>{v.make} {v.model}</div>
                                <div className="type-caption">{v.seats} seats • VIN {v.vin}</div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{v.default_driver_name || 'Pool Driver'}</div>
                                {v.default_driver_phone && <div className="type-caption mono">{v.default_driver_phone}</div>}
                              </td>
                              <td>{v.car_type}</td>
                              <td>
                                <StatusBadge
                                  label={v.energy_type === 'Electric' ? `EV ${v.battery_percent ?? 100}%` : 'Gasoline'}
                                  tone={v.energy_type === 'Electric' ? 'green' : 'neutral'}
                                />
                              </td>
                              <td className="mono">{Number(v.current_odometer || 0).toLocaleString()} km</td>
                              <td>
                                <StatusBadge label={v.status} tone={toneFromStatus(v.status)} />
                                {v.standby_reason && <div className="type-caption">{v.standby_reason}</div>}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button type="button" className="gf-btn gf-btn-secondary" onClick={() => setEditingVehicle({ ...v })}>
                                    <Edit3 size={15} /> Edit
                                  </button>
                                  <button type="button" className="gf-btn gf-btn-primary" onClick={() => openVehicle360(v.id)}>
                                    360°
                                  </button>
                                  <button type="button" className="gf-btn gf-btn-outline-danger" onClick={() => handleDeleteVehicle(v)} title="Delete Vehicle">
                                    <Trash2 size={15} /> Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {opsSubTab === 'DRIVERS' && (
                <section className="gf-card-flat">
                  <h2 className="type-section" style={{ marginBottom: '12px' }}>Register / Update Driver Profile & Group</h2>
                  <form onSubmit={handleSaveDriverProfile} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--color-divider)' }}>
                    <select
                      className="gf-select"
                      value={newDriverForm.user_id}
                      onChange={(e) => {
                        const uid = e.target.value;
                        const found = usersList.find((u) => String(u.id) === uid);
                        setNewDriverForm({
                          ...newDriverForm,
                          user_id: uid,
                          full_name: found ? found.nickname : newDriverForm.full_name,
                          department_id: found?.department_id || newDriverForm.department_id,
                        });
                      }}
                    >
                      <option value="">Link User Account</option>
                      {usersList
                        .filter((u) => u.role === 'DRV' || u.approval_status === 'APPROVED')
                        .map((u) => (
                          <option key={u.id} value={String(u.id)}>
                            {u.nickname} (@{u.group_username} • {u.department_name || u.role})
                          </option>
                        ))}
                    </select>
                    <select
                      className="gf-select notranslate"
                      translate="no"
                      aria-label="Driver Group"
                      value={newDriverForm.department_id}
                      onChange={(e) => setNewDriverForm({ ...newDriverForm, department_id: Number(e.target.value) })}
                    >
                      {activeGroups.map((g) => (
                        <option key={g.id} value={g.id} className="notranslate" translate="no">
                          Group: {g.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="gf-input"
                      required
                      placeholder="Driver Full Name"
                      value={newDriverForm.full_name}
                      onChange={(e) => setNewDriverForm({ ...newDriverForm, full_name: e.target.value })}
                    />
                    <input
                      type="text"
                      className="gf-input"
                      required
                      placeholder="Licence Number"
                      value={newDriverForm.licence_number}
                      onChange={(e) => setNewDriverForm({ ...newDriverForm, licence_number: e.target.value })}
                    />
                    <select
                      className="gf-select"
                      value={newDriverForm.licence_class}
                      onChange={(e) => setNewDriverForm({ ...newDriverForm, licence_class: e.target.value })}
                    >
                      <option value="A">Class A</option>
                      <option value="B1">Class B1</option>
                      <option value="B2">Class B2</option>
                    </select>
                    <input
                      type="date"
                      className="gf-input"
                      required
                      value={newDriverForm.licence_expiry}
                      onChange={(e) => setNewDriverForm({ ...newDriverForm, licence_expiry: e.target.value })}
                    />
                    <input
                      type="text"
                      className="gf-input"
                      placeholder="Phone / Contact"
                      value={newDriverForm.contact_number}
                      onChange={(e) => setNewDriverForm({ ...newDriverForm, contact_number: e.target.value })}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', gridColumn: '1 / -1', background: 'var(--color-bg-subtle)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-divider)' }}>
                      <img
                        src={newDriverForm.photo_url || getDriverAvatarDataUri(newDriverForm.full_name || 'Driver')}
                        alt="Driver Preview"
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-samsung-blue)' }}
                      />
                      <label className="gf-btn gf-btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0, minHeight: '34px', fontSize: '13px' }}>
                        <Camera size={14} /> {newDriverForm.photo_url ? 'Change Driver Photo' : 'Upload Driver Photo'}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setNewDriverForm({ ...newDriverForm, photo_url: String(ev.target?.result || '') });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {newDriverForm.photo_url && (
                        <button
                          type="button"
                          className="gf-btn gf-btn-ghost"
                          style={{ minHeight: '32px', padding: '0 8px', fontSize: '12px', color: 'var(--color-red)' }}
                          onClick={() => setNewDriverForm({ ...newDriverForm, photo_url: '' })}
                        >
                          Remove Photo
                        </button>
                      )}
                      <span className="type-caption" style={{ fontSize: '12px' }}>
                        {newDriverForm.photo_url ? 'Custom photo attached' : 'Default high-resolution avatar will be generated if no photo uploaded'}
                      </span>
                    </div>
                    <button type="submit" className="gf-btn gf-btn-primary">
                      <Plus size={16} /> Save Driver
                    </button>
                  </form>

                  <h2 className="type-section" style={{ marginBottom: '12px' }}>Driver Profiles & Groups ({drivers.length})</h2>
                  {drivers.length === 0 ? (
                    <EmptyState message="No driver profiles registered yet. Approve a driver user or add a driver above." />
                  ) : (
                    <div className="gf-table-wrap">
                      <table className="gf-table">
                        <thead>
                          <tr>
                            <th>Photo</th>
                            <th>Driver</th>
                            <th>Username</th>
                            <th>Driver Group</th>
                            <th>Licence</th>
                            <th>Expiry</th>
                            <th>Status</th>
                            <th>Toggle Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drivers.map((d) => (
                            <tr key={d.id}>
                              <td>
                                <div style={{ position: 'relative', width: '38px', height: '38px', flexShrink: 0 }}>
                                  <img
                                    src={getDriverAvatarDataUri(d.full_name, d.photo_url)}
                                    alt={d.full_name}
                                    style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-divider)' }}
                                  />
                                  <label
                                    title="Upload or change driver photo"
                                    style={{
                                      position: 'absolute',
                                      bottom: '-2px',
                                      right: '-2px',
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '50%',
                                      background: 'var(--color-samsung-blue)',
                                      color: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                    }}
                                  >
                                    <Camera size={10} />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      style={{ display: 'none' }}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = async (ev) => {
                                            const base64 = String(ev.target?.result || '');
                                            try {
                                              await apiRequest(`/api/drivers/${d.id}`, {
                                                method: 'PATCH',
                                                body: JSON.stringify({ photo_url: base64 }),
                                              });
                                              setStatusBanner({ type: 'success', text: `Photo updated for driver ${d.full_name}.` });
                                              await loadAllData(user);
                                            } catch (err: any) {
                                              setStatusBanner({ type: 'danger', text: err.message });
                                            }
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              </td>
                              <td style={{ fontWeight: 700 }}>{d.full_name}</td>
                              <td className="mono">{d.group_username ? `@${d.group_username}` : '—'}</td>
                              <td>
                                <select
                                  className="gf-select notranslate"
                                  translate="no"
                                  style={{ minHeight: '36px', padding: '0 8px' }}
                                  aria-label={`Driver group for ${d.full_name}`}
                                  value={d.department_id || driverGroupId}
                                  onChange={async (e) => {
                                    await apiRequest(`/api/drivers/${d.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ department_id: Number(e.target.value) }),
                                    });
                                    setStatusBanner({ type: 'success', text: `Updated group for driver ${d.full_name}.` });
                                    await loadAllData(user);
                                  }}
                                >
                                  {activeGroups.map((g) => (
                                    <option key={g.id} value={g.id} className="notranslate" translate="no">
                                      {g.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="mono">{d.licence_number} (Class {d.licence_class})</td>
                              <td className="mono">{d.licence_expiry}</td>
                              <td><StatusBadge label={d.availability_status} tone={toneFromStatus(d.availability_status)} /></td>
                              <td>
                                <select
                                  className="gf-select"
                                  style={{ minHeight: '36px', padding: '0 8px' }}
                                  value={d.availability_status}
                                  onChange={async (e) => {
                                    await apiRequest(`/api/drivers/${d.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ availability_status: e.target.value }),
                                    });
                                    await loadAllData(user);
                                  }}
                                >
                                  <option value="Active">Active</option>
                                  <option value="On Leave">On Leave</option>
                                  <option value="Unavailable">Unavailable</option>
                                </select>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="gf-btn gf-btn-secondary"
                                    style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                                    onClick={() => {
                                      setNewDriverForm({
                                        user_id: d.user_id ? String(d.user_id) : '',
                                        full_name: d.full_name,
                                        department_id: d.department_id || driverGroupId,
                                        licence_number: d.licence_number || '',
                                        licence_class: d.licence_class || 'A',
                                        licence_expiry: d.licence_expiry || new Date().toISOString().slice(0, 10),
                                        contact_number: d.contact_number || '',
                                        availability_status: d.availability_status || 'Active',
                                        photo_url: d.photo_url || '',
                                      });
                                      setStatusBanner({ type: 'info', text: `Loaded driver ${d.full_name} into form above for editing.` });
                                    }}
                                  >
                                    <Edit3 size={13} /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="gf-btn gf-btn-outline-danger"
                                    style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                                    onClick={() => handleDeleteDriver(d)}
                                    title="Delete Driver Profile"
                                  >
                                    <Trash2 size={13} /> Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {opsSubTab === 'GROUPS' && (
                <section className="gf-card-flat">
                  <h2 className="type-section" style={{ marginBottom: '12px' }}>Company Groups ({groupsList.length})</h2>
                  <form onSubmit={handleCreateGroup} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <input
                      type="text"
                      className="gf-input"
                      style={{ flex: '1 1 240px' }}
                      placeholder="New Group name"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                    <button type="submit" className="gf-btn gf-btn-primary">
                      <Plus size={16} /> Add Group
                    </button>
                  </form>
                  <div className="gf-table-wrap">
                    <table className="gf-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Group Name</th>
                          <th>Code</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupsList.map((g) => (
                          <tr key={g.id}>
                            <td className="mono">#{g.id}</td>
                            <td style={{ fontWeight: 700 }} className="notranslate" translate="no">{g.name}</td>
                            <td className="mono notranslate" translate="no">{g.code || '—'}</td>
                            <td><StatusBadge label={g.is_active === 0 ? 'Inactive' : 'Active'} tone={g.is_active === 0 ? 'neutral' : 'green'} /></td>
                            <td>
                              {g.is_active === 0 ? (
                                <button
                                  type="button"
                                  className="gf-btn gf-btn-primary"
                                  style={{ minHeight: '30px', padding: '0 10px', fontSize: '12px' }}
                                  onClick={async () => {
                                    await apiRequest(`/api/departments/${g.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ is_active: 1 }),
                                    });
                                    setStatusBanner({ type: 'success', text: `Group "${g.name}" activated.` });
                                    await loadAllData(user);
                                  }}
                                >
                                  Activate
                                </button>
                              ) : (
                                <span className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>Official / Active</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {opsSubTab === 'FUEL_EV' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                  <section className="gf-card-flat">
                    <h2 className="type-section" style={{ marginBottom: '12px' }}>Gasoline Fuel Records (Litres)</h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          await apiRequest('/api/fuel', {
                            method: 'POST',
                            body: JSON.stringify({
                              vehicle_id: Number(fuelForm.vehicle_id),
                              litres: Number(fuelForm.litres),
                              cost: Number(fuelForm.cost),
                              odometer_km: Number(fuelForm.odometer_km),
                              station: fuelForm.station,
                            }),
                          });
                          setStatusBanner({ type: 'success', text: 'Gasoline fuel record saved.' });
                          await loadAllData(user);
                        } catch (err: any) {
                          setStatusBanner({ type: 'danger', text: err.message });
                        }
                      }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}
                    >
                      <select className="gf-select" value={fuelForm.vehicle_id} onChange={(e) => setFuelForm({ ...fuelForm, vehicle_id: Number(e.target.value) })}>
                        <option value={0}>Select Vehicle</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>{v.registration_plate} ({v.energy_type})</option>
                        ))}
                      </select>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <input type="number" step="0.1" className="gf-input" required placeholder="Litres" value={fuelForm.litres} onChange={(e) => setFuelForm({ ...fuelForm, litres: e.target.value })} />
                        <input type="number" step="0.01" className="gf-input" required placeholder="Cost" value={fuelForm.cost} onChange={(e) => setFuelForm({ ...fuelForm, cost: e.target.value })} />
                        <input type="number" className="gf-input" required placeholder="Odo km" value={fuelForm.odometer_km} onChange={(e) => setFuelForm({ ...fuelForm, odometer_km: e.target.value })} />
                      </div>
                      <button type="submit" className="gf-btn gf-btn-primary" disabled={vehicles.length === 0}>Record Fuel</button>
                    </form>
                    <div className="gf-table-wrap">
                      <table className="gf-table">
                        <thead><tr><th>Plate</th><th>Litres</th><th>Cost</th><th>Odo</th></tr></thead>
                        <tbody>
                          {fuelRecords.map((f) => (
                            <tr key={f.id}><td>{f.registration_plate}</td><td className="mono">{f.litres} L</td><td className="mono" style={{ fontWeight: 700 }}>{formatIdr(f.cost)}</td><td className="mono">{f.odometer_km} km</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="gf-card-flat">
                    <h2 className="type-section" style={{ marginBottom: '12px' }}>EV Charging Records (kWh)</h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          await apiRequest('/api/ev-charging', {
                            method: 'POST',
                            body: JSON.stringify({
                              vehicle_id: Number(evForm.vehicle_id),
                              kwh_added: Number(evForm.kwh_added),
                              cost: Number(evForm.cost || 0),
                              battery_start_pct: Number(evForm.battery_start_pct),
                              battery_end_pct: Number(evForm.battery_end_pct),
                              odometer_km: Number(evForm.odometer_km || 0),
                              station: evForm.station,
                            }),
                          });
                          setStatusBanner({ type: 'success', text: 'EV charging session recorded.' });
                          await loadAllData(user);
                        } catch (err: any) {
                          setStatusBanner({ type: 'danger', text: err.message });
                        }
                      }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}
                    >
                      <select className="gf-select" value={evForm.vehicle_id} onChange={(e) => setEvForm({ ...evForm, vehicle_id: Number(e.target.value) })}>
                        <option value={0}>Select EV</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>{v.registration_plate} ({v.energy_type})</option>
                        ))}
                      </select>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <input type="number" step="0.1" className="gf-input" required placeholder="kWh" value={evForm.kwh_added} onChange={(e) => setEvForm({ ...evForm, kwh_added: e.target.value })} />
                        <input type="number" className="gf-input" required placeholder="Start %" value={evForm.battery_start_pct} onChange={(e) => setEvForm({ ...evForm, battery_start_pct: e.target.value })} />
                        <input type="number" className="gf-input" required placeholder="End %" value={evForm.battery_end_pct} onChange={(e) => setEvForm({ ...evForm, battery_end_pct: e.target.value })} />
                      </div>
                      <button type="submit" className="gf-btn gf-btn-primary" disabled={vehicles.length === 0}>Record EV Session</button>
                    </form>
                    <div className="gf-table-wrap">
                      <table className="gf-table">
                        <thead><tr><th>EV</th><th>kWh</th><th>SoC</th><th>Cost</th></tr></thead>
                        <tbody>
                          {evRecords.map((ev) => (
                            <tr key={ev.id}><td>{ev.registration_plate}</td><td className="mono">{ev.kwh_added} kWh</td><td className="mono">{ev.battery_start_pct}% → {ev.battery_end_pct}%</td><td className="mono" style={{ fontWeight: 700 }}>{formatIdr(ev.cost)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {opsSubTab === 'MAINTENANCE' && (
                <section className="gf-card-flat">
                  <h2 className="type-section" style={{ marginBottom: '12px' }}>Maintenance Schedule</h2>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await apiRequest('/api/maintenance', {
                          method: 'POST',
                          body: JSON.stringify({
                            ...maintForm,
                            vehicle_id: Number(maintForm.vehicle_id),
                            cost: Number(maintForm.cost || 0),
                            service_date: new Date(maintForm.service_date).toISOString(),
                            end_date: new Date(maintForm.end_date).toISOString(),
                          }),
                        });
                        setStatusBanner({ type: 'success', text: 'Maintenance scheduled.' });
                        await loadAllData(user);
                      } catch (err: any) {
                        setStatusBanner({ type: 'danger', text: err.message });
                      }
                    }}
                    style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}
                  >
                    <select className="gf-select" style={{ flex: '1 1 180px' }} value={maintForm.vehicle_id} onChange={(e) => setMaintForm({ ...maintForm, vehicle_id: Number(e.target.value) })}>
                      <option value={0}>Select Vehicle</option>
                      {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registration_plate} ({v.energy_type})</option>)}
                    </select>
                    <input type="text" className="gf-input" style={{ flex: '1 1 200px' }} value={maintForm.maintenance_type} onChange={(e) => setMaintForm({ ...maintForm, maintenance_type: e.target.value })} />
                    <select className="gf-select" style={{ flex: '1 1 160px' }} value={maintForm.applicable_energy_type} onChange={(e) => setMaintForm({ ...maintForm, applicable_energy_type: e.target.value })}>
                      <option value="Both">Both Gas & EV</option>
                      <option value="Gasoline">Gasoline Only</option>
                      <option value="Electric">Electric Only</option>
                    </select>
                    <button type="submit" className="gf-btn gf-btn-primary" disabled={vehicles.length === 0}>Schedule</button>
                  </form>
                  <div className="gf-table-wrap">
                    <table className="gf-table">
                      <thead><tr><th>Vehicle</th><th>Type</th><th>Date</th><th>Cost (IDR)</th><th>Status</th></tr></thead>
                      <tbody>
                        {maintenanceRecords.map((m) => (
                          <tr key={m.id}><td>{m.registration_plate}</td><td>{m.maintenance_type} ({m.applicable_energy_type})</td><td className="mono">{new Date(m.service_date).toLocaleDateString()}</td><td className="mono" style={{ fontWeight: 700 }}>{formatIdr(m.cost)}</td><td><StatusBadge label={m.status} tone="amber" /></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {opsSubTab === 'EXPENSES' && (
                <section className="gf-card-flat">
                  <h2 className="type-section" style={{ marginBottom: '12px' }}>Expenses</h2>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await apiRequest('/api/expenses', {
                          method: 'POST',
                          body: JSON.stringify({
                            vehicle_id: Number(expForm.vehicle_id),
                            category: expForm.category,
                            amount: Number(expForm.amount),
                            description: expForm.description,
                          }),
                        });
                        setStatusBanner({ type: 'success', text: 'Expense submitted.' });
                        await loadAllData(user);
                      } catch (err: any) {
                        setStatusBanner({ type: 'danger', text: err.message });
                      }
                    }}
                    style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}
                  >
                    <select className="gf-select" style={{ flex: '1 1 150px' }} value={expForm.vehicle_id} onChange={(e) => setExpForm({ ...expForm, vehicle_id: Number(e.target.value) })}>
                      <option value={0}>Select Vehicle</option>
                      {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registration_plate}</option>)}
                    </select>
                    <select className="gf-select" style={{ flex: '1 1 140px' }} value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}>
                      <option value="Toll">Toll</option>
                      <option value="Parking">Parking</option>
                      <option value="Gas">Gas (Gasoline)</option>
                      <option value="Charging">Charging (EV)</option>
                      <option value="Cleaning">Cleaning</option>
                      <option value="Accessories">Accessories</option>
                      <option value="Other">Other</option>
                    </select>
                    <input type="number" step="0.01" className="gf-input" required placeholder="Amount" style={{ flex: '1 1 120px' }} value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} />
                    <input type="text" className="gf-input" placeholder="Description" style={{ flex: '1 1 200px' }} value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} />
                    <button type="submit" className="gf-btn gf-btn-primary" disabled={vehicles.length === 0}>Submit</button>
                  </form>
                  <div className="gf-table-wrap">
                    <table className="gf-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Plate</th>
                          <th>Category</th>
                          <th>Submitted By</th>
                          <th>Amount</th>
                          <th>Receipt</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.length === 0 ? (
                          <tr><td colSpan={8} style={{ textAlign: 'center', padding: '16px' }} className="type-caption">No expense records or reimbursement claims.</td></tr>
                        ) : (
                          expenses.map((ex) => (
                            <tr key={ex.id}>
                              <td className="mono">{new Date(ex.date_time).toLocaleDateString()}</td>
                              <td className="mono" style={{ fontWeight: 700 }}>{ex.registration_plate}</td>
                              <td>
                                <span style={{ fontWeight: 600 }}>{ex.category}</span>
                                {ex.description && <div className="type-caption">{ex.description}</div>}
                              </td>
                              <td>{ex.submitted_by_name || 'Driver / User'}</td>
                              <td className="mono">Rp {Number(ex.amount).toLocaleString()}</td>
                              <td>
                                {ex.receipt_data_url ? (
                                  <button
                                    type="button"
                                    className="gf-btn gf-btn-secondary"
                                    style={{ minHeight: '28px', padding: '0 8px', fontSize: '11px', gap: '4px' }}
                                    onClick={() =>
                                      setViewingReceiptModal({
                                        url: ex.receipt_data_url,
                                        title: `${ex.category} Receipt (${ex.registration_plate || 'Operational Vehicle'})`,
                                        filename: ex.receipt_filename || 'receipt.jpg',
                                      })
                                    }
                                  >
                                    <FileText size={12} /> View Receipt
                                  </button>
                                ) : ex.receipt_document_id ? (
                                  <button
                                    type="button"
                                    className="gf-btn gf-btn-secondary"
                                    style={{ minHeight: '28px', padding: '0 8px', fontSize: '11px', gap: '4px' }}
                                    onClick={async () => {
                                      try {
                                        const doc = await apiRequest(`/api/documents/${ex.receipt_document_id}`);
                                        if (doc?.document?.content_base64) {
                                          setViewingReceiptModal({
                                            url: `data:${doc.document.mime_type};base64,${doc.document.content_base64}`,
                                            title: `${ex.category} Receipt (${ex.registration_plate || 'Operational Vehicle'})`,
                                            filename: doc.document.file_name,
                                          });
                                        }
                                      } catch (err: any) {
                                        setStatusBanner({ type: 'danger', text: err.message });
                                      }
                                    }}
                                  >
                                    <FileText size={12} /> View Receipt
                                  </button>
                                ) : (
                                  <span className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>None</span>
                                )}
                              </td>
                              <td><StatusBadge label={ex.approval_status} tone={ex.approval_status === 'Approved' ? 'green' : ex.approval_status === 'Rejected' ? 'red' : 'blue'} /></td>
                              <td>
                                {ex.approval_status === 'Submitted' ? (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      type="button"
                                      className="gf-btn gf-btn-primary"
                                      style={{ minHeight: '32px', padding: '0 8px', fontSize: '12px' }}
                                      onClick={async () => {
                                        try {
                                          await apiRequest(`/api/expenses/${ex.id}`, {
                                            method: 'PATCH',
                                            body: JSON.stringify({ approval_status: 'Approved' }),
                                          });
                                          setStatusBanner({ type: 'success', text: `Expense #${ex.id} approved for reimbursement.` });
                                          await loadAllData(user);
                                        } catch (err: any) {
                                          setStatusBanner({ type: 'danger', text: err.message });
                                        }
                                      }}
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      className="gf-btn gf-btn-outline-danger"
                                      style={{ minHeight: '32px', padding: '0 8px', fontSize: '12px' }}
                                      onClick={async () => {
                                        try {
                                          await apiRequest(`/api/expenses/${ex.id}`, {
                                            method: 'PATCH',
                                            body: JSON.stringify({ approval_status: 'Rejected' }),
                                          });
                                          setStatusBanner({ type: 'info', text: `Expense #${ex.id} rejected.` });
                                          await loadAllData(user);
                                        } catch (err: any) {
                                          setStatusBanner({ type: 'danger', text: err.message });
                                        }
                                      }}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>Completed</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {opsSubTab === 'DOCUMENTS' && (
                <section className="gf-card-flat">
                  <h2 className="type-section" style={{ marginBottom: '12px' }}>Document Vault</h2>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const validPdfBase64 = btoa('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
                        await apiRequest('/api/documents', {
                          method: 'POST',
                          body: JSON.stringify({
                            entity_type: docForm.entity_type,
                            entity_id: Number(docForm.entity_id),
                            doc_type: docForm.doc_type,
                            file_name: docForm.file_name,
                            mime_type: 'application/pdf',
                            content_base64: validPdfBase64,
                            expiry_date: docForm.expiry_date,
                          }),
                        });
                        setStatusBanner({ type: 'success', text: 'Document stored.' });
                        await loadAllData(user);
                      } catch (err: any) {
                        setStatusBanner({ type: 'danger', text: err.message });
                      }
                    }}
                    style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}
                  >
                    <select className="gf-select" style={{ flex: '1 1 160px' }} value={docForm.entity_id} onChange={(e) => setDocForm({ ...docForm, entity_id: Number(e.target.value) })}>
                      <option value={0}>Select Vehicle</option>
                      {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registration_plate}</option>)}
                    </select>
                    <input type="text" className="gf-input" style={{ flex: '1 1 180px' }} value={docForm.file_name} onChange={(e) => setDocForm({ ...docForm, file_name: e.target.value })} />
                    <button type="submit" className="gf-btn gf-btn-primary" disabled={vehicles.length === 0}><Upload size={15} /> Upload PDF</button>
                  </form>
                  <div className="gf-table-wrap">
                    <table className="gf-table">
                      <thead><tr><th>Version</th><th>Entity</th><th>Document</th><th>Expiry</th></tr></thead>
                      <tbody>
                        {documents.map((doc) => (
                          <tr key={doc.id}><td className="mono">#{doc.id} (v{doc.version_number})</td><td>{doc.entity_type} #{doc.entity_id}</td><td>{doc.doc_type}: {doc.file_name}</td><td className="mono">{doc.expiry_date || 'N/A'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}

          {adminModule === 'ANALYTICS_REPORT' && usageAnalytics && (
            <>
              {/* Executive Reports Header Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart3 size={20} style={{ color: 'var(--color-samsung-blue)' }} /> Usage Analytics & Executive Briefing
                  </h2>
                  <p className="type-caption">Financial and operational performance summary. All expenditures strictly denominated in Indonesian Rupiah (IDR).</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <a
                    href="/api/reports/executive-pdf"
                    target="_blank"
                    rel="noreferrer"
                    className="gf-btn gf-btn-primary pressable"
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <FileDown size={16} /> Open Executive Report (PDF/Print)
                  </a>
                  <button
                    type="button"
                    className="gf-btn gf-btn-secondary pressable"
                    onClick={() => setShowExecutiveReportModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Printer size={16} /> Print Executive Briefing
                  </button>
                  {user?.role === 'ADM' && (
                    <button
                      type="button"
                      className="gf-btn pressable"
                      onClick={() => setShowResetModal(true)}
                      style={{ background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Reset test operational data to insert real data"
                    >
                      <Trash2 size={16} /> Reset Test Data & Setup Real Fleet
                    </button>
                  )}
                </div>
              </div>

              {/* Top KPI Grid with Elapsed Duration in Hours & Minutes + All-Time IDR Totals */}
              <div className="gf-kpi-grid">
                <div className="gf-card-flat">
                  <div className="type-caption">TOTAL COMPLETED TRIPS</div>
                  <div className="type-title mono" style={{ color: '#0072de' }}>
                    {usageAnalytics.tripDurationSummary?.totalCompletedTrips || usageAnalytics.combinedOverall.allTime.trips}
                  </div>
                  <div className="type-caption">{usageAnalytics.combinedOverall.allTime.distanceKm} km traveled</div>
                </div>
                <div className="gf-card-flat">
                  <div className="type-caption">DRIVER TRIP TIME ELAPSED</div>
                  <div className="type-title mono" style={{ fontSize: '18px', color: '#005bb5' }}>
                    {usageAnalytics.tripDurationSummary?.totalDurationFormatted || '0 Hours 0 Minutes'}
                  </div>
                  <div className="type-caption">Cumulative driving hours count</div>
                </div>
                <div className="gf-card-flat">
                  <div className="type-caption">TOTAL OPERATING COST (IDR)</div>
                  <div className="type-title mono" style={{ fontSize: '18px', color: '#b45309' }}>
                    {formatIdr(usageAnalytics.expensesBreakdownIdr?.total_operational_cost_idr || usageAnalytics.combinedOverall.gasolineSummary.totalFuelCost + usageAnalytics.combinedOverall.electricSummary.totalChargingCost)}
                  </div>
                  <div className="type-caption">Gas, EV, Toll & Parking</div>
                </div>
                <div className="gf-card-flat">
                  <div className="type-caption">THIS MONTH USAGE</div>
                  <div className="type-title mono">{usageAnalytics.combinedOverall.month.distanceKm} km</div>
                  <div className="type-caption">{usageAnalytics.combinedOverall.month.trips} trips completed</div>
                </div>
              </div>

              {/* Energy & Operating Fees Breakdown strictly in IDR */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                <div className="gf-card-flat" style={{ borderLeft: '4px solid #0a0a0a' }}>
                  <div className="type-section" style={{ fontSize: '14.5px' }}>Gasoline Fleet Summary</div>
                  <div className="type-title mono" style={{ fontSize: '16.5px', marginTop: '4px' }}>
                    {usageAnalytics.expensesBreakdownIdr?.gas_litres || usageAnalytics.combinedOverall.gasolineSummary.totalLitres} Litres
                  </div>
                  <div className="type-caption" style={{ fontWeight: 700, color: '#0a0a0a' }}>
                    Cost: {formatIdr(usageAnalytics.expensesBreakdownIdr?.gas_idr || usageAnalytics.combinedOverall.gasolineSummary.totalFuelCost)}
                  </div>
                </div>

                <div className="gf-card-flat" style={{ borderLeft: '4px solid #0072de' }}>
                  <div className="type-section" style={{ fontSize: '14.5px' }}>Electric (EV) Fleet Summary</div>
                  <div className="type-title mono" style={{ fontSize: '16.5px', marginTop: '4px' }}>
                    {usageAnalytics.expensesBreakdownIdr?.electric_kwh || usageAnalytics.combinedOverall.electricSummary.totalKwh} kWh
                  </div>
                  <div className="type-caption" style={{ fontWeight: 700, color: '#0072de' }}>
                    Cost: {formatIdr(usageAnalytics.expensesBreakdownIdr?.electric_idr || usageAnalytics.combinedOverall.electricSummary.totalChargingCost)}
                  </div>
                </div>

                <div className="gf-card-flat" style={{ borderLeft: '4px solid #f59e0b' }}>
                  <div className="type-section" style={{ fontSize: '14.5px' }}>Tollway Operational Fees</div>
                  <div className="type-title mono" style={{ fontSize: '16.5px', marginTop: '4px' }}>
                    {formatIdr(usageAnalytics.expensesBreakdownIdr?.toll_idr || 0)}
                  </div>
                  <div className="type-caption">Electronic toll collection</div>
                </div>

                <div className="gf-card-flat" style={{ borderLeft: '4px solid #8b5cf6' }}>
                  <div className="type-section" style={{ fontSize: '14.5px' }}>Parking & Facility Fees</div>
                  <div className="type-title mono" style={{ fontSize: '16.5px', marginTop: '4px' }}>
                    {formatIdr(usageAnalytics.expensesBreakdownIdr?.parking_idr || 0)}
                  </div>
                  <div className="type-caption">Parking receipts verified</div>
                </div>
              </div>

              {/* Completed Trips Elapsed Time Directory (Hours & Minutes count) */}
              {usageAnalytics.tripDurationSummary?.trips && usageAnalytics.tripDurationSummary.trips.length > 0 && (
                <section className="gf-card-flat" style={{ marginBottom: '14px' }}>
                  <h2 className="type-section" style={{ marginBottom: '12px' }}>
                    Completed Trips Elapsed Driving Time ({usageAnalytics.tripDurationSummary.trips.length} Trips)
                  </h2>
                  <div className="gf-table-wrap">
                    <table className="gf-table">
                      <thead>
                        <tr>
                          <th>Trip ID</th>
                          <th>Driver</th>
                          <th>Vehicle</th>
                          <th>Purpose & Destination</th>
                          <th>Distance</th>
                          <th>Time Elapsed (Hours & Mins)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usageAnalytics.tripDurationSummary.trips.map((t: any) => (
                          <tr key={t.id}>
                            <td className="mono">#{t.id}</td>
                            <td style={{ fontWeight: 700 }}>{t.driver_name}</td>
                            <td className="mono">{t.vehicle_plate}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{t.purpose}</div>
                              <div className="type-caption">📍 {t.destination}</div>
                            </td>
                            <td className="mono">{t.distance_km || 0} km</td>
                            <td>
                              <span className="gf-badge" style={{ background: '#ebf5ff', color: '#005bb5', fontWeight: 800 }}>
                                ⏱️ {t.durationFormatted}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Vehicle Usage Summary Table */}
              <section className="gf-card-flat" style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  <h2 className="type-section">Vehicle Usage & Cost Breakdown (IDR)</h2>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {(['day', 'week', 'month', 'overall'] as const).map((p) => (
                      <Chip key={p} active={usagePeriod === p} onClick={() => setUsagePeriod(p)}>{p.toUpperCase()}</Chip>
                    ))}
                  </div>
                </div>
                <div className="gf-table-wrap">
                  <table className="gf-table">
                    <thead>
                      <tr>
                        <th>Vehicle</th>
                        <th>Energy</th>
                        <th>Day</th>
                        <th>Week</th>
                        <th>Month</th>
                        <th>All-Time</th>
                        <th>Total Cost (IDR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageAnalytics.perVehicle.map((v: any) => (
                        <tr key={v.vehicle_id}>
                          <td><strong>{v.registration_plate}</strong> <div className="type-caption">{v.make} {v.model}</div></td>
                          <td><StatusBadge label={v.energy_type} tone={v.energy_type === 'Electric' ? 'green' : 'neutral'} /></td>
                          <td className="mono">{v.day.distanceKm} km ({v.day.trips})</td>
                          <td className="mono">{v.week.distanceKm} km ({v.week.trips})</td>
                          <td className="mono">{v.month.distanceKm} km ({v.month.trips})</td>
                          <td className="mono">{v.overall.distanceKm} km ({v.overall.trips})</td>
                          <td className="mono" style={{ fontWeight: 700 }}>{formatIdr(v.totalOperatingCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Driver Usage Summary Table */}
              <section className="gf-card-flat">
                <h2 className="type-section" style={{ marginBottom: '12px' }}>Driver Operational Usage Summary</h2>
                <div className="gf-table-wrap">
                  <table className="gf-table">
                    <thead><tr><th>Driver</th><th>Status</th><th>Day</th><th>Week</th><th>Month</th><th>Overall</th></tr></thead>
                    <tbody>
                      {usageAnalytics.perDriver.map((d: any) => (
                        <tr key={d.driver_profile_id}>
                          <td style={{ fontWeight: 700 }}>{d.driver_name}</td>
                          <td><StatusBadge label={d.availability_status} tone="green" /></td>
                          <td className="mono">{d.day.distanceKm} km ({d.day.trips})</td>
                          <td className="mono">{d.week.distanceKm} km ({d.week.trips})</td>
                          <td className="mono">{d.month.distanceKm} km ({d.month.trips})</td>
                          <td className="mono">{d.overall.distanceKm} km ({d.overall.trips})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* DEDICATED AUDIT TRAIL MODULE (Independent from Analytics) */}
          {adminModule === 'AUDIT' && (
            <section className="gf-card-flat">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ScrollText size={20} style={{ color: 'var(--color-samsung-blue)' }} /> System Audit Trail ({auditEvents.length} Recorded Events)
                  </h2>
                  <p className="type-caption">Immutable security log of all system transactions, driver check-ins, trip odometer verifications, and approvals.</p>
                </div>
                <input
                  type="search"
                  className="gf-input"
                  style={{ maxWidth: '280px', minHeight: '38px' }}
                  placeholder="Filter by action or actor..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                />
              </div>

              <div className="gf-table-wrap">
                <table className="gf-table">
                  <thead>
                    <tr>
                      <th>Time (UTC)</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Audit Details & Payload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEvents
                      .filter((ev) => {
                        if (!auditSearchQuery.trim()) return true;
                        const q = auditSearchQuery.toLowerCase();
                        return (
                          (ev.action || '').toLowerCase().includes(q) ||
                          (ev.actor_username || '').toLowerCase().includes(q) ||
                          (ev.entity_type || '').toLowerCase().includes(q)
                        );
                      })
                      .slice(0, 50)
                      .map((ev) => (
                        <tr key={ev.id}>
                          <td className="mono type-caption" style={{ whiteSpace: 'nowrap' }}>{ev.created_at}</td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{ev.actor_username}</div>
                            <div className="type-caption">Role: {ev.actor_role} • User #{ev.actor_user_id}</div>
                          </td>
                          <td>
                            <span className="gf-badge" style={{ fontWeight: 700, fontSize: '11px', background: '#f1f5f9', color: '#1e293b' }}>
                              {ev.action}
                            </span>
                          </td>
                          <td className="mono" style={{ fontSize: '12px' }}>
                            {ev.entity_type} {ev.entity_id ? `#${ev.entity_id}` : ''}
                          </td>
                          <td style={{ fontSize: '11.5px', maxWidth: '380px' }}>
                            <details>
                              <summary style={{ cursor: 'pointer', color: '#0072de', fontWeight: 600 }}>Inspect State Payload</summary>
                              <pre style={{ background: '#f8fafc', padding: '6px', borderRadius: '6px', overflowX: 'auto', fontSize: '10.5px', margin: '4px 0 0 0', maxHeight: '180px' }}>
                                {JSON.stringify({
                                  previous: ev.prev_state_json ? JSON.parse(ev.prev_state_json) : null,
                                  new: ev.new_state_json ? JSON.parse(ev.new_state_json) : null,
                                }, null, 2)}
                              </pre>
                            </details>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </AdminShell>
        {renderSharedModals()}
      </>
    );
  }

  // ============================================================================
  // RIDE-HAILING SHELL (Mobile Map+Sheet, Tablet Rail+Floating Card, Desktop 420px+Map)
  // ============================================================================
  const inActiveBookingFlow = navSection === 'HOME' && bookingStep !== 'HOME';
  const fallbackMetrics = estimateRouteMetrics(bookOrigin, bookDest, originCoords, destCoords);
  const currentMetrics = {
    distanceKm: calculatedRoute?.distanceKm ?? fallbackMetrics.distanceKm,
    durationMin: calculatedRoute?.durationMin ?? fallbackMetrics.durationMin,
    etaText:
      calculatedRoute?.etaText ??
      new Date(
        (scheduleMode === 'SCHEDULE' && bookStart ? new Date(bookStart).getTime() : Date.now()) +
          fallbackMetrics.durationMin * 60000
      ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  // Determine Map visual state
  const mapOrigin =
    bookingStep === 'WAITING' || bookingStep === 'IN_TRIP'
      ? focusedTrip?.origin || bookOrigin
      : bookOrigin;
  const mapDest =
    bookingStep === 'WAITING' || bookingStep === 'IN_TRIP'
      ? focusedTrip?.destination || bookDest
      : bookDest;

  const showRouteOnMap =
    navSection === 'HOME' &&
    ((bookingStep === 'ROUTE' && Boolean(bookOrigin.trim()) && Boolean(bookDest.trim()) && routeTab !== 'PIN') ||
      bookingStep === 'VEHICLE' ||
      bookingStep === 'SUMMARY' ||
      bookingStep === 'IN_TRIP');

  const handleMapBack = () => {
    if (showSchedulePicker) {
      setShowSchedulePicker(false);
      return;
    }
    if (isDriverOnly || navSection === 'DRIVER') {
      setNavSection('DRIVER');
      setSheetSnap('full');
      return;
    }
    if (bookingStep === 'ROUTE') {
      setBookingStep('HOME');
      setSheetSnap('half');
    } else if (bookingStep === 'VEHICLE') {
      setBookingStep('ROUTE');
      setSheetSnap('full');
    } else if (bookingStep === 'SUMMARY') {
      setBookingStep('VEHICLE');
      setSheetSnap('full');
    } else if (bookingStep === 'WAITING' || bookingStep === 'IN_TRIP') {
      setBookingStep('HOME');
      setSheetSnap('half');
    }
  };

  // Sticky Footer per Booking Step (GoCar Reference UI in Samsung Blue & White / Black & White)
  let stickyFooter: React.ReactNode = null;
  if (navSection === 'HOME') {
    if (bookingStep === 'ROUTE') {
      if (routeTab === 'PICKUP') {
        stickyFooter = (
          <StickyActionBar>
            <button
              id="confirm-pickup-spot-btn"
              type="button"
              className="gf-btn gf-btn-primary gf-btn-full pressable"
              style={{ minHeight: '52px', fontSize: '15px', fontWeight: 800 }}
              onClick={() => {
                const baseOrigin = (bookOrigin || 'Company HQ').replace(/\s*•\s*Spot\s*[ABC]$/i, '').trim();
                setBookOrigin(`${baseOrigin} • Spot ${selectedPickupSpot}`);
                setRouteTab('RECENT');
                if (bookDest.trim()) {
                  setBookingStep('VEHICLE');
                  setSheetSnap('full');
                } else {
                  setActiveRouteField('destination');
                  setSheetSnap('full');
                }
              }}
            >
              Confirm pickup point (Spot {selectedPickupSpot})
            </button>
          </StickyActionBar>
        );
      } else if (routeTab === 'PIN') {
        stickyFooter = (
          <StickyActionBar>
            <button
              id="confirm-pin-btn"
              type="button"
              className="gf-btn gf-btn-primary gf-btn-full"
              style={{ minHeight: '52px', fontSize: '15px', fontWeight: 800 }}
              onClick={() => {
                if (activeRouteField === 'pickup' && !bookDest.trim()) {
                  setActiveRouteField('destination');
                  setRouteTab('RECENT');
                  setSheetSnap('full');
                  return;
                }
                setRouteTab('RECENT');
                setBookingStep('VEHICLE');
                setSheetSnap('full');
              }}
            >
              Confirm location
            </button>
          </StickyActionBar>
        );
      } else if (bookOrigin.trim() && bookDest.trim()) {
        stickyFooter = (
          <StickyActionBar>
            <div className="gf-sticky-row">
              <div>
                <div className="type-caption">
                  {calculatingRoute ? 'Calculating street route...' : `Arrival ETA ${currentMetrics.etaText}`}
                </div>
                <div className="type-body" style={{ fontWeight: 700 }}>
                  {currentMetrics.distanceKm} km • ~{currentMetrics.durationMin} min ride
                </div>
              </div>
              <button
                id="route-continue-btn"
                type="button"
                className="gf-btn gf-btn-primary"
                onClick={() => {
                  setBookingStep('VEHICLE');
                  setSheetSnap('full');
                }}
              >
                {t('Continue to Vehicle')}
              </button>
            </div>
          </StickyActionBar>
        );
      }
    } else if (bookingStep === 'VEHICLE' && selectedVehicle) {
      const availSelected = selectedVehicle.isAvailable !== false && selectedVehicle.status === 'Available';
      stickyFooter = (
        <StickyActionBar>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
            <button
              id="schedule-circle-btn"
              type="button"
              className={`gf-schedule-circle-btn pressable ${scheduleMode === 'SCHEDULE' ? 'is-active' : ''}`}
              title={scheduleMode === 'SCHEDULE' ? t('Change Trip Schedule') : t('Set Trip Schedule')}
              aria-label={scheduleMode === 'SCHEDULE' ? t('Change Trip Schedule') : t('Set Trip Schedule')}
              onClick={() => setShowSchedulePicker(true)}
            >
              <Calendar size={22} />
              {scheduleMode === 'SCHEDULE' && <span className="gf-schedule-active-dot" />}
            </button>
            <button
              id="vehicle-continue-btn"
              type="button"
              className="gf-gocar-book-cta pressable"
              disabled={!availSelected}
              onClick={() => {
                setBookingStep('SUMMARY');
                setSheetSnap('half');
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                <span style={{ fontSize: '15px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {scheduleMode === 'SCHEDULE'
                    ? `${t('Schedule')} ${selectedVehicle.make} ${selectedVehicle.model}`
                    : `${t('Book')} ${selectedVehicle.make} ${selectedVehicle.model}`}
                </span>
                <span style={{ fontSize: '11.5px', fontWeight: 600, opacity: 0.9 }}>
                  {scheduleMode === 'SCHEDULE'
                    ? getScheduleSlotBrief(bookStart, lang)
                    : `${t('Ready to Depart')} • ETA ${currentMetrics.etaText}`}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <span style={{ fontSize: '12.5px', fontWeight: 800 }}>
                  {bookReservationType === 'FULL_DAY'
                    ? t('Full Day')
                    : bookReservationType === 'DROP_AND_PICKUP'
                    ? t('Drop & Pick Up')
                    : scheduleMode === 'SCHEDULE'
                    ? t('Scheduled')
                    : t('Instant')}
                </span>
                <span className="gf-gocar-book-arrow">
                  <ArrowRight size={17} strokeWidth={2.75} />
                </span>
              </div>
            </button>
          </div>
        </StickyActionBar>
      );
    } else if (bookingStep === 'SUMMARY' && selectedVehicle) {
      const isPurposeFilled = Boolean(bookPurpose.trim());
      const isPassengerFilled = bookPassengers.length > 0 && bookPassengers.every((p) => Boolean(p.nickname.trim()));
      const canProceedBooking = isPurposeFilled && isPassengerFilled;

      stickyFooter = (
        <StickyActionBar>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="type-caption" style={{ textAlign: 'center' }}>
              {selectedVehicle.make} {selectedVehicle.model} • {selectedVehicle.registration_plate}
              {bookReservationType === 'FULL_DAY'
                ? ' • Full Day'
                : bookReservationType === 'DROP_AND_PICKUP'
                ? ' • Drop & Pick Up'
                : ''}{' '}
              • ETA {currentMetrics.etaText}
            </div>
            <button
              id="submit-booking-btn"
              type="button"
              className="gf-gocar-book-cta pressable"
              style={{
                width: '100%',
                opacity: canProceedBooking ? 1 : 0.88,
              }}
              disabled={isOffline}
              onClick={handleCreateTripBooking}
              title={!canProceedBooking ? t('Please complete Purpose and Passengers before booking') : t('Submit Booking Request')}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '15.5px', fontWeight: 800 }}>{t('Request GalaxyFleet')}</span>
                {!canProceedBooking && (
                  <span style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 700 }}>
                    {!isPurposeFilled && !isPassengerFilled
                      ? `⚠️ ${t('Mandatory to fill Purpose & Passengers')}`
                      : !isPurposeFilled
                      ? `⚠️ ${t('Trip Purpose is mandatory.')}`
                      : `⚠️ ${t('Passenger data is mandatory.')}`}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 800 }}>
                  {bookReservationType === 'FULL_DAY'
                    ? t('Full Day')
                    : bookReservationType === 'DROP_AND_PICKUP'
                    ? t('Drop & Pick Up')
                    : canProceedBooking
                    ? t('Confirm')
                    : t('Complete Details')}
                </span>
                <span className="gf-gocar-book-arrow">
                  <ArrowRight size={17} strokeWidth={2.75} />
                </span>
              </div>
            </button>
          </div>
        </StickyActionBar>
      );
    }
  }

  // Last GPS age caption helper for IN_TRIP (without implying live tracking!)
  const getLastGpsAgeText = () => {
    const tripVeh = vehicles.find((v) => v.id === focusedTrip?.vehicle_id);
    if (tripVeh?.latestGps?.capture_time) {
      const mins = Math.max(1, Math.round((Date.now() - new Date(tripVeh.latestGps.capture_time).getTime()) / 60000));
      return `Last location update ${mins} min ago`;
    }
    return 'Periodic location updates active during duty';
  };

  // Active sheet body content
  const renderSheetContent = () => {
    if (dataError) {
      return <ErrorState message={dataError} onRetry={() => loadAllData(user)} />;
    }

    const notificationPromptBanner = showNotificationPromptBanner ? (
      <div
        style={{
          background: 'linear-gradient(135deg, #0072de, #0052b4)',
          color: '#ffffff',
          padding: '12px 14px',
          borderRadius: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          boxShadow: '0 4px 12px rgba(0, 114, 222, 0.25)',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px', minWidth: 0 }}>
          <Bell size={18} style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '12.5px' }}>{t('Enable Real-Time Alerts')}</div>
            <div style={{ fontSize: '11px', opacity: 0.9, lineHeight: 1.35 }}>
              {t('Get instant alerts for car approvals, dispatches, and trips.')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            type="button"
            className="gf-btn gf-alert-btn"
            style={{ background: '#ffffff', color: '#0072de', fontWeight: 800, border: 'none', padding: '6px 12px', fontSize: '12px', minHeight: '34px' }}
            onClick={() => handleEnablePushNotifications(false)}
          >
            {t('Allow')}
          </button>
          <button
            type="button"
            className="gf-btn gf-alert-btn"
            style={{ background: 'transparent', color: '#ffffff', border: '1px solid rgba(255,255,255,0.45)', padding: '6px 10px', fontSize: '11.5px', minHeight: '34px' }}
            onClick={() => setShowNotificationPromptBanner(false)}
          >
            {t('Later')}
          </button>
        </div>
      </div>
    ) : null;

    const feedbackBanner = (
      <>
        {notificationPromptBanner}
        {statusBanner ? (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-control)',
              marginBottom: '12px',
              background: statusBanner.type === 'danger' ? 'var(--color-status-red-bg)' : 'var(--color-status-green-bg)',
              color: statusBanner.type === 'danger' ? 'var(--color-status-red-fg)' : 'var(--color-status-green-fg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <span className="type-caption" style={{ fontWeight: 700, color: 'inherit' }}>{statusBanner.text}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              style={{ border: 'none', background: 'transparent', color: 'inherit', fontWeight: 700, cursor: 'pointer', minHeight: '32px' }}
            >
              OK
            </button>
          </div>
        ) : null}
      </>
    );

    // -------------------------------------------------------------------------
    // DRIVER DISPATCH SHEET (Gojek-style Driver Check-In + Duty Confirmation)
    // -------------------------------------------------------------------------
    if (navSection === 'DRIVER') {
      const driverCheckedInReady = gpsNoticeAccepted && gpsReportingActive;
      const dedicatedCar = vehicles.find(
        (v) => (v.dedicated_driver_user_id && v.dedicated_driver_user_id === user.id) ||
               (v.default_driver_name && v.default_driver_name.toLowerCase() === (user.nickname || '').toLowerCase())
      );

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {feedbackBanner}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div>
              <h1 className="type-title" style={{ fontSize: '20px', margin: 0 }}>{t('Driver Dispatch')}</h1>
              <p className="type-caption" style={{ margin: '2px 0 0' }}>
                {user.department_name || t('Company Driver')} • {t('Driver dispatch console')}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LanguageSwitcher compact />
              <StatusBadge label={driverCheckedInReady ? t('Online & Checked In') : t('Offline / Standby')} tone={driverCheckedInReady ? 'blue' : 'amber'} />
            </div>
          </div>

          {/* Subtabs for Driver: Duty & Trips vs Car Schedule */}
          <div className="gf-underline-tabs" role="tablist" aria-label="Driver subtabs">
            <button
              type="button"
              role="tab"
              aria-selected={driverSectionTab === 'DISPATCH'}
              className={`gf-underline-tab ${driverSectionTab === 'DISPATCH' ? 'is-active' : ''}`}
              onClick={() => setDriverSectionTab('DISPATCH')}
            >
              <Navigation size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {t('Duty & Trips')} ({dispatches.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={driverSectionTab === 'SCHEDULE'}
              className={`gf-underline-tab ${driverSectionTab === 'SCHEDULE' ? 'is-active' : ''}`}
              onClick={() => setDriverSectionTab('SCHEDULE')}
            >
              <Calendar size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {t('Car Timetable & Schedule')}
            </button>
          </div>

          {/* Dedicated Car Card */}
          {dedicatedCar && (
            <div
              className="gf-proto-card"
              style={{
                borderColor: 'var(--color-samsung-blue)',
                background: 'var(--color-samsung-blue-tint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div className="gf-circle-icon" style={{ width: 34, height: 34, background: '#0072de', color: '#ffffff', flexShrink: 0 }}>
                  <Car size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="type-body" style={{ fontWeight: 800, fontSize: '14px' }}>
                    {dedicatedCar.make} {dedicatedCar.model} • <span className="mono">{dedicatedCar.registration_plate}</span>
                  </div>
                  <div className="type-caption" style={{ fontSize: '12px' }}>
                    {t('Assigned Dedicated Car')} • {dedicatedCar.energy_type} • Odo: {dedicatedCar.current_odometer} km
                  </div>
                </div>
              </div>
              <StatusBadge label={dedicatedCar.status} tone={dedicatedCar.status === 'Available' ? 'blue' : 'amber'} />
            </div>
          )}

          {/* Today's Driving Summary */}
          {(() => {
            const todayStr = new Date().toISOString().slice(0, 10);
            const todayCompletedTrips = trips.filter(
              (t) => (t.assigned_driver_user_id === user.id || t.assigned_driver_name === user.nickname) &&
                     String(t.start_time).startsWith(todayStr) &&
                     (t.trip_status === 'COMPLETED' || t.status === 'COMPLETED')
            );
            const todayDrivingMinutes = todayCompletedTrips.reduce((acc, t) => acc + computeTripDurationMinutes(t), 0);
            const todayDistanceKm = todayCompletedTrips.reduce((acc, t) => {
              const dist = Number(t.distance_km || (t.end_odometer && t.start_odometer ? Number(t.end_odometer) - Number(t.start_odometer) : 0));
              return acc + (dist > 0 ? dist : 0);
            }, 0);

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <div className="gf-driver-triplog-stat-card">
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>{t('Trips Completed')}</span>
                  <span style={{ fontSize: '17px', fontWeight: 800 }}>{todayCompletedTrips.length}</span>
                </div>
                <div className="gf-driver-triplog-stat-card">
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>{t('Total Driving Time')}</span>
                  <span style={{ fontSize: '15px', fontWeight: 800 }}>{formatDurationHuman(todayDrivingMinutes, lang)}</span>
                </div>
                <div className="gf-driver-triplog-stat-card">
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>{t('Total Distance')}</span>
                  <span style={{ fontSize: '16px', fontWeight: 800 }}>{todayDistanceKm} km</span>
                </div>
              </div>
            );
          })()}

          {driverSectionTab === 'SCHEDULE' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                <Chip active={scheduleFilterTab === 'ALL'} onClick={() => setScheduleFilterTab('ALL')}>
                  {t('All Cars')} ({vehicles.length})
                </Chip>
                <Chip active={scheduleFilterTab === 'AVAILABLE'} onClick={() => setScheduleFilterTab('AVAILABLE')}>
                  {t('Available Now')} ({vehicles.filter((v) => v.status === 'Available').length})
                </Chip>
                <Chip active={scheduleFilterTab === 'BOOKED'} onClick={() => setScheduleFilterTab('BOOKED')}>
                  {t('Booked Today')}
                </Chip>
              </div>

              {/* My Driver Agenda */}
              {(() => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const myAgenda = trips.filter(
                  (t) => (t.assigned_driver_user_id === user.id || t.assigned_driver_name === user.nickname) &&
                         String(t.start_time).startsWith(todayStr) &&
                         t.status !== 'CANCELLED' && t.status !== 'REJECTED'
                );
                return (
                  <div
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-card)',
                      background: 'var(--color-bg-subtle)',
                      border: '1.5px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="type-section" style={{ fontSize: '15px' }}>📋 My Driver Agenda (Today)</span>
                      <StatusBadge label={`${myAgenda.length} Trips`} tone="blue" />
                    </div>
                    {myAgenda.length === 0 ? (
                      <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                        No trips scheduled for you today. On standby.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {myAgenda.map((t) => (
                          <div
                            key={t.id}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-control)',
                              background: 'var(--color-surface)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span className="mono" style={{ fontWeight: 700, fontSize: '13px' }}>
                                {new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {formatReservationModeLabel(t.reservation_type, t.return_pickup_time) && (
                                  <StatusBadge label={formatReservationModeLabel(t.reservation_type, t.return_pickup_time)!} tone="blue" />
                                )}
                                <StatusBadge label={t.status} tone={toneFromStatus(t.status)} />
                              </div>
                            </div>
                            <div className="type-caption" style={{ marginTop: '4px', fontWeight: 600 }}>
                              {t.origin} ➔ {t.destination}
                            </div>
                            <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                              Passenger: {t.passenger_nickname || 'Team'} • <span className="notranslate" translate="no">{t.department_name}</span> • Car: {t.registration_plate}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Cars Live Availability and Time Schedule */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {vehicles
                  .filter((v) => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    if (scheduleFilterTab === 'AVAILABLE') return v.status === 'Available';
                    if (scheduleFilterTab === 'BOOKED') {
                      return trips.some((t) => t.vehicle_id === v.id && String(t.start_time).startsWith(todayStr) && t.status !== 'CANCELLED' && t.status !== 'REJECTED');
                    }
                    return true;
                  })
                  .map((v) => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const vehicleTripsToday = trips.filter(
                      (t) => t.vehicle_id === v.id && String(t.start_time).startsWith(todayStr) && t.status !== 'CANCELLED' && t.status !== 'REJECTED'
                    );
                    const isFreeNow = v.status === 'Available' && vehicleTripsToday.every((t) => {
                      const now = Date.now();
                      const start = new Date(t.start_time).getTime();
                      const end = new Date(t.end_time).getTime();
                      return now < start || now > end;
                    });

                    return (
                      <div
                        key={v.id}
                        style={{
                          padding: '14px',
                          borderRadius: 'var(--radius-card)',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="mono" style={{ padding: '2px 7px', borderRadius: '6px', border: '1.5px solid var(--color-text-primary)', fontWeight: 800, fontSize: '12px' }}>
                                {v.registration_plate}
                              </span>
                              <span className="type-body" style={{ fontWeight: 700 }}>
                                {v.make} {v.model}
                              </span>
                            </div>
                            <div className="type-caption" style={{ marginTop: '4px', color: 'var(--color-text-secondary)' }}>
                              👤 Driver: <strong>{v.default_driver_name || 'Pool Driver'}</strong>
                              {v.default_driver_phone && <span className="mono"> ({v.default_driver_phone})</span>}
                            </div>
                          </div>
                          <StatusBadge
                            label={isFreeNow ? 'Available' : v.status !== 'Available' ? v.status : 'In Use'}
                            tone={isFreeNow ? 'green' : v.status !== 'Available' ? 'neutral' : 'amber'}
                          />
                        </div>

                        {/* Visual 24-hr Bar */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }} className="type-caption mono">
                            <span>08:00</span>
                            <span>12:00</span>
                            <span>16:00</span>
                            <span>20:00</span>
                          </div>
                          <div className="gf-timeline-track" style={{ position: 'relative' }}>
                            {vehicleTripsToday.map((t) => {
                              const startH = new Date(t.start_time).getHours() + new Date(t.start_time).getMinutes() / 60;
                              const endH = new Date(t.end_time).getHours() + new Date(t.end_time).getMinutes() / 60;
                              const leftPct = Math.max(0, Math.min(100, ((startH - 8) / 12) * 100));
                              const widthPct = Math.max(8, Math.min(100 - leftPct, ((endH - startH) / 12) * 100));
                              return (
                                <div
                                  key={t.id}
                                  className="gf-timeline-block"
                                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                  title={`${new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${t.department_name} (${t.passenger_nickname || 'Team'})`}
                                />
                              );
                            })}
                          </div>
                        </div>

                        {/* Booked Slots Summary */}
                        <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: '6px' }}>
                          {vehicleTripsToday.length === 0 ? (
                            <div className="type-caption" style={{ color: 'var(--color-green-text)', fontWeight: 600 }}>
                              ✅ Free all day
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {vehicleTripsToday.map((t) => {
                                const modeLabel = formatReservationModeLabel(t.reservation_type, t.return_pickup_time);
                                return (
                                  <div key={t.id} className="type-caption" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span className="mono" style={{ fontWeight: 700 }}>
                                      {new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>: <span className="notranslate" translate="no">{t.department_name}</span> (Pax: {t.passenger_nickname || 'Team'})
                                    {modeLabel && (
                                      <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#ebf5ff', color: '#005bb5', border: '1px solid #bfdbfe' }}>
                                        {modeLabel}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <>
              {/* Driver Duty Confirmation & Location Check-In Card */}
              <div
                className="gf-proto-card"
                style={{
                  borderColor: driverCheckedInReady ? 'var(--color-samsung-blue)' : 'var(--color-divider)',
                  background: driverCheckedInReady ? 'var(--color-samsung-blue-tint)' : 'var(--color-bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div className="type-body" style={{ fontWeight: 700 }}>
                {driverCheckedInReady ? t('Ready for Duty') : t('Step 1: Confirm Ready to Drive & Work')}
              </div>
              <StatusBadge label={driverCheckedInReady ? 'Verified' : 'Required'} tone={driverCheckedInReady ? 'blue' : 'amber'} />
            </div>
            <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
              Before starting any assigned operational trip, please confirm you are on duty and send your current check-in location to dispatch.
            </div>
            {!driverCheckedInReady ? (
              <button
                id="driver-accept-gps-notice-btn"
                type="button"
                className="gf-btn gf-btn-primary gf-btn-full"
                onClick={async () => {
                  setGpsNoticeAccepted(true);
                  setGpsReportingActive(true);
                  detectAndReportUserLocation(true);
                  await sendDriverLocationReport('GRANTED');
                  setStatusBanner({ type: 'success', text: 'Duty confirmed & check-in location sent! You can now start assigned trips.' });
                }}
              >
                <Navigation size={16} /> Confirm Ready to Drive & Send Check-In Location
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="gf-btn gf-btn-primary"
                  style={{ flex: 1 }}
                  onClick={async () => {
                    detectAndReportUserLocation(false);
                    await sendDriverLocationReport('GRANTED');
                  }}
                >
                  <MapPin size={16} /> Update Check-In Location
                </button>
                <button
                  type="button"
                  className="gf-btn gf-btn-secondary"
                  onClick={() => {
                    setGpsReportingActive(false);
                    setGpsNoticeAccepted(false);
                    setStatusBanner({ type: 'info', text: t('Status updated to Offline') });
                  }}
                >
                  {t('Go Offline')}
                </button>
              </div>
            )}
            {lastDriverGpsReport && (
              <div className="type-caption mono">
                Last check-in: {lastDriverGpsReport.permission_state} • {new Date(lastDriverGpsReport.capture_time).toLocaleTimeString()}
              </div>
            )}
          </div>

          <h2 className="type-section">{t('Assigned Trips')} ({dispatches.length})</h2>
          {loadingData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Skeleton height={84} />
              <Skeleton height={84} />
            </div>
          ) : dispatches.length === 0 ? (
            <EmptyState message="No dispatch orders assigned to you yet." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dispatches.map((d) => {
                const tripId = d.trip_request_id;
                const isCompleted = d.trip_status === 'COMPLETED';
                const isInProgress = d.trip_status === 'IN_PROGRESS';

                return (
                  <div
                    key={d.assignment_id}
                    className="gf-proto-card"
                    style={{
                      borderColor: isInProgress ? 'var(--color-samsung-blue)' : 'var(--color-divider)',
                      background: isInProgress ? 'var(--color-samsung-blue-tint)' : 'var(--color-bg-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="mono type-body" style={{ fontWeight: 800 }}>{d.registration_plate} • {d.make} {d.model}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {formatReservationModeLabel(d.reservation_type, d.return_pickup_time) && (
                          <StatusBadge label={formatReservationModeLabel(d.reservation_type, d.return_pickup_time)!} tone="blue" />
                        )}
                        <StatusBadge label={d.trip_status} tone={toneFromStatus(d.trip_status)} />
                      </div>
                    </div>
                    <div className="type-body" style={{ fontWeight: 700 }}>{d.purpose || 'Assigned Trip'}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="gf-proto-pn" />
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{d.origin}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="gf-proto-od" />
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{d.destination}</span>
                      </div>
                    </div>
                    {d.effective_start && d.effective_end && (
                      <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                        🕒 {new Date(d.effective_start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – {new Date(d.effective_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {d.reservation_type === 'DROP_AND_PICKUP' && d.return_pickup_time && (
                          <span style={{ color: '#005bb5', fontWeight: 700 }}>
                            {' '}• Post-Event Pick-Up: {new Date(d.return_pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="type-caption">
                      Passenger: {d.requester_name} ({d.passenger_count} pax) • Odo: {d.current_odometer} km
                      {d.energy_type === 'Electric' ? ` • ${d.battery_percent ?? 100}%` : ''}
                    </div>

                    {!isCompleted && tripId && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-divider)' }}>
                        {!driverCheckedInReady ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="type-caption" style={{ color: 'var(--color-status-amber-fg)', fontWeight: 700 }}>
                              Action required: Confirm duty & send check-in location before running this trip.
                            </div>
                            <button
                              type="button"
                              className="gf-btn gf-btn-primary gf-btn-full"
                              onClick={async () => {
                                setGpsNoticeAccepted(true);
                                setGpsReportingActive(true);
                                detectAndReportUserLocation(true);
                                await sendDriverLocationReport('GRANTED');
                                setStatusBanner({ type: 'success', text: 'Duty confirmed & check-in location sent!' });
                              }}
                            >
                              <Navigation size={16} /> Confirm to Drive & Send Check-In First
                            </button>
                          </div>
                        ) : (
                          <>
                            {!d.acknowledged_at && (
                              <button
                                type="button"
                                className="gf-btn gf-btn-primary gf-btn-full"
                                onClick={async () => {
                                  await sendDriverLocationReport('GRANTED');
                                  await apiRequest(`/api/driver/trips/${tripId}/acknowledge`, { method: 'POST' });
                                  setStatusBanner({ type: 'success', text: 'Dispatch order acknowledged & check-in recorded.' });
                                  await loadAllData(user);
                                }}
                              >
                                Acknowledge Order & Confirm Ready
                              </button>
                            )}
                            {!isInProgress ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ border: '1.5px solid #bfdbfe', background: '#eff6ff', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label htmlFor={`start-odo-file-${tripId}`} style={{ fontWeight: 800, fontSize: '13px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <Camera size={16} /> Mandatory Start Odometer Photo
                                    </label>
                                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                                      {startOdoTime[tripId] ? `Recorded: ${startOdoTime[tripId]}` : 'Auto-recorded on capture'}
                                    </span>
                                  </div>
                                  <input
                                    type="file"
                                    id={`start-odo-file-${tripId}`}
                                    accept="image/*"
                                    capture="environment"
                                    className="gf-input"
                                    style={{ background: '#ffffff' }}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const reader = new FileReader();
                                      reader.onload = () => {
                                        const b64 = reader.result as string;
                                        setStartOdoPhoto((prev) => ({ ...prev, [tripId]: b64 }));
                                        setStartOdoTime((prev) => ({ ...prev, [tripId]: new Date().toLocaleString() }));
                                      };
                                      reader.readAsDataURL(file);
                                    }}
                                  />
                                  {startOdoPhoto[tripId] && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <img
                                        src={startOdoPhoto[tripId]}
                                        alt="Start Odometer preview"
                                        style={{ width: '70px', height: '50px', objectFit: 'cover', borderRadius: '8px', border: '1.5px solid #3b82f6' }}
                                      />
                                      <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 700 }}>
                                        ✅ Odometer photo verified ({startOdoTime[tripId]})
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <input
                                    type="number"
                                    className="gf-input"
                                    aria-label="Start odometer"
                                    placeholder="Start Odometer (km)"
                                    value={activeTripOdoInput[tripId] ?? d.current_odometer}
                                    onChange={(e) => setActiveTripOdoInput({ ...activeTripOdoInput, [tripId]: e.target.value })}
                                  />
                                  <button
                                    type="button"
                                    className="gf-btn gf-btn-primary"
                                    onClick={async () => {
                                      if (!startOdoPhoto[tripId]) {
                                        setStatusBanner({ type: 'danger', text: 'Mandatory: Driver must take a photo of the odometer before starting the trip.' });
                                        return;
                                      }
                                      try {
                                        await sendDriverLocationReport('GRANTED');
                                        await apiRequest(`/api/driver/trips/${tripId}/start`, {
                                          method: 'POST',
                                          body: JSON.stringify({
                                            start_odometer: Number(activeTripOdoInput[tripId] ?? d.current_odometer),
                                            start_odometer_photo: startOdoPhoto[tripId],
                                            photo_base64: startOdoPhoto[tripId],
                                          }),
                                        });
                                        setStatusBanner({ type: 'success', text: 'Check-in & odometer photo verified, trip started!' });
                                        await loadAllData(user);
                                      } catch (err: any) {
                                        setStatusBanner({ type: 'danger', text: err.message });
                                      }
                                    }}
                                  >
                                    <Play size={16} /> Start Trip
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ border: '1.5px solid #bfdbfe', background: '#eff6ff', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label htmlFor={`end-odo-file-${tripId}`} style={{ fontWeight: 800, fontSize: '13px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <Camera size={16} /> Mandatory Completion Odometer Photo
                                    </label>
                                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                                      {endOdoTime[tripId] ? `Recorded: ${endOdoTime[tripId]}` : 'Auto-recorded on capture'}
                                    </span>
                                  </div>
                                  <input
                                    type="file"
                                    id={`end-odo-file-${tripId}`}
                                    accept="image/*"
                                    capture="environment"
                                    className="gf-input"
                                    style={{ background: '#ffffff' }}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const reader = new FileReader();
                                      reader.onload = () => {
                                        const b64 = reader.result as string;
                                        setEndOdoPhoto((prev) => ({ ...prev, [tripId]: b64 }));
                                        setEndOdoTime((prev) => ({ ...prev, [tripId]: new Date().toLocaleString() }));
                                      };
                                      reader.readAsDataURL(file);
                                    }}
                                  />
                                  {endOdoPhoto[tripId] && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <img
                                        src={endOdoPhoto[tripId]}
                                        alt="End Odometer preview"
                                        style={{ width: '70px', height: '50px', objectFit: 'cover', borderRadius: '8px', border: '1.5px solid #3b82f6' }}
                                      />
                                      <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 700 }}>
                                        ✅ End photo verified ({endOdoTime[tripId]})
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <input
                                  type="number"
                                  className="gf-input"
                                  placeholder={`End Odometer (> ${d.start_odometer || d.current_odometer})`}
                                  value={activeTripOdoInput[tripId] ?? Number(d.start_odometer || d.current_odometer) + 25}
                                  onChange={(e) => setActiveTripOdoInput({ ...activeTripOdoInput, [tripId]: e.target.value })}
                                />
                                {d.energy_type === 'Electric' && (
                                  <input
                                    type="number"
                                    className="gf-input"
                                    placeholder="End Battery %"
                                    value={activeTripBatteryInput[tripId] ?? '72'}
                                    onChange={(e) => setActiveTripBatteryInput({ ...activeTripBatteryInput, [tripId]: e.target.value })}
                                  />
                                )}
                                <input
                                  type="text"
                                  className="gf-input"
                                  placeholder="Return parking spot"
                                  value={activeTripParkingInput[tripId] ?? 'Main Pool'}
                                  onChange={(e) => setActiveTripParkingInput({ ...activeTripParkingInput, [tripId]: e.target.value })}
                                />
                                <button
                                  type="button"
                                  className="gf-btn gf-btn-primary gf-btn-full"
                                  onClick={async () => {
                                    if (!endOdoPhoto[tripId]) {
                                      setStatusBanner({ type: 'danger', text: 'Mandatory: Driver must take a photo of the odometer upon trip completion.' });
                                      return;
                                    }
                                    try {
                                      await sendDriverLocationReport('GRANTED');
                                      await apiRequest(`/api/driver/trips/${tripId}/complete`, {
                                        method: 'POST',
                                        body: JSON.stringify({
                                          end_odometer: Number(activeTripOdoInput[tripId] ?? Number(d.start_odometer || d.current_odometer) + 25),
                                          end_odometer_photo: endOdoPhoto[tripId],
                                          photo_base64: endOdoPhoto[tripId],
                                          battery_percent: d.energy_type === 'Electric' ? Number(activeTripBatteryInput[tripId] ?? 72) : undefined,
                                          parking_return_note: activeTripParkingInput[tripId] || 'Main Pool',
                                        }),
                                      });
                                      setStatusBanner({ type: 'success', text: 'Trip completed, odometer photo and timestamp saved!' });
                                      await loadAllData(user);
                                    } catch (err: any) {
                                      setStatusBanner({ type: 'danger', text: err.message });
                                    }
                                  }}
                                >
                                  Complete Trip
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Driver Reimbursements & Expense Receipt Upload (Revision #11) */}
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h2 className="type-section">Reimbursements & Receipts</h2>
                <p className="type-caption">Upload Parking, Gas, Charging (EV), and Toll receipts for reimbursement approval</p>
              </div>
              <button
                id="driver-upload-receipt-btn"
                type="button"
                className="gf-btn gf-btn-primary"
                onClick={() => setShowDriverExpenseModal(true)}
              >
                <Upload size={16} /> Upload Receipt
              </button>
            </div>

            {expenses.length === 0 ? (
              <EmptyState message="No reimbursement claims submitted yet." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {expenses.map((ex) => (
                  <div
                    key={ex.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-card)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div className="type-body" style={{ fontWeight: 700 }}>
                        {ex.category} • Rp {Number(ex.amount).toLocaleString()}
                      </div>
                      <div className="type-caption">
                        {ex.registration_plate || 'Operational Car'} • {ex.description || 'Receipt claim'} • {new Date(ex.date_time).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {(ex.receipt_data_url || ex.receipt_document_id) && (
                        <button
                          type="button"
                          className="gf-btn gf-btn-secondary"
                          style={{ minHeight: '30px', padding: '0 8px', fontSize: '12px', gap: '4px' }}
                          onClick={async () => {
                            if (ex.receipt_data_url) {
                              setViewingReceiptModal({
                                url: ex.receipt_data_url,
                                title: `${ex.category} Receipt (#${ex.id})`,
                                filename: ex.receipt_filename || 'receipt.jpg',
                              });
                            } else if (ex.receipt_document_id) {
                              try {
                                const doc = await apiRequest(`/api/documents/${ex.receipt_document_id}`);
                                if (doc?.document?.content_base64) {
                                  setViewingReceiptModal({
                                    url: `data:${doc.document.mime_type};base64,${doc.document.content_base64}`,
                                    title: `${ex.category} Receipt (#${ex.id})`,
                                    filename: doc.document.file_name,
                                  });
                                }
                              } catch (err: any) {
                                setStatusBanner({ type: 'danger', text: err.message });
                              }
                            }
                          }}
                        >
                          <FileText size={13} /> View Receipt
                        </button>
                      )}
                      <StatusBadge
                        label={ex.approval_status}
                        tone={ex.approval_status === 'Approved' ? 'green' : ex.approval_status === 'Rejected' ? 'red' : 'blue'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

    // -------------------------------------------------------------------------
    // ACTIVITY TAB (Ongoing & History for Employees; Trip Log for Drivers)
    // -------------------------------------------------------------------------
    if (navSection === 'ACTIVITY') {
      if (user.role === 'DRV' || isDriverOnly) {
        // DRIVER TRIP LOG (Replaces Pendapatan with trips completed, driving hours/mins, and distance)
        const myDriverTrips = trips.filter(
          (t) => (t.assigned_driver_user_id && t.assigned_driver_user_id === user.id) ||
                 (t.assigned_driver_name && t.assigned_driver_name.toLowerCase() === (user.nickname || '').toLowerCase())
        );
        const driverCompletedTrips = myDriverTrips.filter((t) => t.trip_status === 'COMPLETED' || t.status === 'COMPLETED');

        // Dynamically compute driving time from trip start to completion
        const totalMinutes = driverCompletedTrips.reduce((acc, t) => acc + computeTripDurationMinutes(t), 0);
        const formattedTotalTime = formatDurationHuman(totalMinutes, lang);

        const totalDistanceKm = driverCompletedTrips.reduce((acc, t) => {
          const dist = Number(t.distance_km || (t.end_odometer && t.start_odometer ? Number(t.end_odometer) - Number(t.start_odometer) : 0));
          return acc + (dist > 0 ? dist : 0);
        }, 0);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {feedbackBanner}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h1 className="type-title">{t('Trip Log')}</h1>
                <p className="type-caption">
                  {user.department_name || 'Driver G'} • {t('Total Driving Time')}
                </p>
              </div>
              <StatusBadge label={`${driverCompletedTrips.length} ${t('Trips Completed')}`} tone="blue" />
            </div>

            {/* Metrics: Trips Completed, Total In-Service Driving Time, Total Distance */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div className="gf-driver-triplog-stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0072de' }}>
                  <Car size={16} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{t('Trips Completed')}</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>{driverCompletedTrips.length}</div>
              </div>

              <div className="gf-driver-triplog-stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0072de' }}>
                  <Clock size={16} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{t('Total Driving Time')}</span>
                </div>
                <div style={{ fontSize: '17px', fontWeight: 800, marginTop: '2px' }}>{formattedTotalTime}</div>
              </div>

              <div className="gf-driver-triplog-stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0072de' }}>
                  <Navigation size={16} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{t('Total Distance')}</span>
                </div>
                <div style={{ fontSize: '17px', fontWeight: 800, marginTop: '2px' }}>{totalDistanceKm} km</div>
              </div>
            </div>

            {/* Subtabs: Completed Trips vs Reimbursements */}
            <div className="gf-underline-tabs" role="tablist">
              <button
                type="button"
                className={`gf-underline-tab ${driverTripLogTab === 'TRIPS' ? 'is-active' : ''}`}
                onClick={() => setDriverTripLogTab('TRIPS')}
              >
                <Clock size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                {t('History')} ({driverCompletedTrips.length})
              </button>
              <button
                type="button"
                className={`gf-underline-tab ${driverTripLogTab === 'EXPENSES' ? 'is-active' : ''}`}
                onClick={() => setDriverTripLogTab('EXPENSES')}
              >
                <Upload size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                {t('Reimbursements')} ({expenses.length})
              </button>
            </div>

            {driverTripLogTab === 'TRIPS' ? (
              driverCompletedTrips.length === 0 ? (
                <EmptyState
                  message={t('No completed trips yet.')}
                  action={
                    <button
                      type="button"
                      className="gf-btn gf-btn-primary"
                      onClick={() => setNavSection('DRIVER')}
                    >
                      <Car size={16} /> {t('Home')}
                    </button>
                  }
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {driverCompletedTrips.map((trip) => {
                    const durationMins = computeTripDurationMinutes(trip);
                    const formattedDur = formatDurationHuman(durationMins, lang);
                    const startOdo = trip.start_odometer || 0;
                    const endOdo = trip.end_odometer || startOdo;
                    const diffKm = endOdo >= startOdo ? endOdo - startOdo : (trip.distance_km || 0);

                    return (
                      <div
                        key={trip.id}
                        style={{
                          borderRadius: 'var(--radius-card)',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                          <div>
                            <div className="type-body" style={{ fontWeight: 800 }}>
                              {trip.origin} ➔ {trip.destination}
                            </div>
                            <div className="type-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              {new Date(trip.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(trip.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(trip.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <span className="gf-driver-triplog-duration-pill">
                            ⏱️ {formattedDur} {t('in service driving')}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px solid var(--color-divider)' }}>
                          <span className="type-caption">
                            {t('Car')}: <strong>{trip.make} {trip.model}</strong> (<span className="mono">{trip.registration_plate}</span>) • Pax: <strong>{trip.passenger_nickname || 'Team'}</strong>
                          </span>
                          <span className="type-caption mono" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            Odo: {startOdo} ➔ {endOdo} km ({diffKm} km)
                          </span>
                        </div>

                        {(trip.start_odometer_photo_url || trip.end_odometer_photo_url) && (
                          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                            {trip.start_odometer_photo_url && (
                              <img
                                src={trip.start_odometer_photo_url}
                                alt="Start Odometer"
                                style={{ width: '60px', height: '44px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #bfdbfe' }}
                                title={t('Start Odometer Photo')}
                              />
                            )}
                            {trip.end_odometer_photo_url && (
                              <img
                                src={trip.end_odometer_photo_url}
                                alt="End Odometer"
                                style={{ width: '60px', height: '44px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #bfdbfe' }}
                                title={t('End Odometer Photo')}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h2 className="type-section" style={{ fontSize: '15px', margin: 0 }}>{t('Driver Reimbursements')}</h2>
                    <p className="type-caption" style={{ margin: 0 }}>{t('Upload Parking, Gas, EV Charging, and Toll receipts')}</p>
                  </div>
                  <button
                    id="driver-upload-receipt-btn"
                    type="button"
                    className="gf-btn gf-btn-primary"
                    onClick={() => setShowDriverExpenseModal(true)}
                  >
                    <Upload size={16} /> {t('Upload Receipt')}
                  </button>
                </div>

                {expenses.length === 0 ? (
                  <EmptyState message={t('No reimbursement claims submitted yet.')} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {expenses.map((exp) => (
                      <div
                        key={exp.id}
                        style={{
                          borderRadius: 'var(--radius-card)',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>{exp.category} • {formatIdr(exp.amount)}</div>
                          <div className="type-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            {exp.description || 'No description'} • {new Date(exp.incurred_date || exp.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <StatusBadge label={exp.status} tone={exp.status === 'Approved' ? 'green' : exp.status === 'Rejected' ? 'red' : 'amber'} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      const shownList = activityTab === 'ONGOING' ? ongoingTrips : historyTrips;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feedbackBanner}
          <h1 className="type-title">{t('Activity')}</h1>

          <div className="gf-underline-tabs" role="tablist" aria-label="Trip history tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activityTab === 'ONGOING'}
              className={`gf-underline-tab ${activityTab === 'ONGOING' ? 'is-active' : ''}`}
              onClick={() => setActivityTab('ONGOING')}
            >
              {t('Ongoing')} ({ongoingTrips.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activityTab === 'HISTORY'}
              className={`gf-underline-tab ${activityTab === 'HISTORY' ? 'is-active' : ''}`}
              onClick={() => setActivityTab('HISTORY')}
            >
              {t('History')} ({historyTrips.length})
            </button>
          </div>

          {loadingData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </div>
          ) : shownList.length === 0 ? (
            <EmptyState
              message={activityTab === 'ONGOING' ? t('No ongoing rides right now.') : t('No completed trips yet.')}
              action={
                user.role === 'DRV' ? (
                  <button
                    type="button"
                    className="gf-btn gf-btn-primary"
                    onClick={() => {
                      setNavSection('DRIVER');
                      setSheetSnap('full');
                    }}
                  >
                    <Navigation size={16} /> {t('Open Driver Dispatch')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="gf-btn gf-btn-primary"
                    onClick={() =>
                      requireLocationBeforeCarUse(() => {
                        setNavSection('HOME');
                        setBookingStep('ROUTE');
                        setSheetSnap('full');
                      })
                    }
                  >
                    {t('Book a ride')}
                  </button>
                )
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {shownList.map((trip) => (
                <div
                  key={trip.id}
                  style={{
                    borderRadius: 'var(--radius-card)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    padding: '8px 12px',
                  }}
                >
                  <ListRow
                    tall
                    icon={<Car size={20} />}
                    title={`${trip.origin} → ${trip.destination}`}
                    subtitle={`${formatReservationModeLabel(trip.reservation_type, trip.return_pickup_time) ? `[${formatReservationModeLabel(trip.reservation_type, trip.return_pickup_time)}] • ` : ''}${formatPassengersDisplay(trip.passengers_json, trip.passenger_nickname) !== 'Team' ? `Pax: ${formatPassengersDisplay(trip.passengers_json, trip.passenger_nickname)} • ` : ''}${new Date(trip.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • ${trip.make} ${trip.model} (${trip.registration_plate})${trip.assigned_driver_name ? ` • Driver: ${trip.assigned_driver_name}` : ''}`}
                    trailing={
                      (() => {
                        if (trip.booking_status === 'CANCELLED') return <StatusBadge label="CANCELLED" tone="red" />;
                        if (trip.status === 'APPROVED') return <StatusBadge label="APPROVED" tone="green" />;
                        if (trip.status === 'IN_PROGRESS') return <StatusBadge label="IN TRIP" tone="blue" />;
                        if (trip.status === 'PENDING_APPROVAL' && trip.requires_dual_approval) {
                          if (trip.pic_approved) return <StatusBadge label="AWAITING HWS" tone="amber" />;
                          if (trip.hws_approved) return <StatusBadge label="AWAITING PIC" tone="amber" />;
                        }
                        return <StatusBadge label={trip.status} tone={toneFromStatus(trip.status)} />;
                      })()
                    }
                    showChevron={activityTab === 'ONGOING'}
                    onClick={
                      activityTab === 'ONGOING'
                        ? () => {
                            setFocusedTripId(trip.id);
                            if (user.role === 'DRV') {
                              setNavSection('DRIVER');
                              setSheetSnap('full');
                            } else {
                              setNavSection('HOME');
                              setBookingStep(trip.status === 'PENDING_APPROVAL' ? 'WAITING' : 'IN_TRIP');
                              setSheetSnap('half');
                            }
                          }
                        : undefined
                    }
                  />
                  {(trip.status === 'APPROVED' || trip.status === 'IN_PROGRESS') && trip.booking_status !== 'CANCELLED' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px', borderTop: '1px solid var(--color-divider)', marginTop: '4px' }}>
                      <button
                        type="button"
                        className="gf-btn gf-btn-secondary"
                        style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px', gap: '5px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const paxFormatted = formatPassengersMultiLine(trip.passengers_json, trip.passenger_nickname);
                          const modeLabel = formatReservationModeLabel(trip.reservation_type, trip.return_pickup_time);
                          const shareModeLine = modeLabel ? `\n📋 *Mode*: ${modeLabel}` : '';
                          const shareMsg = `*GalaxyFleet Booking Details*\n🚗 *Vehicle*: ${trip.make} ${trip.model} (${trip.registration_plate || '—'})\n👥 *Passenger(s) [Nickname only]*:\n${paxFormatted}\n👤 *Driver*: ${trip.assigned_driver_name || 'Assigned Driver'}${trip.assigned_driver_phone ? ` (${trip.assigned_driver_phone})` : ''}\n📍 *Pickup*: ${trip.origin}\n🎯 *Destination*: ${trip.destination}\n🕒 *Schedule*: ${new Date(trip.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(trip.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${shareModeLine}\n📌 *Status*: ${trip.status}\n\n_Reminder: For privacy protection, only nicknames are used._`;
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(shareMsg).catch(() => {});
                          }
                          window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg)}`, '_blank');
                          setStatusBanner({ type: 'success', text: t('Booking details copied & opened WhatsApp to share with passenger!') });
                        }}
                      >
                        <Share2 size={13} /> {t('Share to Passenger (WhatsApp)')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // INBOX TAB
    // -------------------------------------------------------------------------
    if (navSection === 'INBOX') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feedbackBanner}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <h1 className="type-title">{t('Inbox')}</h1>
            {unreadCount > 0 && (
              <button
                type="button"
                className="gf-btn gf-btn-ghost"
                onClick={async () => {
                  await apiRequest('/api/notifications/read-all', { method: 'POST' });
                  await loadAllData(user);
                }}
              >
                {t('Mark all read')}
              </button>
            )}
          </div>

          <button type="button" className="gf-btn gf-btn-secondary gf-btn-full" onClick={handleEnablePushNotifications}>
            <Bell size={16} />
            {pushSubscribed ? t('Push notifications enabled (Send test)') : t('Enable Push Alerts')}
          </button>

          {notifications.length === 0 ? (
            <EmptyState message={t("You're all caught up! Alerts appear here.")} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {notifications.map((n) => (
                <div key={n.id} className={!n.is_read ? 'gf-proto-inbox-unread' : undefined}>
                  <ListRow
                    tall
                    icon={<Bell size={18} style={{ color: n.is_read ? 'var(--color-text-muted)' : '#0072de' }} />}
                    title={n.title}
                    subtitle={n.body}
                    trailing={!n.is_read ? <span className="gf-dot-green" style={{ background: '#0072de' }} aria-label="Unread" /> : undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // PROFILE TAB
    // -------------------------------------------------------------------------
    if (navSection === 'PROFILE') {
      const myDriver = drivers.find((d) => d.user_id === user.id || d.full_name.toLowerCase() === (user.nickname || '').toLowerCase());
      const dedicatedCar = vehicles.find(
        (v) => (v.dedicated_driver_user_id && v.dedicated_driver_user_id === user.id) ||
               (v.default_driver_name && v.default_driver_name.toLowerCase() === (user.nickname || '').toLowerCase())
      );
      const photoSrc = user.photo_url || myDriver?.photo_url || getDriverAvatarDataUri(user.nickname || 'Driver');

      if (user.role === 'DRV' || isDriverOnly) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {feedbackBanner}

            {/* Corporate Driver Profile Card */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-card)',
                background: 'var(--color-bg-surface)',
                border: '1.5px solid var(--color-border)',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
                <img
                  src={photoSrc}
                  alt={user.nickname}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2.5px solid var(--color-samsung-blue)',
                    background: '#f1f5f9',
                  }}
                />
                <label
                  title="Upload photo"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'var(--color-samsung-blue)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                  }}
                >
                  <Camera size={13} />
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const base64 = String(ev.target?.result || '');
                          try {
                            await apiRequest('/api/driver/profile/photo', {
                              method: 'POST',
                              body: JSON.stringify({ photo_url: base64 }),
                            });
                            setStatusBanner({ type: 'success', text: 'Driver profile photo updated successfully!' });
                            await loadAllData(user);
                          } catch (err: any) {
                            setStatusBanner({ type: 'danger', text: err.message });
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '17px', color: 'var(--color-fg-primary)' }}>
                  {user.nickname}
                </div>
                <div className="type-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  @{user.group_username} • <span className="notranslate" translate="no">{user.department_name || 'Driver G'}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <StatusBadge label={`SIM: ${myDriver?.licence_number || 'Registered'} (${myDriver?.licence_class || 'A'})`} tone="blue" />
                  <StatusBadge label="Official Driver" tone="green" />
                </div>
              </div>
            </div>

            {/* Dedicated Vehicle Card if assigned */}
            {dedicatedCar && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-card)',
                  background: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="gf-circle-icon is-green" style={{ width: 34, height: 34 }}>
                    <Car size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13.5px' }}>
                      {dedicatedCar.make} {dedicatedCar.model} • <span className="mono">{dedicatedCar.registration_plate}</span>
                    </div>
                    <div className="type-caption">
                      Assigned Vehicle • {dedicatedCar.energy_type} • Odo: {dedicatedCar.current_odometer} km
                    </div>
                  </div>
                </div>
                <StatusBadge label={dedicatedCar.status} tone={dedicatedCar.status === 'Available' ? 'green' : 'amber'} />
              </div>
            )}

            {/* Language & Appearance */}
            <div style={{ padding: '12px', borderRadius: 'var(--radius-card)', background: 'var(--color-bg-subtle)' }}>
              <div className="type-caption" style={{ fontWeight: 700, marginBottom: '8px' }}>{t('Language')}</div>
              <LanguageSwitcher />
            </div>

            <div style={{ padding: '12px', borderRadius: 'var(--radius-card)', background: 'var(--color-bg-subtle)' }}>
              <div className="type-caption" style={{ fontWeight: 700, marginBottom: '8px' }}>{t('Appearance')}</div>
              <Segmented
                ariaLabel="Theme preference"
                value={themePref}
                onChange={setThemePref}
                options={[
                  { value: 'system', label: t('Auto') },
                  { value: 'light', label: t('Light') },
                  { value: 'dark', label: t('Dark') },
                ]}
              />
            </div>

            {/* Corporate Driver Settings Rows */}
            <div>
              <ListRow
                icon={<User size={18} />}
                title={t('Edit Profile & Nickname')}
                subtitle={user.contact_number ? `${t('Phone')}: ${user.contact_number}` : t('Update contact phone or nickname')}
                showChevron
                onClick={handleOpenProfileModal}
              />
              <ListRow
                icon={<ShieldCheck size={18} />}
                title={t('Change Account Password')}
                subtitle={t('Update login password securely')}
                showChevron
                onClick={() => {
                  handleOpenProfileModal();
                  setProfileTab('PASSWORD');
                }}
              />
              <ListRow
                icon={<Bell size={18} />}
                title={t('Push Notifications')}
                subtitle={pushSubscribed ? t('Active on this device') : t('Receive booking & dispatch updates')}
                showChevron
                onClick={handleEnablePushNotifications}
              />
              <ListRow
                icon={<Smartphone size={18} />}
                title={t('Install GalaxyFleet App')}
                subtitle={t('Add shortcut to your home screen')}
                showChevron
                onClick={handleInstallPwa}
              />
              <ListRow
                icon={<LogOut size={18} />}
                title={t('Sign Out')}
                subtitle={t('Sign out of your driver session')}
                onClick={handleLogout}
              />
            </div>

            {/* Clean Driver App Version Footer */}
            <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
              GalaxyFleet Driver v1.0.0 (Corporate Edition) • Samsung Mobility
            </div>
          </div>
        );
      }

      const initials = (user.nickname || 'U').slice(0, 2).toUpperCase();
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {feedbackBanner}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--color-green-tint)',
                  color: 'var(--color-green-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '18px',
                  flexShrink: 0,
                  overflow: 'hidden',
                  border: '2px solid var(--color-samsung-blue)',
                }}
              >
                {user.photo_url ? (
                  <img src={user.photo_url} alt={user.nickname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  initials
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 className="type-title">{user.nickname}</h1>
                <div className="type-caption">
                  @{user.group_username} •{' '}
                  <span className="notranslate" translate="no">
                    {user.department_name || `Group #${user.department_id}`}
                  </span>
                </div>
                {user.contact_number && (
                  <div className="type-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    📞 {user.contact_number}
                  </div>
                )}
                <div style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
                  <StatusBadge label={`Role: ${user.role}`} tone="green" />
                  {user.is_department_admin === 1 && <StatusBadge label="Group Admin" tone="blue" />}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="gf-btn gf-btn-secondary"
              style={{ minHeight: '36px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleOpenProfileModal}
            >
              <User size={16} /> {t('Edit Profile')}
            </button>
          </div>

          <div style={{ padding: '12px', borderRadius: 'var(--radius-card)', background: 'var(--color-bg-subtle)' }}>
            <div className="type-caption" style={{ fontWeight: 700, marginBottom: '8px' }}>{t('Language')}</div>
            <LanguageSwitcher />
          </div>

          <div style={{ padding: '12px', borderRadius: 'var(--radius-card)', background: 'var(--color-bg-subtle)' }}>
            <div className="type-caption" style={{ fontWeight: 700, marginBottom: '8px' }}>{t('Appearance')}</div>
            <Segmented
              ariaLabel="Theme preference"
              value={themePref}
              onChange={setThemePref}
              options={[
                { value: 'system', label: t('Auto') },
                { value: 'light', label: t('Light') },
                { value: 'dark', label: t('Dark') },
              ]}
            />
          </div>

          <div>
            <ListRow
              icon={<User size={18} />}
              title={t('Edit Profile & Details')}
              subtitle={user.contact_number ? `${t('Phone')}: ${user.contact_number}` : t('Update display nickname, phone & photo')}
              showChevron
              onClick={handleOpenProfileModal}
            />
            <ListRow
              icon={<ShieldCheck size={18} />}
              title={t('Change Account Password')}
              subtitle={t('Update login password securely')}
              showChevron
              onClick={() => {
                handleOpenProfileModal();
                setProfileTab('PASSWORD');
              }}
            />
            <ListRow
              icon={<Bell size={18} />}
              title={t('Push Notifications')}
              subtitle={pushSubscribed ? t('Active on this device') : t('Receive booking & dispatch updates')}
              showChevron
              onClick={handleEnablePushNotifications}
            />
            <ListRow
              icon={<Smartphone size={18} />}
              title={t('Install GalaxyFleet App')}
              subtitle={t('Add shortcut to your home screen')}
              showChevron
              onClick={handleInstallPwa}
            />
            {(user.role === 'DRV' || isPrivileged) && (
              <ListRow
                icon={<Navigation size={18} />}
                title={t('Driver Dispatch Console')}
                subtitle={t('View assigned orders & periodic GPS check-ins')}
                showChevron
                onClick={() => {
                  setNavSection('DRIVER');
                  setSheetSnap('full');
                }}
              />
            )}
            {isPrivileged && (
              <ListRow
                icon={<ShieldCheck size={18} />}
                title={t('Admin Command Console')}
                subtitle={t('Approvals, vehicles, analytics & audit log')}
                showChevron
                onClick={() => setNavSection('ADMIN')}
              />
            )}
            <ListRow
              icon={<LogOut size={18} />}
              title={t('Sign Out')}
              danger
              onClick={handleLogout}
            />
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // BOOKING FLOW STEP 0: HOME (Passengers only; Drivers strictly stay in Driver Dispatch)
    // -------------------------------------------------------------------------
    if (isDriverOnly && navSection === 'HOME') {
      setNavSection('DRIVER');
      return null;
    }

    // -------------------------------------------------------------------------
    // FLEET SCHEDULE & AVAILABILITY BOARD (Revisions #10 & #14)
    // -------------------------------------------------------------------------
    if (bookingStep === 'SCHEDULE_VIEW') {
      const todayStr = new Date().toISOString().slice(0, 10);
      const filteredVehicles = vehicles.filter((v) => {
        if (scheduleFilterTab === 'AVAILABLE') {
          return v.status === 'Available';
        }
        if (scheduleFilterTab === 'BOOKED') {
          return trips.some((t) => t.vehicle_id === v.id && String(t.start_time).startsWith(todayStr) && t.status !== 'CANCELLED' && t.status !== 'REJECTED');
        }
        return true;
      });

      // Filter driver agenda if current user is DRV or has trips
      const driverAgendaTrips = trips.filter((t) => {
        return (t.assigned_driver_user_id === user.id || t.assigned_driver_name === user.nickname) && t.status !== 'CANCELLED' && t.status !== 'REJECTED';
      });

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feedbackBanner}

          {/* Header with Back navigation button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <button
              id="schedule-back-btn"
              type="button"
              className="gf-icon-btn-48 pressable"
              onClick={() => {
                if (user.role === 'DRV') {
                  setNavSection('DRIVER');
                  setSheetSnap('full');
                } else {
                  setBookingStep('HOME');
                }
              }}
              aria-label="Back"
              title="Back"
            >
              <ChevronRight size={22} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="type-title" style={{ fontSize: '19px' }}>Fleet Schedule</h1>
              <p className="type-caption">Live operational timetable & dedicated drivers</p>
            </div>
            <StatusBadge label="Live Availability" tone="green" />
          </div>

          {/* Filter Chips */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            <Chip active={scheduleFilterTab === 'ALL'} onClick={() => setScheduleFilterTab('ALL')}>
              All Cars ({vehicles.length})
            </Chip>
            <Chip active={scheduleFilterTab === 'AVAILABLE'} onClick={() => setScheduleFilterTab('AVAILABLE')}>
              Available Now ({vehicles.filter((v) => v.status === 'Available').length})
            </Chip>
            <Chip active={scheduleFilterTab === 'BOOKED'} onClick={() => setScheduleFilterTab('BOOKED')}>
              Booked Today
            </Chip>
          </div>

          {/* Driver Daily Agenda Card (if Driver account or has assigned trips) */}
          {(user.role === 'DRV' || driverAgendaTrips.length > 0) && (
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-card)',
                background: 'var(--color-bg-subtle)',
                border: '1.5px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="type-section" style={{ fontSize: '15px' }}>📋 My Driver Agenda (Today)</span>
                <StatusBadge label={`${driverAgendaTrips.length} Bookings`} tone="blue" />
              </div>
              {driverAgendaTrips.length === 0 ? (
                <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                  No trips assigned to you today. Ready on standby.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {driverAgendaTrips.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-control)',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span className="mono" style={{ fontWeight: 700, fontSize: '13px' }}>
                          {new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {formatReservationModeLabel(t.reservation_type, t.return_pickup_time) && (
                            <StatusBadge label={formatReservationModeLabel(t.reservation_type, t.return_pickup_time)!} tone="blue" />
                          )}
                          <StatusBadge label={t.status} tone={toneFromStatus(t.status)} />
                        </div>
                      </div>
                      <div className="type-caption" style={{ marginTop: '4px', fontWeight: 600 }}>
                        {t.origin} ➔ {t.destination}
                      </div>
                      <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                        Passenger: {t.passenger_nickname || 'Team'} • <span className="notranslate" translate="no">{t.department_name}</span> • Car: {t.registration_plate}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Vehicle Schedule Timeline Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredVehicles.map((v) => {
              const vehicleTripsToday = trips.filter(
                (t) => t.vehicle_id === v.id && String(t.start_time).startsWith(todayStr) && t.status !== 'CANCELLED' && t.status !== 'REJECTED'
              );
              const isFreeNow = v.status === 'Available' && vehicleTripsToday.every((t) => {
                const now = Date.now();
                const start = new Date(t.start_time).getTime();
                const end = new Date(t.end_time).getTime();
                return now < start || now > end;
              });

              return (
                <div
                  key={v.id}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-card)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {/* Top Bar: Plate + Model + Dedicated Driver */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          className="mono"
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1.5px solid var(--color-text-primary)',
                            fontWeight: 800,
                            fontSize: '12px',
                          }}
                        >
                          {v.registration_plate}
                        </span>
                        <span className="type-body" style={{ fontWeight: 700 }}>
                          {v.make} {v.model}
                        </span>
                      </div>
                      <div className="type-caption" style={{ marginTop: '4px', color: 'var(--color-text-secondary)' }}>
                        👤 Dedicated Driver: <strong>{v.default_driver_name || 'Pool Driver'}</strong>
                        {v.default_driver_phone && <span className="mono"> ({v.default_driver_phone})</span>}
                      </div>
                    </div>
                    <StatusBadge
                      label={isFreeNow ? 'Available Now' : v.status !== 'Available' ? v.status : 'Booked'}
                      tone={isFreeNow ? 'green' : v.status !== 'Available' ? 'neutral' : 'amber'}
                    />
                  </div>

                  {/* 24-Hour Visual Schedule Bar (08:00 - 20:00 range) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }} className="type-caption mono">
                      <span>08:00</span>
                      <span>12:00</span>
                      <span>16:00</span>
                      <span>20:00</span>
                    </div>
                    <div className="gf-timeline-track" style={{ position: 'relative' }}>
                      {vehicleTripsToday.map((t) => {
                        const startH = new Date(t.start_time).getHours() + new Date(t.start_time).getMinutes() / 60;
                        const endH = new Date(t.end_time).getHours() + new Date(t.end_time).getMinutes() / 60;
                        const leftPct = Math.max(0, Math.min(100, ((startH - 8) / 12) * 100));
                        const widthPct = Math.max(8, Math.min(100 - leftPct, ((endH - startH) / 12) * 100));

                        return (
                          <div
                            key={t.id}
                            className="gf-timeline-block"
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            title={`${new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${t.department_name} (${t.passenger_nickname || 'Team'})`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Booking Slots Text List */}
                  <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: '8px' }}>
                    {vehicleTripsToday.length === 0 ? (
                      <div className="type-caption" style={{ color: 'var(--color-green-text)', fontWeight: 600 }}>
                        ✅ Available full day — No scheduled bookings today
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div className="type-caption" style={{ fontWeight: 700 }}>
                          Booked Slots Today ({vehicleTripsToday.length}):
                        </div>
                        {vehicleTripsToday.map((t) => {
                          const modeLabel = formatReservationModeLabel(t.reservation_type, t.return_pickup_time);
                          return (
                            <div key={t.id} className="type-caption" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span className="mono" style={{ fontWeight: 700 }}>
                                🕒 {new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}:
                              </span>
                              <span>
                                <span className="notranslate" translate="no"><strong>{t.department_name}</strong></span> (Passenger: {t.passenger_nickname || 'Team'})
                              </span>
                              {modeLabel && (
                                <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#ebf5ff', color: '#005bb5', border: '1px solid #bfdbfe' }}>
                                  {modeLabel}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quick Action: Book This Car (Passengers only, never for drivers) */}
                  {user.role !== 'DRV' && (
                    <button
                      type="button"
                      className="gf-btn gf-btn-secondary gf-btn-full"
                      style={{ minHeight: '36px', fontSize: '13px' }}
                      onClick={() =>
                        requireLocationBeforeCarUse(() => {
                          setBookVehicleId(v.id);
                          setBookReservationType('ONE_WAY');
                          setBookingStep('ROUTE');
                          setSheetSnap('full');
                        })
                      }
                    >
                      Select & Book This Vehicle
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // BOOKING FLOW STEP 0: HOME
    // -------------------------------------------------------------------------
    if (bookingStep === 'HOME') {
      const isNightHero = new Date().getHours() >= 18 || new Date().getHours() < 5;
      const oneTapDest = recentDestinationChips[0] || QUICK_CORPORATE_POIS[0]?.name || 'Sudirman Central Business District (SCBD)';
      const oneTapAddr = recentPlacesList[0]?.address || QUICK_CORPORATE_POIS[0]?.address || 'Jl. Jend. Sudirman Kav 52-53, Jakarta Selatan';

      const myHomeTrips = (isPrivileged
        ? trips.filter((tr) => tr.requester_id === user.id || tr.requester_name === user.nickname)
        : trips
      )
        .slice()
        .sort((a, b) => Number(b.id) - Number(a.id));

      const ongoingTripCard = ongoingTrips.length > 0 && (() => {
        const topTrip = ongoingTrips[0];
        const isApproved = topTrip.status === 'APPROVED' || topTrip.status === 'IN_PROGRESS';
        const isDual = topTrip.requires_dual_approval;
        let statusText = t('Waiting for approval');
        let badgeTone: 'green' | 'amber' | 'blue' = 'amber';
        let badgeLabel = 'PENDING';

        if (topTrip.status === 'IN_PROGRESS') {
          statusText = topTrip.assigned_driver_name ? `${t('In Trip')} • Driver: ${topTrip.assigned_driver_name}` : t('In Trip');
          badgeTone = 'blue';
          badgeLabel = 'IN TRIP';
        } else if (topTrip.status === 'APPROVED') {
          statusText = topTrip.assigned_driver_name ? `Driver: ${topTrip.assigned_driver_name}` : 'Approved & Dispatched';
          badgeTone = 'blue';
          badgeLabel = 'APPROVED';
        } else if (isDual && topTrip.pic_approved) {
          statusText = 'Approved by Fleet PIC • Awaiting Head of WS Part';
          badgeTone = 'amber';
          badgeLabel = 'STAGE 1';
        } else if (isDual && topTrip.hws_approved) {
          statusText = 'Approved by Head of WS Part • Awaiting Fleet PIC';
          badgeTone = 'amber';
          badgeLabel = 'STAGE 1';
        }

        return (
          <button
            type="button"
            className="gf-option-row is-selected pressable"
            style={{ minHeight: '64px', display: 'flex', alignItems: 'center', gap: '12px' }}
            onClick={() => {
              setFocusedTripId(topTrip.id);
              setBookingStep(topTrip.status === 'PENDING_APPROVAL' ? 'WAITING' : 'IN_TRIP');
              setSheetSnap('half');
            }}
          >
            <div className="gf-circle-icon" style={{ background: isApproved ? '#0072de' : 'var(--color-amber)', color: '#ffffff', flexShrink: 0 }}>
              <Car size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span className="type-body" style={{ fontWeight: 700 }}>{statusText}</span>
                <StatusBadge label={badgeLabel} tone={badgeTone} />
              </div>
              <div className="type-caption" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                {topTrip.origin} → {topTrip.destination} • {topTrip.make} {topTrip.model} ({topTrip.registration_plate || '—'})
              </div>
            </div>
            <ChevronRight size={18} style={{ color: '#0072de', flexShrink: 0 }} />
          </button>
        );
      })();

      // PROTOTYPE SCREEN 1: SIMPLE EMPLOYEE HOME
      if (customerHomeMode === 'SUPER_APP') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {feedbackBanner}

            {/* Clean Search Pill + Profile Circle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                id="home-where-to-btn"
                type="button"
                className="gf-proto-sbar pressable"
                onClick={() =>
                  requireLocationBeforeCarUse(() => {
                    setBookReservationType('ONE_WAY');
                    setBookingStep('ROUTE');
                    setSheetSnap('full');
                  })
                }
                aria-label={t('Search services')}
              >
                <Search size={18} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '14px', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t('Search services')}
                </span>
              </button>
              <button
                type="button"
                className="gf-driver-avatar-btn pressable"
                onClick={handleOpenProfileModal}
                title={t('Profile')}
                style={{ width: '40px', height: '40px', flexShrink: 0 }}
              >
                <img
                  src={user.photo_url || getDriverAvatarDataUri(user.nickname || 'User')}
                  alt={user.nickname}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </button>
            </div>

            {/* Clean 4-Column Service Grid (Car, Shuttle [Under Development], Schedule, Fleet Helpdesk [+ Admin if privileged]) */}
            <div className="gf-proto-shortcut-grid">
              <button
                type="button"
                className="gf-proto-shortcut-item pressable"
                onClick={() => {
                  setCustomerHomeMode('GOCAR_LANDING');
                  setSheetSnap('full');
                }}
              >
                <div className="gf-proto-shortcut-tile is-primary">
                  <Car size={26} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>{t('Car')}</span>
              </button>

              <button
                type="button"
                className="gf-proto-shortcut-item pressable"
                onClick={() => {
                  setStatusBanner({
                    type: 'info',
                    text: t('Shuttle Bus service is currently under development.'),
                  });
                }}
                title={t('Under Development')}
              >
                <div className="gf-proto-shortcut-tile">
                  <Bus size={24} />
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-6px',
                      background: '#0a0a0a',
                      color: '#ffffff',
                      fontSize: '8.5px',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: '9999px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Dev
                  </span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{t('Shuttle Bus')}</span>
              </button>

              <button
                type="button"
                className="gf-proto-shortcut-item pressable"
                onClick={() => {
                  setBookingStep('SCHEDULE_VIEW');
                  setSheetSnap('full');
                }}
              >
                <div className="gf-proto-shortcut-tile">
                  <Calendar size={24} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{t('Set Schedule')}</span>
              </button>

              <button
                type="button"
                className="gf-proto-shortcut-item pressable"
                onClick={() => window.open(FLEET_HELPDESK_WHATSAPP_URL, '_blank')}
                title={`Fleet Helpdesk: ${FLEET_HELPDESK_PIC_LABEL}`}
              >
                <div className="gf-proto-shortcut-tile">
                  <Phone size={24} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{t('Fleet Helpdesk')}</span>
              </button>

              {isPrivileged && (
                <button
                  type="button"
                  className="gf-proto-shortcut-item pressable"
                  onClick={() => setNavSection('ADMIN')}
                  title={t('Admin Command Console')}
                >
                  <div className="gf-proto-shortcut-tile">
                    <ShieldCheck size={24} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>{t('Admin')}</span>
                </button>
              )}
            </div>

            {/* Prototype Activity Section directly on Home */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>{t('Activity')}</h2>
                {myHomeTrips.length > 0 && (
                  <button
                    type="button"
                    className="gf-btn gf-btn-ghost"
                    style={{ minHeight: '28px', padding: '0 6px', fontSize: '12px', fontWeight: 700, color: '#0072de' }}
                    onClick={() => setNavSection('ACTIVITY')}
                  >
                    {t('History')} →
                  </button>
                )}
              </div>

              {loadingData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Skeleton height={86} />
                  <Skeleton height={86} />
                </div>
              ) : myHomeTrips.length === 0 ? (
                <div className="gf-proto-empty">
                  <b>{t('No bookings yet')}</b>
                  {t('Tap Car to start a booking.')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {myHomeTrips.slice(0, 6).map((tr) => {
                    const isCancelled = tr.booking_status === 'CANCELLED' || tr.status === 'CANCELLED';
                    const isPending = tr.status === 'PENDING_APPROVAL' && !isCancelled;
                    const badgeLabel = isCancelled
                      ? 'CANCELLED'
                      : tr.status === 'APPROVED' && tr.registration_plate
                      ? `${tr.status} · ${tr.registration_plate}`
                      : tr.status === 'IN_PROGRESS' && tr.registration_plate
                      ? `IN TRIP · ${tr.registration_plate}`
                      : tr.status === 'PENDING_APPROVAL' && tr.requires_dual_approval && tr.pic_approved
                      ? 'AWAITING HWS'
                      : tr.status === 'PENDING_APPROVAL' && tr.requires_dual_approval && tr.hws_approved
                      ? 'AWAITING PIC'
                      : tr.status;
                    const badgeTone = isCancelled ? 'red' : toneFromStatus(tr.status);
                    const modeLabel = formatReservationModeLabel(tr.reservation_type, tr.return_pickup_time);

                    return (
                      <div
                        key={tr.id}
                        className="gf-proto-card pressable"
                        style={{ cursor: isPending || tr.status === 'APPROVED' || tr.status === 'IN_PROGRESS' ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (isPending || tr.status === 'APPROVED' || tr.status === 'IN_PROGRESS') {
                            setFocusedTripId(tr.id);
                            setBookingStep(isPending ? 'WAITING' : 'IN_TRIP');
                            setSheetSnap('half');
                          }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, fontSize: '14px' }}>
                            {tr.make ? `${tr.make} ${tr.model}` : t('Operational Car')}
                          </span>
                          <StatusBadge label={badgeLabel} tone={badgeTone} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                          <span className="gf-proto-pn" />
                          <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tr.origin}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                          <span className="gf-proto-od" />
                          <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tr.destination}
                          </span>
                        </div>

                        <div className="type-caption" style={{ marginTop: '7px' }}>
                          {new Date(tr.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })} ·{' '}
                          {new Date(tr.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {new Date(tr.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                          {tr.passenger_count || 1} pax
                          {tr.purpose ? ` · ${tr.purpose}` : ''}
                          {modeLabel ? ` · ${modeLabel}` : ''}
                        </div>

                        {isPending && (
                          <div style={{ marginTop: '10px' }}>
                            <button
                              type="button"
                              className="gf-proto-btn gf-proto-btn-r gf-proto-btn-s pressable"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelBookingRequest(tr);
                              }}
                            >
                              {t('Cancel')}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      }

      // PROTOTYPE SCREEN 2: CAR BOOKING LANDING (Samsung Blue Day/Night Sky Hero + Overlapping Sheet)
      return (
        <div className="gf-proto-land-shell">
          <div className="gf-proto-hero">
            <svg viewBox="0 0 412 205" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <defs>
                <linearGradient id="gfProtoSkyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor={isNightHero ? '#0B1F4D' : '#6FCBEF'} />
                  <stop offset="1" stopColor={isNightHero ? '#1B3E86' : '#CDEEF8'} />
                </linearGradient>
              </defs>
              <rect width="412" height="205" fill="url(#gfProtoSkyGrad)" />
              {isNightHero ? (
                <>
                  <circle cx="70" cy="48" r="16" fill="#FFE9A8" />
                  <circle cx="78" cy="42" r="14" fill="#0B1F4D" />
                  <g fill="#ffffff">
                    <circle cx="150" cy="30" r="1.5" />
                    <circle cx="260" cy="50" r="1.5" />
                    <circle cx="340" cy="26" r="2" />
                    <circle cx="200" cy="70" r="1.2" />
                  </g>
                </>
              ) : (
                <circle cx="340" cy="52" r="24" fill="#FFE27A" />
              )}
              <g fill={isNightHero ? '#16306B' : '#9ED8EE'}>
                <rect x="40" y="105" width="26" height="70" />
                <rect x="300" y="85" width="30" height="90" />
                <rect x="340" y="115" width="24" height="60" />
              </g>
              <ellipse cx="206" cy="260" rx="300" ry="100" fill="#0072de" />
            </svg>

            <button
              type="button"
              className="gf-proto-hero-back pressable"
              onClick={() => {
                setCustomerHomeMode('SUPER_APP');
                setSheetSnap('half');
              }}
              aria-label={t('Back')}
            >
              <ArrowLeft size={20} />
            </button>

            <div style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 3, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <LanguageSwitcher compact />
            </div>
          </div>

          <div className="gf-proto-blue-band" style={{ paddingTop: '4px', paddingBottom: '22px' }}>
            <div className="gf-proto-gr" style={{ marginTop: '-52px', marginBottom: '12px' }}>
              <h2>{t('Where to,')} {user.nickname}?</h2>
              <p>{t('Operational cars ready to roll.')}</p>
            </div>

            <button
              type="button"
              className="gf-proto-promo pressable"
              onClick={() => setNavSection('ACTIVITY')}
            >
              <span
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  color: '#0072de',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Info size={18} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: '13.5px' }}>{t('Booking reviewed before departure')}</b>
                <span style={{ fontSize: '11.5px', opacity: 0.92 }}>{t('Reviewed by Fleet PIC & Head of WS. Check status here.')}</span>
              </span>
              <ChevronRight size={18} style={{ flexShrink: 0 }} />
            </button>
          </div>

          <div className="gf-proto-wc" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {statusBanner && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-control)',
                  background: statusBanner.type === 'danger' ? 'var(--color-status-red-bg)' : 'var(--color-status-green-bg)',
                  color: statusBanner.type === 'danger' ? 'var(--color-status-red-fg)' : 'var(--color-status-green-fg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <span className="type-caption" style={{ fontWeight: 700, color: 'inherit' }}>{statusBanner.text}</span>
                <button
                  type="button"
                  onClick={() => setStatusBanner(null)}
                  style={{ border: 'none', background: 'transparent', color: 'inherit', fontWeight: 700, cursor: 'pointer', minHeight: '32px' }}
                >
                  OK
                </button>
              </div>
            )}
            <svg viewBox="0 0 380 86" style={{ width: '100%', height: '86px', borderRadius: '12px', display: 'block' }} aria-hidden="true">
              <rect width="380" height="86" fill="#edf1f7" />
              <path d="M0 64C100 18 200 78 380 26" stroke="#ffffff" strokeWidth="8" fill="none" />
              <circle cx="190" cy="44" r="6" fill="#0072de" stroke="#ffffff" strokeWidth="2" />
            </svg>

            <button
              id="home-where-to-btn"
              type="button"
              className="gf-proto-sbar pressable"
              onClick={() =>
                requireLocationBeforeCarUse(() => {
                  setBookReservationType('ONE_WAY');
                  setBookingStep('ROUTE');
                  setSheetSnap('full');
                })
              }
            >
              <span className="gf-proto-od" style={{ width: '16px', height: '16px' }} aria-hidden="true" />
              <span style={{ flex: 1, fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '14px' }}>
                {t('Where to?')}
              </span>
              <Search size={18} />
            </button>

            <div className="gf-proto-chips" style={{ margin: 0 }}>
              {(recentDestinationChips.length > 0 ? recentDestinationChips : QUICK_CORPORATE_POIS.map((p) => p.label)).map((dest) => (
                <button
                  key={dest}
                  type="button"
                  onClick={() =>
                    requireLocationBeforeCarUse(() => {
                      const matchedPoi = QUICK_CORPORATE_POIS.find((p) => p.label === dest || p.name === dest);
                      setBookDest(matchedPoi ? matchedPoi.name : dest);
                      if (matchedPoi) setDestCoords({ lat: matchedPoi.lat, lon: matchedPoi.lon });
                      setBookingStep('ROUTE');
                      setSheetSnap('full');
                    })
                  }
                >
                  <Bookmark size={14} style={{ color: '#0072de' }} />
                  <span>{dest}</span>
                </button>
              ))}
            </div>

            {ongoingTripCard}

            {/* OneTap Quick Booking Card */}
            <div className="gf-gocar-onetap-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ background: '#0072de', color: '#ffffff', fontSize: '10.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '9999px' }}>
                    OneTap
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    GalaxyFleet
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 800, fontStyle: 'italic', padding: '2px 6px', borderRadius: '4px', background: '#0a0a0a', color: '#ffffff' }}>
                    PRIORITY
                  </span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#0072de', padding: '2px 8px', borderRadius: '9999px', background: '#ebf5ff' }}>
                  Work Trip
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {oneTapDest}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                    {oneTapAddr}
                  </div>
                </div>
                <button
                  type="button"
                  className="pressable"
                  aria-label={`OneTap book to ${oneTapDest}`}
                  onClick={() =>
                    requireLocationBeforeCarUse(() => {
                      setBookDest(oneTapDest);
                      setBookReservationType('ONE_WAY');
                      setBookingStep('VEHICLE');
                      setSheetSnap('full');
                    })
                  }
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '9999px',
                    border: 'none',
                    background: '#0072de',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <ArrowRight size={18} strokeWidth={2.5} />
                </button>
              </div>

              <div style={{ borderTop: '1.5px dashed var(--color-border)', paddingTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="gf-pickup-up-circle" style={{ width: '18px', height: '18px' }}>
                  <ArrowUp size={11} strokeWidth={3} />
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Pickup: {bookOrigin || 'Current GPS Location'}
                </span>
              </div>
            </div>

            {/* Clean Recent / Corporate Locations List */}
            <div style={{ borderRadius: '16px', border: '1px solid var(--color-divider)', background: 'var(--color-bg-surface)', padding: '0 12px' }}>
              {(recentPlacesList.length > 0 ? recentPlacesList : QUICK_CORPORATE_POIS).slice(0, 3).map((place, i) => {
                const isSaved = savedPlaces.some((sp) => sp.name === place.name);
                return (
                  <ListRow
                    key={`${place.name}-${i}`}
                    icon={<Clock size={18} />}
                    title={place.name}
                    subtitle={place.address}
                    trailing={
                      <button
                        type="button"
                        aria-label={isSaved ? 'Remove bookmark' : 'Bookmark place'}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSavePlace(place);
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: isSaved ? '#0072de' : 'var(--color-text-muted)',
                          cursor: 'pointer',
                          padding: '6px',
                        }}
                      >
                        <Bookmark size={16} />
                      </button>
                    }
                    onClick={() =>
                      requireLocationBeforeCarUse(() => {
                        setBookDest(place.name);
                        setDestCoords({ lat: place.lat, lon: place.lon });
                        setBookReservationType('ONE_WAY');
                        setBookingStep('VEHICLE');
                        setSheetSnap('full');
                      })
                    }
                  />
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // BOOKING FLOW STEP 1: WHERE TO? (Screens 2, 3 & 4 of GoCar Reference PDF)
    // -------------------------------------------------------------------------
    if (bookingStep === 'ROUTE') {
      const activeText = (activeRouteField === 'pickup' ? bookOrigin : bookDest).trim();
      const showingLiveSearch = activeText.length >= 2 && geoResults.length > 0;
      const listToDisplay: GeoPlace[] = showingLiveSearch
        ? geoResults
        : routeTab === 'SAVED'
        ? savedPlaces
        : recentPlacesList;

      const pickupSpots: Array<{ letter: 'A' | 'B' | 'C'; title: string; subtitle: string; walk: string }> = [
        {
          letter: 'A',
          title: `Lobby Main Entrance • ${bookOrigin || 'Pickup Point'}`,
          subtitle: 'Nearest drop-off & chauffeur staging bay • Recommended',
          walk: '1 min walk',
        },
        {
          letter: 'B',
          title: `North Gate / Security Post • ${bookOrigin || 'Pickup Point'}`,
          subtitle: 'Fast main road access towards Sudirman / Gatot Subroto',
          walk: '2 min walk',
        },
        {
          letter: 'C',
          title: `VIP Basement / East Wing • ${bookOrigin || 'Pickup Point'}`,
          subtitle: 'Covered weather-protected pickup zone',
          walk: '3 min walk',
        },
      ];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* GoCar Reference Screen 2: Top Bar with Close (X) + Title + Use GPS */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="gf-icon-btn-48 pressable"
                onClick={() => {
                  setBookingStep('HOME');
                  setSheetSnap('half');
                }}
                aria-label="Close route search"
                style={{ width: '36px', height: '36px' }}
              >
                <X size={18} />
              </button>
              <h1 className="type-title" style={{ fontSize: '20px' }}>
                {routeTab === 'PICKUP' ? 'Confirm pickup spot' : 'Where to today?'}
              </h1>
            </div>
            <button
              type="button"
              className="gf-btn gf-btn-ghost"
              style={{ minHeight: '34px', padding: '0 10px', fontSize: '12.5px', color: '#0072de', fontWeight: 700 }}
              onClick={handleUseCurrentGpsForField}
            >
              <Navigation size={14} /> Use GPS
            </button>
          </div>

          {/* GoCar Reference Screen 2 & 3: Route Input Card (20px radius, #F9FAFB fill, Up-arrow Pickup + Target Ring-dot Dest) */}
          <RouteFields
            pickup={bookOrigin}
            destination={bookDest}
            onPickupChange={(val) => {
              setBookOrigin(val);
              if (!val.trim()) setOriginCoords(null);
            }}
            onDestinationChange={(val) => {
              setBookDest(val);
              if (!val.trim()) setDestCoords(null);
            }}
            activeField={activeRouteField}
            onFocusField={(field) => {
              setActiveRouteField(field);
              if (routeTab === 'PICKUP') setRouteTab('RECENT');
            }}
            pickupPlaceholder="Your current pickup location"
            destinationPlaceholder="Search for a destination"
            onAddStop={handleAddStop}
            multiStopToast={multiStopToast}
          />

          {/* GoCar Reference Screen 2: Outlined Action Pills ("Select via map" & "Pickup spot A/B/C") */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`gf-action-pill-outlined pressable ${routeTab === 'PIN' ? 'is-active' : ''}`}
              onClick={() => {
                setRouteTab(routeTab === 'PIN' ? 'RECENT' : 'PIN');
                setSheetSnap(routeTab === 'PIN' ? 'full' : 'peek');
              }}
            >
              <MapPin size={15} style={{ color: routeTab === 'PIN' ? '#ffffff' : '#0072de' }} />
              Select via map
            </button>

            <button
              type="button"
              className={`gf-action-pill-outlined pressable ${routeTab === 'PICKUP' ? 'is-active' : ''}`}
              onClick={() => {
                setRouteTab(routeTab === 'PICKUP' ? 'RECENT' : 'PICKUP');
                setSheetSnap('full');
              }}
            >
              <Navigation size={15} style={{ color: routeTab === 'PICKUP' ? '#ffffff' : '#0a0a0a' }} />
              Pickup spot ({selectedPickupSpot})
            </button>

            <button
              type="button"
              className={`gf-action-pill-outlined pressable ${routeTab === 'SAVED' ? 'is-active' : ''}`}
              onClick={() => {
                setRouteTab(routeTab === 'SAVED' ? 'RECENT' : 'SAVED');
                setSheetSnap('full');
              }}
            >
              <Bookmark size={15} style={{ color: routeTab === 'SAVED' ? '#ffffff' : '#0072de' }} />
              Saved places
            </button>
          </div>

          {/* Live Calculated Route ETA, Ride Time & Distance Banner */}
          {bookOrigin.trim() && bookDest.trim() && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-control)',
                background: '#ebf5ff',
                border: '1px solid #93c5fd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Navigation size={16} style={{ color: '#005bb5' }} />
                <span className="type-body" style={{ fontWeight: 700, color: '#005bb5' }}>
                  {calculatingRoute
                    ? 'Calculating route path & ETA...'
                    : `${currentMetrics.distanceKm} km • ~${currentMetrics.durationMin} min ride`}
                </span>
              </div>
              <StatusBadge label={`ETA ${currentMetrics.etaText}`} tone="blue" />
            </div>
          )}

          {/* Instant Quick-Pick Corporate Destinations */}
          {routeTab !== 'PICKUP' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                className="type-caption"
                style={{
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontSize: '11px',
                }}
              >
                Quick Corporate Locations
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '4px',
                  scrollbarWidth: 'none',
                }}
              >
                {QUICK_CORPORATE_POIS.map((poi) => (
                  <button
                    key={poi.name}
                    type="button"
                    className="pressable"
                    onClick={() => {
                      if (activeRouteField === 'pickup') {
                        setBookOrigin(poi.name);
                        setOriginCoords({ lat: poi.lat, lon: poi.lon });
                        setActiveRouteField('destination');
                      } else {
                        setBookDest(poi.name);
                        setDestCoords({ lat: poi.lat, lon: poi.lon });
                      }
                    }}
                    style={{
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-pill)',
                      padding: '6px 14px',
                      background: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {poi.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* GoCar Reference Screen 4: Pickup Point Confirmation (Lettered Spots A, B, C) */}
          {routeTab === 'PICKUP' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <div className="type-section" style={{ fontSize: '16px', fontWeight: 800 }}>
                    Confirm pickup point
                  </div>
                  <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                    Select a lettered gate or lobby spot for faster chauffeur rendezvous
                  </div>
                </div>
                <button
                  type="button"
                  className="pressable"
                  onClick={() => {
                    setRouteTab('RECENT');
                    setActiveRouteField('pickup');
                  }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '9999px',
                    background: '#ebf5ff',
                    color: '#005bb5',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              </div>

              {pickupSpots.map((spot) => {
                const isSelected = selectedPickupSpot === spot.letter;
                return (
                  <button
                    key={spot.letter}
                    type="button"
                    className={`gf-pickup-spot-row pressable ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedPickupSpot(spot.letter);
                      const baseOrigin = (bookOrigin || 'Samsung Office Jakarta').replace(/\s*\(Spot [ABC]\)$/i, '');
                      setBookOrigin(`${baseOrigin} (Spot ${spot.letter})`);
                    }}
                  >
                    <span className={`gf-pickup-letter-circle ${isSelected ? 'is-selected' : ''}`}>
                      {spot.letter}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {spot.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {spot.subtitle} • {spot.walk}
                      </div>
                    </div>
                    <span className={`gf-radio-circle ${isSelected ? 'is-checked' : ''}`} />
                  </button>
                );
              })}
            </div>
          ) : routeTab === 'PIN' ? (
            <div style={{ padding: '12px 0' }}>
              <div className="type-body" style={{ fontWeight: 700 }}>Drag OpenStreetMap to set location</div>
              <p className="type-caption" style={{ marginTop: '4px' }}>
                Pan the map or use arrow keys to place the center pin for your {activeRouteField === 'pickup' ? 'pickup point' : 'destination'}.
              </p>
              <div className="type-body" style={{ marginTop: '10px', fontWeight: 700, color: '#0072de' }}>
                {(activeRouteField === 'pickup' ? bookOrigin : bookDest) || 'Pan map to resolve street address...'}
              </div>
            </div>
          ) : geoLoading ? (
            /* GoCar Reference Screen 3: Shimmer Skeleton Loading Rows */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </div>
          ) : listToDisplay.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeText.length >= 2 && (
                <ListRow
                  tall
                  icon={<MapPin size={18} style={{ color: '#0072de' }} />}
                  title={`Use typed address: "${activeText}"`}
                  subtitle="Select this location directly or refine coordinates using Select via map"
                  showChevron
                  onClick={() => {
                    if (activeRouteField === 'pickup') {
                      setBookOrigin(activeText);
                      setOriginCoords(null);
                      setActiveRouteField('destination');
                    } else {
                      setBookDest(activeText);
                      setDestCoords(null);
                    }
                  }}
                />
              )}
              <EmptyState
                message={
                  activeText.length >= 2
                    ? 'No exact map match returned above. Tap your typed address above to use it, or tap Select via map to pin manually.'
                    : routeTab === 'SAVED'
                    ? 'No saved places yet. Search any Indonesian city, street, or landmark above and tap the bookmark icon to save it.'
                    : 'Type at least 2 characters to search any city, district, landmark, or address across Indonesia.'
                }
              />
            </div>
          ) : (
            /* GoCar Reference Screen 3: Live Search Results with Distance, Highlighted Query & Sub-location Band */
            <div>
              {listToDisplay.map((p, idx) => {
                const isSaved = savedPlaces.some((sp) => sp.name === p.name && sp.address === p.address);
                const approxKm = originCoords
                  ? Math.max(0.4, Math.hypot((p.lat - originCoords.lat) * 111, (p.lon - originCoords.lon) * 111)).toFixed(1)
                  : (1.8 + idx * 1.4).toFixed(1);

                return (
                  <React.Fragment key={`${p.name}-${idx}`}>
                    <ListRow
                      tall
                      icon={
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                          {routeTab === 'SAVED' ? <Bookmark size={16} /> : <MapPin size={16} />}
                          <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                            {approxKm}km
                          </span>
                        </div>
                      }
                      title={showingLiveSearch ? highlightQueryMatch(p.name, activeText) : p.name}
                      subtitle={p.address}
                      trailing={
                        <button
                          type="button"
                          aria-label={isSaved ? 'Remove from saved places' : 'Save place'}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSavePlace(p);
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: isSaved ? '#0072de' : 'var(--color-text-muted)',
                            cursor: 'pointer',
                            padding: '6px',
                          }}
                        >
                          <Bookmark size={16} />
                        </button>
                      }
                      onClick={() => {
                        if (activeRouteField === 'pickup') {
                          setBookOrigin(p.name);
                          setOriginCoords({ lat: p.lat, lon: p.lon });
                          setActiveRouteField('destination');
                        } else {
                          setBookDest(p.name);
                          setDestCoords({ lat: p.lat, lon: p.lon });
                        }
                      }}
                    />
                    {idx === 0 && showingLiveSearch && (
                      <div
                        className="gf-sublocation-band pressable"
                        onClick={() => {
                          const gateName = `${p.name} (Main Lobby Gate)`;
                          if (activeRouteField === 'pickup') {
                            setBookOrigin(gateName);
                            setOriginCoords({ lat: p.lat, lon: p.lon });
                            setActiveRouteField('destination');
                          } else {
                            setBookDest(gateName);
                            setDestCoords({ lat: p.lat, lon: p.lon });
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Navigation size={13} style={{ color: '#0072de' }} />
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            Main Lobby / Drop-Off Entrance
                          </span>
                        </div>
                        <ChevronRight size={15} style={{ color: 'var(--color-text-muted)' }} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              {showingLiveSearch && (
                <ListRow
                  tall
                  icon={<MapPin size={16} style={{ color: '#0072de' }} />}
                  title={`Use typed address: "${activeText}"`}
                  subtitle="Use exact text you entered instead of suggested result"
                  showChevron
                  onClick={() => {
                    if (activeRouteField === 'pickup') {
                      setBookOrigin(activeText);
                      setOriginCoords(null);
                      setActiveRouteField('destination');
                    } else {
                      setBookDest(activeText);
                      setDestCoords(null);
                    }
                  }}
                />
              )}
            </div>
          )}
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // BOOKING FLOW STEP 2: PICK YOUR RIDE (Screens 5 & 6 of GoCar Reference PDF)
    // -------------------------------------------------------------------------
    if (bookingStep === 'VEHICLE') {
      const activeDrivers = (liveAvailability?.drivers?.length ? liveAvailability.drivers : drivers).filter(
        (d) => d.isAvailable !== false && d.availability_status === 'Active'
      );

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {feedbackBanner}

          {/* Prototype Vehicle Route Card (.gf-proto-rc) & Corporate Fleet Strip (.gf-proto-ban) */}
          <div className="gf-proto-rc">
            <div className="gf-proto-rc-row">
              <span className="gf-proto-pn" />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {bookOrigin || t('Pickup Location')}
              </span>
              <button
                type="button"
                className="gf-proto-btn gf-proto-btn-o gf-proto-btn-s pressable"
                style={{ height: '26px', padding: '0 10px', fontSize: '11px' }}
                onClick={() => setBookingStep('ROUTE')}
              >
                {t('Edit')}
              </button>
            </div>
            <div className="gf-proto-rc-row">
              <span className="gf-proto-od" />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {bookDest || t('Destination')}
              </span>
            </div>
            <div className="gf-proto-ban">
              <span>✓ {t('Internal Work Fleet • Chauffeur Included')}</span>
              <span style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                {currentMetrics.distanceKm} km • ~{currentMetrics.durationMin} min
              </span>
            </div>
          </div>

          {/* Service Category Underline Tabs (incl. Shuttle Dev tab per prototype) */}
          <div className="gf-underline-tabs" role="tablist" aria-label="Vehicle category tabs">
            {([
              { id: 'ALL', label: 'All Fleet' },
              { id: 'Electric', label: 'Electric EV ⚡' },
              { id: 'MPV', label: 'Executive & MPV' },
            ] as Array<{ id: 'ALL' | 'Electric' | 'MPV'; label: string }>).map((tab) => {
              const active = vehicleFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`gf-underline-tab ${active ? 'is-active' : ''}`}
                  onClick={() => setVehicleFilter(tab.id)}
                >
                  {t(tab.label)}
                </button>
              );
            })}
            <button
              type="button"
              role="tab"
              aria-selected={false}
              className="gf-underline-tab"
              onClick={() =>
                setStatusBanner({
                  type: 'info',
                  text: t('Shuttle Bus service is currently under development.'),
                })
              }
            >
              {t('Shuttle (Dev)')}
            </button>
          </div>

          {/* Active Schedule Banner (Gojek Scheduled Mode) or Instant Dispatch Pill */}
          {scheduleMode === 'SCHEDULE' ? (
            <div className="gf-active-schedule-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#0072de', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Calendar size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#005bb5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {t('Departure Schedule')}
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getScheduleSlotDisplay(bookStart, lang)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {bookReservationType === 'FULL_DAY' ? t('Full Day (Seharian)') : bookReservationType === 'DROP_AND_PICKUP' ? t('Drop & Pick Up') : t('Standard Trip')} • {bookDurationHours} {t('hours')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  type="button"
                  className="gf-btn gf-btn-secondary"
                  style={{ minHeight: '32px', height: '32px', padding: '0 10px', fontSize: '11.5px', fontWeight: 700 }}
                  onClick={() => setShowSchedulePicker(true)}
                >
                  {t('Change')}
                </button>
                <button
                  type="button"
                  className="gf-btn gf-btn-ghost"
                  style={{ minHeight: '32px', height: '32px', padding: '0 8px', fontSize: '11px', color: '#dc2626', fontWeight: 600 }}
                  title={t('Remove schedule and return to instant booking')}
                  onClick={() => {
                    setScheduleMode('NOW');
                    const sMs = roundUpTo5MinMs(Date.now() + 2 * 3600000);
                    setBookStart(toLocalDateTimeInput(new Date(sMs)));
                    setBookEnd(toLocalDateTimeInput(new Date(sMs + 2 * 3600000)));
                    setStatusBanner({
                      type: 'info',
                      text: t('Schedule cancelled. Returned to instant booking mode.'),
                    });
                  }}
                >
                  <X size={14} /> {t('Remove')}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '14px', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)' }}>
                <Clock size={16} style={{ color: '#0072de' }} />
                <span><strong>{t('Book Now')}</strong> • {t('Ready to depart immediately or tap schedule button for advance reservation')}</span>
              </div>
              <button
                type="button"
                className="gf-btn gf-btn-secondary gf-btn-sm"
                style={{ padding: '0 10px', height: '30px', fontSize: '11.5px', fontWeight: 700 }}
                onClick={() => setShowSchedulePicker(true)}
              >
                {t('Set Schedule')}
              </button>
            </div>
          )}

          {/* Dedicated Gojek-Style Schedule Picker Sheet ("Kapan mau berangkat?") */}
          {showSchedulePicker && (
            <div className="gf-modal-backdrop" onClick={() => setShowSchedulePicker(false)}>
              <div
                className="gf-modal-card"
                style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxWidth: '520px', maxHeight: '88dvh' }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={t('When do you want to leave?')}
              >
                {/* 1. Gojek Priority Strip Banner */}
                <div className="gf-gojek-priority-strip">
                  <ShieldCheck size={14} />
                  <span>{t('No worries, your booking is our priority')}</span>
                </div>

                {/* Top Header (Pinned so tabs & wheel have unobstructed scroll room below) */}
                <div style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexShrink: 0, borderBottom: '1px solid var(--color-divider)' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    {t('When do you want to leave?')}
                  </h2>
                  <button
                    type="button"
                    className="gf-icon-btn-48 pressable"
                    style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', flexShrink: 0 }}
                    onClick={() => setShowSchedulePicker(false)}
                    aria-label={t('Close')}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Scrollable Body (Block scroll box prevents flex children from squishing vertically) */}
                <div style={{ padding: '14px 20px 16px', flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* 2. 3-Tab Chips: Hari ini / Besok / Pilih tanggal */}
                  <div className="gf-gojek-tab-group" role="tablist">
                    {([
                      { id: 'TODAY', label: t('Today') },
                      { id: 'TOMORROW', label: t('Tomorrow') },
                      { id: 'DATE', label: t('Select date'), icon: <Calendar size={14} /> },
                    ] as Array<{ id: 'TODAY' | 'TOMORROW' | 'DATE'; label: string; icon?: React.ReactNode }>).map((tab) => {
                      const active = schedulePickerTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          className={`gf-gojek-tab-chip pressable ${active ? 'is-active' : ''}`}
                          onClick={() => {
                            setSchedulePickerTab(tab.id);
                            const curD = new Date(bookStart);
                            const curH = !Number.isNaN(curD.getTime()) ? curD.getHours() : 8;
                            const curM = !Number.isNaN(curD.getTime()) ? Math.floor(curD.getMinutes() / 5) * 5 : 0;
                            const target = new Date();
                            if (tab.id === 'TOMORROW') {
                              target.setDate(target.getDate() + 1);
                              target.setHours(curH, curM, 0, 0);
                            } else if (tab.id === 'TODAY') {
                              target.setHours(curH, curM, 0, 0);
                            } else {
                              target.setTime(!Number.isNaN(curD.getTime()) ? curD.getTime() : roundUpTo5MinMs(Date.now() + 2 * 3600000));
                            }
                            const sIso = toLocalDateTimeInput(target);
                            setBookStart(sIso);
                            const eMs = target.getTime() + bookDurationHours * 3600000;
                            setBookEnd(toLocalDateTimeInput(new Date(eMs)));
                            if (bookReservationType === 'DROP_AND_PICKUP') {
                              setBookReturnPickupTime(toLocalDateTimeInput(new Date(eMs - 1800000)));
                            }
                          }}
                        >
                          {tab.icon}
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 3. Gojek Estimate Card */}
                  <div className="gf-gojek-estimate-card">
                    <span className="gf-gojek-estimate-caption">{t('Pickup time estimate')}</span>
                    <span className="gf-gojek-estimate-value">
                      {schedulePickerTab === 'TODAY'
                        ? `${t('Today')} | ${selectedTimeSlot}`
                        : schedulePickerTab === 'TOMORROW'
                        ? `${t('Tomorrow')} | ${selectedTimeSlot}`
                        : `${new Date(bookStart).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'ko' ? 'ko-KR' : 'id-ID', { weekday: 'short', day: 'numeric', month: 'short' })} | ${selectedTimeSlot}`}
                    </span>
                  </div>

                  {/* 4. Gojek Authentic Drum Wheel Picker (3 Visible Rows, Selection Lens, Dual Wheel on "Pilih tanggal") */}
                  <div>
                    <GojekWheelPicker
                      mode={schedulePickerTab}
                      timeSlots={all5MinSlots}
                      selectedTimeSlot={selectedTimeSlot}
                      onSelectTimeSlot={handleSelectSlot}
                      dateList={dateList}
                      selectedDateId={selectedDateId}
                      onSelectDate={handleSelectDate}
                    />
                  </div>

                  {/* 5. Reservation Mode & Preset Shortcuts */}
                  <div>
                    <div className="type-caption" style={{ fontWeight: 700, marginBottom: '6px' }}>
                      {t('Trip Reservation Type')}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }} role="group" aria-label="Reservation mode">
                      {([
                        { id: 'ONE_WAY', label: t('Standard Trip'), sub: t('Point-to-point') },
                        { id: 'DROP_AND_PICKUP', label: t('Drop & Pick Up'), sub: t('Drop & pick up later') },
                        { id: 'FULL_DAY', label: t('Full Day'), sub: t('Full business day') },
                      ] as Array<{ id: 'ONE_WAY' | 'DROP_AND_PICKUP' | 'FULL_DAY'; label: string; sub: string }>).map((mode) => {
                        const selected = bookReservationType === mode.id;
                        return (
                          <button
                            key={mode.id}
                            id={`reservation-mode-${mode.id.toLowerCase()}`}
                            type="button"
                            className="pressable"
                            onClick={() => {
                              setBookReservationType(mode.id);
                              if (mode.id === 'DROP_AND_PICKUP') {
                                const baseStartMs = bookStart && !Number.isNaN(new Date(bookStart).getTime())
                                  ? new Date(bookStart).getTime()
                                  : roundUpTo5MinMs(Date.now() + 2 * 3600000);
                                if (!bookStart) setBookStart(toLocalDateTimeInput(new Date(baseStartMs)));
                                const existingRpMs = bookReturnPickupTime ? new Date(bookReturnPickupTime).getTime() : NaN;
                                const targetRpMs = !Number.isNaN(existingRpMs) && existingRpMs > baseStartMs
                                  ? existingRpMs
                                  : baseStartMs + 3 * 3600000;
                                setBookReturnPickupTime(toLocalDateTimeInput(new Date(targetRpMs)));
                                const curEndMs = bookEnd && !Number.isNaN(new Date(bookEnd).getTime()) ? new Date(bookEnd).getTime() : 0;
                                const minEndMs = targetRpMs + 3600000;
                                if (curEndMs < targetRpMs) {
                                  setBookEnd(toLocalDateTimeInput(new Date(minEndMs)));
                                  setBookDurationHours(Math.max(1, Math.round((minEndMs - baseStartMs) / 3600000)));
                                }
                              } else if (mode.id === 'FULL_DAY') {
                                const minLeadMs = roundUpTo5MinMs(Date.now() + 2 * 3600000);
                                const todayStart = new Date();
                                todayStart.setHours(8, 0, 0, 0);
                                const todayEnd = new Date();
                                todayEnd.setHours(20, 0, 0, 0);
                                let sMs = Math.max(todayStart.getTime(), minLeadMs);
                                let eMs = todayEnd.getTime();
                                if (eMs - sMs < 2 * 3600000) {
                                  const tomStart = new Date();
                                  tomStart.setDate(tomStart.getDate() + 1);
                                  tomStart.setHours(8, 0, 0, 0);
                                  const tomEnd = new Date(tomStart);
                                  tomEnd.setHours(20, 0, 0, 0);
                                  sMs = tomStart.getTime();
                                  eMs = tomEnd.getTime();
                                }
                                setBookStart(toLocalDateTimeInput(new Date(sMs)));
                                setBookEnd(toLocalDateTimeInput(new Date(eMs)));
                                setBookDurationHours(Math.max(1, Math.round((eMs - sMs) / 3600000)));
                              }
                            }}
                            style={{
                              padding: '8px 6px',
                              borderRadius: '10px',
                              border: selected ? '1.5px solid #0072de' : '1px solid var(--color-border)',
                              background: selected ? '#ebf5ff' : 'var(--color-surface)',
                              color: selected ? '#005bb5' : 'var(--color-text-primary)',
                              textAlign: 'center',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                            }}
                          >
                            <span style={{ fontSize: '11.5px', fontWeight: 800, lineHeight: 1.2 }}>{mode.label}</span>
                            <span style={{ fontSize: '9.5px', opacity: 0.78, lineHeight: 1.15 }}>{mode.sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Presets (Today Full Day, Tomorrow Full Day, etc.) */}
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                    <Chip
                      active={false}
                      onClick={() => {
                        const hrs = bookReservationType === 'FULL_DAY' ? Math.max(8, bookDurationHours) : bookDurationHours;
                        const sMs = roundUpTo5MinMs(Date.now() + 2 * 3600000);
                        const eMs = sMs + hrs * 3600000;
                        setBookStart(toLocalDateTimeInput(new Date(sMs)));
                        setBookEnd(toLocalDateTimeInput(new Date(eMs)));
                        if (bookReservationType === 'DROP_AND_PICKUP') {
                          setBookReturnPickupTime(toLocalDateTimeInput(new Date(eMs - 1800000)));
                        }
                      }}
                    >
                      {t('In 2h (Standard)')}
                    </Chip>
                    <Chip
                      active={false}
                      onClick={() => {
                        const hrs = bookReservationType === 'FULL_DAY' ? Math.max(8, bookDurationHours) : bookDurationHours;
                        const sMs = roundUpTo5MinMs(Date.now() + 4 * 3600000);
                        const eMs = sMs + hrs * 3600000;
                        setBookStart(toLocalDateTimeInput(new Date(sMs)));
                        setBookEnd(toLocalDateTimeInput(new Date(eMs)));
                        if (bookReservationType === 'DROP_AND_PICKUP') {
                          setBookReturnPickupTime(toLocalDateTimeInput(new Date(eMs - 1800000)));
                        }
                      }}
                    >
                      {t('In 4h')}
                    </Chip>
                    <Chip
                      active={false}
                      onClick={() => {
                        const start = new Date();
                        const minLeadMs = roundUpTo5MinMs(Date.now() + 2 * 3600000);
                        const todayEnd = new Date();
                        todayEnd.setHours(20, 0, 0, 0);
                        if (todayEnd.getTime() - minLeadMs < 2 * 3600000) {
                          todayEnd.setHours(23, 0, 0, 0);
                        }
                        const sMs = Math.max(start.setHours(8, 0, 0, 0), minLeadMs);
                        const eMs = Math.max(todayEnd.getTime(), sMs + 2 * 3600000);
                        setBookReservationType('FULL_DAY');
                        setBookStart(toLocalDateTimeInput(new Date(sMs)));
                        setBookEnd(toLocalDateTimeInput(new Date(eMs)));
                        setBookDurationHours(Math.max(1, Math.round((eMs - sMs) / 3600000)));
                      }}
                    >
                      {t('Today Full Day')}
                    </Chip>
                    <Chip
                      active={false}
                      onClick={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(8, 0, 0, 0);
                        const tomEnd = new Date(tomorrow);
                        tomEnd.setHours(20, 0, 0, 0);
                        setBookReservationType('FULL_DAY');
                        setBookStart(toLocalDateTimeInput(tomorrow));
                        setBookEnd(toLocalDateTimeInput(tomEnd));
                        setBookDurationHours(12);
                      }}
                    >
                      {t('Tomorrow Full Day')}
                    </Chip>
                  </div>

                  {/* 6. Form Datetime Inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    <div>
                      <label className="type-caption" htmlFor="schedule-start" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        {bookReservationType === 'DROP_AND_PICKUP' ? t('Drop-Off Departure *') : t('Departure Date & Time *')}
                      </label>
                      <input
                        id="schedule-start"
                        type="datetime-local"
                        className="gf-input"
                        required
                        value={bookStart}
                        onChange={(e) => {
                          setBookStart(e.target.value);
                          if (e.target.value) {
                            const newStartMs = new Date(e.target.value).getTime();
                            if (!Number.isNaN(newStartMs)) {
                              const newEndMs = newStartMs + bookDurationHours * 3600000;
                              setBookEnd(toLocalDateTimeInput(new Date(newEndMs)));
                              if (bookReservationType === 'DROP_AND_PICKUP') {
                                const curRpMs = bookReturnPickupTime ? new Date(bookReturnPickupTime).getTime() : NaN;
                                if (Number.isNaN(curRpMs) || curRpMs <= newStartMs) {
                                  setBookReturnPickupTime(toLocalDateTimeInput(new Date(Math.max(newStartMs + 3600000, newEndMs - 1800000))));
                                }
                              }
                            }
                          }
                        }}
                      />
                    </div>

                    {bookReservationType === 'DROP_AND_PICKUP' && (
                      <div>
                        <label className="type-caption" htmlFor="schedule-return-pickup" style={{ fontWeight: 700, display: 'block', marginBottom: '4px', color: '#005bb5' }}>
                          {t('Post-Event Pick-Up Time *')}
                        </label>
                        <input
                          id="schedule-return-pickup"
                          type="datetime-local"
                          className="gf-input"
                          required
                          value={bookReturnPickupTime}
                          onChange={(e) => {
                            setBookReturnPickupTime(e.target.value);
                            if (e.target.value) {
                              const rpMs = new Date(e.target.value).getTime();
                              const curEndMs = bookEnd ? new Date(bookEnd).getTime() : 0;
                              const sMs = bookStart ? new Date(bookStart).getTime() : 0;
                              if (!Number.isNaN(rpMs) && curEndMs < rpMs) {
                                const nextEndMs = rpMs + 3600000;
                                setBookEnd(toLocalDateTimeInput(new Date(nextEndMs)));
                                if (!Number.isNaN(sMs) && sMs > 0) {
                                  setBookDurationHours(Math.max(1, Math.round((nextEndMs - sMs) / 3600000)));
                                }
                              }
                            }
                          }}
                        />
                      </div>
                    )}

                    <div>
                      <label className="type-caption" htmlFor="schedule-end" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        {bookReservationType === 'DROP_AND_PICKUP'
                          ? t('Final Return to Pool *')
                          : bookReservationType === 'FULL_DAY'
                          ? t('Full Day End Date & Time *')
                          : t('Return Date & Time *')}
                      </label>
                      <input
                        id="schedule-end"
                        type="datetime-local"
                        className="gf-input"
                        required
                        value={bookEnd}
                        onChange={(e) => {
                          setBookEnd(e.target.value);
                          if (e.target.value && bookStart) {
                            const diffHrs = Math.max(1, Math.round((new Date(e.target.value).getTime() - new Date(bookStart).getTime()) / 3600000));
                            setBookDurationHours(diffHrs);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* 7. 2-Hour Advance Booking Policy Feedback */}
                  {(() => {
                    const startMs = new Date(bookStart).getTime();
                    const nowMs = Date.now();
                    const diffMin = Math.round((startMs - nowMs) / 60000);
                    const isPast = diffMin < 0;
                    const isUrgent = diffMin >= 0 && diffMin < 120;

                    if (isPast) {
                      return (
                        <div style={{ padding: '8px 10px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <AlertTriangle size={15} style={{ color: '#dc2626', flexShrink: 0 }} />
                          <span style={{ fontSize: '11.5px', color: '#991b1b', fontWeight: 600 }}>
                            {t('Departure time cannot be in the past. Please select an upcoming departure time.')}
                          </span>
                        </div>
                      );
                    }

                    if (isUrgent) {
                      return (
                        <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#fef2f2', border: '1.5px solid #f87171', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase' }}>
                              🚨 {t('Urgent Request (< 2h) • Mandatory Fleet PIC Approval')}
                            </span>
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#7f1d1d' }}>
                            {t('Company policy requires booking at least 2 hours in advance. This trip departs in')} <strong>{diffMin} {t('min ride')}</strong> {t('and requires urgent justification.')}
                          </div>
                          <div>
                            <label className="type-caption" htmlFor="urgent-reason-input" style={{ fontWeight: 700, display: 'block', color: '#991b1b', marginBottom: '2px' }}>
                              {t('Urgent Reason *')}
                            </label>
                            <input
                              id="urgent-reason-input"
                              type="text"
                              className="gf-input"
                              required
                              placeholder={t('Enter urgent reason (e.g. client site emergency, urgent VIP transport)...')}
                              value={bookUrgentReason}
                              onChange={(e) => setBookUrgentReason(e.target.value)}
                            />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div style={{ padding: '8px 10px', borderRadius: '8px', background: '#ebf5ff', border: '1px solid #bfdbfe', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <CheckCircle2 size={15} style={{ color: '#0072de', flexShrink: 0 }} />
                        <span style={{ fontSize: '11.5px', color: '#005bb5', fontWeight: 600 }}>
                          ✓ {t('Standard Trip')} ({Math.floor(diffMin / 60)}h {diffMin % 60}m)
                        </span>
                      </div>
                    );
                  })()}
                  </div>
                </div>

                {/* 8. Pinned Gojek Footer Button Pair */}
                <div
                  style={{
                    padding: '12px 20px calc(14px + var(--safe-bottom))',
                    borderTop: '1px solid var(--color-divider)',
                    background: 'var(--color-bg-surface)',
                    flexShrink: 0,
                  }}
                >
                  <div className="gf-gojek-footer-pair">
                    <button
                      type="button"
                      className="gf-gojek-btn-cancel pressable"
                      onClick={() => setShowSchedulePicker(false)}
                    >
                      {t('Cancel')}
                    </button>
                    <button
                      type="button"
                      className="gf-gojek-btn-commit pressable"
                      onClick={() => {
                        setScheduleMode('SCHEDULE');
                        setShowSchedulePicker(false);
                        setStatusBanner({
                          type: 'success',
                          text: `${t('Schedule set successfully:')} ${getScheduleSlotBrief(bookStart, lang)}`,
                        });
                      }}
                    >
                      {t('Set schedule')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* GoCar Reference Screens 5 & 6: Vehicle Option Cards (Selected card has #EBF5FF tint & #0072DE border) */}
          {loadingData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Skeleton height={84} />
              <Skeleton height={84} />
              <Skeleton height={84} />
            </div>
          ) : filteredVehicles.length === 0 ? (
            <EmptyState
              message="No vehicles registered in this category yet."
              action={
                isPrivileged ? (
                  <button type="button" className="gf-btn gf-btn-primary" onClick={() => { setNavSection('ADMIN'); setAdminModule('FLEET_OPS'); setOpsSubTab('VEHICLES'); }}>
                    Add Vehicle in Admin Console
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="gf-proto-svc">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
                <div style={{ width: '42px', height: '28px', borderRadius: '8px', background: '#0072de', color: '#ffffff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Car size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{t('Operational Car')}</span>
                  </div>
                  <div className="type-caption" style={{ fontSize: '11.5px' }}>
                    {selectedVehicle?.seats ? `${selectedVehicle.seats} ${t('Seats')}` : `4-7 ${t('Seats')}`} • {t('Free Corporate Facility')}
                  </div>
                </div>
              </div>
              {filteredVehicles.map((v, vIdx) => {
                const isAvail = v.isAvailable !== false && v.status === 'Available';
                const isSelected = Number(selectedVehicle?.id) === v.id;
                const isEv = v.energy_type === 'Electric';
                const pct = isEv ? Number(v.battery_percent ?? 100) : 85;
                const waitRange = isAvail ? `${3 + (vIdx % 3)}-${6 + (vIdx % 3)} min` : t('Busy');
                const availText = isAvail
                  ? `${t('Available')} • ${v.registration_plate} • Chauffeur included`
                  : v.status !== 'Available'
                  ? `${v.status}${v.standby_reason ? ` • ${v.standby_reason}` : ''}`
                  : v.conflictReason || 'Booked for this slot';

                return (
                  <OptionRow
                    key={v.id}
                    id={`vehicle-opt-${v.id}`}
                    selected={isSelected}
                    disabled={!isAvail}
                    onClick={() => setBookVehicleId(v.id)}
                    leading={<VehicleArt carType={v.car_type} energyType={v.energy_type} size={64} />}
                    title={`${v.make} ${v.model}`}
                    badge={
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            padding: '1px 7px',
                            borderRadius: '9999px',
                            background: isSelected ? '#0072de' : 'var(--color-bg-subtle)',
                            color: isSelected ? '#ffffff' : 'var(--color-text-secondary)',
                            fontSize: '10.5px',
                            fontWeight: 700,
                          }}
                        >
                          {waitRange}
                        </span>
                        <span className="type-caption">• 👤 {v.seats}</span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            fontStyle: 'italic',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: isEv ? '#0072de' : '#0a0a0a',
                            color: '#ffffff',
                          }}
                        >
                          {isEv ? 'ECO EV' : 'FAST DISPATCH'}
                        </span>
                      </span>
                    }
                    subtitle={availText}
                    rightMetric={
                      <div style={{ textAlign: 'right', minWidth: '64px' }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 800, color: !isAvail ? '#9ca3af' : isSelected ? '#0072de' : 'var(--color-text-primary)' }}>
                          {isAvail ? t('Ready') : t('Busy')}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                          {v.car_type || (isEv ? 'EV Fleet' : 'Fleet')}
                        </div>
                        <div className="type-caption" style={{ fontWeight: 700, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px', marginTop: '2px', fontSize: '10.5px' }}>
                          {isEv ? <BatteryCharging size={11} /> : <Fuel size={11} />}
                          {isEv ? `${pct}%` : 'Full'}
                        </div>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}

          {/* Driver provided / Self-drive policy row */}
          <div style={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--color-divider)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div>
                <div className="type-body" style={{ fontWeight: 700 }}>Driver provided</div>
                <div className="type-caption">Company driver assigned & schedule locked</div>
              </div>
              <StatusBadge label="Included" tone="blue" />
            </div>

            <div>
              <label className="type-caption" htmlFor="driver-pick-select" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Preferred Driver ({selectedVehicle ? selectedVehicle.energy_type : ''} Category)
              </label>
              <select
                id="driver-pick-select"
                className="gf-select"
                value={bookDriverId}
                onChange={(e) => setBookDriverId(e.target.value)}
              >
                <option value="">Auto-assign on Admin approval</option>
                {activeDrivers
                  .filter((d) => {
                    if (!selectedVehicle) return true;
                    const assignedCar = vehicles.find((v) => v.default_driver_id === d.id);
                    if (assignedCar) {
                      return assignedCar.energy_type === selectedVehicle.energy_type;
                    }
                    return true;
                  })
                  .map((d) => {
                    const assignedCar = vehicles.find((v) => v.default_driver_id === d.id);
                    return (
                      <option key={d.id} value={d.id}>
                        {d.full_name} ({selectedVehicle?.energy_type || 'Fleet'} Driver{assignedCar ? ` • ${assignedCar.registration_plate}` : ''})
                      </option>
                    );
                  })}
              </select>
              <div className="type-caption" style={{ marginTop: '4px', color: '#64748b' }}>
                Drivers are filtered by the {selectedVehicle?.energy_type || 'selected'} vehicle category. Final assignment is confirmed upon Admin/Fleet Manager approval.
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.45 }}>
              <div>
                <div className="type-body" style={{ fontWeight: 600 }}>Self-drive</div>
                <div className="type-caption">Disabled by company policy</div>
              </div>
              <Lock size={16} />
            </div>
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // BOOKING FLOW STEP 3: ORDER SUMMARY ("Almost there")
    // -------------------------------------------------------------------------
    if (bookingStep === 'SUMMARY') {
      const chosenDriverObj = drivers.find((d) => String(d.id) === String(bookDriverId));

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feedbackBanner}
          <h1 className="type-title">{t('Almost there')}</h1>

          {/* Compact prototype route card with Edit pill */}
          <div className="gf-proto-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0', gap: '4px' }}>
                <span className="gf-proto-pn" />
                <span style={{ width: 0, height: '14px', borderLeft: '2px dotted var(--color-border)' }} />
                <span className="gf-proto-od" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="type-body" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookOrigin}</div>
                <div className="type-body" style={{ fontWeight: 700, marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookDest}</div>
                <div className="type-caption" style={{ marginTop: '4px' }}>
                  {currentMetrics.distanceKm} km • ~{currentMetrics.durationMin} {t('min ride')} • ETA {currentMetrics.etaText}
                </div>
              </div>
            </div>
            <button type="button" className="gf-proto-btn gf-proto-btn-o gf-proto-btn-s pressable" onClick={() => setBookingStep('ROUTE')}>
              {t('Edit')}
            </button>
          </div>

          {/* Urgent Warning Banner if departing < 2h */}
          {Math.round((new Date(bookStart).getTime() - Date.now()) / 60000) < 120 && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1.5px solid #f87171',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <AlertTriangle size={15} style={{ color: '#dc2626', flexShrink: 0 }} />
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase' }}>
                  🚨 {t('Urgent Short-Notice Request (< 2h Advance)') || 'Urgent Short-Notice Request (< 2h Advance)'}
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#7f1d1d' }}>
                Requires mandatory Fleet Operation PIC approval. Reason: <strong>{bookUrgentReason || bookPurpose || 'Urgent Short-Notice Departure'}</strong>
              </div>
            </div>
          )}

          {/* Mandatory Data Missing Banner */}
          {(!bookPurpose.trim() || bookPassengers.length === 0 || bookPassengers.some((p) => !p.nickname.trim())) && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#fef2f2',
                border: '1.5px solid #fecaca',
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
              }}
            >
              <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
              <div style={{ fontSize: '12px', color: '#991b1b', lineHeight: 1.4 }}>
                <strong>{t('Mandatory Data Incomplete') || 'Data Wajib Belum Lengkap'}:</strong> {t('Please complete') || 'Harap lengkapi'}{' '}
                {!bookPurpose.trim() && <strong>{t('Trip Purpose')}</strong>}
                {!bookPurpose.trim() && (bookPassengers.length === 0 || bookPassengers.some((p) => !p.nickname.trim())) && ` ${t('and') || 'dan'} `}
                {(bookPassengers.length === 0 || bookPassengers.some((p) => !p.nickname.trim())) && <strong>{t('Passengers')}</strong>}{' '}
                {t('before requesting booking.') || 'sebelum melanjutkan pemesanan armada.'}
              </div>
            </div>
          )}

          {/* Plain ListRow Pickers */}
          <div>
            <ListRow
              id="summary-schedule-row"
              icon={<Calendar size={18} />}
              title={t('Schedule & Reservation')}
              subtitle={`${new Date(bookStart).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} → ${new Date(bookEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${bookDurationHours}h) • ${formatReservationModeLabel(bookReservationType, bookReservationType === 'DROP_AND_PICKUP' ? bookReturnPickupTime : null) || 'Standard Trip'}${Math.round((new Date(bookStart).getTime() - Date.now()) / 60000) < 120 ? ' • 🚨 Urgent (< 2h)' : ' • Standard'}`}
              showChevron
              onClick={() => setBookingStep('VEHICLE')}
            />
            <ListRow
              id="summary-purpose-row"
              icon={<Briefcase size={18} style={{ color: bookPurpose.trim() ? '#0072de' : '#dc2626' }} />}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{t('Trip Purpose')}</span>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: bookPurpose.trim() ? '#ebf5ff' : '#fef2f2',
                      color: bookPurpose.trim() ? '#0072de' : '#dc2626',
                    }}
                  >
                    {bookPurpose.trim() ? t('✓ Filled') : t('* Mandatory')}
                  </span>
                </div>
              }
              subtitle={
                bookPurpose.trim() ? (
                  bookPurpose.trim()
                ) : (
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>
                    {t('⚠️ Mandatory • Tap to select or enter purpose')}
                  </span>
                )
              }
              showChevron
              onClick={() => {
                setPickerValidationError(null);
                setSummaryPicker('PURPOSE');
              }}
            />
            <ListRow
              id="summary-pax-row"
              icon={<Users size={18} style={{ color: bookPassengers.length > 0 && bookPassengers.every((p) => Boolean(p.nickname.trim())) ? '#0072de' : '#dc2626' }} />}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{t('Passengers')}</span>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: bookPassengers.length > 0 && bookPassengers.every((p) => Boolean(p.nickname.trim())) ? '#ebf5ff' : '#fef2f2',
                      color: bookPassengers.length > 0 && bookPassengers.every((p) => Boolean(p.nickname.trim())) ? '#0072de' : '#dc2626',
                    }}
                  >
                    {bookPassengers.length > 0 && bookPassengers.every((p) => Boolean(p.nickname.trim()))
                      ? `✓ ${bookPassengers.length} ${t('Passengers')}`
                      : t('* Mandatory')}
                  </span>
                </div>
              }
              subtitle={
                bookPassengers.length > 0 && bookPassengers.every((p) => Boolean(p.nickname.trim())) ? (
                  bookPassengers.map((p) => `${p.id}. ${p.nickname.trim()}`).join(', ')
                ) : (
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>
                    {t('⚠️ Mandatory • Tap to enter passenger nickname')}
                  </span>
                )
              }
              showChevron
              onClick={() => {
                setPickerValidationError(null);
                setSummaryPicker('PAX');
              }}
            />
            <ListRow
              id="summary-notes-row"
              icon={<StickyNote size={18} />}
              title={t('Notes')}
              subtitle={bookNotes || t('Add pickup instructions for driver')}
              showChevron
              onClick={() => setSummaryPicker('NOTES')}
            />
            <ListRow
              id="summary-charge-row"
              icon={<Briefcase size={18} />}
              title={t('Department & Driver')}
              subtitle={`${user.department_name || 'Group'} • Driver: ${chosenDriverObj ? chosenDriverObj.full_name : t('Auto-assign') || 'Auto-assign'}`}
              showChevron
              onClick={() => setSummaryPicker('CHARGE')}
            />
          </div>

          {/* Small Picker Sub-Modal */}
          {summaryPicker && (
            <div className="gf-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Edit ${summaryPicker.toLowerCase()}`}>
              <div className="gf-modal-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px 12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <h3 className="type-section" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      {summaryPicker === 'PURPOSE' && t('Trip Purpose')}
                      {summaryPicker === 'PAX' && t('Passenger Details')}
                      {summaryPicker === 'NOTES' && t('Dispatch Notes')}
                      {summaryPicker === 'CHARGE' && t('Group & Driver')}
                    </span>
                    {(summaryPicker === 'PURPOSE' || summaryPicker === 'PAX') && (
                      <span style={{ fontSize: '11px', fontWeight: 800, lineHeight: 1.3, color: '#dc2626', background: '#fef2f2', padding: '3px 8px', borderRadius: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {t('* Mandatory')}
                      </span>
                    )}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
                    <button
                      type="button"
                      className="gf-btn gf-btn-ghost"
                      style={{ minHeight: '36px', height: '36px', padding: '0 10px', fontSize: '12px' }}
                      onClick={() => {
                        setPickerValidationError(null);
                        setSummaryPicker(null);
                      }}
                    >
                      {t('Cancel')}
                    </button>
                    <button
                      type="button"
                      className="gf-btn gf-btn-primary"
                      style={{ minHeight: '36px', height: '36px', padding: '0 16px', fontSize: '12.5px', fontWeight: 700 }}
                      onClick={handleDoneSummaryPicker}
                    >
                      {t('Done')}
                    </button>
                  </div>
                </div>

                {pickerValidationError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      marginBottom: '10px',
                    }}
                  >
                    <AlertTriangle size={15} style={{ color: '#dc2626', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>
                      {pickerValidationError}
                    </span>
                  </div>
                )}

                {summaryPicker === 'PURPOSE' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="type-caption" style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      {t('Select operational purpose or enter custom purpose:')}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {['Client visit', 'Site audit', 'Airport transfer', 'Executive briefing'].map((preset) => (
                        <Chip
                          key={preset}
                          active={bookPurpose === preset}
                          onClick={() => {
                            setBookPurpose(preset);
                            setPickerValidationError(null);
                          }}
                        >
                          {t(preset)}
                        </Chip>
                      ))}
                    </div>
                    <div>
                      <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        {t('Trip Purpose *')}
                      </label>
                      <input
                        type="text"
                        className="gf-input"
                        placeholder={t('Example: Cikarang Plant Visit...')}
                        value={bookPurpose}
                        required
                        onChange={(e) => {
                          setBookPurpose(e.target.value);
                          if (e.target.value.trim()) setPickerValidationError(null);
                        }}
                        autoFocus
                      />
                    </div>
                  </div>
                )}

                {summaryPicker === 'PAX' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-control)',
                        background: 'var(--color-status-amber-bg)',
                        color: 'var(--color-status-amber-fg)',
                        fontSize: '12.5px',
                        lineHeight: 1.4,
                      }}
                    >
                      ⚠️ <strong>{t('Privacy Policy:') || 'Privacy Policy:'}</strong> {t('Privacy Policy: Mandatory to enter passenger nicknames boarding the operational vehicle. Enter nicknames only (e.g., Budi, Sarah). Do not enter full names.') || 'Wajib mengisi nama panggilan penumpang yang menaiki kendaraan operasional. Masukkan hanya nama panggilan (nickname) (contoh: Budi, Sarah). Dilarang memasukkan nama lengkap.'}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {bookPassengers.map((passenger, index) => {
                        const isMissing = !passenger.nickname.trim();
                        return (
                          <div
                            key={passenger.id}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-control)',
                              border: isMissing ? '1.5px solid #f87171' : '1px solid var(--color-border)',
                              background: 'var(--color-surface)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label className="type-caption" style={{ fontWeight: 700, color: isMissing ? '#dc2626' : 'var(--color-primary)' }}>
                                {index === 0 ? `1. ${t('Passengers')} 1 (Lead Passenger) *` : `${index + 1}. ${t('Passengers')} ${index + 1} *`}
                              </label>
                              {bookPassengers.length > 1 && (
                                <button
                                  type="button"
                                  className="gf-btn gf-btn-outline-danger"
                                  style={{ minHeight: '26px', padding: '0 8px', fontSize: '11px' }}
                                  onClick={() => {
                                    const filtered = bookPassengers.filter((p) => p.id !== passenger.id);
                                    const renumbered = filtered.map((p, idx) => ({ ...p, id: idx + 1 }));
                                    setBookPassengers(renumbered);
                                    setBookPax(renumbered.length);
                                    if (renumbered[0]) setBookPassengerNickname(renumbered[0].nickname);
                                  }}
                                >
                                  ✕ {t('Remove')}
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              className="gf-input"
                              required
                              placeholder={index === 0 ? 'contoh: Budi (Nickname)' : `contoh: Sarah (Nickname)`}
                              value={passenger.nickname}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBookPassengers((prev) =>
                                  prev.map((p) => (p.id === passenger.id ? { ...p, nickname: val } : p))
                                );
                                if (index === 0) setBookPassengerNickname(val);
                                if (val.trim()) setPickerValidationError(null);
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                      <span className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                        Capacity: {bookPassengers.length} of {selectedVehicle?.seats || 7} passengers
                      </span>
                      {bookPassengers.length < (selectedVehicle?.seats || 7) && (
                        <button
                          type="button"
                          className="gf-btn gf-btn-secondary"
                          style={{ minHeight: '34px', padding: '0 12px', fontSize: '12.5px', gap: '6px' }}
                          onClick={() => {
                            const nextList = [...bookPassengers, { id: bookPassengers.length + 1, nickname: '' }];
                            setBookPassengers(nextList);
                            setBookPax(nextList.length);
                          }}
                        >
                          <Plus size={15} /> {t('Add')} {t('Passengers')} {bookPassengers.length + 1}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {summaryPicker === 'NOTES' && (
                  <textarea
                    className="gf-textarea"
                    rows={3}
                    placeholder="Pickup gate, luggage, or contact note"
                    value={bookNotes}
                    onChange={(e) => setBookNotes(e.target.value)}
                    autoFocus
                  />
                )}

                {summaryPicker === 'CHARGE' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} className="type-body">
                    <div><strong>Group:</strong> {user.department_name || `Group #${user.department_id}`}</div>
                    <div><strong>Driver:</strong> {chosenDriverObj ? chosenDriverObj.full_name : 'Assigned on approval'}</div>
                    <p className="type-caption">Requests are routed automatically to Fleet Admin for approval.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // BOOKING FLOW STEP 4: WAITING FOR APPROVAL
    // -------------------------------------------------------------------------
    if (bookingStep === 'WAITING') {
      const isApproved = focusedTrip?.status === 'APPROVED' || focusedTrip?.status === 'IN_PROGRESS';
      const isRejected = focusedTrip?.status === 'REJECTED';
      const isDual = focusedTrip?.requires_dual_approval;
      const isUrgent = focusedTrip?.is_urgent === 1;
      const picApproved = focusedTrip?.pic_approved;
      const hwsApproved = focusedTrip?.hws_approved;

      let badgeLabel = 'Request sent';
      let badgeTone: 'green' | 'amber' | 'red' | 'blue' = 'green';
      let title = 'Waiting for approval';

      if (isApproved) {
        badgeLabel = 'APPROVED & DISPATCHED';
        badgeTone = 'green';
        title = 'Booking Approved!';
      } else if (isRejected) {
        badgeLabel = 'REJECTED';
        badgeTone = 'red';
        title = 'Booking Request Rejected';
      } else if (isUrgent && !picApproved) {
        badgeLabel = '🚨 URGENT (< 2h)';
        badgeTone = 'red';
        title = 'Awaiting Fleet Operation PIC Urgent Approval';
      } else if (isDual && picApproved) {
        badgeLabel = 'Stage 1 Approved';
        badgeTone = 'amber';
        title = 'Awaiting Head Of WS Part Review';
      } else if (isDual && hwsApproved) {
        badgeLabel = 'Stage 1 Approved';
        badgeTone = 'amber';
        title = 'Awaiting Fleet PIC Dispatch';
      }

      const timelineSteps = isApproved
        ? [
            { label: 'Request sent & schedule locked', sub: 'Car and driver slot reserved immediately', done: true },
            {
              label: 'Approvals completed',
              sub: focusedTrip?.adm_delegated
                ? 'Authorized & delegated directly by System Admin'
                : isDual
                ? 'Approved by both Fleet Operation PIC and Head Of WS Part'
                : isUrgent
                ? 'Approved by Fleet Operation PIC (Urgent Short-Notice Authorization)'
                : 'Approved by Fleet Administration',
              done: true,
            },
            {
              label: 'Driver dispatched',
              sub: focusedTrip?.assigned_driver_name
                ? `Driver ${focusedTrip.assigned_driver_name} is assigned (${focusedTrip.registration_plate || 'Company Car'})`
                : 'Driver dispatched and arriving',
              done: true,
            },
          ]
        : isDual
        ? [
            { label: 'Request sent & schedule locked', sub: 'Car and driver slot reserved immediately', done: true },
            {
              label: isUrgent ? 'Fleet Operation PIC urgent approval' : 'Fleet Operation PIC approval',
              sub: picApproved
                ? 'Approved by Fleet Operation PIC'
                : isUrgent
                ? 'Mandatory Fleet Operation PIC authorization required (< 2h departure)'
                : 'Awaiting Fleet Operation PIC review',
              done: Boolean(picApproved),
              active: !picApproved && !hwsApproved,
            },
            {
              label: 'Head Of WS Part authorization',
              sub: hwsApproved ? 'Approved by Head Of WS Part' : picApproved ? 'Awaiting Head Of WS Part authorization' : 'Pending',
              done: Boolean(hwsApproved),
              active: Boolean(picApproved) && !hwsApproved,
            },
            {
              label: 'Driver dispatched',
              sub: 'Driver is assigned immediately upon final approval',
              done: false,
            },
          ]
        : [
            { label: 'Request sent & schedule locked', sub: 'Car and driver slot reserved immediately', done: true },
            {
              label: isUrgent ? 'Fleet Operation PIC urgent approval' : 'Admin review in progress',
              sub: isUrgent
                ? 'Mandatory Fleet Operation PIC authorization required (< 2h departure)'
                : 'Fleet Admin verifies & dispatches your driver',
              active: true,
            },
            { label: 'Driver dispatched', sub: 'You will get a push notification once assigned', done: false },
          ];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feedbackBanner}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 className="type-title">{title}</h1>
            <StatusBadge label={badgeLabel} tone={badgeTone} />
          </div>

          {focusedTrip && (
            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-card)', background: 'var(--color-bg-subtle)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div className="type-body" style={{ fontWeight: 700 }}>{focusedTrip.origin} → {focusedTrip.destination}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {formatReservationModeLabel(focusedTrip.reservation_type, focusedTrip.return_pickup_time) && (
                    <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#ebf5ff', color: '#005bb5', border: '1px solid #bfdbfe' }}>
                      {formatReservationModeLabel(focusedTrip.reservation_type, focusedTrip.return_pickup_time)}
                    </span>
                  )}
                  {focusedTrip.is_urgent === 1 && (
                    <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                      🚨 URGENT (&lt; 2h)
                    </span>
                  )}
                </div>
              </div>
              <div className="type-caption">{focusedTrip.make} {focusedTrip.model} • {focusedTrip.registration_plate}</div>
              {focusedTrip.start_time && focusedTrip.end_time && (
                <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                  🕒 Schedule: {new Date(focusedTrip.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} → {new Date(focusedTrip.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              {focusedTrip.reservation_type === 'DROP_AND_PICKUP' && focusedTrip.return_pickup_time && (
                <div className="type-caption" style={{ color: '#005bb5', fontWeight: 700 }}>
                  🔁 Post-Event Pick-Up: {new Date(focusedTrip.return_pickup_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              {focusedTrip.urgent_reason && (
                <div className="type-caption" style={{ color: '#991b1b', fontWeight: 600 }}>
                  🚨 Urgent Justification: {focusedTrip.urgent_reason}
                </div>
              )}
              {focusedTrip.assigned_driver_name && (
                <div className="type-caption" style={{ color: 'var(--color-green-text)', fontWeight: 600, marginTop: '3px' }}>
                  👤 Assigned Driver: {focusedTrip.assigned_driver_name} {focusedTrip.assigned_driver_phone ? `(${focusedTrip.assigned_driver_phone})` : ''}
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
            {timelineSteps.map((st, idx) => (
              <div key={st.label} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '9999px',
                    background: st.done ? 'var(--color-green)' : st.active ? 'var(--color-green-tint)' : 'var(--color-bg-subtle)',
                    border: st.active ? '2px solid var(--color-green)' : 'none',
                    color: st.done ? '#ffffff' : 'var(--color-green-text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {st.done ? <CheckCircle2 size={14} /> : idx + 1}
                </div>
                <div>
                  <div className="type-body" style={{ fontWeight: 700 }}>{st.label}</div>
                  <div className="type-caption">{st.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {isApproved ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                className="gf-btn gf-btn-primary gf-btn-full"
                onClick={() => {
                  setBookingStep('IN_TRIP');
                  setSheetSnap('half');
                }}
              >
                <Car size={16} /> Open Active Trip & Driver Info
              </button>
            </div>
          ) : isRejected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '13px' }}>Rejection Reason:</div>
                <div style={{ color: '#7f1d1d', fontSize: '13px', marginTop: '2px' }}>
                  {focusedTrip?.decisions?.find((d: any) => d.decision === 'REJECTED')?.reason || 'Booking request was rejected by fleet administration.'}
                </div>
              </div>
              <button
                type="button"
                className="gf-btn gf-btn-secondary gf-btn-full"
                onClick={() => {
                  setFocusedTripId(null);
                  setBookingStep('HOME');
                  setSheetSnap('half');
                }}
              >
                Dismiss & Return to Home
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="gf-btn gf-btn-secondary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={async () => {
                  try {
                    const [trpRes, bkgRes] = await Promise.all([apiRequest('/api/trips'), apiRequest('/api/bookings')]);
                    if (trpRes.trips) setTrips(trpRes.trips);
                    if (bkgRes.bookings) setBookings(bkgRes.bookings);
                    setStatusBanner({ type: 'info', text: 'Trip status synced.' });
                  } catch {}
                }}
              >
                <RefreshCw size={14} /> Sync Status
              </button>
              <button
                type="button"
                className="gf-btn gf-btn-outline-danger"
                style={{ flex: 1 }}
                onClick={() => handleCancelBookingRequest(focusedTrip)}
              >
                Cancel Request
              </button>
            </div>
          )}
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // BOOKING FLOW STEP 5: ASSIGNED AND IN TRIP
    // -------------------------------------------------------------------------
    const tripToShow = focusedTrip;
    const isStarted = tripToShow?.status === 'IN_PROGRESS';
    const driverInitials = (tripToShow?.assigned_driver_name || 'DR').slice(0, 2).toUpperCase();

    const tripModeLabel = formatReservationModeLabel(tripToShow?.reservation_type, tripToShow?.return_pickup_time);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {feedbackBanner}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <StatusBadge label={isStarted ? 'In Trip' : 'Driver Assigned'} tone={isStarted ? 'blue' : 'green'} />
            {tripModeLabel && <StatusBadge label={tripModeLabel} tone="blue" />}
          </div>
          <h1 className="type-title" style={{ marginTop: '6px' }}>
            {isStarted ? `Arriving in ~${Math.max(8, currentMetrics.durationMin || 18)} min (ETA ${currentMetrics.etaText})` : 'Driver arriving in ~10 min'}
          </h1>
          {tripToShow && (
            <div className="type-caption">{tripToShow.origin} → {tripToShow.destination}</div>
          )}
          {tripToShow?.start_time && tripToShow?.end_time && (
            <div className="type-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              🕒 {new Date(tripToShow.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – {new Date(tripToShow.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {tripToShow.reservation_type === 'DROP_AND_PICKUP' && tripToShow.return_pickup_time && (
                <span style={{ color: '#005bb5', fontWeight: 700 }}>
                  {' '}• Return Pick-Up: {new Date(tripToShow.return_pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Driver Row: Round Photo, Name, Rating, Bold Plate Box */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-divider)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '9999px',
                background: 'var(--color-bg-subtle)',
                color: 'var(--color-text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {driverInitials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="type-body" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tripToShow?.assigned_driver_name || 'Assigned Company Driver'}
              </div>
              <div className="type-caption" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Star size={12} style={{ color: 'var(--color-green)', fill: 'var(--color-green)' }} />
                <span>4.9 • {tripToShow?.make} {tripToShow?.model}</span>
              </div>
            </div>
          </div>

          <div
            className="mono"
            style={{
              padding: '6px 10px',
              borderRadius: '10px',
              border: '1.5px solid var(--color-text-primary)',
              fontWeight: 800,
              fontSize: 'var(--text-caption-size)',
              whiteSpace: 'nowrap',
            }}
          >
            {tripToShow?.registration_plate || '—'}
          </div>
        </div>

        {/* Three 48px Round Action Buttons: Call, Chat, Share (Revision #1 & #4) */}
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          <button
            id="trip-call-driver-btn"
            type="button"
            onClick={() => {
              const phone = tripToShow?.assigned_driver_phone || tripToShow?.default_driver_phone || '081234567890';
              if (phone) {
                window.location.href = `tel:${phone}`;
              } else {
                setStatusBanner({ type: 'info', text: `Calling driver desk: ${tripToShow?.assigned_driver_name || 'Driver'}` });
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            title="Call driver via phone app"
          >
            <span className="gf-icon-btn-48 pressable"><Phone size={20} /></span>
            <span className="type-caption" style={{ fontWeight: 600 }}>Call</span>
          </button>

          <button
            id="trip-chat-driver-btn"
            type="button"
            onClick={() => {
              const phone = tripToShow?.assigned_driver_phone || tripToShow?.default_driver_phone || '081234567890';
              if (phone) {
                const url = getWhatsAppUrl(
                  phone,
                  `Halo ${tripToShow?.assigned_driver_name || 'Driver'}, koordinasi perjalanan GalaxyFleet: ${tripToShow?.origin} -> ${tripToShow?.destination} (${tripToShow?.registration_plate || ''})`
                );
                window.open(url, '_blank');
              } else {
                setStatusBanner({ type: 'danger', text: 'Driver contact number not registered.' });
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            title="Chat with driver via WhatsApp"
          >
            <span className="gf-icon-btn-48 pressable" style={{ color: 'var(--color-green)' }}><MessageSquare size={20} /></span>
            <span className="type-caption" style={{ fontWeight: 600 }}>WhatsApp</span>
          </button>

          <button
            id="trip-share-passenger-btn"
            type="button"
            onClick={() => {
              const driverPhone = tripToShow?.assigned_driver_phone || tripToShow?.default_driver_phone || '';
              const paxFormatted = formatPassengersMultiLine(tripToShow?.passengers_json, tripToShow?.passenger_nickname);
              const shareModeLine = tripModeLabel ? `\n📋 *Mode*: ${tripModeLabel}` : '';
              const shareMsg = `*GalaxyFleet Booking Details*\n🚗 *Vehicle*: ${tripToShow?.make} ${tripToShow?.model} (${tripToShow?.registration_plate || '—'})\n👥 *Passenger(s) [Nickname only]*:\n${paxFormatted}\n👤 *Driver*: ${tripToShow?.assigned_driver_name || 'Assigned Driver'}${driverPhone ? ` (${driverPhone})` : ''}\n📍 *Pickup*: ${tripToShow?.origin}\n🎯 *Destination*: ${tripToShow?.destination}\n🕒 *Schedule*: ${new Date(tripToShow?.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(tripToShow?.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${shareModeLine}\n📌 *Status*: ${tripToShow?.status || 'APPROVED'}\n\n_Reminder: For privacy protection, only nicknames are used._`;
              if (navigator.clipboard) {
                navigator.clipboard.writeText(shareMsg).catch(() => {});
              }
              window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg)}`, '_blank');
              setStatusBanner({ type: 'success', text: 'Booking details copied & opened WhatsApp to share with passenger!' });
            }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            title="Share booking details to passenger via WhatsApp"
          >
            <span className="gf-icon-btn-48 pressable"><Share2 size={20} /></span>
            <span className="type-caption" style={{ fontWeight: 600 }}>Share</span>
          </button>
        </div>

        {/* Periodic GPS disclaimer caption — never implies live tracking */}
        <div className="type-caption" style={{ textAlign: 'center', paddingTop: '8px', borderTop: '1px solid var(--color-divider)' }}>
          {getLastGpsAgeText()}
        </div>
      </div>
    );
  };

  return (
    <>
      <AppShell
        activeNav={navSection}
        onSelectNav={(n) => {
          const target = isDriverOnly && n === 'HOME' ? 'DRIVER' : n;
          setNavSection(target);
          if (target === 'HOME' || target === 'DRIVER') {
            setBookingStep('HOME');
            setSheetSnap('half');
          } else {
            setSheetSnap('full');
          }
        }}
        onSignOut={handleLogout}
        onOpenProfile={handleOpenProfileModal}
        hideChromeDuringBooking={inActiveBookingFlow && !isDriverOnly}
        isDriverOrPrivileged={user.role === 'DRV' || Boolean(isPrivileged)}
        isPrivileged={Boolean(isPrivileged)}
        isDriverOnly={isDriverOnly}
        unreadInboxCount={unreadCount}
        pendingDispatchCount={dispatches.filter((d) => d.trip_status !== 'COMPLETED' && d.trip_status !== 'REJECTED').length}
        pendingAdminCount={pendingTrips.length + pendingUsers.length}
        userNickname={user?.nickname}
        departmentName={user?.department_name}
        onSwitchToDriverDispatch={() => {
          setNavSection('DRIVER');
          setSheetSnap('half');
        }}
        onSwitchToAdmin={() => setNavSection('ADMIN')}
        mapStage={
          <div className="gf-map-stage-host">
            {/* Gojek Driver Top Controls (Avatar, Status Pill, Circular Power Button) */}
            {(isDriverOnly || user?.role === 'DRV') && navSection === 'DRIVER' && (
              <div className="gf-driver-topbar">
                {/* Top-left: Circular Driver Avatar (~44dp) with status ring */}
                <button
                  type="button"
                  className={`gf-driver-avatar-btn pressable ${gpsNoticeAccepted && gpsReportingActive ? 'is-online' : ''}`}
                  onClick={handleOpenProfileModal}
                  title={t('Corporate Driver Profile')}
                  style={{ width: '44px', height: '44px', flexShrink: 0 }}
                >
                  <img
                    src={user?.photo_url || getDriverAvatarDataUri(user?.nickname || 'Driver')}
                    alt={user?.nickname}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </button>

                {/* Top-center: Floating Status Pill */}
                <button
                  type="button"
                  id="driver-status-pill-btn"
                  className={`gf-driver-status-pill pressable ${gpsNoticeAccepted && gpsReportingActive ? 'is-online' : ''}`}
                  onClick={() => setSheetSnap(sheetSnap === 'peek' ? 'half' : 'full')}
                >
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: gpsNoticeAccepted && gpsReportingActive ? '#E25C09' : '#94a3b8',
                      boxShadow: gpsNoticeAccepted && gpsReportingActive ? '0 0 0 2px rgba(255,255,255,0.85)' : 'none',
                    }}
                  />
                  <span>
                    {gpsNoticeAccepted && gpsReportingActive
                      ? `${t('Online')} • ${trips.filter((tr) => (tr.assigned_driver_user_id === user.id || tr.assigned_driver_name === user.nickname) && (tr.status === 'COMPLETED' || tr.trip_status === 'COMPLETED')).length} ${t('Trips Completed')}`
                      : `${t('Offline')} ▾`}
                  </span>
                </button>

                {/* Top-right: 48dp Circular Power Button */}
                <button
                  type="button"
                  id="driver-power-toggle-btn"
                  className={`gf-driver-power-btn pressable ${gpsNoticeAccepted && gpsReportingActive ? 'is-online' : ''}`}
                  onClick={async () => {
                    if (gpsNoticeAccepted && gpsReportingActive) {
                      setGpsReportingActive(false);
                      setGpsNoticeAccepted(false);
                      setDriverActivatingToast(t('Status updated to Offline'));
                      setTimeout(() => setDriverActivatingToast(null), 3000);
                    } else {
                      setDriverActivatingToast(t('Switching to online...'));
                      setGpsNoticeAccepted(true);
                      setGpsReportingActive(true);
                      detectAndReportUserLocation(true);
                      await sendDriverLocationReport('GRANTED');
                      setDriverActivatingToast(`${t('You are now online')} • ${t('Ready for Duty')}`);
                      setTimeout(() => setDriverActivatingToast(null), 3500);
                    }
                  }}
                  title={gpsNoticeAccepted && gpsReportingActive ? t('Go Offline') : t('Online')}
                >
                  <Power size={22} />
                </button>
              </div>
            )}

            {driverActivatingToast && (
              <div
                style={{
                  position: 'absolute',
                  top: '72px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#0a0a0a',
                  color: '#ffffff',
                  padding: '8px 18px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: 700,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                  zIndex: 30,
                  pointerEvents: 'none',
                  border: '1px solid rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} style={{ color: '#0072de' }} />
                <span>{driverActivatingToast}</span>
              </div>
            )}

            <MapView
              hasDriverTopbar={(isDriverOnly || user?.role === 'DRV') && navSection === 'DRIVER'}
              origin={mapOrigin}
              destination={mapDest}
              originCoords={originCoords}
              destCoords={destCoords}
              myCoords={myCoords}
              userPins={userPins}
              fleetPositions={fleetPositions}
              currentUserId={user.id}
              onLocateMe={() => detectAndReportUserLocation(false)}
              locatingUser={locatingUser}
              showRoute={showRouteOnMap}
              routeGeometry={calculatedRoute?.geometry || null}
              routeMetrics={calculatedRoute}
              pinMode={navSection === 'HOME' && bookingStep === 'ROUTE' && routeTab === 'PIN'}
              onPinMoveAddress={(place: GeoPlace) => {
                if (activeRouteField === 'pickup') {
                  setBookOrigin(place.name);
                  setOriginCoords({ lat: place.lat, lon: place.lon });
                } else {
                  setBookDest(place.name);
                  setDestCoords({ lat: place.lat, lon: place.lon });
                }
              }}
              waitingRadar={navSection === 'HOME' && bookingStep === 'WAITING'}
              driverActive={navSection === 'HOME' && bookingStep === 'IN_TRIP'}
              driverName={focusedTrip?.assigned_driver_name}
              driverCoords={activeTripDriverCoords}
              activeVehicleModel={focusedTrip?.model || 'Stargazer'}
              showBackButton={inActiveBookingFlow && !isDriverOnly}
              onBack={handleMapBack}
              isOffline={isOffline}
            />
          </div>
        }
        sheet={
          <BottomSheet
            snap={sheetSnap}
            onSnapChange={setSheetSnap}
            onEscape={inActiveBookingFlow ? handleMapBack : undefined}
            hasBottomNav={!inActiveBookingFlow}
            stepKey={`${navSection}:${bookingStep}`}
            footer={stickyFooter}
            topNav={undefined}
            ariaLabel="GalaxyFleet booking sheet"
          >
            {renderSheetContent()}
          </BottomSheet>
        }
      />
      {renderSharedModals()}
    </>
  );
}

export default App;
