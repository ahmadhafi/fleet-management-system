import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  ArrowRight,
  ArrowLeft,
  Bus,
  X,
  Award,
  LocateFixed,
  ChevronDown,
  Loader2,
  ClipboardList,
  Info,
  KeyRound,
  Copy,
  Gauge,
} from 'lucide-react';
import { apiRequest, getStoredToken, setStoredToken, urlBase64ToUint8Array } from './api';
import { AppShell, AdminShell, type NavSection, type AdminModule } from './components/AppShell';
import { DriverScheduleCalendar, isHistoryTripRecord, todayLocalDateStr } from './components/DriverScheduleCalendar';
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
  haversineKm,
} from './components/MapView';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { DisplayModeToggle } from './components/DisplayModeToggle';
import { useAppLanguage, startDomTranslationObserver, translateDomTree, translateNotificationText, type SupportedLang } from './utils/i18n';
import { SamsungBusLogo } from './components/SamsungBusLogo';
import { CompanyCarIcon } from './components/CompanyCarIcon';
import { RouteFields } from './components/RouteFields';
import { getDriverAvatarDataUri, getVehiclePhotoIconUrl } from './components/CarAvatarArt';
import { triggerSystemNotification } from './utils/notification';
import { GojekWheelPicker, type DateOption } from './components/GojekWheelPicker';
import {
  Chip,
  StatusBadge,
  toneFromStatus,
  Segmented,
  ListRow,
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

export const SAMSUNG_JABABEKA_FACILITY = {
  name: 'PT Samsung Electronics Indonesia (SEIN)',
  fullName: 'PT Samsung Electronics Indonesia - Jababeka Plant',
  address: 'Jl. Jababeka Raya Blok F. 29 No.31, Harja Mekar, Kec. Cikarang Utara, Kabupaten Bekasi, Jawa Barat 17530',
  shortAddress: 'Jl. Jababeka Raya Blok F. 29 No.31, Cikarang Utara',
  lat: -6.287549,
  lon: 107.1356063,
  mapsUrl: 'https://maps.app.goo.gl/3SNQBaMPZwVQCy857?g_st=ac',
};

const QUICK_CORPORATE_POIS = [
  { label: 'Samsung Jababeka (SEIN)', name: 'PT Samsung Electronics Indonesia - Jababeka Plant', address: 'Jl. Jababeka Raya Blok F. 29 No.31, Harja Mekar, Kec. Cikarang Utara, Kabupaten Bekasi, Jawa Barat 17530', lat: -6.287549, lon: 107.1356063 },
  { label: 'Plant 1 (Sunter)', name: 'Manufacturing Plant 1', address: 'Jl. Danau Sunter Barat No. 8, Sunter Jaya, Jakarta Utara', lat: -6.13842, lon: 106.88561 },
  { label: 'Plant 2 (Karawang)', name: 'Manufacturing Plant 2', address: 'Kawasan Industri KIIC Lot A-1, Telukjambe Timur, Karawang Barat', lat: -6.34789, lon: 107.28912 },
  { label: 'Central Pool', name: 'Central Fleet Pool & Operations Base', address: 'Jl. Rawa Gelam IV No. 2, Kawasan Industri Pulogadung, Jakarta Timur', lat: -6.19834, lon: 106.88873 },
  { label: 'SCBD Head Office', name: 'Head Office - SCBD District 8', address: 'District 8 SCBD, Treasury Tower Lt. 35, Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan', lat: -6.22728, lon: 106.80816 },
  { label: 'Soekarno-Hatta (CGK)', name: 'Bandara Internasional Soekarno-Hatta (CGK) - Terminal 3', address: 'Bandara Soekarno-Hatta Terminal 3 Ultimate, Benda, Kota Tangerang', lat: -6.12556, lon: 106.65589 },
  { label: 'Whoosh Halim (KCIC)', name: 'Stasiun Kereta Cepat Whoosh Halim (KCIC)', address: 'Jl. Akses Stasiun Kereta Cepat Halim, Makasar, Jakarta Timur', lat: -6.24876, lon: 106.88765 },
  { label: 'Cikarang Hub', name: 'Cikarang Assembly Plant', address: 'Greenland International Industrial Center (GIIC), Deltamas, Cikarang Pusat', lat: -6.37521, lon: 107.16834 },
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
  if (mode === 'DROP_AND_PICKUP' || mode === 'ROUND_TRIP') {
    const rp = returnPickupTime
      ? ` • Pick-Up ${new Date(returnPickupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : '';
    return `Round Trip${rp}`;
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

export function getScheduleSlotDisplay(isoOrDateStr: string, targetLang?: SupportedLang): string {
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

function extractIndividualPassengers(passengersJson?: string | null, passengerNickname?: string | null): string[] {
  const names: string[] = [];
  if (passengersJson) {
    try {
      const parsed = JSON.parse(passengersJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        for (const p of parsed) {
          const raw = String(p?.nickname || p?.name || p || '').trim();
          for (const part of raw.split(/[,\n]+/)) {
            const clean = part.replace(/^\d+\.\s*/, '').trim();
            if (clean) names.push(clean);
          }
        }
      }
    } catch {}
  }
  if (names.length === 0 && passengerNickname) {
    for (const part of String(passengerNickname).split(/[,\n]+/)) {
      const clean = part.replace(/^\d+\.\s*/, '').trim();
      if (clean) names.push(clean);
    }
  }
  return names;
}

function formatPassengersDisplay(passengersJson?: string | null, passengerNickname?: string | null): string {
  const names = extractIndividualPassengers(passengersJson, passengerNickname);
  if (names.length > 0) {
    return names.map((n, idx) => `${idx + 1}. ${n}`).join('\n');
  }
  return passengerNickname || 'Team';
}

function formatPassengersMultiLine(passengersJson?: string | null, passengerNickname?: string | null): string {
  const names = extractIndividualPassengers(passengersJson, passengerNickname);
  if (names.length > 0) {
    return names.map((n, idx) => `${idx + 1}. ${n}`).join('\n');
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

export function compressImageFileToDataUrl(file: File, maxDim = 1200, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || typeof document === 'undefined') {
        resolve(rawDataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width || 800;
          let height = img.naturalHeight || img.height || 600;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.max(1, Math.round((height * maxDim) / width));
              width = maxDim;
            } else {
              width = Math.max(1, Math.round((width * maxDim) / height));
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed && compressed.length < rawDataUrl.length ? compressed : rawDataUrl);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
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

  // Theme preference (Defaults to Samsung Browser Midnight Dark UI across all browsers)
  const [themePref, setThemePref] = useState<'system' | 'light' | 'dark'>(() => {
    const saved = localStorage.getItem('gf_theme_pref_v2');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (themePref === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.setAttribute('data-theme', 'dark');
    }
    localStorage.setItem('gf_theme_pref_v2', themePref);
  }, [themePref]);

  // Auth screen state (Pure Login vs Registration — Revision #2)
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regNickname, setRegNickname] = useState('');
  const [regDeptId, setRegDeptId] = useState(1);
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regContactNumber, setRegContactNumber] = useState('');
  const [regRole, setRegRole] = useState<'EMP' | 'DRV'>('EMP');
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Forgot Password & Admin Direct Password Reset state
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotNotes, setForgotNotes] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotResult, setForgotResult] = useState<{ message: string; admin_whatsapp_url?: string | null; requestId?: number } | null>(null);

  const [passwordResetRequests, setPasswordResetRequests] = useState<any[]>([]);
  const [adminResetTargetUser, setAdminResetTargetUser] = useState<{ id: number; nickname: string; group_username: string; contact_number?: string } | null>(null);
  const [adminResetNewPassword, setAdminResetNewPassword] = useState('');
  const [adminResetShowPassword, setAdminResetShowPassword] = useState(true);
  const [adminResetSubmitting, setAdminResetSubmitting] = useState(false);
  const [adminResetError, setAdminResetError] = useState<string | null>(null);
  const [adminResetResult, setAdminResetResult] = useState<{ message: string; temporary_password: string; whatsapp_url?: string | null; user?: { nickname: string; group_username: string; contact_number?: string } } | null>(null);
  const [adminResetCopied, setAdminResetCopied] = useState(false);

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
  const [reportApprovals, setReportApprovals] = useState<any[]>([]);
  const [reportApprovalPopup, setReportApprovalPopup] = useState<any | null>(null);
  const [reportApprovalNotes, setReportApprovalNotes] = useState<string>('');
  const [reportApprovalSubmitting, setReportApprovalSubmitting] = useState<boolean>(false);
  const reportApprovalSnoozedRef = useRef<Record<string, boolean>>({});
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
  const [vehicleFilter, _setVehicleFilter] = useState<'ALL' | 'Electric' | 'MPV'>('ALL');
  void _setVehicleFilter;
  const [activityTab, setActivityTab] = useState<'ONGOING' | 'HISTORY'>('ONGOING');
  const [summaryPicker, setSummaryPicker] = useState<'PURPOSE' | 'PAX' | 'NOTES' | 'CHARGE' | null>(null);
  const [_pickerValidationError, setPickerValidationError] = useState<string | null>(null);
  const [focusedTripId, setFocusedTripId] = useState<number | null>(null);
  const [driverSectionTab, setDriverSectionTab] = useState<'DISPATCH' | 'SCHEDULE'>('DISPATCH');
  const [customerHomeMode, setCustomerHomeMode] = useState<'SUPER_APP' | 'GOCAR_LANDING'>('SUPER_APP');
  const [driverTripLogTab, setDriverTripLogTab] = useState<'TRIPS' | 'EXPENSES'>('TRIPS');
  const [driverActivatingToast, setDriverActivatingToast] = useState<string | null>(null);
  const [driverStatusSheetOpen, setDriverStatusSheetOpen] = useState<boolean>(false);
  const [driverActivatingOnline, setDriverActivatingOnline] = useState<boolean>(false);
  const [driverDispatchDrawerOpen, setDriverDispatchDrawerOpen] = useState<boolean>(false);

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
  const [bookDriverId, _setBookDriverId] = useState<string>('');
  void _setBookDriverId;
  const [bookPax, setBookPax] = useState<number>(1);
  const [bookNotes, setBookNotes] = useState('');
  const [bookUrgentReason, setBookUrgentReason] = useState<string>('');
  const [bookDurationHours, setBookDurationHours] = useState<number>(2);
  const userEditedBookEndRef = useRef<boolean>(false);
  const [bookEndAutoEtaMin, setBookEndAutoEtaMin] = useState<number | null>(null);
  const [enlargedPhotoModal, setEnlargedPhotoModal] = useState<{ src: string; title: string; subtitle?: string } | null>(null);
  const [liveAvailability, setLiveAvailability] = useState<{ vehicles: any[]; drivers: any[] } | null>(null);
  const [scheduleFilterTab, setScheduleFilterTab] = useState<'ALL' | 'AVAILABLE' | 'BOOKED'>('ALL');
  const [scheduleCalendarDate, setScheduleCalendarDate] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });
  const [calendarTrips, setCalendarTrips] = useState<any[]>([]);
  const [negotiationModalTrip, setNegotiationModalTrip] = useState<any | null>(null);
  const [negotiationActionType, setNegotiationActionType] = useState<'HITCHHIKE' | 'REQUEST_CANCEL'>('HITCHHIKE');
  const [negotiationNote, setNegotiationNote] = useState<string>('');
  const [negotiationPassengerNickname, setNegotiationPassengerNickname] = useState<string>('');
  const [negotiationExtraPassengers, setNegotiationExtraPassengers] = useState<string[]>([]);
  const [negotiationLocationMode, setNegotiationLocationMode] = useState<'SAME' | 'DIFFERENT'>('SAME');
  const [negotiationOrigin, setNegotiationOrigin] = useState<string>('');
  const [negotiationDestination, setNegotiationDestination] = useState<string>('');
  const [negotiationPurpose, setNegotiationPurpose] = useState<string>('');
  const [negActiveRouteField, setNegActiveRouteField] = useState<'pickup' | 'destination'>('pickup');
  const [negGeoResults, setNegGeoResults] = useState<GeoPlace[]>([]);
  const [negGeoLoading, setNegGeoLoading] = useState<boolean>(false);
  const [negLocating, setNegLocating] = useState<boolean>(false);
  const [negotiationSubmitting, setNegotiationSubmitting] = useState<boolean>(false);
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);
  const [negotiationRespondBusyId, setNegotiationRespondBusyId] = useState<number | null>(null);
  const respondingNegIdsRef = useRef<Set<string>>(new Set());
  const decidedNegMapRef = useRef<Map<string, { status: 'ACCEPTED' | 'REJECTED'; transferredTripId?: number | null }>>(new Map());
  const applyLocalNegotiationDecisions = useCallback((list: any[]) => {
    if (!Array.isArray(list) || decidedNegMapRef.current.size === 0) return list;
    return list.map((item) => {
      const byNeg = item?.negotiation_id ? decidedNegMapRef.current.get(`neg-${item.negotiation_id}`) : undefined;
      const byNotif = item?.id ? decidedNegMapRef.current.get(`notif-${item.id}`) : undefined;
      const locked = byNeg || byNotif;
      if (!locked) return item;
      return {
        ...item,
        is_read: 1,
        negotiation_status: locked.status,
        negotiation_transferred_trip_id: locked.transferredTripId ?? item.negotiation_transferred_trip_id,
      };
    });
  }, []);
  const [adminScheduleSubTab, setAdminScheduleSubTab] = useState<'ACTIVE' | 'AUDIT'>('ACTIVE');
  const [scheduleAuditRecords, setScheduleAuditRecords] = useState<any[]>([]);
  const [scheduleAuditDate, setScheduleAuditDate] = useState<string>('');
  const [scheduleAuditStatus, setScheduleAuditStatus] = useState<'COMPLETED' | 'PAST' | 'CANCELLED' | 'REJECTED' | 'ALL'>('COMPLETED');
  const [scheduleAuditSearch, setScheduleAuditSearch] = useState<string>('');
  const [selectedAuditRecord, setSelectedAuditRecord] = useState<any | null>(null);

  // Driver Expense Reimbursement & Petty Cash State
  const [showDriverExpenseModal, setShowDriverExpenseModal] = useState<boolean>(false);
  const [driverPettyCashBalance, setDriverPettyCashBalance] = useState<number>(500000);
  const driverReceiptInputRef = useRef<HTMLInputElement | null>(null);
  const [showPreBookingConfirmModal, setShowPreBookingConfirmModal] = useState<boolean>(false);
  const [driverExpenseForm, setDriverExpenseForm] = useState({
    vehicle_id: 0,
    category: 'Parking',
    payment_source: 'PETTY_CASH' as 'PETTY_CASH' | 'DRIVER_ADVANCE',
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
  const [dispatchAvailability, setDispatchAvailability] = useState<{ vehicles: any[]; drivers: any[] } | null>(null);
  const [dispatchAvailabilityLoading, setDispatchAvailabilityLoading] = useState<boolean>(false);
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
    seats: '5',
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

  // Driver PWA GPS & Trip Action State (Online automatically makes driver Ready for Duty)
  const [gpsNoticeAccepted, setGpsNoticeAccepted] = useState<boolean>(true);
  const [gpsReportingActive, setGpsReportingActive] = useState<boolean>(true);
  const [gpsPermissionState, setGpsPermissionState] = useState<'GRANTED' | 'DENIED' | 'UNAVAILABLE'>('GRANTED');
  const [, setLastDriverGpsReport] = useState<any | null>(null);
  const [activeTripOdoInput, setActiveTripOdoInput] = useState<Record<number, string>>({});
  const [activeTripBatteryInput, setActiveTripBatteryInput] = useState<Record<number, string>>({});
  const [activeTripParkingInput, setActiveTripParkingInput] = useState<Record<number, string>>({});
  const [driverSelectedTripId, setDriverSelectedTripId] = useState<number | null>(null);
  const [driverRoute, setDriverRoute] = useState<RouteCalculationResult | null>(null);
  const [driverOriginCoords, setDriverOriginCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [driverDestCoords, setDriverDestCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [navAppModalTarget, setNavAppModalTarget] = useState<{
    tripId?: number;
    origin?: string;
    destination: string;
    originCoords?: { lat: number; lon: number } | null;
    destCoords?: { lat: number; lon: number } | null;
    targetMode: 'DESTINATION' | 'PICKUP';
  } | null>(null);

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

  // Re-run DOM translation sweep whenever language or active screen/modal changes
  useEffect(() => {
    if (typeof document !== 'undefined' && document.body) {
      translateDomTree(document.body, lang);
      const tId = window.setTimeout(() => {
        if (document.body) translateDomTree(document.body, lang);
      }, 60);
      return () => window.clearTimeout(tId);
    }
    return undefined;
  }, [
    lang,
    user,
    navSection,
    bookingStep,
    customerHomeMode,
    adminModule,
    opsSubTab,
    driverSectionTab,
    driverTripLogTab,
    activityTab,
    showSchedulePicker,
    showDriverExpenseModal,
    showPreBookingConfirmModal,
    dispatchModalTrip,
    summaryPicker,
  ]);

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
      const [vehRes, drvRes, trpRes, bkgRes, ntfRes, deptRes, pinRes, calRes] = await Promise.all([
        apiRequest('/api/vehicles'),
        apiRequest('/api/drivers'),
        apiRequest('/api/trips'),
        apiRequest('/api/bookings'),
        apiRequest('/api/notifications'),
        apiRequest('/api/departments'),
        apiRequest('/api/location/pins').catch(() => ({ pins: [] })),
        apiRequest('/api/schedule/calendar').catch(() => ({ trips: [] })),
      ]);
      const loadedVehicles = vehRes.vehicles || [];
      const loadedDrivers = drvRes.drivers || [];
      setVehicles(loadedVehicles);
      setDrivers(loadedDrivers);
      setTrips(trpRes.trips || []);
      setBookings(bkgRes.bookings || []);
      setNotifications(applyLocalNegotiationDecisions(ntfRes.notifications || []));
      setUserPins(pinRes.pins || []);
      if (Array.isArray(calRes.scheduleTrips || calRes.trips)) {
        setCalendarTrips(calRes.scheduleTrips || calRes.trips);
      }
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

        // Auto-fill logged-in driver's assigned vehicle on reimbursement form (Requirement #7)
        const myDrv = loadedDrivers.find(
          (d: any) => d.user_id === currentUser.id || String(d.full_name || '').toLowerCase() === String(currentUser.nickname || '').toLowerCase()
        );
        if (myDrv && typeof myDrv.petty_cash_balance === 'number') {
          setDriverPettyCashBalance(myDrv.petty_cash_balance);
        }
        const assignedCar =
          loadedVehicles.find(
            (v: any) =>
              (v.dedicated_driver_user_id && v.dedicated_driver_user_id === currentUser.id) ||
              (myDrv && v.default_driver_id === myDrv.id) ||
              (v.default_driver_name && String(v.default_driver_name).toLowerCase() === String(currentUser.nickname || '').toLowerCase())
          ) || loadedVehicles[0];
        if (assignedCar) {
          setDriverExpenseForm((prev) => ({ ...prev, vehicle_id: assignedCar.id }));
        }
      }

      if (['DRV', 'ADM', 'FM'].includes(currentUser.role)) {
        const dspRes = await apiRequest('/api/driver/dispatches');
        const loadedDispatches = dspRes.dispatches || [];
        setDispatches(loadedDispatches);
        if (currentUser.role === 'DRV' && loadedDispatches.length > 0 && loadedDispatches[0].vehicle_id) {
          setDriverExpenseForm((prev) => ({ ...prev, vehicle_id: prev.vehicle_id || loadedDispatches[0].vehicle_id }));
        }
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
      if (typeof expRes.driverPettyCashBalance === 'number') {
        setDriverPettyCashBalance(expRes.driverPettyCashBalance);
      }
      setDocuments(docRes.documents || []);

      if (['ADM', 'FM', 'HWS'].includes(currentUser.role)) {
        const [usrRes, gpsRes, anaRes, audRes, fleetRes, repAppRes, pwdResetRes] = await Promise.all([
          apiRequest('/api/users'),
          apiRequest('/api/gps/latest'),
          apiRequest('/api/analytics/usage'),
          apiRequest('/api/audit'),
          apiRequest('/api/admin/fleet-map-positions'),
          apiRequest('/api/reports/approvals').catch(() => ({ approvals: [], pendingPopup: null })),
          currentUser.role === 'ADM'
            ? apiRequest('/api/admin/password-reset-requests').catch(() => ({ requests: [] }))
            : Promise.resolve({ requests: [] }),
        ]);
        setUsersList(usrRes.users || []);
        setGpsLatest(gpsRes);
        setUsageAnalytics(anaRes);
        setAuditEvents(audRes.auditEvents || []);
        setFleetPositions(fleetRes.fleetPositions || []);
        setReportApprovals(repAppRes.approvals || []);
        setPasswordResetRequests(pwdResetRes.requests || []);
        if (
          (currentUser.role === 'FM' || currentUser.role === 'HWS') &&
          repAppRes.pendingPopup &&
          !reportApprovalSnoozedRef.current[String(repAppRes.pendingPopup.period_key)]
        ) {
          setReportApprovalPopup(repAppRes.pendingPopup);
        }
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

  // Live Nationwide Indonesia Maps Search (Server POIs + MapTiler + Nominatim + Browser-Direct Free ArcGIS & Photon)
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
    const isInsideIndonesia = (lat: number, lon: number) =>
      Number.isFinite(lat) && Number.isFinite(lon) && lat >= -11.5 && lat <= 6.5 && lon >= 94.5 && lon <= 141.5;

    const timer = window.setTimeout(async () => {
      try {
        const serverPromise = apiRequest(`/api/geocode/search?q=${encodeURIComponent(queryText)}`)
          .then((res) => (Array.isArray(res?.results) ? (res.results as GeoPlace[]) : []))
          .catch(() => [] as GeoPlace[]);

        // Direct browser-to-ArcGIS World Geocoder (100% free, zero API key, CORS-enabled, complete all-Indonesia streets/POIs/malls/hotels/offices)
        const browserArcgisPromise = fetch(
          `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(
            queryText
          )}&countryCode=IDN&maxLocations=12&outFields=PlaceName,Place_addr,Match_addr&f=pjson`,
          { headers: { Accept: 'application/json' } }
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((data: any) => {
            const list: GeoPlace[] = [];
            for (const cand of Array.isArray(data?.candidates) ? data.candidates : []) {
              const lat = Number(cand.location?.y);
              const lon = Number(cand.location?.x);
              if (!isInsideIndonesia(lat, lon)) continue;
              const attrs = cand.attributes || {};
              const name = String(attrs.PlaceName || cand.address?.split(',')[0] || queryText).trim();
              const address = String(attrs.Place_addr || attrs.Match_addr || cand.address || name).trim();
              list.push({ name, address, lat, lon });
            }
            return list;
          })
          .catch(() => [] as GeoPlace[]);

        // Direct browser-to-Photon Komoot OpenStreetMap geocoder (100% free, zero API key, CORS-enabled, all Indonesia)
        const browserPhotonPromise = fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(queryText)}&bbox=94.5,-11.2,141.5,6.2&limit=10`,
          { headers: { Accept: 'application/json' } }
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((data: any) => {
            const list: GeoPlace[] = [];
            for (const feat of Array.isArray(data?.features) ? data.features : []) {
              const coords = feat.geometry?.coordinates || [];
              const lon = Number(coords[0]);
              const lat = Number(coords[1]);
              const props = feat.properties || {};
              if (!isInsideIndonesia(lat, lon)) continue;
              if (props.countrycode && String(props.countrycode).toUpperCase() !== 'ID') continue;
              const name = String(props.name || props.street || props.city || props.county || queryText).trim();
              const parts = Array.from(
                new Set([props.name, props.street, props.district || props.locality, props.city || props.county, props.state, props.country].filter(Boolean).map((s) => String(s).trim()))
              );
              list.push({
                name,
                address: parts.join(', ') || name,
                lat,
                lon,
              });
            }
            return list;
          })
          .catch(() => [] as GeoPlace[]);

        const [serverItems, arcItems, photonItems] = await Promise.all([
          serverPromise,
          browserArcgisPromise,
          browserPhotonPromise,
        ]);
        if (cancelled) return;

        const merged: GeoPlace[] = [];
        const addUnique = (p: GeoPlace) => {
          if (!isInsideIndonesia(p.lat, p.lon)) return;
          const dup = merged.some(
            (m) => Math.abs(m.lat - p.lat) < 0.0006 && Math.abs(m.lon - p.lon) < 0.0006
          );
          if (!dup) merged.push(p);
        };
        for (const p of serverItems) addUnique(p);
        for (const p of arcItems) addUnique(p);
        for (const p of photonItems) addUnique(p);

        const finalList = merged.slice(0, 30);
        setGeoResults(finalList);
        // Automatically resolve coordinates for typed addresses only when not explicitly selected yet
        if (finalList.length > 0 && Number.isFinite(finalList[0].lat) && Number.isFinite(finalList[0].lon)) {
          if (activeRouteField === 'pickup') {
            setOriginCoords((prev) => prev || { lat: finalList[0].lat, lon: finalList[0].lon });
          } else if (activeRouteField === 'destination') {
            setDestCoords((prev) => prev || { lat: finalList[0].lat, lon: finalList[0].lon });
          }
        }
      } catch {
        if (!cancelled) setGeoResults([]);
      } finally {
        if (!cancelled) setGeoLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bookingStep, routeTab, activeRouteField, bookOrigin, bookDest]);

  // Live Geocode Search for Cancel & Transfer modal ONLY when "Different Location" is selected
  useEffect(() => {
    if (!negotiationModalTrip || negotiationActionType !== 'REQUEST_CANCEL' || negotiationLocationMode !== 'DIFFERENT') {
      setNegGeoResults([]);
      setNegGeoLoading(false);
      return;
    }
    const queryText = (negActiveRouteField === 'pickup' ? negotiationOrigin : negotiationDestination).trim();
    if (queryText.length < 2) {
      setNegGeoResults([]);
      setNegGeoLoading(false);
      return;
    }
    let cancelled = false;
    setNegGeoLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiRequest(`/api/geocode/search?q=${encodeURIComponent(queryText)}`);
        if (!cancelled) {
          setNegGeoResults(Array.isArray(res?.results) ? (res.results as GeoPlace[]).slice(0, 8) : []);
        }
      } catch {
        if (!cancelled) setNegGeoResults([]);
      } finally {
        if (!cancelled) setNegGeoLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [negotiationModalTrip, negotiationActionType, negotiationLocationMode, negActiveRouteField, negotiationOrigin, negotiationDestination]);

  const handleUseCurrentLocationForTransfer = async () => {
    setNegLocating(true);
    const applyCoords = async (lat: number, lon: number) => {
      let label = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      try {
        const rev = await apiRequest(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
        if (rev?.name) label = String(rev.name);
      } catch {
        // fallback to coordinates
      }
      if (negActiveRouteField === 'destination') {
        setNegotiationDestination(label);
      } else {
        setNegotiationOrigin(label);
        setNegActiveRouteField('destination');
      }
      setNegGeoResults([]);
      setNegLocating(false);
    };
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void applyCoords(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          if (myCoords) {
            void applyCoords(myCoords.lat, myCoords.lon);
          } else {
            setNegLocating(false);
            setStatusBanner({ type: 'warning', text: t('Unable to read GPS location. Please search or pick a location below.') });
          }
        },
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
      );
    } else if (myCoords) {
      await applyCoords(myCoords.lat, myCoords.lon);
    } else {
      setNegLocating(false);
    }
  };

  // Calculate real road route path, distance (km), ride time (min), and arrival ETA whenever pickup & destination are set
  useEffect(() => {
    if (!user || !bookDest.trim()) {
      setCalculatedRoute(null);
      return;
    }

    let cancelled = false;

    // Instant optimistic route & ETA whenever explicit destination coordinates are chosen (zero network wait for Gojek map zoom)
    if (destCoords && Number.isFinite(destCoords.lat) && Number.isFinite(destCoords.lon)) {
      const fastOrigLat = originCoords?.lat ?? myCoords?.lat ?? -6.22728;
      const fastOrigLon = originCoords?.lon ?? myCoords?.lon ?? 106.80816;
      const fastEst = estimateRouteMetrics(
        bookOrigin || 'Samsung Office Jakarta (Lobby)',
        bookDest,
        { lat: fastOrigLat, lon: fastOrigLon },
        destCoords
      );
      const fastDepMs =
        scheduleMode === 'SCHEDULE' && bookStart ? new Date(bookStart).getTime() || Date.now() : Date.now();
      const fastEtaDate = new Date(fastDepMs + fastEst.durationMin * 60_000);
      const ctrlLat = (fastOrigLat + destCoords.lat) / 2 + (destCoords.lon - fastOrigLon) * 0.1;
      const ctrlLon = (fastOrigLon + destCoords.lon) / 2 - (destCoords.lat - fastOrigLat) * 0.1;
      const fastCurve: Array<[number, number]> = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const omt = 1 - t;
        fastCurve.push([
          omt * omt * fastOrigLat + 2 * omt * t * ctrlLat + t * t * destCoords.lat,
          omt * omt * fastOrigLon + 2 * omt * t * ctrlLon + t * t * destCoords.lon,
        ]);
      }
      setCalculatedRoute({
        distanceKm: fastEst.distanceKm,
        durationMin: fastEst.durationMin,
        etaIso: fastEtaDate.toISOString(),
        etaText: fastEtaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        geometry: fastCurve,
      });
    }

    const timer = window.setTimeout(async () => {
      setCalculatingRoute(true);
      try {
        let resolvedOrig = originCoords;
        let resolvedDest = destCoords;

        if (!bookOrigin.trim()) {
          // Leave pickup blank — do not auto-fill a default office address; only compute route preview using current GPS if available
          resolvedOrig = myCoords ? { lat: myCoords.lat, lon: myCoords.lon } : null;
        }

        const quickResolveCoords = async (queryStr: string): Promise<{ lat: number; lon: number } | null> => {
          const gServer = await apiRequest(`/api/geocode/search?q=${encodeURIComponent(queryStr)}`).catch(() => null);
          if (gServer?.results?.[0]) {
            return { lat: Number(gServer.results[0].lat), lon: Number(gServer.results[0].lon) };
          }
          // Fallback directly to free ArcGIS World Geocoder if server search had no hit
          const gArc = await fetch(
            `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(
              queryStr
            )}&countryCode=IDN&maxLocations=1&f=pjson`
          )
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
          const cand = gArc?.candidates?.[0];
          if (cand && Number.isFinite(Number(cand.location?.y)) && Number.isFinite(Number(cand.location?.x))) {
            return { lat: Number(cand.location.y), lon: Number(cand.location.x) };
          }
          return null;
        };

        if (!resolvedOrig && bookOrigin.trim().length >= 2) {
          const cleanOrigQuery = bookOrigin.replace(/\s*\(Spot [ABC]\)$/i, '').replace(/\s*\(Main Lobby Gate\)$/i, '').trim();
          const hit = await quickResolveCoords(cleanOrigQuery);
          if (hit) {
            resolvedOrig = hit;
            if (!cancelled) setOriginCoords(resolvedOrig);
          }
        }
        if (!resolvedDest && bookDest.trim().length >= 2) {
          const cleanDestQuery = bookDest.replace(/\s*\(Main Lobby Gate\)$/i, '').trim();
          const hit = await quickResolveCoords(cleanDestQuery);
          if (hit) {
            resolvedDest = hit;
            if (!cancelled) setDestCoords(resolvedDest);
          }
        }

        const origLat = resolvedOrig?.lat ?? (myCoords?.lat ?? -6.22728);
        const origLon = resolvedOrig?.lon ?? (myCoords?.lon ?? 106.80816);
        const dstLat = resolvedDest?.lat ?? origLat - 0.018;
        const dstLon = resolvedDest?.lon ?? origLon + 0.022;
        const depTime = scheduleMode === 'SCHEDULE' && bookStart ? new Date(bookStart).toISOString() : new Date().toISOString();
        const baseDepMs = new Date(depTime).getTime() || Date.now();

        let routeRes = await apiRequest(
          `/api/route?originLat=${encodeURIComponent(origLat)}&originLon=${encodeURIComponent(origLon)}&destLat=${encodeURIComponent(dstLat)}&destLon=${encodeURIComponent(dstLon)}&departureTime=${encodeURIComponent(depTime)}`
        ).catch(() => null);

        // If server routing failed or fell back (e.g. cPanel outbound restriction), fetch real turn-by-turn road geometry directly in browser
        if (!routeRes || routeRes.source === 'fallback') {
          const directUrls = [
            `https://routing.openstreetmap.de/routed-car/route/v1/driving/${origLon},${origLat};${dstLon},${dstLat}?overview=full&geometries=geojson`,
            `https://router.project-osrm.org/route/v1/driving/${origLon},${origLat};${dstLon},${dstLat}?overview=full&geometries=geojson`,
          ];
          for (const dUrl of directUrls) {
            try {
              const dr = await fetch(dUrl, { headers: { Accept: 'application/json' } });
              if (dr.ok) {
                const dd = await dr.json();
                const rt = dd?.routes?.[0];
                if (rt && typeof rt.distance === 'number' && typeof rt.duration === 'number') {
                  const dKm = Math.max(0.2, Number((rt.distance / 1000).toFixed(1)));
                  const dMin = Math.max(2, Math.round((rt.duration * 1.2) / 60));
                  const etaDate = new Date(baseDepMs + dMin * 60_000);
                  const geom = Array.isArray(rt.geometry?.coordinates)
                    ? rt.geometry.coordinates
                        .filter((pt: any) => Array.isArray(pt) && pt.length >= 2)
                        .map((pt: any) => [Number(pt[1]), Number(pt[0])] as [number, number])
                    : undefined;
                  if (geom && geom.length >= 2) {
                    routeRes = {
                      distanceKm: dKm,
                      durationMin: dMin,
                      etaIso: etaDate.toISOString(),
                      etaText: etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      geometry: geom,
                      source: 'browser-osrm',
                    };
                    break;
                  }
                }
              }
            } catch {
              // try next direct router
            }
          }
        }

        if (!cancelled && routeRes && routeRes.distanceKm > 0) {
          const etaDate = routeRes.etaIso ? new Date(routeRes.etaIso) : new Date(baseDepMs + Number(routeRes.durationMin || 10) * 60_000);
          setCalculatedRoute({
            distanceKm: Number(routeRes.distanceKm || 0),
            durationMin: Number(routeRes.durationMin || 0),
            etaIso: routeRes.etaIso,
            etaText: etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            geometry: Array.isArray(routeRes.geometry) ? routeRes.geometry : undefined,
          });
        } else if (!cancelled) {
          const est = estimateRouteMetrics(bookOrigin || 'Samsung Office Jakarta (Lobby)', bookDest, { lat: origLat, lon: origLon }, { lat: dstLat, lon: dstLon });
          const etaDate = new Date(baseDepMs + est.durationMin * 60_000);
          const ctrlLat = (origLat + dstLat) / 2 + (dstLon - origLon) * 0.1;
          const ctrlLon = (origLon + dstLon) / 2 - (dstLat - origLat) * 0.1;
          const curve: Array<[number, number]> = [];
          for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const omt = 1 - t;
            curve.push([
              omt * omt * origLat + 2 * omt * t * ctrlLat + t * t * dstLat,
              omt * omt * origLon + 2 * omt * t * ctrlLon + t * t * dstLon,
            ]);
          }
          setCalculatedRoute({
            distanceKm: est.distanceKm,
            durationMin: est.durationMin,
            etaIso: etaDate.toISOString(),
            etaText: etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            geometry: curve,
          });
        }
      } catch {
        if (!cancelled) {
          const fallbackOrig = originCoords || (myCoords ? { lat: myCoords.lat, lon: myCoords.lon } : { lat: -6.22728, lon: 106.80816 });
          const fallbackDest = destCoords || { lat: fallbackOrig.lat - 0.018, lon: fallbackOrig.lon + 0.022 };
          const est = estimateRouteMetrics(bookOrigin || 'Samsung Office Jakarta (Lobby)', bookDest, fallbackOrig, fallbackDest);
          const etaDate = new Date(Date.now() + est.durationMin * 60_000);
          setCalculatedRoute({
            distanceKm: est.distanceKm,
            durationMin: est.durationMin,
            etaIso: etaDate.toISOString(),
            etaText: etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            geometry: [
              [fallbackOrig.lat, fallbackOrig.lon],
              [(fallbackOrig.lat + fallbackDest.lat) / 2, (fallbackOrig.lon + fallbackDest.lon) / 2],
              [fallbackDest.lat, fallbackDest.lon],
            ],
          });
        }
      } finally {
        if (!cancelled) setCalculatingRoute(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user, bookOrigin, bookDest, originCoords, destCoords, myCoords, scheduleMode, bookStart]);

  const computeEtaReturnMs = useCallback((startMs: number, durationMin: number): number => {
    const safeMin = Math.max(15, Math.ceil(Math.max(1, durationMin) / 5) * 5);
    return startMs + safeMin * 60_000;
  }, []);

  const formatBookingDuration = useCallback((startVal: string, endVal: string, fallbackHours: number): string => {
    const sMs = startVal ? new Date(startVal).getTime() : NaN;
    const eMs = endVal ? new Date(endVal).getTime() : NaN;
    if (Number.isNaN(sMs) || Number.isNaN(eMs) || eMs <= sMs) {
      return `${fallbackHours}h`;
    }
    const diffMin = Math.max(1, Math.round((eMs - sMs) / 60_000));
    if (diffMin < 60) return `${diffMin}m`;
    const hrs = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    return remMin === 0 ? `${hrs}h` : `${hrs}h ${remMin}m`;
  }, []);

  // Whenever user changes destination, allow the new route's ETA to auto-prefill return time again
  useEffect(() => {
    userEditedBookEndRef.current = false;
  }, [bookDest]);

  // Auto-prefill Return Date & Time from route estimation time (ETA) for Standard Trip unless user manually edited it
  useEffect(() => {
    if (bookReservationType !== 'ONE_WAY') {
      setBookEndAutoEtaMin(null);
      return;
    }
    const etaMin = Number(calculatedRoute?.durationMin || 0);
    if (!etaMin || etaMin <= 0 || userEditedBookEndRef.current) return;
    const sMs = bookStart ? new Date(bookStart).getTime() : NaN;
    if (Number.isNaN(sMs)) return;
    const nextEndMs = computeEtaReturnMs(sMs, etaMin);
    const nextEndLocal = toLocalDateTimeInput(new Date(nextEndMs));
    setBookEnd((prev) => (prev === nextEndLocal ? prev : nextEndLocal));
    setBookDurationHours(Math.max(0.25, Number(((nextEndMs - sMs) / 3600000).toFixed(2))));
    setBookEndAutoEtaMin(etaMin);
  }, [calculatedRoute?.durationMin, bookStart, bookReservationType, computeEtaReturnMs]);

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

  // Fleet Manager / Admin Dispatch Modal: load ONLY available cars & drivers for this trip's exact time window
  useEffect(() => {
    if (!user || !dispatchModalTrip?.id || !dispatchModalTrip?.start_time || !dispatchModalTrip?.end_time) {
      setDispatchAvailability(null);
      setDispatchAvailabilityLoading(false);
      return;
    }
    let cancelled = false;
    setDispatchAvailabilityLoading(true);
    const qs = `start_time=${encodeURIComponent(dispatchModalTrip.start_time)}&end_time=${encodeURIComponent(dispatchModalTrip.end_time)}&exclude_trip_id=${encodeURIComponent(String(dispatchModalTrip.id))}`;
    apiRequest(`/api/availability?${qs}`)
      .then((res) => {
        if (cancelled) return;
        setDispatchAvailability(res);
        const availCars = (res?.vehicles || []).filter((v: any) => v.status === 'Available' && v.isAvailable !== false);
        const availDrivers = (res?.drivers || []).filter((d: any) => d.availability_status === 'Active' && d.isAvailable !== false);
        // 1 Driver = 1 Fixed Car: pair each available driver with their fixed available car
        const availDriverCarPairs = availDrivers
          .map((d: any) => {
            const fixedCar = availCars.find((v: any) => Number(v.default_driver_id) === Number(d.id));
            return fixedCar ? { driver: d, vehicle: fixedCar } : null;
          })
          .filter(Boolean) as Array<{ driver: any; vehicle: any }>;

        if (availDriverCarPairs.length > 0) {
          const preferredPair =
            availDriverCarPairs.find((p) => Number(p.driver.id) === Number(dispatchModalTrip.preferred_driver_id || dispatchModalTrip.driver_profile_id)) ||
            availDriverCarPairs.find((p) => Number(p.vehicle.id) === Number(dispatchModalTrip.vehicle_id)) ||
            availDriverCarPairs[0];
          setDispatchDriverId(String(preferredPair.driver.id));
          setDispatchVehicleId(Number(preferredPair.vehicle.id));
        } else if (availCars.length > 0) {
          // Fallback only if fleet vehicles have no default_driver_id configured yet
          const preferredCar =
            availCars.find((v: any) => Number(v.id) === Number(dispatchModalTrip.vehicle_id)) || availCars[0];
          setDispatchVehicleId(Number(preferredCar.id));
          setDispatchDriverId('');
        } else {
          setDispatchVehicleId(0);
          setDispatchDriverId('');
        }
      })
      .catch(() => {
        if (!cancelled) setDispatchAvailability(null);
      })
      .finally(() => {
        if (!cancelled) setDispatchAvailabilityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, dispatchModalTrip?.id, dispatchModalTrip?.start_time, dispatchModalTrip?.end_time]);

  // Periodic 20-Minute GPS Reporting + Screen WakeLock for Driver PWA
  const sendDriverLocationReport = useCallback(
    async (explicitState?: 'GRANTED' | 'DENIED' | 'UNAVAILABLE') => {
      if (!user || !['DRV', 'ADM', 'FM'].includes(user.role)) return;
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

  // Active dispatch selected for the Driver map route & live tracking (auto-prioritizes IN_PROGRESS trip)
  const activeDriverDispatch = useMemo(() => {
    if (!user || user.role !== 'DRV' || dispatches.length === 0) return null;
    if (driverSelectedTripId != null) {
      const explicit = dispatches.find(
        (d) => Number(d.trip_request_id) === Number(driverSelectedTripId) && d.trip_status !== 'COMPLETED' && d.trip_status !== 'CANCELLED'
      );
      if (explicit) return explicit;
    }
    const inProg = dispatches.find((d) => d.trip_status === 'IN_PROGRESS');
    if (inProg) return inProg;
    return dispatches.find((d) => d.trip_status !== 'COMPLETED' && d.trip_status !== 'CANCELLED' && d.trip_status !== 'REJECTED') || null;
  }, [user, dispatches, driverSelectedTripId]);

  const driverTripInProgress = Boolean(activeDriverDispatch && activeDriverDispatch.trip_status === 'IN_PROGRESS');

  // Continuous live GPS watchPosition so the driver's in-app avatar smoothly follows where they go during a trip
  useEffect(() => {
    if (!user || user.role !== 'DRV') return;
    if (!driverTripInProgress && !(gpsReportingActive && gpsNoticeAccepted)) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation || typeof navigator.geolocation.watchPosition !== 'function') return;

    let lastServerPushMs = 0;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude);
        const lon = Number(pos.coords.longitude);
        const acc = Number(pos.coords.accuracy || 15);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        setMyCoords({ lat, lon, accuracy: acc });
        const nowMs = Date.now();
        const pushIntervalMs = driverTripInProgress ? 5000 : 30000;
        if (nowMs - lastServerPushMs >= pushIntervalMs) {
          lastServerPushMs = nowMs;
          apiRequest('/api/driver/location', {
            method: 'POST',
            body: JSON.stringify({
              latitude: lat,
              longitude: lon,
              accuracy_meters: Math.round(acc),
              captured_at: new Date(pos.timestamp || nowMs).toISOString(),
              permission_state: 'GRANTED',
            }),
          })
            .then((res) => setLastDriverGpsReport(res.report || null))
            .catch(() => {});
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );

    return () => {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {}
    };
  }, [user, driverTripInProgress, gpsReportingActive, gpsNoticeAccepted]);

  // Compute road route geometry & ETA for the driver's active/assigned trip so they see the full route on the map
  useEffect(() => {
    if (!user || user.role !== 'DRV' || !activeDriverDispatch || !activeDriverDispatch.destination) {
      setDriverRoute(null);
      setDriverOriginCoords(null);
      setDriverDestCoords(null);
      return;
    }
    let cancelled = false;
    const drvOriginStr = String(activeDriverDispatch.origin || '').trim();
    const drvDestStr = String(activeDriverDispatch.destination || '').trim();

    const quickGeocode = async (queryStr: string): Promise<{ lat: number; lon: number } | null> => {
      if (!queryStr) return null;
      const gServer = await apiRequest(`/api/geocode/search?q=${encodeURIComponent(queryStr)}`).catch(() => null);
      if (gServer?.results?.[0]) {
        return { lat: Number(gServer.results[0].lat), lon: Number(gServer.results[0].lon) };
      }
      const gArc = await fetch(
        `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(
          queryStr
        )}&countryCode=IDN&maxLocations=1&f=pjson`
      )
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      const cand = gArc?.candidates?.[0];
      if (cand && Number.isFinite(Number(cand.location?.y)) && Number.isFinite(Number(cand.location?.x))) {
        return { lat: Number(cand.location.y), lon: Number(cand.location.x) };
      }
      return null;
    };

    const run = async () => {
      const [oHit, dHit] = await Promise.all([
        drvOriginStr ? quickGeocode(drvOriginStr) : Promise.resolve(null),
        quickGeocode(drvDestStr),
      ]);
      if (cancelled) return;
      const effO = oHit || (myCoords ? { lat: myCoords.lat, lon: myCoords.lon } : { lat: -6.22728, lon: 106.80816 });
      const effD = dHit || { lat: effO.lat - 0.018, lon: effO.lon + 0.022 };
      setDriverOriginCoords(effO);
      setDriverDestCoords(effD);

      let routeRes = await apiRequest(
        `/api/route?originLat=${encodeURIComponent(effO.lat)}&originLon=${encodeURIComponent(effO.lon)}&destLat=${encodeURIComponent(effD.lat)}&destLon=${encodeURIComponent(effD.lon)}`
      ).catch(() => null);

      if (!routeRes || routeRes.source === 'fallback') {
        const directUrls = [
          `https://routing.openstreetmap.de/routed-car/route/v1/driving/${effO.lon},${effO.lat};${effD.lon},${effD.lat}?overview=full&geometries=geojson`,
          `https://router.project-osrm.org/route/v1/driving/${effO.lon},${effO.lat};${effD.lon},${effD.lat}?overview=full&geometries=geojson`,
        ];
        for (const dUrl of directUrls) {
          try {
            const dr = await fetch(dUrl, { headers: { Accept: 'application/json' } });
            if (dr.ok) {
              const dd = await dr.json();
              const rt = dd?.routes?.[0];
              if (rt && typeof rt.distance === 'number' && typeof rt.duration === 'number') {
                const dKm = Math.max(0.2, Number((rt.distance / 1000).toFixed(1)));
                const dMin = Math.max(2, Math.round((rt.duration * 1.2) / 60));
                const etaDate = new Date(Date.now() + dMin * 60_000);
                const geom = Array.isArray(rt.geometry?.coordinates)
                  ? rt.geometry.coordinates
                      .filter((pt: any) => Array.isArray(pt) && pt.length >= 2)
                      .map((pt: any) => [Number(pt[1]), Number(pt[0])] as [number, number])
                  : undefined;
                if (geom && geom.length >= 2) {
                  routeRes = {
                    distanceKm: dKm,
                    durationMin: dMin,
                    etaIso: etaDate.toISOString(),
                    etaText: etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    geometry: geom,
                  };
                  break;
                }
              }
            }
          } catch {}
        }
      }

      if (cancelled) return;
      if (routeRes && routeRes.distanceKm > 0) {
        const etaDate = routeRes.etaIso ? new Date(routeRes.etaIso) : new Date(Date.now() + Number(routeRes.durationMin || 10) * 60_000);
        setDriverRoute({
          distanceKm: Number(routeRes.distanceKm || 0),
          durationMin: Number(routeRes.durationMin || 0),
          etaIso: routeRes.etaIso,
          etaText: etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          geometry: Array.isArray(routeRes.geometry) ? routeRes.geometry : undefined,
        });
      } else {
        const est = estimateRouteMetrics(drvOriginStr || 'Pickup', drvDestStr, effO, effD);
        const etaDate = new Date(Date.now() + est.durationMin * 60_000);
        setDriverRoute({
          distanceKm: est.distanceKm,
          durationMin: est.durationMin,
          etaIso: etaDate.toISOString(),
          etaText: etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          geometry: [
            [effO.lat, effO.lon],
            [(effO.lat + effD.lat) / 2, (effO.lon + effD.lon) / 2],
            [effD.lat, effD.lon],
          ],
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user, activeDriverDispatch?.trip_request_id, activeDriverDispatch?.origin, activeDriverDispatch?.destination]);

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
    const digits = regContactNumber.replace(/\D/g, '');
    if (digits.length < 8) {
      setAuthMessage({ type: 'error', text: t('WhatsApp / phone number is mandatory (at least 8 digits) for account recovery.') });
      return;
    }
    try {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          nickname: regNickname,
          department_id: regDeptId,
          group_username: regUsername,
          password: regPassword,
          contact_number: regContactNumber.trim(),
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
      setRegContactNumber('');
      setAuthMode('LOGIN');
    } catch (err: any) {
      setAuthMessage({ type: 'error', text: err.message });
    }
  };

  const handleOpenForgotPasswordModal = () => {
    setForgotUsername(loginUsername.trim());
    setForgotPhone('');
    setForgotNotes('');
    setForgotError(null);
    setForgotResult(null);
    setShowForgotPasswordModal(true);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    if (!forgotUsername.trim()) {
      setForgotError(t('Please enter your username.'));
      return;
    }
    if (forgotPhone.replace(/\D/g, '').length < 8) {
      setForgotError(t('Please enter a valid WhatsApp / mobile phone number (at least 8 digits).'));
      return;
    }
    setForgotSubmitting(true);
    try {
      const res = await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          group_username: forgotUsername.trim(),
          contact_number: forgotPhone.trim(),
          notes: forgotNotes.trim() || undefined,
        }),
      });
      setForgotResult({
        message: res.message || 'Password reset request sent to the Administrator.',
        admin_whatsapp_url: res.admin_whatsapp_url || FLEET_HELPDESK_WHATSAPP_URL,
        requestId: res.requestId,
      });
    } catch (err: any) {
      setForgotError(err.message || 'Unable to submit password reset request.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  const generateTempPassword = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const pick = (pool: string, n: number) =>
      Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]).join('');
    return `GF-${pick(letters, 3)}${pick(digits, 4)}`;
  };

  const handleOpenAdminResetModal = (target: { id: number; nickname: string; group_username: string; contact_number?: string }) => {
    setAdminResetTargetUser(target);
    setAdminResetNewPassword(generateTempPassword());
    setAdminResetShowPassword(true);
    setAdminResetError(null);
    setAdminResetResult(null);
    setAdminResetCopied(false);
  };

  const handleAdminResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminResetTargetUser) return;
    if (!adminResetNewPassword || adminResetNewPassword.length < 6) {
      setAdminResetError(t('New password must be at least 6 characters.'));
      return;
    }
    setAdminResetSubmitting(true);
    setAdminResetError(null);
    try {
      const res = await apiRequest(`/api/admin/users/${adminResetTargetUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: adminResetNewPassword }),
      });
      setAdminResetResult({
        message: res.message || 'Password has been reset.',
        temporary_password: res.temporary_password || adminResetNewPassword,
        whatsapp_url: res.whatsapp_url || null,
        user: res.user,
      });
      setStatusBanner({
        type: 'success',
        text: res.message || `Password reset for @${adminResetTargetUser.group_username}.`,
      });
      if (user) {
        await loadAllData(user);
      }
    } catch (err: any) {
      setAdminResetError(err.message || 'Failed to reset user password.');
    } finally {
      setAdminResetSubmitting(false);
    }
  };

  const handleDismissPasswordResetRequest = async (requestId: number) => {
    try {
      await apiRequest(`/api/admin/password-reset-requests/${requestId}/dismiss`, { method: 'POST' });
      setStatusBanner({ type: 'info', text: 'Password reset request dismissed.' });
      if (user) {
        await loadAllData(user);
      }
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message || 'Failed to dismiss request.' });
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

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileStatusBanner({ type: 'danger', text: 'Please select an image file (PNG, JPG, SVG).' });
      return;
    }
    const compressed = await compressImageFileToDataUrl(file, 900, 0.78);
    if (compressed) {
      setProfilePhotoUrl(compressed);
    }
  };

  const handleSaveProfileDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileNickname.trim() || profileNickname.trim().length < 2) {
      setProfileStatusBanner({ type: 'danger', text: 'Nickname must be at least 2 characters long.' });
      return;
    }
    if (profileContactNumber.replace(/\D/g, '').length < 8) {
      setProfileStatusBanner({ type: 'danger', text: t('WhatsApp / phone number is mandatory (at least 8 digits) for account recovery.') });
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

          // Only fill pickup/destination when the user explicitly taps "Current Location" (leave pickup blank by default)
          if (fillActiveField) {
            if (activeRouteField === 'pickup') {
              setBookOrigin(resolvedLabel);
              setOriginCoords({ lat, lon });
              setActiveRouteField('destination');
            } else {
              setBookDest(resolvedLabel);
              setDestCoords({ lat, lon });
            }
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

    // Ultra-low-latency trip & schedule sync helper (shared by SSE reconnect, focus/visibility, and fast fallback poller)
    let syncInFlight = false;
    const syncTripsAndSchedule = async () => {
      if (syncInFlight) return;
      syncInFlight = true;
      try {
        const [trpRes, bkgRes, calRes, vehRes] = await Promise.all([
          apiRequest('/api/trips'),
          apiRequest('/api/bookings'),
          apiRequest('/api/schedule/calendar').catch(() => ({ scheduleTrips: [], trips: [] })),
          apiRequest('/api/vehicles').catch(() => ({ vehicles: null })),
        ]);
        if (Array.isArray(trpRes.trips)) {
          setTrips(trpRes.trips);
        }
        if (Array.isArray(bkgRes.bookings)) {
          setBookings(bkgRes.bookings);
        }
        const calList = calRes.scheduleTrips || calRes.trips;
        if (Array.isArray(calList)) {
          setCalendarTrips(calList);
        }
        if (Array.isArray(vehRes?.vehicles)) {
          setVehicles(vehRes.vehicles);
        }
        if (['DRV', 'ADM', 'FM'].includes(user.role)) {
          const dspRes = await apiRequest('/api/driver/dispatches').catch(() => ({ dispatches: [] }));
          if (Array.isArray(dspRes.dispatches)) {
            setDispatches(dspRes.dispatches);
          }
        }
      } catch {
      } finally {
        syncInFlight = false;
      }
    };

    const upsertCalendarTrip = (trip: any) => {
      if (!trip || !trip.id) return;
      const st = String(trip.status || '').toUpperCase();
      const bSt = String(trip.booking_status || '').toUpperCase();
      const isInactive = ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(st) || ['COMPLETED', 'CANCELLED'].includes(bSt);
      setCalendarTrips((prev: any[]) => {
        if (isInactive) {
          return prev.filter((c: any) => Number(c.id) !== Number(trip.id));
        }
        const idx = prev.findIndex((c: any) => Number(c.id) === Number(trip.id));
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...trip };
          return next;
        }
        return [trip, ...prev];
      });
    };

    // Fast fallback poller (runs every 1.8s when tab is visible — guarantees low latency even if proxy buffers SSE)
    const syncInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncTripsAndSchedule();
      }
    }, 1800);

    // Real-time notification poller (delivers alerts to Driver, User, Admin, Head of WS Part, Fleet Operation PIC)
    const notifInterval = window.setInterval(async () => {
      try {
        const res = await apiRequest('/api/notifications');
        const list = applyLocalNegotiationDecisions(res.notifications || []);
        setNotifications((prev) => {
          const prevIds = new Set(prev.map((n: any) => n.id));
          const newItems = list.filter((n: any) => !prevIds.has(n.id) && !n.is_read);
          if (newItems.length > 0) {
            // Immediately sync trips and bookings when an alert arrives
            void syncTripsAndSchedule();
            for (const item of newItems) {
              triggerSystemNotification(item.title, { body: item.body });
            }
          }
          return list;
        });
      } catch {}
    }, 8 * 1000);

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

    // Ultra-low latency Real-Time Server-Sent Events (SSE) Stream (< 50ms push) with auto-reconnect
    let sseSource: EventSource | null = null;
    let sseReconnectTimer: number | null = null;
    let disposed = false;
    const authToken = getStoredToken();

    const connectSse = () => {
      if (disposed || !authToken || typeof EventSource === 'undefined') return;
      if (sseSource) {
        try {
          sseSource.close();
        } catch {}
        sseSource = null;
      }
      try {
        const streamUrl = `/api/live/stream?token=${encodeURIComponent(authToken)}`;
        const es = new EventSource(streamUrl);
        sseSource = es;

        es.onopen = () => {
          void syncTripsAndSchedule();
        };

        es.onerror = () => {
          if (disposed) return;
          if (es.readyState === EventSource.CLOSED && sseReconnectTimer === null) {
            sseReconnectTimer = window.setTimeout(() => {
              sseReconnectTimer = null;
              connectSse();
            }, 1500);
          }
        };

        es.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (!payload || !payload.type) return;

            if (payload.type === 'VEHICLE_UPDATED') {
              void syncTripsAndSchedule();
              return;
            }

            if (payload.type === 'SCHEDULE_UPDATED') {
              const schedTrip = payload.data?.trip;
              if (schedTrip && schedTrip.id) {
                upsertCalendarTrip(schedTrip);
              } else {
                void syncTripsAndSchedule();
              }
              return;
            }

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
                  const idx = prev.findIndex((t: any) => Number(t.id) === Number(trip.id));
                  if (idx >= 0) {
                    const nextList = [...prev];
                    nextList[idx] = { ...nextList[idx], ...trip };
                    return nextList;
                  }
                  return [trip, ...prev];
                });
                upsertCalendarTrip(trip);

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
            } else if (payload.type === 'DEPARTURE_REMINDER') {
              const rem = payload.data || {};
              playNotificationChime();
              triggerSystemNotification(rem.title || 'Departure Reminder', {
                body: rem.body || 'Your operational car departs soon. Please confirm boarding or board within 20 minutes to avoid auto-cancellation.',
              });
              setStatusBanner({
                type: 'warning',
                text: rem.body || 'Reminder: Your operational car is ready. Please tap "I Am Here / Confirm Boarding" or board within 20 minutes of departure.',
              });
              void syncTripsAndSchedule();
            } else if (payload.type === 'NOTIFICATION') {
              const notif = payload.data;
              if (notif && notif.id) {
                setNotifications((prev: any[]) => {
                  if (prev.some((n: any) => Number(n.id) === Number(notif.id))) return prev;
                  return [notif, ...prev];
                });
                playNotificationChime();
                triggerSystemNotification(notif.title, { body: notif.body });
                apiRequest('/api/notifications')
                  .then((nr) => {
                    if (Array.isArray(nr?.notifications)) setNotifications(applyLocalNegotiationDecisions(nr.notifications));
                  })
                  .catch(() => {});
                void syncTripsAndSchedule();
              }
            }
          } catch {}
        };
      } catch {}
    };

    connectSse();

    const handleResumeSync = () => {
      if (document.visibilityState === 'visible') {
        void syncTripsAndSchedule();
        if (!sseSource || sseSource.readyState === EventSource.CLOSED) {
          connectSse();
        }
      }
    };
    document.addEventListener('visibilitychange', handleResumeSync);
    window.addEventListener('focus', handleResumeSync);
    window.addEventListener('online', handleResumeSync);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleResumeSync);
      window.removeEventListener('focus', handleResumeSync);
      window.removeEventListener('online', handleResumeSync);
      if (sseReconnectTimer !== null) window.clearTimeout(sseReconnectTimer);
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
    const etaMin = Number(calculatedRoute?.durationMin || 0);
    const eMs =
      !userEditedBookEndRef.current && bookReservationType === 'ONE_WAY' && etaMin > 0
        ? computeEtaReturnMs(d.getTime(), etaMin)
        : d.getTime() + bookDurationHours * 3600000;
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
    const etaMin = Number(calculatedRoute?.durationMin || 0);
    const eMs =
      !userEditedBookEndRef.current && bookReservationType === 'ONE_WAY' && etaMin > 0
        ? computeEtaReturnMs(targetD.getTime(), etaMin)
        : targetD.getTime() + bookDurationHours * 3600000;
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

  const _handleDoneSummaryPicker = () => {
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
  void _handleDoneSummaryPicker;

  const handleCreateTripBooking = async (_confirmed?: boolean | React.MouseEvent) => {
    setStatusBanner(null);
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
        setStatusBanner({ type: 'danger', text: 'Please select a post-event pick-up time for Round Trip bookings.' });
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
        text: 'Tujuan perjalanan (Trip Purpose) wajib diisi. Silakan pilih atau ketik tujuan perjalanan Anda sebelum memesan.',
      });
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
      return;
    }

    const effectivePurpose = bookPurpose.trim();
    setShowPreBookingConfirmModal(false);

    const startIso = new Date(bookStart).toISOString();
    const endIso = new Date(bookEnd).toISOString();

    const formattedPaxNickname =
      cleanPassengers.length > 0
        ? cleanPassengers.map((p) => `${p.id}. ${p.nickname}`).join(', ')
        : bookPassengerNickname.trim();

    const reqPax = Math.max(1, cleanPassengers.length || Number(bookPax));

    const pickAutoAvailableVehicleId = (pool: any[]): number | null => {
      const avail = (pool || []).filter((v: any) => v.status === 'Available' && v.isAvailable !== false);
      if (avail.length === 0) return null;
      const enoughSeats = avail.find((v: any) => Number(v.seats || 4) >= reqPax);
      return Number((enoughSeats || avail[0]).id);
    };

    try {
      let autoVehicleId = pickAutoAvailableVehicleId(liveAvailability?.vehicles || []);
      if (!autoVehicleId) {
        const freshAvail = await apiRequest(
          `/api/availability?start_time=${encodeURIComponent(startIso)}&end_time=${encodeURIComponent(endIso)}`
        ).catch(() => null);
        if (freshAvail?.vehicles) {
          setLiveAvailability(freshAvail);
          autoVehicleId = pickAutoAvailableVehicleId(freshAvail.vehicles);
        }
      }
      if (!autoVehicleId) {
        const fallbackCar = vehicles.find((v: any) => v.status === 'Available') || vehicles[0];
        if (fallbackCar?.id) {
          autoVehicleId = Number(fallbackCar.id);
        }
      }

      if (!autoVehicleId) {
        setStatusBanner({
          type: 'danger',
          text: 'No available vehicles are currently registered in the fleet. Please contact Fleet Manager.',
        });
        return;
      }

      const buildPayload = (vehId: number) =>
        JSON.stringify({
          vehicle_id: vehId,
          auto_assign: true,
          preferred_driver_id: null,
          purpose: effectivePurpose,
          origin: bookOrigin.trim(),
          destination: bookDest.trim(),
          start_time: startIso,
          end_time: endIso,
          reservation_type: bookReservationType,
          return_pickup_time: returnPickupIso,
          passenger_count: reqPax,
          passenger_nickname: formattedPaxNickname,
          passengers: cleanPassengers,
          notes: bookNotes || effectivePurpose,
          is_urgent: 0,
          urgent_reason: effectivePurpose,
        });

      let created: any;
      try {
        created = await apiRequest('/api/trips', {
          method: 'POST',
          body: buildPayload(autoVehicleId),
        });
      } catch (firstErr: any) {
        const msg = String(firstErr?.message || '').toLowerCase();
        // If another user booked that car concurrently on an older server worker, refresh availability and retry with the next free car
        if (msg.includes('conflict') || msg.includes('booked') || msg.includes('already') || msg.includes('409')) {
          const retryAvail = await apiRequest(
            `/api/availability?start_time=${encodeURIComponent(startIso)}&end_time=${encodeURIComponent(endIso)}`
          ).catch(() => null);
          const nextFree = (retryAvail?.vehicles || []).find(
            (v: any) => v.status === 'Available' && v.isAvailable !== false && Number(v.id) !== autoVehicleId
          );
          if (nextFree?.id) {
            created = await apiRequest('/api/trips', {
              method: 'POST',
              body: buildPayload(Number(nextFree.id)),
            });
          } else {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }
      setBookPurpose('');
      setBookPassengerNickname('');
      setBookPassengers([{ id: 1, nickname: '' }]);
      setBookPax(1);
      setBookNotes('');
      setBookUrgentReason('');
      setBookReservationType('ONE_WAY');
      userEditedBookEndRef.current = false;
      setBookEndAutoEtaMin(null);
      const nextDefaultMs = roundUpTo5MinMs(Date.now() + 2 * 3600000);
      setBookStart(toLocalDateTimeInput(new Date(nextDefaultMs)));
      setBookEnd(toLocalDateTimeInput(new Date(nextDefaultMs + 2 * 3600000)));
      setFocusedTripId(created.tripId);
      setBookingStep('WAITING');
      setSheetSnap('half');
      setStatusBanner({
        type: 'success',
        text: 'Request sent! Awaiting Fleet Manager approval & car assignment.',
      });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleCancelBookingRequest = async (trip: any) => {
    const tripId = Number(trip?.trip_request_id || trip?.id || 0);
    let bookingId = Number(
      trip?.booking_id ||
        bookings.find((b) => Number(b.trip_request_id) === tripId && b.status !== 'CANCELLED')?.id ||
        0
    );

    if (!tripId && !bookingId) {
      setBookingStep('HOME');
      setSheetSnap('half');
      return;
    }

    const cancelReason = 'Cancelled by requester (plan changed)';
    try {
      let cancelledOk = false;
      if (tripId > 0) {
        try {
          await apiRequest(`/api/trips/${tripId}/cancel`, {
            method: 'POST',
            body: JSON.stringify({
              reason: cancelReason,
              cancellation_reason: cancelReason,
            }),
          });
          cancelledOk = true;
        } catch (primaryErr: any) {
          const msg = String(primaryErr?.message || '').toLowerCase();
          const isRouteNotFound = msg.includes('not found') || msg.includes('404');
          if (!isRouteNotFound) {
            throw primaryErr;
          }
          // Fallback for proxies/rolling restarts: resolve linked booking ID and cancel via PATCH /api/bookings/:id
          if (!bookingId) {
            const bkgRes = await apiRequest('/api/bookings').catch(() => ({ bookings: [] }));
            const matchedBkg = (bkgRes?.bookings || []).find(
              (b: any) => Number(b.trip_request_id) === tripId && b.status !== 'CANCELLED'
            );
            if (matchedBkg?.id) {
              bookingId = Number(matchedBkg.id);
            }
          }
          if (bookingId > 0) {
            await apiRequest(`/api/bookings/${bookingId}`, {
              method: 'PATCH',
              body: JSON.stringify({
                status: 'CANCELLED',
                cancellation_reason: cancelReason,
              }),
            });
            cancelledOk = true;
          } else {
            await apiRequest(`/api/trips/${tripId}`, {
              method: 'DELETE',
              body: JSON.stringify({
                reason: cancelReason,
                cancellation_reason: cancelReason,
              }),
            });
            cancelledOk = true;
          }
        }
      } else if (bookingId > 0) {
        await apiRequest(`/api/bookings/${bookingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'CANCELLED',
            cancellation_reason: cancelReason,
          }),
        });
        cancelledOk = true;
      }

      if (cancelledOk) {
        setFocusedTripId(null);
        setBookingStep('HOME');
        setSheetSnap('half');
        setStatusBanner({ type: 'info', text: t('Booking cancelled and vehicle/driver slot released.') });
        await loadAllData(user);
      }
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleConfirmPassengerBoarding = async (trip: any) => {
    if (!trip?.id) return;
    try {
      await apiRequest(`/api/trips/${trip.id}/confirm-boarding`, {
        method: 'POST',
      });
      setStatusBanner({
        type: 'success',
        text: t('Boarding confirmed! Auto-cancellation timer stopped and driver notified.'),
      });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleSubmitNegotiation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!negotiationModalTrip?.id || negotiationSubmitting) return;
    const rawNames = [negotiationPassengerNickname || user?.nickname || '', ...negotiationExtraPassengers]
      .map((s) => String(s || '').trim())
      .filter(Boolean);
    const seenLower = new Set<string>();
    const uniquePax: string[] = [];
    for (const n of rawNames) {
      const k = n.toLowerCase();
      if (!seenLower.has(k)) {
        seenLower.add(k);
        uniquePax.push(n);
      }
    }
    if (negotiationActionType === 'HITCHHIKE' && uniquePax.length === 0) {
      setStatusBanner({ type: 'danger', text: t('Please enter your passenger nickname to hitchhike.') });
      return;
    }
    const matchedVehForSubmit = vehicles.find((v) => Number(v.id) === Number(negotiationModalTrip.vehicle_id));
    const maxSeatsForSubmit = Number(matchedVehForSubmit?.seats || negotiationModalTrip.seats || 5);
    const existingPaxCountForSubmit =
      extractIndividualPassengers(negotiationModalTrip.passengers_json, negotiationModalTrip.passenger_nickname).length ||
      Number(negotiationModalTrip.passenger_count || 1);
    const maxAllowedPax =
      negotiationActionType === 'HITCHHIKE'
        ? Math.max(0, maxSeatsForSubmit - existingPaxCountForSubmit)
        : maxSeatsForSubmit;
    if (uniquePax.length > maxAllowedPax) {
      setStatusBanner({
        type: 'danger',
        text: `${t('Passenger count exceeds this car seat capacity.')} (${maxAllowedPax} ${t('seats')})`,
      });
      return;
    }
    const resolvedOrigin =
      negotiationActionType === 'REQUEST_CANCEL'
        ? (negotiationLocationMode === 'DIFFERENT' ? negotiationOrigin.trim() : String(negotiationModalTrip.origin || '').trim()) || String(negotiationModalTrip.origin || '').trim()
        : undefined;
    const resolvedDestination =
      negotiationActionType === 'REQUEST_CANCEL'
        ? (negotiationLocationMode === 'DIFFERENT' ? negotiationDestination.trim() : String(negotiationModalTrip.destination || '').trim())
        : undefined;
    if (negotiationActionType === 'REQUEST_CANCEL' && negotiationLocationMode === 'DIFFERENT' && (!negotiationOrigin.trim() || !negotiationDestination.trim())) {
      setStatusBanner({ type: 'danger', text: t('Please enter both your Pickup Location and Destination for the transferred car slot.') });
      return;
    }
    setNegotiationSubmitting(true);
    try {
      const targetTripId = Number(negotiationModalTrip.trip_request_id || negotiationModalTrip.id);
      const negPayload = {
        trip_id: targetTripId,
        booking_id: negotiationModalTrip.booking_id ? Number(negotiationModalTrip.booking_id) : undefined,
        action_type: negotiationActionType,
        passenger_nickname: uniquePax.join(', ') || user?.nickname || 'Colleague',
        passengers: uniquePax.length > 0 ? uniquePax : [user?.nickname || 'Colleague'],
        ...(negotiationActionType === 'REQUEST_CANCEL'
          ? {
              origin: resolvedOrigin,
              destination: resolvedDestination || negotiationModalTrip.destination,
              purpose: negotiationPurpose.trim() || undefined,
            }
          : {}),
        message: negotiationNote.trim(),
        note: negotiationNote.trim(),
      };
      let res: any;
      try {
        res = await apiRequest(`/api/trips/${targetTripId}/negotiate`, {
          method: 'POST',
          body: JSON.stringify(negPayload),
        });
      } catch (firstErr: any) {
        if (/api endpoint not found/i.test(String(firstErr?.message || ''))) {
          res = await apiRequest('/api/trips/negotiate', {
            method: 'POST',
            body: JSON.stringify(negPayload),
          });
        } else {
          throw firstErr;
        }
      }
      const rawSuccessMsg =
        res.message || `Request sent to ${negotiationModalTrip.requester_name || 'booking holder'} (${negotiationModalTrip.department_name || 'Group'}).`;
      setStatusBanner({
        type: 'success',
        text: translateNotificationText(rawSuccessMsg, lang),
      });
      setNegotiationModalTrip(null);
      setNegotiationNote('');
      setNegotiationExtraPassengers([]);
      setNegotiationLocationMode('SAME');
      setNegotiationOrigin('');
      setNegotiationDestination('');
      setNegotiationPurpose('');
      await loadAllData(user);
    } catch (err: any) {
      const errMsg = String(err?.message || 'Request failed');
      const friendlyMsg = /api endpoint not found/i.test(errMsg)
        ? t('Server backend is still running an older process. Please click Stop then Start (or Restart) in cPanel Setup Node.js App, then try again.')
        : translateNotificationText(errMsg, lang);
      setStatusBanner({ type: 'danger', text: friendlyMsg });
    } finally {
      setNegotiationSubmitting(false);
    }
  };

  const handleAcceptHitchhike = async (tripId: number, passengerNickname: string, requesterUserId?: number, notificationId?: number) => {
    const lockKey = notificationId ? `notif-${notificationId}` : `trip-${tripId}-${passengerNickname.toLowerCase()}`;
    if (respondingNegIdsRef.current.has(lockKey)) return;
    respondingNegIdsRef.current.add(lockKey);
    if (notificationId) {
      decidedNegMapRef.current.set(`notif-${notificationId}`, { status: 'ACCEPTED' });
      setNegotiationRespondBusyId(notificationId);
      setNotifications((prev: any[]) =>
        prev.map((item) => (Number(item.id) === Number(notificationId) ? { ...item, is_read: 1, negotiation_status: 'ACCEPTED' } : item))
      );
    }
    try {
      const res = await apiRequest(`/api/trips/${tripId}/hitchhike-accept`, {
        method: 'POST',
        body: JSON.stringify({
          passenger_nickname: passengerNickname,
          requester_user_id: requesterUserId,
          notification_id: notificationId,
        }),
      });
      setStatusBanner({
        type: 'success',
        text: `Hitchhike accepted! ${Array.isArray(res.addedPassengers) ? res.addedPassengers.join(', ') : passengerNickname} added to Trip #${tripId}.`,
      });
      await loadAllData(user);
    } catch (err: any) {
      if (!/already/i.test(String(err.message || ''))) {
        respondingNegIdsRef.current.delete(lockKey);
        if (notificationId) {
          decidedNegMapRef.current.delete(`notif-${notificationId}`);
          setNotifications((prev: any[]) =>
            prev.map((item) => (Number(item.id) === Number(notificationId) ? { ...item, negotiation_status: null } : item))
          );
        }
      }
      setStatusBanner({ type: 'danger', text: err.message });
    } finally {
      if (notificationId) setNegotiationRespondBusyId(null);
    }
  };

  const handleOpenNotification = (notif: any) => {
    setSelectedNotification({ ...notif, is_read: 1 });
    if (!notif.is_read) {
      setNotifications((prev: any[]) => prev.map((item) => (Number(item.id) === Number(notif.id) ? { ...item, is_read: 1 } : item)));
      void apiRequest(`/api/notifications/${notif.id}/read`, { method: 'POST' }).catch(() => {});
    }
  };

  const handleRespondNegotiation = async (notif: any, decision: 'ACCEPT' | 'REJECT') => {
    const negId = notif?.negotiation_id ? Number(notif.negotiation_id) : 0;
    const notifId = notif?.id ? Number(notif.id) : 0;
    if (!negId && !notifId) return;
    const busyId = negId || notifId;
    const lockKey = negId ? `neg-${negId}` : `notif-${notifId}`;
    if (
      respondingNegIdsRef.current.has(lockKey) ||
      decidedNegMapRef.current.has(lockKey) ||
      (notifId && decidedNegMapRef.current.has(`notif-${notifId}`)) ||
      negotiationRespondBusyId === busyId
    ) {
      return;
    }
    const nextStatus: 'ACCEPTED' | 'REJECTED' = decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    respondingNegIdsRef.current.add(lockKey);
    decidedNegMapRef.current.set(lockKey, { status: nextStatus });
    if (notifId) decidedNegMapRef.current.set(`notif-${notifId}`, { status: nextStatus });
    setNegotiationRespondBusyId(busyId);
    const matchesTarget = (item: any) =>
      Boolean(item) &&
      ((negId > 0 && Number(item.negotiation_id) === negId) || (notifId > 0 && Number(item.id) === notifId));

    // 0ms optimistic lock: immediately hide Accept/Reject buttons so 2nd click is physically impossible
    setNotifications((prev: any[]) =>
      prev.map((item) => (matchesTarget(item) ? { ...item, is_read: 1, negotiation_status: nextStatus } : item))
    );
    setSelectedNotification((prev: any) =>
      matchesTarget(prev) ? { ...prev, is_read: 1, negotiation_status: nextStatus } : prev
    );
    try {
      let targetNegId = negId;
      if (!targetNegId && notifId) {
        try {
          const fresh = await apiRequest('/api/notifications');
          const matched = (fresh?.notifications || []).find((item: any) => Number(item.id) === notifId);
          if (matched?.negotiation_id) {
            targetNegId = Number(matched.negotiation_id);
          }
        } catch {}
      }
      const endpoint = targetNegId
        ? `/api/negotiations/${targetNegId}/respond`
        : `/api/notifications/${notifId}/respond-negotiation`;
      let res: any;
      try {
        res = await apiRequest(endpoint, {
          method: 'POST',
          body: JSON.stringify({ decision, negotiation_id: targetNegId || undefined, notification_id: notifId || undefined }),
        });
      } catch (firstErr: any) {
        const firstMsg = String(firstErr?.message || '');
        if (/api endpoint not found|negotiation request not found/i.test(firstMsg) && notifId) {
          res = await apiRequest('/api/negotiations/respond', {
            method: 'POST',
            body: JSON.stringify({ decision, negotiation_id: targetNegId || undefined, notification_id: notifId }),
          });
        } else {
          throw firstErr;
        }
      }
      const transferredId = res?.transferredTripId || null;
      const resolvedNegId = res?.negotiationId ? Number(res.negotiationId) : targetNegId;
      decidedNegMapRef.current.set(lockKey, { status: nextStatus, transferredTripId: transferredId });
      if (resolvedNegId) decidedNegMapRef.current.set(`neg-${resolvedNegId}`, { status: nextStatus, transferredTripId: transferredId });
      if (notifId) decidedNegMapRef.current.set(`notif-${notifId}`, { status: nextStatus, transferredTripId: transferredId });
      setNotifications((prev: any[]) =>
        prev.map((item) =>
          matchesTarget(item)
            ? {
                ...item,
                is_read: 1,
                negotiation_id: resolvedNegId || item.negotiation_id,
                negotiation_status: nextStatus,
                negotiation_transferred_trip_id: transferredId ?? item.negotiation_transferred_trip_id,
              }
            : item
        )
      );
      setSelectedNotification((prev: any) =>
        matchesTarget(prev)
          ? {
              ...prev,
              is_read: 1,
              negotiation_id: resolvedNegId || prev.negotiation_id,
              negotiation_status: nextStatus,
              negotiation_transferred_trip_id: transferredId ?? prev.negotiation_transferred_trip_id,
            }
          : prev
      );
      const isHitchhike =
        notif.negotiation_action_type === 'HITCHHIKE' ||
        notif.trigger_type === 'NEGOTIATE_HITCHHIKE_REQUEST' ||
        notif.trigger_type === 'HITCHHIKE_REQUEST' ||
        /schedule negotiation.*hitchhike/i.test(String(notif.title || ''));
      if (decision === 'ACCEPT') {
        setStatusBanner({
          type: 'success',
          text: isHitchhike
            ? t('Hitchhike accepted! Passenger added to your booking.')
            : `${t('Cancellation accepted! Booking cancelled and transferred to requester')}${transferredId ? ` (#${transferredId})` : ''}.`,
        });
      } else {
        setStatusBanner({
          type: 'info',
          text: isHitchhike ? t('Hitchhike request rejected.') : t('Cancellation request rejected. Your booking remains active.'),
        });
      }
      await loadAllData(user);
    } catch (err: any) {
      const errMsg = String(err?.message || 'Request failed');
      if (!/already/i.test(errMsg)) {
        respondingNegIdsRef.current.delete(lockKey);
        decidedNegMapRef.current.delete(lockKey);
        if (notifId) decidedNegMapRef.current.delete(`notif-${notifId}`);
        setNotifications((prev: any[]) =>
          prev.map((item) => (matchesTarget(item) ? { ...item, negotiation_status: 'PENDING' } : item))
        );
        setSelectedNotification((prev: any) =>
          matchesTarget(prev) ? { ...prev, negotiation_status: 'PENDING' } : prev
        );
      }
      const friendlyMsg = /^api endpoint not found$/i.test(errMsg.trim())
        ? t('Server backend is still running an older process. Please click Stop then Start (or Restart) in cPanel Setup Node.js App, then try again.')
        : translateNotificationText(errMsg, lang);
      setStatusBanner({ type: 'danger', text: friendlyMsg });
    } finally {
      setNegotiationRespondBusyId(null);
    }
  };

  const handleSubmitReportApproval = async (reportId: number, decision: 'APPROVED' | 'REJECTED') => {
    if (!user || (user.role !== 'FM' && user.role !== 'HWS')) return;
    setReportApprovalSubmitting(true);
    try {
      const res = await apiRequest(`/api/reports/approvals/${reportId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes: reportApprovalNotes.trim() }),
      });
      if (reportApprovalPopup?.period_key) {
        reportApprovalSnoozedRef.current[String(reportApprovalPopup.period_key)] = true;
      }
      setReportApprovalPopup(null);
      setReportApprovalNotes('');
      setStatusBanner({
        type: decision === 'APPROVED' ? 'success' : 'info',
        text: `Summary report digitally ${decision.toLowerCase()} by ${user.role === 'FM' ? 'Fleet Manager' : 'Head of WS'} (Stamp: ${res.signatureHash}).`,
      });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message || 'Unable to submit digital report approval.' });
    } finally {
      setReportApprovalSubmitting(false);
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

  // Keep dispatchModalTrip automatically synced with the latest trip record in trips
  useEffect(() => {
    if (!dispatchModalTrip) return;
    const latest = trips.find((t: any) => Number(t.id) === Number(dispatchModalTrip.id));
    if (!latest) return;
    if (
      latest.status !== dispatchModalTrip.status ||
      Boolean(latest.pic_approved) !== Boolean(dispatchModalTrip.pic_approved) ||
      Boolean(latest.hws_approved) !== Boolean(dispatchModalTrip.hws_approved) ||
      latest.driver_profile_id !== dispatchModalTrip.driver_profile_id ||
      latest.vehicle_id !== dispatchModalTrip.vehicle_id
    ) {
      setDispatchModalTrip((prev: any) => (prev && Number(prev.id) === Number(latest.id) ? { ...prev, ...latest } : prev));
    }
  }, [trips, dispatchModalTrip]);

  const handleAdminTripDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!dispatchModalTrip) return;
    const targetTripId = Number(dispatchModalTrip.id);
    const allCarsPool = dispatchAvailability?.vehicles?.length ? dispatchAvailability.vehicles : vehicles;
    const allDriversPool = dispatchAvailability?.drivers?.length ? dispatchAvailability.drivers : drivers;
    const availCarsForTrip = allCarsPool.filter(
      (v: any) => v.status === 'Available' && v.isAvailable !== false
    );
    const chosenDriverNum = dispatchDriverId ? Number(dispatchDriverId) : Number(dispatchModalTrip.driver_profile_id || 0) || null;
    // 1 Driver = 1 Fixed Car: always resolve the car fixed to the chosen driver
    const fixedCarForDriver = chosenDriverNum
      ? availCarsForTrip.find((v: any) => Number(v.default_driver_id) === chosenDriverNum) ||
        allCarsPool.find((v: any) => Number(v.default_driver_id) === chosenDriverNum)
      : null;
    const chosenVehicleId = Number(fixedCarForDriver?.id || dispatchVehicleId || dispatchModalTrip.vehicle_id || 0);
    const chosenDriverObj = chosenDriverNum
      ? allDriversPool.find((d: any) => Number(d.id) === chosenDriverNum)
      : null;

    if (decision === 'APPROVED' && !dispatchModalTrip.pic_approved) {
      if (availCarsForTrip.length === 0) {
        setStatusBanner({ type: 'danger', text: t('No available driver/vehicle pairs for this time slot. Cannot approve.') });
        return;
      }
      if (!chosenVehicleId || !availCarsForTrip.some((v: any) => Number(v.id) === chosenVehicleId)) {
        setStatusBanner({ type: 'danger', text: t('Please select an available driver (with an available fixed car) before approving.') });
        return;
      }
    }

    // 0ms Instant Optimistic Lock: immediately lock trip in both trips list and open modal before network round-trip completes
    const previousTripSnapshot = { ...dispatchModalTrip };
    if (decision === 'APPROVED') {
      const isDual = Boolean(dispatchModalTrip.requires_dual_approval);
      const nextPicApproved = user.role === 'FM' ? true : Boolean(dispatchModalTrip.pic_approved);
      const nextHwsApproved = user.role === 'HWS' ? true : Boolean(dispatchModalTrip.hws_approved);
      const nextFinalStatus =
        user.role === 'ADM' || !isDual || (nextPicApproved && nextHwsApproved) ? 'APPROVED' : 'PENDING_APPROVAL';
      const optimisticPatch: Record<string, any> = {
        status: nextFinalStatus,
        pic_approved: nextPicApproved,
        hws_approved: nextHwsApproved,
        driver_profile_id: chosenDriverNum || dispatchModalTrip.driver_profile_id,
        assigned_driver_name: chosenDriverObj?.full_name || dispatchModalTrip.assigned_driver_name,
        vehicle_id: chosenVehicleId || dispatchModalTrip.vehicle_id,
        registration_plate: fixedCarForDriver?.registration_plate || dispatchModalTrip.registration_plate,
        make: fixedCarForDriver?.make || dispatchModalTrip.make,
        model: fixedCarForDriver?.model || dispatchModalTrip.model,
        energy_type: fixedCarForDriver?.energy_type || dispatchModalTrip.energy_type,
      };
      setTrips((prev: any[]) =>
        prev.map((tr: any) => (Number(tr.id) === targetTripId ? { ...tr, ...optimisticPatch } : tr))
      );
      setDispatchModalTrip((prev: any) =>
        prev && Number(prev.id) === targetTripId ? { ...prev, ...optimisticPatch } : prev
      );
    }

    try {
      const res = await apiRequest(`/api/trips/${targetTripId}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          reason: dispatchDecisionReason || (decision === 'APPROVED' ? `Approved by ${user.role}` : ''),
          vehicle_id: chosenVehicleId || Number(dispatchModalTrip.vehicle_id),
          driver_profile_id: chosenDriverNum,
          enforce_fixed_driver_car: Boolean(chosenDriverNum),
        }),
      });
      setDispatchDecisionReason('');

      if (res?.trip) {
        const serverTrip = {
          ...res.trip,
          pic_approved: Boolean(res.trip.pic_approved),
          hws_approved: Boolean(res.trip.hws_approved),
        };
        setTrips((prev: any[]) =>
          prev.map((tr: any) => (Number(tr.id) === targetTripId ? { ...tr, ...serverTrip } : tr))
        );
        setDispatchModalTrip((prev: any) =>
          prev && Number(prev.id) === targetTripId ? { ...prev, ...serverTrip } : prev
        );
      }

      if (decision === 'REJECTED') {
        setDispatchModalTrip(null);
      }

      if (res.status === 'PENDING_APPROVAL') {
        setStatusBanner({
          type: 'success',
          text: `Trip #${targetTripId} approved by ${user.role === 'FM' ? 'Fleet Operation PIC' : 'Head Of WS Part'}! Locked and awaiting second approval.`,
        });
      } else {
        setStatusBanner({
          type: 'success',
          text:
            decision === 'APPROVED'
              ? `Trip #${targetTripId} fully approved and dispatched!`
              : `Trip #${targetTripId} rejected and vehicle schedule slot released.`,
        });
      }

      // Refresh trips & bookings immediately in background without blocking the locked UI
      void apiRequest('/api/trips')
        .then((trpRes) => {
          if (Array.isArray(trpRes?.trips)) setTrips(trpRes.trips);
        })
        .catch(() => {});
      void loadAllData(user);
    } catch (err: any) {
      // Revert optimistic state on error
      setTrips((prev: any[]) =>
        prev.map((tr: any) => (Number(tr.id) === targetTripId ? previousTripSnapshot : tr))
      );
      setDispatchModalTrip((prev: any) =>
        prev && Number(prev.id) === targetTripId ? previousTripSnapshot : prev
      );
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
        seats: '5',
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

  // Authoritative cross-account active schedule list merging /api/schedule/calendar, /api/trips, and /api/bookings
  // Guarantees every employee (e.g. Tito) immediately sees bookings made by any other employee (e.g. Hafi)
  const allActiveScheduleTrips = useMemo(() => {
    const mergedById = new Map<number, any>();
    for (const b of bookings) {
      const bSt = String(b.status || '').toUpperCase();
      const tSt = String(b.trip_status || '').toUpperCase();
      if (['CANCELLED', 'COMPLETED'].includes(bSt)) continue;
      if (['CANCELLED', 'COMPLETED', 'REJECTED'].includes(tSt)) continue;
      const syntheticId = b.trip_request_id ? Number(b.trip_request_id) : -100000 - Number(b.id);
      const normStatus = tSt || (bSt === 'ACTIVE' ? 'APPROVED' : bSt || 'PENDING_APPROVAL');
      mergedById.set(syntheticId, {
        id: syntheticId,
        trip_request_id: b.trip_request_id ? Number(b.trip_request_id) : null,
        booking_id: Number(b.id),
        booking_status: b.status,
        vehicle_id: b.vehicle_id,
        requester_id: b.booked_by,
        requester_name: b.booked_by_name || 'Colleague',
        requester_username: b.requester_username || '',
        requester_contact: b.requester_contact || '',
        department_name: b.department_name || 'Group',
        registration_plate: b.registration_plate || '',
        make: b.make || '',
        model: b.model || '',
        car_type: b.car_type || '',
        energy_type: b.energy_type || '',
        seats: Number(vehicles.find((v) => Number(v.id) === Number(b.vehicle_id))?.seats || b.seats || 5),
        origin: b.origin || '',
        destination: b.destination || b.purpose || 'Operational Trip',
        purpose: b.purpose || '',
        start_time: b.start_time,
        end_time: b.end_time,
        passenger_nickname: b.passenger_nickname || b.booked_by_name || '',
        passengers_json: b.passengers_json || null,
        passenger_count: b.passenger_count || 1,
        reservation_type: b.reservation_type || 'ONE_WAY',
        return_pickup_time: b.return_pickup_time || null,
        driver_profile_id: b.driver_profile_id || null,
        assigned_driver_name: b.driver_name || 'Pool Driver',
        assigned_driver_phone: b.assigned_driver_phone || '',
        status: normStatus,
      });
    }
    for (const ct of calendarTrips) {
      const id = Number(ct.id);
      const prev = mergedById.get(id);
      mergedById.set(id, prev ? { ...prev, ...ct } : ct);
    }
    for (const tr of trips) {
      const id = Number(tr.id);
      const st = String(tr.status || '').toUpperCase();
      const bSt = String(tr.booking_status || '').toUpperCase();
      if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(st) || ['COMPLETED', 'CANCELLED'].includes(bSt)) {
        mergedById.delete(id);
        continue;
      }
      const prev = mergedById.get(id);
      mergedById.set(id, prev ? { ...prev, ...tr } : tr);
    }
    return Array.from(mergedById.values()).filter((tr) => {
      const st = String(tr.status || '').toUpperCase();
      const bSt = String(tr.booking_status || '').toUpperCase();
      return ['PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS'].includes(st) && !['CANCELLED', 'COMPLETED'].includes(bSt);
    });
  }, [calendarTrips, trips, bookings]);

  // Complete calendar schedule including active AND finished/cancelled/rejected/transferred trips for usage audit
  const allCalendarAuditTrips = useMemo(() => {
    const mergedById = new Map<number, any>();
    for (const b of bookings) {
      const bSt = String(b.status || '').toUpperCase();
      const tSt = String(b.trip_status || '').toUpperCase();
      const syntheticId = b.trip_request_id ? Number(b.trip_request_id) : -100000 - Number(b.id);
      const normStatus = tSt || (bSt === 'ACTIVE' ? 'APPROVED' : bSt || 'PENDING_APPROVAL');
      mergedById.set(syntheticId, {
        id: syntheticId,
        trip_request_id: b.trip_request_id ? Number(b.trip_request_id) : null,
        booking_id: Number(b.id),
        booking_status: b.status,
        cancellation_reason: b.cancellation_reason || null,
        vehicle_id: b.vehicle_id,
        requester_id: b.booked_by,
        requester_name: b.booked_by_name || 'Colleague',
        requester_username: b.requester_username || '',
        requester_contact: b.requester_contact || '',
        department_name: b.department_name || 'Group',
        registration_plate: b.registration_plate || '',
        make: b.make || '',
        model: b.model || '',
        car_type: b.car_type || '',
        energy_type: b.energy_type || '',
        seats: Number(vehicles.find((v) => Number(v.id) === Number(b.vehicle_id))?.seats || b.seats || 5),
        origin: b.origin || '',
        destination: b.destination || b.purpose || 'Operational Trip',
        purpose: b.purpose || '',
        start_time: b.start_time,
        end_time: b.end_time,
        passenger_nickname: b.passenger_nickname || b.booked_by_name || '',
        passengers_json: b.passengers_json || null,
        passenger_count: b.passenger_count || 1,
        reservation_type: b.reservation_type || 'ONE_WAY',
        return_pickup_time: b.return_pickup_time || null,
        driver_profile_id: b.driver_profile_id || null,
        assigned_driver_name: b.driver_name || 'Pool Driver',
        assigned_driver_phone: b.assigned_driver_phone || '',
        status: normStatus,
      });
    }
    for (const ct of calendarTrips) {
      const id = Number(ct.id);
      const prev = mergedById.get(id);
      mergedById.set(id, prev ? { ...prev, ...ct } : ct);
    }
    for (const rec of scheduleAuditRecords) {
      const id = Number(rec.id);
      const prev = mergedById.get(id);
      mergedById.set(id, prev ? { ...prev, ...rec } : rec);
    }
    for (const tr of trips) {
      const id = Number(tr.id);
      const prev = mergedById.get(id);
      mergedById.set(id, prev ? { ...prev, ...tr } : tr);
    }
    return Array.from(mergedById.values());
  }, [calendarTrips, trips, bookings, scheduleAuditRecords, vehicles]);

  // Live car availability count: total Available fleet vehicles minus vehicles with active bookings today / in-progress right now
  const liveAvailableCarsCount = useMemo(() => {
    const nowMs = Date.now();
    const todayStr = todayLocalDateStr();
    const bookedVehicleIds = new Set<number>();
    for (const tr of allActiveScheduleTrips) {
      if (!tr.vehicle_id) continue;
      const st = String(tr.status || '').toUpperCase();
      if (st === 'IN_PROGRESS') {
        bookedVehicleIds.add(Number(tr.vehicle_id));
        continue;
      }
      const startD = new Date(tr.start_time);
      const endD = new Date(tr.end_time || tr.start_time);
      const startMs = startD.getTime();
      const endMs = Math.max(endD.getTime(), startMs + 30 * 60_000);
      if (Number.isNaN(startMs)) continue;
      const pad = (n: number) => String(n).padStart(2, '0');
      const localStartDate = `${startD.getFullYear()}-${pad(startD.getMonth() + 1)}-${pad(startD.getDate())}`;
      const localEndDate = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())}`;
      const touchesToday = localStartDate === todayStr || localEndDate === todayStr || (startMs <= nowMs && endMs > nowMs);
      if (touchesToday && endMs > nowMs) {
        bookedVehicleIds.add(Number(tr.vehicle_id));
      }
    }
    return vehicles.filter((v) => v.status === 'Available' && !bookedVehicleIds.has(Number(v.id))).length;
  }, [vehicles, allActiveScheduleTrips]);

  // Immediately fetch fresh server-side vehicles, bookings & calendar schedule whenever opening Home, Schedule Calendar, or switching calendar date
  useEffect(() => {
    if (!user) return;
    if (navSection !== 'HOME' && !(navSection === 'ADMIN' && adminModule === 'DRIVER_SCHEDULE')) return;
    if (navSection === 'HOME' && bookingStep !== 'HOME' && bookingStep !== 'SCHEDULE_VIEW') return;
    let cancelled = false;
    Promise.all([
      apiRequest('/api/vehicles').catch(() => null),
      apiRequest('/api/schedule/calendar').catch(() => null),
      apiRequest('/api/bookings').catch(() => null),
    ]).then(([vehRes, calRes, bkgRes]) => {
      if (cancelled) return;
      if (Array.isArray(vehRes?.vehicles)) setVehicles(vehRes.vehicles);
      const calList = calRes?.scheduleTrips || calRes?.trips;
      if (Array.isArray(calList)) setCalendarTrips(calList);
      if (Array.isArray(bkgRes?.bookings)) setBookings(bkgRes.bookings);
    });
    return () => {
      cancelled = true;
    };
  }, [user, navSection, bookingStep, adminModule, scheduleCalendarDate]);

  // Load past & completed schedule audit records when viewing Admin Driver Schedule or Audit console
  useEffect(() => {
    if (!user || !isPrivileged || navSection !== 'ADMIN') return;
    if (adminModule !== 'DRIVER_SCHEDULE' && adminModule !== 'AUDIT') return;
    let cancelled = false;
    apiRequest('/api/schedule/audit?status=ALL')
      .then((res) => {
        if (!cancelled && Array.isArray(res?.records)) {
          setScheduleAuditRecords(res.records);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, isPrivileged, navSection, adminModule, trips.length]);

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

  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [driverToPickupEta, setDriverToPickupEta] = useState<{
    distanceKm: number;
    durationMin: number;
    etaText: string;
  } | null>(null);

  const canShowAssignedDriverLive = useMemo(() => {
    if (!focusedTrip) return false;
    const hasAssignedDriver = Boolean(
      focusedTrip.driver_profile_id || focusedTrip.assigned_driver_user_id || focusedTrip.assigned_driver_name
    );
    if (!hasAssignedDriver) return false;
    if (focusedTrip.status === 'IN_PROGRESS') return true;
    if (focusedTrip.status !== 'APPROVED') return false;
    if (focusedTrip.live_driver_tracking_visible === true) return true;
    const startMs = focusedTrip.start_time ? new Date(focusedTrip.start_time).getTime() : NaN;
    if (!Number.isFinite(startMs)) return false;
    return startMs - nowTick <= 10 * 60_000;
  }, [focusedTrip, nowTick]);

  const driverTrackingUnlocksAtText = useMemo(() => {
    if (!focusedTrip) return null;
    const unlockIso =
      focusedTrip.tracking_unlocks_at ||
      (focusedTrip.start_time ? new Date(new Date(focusedTrip.start_time).getTime() - 10 * 60_000).toISOString() : null);
    if (!unlockIso) return null;
    const d = new Date(unlockIso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [focusedTrip]);

  // Periodically update clock & refresh trip GPS while viewing an APPROVED / IN_PROGRESS booking
  useEffect(() => {
    if (!focusedTrip || (focusedTrip.status !== 'APPROVED' && focusedTrip.status !== 'IN_PROGRESS')) return;
    const id = window.setInterval(async () => {
      setNowTick(Date.now());
      if (bookingStep === 'IN_TRIP') {
        try {
          const res = await apiRequest('/api/trips');
          if (res.trips) setTrips(res.trips);
        } catch {
          // ignore transient poll error
        }
      }
    }, 15_000);
    return () => window.clearInterval(id);
  }, [focusedTrip?.id, focusedTrip?.status, bookingStep]);

  // Trigger an immediate /api/trips refresh right when crossing into the 10-minute pre-departure window
  useEffect(() => {
    if (!canShowAssignedDriverLive || !focusedTrip) return;
    if (focusedTrip.assigned_driver_lat == null || focusedTrip.assigned_driver_lon == null) {
      apiRequest('/api/trips')
        .then((res) => {
          if (res?.trips) setTrips(res.trips);
        })
        .catch(() => {});
    }
  }, [canShowAssignedDriverLive, focusedTrip?.id]);

  // Strictly show ONLY the assigned driver's live GPS and ONLY inside the 10-minute window (or IN_PROGRESS)
  const activeTripDriverCoords = useMemo(() => {
    if (!focusedTrip || !canShowAssignedDriverLive) return null;
    if (
      focusedTrip.assigned_driver_lat != null &&
      focusedTrip.assigned_driver_lon != null &&
      Number.isFinite(Number(focusedTrip.assigned_driver_lat)) &&
      Number.isFinite(Number(focusedTrip.assigned_driver_lon))
    ) {
      return { lat: Number(focusedTrip.assigned_driver_lat), lon: Number(focusedTrip.assigned_driver_lon) };
    }
    if (focusedTrip.vehicle_id) {
      const carPos = fleetPositions.find((p) => p.id === focusedTrip.vehicle_id);
      if (carPos && Number.isFinite(carPos.latitude) && Number.isFinite(carPos.longitude)) {
        return { lat: carPos.latitude, lon: carPos.longitude };
      }
    }
    if (focusedTrip.assigned_driver_user_id) {
      const drvPin = userPins.find((p) => p.user_id === focusedTrip.assigned_driver_user_id);
      if (drvPin && Number.isFinite(drvPin.latitude) && Number.isFinite(drvPin.longitude)) {
        return { lat: drvPin.latitude, lon: drvPin.longitude };
      }
    }
    return null;
  }, [focusedTrip, canShowAssignedDriverLive, fleetPositions, userPins]);

  // Compute live ETA & distance from assigned driver's position to user's pickup position
  useEffect(() => {
    if (!canShowAssignedDriverLive || !activeTripDriverCoords) {
      setDriverToPickupEta(null);
      return;
    }
    const pickupPoint =
      originCoords && Number.isFinite(originCoords.lat) && Number.isFinite(originCoords.lon)
        ? originCoords
        : myCoords && Number.isFinite(myCoords.lat) && Number.isFinite(myCoords.lon)
        ? { lat: myCoords.lat, lon: myCoords.lon }
        : { lat: -6.22728, lon: 106.80816 };

    const est = estimateRouteMetrics('Driver', 'Pickup', activeTripDriverCoords, pickupPoint);
    const estEta = new Date(Date.now() + est.durationMin * 60_000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    setDriverToPickupEta({
      distanceKm: est.distanceKm,
      durationMin: est.durationMin,
      etaText: estEta,
    });

    let cancelled = false;
    apiRequest(
      `/api/route?originLat=${encodeURIComponent(activeTripDriverCoords.lat)}&originLon=${encodeURIComponent(
        activeTripDriverCoords.lon
      )}&destLat=${encodeURIComponent(pickupPoint.lat)}&destLon=${encodeURIComponent(pickupPoint.lon)}`
    )
      .then((res) => {
        if (!cancelled && res && Number(res.distanceKm) > 0 && Number(res.durationMin) > 0) {
          const dMin = Math.max(1, Math.round(Number(res.durationMin)));
          const etaText = new Date(Date.now() + dMin * 60_000).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          setDriverToPickupEta({
            distanceKm: Number(Number(res.distanceKm).toFixed(1)),
            durationMin: dMin,
            etaText,
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    canShowAssignedDriverLive,
    activeTripDriverCoords?.lat,
    activeTripDriverCoords?.lon,
    originCoords?.lat,
    originCoords?.lon,
    myCoords?.lat,
    myCoords?.lon,
  ]);

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

  // Ensure route origin/destination coordinates resolve accurately when opening an existing trip in WAITING / IN_TRIP
  useEffect(() => {
    if ((bookingStep !== 'WAITING' && bookingStep !== 'IN_TRIP') || !focusedTrip) return;
    if (focusedTrip.origin && focusedTrip.origin !== bookOrigin) {
      setBookOrigin(focusedTrip.origin);
      setOriginCoords(null);
    }
    if (focusedTrip.destination && focusedTrip.destination !== bookDest) {
      setBookDest(focusedTrip.destination);
      setDestCoords(null);
    }
  }, [bookingStep, focusedTrip?.id, focusedTrip?.origin, focusedTrip?.destination]);

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', width: '100%' }}>
            <DisplayModeToggle variant="compact" id="auth-display-mode-toggle" />
            <LanguageSwitcher compact />
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="type-caption" htmlFor="login-password" style={{ fontWeight: 700, display: 'block' }}>
                    {t('Password')}
                  </label>
                  <button
                    id="login-forgot-password-btn"
                    type="button"
                    onClick={handleOpenForgotPasswordModal}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--color-samsung-blue, #0072de)',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {t('Forgot Password?')}
                  </button>
                </div>
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
                <strong>{t('Account Registration')}:</strong> {t('Enter your nickname, group, WhatsApp phone number, username & password. Administrator approval is required before sign-in.')}
              </div>

              <div>
                <label className="type-caption" htmlFor="reg-nickname" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  {t('Nickname')} <span style={{ color: '#dc2626' }}>*</span>
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
                  {t('Group')} <span style={{ color: '#dc2626' }}>*</span>
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
                <label className="type-caption" htmlFor="reg-contact-number" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  {t('WhatsApp / Mobile Phone Number')} <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="reg-contact-number"
                  className="gf-input"
                  type="tel"
                  required
                  minLength={8}
                  placeholder="e.g. 081234567890"
                  value={regContactNumber}
                  onChange={(e) => setRegContactNumber(e.target.value)}
                />
                <div className="type-caption" style={{ marginTop: '3px', color: 'var(--color-text-secondary)' }}>
                  {t('Mandatory for account recovery & WhatsApp fleet coordination.')}
                </div>
              </div>

              <div>
                <label className="type-caption" htmlFor="reg-username" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  {t('Username')} <span style={{ color: '#dc2626' }}>*</span>
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
                  {t('Password')} <span style={{ color: '#dc2626' }}>*</span>
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

        {showForgotPasswordModal && (
          <div
            id="forgot-password-modal"
            className="gf-modal-backdrop"
            style={{ zIndex: 1200 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowForgotPasswordModal(false);
            }}
          >
            <div className="gf-modal-card" style={{ maxWidth: '440px', width: '94vw' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      background: 'rgba(0, 114, 222, 0.12)',
                      color: '#0072de',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <KeyRound size={18} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{t('Forgot Password')}</h3>
                    <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                      {t('Request a direct password reset from the Administrator')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="gf-icon-btn-48"
                  style={{ width: '34px', height: '34px' }}
                  onClick={() => setShowForgotPasswordModal(false)}
                  aria-label={t('Close')}
                >
                  <X size={16} />
                </button>
              </div>

              {forgotResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    id="forgot-password-success"
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'rgba(0, 114, 222, 0.08)',
                      border: '1px solid rgba(0, 114, 222, 0.28)',
                      fontSize: '13px',
                      color: 'var(--color-text-primary)',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#0072de', marginBottom: '4px' }}>
                      ✓ {t('Password Reset Request Sent')}
                    </div>
                    <div>{forgotResult.message}</div>
                  </div>

                  {forgotResult.admin_whatsapp_url && (
                    <a
                      id="forgot-password-wa-admin-link"
                      href={forgotResult.admin_whatsapp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gf-btn gf-btn-primary gf-btn-full"
                      style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <Phone size={16} /> {t('Message Admin on WhatsApp (Free)')}
                    </a>
                  )}

                  <button
                    type="button"
                    className="gf-btn gf-btn-secondary gf-btn-full"
                    onClick={() => setShowForgotPasswordModal(false)}
                  >
                    {t('Back to Sign In')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'var(--color-bg-subtle)',
                      fontSize: '12.5px',
                      color: 'var(--color-text-secondary)',
                      lineHeight: 1.45,
                    }}
                  >
                    {t('Enter your username and registered WhatsApp number. Your request will appear in the Admin Console immediately, and you can also chat with the Admin on WhatsApp for free.')}
                  </div>

                  {forgotError && (
                    <div
                      id="forgot-password-error"
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'var(--color-danger-tint)',
                        color: 'var(--color-danger-text)',
                        fontSize: '12.5px',
                        fontWeight: 600,
                      }}
                    >
                      {forgotError}
                    </div>
                  )}

                  <div>
                    <label className="type-caption" htmlFor="forgot-username" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      {t('Username')} <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      id="forgot-username"
                      className="gf-input"
                      type="text"
                      required
                      placeholder={t('Enter your username')}
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="type-caption" htmlFor="forgot-phone" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      {t('Registered WhatsApp / Phone Number')} <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      id="forgot-phone"
                      className="gf-input"
                      type="tel"
                      required
                      minLength={8}
                      placeholder="e.g. 081234567890"
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="type-caption" htmlFor="forgot-notes" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      {t('Notes for Admin (Optional)')}
                    </label>
                    <input
                      id="forgot-notes"
                      className="gf-input"
                      type="text"
                      maxLength={300}
                      placeholder={t('e.g. Urgent trip today, please reset password')}
                      value={forgotNotes}
                      onChange={(e) => setForgotNotes(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="gf-btn gf-btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => setShowForgotPasswordModal(false)}
                      disabled={forgotSubmitting}
                    >
                      {t('Cancel')}
                    </button>
                    <button
                      id="forgot-password-submit-btn"
                      type="submit"
                      className="gf-btn gf-btn-primary"
                      style={{ flex: 1.4 }}
                      disabled={forgotSubmitting}
                    >
                      {forgotSubmitting ? t('Submitting...') : t('Request Password Reset')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
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
                <label className="type-caption" htmlFor="edit-vehicle-seats-input" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  {t('Passenger Seat Capacity')} *
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    id="edit-vehicle-seats-dec"
                    type="button"
                    className="gf-btn gf-btn-secondary pressable"
                    style={{ minWidth: '40px', padding: '0 12px', fontWeight: 800, fontSize: '16px' }}
                    aria-label="Decrease seat capacity"
                    onClick={() =>
                      setEditingVehicle({
                        ...editingVehicle,
                        seats: Math.max(1, Number(editingVehicle.seats || 5) - 1),
                      })
                    }
                  >
                    -
                  </button>
                  <input
                    id="edit-vehicle-seats-input"
                    type="number"
                    className="gf-input mono"
                    min={1}
                    max={50}
                    required
                    style={{ textAlign: 'center', fontWeight: 700 }}
                    value={editingVehicle.seats ?? 5}
                    onChange={(e) =>
                      setEditingVehicle({
                        ...editingVehicle,
                        seats: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                      })
                    }
                  />
                  <button
                    id="edit-vehicle-seats-inc"
                    type="button"
                    className="gf-btn gf-btn-secondary pressable"
                    style={{ minWidth: '40px', padding: '0 12px', fontWeight: 800, fontSize: '16px' }}
                    aria-label="Increase seat capacity"
                    onClick={() =>
                      setEditingVehicle({
                        ...editingVehicle,
                        seats: Math.min(50, Number(editingVehicle.seats || 5) + 1),
                      })
                    }
                  >
                    +
                  </button>
                </div>
                <p className="type-caption" style={{ marginTop: '3px', color: 'var(--color-text-secondary)' }}>
                  {t('Maximum passenger seats allowed for booking, hitchhike, and slot transfer.')}
                </p>
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
          <div className="gf-modal-card" style={{ maxWidth: '460px', padding: '18px 20px' }}>
            {/* Clean Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="type-title" style={{ margin: 0, fontSize: '18px' }}>
                  {t('Booking Approval')} #{dispatchModalTrip.id}
                </h3>
                {formatReservationModeLabel(dispatchModalTrip.reservation_type, dispatchModalTrip.return_pickup_time) && (
                  <StatusBadge
                    label={formatReservationModeLabel(dispatchModalTrip.reservation_type, dispatchModalTrip.return_pickup_time)!}
                    tone="blue"
                  />
                )}
              </div>
              <button
                type="button"
                className="gf-icon-btn-48 pressable"
                style={{ width: '34px', height: '34px' }}
                onClick={() => setDispatchModalTrip(null)}
                aria-label="Close"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Compact Executive Trip Summary Card */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: 'var(--color-bg-subtle)',
                border: '1px solid var(--color-divider)',
                marginBottom: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="type-body" style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {dispatchModalTrip.purpose}
                </span>
                <span className="type-caption" style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  {dispatchModalTrip.requester_name} • {dispatchModalTrip.department_name}
                </span>
              </div>
              <div className="type-caption" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                {dispatchModalTrip.origin} → {dispatchModalTrip.destination}
              </div>
              {dispatchModalTrip.start_time && dispatchModalTrip.end_time && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  <Clock size={13} style={{ color: '#0072de', flexShrink: 0 }} />
                  <span>
                    {new Date(dispatchModalTrip.start_time).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    – {new Date(dispatchModalTrip.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {dispatchModalTrip.reservation_type === 'DROP_AND_PICKUP' && dispatchModalTrip.return_pickup_time && (
                    <span style={{ color: '#258cfb', fontWeight: 700 }}>
                      • Return {new Date(dispatchModalTrip.return_pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}
              {(dispatchModalTrip.start_odometer != null ||
                dispatchModalTrip.end_odometer != null ||
                dispatchModalTrip.start_odometer_photo_url ||
                dispatchModalTrip.end_odometer_photo_url) && (
                <div
                  id="dispatch-odometer-photos"
                  style={{
                    marginTop: '6px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--color-divider)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--color-text-primary)' }}>
                      <Gauge size={13} style={{ color: 'var(--color-samsung-blue)' }} /> {t('Odometer & Distance')}
                    </span>
                    <span className="mono" style={{ color: 'var(--color-samsung-blue-text)' }}>
                      {dispatchModalTrip.start_odometer ?? '-'} → {dispatchModalTrip.end_odometer ?? '-'} km
                      {dispatchModalTrip.distance_km != null ? ` (${dispatchModalTrip.distance_km} km)` : ''}
                    </span>
                  </div>
                  {(dispatchModalTrip.start_odometer_photo_url || dispatchModalTrip.end_odometer_photo_url) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {dispatchModalTrip.start_odometer_photo_url ? (
                        <button
                          type="button"
                          className="pressable"
                          onClick={() =>
                            setEnlargedPhotoModal({
                              src: dispatchModalTrip.start_odometer_photo_url,
                              title: `${t('Start Odometer Photo')} — #${dispatchModalTrip.id}`,
                              subtitle: `${dispatchModalTrip.registration_plate || ''} • ${dispatchModalTrip.start_odometer ?? '-'} km`,
                            })
                          }
                          style={{ padding: 0, border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', background: 'var(--color-bg-surface)', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <img src={dispatchModalTrip.start_odometer_photo_url} alt={t('Start Odometer Photo')} style={{ width: '100%', height: '72px', objectFit: 'cover', display: 'block' }} />
                          <div style={{ padding: '4px 6px', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{t('Start Odo')}</span>
                            <span style={{ color: 'var(--color-samsung-blue-text)' }}>{t('Tap to enlarge')}</span>
                          </div>
                        </button>
                      ) : null}
                      {dispatchModalTrip.end_odometer_photo_url ? (
                        <button
                          type="button"
                          className="pressable"
                          onClick={() =>
                            setEnlargedPhotoModal({
                              src: dispatchModalTrip.end_odometer_photo_url,
                              title: `${t('End Odometer Photo')} — #${dispatchModalTrip.id}`,
                              subtitle: `${dispatchModalTrip.registration_plate || ''} • ${dispatchModalTrip.end_odometer ?? '-'} km${dispatchModalTrip.distance_km != null ? ` (${dispatchModalTrip.distance_km} km)` : ''}`,
                            })
                          }
                          style={{ padding: 0, border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', background: 'var(--color-bg-surface)', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <img src={dispatchModalTrip.end_odometer_photo_url} alt={t('End Odometer Photo')} style={{ width: '100%', height: '72px', objectFit: 'cover', display: 'block' }} />
                          <div style={{ padding: '4px 6px', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{t('End Odo')}</span>
                            <span style={{ color: 'var(--color-samsung-blue-text)' }}>{t('Tap to enlarge')}</span>
                          </div>
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Compact Urgent Pill (Only when < 2h lead time) */}
            {dispatchModalTrip.is_urgent === 1 && (
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'rgba(220, 38, 38, 0.1)',
                  border: '1px solid rgba(248, 113, 113, 0.45)',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#ef4444' }}>
                  <AlertTriangle size={14} />
                  <span>{t('Urgent Booking (< 2h)')}</span>
                </div>
                {dispatchModalTrip.urgent_reason && (
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                    {dispatchModalTrip.urgent_reason}
                  </span>
                )}
              </div>
            )}

            {/* Sleek Horizontal 2-Step Approval Stepper (Fleet PIC -> Head of WS) */}
            {dispatchModalTrip.requires_dual_approval && (
              <div
                id="dispatch-approval-stepper"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-divider)',
                  marginBottom: '14px',
                }}
              >
                {/* Step 1: Fleet PIC */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '9999px',
                      background: dispatchModalTrip.pic_approved ? '#0072de' : 'rgba(0, 114, 222, 0.14)',
                      color: dispatchModalTrip.pic_approved ? '#ffffff' : '#258cfb',
                      border: dispatchModalTrip.pic_approved ? 'none' : '1.5px solid #0072de',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '11px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {dispatchModalTrip.pic_approved ? <CheckCircle2 size={14} /> : '1'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t('Fleet PIC')}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: dispatchModalTrip.pic_approved ? '#258cfb' : '#d97706' }}>
                      {dispatchModalTrip.pic_approved ? t('Approved') : t('Pending')}
                    </div>
                  </div>
                </div>

                <ChevronRight size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />

                {/* Step 2: Head of WS */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '9999px',
                      background: dispatchModalTrip.hws_approved
                        ? '#0072de'
                        : dispatchModalTrip.pic_approved
                        ? 'rgba(0, 114, 222, 0.14)'
                        : 'var(--color-bg-elevated)',
                      color: dispatchModalTrip.hws_approved
                        ? '#ffffff'
                        : dispatchModalTrip.pic_approved
                        ? '#258cfb'
                        : 'var(--color-text-muted)',
                      border: dispatchModalTrip.hws_approved
                        ? 'none'
                        : dispatchModalTrip.pic_approved
                        ? '1.5px solid #0072de'
                        : '1px solid var(--color-divider)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '11px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {dispatchModalTrip.hws_approved ? <CheckCircle2 size={14} /> : '2'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t('Head of WS')}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: dispatchModalTrip.hws_approved
                          ? '#258cfb'
                          : dispatchModalTrip.pic_approved
                          ? '#d97706'
                          : 'var(--color-text-muted)',
                      }}
                    >
                      {dispatchModalTrip.hws_approved
                        ? t('Approved')
                        : dispatchModalTrip.pic_approved
                        ? t('Ready')
                        : t('Waiting Step 1')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(() => {
              const isFinalStatusLocked = ['APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(
                String(dispatchModalTrip.status)
              );
              const isPicApprovedLocked = Boolean(dispatchModalTrip.pic_approved);
              const isFullyLockedModal = isFinalStatusLocked || (isPicApprovedLocked && user.role === 'FM');

              if (isFullyLockedModal) {
                return (
                  <div id="dispatch-locked-summary" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-divider)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: '#0072de',
                            color: '#fff',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Car size={18} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--color-text-primary)' }}>
                            {dispatchModalTrip.assigned_driver_name || t('Assigned Driver')} • {dispatchModalTrip.registration_plate}
                          </div>
                          <div className="type-caption" style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
                            {dispatchModalTrip.make} {dispatchModalTrip.model} ({dispatchModalTrip.energy_type || 'Fleet'})
                          </div>
                        </div>
                      </div>
                      <StatusBadge
                        label={isFinalStatusLocked ? dispatchModalTrip.status : 'FLEET PIC APPROVED'}
                        tone={isFinalStatusLocked ? toneFromStatus(dispatchModalTrip.status) : 'blue'}
                      />
                    </div>

                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: 'rgba(0, 114, 222, 0.08)',
                        border: '1px solid rgba(37, 140, 251, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      <Lock size={14} style={{ color: '#258cfb', flexShrink: 0 }} />
                      <span>
                        {t('Booking is approved and locked. Cannot be edited or rejected; only the requester can cancel this booking.')}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="gf-btn gf-btn-secondary gf-btn-full"
                      onClick={() => setDispatchModalTrip(null)}
                    >
                      {t('Close')}
                    </button>
                  </div>
                );
              }

              // Stage 2 view after Fleet PIC has already approved: Driver & Car are locked and Reject is disabled
              if (isPicApprovedLocked) {
                return (
                  <div id="dispatch-stage2-locked-view" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span className="type-caption" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {t('Assigned Driver & Vehicle')}
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            color: '#258cfb',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Lock size={11} /> {t('Locked by Fleet PIC')}
                        </span>
                      </div>
                      <div
                        id="dispatch-fixed-vehicle-display"
                        style={{
                          padding: '11px 12px',
                          borderRadius: '10px',
                          background: 'var(--color-bg-subtle)',
                          border: '1px solid var(--color-divider)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              background: '#0072de',
                              color: '#fff',
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Car size={17} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--color-text-primary)' }}>
                              {dispatchModalTrip.assigned_driver_name || t('Assigned Driver')} • {dispatchModalTrip.registration_plate}
                            </div>
                            <div className="type-caption" style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
                              {dispatchModalTrip.make} {dispatchModalTrip.model} ({dispatchModalTrip.energy_type || 'Fleet'})
                            </div>
                          </div>
                        </div>
                        <Lock size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: 'rgba(0, 114, 222, 0.08)',
                        border: '1px solid rgba(37, 140, 251, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      <Lock size={14} style={{ color: '#258cfb', flexShrink: 0 }} />
                      <span>
                        {t('Approved by Fleet PIC — cannot be rejected or edited. Only the requester can cancel this booking.')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      <button
                        type="button"
                        className="gf-btn gf-btn-secondary"
                        style={{ flex: 1 }}
                        onClick={() => setDispatchModalTrip(null)}
                      >
                        {t('Close')}
                      </button>
                      <button
                        type="button"
                        className="gf-btn gf-btn-primary"
                        style={{ flex: 1.4 }}
                        onClick={() => handleAdminTripDecision('APPROVED')}
                      >
                        {t('Final Approve')}
                      </button>
                    </div>
                  </div>
                );
              }

              const allPoolVehicles = dispatchAvailability?.vehicles?.length ? dispatchAvailability.vehicles : vehicles;
              const availableDispatchVehicles = allPoolVehicles.filter(
                (v: any) => v.status === 'Available' && v.isAvailable !== false
              );
              const allPoolDrivers = dispatchAvailability?.drivers?.length ? dispatchAvailability.drivers : drivers;
              const availableDispatchDrivers = allPoolDrivers.filter(
                (d: any) => d.availability_status === 'Active' && d.isAvailable !== false
              );

              // 1 Driver = 1 Fixed Car: pair each available driver strictly with their fixed available car
              const availableDriverCarPairs = availableDispatchDrivers
                .map((d: any) => {
                  const fixedCar = availableDispatchVehicles.find(
                    (v: any) => Number(v.default_driver_id) === Number(d.id)
                  );
                  return fixedCar ? { driver: d, vehicle: fixedCar } : null;
                })
                .filter(Boolean) as Array<{ driver: any; vehicle: any }>;

              const hasDriverCarPairs = availableDriverCarPairs.length > 0;
              const selectedPair =
                availableDriverCarPairs.find((p) => String(p.driver.id) === String(dispatchDriverId)) ||
                availableDriverCarPairs.find((p) => Number(p.vehicle.id) === Number(dispatchVehicleId)) ||
                availableDriverCarPairs[0] ||
                null;
              const fixedVehicle =
                selectedPair?.vehicle ||
                availableDispatchVehicles.find((v: any) => Number(v.id) === Number(dispatchVehicleId)) ||
                availableDispatchVehicles[0] ||
                null;

              const noAvailableOption = !dispatchAvailabilityLoading && !fixedVehicle;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Step 1: Select Available Driver FIRST (Car follows automatically and is FIXED) */}
                  {hasDriverCarPairs ? (
                    <>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <label className="type-caption" htmlFor="dispatch-available-driver-select" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {t('Assign Driver')}
                          </label>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#258cfb',
                              background: 'rgba(0, 114, 222, 0.12)',
                              padding: '2px 8px',
                              borderRadius: '99px',
                            }}
                          >
                            {dispatchAvailabilityLoading
                              ? t('Checking...')
                              : `${availableDriverCarPairs.length} ${t('Available')}`}
                          </span>
                        </div>
                        <select
                          id="dispatch-available-driver-select"
                          className="gf-select"
                          value={selectedPair ? String(selectedPair.driver.id) : dispatchDriverId}
                          disabled={dispatchAvailabilityLoading}
                          onChange={(e) => {
                            const nextDrvId = e.target.value;
                            setDispatchDriverId(nextDrvId);
                            const matchedPair = availableDriverCarPairs.find(
                              (p) => String(p.driver.id) === nextDrvId
                            );
                            if (matchedPair) {
                              setDispatchVehicleId(Number(matchedPair.vehicle.id));
                            }
                          }}
                        >
                          {availableDriverCarPairs.map(({ driver: d, vehicle: v }) => (
                            <option key={d.id} value={String(d.id)}>
                              {d.full_name} • {v.registration_plate} ({v.model})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Step 2: Fixed Vehicle Card (Automatically follows selected Driver — READ-ONLY / CANNOT CHANGE) */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span className="type-caption" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {t('Paired Vehicle')}
                          </span>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              color: 'var(--color-text-secondary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Lock size={11} /> {t('Auto-paired')}
                          </span>
                        </div>
                        <div
                          id="dispatch-fixed-vehicle-display"
                          style={{
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: 'var(--color-bg-subtle)',
                            border: '1px solid var(--color-divider)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
                                background: '#0072de',
                                color: '#fff',
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Car size={17} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--color-text-primary)' }}>
                                {fixedVehicle.registration_plate} • {fixedVehicle.make} {fixedVehicle.model}
                              </div>
                              <div className="type-caption" style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
                                {fixedVehicle.energy_type} • {fixedVehicle.seats} {t('seats')}
                              </div>
                            </div>
                          </div>
                          <Lock size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Edge-case fallback: fleet has available cars with no default driver linked yet, or 0 available */
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <label className="type-caption" htmlFor="dispatch-available-vehicle-select" style={{ fontWeight: 700 }}>
                          {t('Vehicle')}
                        </label>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            color: noAvailableOption ? '#ef4444' : '#258cfb',
                            background: noAvailableOption ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0, 114, 222, 0.12)',
                            padding: '2px 8px',
                            borderRadius: '99px',
                          }}
                        >
                          {dispatchAvailabilityLoading
                            ? t('Checking...')
                            : `${availableDispatchVehicles.length} ${t('Available')}`}
                        </span>
                      </div>
                      <select
                        id="dispatch-available-vehicle-select"
                        className="gf-select"
                        value={dispatchVehicleId}
                        disabled={dispatchAvailabilityLoading || noAvailableOption}
                        onChange={(e) => setDispatchVehicleId(Number(e.target.value))}
                      >
                        {noAvailableOption ? (
                          <option value={0}>No available driver/car for this schedule</option>
                        ) : (
                          availableDispatchVehicles.map((v: any) => (
                            <option key={v.id} value={v.id}>
                              {v.registration_plate} • {v.make} {v.model} ({v.seats} seats)
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '5px', color: 'var(--color-text-primary)' }}>
                      {t('Note')} <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>({t('required if rejecting')})</span>
                    </label>
                    <input
                      type="text"
                      className="gf-input"
                      placeholder={t('Optional approval note or rejection reason...')}
                      value={dispatchDecisionReason}
                      onChange={(e) => setDispatchDecisionReason(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="gf-btn gf-btn-outline-danger"
                      style={{ flex: 1 }}
                      onClick={() => handleAdminTripDecision('REJECTED')}
                    >
                      {t('Reject')}
                    </button>
                    <button
                      type="button"
                      className="gf-btn gf-btn-primary"
                      style={{ flex: 1.4 }}
                      disabled={
                        dispatchAvailabilityLoading ||
                        noAvailableOption ||
                        (user.role === 'HWS' && dispatchModalTrip.requires_dual_approval && !dispatchModalTrip.pic_approved)
                      }
                      onClick={() => handleAdminTripDecision('APPROVED')}
                    >
                      {user.role === 'ADM' && dispatchModalTrip.requires_dual_approval && (!dispatchModalTrip.pic_approved || !dispatchModalTrip.hws_approved)
                        ? t('Approve (Admin)')
                        : user.role === 'FM'
                        ? t('Approve & Assign')
                        : user.role === 'HWS'
                        ? dispatchModalTrip.pic_approved
                          ? t('Final Approve')
                          : t('Await Fleet PIC')
                        : t('Approve & Dispatch')}
                    </button>
                  </div>
                </div>
              );
            })()}
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
                  background: 'rgba(0, 114, 222, 0.12)',
                  color: '#0072de',
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

      {showDriverExpenseModal && (() => {
        const myDrv = drivers.find(
          (d: any) => d.user_id === user?.id || String(d.full_name || '').toLowerCase() === String(user?.nickname || '').toLowerCase()
        );
        const activeDispatchVehId = dispatches.find((d: any) => d.trip_status === 'IN_PROGRESS' || d.trip_status === 'APPROVED')?.vehicle_id;
        const assignedDriverVeh =
          vehicles.find(
            (v: any) =>
              (v.dedicated_driver_user_id && v.dedicated_driver_user_id === user?.id) ||
              (myDrv && v.default_driver_id === myDrv.id) ||
              (v.default_driver_name && String(v.default_driver_name).toLowerCase() === String(user?.nickname || '').toLowerCase())
          ) ||
          (activeDispatchVehId ? vehicles.find((v: any) => v.id === activeDispatchVehId) : null) ||
          vehicles.find((v: any) => v.id === driverExpenseForm.vehicle_id) ||
          vehicles[0];
        const effectiveVehicleId = user?.role === 'DRV' && assignedDriverVeh ? assignedDriverVeh.id : (driverExpenseForm.vehicle_id || assignedDriverVeh?.id || 0);
        const currentPettyCash = typeof myDrv?.petty_cash_balance === 'number' ? myDrv.petty_cash_balance : driverPettyCashBalance;

        const clearReceiptSelection = () => {
          if (driverReceiptInputRef.current) {
            driverReceiptInputRef.current.value = '';
          }
          setDriverExpenseForm((prev) => ({
            ...prev,
            receipt_name: '',
            receipt_data_url: '',
            receipt_base64: '',
            receipt_mime_type: '',
            receipt_size_bytes: 0,
          }));
        };

        return (
          <div className="gf-modal-backdrop" role="dialog" aria-modal="true" aria-label="Upload Expense Receipt">
            <div className="gf-modal-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 className="type-title">{t('Upload Expense Receipt')}</h3>
                  <p className="type-caption">{t('Claim reimbursement for operational car expenses')}</p>
                </div>
                <button
                  type="button"
                  className="gf-btn gf-btn-ghost"
                  onClick={() => {
                    clearReceiptSelection();
                    setShowDriverExpenseModal(false);
                  }}
                >
                  {t('Cancel')}
                </button>
              </div>

              {/* Petty Cash Balance Card inside Modal (Requirement #9) */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: '#ebf5ff',
                  border: '1.5px solid #93c5fd',
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#005bb5', textTransform: 'uppercase' }}>
                    {t('Driver Petty Cash Wallet')}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#1e3a8a', marginTop: '2px' }}>
                    {t('Cash parking & toll expenses deduct from Petty Cash and are replenished upon approval.')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10.5px', color: '#005bb5', fontWeight: 700 }}>{t('Petty Cash Balance')}</div>
                  <div className="mono" style={{ fontSize: '15px', fontWeight: 800, color: '#0072de' }}>
                    {formatIdr(currentPettyCash)}
                  </div>
                </div>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!effectiveVehicleId) {
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
                        vehicle_id: Number(effectiveVehicleId),
                        category: driverExpenseForm.category,
                        payment_source: driverExpenseForm.payment_source || 'PETTY_CASH',
                        amount: Number(driverExpenseForm.amount),
                        description: (driverExpenseForm.description.trim() || `${driverExpenseForm.category} Receipt Claim`),
                        receipt_base64: driverExpenseForm.receipt_base64 || undefined,
                        receipt_data_url: driverExpenseForm.receipt_data_url || undefined,
                        receipt_filename: driverExpenseForm.receipt_name || undefined,
                        receipt_mime_type: driverExpenseForm.receipt_mime_type || undefined,
                      }),
                    });
                    clearReceiptSelection();
                    setShowDriverExpenseModal(false);
                    setDriverExpenseForm({
                      vehicle_id: effectiveVehicleId,
                      category: 'Parking',
                      payment_source: 'PETTY_CASH',
                      amount: '',
                      description: '',
                      receipt_name: '',
                      receipt_base64: '',
                      receipt_data_url: '',
                      receipt_mime_type: '',
                      receipt_size_bytes: 0,
                    });
                    setStatusBanner({
                      type: 'success',
                      text: t('Expense receipt saved & Petty Cash claim submitted for reimbursement approval!'),
                    });
                    await loadAllData(user);
                  } catch (err: any) {
                    setStatusBanner({ type: 'danger', text: err.message });
                  }
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                {/* Requirement #7: Auto-filled & locked vehicle for logged-in driver so reimbursements never mix */}
                <div>
                  <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {user?.role === 'DRV' ? t('Assigned Driver & Operational Vehicle (Auto-Filled)') : t('Operational Vehicle')}
                  </label>
                  {user?.role === 'DRV' && assignedDriverVeh ? (
                    <div
                      id="driver-expense-locked-vehicle"
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-control)',
                        background: 'var(--color-bg-subtle)',
                        border: '1.5px solid #0072de',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--color-text-primary)' }}>
                          {assignedDriverVeh.registration_plate} — {assignedDriverVeh.make} {assignedDriverVeh.model} ({assignedDriverVeh.energy_type})
                        </div>
                        <div className="type-caption" style={{ color: '#005bb5', fontWeight: 700, marginTop: '2px' }}>
                          {t('Driver')}: {user.nickname} • {t('Locked to your driver account to prevent mixed claims')}
                        </div>
                      </div>
                      <Lock size={16} style={{ color: '#0072de', flexShrink: 0 }} />
                    </div>
                  ) : (
                    <select
                      className="gf-select"
                      required
                      value={effectiveVehicleId}
                      onChange={(e) => setDriverExpenseForm({ ...driverExpenseForm, vehicle_id: Number(e.target.value) })}
                    >
                      <option value={0}>Select Vehicle</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.registration_plate} — {v.make} {v.model} ({v.energy_type})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {t('Expense Category')}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(['Parking', 'Toll', 'Gas', 'Charging'] as const).map((cat) => (
                      <Chip
                        key={cat}
                        active={driverExpenseForm.category === cat}
                        onClick={() => setDriverExpenseForm({ ...driverExpenseForm, category: cat })}
                      >
                        {cat === 'Charging' ? t('Charging (EV)') : t(cat)}
                      </Chip>
                    ))}
                  </div>
                </div>

                {/* Requirement #9: Petty Cash payment source */}
                <div>
                  <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {t('Payment Source (Petty Cash Reimbursement)')}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Chip
                      active={driverExpenseForm.payment_source === 'PETTY_CASH'}
                      onClick={() => setDriverExpenseForm({ ...driverExpenseForm, payment_source: 'PETTY_CASH' })}
                    >
                      {t('Petty Cash (Cash Parking / Operational)')}
                    </Chip>
                    <Chip
                      active={driverExpenseForm.payment_source === 'DRIVER_ADVANCE'}
                      onClick={() => setDriverExpenseForm({ ...driverExpenseForm, payment_source: 'DRIVER_ADVANCE' })}
                    >
                      {t('Personal Cash Advance')}
                    </Chip>
                  </div>
                </div>

                <div>
                  <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {t('Amount (Rp)')}
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
                    {t('Description / Location')}
                  </label>
                  <input
                    type="text"
                    className="gf-input"
                    placeholder="e.g. Parkir Tunai Gedung SCBD, Gerbang Tol Cikarang Utama"
                    value={driverExpenseForm.description}
                    onChange={(e) => setDriverExpenseForm({ ...driverExpenseForm, description: e.target.value })}
                  />
                </div>

                {/* Requirement #8: Complete removal of receipt photo when deleted or cancelled */}
                <div>
                  <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {t('Receipt Photo / Document')}
                  </label>
                  <input
                    ref={driverReceiptInputRef}
                    id="driver-receipt-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="gf-input"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) {
                        clearReceiptSelection();
                        return;
                      }
                      if (file.size > 15 * 1024 * 1024) {
                        setStatusBanner({ type: 'danger', text: 'Receipt file exceeds 15 MB size limit.' });
                        clearReceiptSelection();
                        return;
                      }
                      if (file.type.startsWith('image/')) {
                        const compressedUrl = await compressImageFileToDataUrl(file, 1200, 0.75);
                        setDriverExpenseForm((prev) => ({
                          ...prev,
                          receipt_name: file.name,
                          receipt_data_url: compressedUrl,
                          receipt_base64: compressedUrl,
                          receipt_mime_type: 'image/jpeg',
                          receipt_size_bytes: Math.round((compressedUrl.length * 3) / 4),
                        }));
                      } else {
                        const reader = new FileReader();
                        reader.onload = (loadEvt) => {
                          const dataUrl = String(loadEvt.target?.result || '');
                          setDriverExpenseForm((prev) => ({
                            ...prev,
                            receipt_name: file.name,
                            receipt_data_url: dataUrl,
                            receipt_base64: dataUrl,
                            receipt_mime_type: file.type || 'application/pdf',
                            receipt_size_bytes: file.size,
                          }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />

                  {driverExpenseForm.receipt_data_url && (
                    <div
                      id="driver-receipt-preview-box"
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
                            {(driverExpenseForm.receipt_size_bytes / 1024).toFixed(1)} KB • {t('Verified & Ready')}
                          </div>
                        </div>
                      </div>
                      <button
                        id="driver-remove-receipt-btn"
                        type="button"
                        className="gf-btn gf-btn-outline-danger"
                        style={{ minHeight: '28px', padding: '0 8px', fontSize: '11px' }}
                        onClick={clearReceiptSelection}
                      >
                        <Trash2 size={12} /> {t('Remove')}
                      </button>
                    </div>
                  )}

                  <p className="type-caption" style={{ marginTop: '4px', color: 'var(--color-text-secondary)' }}>
                    {t('Take a photo of the receipt or attach PDF slip. Stored securely in database.')}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="gf-btn gf-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      clearReceiptSelection();
                      setShowDriverExpenseModal(false);
                    }}
                  >
                    {t('Cancel')}
                  </button>
                  <button type="submit" className="gf-btn gf-btn-primary" style={{ flex: 1 }}>
                    {t('Submit Claim')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Requirement #12: Pre-Booking Confirmation Modal (Default +2h Advance Schedule & Urgent Change Reminder) */}
      {showPreBookingConfirmModal && selectedVehicle && (() => {
        const startMs = new Date(bookStart).getTime();
        const leadTimeMin = Math.round((startMs - Date.now()) / 60000);
        const isUrgent = leadTimeMin < 120;
        const cleanPax = bookPassengers.filter((p) => p.nickname.trim());

        return (
          <div className="gf-modal-backdrop" role="dialog" aria-modal="true" aria-label="Pre-Booking Confirmation">
            <div className="gf-modal-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div>
                  <h3 className="type-title" style={{ margin: 0 }}>{t('Pre-Booking Confirmation')}</h3>
                  <p className="type-caption" style={{ margin: '2px 0 0' }}>
                    {t('Please review your departure schedule and details before submitting')}
                  </p>
                </div>
                <StatusBadge label={isUrgent ? t('Urgent (< 2h)') : t('Standard (+2h)')} tone={isUrgent ? 'red' : 'blue'} />
              </div>

              {isUrgent ? (
                <div style={{ padding: '12px', borderRadius: '10px', background: '#fef2f2', border: '1.5px solid #f87171', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#991b1b', fontWeight: 800, fontSize: '12px' }}>
                    <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                    <span>{t('Urgent Short-Notice Departure Reminder')}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#7f1d1d', lineHeight: 1.4 }}>
                    {t('Default booking is 2 hours from current time. You selected an urgent departure in')} <strong>{Math.max(1, leadTimeMin)} min</strong>. {t('This requires Stage 1 Fleet Operation PIC consent followed by Stage 2 Head Of WS approval.')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#991b1b' }}>
                    <strong>{t('Urgent Reason')}:</strong> {bookUrgentReason.trim() || bookPurpose.trim()}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '12px', borderRadius: '10px', background: '#ebf5ff', border: '1.5px solid #93c5fd', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#005bb5' }}>
                    {t('Scheduled 2+ Hours in Advance (Standard Policy)')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#1e3a8a', lineHeight: 1.4 }}>
                    {t('Your booking is automatically set for 2+ hours from now. Need to depart urgently sooner than 2 hours? Tap "Change Schedule Time" below.')}
                  </div>
                </div>
              )}

              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div><strong>{t('Departure')}:</strong> {new Date(bookStart).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                <div><strong>{t('Return')}:</strong> {new Date(bookEnd).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                <div><strong>{t('Route')}:</strong> {bookOrigin} → {bookDest}</div>
                <div><strong>{t('Vehicle')}:</strong> {selectedVehicle.make} {selectedVehicle.model} ({selectedVehicle.registration_plate})</div>
                <div><strong>{t('Trip Purpose')}:</strong> {bookPurpose}</div>
                <div><strong>{t('Passengers')}:</strong> {cleanPax.map((p, idx) => `${idx + 1}. ${p.nickname}`).join(', ')}</div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--color-bg-subtle)', fontSize: '11.5px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                <strong>{t(' Boarding & No-Show Policy')}:</strong> {t('You will receive constant reminders starting 10 minutes before departure. If you do not show up or confirm boarding within 20 minutes after departure time, the booking will be automatically cancelled and the vehicle slot freed.')}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  id="confirm-prebooking-submit-btn"
                  type="button"
                  className="gf-btn gf-btn-primary gf-btn-full"
                  onClick={() => handleCreateTripBooking(true)}
                >
                  <CheckCircle2 size={16} /> {t('Confirm & Submit Booking')}
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    id="prebooking-change-time-btn"
                    type="button"
                    className="gf-btn gf-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setShowPreBookingConfirmModal(false);
                      setBookingStep('VEHICLE');
                      setShowSchedulePicker(true);
                    }}
                  >
                    <Calendar size={15} /> {t('Change Schedule Time')}
                  </button>
                  <button
                    type="button"
                    className="gf-btn gf-btn-ghost"
                    style={{ flex: 1 }}
                    onClick={() => setShowPreBookingConfirmModal(false)}
                  >
                    {t('Back to Summary')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Digital Summary Report Approval Popup (Auto-pops on Friday End-of-Week & End-of-Month for FM & HWS) */}
      {reportApprovalPopup && user && (user.role === 'FM' || user.role === 'HWS') && (() => {
        const s = reportApprovalPopup.summary || {};
        const isWeekly = reportApprovalPopup.period_type === 'WEEKLY';
        const myRoleStatus = user.role === 'FM' ? reportApprovalPopup.fm_status : reportApprovalPopup.hws_status;
        return (
          <div
            id="report-approval-popup-modal"
            className="gf-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Digital Summary Report Approval"
            style={{ zIndex: 1200 }}
          >
            <div className="gf-modal-card" style={{ maxWidth: '520px', width: '94vw', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 800,
                      background: '#ebf5ff',
                      color: '#0072de',
                      marginBottom: '6px',
                    }}
                  >
                    <ShieldCheck size={13} />
                    {isWeekly ? t('Weekly Summary Report • Friday Sign-Off') : t('Monthly Summary Report • End of Month Sign-Off')}
                  </span>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    {reportApprovalPopup.period_label}
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    {t('Digital approval required from Fleet Manager & Head of WS.')}
                  </p>
                </div>
                <button
                  type="button"
                  className="gf-btn gf-btn-ghost"
                  style={{ minHeight: '34px', width: '34px', padding: 0, borderRadius: '50%' }}
                  aria-label="Close report approval popup"
                  onClick={() => {
                    reportApprovalSnoozedRef.current[String(reportApprovalPopup.period_key)] = true;
                    setReportApprovalPopup(null);
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Summary KPIs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '14px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{t('Completed Trips')}</div>
                  <div className="mono" style={{ fontSize: '18px', fontWeight: 800, color: '#0072de', marginTop: '2px' }}>
                    {Number(s.completed_trips ?? 0)} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>/ {Number(s.total_trips ?? 0)}</span>
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{t('Total Distance')}</div>
                  <div className="mono" style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {Number(s.total_distance_km ?? 0).toLocaleString()} km
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{t('Total Cost (IDR)')}</div>
                  <div className="mono" style={{ fontSize: '15px', fontWeight: 800, color: '#005bb5', marginTop: '4px' }}>
                    {formatIdr(Number(s.total_operational_cost_idr ?? 0))}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{t('Fleet & Drivers')}</div>
                  <div className="mono" style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                    {Number(s.active_vehicles ?? vehicles.length)} cars • {Number(s.active_drivers ?? drivers.length)} drivers
                  </div>
                </div>
              </div>

              {/* Dual Digital Signature Status */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{t('Digital Approval Signatures')}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                  <span><strong>Fleet Manager (FM):</strong> {reportApprovalPopup.fm_approved_by_name || 'Awaiting sign-off'}</span>
                  <StatusBadge label={reportApprovalPopup.fm_status} tone={reportApprovalPopup.fm_status === 'APPROVED' ? 'blue' : reportApprovalPopup.fm_status === 'REJECTED' ? 'red' : 'amber'} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                  <span><strong>Head of WS (HWS):</strong> {reportApprovalPopup.hws_approved_by_name || 'Awaiting sign-off'}</span>
                  <StatusBadge label={reportApprovalPopup.hws_status} tone={reportApprovalPopup.hws_status === 'APPROVED' ? 'blue' : reportApprovalPopup.hws_status === 'REJECTED' ? 'red' : 'amber'} />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label className="type-label" style={{ display: 'block', marginBottom: '5px' }}>
                  {t('Digital Approval Notes (Optional)')}
                </label>
                <input
                  type="text"
                  className="gf-input"
                  placeholder={t('e.g., Verified weekly mileage and operational receipts')}
                  value={reportApprovalNotes}
                  onChange={(e) => setReportApprovalNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  id="approve-report-digitally-btn"
                  type="button"
                  className="gf-btn gf-btn-primary pressable"
                  style={{ flex: 2 }}
                  disabled={reportApprovalSubmitting}
                  onClick={() => handleSubmitReportApproval(reportApprovalPopup.id, 'APPROVED')}
                >
                  <CheckCircle2 size={16} /> {myRoleStatus === 'APPROVED' ? t('Re-Sign Digitally') : t('Approve Report Digitally')}
                </button>
                <button
                  id="reject-report-digitally-btn"
                  type="button"
                  className="gf-btn gf-btn-outline-danger pressable"
                  style={{ flex: 1 }}
                  disabled={reportApprovalSubmitting}
                  onClick={() => handleSubmitReportApproval(reportApprovalPopup.id, 'REJECTED')}
                >
                  {t('Reject')}
                </button>
              </div>
              <button
                type="button"
                className="gf-btn gf-btn-ghost"
                style={{ width: '100%', marginTop: '8px', fontSize: '12.5px', color: '#64748b' }}
                onClick={() => {
                  reportApprovalSnoozedRef.current[String(reportApprovalPopup.period_key)] = true;
                  setReportApprovalPopup(null);
                }}
              >
                {t('Review Later')}
              </button>
            </div>
          </div>
        );
      })()}

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
                                  {isEv ? 'Electric' : 'Gasoline'}
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
                        <td><strong>Gasoline Fuel</strong></td>
                        <td className="mono">{Number(usageAnalytics.expensesBreakdownIdr?.gas_litres || 0).toFixed(1)} Litres</td>
                        <td>Gasoline fleet fuel refuel receipts</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatIdr(usageAnalytics.expensesBreakdownIdr?.gas_idr || 0)}</td>
                      </tr>
                      <tr>
                        <td><strong>Electric Charging (EV)</strong></td>
                        <td className="mono">{Number(usageAnalytics.expensesBreakdownIdr?.electric_kwh || 0).toFixed(1)} kWh</td>
                        <td>EV charging station kilowatt hours</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatIdr(usageAnalytics.expensesBreakdownIdr?.electric_idr || 0)}</td>
                      </tr>
                      <tr>
                        <td><strong>Tollway Operational Fees</strong></td>
                        <td>Receipt Verified</td>
                        <td>Electronic highway toll card reimbursements</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatIdr(usageAnalytics.expensesBreakdownIdr?.toll_idr || 0)}</td>
                      </tr>
                      <tr>
                        <td><strong>Facility & Parking Fees</strong></td>
                        <td>Receipt Verified</td>
                        <td>Official operational parking receipts</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatIdr(usageAnalytics.expensesBreakdownIdr?.parking_idr || 0)}</td>
                      </tr>
                      <tr>
                        <td><strong>Maintenance & Service</strong></td>
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
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                  <AlertTriangle size={18} />
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
                          Recommended for Real Fleet Launch
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#0f172a', marginTop: '6px', lineHeight: 1.5, background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ color: '#0369a1', fontWeight: 700, marginBottom: '2px' }}>
                          GUARANTEED NOT ERASED:
                        </div>
                        <div>• <strong>Vehicle License Plates & Specs:</strong> All plate numbers ({vehicles.map(v => v.registration_plate).slice(0, 5).join(', ')}{vehicles.length > 5 ? '...' : ''}), models, VINs remain fully intact.</div>
                        <div>• <strong>Driver Names & Phone Numbers:</strong> All driver profiles, contact phones, licenses, and photos remain fully intact.</div>
                        <div>• <strong>User Accounts & 13 Company Groups:</strong> All logins and department structures remain fully intact.</div>
                        <div style={{ color: '#b91c1c', fontWeight: 700, marginTop: '4px' }}>
                          ERASED ONLY:
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
                  Safety Confirmation
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
                {t('Profile Details')}
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
                {t('Change Password')}
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
                  <label className="type-caption" htmlFor="profile-contact-number" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {t('Contact Phone Number (WhatsApp / Mobile)')} <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    id="profile-contact-number"
                    type="tel"
                    className="gf-input"
                    required
                    minLength={8}
                    value={profileContactNumber}
                    onChange={(e) => setProfileContactNumber(e.target.value)}
                    placeholder="e.g. 081234567890"
                  />
                  <p className="type-caption" style={{ marginTop: '3px', color: 'var(--color-text-secondary)' }}>
                    {t('Mandatory for account recovery, password reset via Admin WhatsApp, and ride coordination.')}
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
                  For your security, enter your current password to verify your identity before setting a new password (min. 6 characters).
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

      {negotiationModalTrip && (
        <div
          className="gf-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Negotiate or Hitchhike Booking"
          style={{ zIndex: 9999 }}
          onClick={() => setNegotiationModalTrip(null)}
        >
          <div
            className="gf-modal-card"
            style={{ maxWidth: '500px', width: '94vw', display: 'flex', flexDirection: 'column', gap: '14px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
              <div>
                <h3 className="type-title" style={{ margin: 0, fontSize: '18px' }}>
                  {t('Negotiate / Hitchhike')}
                </h3>
                <p className="type-caption" style={{ margin: '2px 0 0' }}>
                  {negotiationModalTrip.make} {negotiationModalTrip.model} ({negotiationModalTrip.registration_plate})
                </p>
              </div>
              <button
                type="button"
                className="gf-btn gf-btn-secondary"
                style={{ minHeight: '32px', padding: '4px 10px' }}
                onClick={() => setNegotiationModalTrip(null)}
                aria-label={t('Close')}
              >
                <X size={15} />
              </button>
            </div>

            {/* Current Booking Holder Info Card */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: 'rgba(0, 114, 222, 0.12)',
                border: '1.5px solid rgba(59, 130, 246, 0.45)',
                color: 'var(--color-text-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, color: '#3b82f6' }}>
                  {t('Current Holder (PIC)')}: {negotiationModalTrip.requester_name || t('Booking Holder')} ({negotiationModalTrip.department_name || t('Group')})
                </span>
                <StatusBadge label={t(formatReservationModeLabel(negotiationModalTrip.reservation_type, negotiationModalTrip.return_pickup_time) || 'Standard Trip')} tone="blue" />
              </div>
              <div>
                <strong>{t('Route')}:</strong> {negotiationModalTrip.origin} → <strong>{negotiationModalTrip.destination}</strong>
              </div>
              <div>
                <strong>{t('Passengers')}:</strong>
                <div style={{ whiteSpace: 'pre-line', marginTop: '2px', paddingLeft: '14px' }}>
                  {formatPassengersMultiLine(negotiationModalTrip.passengers_json, negotiationModalTrip.passenger_nickname)}
                </div>
              </div>
              <div>
                <strong>{t('Booked Time & Duration')}:</strong>{' '}
                {new Date(negotiationModalTrip.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                {new Date(negotiationModalTrip.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                ({Math.max(1, Math.round((new Date(negotiationModalTrip.end_time).getTime() - new Date(negotiationModalTrip.start_time).getTime()) / 3600000))}h)
              </div>
            </div>

            <form onSubmit={handleSubmitNegotiation} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  {t('Choose Action')}:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    id="btn-neg-action-hitchhike"
                    type="button"
                    className="pressable"
                    onClick={() => { setNegotiationActionType('HITCHHIKE'); setNegotiationExtraPassengers([]); }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: negotiationActionType === 'HITCHHIKE' ? '2px solid #0072de' : '1px solid var(--color-border)',
                      background: negotiationActionType === 'HITCHHIKE' ? 'rgba(0, 114, 222, 0.12)' : 'var(--color-bg-surface)',
                      color: negotiationActionType === 'HITCHHIKE' ? '#0072de' : 'var(--color-text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Car size={14} /> {t('Hitchhike Ride')}
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>{t('Join this car (same destination)')}</div>
                  </button>
                  <button
                    id="btn-neg-action-cancel"
                    type="button"
                    className="pressable"
                    onClick={() => {
                      setNegotiationActionType('REQUEST_CANCEL');
                      setNegotiationExtraPassengers([]);
                      setNegotiationLocationMode('SAME');
                      setNegotiationOrigin(String(negotiationModalTrip.origin || ''));
                      setNegotiationDestination(String(negotiationModalTrip.destination || ''));
                      if (/may i hitchhike/i.test(negotiationNote)) setNegotiationNote('');
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: negotiationActionType === 'REQUEST_CANCEL' ? '2px solid #0072de' : '1px solid var(--color-border)',
                      background: negotiationActionType === 'REQUEST_CANCEL' ? 'rgba(0, 114, 222, 0.12)' : 'var(--color-bg-surface)',
                      color: negotiationActionType === 'REQUEST_CANCEL' ? '#0072de' : 'var(--color-text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <RefreshCw size={14} /> {t('Negotiate Cancel')}
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>{t('Transfer car slot (same or different location)')}</div>
                  </button>
                </div>
              </div>

              {negotiationActionType === 'REQUEST_CANCEL' && (
                <div
                  id="negotiate-cancel-route-section"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'var(--color-bg-subtle)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <label className="type-caption" style={{ fontWeight: 700 }}>
                      {t('Location for Transferred Slot')} *
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        id="btn-neg-loc-same"
                        type="button"
                        className={`gf-btn gf-btn-sm pressable ${negotiationLocationMode === 'SAME' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
                        style={{ minHeight: '28px', padding: '0 10px', fontSize: '11.5px' }}
                        onClick={() => {
                          setNegotiationLocationMode('SAME');
                          setNegotiationOrigin(String(negotiationModalTrip.origin || ''));
                          setNegotiationDestination(String(negotiationModalTrip.destination || ''));
                        }}
                      >
                        {t('Same Location')}
                      </button>
                      <button
                        id="btn-neg-loc-different"
                        type="button"
                        className={`gf-btn gf-btn-sm pressable ${negotiationLocationMode === 'DIFFERENT' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
                        style={{ minHeight: '28px', padding: '0 10px', fontSize: '11.5px' }}
                        onClick={() => {
                          setNegotiationLocationMode('DIFFERENT');
                          setNegActiveRouteField('pickup');
                          setNegGeoResults([]);
                          if (negotiationOrigin === String(negotiationModalTrip.origin || '')) setNegotiationOrigin('');
                          if (negotiationDestination === String(negotiationModalTrip.destination || '')) setNegotiationDestination('');
                        }}
                      >
                        {t('Different Location')}
                      </button>
                    </div>
                  </div>

                  {negotiationLocationMode === 'SAME' ? (
                    <div className="type-caption" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                      <strong>{t('Pickup')}:</strong> {negotiationModalTrip.origin}
                      <br />
                      <strong>{t('Destination')}:</strong> {negotiationModalTrip.destination}
                    </div>
                  ) : (
                    <div id="negotiate-route-chooser" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Booking-style Route Inputs (Pickup + Destination with active focus & clear buttons) */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          padding: '10px',
                          borderRadius: '10px',
                          background: 'var(--color-bg-surface)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <div>
                          <label className="type-caption" htmlFor="negotiate-cancel-origin" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>
                              {t('New Pickup Location')} <span style={{ color: '#dc2626' }}>*</span>
                            </span>
                            {negActiveRouteField === 'pickup' && (
                              <span style={{ fontSize: '10.5px', color: '#0072de', fontWeight: 700 }}>{t('Choosing Pickup')}</span>
                            )}
                          </label>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                              id="negotiate-cancel-origin"
                              type="text"
                              className="gf-input"
                              style={{ paddingRight: negotiationOrigin ? '34px' : undefined }}
                              required
                              placeholder={t('Search or choose pickup location')}
                              value={negotiationOrigin}
                              onFocus={() => setNegActiveRouteField('pickup')}
                              onChange={(e) => {
                                setNegActiveRouteField('pickup');
                                setNegotiationOrigin(e.target.value);
                              }}
                            />
                            {negotiationOrigin && (
                              <button
                                type="button"
                                aria-label={t('Clear pickup')}
                                onClick={() => {
                                  setNegotiationOrigin('');
                                  setNegActiveRouteField('pickup');
                                  setNegGeoResults([]);
                                }}
                                style={{
                                  position: 'absolute',
                                  right: '6px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--color-text-muted)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                }}
                              >
                                <X size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="type-caption" htmlFor="negotiate-cancel-destination" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>
                              {t('New Destination')} <span style={{ color: '#dc2626' }}>*</span>
                            </span>
                            {negActiveRouteField === 'destination' && (
                              <span style={{ fontSize: '10.5px', color: '#0072de', fontWeight: 700 }}>{t('Choosing Destination')}</span>
                            )}
                          </label>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                              id="negotiate-cancel-destination"
                              type="text"
                              className="gf-input"
                              style={{ paddingRight: negotiationDestination ? '34px' : undefined }}
                              required
                              placeholder={t('Search or choose destination')}
                              value={negotiationDestination}
                              onFocus={() => setNegActiveRouteField('destination')}
                              onChange={(e) => {
                                setNegActiveRouteField('destination');
                                setNegotiationDestination(e.target.value);
                              }}
                            />
                            {negotiationDestination && (
                              <button
                                type="button"
                                aria-label={t('Clear destination')}
                                onClick={() => {
                                  setNegotiationDestination('');
                                  setNegActiveRouteField('destination');
                                  setNegGeoResults([]);
                                }}
                                style={{
                                  position: 'absolute',
                                  right: '6px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--color-text-muted)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                }}
                              >
                                <X size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Action Bar: Current Location GPS */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            id="btn-neg-current-location"
                            type="button"
                            disabled={negLocating}
                            className="gf-btn gf-btn-secondary gf-btn-sm pressable"
                            style={{ minHeight: '30px', padding: '0 10px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            onClick={handleUseCurrentLocationForTransfer}
                          >
                            <LocateFixed size={13} style={{ color: '#0072de' }} />
                            {negLocating ? t('Locating...') : t('Use Current Location')}
                          </button>
                        </div>
                      </div>

                      {/* Live Geocode Autocomplete Suggestions */}
                      {(negGeoLoading || negGeoResults.length > 0) && (
                        <div
                          id="negotiate-geo-results"
                          style={{
                            maxHeight: '170px',
                            overflowY: 'auto',
                            borderRadius: '10px',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-surface)',
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                        >
                          {negGeoLoading ? (
                            <div className="type-caption" style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>
                              {t('Searching locations...')}
                            </div>
                          ) : (
                            negGeoResults.map((place, idx) => (
                              <button
                                key={`${place.name}-${idx}`}
                                type="button"
                                className="pressable"
                                onClick={() => {
                                  if (negActiveRouteField === 'pickup') {
                                    setNegotiationOrigin(place.name);
                                    setNegActiveRouteField('destination');
                                  } else {
                                    setNegotiationDestination(place.name);
                                  }
                                  setNegGeoResults([]);
                                }}
                                style={{
                                  textAlign: 'left',
                                  padding: '8px 10px',
                                  border: 'none',
                                  borderBottom: idx < negGeoResults.length - 1 ? '1px solid var(--color-divider)' : 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '8px',
                                }}
                              >
                                <MapPin size={14} style={{ color: '#0072de', marginTop: '2px', flexShrink: 0 }} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{place.name}</div>
                                  {place.address && (
                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {place.address}
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {/* Quick Corporate Locations & Saved Places Picker */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div className="type-caption" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {negActiveRouteField === 'pickup' ? t('Quick Locations (Tap for Pickup)') : t('Quick Locations (Tap for Destination)')}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {QUICK_CORPORATE_POIS.map((poi) => (
                            <button
                              key={poi.name}
                              type="button"
                              className="gf-btn gf-btn-secondary gf-btn-sm pressable"
                              style={{ minHeight: '28px', padding: '0 9px', fontSize: '11px', fontWeight: 600 }}
                              onClick={() => {
                                if (negActiveRouteField === 'pickup') {
                                  setNegotiationOrigin(poi.name);
                                  setNegActiveRouteField('destination');
                                } else {
                                  setNegotiationDestination(poi.name);
                                }
                                setNegGeoResults([]);
                              }}
                            >
                              {poi.label}
                            </button>
                          ))}
                          {savedPlaces.slice(0, 4).map((sp) => (
                            <button
                              key={`saved-${sp.name}`}
                              type="button"
                              className="gf-btn gf-btn-secondary gf-btn-sm pressable"
                              style={{ minHeight: '28px', padding: '0 9px', fontSize: '11px', fontWeight: 600, borderColor: 'rgba(0, 114, 222, 0.35)' }}
                              onClick={() => {
                                if (negActiveRouteField === 'pickup') {
                                  setNegotiationOrigin(sp.name);
                                  setNegActiveRouteField('destination');
                                } else {
                                  setNegotiationDestination(sp.name);
                                }
                                setNegGeoResults([]);
                              }}
                            >
                              {sp.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="type-caption" htmlFor="negotiate-cancel-purpose" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      {t('Trip Purpose (Optional)')}
                    </label>
                    <input
                      id="negotiate-cancel-purpose"
                      type="text"
                      className="gf-input"
                      placeholder={t('e.g. Client Visit / Site Inspection')}
                      value={negotiationPurpose}
                      onChange={(e) => setNegotiationPurpose(e.target.value)}
                    />
                  </div>

                  <div
                    style={{
                      fontSize: '11.5px',
                      color: '#0072de',
                      background: 'rgba(0, 114, 222, 0.08)',
                      border: '1px solid rgba(0, 114, 222, 0.22)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      lineHeight: 1.45,
                    }}
                  >
                    {t('When the current holder accepts in their Inbox, this car timeslot transfers to you automatically and will require fresh approval from the Fleet Manager & Head of WS.')}
                  </div>
                </div>
              )}

              {(() => {
                const matchedVeh = vehicles.find((v) => Number(v.id) === Number(negotiationModalTrip.vehicle_id));
                const maxSeats = Number(matchedVeh?.seats || negotiationModalTrip.seats || 5);
                const existingNames = extractIndividualPassengers(negotiationModalTrip.passengers_json, negotiationModalTrip.passenger_nickname);
                const currentPaxCount = existingNames.length || Number(negotiationModalTrip.passenger_count || 1);
                const isHitchhike = negotiationActionType === 'HITCHHIKE';
                const seatLimit = isHitchhike ? Math.max(0, maxSeats - currentPaxCount) : maxSeats;
                const totalRequested = 1 + negotiationExtraPassengers.length;
                const canAddMore = totalRequested < seatLimit;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <label className="type-caption" style={{ fontWeight: 700 }}>
                        {isHitchhike ? t('Hitchhike Passenger(s)') : t('Your Passenger(s) After Switch')} *
                      </label>
                      <span
                        id="hitchhike-seat-counter"
                        className="mono"
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 800,
                          color: seatLimit > 0 && totalRequested <= seatLimit ? '#0072de' : '#dc2626',
                        }}
                      >
                        {isHitchhike
                          ? `${t('Seats')}: ${currentPaxCount}/${maxSeats} (${seatLimit} ${t('left')})`
                          : `${t('Seats')}: ${totalRequested}/${maxSeats}`}
                      </span>
                    </div>

                    {seatLimit <= 0 ? (
                      <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(220, 38, 38, 0.12)', border: '1px solid rgba(220, 38, 38, 0.35)', color: '#ef4444', fontSize: '12.5px', fontWeight: 700 }}>
                        {t('This vehicle is full. No remaining seats available for hitchhike.')}
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span className="mono" style={{ width: '22px', fontWeight: 800, fontSize: '12.5px', color: '#0072de', flexShrink: 0 }}>1.</span>
                          <input
                            id="hitchhike-pax-0"
                            type="text"
                            className="gf-input"
                            style={{ flex: 1 }}
                            required
                            placeholder={t('Your name (Passenger 1)')}
                            value={negotiationPassengerNickname}
                            onChange={(e) => setNegotiationPassengerNickname(e.target.value)}
                          />
                        </div>
                        {negotiationExtraPassengers.map((extraName, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className="mono" style={{ width: '22px', fontWeight: 800, fontSize: '12.5px', color: '#0072de', flexShrink: 0 }}>{idx + 2}.</span>
                            <input
                              id={`hitchhike-pax-${idx + 1}`}
                              type="text"
                              className="gf-input"
                              style={{ flex: 1 }}
                              required
                              placeholder={`${t('Additional passenger')} ${idx + 2}`}
                              value={extraName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNegotiationExtraPassengers((prev) => prev.map((item, i) => (i === idx ? val : item)));
                              }}
                            />
                            <button
                              type="button"
                              className="gf-btn gf-btn-outline-danger gf-btn-sm pressable"
                              style={{ minHeight: '38px', padding: '0 10px' }}
                              aria-label={t('Remove passenger')}
                              onClick={() => setNegotiationExtraPassengers((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            id="btn-add-hitchhike-pax"
                            type="button"
                            disabled={!canAddMore}
                            className="gf-btn gf-btn-secondary gf-btn-sm pressable"
                            style={{
                              minHeight: '34px',
                              fontSize: '12.5px',
                              fontWeight: 700,
                              borderColor: canAddMore ? '#0072de' : undefined,
                              color: canAddMore ? '#0072de' : undefined,
                            }}
                            onClick={() => {
                              if (canAddMore) {
                                setNegotiationExtraPassengers((prev) => [...prev, '']);
                              }
                            }}
                          >
                            + {t('Add Another Person')} ({Math.max(0, seatLimit - totalRequested)} {t('left')})
                          </button>
                          {!canAddMore && (
                            <span className="type-caption" style={{ fontSize: '11px', color: '#d97706', fontWeight: 700 }}>
                              {t('Car seat limit reached')}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  {t('Message to')} {negotiationModalTrip.requester_name || t('Booking Holder')} ({t('Optional')})
                </label>
                <input
                  type="text"
                  className="gf-input"
                  placeholder={
                    negotiationActionType === 'HITCHHIKE'
                      ? lang === 'id'
                        ? `Searah ke ${negotiationModalTrip.destination} juga, boleh ikut nebeng?`
                        : lang === 'ko'
                        ? `${negotiationModalTrip.destination} 방면으로 이동합니다. 합승 가능할까요?`
                        : `Heading to ${negotiationModalTrip.destination} too, may I join your ride?`
                      : t('Need this car urgently for a client visit, can we coordinate?')
                  }
                  value={negotiationNote}
                  onChange={(e) => setNegotiationNote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className="gf-btn gf-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => { setNegotiationModalTrip(null); setNegotiationExtraPassengers([]); }}
                  disabled={negotiationSubmitting}
                >
                  {t('Cancel')}
                </button>
                <button
                  id="submit-negotiation-btn"
                  type="submit"
                  className="gf-btn gf-btn-primary"
                  style={{ flex: 1.4 }}
                  disabled={(() => {
                    if (negotiationSubmitting) return true;
                    const matchedVeh = vehicles.find((v) => Number(v.id) === Number(negotiationModalTrip.vehicle_id));
                    const maxSeats = Number(matchedVeh?.seats || negotiationModalTrip.seats || 5);
                    const currentPaxCount =
                      extractIndividualPassengers(negotiationModalTrip.passengers_json, negotiationModalTrip.passenger_nickname).length ||
                      Number(negotiationModalTrip.passenger_count || 1);
                    const seatLimit = negotiationActionType === 'HITCHHIKE' ? Math.max(0, maxSeats - currentPaxCount) : maxSeats;
                    return seatLimit <= 0 || 1 + negotiationExtraPassengers.length > seatLimit;
                  })()}
                >
                  {negotiationSubmitting
                    ? t('Sending...')
                    : negotiationActionType === 'HITCHHIKE'
                    ? t('Send Hitchhike Request')
                    : t('Send Cancel Negotiation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adminResetTargetUser && user?.role === 'ADM' && (
        <div
          id="admin-reset-password-modal"
          className="gf-modal-backdrop"
          style={{ zIndex: 1300 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !adminResetSubmitting) {
              setAdminResetTargetUser(null);
              setAdminResetResult(null);
            }
          }}
        >
          <div className="gf-modal-card" style={{ maxWidth: '460px', width: '94vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'rgba(0, 114, 222, 0.12)',
                    color: '#0072de',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{t('Reset User Password')}</h3>
                  <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                    {adminResetTargetUser.nickname} (@{adminResetTargetUser.group_username})
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="gf-icon-btn-48"
                style={{ width: '34px', height: '34px' }}
                onClick={() => {
                  setAdminResetTargetUser(null);
                  setAdminResetResult(null);
                }}
                aria-label={t('Close')}
              >
                <X size={16} />
              </button>
            </div>

            {adminResetResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  id="admin-reset-password-success"
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(0, 114, 222, 0.08)',
                    border: '1px solid rgba(0, 114, 222, 0.28)',
                    fontSize: '13px',
                    color: 'var(--color-text-primary)',
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#0072de', marginBottom: '6px' }}>
                    ✓ {t('Password Reset Complete')}
                  </div>
                  <div>{adminResetResult.message}</div>
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--color-bg-surface)',
                      border: '1px dashed rgba(0, 114, 222, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                        {t('New Temporary Password')}
                      </div>
                      <div id="admin-reset-temp-password-value" className="mono" style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.5px' }}>
                        {adminResetResult.temporary_password}
                      </div>
                    </div>
                    <button
                      id="admin-reset-copy-btn"
                      type="button"
                      className="gf-btn gf-btn-secondary gf-btn-sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(adminResetResult.temporary_password).catch(() => {});
                        setAdminResetCopied(true);
                      }}
                    >
                      <Copy size={14} /> {adminResetCopied ? t('Copied!') : t('Copy')}
                    </button>
                  </div>
                </div>

                {adminResetResult.whatsapp_url ? (
                  <a
                    id="admin-reset-wa-user-link"
                    href={adminResetResult.whatsapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gf-btn gf-btn-primary gf-btn-full"
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Phone size={16} /> {t('Send Password via WhatsApp (Free)')}
                  </a>
                ) : (
                  <div className="type-caption" style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                    {t('No phone number saved on this user profile. Copy and share the temporary password directly.')}
                  </div>
                )}

                <button
                  type="button"
                  className="gf-btn gf-btn-secondary gf-btn-full"
                  onClick={() => {
                    setAdminResetTargetUser(null);
                    setAdminResetResult(null);
                  }}
                >
                  {t('Done')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleAdminResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'var(--color-bg-subtle)',
                    fontSize: '12.5px',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.45,
                  }}
                >
                  {t('Set a new temporary password for this user. All active sessions for this account will be signed out immediately, and you can send the new password via free WhatsApp link.')}
                  {adminResetTargetUser.contact_number && (
                    <div style={{ marginTop: '6px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      WhatsApp: {adminResetTargetUser.contact_number}
                    </div>
                  )}
                </div>

                {adminResetError && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--color-danger-tint)',
                      color: 'var(--color-danger-text)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                    }}
                  >
                    {adminResetError}
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="type-caption" htmlFor="admin-reset-new-password" style={{ fontWeight: 700 }}>
                      {t('New Temporary Password')} <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <button
                      id="admin-reset-generate-btn"
                      type="button"
                      onClick={() => setAdminResetNewPassword(generateTempPassword())}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: '#0072de',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <RefreshCw size={12} /> {t('Generate')}
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="admin-reset-new-password"
                      className="gf-input mono"
                      type={adminResetShowPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={adminResetNewPassword}
                      onChange={(e) => setAdminResetNewPassword(e.target.value)}
                      placeholder={t('Minimum 6 characters')}
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                      }}
                      onClick={() => setAdminResetShowPassword((prev) => !prev)}
                      aria-label={adminResetShowPassword ? 'Hide password' : 'Show password'}
                    >
                      {adminResetShowPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    className="gf-btn gf-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setAdminResetTargetUser(null)}
                    disabled={adminResetSubmitting}
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    id="admin-reset-submit-btn"
                    type="submit"
                    className="gf-btn gf-btn-primary"
                    style={{ flex: 1.4 }}
                    disabled={adminResetSubmitting}
                  >
                    {adminResetSubmitting ? t('Resetting...') : t('Set New Password')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {selectedNotification && (() => {
        const sn = notifications.find((item) => Number(item.id) === Number(selectedNotification.id)) || selectedNotification;
        const isHitchhikeReq =
          sn.negotiation_action_type === 'HITCHHIKE' ||
          sn.trigger_type === 'NEGOTIATE_HITCHHIKE_REQUEST' ||
          sn.trigger_type === 'HITCHHIKE_REQUEST' ||
          /schedule negotiation.*hitchhike/i.test(String(sn.title || ''));
        const isCancelNegotiateReq =
          sn.negotiation_action_type === 'REQUEST_CANCEL' ||
          sn.trigger_type === 'NEGOTIATE_CANCEL_REQUEST' ||
          sn.trigger_type === 'CANCEL_NEGOTIATION_REQUEST' ||
          /schedule negotiation.*(cancel|transfer)/i.test(String(sn.title || ''));
        const isNegotiation = (isHitchhikeReq || isCancelNegotiateReq) && Boolean(sn.negotiation_id || sn.related_entity_id || sn.id);
        const negStatus = String(sn.negotiation_status || 'PENDING').toUpperCase();
        const isPendingDecision = isNegotiation && (!negStatus || negStatus === 'PENDING');
        const busyTargetId = sn.negotiation_id ? Number(sn.negotiation_id) : Number(sn.id || 0);
        const isBusy = Boolean(busyTargetId) && negotiationRespondBusyId === busyTargetId;
        const hitchhikerName = sn.negotiation_passenger_nickname || sn.negotiation_requester_name || 'Colleague';
        const relatedTrip = trips.find((tr) => Number(tr.id) === Number(sn.related_entity_id));
        const slotPlate = sn.negotiation_vehicle_plate || relatedTrip?.registration_plate || '';
        const slotCar = sn.negotiation_vehicle_name || (relatedTrip ? `${relatedTrip.make || ''} ${relatedTrip.model || ''}`.trim() : '');
        const slotStart = sn.negotiation_start_time || relatedTrip?.start_time || '';
        const slotEnd = sn.negotiation_end_time || relatedTrip?.end_time || '';
        const hasStructuredTransferFields = Boolean(
          sn.negotiation_requester_name ||
          sn.negotiation_origin ||
          sn.negotiation_destination ||
          sn.negotiation_message
        );

        return (
          <div
            className="gf-gcal-sheet-backdrop"
            style={{ zIndex: 9999 }}
            onClick={() => setSelectedNotification(null)}
            role="presentation"
          >
            <div
              id="notification-detail-modal"
              className="gf-gcal-sheet"
              style={{ padding: '18px 18px calc(22px + var(--safe-bottom, 0px))' }}
              role="dialog"
              aria-modal="true"
              aria-label={t('Notification Details')}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="gf-gcal-sheet-head">
                <Bell size={18} style={{ color: '#0072de', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="gf-gcal-sheet-title" style={{ fontSize: '15.5px', lineHeight: 1.3 }}>
                    {translateNotificationText(sn.title, lang)}
                  </div>
                  {sn.created_at && (
                    <div className="gf-gcal-sheet-sub" style={{ marginTop: '2px' }}>
                      {new Date(String(sn.created_at).replace(' ', 'T') + (String(sn.created_at).includes('Z') ? '' : 'Z')).toLocaleString()}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="gf-icon-btn-48 pressable"
                  style={{ width: 34, height: 34 }}
                  aria-label={t('Close')}
                  onClick={() => setSelectedNotification(null)}
                >
                  <X size={18} />
                </button>
              </div>

              {isNegotiation && isCancelNegotiateReq ? (
                <div
                  id="notification-transfer-approval-box"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'rgba(0, 114, 222, 0.08)',
                    border: '1.5px solid rgba(0, 114, 222, 0.32)',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0072de' }}>
                    {t('Car Slot Transfer Approval')}
                  </div>

                  <div id="notification-detail-body" style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px', lineHeight: 1.45, color: 'var(--color-text-primary)' }}>
                    {!hasStructuredTransferFields && sn.body && (
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{translateNotificationText(sn.body, lang)}</div>
                    )}
                    {sn.negotiation_requester_name && (
                      <div>
                        <strong>{t('Requester')}:</strong> {sn.negotiation_requester_name}
                      </div>
                    )}
                    {(slotCar || slotPlate) && (
                      <div>
                        <strong>{t('Car')}:</strong> {slotCar} {slotPlate ? `(${slotPlate})` : ''}
                      </div>
                    )}
                    {slotStart && slotEnd && (
                      <div>
                        <strong>{t('Timeslot')}:</strong>{' '}
                        {new Date(slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                        {new Date(slotEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {(sn.negotiation_origin || sn.negotiation_destination) && (
                      <div>
                        <strong>{t('New Route')}:</strong> {sn.negotiation_origin || '—'} → <strong>{sn.negotiation_destination || '—'}</strong>
                      </div>
                    )}
                    {sn.negotiation_passenger_nickname && (
                      <div>
                        <strong>{t('New Passenger(s)')}:</strong> {sn.negotiation_passenger_nickname}
                      </div>
                    )}
                    {sn.negotiation_purpose && (
                      <div>
                        <strong>{t('Purpose')}:</strong> {sn.negotiation_purpose}
                      </div>
                    )}
                    {sn.negotiation_message && (
                      <div>
                        <strong>{t('Message')}:</strong> &ldquo;{sn.negotiation_message}&rdquo;
                      </div>
                    )}
                    {isPendingDecision && (
                      <div style={{ marginTop: '4px', fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
                        {t('Approving cancels your booking and automatically transfers this car timeslot to the requester. Fresh approval from Fleet Manager & Head of WS will be required.')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                    {isPendingDecision ? (
                      <>
                        <button
                          id="modal-accept-negotiation-btn"
                          type="button"
                          disabled={isBusy}
                          className="gf-btn gf-btn-primary gf-btn-sm pressable"
                          style={{ flex: 1, minHeight: '42px' }}
                          onClick={() => handleRespondNegotiation(sn, 'ACCEPT')}
                        >
                          ✓ {t('Approve & Transfer Slot')}
                        </button>
                        <button
                          id="modal-reject-negotiation-btn"
                          type="button"
                          disabled={isBusy}
                          className="gf-btn gf-btn-outline-danger gf-btn-sm pressable"
                          style={{ minHeight: '42px', padding: '0 18px' }}
                          onClick={() => handleRespondNegotiation(sn, 'REJECT')}
                        >
                          ✕ {t('Reject')}
                        </button>
                      </>
                    ) : negStatus === 'ACCEPTED' ? (
                      <StatusBadge
                        tone="blue"
                        label={`${t('Approved')} • ${t('Transferred (Pending FM & HWS Approval)')}${sn.negotiation_transferred_trip_id ? ` #${sn.negotiation_transferred_trip_id}` : ''}`}
                      />
                    ) : (
                      <StatusBadge tone="red" label={t('Rejected')} />
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div
                    id="notification-detail-body"
                    style={{
                      fontSize: '13.5px',
                      lineHeight: 1.55,
                      color: 'var(--color-text-primary)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'rgba(148, 163, 184, 0.1)',
                      border: '1px solid var(--color-divider)',
                    }}
                  >
                    {translateNotificationText(sn.body, lang)}
                  </div>

                  {isNegotiation && (
                    <div
                      id="notification-transfer-approval-box"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        padding: '12px',
                        borderRadius: '12px',
                        background: 'rgba(0, 114, 222, 0.08)',
                        border: '1.5px solid rgba(0, 114, 222, 0.3)',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0072de' }}>
                        {t('Hitchhike Request Approval')}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {isPendingDecision ? (
                          <>
                            <button
                              id="modal-accept-negotiation-btn"
                              type="button"
                              disabled={isBusy}
                              className="gf-btn gf-btn-primary gf-btn-sm pressable"
                              style={{ flex: 1, minHeight: '40px' }}
                              onClick={() =>
                                sn.negotiation_id
                                  ? handleRespondNegotiation(sn, 'ACCEPT')
                                  : sn.related_entity_id
                                  ? handleAcceptHitchhike(Number(sn.related_entity_id), hitchhikerName, undefined, Number(sn.id))
                                  : handleRespondNegotiation(sn, 'ACCEPT')
                              }
                            >
                              ✓ {t('Accept Hitchhike')} ({hitchhikerName})
                            </button>
                            <button
                              id="modal-reject-negotiation-btn"
                              type="button"
                              disabled={isBusy}
                              className="gf-btn gf-btn-outline-danger gf-btn-sm pressable"
                              style={{ minHeight: '40px', padding: '0 16px' }}
                              onClick={() => handleRespondNegotiation(sn, 'REJECT')}
                            >
                              ✕ {t('Reject')}
                            </button>
                          </>
                        ) : negStatus === 'ACCEPTED' ? (
                          <StatusBadge tone="blue" label={`${t('Accepted')} • ${hitchhikerName} ${t('added to passengers')}`} />
                        ) : (
                          <StatusBadge tone="red" label={t('Rejected')} />
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              <button
                type="button"
                className="gf-btn gf-btn-secondary gf-btn-full pressable"
                style={{ minHeight: '40px', marginTop: '2px' }}
                onClick={() => setSelectedNotification(null)}
              >
                {t('Close')}
              </button>
            </div>
          </div>
        );
      })()}

      {enlargedPhotoModal && (
        <div
          id="odometer-photo-lightbox"
          className="gf-gcal-sheet-backdrop"
          style={{ zIndex: 10000, padding: '16px', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEnlargedPhotoModal(null)}
          role="dialog"
          aria-modal="true"
          aria-label={enlargedPhotoModal.title}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '680px',
              background: 'var(--color-bg-surface)',
              borderRadius: '14px',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--color-divider)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--color-text-primary)' }}>{enlargedPhotoModal.title}</div>
                {enlargedPhotoModal.subtitle && <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>{enlargedPhotoModal.subtitle}</div>}
              </div>
              <button
                type="button"
                className="gf-icon-btn-48 pressable"
                style={{ width: 32, height: 32 }}
                onClick={() => setEnlargedPhotoModal(null)}
                aria-label={t('Close')}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '10px', background: '#0b1120', display: 'flex', justifyContent: 'center', alignItems: 'center', maxHeight: '72vh', overflow: 'auto' }}>
              <img src={enlargedPhotoModal.src} alt={enlargedPhotoModal.title} style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain', borderRadius: '6px' }} />
            </div>
          </div>
        </div>
      )}

      {navAppModalTarget && (() => {
        const isPickupMode = navAppModalTarget.targetMode === 'PICKUP' && Boolean(navAppModalTarget.origin);
        const targetLabel = isPickupMode ? String(navAppModalTarget.origin || '') : String(navAppModalTarget.destination || '');
        const targetCoords = isPickupMode ? navAppModalTarget.originCoords : navAppModalTarget.destCoords;
        const hasCoords = Boolean(targetCoords && Number.isFinite(targetCoords.lat) && Number.isFinite(targetCoords.lon));
        const encAddr = encodeURIComponent(targetLabel);
        const latLonStr = hasCoords ? `${targetCoords!.lat},${targetCoords!.lon}` : '';

        const navApps = [
          {
            id: 'google-maps',
            name: 'Google Maps',
            desc: t('Turn-by-turn driving navigation'),
            url: hasCoords
              ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(latLonStr)}&travelmode=driving`
              : `https://www.google.com/maps/dir/?api=1&destination=${encAddr}&travelmode=driving`,
          },
          {
            id: 'waze',
            name: 'Waze',
            desc: t('Live traffic & community route'),
            url: hasCoords
              ? `https://waze.com/ul?ll=${encodeURIComponent(latLonStr)}&navigate=yes`
              : `https://waze.com/ul?q=${encAddr}&navigate=yes`,
          },
          {
            id: 'amap',
            name: 'Amap (Gaode Maps)',
            desc: t('Amap / Gaode car navigation'),
            url: hasCoords
              ? `https://uri.amap.com/navigation?to=${encodeURIComponent(`${targetCoords!.lon},${targetCoords!.lat},${targetLabel}`)}&mode=car&callnative=1`
              : `https://uri.amap.com/search?keyword=${encAddr}&callnative=1`,
          },
          {
            id: 'apple-maps',
            name: 'Apple Maps',
            desc: t('iOS / macOS driving directions'),
            url: hasCoords
              ? `https://maps.apple.com/?daddr=${encodeURIComponent(latLonStr)}&dirflg=d`
              : `https://maps.apple.com/?daddr=${encAddr}&dirflg=d`,
          },
          {
            id: 'here-wego',
            name: 'HERE WeGo',
            desc: t('Offline & highway car navigation'),
            url: hasCoords
              ? `https://share.here.com/r/mylocation/${encodeURIComponent(latLonStr)},${encAddr}`
              : `https://wego.here.com/search/${encAddr}`,
          },
        ];

        return (
          <div
            id="driver-nav-app-modal"
            className="gf-gcal-sheet-backdrop"
            style={{ zIndex: 9999 }}
            onClick={() => setNavAppModalTarget(null)}
            role="dialog"
            aria-modal="true"
            aria-label={t('Open Navigation App')}
          >
            <div className="gf-gcal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
              <div className="gf-gcal-sheet-head">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="gf-gcal-sheet-title">{t('Open Navigation App')}</div>
                  <div className="gf-gcal-sheet-sub">{t('Choose your preferred navigation app')}</div>
                </div>
                <button
                  type="button"
                  className="gf-icon-btn-48 pressable"
                  style={{ width: 34, height: 34 }}
                  aria-label={t('Close')}
                  onClick={() => setNavAppModalTarget(null)}
                >
                  <X size={18} />
                </button>
              </div>

              {navAppModalTarget.origin && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    type="button"
                    className={`gf-btn gf-btn-sm pressable ${!isPickupMode ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
                    onClick={() => setNavAppModalTarget((prev) => (prev ? { ...prev, targetMode: 'DESTINATION' } : null))}
                  >
                    {t('Destination')}
                  </button>
                  <button
                    type="button"
                    className={`gf-btn gf-btn-sm pressable ${isPickupMode ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
                    onClick={() => setNavAppModalTarget((prev) => (prev ? { ...prev, targetMode: 'PICKUP' } : null))}
                  >
                    {t('Pickup Location')}
                  </button>
                </div>
              )}

              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--color-samsung-blue-text)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  {isPickupMode ? t('Pickup Location') : t('Destination')}
                </div>
                {targetLabel}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {navApps.map((appItem) => (
                  <a
                    key={appItem.id}
                    id={`nav-app-${appItem.id}`}
                    href={appItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gf-btn gf-btn-secondary pressable"
                    style={{
                      minHeight: '44px',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onClick={() => setNavAppModalTarget(null)}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-text-primary)' }}>{appItem.name}</div>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{appItem.desc}</div>
                    </div>
                    <Navigation size={16} style={{ color: 'var(--color-samsung-blue)', flexShrink: 0 }} />
                  </a>
                ))}

                <button
                  type="button"
                  id="nav-app-copy-address"
                  className="gf-btn gf-btn-secondary gf-btn-sm pressable"
                  style={{ minHeight: '38px' }}
                  onClick={async () => {
                    try {
                      await navigator.clipboard?.writeText(targetLabel);
                      setStatusBanner({ type: 'success', text: t('Destination address copied to clipboard.') });
                    } catch {
                      setStatusBanner({ type: 'info', text: targetLabel });
                    }
                    setNavAppModalTarget(null);
                  }}
                >
                  <Copy size={14} /> {t('Copy Address for Other App')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );

  // ============================================================================
  // ADMIN CONSOLE MODE (Left Sidebar + Clean Flat Tables)
  // ============================================================================
  if (navSection === 'ADMIN' && isPrivileged) {
    const pendingPasswordResetRequests = passwordResetRequests.filter((r) => r.status === 'PENDING');
    return (
      <>
        <AdminShell
          activeModule={adminModule}
          onSelectModule={setAdminModule}
          onSignOut={handleLogout}
          onOpenProfile={handleOpenProfileModal}
          onBackToApp={() => {
            setNavSection('HOME');
            setBookingStep('HOME');
            setSheetSnap('full');
          }}
          pendingCount={pendingTrips.length + pendingUsers.length + (user.role === 'ADM' ? pendingPasswordResetRequests.length : 0)}
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
                padding: '9px 12px',
                borderRadius: '11px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                boxShadow: '0 2px 10px rgba(0, 114, 222, 0.2)',
                marginBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 180px', minWidth: 0 }}>
                <Bell size={16} style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '12px', lineHeight: 1.2 }}>{t('Enable Real-Time Notifications')}</div>
                  <div style={{ fontSize: '11px', opacity: 0.9, lineHeight: 1.25 }}>
                    {t('Get instant push alerts for car approvals, driver dispatches, and operations.')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button
                  type="button"
                  className="gf-btn gf-alert-btn"
                  style={{ background: '#ffffff', color: '#0072de', fontWeight: 800, border: 'none', padding: '4px 10px', fontSize: '11.5px', minHeight: '28px', borderRadius: '8px' }}
                  onClick={() => handleEnablePushNotifications(false)}
                >
                  {t('Allow Alerts')}
                </button>
                <button
                  type="button"
                  className="gf-btn gf-alert-btn"
                  style={{ background: 'transparent', color: '#ffffff', border: '1px solid rgba(255,255,255,0.45)', padding: '4px 10px', fontSize: '11px', minHeight: '28px', borderRadius: '8px' }}
                  onClick={() => setShowNotificationPromptBanner(false)}
                >
                  {t('Dismiss')}
                </button>
              </div>
            </div>
          )}
          {statusBanner && (
            <div
              className="gf-status-banner-compact"
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                background: statusBanner.type === 'danger' ? 'var(--color-status-red-bg)' : 'var(--color-status-green-bg)',
                color: statusBanner.type === 'danger' ? 'var(--color-status-red-fg)' : 'var(--color-status-green-fg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                fontSize: '12.5px',
              }}
            >
              <span style={{ fontWeight: 600, lineHeight: 1.35, flex: 1, minWidth: 0 }}>{t(statusBanner.text)}</span>
              <button
                type="button"
                className="gf-btn gf-btn-secondary gf-btn-sm"
                style={{ minHeight: '26px', height: '26px', padding: '0 10px', fontSize: '11.5px', borderRadius: '99px', flexShrink: 0 }}
                onClick={() => setStatusBanner(null)}
              >
                OK
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
                      Gasoline: {fleetPositions.filter((p) => p.energy_type === 'Gasoline').length} Cars
                    </span>
                    <span className="gf-badge" style={{ background: '#ebf5ff', color: '#0072de', fontWeight: 700, padding: '4px 10px' }}>
                      EV: {fleetPositions.filter((p) => p.energy_type === 'Electric').length} Cars
                    </span>
                    <span className="gf-badge" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 700, padding: '4px 10px' }}>
                      In Trip: {fleetPositions.filter((p) => p.status === 'IN_TRIP').length} Active
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
                      { id: 'DRIVING', label: `Driving / In Trip (${fleetPositions.filter((p) => p.status === 'IN_TRIP').length})` },
                      { id: 'GASOLINE', label: `Gasoline (${fleetPositions.filter((p) => p.energy_type === 'Gasoline').length})` },
                      { id: 'ELECTRIC', label: `Electric EV (${fleetPositions.filter((p) => p.energy_type === 'Electric').length})` },
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

                {/* Real-Time Fleet ETA to Samsung Jababeka Facility Monitor (FM, HWS, ADM) */}
                <div
                  className="gf-card-flat"
                  style={{
                    background: 'linear-gradient(135deg, #021a38 0%, #003873 100%)',
                    color: '#ffffff',
                    borderRadius: '16px',
                    padding: '16px 18px',
                    border: '1.5px solid rgba(255, 255, 255, 0.16)',
                    boxShadow: '0 8px 24px rgba(0, 56, 115, 0.28)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#258cfb', color: '#ffffff', padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.04em' }}>
                          SAMSUNG DESTINATION MONITOR
                        </span>
                        <span style={{ fontSize: '11px', color: '#9ecaff', fontWeight: 700 }}>
                          Live Fleet Tracking & Arrival ETA
                        </span>
                      </div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '6px 0 2px', color: '#ffffff' }}>
                        {SAMSUNG_JABABEKA_FACILITY.fullName}
                      </h3>
                      <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0 }}>
                        {SAMSUNG_JABABEKA_FACILITY.address}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <a
                        href={SAMSUNG_JABABEKA_FACILITY.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="gf-btn"
                        style={{
                          background: 'rgba(255, 255, 255, 0.18)',
                          color: '#ffffff',
                          fontSize: '11.5px',
                          padding: '6px 12px',
                          borderRadius: '9999px',
                          border: '1px solid rgba(255, 255, 255, 0.28)',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontWeight: 700,
                        }}
                      >
                        <span>Open in Google Maps ↗</span>
                      </a>
                      <span className="gf-badge" style={{ background: '#0072de', color: '#ffffff', fontWeight: 800, border: '1px solid rgba(255,255,255,0.3)' }}>
                        Hub: -6.2875, 107.1356
                      </span>
                    </div>
                  </div>

                  {/* Vehicle Cards Grid with Real-Time Road Distance & ETA to Samsung */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {fleetPositions.map((pos) => {
                      const distKm = Math.max(0.5, Number((haversineKm(pos.latitude, pos.longitude, SAMSUNG_JABABEKA_FACILITY.lat, SAMSUNG_JABABEKA_FACILITY.lon) * 1.28).toFixed(1)));
                      const etaMin = Math.max(3, Math.round(distKm * 2.3 + 4));
                      const arrivalTime = new Date(Date.now() + etaMin * 60_000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const isInTrip = pos.status === 'IN_TRIP';
                      const isFocused = focusedVehicleId === pos.id;

                      return (
                        <div
                          key={pos.id}
                          style={{
                            background: isFocused ? 'rgba(37, 140, 251, 0.38)' : 'rgba(255, 255, 255, 0.08)',
                            border: isFocused ? '1.5px solid #60a5fa' : '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '12px',
                            padding: '10px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            transition: 'all 120ms ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#ffffff' }}>
                              {pos.registration_plate}
                            </span>
                            <span
                              style={{
                                fontSize: '9.5px',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '9999px',
                                background: isInTrip ? '#fef3c7' : 'rgba(255, 255, 255, 0.2)',
                                color: isInTrip ? '#b45309' : '#ffffff',
                              }}
                            >
                              {isInTrip ? 'In Trip' : 'Standby'}
                            </span>
                          </div>

                          <div style={{ fontSize: '11.5px', color: '#9ecaff' }}>
                            {pos.make} {pos.model} • Driver: <b>{pos.driver_name?.split(' ')[0] || 'Driver'}</b>
                          </div>

                          <div style={{ background: 'rgba(0, 0, 0, 0.35)', borderRadius: '8px', padding: '6px 8px', marginTop: '2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <span style={{ fontSize: '10.5px', color: '#cbd5e1' }}>ETA to Samsung:</span>
                              <span style={{ fontSize: '13px', fontWeight: 900, color: '#60a5fa' }}>
                                ~{etaMin} min
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                              <span>Distance: <b>{distKm} km</b></span>
                              <span>Arrival: <b>{arrivalTime}</b></span>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="gf-btn"
                            style={{
                              minHeight: '28px',
                              padding: '0 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: isFocused ? '#258cfb' : 'rgba(255, 255, 255, 0.16)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                            onClick={() => {
                              setFocusedVehicleId(pos.id);
                              document.getElementById('admin-fleet-map-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                          >
                            <Navigation size={12} /> {isFocused ? 'Tracking on Map' : 'Track on Map'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Driver Quick Position Cards - Display ONLY when search query is typed */}
                {q.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="type-caption" style={{ fontWeight: 700, color: 'var(--color-samsung-blue)' }}>
                        Driver & Vehicle Search Results for &ldquo;{driverSearchQuery}&rdquo; ({filteredFleetPositions.length} found)
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
                                      {isInTrip ? 'Driving' : 'Standby'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-samsung-blue)' }}>
                                    {pos.registration_plate} • {pos.make} {pos.model}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', gap: '6px' }}>
                                    <span>{isEv ? `EV ${pos.battery_percent ?? 100}%` : 'Gasoline'}</span>
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
                                      Person Using This Car
                                    </span>
                                    {pos.active_trip.ride_duration_formatted && (
                                      <span style={{ fontSize: '10px', fontWeight: 700, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '9999px' }}>
                                        {pos.active_trip.ride_duration_formatted}
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
                                    {pos.active_trip.origin || 'HQ Pool'} → {pos.active_trip.destination}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ background: 'var(--color-bg-subtle)', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                  Parked at: <b>{pos.location_label || 'Central Fleet Pool'}</b>
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
                <div id="admin-fleet-map-canvas" className="gf-admin-map-canvas" style={{ height: '560px', width: '100%', borderRadius: '16px', overflow: 'hidden', position: 'relative', border: '1px solid var(--color-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                    <h3 className="type-title" style={{ fontSize: '15px' }}>Live Vehicle Status Directory</h3>
                    <span className="type-caption">Showing {filteredFleetPositions.length} of {fleetPositions.length} vehicles</span>
                  </div>
                  <div className="gf-desktop-only-table">
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
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <img
                                      src={getVehiclePhotoIconUrl(`${pos.make} ${pos.model}`, pos.energy_type)}
                                      alt={`${pos.make} ${pos.model}`}
                                      style={{ width: '40px', height: '40px', objectFit: 'contain', flexShrink: 0, borderRadius: '8px', background: '#f8fafc', padding: '2px', border: '1px solid #e2e8f0' }}
                                    />
                                    <div>
                                      <div style={{ fontWeight: 800 }}>{pos.registration_plate}</div>
                                      <div className="type-caption">{pos.make} {pos.model} ({pos.car_type})</div>
                                    </div>
                                  </div>
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
                  <div className="gf-mobile-only-cards">
                    {filteredFleetPositions.map((pos) => (
                      <div key={pos.id} className="gf-proto-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: focusedVehicleId === pos.id ? '#f0f7ff' : undefined }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <img
                              src={getVehiclePhotoIconUrl(`${pos.make} ${pos.model}`, pos.energy_type)}
                              alt={`${pos.make} ${pos.model}`}
                              style={{ width: '40px', height: '40px', objectFit: 'contain', flexShrink: 0, borderRadius: '8px', background: '#f8fafc', padding: '2px', border: '1px solid #e2e8f0' }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <span className="mono" style={{ fontWeight: 800, fontSize: '13.5px' }}>{pos.registration_plate}</span>
                              <div className="type-caption">{pos.make} {pos.model} ({pos.car_type})</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <StatusBadge
                              label={pos.energy_type === 'Electric' ? `EV ${pos.battery_percent ?? 100}%` : 'Gas'}
                              tone={pos.energy_type === 'Electric' ? 'green' : 'neutral'}
                            />
                            <StatusBadge
                              label={pos.status}
                              tone={pos.status === 'IN_TRIP' ? 'blue' : pos.status === 'Active' ? 'green' : 'amber'}
                            />
                          </div>
                        </div>
                        <div className="type-caption" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                          <span>Driver: <b>{pos.driver_name || 'Pool'}</b></span>
                          <span>{pos.location_label}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', paddingTop: '6px', borderTop: '1px solid var(--color-divider)' }}>
                          <button
                            type="button"
                            className="gf-proto-btn gf-proto-btn-s pressable"
                            style={{ flex: 1 }}
                            onClick={() => {
                              setFocusedVehicleId(pos.id);
                              document.getElementById('admin-fleet-map-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                          >
                            Locate on Map
                          </button>
                          {pos.driver_phone && (
                            <>
                              <a
                                href={formatWhatsAppUrl(pos.driver_phone)}
                                target="_blank"
                                rel="noreferrer"
                                className="gf-proto-btn gf-proto-btn-o gf-proto-btn-s pressable"
                                style={{ textDecoration: 'none' }}
                              >
                                WA
                              </a>
                              <a
                                href={formatPhoneCallUrl(pos.driver_phone)}
                                className="gf-proto-btn gf-proto-btn-g gf-proto-btn-s pressable"
                                style={{ textDecoration: 'none' }}
                              >
                                Call
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {adminModule === 'DRIVER_SCHEDULE' && (() => {
            const adminSchedDate = scheduleCalendarDate || todayLocalDateStr();
            const schedById = new Map<number, any>();
            for (const ct of allCalendarAuditTrips) schedById.set(Number(ct.id), ct);
            const shiftDate = (days: number) => {
              const [yy, mm, dd] = adminSchedDate.split('-').map(Number);
              const d = new Date(yy, (mm || 1) - 1, dd || 1);
              d.setDate(d.getDate() + days);
              setScheduleCalendarDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
            };

            const filteredAuditRecords = scheduleAuditRecords.filter((rec) => {
              const st = String(rec.status || '').toUpperCase();
              if (scheduleAuditStatus === 'COMPLETED' && st !== 'COMPLETED') return false;
              if (scheduleAuditStatus === 'CANCELLED' && st !== 'CANCELLED') return false;
              if (scheduleAuditStatus === 'REJECTED' && st !== 'REJECTED') return false;
              if (scheduleAuditStatus === 'PAST' && !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(st)) return false;
              if (scheduleAuditDate) {
                const s = new Date(rec.start_time);
                const localD = !Number.isNaN(s.getTime())
                  ? `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`
                  : '';
                if (localD !== scheduleAuditDate && !String(rec.start_time || '').startsWith(scheduleAuditDate)) return false;
              }
              if (scheduleAuditSearch.trim()) {
                const q = scheduleAuditSearch.trim().toLowerCase();
                const hay = [rec.id, rec.requester_name, rec.department_name, rec.registration_plate, rec.make, rec.model, rec.assigned_driver_name, rec.origin, rec.destination, rec.purpose, rec.passenger_nickname]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase();
                if (!hay.includes(q)) return false;
              }
              return true;
            });

            return (
              <section className="gf-card-flat" id="admin-driver-schedule" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '15px', margin: 0 }}>
                      <Calendar size={16} /> {t('Driver Schedule')}
                      <StatusBadge label={t('24 Hours (00:00 – 24:00)')} tone="blue" />
                    </h2>
                    <p className="type-caption" style={{ margin: '2px 0 0' }}>
                      {adminScheduleSubTab === 'ACTIVE'
                        ? t('Tap a booking to see who booked the car and who is on board')
                        : t('Completed & past schedule records preserved for audit review')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      id="btn-schedule-tab-active"
                      type="button"
                      className={`gf-btn gf-btn-sm pressable ${adminScheduleSubTab === 'ACTIVE' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
                      onClick={() => setAdminScheduleSubTab('ACTIVE')}
                    >
                      {t('Active Schedule')}
                    </button>
                    <button
                      id="btn-schedule-tab-audit"
                      type="button"
                      className={`gf-btn gf-btn-sm pressable ${adminScheduleSubTab === 'AUDIT' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
                      onClick={() => setAdminScheduleSubTab('AUDIT')}
                    >
                      {t('Past & Completed (Audit)')} ({scheduleAuditRecords.filter((r) => String(r.status).toUpperCase() === 'COMPLETED').length})
                    </button>
                  </div>
                </div>

                {adminScheduleSubTab === 'ACTIVE' ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <button type="button" className="gf-btn gf-btn-secondary gf-btn-sm" onClick={() => shiftDate(-1)} aria-label={t('Previous day')}>‹</button>
                      <input
                        id="admin-schedule-date-input"
                        type="date"
                        className="gf-input"
                        style={{ minHeight: '34px', height: '34px', padding: '0 10px', fontSize: '13px', width: 'auto' }}
                        value={adminSchedDate}
                        onChange={(e) => setScheduleCalendarDate(e.target.value)}
                      />
                      <button type="button" className="gf-btn gf-btn-secondary gf-btn-sm" onClick={() => shiftDate(1)} aria-label={t('Next day')}>›</button>
                      <button type="button" className="gf-btn gf-btn-secondary gf-btn-sm" onClick={() => setScheduleCalendarDate(todayLocalDateStr())}>
                        {t('Today')}
                      </button>
                    </div>
                    <DriverScheduleCalendar
                      vehicles={vehicles}
                      trips={Array.from(schedById.values())}
                      dateStr={adminSchedDate}
                      currentUserId={user.id}
                      showContacts
                      showOdometerPhotos
                      onOpenTrip={(tr) => {
                        const auditMatch = scheduleAuditRecords.find((x) => Number(x.id) === Number(tr.id));
                        const full = trips.find((x) => Number(x.id) === Number(tr.id)) || auditMatch || tr;
                        if (isHistoryTripRecord(full)) {
                          setSelectedAuditRecord(auditMatch ? { ...full, ...auditMatch } : full);
                          return;
                        }
                        setDispatchModalTrip(full);
                        setDispatchVehicleId(full.vehicle_id);
                        const defaultDrv = full.driver_profile_id || full.preferred_driver_id || drivers[0]?.id || '';
                        setDispatchDriverId(defaultDrv ? String(defaultDrv) : '');
                        setDispatchDecisionReason('');
                      }}
                      openTripLabel={t('Open Approval / Dispatch')}
                    />
                  </>
                ) : (
                  <div id="schedule-audit-history-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        id="schedule-audit-status-filter"
                        className="gf-input"
                        style={{ width: 'auto', minHeight: '34px', height: '34px', fontSize: '12.5px' }}
                        value={scheduleAuditStatus}
                        onChange={(e) => setScheduleAuditStatus(e.target.value as any)}
                      >
                        <option value="COMPLETED">{t('Completed Trips')}</option>
                        <option value="PAST">{t('All Past (Completed/Cancelled/Rejected)')}</option>
                        <option value="CANCELLED">{t('Cancelled')}</option>
                        <option value="REJECTED">{t('Rejected')}</option>
                        <option value="ALL">{t('All Records')}</option>
                      </select>
                      <input
                        id="schedule-audit-date-filter"
                        type="date"
                        className="gf-input"
                        style={{ width: 'auto', minHeight: '34px', height: '34px', fontSize: '12.5px' }}
                        value={scheduleAuditDate}
                        onChange={(e) => setScheduleAuditDate(e.target.value)}
                      />
                      {scheduleAuditDate && (
                        <button type="button" className="gf-btn gf-btn-ghost gf-btn-sm" onClick={() => setScheduleAuditDate('')}>
                          {t('All Dates')}
                        </button>
                      )}
                      <input
                        id="schedule-audit-search"
                        type="search"
                        className="gf-input"
                        style={{ flex: 1, minWidth: '180px', minHeight: '34px', height: '34px', fontSize: '12.5px' }}
                        placeholder={t('Search car, driver, booker, destination...')}
                        value={scheduleAuditSearch}
                        onChange={(e) => setScheduleAuditSearch(e.target.value)}
                      />
                    </div>

                    {filteredAuditRecords.length === 0 ? (
                      <EmptyState message={t('No schedule audit records match this filter.')} />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredAuditRecords.map((rec) => {
                          const sD = new Date(rec.start_time);
                          const eD = new Date(rec.end_time);
                          const st = String(rec.status || '').toUpperCase();
                          const tone = st === 'COMPLETED' ? 'blue' : st === 'CANCELLED' || st === 'REJECTED' ? 'red' : 'amber';
                          return (
                            <div
                              key={rec.id}
                              data-audit-trip-id={rec.id}
                              className="gf-proto-card pressable"
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedAuditRecord(rec)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAuditRecord(rec); } }}
                              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span className="mono" style={{ fontWeight: 800, fontSize: '12px' }}>#{rec.id}</span>
                                  <span className="mono" style={{ fontWeight: 800, fontSize: '12px', padding: '1px 6px', borderRadius: '5px', border: '1px solid var(--color-border)' }}>
                                    {rec.registration_plate}
                                  </span>
                                  <span style={{ fontWeight: 700, fontSize: '13px' }}>{rec.make} {rec.model}</span>
                                </div>
                                <StatusBadge label={st} tone={tone} />
                              </div>
                              <div className="type-caption" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <span>{sD.toLocaleDateString()} {sD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {eD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span><strong>{rec.requester_name}</strong> ({rec.department_name})</span>
                                <span>{t('Driver')}: <strong>{rec.assigned_driver_name}</strong></span>
                              </div>
                              <div style={{ fontSize: '12.5px', color: 'var(--color-text-primary)' }}>
                                {rec.origin} → <strong>{rec.destination}</strong>
                              </div>
                              <div className="type-caption" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                                <span>
                                  {t('Passengers On Board')}: {formatPassengersDisplay(rec.passengers_json, rec.passenger_nickname)}
                                  {rec.distance_km != null ? ` • ${rec.distance_km} km` : ''}
                                  {rec.start_odometer != null && rec.end_odometer != null ? ` (ODO ${rec.start_odometer} → ${rec.end_odometer})` : ''}
                                </span>
                                <span style={{ color: '#0072de', fontWeight: 700 }}>{t('View Audit Record')} →</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })()}

          {adminModule === 'ADMIN_DISPATCH' && (
            <>
              {user.role === 'ADM' && (
                <section id="admin-password-reset-requests-card" className="gf-card-flat">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14.5px' }}>
                      <KeyRound size={16} /> {t('Password Reset Requests')} ({pendingPasswordResetRequests.length})
                    </h2>
                    <span className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                      {t('Admins can also reset any user password from User & Role Management below.')}
                    </span>
                  </div>

                  {pendingPasswordResetRequests.length === 0 ? (
                    <EmptyState message={t('No pending password reset requests.')} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {pendingPasswordResetRequests.map((reqItem) => (
                        <div
                          key={reqItem.id}
                          id={`password-reset-request-${reqItem.id}`}
                          className="gf-proto-card"
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '10px',
                          }}
                        >
                          <div style={{ minWidth: '200px', flex: '1 1 240px' }}>
                            <div style={{ fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span>{reqItem.user_nickname || reqItem.group_username}</span>
                              <span className="mono type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                                @{reqItem.group_username}
                              </span>
                              <StatusBadge label={reqItem.user_role || 'EMP'} tone="blue" />
                            </div>
                            <div className="type-caption" style={{ marginTop: '3px', color: 'var(--color-text-secondary)' }}>
                              {reqItem.resolved_phone || reqItem.contact_number} • {reqItem.department_name || 'Group'} • {reqItem.created_at ? new Date(String(reqItem.created_at).replace(' ', 'T') + (String(reqItem.created_at).includes('Z') ? '' : 'Z')).toLocaleString() : ''}
                            </div>
                            {reqItem.notes && (
                              <div className="type-caption" style={{ marginTop: '4px', color: 'var(--color-text-primary)', fontStyle: 'italic' }}>
                                “{reqItem.notes}”
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              id={`handle-reset-request-${reqItem.id}`}
                              type="button"
                              className="gf-btn gf-btn-primary gf-btn-sm"
                              onClick={() =>
                                handleOpenAdminResetModal({
                                  id: Number(reqItem.user_id),
                                  nickname: reqItem.user_nickname || reqItem.group_username,
                                  group_username: reqItem.group_username,
                                  contact_number: reqItem.resolved_phone || reqItem.contact_number || '',
                                })
                              }
                            >
                              <KeyRound size={14} /> {t('Reset Password')}
                            </button>
                            <button
                              id={`dismiss-reset-request-${reqItem.id}`}
                              type="button"
                              className="gf-btn gf-btn-secondary gf-btn-sm"
                              onClick={() => handleDismissPasswordResetRequest(Number(reqItem.id))}
                            >
                              {t('Dismiss')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {user.role === 'ADM' && (
              <section className="gf-card-flat">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14.5px' }}>
                    <UserCheck size={16} /> {t('Pending Account Registrations')} ({pendingUsers.length})
                  </h2>
                  <button
                    type="button"
                    className="gf-btn gf-btn-primary gf-btn-sm"
                    style={{ minHeight: '30px', padding: '4px 10px', fontSize: '11.5px', borderRadius: '8px' }}
                    onClick={async () => {
                      const res = await apiRequest('/api/notifications/send-reminders', { method: 'POST' });
                      setStatusBanner({ type: 'success', text: `Sent ${res.sentCount} booking & dispatch push reminders.` });
                      await loadAllData(user);
                    }}
                  >
                    <Bell size={13} /> {t('Send Upcoming Push Reminders')}
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
              )}

              <section className="gf-card-flat">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <ShieldCheck size={18} /> {t('Vehicle Bookings & Dispatch Queue')} ({trips.length})
                  </h2>
                  {user.role !== 'ADM' && (
                    <button
                      type="button"
                      className="gf-btn gf-btn-primary gf-btn-sm"
                      style={{ minHeight: '30px', padding: '4px 10px', fontSize: '11.5px', borderRadius: '8px' }}
                      onClick={async () => {
                        const res = await apiRequest('/api/notifications/send-reminders', { method: 'POST' });
                        setStatusBanner({ type: 'success', text: `Sent ${res.sentCount} booking & dispatch push reminders.` });
                        await loadAllData(user);
                      }}
                    >
                      <Bell size={13} /> {t('Send Upcoming Push Reminders')}
                    </button>
                  )}
                </div>
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
                                        URGENT (&lt; 2h)
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
                                  {t.status === 'PENDING_APPROVAL' && t.requires_dual_approval && (
                                    <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                      <span style={{ color: t.pic_approved ? '#258cfb' : '#d97706' }}>
                                        {t.pic_approved ? '✓ Fleet PIC' : '1. Fleet PIC'}
                                      </span>
                                      <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                                      <span style={{ color: t.hws_approved ? '#258cfb' : t.pic_approved ? '#d97706' : 'var(--color-text-muted)' }}>
                                        {t.hws_approved ? '✓ Head of WS' : '2. Head of WS'}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className={
                                      t.status === 'PENDING_APPROVAL' && !(user.role === 'FM' && t.pic_approved)
                                        ? 'gf-btn gf-btn-primary'
                                        : 'gf-btn gf-btn-secondary'
                                    }
                                    onClick={() => {
                                      setDispatchModalTrip(t);
                                      setDispatchVehicleId(t.vehicle_id);
                                      const defaultDrv = t.driver_profile_id || t.preferred_driver_id || drivers[0]?.id || '';
                                      setDispatchDriverId(defaultDrv ? String(defaultDrv) : '');
                                      setDispatchDecisionReason('');
                                    }}
                                  >
                                    {t.status === 'PENDING_APPROVAL' && !(user.role === 'FM' && t.pic_approved)
                                      ? 'Review & Dispatch'
                                      : 'View Details'}
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
                                <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(248,113,113,0.4)' }}>
                                  URGENT (&lt; 2h)
                                </span>
                              )}
                              {formatReservationModeLabel(tr.reservation_type, tr.return_pickup_time) && (
                                <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: 'rgba(0,114,222,0.12)', color: '#258cfb', border: '1px solid rgba(37,140,251,0.35)' }}>
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

                          {tr.status === 'PENDING_APPROVAL' && tr.requires_dual_approval && (
                            <div style={{ fontSize: '11.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: tr.pic_approved ? '#258cfb' : '#d97706' }}>
                                {tr.pic_approved ? '✓ Fleet PIC' : '1. Fleet PIC'}
                              </span>
                              <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                              <span style={{ color: tr.hws_approved ? '#258cfb' : tr.pic_approved ? '#d97706' : 'var(--color-text-muted)' }}>
                                {tr.hws_approved ? '✓ Head of WS' : '2. Head of WS'}
                              </span>
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
                              {tr.status === 'PENDING_APPROVAL' && !(user.role === 'FM' && tr.pic_approved)
                                ? t('Review & Dispatch')
                                : t('View Details')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {user.role === 'ADM' && (
              <section className="gf-card-flat">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <h2 className="type-section">{t('User Registry & Account Management')} ({usersList.length})</h2>
                    <p className="type-caption">Create approved accounts, assign groups (including Driver groups), deactivate/activate, or delete users</p>
                  </div>
                </div>

                <form onSubmit={handleCreateUserByAdmin} className="gf-admin-compact-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--color-divider)' }}>
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
                                          id={`reset-user-password-${u.id}`}
                                          type="button"
                                          className="gf-btn gf-btn-secondary"
                                          style={{ minHeight: '34px', padding: '0 10px' }}
                                          onClick={() =>
                                            handleOpenAdminResetModal({
                                              id: Number(u.id),
                                              nickname: u.nickname,
                                              group_username: u.group_username,
                                              contact_number: u.contact_number || '',
                                            })
                                          }
                                          title={t('Reset user password directly')}
                                        >
                                          <KeyRound size={14} /> {t('Reset Password')}
                                        </button>
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
                                  {u.contact_number && (
                                    <div className="type-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                      {u.contact_number}
                                    </div>
                                  )}
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
                                  id={`mobile-reset-user-password-${u.id}`}
                                  type="button"
                                  className="gf-proto-btn gf-proto-btn-o gf-proto-btn-s pressable"
                                  onClick={() =>
                                    handleOpenAdminResetModal({
                                      id: Number(u.id),
                                      nickname: u.nickname,
                                      group_username: u.group_username,
                                      contact_number: u.contact_number || '',
                                    })
                                  }
                                >
                                  <KeyRound size={13} /> {t('Reset Password')}
                                </button>
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
              )}
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
                  <h2 className="type-section" style={{ marginBottom: '10px' }}>Register New Vehicle</h2>
                  <form onSubmit={handleCreateVehicle} className="gf-admin-compact-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '8px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--color-divider)' }}>
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
                      style={{ gridColumn: '1 / -1' }}
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
                      <Plus size={15} /> Add Vehicle
                    </button>
                  </form>

                  <h2 className="type-section" style={{ marginBottom: '10px' }}>Fleet Register ({vehicles.length} Cars — Edit Plate, Type & Standby)</h2>
                  {vehicles.length === 0 ? (
                    <EmptyState message="No vehicles in the fleet yet. Use the form above to add your first car." />
                  ) : (
                    <>
                      <div className="gf-desktop-only-table">
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <img
                                        src={getVehiclePhotoIconUrl(`${v.make} ${v.model}`, v.energy_type)}
                                        alt={`${v.make} ${v.model}`}
                                        style={{ width: '40px', height: '40px', objectFit: 'contain', flexShrink: 0, borderRadius: '8px', background: '#f8fafc', padding: '2px', border: '1px solid #e2e8f0' }}
                                      />
                                      <div>
                                        <div style={{ fontWeight: 700 }}>{v.make} {v.model}</div>
                                        <div className="type-caption">{v.seats} seats • VIN {v.vin}</div>
                                      </div>
                                    </div>
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
                                        {t('Details')}
                                      </button>
                                      {user.role === 'ADM' && (
                                        <button type="button" className="gf-btn gf-btn-outline-danger" onClick={() => handleDeleteVehicle(v)} title="Delete Vehicle">
                                          <Trash2 size={15} /> Delete
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="gf-mobile-only-cards">
                        {vehicles.map((v) => (
                          <div key={v.id} className="gf-proto-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <img
                                  src={getVehiclePhotoIconUrl(`${v.make} ${v.model}`, v.energy_type)}
                                  alt={`${v.make} ${v.model}`}
                                  style={{ width: '40px', height: '40px', objectFit: 'contain', flexShrink: 0, borderRadius: '8px', background: '#f8fafc', padding: '2px', border: '1px solid #e2e8f0' }}
                                />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span className="gf-proto-plt">{v.registration_plate}</span>
                                    <span style={{ fontWeight: 800, fontSize: '13.5px' }}>{v.make} {v.model}</span>
                                  </div>
                                  <div className="type-caption" style={{ marginTop: '3px' }}>
                                    {v.car_type} · {v.seats} seats · {Number(v.current_odometer || 0).toLocaleString()} km
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <StatusBadge
                                  label={v.energy_type === 'Electric' ? `EV ${v.battery_percent ?? 100}%` : 'Gas'}
                                  tone={v.energy_type === 'Electric' ? 'green' : 'neutral'}
                                />
                                <StatusBadge label={v.status} tone={toneFromStatus(v.status)} />
                              </div>
                            </div>

                            <div className="type-caption" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                              <span>Driver: <b>{v.default_driver_name || 'Pool Driver'}</b></span>
                              {v.default_driver_phone && <span className="mono">{v.default_driver_phone}</span>}
                            </div>

                            {v.standby_reason && (
                              <div className="type-caption" style={{ color: '#b45309' }}>Note: {v.standby_reason}</div>
                            )}

                            <div style={{ display: 'flex', gap: '6px', paddingTop: '6px', borderTop: '1px solid var(--color-divider)' }}>
                              <button type="button" className="gf-proto-btn gf-proto-btn-g gf-proto-btn-s pressable" style={{ flex: 1 }} onClick={() => setEditingVehicle({ ...v })}>
                                <Edit3 size={13} /> Edit
                              </button>
                              <button type="button" className="gf-proto-btn gf-proto-btn-s pressable" style={{ flex: 1 }} onClick={() => openVehicle360(v.id)}>
                                {t('Details')}
                              </button>
                              {user.role === 'ADM' && (
                                <button type="button" className="gf-proto-btn gf-proto-btn-r gf-proto-btn-s pressable" onClick={() => handleDeleteVehicle(v)} title="Delete Vehicle">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}

              {opsSubTab === 'DRIVERS' && (
                <section className="gf-card-flat">
                  <h2 className="type-section" style={{ marginBottom: '10px' }}>Register / Update Driver Profile & Group</h2>
                  <form onSubmit={handleSaveDriverProfile} className="gf-admin-compact-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--color-divider)' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', gridColumn: '1 / -1', background: 'var(--color-bg-subtle)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-divider)' }}>
                      <img
                        src={newDriverForm.photo_url || getDriverAvatarDataUri(newDriverForm.full_name || 'Driver')}
                        alt="Driver Preview"
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-samsung-blue)' }}
                      />
                      <label className="gf-btn gf-btn-secondary gf-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0, minHeight: '30px', fontSize: '12px' }}>
                        <Camera size={13} /> {newDriverForm.photo_url ? 'Change Photo' : 'Upload Photo'}
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
                          className="gf-btn gf-btn-ghost gf-btn-sm"
                          style={{ minHeight: '28px', padding: '0 8px', fontSize: '11.5px', color: 'var(--color-red)' }}
                          onClick={() => setNewDriverForm({ ...newDriverForm, photo_url: '' })}
                        >
                          Remove
                        </button>
                      )}
                      <span className="type-caption" style={{ fontSize: '11.5px' }}>
                        {newDriverForm.photo_url ? 'Custom photo attached' : 'Default avatar used if none uploaded'}
                      </span>
                    </div>
                    <button type="submit" className="gf-btn gf-btn-primary">
                      <Plus size={15} /> Save Driver
                    </button>
                  </form>

                  <h2 className="type-section" style={{ marginBottom: '10px' }}>Driver Profiles & Groups ({drivers.length})</h2>
                  {drivers.length === 0 ? (
                    <EmptyState message="No driver profiles registered yet. Approve a driver user or add a driver above." />
                  ) : (
                    <>
                      <div className="gf-desktop-only-table">
                        <div className="gf-table-wrap">
                          <table className="gf-table">
                            <thead>
                              <tr>
                                <th>Photo</th>
                                <th>Driver</th>
                                <th>Username</th>
                                <th>Driver Group</th>
                                <th>Licence</th>
                                <th>Petty Cash</th>
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
                                          onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const base64 = await compressImageFileToDataUrl(file, 900, 0.75);
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
                                  <td>
                                    <div className="mono" style={{ fontWeight: 800, color: '#0072de' }}>
                                      {formatIdr(d.petty_cash_balance ?? 500000)}
                                    </div>
                                    <button
                                      type="button"
                                      className="gf-btn gf-btn-secondary"
                                      style={{ minHeight: '24px', padding: '0 7px', fontSize: '10.5px', marginTop: '3px' }}
                                      onClick={async () => {
                                        try {
                                          await apiRequest(`/api/drivers/${d.id}/petty-cash-topup`, {
                                            method: 'POST',
                                            body: JSON.stringify({ amount: 250000 }),
                                          });
                                          setStatusBanner({ type: 'success', text: `Topped up Rp 250.000 Petty Cash for ${d.full_name}.` });
                                          await loadAllData(user);
                                        } catch (err: any) {
                                          setStatusBanner({ type: 'danger', text: err.message });
                                        }
                                      }}
                                    >
                                      + Rp 250k Top Up
                                    </button>
                                  </td>
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
                                      {user.role === 'ADM' && (
                                        <button
                                          type="button"
                                          className="gf-btn gf-btn-outline-danger"
                                          style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                                          onClick={() => handleDeleteDriver(d)}
                                          title="Delete Driver Profile"
                                        >
                                          <Trash2 size={13} /> Delete
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="gf-mobile-only-cards">
                        {drivers.map((d) => (
                          <div key={d.id} className="gf-proto-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img
                                  src={getDriverAvatarDataUri(d.full_name, d.photo_url)}
                                  alt={d.full_name}
                                  style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-divider)' }}
                                />
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '13.5px' }}>{d.full_name}</div>
                                  <div className="type-caption mono">SIM {d.licence_class}: {d.licence_number} • Petty Cash: {formatIdr(d.petty_cash_balance ?? 500000)}</div>
                                </div>
                              </div>
                              <StatusBadge label={d.availability_status} tone={toneFromStatus(d.availability_status)} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                              <select
                                className="gf-select notranslate"
                                translate="no"
                                aria-label={`Mobile group for ${d.full_name}`}
                                value={d.department_id || driverGroupId}
                                onChange={async (e) => {
                                  await apiRequest(`/api/drivers/${d.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ department_id: Number(e.target.value) }),
                                  });
                                  await loadAllData(user);
                                }}
                              >
                                {activeGroups.map((g) => (
                                  <option key={g.id} value={g.id} className="notranslate" translate="no">
                                    {g.name}
                                  </option>
                                ))}
                              </select>
                              <select
                                className="gf-select"
                                aria-label={`Mobile availability for ${d.full_name}`}
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
                            </div>
                            <div style={{ display: 'flex', gap: '6px', paddingTop: '4px', borderTop: '1px solid var(--color-divider)' }}>
                              <button
                                type="button"
                                className="gf-proto-btn gf-proto-btn-s pressable"
                                style={{ flex: 1 }}
                                onClick={async () => {
                                  try {
                                    await apiRequest(`/api/drivers/${d.id}/petty-cash-topup`, {
                                      method: 'POST',
                                      body: JSON.stringify({ amount: 250000 }),
                                    });
                                    setStatusBanner({ type: 'success', text: `Topped up Rp 250.000 Petty Cash for ${d.full_name}.` });
                                    await loadAllData(user);
                                  } catch (err: any) {
                                    setStatusBanner({ type: 'danger', text: err.message });
                                  }
                                }}
                              >
                                +Rp 250k Petty Cash
                              </button>
                              <button
                                type="button"
                                className="gf-proto-btn gf-proto-btn-g gf-proto-btn-s pressable"
                                style={{ flex: 1 }}
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
                                  setStatusBanner({ type: 'info', text: `Loaded driver ${d.full_name} into form above.` });
                                }}
                              >
                                <Edit3 size={13} /> Edit
                              </button>
                              {user.role === 'ADM' && (
                                <button
                                  type="button"
                                  className="gf-proto-btn gf-proto-btn-r gf-proto-btn-s pressable"
                                  onClick={() => handleDeleteDriver(d)}
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600 }}>{ex.category}</span>
                                  {ex.payment_source === 'PETTY_CASH' && (
                                    <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#ebf5ff', color: '#005bb5', border: '1px solid #93c5fd' }}>
                                      Petty Cash
                                    </span>
                                  )}
                                </div>
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
                              <td>
                                {(() => {
                                  const expStat = String(ex.approval_status || '').toUpperCase();
                                  const isPending = expStat === 'PENDING' || expStat === 'SUBMITTED';
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                      <StatusBadge
                                        label={ex.approval_status}
                                        tone={expStat === 'APPROVED' ? 'green' : expStat === 'REJECTED' ? 'red' : isPending ? 'blue' : 'blue'}
                                      />
                                      {ex.reimbursement_status === 'REIMBURSED' && (
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#005bb5' }}>✓ {t('Replenished to Petty Cash')}</span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td>
                                {['PENDING', 'SUBMITTED'].includes(String(ex.approval_status || '').toUpperCase()) ? (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      type="button"
                                      className="gf-btn gf-btn-primary"
                                      style={{ minHeight: '32px', padding: '0 8px', fontSize: '12px' }}
                                      onClick={async () => {
                                        try {
                                          await apiRequest(`/api/expenses/${ex.id}`, {
                                            method: 'PATCH',
                                            body: JSON.stringify({ approval_status: 'APPROVED' }),
                                          });
                                          setStatusBanner({ type: 'success', text: `Expense #${ex.id} approved & driver Petty Cash replenished.` });
                                          await loadAllData(user);
                                        } catch (err: any) {
                                          setStatusBanner({ type: 'danger', text: err.message });
                                        }
                                      }}
                                    >
                                      {t('Approve')}
                                    </button>
                                    <button
                                      type="button"
                                      className="gf-btn gf-btn-outline-danger"
                                      style={{ minHeight: '32px', padding: '0 8px', fontSize: '12px' }}
                                      onClick={async () => {
                                        try {
                                          await apiRequest(`/api/expenses/${ex.id}`, {
                                            method: 'PATCH',
                                            body: JSON.stringify({ approval_status: 'REJECTED' }),
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BarChart3 size={18} style={{ color: 'var(--color-samsung-blue)' }} /> Usage Analytics & Executive Briefing
                  </h2>
                  <p className="type-caption">Financial and operational performance summary. All expenditures strictly denominated in Indonesian Rupiah (IDR).</p>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', width: '100%' }}>
                  <a
                    href="/api/reports/executive-pdf"
                    target="_blank"
                    rel="noreferrer"
                    className="gf-btn gf-btn-primary gf-btn-sm pressable"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', minHeight: '32px', padding: '4px 10px', fontSize: '12px', flex: '1 1 auto' }}
                  >
                    <FileDown size={14} /> Open Executive Report (PDF/Print)
                  </a>
                  <button
                    type="button"
                    className="gf-btn gf-btn-secondary gf-btn-sm pressable"
                    onClick={() => setShowExecutiveReportModal(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', minHeight: '32px', padding: '4px 10px', fontSize: '12px', flex: '1 1 auto' }}
                  >
                    <Printer size={14} /> Print Executive Briefing
                  </button>
                  {user?.role === 'ADM' && (
                    <button
                      type="button"
                      className="gf-btn gf-btn-sm pressable"
                      onClick={() => setShowResetModal(true)}
                      style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', minHeight: '32px', padding: '4px 10px', fontSize: '12px', flex: '1 1 auto' }}
                      title="Reset test operational data to insert real data"
                    >
                      <Trash2 size={13} /> Reset Test Data & Setup Real Fleet
                    </button>
                  )}
                </div>
              </div>

              {/* Digital Summary Report Approvals (Weekly on Friday & End of Month) */}
              <section className="gf-card-flat" style={{ marginBottom: '12px', borderLeft: '4px solid #0072de' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <div>
                    <h3 className="type-section" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px' }}>
                      <ShieldCheck size={16} style={{ color: '#0072de' }} /> {t('Digital Report Approvals (Weekly Friday & End of Month)')}
                    </h3>
                    <p className="type-caption" style={{ margin: '2px 0 0' }}>
                      {t('Auto-prompts Fleet Manager & Head of WS every Friday and End of Month for digital sign-off.')}
                    </p>
                  </div>
                </div>
                {reportApprovals.length === 0 ? (
                  <EmptyState message={t('No periodic summary reports generated yet.')} />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                    {reportApprovals.slice(0, 4).map((rep) => {
                      const s = rep.summary || {};
                      const canSign = user?.role === 'FM' || user?.role === 'HWS';
                      const myStatus = user?.role === 'FM' ? rep.fm_status : rep.hws_status;
                      return (
                        <div key={rep.id} className="gf-proto-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            <div>
                              <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#0072de', textTransform: 'uppercase' }}>
                                {rep.period_type === 'WEEKLY' ? 'Weekly • Friday' : 'Monthly • End of Month'}
                              </span>
                              <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#0f172a' }}>{rep.period_label}</div>
                            </div>
                            <StatusBadge
                              label={rep.overall_status}
                              tone={rep.overall_status === 'APPROVED' ? 'blue' : rep.overall_status === 'REJECTED' ? 'red' : 'amber'}
                            />
                          </div>

                          <div className="type-caption" style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                            <span>Trips: <b>{Number(s.completed_trips ?? 0)}/{Number(s.total_trips ?? 0)}</b></span>
                            <span>Dist: <b>{Number(s.total_distance_km ?? 0)} km</b></span>
                            <span>Cost: <b>{formatIdr(Number(s.total_operational_cost_idr ?? 0))}</b></span>
                          </div>

                          <div style={{ fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '4px', background: '#f8fafc', padding: '8px', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                              <span><strong>FM:</strong> {rep.fm_approved_by_name || 'Pending'}</span>
                              <span className="mono" style={{ fontSize: '10.5px', color: rep.fm_status === 'APPROVED' ? '#0072de' : '#64748b' }}>
                                {rep.fm_signature_hash || rep.fm_status}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                              <span><strong>HWS:</strong> {rep.hws_approved_by_name || 'Pending'}</span>
                              <span className="mono" style={{ fontSize: '10.5px', color: rep.hws_status === 'APPROVED' ? '#0072de' : '#64748b' }}>
                                {rep.hws_signature_hash || rep.hws_status}
                              </span>
                            </div>
                          </div>

                          {canSign && (
                            <button
                              type="button"
                              className="gf-btn gf-btn-primary gf-btn-sm pressable"
                              style={{ width: '100%', minHeight: '34px', fontSize: '12px' }}
                              onClick={() => {
                                setReportApprovalNotes('');
                                setReportApprovalPopup(rep);
                              }}
                            >
                              <CheckCircle2 size={14} /> {myStatus === 'PENDING' ? t('Approve Digitally') : t('Review / Update Signature')}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

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
                  <div className="type-title mono" style={{ fontSize: '16px', color: '#005bb5' }}>
                    {usageAnalytics.tripDurationSummary?.totalDurationFormatted || '0 Hours 0 Minutes'}
                  </div>
                  <div className="type-caption">Cumulative driving hours count</div>
                </div>
                <div className="gf-card-flat">
                  <div className="type-caption">TOTAL OPERATING COST (IDR)</div>
                  <div className="type-title mono" style={{ fontSize: '16px', color: '#b45309' }}>
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
              <div className="gf-kpi-grid" style={{ marginBottom: '12px' }}>
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
                              <div className="type-caption">{t.destination}</div>
                            </td>
                            <td className="mono">{t.distance_km || 0} km</td>
                            <td>
                              <span className="gf-badge" style={{ background: '#ebf5ff', color: '#005bb5', fontWeight: 800 }}>
                                {t.durationFormatted}
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
              <section className="gf-card-flat" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <h2 className="type-section">Vehicle Usage & Cost Breakdown (IDR)</h2>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {(['day', 'week', 'month', 'overall'] as const).map((p) => (
                      <Chip key={p} active={usagePeriod === p} onClick={() => setUsagePeriod(p)}>{p.toUpperCase()}</Chip>
                    ))}
                  </div>
                </div>
                <div className="gf-desktop-only-table">
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
                </div>
                <div className="gf-mobile-only-cards">
                  {usageAnalytics.perVehicle.map((v: any) => (
                    <div key={v.vehicle_id} className="gf-proto-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="gf-proto-plt">{v.registration_plate}</span>
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>{v.make} {v.model}</span>
                        </div>
                        <div className="type-caption" style={{ marginTop: '3px' }}>
                          {v[usagePeriod]?.distanceKm ?? v.overall.distanceKm} km ({v[usagePeriod]?.trips ?? v.overall.trips} trips) · {v.energy_type}
                        </div>
                      </div>
                      <div className="mono" style={{ fontWeight: 800, fontSize: '12.5px', color: '#0072de', textAlign: 'right' }}>
                        {formatIdr(v.totalOperatingCost)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Driver Usage Summary Table */}
              <section className="gf-card-flat">
                <h2 className="type-section" style={{ marginBottom: '10px' }}>Driver Operational Usage Summary</h2>
                <div className="gf-desktop-only-table">
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
                </div>
                <div className="gf-mobile-only-cards">
                  {usageAnalytics.perDriver.map((d: any) => (
                    <div key={d.driver_profile_id} className="gf-proto-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '13.5px' }}>{d.driver_name}</div>
                        <div className="type-caption">
                          Month: {d.month.distanceKm} km ({d.month.trips}) · Total: {d.overall.distanceKm} km ({d.overall.trips})
                        </div>
                      </div>
                      <StatusBadge label={d.availability_status} tone="green" />
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* DEDICATED AUDIT TRAIL MODULE (Independent from Analytics) */}
          {adminModule === 'AUDIT' && (
            <>
              <section className="gf-card-flat" id="audit-completed-schedule-section" style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <div>
                    <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                      <Calendar size={17} style={{ color: 'var(--color-samsung-blue)' }} /> {t('Past & Completed Schedule Records (Audit)')} ({scheduleAuditRecords.filter((r) => ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(String(r.status).toUpperCase())).length})
                    </h2>
                    <p className="type-caption" style={{ margin: '2px 0 0' }}>{t('Review completed bookings, passengers, routes, odometer readings, and approval decisions.')}</p>
                  </div>
                  <button
                    type="button"
                    className="gf-btn gf-btn-secondary gf-btn-sm pressable"
                    onClick={() => {
                      setAdminScheduleSubTab('AUDIT');
                      setAdminModule('DRIVER_SCHEDULE');
                    }}
                  >
                    {t('Open Full Schedule Audit')} →
                  </button>
                </div>
                {scheduleAuditRecords.filter((r) => ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(String(r.status).toUpperCase())).length === 0 ? (
                  <EmptyState message={t('No completed or past bookings recorded yet.')} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {scheduleAuditRecords
                      .filter((r) => ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(String(r.status).toUpperCase()))
                      .slice(0, 15)
                      .map((rec) => {
                        const sD = new Date(rec.start_time);
                        const st = String(rec.status || '').toUpperCase();
                        return (
                          <div
                            key={rec.id}
                            className="gf-proto-card pressable"
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedAuditRecord(rec)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAuditRecord(rec); } }}
                            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: '13px' }}>
                                <span className="mono">#{rec.id}</span> • <span className="mono">{rec.registration_plate}</span> ({rec.make} {rec.model}) — {rec.requester_name}
                              </div>
                              <div className="type-caption">
                                {sD.toLocaleDateString()} • {rec.origin} → {rec.destination}
                                {rec.distance_km != null ? ` • ${rec.distance_km} km` : ''}
                              </div>
                            </div>
                            <StatusBadge label={st} tone={st === 'COMPLETED' ? 'blue' : 'red'} />
                          </div>
                        );
                      })}
                  </div>
                )}
              </section>

              <section className="gf-card-flat">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ScrollText size={18} style={{ color: 'var(--color-samsung-blue)' }} /> System Audit Trail ({auditEvents.length} Recorded Events)
                  </h2>
                  <p className="type-caption">Immutable security log of all system transactions, driver check-ins, trip odometer verifications, and approvals.</p>
                </div>
                <input
                  type="search"
                  className="gf-input"
                  style={{ maxWidth: '280px', minHeight: '36px' }}
                  placeholder="Filter by action or actor..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                />
              </div>

              <div className="gf-desktop-only-table">
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
              </div>

              <div className="gf-mobile-only-cards">
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
                    <div key={ev.id} className="gf-proto-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <span className="gf-badge" style={{ fontWeight: 700, fontSize: '10.5px', background: '#ebf5ff', color: '#005bb5' }}>
                          {ev.action}
                        </span>
                        <span className="mono type-caption" style={{ fontSize: '10.5px' }}>{ev.created_at}</span>
                      </div>
                      <div className="type-caption">
                        <b>{ev.actor_username}</b> ({ev.actor_role}) · <span className="mono">{ev.entity_type} {ev.entity_id ? `#${ev.entity_id}` : ''}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
            </>
          )}

          {selectedAuditRecord && (() => {
            const rec = selectedAuditRecord;
            const sD = new Date(rec.start_time);
            const eD = new Date(rec.end_time);
            const st = String(rec.status || '').toUpperCase();
            return (
              <div className="gf-gcal-sheet-backdrop" onClick={() => setSelectedAuditRecord(null)} role="presentation">
                <div
                  id="audit-trip-detail-modal"
                  className="gf-gcal-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label={t('Schedule Audit Record')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="gf-gcal-sheet-head">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="gf-gcal-sheet-title">
                        {t('Booking Audit')} #{rec.id} • {rec.registration_plate}
                      </div>
                      <div className="gf-gcal-sheet-sub">
                        {rec.make} {rec.model} • {st}
                      </div>
                    </div>
                    <button type="button" className="gf-icon-btn-48 pressable" style={{ width: 34, height: 34 }} aria-label={t('Close')} onClick={() => setSelectedAuditRecord(null)}>
                      <X size={18} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                    <div><strong>{t('Booker')}:</strong> {rec.requester_name} ({rec.department_name})</div>
                    <div><strong>{t('Driver')}:</strong> {rec.assigned_driver_name || t('Pool Driver')}</div>
                    <div><strong>{t('Schedule')}:</strong> {sD.toLocaleString()} – {eD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    {rec.actual_start_time && <div><strong>{t('Actual Trip Time')}:</strong> {new Date(rec.actual_start_time).toLocaleString()} → {rec.actual_end_time ? new Date(rec.actual_end_time).toLocaleString() : '-'}</div>}
                    <div><strong>{t('Route')}:</strong> {rec.origin} → {rec.destination}</div>
                    <div><strong>{t('Purpose')}:</strong> {rec.purpose}</div>
                    <div><strong>{t('Passengers On Board')}:</strong> {formatPassengersDisplay(rec.passengers_json, rec.passenger_nickname)} ({rec.passenger_count || 1})</div>
                    {(rec.start_odometer != null ||
                      rec.end_odometer != null ||
                      rec.distance_km != null ||
                      rec.start_odometer_photo_url ||
                      rec.end_odometer_photo_url ||
                      st === 'COMPLETED' ||
                      st === 'IN_PROGRESS') && (
                      <div
                        id="audit-odometer-photos"
                        style={{
                          marginTop: '4px',
                          padding: '10px',
                          borderRadius: '10px',
                          background: 'var(--color-bg-subtle)',
                          border: '1px solid var(--color-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                            <Gauge size={14} style={{ color: 'var(--color-samsung-blue)' }} />
                            {t('Odometer & Distance')}
                          </span>
                          <span className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-samsung-blue-text)' }}>
                            {rec.start_odometer ?? '-'} → {rec.end_odometer ?? '-'} km ({rec.distance_km ?? 0} km)
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {rec.start_odometer_photo_url ? (
                            <button
                              type="button"
                              className="pressable"
                              data-testid="audit-start-odo-photo"
                              onClick={() =>
                                setEnlargedPhotoModal({
                                  src: rec.start_odometer_photo_url,
                                  title: `${t('Start Odometer Photo')} — #${rec.id}`,
                                  subtitle: `${rec.registration_plate || ''} • ${rec.start_odometer ?? '-'} km`,
                                })
                              }
                              style={{
                                padding: 0,
                                border: '1px solid var(--color-border)',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                background: 'var(--color-bg-surface)',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <img
                                src={rec.start_odometer_photo_url}
                                alt={t('Start Odometer Photo')}
                                style={{ width: '100%', height: '92px', objectFit: 'cover', display: 'block' }}
                              />
                              <div style={{ padding: '4px 6px', fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{t('Start Odo')}</span>
                                <span style={{ color: 'var(--color-samsung-blue-text)', fontSize: '10px' }}>{t('Tap to enlarge')}</span>
                              </div>
                            </button>
                          ) : (
                            <div style={{ padding: '14px 8px', borderRadius: '8px', border: '1px dashed var(--color-border)', textAlign: 'center', fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <Camera size={14} />
                              <span>{t('No start photo')}</span>
                            </div>
                          )}

                          {rec.end_odometer_photo_url ? (
                            <button
                              type="button"
                              className="pressable"
                              data-testid="audit-end-odo-photo"
                              onClick={() =>
                                setEnlargedPhotoModal({
                                  src: rec.end_odometer_photo_url,
                                  title: `${t('End Odometer Photo')} — #${rec.id}`,
                                  subtitle: `${rec.registration_plate || ''} • ${rec.end_odometer ?? '-'} km (${rec.distance_km ?? 0} km)`,
                                })
                              }
                              style={{
                                padding: 0,
                                border: '1px solid var(--color-border)',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                background: 'var(--color-bg-surface)',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <img
                                src={rec.end_odometer_photo_url}
                                alt={t('End Odometer Photo')}
                                style={{ width: '100%', height: '92px', objectFit: 'cover', display: 'block' }}
                              />
                              <div style={{ padding: '4px 6px', fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{t('End Odo')}</span>
                                <span style={{ color: 'var(--color-samsung-blue-text)', fontSize: '10px' }}>{t('Tap to enlarge')}</span>
                              </div>
                            </button>
                          ) : (
                            <div style={{ padding: '14px 8px', borderRadius: '8px', border: '1px dashed var(--color-border)', textAlign: 'center', fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <Camera size={14} />
                              <span>{t('No end photo')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {rec.transferred_to_trip_id && <div><strong>{t('Transferred To')}:</strong> #{rec.transferred_to_trip_id}</div>}
                    {rec.transferred_from_trip_id && <div><strong>{t('Transferred From')}:</strong> #{rec.transferred_from_trip_id}</div>}
                    {rec.cancellation_reason && <div><strong>{t('Cancellation Reason')}:</strong> {rec.cancellation_reason}</div>}
                    {Array.isArray(rec.decisions) && rec.decisions.length > 0 && (
                      <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px solid var(--color-divider)' }}>
                        <strong>{t('Approval History')}:</strong>
                        <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '12px' }}>
                          {rec.decisions.map((d: any) => (
                            <li key={d.id}>
                              <strong>{d.decider_role}</strong> ({d.decider_name}): {d.decision}{d.reason ? ` — "${d.reason}"` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <button type="button" className="gf-btn gf-btn-secondary gf-btn-full pressable" style={{ minHeight: '38px', marginTop: '6px' }} onClick={() => setSelectedAuditRecord(null)}>
                    {t('Close')}
                  </button>
                </div>
              </div>
            );
          })()}
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
      ? focusedTrip?.origin || bookOrigin || ''
      : bookOrigin || '';
  const mapDest =
    bookingStep === 'WAITING' || bookingStep === 'IN_TRIP'
      ? focusedTrip?.destination || bookDest
      : bookDest;

  const showRouteOnMap =
    navSection === 'HOME' &&
    ((bookingStep === 'ROUTE' && Boolean(bookDest.trim()) && routeTab !== 'PIN') ||
      bookingStep === 'VEHICLE' ||
      bookingStep === 'SUMMARY' ||
      bookingStep === 'WAITING' ||
      bookingStep === 'IN_TRIP');

  // Map only appears when user is actively booking a car (or compact Driver duty header)
  const isCarBookingMapStep =
    navSection === 'HOME' &&
    (bookingStep === 'ROUTE' ||
      bookingStep === 'VEHICLE' ||
      bookingStep === 'SUMMARY' ||
      bookingStep === 'WAITING' ||
      bookingStep === 'IN_TRIP');

  const showBookingMap = isCarBookingMapStep || (user.role === 'DRV' && navSection === 'DRIVER' && driverSectionTab === 'DISPATCH');

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
      setSheetSnap('full');
    } else if (bookingStep === 'VEHICLE') {
      setBookingStep('ROUTE');
      setSheetSnap('half');
    } else if (bookingStep === 'SUMMARY') {
      setBookingStep('VEHICLE');
      setSheetSnap('half');
    } else if (bookingStep === 'WAITING' || bookingStep === 'IN_TRIP') {
      setBookingStep('HOME');
      setSheetSnap('full');
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
                  setSheetSnap('half');
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
                setSheetSnap('half');
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
                  {`${currentMetrics.distanceKm} km • ~${currentMetrics.durationMin} min ride`}
                </div>
              </div>
              <button
                id="route-continue-btn"
                type="button"
                className="gf-btn gf-btn-primary"
                onClick={() => {
                  setBookingStep('VEHICLE');
                  setSheetSnap('half');
                }}
              >
                {t('Continue to Trip Form')}
              </button>
            </div>
          </StickyActionBar>
        );
      }
    } else if (bookingStep === 'VEHICLE') {
      const isPurposeFilled = Boolean(bookPurpose.trim());
      const isPassengerFilled = bookPassengers.length > 0 && bookPassengers.every((p) => Boolean(p.nickname.trim()));
      const canDirectSubmit = isPurposeFilled && isPassengerFilled;

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
              onClick={() => {
                if (canDirectSubmit) {
                  handleCreateTripBooking(true);
                } else {
                  setStatusBanner({
                    type: 'danger',
                    text: !isPurposeFilled
                      ? 'Please fill in Trip Purpose before submitting.'
                      : 'Please fill in at least Passenger 1 Name before submitting.',
                  });
                }
              }}
            >
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, overflow: 'hidden' }}>
                <span style={{ width: '100%', textAlign: 'left', fontSize: '14.5px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t('Submit Trip Request')}
                </span>
                <span style={{ width: '100%', textAlign: 'left', fontSize: '11.5px', fontWeight: 600, opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getScheduleSlotBrief(bookStart, lang)} • {t('Car assigned by Fleet Manager')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {bookReservationType === 'FULL_DAY'
                    ? t('Full Day')
                    : bookReservationType === 'DROP_AND_PICKUP'
                    ? t('Round Trip')
                    : t('Standard Trip')}
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
                ? ' • Round Trip'
                : ' • Standard Trip'}{' '}
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
                      ? `${t('Mandatory to fill Purpose & Passengers')}`
                      : !isPurposeFilled
                      ? `${t('Trip Purpose is mandatory.')}`
                      : `${t('Passenger data is mandatory.')}`}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 800 }}>
                  {bookReservationType === 'FULL_DAY'
                    ? t('Full Day')
                    : bookReservationType === 'DROP_AND_PICKUP'
                    ? t('Round Trip')
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
            <span className="type-caption" style={{ fontWeight: 700, color: 'inherit' }}>{t(statusBanner.text)}</span>
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
    if (navSection === 'DRIVER' && user.role === 'DRV') {
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
              <DisplayModeToggle variant="icon" id="driver-display-mode-toggle" />
              <LanguageSwitcher compact />
              <StatusBadge label={driverCheckedInReady ? t('Online & Checked In') : t('Offline / Standby')} tone={driverCheckedInReady ? 'blue' : 'amber'} />
              <button
                type="button"
                id="driver-close-drawer-btn"
                className="pressable"
                onClick={() => {
                  setDriverSectionTab('DISPATCH');
                  setDriverDispatchDrawerOpen(false);
                }}
                title={t('Back to Full Map')}
                aria-label={t('Back to Full Map')}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-subtle)',
                  color: 'var(--color-text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={18} />
              </button>
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
              {['ADM', 'FM', 'HWS'].includes(user.role) ? (
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
              ) : (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#ebf5ff',
                    border: '1px solid #93c5fd',
                    color: '#005bb5',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Lock size={15} style={{ flexShrink: 0 }} />
                  <span>
                    {t('Drivers can view their own assigned schedule only. Full fleet schedule is restricted to Admin, Fleet PIC, and Head of WS.')}
                  </span>
                </div>
              )}

              {/* My Driver Agenda */}
              {(() => {
                const myAgenda = trips.filter(
                  (t) =>
                    (t.assigned_driver_user_id === user.id ||
                      (t.assigned_driver_name && t.assigned_driver_name.toLowerCase() === (user.nickname || '').toLowerCase()) ||
                      (dedicatedCar && t.vehicle_id === dedicatedCar.id)) &&
                    t.status !== 'CANCELLED' &&
                    t.status !== 'REJECTED'
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
                      <span className="type-section" style={{ fontSize: '15px' }}>{t('My Driver Agenda (Today)')}</span>
                      <StatusBadge label={`${myAgenda.length} ${t('Trips')}`} tone="blue" />
                    </div>
                    {myAgenda.length === 0 ? (
                      <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                        {t('No trips scheduled for you today. On standby.')}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {myAgenda.map((tItem) => (
                          <div
                            key={tItem.id}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-control)',
                              background: 'var(--color-surface)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span className="mono" style={{ fontWeight: 700, fontSize: '13px' }}>
                                {new Date(tItem.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(tItem.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(tItem.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {formatReservationModeLabel(tItem.reservation_type, tItem.return_pickup_time) && (
                                  <StatusBadge label={formatReservationModeLabel(tItem.reservation_type, tItem.return_pickup_time)!} tone="blue" />
                                )}
                                <StatusBadge label={tItem.status} tone={toneFromStatus(tItem.status)} />
                              </div>
                            </div>
                            <div className="type-caption" style={{ marginTop: '4px', fontWeight: 600 }}>
                              {tItem.origin} → {tItem.destination}
                            </div>
                            <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                              {t('Passengers')}: {tItem.passenger_nickname || 'Team'} • <span className="notranslate" translate="no">{tItem.department_name}</span> • {t('Car')}: {tItem.registration_plate}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Cars Live Availability and Time Schedule (Scoped to own dedicated car for DRV, or all cars for ADM/FM/HWS) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {vehicles
                  .filter((v) => {
                    if (!['ADM', 'FM', 'HWS'].includes(user.role)) {
                      return Boolean(dedicatedCar && v.id === dedicatedCar.id);
                    }
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
                              {t('Driver')}: <strong>{v.default_driver_name || 'Pool Driver'}</strong>
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
                            <span>00:00</span>
                            <span>06:00</span>
                            <span>12:00</span>
                            <span>18:00</span>
                            <span>24:00</span>
                          </div>
                          <div className="gf-timeline-track" style={{ position: 'relative' }}>
                            {vehicleTripsToday.map((t) => {
                              const startH = new Date(t.start_time).getHours() + new Date(t.start_time).getMinutes() / 60;
                              const endH = new Date(t.end_time).getHours() + new Date(t.end_time).getMinutes() / 60;
                              const leftPct = Math.max(0, Math.min(100, (startH / 24) * 100));
                              const widthPct = Math.max(4, Math.min(100 - leftPct, (Math.max(0.5, endH - startH) / 24) * 100));
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
                              {t('Free all day')}
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
              {/* Item 6: Driver Online Status Bar (No separate "Ready for Duty" button — Online toggle automatically activates duty) */}
              <div
                className="gf-proto-card"
                style={{
                  borderColor: driverCheckedInReady ? 'var(--color-samsung-blue)' : 'var(--color-divider)',
                  background: driverCheckedInReady ? 'var(--color-samsung-blue-tint)' : 'var(--color-bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: driverCheckedInReady ? '#0072de' : '#94a3b8',
                      boxShadow: driverCheckedInReady ? '0 0 0 3px rgba(0, 114, 222, 0.2)' : 'none',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div className="type-body" style={{ fontWeight: 800, fontSize: '13.5px' }}>
                      {driverCheckedInReady ? t('Online & Ready for Duty') : t('Offline / Standby')}
                    </div>
                    <div className="type-caption" style={{ color: 'var(--color-text-secondary)', fontSize: '11.5px' }}>
                      {driverCheckedInReady
                        ? t('Automatically ready when Online is active')
                        : t('Tap Online to automatically go on duty')}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    id="driver-online-toggle-sheet-btn"
                    type="button"
                    className={`gf-btn ${driverCheckedInReady ? 'gf-btn-secondary' : 'gf-btn-primary'}`}
                    style={{ minHeight: '34px', padding: '0 12px', fontSize: '12px' }}
                    onClick={async () => {
                      if (driverCheckedInReady) {
                        setGpsReportingActive(false);
                        setGpsNoticeAccepted(false);
                        setStatusBanner({ type: 'info', text: t('Status updated to Offline') });
                      } else {
                        setGpsNoticeAccepted(true);
                        setGpsReportingActive(true);
                        detectAndReportUserLocation(true);
                        await sendDriverLocationReport('GRANTED');
                        setStatusBanner({ type: 'success', text: t('You are now Online and automatically Ready for Duty!') });
                      }
                    }}
                  >
                    <Power size={14} /> {driverCheckedInReady ? t('Go Offline') : t('Online')}
                  </button>
                </div>
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
                        {new Date(d.effective_start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – {new Date(d.effective_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {d.reservation_type === 'DROP_AND_PICKUP' && d.return_pickup_time && (
                          <span style={{ color: '#005bb5', fontWeight: 700 }}>
                            {' '}• Post-Event Pick-Up: {new Date(d.return_pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="type-caption">
                      {t('Passenger')}: {d.requester_name} ({d.passenger_count} {t('pax')}) • {t('Odo')}: {d.current_odometer} km
                      {d.energy_type === 'Electric' ? ` • ${d.battery_percent ?? 100}%` : ''}
                    </div>

                    {!isCompleted && tripId && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          id={`driver-view-route-btn-${tripId}`}
                          type="button"
                          className="gf-btn gf-btn-secondary gf-btn-sm pressable"
                          style={{ flex: '1 1 130px', minHeight: '36px', fontSize: '12px', fontWeight: 700 }}
                          onClick={() => {
                            setDriverSelectedTripId(Number(tripId));
                            setDriverDispatchDrawerOpen(false);
                          }}
                        >
                          <MapPin size={14} /> {t('View Route on Map')}
                        </button>
                        <button
                          id={`driver-navigate-btn-${tripId}`}
                          type="button"
                          className="gf-btn gf-btn-primary gf-btn-sm pressable"
                          style={{ flex: '1 1 130px', minHeight: '36px', fontSize: '12px', fontWeight: 800 }}
                          onClick={() => {
                            setDriverSelectedTripId(Number(tripId));
                            const sameSelected = Number(activeDriverDispatch?.trip_request_id) === Number(tripId);
                            setNavAppModalTarget({
                              tripId: Number(tripId),
                              origin: d.origin || '',
                              destination: d.destination || '',
                              originCoords: sameSelected ? driverOriginCoords : null,
                              destCoords: sameSelected ? driverDestCoords : null,
                              targetMode: 'DESTINATION',
                            });
                          }}
                        >
                          <Navigation size={14} /> {t('Navigate')}
                        </button>
                      </div>
                    )}

                    {!isCompleted && tripId && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-divider)' }}>
                        <div
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            background: '#ebf5ff',
                            border: '1px solid #bfdbfe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#005bb5',
                          }}
                        >
                          <span>✓ {t('Auto-Accepted Order')}</span>
                          <span style={{ fontSize: '11px', fontWeight: 600 }}>
                            {isInProgress ? t('Trip in Progress') : t('Take odometer photo & type reading to start')}
                          </span>
                        </div>
                        {!isInProgress ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ border: '1.5px solid #bfdbfe', background: '#eff6ff', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                                <label htmlFor={`start-odo-file-${tripId}`} style={{ fontWeight: 800, fontSize: '13px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Camera size={16} /> 1. {t('Mandatory Start Odometer Photo')} *
                                </label>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                  {startOdoTime[tripId] ? `Recorded: ${startOdoTime[tripId]}` : t('Photo required for verification')}
                                </span>
                              </div>
                              <input
                                type="file"
                                id={`start-odo-file-${tripId}`}
                                accept="image/*"
                                capture="environment"
                                className="gf-input"
                                style={{ background: '#ffffff' }}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) {
                                    setStartOdoPhoto((prev) => {
                                      const next = { ...prev };
                                      delete next[tripId];
                                      return next;
                                    });
                                    return;
                                  }
                                  try {
                                    const compressed = await compressImageFileToDataUrl(file, 1200, 0.72);
                                    setStartOdoPhoto((prev) => ({ ...prev, [tripId]: compressed }));
                                    setStartOdoTime((prev) => ({ ...prev, [tripId]: new Date().toLocaleString() }));
                                  } catch {
                                    setStatusBanner({ type: 'danger', text: 'Failed to process odometer photo.' });
                                  }
                                }}
                              />
                              {startOdoPhoto[tripId] && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <img
                                      src={startOdoPhoto[tripId]}
                                      alt="Start Odometer preview"
                                      style={{ width: '70px', height: '50px', objectFit: 'cover', borderRadius: '8px', border: '1.5px solid #3b82f6' }}
                                    />
                                    <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 700 }}>
                                      {t('Odometer photo verified')} ({startOdoTime[tripId]})
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    className="gf-btn gf-btn-outline-danger"
                                    style={{ minHeight: '28px', padding: '0 8px', fontSize: '11px' }}
                                    onClick={() => {
                                      setStartOdoPhoto((prev) => {
                                        const next = { ...prev };
                                        delete next[tripId];
                                        return next;
                                      });
                                      const inputEl = document.getElementById(`start-odo-file-${tripId}`) as HTMLInputElement | null;
                                      if (inputEl) inputEl.value = '';
                                    }}
                                  >
                                    <X size={12} /> {t('Remove')}
                                  </button>
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label htmlFor={`start-odo-input-${tripId}`} className="type-caption" style={{ fontWeight: 800, color: '#1e40af' }}>
                                2. Type Start Odometer Manually (km) * — Min: {d.current_odometer} km
                              </label>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                  id={`start-odo-input-${tripId}`}
                                  type="number"
                                  className="gf-input"
                                  aria-label="Start odometer"
                                  required
                                  placeholder={`Type current odometer (min ${d.current_odometer} km)`}
                                  value={activeTripOdoInput[tripId] ?? ''}
                                  onChange={(e) => setActiveTripOdoInput({ ...activeTripOdoInput, [tripId]: e.target.value })}
                                />
                                <button
                                  type="button"
                                  className="gf-btn gf-btn-primary"
                                  onClick={async () => {
                                    if (!startOdoPhoto[tripId]) {
                                      setStatusBanner({ type: 'danger', text: t('Mandatory: Driver must take a photo of the odometer before starting the trip.') });
                                      return;
                                    }
                                    const rawStartOdo = (activeTripOdoInput[tripId] ?? '').toString().trim();
                                    if (!rawStartOdo || Number.isNaN(Number(rawStartOdo)) || Number(rawStartOdo) < Number(d.current_odometer || 0)) {
                                      setStatusBanner({
                                        type: 'danger',
                                        text: `Mandatory: Please type the start odometer reading manually (must be at least ${d.current_odometer || 0} km) matching your odometer photo.`,
                                      });
                                      return;
                                    }
                                    try {
                                      setGpsNoticeAccepted(true);
                                      setGpsReportingActive(true);
                                      await sendDriverLocationReport('GRANTED');
                                      await apiRequest(`/api/driver/trips/${tripId}/start`, {
                                        method: 'POST',
                                        body: JSON.stringify({
                                          start_odometer: Number(rawStartOdo),
                                          start_odometer_photo: startOdoPhoto[tripId],
                                          photo_base64: startOdoPhoto[tripId],
                                          enforce_photo: true,
                                        }),
                                      });
                                      setActiveTripOdoInput((prev) => {
                                        const next = { ...prev };
                                        delete next[tripId];
                                        return next;
                                      });
                                      setStatusBanner({ type: 'success', text: t('Odometer photo & manual reading verified, trip started!') });
                                      await loadAllData(user);
                                    } catch (err: any) {
                                      setStatusBanner({ type: 'danger', text: err.message });
                                    }
                                  }}
                                >
                                  <Play size={16} /> {t('Start Trip')}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ border: '1.5px solid #bfdbfe', background: '#eff6ff', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                                <label htmlFor={`end-odo-file-${tripId}`} style={{ fontWeight: 800, fontSize: '13px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Camera size={16} /> 1. {t('Mandatory Completion Odometer Photo')} *
                                </label>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                  {endOdoTime[tripId] ? `Recorded: ${endOdoTime[tripId]}` : t('Photo required to verify odometer')}
                                </span>
                              </div>
                              <input
                                type="file"
                                id={`end-odo-file-${tripId}`}
                                accept="image/*"
                                capture="environment"
                                className="gf-input"
                                style={{ background: '#ffffff' }}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) {
                                    setEndOdoPhoto((prev) => {
                                      const next = { ...prev };
                                      delete next[tripId];
                                      return next;
                                    });
                                    return;
                                  }
                                  try {
                                    const compressed = await compressImageFileToDataUrl(file, 1200, 0.72);
                                    setEndOdoPhoto((prev) => ({ ...prev, [tripId]: compressed }));
                                    setEndOdoTime((prev) => ({ ...prev, [tripId]: new Date().toLocaleString() }));
                                  } catch {
                                    setStatusBanner({ type: 'danger', text: 'Failed to process odometer photo.' });
                                  }
                                }}
                              />
                              {endOdoPhoto[tripId] && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <img
                                      src={endOdoPhoto[tripId]}
                                      alt="End Odometer preview"
                                      style={{ width: '70px', height: '50px', objectFit: 'cover', borderRadius: '8px', border: '1.5px solid #3b82f6' }}
                                    />
                                    <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 700 }}>
                                      {t('End photo verified')} ({endOdoTime[tripId]})
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    className="gf-btn gf-btn-outline-danger"
                                    style={{ minHeight: '28px', padding: '0 8px', fontSize: '11px' }}
                                    onClick={() => {
                                      setEndOdoPhoto((prev) => {
                                        const next = { ...prev };
                                        delete next[tripId];
                                        return next;
                                      });
                                      const inputEl = document.getElementById(`end-odo-file-${tripId}`) as HTMLInputElement | null;
                                      if (inputEl) inputEl.value = '';
                                    }}
                                  >
                                    <X size={12} /> {t('Remove')}
                                  </button>
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label htmlFor={`end-odo-input-${tripId}`} className="type-caption" style={{ fontWeight: 800, color: '#1e40af' }}>
                                2. Type End Odometer Manually (km) * — Must be &ge; {d.start_odometer || d.current_odometer} km
                              </label>
                              <input
                                id={`end-odo-input-${tripId}`}
                                type="number"
                                className="gf-input"
                                required
                                placeholder={`Type end odometer manually (>= ${d.start_odometer || d.current_odometer} km)`}
                                value={activeTripOdoInput[tripId] ?? ''}
                                onChange={(e) => setActiveTripOdoInput({ ...activeTripOdoInput, [tripId]: e.target.value })}
                              />
                            </div>
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
                                  setStatusBanner({ type: 'danger', text: t('Mandatory: Driver must take a photo of the odometer upon trip completion.') });
                                  return;
                                }
                                const rawEndOdo = (activeTripOdoInput[tripId] ?? '').toString().trim();
                                const minStartOdo = Number(d.start_odometer || d.current_odometer || 0);
                                if (!rawEndOdo || Number.isNaN(Number(rawEndOdo)) || Number(rawEndOdo) < minStartOdo) {
                                  setStatusBanner({
                                    type: 'danger',
                                    text: `Mandatory: Please type the end odometer reading manually (must be >= ${minStartOdo} km) matching your completion odometer photo.`,
                                  });
                                  return;
                                }
                                try {
                                  setGpsNoticeAccepted(true);
                                  setGpsReportingActive(true);
                                  await sendDriverLocationReport('GRANTED');
                                  await apiRequest(`/api/driver/trips/${tripId}/complete`, {
                                    method: 'POST',
                                    body: JSON.stringify({
                                      end_odometer: Number(rawEndOdo),
                                      end_odometer_photo: endOdoPhoto[tripId],
                                      photo_base64: endOdoPhoto[tripId],
                                      enforce_photo: true,
                                      battery_percent: d.energy_type === 'Electric' ? Number(activeTripBatteryInput[tripId] ?? 72) : undefined,
                                      parking_return_note: activeTripParkingInput[tripId] || 'Main Pool',
                                    }),
                                  });
                                  setStatusBanner({ type: 'success', text: t('Trip completed, odometer photo and manual reading verified!') });
                                  await loadAllData(user);
                                } catch (err: any) {
                                  setStatusBanner({ type: 'danger', text: err.message });
                                }
                              }}
                            >
                              {t('Complete Trip')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Driver Reimbursements, Petty Cash Wallet & Expense Receipt Upload (Items 7, 8 & 9) */}
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h2 className="type-section">{t('Reimbursements & Receipts')}</h2>
                <p className="type-caption">{t('Upload Parking, Gas, Charging (EV), and Toll receipts for reimbursement approval')}</p>
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

            {/* Petty Cash Wallet Balance Card (Item 9) */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-card)',
                background: 'linear-gradient(135deg, #0072de 0%, #005bb5 100%)',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('Petty Cash Wallet')} ({t('Parking & Operational Cash')})
                </div>
                <div className="mono" style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>
                  {formatIdr(driverPettyCashBalance)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.88, marginTop: '2px' }}>
                  {t('Deducted on cash parking/expense claims & replenished when Admin approves')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', opacity: 0.9 }}>{t('Pending Petty Cash Claims')}</div>
                <div className="mono" style={{ fontSize: '14px', fontWeight: 800 }}>
                  {formatIdr(
                    expenses
                      .filter((ex) => ex.payment_source === 'PETTY_CASH' && ['PENDING', 'SUBMITTED'].includes(String(ex.approval_status || ex.status || '').toUpperCase()))
                      .reduce((sum, ex) => sum + Number(ex.amount || 0), 0)
                  )}
                </div>
              </div>
            </div>

            {expenses.length === 0 ? (
              <EmptyState message={t('No reimbursement claims submitted yet.')} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {expenses.map((ex) => {
                  const expStatusNorm = String(ex.approval_status || ex.status || 'PENDING').toUpperCase();
                  const isExpPending = expStatusNorm === 'PENDING' || expStatusNorm === 'SUBMITTED';
                  return (
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
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div className="type-body" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>{t(ex.category)} • Rp {Number(ex.amount).toLocaleString()}</span>
                        {ex.payment_source === 'PETTY_CASH' && (
                          <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#ebf5ff', color: '#005bb5', border: '1px solid #93c5fd' }}>
                            {t('Petty Cash')}
                          </span>
                        )}
                        {ex.reimbursement_status === 'REIMBURSED' && (
                          <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#dbeafe', color: '#1e40af' }}>
                            ✓ {t('Replenished to Petty Cash')}
                          </span>
                        )}
                      </div>
                      <div className="type-caption">
                        {ex.registration_plate || t('Operational Car')} • {ex.description || t('Receipt claim')} • {new Date(ex.date_time).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {(ex.receipt_data_url || ex.receipt_document_id) && (
                        <>
                          <button
                            type="button"
                            className="gf-btn gf-btn-secondary"
                            style={{ minHeight: '30px', padding: '0 8px', fontSize: '11.5px', gap: '4px' }}
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
                            <FileText size={12} /> {t('View Receipt')}
                          </button>
                          {isExpPending && (
                            <button
                              type="button"
                              className="gf-btn gf-btn-outline-danger"
                              style={{ minHeight: '30px', padding: '0 8px', fontSize: '11.5px', gap: '4px' }}
                              title={t('Remove Receipt Photo')}
                              onClick={async () => {
                                try {
                                  await apiRequest(`/api/expenses/${ex.id}/receipt`, { method: 'DELETE' });
                                  setStatusBanner({ type: 'info', text: t('Receipt photo removed.') });
                                  await loadAllData(user);
                                } catch (err: any) {
                                  setStatusBanner({ type: 'danger', text: err.message });
                                }
                              }}
                            >
                              <X size={12} /> {t('Remove Receipt')}
                            </button>
                          )}
                        </>
                      )}
                      {isExpPending && (
                        <button
                          type="button"
                          className="gf-btn gf-btn-outline-danger"
                          style={{ minHeight: '30px', padding: '0 8px', fontSize: '11.5px', gap: '4px' }}
                          onClick={async () => {
                            try {
                              await apiRequest(`/api/expenses/${ex.id}`, { method: 'DELETE' });
                              setStatusBanner({ type: 'info', text: t('Reimbursement claim removed.') });
                              await loadAllData(user);
                            } catch (err: any) {
                              setStatusBanner({ type: 'danger', text: err.message });
                            }
                          }}
                        >
                          <X size={12} /> {t('Delete')}
                        </button>
                      )}
                      <StatusBadge
                        label={ex.approval_status || ex.status}
                        tone={expStatusNorm === 'APPROVED' ? 'green' : expStatusNorm === 'REJECTED' ? 'red' : 'blue'}
                      />
                    </div>
                  </div>
                  );
                })}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="gf-icon-btn-48 pressable"
                  style={{ width: '36px', height: '36px' }}
                  aria-label={t('Back')}
                  title={t('Back')}
                  onClick={() => {
                    setNavSection('DRIVER');
                    setSheetSnap('full');
                  }}
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h1 className="type-title">{t('Trip Log')}</h1>
                  <p className="type-caption">
                    {user.department_name || 'Driver G'} • {t('Total Driving Time')}
                  </p>
                </div>
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
                <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '2px' }}>{driverCompletedTrips.length}</div>
              </div>
              <div className="gf-driver-triplog-stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0072de' }}>
                  <Clock size={16} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{t('Total Driving Time')}</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, marginTop: '2px' }}>{formattedTotalTime}</div>
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
                              {trip.origin} → {trip.destination}
                            </div>
                            <div className="type-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              {new Date(trip.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(trip.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(trip.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <span className="gf-driver-triplog-duration-pill">
                            {formattedDur} {t('in service driving')}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px solid var(--color-divider)' }}>
                          <span className="type-caption">
                            {t('Car')}: <strong>{trip.make} {trip.model}</strong> (<span className="mono">{trip.registration_plate}</span>) • Pax: <strong>{trip.passenger_nickname || 'Team'}</strong>
                          </span>
                          <span className="type-caption mono" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            Odo: {startOdo} → {endOdo} km ({diffKm} km)
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

                {/* Petty Cash Wallet Banner */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-card)',
                    background: 'linear-gradient(135deg, #0072de 0%, #005bb5 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.9, textTransform: 'uppercase' }}>
                      {t('Petty Cash Wallet')}
                    </div>
                    <div className="mono" style={{ fontSize: '19px', fontWeight: 800 }}>
                      {formatIdr(driverPettyCashBalance)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', opacity: 0.9 }}>{t('Pending Petty Cash Claims')}</div>
                    <div className="mono" style={{ fontSize: '14px', fontWeight: 800 }}>
                      {formatIdr(
                        expenses
                          .filter((ex) => ex.payment_source === 'PETTY_CASH' && ['PENDING', 'SUBMITTED'].includes(String(ex.approval_status || ex.status || '').toUpperCase()))
                          .reduce((sum, ex) => sum + Number(ex.amount || 0), 0)
                      )}
                    </div>
                  </div>
                </div>

                {expenses.length === 0 ? (
                  <EmptyState message={t('No reimbursement claims submitted yet.')} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {expenses.map((exp) => {
                      const expStatusNorm = String(exp.approval_status || exp.status || 'PENDING').toUpperCase();
                      const isExpPending = expStatusNorm === 'PENDING' || expStatusNorm === 'SUBMITTED';
                      return (
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
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span>{t(exp.category)} • {formatIdr(exp.amount)}</span>
                            {exp.payment_source === 'PETTY_CASH' && (
                              <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#ebf5ff', color: '#005bb5', border: '1px solid #93c5fd' }}>
                                {t('Petty Cash')}
                              </span>
                            )}
                            {exp.reimbursement_status === 'REIMBURSED' && (
                              <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#dbeafe', color: '#1e40af' }}>
                                ✓ {t('Replenished to Petty Cash')}
                              </span>
                            )}
                          </div>
                          <div className="type-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            {exp.registration_plate || t('Operational Car')} • {exp.description || t('No description')} • {new Date(exp.date_time || exp.incurred_date || exp.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {(exp.receipt_data_url || exp.receipt_document_id) && isExpPending && (
                            <button
                              type="button"
                              className="gf-btn gf-btn-outline-danger"
                              style={{ minHeight: '28px', padding: '0 8px', fontSize: '11px' }}
                              onClick={async () => {
                                try {
                                  await apiRequest(`/api/expenses/${exp.id}/receipt`, { method: 'DELETE' });
                                  setStatusBanner({ type: 'info', text: t('Receipt photo removed.') });
                                  await loadAllData(user);
                                } catch (err: any) {
                                  setStatusBanner({ type: 'danger', text: err.message });
                                }
                              }}
                            >
                              <X size={12} /> {t('Remove Receipt')}
                            </button>
                          )}
                          {isExpPending && (
                            <button
                              type="button"
                              className="gf-btn gf-btn-outline-danger"
                              style={{ minHeight: '28px', padding: '0 8px', fontSize: '11px' }}
                              onClick={async () => {
                                try {
                                  await apiRequest(`/api/expenses/${exp.id}`, { method: 'DELETE' });
                                  setStatusBanner({ type: 'info', text: t('Reimbursement claim removed.') });
                                  await loadAllData(user);
                                } catch (err: any) {
                                  setStatusBanner({ type: 'danger', text: err.message });
                                }
                              }}
                            >
                              <X size={12} /> {t('Delete')}
                            </button>
                          )}
                          <StatusBadge label={exp.approval_status || exp.status} tone={expStatusNorm === 'APPROVED' ? 'green' : expStatusNorm === 'REJECTED' ? 'red' : 'blue'} />
                        </div>
                      </div>
                      );
                    })}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              id="activity-back-btn"
              type="button"
              className="gf-icon-btn-48 pressable"
              style={{ width: '36px', height: '36px' }}
              aria-label={t('Back')}
              title={t('Back')}
              onClick={() => {
                setNavSection('HOME');
                setBookingStep('HOME');
                setSheetSnap('full');
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="type-title" style={{ margin: 0 }}>{t('Activity')}</h1>
          </div>

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
                  {(trip.status === 'PENDING_APPROVAL' || trip.status === 'APPROVED' || trip.status === 'IN_PROGRESS') && trip.booking_status !== 'CANCELLED' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px solid var(--color-divider)', marginTop: '4px' }}>
                      {trip.status === 'APPROVED' && !trip.passenger_boarded_at && (
                        <button
                          type="button"
                          className="gf-btn gf-btn-primary"
                          style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px', gap: '5px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmPassengerBoarding(trip);
                          }}
                        >
                          <CheckCircle2 size={13} /> {t('I Am Here / Confirm Boarding')}
                        </button>
                      )}
                      {trip.status === 'APPROVED' && Boolean(trip.passenger_boarded_at) && (
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#005bb5', padding: '4px 8px', borderRadius: '6px', background: '#ebf5ff' }}>
                          ✓ {t('Boarding Confirmed')}
                        </span>
                      )}
                      {(trip.status === 'APPROVED' || trip.status === 'IN_PROGRESS') && (
                        <button
                          type="button"
                          className="gf-btn gf-btn-secondary"
                          style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px', gap: '5px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const paxFormatted = formatPassengersMultiLine(trip.passengers_json, trip.passenger_nickname);
                            const modeLabel = formatReservationModeLabel(trip.reservation_type, trip.return_pickup_time);
                            const shareModeLine = modeLabel ? `\n*Mode*: ${modeLabel}` : '';
                            const shareMsg = `*GalaxyFleet Booking Details*\n*Vehicle*: ${trip.make} ${trip.model} (${trip.registration_plate || '—'})\n*Passenger(s) [Nickname only]*:\n${paxFormatted}\n*Driver*: ${trip.assigned_driver_name || 'Assigned Driver'}${trip.assigned_driver_phone ? ` (${trip.assigned_driver_phone})` : ''}\n*Pickup*: ${trip.origin}\n*Destination*: ${trip.destination}\n*Schedule*: ${new Date(trip.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(trip.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${shareModeLine}\n*Status*: ${trip.status}\n\n_Reminder: For privacy protection, only nicknames are used._`;
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText(shareMsg).catch(() => {});
                            }
                            window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg)}`, '_blank');
                            setStatusBanner({ type: 'success', text: t('Booking details copied & opened WhatsApp to share with passenger!') });
                          }}
                        >
                          <Share2 size={13} /> {t('Share to Passenger (WhatsApp)')}
                        </button>
                      )}
                      {(trip.status === 'PENDING_APPROVAL' || trip.status === 'APPROVED') && (
                        <button
                          type="button"
                          className="gf-btn gf-btn-outline-danger"
                          style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelBookingRequest(trip);
                          }}
                        >
                          {t('Cancel Booking')}
                        </button>
                      )}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                id="inbox-back-btn"
                type="button"
                className="gf-icon-btn-48 pressable"
                style={{ width: '36px', height: '36px' }}
                aria-label={t('Back')}
                title={t('Back')}
                onClick={() => {
                  setNavSection(isDriverOnly ? 'DRIVER' : 'HOME');
                  setBookingStep('HOME');
                  setSheetSnap('full');
                }}
              >
                <ArrowLeft size={18} />
              </button>
              <h1 className="type-title" style={{ margin: 0 }}>{t('Inbox')}</h1>
            </div>
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
              {notifications.map((n) => {
                const isHitchhikeReq =
                  n.negotiation_action_type === 'HITCHHIKE' ||
                  n.trigger_type === 'NEGOTIATE_HITCHHIKE_REQUEST' ||
                  n.trigger_type === 'HITCHHIKE_REQUEST' ||
                  /schedule negotiation.*hitchhike/i.test(String(n.title || ''));
                const isCancelNegotiateReq =
                  n.negotiation_action_type === 'REQUEST_CANCEL' ||
                  n.trigger_type === 'NEGOTIATE_CANCEL_REQUEST' ||
                  n.trigger_type === 'CANCEL_NEGOTIATION_REQUEST' ||
                  /schedule negotiation.*(cancel|transfer)/i.test(String(n.title || ''));
                const isNegotiation = (isHitchhikeReq || isCancelNegotiateReq) && Boolean(n.negotiation_id || n.related_entity_id || n.id);
                const negStatus = String(n.negotiation_status || (isNegotiation ? 'PENDING' : '')).toUpperCase();
                const isPendingDecision = isNegotiation && (!negStatus || negStatus === 'PENDING');
                const busyTargetId = n.negotiation_id ? Number(n.negotiation_id) : Number(n.id || 0);
                const isBusy = Boolean(busyTargetId) && negotiationRespondBusyId === busyTargetId;
                const hitchhikerName =
                  n.negotiation_passenger_nickname ||
                  n.negotiation_requester_name ||
                  String(n.body || '').match(/Passenger(?:\(s\))?\s+to add(?:\s*\(\d+\))?:\s*([^.]+)/i)?.[1]?.trim() ||
                  String(n.body || '').match(/^([^\s(]+)/)?.[1] ||
                  'Colleague';

                return (
                  <div
                    key={n.id}
                    data-notification-id={n.id}
                    data-negotiation-id={n.negotiation_id || undefined}
                    className={!n.is_read ? 'gf-proto-inbox-unread pressable' : 'pressable'}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenNotification(n)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenNotification(n);
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      borderRadius: '12px',
                      border: isNegotiation ? '1.5px solid #93c5fd' : '1px solid var(--color-divider)',
                      padding: '8px 12px',
                      background: !n.is_read ? undefined : 'var(--color-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <Bell size={18} style={{ color: n.is_read ? 'var(--color-text-muted)' : '#0072de', marginTop: '2px', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-text-primary)' }}>{translateNotificationText(n.title, lang)}</span>
                          {!n.is_read && <span className="gf-dot-green" style={{ background: '#0072de', flexShrink: 0 }} aria-label="Unread" />}
                        </div>
                        <div
                          style={{
                            fontSize: '12.5px',
                            color: 'var(--color-text-secondary)',
                            marginTop: '3px',
                            lineHeight: 1.4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {translateNotificationText(n.body, lang)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
                          <span className="type-caption" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {n.created_at ? new Date(String(n.created_at).replace(' ', 'T') + (String(n.created_at).includes('Z') ? '' : 'Z')).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#0072de' }}>
                            {isNegotiation && isPendingDecision ? t('Tap to review & approve/reject') : t('Tap to read full message')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isNegotiation && (
                      <div
                        style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 0 2px 28px' }}
                        onClick={(e) => {
                          if (!isCancelNegotiateReq) e.stopPropagation();
                        }}
                      >
                        {isCancelNegotiateReq && (n.negotiation_origin || n.negotiation_destination) && (
                          <div
                            className="type-caption"
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--color-text-primary)',
                              background: 'rgba(0, 114, 222, 0.08)',
                              border: '1px solid rgba(0, 114, 222, 0.22)',
                              borderRadius: '8px',
                              padding: '5px 8px',
                              lineHeight: 1.4,
                            }}
                          >
                            <strong>{t('New Route')}:</strong> {n.negotiation_origin || '—'} → <strong>{n.negotiation_destination || '—'}</strong>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {isPendingDecision ? (
                            isCancelNegotiateReq ? (
                              <button
                                id={`btn-review-neg-${n.negotiation_id || n.id}`}
                                type="button"
                                className="gf-btn gf-btn-primary gf-btn-sm pressable"
                                style={{ minHeight: '32px', padding: '0 12px', fontSize: '12px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenNotification(n);
                                }}
                              >
                                {t('Review & Approve / Reject')}
                              </button>
                            ) : (
                              <>
                                <button
                                  id={`btn-accept-neg-${n.negotiation_id || n.id}`}
                                  type="button"
                                  disabled={isBusy}
                                  className="gf-btn gf-btn-primary gf-btn-sm pressable"
                                  style={{ minHeight: '32px', padding: '0 12px', fontSize: '12px' }}
                                  onClick={() =>
                                    n.negotiation_id
                                      ? handleRespondNegotiation(n, 'ACCEPT')
                                      : n.related_entity_id
                                      ? handleAcceptHitchhike(Number(n.related_entity_id), hitchhikerName, undefined, Number(n.id))
                                      : handleRespondNegotiation(n, 'ACCEPT')
                                  }
                                >
                                  ✓ {t('Accept Hitchhike')} ({hitchhikerName})
                                </button>
                                <button
                                  id={`btn-reject-neg-${n.negotiation_id || n.id}`}
                                  type="button"
                                  disabled={isBusy}
                                  className="gf-btn gf-btn-outline-danger gf-btn-sm pressable"
                                  style={{ minHeight: '32px', padding: '0 12px', fontSize: '12px' }}
                                  onClick={() => handleRespondNegotiation(n, 'REJECT')}
                                >
                                  ✕ {t('Reject')}
                                </button>
                              </>
                            )
                          ) : negStatus === 'ACCEPTED' ? (
                            <StatusBadge
                              tone="blue"
                              label={
                                isHitchhikeReq
                                  ? `${t('Accepted')} • ${hitchhikerName} ${t('added to passengers')}`
                                  : `${t('Approved')} • ${t('Transferred (Pending FM & HWS Approval)')}${n.negotiation_transferred_trip_id ? ` #${n.negotiation_transferred_trip_id}` : ''}`
                              }
                            />
                          ) : negStatus === 'REJECTED' ? (
                            <StatusBadge tone="red" label={t('Rejected')} />
                          ) : isHitchhikeReq && n.related_entity_id ? (
                            <button
                              type="button"
                              disabled={negotiationRespondBusyId === Number(n.id)}
                              className="gf-btn gf-btn-primary gf-btn-sm pressable"
                              style={{ minHeight: '30px', padding: '0 12px', fontSize: '11.5px' }}
                              onClick={() => handleAcceptHitchhike(Number(n.related_entity_id), hitchhikerName, undefined, Number(n.id))}
                            >
                              ✓ {t('Accept Hitchhike')} ({hitchhikerName})
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                id="driver-profile-back-btn"
                type="button"
                className="gf-icon-btn-48 pressable"
                style={{ width: '36px', height: '36px' }}
                aria-label={t('Back')}
                title={t('Back')}
                onClick={() => {
                  setNavSection('DRIVER');
                  setSheetSnap('full');
                }}
              >
                <ArrowLeft size={18} />
              </button>
              <h1 className="type-title" style={{ margin: 0, fontSize: '19px' }}>{t('Corporate Driver Profile')}</h1>
            </div>

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
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const base64 = await compressImageFileToDataUrl(file, 900, 0.75);
                          await apiRequest('/api/driver/profile/photo', {
                            method: 'POST',
                            body: JSON.stringify({ photo_url: base64 }),
                          });
                          setStatusBanner({ type: 'success', text: t('Driver profile photo updated successfully!') });
                          await loadAllData(user);
                        } catch (err: any) {
                          setStatusBanner({ type: 'danger', text: err.message });
                        }
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
              <div className="type-caption" style={{ fontWeight: 700, marginBottom: '4px' }}>{t('Display Mode')}</div>
              <div className="type-caption" style={{ marginBottom: '8px' }}>{t('Mobile View keeps a compact phone layout; Web View shows the full desktop layout.')}</div>
              <DisplayModeToggle variant="full" id="profile-display-mode-toggle-0" />
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                id="profile-back-btn"
                type="button"
                className="gf-icon-btn-48 pressable"
                style={{ width: '36px', height: '36px' }}
                aria-label={t('Back')}
                title={t('Back')}
                onClick={() => {
                  setNavSection('HOME');
                  setBookingStep('HOME');
                  setSheetSnap('full');
                }}
              >
                <ArrowLeft size={18} />
              </button>
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
                    {user.contact_number}
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

          {!user.contact_number && (
            <div
              id="profile-missing-phone-banner"
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-card)',
                background: 'rgba(217, 119, 6, 0.1)',
                border: '1px solid rgba(217, 119, 6, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-primary)', lineHeight: 1.45, flex: '1 1 200px' }}>
                <strong>{t('WhatsApp Phone Required for Recovery')}:</strong>{' '}
                {t('Add your WhatsApp / mobile phone number so the Administrator can verify and send password resets if needed.')}
              </div>
              <button
                type="button"
                className="gf-btn gf-btn-primary gf-btn-sm"
                onClick={handleOpenProfileModal}
              >
                {t('Add Phone Number')}
              </button>
            </div>
          )}

          <div style={{ padding: '12px', borderRadius: 'var(--radius-card)', background: 'var(--color-bg-subtle)' }}>
            <div className="type-caption" style={{ fontWeight: 700, marginBottom: '8px' }}>{t('Language')}</div>
            <LanguageSwitcher />
          </div>

          <div style={{ padding: '12px', borderRadius: 'var(--radius-card)', background: 'var(--color-bg-subtle)' }}>
            <div className="type-caption" style={{ fontWeight: 700, marginBottom: '4px' }}>{t('Display Mode')}</div>
            <div className="type-caption" style={{ marginBottom: '8px' }}>{t('Mobile View keeps a compact phone layout; Web View shows the full desktop layout.')}</div>
            <DisplayModeToggle variant="full" id="profile-display-mode-toggle-1" />
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
            {user.role === 'DRV' && (
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
    // SET SCHEDULE: GOOGLE CALENDAR-STYLE FLEET & DRIVER TIMETABLE (24 Hours: 00:00 - 24:00)
    // -------------------------------------------------------------------------
    if (bookingStep === 'SCHEDULE_VIEW') {
      const selectedDateStr = scheduleCalendarDate || todayLocalDateStr();
      const isDriverRole = user.role === 'DRV' && !isPrivileged;
      const myDedicatedVehicle = vehicles.find(
        (v) =>
          (v.dedicated_driver_user_id && v.dedicated_driver_user_id === user.id) ||
          (v.default_driver_name && v.default_driver_name.toLowerCase() === (user.nickname || '').toLowerCase())
      );

      // Calendar trips: all bookings (active + completed/cancelled/rejected/transferred history) for full usage audit
      const rawCalendarSource = allCalendarAuditTrips;
      const otherBookedDateCounts = new Map<string, number>();
      const pad2Local = (n: number) => String(n).padStart(2, '0');
      const calendarTripsOnSelectedDate = rawCalendarSource.filter((t) => {
        const startD = new Date(t.start_time);
        const endD = new Date(t.end_time);
        if (!Number.isNaN(startD.getTime()) && !Number.isNaN(endD.getTime())) {
          const localStartDate = `${startD.getFullYear()}-${pad2Local(startD.getMonth() + 1)}-${pad2Local(startD.getDate())}`;
          const localEndDate = `${endD.getFullYear()}-${pad2Local(endD.getMonth() + 1)}-${pad2Local(endD.getDate())}`;
          const matchesSelected =
            localStartDate === selectedDateStr ||
            localEndDate === selectedDateStr ||
            String(t.start_time).startsWith(selectedDateStr);
          if (!matchesSelected && localStartDate) {
            otherBookedDateCounts.set(localStartDate, (otherBookedDateCounts.get(localStartDate) || 0) + 1);
          }
          return matchesSelected;
        }
        return String(t.start_time || '').startsWith(selectedDateStr);
      });
      const activeCalendarTrips = calendarTripsOnSelectedDate.filter((t) => !isHistoryTripRecord(t));
      const otherBookedDates = Array.from(otherBookedDateCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));

      const nowMs = Date.now();
      const isViewingToday = selectedDateStr === todayLocalDateStr();
      const busyVehicleIdsOnSelectedDate = new Set<number>();
      for (const t of activeCalendarTrips) {
        if (!t.vehicle_id) continue;
        const st = String(t.status || '').toUpperCase();
        if (st === 'IN_PROGRESS') {
          busyVehicleIdsOnSelectedDate.add(Number(t.vehicle_id));
          continue;
        }
        const startD = new Date(t.start_time);
        const endD = new Date(t.end_time || t.start_time);
        const endMs = Math.max(endD.getTime(), startD.getTime() + 15 * 60_000);
        if (!isViewingToday || Number.isNaN(endMs) || endMs > nowMs) {
          busyVehicleIdsOnSelectedDate.add(Number(t.vehicle_id));
        }
      }
      const availableVehiclesCount = vehicles.filter(
        (v) => v.status === 'Available' && !busyVehicleIdsOnSelectedDate.has(Number(v.id))
      ).length;

      const visibleVehicles = vehicles.filter((v) => {
        if (isDriverRole) {
          return Boolean(myDedicatedVehicle && v.id === myDedicatedVehicle.id);
        }
        if (scheduleFilterTab === 'AVAILABLE') {
          return v.status === 'Available' && !busyVehicleIdsOnSelectedDate.has(Number(v.id));
        }
        if (scheduleFilterTab === 'BOOKED') {
          return calendarTripsOnSelectedDate.some((t) => Number(t.vehicle_id) === Number(v.id));
        }
        return true;
      });

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feedbackBanner}

          {/* Header with Back navigation button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                    setSheetSnap('full');
                  }
                }}
                aria-label={t('Back')}
                title={t('Back')}
                style={{ width: '38px', height: '38px' }}
              >
                <ArrowLeft size={20} />
              </button>
              <div style={{ minWidth: 0 }}>
                <h1 className="type-title" style={{ fontSize: '19px', margin: 0 }}>
                  {t('Set Schedule (24 Hours)')}
                </h1>
                <p className="type-caption" style={{ margin: '2px 0 0' }}>
                  {t('Tap a booking to see who booked the car and who is on board')}
                </p>
              </div>
            </div>
            <StatusBadge label={t('24 Hours (00:00 – 24:00)')} tone="blue" />
          </div>

          {/* Date Picker & Filter Chips */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
              padding: '10px 12px',
              borderRadius: '12px',
              background: 'var(--color-bg-subtle)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Calendar size={16} style={{ color: '#0072de' }} />
              <input
                id="schedule-calendar-date-input"
                type="date"
                className="gf-input"
                style={{ minHeight: '34px', height: '34px', padding: '0 10px', fontSize: '13px', width: 'auto' }}
                value={selectedDateStr}
                onChange={(e) => setScheduleCalendarDate(e.target.value)}
              />
              <button
                type="button"
                className="gf-btn gf-btn-secondary gf-btn-sm"
                style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                onClick={() => {
                  const now = new Date();
                  const pad = (n: number) => String(n).padStart(2, '0');
                  setScheduleCalendarDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
                }}
              >
                {t('Today')}
              </button>
              <button
                type="button"
                className="gf-btn gf-btn-secondary gf-btn-sm"
                style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                onClick={() => {
                  const tom = new Date();
                  tom.setDate(tom.getDate() + 1);
                  const pad = (n: number) => String(n).padStart(2, '0');
                  setScheduleCalendarDate(`${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`);
                }}
              >
                {t('Tomorrow')}
              </button>
            </div>

            {!isDriverRole && (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
                <Chip active={scheduleFilterTab === 'ALL'} onClick={() => setScheduleFilterTab('ALL')}>
                  {t('All Cars')} ({vehicles.length})
                </Chip>
                <Chip active={scheduleFilterTab === 'AVAILABLE'} onClick={() => setScheduleFilterTab('AVAILABLE')}>
                  {t('Available Now')} ({availableVehiclesCount})
                </Chip>
                <Chip active={scheduleFilterTab === 'BOOKED'} onClick={() => setScheduleFilterTab('BOOKED')}>
                  {t('Booked Today')} ({activeCalendarTrips.length})
                </Chip>
              </div>
            )}

            {otherBookedDates.length > 0 && (
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px solid var(--color-divider)' }}>
                <span className="type-caption" style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  {t('Other booked dates')}:
                </span>
                {otherBookedDates.slice(0, 5).map(([dateKey, count]) => (
                  <button
                    key={dateKey}
                    type="button"
                    className="gf-btn gf-btn-secondary gf-btn-sm pressable"
                    style={{ minHeight: '26px', padding: '0 9px', fontSize: '11.5px', fontWeight: 700, borderColor: 'rgba(0, 114, 222, 0.35)', color: '#0072de' }}
                    onClick={() => setScheduleCalendarDate(dateKey)}
                  >
                    {dateKey} ({count})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Google Calendar–style day view: one column per car & driver, bookings blocked from start → end with the booker's name */}
          <DriverScheduleCalendar
            vehicles={visibleVehicles}
            trips={calendarTripsOnSelectedDate}
            dateStr={selectedDateStr}
            currentUserId={user.id}
            showContacts={isPrivileged}
            showOdometerPhotos={isPrivileged || user.role === 'DRV'}
            onBookSlot={
              isDriverRole
                ? undefined
                : (vehicleId, hour) =>
                    requireLocationBeforeCarUse(() => {
                      const [yr, mo, dy] = selectedDateStr.split('-').map(Number);
                      const slotStart = new Date();
                      if (yr && mo && dy) slotStart.setFullYear(yr, mo - 1, dy);
                      slotStart.setHours(hour, 0, 0, 0);
                      if (slotStart.getTime() < Date.now()) {
                        slotStart.setTime(roundUpTo5MinMs(Date.now() + 30 * 60000));
                      }
                      const slotEnd = new Date(slotStart.getTime() + 2 * 3600000);
                      setBookVehicleId(vehicleId);
                      setBookStart(toLocalDateTimeInput(slotStart));
                      setBookEnd(toLocalDateTimeInput(slotEnd));
                      setBookDurationHours(2);
                      setScheduleMode('SCHEDULE');
                      setBookingStep('ROUTE');
                      setSheetSnap('full');
                    })
            }
            onNegotiate={
              isDriverRole
                ? undefined
                : (tr) => {
                    setNegotiationModalTrip(tr);
                    setNegotiationActionType('HITCHHIKE');
                    setNegotiationPassengerNickname(user.nickname || '');
                    setNegotiationExtraPassengers([]);
                    setNegotiationLocationMode('SAME');
                    setNegotiationOrigin(String(tr.origin || ''));
                    setNegotiationDestination(String(tr.destination || ''));
                    setNegotiationPurpose('');
                    setNegotiationNote(`Heading to ${tr.destination} too, may I hitchhike?`);
                  }
            }
          />
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // BOOKING FLOW STEP 0: HOME
    // -------------------------------------------------------------------------
    if (bookingStep === 'HOME') {
      const isNightHero = new Date().getHours() >= 18 || new Date().getHours() < 5;

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
              <CompanyCarIcon size={20} />
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

      // PROTOTYPE SCREEN 1: GOJEK-STYLE SUPER-APP HOME (Reference: Screenshot_20261118_193720_Gojek.jpg)
      if (customerHomeMode === 'SUPER_APP') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            {feedbackBanner}

            {/* 1. Gojek-Style Search Bar (Preserves id="home-where-to-btn") */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', boxSizing: 'border-box', padding: '0 2px' }}>
              <button
                id="home-where-to-btn"
                type="button"
                className="gf-gojek-search-bar pressable"
                onClick={() =>
                  requireLocationBeforeCarUse(() => {
                    setBookReservationType('ONE_WAY');
                    setBookingStep('ROUTE');
                    setSheetSnap('half');
                  })
                }
                aria-label={t('Search services, cars, destinations...')}
              >
                <Search size={18} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                <span style={{ fontSize: '13.5px', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                  {t('Search services, cars, destinations...')}
                </span>
              </button>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <DisplayModeToggle variant="icon" id="home-display-mode-toggle" />
              </div>
              <button
                type="button"
                className="gf-driver-avatar-btn pressable"
                onClick={handleOpenProfileModal}
                title={t('Profile')}
                style={{ width: '40px', height: '40px', minWidth: '40px', flexShrink: 0 }}
              >
                <img
                  src={user.photo_url || getDriverAvatarDataUri(user.nickname || 'User')}
                  alt={user.nickname}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </button>
            </div>

            {/* 2. Gojek-Style Primary Hero Service Cards (GoCar, Shuttle, Schedule - Big & Proportional!) */}
            <div className="gf-gojek-hero-grid">
              {/* Card 1: Pesan Mobil (Company Car) */}
              <button
                type="button"
                className="gf-gojek-hero-card is-featured pressable"
                onClick={() => {
                  setCustomerHomeMode('GOCAR_LANDING');
                  setSheetSnap('full');
                }}
                title={t('Company Car')}
              >
                <span id="company-car-live-availability" className="gf-gojek-hero-tag">
                  {t(liveAvailableCarsCount === 1 ? '1 Car Available' : `${liveAvailableCarsCount} Cars Available`)}
                </span>
                <div className="gf-gojek-hero-art">
                  <CompanyCarIcon size={48} />
                </div>
                <div>
                  <div className="gf-gojek-hero-title">{t('Company Car')}</div>
                  <div className="gf-gojek-hero-subtitle">{t('Ready for Duty')}</div>
                </div>
              </button>

              {/* Card 2: Shuttle Bus (Antar-Jemput) */}
              <button
                type="button"
                className="gf-gojek-hero-card pressable"
                onClick={() => {
                  setStatusBanner({
                    type: 'info',
                    text: t('Shuttle Bus service is currently under development.'),
                  });
                }}
                title={t('Under Development')}
              >
                <span className="gf-gojek-hero-tag" style={{ background: '#0a0a0a', color: '#ffffff' }}>Dev</span>
                <div className="gf-gojek-hero-art">
                  <Bus size={34} color="#0072de" />
                </div>
                <div>
                  <div className="gf-gojek-hero-title">{t('Shuttle Bus')}</div>
                  <div className="gf-gojek-hero-subtitle">{t('Office Route')}</div>
                </div>
              </button>

              {/* Card 3: Set Schedule (Reservasi Jadwal) */}
              <button
                type="button"
                className="gf-gojek-hero-card pressable"
                onClick={() => {
                  setBookingStep('SCHEDULE_VIEW');
                  setSheetSnap('full');
                }}
                title={t('Set Schedule')}
              >
                <span className="gf-gojek-hero-tag">{t('Schedule')}</span>
                <div className="gf-gojek-hero-art">
                  <Calendar size={34} color="#0072de" />
                </div>
                <div>
                  <div className="gf-gojek-hero-title">{t('Set Schedule')}</div>
                  <div className="gf-gojek-hero-subtitle">{t('Book in Advance')}</div>
                </div>
              </button>
            </div>

            {/* 3. Gojek-Style Secondary Service Shortcuts (Helpdesk, Trip Log, Dispatch, Admin) */}
            <div className="gf-gojek-quick-grid">
              <button
                type="button"
                className="gf-gojek-quick-item pressable"
                onClick={() => window.open(FLEET_HELPDESK_WHATSAPP_URL, '_blank')}
                title={`Fleet Helpdesk: ${FLEET_HELPDESK_PIC_LABEL}`}
              >
                <div className="gf-gojek-quick-tile is-blue">
                  <Phone size={22} />
                </div>
                <span className="gf-gojek-quick-label">{t('Fleet Helpdesk')}</span>
              </button>

              <button
                type="button"
                className="gf-gojek-quick-item pressable"
                onClick={() => setNavSection('ACTIVITY')}
                title={t('Trip Log')}
              >
                <div className="gf-gojek-quick-tile">
                  <Clock size={22} />
                </div>
                <span className="gf-gojek-quick-label">{t('Trip Log')}</span>
              </button>

              {user.role === 'DRV' ? (
                <button
                  type="button"
                  className="gf-gojek-quick-item pressable"
                  onClick={() => setNavSection('DRIVER')}
                  title={t('Driver Dispatch')}
                >
                  <div className="gf-gojek-quick-tile is-blue">
                    <Navigation size={22} />
                  </div>
                  <span className="gf-gojek-quick-label">{t('Dispatch')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="gf-gojek-quick-item pressable"
                  onClick={() => {
                    setCustomerHomeMode('GOCAR_LANDING');
                    setSheetSnap('full');
                  }}
                  title={t('Company Car')}
                >
                  <div className="gf-gojek-quick-tile">
                    <CompanyCarIcon size={24} />
                  </div>
                  <span className="gf-gojek-quick-label">{t('Vehicles')}</span>
                </button>
              )}

              {isPrivileged ? (
                <button
                  type="button"
                  className="gf-gojek-quick-item pressable"
                  onClick={() => setNavSection('ADMIN')}
                  title={t('Admin Console')}
                >
                  <div className="gf-gojek-quick-tile is-blue">
                    <ShieldCheck size={22} />
                  </div>
                  <span className="gf-gojek-quick-label">{t('Admin')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="gf-gojek-quick-item pressable"
                  onClick={handleOpenProfileModal}
                  title={t('Profile')}
                >
                  <div className="gf-gojek-quick-tile">
                    <User size={22} />
                  </div>
                  <span className="gf-gojek-quick-label">{t('Profile')}</span>
                </button>
              )}
            </div>

            {/* 4. Gojek GoPay-Style Fleet Pass Card */}
            <div className="gf-gojek-pass-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'var(--color-samsung-blue-tint, #ebf5ff)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0072de',
                    flexShrink: 0,
                  }}
                >
                  <CompanyCarIcon size={26} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '14.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.nickname} {user.department_name ? `• ${user.department_name}` : ''}
                  </div>
                  <div className="type-caption" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="gf-badge gf-badge-blue" style={{ fontSize: '10.5px', padding: '1px 6px' }}>
                      {user.role}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t('Ready for official travel')}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="gf-btn gf-btn-primary gf-btn-sm pressable"
                style={{ flexShrink: 0, padding: '0 14px', height: '36px', fontSize: '12.5px', borderRadius: '10px' }}
                onClick={() => {
                  setCustomerHomeMode('GOCAR_LANDING');
                  setSheetSnap('full');
                }}
              >
                {t('Book Now')} →
              </button>
            </div>

            {/* 5. Gojek "Pilihan cepat buatmu" Quick Destinations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <h3 style={{ fontSize: '15.5px', fontWeight: 800, margin: 0 }}>{t('Quick Destinations')}</h3>

              <div className="gf-gojek-dest-grid">
                {[
                  {
                    poi: QUICK_CORPORATE_POIS[3],
                    tag: 'Head Office',
                    title: 'SCBD Head Office',
                    sub: 'District 8, Sudirman',
                  },
                  {
                    poi: QUICK_CORPORATE_POIS[4],
                    tag: 'Airport VIP',
                    title: 'Soekarno-Hatta T3',
                    sub: 'Terminal 3 Ultimate',
                  },
                  {
                    poi: QUICK_CORPORATE_POIS[0],
                    tag: 'Plant 1',
                    title: 'Plant 1 Sunter',
                    sub: 'Manufacturing Plant',
                  },
                  {
                    poi: QUICK_CORPORATE_POIS[1],
                    tag: 'Plant 2',
                    title: 'Plant 2 Karawang',
                    sub: 'KIIC Industrial Area',
                  },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="gf-gojek-dest-item pressable"
                    onClick={() =>
                      requireLocationBeforeCarUse(() => {
                        setBookDest(item.poi.name);
                        setDestCoords({ lat: item.poi.lat, lon: item.poi.lon });
                        setBookReservationType('ONE_WAY');
                        setBookingStep('VEHICLE');
                        setSheetSnap('half');
                      })
                    }
                  >
                    <span className="gf-gojek-dest-tag">{t(item.tag)}</span>
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ fontWeight: 800, fontSize: '13.5px', lineHeight: 1.25 }}>{t(item.title)}</div>
                      <div className="type-caption" style={{ marginTop: '2px', fontSize: '11px' }}>{t(item.sub)}</div>
                    </div>
                  </button>
                ))}
              </div>
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
                    const isApprovedTrip = tr.status === 'APPROVED' && !isCancelled;
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

                        {(isPending || isApprovedTrip) && (
                          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {isApprovedTrip && !tr.passenger_boarded_at && (
                              <button
                                type="button"
                                className="gf-proto-btn gf-proto-btn-s pressable"
                                style={{ background: '#0072de', color: '#ffffff', border: 'none' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfirmPassengerBoarding(tr);
                                }}
                              >
                                ✓ {t('I Am Here / Confirm Boarding')}
                              </button>
                            )}
                            {isApprovedTrip && Boolean(tr.passenger_boarded_at) && (
                              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#005bb5', padding: '4px 10px', borderRadius: '9999px', background: '#ebf5ff' }}>
                                ✓ {t('Boarding Confirmed')}
                              </span>
                            )}
                            <button
                              type="button"
                              className="gf-proto-btn gf-proto-btn-r gf-proto-btn-s pressable"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelBookingRequest(tr);
                              }}
                            >
                              {t('Cancel Booking')}
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

      // PROTOTYPE SCREEN 2: CAR BOOKING LANDING (Reference: 1794990260264.jpg in Samsung Blue)
      const primaryPoi = QUICK_CORPORATE_POIS[0] || {
        name: 'Manufacturing Plant 1',
        label: 'Plant 1 (Sunter)',
        address: 'Jl. Danau Sunter Barat No. 8, Sunter Jaya, Jakarta Utara',
        lat: -6.1436,
        lon: 106.8691,
      };
      const secondaryPois = (recentPlacesList.length > 1 ? recentPlacesList.slice(1, 4) : QUICK_CORPORATE_POIS.slice(1, 4));

      return (
        <div className="gf-proto-land-shell">
          <div className="gf-proto-hero" style={{ height: '212px' }}>
            <svg viewBox="0 0 412 212" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <defs>
                <linearGradient id="gfProtoSkyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor={isNightHero ? '#0B1F4D' : '#8FD4F7'} />
                  <stop offset="1" stopColor={isNightHero ? '#1B3E86' : '#E0F5FE'} />
                </linearGradient>
              </defs>
              <rect width="412" height="212" fill="url(#gfProtoSkyGrad)" />

              {/* Sun / Moon & Clouds */}
              {isNightHero ? (
                <>
                  <circle cx="115" cy="40" r="15" fill="#FFE9A8" />
                  <circle cx="122" cy="35" r="13" fill="#0B1F4D" />
                  <g fill="#ffffff" opacity="0.85">
                    <circle cx="180" cy="28" r="1.5" />
                    <circle cx="260" cy="44" r="1.5" />
                    <circle cx="340" cy="24" r="2" />
                  </g>
                </>
              ) : (
                <>
                  <circle cx="128" cy="36" r="14" fill="#FACC15" />
                  <path d="M96 46h52a10 10 0 0 0-9-10 13 13 0 0 0-24-3 11 11 0 0 0-19 13z" fill="#ffffff" opacity="0.95" />
                  <path d="M282 44h58a10 10 0 0 0-10-10 14 14 0 0 0-26-2 11 11 0 0 0-22 12z" fill="#ffffff" opacity="0.95" />
                </>
              )}

              {/* Cityscape Silhouette */}
              <g fill={isNightHero ? '#16306B' : '#1282C4'} opacity="0.88">
                <path d="M0 150 L28 112 L68 145 Z" />
                <rect x="72" y="102" width="22" height="58" rx="2" />
                <polygon points="155,148 155,104 192,88 192,148" />
                <rect x="218" y="114" width="26" height="42" />
                <rect x="252" y="88" width="20" height="68" />
                <rect x="348" y="76" width="38" height="80" />
                <rect x="392" y="100" width="20" height="56" />
              </g>
              {/* City Windows */}
              <g fill="#E0F5FE" opacity="0.7">
                <rect x="256" y="94" width="4" height="4" />
                <rect x="264" y="94" width="4" height="4" />
                <rect x="256" y="102" width="4" height="4" />
                <rect x="264" y="102" width="4" height="4" />
                <rect x="256" y="110" width="4" height="4" />
                <rect x="264" y="110" width="4" height="4" />
              </g>

              {/* Curved Dark Navy Horizon */}
              <ellipse cx="206" cy="252" rx="310" ry="96" fill="#0d1526" />

              {/* Left Corporate Van (GalaxyFleet) */}
              <g transform="translate(34, 108)">
                <path d="M4 32 L10 12 Q12 6 20 6 L72 6 Q82 6 88 16 L98 30 Q102 34 102 42 L102 52 Q102 56 96 56 L6 56 Q2 56 2 50 Z" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <path d="M14 12 L42 12 L42 26 L10 26 Z" fill="#38bdf8" opacity="0.45" />
                <path d="M46 12 L68 12 L74 26 L46 26 Z" fill="#bae6fd" />
                <path d="M72 12 L84 12 L94 26 L78 26 Z" fill="#e0f2fe" />
                <rect x="82" y="34" width="12" height="5" rx="2.5" fill="#facc15" />
                <text x="16" y="42" fill="#cbd5e1" fontSize="9.5" fontWeight="800" fontStyle="italic">GalaxyFleet</text>
                <circle cx="24" cy="55" r="9" fill="#0f172a" />
                <circle cx="24" cy="55" r="4.5" fill="#94a3b8" />
                <circle cx="76" cy="55" r="9" fill="#0f172a" />
                <circle cx="76" cy="55" r="4.5" fill="#94a3b8" />
              </g>

              {/* Right Corporate Van (GalaxyFleet with Roof Pin) */}
              <g transform="translate(262, 92)">
                {/* Roof Location Pin */}
                <path d="M54 -8 C48 -8 44 -3 44 2 C44 9 54 17 54 17 C54 17 64 9 64 2 C64 -3 60 -8 54 -8 Z" fill="#0072de" stroke="#ffffff" strokeWidth="1.5" />
                <circle cx="54" cy="2" r="3.5" fill="#ffffff" />
                {/* Van Body */}
                <path d="M6 44 L18 22 Q24 14 36 14 L106 14 Q116 14 120 26 L124 62 Q124 68 118 68 L8 68 Q2 68 2 60 Z" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <path d="M54 44 L122 46 L122 64 L54 64 Z" fill="#38bdf8" />
                <path d="M22 20 L54 20 L44 36 L14 36 Z" fill="#e0f2fe" />
                <path d="M58 20 L88 20 L88 36 L52 36 Z" fill="#7dd3fc" opacity="0.85" />
                <rect x="26" y="44" width="14" height="6" rx="3" fill="#ffffff" />
                <text x="72" y="37" fill="#cbd5e1" fontSize="9.5" fontWeight="800" fontStyle="italic">GalaxyFleet</text>
                <circle cx="44" cy="67" r="10" fill="#0f172a" />
                <circle cx="44" cy="67" r="5" fill="#94a3b8" />
                <circle cx="104" cy="67" r="10" fill="#0f172a" />
                <circle cx="104" cy="67" r="5" fill="#94a3b8" />
              </g>
            </svg>

            <button
              type="button"
              className="gf-proto-hero-back pressable"
              onClick={() => {
                setCustomerHomeMode('SUPER_APP');
                setSheetSnap('full');
              }}
              aria-label={t('Back')}
            >
              <ArrowLeft size={20} />
            </button>

            <div style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 3, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <LanguageSwitcher compact />
            </div>

            {/* Horizon Badges: Group Order & Work Trip */}
            <div
              style={{
                position: 'absolute',
                bottom: '44px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 3,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                }}
              >
                <Users size={13} style={{ color: '#0072de' }} />
                <span>Group Order</span>
              </span>
              <span
                style={{
                  background: '#1e3a5f',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 800,
                  padding: '4px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  transform: 'rotate(-7deg)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                Work Trip
              </span>
            </div>
          </div>

          <div className="gf-gocar-landing-dark-band">
            <div className="gf-proto-gr" style={{ marginTop: '-34px', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t('Where to,')} {(user.nickname || '').split('(')[0].trim()}?
              </h2>
              <p style={{ fontSize: '14px', color: '#cbd5e1', marginTop: '4px' }}>
                {t('Operational cars ready to roll.')}
              </p>
            </div>

            {/* Samsung Blue Review Banner (Reference: 1794990260264.jpg) */}
            <button
              type="button"
              className="pressable"
              onClick={() => setNavSection('ACTIVITY')}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'linear-gradient(135deg, #0072de 0%, #0d8bff 100%)',
                border: 'none',
                borderRadius: '18px',
                padding: '14px 16px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(0, 114, 222, 0.32)',
              }}
            >
              <span
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '11px',
                  background: '#ffffff',
                  color: '#0072de',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <ShieldCheck size={22} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: '15px', fontWeight: 800, lineHeight: 1.25 }}>
                  {t('Booking reviewed before departure')}
                </b>
                <span style={{ display: 'block', fontSize: '12.5px', opacity: 0.95, marginTop: '3px', lineHeight: 1.35 }}>
                  {t('Reviewed by Fleet PIC & Head of WS. Check status here.')} ›
                </span>
              </span>
            </button>
          </div>

          <div className="gf-proto-wc" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '-8px' }}>
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
                <span className="type-caption" style={{ fontWeight: 700, color: 'inherit' }}>{t(statusBanner.text)}</span>
                <button
                  type="button"
                  onClick={() => setStatusBanner(null)}
                  style={{ border: 'none', background: 'transparent', color: 'inherit', fontWeight: 700, cursor: 'pointer', minHeight: '32px' }}
                >
                  OK
                </button>
              </div>
            )}

            {/* Compact Rounded Inline Map Preview Card (Reference: 1794990260264.jpg — ~116px tall, with live MapTiler/OSM tiles + pin + corporate cars) */}
            <button
              type="button"
              className="pressable"
              onClick={() =>
                requireLocationBeforeCarUse(() => {
                  setBookReservationType('ONE_WAY');
                  setBookingStep('ROUTE');
                  setSheetSnap('half');
                })
              }
              aria-label={t('Where to?')}
              style={{
                padding: 0,
                border: '1px solid var(--color-border)',
                borderRadius: '18px',
                overflow: 'hidden',
                width: '100%',
                height: '116px',
                display: 'block',
                cursor: 'pointer',
                position: 'relative',
                background: '#f5efe4',
                boxShadow: '0 2px 10px rgba(15, 23, 42, 0.08)',
              }}
            >
              {/* Real Map Tiles Layer (Backed by /api/maps/tiles with MapTiler API Key) */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  opacity: 0.96,
                  pointerEvents: 'none',
                }}
              >
                <img
                  src="/api/maps/tiles/streets/13/6527/4240"
                  alt=""
                  style={{ width: '100%', height: '140px', objectFit: 'cover', marginTop: '-14px' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <img
                  src="/api/maps/tiles/streets/13/6528/4240"
                  alt=""
                  style={{ width: '100%', height: '140px', objectFit: 'cover', marginTop: '-14px' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>

              <svg viewBox="0 0 380 116" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block', position: 'relative', zIndex: 1 }} aria-hidden="true">
                {/* Road Network & Labels Overlay */}
                <path d="M0 82 Q90 66 175 56 T355 88 L380 94" stroke="#cbd5e1" strokeWidth="4.5" fill="none" opacity="0.65" />
                <path d="M0 82 Q90 66 175 56 T355 88 L380 94" stroke="#ffffff" strokeWidth="2.2" fill="none" opacity="0.8" />
                <text x="38" y="34" fill="#1e293b" fontSize="10.5" fontWeight="700" stroke="#ffffff" strokeWidth="3" paintOrder="stroke">Muara Gembong</text>
                <text x="36" y="72" fill="#334155" fontSize="10" fontWeight="700" stroke="#ffffff" strokeWidth="3" paintOrder="stroke">Sunter</text>
                <text x="124" y="72" fill="#0f172a" fontSize="10.5" fontWeight="800" stroke="#ffffff" strokeWidth="3" paintOrder="stroke">Jl. Jababeka Raya</text>
                <text x="252" y="70" fill="#334155" fontSize="10" fontWeight="700" stroke="#ffffff" strokeWidth="3" paintOrder="stroke">Sunter</text>

                {/* Center Samsung Blue Location Pin */}
                <g transform="translate(186, 44)">
                  <ellipse cx="0" cy="18" rx="6" ry="2.5" fill="rgba(0,0,0,0.25)" />
                  <path d="M0 -12 C-8 -12 -13 -6 -13 1 C-13 9 0 18 0 18 C0 18 13 9 13 1 C13 -6 8 -12 0 -12 Z" fill="#0072de" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="0" cy="0" r="4.5" fill="#ffffff" />
                </g>

                {/* Left Top-Down Corporate Car Icon */}
                <g transform="translate(108, 92) rotate(-8)">
                  <rect x="-15" y="-8" width="30" height="16" rx="5" fill="#0072de" stroke="#ffffff" strokeWidth="1.5" />
                  <rect x="-8" y="-6" width="16" height="12" rx="2.5" fill="#e0f2fe" />
                  <rect x="-5" y="-5" width="9" height="10" rx="1.5" fill="#0284c7" />
                </g>

                {/* Right Top-Down Corporate Car Icon */}
                <g transform="translate(306, 92)">
                  <rect x="-8" y="-15" width="16" height="30" rx="5" fill="#0072de" stroke="#ffffff" strokeWidth="1.5" />
                  <rect x="-6" y="-8" width="12" height="16" rx="2.5" fill="#e0f2fe" />
                  <rect x="-5" y="-4" width="10" height="9" rx="1.5" fill="#0284c7" />
                </g>
              </svg>
            </button>

            {/* White Pill Search Bar ("Mau ke mana?" / "Where to?") */}
            <button
              id="home-where-to-btn"
              type="button"
              className="gf-proto-sbar pressable"
              style={{
                minHeight: '52px',
                borderRadius: '9999px',
                padding: '0 18px',
                background: 'var(--color-bg-surface)',
                border: '1.5px solid var(--color-border)',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)',
              }}
              onClick={() =>
                requireLocationBeforeCarUse(() => {
                  setBookReservationType('ONE_WAY');
                  setBookingStep('ROUTE');
                  setSheetSnap('half');
                })
              }
            >
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  border: '4.5px solid #0072de',
                  borderTopColor: '#EA580C',
                  borderLeftColor: '#EA580C',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              <span style={{ flex: 1, fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '15px', textAlign: 'left' }}>
                {t('Where to?')}
              </span>
              <Search size={20} style={{ color: 'var(--color-text-secondary)' }} />
            </button>

            {/* Saved / Bookmark Quick Chips */}
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
                      setBookingStep('VEHICLE');
                      setSheetSnap('half');
                    })
                  }
                >
                  <Bookmark size={14} style={{ color: '#0072de' }} />
                  <span>{dest}</span>
                </button>
              ))}
            </div>

            {ongoingTripCard}

            {/* Primary Destination Card with OneTap, GalaxyFleet, PRIORITY, Work Trip Badges (Reference: 1794990260264.jpg) */}
            <div
              className="gf-gocar-dest-card pressable"
              role="button"
              tabIndex={0}
              aria-label={`OneTap book to ${primaryPoi.name}`}
              onClick={() =>
                requireLocationBeforeCarUse(() => {
                  setBookDest(primaryPoi.name);
                  setDestCoords({ lat: primaryPoi.lat, lon: primaryPoi.lon });
                  setBookReservationType('ONE_WAY');
                  setBookingStep('VEHICLE');
                  setSheetSnap('half');
                })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  requireLocationBeforeCarUse(() => {
                    setBookDest(primaryPoi.name);
                    setDestCoords({ lat: primaryPoi.lat, lon: primaryPoi.lon });
                    setBookReservationType('ONE_WAY');
                    setBookingStep('VEHICLE');
                    setSheetSnap('half');
                  });
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <MapPin size={20} style={{ color: '#0072de', flexShrink: 0 }} />
                  <span style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {primaryPoi.name}
                  </span>
                </div>
                <Bookmark size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingLeft: '28px', flexWrap: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap', minWidth: 0 }}>
                  <span style={{ background: '#0072de', color: '#ffffff', fontSize: '10.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '9999px', whiteSpace: 'nowrap' }}>
                    OneTap
                  </span>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
                    GalaxyFleet
                  </span>
                  <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#0a0a0a', color: '#ffffff', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                    PRIORITY
                  </span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#005bb5', padding: '2px 8px', borderRadius: '9999px', background: '#dbeafe', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Work Trip
                </span>
              </div>

              <div style={{ paddingLeft: '28px', fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                {primaryPoi.address}
              </div>
            </div>

            {/* Secondary Corporate Destination Row Cards (Reference: Manufacturing Plant 2, Central Fleet Pool & Operations Base) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {secondaryPois.map((place, i) => (
                <button
                  key={`${place.name}-${i}`}
                  type="button"
                  className="gf-gocar-dest-row-card pressable"
                  onClick={() =>
                    requireLocationBeforeCarUse(() => {
                      setBookDest(place.name);
                      setDestCoords({ lat: place.lat, lon: place.lon });
                      setBookReservationType('ONE_WAY');
                      setBookingStep('VEHICLE');
                      setSheetSnap('half');
                    })
                  }
                >
                  <span
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '4px solid var(--color-text-muted)',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {place.name}
                    </div>
                    {place.address && (
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                        {place.address}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                </button>
              ))}
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
          subtitle: 'Nearest drop-off & driver staging bay • Recommended',
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

      // Dedicated compact Map Pin Picker Panel when routeTab === 'PIN' so the map gets 68% of the mobile screen
      if (routeTab === 'PIN') {
        return (
          <div id="mobile-pin-map-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <button
                id="pin-back-to-search-btn"
                type="button"
                className="gf-btn gf-btn-secondary gf-btn-sm pressable"
                style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px', gap: '5px' }}
                onClick={() => {
                  setRouteTab('RECENT');
                  setSheetSnap(bookDest.trim() ? 'peek' : 'half');
                }}
              >
                <ArrowLeft size={14} /> {t('Back to Search')}
              </button>

              <div
                style={{
                  display: 'inline-flex',
                  background: 'var(--color-bg-subtle)',
                  padding: '3px',
                  borderRadius: '9999px',
                  border: '1px solid var(--color-divider)',
                  gap: '3px',
                }}
              >
                <button
                  type="button"
                  className="pressable"
                  onClick={() => setActiveRouteField('pickup')}
                  style={{
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '4px 11px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: activeRouteField === 'pickup' ? '#0072de' : 'transparent',
                    color: activeRouteField === 'pickup' ? '#ffffff' : 'var(--color-text-secondary)',
                  }}
                >
                  {t('Pickup Point')}
                </button>
                <button
                  type="button"
                  className="pressable"
                  onClick={() => setActiveRouteField('destination')}
                  style={{
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '4px 11px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: activeRouteField === 'destination' ? '#0072de' : 'transparent',
                    color: activeRouteField === 'destination' ? '#ffffff' : 'var(--color-text-secondary)',
                  }}
                >
                  {t('Destination')}
                </button>
              </div>
            </div>

            <div
              id="pin-mode-live-address-card"
              style={{
                padding: '10px 12px',
                borderRadius: '12px',
                background: 'var(--color-bg-subtle)',
                border: '1px solid var(--color-divider)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'rgba(0, 114, 222, 0.14)',
                  color: '#258cfb',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <MapPin size={18} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="type-caption" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                  {activeRouteField === 'pickup' ? t('Pinning Pickup Point (Drag or tap map)') : t('Pinning Destination (Drag or tap map)')}
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '13.5px',
                    color: 'var(--color-text-primary)',
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {(activeRouteField === 'pickup' ? bookOrigin : bookDest) || t('Pan map to resolve street address...')}
                </div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* GoCar Reference Screen 2: Top Bar with Back Arrow + Title + Use GPS */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                id="route-back-btn"
                type="button"
                className="gf-icon-btn-48 pressable"
                onClick={() => {
                  setBookingStep('HOME');
                  setSheetSnap('half');
                }}
                aria-label="Back to Home"
                style={{ width: '36px', height: '36px' }}
              >
                <ArrowLeft size={18} />
              </button>
              <h1 className="type-title" style={{ fontSize: '19px' }}>
                {routeTab === 'PICKUP' ? t('Confirm pickup spot') : t('Where to today?')}
              </h1>
            </div>
            <button
              type="button"
              className="gf-btn gf-btn-ghost"
              style={{ minHeight: '34px', padding: '0 10px', fontSize: '12.5px', color: '#0072de', fontWeight: 700 }}
              onClick={handleUseCurrentGpsForField}
            >
              <Navigation size={14} /> {t('Use GPS')}
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
              setDestCoords(null);
            }}
            activeField={activeRouteField}
            onFocusField={(field) => {
              setActiveRouteField(field);
              if (routeTab === 'PICKUP') setRouteTab('RECENT');
            }}
            onSubmitDestination={() => {
              if (geoResults.length > 0 && Number.isFinite(geoResults[0].lat) && Number.isFinite(geoResults[0].lon)) {
                setBookDest(geoResults[0].name);
                setDestCoords({ lat: geoResults[0].lat, lon: geoResults[0].lon });
              }
              setSheetSnap('peek');
            }}
            pickupPlaceholder="Your current pickup location"
            destinationPlaceholder="Search for a destination"
            onAddStop={handleAddStop}
            multiStopToast={multiStopToast}
          />

          {/* GoCar Reference Screen 2: Outlined Action Pills ("Select via map", "Pick Destination on Map", "Pickup spot A/B/C") */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="gf-action-pill-outlined pressable"
              onClick={() => {
                setRouteTab('PIN');
                setSheetSnap('peek');
              }}
            >
              <MapPin size={15} style={{ color: '#0072de' }} />
              {t('Select via map')}
            </button>

            <button
              id="route-pick-dest-map-btn"
              type="button"
              className="gf-action-pill-outlined pressable"
              onClick={() => {
                setActiveRouteField('destination');
                setRouteTab('PIN');
                setSheetSnap('peek');
              }}
            >
              <MapPin size={15} style={{ color: '#0072de' }} />
              {t('Pick Destination on Map')}
            </button>

            <button
              type="button"
              className={`gf-action-pill-outlined pressable ${routeTab === 'PICKUP' ? 'is-active' : ''}`}
              onClick={() => {
                setRouteTab(routeTab === 'PICKUP' ? 'RECENT' : 'PICKUP');
                setSheetSnap('half');
              }}
            >
              <Navigation size={15} style={{ color: routeTab === 'PICKUP' ? '#ffffff' : '#0072de' }} />
              {t('Pickup spot')} ({selectedPickupSpot})
            </button>

            <button
              type="button"
              className={`gf-action-pill-outlined pressable ${routeTab === 'SAVED' ? 'is-active' : ''}`}
              onClick={() => {
                setRouteTab(routeTab === 'SAVED' ? 'RECENT' : 'SAVED');
                setSheetSnap('half');
              }}
            >
              <Bookmark size={15} style={{ color: routeTab === 'SAVED' ? '#ffffff' : '#0072de' }} />
              {t('Saved places')}
            </button>
          </div>

          {/* Live Calculated Route ETA, Ride Time & Distance Banner + 1-Tap Expand Route Map Button */}
          {bookOrigin.trim() && bookDest.trim() && (
            <div
              id="route-live-eta-banner"
              style={{
                padding: '10px 12px',
                borderRadius: '12px',
                background: 'rgba(0, 114, 222, 0.12)',
                border: '1px solid rgba(37, 140, 251, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Navigation size={15} style={{ color: '#258cfb' }} />
                <span className="type-body" style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                  {calculatingRoute
                    ? t('Calculating route path & ETA...')
                    : `${currentMetrics.distanceKm} km • ~${currentMetrics.durationMin} ${t('min ride')}`}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <StatusBadge label={`ETA ${currentMetrics.etaText}`} tone="blue" />
                <button
                  id="btn-toggle-route-map-view"
                  type="button"
                  className="gf-btn gf-btn-secondary gf-btn-sm pressable"
                  style={{ minHeight: '26px', padding: '0 8px', fontSize: '11px' }}
                  onClick={() => setSheetSnap(sheetSnap === 'peek' ? 'half' : 'peek')}
                >
                  {sheetSnap === 'peek' ? t('Show List') : t('View Map Path')}
                </button>
              </div>
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
                {t('Quick Corporate Locations')}
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
                        setSheetSnap('peek');
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
                    {t('Confirm pickup point')}
                  </div>
                  <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('Select a lettered gate or lobby spot for faster driver rendezvous')}
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
                  {t('Edit')}
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
                  title={`${t('Use typed address:')} "${activeText}"`}
                  subtitle={t('Select this location directly or refine coordinates using Select via map')}
                  showChevron
                  onClick={() => {
                    if (activeRouteField === 'pickup') {
                      setBookOrigin(activeText);
                      setOriginCoords(null);
                      setActiveRouteField('destination');
                    } else {
                      setBookDest(activeText);
                      if (geoResults[0] && Number.isFinite(geoResults[0].lat) && Number.isFinite(geoResults[0].lon)) {
                        setDestCoords({ lat: geoResults[0].lat, lon: geoResults[0].lon });
                      } else {
                        setDestCoords(null);
                      }
                      setSheetSnap('peek');
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
                          setSheetSnap('peek');
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
                            setSheetSnap('peek');
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Navigation size={13} style={{ color: '#0072de' }} />
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {t('Main Lobby / Drop-Off Entrance')}
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
                  title={`${t('Use typed address:')} "${activeText}"`}
                  subtitle={t('Use exact text you entered instead of suggested result')}
                  showChevron
                  onClick={() => {
                    if (activeRouteField === 'pickup') {
                      setBookOrigin(activeText);
                      setOriginCoords(null);
                      setActiveRouteField('destination');
                    } else {
                      setBookDest(activeText);
                      if (geoResults[0] && Number.isFinite(geoResults[0].lat) && Number.isFinite(geoResults[0].lon)) {
                        setDestCoords({ lat: geoResults[0].lat, lon: geoResults[0].lon });
                      } else {
                        setDestCoords(null);
                      }
                      setSheetSnap('peek');
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
    // BOOKING FLOW STEP 2: PICK YOUR RIDE, TRIP CATEGORY, TIME & INLINE PURPOSE / PASSENGERS FORM
    // -------------------------------------------------------------------------
    if (bookingStep === 'VEHICLE') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {feedbackBanner}

          {/* Header with Back Button to ROUTE step + 1-Tap Expand Route Map toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <button
                id="vehicle-back-btn"
                type="button"
                className="gf-icon-btn-48 pressable"
                style={{ width: '36px', height: '36px', flexShrink: 0 }}
                aria-label={t('Back')}
                title={t('Back')}
                onClick={() => {
                  setBookingStep('ROUTE');
                  setSheetSnap(bookDest.trim() ? 'peek' : 'half');
                }}
              >
                <ArrowLeft size={18} />
              </button>
              <h1 className="type-title" style={{ fontSize: '17.5px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t('Trip Category, Time & Booking Form')}
              </h1>
            </div>
            <button
              id="vehicle-toggle-map-btn"
              type="button"
              className="gf-btn gf-btn-secondary gf-btn-sm pressable"
              style={{ minHeight: '30px', padding: '0 10px', fontSize: '11.5px', flexShrink: 0 }}
              onClick={() => setSheetSnap(sheetSnap === 'peek' ? 'half' : 'peek')}
            >
              {sheetSnap === 'peek' ? t('Show Form') : t('View Map Path')}
            </button>
          </div>

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
                onClick={() => {
                  setBookingStep('ROUTE');
                  setSheetSnap('half');
                }}
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
              <span>✓ {t('Internal Work Fleet • Driver Included')}</span>
              <span style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                {`${currentMetrics.distanceKm} km • ~${currentMetrics.durationMin} min`}
              </span>
            </div>
          </div>

          {/* Step 2A: Choose Trip Category (Standard Trip, Round Trip, Full Day) & Departure / Return Time */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '14px',
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div>
              <div className="type-caption" style={{ fontWeight: 800, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
                1. {t('Trip Category')} *
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }} role="group" aria-label="Trip Category">
                {([
                  { id: 'ONE_WAY', label: t('Standard Trip'), sub: t('Point-to-point') },
                  { id: 'DROP_AND_PICKUP', label: t('Round Trip'), sub: t('Depart & return') },
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
                          todayEnd.setHours(16, 0, 0, 0);
                          let sMs = Math.max(todayStart.getTime(), minLeadMs);
                          let eMs = todayEnd.getTime();
                          if (eMs - sMs < 2 * 3600000) {
                            const tomStart = new Date();
                            tomStart.setDate(tomStart.getDate() + 1);
                            tomStart.setHours(8, 0, 0, 0);
                            const tomEnd = new Date(tomStart);
                            tomEnd.setHours(16, 0, 0, 0);
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
                        border: selected ? '2px solid var(--color-samsung-blue)' : '1px solid var(--color-border)',
                        background: selected ? 'var(--color-samsung-blue-tint)' : 'var(--color-bg-surface)',
                        color: selected ? 'var(--color-samsung-blue-text)' : 'var(--color-text-primary)',
                        textAlign: 'center',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 800, lineHeight: 1.2 }}>{mode.label}</span>
                      <span style={{ fontSize: '10px', opacity: 0.85, lineHeight: 1.15 }}>{mode.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Departure & Return Time Selector Banner */}
            <div
              id="booking-departure-return-banner"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '12px',
                background: 'var(--color-samsung-blue-tint)',
                border: '1px solid var(--color-samsung-blue-ring)',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <Clock size={18} style={{ color: 'var(--color-samsung-blue)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-samsung-blue-text)', textTransform: 'uppercase' }}>
                    2. {t('Departure & Return Time')}
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    {new Date(bookStart).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} → {new Date(bookEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({formatBookingDuration(bookStart, bookEnd, bookDurationHours)})
                  </div>
                  {bookEndAutoEtaMin != null && bookReservationType === 'ONE_WAY' && (
                    <div id="booking-eta-prefill-hint" style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-samsung-blue-text)', marginTop: '1px' }}>
                      {t('Auto-filled from route ETA')} (~{bookEndAutoEtaMin} {t('min')}) · {t('Editable')}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="gf-btn gf-btn-primary gf-btn-sm pressable"
                style={{ padding: '0 12px', height: '32px', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}
                onClick={() => setShowSchedulePicker(true)}
              >
                <Calendar size={14} /> {t('Set Time')}
              </button>
            </div>
          </div>

          {/* Dedicated Gojek-Style Schedule Picker Sheet (Time Scrolling Wheel Only — No Preset Chips) */}
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
                <div className="gf-gojek-priority-strip">
                  <ShieldCheck size={14} />
                  <span>{t('No worries, your booking is our priority')}</span>
                </div>

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

                <div style={{ padding: '14px 20px 16px', flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* 3-Tab Chips: Today / Tomorrow / Select date */}
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
                              const etaMin = Number(calculatedRoute?.durationMin || 0);
                              const eMs =
                                !userEditedBookEndRef.current && bookReservationType === 'ONE_WAY' && etaMin > 0
                                  ? computeEtaReturnMs(target.getTime(), etaMin)
                                  : target.getTime() + bookDurationHours * 3600000;
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

                    {/* Gojek Estimate Card */}
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

                    {/* Gojek Drum Time Scrolling Wheel Picker */}
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

                    {/* Trip Category Selector inside Schedule Sheet */}
                    <div>
                      <div className="type-caption" style={{ fontWeight: 700, marginBottom: '6px' }}>
                        {t('Trip Category')}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }} role="group" aria-label="Reservation mode">
                        {([
                          { id: 'ONE_WAY', label: t('Standard Trip'), sub: t('Point-to-point') },
                          { id: 'DROP_AND_PICKUP', label: t('Round Trip'), sub: t('Depart & return') },
                          { id: 'FULL_DAY', label: t('Full Day'), sub: t('Full business day') },
                        ] as Array<{ id: 'ONE_WAY' | 'DROP_AND_PICKUP' | 'FULL_DAY'; label: string; sub: string }>).map((mode) => {
                          const selected = bookReservationType === mode.id;
                          return (
                            <button
                              key={mode.id}
                              type="button"
                              className="pressable"
                              onClick={() => {
                                setBookReservationType(mode.id);
                                if (mode.id === 'ONE_WAY') {
                                  userEditedBookEndRef.current = false;
                                }
                              }}
                              style={{
                                padding: '8px 6px',
                                borderRadius: '10px',
                                border: selected ? '1.5px solid var(--color-samsung-blue)' : '1px solid var(--color-border)',
                                background: selected ? 'var(--color-samsung-blue-tint)' : 'var(--color-bg-surface)',
                                color: selected ? 'var(--color-samsung-blue-text)' : 'var(--color-text-primary)',
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

                    {/* Departure & Return Date/Time Inputs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      <div>
                        <label className="type-caption" htmlFor="schedule-start" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          {t('Departure Date & Time *')}
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
                                const etaMin = Number(calculatedRoute?.durationMin || 0);
                                const newEndMs =
                                  !userEditedBookEndRef.current && bookReservationType === 'ONE_WAY' && etaMin > 0
                                    ? computeEtaReturnMs(newStartMs, etaMin)
                                    : newStartMs + bookDurationHours * 3600000;
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
                            {t('Return Pick-Up Time *')}
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
                                    setBookDurationHours(Math.max(0.25, Number(((nextEndMs - sMs) / 3600000).toFixed(2))));
                                  }
                                }
                              }
                            }}
                          />
                        </div>
                      )}

                      <div>
                        <label className="type-caption" htmlFor="schedule-end" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          {t('Return Date & Time *')}
                          {bookEndAutoEtaMin != null && bookReservationType === 'ONE_WAY' && (
                            <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--color-samsung-blue-text)' }}>
                              ({t('Route ETA')})
                            </span>
                          )}
                        </label>
                        <input
                          id="schedule-end"
                          type="datetime-local"
                          className="gf-input"
                          required
                          value={bookEnd}
                          onChange={(e) => {
                            userEditedBookEndRef.current = true;
                            setBookEndAutoEtaMin(null);
                            setBookEnd(e.target.value);
                            if (e.target.value && bookStart) {
                              const diffHrs = Math.max(
                                0.25,
                                Number(((new Date(e.target.value).getTime() - new Date(bookStart).getTime()) / 3600000).toFixed(2))
                              );
                              setBookDurationHours(diffHrs);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

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

          {/* Step 2B: Direct Inline Booking Form — Trip Purpose & Passengers Name (1, 2, 3...) */}
          <div
            style={{
              padding: '14px',
              borderRadius: '14px',
              background: 'var(--color-bg-surface)',
              border: '1.5px solid var(--color-samsung-blue-ring)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--color-samsung-blue-text)' }}>
                3. {t('Trip Purpose')} &amp; {t('Passengers Name (1, 2, 3...)')}
              </span>
              <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'var(--color-samsung-blue-tint)', color: 'var(--color-samsung-blue-text)' }}>
                {t('* Mandatory')}
              </span>
            </div>

            {/* Inline Trip Purpose */}
            <div>
              <label htmlFor="inline-trip-purpose-input" className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                {t('Trip Purpose')} *
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {['Client visit', 'Site audit', 'Airport transfer', 'Executive briefing'].map((preset) => (
                  <Chip
                    key={preset}
                    active={bookPurpose === preset}
                    onClick={() => setBookPurpose(preset)}
                  >
                    {t(preset)}
                  </Chip>
                ))}
              </div>
              <input
                id="inline-trip-purpose-input"
                type="text"
                className="gf-input"
                required
                placeholder={t('Example: Cikarang Plant Visit, Client Meeting...')}
                value={bookPurpose}
                onChange={(e) => setBookPurpose(e.target.value)}
              />
            </div>

            {/* Inline Passengers Name (1, 2, 3...) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="type-caption" style={{ fontWeight: 700 }}>
                  {t('Passengers Name (1, 2, 3...)')} *
                </label>
                {bookPassengers.length < (selectedVehicle?.seats || 5) && (
                  <button
                    type="button"
                    className="gf-btn gf-btn-secondary gf-btn-sm pressable"
                    style={{ minHeight: '28px', padding: '0 10px', fontSize: '11.5px', gap: '4px' }}
                    onClick={() => {
                      const nextList = [...bookPassengers, { id: bookPassengers.length + 1, nickname: '' }];
                      setBookPassengers(nextList);
                      setBookPax(nextList.length);
                    }}
                  >
                    <Plus size={13} /> {t('Add')} Passenger {bookPassengers.length + 1}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bookPassengers.map((passenger, index) => (
                  <div key={passenger.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      className="mono"
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: 'var(--color-samsung-blue-tint)',
                        color: 'var(--color-samsung-blue-text)',
                        fontWeight: 800,
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      className="gf-input"
                      required
                      placeholder={`Passenger ${index + 1} Name / Nickname (e.g. ${index === 0 ? 'Budi' : index === 1 ? 'Sarah' : 'Andi'})`}
                      value={passenger.nickname}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBookPassengers((prev) =>
                          prev.map((p) => (p.id === passenger.id ? { ...p, nickname: val } : p))
                        );
                        if (index === 0) setBookPassengerNickname(val);
                      }}
                    />
                    {bookPassengers.length > 1 && (
                      <button
                        type="button"
                        className="gf-btn gf-btn-outline-danger"
                        style={{ minHeight: '34px', padding: '0 8px', fontSize: '11px', flexShrink: 0 }}
                        onClick={() => {
                          const filtered = bookPassengers.filter((p) => p.id !== passenger.id);
                          const renumbered = filtered.map((p, idx) => ({ ...p, id: idx + 1 }));
                          setBookPassengers(renumbered);
                          setBookPax(renumbered.length);
                          if (renumbered[0]) setBookPassengerNickname(renumbered[0].nickname);
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fleet Manager Car Assignment Notice (Users cannot choose a car directly) */}
          <div
            id="fleet-manager-car-assignment-notice"
            style={{
              padding: '12px 14px',
              borderRadius: '14px',
              background: 'var(--color-samsung-blue-tint)',
              border: '1.5px solid var(--color-samsung-blue-ring)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#0072de', color: '#ffffff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Car size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-samsung-blue-text)' }}>
                {t('Vehicle & Driver Assigned by Fleet Manager')}
              </div>
              <div className="type-caption" style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {t('You do not need to pick a car. When approving your request, Fleet Manager will assign an available company car & driver for your schedule.')}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // BOOKING FLOW STEP 3: ORDER SUMMARY ("Almost there") WITH DIRECT INLINE FORM
    // -------------------------------------------------------------------------
    if (bookingStep === 'SUMMARY') {
      const chosenDriverObj = drivers.find((d) => String(d.id) === String(bookDriverId));

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feedbackBanner}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              id="summary-back-btn"
              type="button"
              className="gf-icon-btn-48 pressable"
              style={{ width: '36px', height: '36px' }}
              aria-label={t('Back')}
              title={t('Back')}
              onClick={() => {
                setBookingStep('VEHICLE');
                setSheetSnap('half');
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="type-title" style={{ margin: 0 }}>{t('Almost there')}</h1>
          </div>

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
                  {`${currentMetrics.distanceKm} km • ~${currentMetrics.durationMin} ${t('min ride')} • ETA ${currentMetrics.etaText}`}
                </div>
              </div>
            </div>
            <button type="button" className="gf-proto-btn gf-proto-btn-o gf-proto-btn-s pressable" onClick={() => setBookingStep('ROUTE')}>
              {t('Edit')}
            </button>
          </div>

          {/* Direct Inline Trip Purpose & Passengers Name (1, 2, 3...) Form */}
          <div
            style={{
              padding: '14px',
              borderRadius: '14px',
              background: 'var(--color-surface)',
              border: '1.5px solid #93c5fd',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div>
              <label htmlFor="summary-inline-purpose-input" className="type-caption" style={{ fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                {t('Trip Purpose')} *
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {['Client visit', 'Site audit', 'Airport transfer', 'Executive briefing'].map((preset) => (
                  <Chip
                    key={preset}
                    active={bookPurpose === preset}
                    onClick={() => setBookPurpose(preset)}
                  >
                    {t(preset)}
                  </Chip>
                ))}
              </div>
              <input
                id="summary-inline-purpose-input"
                type="text"
                className="gf-input"
                required
                placeholder={t('Example: Cikarang Plant Visit...')}
                value={bookPurpose}
                onChange={(e) => setBookPurpose(e.target.value)}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="type-caption" style={{ fontWeight: 700 }}>
                  {t('Passengers Name (1, 2, 3...)')} *
                </label>
                {bookPassengers.length < (selectedVehicle?.seats || 5) && (
                  <button
                    type="button"
                    className="gf-btn gf-btn-secondary gf-btn-sm pressable"
                    style={{ minHeight: '28px', padding: '0 10px', fontSize: '11.5px', gap: '4px' }}
                    onClick={() => {
                      const nextList = [...bookPassengers, { id: bookPassengers.length + 1, nickname: '' }];
                      setBookPassengers(nextList);
                      setBookPax(nextList.length);
                    }}
                  >
                    <Plus size={13} /> {t('Add')} Passenger {bookPassengers.length + 1}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bookPassengers.map((passenger, index) => (
                  <div key={passenger.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      className="mono"
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: 'var(--color-samsung-blue-tint)',
                        color: 'var(--color-samsung-blue-text)',
                        fontWeight: 800,
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      className="gf-input"
                      required
                      placeholder={`Passenger ${index + 1} Name / Nickname`}
                      value={passenger.nickname}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBookPassengers((prev) =>
                          prev.map((p) => (p.id === passenger.id ? { ...p, nickname: val } : p))
                        );
                        if (index === 0) setBookPassengerNickname(val);
                      }}
                    />
                    {bookPassengers.length > 1 && (
                      <button
                        type="button"
                        className="gf-btn gf-btn-outline-danger"
                        style={{ minHeight: '34px', padding: '0 8px', fontSize: '11px', flexShrink: 0 }}
                        onClick={() => {
                          const filtered = bookPassengers.filter((p) => p.id !== passenger.id);
                          const renumbered = filtered.map((p, idx) => ({ ...p, id: idx + 1 }));
                          setBookPassengers(renumbered);
                          setBookPax(renumbered.length);
                          if (renumbered[0]) setBookPassengerNickname(renumbered[0].nickname);
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Rows */}
          <div>
            <ListRow
              id="summary-schedule-row"
              icon={<Calendar size={18} />}
              title={t('Schedule & Reservation')}
              subtitle={`${new Date(bookStart).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} → ${new Date(bookEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${formatBookingDuration(bookStart, bookEnd, bookDurationHours)}) • ${formatReservationModeLabel(bookReservationType, bookReservationType === 'DROP_AND_PICKUP' ? bookReturnPickupTime : null) || 'Standard Trip'}`}
              showChevron
              onClick={() => setBookingStep('VEHICLE')}
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
        title = 'Request Rejected';
      } else if (isUrgent && !picApproved) {
        badgeLabel = 'URGENT (< 2h)';
        badgeTone = 'red';
        title = 'Fleet PIC Review';
      } else if (isDual && picApproved) {
        badgeLabel = t('Step 2 of 2');
        badgeTone = 'amber';
        title = t('Awaiting Head of WS');
      } else if (isDual && !picApproved) {
        badgeLabel = t('Step 1 of 2');
        badgeTone = 'amber';
        title = t('Awaiting Fleet PIC');
      }

      const timelineSteps = isApproved
        ? [
            { label: t('Request Submitted'), sub: t('Schedule reserved'), done: true },
            {
              label: t('Approved'),
              sub: focusedTrip?.adm_delegated
                ? t('Authorized by Admin')
                : isDual
                ? t('Fleet PIC & Head of WS')
                : t('Fleet Operations'),
              done: true,
            },
            {
              label: t('Driver Assigned'),
              sub: focusedTrip?.assigned_driver_name
                ? `${focusedTrip.assigned_driver_name} • ${focusedTrip.registration_plate || t('Company Car')}`
                : t('Ready for departure'),
              done: true,
            },
          ]
        : isDual
        ? [
            { label: t('Request Submitted'), sub: t('Schedule reserved'), done: true },
            {
              label: t('1. Fleet PIC'),
              sub: picApproved ? t('Approved & driver paired') : t('Pending review'),
              done: Boolean(picApproved),
              active: !picApproved,
            },
            {
              label: t('2. Head of WS'),
              sub: hwsApproved
                ? t('Approved')
                : picApproved
                ? t('Pending final sign-off')
                : t('Waiting Step 1'),
              done: Boolean(hwsApproved),
              active: Boolean(picApproved) && !hwsApproved,
            },
          ]
        : [
            { label: t('Request Submitted'), sub: t('Schedule reserved'), done: true },
            {
              label: t('Fleet Review'),
              sub: t('Assigning driver & vehicle'),
              active: true,
            },
          ];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {feedbackBanner}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                id="waiting-back-btn"
                type="button"
                className="gf-icon-btn-48 pressable"
                style={{ width: '36px', height: '36px' }}
                aria-label={t('Back')}
                title={t('Back')}
                onClick={() => {
                  setBookingStep('HOME');
                  setSheetSnap('full');
                }}
              >
                <ArrowLeft size={18} />
              </button>
              <h1 className="type-title" style={{ margin: 0 }}>{title}</h1>
            </div>
            <StatusBadge label={badgeLabel} tone={badgeTone} />
          </div>

          {focusedTrip && (
            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-card)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div className="type-body" style={{ fontWeight: 700 }}>{focusedTrip.origin} → {focusedTrip.destination}</div>
                {formatReservationModeLabel(focusedTrip.reservation_type, focusedTrip.return_pickup_time) && (
                  <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '99px', background: 'rgba(0, 114, 222, 0.12)', color: '#258cfb' }}>
                    {formatReservationModeLabel(focusedTrip.reservation_type, focusedTrip.return_pickup_time)}
                  </span>
                )}
              </div>
              {focusedTrip.start_time && focusedTrip.end_time && (
                <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
                  {new Date(focusedTrip.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – {new Date(focusedTrip.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {focusedTrip.reservation_type === 'DROP_AND_PICKUP' && focusedTrip.return_pickup_time && (
                    <span style={{ color: '#258cfb', fontWeight: 700 }}>
                      {' '}• Return {new Date(focusedTrip.return_pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}
              {focusedTrip.assigned_driver_name && (
                <div className="type-caption" style={{ color: '#258cfb', fontWeight: 700 }}>
                  {focusedTrip.assigned_driver_name} • {focusedTrip.registration_plate}
                </div>
              )}
            </div>
          )}

          {/* Compact Approval Stepper */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
            {timelineSteps.map((st, idx) => (
              <div key={st.label} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '9999px',
                    background: st.done ? 'var(--color-green)' : st.active ? 'var(--color-green-tint)' : 'var(--color-bg-subtle)',
                    border: st.active ? '2px solid var(--color-green)' : '1px solid var(--color-divider)',
                    color: st.done ? '#ffffff' : 'var(--color-green-text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {st.done ? <CheckCircle2 size={14} /> : idx + 1}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flex: 1, gap: '8px', flexWrap: 'wrap' }}>
                  <span className="type-body" style={{ fontWeight: 700, fontSize: '13.5px' }}>{st.label}</span>
                  <span className="type-caption" style={{ fontSize: '12px' }}>{st.sub}</span>
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
                <Car size={16} /> {t('View Driver & Trip')}
              </button>
              {focusedTrip?.status === 'APPROVED' && !focusedTrip?.passenger_boarded_at && (
                <button
                  id="waiting-confirm-boarding-btn"
                  type="button"
                  className="gf-btn gf-btn-secondary gf-btn-full"
                  onClick={() => handleConfirmPassengerBoarding(focusedTrip)}
                >
                  <CheckCircle2 size={16} /> {t('Confirm Boarding')}
                </button>
              )}
              {focusedTrip?.status === 'APPROVED' && (
                <button
                  type="button"
                  className="gf-btn gf-btn-outline-danger gf-btn-full"
                  onClick={() => handleCancelBookingRequest(focusedTrip)}
                >
                  {t('Cancel Booking')}
                </button>
              )}
            </div>
          ) : isRejected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(248, 113, 113, 0.4)', borderRadius: '10px', padding: '10px 12px' }}>
                <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '12.5px' }}>{t('Rejected')}:</div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '12.5px', marginTop: '2px' }}>
                  {focusedTrip?.decisions?.find((d: any) => d.decision === 'REJECTED')?.reason || 'Declined by fleet administration.'}
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
                {t('Back to Home')}
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
                    setStatusBanner({ type: 'info', text: t('Trip status synced.') });
                  } catch {}
                }}
              >
                <RefreshCw size={14} /> {t('Refresh')}
              </button>
              <button
                type="button"
                className="gf-btn gf-btn-outline-danger"
                style={{ flex: 1 }}
                onClick={() => handleCancelBookingRequest(focusedTrip)}
              >
                {t('Cancel Request')}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {feedbackBanner}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                id="in-trip-back-btn"
                type="button"
                className="gf-icon-btn-48 pressable"
                style={{ width: '34px', height: '34px' }}
                aria-label={t('Back')}
                title={t('Back')}
                onClick={() => {
                  setBookingStep('HOME');
                  setSheetSnap('full');
                }}
              >
                <ArrowLeft size={17} />
              </button>
              <StatusBadge label={isStarted ? 'In Trip' : 'Driver Assigned'} tone={isStarted ? 'blue' : 'green'} />
              {tripModeLabel && <StatusBadge label={tripModeLabel} tone="blue" />}
            </div>
          </div>
          <h1 className="type-title" style={{ marginTop: '6px' }}>
            {isStarted
              ? `Arriving in ~${Math.max(8, currentMetrics.durationMin || 18)} min (ETA ${currentMetrics.etaText})`
              : canShowAssignedDriverLive && driverToPickupEta
              ? `Driver arriving in ~${driverToPickupEta.durationMin} min (${driverToPickupEta.distanceKm} km)`
              : canShowAssignedDriverLive
              ? t('Driver En Route')
              : t('Booking Confirmed')}
          </h1>
          {tripToShow && (
            <div className="type-caption">{tripToShow.origin} → {tripToShow.destination}</div>
          )}
          {tripToShow?.start_time && tripToShow?.end_time && (
            <div className="type-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {new Date(tripToShow.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – {new Date(tripToShow.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {tripToShow.reservation_type === 'DROP_AND_PICKUP' && tripToShow.return_pickup_time && (
                <span style={{ color: '#258cfb', fontWeight: 700 }}>
                  {' '}• Return {new Date(tripToShow.return_pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Live Assigned Driver Position & Pickup ETA (unlocked 10 min before departure or while IN_PROGRESS) */}
        {canShowAssignedDriverLive ? (
          <div
            id="live-driver-eta-card"
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              background: 'rgba(0, 114, 222, 0.1)',
              border: '1px solid rgba(37, 140, 251, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#258cfb', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {isStarted ? t('Live Trip GPS') : t('Driver Pickup ETA')}
              </div>
              <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {driverToPickupEta
                  ? `~${driverToPickupEta.durationMin} min (${driverToPickupEta.distanceKm} km) • ${driverToPickupEta.etaText}`
                  : t('Connecting to driver GPS...')}
              </div>
            </div>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '9999px',
                background: '#0072de',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              LIVE
            </span>
          </div>
        ) : tripToShow?.status === 'APPROVED' ? (
          <div
            id="driver-tracking-locked-notice"
            style={{
              padding: '10px 12px',
              borderRadius: '12px',
              background: 'var(--color-bg-subtle)',
              border: '1px solid var(--color-divider)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              <Lock size={14} style={{ color: '#258cfb', flexShrink: 0 }} />
              <span>{t('Live driver GPS & ETA active 10m before departure')}</span>
            </div>
            {driverTrackingUnlocksAtText && (
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#258cfb', whiteSpace: 'nowrap' }}>
                {driverTrackingUnlocksAtText}
              </span>
            )}
          </div>
        ) : null}

        {/* Clean Boarding Confirmation & Cancel Row (Zero Verbose Paragraphs) */}
        {!isStarted && tripToShow?.status === 'APPROVED' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {tripToShow?.passenger_boarded_at ? (
              <div
                style={{
                  flex: 1,
                  minHeight: '38px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  background: 'rgba(0, 114, 222, 0.12)',
                  border: '1px solid rgba(37, 140, 251, 0.35)',
                  color: '#258cfb',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={15} /> {t('Boarding Confirmed')}
              </div>
            ) : (
              <button
                id="confirm-boarding-btn"
                type="button"
                className="gf-btn gf-btn-primary"
                style={{ flex: 1, minHeight: '38px', fontSize: '12.5px' }}
                onClick={() => handleConfirmPassengerBoarding(tripToShow)}
              >
                <CheckCircle2 size={15} /> {t('Confirm Boarding')}
              </button>
            )}
            <button
              id="cancel-approved-booking-btn"
              type="button"
              className="gf-btn gf-btn-outline-danger"
              style={{ minHeight: '38px', fontSize: '12.5px', padding: '0 14px' }}
              onClick={() => handleCancelBookingRequest(tripToShow)}
            >
              <X size={15} /> {t('Cancel Booking')}
            </button>
          </div>
        )}

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
                {tripToShow?.assigned_driver_name || t('Assigned Company Driver')}
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
            <span className="type-caption" style={{ fontWeight: 600 }}>{t('Call')}</span>
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
              const shareModeLine = tripModeLabel ? `\n*Mode*: ${tripModeLabel}` : '';
              const shareMsg = `*GalaxyFleet Booking Details*\n*Vehicle*: ${tripToShow?.make} ${tripToShow?.model} (${tripToShow?.registration_plate || '—'})\n*Passenger(s) [Nickname only]*:\n${paxFormatted}\n*Driver*: ${tripToShow?.assigned_driver_name || 'Assigned Driver'}${driverPhone ? ` (${driverPhone})` : ''}\n*Pickup*: ${tripToShow?.origin}\n*Destination*: ${tripToShow?.destination}\n*Schedule*: ${new Date(tripToShow?.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(tripToShow?.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${shareModeLine}\n*Status*: ${tripToShow?.status || 'APPROVED'}\n\n_Reminder: For privacy protection, only nicknames are used._`;
              if (navigator.clipboard) {
                navigator.clipboard.writeText(shareMsg).catch(() => {});
              }
              window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg)}`, '_blank');
              setStatusBanner({ type: 'success', text: t('Booking details copied & opened WhatsApp to share with passenger!') });
            }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            title="Share booking details to passenger via WhatsApp"
          >
            <span className="gf-icon-btn-48 pressable"><Share2 size={20} /></span>
            <span className="type-caption" style={{ fontWeight: 600 }}>{t('Share')}</span>
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
          if (target === 'DRIVER') {
            setBookingStep('HOME');
            setDriverSectionTab('DISPATCH');
            setDriverDispatchDrawerOpen(false);
            setSheetSnap('peek');
          } else if (target === 'HOME') {
            setBookingStep('HOME');
            setSheetSnap('full');
          } else {
            setSheetSnap('full');
          }
        }}
        onSignOut={handleLogout}
        onOpenProfile={handleOpenProfileModal}
        hideChromeDuringBooking={(inActiveBookingFlow || (navSection === 'HOME' && customerHomeMode === 'GOCAR_LANDING')) && !isDriverOnly}
        isDriverOrPrivileged={user.role === 'DRV'}
        isPrivileged={Boolean(isPrivileged)}
        isDriverOnly={isDriverOnly}
        unreadInboxCount={unreadCount}
        pendingDispatchCount={dispatches.filter((d) => d.trip_status !== 'COMPLETED' && d.trip_status !== 'REJECTED').length}
        pendingAdminCount={pendingTrips.length + pendingUsers.length}
        userNickname={user?.nickname}
        departmentName={user?.department_name}
        onSwitchToDriverDispatch={
          user.role === 'DRV'
            ? () => {
                setNavSection('DRIVER');
                setDriverSectionTab('DISPATCH');
                setDriverDispatchDrawerOpen(false);
                setSheetSnap('peek');
              }
            : undefined
        }
        onSwitchToAdmin={() => setNavSection('ADMIN')}
        mapStage={
          showBookingMap ? (() => {
            const isDriverDispatchMap = user.role === 'DRV' && navSection === 'DRIVER' && driverSectionTab === 'DISPATCH';
            const isDriverFullMap = isDriverDispatchMap && !driverDispatchDrawerOpen;
            const isDriverOnline = Boolean(gpsNoticeAccepted && gpsReportingActive);
            const driverCompletedCount = trips.filter(
              (tr) =>
                (tr.assigned_driver_user_id === user.id || tr.assigned_driver_name === user.nickname) &&
                (tr.status === 'COMPLETED' || tr.trip_status === 'COMPLETED')
            ).length;
            const pendingDriverJobsCount = dispatches.filter(
              (d) => d.trip_status !== 'COMPLETED' && d.trip_status !== 'REJECTED'
            ).length;

            const handleToggleDriverPower = async () => {
              if (driverActivatingOnline) return;
              if (isDriverOnline) {
                setGpsReportingActive(false);
                setGpsNoticeAccepted(false);
                setDriverActivatingToast(t('Status updated to Offline'));
                setTimeout(() => setDriverActivatingToast(null), 3000);
              } else {
                setDriverActivatingOnline(true);
                detectAndReportUserLocation(true);
                try {
                  await sendDriverLocationReport('GRANTED');
                } catch {}
                window.setTimeout(() => {
                  setDriverActivatingOnline(false);
                  setGpsNoticeAccepted(true);
                  setGpsReportingActive(true);
                  setDriverActivatingToast(t('You are now online'));
                  window.setTimeout(() => setDriverActivatingToast(null), 3500);
                }, 1100);
              }
            };

            const isPinOnMapMode = navSection === 'HOME' && bookingStep === 'ROUTE' && routeTab === 'PIN';
            return (
              <div
                className={`gf-map-stage-host ${isDriverFullMap ? 'is-driver-full-map' : ''}`}
                style={
                  {
                    '--mobile-map-height': isDriverFullMap
                      ? 'calc(100 * var(--app-dvh-unit, 1dvh) - 64px)'
                      : isPinOnMapMode
                      ? 'calc(68 * var(--app-dvh-unit, 1dvh))'
                      : sheetSnap === 'peek'
                      ? 'calc(66 * var(--app-dvh-unit, 1dvh))'
                      : sheetSnap === 'full'
                      ? 'calc(34 * var(--app-dvh-unit, 1dvh))'
                      : 'calc(48 * var(--app-dvh-unit, 1dvh))',
                  } as React.CSSProperties
                }
              >
                {/* Reference Page 4: Gojek Driver Top Controls (Avatar, White Status Pill, Circular Power Button) */}
                {isDriverDispatchMap && (
                  <div className="gf-driver-topbar">
                    {/* Top-left: Circular Driver Avatar (44dp) with Samsung Blue online ring */}
                    <button
                      type="button"
                      id="driver-avatar-btn"
                      className={`gf-driver-avatar-btn pressable ${isDriverOnline ? 'is-online' : ''}`}
                      onClick={() => setNavSection('PROFILE')}
                      title={t('Corporate Driver Profile')}
                      style={{ width: '44px', height: '44px', flexShrink: 0 }}
                    >
                      <img
                        src={user?.photo_url || getDriverAvatarDataUri(user?.nickname || 'Driver')}
                        alt={user?.nickname}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </button>

                    {/* Top-center: White Rounded Status Pill (Offline > / Online compact medal + counter) */}
                    <button
                      type="button"
                      id="driver-status-pill-btn"
                      className={`gf-driver-status-pill pressable ${isDriverOnline ? 'is-online' : ''}`}
                      onClick={() => setDriverStatusSheetOpen(true)}
                      aria-label={isDriverOnline ? t('Online') : t('Offline')}
                    >
                      {isDriverOnline ? (
                        <>
                          <Award size={15} style={{ color: '#E25C09' }} />
                          <span style={{ fontSize: '13px', fontWeight: 800, lineHeight: 1.1 }}>
                            {driverCompletedCount}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>{t('Offline')}</span>
                          <ChevronRight size={16} style={{ color: '#1f1f1f', marginLeft: '-2px' }} />
                        </>
                      )}
                    </button>

                    {/* Top-right: 48dp Circular Power Button (Black offline / Spinner activating / Samsung Blue online) */}
                    <button
                      type="button"
                      id="driver-power-toggle-btn"
                      className={`gf-driver-power-btn pressable ${isDriverOnline ? 'is-online' : ''}`}
                      onClick={handleToggleDriverPower}
                      title={isDriverOnline ? t('Go Offline') : t('Online')}
                      aria-label={isDriverOnline ? t('Go Offline') : t('Online')}
                    >
                      {driverActivatingOnline ? (
                        <Loader2 size={22} className="gf-spin" />
                      ) : (
                        <Power size={22} />
                      )}
                    </button>
                  </div>
                )}

                {/* Reference Page 4: Right-edge floating 44dp circular white map buttons */}
                {isDriverFullMap && !driverActivatingOnline && (
                  <div className="gf-driver-map-fab-stack">
                    <button
                      type="button"
                      id="driver-fab-dispatches"
                      className="gf-driver-map-fab pressable"
                      onClick={() => {
                        setDriverDispatchDrawerOpen(true);
                        setSheetSnap('half');
                      }}
                      title={t('Duty & Trips')}
                      aria-label={t('Duty & Trips')}
                    >
                      <ClipboardList size={20} style={{ color: '#E25C09' }} />
                      {pendingDriverJobsCount > 0 && (
                        <span className="gf-driver-map-fab-badge">{pendingDriverJobsCount}</span>
                      )}
                    </button>

                    <button
                      type="button"
                      id="driver-fab-schedule"
                      className="gf-driver-map-fab pressable"
                      onClick={() => {
                        setDriverSectionTab('SCHEDULE');
                        setDriverDispatchDrawerOpen(false);
                        setSheetSnap('full');
                      }}
                      title={t('Car Timetable & Schedule')}
                      aria-label={t('Car Timetable & Schedule')}
                    >
                      <Calendar size={20} style={{ color: '#0072de' }} />
                    </button>

                    <button
                      type="button"
                      id="driver-fab-locate"
                      className="gf-driver-map-fab pressable"
                      onClick={() => detectAndReportUserLocation(false)}
                      title={t('Detect & center on my location')}
                      aria-label={t('Detect & center on my location')}
                    >
                      <LocateFixed size={20} style={{ color: isDriverOnline ? '#0072de' : '#1f1f1f' }} />
                    </button>
                  </div>
                )}

                {/* Reference Page 4: Going Online Scrim + Top Dark Banner + White Activation Sheet */}
                {isDriverDispatchMap && driverActivatingOnline && (
                  <>
                    <div className="gf-driver-top-banner">
                      <CompanyCarIcon size={18} />
                      <span>GalaxyFleet Driver • {t("Let's start work!")}</span>
                    </div>
                    <div className="gf-driver-scrim">
                      <div className="gf-driver-activating-sheet">
                        <div style={{ fontSize: '17px', fontWeight: 800, color: '#1f1f1f' }}>
                          {t('Switching to online...')}
                        </div>
                        <div style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.45 }}>
                          {t('Please do not close or leave the app until it finishes.')}
                        </div>
                        <div className="gf-driver-progress-track">
                          <div className="gf-driver-progress-bar" />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Reference Page 4: Dark Bottom Toast ("Anda sekarang online" / "You are now online") */}
                {driverActivatingToast && !driverActivatingOnline && !driverStatusSheetOpen && (
                  <div className="gf-driver-bottom-toast">
                    <CheckCircle2 size={16} style={{ color: '#258cfb' }} />
                    <span>{driverActivatingToast}</span>
                  </div>
                )}

                <MapView
                  hasDriverTopbar={isDriverDispatchMap}
                  driverMapMode={isDriverDispatchMap}
                  driverOnline={isDriverOnline}
                  driverAvatarUrl={user?.photo_url || getDriverAvatarDataUri(user?.nickname || 'Driver')}
                  driverTripInProgress={isDriverDispatchMap && driverTripInProgress}
                  followDriver={isDriverDispatchMap && driverTripInProgress}
                  onOpenNavigationApps={
                    isDriverDispatchMap && activeDriverDispatch
                      ? () =>
                          setNavAppModalTarget({
                            tripId: Number(activeDriverDispatch.trip_request_id),
                            origin: activeDriverDispatch.origin || '',
                            destination: activeDriverDispatch.destination || '',
                            originCoords: driverOriginCoords,
                            destCoords: driverDestCoords,
                            targetMode: 'DESTINATION',
                          })
                      : undefined
                  }
                  driverVehicleModel={(() => {
                    const myProf = drivers.find((d) => d.user_id === user.id);
                    const myVeh = myProf ? vehicles.find((v) => v.default_driver_id === myProf.id) : null;
                    return myVeh ? `${myVeh.make} ${myVeh.model}` : focusedTrip?.model || 'Stargazer';
                  })()}
                  driverVehicleEnergyType={(() => {
                    const myProf = drivers.find((d) => d.user_id === user.id);
                    const myVeh = myProf ? vehicles.find((v) => v.default_driver_id === myProf.id) : null;
                    return myVeh?.energy_type || focusedTrip?.energy_type || 'Gasoline';
                  })()}
                  origin={isDriverDispatchMap && activeDriverDispatch ? activeDriverDispatch.origin || '' : mapOrigin}
                  destination={isDriverDispatchMap && activeDriverDispatch ? activeDriverDispatch.destination || '' : mapDest}
                  originCoords={isDriverDispatchMap && activeDriverDispatch ? driverOriginCoords : originCoords}
                  destCoords={isDriverDispatchMap && activeDriverDispatch ? driverDestCoords : destCoords}
                  myCoords={myCoords}
                  userPins={[]}
                  fleetPositions={undefined}
                  currentUserId={user.id}
                  onLocateMe={() => detectAndReportUserLocation(false)}
                  locatingUser={locatingUser}
                  showRoute={isDriverDispatchMap ? Boolean(activeDriverDispatch?.destination) : showRouteOnMap}
                  routeGeometry={isDriverDispatchMap && activeDriverDispatch ? driverRoute?.geometry || null : calculatedRoute?.geometry || null}
                  routeMetrics={isDriverDispatchMap && activeDriverDispatch ? driverRoute : calculatedRoute}
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
                  driverActive={navSection === 'HOME' && bookingStep === 'IN_TRIP' && canShowAssignedDriverLive}
                  driverName={focusedTrip?.assigned_driver_name}
                  driverCoords={canShowAssignedDriverLive ? activeTripDriverCoords : null}
                  driverToPickupEta={canShowAssignedDriverLive ? driverToPickupEta : null}
                  activeVehicleModel={focusedTrip?.model || 'Stargazer'}
                  showBackButton={inActiveBookingFlow && !isDriverOnly}
                  onBack={handleMapBack}
                  isOffline={isOffline}
                />
              </div>
            );
          })() : null
        }
        sheet={
          navSection === 'DRIVER' && driverSectionTab === 'DISPATCH' && !driverDispatchDrawerOpen ? null : (
            <BottomSheet
              snap={sheetSnap}
              onSnapChange={setSheetSnap}
              onEscape={
                navSection === 'DRIVER' && driverDispatchDrawerOpen
                  ? () => setDriverDispatchDrawerOpen(false)
                  : inActiveBookingFlow
                  ? handleMapBack
                  : undefined
              }
              hasBottomNav={!(inActiveBookingFlow || (navSection === 'HOME' && customerHomeMode === 'GOCAR_LANDING'))}
              fullScreenPage={!showBookingMap}
              stepKey={`${navSection}:${bookingStep}:${customerHomeMode}:${driverSectionTab}`}
              footer={stickyFooter}
              topNav={undefined}
              ariaLabel="GalaxyFleet booking sheet"
            >
              {renderSheetContent()}
            </BottomSheet>
          )
        }
      />

      {/* Reference Page 5: Floating Driver Status Sheet over Dimmed Map + Circular White Close (X) Below */}
      {driverStatusSheetOpen && (() => {
        const isDriverOnline = Boolean(gpsNoticeAccepted && gpsReportingActive);
        const myDriverTrips = trips.filter(
          (tr) => tr.assigned_driver_user_id === user.id || tr.assigned_driver_name === user.nickname
        );
        const completedCount = myDriverTrips.filter(
          (tr) => tr.status === 'COMPLETED' || tr.trip_status === 'COMPLETED'
        ).length;
        const dedicatedCar = vehicles.find(
          (v) =>
            (v.dedicated_driver_user_id && v.dedicated_driver_user_id === user.id) ||
            (v.default_driver_name && v.default_driver_name.toLowerCase() === (user.nickname || '').toLowerCase())
        );
        const activeJobsCount = dispatches.filter(
          (d) => d.trip_status !== 'COMPLETED' && d.trip_status !== 'REJECTED'
        ).length;

        return (
          <div
            className="gf-driver-status-sheet-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={t('Driver Status')}
            onClick={() => setDriverStatusSheetOpen(false)}
          >
            <div
              className="gf-driver-status-sheet-card"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header: "Offline v" or "Online v" */}
              <button
                type="button"
                className="gf-driver-status-sheet-header"
                onClick={() => setDriverStatusSheetOpen(false)}
              >
                <span>{isDriverOnline ? t('Online') : t('Offline')}</span>
                <ChevronDown size={18} />
              </button>

              <div className="gf-driver-status-sheet-body">
                {/* 1. Today's Summary (Poin hari ini -> Today's Trips) */}
                <div style={{ padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '12.5px', color: '#878787', fontWeight: 500 }}>
                    {t('Trips Completed')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <Award size={22} style={{ color: '#E25C09' }} />
                    <span style={{ fontSize: '26px', fontWeight: 800, color: '#1f1f1f', lineHeight: 1 }}>
                      {completedCount}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#878787', marginTop: '4px' }}>
                    {completedCount} / {Math.max(completedCount, myDriverTrips.length)} {t('Trips Completed')}
                  </div>
                </div>

                {/* 2. Two Stats Side-by-Side (Dispatch Acceptance & Trip Completion) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    padding: '14px 0',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', color: '#878787', marginBottom: '4px' }}>
                      {t('Dispatch Acceptance')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={18} style={{ color: '#E25C09' }} />
                      <span style={{ fontSize: '22px', fontWeight: 800, color: '#1f1f1f' }}>100%</span>
                      <Info size={14} style={{ color: '#94a3b8' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#878787', marginBottom: '4px' }}>
                      {t('Trip Completion')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={18} style={{ color: '#E25C09' }} />
                      <span style={{ fontSize: '22px', fontWeight: 800, color: '#1f1f1f' }}>100%</span>
                      <Info size={14} style={{ color: '#94a3b8' }} />
                    </div>
                  </div>
                </div>

                {/* 3. Assigned Dedicated Vehicle Row */}
                <div className="gf-driver-status-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <img
                      src={getVehiclePhotoIconUrl(dedicatedCar ? `${dedicatedCar.make} ${dedicatedCar.model}` : 'Stargazer', dedicatedCar?.energy_type)}
                      alt={dedicatedCar ? `${dedicatedCar.make} ${dedicatedCar.model}` : 'Assigned Car'}
                      style={{ width: '42px', height: '42px', objectFit: 'contain', flexShrink: 0, borderRadius: '10px', background: '#f8fafc', padding: '2px', border: '1px solid #e2e8f0' }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#1f1f1f' }}>
                        {dedicatedCar ? `${dedicatedCar.make} ${dedicatedCar.model}` : t('Assigned Dedicated Car')}
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#878787', marginTop: '2px' }}>
                        {dedicatedCar ? `${dedicatedCar.registration_plate} • Odo ${dedicatedCar.current_odometer} km` : t('Ready for Duty')}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="gf-driver-outlined-pill pressable"
                    onClick={() => {
                      setDriverStatusSheetOpen(false);
                      setDriverDispatchDrawerOpen(true);
                      setSheetSnap('half');
                    }}
                  >
                    {t('Details')}
                  </button>
                </div>

                {/* 4. Active Dispatches Row */}
                <div className="gf-driver-status-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1f1f1f' }}>
                      {t('Duty & Trips')}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#878787', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{t('Active Dispatches')}:</span>
                      <span
                        style={{
                          background: '#0072de',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '1px 7px',
                          borderRadius: '9999px',
                        }}
                      >
                        {activeJobsCount}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="gf-driver-outlined-pill pressable"
                    onClick={() => {
                      setDriverStatusSheetOpen(false);
                      setDriverDispatchDrawerOpen(true);
                      setSheetSnap('half');
                    }}
                  >
                    {t('Open')}
                  </button>
                </div>

                {/* 5. Operational Schedule Row (Pilihan operasional -> Atur) */}
                <div className="gf-driver-status-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1f1f1f' }}>
                      {t('Car Timetable & Schedule')}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#878787', marginTop: '2px' }}>
                      {t('View your assigned shift & bookings')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="gf-driver-outlined-pill pressable"
                    onClick={() => {
                      setDriverStatusSheetOpen(false);
                      setDriverSectionTab('SCHEDULE');
                      setDriverDispatchDrawerOpen(false);
                      setSheetSnap('full');
                    }}
                  >
                    {t('Manage')}
                  </button>
                </div>

                {/* 6. Trip Log & Petty Cash Row */}
                <div className="gf-driver-status-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1f1f1f' }}>
                      {t('Trip Log & Petty Cash')}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#878787', marginTop: '2px' }}>
                      {t('Fuel, toll & parking receipts')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="gf-driver-outlined-pill pressable"
                    onClick={() => {
                      setDriverStatusSheetOpen(false);
                      setNavSection('ACTIVITY');
                      setSheetSnap('full');
                    }}
                  >
                    {t('View')}
                  </button>
                </div>

                {/* 7. Display Mode & Language Row */}
                <div className="gf-driver-status-row">
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1f1f1f' }}>
                    {t('Appearance & Language')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DisplayModeToggle variant="icon" id="driver-status-display-toggle" />
                    <LanguageSwitcher compact />
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Circular White Close (X) Button beneath the card (Reference Page 5) */}
            <button
              type="button"
              id="driver-status-sheet-close-btn"
              className="gf-driver-status-sheet-close pressable"
              onClick={() => setDriverStatusSheetOpen(false)}
              aria-label={t('Close')}
            >
              <X size={22} />
            </button>
          </div>
        );
      })()}

      {renderSharedModals()}
    </>
  );
}

export default App;
