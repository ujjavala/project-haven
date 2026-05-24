import React from 'react';
import type { AlertDto } from '../types';

function badgeClass(type: AlertDto['type']): string {
  const map: Record<string, string> = {
    CRITICAL: 'badge-critical', HIGH: 'badge-high',
    MEDIUM: 'badge-medium',     LOW: 'badge-info',
  };
  return `badge ${map[type] ?? 'badge-neutral'}`;
}

export default function AlertList({ alerts }: { alerts: AlertDto[] }) {
  if (alerts.length === 0) return (
    <p style={{ color: 'var(--c-muted)', fontSize: '0.87rem', padding: 'var(--sp-3) 0' }}>
      No active alerts.
    </p>
  );

  return (
    <div role="list" aria-label="Emergency alerts">
      {alerts.map((a) => (
        <article key={a.id} className={`alert-item ${a.type}`} role="listitem">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-1)' }}>
            <span className={badgeClass(a.type)}>{a.type}</span>
            <strong style={{ fontSize: '0.9rem', lineHeight: 1.35 }}>{a.title}</strong>
          </div>
          <p style={{ fontSize: '0.85rem', marginBottom: 'var(--sp-2)', color: 'var(--c-text-2)', lineHeight: 1.5 }}>
            {a.description}
          </p>
          <p className="card-meta">
            Radius: {a.affectedRadiusKm} km ·{' '}
            {new Date(a.generatedAt).toLocaleString()}
          </p>
        </article>
      ))}
    </div>
  );
}

