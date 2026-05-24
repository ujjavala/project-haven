import React from 'react';
import type { SafeSpaceDto } from '../types';
import { MapPin, Clock, Accessibility, Users } from 'lucide-react';

function capacityPct(current: number, max: number) {
  return max > 0 ? Math.min((current / max) * 100, 100) : 0;
}
function capacityColour(current: number, max: number): string {
  const r = max > 0 ? current / max : 0;
  if (r > 0.8) return 'var(--c-critical)';
  if (r > 0.5) return 'var(--c-high)';
  return 'var(--c-safe)';
}

export default function SafeSpaceList({ spaces }: { spaces: SafeSpaceDto[] }) {
  if (spaces.length === 0) return null;

  return (
    <div className="card-grid">
      {spaces.map((s, i) => (
        <article key={s.id} className="card" aria-label={`Safe space: ${s.name}`} style={{ position: 'relative' }}>
          {/* Rank badge */}
          {i < 3 && (
            <div style={{
              position: 'absolute', top: '-10px', left: 'var(--sp-4)',
              background: i === 0 ? 'var(--c-safe)' : 'var(--c-surface-3)',
              color: '#fff', fontSize: '0.65rem', fontWeight: 800,
              padding: '0.15rem 0.5rem', borderRadius: 'var(--r-full)',
            }}>
              #{i + 1} nearest
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
            <h3 className="card-title" style={{ flex: 1, paddingRight: 'var(--sp-2)' }}>{s.name}</h3>
            <span className={`badge ${s.isOpen ? 'badge-safe' : 'badge-neutral'}`}>{s.isOpen ? 'Open' : 'Closed'}</span>
          </div>

          <div className="card-meta" style={{ marginBottom: 'var(--sp-2)' }}>
            <MapPin size={12} />{s.address}
          </div>

          {s.distanceKm !== null && (
            <div className="card-meta" style={{ marginBottom: 'var(--sp-3)' }}>
              <Clock size={12} />
              {s.distanceKm} km away
              {s.etaMinutes !== null && (
                <strong style={{ color: 'var(--c-text)', marginLeft: 4 }}>~{s.etaMinutes} min drive</strong>
              )}
            </div>
          )}

          {/* Capacity */}
          <div style={{ marginBottom: 'var(--sp-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginBottom: 'var(--sp-1)' }}>
              <span style={{ color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={11} /> Capacity
              </span>
              <span style={{ fontWeight: 700, color: capacityColour(s.capacityCurrent, s.capacityMax) }}>
                {s.capacityCurrent}/{s.capacityMax}
              </span>
            </div>
            <div className="capacity-bar-track">
              <div
                className="capacity-bar-fill"
                style={{ width: `${capacityPct(s.capacityCurrent, s.capacityMax)}%`, background: capacityColour(s.capacityCurrent, s.capacityMax) }}
              />
            </div>
          </div>

          {s.accessibility.length > 0 && (
            <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap', marginTop: 'var(--sp-2)' }}>
              {s.accessibility.map((a) => (
                <span key={a} className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                  <Accessibility size={9} />{a.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
