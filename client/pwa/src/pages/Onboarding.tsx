import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, MapPin, Bell, WifiOff, ChevronRight, Check, Shield } from 'lucide-react';

const STEPS = [
  {
    key: 'welcome',
    Icon: Flame,
    iconColor: 'var(--c-critical)',
    title: 'Welcome to Haven',
    body: 'Your emergency companion for bushfire preparedness, real-time alerts, and safe evacuation guidance.',
    action: 'Get Started',
    skip: false,
  },
  {
    key: 'location',
    Icon: MapPin,
    iconColor: 'var(--c-info)',
    title: 'Allow Location Access',
    body: 'Haven uses your location to show nearby evacuation centres, active alerts, and real-time risk levels. Location is never stored without your consent.',
    action: 'Enable Location',
    skip: true,
  },
  {
    key: 'notifications',
    Icon: Bell,
    iconColor: 'var(--c-medium)',
    title: 'Stay Alert',
    body: 'Receive critical emergency alerts in under 5 seconds — even when the app is in the background. You can adjust notification preferences at any time.',
    action: 'Enable Notifications',
    skip: true,
  },
  {
    key: 'offline',
    Icon: WifiOff,
    iconColor: 'var(--c-safe)',
    title: 'Works Offline',
    body: 'Haven caches evacuation points, alerts, and your preferences locally. If you lose connectivity during an emergency, the app still works.',
    action: 'Got It',
    skip: false,
  },
] as const;

type StepKey = typeof STEPS[number]['key'];

export default function Onboarding() {
  const [step, setStep]       = useState(0);
  const [done, setDone]       = useState<Set<StepKey>>(new Set());
  const navigate              = useNavigate();
  const current               = STEPS[step];

  async function handleAction() {
    if (current.key === 'location') {
      try { await navigator.geolocation.getCurrentPosition(() => {}); } catch { /* ignored */ }
    }
    if (current.key === 'notifications' && 'Notification' in window) {
      await Notification.requestPermission().catch(() => {});
    }
    setDone(prev => new Set([...prev, current.key]));
    if (step + 1 < STEPS.length) {
      setStep(s => s + 1);
    } else {
      navigate('/');
    }
  }

  function skip() {
    if (step + 1 < STEPS.length) setStep(s => s + 1);
    else navigate('/');
  }

  const { Icon } = current;

  return (
    <div className="onboarding" style={{ paddingBottom: 'var(--sp-8)' }}>
      {/* Progress dots */}
      <div className="step-dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`step-dot ${i === step ? 'active' : ''}`}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Icon */}
      <div className="onboarding-icon">
        <Icon size={38} color={current.iconColor} />
      </div>

      <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: 'var(--sp-3)', lineHeight: 1.2, letterSpacing: '-0.03em' }}>
        {current.title}
      </h1>
      <p style={{ color: 'var(--c-muted)', fontSize: '1rem', lineHeight: 1.65, maxWidth: 360, marginBottom: 'var(--sp-8)' }}>
        {current.body}
      </p>

      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <button className="btn btn-primary btn-lg btn-block" onClick={handleAction}>
          {done.has(current.key) ? <Check size={18} /> : <ChevronRight size={18} />}
          {current.action}
        </button>
        {current.skip && (
          <button className="btn btn-ghost btn-block" onClick={skip}>
            Skip for now
          </button>
        )}
      </div>

      {/* Privacy note on location step */}
      {current.key === 'location' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginTop: 'var(--sp-5)', color: 'var(--c-muted)', fontSize: '0.78rem' }}>
          <Shield size={13} />
          Location data is processed locally and never sold.
        </div>
      )}
    </div>
  );
}
