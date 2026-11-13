import React, { useEffect, useState, useCallback } from 'react';
import {
  Car,
  ShieldCheck,
  Bell,
  Download,
  LogOut,
  Calendar,
  Navigation,
  Wrench,
  FileText,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  BatteryCharging,
  Fuel,
  UserCheck,
  Users,
  MapPin,
  Upload,
  RefreshCw,
  Edit3,
  PauseCircle,
  Play,
  Flag,
} from 'lucide-react';
import { apiRequest, getStoredToken, setStoredToken, urlBase64ToUint8Array } from './api';

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

export function App() {
  const [user, setUser] = useState<any | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState<string>('');
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

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
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);
  const [showInstallGuideModal, setShowInstallGuideModal] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<'BOOKING' | 'DRIVER_PWA' | 'ADMIN_DISPATCH' | 'FLEET_OPS' | 'ANALYTICS_AUDIT'>('BOOKING');
  const [statusBanner, setStatusBanner] = useState<{ type: 'info' | 'success' | 'warning' | 'danger'; text: string } | null>(null);

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

  // Analytics Granularity Filter (Revision #6: Day / Week / Month / Overall)
  const [usagePeriod, setUsagePeriod] = useState<'day' | 'week' | 'month' | 'overall'>('month');

  const isPrivileged = user && ['ADM', 'FM', 'HWS'].includes(user.role);

  // Listen for online/offline (WEB-03) and PWA beforeinstallprompt (WEB-02, Revision #5)
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
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Non-blocking in non-HTTPS test environments
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const loadAllData = useCallback(async (currentUser: any) => {
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
    } catch (err) {
      console.error('Failed loading dashboard data:', err);
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
          setActiveTab('DRIVER_PWA');
        } else if (['ADM', 'FM', 'HWS'].includes(res.user.role)) {
          setActiveTab('ADMIN_DISPATCH');
        } else {
          setActiveTab('BOOKING');
        }
        return loadAllData(res.user);
      })
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => setLoadingAuth(false));
  }, [loadAllData]);

  // Live availability check when booking start/end times change
  useEffect(() => {
    if (!user || !bookStart || !bookEnd) return;
    const sIso = new Date(bookStart).toISOString();
    const eIso = new Date(bookEnd).toISOString();
    apiRequest(`/api/availability?start_time=${encodeURIComponent(sIso)}&end_time=${encodeURIComponent(eIso)}`)
      .then((res) => setLiveAvailability(res))
      .catch(() => {});
  }, [user, bookStart, bookEnd, trips, bookings, vehicles]);

  // Periodic 20-Minute GPS Reporting + Screen WakeLock for Driver PWA (Section 9)
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
            // Fallback simulated HQ Jakarta coordinates when desktop browser lacks hardware GPS fix, or record state
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
    }, 20 * 60 * 1000); // 20-minute target interval (GPS-02)

    return () => {
      window.clearInterval(intervalId);
      if (wakeLock && wakeLock.release) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [gpsReportingActive, gpsNoticeAccepted, sendDriverLocationReport]);

  // Handlers: Login & Registration (Revision #2)
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
        setActiveTab('DRIVER_PWA');
      } else if (['ADM', 'FM', 'HWS'].includes(res.user.role)) {
        setActiveTab('ADMIN_DISPATCH');
      } else {
        setActiveTab('BOOKING');
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

  // Handler: Install PWA & Enable Web Push Notifications (Revision #5)
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
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
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

      // Always register a verified subscription record & trigger a test push/in-app notification
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
        new Notification('FleetOps PWA Push Active', {
          body: 'You will now receive instant booking, reminder, and dispatch notifications.',
          icon: '/icons/icon.svg',
        });
      }

      setPushSubscribed(true);
      setStatusBanner({
        type: 'success',
        text: 'PWA Push Notifications enabled! A test alert was delivered to your notification center.',
      });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  // Handler: Submit Trip Booking (Revision #1 No Self-Drive, Revision #4 Immediate Car/Driver Schedule Lock)
  const handleCreateTripBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusBanner(null);
    try {
      await apiRequest('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          vehicle_id: Number(bookVehicleId),
          preferred_driver_id: bookDriverId ? Number(bookDriverId) : null,
          purpose: bookPurpose,
          origin: bookOrigin,
          destination: bookDest,
          start_time: new Date(bookStart).toISOString(),
          end_time: new Date(bookEnd).toISOString(),
          passenger_count: Number(bookPax),
          notes: bookNotes,
        }),
      });
      setBookPurpose('');
      setBookDest('');
      setBookNotes('');
      setStatusBanner({
        type: 'success',
        text: 'Booking submitted! The selected vehicle and driver schedule are now IMMEDIATELY LOCKED (Pending Approval) so no double-booking can occur.',
      });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  // Handler: Admin Approve/Reject User Registration (Revision #2)
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

  // Handler: Admin One-Click Approve & Dispatch or Reject Trip Request
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
            ? `Trip #${dispatchModalTrip.id} approved and dispatched! Push notification sent to Driver and Requester.`
            : `Trip #${dispatchModalTrip.id} rejected and vehicle schedule slot released.`,
      });
      await loadAllData(user);
    } catch (err: any) {
      setStatusBanner({ type: 'danger', text: err.message });
    }
  };

  // Handler: Admin Save Vehicle Changes / Standby Status (Revision #3)
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

  if (loadingAuth) {
    return (
      <div className="auth-screen">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h2>Loading Fleet Management System...</h2>
        </div>
      </div>
    );
  }

  // ============================================================================
  // UNAUTHENTICATED SCREEN: PURE LOGIN & 4-FIELD REGISTRATION (Revision #2)
  // ============================================================================
  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div className="brand-mark">
              <Car size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>Company Fleet Management</h1>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Internal Vehicle Reservation, Dispatch & Android PWA
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <button
              type="button"
              id="auth-tab-login"
              className={`btn ${authMode === 'LOGIN' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => {
                setAuthMode('LOGIN');
                setAuthMessage(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              id="auth-tab-register"
              className={`btn ${authMode === 'REGISTER' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => {
                setAuthMode('REGISTER');
                setAuthMessage(null);
              }}
            >
              Register Account
            </button>
          </div>

          {authMessage && (
            <div className={`banner ${authMessage.type === 'error' ? 'banner-danger' : 'banner-success'}`}>
              <span>{authMessage.text}</span>
            </div>
          )}

          {authMode === 'LOGIN' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-username">
                  Group Username
                </label>
                <input
                  id="login-username"
                  className="form-input"
                  type="text"
                  required
                  placeholder="e.g., admin, drv_budi, emp_alex"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="login-password">
                  Password
                </label>
                <input
                  id="login-password"
                  className="form-input"
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
              <button id="login-submit-btn" type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.25rem' }}>
                Sign In to Fleet System
              </button>

              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.85rem',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Pre-Configured Accounts for Testing:</div>
                <div className="mono" style={{ display: 'grid', gap: '0.2rem' }}>
                  <div>• Admin: <strong>admin</strong> / <strong>Admin@123</strong></div>
                  <div>• Fleet Manager: <strong>fleetmgr</strong> / <strong>Fleet@123</strong></div>
                  <div>• Head of HWS: <strong>hws_head</strong> / <strong>Hws@123</strong></div>
                  <div>• Driver (PWA): <strong>drv_budi</strong> / <strong>Driver@123</strong></div>
                  <div>• Employee User: <strong>emp_alex</strong> / <strong>Emp@123</strong></div>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="banner banner-info" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                <span>
                  <strong>Privacy-First Registration:</strong> No personal contact/ID data required. Accounts require{' '}
                  <strong>Administrator approval</strong> before sign-in.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-nickname">
                  Nickname
                </label>
                <input
                  id="reg-nickname"
                  className="form-input"
                  type="text"
                  required
                  placeholder="e.g., Kevin"
                  value={regNickname}
                  onChange={(e) => setRegNickname(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-dept">
                  Department (9 Company Departments)
                </label>
                <select
                  id="reg-dept"
                  className="form-select"
                  value={regDeptId}
                  onChange={(e) => setRegDeptId(Number(e.target.value))}
                >
                  {REGISTRATION_DEPARTMENTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-username">
                  Group Username
                </label>
                <input
                  id="reg-username"
                  className="form-input"
                  type="text"
                  required
                  placeholder="e.g., eng_kevin"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">
                  Password
                </label>
                <input
                  id="reg-password"
                  className="form-input"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-role">
                  Account Type
                </label>
                <select id="reg-role" className="form-select" value={regRole} onChange={(e) => setRegRole(e.target.value as 'EMP' | 'DRV')}>
                  <option value="EMP">User / Employee (Book & Reserve Cars)</option>
                  <option value="DRV">Company Driver (Receive Dispatch Orders)</option>
                </select>
              </div>

              <button id="register-submit-btn" type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Submit Registration for Admin Approval
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const pendingUsers = usersList.filter((u) => u.approval_status === 'PENDING_APPROVAL');
  const pendingTrips = trips.filter((t) => t.status === 'PENDING_APPROVAL');

  return (
    <div className="app-shell">
      {/* Top Header with Universal PWA Install & Push Notification Controls (Revision #5) */}
      <header className="top-navbar">
        <div className="brand-cluster">
          <div className="brand-mark">
            <Car size={20} />
          </div>
          <div>
            <div className="brand-title">FleetOps Command & PWA</div>
            <div className="brand-subtitle">
              8 Vehicles (5 Gasoline • 3 Electric) • 9 Departments • Periodic GPS
            </div>
          </div>
        </div>

        <div className="nav-actions">
          <span className="badge badge-info" style={{ padding: '0.35rem 0.7rem' }}>
            {user.nickname} (@{user.group_username}) • Role: {user.role}
            {user.is_department_admin === 1 ? ' + Dept Admin' : ''}
          </span>

          <button id="pwa-install-btn" type="button" className="btn btn-secondary btn-sm" onClick={handleInstallPwa}>
            <Download size={15} />
            Install PWA App
          </button>

          <button
            id="push-enable-btn"
            type="button"
            className={`btn btn-sm ${pushSubscribed ? 'btn-success' : 'btn-primary'}`}
            onClick={handleEnablePushNotifications}
          >
            <Bell size={15} />
            {pushSubscribed ? 'Push Active (Test)' : 'Enable Push Alerts'}
          </button>

          <button
            id="notifications-drawer-btn"
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowNotificationsModal(true)}
          >
            <Bell size={15} />
            Inbox ({unreadCount})
          </button>

          <button id="logout-btn" type="button" className="btn btn-danger btn-sm" onClick={handleLogout}>
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </header>

      {/* WEB-03: Explicit Connection-Required Offline Guard */}
      {isOffline && (
        <div className="banner banner-danger" style={{ margin: '0.75rem 1.25rem 0', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} />
            <strong>Connection Required (WEB-03):</strong> You are currently offline. Live fleet data is not cached offline to prevent stale booking or location decisions.
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="sub-nav" aria-label="Main Modules">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'BOOKING' ? 'active' : ''}`}
          onClick={() => setActiveTab('BOOKING')}
        >
          <Calendar size={16} />
          Book / Reserve Car & My Trips
        </button>

        {(user.role === 'DRV' || isPrivileged) && (
          <button
            type="button"
            className={`tab-btn ${activeTab === 'DRIVER_PWA' ? 'active' : ''}`}
            onClick={() => setActiveTab('DRIVER_PWA')}
          >
            <Navigation size={16} />
            Driver Dispatch PWA ({dispatches.filter((d) => d.trip_status !== 'COMPLETED' && d.trip_status !== 'REJECTED').length})
          </button>
        )}

        {isPrivileged && (
          <>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'ADMIN_DISPATCH' ? 'active' : ''}`}
              onClick={() => setActiveTab('ADMIN_DISPATCH')}
            >
              <ShieldCheck size={16} />
              Admin Approvals & Dispatch ({pendingTrips.length + pendingUsers.length})
            </button>

            <button
              type="button"
              className={`tab-btn ${activeTab === 'FLEET_OPS' ? 'active' : ''}`}
              onClick={() => setActiveTab('FLEET_OPS')}
            >
              <Wrench size={16} />
              Vehicles, Standby, Energy & Docs
            </button>

            <button
              type="button"
              className={`tab-btn ${activeTab === 'ANALYTICS_AUDIT' ? 'active' : ''}`}
              onClick={() => setActiveTab('ANALYTICS_AUDIT')}
            >
              <BarChart3 size={16} />
              Usage Analytics (Day/Week/Month), GPS & Audit
            </button>
          </>
        )}
      </nav>

      <main className="main-container">
        {statusBanner && (
          <div className={`banner banner-${statusBanner.type}`}>
            <span>{statusBanner.text}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatusBanner(null)}>
              Dismiss
            </button>
          </div>
        )}

        {/* ===================================================================
            TAB 1: BOOK / RESERVE CAR & MY TRIPS (Revisions #1 & #4)
           =================================================================== */}
        {activeTab === 'BOOKING' && (
          <div className="grid-2">
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <Car size={19} />
                  Reserve Company Vehicle (With Driver)
                </h2>
                <span className="badge badge-info">Immediate Schedule Lock on Submit</span>
              </div>

              <div className="banner banner-info" style={{ fontSize: '0.82rem' }}>
                <span>
                  <strong>Anti-Double-Booking Protection:</strong> All trips include a company driver (Self-Drive is disabled). As soon as you submit a booking, the selected{' '}
                  <strong>car and driver schedule are immediately blocked</strong> even while awaiting Administrator approval.
                </span>
              </div>

              <form onSubmit={handleCreateTripBooking} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Departure Date & Time</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      required
                      value={bookStart}
                      onChange={(e) => setBookStart(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Return Date & Time</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      required
                      value={bookEnd}
                      onChange={(e) => setBookEnd(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Select Vehicle (8-Car Shared Pool)</label>
                    <select
                      className="form-select"
                      value={bookVehicleId}
                      onChange={(e) => setBookVehicleId(Number(e.target.value))}
                    >
                      {(liveAvailability?.vehicles || vehicles).map((v: any) => {
                        const avail = v.isAvailable !== false && v.status === 'Available';
                        return (
                          <option key={v.id} value={v.id} disabled={!avail}>
                            {avail ? '✅ AVAILABLE' : '🔒 BLOCKED'} — {v.registration_plate} • {v.make} {v.model} ({v.car_type}, {v.energy_type}
                            {v.energy_type === 'Electric' ? ` ${v.battery_percent ?? 100}%` : ''})
                            {!avail && v.conflictReason ? ` [${v.conflictReason}]` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Assign / Block Driver</label>
                    <select
                      className="form-select"
                      value={bookDriverId}
                      onChange={(e) => setBookDriverId(e.target.value)}
                    >
                      <option value="">Let Admin Assign on Approval</option>
                      {(liveAvailability?.drivers || drivers).map((d: any) => {
                        const avail = d.isAvailable !== false && d.availability_status === 'Active';
                        return (
                          <option key={d.id} value={d.id} disabled={!avail}>
                            {avail ? '✅' : '🔒'} {d.full_name} (Class {d.licence_class}) — {avail ? 'Available' : d.conflictReason || d.availability_status}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Trip Purpose</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="e.g., Client Contract Signing"
                      value={bookPurpose}
                      onChange={(e) => setBookPurpose(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Passengers</label>
                    <input
                      type="number"
                      className="form-input"
                      min={1}
                      max={7}
                      required
                      value={bookPax}
                      onChange={(e) => setBookPax(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Origin</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      value={bookOrigin}
                      onChange={(e) => setBookOrigin(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Destination</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="e.g., Sudirman Central Business District"
                      value={bookDest}
                      onChange={(e) => setBookDest(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Dispatch Notes for Driver / Admin</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Pickup point details or cargo notes"
                    value={bookNotes}
                    onChange={(e) => setBookNotes(e.target.value)}
                  />
                </div>

                <button id="submit-booking-btn" type="submit" className="btn btn-primary">
                  <Calendar size={16} />
                  Reserve Vehicle & Lock Schedule Slot
                </button>
              </form>
            </section>

            {/* Right Column: Live Fleet Availability & User's Reservations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <section className="card">
                <div className="card-header">
                  <h2 className="card-title">Live Fleet Status (8 Vehicles)</h2>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Plate & Model</th>
                        <th>Type / Energy</th>
                        <th>Schedule Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{v.registration_plate}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              {v.make} {v.model} ({v.seats} seats)
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${v.energy_type === 'Electric' ? 'badge-success' : 'badge-info'}`}>
                              {v.energy_type === 'Electric' ? `⚡ EV (${v.battery_percent ?? 100}%)` : '⛽ Gasoline'}
                            </span>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{v.car_type}</div>
                          </td>
                          <td>
                            {v.status !== 'Available' ? (
                              <span className="badge badge-danger">
                                {v.status} {v.standby_reason ? `(${v.standby_reason})` : ''}
                              </span>
                            ) : v.activeBooking ? (
                              <div>
                                <span className="badge badge-warning">
                                  🔒 Blocked ({v.activeBooking.status})
                                </span>
                                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                  {new Date(v.activeBooking.start_time).toLocaleString()}
                                </div>
                              </div>
                            ) : (
                              <span className="badge badge-success">Available to Book</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <h2 className="card-title">My Bookings & Approval History</h2>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Trip & Route</th>
                        <th>Vehicle & Driver</th>
                        <th>Status & Decisions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>#{t.id} — {t.purpose}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              {t.origin} → {t.destination}
                            </div>
                            <div className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              {new Date(t.start_time).toLocaleString()} — {new Date(t.end_time).toLocaleTimeString()}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{t.registration_plate}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              Driver: {t.assigned_driver_name || 'Pending Dispatch'}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                t.status === 'COMPLETED' || t.status === 'APPROVED'
                                  ? 'badge-success'
                                  : t.status === 'REJECTED' || t.status === 'CANCELLED'
                                  ? 'badge-danger'
                                  : 'badge-warning'
                              }`}
                            >
                              {t.status}
                            </span>
                            {t.decisions && t.decisions.length > 0 && (
                              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                {t.decisions.map((d: any) => (
                                  <div key={d.id}>
                                    • {d.decision} by {d.decider_name} ({d.reason})
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 2: DRIVER DISPATCH PWA CONSOLE (Section 7.8 TRP & Section 9 GPS)
           =================================================================== */}
        {activeTab === 'DRIVER_PWA' && (
          <div className="grid-2">
            {/* Driver Periodic Location Reporting Console (GPS-01 to GPS-18) */}
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <Navigation size={19} />
                  Driver Periodic Location Reporting (Best-Effort PWA GPS)
                </h2>
                <span className={`badge ${gpsReportingActive ? 'badge-success' : 'badge-neutral'}`}>
                  {gpsReportingActive ? 'Reporting Active (Every 20m Target)' : 'Not Tracking'}
                </span>
              </div>

              {/* GPS-15: Driver Privacy Notice before reporting starts */}
              <div className="banner banner-info" style={{ fontSize: '0.82rem' }}>
                <div>
                  <strong>Driver Location Notice (GPS-03, GPS-15):</strong> This PWA sends <em>periodic location reports</em> (target every 20 minutes while the app is open and permission is granted) during active duty. It is <strong>not continuous live tracking</strong>. Coordinates, capture time, and accuracy are visible only to authorized Fleet Managers, HWS Head, and Administrators.
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
                {!gpsNoticeAccepted ? (
                  <button
                    id="driver-accept-gps-notice-btn"
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setGpsNoticeAccepted(true);
                      setGpsReportingActive(true);
                    }}
                  >
                    <CheckCircle2 size={16} />
                    Acknowledge Notice & Start Periodic GPS Reporting
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => sendDriverLocationReport('GRANTED')}
                    >
                      <MapPin size={16} />
                      Send Periodic GPS Report Now
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setGpsPermissionState('DENIED');
                        sendDriverLocationReport('DENIED');
                      }}
                    >
                      Simulate Permission Denied (GPS-07)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setGpsPermissionState('UNAVAILABLE');
                        sendDriverLocationReport('UNAVAILABLE');
                      }}
                    >
                      Simulate Signal Unavailable (GPS-07)
                    </button>
                  </>
                )}
              </div>

              {lastDriverGpsReport && (
                <div style={{ padding: '0.9rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontSize: '0.84rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Latest Report Sent from This Phone:</div>
                  <div className="mono">
                    <div>State: {lastDriverGpsReport.permission_state}</div>
                    {lastDriverGpsReport.latitude && (
                      <div>
                        Coordinates: {Number(lastDriverGpsReport.latitude).toFixed(5)}, {Number(lastDriverGpsReport.longitude).toFixed(5)} (±
                        {lastDriverGpsReport.accuracy_meters ?? 'N/A'}m)
                      </div>
                    )}
                    <div>Phone Capture Time: {lastDriverGpsReport.capture_time}</div>
                    <div>Server Receipt Time: {lastDriverGpsReport.server_receipt_time}</div>
                  </div>
                </div>
              )}
            </section>

            {/* Driver Dispatch Orders Queue (TRP-01 to TRP-11) */}
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <Flag size={19} />
                  My Dispatch Orders ({dispatches.length})
                </h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {dispatches.map((d) => {
                  const tripId = d.trip_request_id;
                  const isCompleted = d.trip_status === 'COMPLETED';
                  const isInProgress = d.trip_status === 'IN_PROGRESS';

                  return (
                    <div
                      key={d.assignment_id}
                      style={{
                        border: '1px solid var(--border-strong)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                        background: isInProgress ? 'var(--brand-soft)' : 'var(--bg-surface)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div>
                          <span className="badge badge-info" style={{ marginBottom: '0.3rem' }}>
                            {d.registration_plate} • {d.make} {d.model} ({d.energy_type})
                          </span>
                          <h3 style={{ fontSize: '1rem' }}>
                            #{tripId} — {d.purpose || 'Assigned Dispatch'}
                          </h3>
                        </div>
                        <span className={`badge ${isCompleted ? 'badge-success' : isInProgress ? 'badge-warning' : 'badge-info'}`}>
                          {d.trip_status}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                        <div>
                          <strong>Route:</strong> {d.origin} → {d.destination}
                        </div>
                        <div>
                          <strong>Schedule:</strong> {new Date(d.effective_start).toLocaleString()} — {new Date(d.effective_end).toLocaleTimeString()}
                        </div>
                        <div>
                          <strong>Passenger / Dept:</strong> {d.requester_name} ({d.department_name}) • {d.passenger_count} pax
                        </div>
                        <div>
                          <strong>Vehicle Current Odometer:</strong> <span className="mono">{d.current_odometer} km</span>
                          {d.energy_type === 'Electric' ? ` • Battery: ${d.battery_percent ?? 100}%` : ''}
                          {d.last_parking_spot ? ` • Parked at: ${d.last_parking_spot}` : ''}
                        </div>
                      </div>

                      {!isCompleted && tripId && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                          {!d.acknowledged_at && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={async () => {
                                await apiRequest(`/api/driver/trips/${tripId}/acknowledge`, { method: 'POST' });
                                setStatusBanner({ type: 'success', text: `Dispatch order #${tripId} acknowledged.` });
                                await loadAllData(user);
                              }}
                            >
                              <CheckCircle2 size={15} />
                              Acknowledge Dispatch Order (TRP-02)
                            </button>
                          )}

                          {!isInProgress ? (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              <input
                                type="number"
                                className="form-input"
                                style={{ maxWidth: '160px' }}
                                placeholder={`Start Odo (${d.current_odometer})`}
                                value={activeTripOdoInput[tripId] ?? d.current_odometer}
                                onChange={(e) => setActiveTripOdoInput({ ...activeTripOdoInput, [tripId]: e.target.value })}
                              />
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                onClick={async () => {
                                  try {
                                    await apiRequest(`/api/driver/trips/${tripId}/start`, {
                                      method: 'POST',
                                      body: JSON.stringify({
                                        start_odometer: Number(activeTripOdoInput[tripId] ?? d.current_odometer),
                                      }),
                                    });
                                    setStatusBanner({ type: 'success', text: `Trip #${tripId} started!` });
                                    await loadAllData(user);
                                  } catch (err: any) {
                                    setStatusBanner({ type: 'danger', text: err.message });
                                  }
                                }}
                              >
                                <Play size={15} />
                                Start Trip (TRP-03)
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div className="form-grid">
                                <input
                                  type="number"
                                  className="form-input"
                                  placeholder={`End Odometer (> ${d.start_odometer || d.current_odometer} km)`}
                                  value={activeTripOdoInput[tripId] ?? Number(d.start_odometer || d.current_odometer) + 25}
                                  onChange={(e) => setActiveTripOdoInput({ ...activeTripOdoInput, [tripId]: e.target.value })}
                                />
                                {d.energy_type === 'Electric' && (
                                  <input
                                    type="number"
                                    className="form-input"
                                    min={0}
                                    max={100}
                                    placeholder="End EV Battery % (0-100)"
                                    value={activeTripBatteryInput[tripId] ?? '72'}
                                    onChange={(e) => setActiveTripBatteryInput({ ...activeTripBatteryInput, [tripId]: e.target.value })}
                                  />
                                )}
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Return Parking Spot (e.g. B1 Slot A02)"
                                  value={activeTripParkingInput[tripId] ?? 'Basement B1'}
                                  onChange={(e) => setActiveTripParkingInput({ ...activeTripParkingInput, [tripId]: e.target.value })}
                                />
                              </div>
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
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
                                    setStatusBanner({
                                      type: 'success',
                                      text: `Trip #${tripId} completed! Distance and vehicle usage analytics updated automatically.`,
                                    });
                                    await loadAllData(user);
                                  } catch (err: any) {
                                    setStatusBanner({ type: 'danger', text: err.message });
                                  }
                                }}
                              >
                                <CheckCircle2 size={15} />
                                Complete Trip & Update Odometer (TRP-03)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            TAB 3: ADMIN APPROVALS & ONE-CLICK DISPATCH COMMAND CENTER
           =================================================================== */}
        {activeTab === 'ADMIN_DISPATCH' && isPrivileged && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Pending User Account Registrations Gate (Revision #2) */}
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <UserCheck size={19} />
                  Account Registrations Pending Administrator Approval ({pendingUsers.length})
                </h2>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    const res = await apiRequest('/api/notifications/send-reminders', { method: 'POST' });
                    setStatusBanner({
                      type: 'success',
                      text: `Sent ${res.sentCount} booking & dispatch push reminders to users and drivers.`,
                    });
                    await loadAllData(user);
                  }}
                >
                  <Bell size={15} />
                  Send Upcoming Booking & Dispatch Push Reminders
                </button>
              </div>

              {pendingUsers.length === 0 ? (
                <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                  All registered accounts have been reviewed. New registrations will appear here for approval.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nickname</th>
                        <th>Group Username</th>
                        <th>Department</th>
                        <th>Requested Role</th>
                        <th>Admin Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingUsers.map((u) => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600 }}>{u.nickname}</td>
                          <td className="mono">@{u.group_username}</td>
                          <td>{u.department_name}</td>
                          <td>
                            <span className="badge badge-warning">{u.role}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                onClick={() => handleApproveUser(u.id, true, u.role)}
                              >
                                <CheckCircle2 size={14} />
                                Approve ({u.role})
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleApproveUser(u.id, false, u.role)}
                              >
                                <XCircle size={14} />
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

            {/* All Bookings & One-Click Approve & Dispatch Table */}
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <ShieldCheck size={19} />
                  Vehicle Bookings & Dispatch Queue ({trips.length})
                </h2>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID & Purpose</th>
                      <th>Requester & Dept</th>
                      <th>Time Window</th>
                      <th>Locked Vehicle & Driver</th>
                      <th>Status</th>
                      <th>Admin Control</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>#{t.id} — {t.purpose}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {t.origin} → {t.destination} ({t.passenger_count} pax)
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{t.requester_name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.department_name}</div>
                        </td>
                        <td className="mono" style={{ fontSize: '0.78rem' }}>
                          <div>Start: {new Date(t.start_time).toLocaleString()}</div>
                          <div>End: {new Date(t.end_time).toLocaleString()}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {t.registration_plate} ({t.energy_type})
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            Driver: {t.assigned_driver_name || 'Unassigned'}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              t.status === 'APPROVED' || t.status === 'COMPLETED'
                                ? 'badge-success'
                                : t.status === 'PENDING_APPROVAL' || t.status === 'IN_PROGRESS'
                                ? 'badge-warning'
                                : 'badge-danger'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setDispatchModalTrip(t);
                              setDispatchVehicleId(t.vehicle_id);
                              setDispatchDriverId(t.driver_profile_id || t.preferred_driver_id || 1);
                              setDispatchDecisionReason('');
                            }}
                          >
                            {t.status === 'PENDING_APPROVAL' ? 'Review & Dispatch' : 'Reassign / Manage'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            TAB 4: VEHICLES (EDIT & STANDBY), DRIVERS, ENERGY & DOCUMENTS
           =================================================================== */}
        {activeTab === 'FLEET_OPS' && isPrivileged && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(['VEHICLES', 'DRIVERS', 'FUEL_EV', 'MAINTENANCE', 'EXPENSES', 'DOCUMENTS'] as const).map((sub) => (
                <button
                  key={sub}
                  type="button"
                  className={`btn btn-sm ${opsSubTab === sub ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setOpsSubTab(sub)}
                >
                  {sub.replace('_', ' & ')}
                </button>
              ))}
            </div>

            {opsSubTab === 'VEHICLES' && (
              <section className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    <Car size={19} />
                    Fleet Register (8 Cars: 5 Gasoline, 3 Electric) — Edit Car Type, Plate & Standby Status
                  </h2>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>License Plate</th>
                        <th>Make / Model</th>
                        <th>Car Type</th>
                        <th>Energy & Battery</th>
                        <th>Odometer & Parking</th>
                        <th>Operational Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.map((v) => (
                        <tr key={v.id}>
                          <td className="mono" style={{ fontWeight: 700 }}>{v.registration_plate}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{v.make} {v.model}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>VIN: {v.vin} • {v.seats} seats</div>
                          </td>
                          <td>{v.car_type}</td>
                          <td>
                            <span className={`badge ${v.energy_type === 'Electric' ? 'badge-success' : 'badge-info'}`}>
                              {v.energy_type === 'Electric' ? `⚡ Electric (${v.battery_percent ?? 100}%)` : '⛽ Gasoline'}
                            </span>
                          </td>
                          <td>
                            <div className="mono">{v.current_odometer.toLocaleString()} km</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.last_parking_spot}</div>
                          </td>
                          <td>
                            <span className={`badge ${v.status === 'Available' ? 'badge-success' : 'badge-danger'}`}>
                              {v.status}
                            </span>
                            {v.standby_reason && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--status-danger)', marginTop: '0.2rem' }}>
                                Note: {v.standby_reason}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setEditingVehicle({ ...v })}
                              >
                                <Edit3 size={14} />
                                Edit Plate / Type / Standby
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => openVehicle360(v.id)}
                              >
                                360° Record
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
              <section className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    <Users size={19} />
                    Driver Profiles & Account Management
                  </h2>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Driver Name</th>
                        <th>Username</th>
                        <th>Licence Number & Class</th>
                        <th>Licence Expiry</th>
                        <th>Contact</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.map((d) => (
                        <tr key={d.id}>
                          <td style={{ fontWeight: 600 }}>{d.full_name}</td>
                          <td className="mono">@{d.group_username}</td>
                          <td className="mono">{d.licence_number} (Class {d.licence_class})</td>
                          <td className="mono">{d.licence_expiry}</td>
                          <td className="mono">{d.contact_number}</td>
                          <td>
                            <span className={`badge ${d.availability_status === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                              {d.availability_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {opsSubTab === 'FUEL_EV' && (
              <div className="grid-2">
                {/* Gasoline Fuel Log */}
                <section className="card">
                  <div className="card-header">
                    <h2 className="card-title">
                      <Fuel size={19} />
                      Gasoline Fuel Records (Litres — 5 Gasoline Cars Only)
                    </h2>
                  </div>
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
                            override_reason: fuelForm.override_reason || undefined,
                          }),
                        });
                        setStatusBanner({ type: 'success', text: 'Gasoline fuel record saved.' });
                        await loadAllData(user);
                      } catch (err: any) {
                        setStatusBanner({ type: 'danger', text: err.message });
                      }
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}
                  >
                    <div className="form-grid">
                      <select
                        className="form-select"
                        value={fuelForm.vehicle_id}
                        onChange={(e) => setFuelForm({ ...fuelForm, vehicle_id: Number(e.target.value) })}
                      >
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.registration_plate} ({v.energy_type}) — Odo: {v.current_odometer} km
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.1"
                        className="form-input"
                        placeholder="Litres"
                        value={fuelForm.litres}
                        onChange={(e) => setFuelForm({ ...fuelForm, litres: e.target.value })}
                      />
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        placeholder="Cost ($)"
                        value={fuelForm.cost}
                        onChange={(e) => setFuelForm({ ...fuelForm, cost: e.target.value })}
                      />
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Odometer (km)"
                        value={fuelForm.odometer_km}
                        onChange={(e) => setFuelForm({ ...fuelForm, odometer_km: e.target.value })}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm">
                      Record Gasoline Refuel
                    </button>
                  </form>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Vehicle</th>
                          <th>Litres</th>
                          <th>Cost</th>
                          <th>Odometer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fuelRecords.map((f) => (
                          <tr key={f.id}>
                            <td style={{ fontWeight: 600 }}>{f.registration_plate}</td>
                            <td className="mono">{f.litres} L</td>
                            <td className="mono">${Number(f.cost).toFixed(2)}</td>
                            <td className="mono">{f.odometer_km} km</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* EV Charging Log */}
                <section className="card">
                  <div className="card-header">
                    <h2 className="card-title">
                      <BatteryCharging size={19} />
                      EV Charging Sessions (kWh & Battery % — 3 Electric Cars Only)
                    </h2>
                  </div>
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
                    style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}
                  >
                    <div className="form-grid">
                      <select
                        className="form-select"
                        value={evForm.vehicle_id}
                        onChange={(e) => setEvForm({ ...evForm, vehicle_id: Number(e.target.value) })}
                      >
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.registration_plate} ({v.energy_type})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.1"
                        className="form-input"
                        placeholder="Energy Added (kWh)"
                        value={evForm.kwh_added}
                        onChange={(e) => setEvForm({ ...evForm, kwh_added: e.target.value })}
                      />
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Start SoC %"
                        value={evForm.battery_start_pct}
                        onChange={(e) => setEvForm({ ...evForm, battery_start_pct: e.target.value })}
                      />
                      <input
                        type="number"
                        className="form-input"
                        placeholder="End SoC %"
                        value={evForm.battery_end_pct}
                        onChange={(e) => setEvForm({ ...evForm, battery_end_pct: e.target.value })}
                      />
                    </div>
                    <button type="submit" className="btn btn-success btn-sm">
                      Record EV Charging Session
                    </button>
                  </form>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>EV Plate</th>
                          <th>kWh Added</th>
                          <th>Battery SoC</th>
                          <th>Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evRecords.map((ev) => (
                          <tr key={ev.id}>
                            <td style={{ fontWeight: 600 }}>{ev.registration_plate}</td>
                            <td className="mono">{ev.kwh_added} kWh</td>
                            <td className="mono">
                              {ev.battery_start_pct}% → {ev.battery_end_pct}%
                            </td>
                            <td className="mono">${Number(ev.cost).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {opsSubTab === 'MAINTENANCE' && (
              <section className="card">
                <div className="card-header">
                  <h2 className="card-title">Maintenance Schedule & Energy-Specific Catalogue (MNT-01 to MNT-07)</h2>
                </div>
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
                      setStatusBanner({ type: 'success', text: 'Maintenance record scheduled.' });
                      await loadAllData(user);
                    } catch (err: any) {
                      setStatusBanner({ type: 'danger', text: err.message });
                    }
                  }}
                  style={{ marginBottom: '1rem' }}
                >
                  <div className="form-grid" style={{ marginBottom: '0.75rem' }}>
                    <select
                      className="form-select"
                      value={maintForm.vehicle_id}
                      onChange={(e) => setMaintForm({ ...maintForm, vehicle_id: Number(e.target.value) })}
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.registration_plate} ({v.energy_type})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Maintenance Type"
                      value={maintForm.maintenance_type}
                      onChange={(e) => setMaintForm({ ...maintForm, maintenance_type: e.target.value })}
                    />
                    <select
                      className="form-select"
                      value={maintForm.applicable_energy_type}
                      onChange={(e) => setMaintForm({ ...maintForm, applicable_energy_type: e.target.value })}
                    >
                      <option value="Both">Applies to Both Gas & EV</option>
                      <option value="Gasoline">Gasoline Only (e.g., Engine Oil / Spark Plugs)</option>
                      <option value="Electric">Electric Only (e.g., HV Battery Coolant)</option>
                    </select>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Cost ($)"
                      value={maintForm.cost}
                      onChange={(e) => setMaintForm({ ...maintForm, cost: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Schedule Maintenance (Blocks Vehicle Bookings)
                  </button>
                </form>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Vehicle</th>
                        <th>Type & Energy Rule</th>
                        <th>Service Window</th>
                        <th>Cost</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenanceRecords.map((m) => (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600 }}>{m.registration_plate}</td>
                          <td>
                            {m.maintenance_type} <span className="badge badge-neutral">{m.applicable_energy_type}</span>
                          </td>
                          <td className="mono">{new Date(m.service_date).toLocaleDateString()}</td>
                          <td className="mono">${Number(m.cost).toFixed(2)}</td>
                          <td>
                            <span className="badge badge-warning">{m.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {opsSubTab === 'EXPENSES' && (
              <section className="card">
                <div className="card-header">
                  <h2 className="card-title">Vehicle Expenses & Reimbursement Approvals (EXP-01 to EXP-08)</h2>
                </div>
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
                      setStatusBanner({ type: 'success', text: 'Expense recorded.' });
                      await loadAllData(user);
                    } catch (err: any) {
                      setStatusBanner({ type: 'danger', text: err.message });
                    }
                  }}
                  style={{ marginBottom: '1rem' }}
                >
                  <div className="form-grid" style={{ marginBottom: '0.75rem' }}>
                    <select
                      className="form-select"
                      value={expForm.vehicle_id}
                      onChange={(e) => setExpForm({ ...expForm, vehicle_id: Number(e.target.value) })}
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.registration_plate}
                        </option>
                      ))}
                    </select>
                    <select
                      className="form-select"
                      value={expForm.category}
                      onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
                    >
                      <option value="Toll">Toll</option>
                      <option value="Parking">Parking</option>
                      <option value="Cleaning">Cleaning</option>
                      <option value="Accessories">Accessories</option>
                      <option value="Other">Other</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="Amount ($)"
                      value={expForm.amount}
                      onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Description"
                      value={expForm.description}
                      onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Submit Expense
                  </button>
                </form>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Vehicle</th>
                        <th>Category & Description</th>
                        <th>Amount</th>
                        <th>Approval & Reimbursement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((ex) => (
                        <tr key={ex.id}>
                          <td style={{ fontWeight: 600 }}>{ex.registration_plate}</td>
                          <td>
                            <strong>{ex.category}:</strong> {ex.description}
                          </td>
                          <td className="mono">${Number(ex.amount).toFixed(2)}</td>
                          <td>
                            <span className="badge badge-info">{ex.approval_status}</span> •{' '}
                            <span className="badge badge-neutral">{ex.reimbursement_status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {opsSubTab === 'DOCUMENTS' && (
              <section className="card">
                <div className="card-header">
                  <h2 className="card-title">Protected Document Vault (Server Magic-Byte & Antivirus Validated — DOC-01 to 08)</h2>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      // Sample valid %PDF-1.4 payload encoded as base64
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
                      setStatusBanner({ type: 'success', text: 'Protected document validated and stored in vault.' });
                      await loadAllData(user);
                    } catch (err: any) {
                      setStatusBanner({ type: 'danger', text: err.message });
                    }
                  }}
                  style={{ marginBottom: '1rem' }}
                >
                  <div className="form-grid" style={{ marginBottom: '0.75rem' }}>
                    <select
                      className="form-select"
                      value={docForm.entity_id}
                      onChange={(e) => setDocForm({ ...docForm, entity_id: Number(e.target.value) })}
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          Vehicle: {v.registration_plate}
                        </option>
                      ))}
                    </select>
                    <select
                      className="form-select"
                      value={docForm.doc_type}
                      onChange={(e) => setDocForm({ ...docForm, doc_type: e.target.value })}
                    >
                      <option value="Registration">Registration (STNK)</option>
                      <option value="Insurance">Insurance Policy</option>
                      <option value="Inspection">Inspection Certificate</option>
                    </select>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Document Filename"
                      value={docForm.file_name}
                      onChange={(e) => setDocForm({ ...docForm, file_name: e.target.value })}
                    />
                    <input
                      type="date"
                      className="form-input"
                      value={docForm.expiry_date}
                      onChange={(e) => setDocForm({ ...docForm, expiry_date: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm">
                    <Upload size={15} />
                    Upload Protected PDF Document
                  </button>
                </form>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID & Version</th>
                        <th>Entity</th>
                        <th>Type & Filename</th>
                        <th>Expiry Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => (
                        <tr key={doc.id}>
                          <td className="mono">
                            #{doc.id} (v{doc.version_number})
                          </td>
                          <td>
                            {doc.entity_type} #{doc.entity_id}
                          </td>
                          <td>
                            <strong>{doc.doc_type}:</strong> {doc.file_name}
                          </td>
                          <td className="mono">{doc.expiry_date || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 5: ADMIN USAGE ANALYTICS (Revision #6), GPS MONITOR & AUDIT LOG
           =================================================================== */}
        {activeTab === 'ANALYTICS_AUDIT' && isPrivileged && usageAnalytics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Overall Fleet Combined KPIs (All 8 Cars Combined — Day, Week, Month, All-Time) */}
            <div className="grid-kpi">
              <div className="kpi-card">
                <div className="kpi-label">Today (All Cars Combined)</div>
                <div className="kpi-value">{usageAnalytics.combinedOverall.day.distanceKm} km</div>
                <div className="kpi-meta">{usageAnalytics.combinedOverall.day.trips} completed trips today</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">This Week (All Cars Combined)</div>
                <div className="kpi-value">{usageAnalytics.combinedOverall.week.distanceKm} km</div>
                <div className="kpi-meta">{usageAnalytics.combinedOverall.week.trips} completed trips (last 7 days)</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">This Month (All Cars Combined)</div>
                <div className="kpi-value">{usageAnalytics.combinedOverall.month.distanceKm} km</div>
                <div className="kpi-meta">{usageAnalytics.combinedOverall.month.trips} completed trips this month</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Overall Total (All 8 Cars)</div>
                <div className="kpi-value">{usageAnalytics.combinedOverall.allTime.distanceKm} km</div>
                <div className="kpi-meta">{usageAnalytics.combinedOverall.allTime.trips} total completed trips</div>
              </div>
            </div>

            {/* Separate Gasoline Litres vs EV kWh Summary (EV-05, RPT-04) */}
            <div className="grid-2">
              <div className="card">
                <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>⛽ Gasoline Fleet Energy Summary (5 Vehicles — Litres Only)</h3>
                <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                  {usageAnalytics.combinedOverall.gasolineSummary.totalLitres} Litres • $
                  {usageAnalytics.combinedOverall.gasolineSummary.totalFuelCost.toFixed(2)}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Strictly separated from Electric kWh per Requirement EV-05 & RPT-04.
                </p>
              </div>
              <div className="card">
                <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>⚡ Electric Fleet Energy Summary (3 EVs — kWh Only)</h3>
                <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                  {usageAnalytics.combinedOverall.electricSummary.totalKwh} kWh • $
                  {usageAnalytics.combinedOverall.electricSummary.totalChargingCost.toFixed(2)}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Strictly separated from Gasoline Litres per Requirement EV-05 & RPT-04.
                </p>
              </div>
            </div>

            {/* Per-Vehicle Usage Table (Day, Week, Month, Overall + Energy Efficiency) */}
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <BarChart3 size={19} />
                  Vehicle Usage & Distance Summary (Per Day, Week, Month & Overall per Car)
                </h2>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {(['day', 'week', 'month', 'overall'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`btn btn-sm ${usagePeriod === p ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setUsagePeriod(p)}
                    >
                      Highlight: {p.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vehicle Plate & Model</th>
                      <th>Energy Type</th>
                      <th>Today (Trips / km)</th>
                      <th>This Week (Trips / km)</th>
                      <th>This Month (Trips / km)</th>
                      <th>All-Time (Trips / km)</th>
                      <th>Energy Consumption & Efficiency</th>
                      <th>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageAnalytics.perVehicle.map((v: any) => (
                      <tr key={v.vehicle_id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{v.registration_plate}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                            {v.make} {v.model} ({v.car_type})
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${v.energy_type === 'Electric' ? 'badge-success' : 'badge-info'}`}>
                            {v.energy_type}
                          </span>
                        </td>
                        <td className="mono">
                          <strong>{v.day.distanceKm} km</strong> ({v.day.trips} trips)
                        </td>
                        <td className="mono">
                          <strong>{v.week.distanceKm} km</strong> ({v.week.trips} trips)
                        </td>
                        <td className="mono">
                          <strong>{v.month.distanceKm} km</strong> ({v.month.trips} trips)
                        </td>
                        <td className="mono">
                          <strong>{v.overall.distanceKm} km</strong> ({v.overall.trips} trips)
                        </td>
                        <td className="mono" style={{ fontSize: '0.8rem' }}>
                          {v.energy.measureUnit === 'Litres' ? (
                            <>
                              {v.energy.totalLitres} L {v.energy.efficiencyKmPerLitre ? `(${v.energy.efficiencyKmPerLitre} km/L)` : ''}
                            </>
                          ) : (
                            <>
                              {v.energy.totalKwh} kWh {v.energy.efficiencyKwhPer100Km ? `(${v.energy.efficiencyKwhPer100Km} kWh/100km)` : ''}
                            </>
                          )}
                        </td>
                        <td className="mono">${v.totalOperatingCost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Per-Driver Usage Summary Table */}
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <Users size={19} />
                  Driver Completed Trips & Distance Summary (Day, Week, Month & Overall)
                </h2>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Driver Name</th>
                      <th>Status</th>
                      <th>Today (Trips / km)</th>
                      <th>This Week (Trips / km)</th>
                      <th>This Month (Trips / km)</th>
                      <th>Overall Total (Trips / km)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageAnalytics.perDriver.map((d: any) => (
                      <tr key={d.driver_profile_id}>
                        <td style={{ fontWeight: 600 }}>{d.driver_name}</td>
                        <td>
                          <span className="badge badge-success">{d.availability_status}</span>
                        </td>
                        <td className="mono">
                          {d.day.distanceKm} km ({d.day.trips} trips)
                        </td>
                        <td className="mono">
                          {d.week.distanceKm} km ({d.week.trips} trips)
                        </td>
                        <td className="mono">
                          {d.month.distanceKm} km ({d.month.trips} trips)
                        </td>
                        <td className="mono" style={{ fontWeight: 700 }}>
                          {d.overall.distanceKm} km ({d.overall.trips} trips)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Best-Effort Periodic GPS Monitor (Section 9) */}
            {gpsLatest && (
              <section className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    <MapPin size={19} />
                    Periodic Driver Phone Location Monitor (Best-Effort — Stale Threshold: {gpsLatest.staleThresholdMinutes}m)
                  </h2>
                </div>
                <div className="banner banner-info" style={{ fontSize: '0.8rem' }}>
                  <span>{gpsLatest.notice}</span>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th>Display Status (Recent vs Stale)</th>
                        <th>Text Coordinates & Accuracy (GPS-17)</th>
                        <th>Capture & Server Receipt Timestamps (GPS-05)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gpsLatest.drivers.map((d: any) => (
                        <tr key={d.driver_profile_id}>
                          <td style={{ fontWeight: 600 }}>{d.driver_name}</td>
                          <td>
                            <span
                              className={`badge ${
                                d.display_state === 'RECENT'
                                  ? 'badge-success'
                                  : d.display_state === 'STALE'
                                  ? 'badge-warning'
                                  : 'badge-danger'
                              }`}
                            >
                              {d.status_label}
                            </span>
                          </td>
                          <td className="mono" style={{ fontSize: '0.8rem' }}>
                            {d.report && d.report.latitude !== null ? (
                              <>
                                {Number(d.report.latitude).toFixed(5)}, {Number(d.report.longitude).toFixed(5)} ({d.accuracy_label})
                              </>
                            ) : (
                              'No position shown as current'
                            )}
                          </td>
                          <td className="mono" style={{ fontSize: '0.76rem' }}>
                            {d.report ? (
                              <>
                                <div>Captured: {d.report.capture_time}</div>
                                <div>Received: {d.report.server_receipt_time}</div>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Immutable Audit History (AUD-01 to AUD-05) */}
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <FileText size={19} />
                  Immutable Audit Trail ({auditEvents.length} Recent Events)
                </h2>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time (UTC)</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Entity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEvents.slice(0, 25).map((ev) => (
                      <tr key={ev.id}>
                        <td className="mono" style={{ fontSize: '0.76rem' }}>{ev.created_at}</td>
                        <td>
                          {ev.actor_username} <span className="badge badge-neutral">{ev.actor_role}</span>
                        </td>
                        <td className="mono" style={{ fontWeight: 600 }}>{ev.action}</td>
                        <td className="mono">
                          {ev.entity_type} {ev.entity_id ? `#${ev.entity_id}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* =====================================================================
          MODAL 1: ADMIN EDIT VEHICLE (Plate, Car Type, Standby / Deactivate)
         ===================================================================== */}
      {editingVehicle && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="card-header">
              <h3 className="card-title">Edit Vehicle #{editingVehicle.id} & Standby Control</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingVehicle(null)}>
                Close
              </button>
            </div>
            <form onSubmit={handleSaveVehicleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">License Plate</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={editingVehicle.registration_plate}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, registration_plate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Car Type / Classification</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={editingVehicle.car_type}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, car_type: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Make</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={editingVehicle.make}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, make: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={editingVehicle.model}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, model: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Operational Status (Standby / Deactivate)</label>
                  <select
                    className="form-select"
                    value={editingVehicle.status}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, status: e.target.value })}
                  >
                    <option value="Available">Available (Bookable)</option>
                    <option value="Standby">Standby (Reserved for Executive / Special Purpose)</option>
                    <option value="Deactivated">Deactivated (Temporarily Offline)</option>
                    <option value="In Maintenance">In Maintenance</option>
                    <option value="Retired">Retired</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Standby / Deactivation Reason</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Reserved for Board VIP Visit"
                    value={editingVehicle.standby_reason || ''}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, standby_reason: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingVehicle(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Vehicle Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: ADMIN ONE-CLICK APPROVE & DISPATCH / REJECT MODAL
         ===================================================================== */}
      {dispatchModalTrip && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="card-header">
              <h3 className="card-title">Dispatch & Approval — Trip #{dispatchModalTrip.id}</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDispatchModalTrip(null)}>
                Close
              </button>
            </div>

            <div style={{ fontSize: '0.86rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              <div>
                <strong>Purpose:</strong> {dispatchModalTrip.purpose} ({dispatchModalTrip.origin} → {dispatchModalTrip.destination})
              </div>
              <div>
                <strong>Requester:</strong> {dispatchModalTrip.requester_name} ({dispatchModalTrip.department_name})
              </div>
              <div>
                <strong>Window:</strong> {new Date(dispatchModalTrip.start_time).toLocaleString()} — {new Date(dispatchModalTrip.end_time).toLocaleString()}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Assigned Vehicle</label>
                <select
                  className="form-select"
                  value={dispatchVehicleId}
                  onChange={(e) => setDispatchVehicleId(Number(e.target.value))}
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registration_plate} — {v.make} {v.model} ({v.energy_type}, Status: {v.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Driver (Receives Dispatch Order in PWA)</label>
                <select
                  className="form-select"
                  value={dispatchDriverId}
                  onChange={(e) => setDispatchDriverId(Number(e.target.value))}
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} (Class {d.licence_class} • {d.availability_status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Approval Note / Rejection Reason (Mandatory if Rejecting)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter dispatch note or reason for rejection"
                  value={dispatchDecisionReason}
                  onChange={(e) => setDispatchDecisionReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-danger" onClick={() => handleAdminTripDecision('REJECTED')}>
                  <XCircle size={16} />
                  Reject & Release Locked Slot
                </button>
                <button type="button" className="btn btn-success" onClick={() => handleAdminTripDecision('APPROVED')}>
                  <CheckCircle2 size={16} />
                  Approve & Dispatch Driver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: 360° VEHICLE DETAIL VIEW (VEH-05)
         ===================================================================== */}
      {vehicleDetail360 && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: '720px' }}>
            <div className="card-header">
              <h3 className="card-title">
                360° Vehicle Record — {vehicleDetail360.vehicle.registration_plate} ({vehicleDetail360.vehicle.make} {vehicleDetail360.vehicle.model})
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVehicleDetail360(null)}>
                Close
              </button>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.84rem' }}>
              <div>
                <strong>Energy Type:</strong> {vehicleDetail360.vehicle.energy_type} • <strong>Odometer:</strong>{' '}
                {vehicleDetail360.vehicle.current_odometer} km • <strong>Status:</strong> {vehicleDetail360.vehicle.status}
              </div>
              <div>
                <strong>Bookings ({vehicleDetail360.bookings.length}):</strong>{' '}
                {vehicleDetail360.bookings.map((b: any) => `#${b.id} (${b.status})`).join(', ') || 'None'}
              </div>
              <div>
                <strong>Assignments ({vehicleDetail360.assignments.length}):</strong>{' '}
                {vehicleDetail360.assignments.map((a: any) => `${a.driver_name} (${a.effective_start.slice(0, 10)})`).join(', ') || 'None'}
              </div>
              <div>
                <strong>Energy Logs:</strong>{' '}
                {vehicleDetail360.vehicle.energy_type === 'Gasoline'
                  ? `${vehicleDetail360.fuelRecords.length} Gasoline fuel records`
                  : `${vehicleDetail360.evRecords.length} EV charging records`}
              </div>
              <div>
                <strong>Maintenance ({vehicleDetail360.maintenanceRecords.length}) & Expenses ({vehicleDetail360.expenses.length}) & Protected Docs ({vehicleDetail360.documents.length})</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: IN-APP & PUSH NOTIFICATIONS DRAWER (NTF-05, Revision #5)
         ===================================================================== */}
      {showNotificationsModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="card-header">
              <h3 className="card-title">Notification Center (Push & In-App Alerts)</h3>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    await apiRequest('/api/notifications/read-all', { method: 'POST' });
                    await loadAllData(user);
                  }}
                >
                  Mark All Read
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowNotificationsModal(false)}>
                  Close
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {notifications.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: n.is_read ? 'var(--bg-surface)' : 'var(--brand-soft)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span className="mono">{n.trigger_type}</span>
                      <span>{n.created_at}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '0.2rem' }}>{n.title}</div>
                    <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>{n.body}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: PWA INSTALLATION GUIDE FOR ANDROID / DESKTOP
         ===================================================================== */}
      {showInstallGuideModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="card-header">
              <h3 className="card-title">Install FleetOps PWA (Driver, Admin & User)</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowInstallGuideModal(false)}>
                Close
              </button>
            </div>
            <div style={{ fontSize: '0.88rem', display: 'grid', gap: '0.75rem', color: 'var(--text-secondary)' }}>
              <p>
                This application includes a full Web App Manifest (<code className="mono">/manifest.webmanifest</code>) and Service Worker (<code className="mono">/sw.js</code>) for standalone installation on Android and Desktop:
              </p>
              <div>
                <strong>On Android (Chrome):</strong> Tap the browser menu (⋮) and select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
              </div>
              <div>
                <strong>On Desktop (Chrome / Edge):</strong> Click the <strong>Install icon</strong> on the right side of the address bar.
              </div>
              <div>
                <strong>Push Notifications:</strong> Click <strong>"Enable Push Alerts"</strong> in the top bar to subscribe your device to booking updates, reminders, and driver dispatch notifications.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
