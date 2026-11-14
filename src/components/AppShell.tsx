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

export interface DynamicIslandNavProps {
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
  onSwitchToDriverDispatch?: () => void;
  onSwitchToAdmin?: () => void;
  hideChromeDuringBooking?: boolean;
}

export const DynamicIslandNav: React.FC<DynamicIslandNavProps> = ({
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
  onSwitchToDriverDispatch,
  onSwitchToAdmin,
  hideChromeDuringBooking,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Close when clicking outside the dynamic island
  React.useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    if (isExpanded) {
      document.addEventListener('pointerdown', handlePointerDown);
      return () => document.removeEventListener('pointerdown', handlePointerDown);
    }
  }, [isExpanded]);

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // For drivers: strictly driver functions only (Dispatch, Activity, Inbox, Profile) - no Home / Book a ride!
  const navItems = isDriverOnly
    ? [
        { id: 'DRIVER' as const, label: 'Dispatch', icon: <Navigation size={17} />, badge: pendingDispatchCount },
        { id: 'ACTIVITY' as const, label: 'Activity', icon: <Clock size={17} /> },
        { id: 'INBOX' as const, label: 'Inbox', icon: <Inbox size={17} />, badge: unreadInboxCount },
        { id: 'PROFILE' as const, label: 'Profile', icon: <User size={17} /> },
      ]
    : [
        { id: 'HOME' as const, label: 'Home', icon: <Home size={17} /> },
        { id: 'ACTIVITY' as const, label: 'Activity', icon: <Clock size={17} /> },
        { id: 'INBOX' as const, label: 'Inbox', icon: <Inbox size={17} />, badge: unreadInboxCount },
        { id: 'PROFILE' as const, label: 'Profile', icon: <User size={17} /> },
        ...(isDriverOrPrivileged ? [{ id: 'DRIVER' as const, label: 'Dispatch', icon: <Navigation size={17} />, badge: pendingDispatchCount }] : []),
        ...(isPrivileged ? [{ id: 'ADMIN' as const, label: 'Admin', icon: <ShieldCheck size={17} /> }] : []),
      ];

  const getActiveLabel = () => {
    switch (activeNav) {
      case 'HOME': return isDriverOnly ? 'Driver Dispatch' : 'GalaxyFleet';
      case 'ACTIVITY': return 'My Activity';
      case 'INBOX': return 'Inbox';
      case 'PROFILE': return 'Profile';
      case 'DRIVER': return 'Driver Dispatch';
      case 'ADMIN': return 'Admin Console';
      default: return isDriverOnly ? 'Driver Dispatch' : 'GalaxyFleet';
    }
  };

  const handleSelectTab = (id: NavSection) => {
    if (id === 'DRIVER' && onSwitchToDriverDispatch) {
      onSwitchToDriverDispatch();
    } else if (id === 'ADMIN' && onSwitchToAdmin) {
      onSwitchToAdmin();
    } else {
      onSelectNav(id);
    }
    setIsExpanded(false);
  };

  return (
    <div
      ref={containerRef}
      className={`gf-dynamic-island ${isExpanded ? 'is-expanded' : 'is-collapsed'} ${hideChromeDuringBooking ? 'during-booking' : ''}`}
      role="region"
      aria-label="Dynamic Island Navigation"
    >
      {!isExpanded ? (
        /* Collapsed Resting Pill (Centered with dedicated companion language switcher) */
        <div className="gf-island-collapsed-wrapper">
          <button
            type="button"
            id="gf-island-collapsed-pill"
            className="gf-island-collapsed-pill pressable"
            onClick={() => setIsExpanded(true)}
            aria-expanded={false}
            aria-label={`Open GalaxyFleet navigation (Currently on ${getActiveLabel()})`}
            title="Click to expand navigation menu"
          >
            <div className="gf-island-mini-badge">GF</div>
            <div className="gf-island-collapsed-label">
              <span>{getActiveLabel()}</span>
              {unreadInboxCount > 0 && activeNav !== 'INBOX' && (
                <span className="gf-nav-badge" style={{ marginLeft: 6 }}>{unreadInboxCount}</span>
              )}
            </div>
            <div className="gf-island-pulse-dot" title="Live status active" />
            <ChevronDown size={14} className="gf-island-chevron" />
          </button>
          <div className="gf-island-lang-pill">
            <LanguageSwitcher compact darkGlass />
          </div>
        </div>
      ) : (
        /* Expanded Dynamic Island (Inside-out morphing) */
        <div className="gf-island-expanded-content" role="dialog" aria-modal="false" aria-label="Expanded navigation">
          {/* Brand & User context */}
          <div className="gf-island-brand-area">
            <div className="gf-island-badge">GF</div>
            <div className="gf-island-brand-text">
              <span className="gf-island-title">GalaxyFleet</span>
              {(userNickname || departmentName) && (
                <span className="gf-island-subtitle">
                  {userNickname} {departmentName ? <span>• <span className="notranslate" translate="no">{departmentName}</span></span> : ''}
                </span>
              )}
            </div>
          </div>

          {/* Segmented Navigation Pills */}
          <nav className="gf-island-nav" aria-label="Primary navigation">
            {navItems.map((item) => {
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  id={`island-nav-${item.id.toLowerCase()}`}
                  className={`gf-island-nav-item pressable ${active ? 'active' : ''}`}
                  onClick={() => handleSelectTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="gf-nav-badge">{item.badge}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Actions: Dedicated Language, SignOut, Collapse Button */}
          <div className="gf-island-actions">
            <div className="gf-island-lang-wrap">
              <LanguageSwitcher compact darkGlass />
            </div>
            <button
              type="button"
              id="island-signout-btn"
              className="gf-island-action-btn pressable is-signout"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} />
              <span className="gf-island-btn-text">Sign Out</span>
            </button>
            <button
              type="button"
              id="island-collapse-btn"
              className="gf-island-action-btn pressable is-collapse"
              onClick={() => setIsExpanded(false)}
              aria-label="Collapse navigation"
              title="Collapse navigation"
            >
              <ChevronUp size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

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
  onSwitchToDriverDispatch,
  onSwitchToAdmin,
}) => {
  const navItems: NavItem[] = isDriverOnly
    ? [
        { id: 'DRIVER', label: 'Dispatch', icon: <Navigation size={22} />, badge: pendingDispatchCount },
        { id: 'ACTIVITY', label: 'Activity', icon: <Clock size={22} /> },
        { id: 'INBOX', label: 'Inbox', icon: <Inbox size={22} />, badge: unreadInboxCount },
        { id: 'PROFILE', label: 'Profile', icon: <User size={22} /> },
      ]
    : [
        { id: 'HOME', label: 'Home', icon: <Home size={22} /> },
        { id: 'ACTIVITY', label: 'Activity', icon: <Clock size={22} /> },
        { id: 'INBOX', label: 'Inbox', icon: <Inbox size={22} />, badge: unreadInboxCount },
        { id: 'PROFILE', label: 'Profile', icon: <User size={22} /> },
      ];

  return (
    <div className="gf-shell">
      <div className="gf-ride-layout">
        {/* Dynamic Island Centered Top Navigation (iPhone-style Inside-Out Morphing) */}
        <DynamicIslandNav
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
          onSwitchToDriverDispatch={onSwitchToDriverDispatch}
          onSwitchToAdmin={onSwitchToAdmin}
          hideChromeDuringBooking={hideChromeDuringBooking}
        />

        {/* Full-bleed Map Canvas */}
        {mapStage}

        {/* Adaptive Sheet / Tablet Floating Card / Desktop 440px Left Panel */}
        {sheet}

        {/* Mobile Bottom Tab Bar (hidden during active booking) */}
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
  const items: NavItem[] = isDriverOnly
    ? [
        { id: 'DRIVER', label: 'Dispatch', icon: <Navigation size={18} /> },
        { id: 'ACTIVITY', label: 'Activity', icon: <Clock size={18} /> },
        { id: 'INBOX', label: 'Inbox', icon: <Inbox size={18} />, badge: unreadInboxCount },
        { id: 'PROFILE', label: 'Profile', icon: <User size={18} /> },
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              <span>{item.label}</span>
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
