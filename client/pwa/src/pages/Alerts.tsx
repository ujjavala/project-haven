import React, { useEffect, useState } from 'react';
import { fetchAlerts } from '../api';
import type { AlertDto } from '../types';
import { useGeolocation } from '../hooks/useGeolocation';
import { BellRing, AlertOctagon, X, Radio } from 'lucide-react';

function badgeClass(type: AlertDto['type']): string {
  const m: Record<string, string> = {
    CRITICAL: 'badge-critical', HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-info',
  };
  return `badge ${m[type] ?? 'badge-neutral'}`;
}

export default function Alerts() {
  const location = useGeolocation();
  const [alerts, setAlerts]         = useState<AlertDto[]>([]);
  const [loading, setLoading]       = useState(true);
  const [dismissed, setDismissed]   = useState<Set<string>>(new Set());
  const [overlayId, setOverlayId]   = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts(location?.latitude, location?.longitude)
      .then((data) => {
        setAlerts(data);
        // Auto-open first CRITICAL if any
        const first = data.find(a => a.type === 'CRITICAL');
        if (first) setOverlayId(first.id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [location]);

  function dismiss(id: string) {
    setDismissed(prev => new Set([...prev, id]));
    if (overlayId === id) setOverlayId(null);
  }

  const visible = alerts.filter(a => !dismissed.has(a.id));
  const criticalAlert = overlayId ? alerts.find(a => a.id === overlayId) : null;

  return (
    <>
      {/* Full-screen CRITICAL overlay */}
      {criticalAlert && (
        <div className="alert-fullscreen-overlay" role="alertdialog" aria-modal="true" aria-label="Critical alert">
          <AlertOctagon size={56} color="#fca5a5" style={{ marginBottom: 'var(--sp-4)' }} />
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#fca5a5', marginBottom: 'var(--sp-2)' }}>
            Critical Emergency Alert
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', textAlign: 'center', marginBottom: 'var(--sp-3)', lineHeight: 1.25 }}>
            {criticalAlert.title}
          </h2>
          <p style={{ color: '#fca5a5', textAlign: 'center', maxWidth: 400, marginBottom: 'var(--sp-6)', lineHeight: 1.6 }}>
            {criticalAlert.description}
          </p>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="/safe-spaces" className="btn btn-safe btn-lg">Find Evacuation Point</a>
            <button className="btn btn-ghost" onClick={() => dismiss(criticalAlert.id)}>
              <X size={16} /> Dismiss
            </button>
          </div>
        </div>
      )}

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
          <h1 className="page-heading" style={{ margin: 0 }}>Live Alerts</h1>
          {!loading && visible.length > 0 && (
            <span className="badge badge-critical" style={{ animation: 'pulse-danger 2s ease-in-out infinite' }}>
              <Radio size={10} /> {visible.length} Active
            </span>
          )}
        </div>

        {loading && <div className="spinner" role="status" aria-label="Loading" />}

        {!loading && visible.length === 0 && (
          <div className="empty-state">
            <BellRing size={40} />
            <strong>No active alerts in your area.</strong>
            <span style={{ fontSize: '0.85rem' }}>You'll be notified immediately if conditions change.</span>
          </div>
        )}

        {!loading && visible.length > 0 && (
          <div role="list" aria-label="Emergency alerts">
            {visible.map((a) => (
              <article key={a.id} className={`alert-item ${a.type}`} role="listitem">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
                  <span className={badgeClass(a.type)}>{a.type}</span>
                  <strong style={{ flex: 1, lineHeight: 1.35 }}>{a.title}</strong>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '0.2rem 0.5rem', minHeight: 28 }}
                    onClick={() => dismiss(a.id)}
                    aria-label={`Dismiss alert: ${a.title}`}
                  >
                    <X size={13} />
                  </button>
                </div>
                <p style={{ fontSize: '0.87rem', marginBottom: 'var(--sp-2)', color: 'var(--c-text-2)', lineHeight: 1.5 }}>
                  {a.description}
                </p>
                <p className="card-meta">
                  Affected radius: {a.affectedRadiusKm} km ·{' '}
                  {new Date(a.generatedAt).toLocaleString()}
                  {a.type === 'CRITICAL' && (
                    <button
                      style={{ marginLeft: 'var(--sp-3)', background: 'none', border: 'none', color: 'var(--c-critical)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}
                      onClick={() => setOverlayId(a.id)}
                    >
                      View full alert →
                    </button>
                  )}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

