/**
 * atlasEnrich.ts — Prediction Service
 *
 * Real fire incident data pipeline (tried in order):
 *   1. NASA FIRMS VIIRS NRT — satellite fire detections within 3 h (requires free MAP_KEY)
 *   2. VIC Emergency JSON feed — live Victorian incidents (no auth)
 *   3. NSW RFS major incidents GeoJSON (no auth)
 *   4. Geoscience Australia vegetation/fire-prone polygons (no auth)
 *   5. Static curated fire-prone locations (always available)
 */

import { randomUUID } from 'crypto';
import pool from './db';
import { createLogger } from '@haven/shared';

const logger = createLogger('prediction-atlas');

const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Known historically fire-prone Australian locations — final fallback */
const STATIC_FIRE_SEEDS: Array<{ lat: number; lng: number; severity: number }> = [
  { lat: -33.85,  lng: 150.5,  severity: 0.82 },  // Blue Mountains NSW
  { lat: -37.65,  lng: 146.25, severity: 0.75 },  // Victorian High Country
  { lat: -32.2,   lng: 148.6,  severity: 0.78 },  // Central Western NSW
  { lat: -34.0,   lng: 142.5,  severity: 0.70 },  // Mallee VIC
  { lat: -36.1,   lng: 148.0,  severity: 0.73 },  // Snowy Mountains NSW
  { lat: -28.5,   lng: 153.0,  severity: 0.68 },  // Northern Rivers NSW
  { lat: -31.5,   lng: 116.5,  severity: 0.65 },  // Avon WA
  { lat: -35.3,   lng: 138.9,  severity: 0.62 },  // Adelaide Hills SA
  { lat: -43.0,   lng: 147.0,  severity: 0.58 },  // Southern Tasmania
  { lat: -27.0,   lng: 152.5,  severity: 0.71 },  // Southeast Queensland
  { lat: -34.9,   lng: 150.0,  severity: 0.80 },  // South Coast NSW
  { lat: -37.0,   lng: 143.8,  severity: 0.69 },  // Grampians VIC
];

interface FirePoint { lat: number; lng: number; severity: number; confidence: number; radiusKm: number }

// ── Source 1: NASA FIRMS VIIRS NRT ──────────────────────────────────────────

interface FirmsRecord {
  latitude: string;
  longitude: string;
  frp?: string;        // Fire Radiative Power (MW)
  confidence?: string; // VIIRS: 'l'|'n'|'h'  MODIS: 0-100
}

function firmsConfidence(raw?: string): number {
  if (!raw) return 0.65;
  if (raw === 'l') return 0.45;
  if (raw === 'n') return 0.70;
  if (raw === 'h') return 0.92;
  const n = parseFloat(raw);
  return isNaN(n) ? 0.65 : Math.min(n / 100, 1);
}

function frmsSeverity(frp?: string): number {
  const w = frp ? parseFloat(frp) : 0;
  if (w > 100) return 0.92;
  if (w >  50) return 0.78;
  if (w >  20) return 0.65;
  return 0.55;
}

async function fetchFirms(): Promise<FirePoint[]> {
  const key = process.env.NASA_FIRMS_MAP_KEY;
  if (!key) {
    logger.info('NASA_FIRMS_MAP_KEY not set — skipping FIRMS');
    return [];
  }

  // Australia bounding box: lng_min,lat_min,lng_max,lat_max
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/json/${key}/VIIRS_SNPP_NRT/112,-44,154,-10/1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) { logger.warn('FIRMS non-200', { status: res.status }); return []; }
    const data = await res.json() as FirmsRecord[];
    if (!Array.isArray(data)) return [];

    return data
      .map(r => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        if (isNaN(lat) || isNaN(lng)) return null;
        if (lat < -44 || lat > -10 || lng < 112 || lng > 154) return null;
        return {
          lat, lng,
          severity:   frmsSeverity(r.frp),
          confidence: firmsConfidence(r.confidence),
          radiusKm:   5 + Math.random() * 30,
        } satisfies FirePoint;
      })
      .filter((p): p is FirePoint => p !== null);
  } catch (err) {
    clearTimeout(timer);
    logger.warn('FIRMS fetch failed (non-fatal)', { error: String(err) });
    return [];
  }
}

// ── Source 2: VIC Emergency JSON feed ───────────────────────────────────────

interface VicFeature {
  geometry?: { type?: string; coordinates?: number[] };
  properties?: { category1?: string; category2?: string; status?: string };
}

async function fetchVicEmergency(): Promise<FirePoint[]> {
  const url = 'https://emergency.vic.gov.au/public/osom-feed.json';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) { logger.warn('VIC Emergency non-200', { status: res.status }); return []; }
    const json = await res.json() as { features?: VicFeature[] };
    const features = json.features ?? [];

    return features
      .filter(f => {
        const cat = (f.properties?.category1 ?? '').toLowerCase();
        return cat.includes('fire') || cat.includes('bushfire');
      })
      .map(f => {
        if (f.geometry?.type !== 'Point') return null;
        const [lng, lat] = f.geometry.coordinates ?? [];
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
        return {
          lat, lng,
          severity:   0.70,
          confidence: 0.85,
          radiusKm:   10 + Math.random() * 30,
        } satisfies FirePoint;
      })
      .filter((p): p is FirePoint => p !== null);
  } catch (err) {
    clearTimeout(timer);
    logger.warn('VIC Emergency fetch failed (non-fatal)', { error: String(err) });
    return [];
  }
}

// ── Source 3: NSW RFS major incidents ────────────────────────────────────────

interface RfsFeature {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: { category?: string; title?: string };
}

async function fetchNswRfs(): Promise<FirePoint[]> {
  const url = 'https://www.rfs.nsw.gov.au/feeds/majorIncidents.json';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) { logger.warn('NSW RFS non-200', { status: res.status }); return []; }
    const json = await res.json() as { features?: RfsFeature[] };
    const features = json.features ?? [];

    return features
      .map(f => {
        if (f.geometry?.type !== 'Point') return null;
        const coords = f.geometry.coordinates as number[] | undefined;
        const [lng, lat] = coords ?? [];
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
        return {
          lat, lng,
          severity:   0.75,
          confidence: 0.90,
          radiusKm:   15 + Math.random() * 35,
        } satisfies FirePoint;
      })
      .filter((p): p is FirePoint => p !== null);
  } catch (err) {
    clearTimeout(timer);
    logger.warn('NSW RFS fetch failed (non-fatal)', { error: String(err) });
    return [];
  }
}

// ── Source 4: GA fire-prone polygons (existing) ──────────────────────────────

const FIRE_PRONE_URL =
  'https://services.ga.gov.au/gis/rest/services/Topographic/National_Integrated_Vegetation/FeatureServer/0/query';

interface AtlasPolygonFeature {
  centroid?: { x: number; y: number };
  geometry?: { rings?: number[][][] };
  attributes?: Record<string, unknown>;
}

function ringCentroid(rings: number[][][]): { lat: number; lng: number } | null {
  const ring = rings[0];
  if (!ring?.length) return null;
  const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return { lat, lng };
}

async function fetchGaFireProne(): Promise<FirePoint[]> {
  const params = new URLSearchParams({
    where: '1=1', outFields: '*',
    resultRecordCount: '200', f: 'json',
    outSR: '4326', returnCentroid: 'true',
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${FIRE_PRONE_URL}?${params}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = await res.json() as { features?: AtlasPolygonFeature[]; error?: unknown };
    if (json.error || !json.features?.length) return [];

    return json.features.map(f => {
      let lat: number | undefined, lng: number | undefined;
      if (f.centroid?.x && f.centroid?.y) { lng = f.centroid.x; lat = f.centroid.y; }
      else if (f.geometry?.rings?.length) { const c = ringCentroid(f.geometry.rings); if (c) { lat = c.lat; lng = c.lng; } }
      if (!lat || !lng || lat < -44 || lat > -10 || lng < 112 || lng > 154) return null;
      return { lat, lng, severity: 0.60 + Math.random() * 0.25, confidence: 0.60, radiusKm: 10 + Math.random() * 40 } satisfies FirePoint;
    }).filter((p): p is FirePoint => p !== null);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function enrichFromAtlas(): Promise<void> {
  logger.info('Starting fire data enrichment…');

  const { rows: existing } = await pool.query('SELECT COUNT(*) AS cnt FROM predictions');
  const existingCount = parseInt(String(existing[0]?.cnt ?? '0'), 10);
  if (existingCount >= 20) {
    logger.info('Predictions already seeded — skipping enrichment', { existingCount });
    return;
  }

  // Try sources in priority order; merge all that return data
  const [firms, vic, nsw, ga] = await Promise.all([
    fetchFirms(),
    fetchVicEmergency(),
    fetchNswRfs(),
    fetchGaFireProne(),
  ]);

  let points: FirePoint[];
  let source: string;

  if (firms.length > 0) {
    points = firms;
    source = `NASA FIRMS (${firms.length})`;
    // Supplement with live incident feeds
    if (vic.length > 0) { points = [...points, ...vic]; source += ` + VIC Emergency (${vic.length})`; }
    if (nsw.length > 0) { points = [...points, ...nsw]; source += ` + NSW RFS (${nsw.length})`; }
  } else if (vic.length > 0 || nsw.length > 0) {
    points = [...vic, ...nsw];
    source = `live feeds — VIC(${vic.length}), NSW(${nsw.length})`;
  } else if (ga.length > 0) {
    points = ga;
    source = `GA fire-prone polygons (${ga.length})`;
  } else {
    points = STATIC_FIRE_SEEDS.map(s => ({ ...s, confidence: 0.60, radiusKm: 20 + Math.random() * 30 }));
    source = 'static fallback';
  }

  let inserted = 0;
  for (const p of points) {
    const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    const hoursAgo  = Math.random() * 12;
    try {
      await pool.query(
        `INSERT INTO predictions
           (id, latitude, longitude, severity, confidence, radius_km, spread_direction, predicted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, NOW() - ($8 * INTERVAL '1 hour'))
         ON CONFLICT DO NOTHING`,
        [randomUUID(), p.lat, p.lng, p.severity, p.confidence, Math.round(p.radiusKm), direction, hoursAgo],
      );
      inserted++;
    } catch (err) {
      logger.warn('Prediction insert failed', { lat: p.lat, lng: p.lng, error: String(err) });
    }
  }

  logger.info('Fire enrichment complete', { source, inserted });
}

