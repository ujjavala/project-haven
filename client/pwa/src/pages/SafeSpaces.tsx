import React, { useEffect, useState } from 'react';
import { fetchSafeSpaces } from '../api';
import type { SafeSpaceDto } from '../types';
import { useGeolocation } from '../hooks/useGeolocation';
import SafeSpaceList from '../components/SafeSpaceList';
import { MapPin } from 'lucide-react';

export default function SafeSpaces() {
  const location = useGeolocation();
  const [spaces, setSpaces]   = useState<SafeSpaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<'all' | 'open'>('open');

  useEffect(() => {
    fetchSafeSpaces(location?.latitude, location?.longitude)
      .then(setSpaces)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [location]);

  const visible = filter === 'open' ? spaces.filter(s => s.isOpen) : spaces;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)', flexWrap: 'wrap' }}>
        <h1 className="page-heading" style={{ margin: 0 }}>Evacuation Points</h1>
        {!loading && (
          <span className="badge badge-info">{spaces.filter(s => s.isOpen).length} open</span>
        )}
      </div>
      <p style={{ color: 'var(--c-muted)', marginBottom: 'var(--sp-4)', fontSize: '0.87rem' }}>
        Nearest centres ranked by ETA. Accessibility filters shown on each card.
      </p>

      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
        <button className={`btn btn-sm ${filter === 'open' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('open')}>Open only</button>
        <button className={`btn btn-sm ${filter === 'all'  ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('all')}>Show all</button>
      </div>

      {loading && <div className="spinner" role="status" aria-label="Loading" />}
      {!loading && visible.length === 0 && (
        <div className="empty-state">
          <MapPin size={36} />
          <strong>No open spaces found nearby.</strong>
          <span style={{ fontSize: '0.85rem' }}>Toggle to "Show all" to see closed centres, or check back later.</span>
        </div>
      )}
      {!loading && <SafeSpaceList spaces={visible} />}
    </div>
  );
}
