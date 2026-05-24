import React, { useEffect, useState } from 'react';
import { fetchAlerts, fetchSafeSpaces, fetchPredictions } from '../api';
import type { AlertDto, SafeSpaceDto, PredictionDto } from '../types';
import { useGeolocation } from '../hooks/useGeolocation';
import AlertList from '../components/AlertList';
import SafeSpaceList from '../components/SafeSpaceList';
import HavenMap from '../components/HavenMap';
import { Link } from 'react-router-dom';
import {
  AlertOctagon, AlertTriangle, Zap, CheckCircle2,
  PersonStanding, Bell, HeartHandshake, MapPin, Bot,
} from 'lucide-react';

const RISK_CONFIG: Record<string, { banner: string; label: string; Icon: React.ElementType }> = {
  CRITICAL: { banner: 'risk-banner-CRITICAL', label: 'CRITICAL DANGER',  Icon: AlertOctagon  },
  HIGH:     { banner: 'risk-banner-HIGH',     label: 'HIGH RISK',        Icon: AlertTriangle },
  MEDIUM:   { banner: 'risk-banner-MEDIUM',   label: 'MEDIUM CAUTION',   Icon: Zap           },
  LOW:      { banner: 'risk-banner-LOW',      label: 'LOW RISK — CLEAR', Icon: CheckCircle2  },
};

export default function Dashboard() {
  const location = useGeolocation();
  const [alerts, setAlerts]           = useState<AlertDto[]>([]);
  const [spaces, setSpaces]           = useState<SafeSpaceDto[]>([]);
  const [predictions, setPredictions] = useState<PredictionDto[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    Promise.all([
      fetchAlerts(location.latitude, location.longitude),
      fetchSafeSpaces(location.latitude, location.longitude),
      fetchPredictions(location.latitude, location.longitude),
    ])
      .then(([a, s, p]) => { setAlerts(a); setSpaces(s); setPredictions(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [location]);

  const topAlert = alerts[0];
  const riskLevel = topAlert?.type ?? 'LOW';
  const { banner: bannerClass, label: riskLabel, Icon: RiskIcon } = RISK_CONFIG[riskLevel] ?? RISK_CONFIG.LOW;
  const criticalAlerts = alerts.filter(a => a.type === 'CRITICAL');

  return (
    <div>
      {/* Risk banner */}
      <div className={`risk-banner ${bannerClass}`} role="alert" aria-live="assertive">
        <RiskIcon size={22} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.72rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current Risk Level</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>{riskLabel}</div>
          {topAlert && <div style={{ fontWeight: 400, fontSize: '0.85rem', opacity: 0.9, marginTop: 2 }}>{topAlert.title}</div>}
        </div>
        {criticalAlerts.length > 0 && (
          <span className="badge badge-critical" style={{ flexShrink: 0 }}>{criticalAlerts.length} active</span>
        )}
      </div>

      {/* Stat row */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
          <div className="stat-tile">
            <div className="stat-value" style={{ color: alerts.length > 0 ? 'var(--c-critical)' : 'var(--c-safe)' }}>{alerts.length}</div>
            <div className="stat-label">Alerts</div>
          </div>
          <div className="stat-tile">
            <div className="stat-value" style={{ color: 'var(--c-info)' }}>{spaces.filter(s => s.isOpen).length}</div>
            <div className="stat-label">Open spaces</div>
          </div>
          <div className="stat-tile">
            <div className="stat-value" style={{ color: predictions.length > 0 ? 'var(--c-high)' : 'var(--c-muted)' }}>{predictions.length}</div>
            <div className="stat-label">Predictions</div>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="map-container" style={{ marginBottom: 'var(--sp-4)' }}>
        {location
          ? <HavenMap center={location} safeSpaces={spaces} predictions={predictions} />
          : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-3)', color: 'var(--c-muted)' }}>
              <MapPin size={32} style={{ opacity: 0.4 }} />
              <span style={{ fontSize: '0.9rem' }}>Allow location access to see your area</span>
            </div>
          )
        }
      </div>

      {/* Quick CTAs */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', marginBottom: 'var(--sp-5)' }}>
        <Link to="/safe-spaces" className="btn btn-danger btn-lg" style={{ flex: 1, minWidth: 140 }}>
          <PersonStanding size={18} />Evacuate Now
        </Link>
        <Link to="/alerts" className="btn btn-ghost" style={{ flex: 1, minWidth: 120 }}>
          <Bell size={16} />View Alerts
        </Link>
        <Link to="/assistant" className="btn btn-ghost" style={{ flex: 1, minWidth: 120 }}>
          <Bot size={16} />AI Guide
        </Link>
      </div>

      {loading && <div className="spinner" role="status" aria-label="Loading data" />}

      {!loading && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
            <h2 className="section-heading" style={{ margin: 0 }}>Nearby Safe Spaces</h2>
            <Link to="/safe-spaces" style={{ fontSize: '0.8rem', color: 'var(--c-info)' }}>See all →</Link>
          </div>
          <SafeSpaceList spaces={spaces.slice(0, 3)} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
            <h2 className="section-heading" style={{ margin: 0 }}>Recent Alerts</h2>
            <Link to="/alerts" style={{ fontSize: '0.8rem', color: 'var(--c-info)' }}>See all →</Link>
          </div>
          <AlertList alerts={alerts.slice(0, 5)} />

          <div style={{ marginBottom: 'var(--sp-4)' }} />
          <Link to="/recovery" className="btn btn-ghost btn-block">
            <HeartHandshake size={16} />Recovery & Support Resources
          </Link>
        </>
      )}
    </div>
  );
}

