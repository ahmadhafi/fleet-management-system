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
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';

export type NavSection = 'HOME' | 'ACTIVITY' | 'INBOX' | 'PROFILE' | 'DRIVER' | 'ADMIN';

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface AppShellProps {
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  onSignOut: () => void;
  hideChromeDuringBooking: boolean;
  isDriverOrPrivileged: boolean;
  isPrivileged: boolean;
  unreadInboxCount: number;
  pendingDispatchCount: number;
  pendingAdminCount: number;
  mapStage: React.ReactNode;
  sheet: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeNav,
  onSelectNav,
  onSignOut,
  hideChromeDuringBooking,
  isDriverOrPrivileged,
  isPrivileged,
  unreadInboxCount,
  pendingDispatchCount,
  mapStage,
  sheet,
}) => {
  const navItems: NavItem[] = [
    { id: 'HOME', label: 'Home', icon: <Home size={22} /> },
    { id: 'ACTIVITY', label: 'Activity', icon: <Clock size={22} /> },
    { id: 'INBOX', label: 'Inbox', icon: <Inbox size={22} />, badge: unreadInboxCount },
    { id: 'PROFILE', label: 'Profile', icon: <User size={22} /> },
  ];

  const [tabletNavCollapsed, setTabletNavCollapsed] = React.useState(false);

  const tabletItems: NavItem[] = [
    ...navItems,
    ...(isDriverOrPrivileged ? [{ id: 'DRIVER' as const, label: 'Dispatch', icon: <Navigation size={20} />, badge: pendingDispatchCount }] : []),
    ...(isPrivileged ? [{ id: 'ADMIN' as const, label: 'Admin', icon: <ShieldCheck size={20} /> }] : []),
  ];

  return (
    <div className="gf-shell">
      <div className="gf-ride-layout">
        {/* Tablet Floating Capsule Navigation (640-1023px) - Collapsible to maximize map view */}
        <nav
          className={`gf-tablet-nav ${hideChromeDuringBooking ? 'is-hidden' : ''}`}
          aria-label="Tablet navigation"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px', paddingRight: '4px' }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'var(--color-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '13px',
                boxShadow: '0 2px 6px rgba(0, 170, 19, 0.35)',
              }}
            >
              GF
            </div>
            {tabletNavCollapsed && (
              <button
                type="button"
                className="gf-tablet-nav-item pressable"
                style={{ padding: '6px 10px', fontSize: '12.5px', gap: '4px' }}
                onClick={() => setTabletNavCollapsed(false)}
                title="Expand navigation menu"
              >
                <span>Menu</span>
                <ChevronDown size={16} />
              </button>
            )}
          </div>
          {!tabletNavCollapsed && (
            <>
              {tabletItems.map((item) => {
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`gf-tablet-nav-item pressable ${active ? 'active' : ''}`}
                    onClick={() => onSelectNav(item.id)}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && <span className="gf-nav-badge">{item.badge}</span>}
                  </button>
                );
              })}
              <div style={{ width: '1px', height: '22px', background: 'var(--color-divider)', margin: '0 4px' }} />
              <LanguageSwitcher compact />
              <button
                type="button"
                className="gf-tablet-nav-item pressable"
                style={{ color: 'var(--color-status-red-fg)', padding: '8px 12px' }}
                onClick={onSignOut}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
              <button
                type="button"
                className="gf-tablet-nav-item pressable"
                style={{ padding: '6px 8px', color: 'var(--color-text-muted)' }}
                onClick={() => setTabletNavCollapsed(true)}
                title="Collapse navbar to see full map"
                aria-label="Collapse navbar"
              >
                <ChevronUp size={16} />
              </button>
            </>
          )}
        </nav>

        {/* Full-bleed Map Canvas */}
        {mapStage}

        {/* Adaptive Sheet / Tablet Floating Card / Desktop 440px Left Panel */}
        {sheet}

        {/* Mobile Bottom Tab Bar (68px Dock with soft pill indicator, hidden during active booking) */}
        {!hideChromeDuringBooking && (
          <nav className="gf-bottom-nav" aria-label="Primary tabs">
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
                  <span>{item.label}</span>
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
  onSignOut,
  userNickname,
  departmentName,
  onSwitchToDriverDispatch,
  onSwitchToAdmin,
}) => {
  const [navPillsCollapsed, setNavPillsCollapsed] = React.useState(false);
  const items: NavItem[] = [
    { id: 'HOME', label: 'Home', icon: <Home size={18} /> },
    { id: 'ACTIVITY', label: 'Activity', icon: <Clock size={18} /> },
    { id: 'INBOX', label: 'Inbox', icon: <Inbox size={18} />, badge: unreadInboxCount },
    { id: 'PROFILE', label: 'Profile', icon: <User size={18} /> },
  ];

  if (isDriverOrPrivileged && onSwitchToDriverDispatch) {
    items.push({ id: 'DRIVER', label: 'Dispatch', icon: <Navigation size={18} /> });
  }
  if (isPrivileged && onSwitchToAdmin) {
    items.push({ id: 'ADMIN', label: 'Admin', icon: <ShieldCheck size={18} /> });
  }

  return (
    <div className="gf-desktop-top-nav">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--color-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '15px',
              boxShadow: '0 2px 6px rgba(0, 170, 19, 0.35)',
            }}
          >
            GF
          </div>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <LanguageSwitcher compact />
          {onSignOut && (
            <button
              id="desktop-header-signout-btn"
              type="button"
              className="gf-btn gf-btn-secondary pressable"
              style={{ minHeight: '34px', padding: '0 10px', fontSize: '13px', color: 'var(--color-status-red-fg)', borderRadius: 'var(--radius-control)' }}
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          )}
          <button
            type="button"
            className="gf-btn gf-btn-secondary pressable"
            style={{ minHeight: '34px', padding: '0 8px', borderRadius: 'var(--radius-control)' }}
            onClick={() => setNavPillsCollapsed((c) => !c)}
            title={navPillsCollapsed ? 'Expand navigation tabs' : 'Collapse navigation tabs to see more map'}
            aria-label="Toggle navigation tabs visibility"
          >
            {navPillsCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {!navPillsCollapsed && (
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
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && <span className="gf-nav-badge">{item.badge}</span>}
            </button>
          );
        })}
      </nav>
      )}
    </div>
  );
};

export const DesktopPanelNav: React.FC<DesktopHeaderNavProps> = (props) => <DesktopHeaderNav {...props} />;

interface AdminShellProps {
  activeModule: 'ADMIN_DISPATCH' | 'FLEET_OPS' | 'ANALYTICS_AUDIT';
  onSelectModule: (m: 'ADMIN_DISPATCH' | 'FLEET_OPS' | 'ANALYTICS_AUDIT') => void;
  onSwitchToRideBooking: () => void;
  onSwitchToDriverDispatch: () => void;
  onSignOut: () => void;
  pendingCount: number;
  vehicleCount: number;
  groupCount: number;
  userNickname: string;
  userRole: string;
  children: React.ReactNode;
}

export const AdminShell: React.FC<AdminShellProps> = ({
  activeModule,
  onSelectModule,
  onSwitchToRideBooking,
  onSwitchToDriverDispatch,
  onSignOut,
  pendingCount,
  vehicleCount,
  groupCount,
  userNickname,
  userRole,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navButtons = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        type="button"
        className={`gf-btn pressable ${activeModule === 'ADMIN_DISPATCH' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
        style={{ justifyContent: 'flex-start', gap: '10px', fontSize: '14.5px', padding: '12px 14px' }}
        onClick={() => {
          onSelectModule('ADMIN_DISPATCH');
          setMobileMenuOpen(false);
        }}
      >
        <FileCheck size={18} />
        <span style={{ flex: 1, textAlign: 'left' }}>Approvals & Dispatch</span>
        {pendingCount > 0 && (
          <span className="gf-badge gf-badge-amber" style={{ fontSize: '12px', padding: '2px 8px' }}>
            {pendingCount}
          </span>
        )}
      </button>
      <button
        type="button"
        className={`gf-btn pressable ${activeModule === 'FLEET_OPS' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
        style={{ justifyContent: 'flex-start', gap: '10px', fontSize: '14.5px', padding: '12px 14px' }}
        onClick={() => {
          onSelectModule('FLEET_OPS');
          setMobileMenuOpen(false);
        }}
      >
        <Car size={18} />
        <span style={{ flex: 1, textAlign: 'left' }}>Fleet, Groups & Energy</span>
      </button>
      <button
        type="button"
        className={`gf-btn pressable ${activeModule === 'ANALYTICS_AUDIT' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
        style={{ justifyContent: 'flex-start', gap: '10px', fontSize: '14.5px', padding: '12px 14px' }}
        onClick={() => {
          onSelectModule('ANALYTICS_AUDIT');
          setMobileMenuOpen(false);
        }}
      >
        <BarChart3 size={18} />
        <span style={{ flex: 1, textAlign: 'left' }}>Usage Analytics & GPS</span>
      </button>

      <div style={{ borderTop: '1px solid var(--color-divider)', margin: '8px 0' }} />

      <button
        type="button"
        className="gf-btn gf-btn-secondary pressable"
        style={{ justifyContent: 'flex-start', gap: '10px', fontSize: '14px', padding: '10px 14px' }}
        onClick={() => {
          onSwitchToRideBooking();
          setMobileMenuOpen(false);
        }}
      >
        <Calendar size={18} />
        <span>Book a Ride (User View)</span>
      </button>
      <button
        type="button"
        className="gf-btn gf-btn-secondary pressable"
        style={{ justifyContent: 'flex-start', gap: '10px', fontSize: '14px', padding: '10px 14px' }}
        onClick={() => {
          onSwitchToDriverDispatch();
          setMobileMenuOpen(false);
        }}
      >
        <Navigation size={18} />
        <span>Driver Dispatch View</span>
      </button>

      <div style={{ borderTop: '1px solid var(--color-divider)', margin: '8px 0' }} />

      <button
        id="admin-sidebar-signout-btn"
        type="button"
        className="gf-btn gf-btn-outline-danger pressable"
        style={{ justifyContent: 'flex-start', gap: '10px', fontSize: '14px', padding: '10px 14px' }}
        onClick={onSignOut}
      >
        <LogOut size={18} /> <span>Sign Out</span>
      </button>
    </div>
  );

  return (
    <div className="gf-admin-shell">
      <aside className="gf-admin-sidebar" aria-label="Admin sidebar">
        <div style={{ paddingBottom: '14px', borderBottom: '1px solid var(--color-divider)', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '6px',
                background: 'var(--color-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: '12px',
              }}
            >
              GF
            </div>
            <div className="type-title" style={{ fontSize: '19px', fontWeight: 800 }}>
              GalaxyFleet
            </div>
          </div>
          <div className="type-caption" style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Admin Console • {userNickname} ({userRole})
          </div>
        </div>
        {navButtons}
      </aside>

      <div className="gf-admin-main">
        <header className="gf-admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className="gf-icon-btn-48 gf-mobile-only-btn"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle admin menu"
            >
              <Menu size={22} />
            </button>
            <div>
              <div className="type-section" style={{ fontSize: '18px', fontWeight: 800 }}>GalaxyFleet Admin Console</div>
              <div className="type-caption" style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {vehicleCount} Vehicles • {groupCount} Groups • Periodic GPS Active
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <LanguageSwitcher compact />
            <button
              type="button"
              className="gf-btn gf-btn-primary pressable"
              onClick={onSwitchToRideBooking}
              style={{ fontSize: '14px', padding: '8px 16px' }}
            >
              Open Ride Booking
            </button>
            <button
              id="admin-topbar-signout-btn"
              type="button"
              className="gf-btn gf-btn-outline-danger pressable"
              onClick={onSignOut}
              style={{ fontSize: '14px', padding: '8px 14px' }}
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="gf-card-flat" style={{ margin: '12px 16px 0' }}>
            {navButtons}
          </div>
        )}

        <main className="gf-admin-content">{children}</main>
      </div>
    </div>
  );
};
