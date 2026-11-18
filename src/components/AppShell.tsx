import React from 'react';
import {
  Home,
  Clock,
  Inbox,
  User,
  Navigation,
  ShieldCheck,
  Menu,
  LogOut,
  Car,
  FileCheck,
  BarChart3,
  Map,
  ScrollText,
} from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { DisplayModeToggle } from './DisplayModeToggle';
import { SamsungBusLogo } from './SamsungBusLogo';
import { useAppLanguage } from '../utils/i18n';


export type NavSection = 'HOME' | 'ACTIVITY' | 'INBOX' | 'PROFILE' | 'DRIVER' | 'ADMIN';
export type AdminModule = 'FLEET_MAP' | 'ADMIN_DISPATCH' | 'FLEET_OPS' | 'ANALYTICS_REPORT' | 'AUDIT';

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export interface EmbeddedTopNavProps {
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  unreadInboxCount: number;
  pendingDispatchCount?: number;
  isDriverOrPrivileged?: boolean;
  isPrivileged?: boolean;
  isDriverOnly?: boolean;
  onSignOut: () => void;
  userNickname?: string;
  departmentName?: string;
  userRole?: string;
  onOpenProfile?: () => void;
  onSwitchToDriverDispatch?: () => void;
  onSwitchToAdmin?: () => void;
}

export const EmbeddedTopNav: React.FC<EmbeddedTopNavProps> = ({
  activeNav,
  onSelectNav,
  unreadInboxCount,
  pendingDispatchCount = 0,
  isDriverOrPrivileged,
  isPrivileged,
  isDriverOnly = false,
  onSignOut,
  userNickname,
  departmentName,
  userRole,
  onOpenProfile,
  onSwitchToDriverDispatch,
  onSwitchToAdmin,
}) => {
  const navItems = isDriverOnly
    ? [
        { id: 'DRIVER' as const, label: 'Home', icon: <Car size={17} />, badge: pendingDispatchCount },
        { id: 'ACTIVITY' as const, label: 'Trip Log', icon: <Clock size={17} /> },
        { id: 'INBOX' as const, label: 'Messages', icon: <Inbox size={17} />, badge: unreadInboxCount },
        { id: 'PROFILE' as const, label: 'Account', icon: <User size={17} /> },
      ]
    : [
        { id: 'HOME' as const, label: 'Home', icon: <Home size={17} /> },
        { id: 'ACTIVITY' as const, label: 'Activity', icon: <Clock size={17} /> },
        { id: 'INBOX' as const, label: 'Inbox', icon: <Inbox size={17} />, badge: unreadInboxCount },
        { id: 'PROFILE' as const, label: 'Profile', icon: <User size={17} /> },
        ...(isDriverOrPrivileged ? [{ id: 'DRIVER' as const, label: 'Dispatch', icon: <Navigation size={17} />, badge: pendingDispatchCount }] : []),
        ...(isPrivileged ? [{ id: 'ADMIN' as const, label: 'Admin', icon: <ShieldCheck size={17} /> }] : []),
      ];

  const { t } = useAppLanguage();

  const handleSelectTab = (id: NavSection) => {
    if (id === 'DRIVER' && onSwitchToDriverDispatch) {
      onSwitchToDriverDispatch();
    } else if (id === 'ADMIN' && onSwitchToAdmin) {
      onSwitchToAdmin();
    } else {
      onSelectNav(id);
    }
  };

  return (
    <header className="gf-embedded-topbar" role="banner">
      {/* Left: Brand Identity & Group */}
      <div className="gf-topbar-left">
        <div className="gf-topbar-logo" title="GalaxyFleet">
          <SamsungBusLogo size={36} />
        </div>
        <div className="gf-topbar-brand-meta">
          <span className="gf-topbar-title">GalaxyFleet</span>
          {(userNickname || departmentName) && (
            <span className="gf-topbar-dept">
              {userNickname} {departmentName ? <span>• <span className="notranslate" translate="no">{departmentName}</span></span> : ''}
            </span>
          )}
        </div>
      </div>

      {/* Center: Navigation Pills (Desktop & Tablet) */}
      <nav className="gf-topbar-nav" aria-label="Main application tabs">
        {navItems.map((item) => {
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              id={`topbar-nav-${item.id.toLowerCase()}`}
              className={`gf-topbar-nav-pill pressable ${active ? 'active' : ''}`}
              onClick={() => handleSelectTab(item.id)}
              aria-current={active ? 'page' : undefined}
            >
              {item.icon}
              <span>{t(item.label)}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="gf-nav-badge">{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right: Dedicated Language Switcher + User Role Badge + Sign Out (Ample room, no cut-off) */}
      <div className="gf-topbar-right">
        <DisplayModeToggle variant="compact" id="topbar-display-mode-toggle" />
        <div className="gf-topbar-lang-wrap">
          <LanguageSwitcher compact={false} />
        </div>

        {onOpenProfile && (
          <button
            type="button"
            id="topbar-profile-btn"
            className="gf-btn gf-btn-secondary pressable"
            onClick={onOpenProfile}
            style={{ fontSize: '13px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}
            title={t('My Profile & Change Password')}
          >
            <User size={15} color="#0072de" />
            <span style={{ fontWeight: 700 }}>{userNickname || t('Profile')}</span>
          </button>
        )}

        {userRole && (
          <div className="gf-topbar-role-badge" title={`Role: ${userRole}`}>
            {userRole}
          </div>
        )}

        <button
          type="button"
          id="topbar-signout-btn"
          className="gf-topbar-signout-btn pressable"
          onClick={onSignOut}
          aria-label={t('Sign Out')}
          title={t('Sign Out')}
        >
          <LogOut size={16} />
          <span className="gf-topbar-btn-text">{t('Sign Out')}</span>
        </button>
      </div>
    </header>
  );
};

// Backward-compatible alias for any residual references
export const DynamicIslandNav = EmbeddedTopNav;

interface AppShellProps {
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  onSignOut: () => void;
  hideChromeDuringBooking: boolean;
  isDriverOrPrivileged: boolean;
  isPrivileged: boolean;
  isDriverOnly?: boolean;
  unreadInboxCount: number;
  pendingDispatchCount: number;
  pendingAdminCount: number;
  mapStage: React.ReactNode;
  sheet: React.ReactNode;
  userNickname?: string;
  departmentName?: string;
  userRole?: string;
  onOpenProfile?: () => void;
  onSwitchToDriverDispatch?: () => void;
  onSwitchToAdmin?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeNav,
  onSelectNav,
  onSignOut,
  hideChromeDuringBooking,
  isDriverOrPrivileged,
  isPrivileged,
  isDriverOnly = false,
  unreadInboxCount,
  pendingDispatchCount,
  mapStage,
  sheet,
  userNickname,
  departmentName,
  userRole,
  onOpenProfile,
  onSwitchToDriverDispatch,
  onSwitchToAdmin,
}) => {
  const { t } = useAppLanguage();

  const navItems: NavItem[] = isDriverOnly
    ? [
        { id: 'DRIVER', label: 'Home', icon: <Car size={22} />, badge: pendingDispatchCount },
        { id: 'ACTIVITY', label: 'Trip Log', icon: <Clock size={22} /> },
        { id: 'INBOX', label: 'Messages', icon: <Inbox size={22} />, badge: unreadInboxCount },
        { id: 'PROFILE', label: 'Account', icon: <User size={22} /> },
      ]
    : [
        { id: 'HOME', label: 'Home', icon: <Home size={22} />, },
        { id: 'ACTIVITY', label: 'Activity', icon: <Clock size={22} /> },
        { id: 'INBOX', label: 'Inbox', icon: <Inbox size={22} />, badge: unreadInboxCount },
        { id: 'PROFILE', label: 'Profile', icon: <User size={22} /> },
      ];

  return (
    <div className="gf-shell">
      {/* Embedded Permanent Top Navbar without clipping or collapse */}
      <EmbeddedTopNav
        activeNav={activeNav}
        onSelectNav={onSelectNav}
        unreadInboxCount={unreadInboxCount}
        pendingDispatchCount={pendingDispatchCount}
        isDriverOrPrivileged={isDriverOrPrivileged}
        isPrivileged={isPrivileged}
        isDriverOnly={isDriverOnly}
        onSignOut={onSignOut}
        userNickname={userNickname}
        departmentName={departmentName}
        userRole={userRole}
        onOpenProfile={onOpenProfile}
        onSwitchToDriverDispatch={onSwitchToDriverDispatch}
        onSwitchToAdmin={onSwitchToAdmin}
      />

      <div className={`gf-ride-layout ${!mapStage ? 'is-no-map' : ''}`}>
        {/* Full-bleed Map Canvas (only rendered during active car booking / driver duty) */}
        {mapStage}

        {/* Adaptive Sheet / Full-Screen Mobile Page */}
        {sheet}

        {/* Mobile Bottom Tab Bar (hidden during active booking or on desktop) */}
        {!hideChromeDuringBooking && (
          <nav className="gf-bottom-nav gf-mobile-bottom-nav" aria-label="Primary mobile tabs">
            {navItems.map((item) => {
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  id={`tab-${item.id.toLowerCase()}`}
                  type="button"
                  className={`gf-nav-item pressable ${active ? 'active' : ''}`}
                  onClick={() => onSelectNav(item.id)}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{t(item.label)}</span>
                  {item.badge !== undefined && item.badge > 0 && <span className="gf-nav-badge">{item.badge}</span>}
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
};

export interface DesktopHeaderNavProps {
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  unreadInboxCount: number;
  isDriverOrPrivileged?: boolean;
  isPrivileged?: boolean;
  isDriverOnly?: boolean;
  onSignOut?: () => void;
  userNickname?: string;
  departmentName?: string;
  onSwitchToDriverDispatch?: () => void;
  onSwitchToAdmin?: () => void;
}

export const DesktopHeaderNav: React.FC<DesktopHeaderNavProps> = ({
  activeNav,
  onSelectNav,
  unreadInboxCount,
  isDriverOrPrivileged,
  isPrivileged,
  isDriverOnly = false,
  onSignOut,
  userNickname,
  departmentName,
  onSwitchToDriverDispatch,
  onSwitchToAdmin,
}) => {
  const { t } = useAppLanguage();

  const items: NavItem[] = isDriverOnly
    ? [
        { id: 'DRIVER', label: 'Home', icon: <Car size={18} /> },
        { id: 'ACTIVITY', label: 'Trip Log', icon: <Clock size={18} /> },
        { id: 'INBOX', label: 'Messages', icon: <Inbox size={18} />, badge: unreadInboxCount },
        { id: 'PROFILE', label: 'Account', icon: <User size={18} /> },
      ]
    : [
        { id: 'HOME', label: 'Home', icon: <Home size={18} /> },
        { id: 'ACTIVITY', label: 'Activity', icon: <Clock size={18} /> },
        { id: 'INBOX', label: 'Inbox', icon: <Inbox size={18} />, badge: unreadInboxCount },
        { id: 'PROFILE', label: 'Profile', icon: <User size={18} /> },
      ];

  if (!isDriverOnly && isDriverOrPrivileged && onSwitchToDriverDispatch) {
    items.push({ id: 'DRIVER', label: 'Dispatch', icon: <Navigation size={18} /> });
  }
  if (isPrivileged && onSwitchToAdmin) {
    items.push({ id: 'ADMIN', label: 'Admin', icon: <ShieldCheck size={18} /> });
  }

  return (
    <div className="gf-desktop-top-nav">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SamsungBusLogo size={34} />
          <div>
            <div className="type-title" style={{ fontSize: '17px', lineHeight: 1.2 }}>
              GalaxyFleet
            </div>
            {(userNickname || departmentName) && (
              <div className="type-caption" style={{ color: 'var(--color-text-secondary)', fontSize: '12.5px' }}>
                {userNickname} {departmentName ? <span>• <span className="notranslate" translate="no">{departmentName}</span></span> : ''}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DisplayModeToggle variant="icon" id="desktop-header-display-mode-toggle" />
          <LanguageSwitcher compact />
          {onSignOut && (
            <button
              id="desktop-header-signout-btn"
              type="button"
              className="gf-btn gf-btn-secondary pressable"
              style={{ minHeight: '34px', padding: '0 10px', fontSize: '13px', color: 'var(--color-status-red-fg)', borderRadius: 'var(--radius-control)' }}
              onClick={onSignOut}
              aria-label={t('Sign Out')}
              title={t('Sign Out')}
            >
              <LogOut size={15} />
              <span>{t('Sign Out')}</span>
            </button>
          )}
        </div>
      </div>

      <nav className="gf-desktop-nav-segmented" aria-label="Desktop panel tabs">
        {items.map((item) => {
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`gf-desktop-nav-pill pressable ${active ? 'active' : ''}`}
              onClick={() => {
                if (item.id === 'DRIVER' && onSwitchToDriverDispatch) {
                  onSwitchToDriverDispatch();
                } else if (item.id === 'ADMIN' && onSwitchToAdmin) {
                  onSwitchToAdmin();
                } else {
                  onSelectNav(item.id);
                }
              }}
              aria-current={active ? 'page' : undefined}
            >
              {item.icon}
              <span>{t(item.label)}</span>
              {item.badge !== undefined && item.badge > 0 && <span className="gf-nav-badge">{item.badge}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export const DesktopPanelNav: React.FC<DesktopHeaderNavProps> = (props) => <DesktopHeaderNav {...props} />;

interface AdminShellProps {
  activeModule: AdminModule;
  onSelectModule: (m: AdminModule) => void;
  onSignOut: () => void;
  pendingCount: number;
  vehicleCount: number;
  groupCount: number;
  userNickname: string;
  userRole: string;
  onOpenProfile?: () => void;
  children: React.ReactNode;
}

export const AdminShell: React.FC<AdminShellProps> = ({
  activeModule,
  onSelectModule,
  onSignOut,
  pendingCount,
  vehicleCount,
  groupCount,
  userNickname,
  userRole,
  onOpenProfile,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { t } = useAppLanguage();

  const navButtons = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* 1. Overall Live Fleet Map */}
      <button
        type="button"
        id="admin-nav-fleet-map"
        className={`gf-btn pressable ${activeModule === 'FLEET_MAP' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
        style={{ justifyContent: 'flex-start', gap: '10px', fontSize: '14px', padding: '12px 14px' }}
        onClick={() => {
          onSelectModule('FLEET_MAP');
          setMobileMenuOpen(false);
        }}
      >
        <Map size={18} />
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 700 }}>{t('Fleet Live Map')}</span>
        <span className="gf-dot-green" title="Live GPS & Pool tracking" />
      </button>

      {/* 2. Approvals & Dispatch */}
      <button
        type="button"
        id="admin-nav-dispatch"
        className={`gf-btn pressable ${activeModule === 'ADMIN_DISPATCH' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
        style={{ justifyContent: 'flex-start', gap: '10px', fontSize: '14px', padding: '12px 14px' }}
        onClick={() => {
          onSelectModule('ADMIN_DISPATCH');
          setMobileMenuOpen(false);
        }}
      >
        <FileCheck size={18} />
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 700 }}>{t('Approvals & Dispatch')}</span>
        {pendingCount > 0 && (
          <span className="gf-badge gf-badge-amber" style={{ fontSize: '12px', padding: '2px 8px' }}>
            {pendingCount}
          </span>
        )}
      </button>

      {/* 3. Fleet, Drivers & Energy */}
      <button
        type="button"
        id="admin-nav-fleet-ops"
        className={`gf-btn pressable ${activeModule === 'FLEET_OPS' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
        style={{ justifyContent: 'flex-start', gap: '10px', fontSize: '14px', padding: '12px 14px' }}
        onClick={() => {
          onSelectModule('FLEET_OPS');
          setMobileMenuOpen(false);
        }}
      >
        <Car size={18} />
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 700 }}>{t('Fleet, Drivers & Energy')}</span>
      </button>

      {/* 4. Usage Analytics & Reports */}
      <button
        type="button"
        id="admin-nav-reports"
        className={`gf-btn pressable ${activeModule === 'ANALYTICS_REPORT' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
        style={{ justifyContent: 'flex-start', gap: '10px', fontSize: '14px', padding: '12px 14px' }}
        onClick={() => {
          onSelectModule('ANALYTICS_REPORT');
          setMobileMenuOpen(false);
        }}
      >
        <BarChart3 size={18} />
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 700 }}>{t('Analytics & Reports (IDR)')}</span>
      </button>

      {/* 5. Dedicated Audit Trail Module */}
      <button
        type="button"
        id="admin-nav-audit"
        className={`gf-btn pressable ${activeModule === 'AUDIT' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
        style={{ justifyContent: 'flex-start', gap: '10px', fontSize: '14px', padding: '12px 14px' }}
        onClick={() => {
          onSelectModule('AUDIT');
          setMobileMenuOpen(false);
        }}
      >
        <ScrollText size={18} />
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 700 }}>{t('Audit Trail')}</span>
      </button>

      <div style={{ borderTop: '1px solid var(--color-divider)', margin: '8px 0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span className="type-caption" style={{ fontWeight: 700 }}>{t('Display Mode')}</span>
        <DisplayModeToggle variant="full" />
      </div>

      <button
        id="admin-sidebar-signout-btn"
        type="button"
        className="gf-btn gf-btn-outline-danger pressable"
        style={{ justifyContent: 'flex-start', gap: '10px', fontSize: '14px', padding: '10px 14px' }}
        onClick={onSignOut}
      >
        <LogOut size={18} /> <span>{t('Sign Out')}</span>
      </button>
    </div>
  );

  return (
    <div className="gf-admin-shell">
      <aside className="gf-admin-sidebar" aria-label="Admin sidebar">
        <div style={{ paddingBottom: '14px', borderBottom: '1px solid var(--color-divider)', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <SamsungBusLogo size={32} />
            <div className="type-title" style={{ fontSize: '18px', fontWeight: 800 }}>
              GalaxyFleet
            </div>
          </div>
          <div
            className="type-caption pressable"
            onClick={onOpenProfile}
            style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', cursor: onOpenProfile ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '5px' }}
            title={t('My Profile & Change Password')}
          >
            <User size={14} color="#0072de" />
            <span>Admin Console • {userNickname} ({userRole})</span>
          </div>
        </div>
        {navButtons}
      </aside>

      <div className="gf-admin-main">
        <header className="gf-admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            <button
              type="button"
              className="gf-icon-btn-48 gf-tablet-only-menu-btn"
              style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' }}
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle admin menu"
            >
              <Menu size={18} />
            </button>
            <div className="gf-admin-mobile-logo" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <SamsungBusLogo size={26} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="type-section gf-admin-topbar-title" style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.2 }}>
                {t('Admin Console')}
              </div>
              <div className="type-caption gf-admin-subtitle-desktop" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {vehicleCount} {t('Operational Vehicles')} • {groupCount} {t('Groups')} • {t('Currency: IDR (Rp)')}
              </div>
            </div>
          </div>

          <div className="gf-admin-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <DisplayModeToggle variant="icon" id="admin-topbar-display-mode-toggle" />
            <div className="gf-topbar-lang-wrap">
              <LanguageSwitcher compact />
            </div>
            {onOpenProfile && (
              <button
                id="admin-topbar-profile-btn"
                type="button"
                className="gf-btn gf-btn-secondary gf-btn-sm pressable gf-admin-action-btn"
                onClick={onOpenProfile}
                style={{ fontSize: '12.5px', padding: '4px 10px', minHeight: '32px', display: 'flex', alignItems: 'center', gap: '5px' }}
                title={t('My Account Profile & Change Password')}
                aria-label={t('Profile')}
              >
                <User size={14} />
                <span className="gf-topbar-btn-text">{t('Profile')}</span>
              </button>
            )}
            <button
              id="admin-topbar-signout-btn"
              type="button"
              className="gf-btn gf-btn-outline-danger gf-btn-sm pressable gf-admin-action-btn"
              onClick={onSignOut}
              style={{ fontSize: '12.5px', padding: '4px 10px', minHeight: '32px' }}
              title={t('Sign Out')}
              aria-label={t('Sign Out')}
            >
              <LogOut size={14} /> <span className="gf-topbar-btn-text">{t('Sign Out')}</span>
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="gf-card-flat" style={{ margin: '10px 12px 0' }}>
            {navButtons}
          </div>
        )}

        <main className="gf-admin-content">{children}</main>

        <nav className="gf-admin-bottom-nav" aria-label="Admin mobile tabs">
          {[
            { id: 'ADMIN_DISPATCH' as const, label: 'Dispatch', icon: <FileCheck size={18} />, badge: pendingCount },
            { id: 'FLEET_MAP' as const, label: 'Map', icon: <Map size={18} /> },
            { id: 'FLEET_OPS' as const, label: 'Fleet', icon: <Car size={18} /> },
            { id: 'ANALYTICS_REPORT' as const, label: 'Reports', icon: <BarChart3 size={18} /> },
            { id: 'AUDIT' as const, label: 'Audit', icon: <ScrollText size={18} /> },
          ].map((tab) => {
            const isActive = activeModule === tab.id;
            return (
              <button
                key={tab.id}
                id={`admin-mobile-tab-${tab.id.toLowerCase()}`}
                type="button"
                className={`gf-admin-bottom-btn pressable ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  onSelectModule(tab.id);
                  setMobileMenuOpen(false);
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.icon}
                <span>{t(tab.label)}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="gf-admin-bottom-badge">{tab.badge}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
