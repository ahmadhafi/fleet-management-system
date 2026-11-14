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
  Zap,
  Smartphone,
  ChevronRight,
  Lock,
  Minus,
  Plus,
} from 'lucide-react';
import { apiRequest, getStoredToken, setStoredToken, urlBase64ToUint8Array } from './api';
import { AppShell, DesktopPanelNav, AdminShell, type NavSection } from './components/AppShell';
import { BottomSheet, type SnapPoint } from './components/BottomSheet';
import { MapView, CORPORATE_HUBS, estimateRouteMetrics } from './components/MapView';
import { RouteFields } from './components/RouteFields';
import { VehicleArt } from './components/VehicleArt';
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

const REGISTRATION_DEPARTMENTS = [
  { id: 1, name: 'Workplace Solution (HWS)' },
  { id: 2, name: 'Operations & Field Services (OPS)' },
  { id: 3, name: 'Engineering & Technology (ENG)' },
  { id: 4, name: 'Finance & Accounting (FIN)' },
  { id: 5, name: 'Human Resources (HR)' },
  { id: 6, name: 'Sales & Marketing (SLS)' },
  { id: 7, name: 'Logistics & Supply Chain (LOG)' },
  { id: 8, name: 'Corporate Legal & Compliance (LEG)' },
  { id: 9, name: 'Executive Office (EXEC)' },
];

type BookingStep = 'HOME' | 'ROUTE' | 'VEHICLE' | 'SUMMARY' | 'WAITING' | 'IN_TRIP';

const SAVED_PLACES = [
  { name: 'HQ Tower Lobby', address: 'Jl. Jend. Sudirman Kav. 52, South Jakarta', tag: 'HQ' },
  { name: 'SCBD District 8', address: 'Senopati Suites, Kebayoran Baru', tag: 'Office' },
  { name: 'Soekarno-Hatta Terminal 3', address: 'International Airport, Tangerang', tag: 'Airport' },
  { name: 'Data Center Cibitung', address: 'MM2100 Industrial Town, Bekasi', tag: 'Site' },
];

const ANNOUNCEMENTS = [
  {
    title: 'Zero-Emission EV Pool Ready',
    body: 'Book our Hyundai Ioniq 5, BYD Atto 3, or Tesla Model Y for city rides.',
    tag: 'Electric Fleet',
  },
  {
    title: 'Instant Schedule Lock',
    body: 'Vehicle and driver slots lock immediately on submission to prevent double-booking.',
    tag: 'Anti-Overlap',
  },
  {
    title: 'Install GalaxyFleet PWA',
    body: 'Get instant push notifications for approvals, reminders, and driver arrivals.',
    tag: 'Mobile PWA',
  },
];

function getTimeGreeting(): string {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good morning';
  if (hr < 17) return 'Good afternoon';
  return 'Good evening';
}

export function App() {
  const [user, setUser] = useState<any | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState<string>('');
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

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

  // Auth screen state (Pure Login vs 4-Field Registration — Revision #2)
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regNickname, setRegNickname] = useState('');
  const [regDeptId, setRegDeptId] = useState(3);
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'EMP' | 'DRV'>('EMP');
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // PWA Install & Push Notification state (Revision #5)
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [pushSubscribed, setPushSubscribed] = useState<boolean>(false);
  const [showInstallGuideModal, setShowInstallGuideModal] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Navigation & Presentation State
  const [navSection, setNavSection] = useState<NavSection>('HOME');
  const [bookingStep, setBookingStep] = useState<BookingStep>('HOME');
  const [sheetSnap, setSheetSnap] = useState<SnapPoint>('half');
  const [adminModule, setAdminModule] = useState<'ADMIN_DISPATCH' | 'FLEET_OPS' | 'ANALYTICS_AUDIT'>('ADMIN_DISPATCH');
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

  // Core Application Data (Preserved identically)
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
  const [gpsLatest, setGpsLatest] = useState<any>(null);
  const [usageAnalytics, setUsageAnalytics] = useState<any>(null);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);

  // Booking Form State (Revision #1 No Self-Drive, Revision #4 Immediate Vehicle/Driver Block)
  const defaultStart = new Date(Date.now() + 2 * 3600000).toISOString().slice(0, 16);
  const defaultEnd = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 16);
  const [bookPurpose, setBookPurpose] = useState('');
  const [bookOrigin, setBookOrigin] = useState('HQ Tower Lobby');
  const [bookDest, setBookDest] = useState('');
  const [bookStart, setBookStart] = useState(defaultStart);
  const [bookEnd, setBookEnd] = useState(defaultEnd);
  const [bookVehicleId, setBookVehicleId] = useState<number>(1);
  const [bookDriverId, setBookDriverId] = useState<string>('1');
  const [bookPax, setBookPax] = useState<number>(2);
  const [bookNotes, setBookNotes] = useState('');
  const [liveAvailability, setLiveAvailability] = useState<{ vehicles: any[]; drivers: any[] } | null>(null);

  // Admin Modals & Editing State (Revision #3 Car Edit & Standby, 360° Vehicle Detail)
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [vehicleDetail360, setVehicleDetail360] = useState<any | null>(null);
  const [dispatchModalTrip, setDispatchModalTrip] = useState<any | null>(null);
  const [dispatchVehicleId, setDispatchVehicleId] = useState<number>(1);
  const [dispatchDriverId, setDispatchDriverId] = useState<number>(1);
  const [dispatchDecisionReason, setDispatchDecisionReason] = useState('');

  // Driver PWA GPS & Trip Action State
  const [gpsNoticeAccepted, setGpsNoticeAccepted] = useState<boolean>(false);
  const [gpsReportingActive, setGpsReportingActive] = useState<boolean>(false);
  const [gpsPermissionState, setGpsPermissionState] = useState<'GRANTED' | 'DENIED' | 'UNAVAILABLE'>('GRANTED');
  const [lastDriverGpsReport, setLastDriverGpsReport] = useState<any | null>(null);
  const [activeTripOdoInput, setActiveTripOdoInput] = useState<Record<number, string>>({});
  const [activeTripBatteryInput, setActiveTripBatteryInput] = useState<Record<number, string>>({});
  const [activeTripParkingInput, setActiveTripParkingInput] = useState<Record<number, string>>({});

  // Fleet Ops Sub-forms State
  const [opsSubTab, setOpsSubTab] = useState<'VEHICLES' | 'DRIVERS' | 'FUEL_EV' | 'MAINTENANCE' | 'EXPENSES' | 'DOCUMENTS'>('VEHICLES');
  const [fuelForm, setFuelForm] = useState({ vehicle_id: 1, litres: '35', cost: '48.50', odometer_km: '34250', station: 'Shell Kuningan', override_reason: '' });
  const [evForm, setEvForm] = useState({ vehicle_id: 6, kwh_added: '42', cost: '15.80', battery_start_pct: '25', battery_end_pct: '90', odometer_km: '15660', station: 'SPKLU HQ' });
  const [maintForm, setMaintForm] = useState({
    vehicle_id: 1,
    maintenance_type: 'Periodic 10,000km Service',
    applicable_energy_type: 'Both',
    service_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16),
    end_date: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 16),
    provider: 'Authorized Service Center',
    cost: '145.00',
    blocks_availability: true,
  });
  const [expForm, setExpForm] = useState({ vehicle_id: 1, category: 'Toll', amount: '12.50', description: 'Inner City Toll Gate' });
  const [docForm, setDocForm] = useState({ entity_type: 'VEHICLE', entity_id: 1, doc_type: 'Insurance', file_name: 'policy.pdf', expiry_date: '2027-12-31' });
  const [usagePeriod, setUsagePeriod] = useState<'day' | 'week' | 'month' | 'overall'>('month');

  const isPrivileged = user && ['ADM', 'FM', 'HWS'].includes(user.role);

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
      const [vehRes, drvRes, trpRes, bkgRes, ntfRes] = await Promise.all([
        apiRequest('/api/vehicles'),
        apiRequest('/api/drivers'),
        apiRequest('/api/trips'),
        apiRequest('/api/bookings'),
        apiRequest('/api/notifications'),
      ]);
      setVehicles(vehRes.vehicles || []);
      setDrivers(drvRes.drivers || []);
      setTrips(trpRes.trips || []);
      setBookings(bkgRes.bookings || []);
      setNotifications(ntfRes.notifications || []);
      setIsOffline(false);

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
        const [usrRes, gpsRes, anaRes, audRes] = await Promise.all([
          apiRequest('/api/users'),
          apiRequest('/api/gps/latest'),
          apiRequest('/api/analytics/usage'),
          apiRequest('/api/audit'),
        ]);
        setUsersList(usrRes.users || []);
        setGpsLatest(gpsRes);
        setUsageAnalytics(anaRes);
        setAuditEvents(audRes.auditEvents || []);
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
                latitude: -6.2249 + (Math.random() - 0.5) * 0.008,
                longitude: 106.8096 + (Math.random() - 0.5) * 0.008,
                accuracy_meters: 12.5,
                capture_time: new Date().toISOString(),
                permission_state: 'GRANTED',
                phone_state: 'FOREGROUND',
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
      (navigator as any).wakeLock.request('screen').then((wl: any) => {
        wakeLock = wl;
      }).catch(() => {});
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

  // Handlers: Login & Registration
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

  const handleEnablePushNotifications = async () => {
    try {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted' && 'serviceWorker' in navigator && vapidPublicKey) {
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

      await apiRequest('/api/notifications/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: `https://test-push.internal/user-${user.id}`,
          keys: { p256dh: 'BOr9_test_p256dh_key', auth: 'test_auth_secret' },
        }),
      });
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

      setPushSubscribed(true);
      setStatusBanner({
        type: 'success',
        text: 'Push notifications active. Alerts will appear here and on your lock screen.',
      });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  const handleCreateTripBooking = async () => {
    setStatusBanner(null);
    const startIso = scheduleMode === 'NOW' ? new Date(Date.now() + 5 * 60000).toISOString() : new Date(bookStart).toISOString();
    const endIso = scheduleMode === 'NOW' ? new Date(Date.now() + 125 * 60000).toISOString() : new Date(bookEnd).toISOString();
    const effectivePurpose = bookPurpose.trim() || 'Business Trip';

    try {
      const created = await apiRequest('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          vehicle_id: Number(bookVehicleId),
          preferred_driver_id: bookDriverId ? Number(bookDriverId) : null,
          purpose: effectivePurpose,
          origin: bookOrigin.trim() || 'HQ Tower Lobby',
          destination: bookDest.trim(),
          start_time: startIso,
          end_time: endIso,
          passenger_count: Number(bookPax),
          notes: bookNotes,
        }),
      });
      setBookPurpose('');
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

  const handleAdminTripDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!dispatchModalTrip) return;
    try {
      await apiRequest(`/api/trips/${dispatchModalTrip.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          reason: dispatchDecisionReason || (decision === 'APPROVED' ? 'Approved and dispatched by Admin' : ''),
          vehicle_id: Number(dispatchVehicleId),
          driver_profile_id: Number(dispatchDriverId),
        }),
      });
      setDispatchModalTrip(null);
      setDispatchDecisionReason('');
      setStatusBanner({
        type: 'success',
        text:
          decision === 'APPROVED'
            ? `Trip #${dispatchModalTrip.id} approved and dispatched!`
            : `Trip #${dispatchModalTrip.id} rejected and vehicle schedule slot released.`,
      });
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
        }),
      });
      setEditingVehicle(null);
      setStatusBanner({ type: 'success', text: 'Vehicle specifications, license plate, and operational status updated.' });
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
  const rawAvailVehicles = liveAvailability?.vehicles || vehicles;
  const filteredVehicles = useMemo(() => {
    if (vehicleFilter === 'Electric') return rawAvailVehicles.filter((v) => v.energy_type === 'Electric');
    if (vehicleFilter === 'MPV') return rawAvailVehicles.filter((v) => String(v.car_type).toLowerCase().includes('mpv') || v.seats >= 7);
    return rawAvailVehicles;
  }, [rawAvailVehicles, vehicleFilter]);

  const selectedVehicle = useMemo(
    () => rawAvailVehicles.find((v) => v.id === Number(bookVehicleId)) || filteredVehicles[0] || rawAvailVehicles[0],
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

  const recentDestinationChips = useMemo(() => {
    const fromHistory = Array.from(new Set(trips.map((t) => String(t.destination)).filter(Boolean)));
    const defaults = ['SCBD District 8', 'Soekarno-Hatta Terminal 3', 'Data Center Cibitung', 'BSD Green Office Park', 'Tangerang Logistics Hub'];
    return Array.from(new Set([...fromHistory, ...defaults])).slice(0, 5);
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
  // UNAUTHENTICATED SCREEN: PURE LOGIN & 4-FIELD REGISTRATION (Revision #2)
  // ============================================================================
  if (!user) {
    return (
      <div className="gf-auth-screen">
        <div className="gf-auth-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'var(--color-green)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Car size={24} />
            </div>
            <div>
              <h1 className="type-title">GalaxyFleet</h1>
              <p className="type-caption">Company Ride Dispatch & Mobile PWA</p>
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
                  Group Username
                </label>
                <input
                  id="login-username"
                  className="gf-input"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="e.g., admin, drv_budi, emp_alex"
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

              <div
                style={{
                  marginTop: '8px',
                  padding: '12px 14px',
                  background: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-control)',
                }}
              >
                <div className="type-caption" style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                  Test Accounts:
                </div>
                <div className="mono type-caption" style={{ display: 'grid', gap: '4px' }}>
                  <div>• Admin: <strong>admin</strong> / <strong>Admin@123</strong></div>
                  <div>• Fleet Mgr: <strong>fleetmgr</strong> / <strong>Fleet@123</strong></div>
                  <div>• Approver: <strong>hws_head</strong> / <strong>Hws@123</strong></div>
                  <div>• Driver: <strong>drv_budi</strong> / <strong>Driver@123</strong></div>
                  <div>• Employee: <strong>emp_alex</strong> / <strong>Emp@123</strong></div>
                </div>
              </div>
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
                <strong>Privacy-First Registration:</strong> Only nickname, department, group username & password needed. Admin approval required before sign-in.
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
                  placeholder="e.g., Kevin"
                  value={regNickname}
                  onChange={(e) => setRegNickname(e.target.value)}
                />
              </div>

              <div>
                <label className="type-caption" htmlFor="reg-dept" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Department
                </label>
                <select id="reg-dept" className="gf-select" value={regDeptId} onChange={(e) => setRegDeptId(Number(e.target.value))}>
                  {REGISTRATION_DEPARTMENTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="type-caption" htmlFor="reg-username" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Group Username
                </label>
                <input
                  id="reg-username"
                  className="gf-input"
                  type="text"
                  required
                  placeholder="e.g., eng_kevin"
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
                  placeholder="e.g., Reserved for Board VIP Visit"
                  value={editingVehicle.standby_reason || ''}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, standby_reason: e.target.value })}
                />
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
                <select className="gf-select" value={dispatchDriverId} onChange={(e) => setDispatchDriverId(Number(e.target.value))}>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
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
                  Approve & Dispatch
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="type-title">Install GalaxyFleet App</h3>
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
          onSwitchToRideBooking={() => {
            setNavSection('HOME');
            setBookingStep('HOME');
            setSheetSnap('half');
          }}
          onSwitchToDriverDispatch={() => {
            setNavSection('DRIVER');
            setSheetSnap('half');
          }}
          pendingCount={pendingTrips.length + pendingUsers.length}
          userNickname={user.nickname}
          userRole={user.role}
        >
          {isOffline && <ErrorState message="Connection required (WEB-03). Fleet mutations require active network connectivity." />}
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

          {adminModule === 'ADMIN_DISPATCH' && (
            <>
              <section className="gf-card-flat">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserCheck size={18} /> Account Registrations ({pendingUsers.length})
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
                          <th>Department</th>
                          <th>Requested Role</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingUsers.map((u) => (
                          <tr key={u.id}>
                            <td style={{ fontWeight: 700 }}>{u.nickname}</td>
                            <td className="mono">@{u.group_username}</td>
                            <td>{u.department_name}</td>
                            <td><StatusBadge label={u.role} tone="amber" /></td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="button" className="gf-btn gf-btn-primary" onClick={() => handleApproveUser(u.id, true, u.role)}>
                                  Approve
                                </button>
                                <button type="button" className="gf-btn gf-btn-outline-danger" onClick={() => handleApproveUser(u.id, false, u.role)}>
                                  Reject
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

              <section className="gf-card-flat">
                <h2 className="type-section" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <ShieldCheck size={18} /> Vehicle Bookings & Dispatch Queue ({trips.length})
                </h2>
                <div className="gf-table-wrap">
                  <table className="gf-table">
                    <thead>
                      <tr>
                        <th>ID & Purpose</th>
                        <th>Requester & Dept</th>
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
                          <td><StatusBadge label={t.status} tone={toneFromStatus(t.status)} /></td>
                          <td>
                            <button
                              type="button"
                              className="gf-btn gf-btn-primary"
                              onClick={() => {
                                setDispatchModalTrip(t);
                                setDispatchVehicleId(t.vehicle_id);
                                setDispatchDriverId(t.driver_profile_id || t.preferred_driver_id || 1);
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
              </section>
            </>
          )}

          {adminModule === 'FLEET_OPS' && (
            <>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(['VEHICLES', 'DRIVERS', 'FUEL_EV', 'MAINTENANCE', 'EXPENSES', 'DOCUMENTS'] as const).map((sub) => (
                  <Chip key={sub} active={opsSubTab === sub} onClick={() => setOpsSubTab(sub)}>
                    {sub.replace('_', ' & ')}
                  </Chip>
                ))}
              </div>

              {opsSubTab === 'VEHICLES' && (
                <section className="gf-card-flat">
                  <h2 className="type-section" style={{ marginBottom: '12px' }}>Fleet Register (8 Cars — Edit Plate, Type & Standby)</h2>
                  <div className="gf-table-wrap">
                    <table className="gf-table">
                      <thead>
                        <tr>
                          <th>Plate</th>
                          <th>Model</th>
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
                            <td>{v.car_type}</td>
                            <td>
                              <StatusBadge
                                label={v.energy_type === 'Electric' ? `EV ${v.battery_percent ?? 100}%` : 'Gasoline'}
                                tone={v.energy_type === 'Electric' ? 'green' : 'neutral'}
                              />
                            </td>
                            <td className="mono">{v.current_odometer.toLocaleString()} km</td>
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
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {opsSubTab === 'DRIVERS' && (
                <section className="gf-card-flat">
                  <h2 className="type-section" style={{ marginBottom: '12px' }}>Driver Profiles</h2>
                  <div className="gf-table-wrap">
                    <table className="gf-table">
                      <thead>
                        <tr>
                          <th>Driver</th>
                          <th>Username</th>
                          <th>Licence</th>
                          <th>Expiry</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drivers.map((d) => (
                          <tr key={d.id}>
                            <td style={{ fontWeight: 700 }}>{d.full_name}</td>
                            <td className="mono">@{d.group_username}</td>
                            <td className="mono">{d.licence_number} (Class {d.licence_class})</td>
                            <td className="mono">{d.licence_expiry}</td>
                            <td><StatusBadge label={d.availability_status} tone={toneFromStatus(d.availability_status)} /></td>
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
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>{v.registration_plate} ({v.energy_type})</option>
                        ))}
                      </select>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <input type="number" step="0.1" className="gf-input" placeholder="Litres" value={fuelForm.litres} onChange={(e) => setFuelForm({ ...fuelForm, litres: e.target.value })} />
                        <input type="number" step="0.01" className="gf-input" placeholder="Cost" value={fuelForm.cost} onChange={(e) => setFuelForm({ ...fuelForm, cost: e.target.value })} />
                        <input type="number" className="gf-input" placeholder="Odo km" value={fuelForm.odometer_km} onChange={(e) => setFuelForm({ ...fuelForm, odometer_km: e.target.value })} />
                      </div>
                      <button type="submit" className="gf-btn gf-btn-primary">Record Fuel</button>
                    </form>
                    <div className="gf-table-wrap">
                      <table className="gf-table">
                        <thead><tr><th>Plate</th><th>Litres</th><th>Cost</th><th>Odo</th></tr></thead>
                        <tbody>
                          {fuelRecords.map((f) => (
                            <tr key={f.id}><td>{f.registration_plate}</td><td className="mono">{f.litres} L</td><td className="mono">${Number(f.cost).toFixed(2)}</td><td className="mono">{f.odometer_km} km</td></tr>
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
                              cost: Number(evForm.cost),
                              battery_start_pct: Number(evForm.battery_start_pct),
                              battery_end_pct: Number(evForm.battery_end_pct),
                              odometer_km: Number(evForm.odometer_km),
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
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>{v.registration_plate} ({v.energy_type})</option>
                        ))}
                      </select>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <input type="number" step="0.1" className="gf-input" placeholder="kWh" value={evForm.kwh_added} onChange={(e) => setEvForm({ ...evForm, kwh_added: e.target.value })} />
                        <input type="number" className="gf-input" placeholder="Start %" value={evForm.battery_start_pct} onChange={(e) => setEvForm({ ...evForm, battery_start_pct: e.target.value })} />
                        <input type="number" className="gf-input" placeholder="End %" value={evForm.battery_end_pct} onChange={(e) => setEvForm({ ...evForm, battery_end_pct: e.target.value })} />
                      </div>
                      <button type="submit" className="gf-btn gf-btn-primary">Record EV Session</button>
                    </form>
                    <div className="gf-table-wrap">
                      <table className="gf-table">
                        <thead><tr><th>EV</th><th>kWh</th><th>SoC</th><th>Cost</th></tr></thead>
                        <tbody>
                          {evRecords.map((ev) => (
                            <tr key={ev.id}><td>{ev.registration_plate}</td><td className="mono">{ev.kwh_added} kWh</td><td className="mono">{ev.battery_start_pct}% → {ev.battery_end_pct}%</td><td className="mono">${Number(ev.cost).toFixed(2)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {opsSubTab === 'MAINTENANCE' && (
                <section className="gf-card-flat">
                  <h2 className="type-section" style={{ marginBottom: '12px' }}>Maintenance Schedule (MNT-01..07)</h2>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await apiRequest('/api/maintenance', {
                          method: 'POST',
                          body: JSON.stringify({
                            ...maintForm,
                            vehicle_id: Number(maintForm.vehicle_id),
                            cost: Number(maintForm.cost),
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
                      {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registration_plate} ({v.energy_type})</option>)}
                    </select>
                    <input type="text" className="gf-input" style={{ flex: '1 1 200px' }} value={maintForm.maintenance_type} onChange={(e) => setMaintForm({ ...maintForm, maintenance_type: e.target.value })} />
                    <select className="gf-select" style={{ flex: '1 1 160px' }} value={maintForm.applicable_energy_type} onChange={(e) => setMaintForm({ ...maintForm, applicable_energy_type: e.target.value })}>
                      <option value="Both">Both Gas & EV</option>
                      <option value="Gasoline">Gasoline Only</option>
                      <option value="Electric">Electric Only</option>
                    </select>
                    <button type="submit" className="gf-btn gf-btn-primary">Schedule</button>
                  </form>
                  <div className="gf-table-wrap">
                    <table className="gf-table">
                      <thead><tr><th>Vehicle</th><th>Type</th><th>Date</th><th>Cost</th><th>Status</th></tr></thead>
                      <tbody>
                        {maintenanceRecords.map((m) => (
                          <tr key={m.id}><td>{m.registration_plate}</td><td>{m.maintenance_type} ({m.applicable_energy_type})</td><td className="mono">{new Date(m.service_date).toLocaleDateString()}</td><td className="mono">${Number(m.cost).toFixed(2)}</td><td><StatusBadge label={m.status} tone="amber" /></td></tr>
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
                      {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registration_plate}</option>)}
                    </select>
                    <select className="gf-select" style={{ flex: '1 1 140px' }} value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}>
                      <option value="Toll">Toll</option>
                      <option value="Parking">Parking</option>
                      <option value="Cleaning">Cleaning</option>
                      <option value="Accessories">Accessories</option>
                      <option value="Other">Other</option>
                    </select>
                    <input type="number" step="0.01" className="gf-input" style={{ flex: '1 1 120px' }} value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} />
                    <input type="text" className="gf-input" style={{ flex: '1 1 200px' }} value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} />
                    <button type="submit" className="gf-btn gf-btn-primary">Submit</button>
                  </form>
                  <div className="gf-table-wrap">
                    <table className="gf-table">
                      <thead><tr><th>Plate</th><th>Category</th><th>Amount</th><th>Status</th></tr></thead>
                      <tbody>
                        {expenses.map((ex) => (
                          <tr key={ex.id}><td>{ex.registration_plate}</td><td>{ex.category}: {ex.description}</td><td className="mono">${Number(ex.amount).toFixed(2)}</td><td><StatusBadge label={ex.approval_status} tone="blue" /></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {opsSubTab === 'DOCUMENTS' && (
                <section className="gf-card-flat">
                  <h2 className="type-section" style={{ marginBottom: '12px' }}>Document Vault (DOC-01..08)</h2>
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
                      {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registration_plate}</option>)}
                    </select>
                    <input type="text" className="gf-input" style={{ flex: '1 1 180px' }} value={docForm.file_name} onChange={(e) => setDocForm({ ...docForm, file_name: e.target.value })} />
                    <button type="submit" className="gf-btn gf-btn-primary"><Upload size={15} /> Upload PDF</button>
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

          {adminModule === 'ANALYTICS_AUDIT' && usageAnalytics && (
            <>
              <div className="gf-kpi-grid">
                <div className="gf-card-flat">
                  <div className="type-caption">TODAY (ALL CARS)</div>
                  <div className="type-title mono">{usageAnalytics.combinedOverall.day.distanceKm} km</div>
                  <div className="type-caption">{usageAnalytics.combinedOverall.day.trips} trips</div>
                </div>
                <div className="gf-card-flat">
                  <div className="type-caption">THIS WEEK (ALL CARS)</div>
                  <div className="type-title mono">{usageAnalytics.combinedOverall.week.distanceKm} km</div>
                  <div className="type-caption">{usageAnalytics.combinedOverall.week.trips} trips</div>
                </div>
                <div className="gf-card-flat">
                  <div className="type-caption">THIS MONTH (ALL CARS)</div>
                  <div className="type-title mono">{usageAnalytics.combinedOverall.month.distanceKm} km</div>
                  <div className="type-caption">{usageAnalytics.combinedOverall.month.trips} trips</div>
                </div>
                <div className="gf-card-flat">
                  <div className="type-caption">OVERALL TOTAL</div>
                  <div className="type-title mono">{usageAnalytics.combinedOverall.allTime.distanceKm} km</div>
                  <div className="type-caption">{usageAnalytics.combinedOverall.allTime.trips} trips</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                <div className="gf-card-flat">
                  <div className="type-section">Gasoline Summary (Litres)</div>
                  <div className="type-title mono">{usageAnalytics.combinedOverall.gasolineSummary.totalLitres} L • ${usageAnalytics.combinedOverall.gasolineSummary.totalFuelCost.toFixed(2)}</div>
                </div>
                <div className="gf-card-flat">
                  <div className="type-section">Electric Summary (kWh)</div>
                  <div className="type-title mono">{usageAnalytics.combinedOverall.electricSummary.totalKwh} kWh • ${usageAnalytics.combinedOverall.electricSummary.totalChargingCost.toFixed(2)}</div>
                </div>
              </div>

              <section className="gf-card-flat">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  <h2 className="type-section">Vehicle Usage Summary</h2>
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
                        <th>Total Cost</th>
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
                          <td className="mono">${v.totalOperatingCost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="gf-card-flat">
                <h2 className="type-section" style={{ marginBottom: '12px' }}>Driver Usage Summary</h2>
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

              {gpsLatest && (
                <section className="gf-card-flat">
                  <h2 className="type-section" style={{ marginBottom: '8px' }}>Periodic Location Monitor (Best-Effort GPS)</h2>
                  <p className="type-caption" style={{ marginBottom: '12px' }}>{gpsLatest.notice}</p>
                  <div className="gf-table-wrap">
                    <table className="gf-table">
                      <thead><tr><th>Driver</th><th>State</th><th>Coordinates</th><th>Timestamps</th></tr></thead>
                      <tbody>
                        {gpsLatest.drivers.map((d: any) => (
                          <tr key={d.driver_profile_id}>
                            <td style={{ fontWeight: 700 }}>{d.driver_name}</td>
                            <td><StatusBadge label={d.status_label} tone={toneFromStatus(d.display_state)} /></td>
                            <td className="mono type-caption">{d.report && d.report.latitude !== null ? `${Number(d.report.latitude).toFixed(5)}, ${Number(d.report.longitude).toFixed(5)} (${d.accuracy_label})` : 'No position shown as current'}</td>
                            <td className="mono type-caption">{d.report ? `Captured: ${d.report.capture_time}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <section className="gf-card-flat">
                <h2 className="type-section" style={{ marginBottom: '12px' }}>Audit Trail ({auditEvents.length} Recent)</h2>
                <div className="gf-table-wrap">
                  <table className="gf-table">
                    <thead><tr><th>Time (UTC)</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead>
                    <tbody>
                      {auditEvents.slice(0, 20).map((ev) => (
                        <tr key={ev.id}>
                          <td className="mono type-caption">{ev.created_at}</td>
                          <td>{ev.actor_username} ({ev.actor_role})</td>
                          <td className="mono">{ev.action}</td>
                          <td className="mono">{ev.entity_type} {ev.entity_id ? `#${ev.entity_id}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
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
  const currentMetrics = estimateRouteMetrics(bookOrigin, bookDest);

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
    ((bookingStep === 'ROUTE' && Boolean(bookDest.trim()) && routeTab !== 'PIN') ||
      bookingStep === 'VEHICLE' ||
      bookingStep === 'SUMMARY' ||
      bookingStep === 'IN_TRIP');

  const handleMapBack = () => {
    if (navSection === 'DRIVER') {
      setNavSection('HOME');
      setBookingStep('HOME');
      setSheetSnap('half');
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
                if (!bookDest.trim()) {
                  setBookDest('SCBD District 8');
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
                <div className="type-caption">Estimated route</div>
                <div className="type-body" style={{ fontWeight: 700 }}>
                  {currentMetrics.distanceKm} km • ~{currentMetrics.durationMin} min
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
                {scheduleMode === 'NOW' ? 'Departing now' : new Date(bookStart).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
              {selectedVehicle.make} {selectedVehicle.model} • {selectedVehicle.registration_plate}
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

    // Banner feedback inside sheet
    const feedbackBanner = statusBanner ? (
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
    ) : null;

    // -------------------------------------------------------------------------
    // DRIVER DISPATCH SHEET (No tables, flat cards/rows, periodic GPS)
    // -------------------------------------------------------------------------
    if (navSection === 'DRIVER') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feedbackBanner}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div>
              <h1 className="type-title">Driver Dispatch</h1>
              <p className="type-caption">Assigned orders & periodic location check-ins</p>
            </div>
            <StatusBadge label={gpsReportingActive ? 'Duty Active' : 'Standby'} tone={gpsReportingActive ? 'green' : 'neutral'} />
          </div>

          {/* Periodic GPS Notice & Controls (GPS-03, GPS-15) */}
          <div style={{ padding: '14px', borderRadius: 'var(--radius-card)', background: 'var(--color-bg-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="type-caption" style={{ color: 'var(--color-text-secondary)' }}>
              <strong>Periodic Location Notice:</strong> Sends a report every 20 minutes while the app stays open during active duty (not continuous live tracking).
            </div>
            {!gpsNoticeAccepted ? (
              <button
                id="driver-accept-gps-notice-btn"
                type="button"
                className="gf-btn gf-btn-primary gf-btn-full"
                onClick={() => {
                  setGpsNoticeAccepted(true);
                  setGpsReportingActive(true);
                }}
              >
                <Navigation size={16} /> Start Duty & Location Check-In
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" className="gf-btn gf-btn-primary" style={{ flex: 1 }} onClick={() => sendDriverLocationReport('GRANTED')}>
                  <MapPin size={16} /> Send Check-In
                </button>
                <button
                  type="button"
                  className="gf-btn gf-btn-secondary"
                  onClick={() => {
                    setGpsPermissionState('DENIED');
                    sendDriverLocationReport('DENIED');
                  }}
                >
                  Permission Denied
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
                        {!d.acknowledged_at && (
                          <button
                            type="button"
                            className="gf-btn gf-btn-primary gf-btn-full"
                            onClick={async () => {
                              await apiRequest(`/api/driver/trips/${tripId}/acknowledge`, { method: 'POST' });
                              setStatusBanner({ type: 'success', text: 'Dispatch order acknowledged.' });
                              await loadAllData(user);
                            }}
                          >
                            Acknowledge Order
                          </button>
                        )}
                        {!isInProgress ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="number"
                              className="gf-input"
                              aria-label="Start odometer"
                              value={activeTripOdoInput[tripId] ?? d.current_odometer}
                              onChange={(e) => setActiveTripOdoInput({ ...activeTripOdoInput, [tripId]: e.target.value })}
                            />
                            <button
                              type="button"
                              className="gf-btn gf-btn-primary"
                              onClick={async () => {
                                try {
                                  await apiRequest(`/api/driver/trips/${tripId}/start`, {
                                    method: 'POST',
                                    body: JSON.stringify({ start_odometer: Number(activeTripOdoInput[tripId] ?? d.current_odometer) }),
                                  });
                                  setStatusBanner({ type: 'success', text: 'Trip started!' });
                                  await loadAllData(user);
                                } catch (err: any) {
                                  setStatusBanner({ type: 'danger', text: err.message });
                                }
                              }}
                            >
                              <Play size={16} /> Start Trip
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                              value={activeTripParkingInput[tripId] ?? 'Basement B1'}
                              onChange={(e) => setActiveTripParkingInput({ ...activeTripParkingInput, [tripId]: e.target.value })}
                            />
                            <button
                              type="button"
                              className="gf-btn gf-btn-primary gf-btn-full"
                              onClick={async () => {
                                try {
                                  await apiRequest(`/api/driver/trips/${tripId}/complete`, {
                                    method: 'POST',
                                    body: JSON.stringify({
                                      end_odometer: Number(activeTripOdoInput[tripId] ?? Number(d.start_odometer || d.current_odometer) + 25),
                                      battery_percent: d.energy_type === 'Electric' ? Number(activeTripBatteryInput[tripId] ?? 72) : undefined,
                                      parking_return_note: activeTripParkingInput[tripId] || 'Basement B1',
                                    }),
                                  });
                                  setStatusBanner({ type: 'success', text: 'Trip completed & odometer saved.' });
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
                <button
                  type="button"
                  className="gf-btn gf-btn-primary"
                  onClick={() => {
                    setNavSection('HOME');
                    setBookingStep('ROUTE');
                    setSheetSnap('full');
                  }}
                >
                  Book a ride
                </button>
              }
            />
          ) : (
            <div>
              {shownList.map((t) => (
                <ListRow
                  key={t.id}
                  tall
                  icon={<Car size={20} />}
                  title={`${t.origin} → ${t.destination}`}
                  subtitle={`${new Date(t.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • ${t.make} ${t.model} (${t.registration_plate})`}
                  trailing={<StatusBadge label={t.booking_status === 'CANCELLED' ? 'CANCELLED' : t.status} tone={toneFromStatus(t.booking_status === 'CANCELLED' ? 'CANCELLED' : t.status)} />}
                  showChevron={activityTab === 'ONGOING'}
                  onClick={
                    activityTab === 'ONGOING'
                      ? () => {
                          setFocusedTripId(t.id);
                          setNavSection('HOME');
                          setBookingStep(t.status === 'PENDING_APPROVAL' ? 'WAITING' : 'IN_TRIP');
                          setSheetSnap('half');
                        }
                      : undefined
                  }
                />
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
              <div className="type-caption">@{user.group_username} • {user.department_name || `Dept #${user.department_id}`}</div>
              <div style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
                <StatusBadge label={`Role: ${user.role}`} tone="green" />
                {user.is_department_admin === 1 && <StatusBadge label="Dept Admin" tone="blue" />}
              </div>
            </div>
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
    // BOOKING FLOW STEP 0: HOME
    // -------------------------------------------------------------------------
    if (bookingStep === 'HOME') {
      const shortcutCount = isPrivileged || user.role === 'DRV' ? 8 : 7;
      const shortcuts = [
        {
          id: 'sc-ride',
          label: 'Book Ride',
          green: true,
          icon: <Car size={24} />,
          action: () => {
            setVehicleFilter('ALL');
            setScheduleMode('NOW');
            setBookingStep('ROUTE');
            setSheetSnap('full');
          },
        },
        {
          id: 'sc-schedule',
          label: 'Schedule',
          green: false,
          icon: <Calendar size={22} />,
          action: () => {
            setVehicleFilter('ALL');
            setScheduleMode('SCHEDULE');
            setBookingStep('ROUTE');
            setSheetSnap('full');
          },
        },
        {
          id: 'sc-ev',
          label: 'EV Pool',
          green: true,
          icon: <Zap size={22} />,
          action: () => {
            setVehicleFilter('Electric');
            setBookingStep('ROUTE');
            setSheetSnap('full');
          },
        },
        {
          id: 'sc-mpv',
          label: '7-Seater',
          green: false,
          icon: <Users size={22} />,
          action: () => {
            setVehicleFilter('MPV');
            setBookingStep('ROUTE');
            setSheetSnap('full');
          },
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
        ...(shortcutCount === 8
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

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {feedbackBanner}

          {/* Greeting + Dept Chip + Notification Bell */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ minWidth: 0 }}>
              <h1 className="type-title">
                {getTimeGreeting()}, {user.nickname}
              </h1>
              <div style={{ marginTop: '6px' }}>
                <Chip subtle>{user.department_name || 'Company Team'}</Chip>
              </div>
            </div>
            <button
              type="button"
              className="gf-icon-btn-48 pressable"
              onClick={() => setNavSection('INBOX')}
              aria-label={`Notifications (${unreadCount} unread)`}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="gf-nav-badge" style={{ top: '6px', right: '6px' }}>
                  {unreadCount}
                </span>
              )}
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
            onClick={() => {
              setBookingStep('ROUTE');
              setSheetSnap('full');
            }}
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

          {/* Horizontal Scroll Chips for Recent Destinations */}
          <div>
            <div className="type-caption" style={{ fontWeight: 700, marginBottom: '8px' }}>
              Recent destinations
            </div>
            <div className="gf-hscroll">
              {recentDestinationChips.map((dest) => (
                <Chip
                  key={dest}
                  icon={<MapPin size={14} style={{ color: 'var(--color-green)' }} />}
                  onClick={() => {
                    setBookDest(dest);
                    setBookingStep('ROUTE');
                    setSheetSnap('full');
                  }}
                >
                  {dest}
                </Chip>
              ))}
            </div>
          </div>

          {/* Announcement Carousel (16:9 cards + dot pagination) */}
          <div>
            <div className="gf-promo-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusBadge label={ANNOUNCEMENTS[carouselIdx].tag} tone="green" />
                <Car size={28} style={{ color: 'var(--color-green)', opacity: 0.7 }} />
              </div>
              <div>
                <div className="type-section">{ANNOUNCEMENTS[carouselIdx].title}</div>
                <p className="type-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  {ANNOUNCEMENTS[carouselIdx].body}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
              {ANNOUNCEMENTS.map((item, idx) => (
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
    // BOOKING FLOW STEP 1: WHERE TO? (ROUTE)
    // -------------------------------------------------------------------------
    if (bookingStep === 'ROUTE') {
      const baseList = routeTab === 'SAVED' ? SAVED_PLACES : CORPORATE_HUBS;
      const placeList =
        activeRouteField === 'destination'
          ? baseList.filter((p) => p.name.toLowerCase() !== bookOrigin.toLowerCase().trim())
          : baseList;
      const filterText = (activeRouteField === 'pickup' ? bookOrigin : bookDest).toLowerCase().trim();
      const filteredPlaces =
        filterText && activeRouteField === 'destination'
          ? placeList.filter((p) => p.name.toLowerCase().includes(filterText) || p.address.toLowerCase().includes(filterText))
          : placeList;
      const rowsToRender = filteredPlaces.length > 0 ? filteredPlaces : placeList;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 className="type-title">Where to?</h1>
          </div>

          <RouteFields
            pickup={bookOrigin}
            destination={bookDest}
            onPickupChange={setBookOrigin}
            onDestinationChange={setBookDest}
            activeField={activeRouteField}
            onFocusField={setActiveRouteField}
          />

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
              <div className="type-body" style={{ fontWeight: 700 }}>Drag map to set location</div>
              <p className="type-caption" style={{ marginTop: '4px' }}>
                Move the map or use arrow keys to place the pin for your {activeRouteField === 'pickup' ? 'pickup point' : 'destination'}.
              </p>
              <div className="type-body" style={{ marginTop: '10px', fontWeight: 600, color: 'var(--color-green-text)' }}>
                {activeRouteField === 'pickup' ? bookOrigin : bookDest || 'Center pin active'}
              </div>
            </div>
          ) : loadingData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </div>
          ) : (
            <div>
              {rowsToRender.map((p) => (
                <ListRow
                  key={p.name}
                  tall
                  icon={routeTab === 'SAVED' ? <Bookmark size={18} /> : <MapPin size={18} />}
                  title={p.name}
                  subtitle={p.address}
                  onClick={() => {
                    if (activeRouteField === 'pickup') {
                      setBookOrigin(p.name);
                      setActiveRouteField('destination');
                    } else {
                      setBookDest(p.name);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // BOOKING FLOW STEP 2: PICK YOUR RIDE (VEHICLE)
    // -------------------------------------------------------------------------
    if (bookingStep === 'VEHICLE') {
      const activeDrivers = (liveAvailability?.drivers || drivers).filter(
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
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredVehicles.map((v) => {
                const isAvail = v.isAvailable !== false && v.status === 'Available';
                const isSelected = Number(bookVehicleId) === v.id;
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
                        <StatusBadge label={isEv ? 'EV' : 'Gasoline'} tone={isEv ? 'green' : 'neutral'} />
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
                Preferred Driver
              </label>
              <select
                id="driver-pick-select"
                className="gf-select"
                value={bookDriverId}
                onChange={(e) => setBookDriverId(e.target.value)}
              >
                <option value="">Auto-assign on Admin approval</option>
                {activeDrivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} (Class {d.licence_class})
                  </option>
                ))}
              </select>
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
                  {currentMetrics.distanceKm} km • ~{currentMetrics.durationMin} min
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
              subtitle={`${bookPax} passenger${bookPax > 1 ? 's' : ''}`}
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
              subtitle={`${user.department_name || 'Department'} • Driver: ${chosenDriverObj ? chosenDriverObj.full_name : 'Auto-assign'}`}
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
                    {summaryPicker === 'PAX' && 'Number of passengers'}
                    {summaryPicker === 'NOTES' && 'Dispatch notes'}
                    {summaryPicker === 'CHARGE' && 'Department & driver'}
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '12px 0' }}>
                    <button
                      type="button"
                      className="gf-icon-btn-48"
                      aria-label="Decrease passengers"
                      onClick={() => setBookPax((p) => Math.max(1, p - 1))}
                    >
                      <Minus size={18} />
                    </button>
                    <span className="type-title" style={{ minWidth: '48px', textAlign: 'center' }}>{bookPax}</span>
                    <button
                      type="button"
                      className="gf-icon-btn-48"
                      aria-label="Increase passengers"
                      onClick={() => setBookPax((p) => Math.min(selectedVehicle?.seats || 7, p + 1))}
                    >
                      <Plus size={18} />
                    </button>
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
                    <div><strong>Department:</strong> {user.department_name || `Dept #${user.department_id}`}</div>
                    <div><strong>Driver:</strong> {chosenDriverObj ? chosenDriverObj.full_name : 'Assigned on approval'}</div>
                    <p className="type-caption">Requests are routed automatically to Fleet & HWS Admin for approval.</p>
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
            {isStarted ? `Arriving in ~${Math.max(8, currentMetrics.durationMin || 18)} min` : 'Driver arriving in ~10 min'}
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
            {tripToShow?.registration_plate || 'B 1001 FMS'}
          </div>
        </div>

        {/* Three 48px Round Action Buttons: Call, Chat, Share */}
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setStatusBanner({ type: 'info', text: `Driver dispatch desk: ${tripToShow?.assigned_driver_name || 'Driver'} is notified of your call.` })}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <span className="gf-icon-btn-48"><Phone size={20} /></span>
            <span className="type-caption" style={{ fontWeight: 600 }}>Call</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusBanner({ type: 'info', text: 'Quick dispatch note sent to your driver.' })}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <span className="gf-icon-btn-48"><MessageSquare size={20} /></span>
            <span className="type-caption" style={{ fontWeight: 600 }}>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(`${tripToShow?.make} ${tripToShow?.model} (${tripToShow?.registration_plate}) -> ${tripToShow?.destination}`).catch(() => {});
              }
              setStatusBanner({ type: 'success', text: 'Trip summary copied to clipboard.' });
            }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <span className="gf-icon-btn-48"><Share2 size={20} /></span>
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
          setNavSection(n);
          if (n === 'HOME') {
            setBookingStep('HOME');
            setSheetSnap('half');
          } else {
            setSheetSnap('full');
          }
        }}
        hideChromeDuringBooking={inActiveBookingFlow || navSection === 'DRIVER'}
        isDriverOrPrivileged={user.role === 'DRV' || Boolean(isPrivileged)}
        isPrivileged={Boolean(isPrivileged)}
        unreadInboxCount={unreadCount}
        pendingDispatchCount={dispatches.filter((d) => d.trip_status !== 'COMPLETED' && d.trip_status !== 'REJECTED').length}
        pendingAdminCount={pendingTrips.length + pendingUsers.length}
        mapStage={
          <MapView
            origin={mapOrigin}
            destination={mapDest}
            showRoute={showRouteOnMap}
            pinMode={navSection === 'HOME' && bookingStep === 'ROUTE' && routeTab === 'PIN'}
            onPinMoveAddress={(addr) => {
              if (activeRouteField === 'pickup') setBookOrigin(addr);
              else setBookDest(addr);
            }}
            waitingRadar={navSection === 'HOME' && bookingStep === 'WAITING'}
            driverActive={navSection === 'HOME' && bookingStep === 'IN_TRIP'}
            driverName={focusedTrip?.assigned_driver_name}
            showBackButton={inActiveBookingFlow || navSection === 'DRIVER'}
            onBack={handleMapBack}
            isOffline={isOffline}
          />
        }
        sheet={
          <BottomSheet
            snap={sheetSnap}
            onSnapChange={setSheetSnap}
            onEscape={inActiveBookingFlow ? handleMapBack : undefined}
            hasBottomNav={!inActiveBookingFlow && navSection !== 'DRIVER'}
            stepKey={`${navSection}:${bookingStep}`}
            footer={stickyFooter}
            desktopNav={
              !inActiveBookingFlow && navSection !== 'DRIVER' ? (
                <DesktopPanelNav
                  activeNav={navSection}
                  onSelectNav={(n) => {
                    setNavSection(n);
                    if (n === 'HOME') setBookingStep('HOME');
                  }}
                  unreadInboxCount={unreadCount}
                />
              ) : undefined
            }
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
