import React, { useState } from 'react';
import {
  Bell, MapPin, WifiOff, Moon, PhoneCall, Trash2,
  ChevronRight, User, Shield, Info, Smartphone,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

type Contact = { name: string; phone: string };

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      className={`toggle ${on ? 'on' : ''}`}
      onClick={onToggle}
    />
  );
}

function Row({
  label, sub, children, icon: Icon,
}: {
  label: string;
  sub?: string;
  children?: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="settings-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flex: 1, minWidth: 0 }}>
        {Icon && (
          <div style={{ width: 34, height: 34, borderRadius: 'var(--r-md)', background: 'var(--c-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={16} color="var(--c-muted)" />
          </div>
        )}
        <div>
          <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{label}</div>
          {sub && <div style={{ fontSize: '0.75rem', color: 'var(--c-muted)' }}>{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--sp-5)' }}>
      <div className="section-heading">{title}</div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

export default function Settings() {
  const [notifCritical, setNotifCritical]   = useState(true);
  const [notifHigh, setNotifHigh]           = useState(true);
  const [notifMedium, setNotifMedium]       = useState(false);
  const [notifLow, setNotifLow]             = useState(false);
  const [offlineSync, setOfflineSync]       = useState(true);
  const [locationLive, setLocationLive]     = useState(true);
  const { theme, toggleTheme }              = useTheme();
  const [contacts, setContacts]             = useState<Contact[]>([
    { name: '', phone: '' },
  ]);

  function updateContact(i: number, field: keyof Contact, val: string) {
    setContacts(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  }
  function addContact() {
    setContacts(prev => [...prev, { name: '', phone: '' }]);
  }
  function removeContact(i: number) {
    setContacts(prev => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <h1 className="page-heading">Settings</h1>

      {/* Profile placeholder */}
      <div className="card card-glass" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 'var(--r-full)', background: 'var(--c-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <User size={24} color="var(--c-muted)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>Your Profile</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--c-muted)' }}>Tap to sign in and sync your preferences</div>
        </div>
        <ChevronRight size={18} color="var(--c-muted)" />
      </div>

      {/* Notifications */}
      <Section title="Notifications">
        <Row label="Critical alerts" sub="Full-screen — fires, floods, evacuations" icon={Bell}>
          <Toggle on={notifCritical} onToggle={() => setNotifCritical(v => !v)} />
        </Row>
        <Row label="High-risk alerts" sub="Persistent banner notifications" icon={Bell}>
          <Toggle on={notifHigh} onToggle={() => setNotifHigh(v => !v)} />
        </Row>
        <Row label="Medium caution" sub="Toast notifications" icon={Bell}>
          <Toggle on={notifMedium} onToggle={() => setNotifMedium(v => !v)} />
        </Row>
        <Row label="Low / informational" sub="Feed updates only" icon={Bell}>
          <Toggle on={notifLow} onToggle={() => setNotifLow(v => !v)} />
        </Row>
      </Section>

      {/* Location & offline */}
      <Section title="Location & offline">
        <Row label="Live location tracking" sub="Improves alert relevance & ETA estimates" icon={MapPin}>
          <Toggle on={locationLive} onToggle={() => setLocationLive(v => !v)} />
        </Row>
        <Row label="Offline sync" sub="Cache alerts, spaces & feed for no-connection use" icon={WifiOff}>
          <Toggle on={offlineSync} onToggle={() => setOfflineSync(v => !v)} />
        </Row>
      </Section>

      {/* Emergency contacts */}
      <Section title="Emergency contacts">
        {contacts.map((c, i) => (
          <div key={i} style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--c-border)', display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <PhoneCall size={16} color="var(--c-muted)" style={{ flexShrink: 0 }} />
            <input
              className="input"
              value={c.name}
              onChange={e => updateContact(i, 'name', e.target.value)}
              placeholder="Name"
              style={{ flex: 1, marginRight: 'var(--sp-2)' }}
            />
            <input
              className="input"
              value={c.phone}
              onChange={e => updateContact(i, 'phone', e.target.value)}
              placeholder="Phone"
              type="tel"
              style={{ flex: 1 }}
            />
            {contacts.length > 1 && (
              <button className="btn btn-ghost btn-sm" onClick={() => removeContact(i)} aria-label="Remove contact">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
        <div style={{ padding: 'var(--sp-2) var(--sp-4)' }}>
          <button className="btn btn-ghost btn-sm" onClick={addContact}>
            + Add contact
          </button>
        </div>
      </Section>

      {/* Accessibility */}
      <Section title="Accessibility & display">
        <Row label="Dark mode" sub="Switch between dark and light theme" icon={Moon}>
          <Toggle on={theme === 'dark'} onToggle={toggleTheme} />
        </Row>
        <Row label="Reduced motion" sub="Controlled by system preference" icon={Smartphone}>
          <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>System</span>
        </Row>
      </Section>

      {/* About */}
      <Section title="About">
        <Row label="Privacy policy" icon={Shield}>
          <ChevronRight size={16} color="var(--c-muted)" />
        </Row>
        <Row label="App version" sub="Haven v1.0.0" icon={Info}>
          <span style={{ fontSize: '0.8rem', color: 'var(--c-muted)' }}>v1.0.0</span>
        </Row>
      </Section>
    </div>
  );
}
