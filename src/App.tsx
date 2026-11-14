import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Car,
  ShieldCheck,
  Bell,
  Download,
  LogOut,
  Calendar,
  Navigation,
  CheckCircle2,
  Clock,
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
  CreditCard,
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
import { SamsungBusLogo } from './components/SamsungBusLogo';
import { RouteFields } from './components/RouteFields';
import { VehicleArt } from './components/VehicleArt';
import { getDriverAvatarDataUri } from './components/CarAvatarArt';
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

function getTimeGreeting(): string {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good morning';
  if (hr < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatIdr(amount: number | string | undefined | null): string {
  const num = Number(amount || 0);
  return `Rp ${Math.round(num).toLocaleString('id-ID')}`;
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

export function App() {
  const [user, setUser] = useState<any | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState<string>('');
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  // Official Company Groups (12 Groups)
  const [groupsList, setGroupsList] = useState<Array<{ id: number; name: string; code?: string; is_active?: number }>>(FALLBACK_GROUPS);

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
  const [sheetSnap, setSheetSnap] = useState<SnapPoint>('half');
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

  // Home / Route / Ride / Activity sub-states
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [routeTab, setRouteTab] = useState<'RECENT' | 'SAVED' | 'PIN'>('RECENT');
  const [activeRouteField, setActiveRouteField] = useState<'pickup' | 'destination'>('destination');
  const [scheduleMode, setScheduleMode] = useState<'NOW' | 'SCHEDULE'>('NOW');
  const [vehicleFilter, setVehicleFilter] = useState<'ALL' | 'Electric' | 'MPV'>('ALL');
  const [activityTab, setActivityTab] = useState<'ONGOING' | 'HISTORY'>('ONGOING');
  const [summaryPicker, setSummaryPicker] = useState<'PURPOSE' | 'PAX' | 'NOTES' | 'CHARGE' | null>(null);
  const [focusedTripId, setFocusedTripId] = useState<number | null>(null);
  const [driverSectionTab, setDriverSectionTab] = useState<'DISPATCH' | 'SCHEDULE'>('DISPATCH');

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
  const defaultStart = new Date(Date.now() + 2 * 3600000).toISOString().slice(0, 16);
  const defaultEnd = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 16);
  const [bookPurpose, setBookPurpose] = useState('');
  const [bookPassengerNickname, setBookPassengerNickname] = useState('');
  const [bookPassengers, setBookPassengers] = useState<Array<{ id: number; nickname: string }>>([
    { id: 1, nickname: '' },
  ]);
  const [bookOrigin, setBookOrigin] = useState('');
  const [bookDest, setBookDest] = useState('');
  const [bookStart, setBookStart] = useState(defaultStart);
  const [bookEnd, setBookEnd] = useState(defaultEnd);
  const [bookVehicleId, setBookVehicleId] = useState<number>(0);
  const [bookDriverId, setBookDriverId] = useState<string>('');
  const [bookPax, setBookPax] = useState<number>(1);
  const [bookNotes, setBookNotes] = useState('');
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
    department_id: 1,
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
          setRegDeptId(res.groups[0].id);
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

  // Live MapTiler / Nominatim address search when typing in RouteFields
  useEffect(() => {
    if (bookingStep !== 'ROUTE' || routeTab === 'PIN') return;
    const queryText = (activeRouteField === 'pickup' ? bookOrigin : bookDest).trim();
    if (queryText.length < 2) {
      setGeoResults([]);
      setGeoLoading(false);
      return;
    }
    setGeoLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiRequest(`/api/geocode/search?q=${encodeURIComponent(queryText)}`);
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
        setGeoResults([]);
      } finally {
        setGeoLoading(false);
      }
    }, 150);
    return () => window.clearTimeout(timer);
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
    const sDate = scheduleMode === 'NOW' ? new Date(Date.now() + 5 * 60000) : new Date(bookStart);
    const eDate = scheduleMode === 'NOW' ? new Date(Date.now() + 125 * 60000) : new Date(bookEnd);
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

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('GalaxyFleet PWA Push Active', {
            body: 'You will now receive instant booking, reminder, and dispatch notifications.',
            icon: '/icons/icon.svg',
          });
        }

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

    // If user is on Employee Home or Driver Dispatch and hasn't verified location permission yet, show the location permission popup
    if (!locationPermissionVerified && !myCoords && (user.role === 'EMP' || user.role === 'DRV')) {
      setShowLocationPermissionModal(true);
    }

    const locInterval = window.setInterval(() => {
      detectAndReportUserLocation(false);
    }, 45 * 1000);

    // Real-time notification poller (delivers alerts to Driver, User, Admin, Head of WS Part, Fleet Operation PIC)
    const notifInterval = window.setInterval(async () => {
      try {
        const res = await apiRequest('/api/notifications');
        const list = res.notifications || [];
        setNotifications((prev) => {
          const prevIds = new Set(prev.map((n: any) => n.id));
          const newItems = list.filter((n: any) => !prevIds.has(n.id) && !n.is_read);
          if (newItems.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
            for (const item of newItems) {
              try {
                new Notification(item.title, { body: item.body, icon: '/icons/icon.svg' });
              } catch {}
            }
          }
          return list;
        });
      } catch {}
    }, 15 * 1000);

    return () => {
      window.clearInterval(locInterval);
      window.clearInterval(notifInterval);
    };
  }, [user]);

  const handleUseCurrentGpsForField = () => {
    detectAndReportUserLocation(true);
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
    const startIso = scheduleMode === 'NOW' ? new Date(Date.now() + 5 * 60000).toISOString() : new Date(bookStart).toISOString();
    const endIso = scheduleMode === 'NOW' ? new Date(Date.now() + 125 * 60000).toISOString() : new Date(bookEnd).toISOString();
    const effectivePurpose = bookPurpose.trim() || 'Company Business Trip';

    const cleanPassengers = bookPassengers
      .map((p, idx) => ({ id: idx + 1, nickname: p.nickname.trim() }))
      .filter((p) => Boolean(p.nickname));
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
          passenger_count: Math.max(1, cleanPassengers.length || Number(bookPax)),
          passenger_nickname: formattedPaxNickname,
          passengers: cleanPassengers,
          notes: bookNotes,
        }),
      });
      setBookPurpose('');
      setBookPassengerNickname('');
      setBookPassengers([{ id: 1, nickname: '' }]);
      setBookPax(1);
      setBookNotes('');
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

  const handleApproveUser = async (targetUserId: number, approve: boolean, selectedRole: string) => {
    try {
      await apiRequest(`/api/users/${targetUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          approval_status: approve ? 'APPROVED' : 'REJECTED',
          role: selectedRole,
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
          department_id: Number(newDriverForm.department_id) || 1,
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
        department_id: groupsList[0]?.id || 1,
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
        department_id: groupsList[0]?.id || 1,
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
          t.booking_id !== null &&
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
          t.booking_status === 'CANCELLED' ||
          t.booking_id === null
      ),
    [trips]
  );

  const focusedTrip = useMemo(
    () => trips.find((t) => t.id === focusedTripId) || ongoingTrips[0] || null,
    [trips, focusedTripId, ongoingTrips]
  );

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

  // Real live system status cards for Home carousel (zero fake announcements)
  const liveOverviewCards = useMemo(() => {
    const availCars = vehicles.filter((v) => v.status === 'Available').length;
    const evCars = vehicles.filter((v) => v.energy_type === 'Electric' && v.status === 'Available').length;
    return [
      {
        tag: 'Fleet Status',
        title: vehicles.length > 0 ? `${availCars} of ${vehicles.length} Vehicles Available` : 'Fleet Ready for Registration',
        body:
          vehicles.length > 0
            ? `${evCars} Electric and ${Math.max(0, availCars - evCars)} Gasoline vehicles ready for booking.`
            : 'Administrators can register company vehicles and drivers in the Admin Console.',
      },
      {
        tag: 'Schedule Protection',
        title: 'Instant Schedule Lock',
        body: 'Vehicle and driver time slots lock immediately on submission to prevent double-booking.',
      },
      {
        tag: 'Mobile PWA',
        title: 'Push Alerts & Reminders',
        body: 'Enable push notifications to receive instant booking approvals, dispatch updates, and trip reminders.',
      },
    ];
  }, [vehicles]);

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
              <p className="type-caption">Internal Fleet Management System</p>
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
                { value: 'LOGIN', label: 'Sign In' },
                { value: 'REGISTER', label: 'Register Account' },
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
                  Username
                </label>
                <input
                  id="login-username"
                  className="gf-input"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="Enter your username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="type-caption" htmlFor="login-password" style={{ fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  id="login-password"
                  className="gf-input"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
              <button id="login-submit-btn" type="submit" className="gf-btn gf-btn-primary gf-btn-full">
                Sign In to GalaxyFleet
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
                  Nickname
                </label>
                <input
                  id="reg-nickname"
                  className="gf-input"
                  type="text"
                  required
                  placeholder="Enter your nickname"
                  value={regNickname}
                  onChange={(e) => setRegNickname(e.target.value)}
                />
              </div>

              <div>
                <label className="type-caption" htmlFor="reg-dept" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Group
                </label>
                <select id="reg-dept" className="gf-select notranslate" translate="no" value={regDeptId} onChange={(e) => setRegDeptId(Number(e.target.value))}>
                  {groupsList.map((g) => (
                    <option key={g.id} value={g.id} className="notranslate" translate="no">
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="type-caption" htmlFor="reg-username" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Username
                </label>
                <input
                  id="reg-username"
                  className="gf-input"
                  type="text"
                  required
                  placeholder="Enter your username"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="type-caption" htmlFor="reg-password" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Password
                </label>
                <input
                  id="reg-password"
                  className="gf-input"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="type-caption" htmlFor="reg-role" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Account Type
                </label>
                <select id="reg-role" className="gf-select" value={regRole} onChange={(e) => setRegRole(e.target.value as 'EMP' | 'DRV')}>
                  <option value="EMP">User / Employee (Book & Reserve Cars)</option>
                  <option value="DRV">Company Driver (Receive Dispatch Orders)</option>
                </select>
              </div>

              <button id="register-submit-btn" type="submit" className="gf-btn gf-btn-primary gf-btn-full">
                Submit Registration
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
              <div className="type-body" style={{ fontWeight: 700 }}>{dispatchModalTrip.purpose}</div>
              <div className="type-caption">{dispatchModalTrip.origin} → {dispatchModalTrip.destination}</div>
              <div className="type-caption">{dispatchModalTrip.requester_name} ({dispatchModalTrip.department_name})</div>
            </div>

            {dispatchModalTrip.requires_dual_approval && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#eff6ff', border: '1.5px solid #bfdbfe', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', marginBottom: '4px' }}>Dual-Approval Requirement</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11.5px' }}>
                  <span style={{ color: dispatchModalTrip.pic_approved ? '#059669' : '#64748b', fontWeight: 700 }}>
                    {dispatchModalTrip.pic_approved ? '✓ Fleet Operation PIC: Approved' : '⏳ Fleet Operation PIC: Pending'}
                  </span>
                  <span>•</span>
                  <span style={{ color: dispatchModalTrip.hws_approved ? '#059669' : '#64748b', fontWeight: 700 }}>
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
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#059669' }}>{usageAnalytics.tripDurationSummary?.totalDurationFormatted || '0 Hours 0 Minutes'}</div>
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
                    <span className="gf-badge" style={{ background: '#ecfdf5', color: '#065f46', border: '1.5px solid #10b981', fontWeight: 800, padding: '3px 8px', fontSize: '10.5px' }}>
                      ✓ APPROVED BY SYSTEM
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }}>Digital Audit: SYS-PIC-CERTIFIED</div>
                </div>
                <div style={{ border: '1.5px solid #dbeafe', borderRadius: '8px', padding: '10px', textAlign: 'center', background: '#f8fafc' }}>
                  <div style={{ fontSize: '9.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Reviewed & Authorized By</div>
                  <div style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a', marginTop: '2px' }}>Head Of WS Part</div>
                  <div style={{ margin: '6px 0 2px 0' }}>
                    <span className="gf-badge" style={{ background: '#ecfdf5', color: '#065f46', border: '1.5px solid #10b981', fontWeight: 800, padding: '3px 8px', fontSize: '10.5px' }}>
                      ✓ APPROVED BY SYSTEM
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }}>Digital Audit: SYS-HWS-CERTIFIED</div>
                </div>
                <div style={{ border: '1.5px solid #dbeafe', borderRadius: '8px', padding: '10px', textAlign: 'center', background: '#f8fafc' }}>
                  <div style={{ fontSize: '9.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Final Executive Sign-Off</div>
                  <div style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a', marginTop: '2px' }}>Executive General Manager</div>
                  <div style={{ margin: '6px 0 2px 0' }}>
                    <span className="gf-badge" style={{ background: '#ecfdf5', color: '#065f46', border: '1.5px solid #10b981', fontWeight: 800, padding: '3px 8px', fontSize: '10.5px' }}>
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
                        <span style={{ background: '#dcfce7', color: '#166534', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '9999px' }}>
                          ✅ Recommended for Real Fleet Launch
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#0f172a', marginTop: '6px', lineHeight: 1.5, background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ color: '#0369a1', fontWeight: 700, marginBottom: '2px' }}>
                          🛡️ GUARANTEED NOT ERASED:
                        </div>
                        <div>• <strong>Vehicle License Plates & Specs:</strong> All plate numbers ({vehicles.map(v => v.registration_plate).slice(0, 5).join(', ')}{vehicles.length > 5 ? '...' : ''}), models, VINs remain fully intact.</div>
                        <div>• <strong>Driver Names & Phone Numbers:</strong> All driver profiles, contact phones, licenses, and photos remain fully intact.</div>
                        <div>• <strong>User Accounts & 12 Company Groups:</strong> All logins and department structures remain fully intact.</div>
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
                        Wipes all test vehicles, test drivers, test trips, bookings, expenses, and non-admin users. Returns system to clean production slate (12 official Groups and Admin account) so you can register real cars and drivers from scratch.
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
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(0, 114, 222, 0.25)',
                marginBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bell size={20} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px' }}>Enable Real-Time Notifications</div>
                  <div style={{ fontSize: '11px', opacity: 0.9 }}>
                    Get instant push alerts for car approvals, driver dispatches, and operations.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  type="button"
                  className="gf-btn"
                  style={{ background: '#ffffff', color: '#0072de', fontWeight: 800, border: 'none', padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => handleEnablePushNotifications(false)}
                >
                  Allow Alerts
                </button>
                <button
                  type="button"
                  className="gf-btn"
                  style={{ background: 'transparent', color: '#ffffff', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 10px', fontSize: '11px' }}
                  onClick={() => setShowNotificationPromptBanner(false)}
                >
                  Dismiss
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
                    <span className="gf-badge" style={{ background: '#e0edff', color: '#005bb5', fontWeight: 700, padding: '4px 10px' }}>
                      ⛽ Gasoline: {fleetPositions.filter((p) => p.energy_type === 'Gasoline').length} Cars
                    </span>
                    <span className="gf-badge" style={{ background: '#ecfdf5', color: '#059669', fontWeight: 700, padding: '4px 10px' }}>
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
                                      background: isInTrip ? '#258cfb' : '#10b981',
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
                                        background: isInTrip ? '#fef3c7' : '#ecfdf5',
                                        color: isInTrip ? '#b45309' : '#059669',
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
                                      style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px', background: '#dcfce7', color: '#166534', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
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
                                        style={{ minHeight: '32px', padding: '0 8px', fontSize: '12px', background: '#dcfce7', color: '#166534', textDecoration: 'none' }}
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
                    <UserCheck size={18} /> Pending Account Registrations ({pendingUsers.length})
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
                    <Bell size={16} /> Send Upcoming Push Reminders
                  </button>
                </div>

                {pendingUsers.length === 0 ? (
                  <EmptyState message="All registered accounts have been reviewed." />
                ) : (
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
                          return (
                            <tr key={u.id}>
                              <td style={{ fontWeight: 700 }}>{u.nickname}</td>
                              <td className="mono">@{u.group_username}</td>
                              <td>{u.department_name}</td>
                              <td>
                                <select
                                  className="gf-select"
                                  style={{ minHeight: '38px', padding: '0 10px' }}
                                  value={roleVal}
                                  onChange={(e) => setPendingRoleSelections({ ...pendingRoleSelections, [u.id]: e.target.value })}
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
                                  <button type="button" className="gf-btn gf-btn-primary" onClick={() => handleApproveUser(u.id, true, roleVal)}>
                                    Approve
                                  </button>
                                  <button type="button" className="gf-btn gf-btn-outline-danger" onClick={() => handleApproveUser(u.id, false, roleVal)}>
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
                )}
              </section>

              <section className="gf-card-flat">
                <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <ShieldCheck size={18} /> Vehicle Bookings & Dispatch Queue ({trips.length})
                </h2>
                {trips.length === 0 ? (
                  <EmptyState message="No vehicle bookings submitted yet." />
                ) : (
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
                              <div style={{ fontWeight: 700 }}>#{t.id} — {t.purpose}</div>
                              <div className="type-caption">{t.origin} → {t.destination} ({t.passenger_count} pax)</div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{t.requester_name}</div>
                              <div className="type-caption">{t.department_name}</div>
                            </td>
                            <td className="mono type-caption">
                              <div>{new Date(t.start_time).toLocaleString()}</div>
                              <div>{new Date(t.end_time).toLocaleTimeString()}</div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{t.registration_plate}</div>
                              <div className="type-caption">Driver: {t.assigned_driver_name || 'Unassigned'}</div>
                            </td>
                            <td>
                              <StatusBadge label={t.status} tone={toneFromStatus(t.status)} />
                              {t.status === 'PENDING_APPROVAL' && t.requires_dual_approval && (
                                <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: 600 }}>
                                  {t.pic_approved && !t.hws_approved ? (
                                    <span style={{ color: '#0072de' }}>✓ PIC Approved • Awaiting Head Of WS Part</span>
                                  ) : t.hws_approved && !t.pic_approved ? (
                                    <span style={{ color: '#059669' }}>✓ Head Of WS Part Approved • Awaiting PIC</span>
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
                )}
              </section>

              <section className="gf-card-flat">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <h2 className="type-section">User Registry & Account Management ({usersList.length})</h2>
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
                    className="gf-select"
                    aria-label="User group"
                    value={newUserForm.department_id}
                    onChange={(e) => setNewUserForm({ ...newUserForm, department_id: Number(e.target.value) })}
                  >
                    {groupsList.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <select
                    className="gf-select"
                    aria-label="User role"
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                  >
                    <option value="EMP">EMP (Employee)</option>
                    <option value="DRV">DRV (Driver Account)</option>
                    <option value="FM">FM (Fleet Operation PIC)</option>
                    <option value="HWS">HWS (Head Of WS Part)</option>
                    <option value="ADM">ADM (Admin)</option>
                  </select>
                  <button type="submit" className="gf-btn gf-btn-primary">
                    <Plus size={16} /> Create User
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
                      {usersList
                        .filter((u) => {
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
                        })
                        .map((u) => {
                          const isSelf = u.id === user.id;
                          return (
                            <tr key={u.id} style={{ opacity: u.is_active === 0 ? 0.65 : 1 }}>
                              <td>
                                <div style={{ fontWeight: 700 }}>{u.nickname}</div>
                                <div className="mono type-caption">@{u.group_username}</div>
                              </td>
                              <td>
                                <select
                                  className="gf-select"
                                  style={{ minHeight: '36px', padding: '0 8px' }}
                                  aria-label={`Group for ${u.nickname}`}
                                  value={u.department_id}
                                  onChange={(e) => handleUpdateUserRoleOrGroup(u.id, { department_id: Number(e.target.value) })}
                                >
                                  {groupsList.map((g) => (
                                    <option key={g.id} value={g.id}>
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
                                      onClick={() => handleApproveUser(u.id, true, u.role)}
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
                                    <Power size={14} /> {u.is_active === 1 ? 'Deactivate' : 'Activate'}
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
              </section>
            </>
          )}

          {adminModule === 'FLEET_OPS' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(['VEHICLES', 'DRIVERS', 'GROUPS', 'FUEL_EV', 'MAINTENANCE', 'EXPENSES', 'DOCUMENTS'] as const).map((sub) => (
                    <Chip key={sub} active={opsSubTab === sub} onClick={() => setOpsSubTab(sub)}>
                      {sub.replace('_', ' & ')}
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
                      className="gf-select"
                      aria-label="Driver Group"
                      value={newDriverForm.department_id}
                      onChange={(e) => setNewDriverForm({ ...newDriverForm, department_id: Number(e.target.value) })}
                    >
                      {groupsList.map((g) => (
                        <option key={g.id} value={g.id}>
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
                                  className="gf-select"
                                  style={{ minHeight: '36px', padding: '0 8px' }}
                                  aria-label={`Driver group for ${d.full_name}`}
                                  value={d.department_id || groupsList[0]?.id || 1}
                                  onChange={async (e) => {
                                    await apiRequest(`/api/drivers/${d.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ department_id: Number(e.target.value) }),
                                    });
                                    setStatusBanner({ type: 'success', text: `Updated group for driver ${d.full_name}.` });
                                    await loadAllData(user);
                                  }}
                                >
                                  {groupsList.map((g) => (
                                    <option key={g.id} value={g.id}>
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
                                        department_id: d.department_id || groupsList[0]?.id || 1,
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
                        </tr>
                      </thead>
                      <tbody>
                        {groupsList.map((g) => (
                          <tr key={g.id}>
                            <td className="mono">#{g.id}</td>
                            <td style={{ fontWeight: 700 }}>{g.name}</td>
                            <td className="mono">{g.code || '—'}</td>
                            <td><StatusBadge label={g.is_active === 0 ? 'Inactive' : 'Active'} tone={g.is_active === 0 ? 'neutral' : 'green'} /></td>
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
                  <div className="type-title mono" style={{ fontSize: '18px', color: '#059669' }}>
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
                <div className="gf-card-flat" style={{ borderLeft: '4px solid #0072de' }}>
                  <div className="type-section" style={{ fontSize: '14.5px' }}>Gasoline Fleet Summary</div>
                  <div className="type-title mono" style={{ fontSize: '16.5px', marginTop: '4px' }}>
                    {usageAnalytics.expensesBreakdownIdr?.gas_litres || usageAnalytics.combinedOverall.gasolineSummary.totalLitres} Litres
                  </div>
                  <div className="type-caption" style={{ fontWeight: 700, color: '#005bb5' }}>
                    Cost: {formatIdr(usageAnalytics.expensesBreakdownIdr?.gas_idr || usageAnalytics.combinedOverall.gasolineSummary.totalFuelCost)}
                  </div>
                </div>

                <div className="gf-card-flat" style={{ borderLeft: '4px solid #059669' }}>
                  <div className="type-section" style={{ fontSize: '14.5px' }}>Electric (EV) Fleet Summary</div>
                  <div className="type-title mono" style={{ fontSize: '16.5px', marginTop: '4px' }}>
                    {usageAnalytics.expensesBreakdownIdr?.electric_kwh || usageAnalytics.combinedOverall.electricSummary.totalKwh} kWh
                  </div>
                  <div className="type-caption" style={{ fontWeight: 700, color: '#059669' }}>
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
                              <span className="gf-badge" style={{ background: '#ecfdf5', color: '#059669', fontWeight: 800 }}>
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

  // Sticky Footer per Booking Step
  let stickyFooter: React.ReactNode = null;
  if (navSection === 'HOME') {
    if (bookingStep === 'ROUTE') {
      if (routeTab === 'PIN') {
        stickyFooter = (
          <StickyActionBar>
            <button
              id="confirm-pin-btn"
              type="button"
              className="gf-btn gf-btn-primary gf-btn-full"
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
                Pick your ride
              </button>
            </div>
          </StickyActionBar>
        );
      }
    } else if (bookingStep === 'VEHICLE' && selectedVehicle) {
      const availSelected = selectedVehicle.isAvailable !== false && selectedVehicle.status === 'Available';
      stickyFooter = (
        <StickyActionBar>
          <div className="gf-sticky-row">
            <div style={{ minWidth: 0 }}>
              <div className="type-body" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedVehicle.make} {selectedVehicle.model}
              </div>
              <div className="type-caption">
                {scheduleMode === 'NOW' ? `Now • ETA ${currentMetrics.etaText}` : new Date(bookStart).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <button
              id="vehicle-continue-btn"
              type="button"
              className="gf-btn gf-btn-primary"
              disabled={!availSelected}
              onClick={() => {
                setBookingStep('SUMMARY');
                setSheetSnap('half');
              }}
            >
              Continue
            </button>
          </div>
        </StickyActionBar>
      );
    } else if (bookingStep === 'SUMMARY' && selectedVehicle) {
      stickyFooter = (
        <StickyActionBar>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="type-caption" style={{ textAlign: 'center' }}>
              {selectedVehicle.make} {selectedVehicle.model} • {selectedVehicle.registration_plate} • ETA {currentMetrics.etaText}
            </div>
            <button
              id="submit-booking-btn"
              type="button"
              className="gf-btn gf-btn-primary gf-btn-full"
              disabled={isOffline}
              onClick={handleCreateTripBooking}
            >
              Request GalaxyFleet
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
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          boxShadow: '0 4px 12px rgba(0, 114, 222, 0.25)',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={18} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '12.5px' }}>Enable Real-Time Alerts</div>
            <div style={{ fontSize: '11px', opacity: 0.9 }}>
              Get instant alerts for car approvals, dispatches, and trips.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            type="button"
            className="gf-btn"
            style={{ background: '#ffffff', color: '#0072de', fontWeight: 800, border: 'none', padding: '5px 10px', fontSize: '12px' }}
            onClick={() => handleEnablePushNotifications(false)}
          >
            Allow
          </button>
          <button
            type="button"
            className="gf-btn"
            style={{ background: 'transparent', color: '#ffffff', border: '1px solid rgba(255,255,255,0.4)', padding: '5px 8px', fontSize: '11px' }}
            onClick={() => setShowNotificationPromptBanner(false)}
          >
            Later
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feedbackBanner}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div>
              <h1 className="type-title">Driver Dispatch</h1>
              <p className="type-caption">
                {user.department_name || 'Company Driver'} • Driver duty console & car operational schedule
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <LanguageSwitcher compact />
              <StatusBadge label={driverCheckedInReady ? 'Online & Checked In' : 'Offline / Standby'} tone={driverCheckedInReady ? 'green' : 'amber'} />
              <button
                type="button"
                className="gf-btn gf-btn-outline-danger"
                style={{ minHeight: '38px', padding: '0 10px' }}
                onClick={handleLogout}
                aria-label="Sign Out"
                title="Sign Out"
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>

          {/* Driver Profile & Photo Card */}
          {(() => {
            const myDriver = drivers.find((d) => d.user_id === user.id || d.full_name.toLowerCase() === (user.nickname || '').toLowerCase());
            const photoSrc = myDriver?.photo_url || getDriverAvatarDataUri(user.nickname || 'Driver');
            return (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-card)',
                  background: 'var(--color-bg-surface)',
                  border: '1.5px solid var(--color-border)',
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
                    <img
                      src={photoSrc}
                      alt={user.nickname}
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2.5px solid var(--color-samsung-blue)',
                        background: '#f1f5f9',
                      }}
                    />
                    <label
                      title="Upload new driver photo"
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: '22px',
                        height: '22px',
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
                      <Camera size={12} />
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
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--color-fg-primary)' }}>
                      {user.nickname} <span className="mono" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>@{user.group_username}</span>
                    </div>
                    <div className="type-caption" style={{ fontSize: '12.5px', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                      <span>SIM: <strong>{myDriver?.licence_number || 'Registered'}</strong> (Class {myDriver?.licence_class || 'A'})</span>
                      {myDriver?.contact_number && <span>• Tel: <strong>{myDriver.contact_number}</strong></span>}
                      <span>• Group: <strong>{user.department_name || 'Fleet'}</strong></span>
                    </div>
                  </div>
                </div>

                <label
                  className="gf-btn gf-btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0, minHeight: '34px', fontSize: '12.5px' }}
                >
                  <Camera size={14} /> Update My Photo
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
            );
          })()}

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
              Duty & Trips ({dispatches.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={driverSectionTab === 'SCHEDULE'}
              className={`gf-underline-tab ${driverSectionTab === 'SCHEDULE' ? 'is-active' : ''}`}
              onClick={() => setDriverSectionTab('SCHEDULE')}
            >
              <Calendar size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Car Timetable & Schedule
            </button>
          </div>

          {/* Dedicated Car Card */}
          {dedicatedCar && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-card)',
                background: 'var(--color-bg-subtle)',
                border: '1.5px solid var(--color-green)',
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
                  <div className="type-body" style={{ fontWeight: 800, fontSize: '14px' }}>
                    {dedicatedCar.make} {dedicatedCar.model} • <span className="mono">{dedicatedCar.registration_plate}</span>
                  </div>
                  <div className="type-caption" style={{ fontSize: '12px' }}>
                    Assigned Dedicated Car • {dedicatedCar.energy_type} • Odo: {dedicatedCar.current_odometer} km
                  </div>
                </div>
              </div>
              <StatusBadge label={dedicatedCar.status} tone={dedicatedCar.status === 'Available' ? 'green' : 'amber'} />
            </div>
          )}

          {driverSectionTab === 'SCHEDULE' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="mono" style={{ fontWeight: 700, fontSize: '13px' }}>
                                {new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <StatusBadge label={t.status} tone={toneFromStatus(t.status)} />
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
                              {vehicleTripsToday.map((t) => (
                                <div key={t.id} className="type-caption">
                                  <span className="mono" style={{ fontWeight: 700 }}>
                                    {new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>: <span className="notranslate" translate="no">{t.department_name}</span> (Pax: {t.passenger_nickname || 'Team'})
                                </div>
                              ))}
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
              {/* Gojek-Style Driver Duty Confirmation & Location Check-In Card */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-card)',
                  background: driverCheckedInReady ? 'var(--color-green-tint)' : 'var(--color-bg-subtle)',
                  border: `1.5px solid ${driverCheckedInReady ? 'var(--color-green)' : 'var(--color-border)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div className="type-body" style={{ fontWeight: 700 }}>
                {driverCheckedInReady ? 'Ready to Drive — Duty Active' : 'Step 1: Confirm Ready to Drive & Work'}
              </div>
              <StatusBadge label={driverCheckedInReady ? 'Verified' : 'Required'} tone={driverCheckedInReady ? 'green' : 'amber'} />
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
                    setStatusBanner({ type: 'info', text: 'Switched to Standby / Off-Duty.' });
                  }}
                >
                  Go Offline
                </button>
              </div>
            )}
            {lastDriverGpsReport && (
              <div className="type-caption mono">
                Last check-in: {lastDriverGpsReport.permission_state} • {new Date(lastDriverGpsReport.capture_time).toLocaleTimeString()}
              </div>
            )}
          </div>

          <h2 className="type-section">Assigned Trips ({dispatches.length})</h2>
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
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-card)',
                      border: `1px solid ${isInProgress ? 'var(--color-green)' : 'var(--color-divider)'}`,
                      background: isInProgress ? 'var(--color-green-tint)' : 'var(--color-bg-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span className="mono type-body" style={{ fontWeight: 700 }}>{d.registration_plate} • {d.make} {d.model}</span>
                      <StatusBadge label={d.trip_status} tone={toneFromStatus(d.trip_status)} />
                    </div>
                    <div className="type-body" style={{ fontWeight: 700 }}>{d.purpose || 'Assigned Trip'}</div>
                    <div className="type-caption">{d.origin} → {d.destination}</div>
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
    // ACTIVITY TAB (Ongoing & History underline tabs, no tables)
    // -------------------------------------------------------------------------
    if (navSection === 'ACTIVITY') {
      const shownList = activityTab === 'ONGOING' ? ongoingTrips : historyTrips;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feedbackBanner}
          <h1 className="type-title">Activity</h1>

          <div className="gf-underline-tabs" role="tablist" aria-label="Trip history tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activityTab === 'ONGOING'}
              className={`gf-underline-tab ${activityTab === 'ONGOING' ? 'is-active' : ''}`}
              onClick={() => setActivityTab('ONGOING')}
            >
              Ongoing ({ongoingTrips.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activityTab === 'HISTORY'}
              className={`gf-underline-tab ${activityTab === 'HISTORY' ? 'is-active' : ''}`}
              onClick={() => setActivityTab('HISTORY')}
            >
              History ({historyTrips.length})
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
              message={activityTab === 'ONGOING' ? 'No ongoing rides right now.' : 'No completed trips yet.'}
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
                    <Navigation size={16} /> Open Driver Dispatch
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
                    Book a ride
                  </button>
                )
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {shownList.map((t) => (
                <div
                  key={t.id}
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
                    title={`${t.origin} → ${t.destination}`}
                    subtitle={`${formatPassengersDisplay(t.passengers_json, t.passenger_nickname) !== 'Team' ? `Pax: ${formatPassengersDisplay(t.passengers_json, t.passenger_nickname)} • ` : ''}${new Date(t.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • ${t.make} ${t.model} (${t.registration_plate})`}
                    trailing={<StatusBadge label={t.booking_status === 'CANCELLED' ? 'CANCELLED' : t.status} tone={toneFromStatus(t.booking_status === 'CANCELLED' ? 'CANCELLED' : t.status)} />}
                    showChevron={activityTab === 'ONGOING'}
                    onClick={
                      activityTab === 'ONGOING'
                        ? () => {
                            setFocusedTripId(t.id);
                            if (user.role === 'DRV') {
                              setNavSection('DRIVER');
                              setSheetSnap('full');
                            } else {
                              setNavSection('HOME');
                              setBookingStep(t.status === 'PENDING_APPROVAL' ? 'WAITING' : 'IN_TRIP');
                              setSheetSnap('half');
                            }
                          }
                        : undefined
                    }
                  />
                  {(t.status === 'APPROVED' || t.status === 'IN_PROGRESS') && t.booking_status !== 'CANCELLED' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px', borderTop: '1px solid var(--color-divider)', marginTop: '4px' }}>
                      <button
                        type="button"
                        className="gf-btn gf-btn-secondary"
                        style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px', gap: '5px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const paxFormatted = formatPassengersMultiLine(t.passengers_json, t.passenger_nickname);
                          const shareMsg = `*GalaxyFleet Booking Details*\n🚗 *Vehicle*: ${t.make} ${t.model} (${t.registration_plate || '—'})\n👥 *Passenger(s) [Nickname only]*:\n${paxFormatted}\n👤 *Driver*: ${t.assigned_driver_name || 'Assigned Driver'}${t.assigned_driver_phone ? ` (${t.assigned_driver_phone})` : ''}\n📍 *Pickup*: ${t.origin}\n🎯 *Destination*: ${t.destination}\n🕒 *Schedule*: ${new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n📌 *Status*: ${t.status}\n\n_Reminder: For privacy protection, only nicknames are used._`;
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(shareMsg).catch(() => {});
                          }
                          window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg)}`, '_blank');
                          setStatusBanner({ type: 'success', text: 'Booking details copied & opened WhatsApp to share with passenger!' });
                        }}
                      >
                        <Share2 size={13} /> Share to Passenger (WhatsApp)
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
            <h1 className="type-title">Inbox</h1>
            {unreadCount > 0 && (
              <button
                type="button"
                className="gf-btn gf-btn-ghost"
                onClick={async () => {
                  await apiRequest('/api/notifications/read-all', { method: 'POST' });
                  await loadAllData(user);
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <button type="button" className="gf-btn gf-btn-secondary gf-btn-full" onClick={handleEnablePushNotifications}>
            <Bell size={16} />
            {pushSubscribed ? 'Push notifications enabled (Send test)' : 'Enable Push Alerts'}
          </button>

          {notifications.length === 0 ? (
            <EmptyState message="You're all caught up! Alerts appear here." />
          ) : (
            <div>
              {notifications.map((n) => (
                <ListRow
                  key={n.id}
                  tall
                  icon={<Bell size={18} style={{ color: n.is_read ? 'var(--color-text-muted)' : 'var(--color-green)' }} />}
                  title={n.title}
                  subtitle={n.body}
                  trailing={!n.is_read ? <span className="gf-dot-green" aria-label="Unread" /> : undefined}
                />
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
      const initials = (user.nickname || 'U').slice(0, 2).toUpperCase();
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {feedbackBanner}
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
              }}
            >
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 className="type-title">{user.nickname}</h1>
              <div className="type-caption">@{user.group_username} • {user.department_name || `Group #${user.department_id}`}</div>
              <div style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
                <StatusBadge label={`Role: ${user.role}`} tone="green" />
                {user.is_department_admin === 1 && <StatusBadge label="Group Admin" tone="blue" />}
              </div>
            </div>
          </div>

          <div style={{ padding: '12px', borderRadius: 'var(--radius-card)', background: 'var(--color-bg-subtle)' }}>
            <div className="type-caption" style={{ fontWeight: 700, marginBottom: '8px' }}>Language (Google Translate)</div>
            <LanguageSwitcher />
          </div>

          <div style={{ padding: '12px', borderRadius: 'var(--radius-card)', background: 'var(--color-bg-subtle)' }}>
            <div className="type-caption" style={{ fontWeight: 700, marginBottom: '8px' }}>Appearance</div>
            <Segmented
              ariaLabel="Theme preference"
              value={themePref}
              onChange={setThemePref}
              options={[
                { value: 'system', label: 'Auto' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>

          <div>
            <ListRow
              icon={<Bell size={18} />}
              title="Push Notifications"
              subtitle={pushSubscribed ? 'Active on this device' : 'Receive booking & dispatch updates'}
              showChevron
              onClick={handleEnablePushNotifications}
            />
            <ListRow
              icon={<Smartphone size={18} />}
              title="Install GalaxyFleet App"
              subtitle="Add shortcut to your home screen"
              showChevron
              onClick={handleInstallPwa}
            />
            {(user.role === 'DRV' || isPrivileged) && (
              <ListRow
                icon={<Navigation size={18} />}
                title="Driver Dispatch Console"
                subtitle="View assigned orders & periodic GPS check-ins"
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
                title="Admin Command Console"
                subtitle="Approvals, vehicles, analytics & audit log"
                showChevron
                onClick={() => setNavSection('ADMIN')}
              />
            )}
            <ListRow
              icon={<LogOut size={18} />}
              title="Sign Out"
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="mono" style={{ fontWeight: 700, fontSize: '13px' }}>
                          {new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <StatusBadge label={t.status} tone={toneFromStatus(t.status)} />
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
                        {vehicleTripsToday.map((t) => (
                          <div key={t.id} className="type-caption" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="mono" style={{ fontWeight: 700 }}>
                              🕒 {new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}:
                            </span>
                            <span>
                              <span className="notranslate" translate="no"><strong>{t.department_name}</strong></span> (Passenger: {t.passenger_nickname || 'Team'})
                            </span>
                          </div>
                        ))}
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
      const shortcuts = [
        {
          id: 'sc-ride',
          label: 'Book Ride',
          green: true,
          icon: <Car size={24} />,
          action: () =>
            requireLocationBeforeCarUse(() => {
              setVehicleFilter('ALL');
              setScheduleMode('NOW');
              setBookingStep('ROUTE');
              setSheetSnap('full');
            }),
        },
        {
          id: 'sc-schedule',
          label: 'Schedule',
          green: false,
          icon: <Calendar size={22} />,
          action: () => {
            setBookingStep('SCHEDULE_VIEW');
            setSheetSnap('full');
          },
        },
        {
          id: 'sc-saved',
          label: 'Saved Places',
          green: false,
          icon: <Bookmark size={22} />,
          action: () =>
            requireLocationBeforeCarUse(() => {
              setRouteTab('SAVED');
              setBookingStep('ROUTE');
              setSheetSnap('full');
            }),
        },
        {
          id: 'sc-trips',
          label: 'My Trips',
          green: false,
          icon: <Clock size={22} />,
          action: () => setNavSection('ACTIVITY'),
        },
        {
          id: 'sc-push',
          label: 'Alerts',
          green: false,
          icon: <Bell size={22} />,
          action: handleEnablePushNotifications,
        },
        {
          id: 'sc-install',
          label: 'Install App',
          green: false,
          icon: <Download size={22} />,
          action: handleInstallPwa,
        },
        ...(isPrivileged || user.role === 'DRV'
          ? [
              {
                id: 'sc-ops',
                label: isPrivileged ? 'Admin' : 'Dispatch',
                green: true,
                icon: isPrivileged ? <ShieldCheck size={22} /> : <Navigation size={22} />,
                action: () => setNavSection(isPrivileged ? 'ADMIN' : 'DRIVER'),
              },
            ]
          : []),
      ];

      const activeOverview = liveOverviewCards[carouselIdx % liveOverviewCards.length];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {feedbackBanner}

          {/* Greeting + Group Chip + Language Switcher + Notification Bell + Sign Out Button */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ minWidth: 0 }}>
              <h1 className="type-title">
                {getTimeGreeting()}, {user.nickname}
              </h1>
              <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <Chip subtle><span className="notranslate" translate="no">{user.department_name || 'Company Group'}</span></Chip>
                <LanguageSwitcher compact />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                className="gf-icon-btn-48 pressable"
                onClick={() => setNavSection('INBOX')}
                aria-label={`Notifications (${unreadCount} unread)`}
                title="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="gf-nav-badge" style={{ top: '6px', right: '6px' }}>
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                id="home-signout-btn"
                type="button"
                className="gf-icon-btn-48 pressable"
                onClick={handleLogout}
                aria-label="Sign Out"
                title="Sign Out"
                style={{ color: 'var(--color-status-red-fg)' }}
              >
                <LogOut size={19} />
              </button>
            </div>
          </div>

          {/* Hero Action Cards for Primary Workflows (Revision #7) */}
          <div className="gf-hero-action-grid">
            <button
              id="hero-book-ride-card"
              type="button"
              className="gf-hero-action-card pressable"
              onClick={() =>
                requireLocationBeforeCarUse(() => {
                  setVehicleFilter('ALL');
                  setScheduleMode('NOW');
                  setBookingStep('ROUTE');
                  setSheetSnap('full');
                })
              }
              style={{ borderLeft: '4px solid var(--color-green)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="gf-circle-icon is-green" style={{ width: '40px', height: '40px' }}>
                  <Car size={22} />
                </div>
                <ChevronRight size={18} style={{ color: 'var(--color-green)' }} />
              </div>
              <div>
                <div className="type-title" style={{ fontSize: '16px', fontWeight: 800 }}>Book a Ride</div>
                <div className="type-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Request operational car
                </div>
              </div>
            </button>

            <button
              id="hero-fleet-schedule-card"
              type="button"
              className="gf-hero-action-card pressable"
              onClick={() => {
                setBookingStep('SCHEDULE_VIEW');
                setSheetSnap('full');
              }}
              style={{ borderLeft: '4px solid var(--color-text-primary)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="gf-circle-icon" style={{ width: '40px', height: '40px', background: 'var(--color-bg-subtle)' }}>
                  <Calendar size={22} />
                </div>
                <ChevronRight size={18} style={{ color: 'var(--color-text-secondary)' }} />
              </div>
              <div>
                <div className="type-title" style={{ fontSize: '16px', fontWeight: 800 }}>Fleet Schedule</div>
                <div className="type-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Live slots & cars
                </div>
              </div>
            </button>
          </div>

          {/* Quick Collapse to Map Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '-8px 0 -4px 0' }}>
            <span className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
              Operational Quick Access
            </span>
            <button
              type="button"
              className="gf-btn gf-btn-ghost"
              style={{ minHeight: '30px', padding: '0 8px', fontSize: '12px' }}
              onClick={() => setSheetSnap(sheetSnap === 'peek' ? 'half' : 'peek')}
            >
              <Navigation size={13} /> {sheetSnap === 'peek' ? 'Expand Menu' : 'View Full Map'}
            </button>
          </div>

          {/* Active ongoing trip card if any */}
          {ongoingTrips.length > 0 && (
            <button
              type="button"
              className="gf-option-row is-selected pressable"
              style={{ minHeight: '64px' }}
              onClick={() => {
                setFocusedTripId(ongoingTrips[0].id);
                setBookingStep(ongoingTrips[0].status === 'PENDING_APPROVAL' ? 'WAITING' : 'IN_TRIP');
                setSheetSnap('half');
              }}
            >
              <div className="gf-circle-icon" style={{ background: 'var(--color-green)', color: '#ffffff' }}>
                <Car size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="type-body" style={{ fontWeight: 700 }}>
                  {ongoingTrips[0].status === 'PENDING_APPROVAL' ? 'Waiting for approval' : 'Ride assigned'}
                </div>
                <div className="type-caption" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ongoingTrips[0].origin} → {ongoingTrips[0].destination}
                </div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--color-green-text)' }} />
            </button>
          )}

          {/* Large Rounded "Where to?" Search Pill (height 56px, grey fill, magnifier, green dot) */}
          <button
            id="home-where-to-btn"
            type="button"
            className="gf-search-pill pressable"
            onClick={() =>
              requireLocationBeforeCarUse(() => {
                setBookingStep('ROUTE');
                setSheetSnap('full');
              })
            }
          >
            <Search size={20} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
            <span className="type-section" style={{ flex: 1, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Where to?
            </span>
            <span className="gf-dot-green" aria-hidden="true" />
          </button>

          {/* Service Shortcuts (4 columns, 56px tiles, 12px labels, max 8 items, zero borders) */}
          <div className="gf-shortcut-grid">
            {shortcuts.map((sc) => (
              <button key={sc.id} id={sc.id} type="button" className="gf-shortcut-btn pressable" onClick={sc.action}>
                <div className={`gf-shortcut-tile ${sc.green ? 'is-green' : ''}`}>{sc.icon}</div>
                <span className="gf-shortcut-label">{sc.label}</span>
              </button>
            ))}
          </div>

          {/* Horizontal Scroll Chips for User's Real Recent Destinations */}
          {recentDestinationChips.length > 0 && (
            <div>
              <div className="type-caption" style={{ fontWeight: 700, marginBottom: '8px' }}>
                Recent destinations
              </div>
              <div className="gf-hscroll">
                {recentDestinationChips.map((dest) => (
                  <Chip
                    key={dest}
                    icon={<MapPin size={14} style={{ color: 'var(--color-green)' }} />}
                    onClick={() =>
                      requireLocationBeforeCarUse(() => {
                        setBookDest(dest);
                        setBookingStep('ROUTE');
                        setSheetSnap('full');
                      })
                    }
                  >
                    {dest}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Live System Overview Carousel (16:9 cards + dot pagination) */}
          <div>
            <div className="gf-promo-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusBadge label={activeOverview.tag} tone="green" />
                <Car size={28} style={{ color: 'var(--color-green)', opacity: 0.7 }} />
              </div>
              <div>
                <div className="type-section">{activeOverview.title}</div>
                <p className="type-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  {activeOverview.body}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
              {liveOverviewCards.map((item, idx) => (
                <button
                  key={item.title}
                  type="button"
                  aria-label={`Slide ${idx + 1}: ${item.title}`}
                  onClick={() => setCarouselIdx(idx)}
                  style={{
                    width: carouselIdx === idx ? '20px' : '8px',
                    height: '8px',
                    padding: 0,
                    border: 'none',
                    borderRadius: '9999px',
                    background: carouselIdx === idx ? 'var(--color-green)' : 'var(--color-border)',
                    cursor: 'pointer',
                    transition: 'width 200ms ease',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // BOOKING FLOW STEP 1: WHERE TO? (ROUTE — Real OpenStreetMap Search & Pin)
    // -------------------------------------------------------------------------
    if (bookingStep === 'ROUTE') {
      const activeText = (activeRouteField === 'pickup' ? bookOrigin : bookDest).trim();
      const showingLiveSearch = activeText.length >= 2 && geoResults.length > 0;
      const listToDisplay: GeoPlace[] = showingLiveSearch
        ? geoResults
        : routeTab === 'SAVED'
        ? savedPlaces
        : recentPlacesList;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <h1 className="type-title">Where to?</h1>
            <button
              type="button"
              className="gf-btn gf-btn-ghost"
              style={{ minHeight: '36px', padding: '0 10px' }}
              onClick={handleUseCurrentGpsForField}
            >
              <Navigation size={14} /> Use GPS
            </button>
          </div>

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
            onFocusField={setActiveRouteField}
            pickupPlaceholder="Search pickup address or pin on map"
            destinationPlaceholder="Where to? Search any address"
          />

          {/* Live Calculated Route ETA, Ride Time & Distance Banner */}
          {bookOrigin.trim() && bookDest.trim() && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-control)',
                background: 'var(--color-green-tint)',
                border: '1px solid var(--color-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Navigation size={16} style={{ color: 'var(--color-green-text)' }} />
                <span className="type-body" style={{ fontWeight: 700, color: 'var(--color-green-text)' }}>
                  {calculatingRoute
                    ? 'Calculating route path & ETA...'
                    : `${currentMetrics.distanceKm} km • ~${currentMetrics.durationMin} min ride`}
                </span>
              </div>
              <StatusBadge label={`ETA ${currentMetrics.etaText}`} tone="green" />
            </div>
          )}

          {/* Instant Quick-Pick Corporate Destinations */}
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
              Quick Destinations
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

          <Segmented
            ariaLabel="Destination source"
            value={routeTab}
            onChange={(val) => {
              setRouteTab(val);
              if (val === 'PIN') {
                setSheetSnap('peek');
              } else {
                setSheetSnap('full');
              }
            }}
            options={[
              { value: 'RECENT', label: 'Recent' },
              { value: 'SAVED', label: 'Saved' },
              { value: 'PIN', label: 'Pin on map' },
            ]}
          />

          {routeTab === 'PIN' ? (
            <div style={{ padding: '12px 0' }}>
              <div className="type-body" style={{ fontWeight: 700 }}>Drag OpenStreetMap to set location</div>
              <p className="type-caption" style={{ marginTop: '4px' }}>
                Pan the map or use arrow keys to place the center pin for your {activeRouteField === 'pickup' ? 'pickup point' : 'destination'}.
              </p>
              <div className="type-body" style={{ marginTop: '10px', fontWeight: 600, color: 'var(--color-green-text)' }}>
                {(activeRouteField === 'pickup' ? bookOrigin : bookDest) || 'Pan map to resolve street address...'}
              </div>
            </div>
          ) : geoLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </div>
          ) : listToDisplay.length === 0 ? (
            <EmptyState
              message={
                activeText.length >= 2
                  ? 'No matching OpenStreetMap addresses found. You can still continue with your typed address or switch to Pin on map.'
                  : routeTab === 'SAVED'
                  ? 'No saved places yet. Search any address above and tap the bookmark icon to save it.'
                  : 'Type at least 2 characters above to search live OpenStreetMap addresses, or tap Pin on map.'
              }
            />
          ) : (
            <div>
              {listToDisplay.map((p, idx) => {
                const isSaved = savedPlaces.some((sp) => sp.name === p.name && sp.address === p.address);
                return (
                  <ListRow
                    key={`${p.name}-${idx}`}
                    tall
                    icon={routeTab === 'SAVED' ? <Bookmark size={18} /> : <MapPin size={18} />}
                    title={p.name}
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
                          color: isSaved ? 'var(--color-green)' : 'var(--color-text-muted)',
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
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // BOOKING FLOW STEP 2: PICK YOUR RIDE (VEHICLE)
    // -------------------------------------------------------------------------
    if (bookingStep === 'VEHICLE') {
      const activeDrivers = (liveAvailability?.drivers?.length ? liveAvailability.drivers : drivers).filter(
        (d) => d.isAvailable !== false && d.availability_status === 'Active'
      );

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feedbackBanner}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <h1 className="type-title">Pick your ride</h1>
            {vehicleFilter !== 'ALL' && (
              <Chip active onClick={() => setVehicleFilter('ALL')}>
                {vehicleFilter} ✕
              </Chip>
            )}
          </div>

          <Segmented
            ariaLabel="Pickup time mode"
            value={scheduleMode}
            onChange={(val) => setScheduleMode(val)}
            options={[
              { value: 'NOW', label: 'Now' },
              { value: 'SCHEDULE', label: 'Schedule' },
            ]}
          />

          {scheduleMode === 'SCHEDULE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', borderRadius: 'var(--radius-control)', background: 'var(--color-bg-subtle)' }}>
              <div>
                <label className="type-caption" htmlFor="schedule-start" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Departure
                </label>
                <input
                  id="schedule-start"
                  type="datetime-local"
                  className="gf-input"
                  value={bookStart}
                  onChange={(e) => setBookStart(e.target.value)}
                />
              </div>
              <div>
                <label className="type-caption" htmlFor="schedule-end" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Return
                </label>
                <input
                  id="schedule-end"
                  type="datetime-local"
                  className="gf-input"
                  value={bookEnd}
                  onChange={(e) => setBookEnd(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Horizontal Option Rows (80-88px) — Never a grid or table */}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredVehicles.map((v) => {
                const isAvail = v.isAvailable !== false && v.status === 'Available';
                const isSelected = Number(selectedVehicle?.id) === v.id;
                const isEv = v.energy_type === 'Electric';
                const pct = isEv ? Number(v.battery_percent ?? 100) : 85;
                const availText = isAvail
                  ? scheduleMode === 'NOW'
                    ? 'Available now'
                    : `Available at ${new Date(bookStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
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
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span className="type-caption">• {v.seats} seats</span>
                        <StatusBadge label={isEv ? 'EV' : 'Gasoline'} tone={isEv ? 'blue' : 'neutral'} />
                      </span>
                    }
                    subtitle={availText}
                    rightMetric={
                      <div style={{ width: '52px' }}>
                        <div className="type-caption" style={{ fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                          {isEv ? <BatteryCharging size={12} /> : <Fuel size={12} />}
                          {isEv ? `${pct}%` : 'Full'}
                        </div>
                        <div style={{ height: '4px', width: '100%', background: 'var(--color-bg-subtle)', borderRadius: '9999px', marginTop: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: isAvail ? 'var(--color-green)' : 'var(--color-border)' }} />
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
              <StatusBadge label="Included" tone="green" />
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
                        {d.full_name} ({selectedVehicle.energy_type} Driver{assignedCar ? ` • ${assignedCar.registration_plate}` : ''})
                      </option>
                    );
                  })}
              </select>
              <div className="type-caption" style={{ marginTop: '4px', color: '#64748b' }}>
                Drivers are filtered by the {selectedVehicle.energy_type} vehicle category. Final assignment is confirmed upon Admin/Fleet Manager approval.
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
          <h1 className="type-title">Almost there</h1>

          {/* Compact route card with Edit link */}
          <div style={{ padding: '14px', borderRadius: 'var(--radius-card)', background: 'var(--color-bg-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 0', gap: '4px' }}>
                <span className="gf-dot-green" />
                <span style={{ width: 0, height: '14px', borderLeft: '2px dotted var(--color-border)' }} />
                <span className="gf-square-red" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="type-body" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookOrigin}</div>
                <div className="type-body" style={{ fontWeight: 700, marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookDest}</div>
                <div className="type-caption" style={{ marginTop: '4px' }}>
                  {currentMetrics.distanceKm} km • ~{currentMetrics.durationMin} min ride • ETA {currentMetrics.etaText}
                </div>
              </div>
            </div>
            <button type="button" className="gf-btn gf-btn-ghost" onClick={() => setBookingStep('ROUTE')}>
              Edit
            </button>
          </div>

          {/* Plain ListRow Pickers */}
          <div>
            <ListRow
              id="summary-purpose-row"
              icon={<Briefcase size={18} />}
              title="Purpose"
              subtitle={bookPurpose || 'Tap to select trip purpose'}
              showChevron
              onClick={() => setSummaryPicker('PURPOSE')}
            />
            <ListRow
              id="summary-pax-row"
              icon={<Users size={18} />}
              title="Passengers"
              subtitle={
                bookPassengers.some((p) => p.nickname.trim())
                  ? bookPassengers
                      .filter((p) => p.nickname.trim())
                      .map((p) => `${p.id}. ${p.nickname.trim()}`)
                      .join(', ')
                  : `${bookPax} passenger${bookPax > 1 ? 's' : ''}`
              }
              showChevron
              onClick={() => setSummaryPicker('PAX')}
            />
            <ListRow
              id="summary-notes-row"
              icon={<StickyNote size={18} />}
              title="Notes"
              subtitle={bookNotes || 'Add pickup instructions for driver'}
              showChevron
              onClick={() => setSummaryPicker('NOTES')}
            />
            <ListRow
              id="summary-charge-row"
              icon={<CreditCard size={18} />}
              title="Charge to"
              subtitle={`${user.department_name || 'Group'} • Driver: ${chosenDriverObj ? chosenDriverObj.full_name : 'Auto-assign'}`}
              showChevron
              onClick={() => setSummaryPicker('CHARGE')}
            />
          </div>

          {/* Small Picker Sub-Modal */}
          {summaryPicker && (
            <div className="gf-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Edit ${summaryPicker.toLowerCase()}`}>
              <div className="gf-modal-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 className="type-section">
                    {summaryPicker === 'PURPOSE' && 'Trip purpose'}
                    {summaryPicker === 'PAX' && 'Passenger details'}
                    {summaryPicker === 'NOTES' && 'Dispatch notes'}
                    {summaryPicker === 'CHARGE' && 'Group & driver'}
                  </h3>
                  <button type="button" className="gf-btn gf-btn-primary" style={{ minHeight: '40px' }} onClick={() => setSummaryPicker(null)}>
                    Done
                  </button>
                </div>

                {summaryPicker === 'PURPOSE' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {['Client visit', 'Site audit', 'Airport transfer', 'Executive briefing'].map((preset) => (
                        <Chip key={preset} active={bookPurpose === preset} onClick={() => setBookPurpose(preset)}>
                          {preset}
                        </Chip>
                      ))}
                    </div>
                    <input
                      type="text"
                      className="gf-input"
                      placeholder="Or enter custom purpose"
                      value={bookPurpose}
                      onChange={(e) => setBookPurpose(e.target.value)}
                      autoFocus
                    />
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
                      ⚠️ <strong>Privacy Notice:</strong> Group Admin must fill passenger names who will ride the operational car. Enter <strong>nickname only</strong> (e.g. Budi, Sarah). Do NOT enter full names.
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {bookPassengers.map((passenger, index) => (
                        <div
                          key={passenger.id}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-control)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label className="type-caption" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                              {index === 0 ? '1. Passenger 1 (Lead Passenger)' : `${index + 1}. Passenger ${index + 1}`}
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
                                ✕ Remove
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            className="gf-input"
                            placeholder={index === 0 ? 'e.g. Budi (Nickname)' : `e.g. Sarah (Nickname)`}
                            value={passenger.nickname}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBookPassengers((prev) =>
                                prev.map((p) => (p.id === passenger.id ? { ...p, nickname: val } : p))
                              );
                              if (index === 0) setBookPassengerNickname(val);
                            }}
                          />
                        </div>
                      ))}
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
                          <Plus size={15} /> Add Passenger {bookPassengers.length + 1}
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
      const timelineSteps = [
        { label: 'Request sent & schedule locked', sub: 'Car and driver slot reserved immediately', done: true },
        { label: 'Admin review in progress', sub: 'Fleet Admin verifies & dispatches your driver', active: true },
        { label: 'Driver dispatched', sub: 'You will get a push notification once assigned', done: false },
      ];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feedbackBanner}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <h1 className="type-title">Waiting for approval</h1>
            <StatusBadge label="Request sent" tone="green" />
          </div>

          {focusedTrip && (
            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-card)', background: 'var(--color-bg-subtle)' }}>
              <div className="type-body" style={{ fontWeight: 700 }}>{focusedTrip.origin} → {focusedTrip.destination}</div>
              <div className="type-caption">{focusedTrip.make} {focusedTrip.model} • {focusedTrip.registration_plate}</div>
            </div>
          )}

          {/* 3-step timeline */}
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

          <button
            type="button"
            className="gf-btn gf-btn-outline-danger gf-btn-full"
            onClick={() => handleCancelBookingRequest(focusedTrip)}
          >
            Cancel request
          </button>
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // BOOKING FLOW STEP 5: ASSIGNED AND IN TRIP
    // -------------------------------------------------------------------------
    const tripToShow = focusedTrip;
    const isStarted = tripToShow?.status === 'IN_PROGRESS';
    const driverInitials = (tripToShow?.assigned_driver_name || 'DR').slice(0, 2).toUpperCase();

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {feedbackBanner}
        <div>
          <StatusBadge label={isStarted ? 'In Trip' : 'Driver Assigned'} tone={isStarted ? 'blue' : 'green'} />
          <h1 className="type-title" style={{ marginTop: '6px' }}>
            {isStarted ? `Arriving in ~${Math.max(8, currentMetrics.durationMin || 18)} min (ETA ${currentMetrics.etaText})` : 'Driver arriving in ~10 min'}
          </h1>
          {tripToShow && (
            <div className="type-caption">{tripToShow.origin} → {tripToShow.destination}</div>
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
              const shareMsg = `*GalaxyFleet Booking Details*\n🚗 *Vehicle*: ${tripToShow?.make} ${tripToShow?.model} (${tripToShow?.registration_plate || '—'})\n👥 *Passenger(s) [Nickname only]*:\n${paxFormatted}\n👤 *Driver*: ${tripToShow?.assigned_driver_name || 'Assigned Driver'}${driverPhone ? ` (${driverPhone})` : ''}\n📍 *Pickup*: ${tripToShow?.origin}\n🎯 *Destination*: ${tripToShow?.destination}\n🕒 *Schedule*: ${new Date(tripToShow?.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(tripToShow?.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n📌 *Status*: ${tripToShow?.status || 'APPROVED'}\n\n_Reminder: For privacy protection, only nicknames are used._`;
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
          if (target === 'HOME') {
            setBookingStep('HOME');
            setSheetSnap('half');
          } else {
            setSheetSnap('full');
          }
        }}
        onSignOut={handleLogout}
        hideChromeDuringBooking={inActiveBookingFlow && !isDriverOnly}
        isDriverOrPrivileged={user.role === 'DRV' || Boolean(isPrivileged)}
        isPrivileged={Boolean(isPrivileged)}
        isDriverOnly={isDriverOnly}
        unreadInboxCount={unreadCount}
        pendingDispatchCount={dispatches.filter((d) => d.trip_status !== 'COMPLETED' && d.trip_status !== 'REJECTED').length}
        pendingAdminCount={pendingTrips.length + pendingUsers.length}
        userNickname={user?.nickname}
        departmentName={user?.department_name}
        onSwitchToDriverDispatch={() => setNavSection('DRIVER')}
        onSwitchToAdmin={() => setNavSection('ADMIN')}
        mapStage={
          <MapView
            origin={mapOrigin}
            destination={mapDest}
            originCoords={originCoords}
            destCoords={destCoords}
            myCoords={myCoords}
            userPins={userPins}
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
            showBackButton={inActiveBookingFlow && !isDriverOnly}
            onBack={handleMapBack}
            isOffline={isOffline}
          />
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
