import React from 'react';
import { NavLink } from 'react-router-dom';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Flame, LayoutDashboard, Bell, MapPin, MessageCircle, HeartHandshake, WifiOff, Settings, Bot } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',            label: 'Home',     Icon: LayoutDashboard },
  { to: '/alerts',      label: 'Alerts',   Icon: Bell },
  { to: '/safe-spaces', label: 'Evacuate', Icon: MapPin },
  { to: '/feed',        label: 'Feed',     Icon: MessageCircle },
  { to: '/recovery',    label: 'Support',  Icon: HeartHandshake },
] as const;

export default function Nav() {
  const online = useOnlineStatus();

  return (
    <>
      {!online && (
        <div className="offline-banner" role="alert" aria-live="polite">
          <WifiOff size={13} />
          Offline — showing cached data. Last sync may be stale.
        </div>
      )}
      <nav className="bottom-nav" aria-label="Main navigation">
        <div className="bottom-nav-brand" aria-label="Haven">
          <Flame size={18} />
          Haven
        </div>
        <div className="nav-items">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              aria-label={label}
            >
              <Icon size={20} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </div>
        <div className="nav-status" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', borderLeft: '1px solid var(--c-border-2)', paddingLeft: 'var(--sp-2)', minWidth: 36, alignItems: 'center' }}>
          <NavLink to="/assistant" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} aria-label="AI Assistant" style={{ minHeight: 28, padding: '2px 4px' }}>
            <Bot size={16} strokeWidth={1.8} />
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} aria-label="Settings" style={{ minHeight: 28, padding: '2px 4px' }}>
            <Settings size={16} strokeWidth={1.8} />
          </NavLink>
          <span
            className={`nav-online-dot ${online ? 'online' : 'offline'}`}
            title={online ? 'Online' : 'Offline'}
            aria-label={online ? 'Online' : 'Offline'}
          />
        </div>
      </nav>
    </>
  );
}


