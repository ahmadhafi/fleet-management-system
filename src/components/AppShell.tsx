import React from 'react';
import { Home, Clock, Inbox, User, Navigation, ShieldCheck, Menu } from 'lucide-react';

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
  hideChromeDuringBooking,
  isDriverOrPrivileged,
  isPrivileged,
  unreadInboxCount,
  pendingDispatchCount,
  mapStage,
  sheet,
}) => {
  const navItems: NavItem[] = [
    { id: 'HOME', label: 'Home', icon: <Home size={20} /> },
    { id: 'ACTIVITY', label: 'Activity', icon: <Clock size={20} /> },
    { id: 'INBOX', label: 'Inbox', icon: <Inbox size={20} />, badge: unreadInboxCount },
    { id: 'PROFILE', label: 'Profile', icon: <User size={20} /> },
  ];

  // Driver shortcut stays accessible from Left Rail / Profile without cluttering the 4-tab booking bar
  const tabletRailItems: NavItem[] = [
    ...navItems,
    ...(isDriverOrPrivileged ? [{ id: 'DRIVER' as const, label: 'Dispatch', icon: <Navigation size={20} />, badge: pendingDispatchCount }] : []),
    ...(isPrivileged ? [{ id: 'ADMIN' as const, label: 'Admin', icon: <ShieldCheck size={20} /> }] : []),
  ];

  return (
    <div className="gf-shell">
      <div className={`gf-ride-layout ${!hideChromeDuringBooking ? 'has-rail' : ''}`}>
        {/* Tablet Slim Left Rail (640-1023px) */}
        <aside className={`gf-left-rail ${hideChromeDuringBooking ? 'is-hidden' : ''}`} aria-label="Main navigation">
          {tabletRailItems.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`gf-nav-item pressable ${active ? 'active' : ''}`}
                style={{ width: '100%', borderRadius: 'var(--radius-control)' }}
                onClick={() => onSelectNav(item.id)}
                aria-current={active ? 'page' : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && <span className="gf-nav-badge">{item.badge}</span>}
              </button>
            );
          })}
        </aside>

        {/* Full-bleed Map Canvas */}
        {mapStage}

        {/* Adaptive Sheet / Tablet Floating Card / Desktop 420px Left Panel */}
        {sheet}

        {/* Mobile Bottom Tab Bar (Hidden during booking flow as in ride-hailing apps) */}
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

interface DesktopPanelNavProps {
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  unreadInboxCount: number;
}

export const DesktopPanelNav: React.FC<DesktopPanelNavProps> = ({ activeNav, onSelectNav, unreadInboxCount }) => {
  const items: NavItem[] = [
    { id: 'HOME', label: 'Home', icon: <Home size={18} /> },
    { id: 'ACTIVITY', label: 'Activity', icon: <Clock size={18} /> },
    { id: 'INBOX', label: 'Inbox', icon: <Inbox size={18} />, badge: unreadInboxCount },
    { id: 'PROFILE', label: 'Profile', icon: <User size={18} /> },
  ];

  return (
    <nav className="gf-desktop-panel-nav" aria-label="Desktop panel tabs">
      {items.map((item) => {
        const active = activeNav === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`gf-nav-item pressable ${active ? 'active' : ''}`}
            style={{ height: '60px' }}
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
  );
};

interface AdminShellProps {
  activeModule: 'ADMIN_DISPATCH' | 'FLEET_OPS' | 'ANALYTICS_AUDIT';
  onSelectModule: (m: 'ADMIN_DISPATCH' | 'FLEET_OPS' | 'ANALYTICS_AUDIT') => void;
  onSwitchToRideBooking: () => void;
  onSwitchToDriverDispatch: () => void;
  pendingCount: number;
  userNickname: string;
  userRole: string;
  children: React.ReactNode;
}

export const AdminShell: React.FC<AdminShellProps> = ({
  activeModule,
  onSelectModule,
  onSwitchToRideBooking,
  onSwitchToDriverDispatch,
  pendingCount,
  userNickname,
  userRole,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navButtons = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <button
        type="button"
        className={`gf-btn pressable ${activeModule === 'ADMIN_DISPATCH' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
        style={{ justifyContent: 'flex-start' }}
        onClick={() => {
          onSelectModule('ADMIN_DISPATCH');
          setMobileMenuOpen(false);
        }}
      >
        Approvals & Dispatch ({pendingCount})
      </button>
      <button
        type="button"
        className={`gf-btn pressable ${activeModule === 'FLEET_OPS' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
        style={{ justifyContent: 'flex-start' }}
        onClick={() => {
          onSelectModule('FLEET_OPS');
          setMobileMenuOpen(false);
        }}
      >
        Fleet, Standby & Energy
      </button>
      <button
        type="button"
        className={`gf-btn pressable ${activeModule === 'ANALYTICS_AUDIT' ? 'gf-btn-primary' : 'gf-btn-secondary'}`}
        style={{ justifyContent: 'flex-start' }}
        onClick={() => {
          onSelectModule('ANALYTICS_AUDIT');
          setMobileMenuOpen(false);
        }}
      >
        Usage Analytics & GPS
      </button>

      <div style={{ borderTop: '1px solid var(--color-divider)', margin: '8px 0' }} />

      <button
        type="button"
        className="gf-btn gf-btn-secondary pressable"
        style={{ justifyContent: 'flex-start' }}
        onClick={() => {
          onSwitchToRideBooking();
          setMobileMenuOpen(false);
        }}
      >
        Book a Ride (User View)
      </button>
      <button
        type="button"
        className="gf-btn gf-btn-secondary pressable"
        style={{ justifyContent: 'flex-start' }}
        onClick={() => {
          onSwitchToDriverDispatch();
          setMobileMenuOpen(false);
        }}
      >
        Driver Dispatch View
      </button>
    </div>
  );

  return (
    <div className="gf-admin-shell">
      <aside className="gf-admin-sidebar" aria-label="Admin sidebar">
        <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--color-divider)', marginBottom: '6px' }}>
          <div className="type-title" style={{ fontSize: '18px' }}>
            GalaxyFleet
          </div>
          <div className="type-caption">
            Admin Console • {userNickname} ({userRole})
          </div>
        </div>
        {navButtons}
      </aside>

      <div className="gf-admin-main">
        <header className="gf-admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="gf-icon-btn-48 gf-mobile-only-btn"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle admin menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <div className="type-section">GalaxyFleet Admin Console</div>
              <div className="type-caption">8 Vehicles • 9 Departments • Periodic GPS</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" className="gf-btn gf-btn-primary" onClick={onSwitchToRideBooking}>
              Open Ride Booking
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
