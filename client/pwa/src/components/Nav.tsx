import React from 'react';
import { NavLink } from 'react-router-dom';
import { Flame, LayoutDashboard, Bell, MapPin, MessageCircle, HeartHandshake, Settings, Bot } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const NAV_ITEMS = [
  { to: '/',            label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/alerts',      label: 'Alerts',    Icon: Bell },
  { to: '/safe-spaces', label: 'Evacuate',  Icon: MapPin },
  { to: '/feed',        label: 'Feed',      Icon: MessageCircle },
  { to: '/recovery',    label: 'Support',   Icon: HeartHandshake },
] as const;

export default function Nav() {
  const online = useOnlineStatus();

  return (
    <nav className="side-nav" aria-label="Main navigation">
      <div className="side-nav-brand" aria-label="Haven">
        <Flame size={20} />
        <span>Haven</span>
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
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
      <div className="nav-status">
        <NavLink to="/assistant" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} aria-label="AI Assistant">
          <Bot size={18} strokeWidth={1.8} />
          <span>AI Assistant</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} aria-label="Settings">
          <Settings size={18} strokeWidth={1.8} />
          <span>Settings</span>
        </NavLink>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-3)', fontSize: '0.75rem', color: 'var(--c-muted)' }}>
          <span
            className={`nav-online-dot ${online ? 'online' : 'offline'}`}
            title={online ? 'Online' : 'Offline'}
            aria-label={online ? 'Online' : 'Offline'}
          />
          {online ? 'Online' : 'Offline'}
        </div>
      </div>
    </nav>
  );
}


