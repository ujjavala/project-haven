import React, { useEffect, useState } from 'react';
import { fetchRecommendations } from '../api';
import type { RecommendationDto } from '../types';
import {
  Flame, PersonStanding, Home, Banknote, Building2, Siren,
  RefreshCw, HeartPulse, ClipboardList, ShieldCheck, ExternalLink, Leaf,
} from 'lucide-react';

const SCENARIOS = [
  { value: 'ACTIVE_FIRE', label: 'Active Fire',  Icon: Flame,          desc: 'Right now — evacuation & safety' },
  { value: 'EVACUATION',  label: 'Evacuating',   Icon: PersonStanding, desc: 'Finding shelter & transport' },
  { value: 'RECOVERY',    label: 'Recovery',     Icon: Home,           desc: 'Grants, housing & mental health' },
] as const;

type Scenario = typeof SCENARIOS[number]['value'];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  GRANT: Banknote, HOUSING: Building2, EMERGENCY: Siren,
  RECOVERY: RefreshCw, HEALTH: HeartPulse, ENVIRONMENT: Leaf,
};

export default function Recovery() {
  const [scenario, setScenario] = useState<Scenario>('ACTIVE_FIRE');
  const [recs, setRecs]         = useState<RecommendationDto[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchRecommendations(scenario)
      .then(setRecs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [scenario]);

  const activeScenario = SCENARIOS.find(s => s.value === scenario)!;

  return (
    <div>
      <h1 className="page-heading">Recovery & Support</h1>

      {/* Scenario selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
        {SCENARIOS.map((s) => (
          <button
            key={s.value}
            className={`btn ${scenario === s.value ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setScenario(s.value)}
            style={{ flexDirection: 'column', gap: 'var(--sp-1)', padding: 'var(--sp-3) var(--sp-2)', height: 'auto', minHeight: 68 }}
          >
            <s.Icon size={18} />
            <span style={{ fontSize: '0.75rem', lineHeight: 1.2 }}>{s.label}</span>
          </button>
        ))}
      </div>

      <div className="card-glass" style={{ marginBottom: 'var(--sp-5)', display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
        <activeScenario.Icon size={28} style={{ color: 'var(--c-info)', flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{activeScenario.label}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--c-muted)' }}>{activeScenario.desc}</div>
        </div>
      </div>

      {loading && <div className="spinner" role="status" aria-label="Loading" />}
      {!loading && recs.length === 0 && (
        <div className="empty-state">
          <ClipboardList size={38} />
          <strong>No recommendations found for this scenario.</strong>
        </div>
      )}

      <div className="card-grid">
        {recs.map((r) => {
          const CatIcon = CATEGORY_ICONS[r.category] ?? ClipboardList;
          return (
            <article key={r.id} className="card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--r-md)',
                  background: 'var(--c-info-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <CatIcon size={20} color="var(--c-info)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="card-title">{r.title}</div>
                  <div style={{ display: 'flex', gap: 'var(--sp-1)', marginTop: 'var(--sp-1)', flexWrap: 'wrap' }}>
                    <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{r.category}</span>
                    <span className="badge badge-safe" style={{ fontSize: '0.65rem' }}><ShieldCheck size={9} /> Verified</span>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '0.87rem', marginBottom: 'var(--sp-3)', color: 'var(--c-text-2)', lineHeight: 1.55 }}>
                {r.description}
              </p>

              <div className="card-meta" style={{ marginBottom: 'var(--sp-2)' }}>Provider: {r.provider}</div>
              {r.eligibilitySummary && (
                <div className="card-meta" style={{ marginBottom: 'var(--sp-3)' }}>Eligibility: {r.eligibilitySummary}</div>
              )}

              {r.applicationUrl && (
                <a
                  href={r.applicationUrl}
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  style={{ width: 'fit-content' }}
                >
                  <ExternalLink size={12} /> Apply Now
                </a>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
