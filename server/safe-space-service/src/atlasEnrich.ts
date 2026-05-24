/**
 * atlasEnrich.ts — Safe-Space Service
 *
 * Fetches real Australian emergency facility data from the Geoscience Australia
 * Topographic Facilities FeatureServer (Digital Atlas backbone).
 *
 * Runs at startup; any failure is logged and skipped so the service always starts.
 */

import pool from './db';
import { createLogger } from '@haven/shared';

const logger = createLogger('safe-space-atlas');

const ATLAS_URL =
  'https://services.ga.gov.au/gis/rest/services/Topographic/Facilities/FeatureServer/0/query';

/** ArcGIS feature field names returned by GA Topographic/Facilities */
interface AtlasFeature {
  attributes: {
    // Different GA layers use different field name conventions — try all variants
    FEAT_NAME?: string;
    NAME?: string;
    PLACE_NAME?: string;
    ADDRESS?: string;
    FULL_ADDRESS?: string;
    STREET?: string;
    LOCALITY?: string;
    STATE?: string;
    FEAT_CODE?: string;
  };
  geometry?: {
    x?: number;  // longitude (EPSG:4326)
    y?: number;  // latitude
  };
}

interface AtlasResponse {
  features?: AtlasFeature[];
  error?: { code: number; message: string };
}

/** Accessibility tags inferred from facility type */
function accessibilityTags(featCode: string): string[] {
  const base = ['wheelchair', 'accessible_toilet'];
  if (['HSPT', 'MEDL'].includes(featCode)) return [...base, 'medical'];
  if (['STAD', 'COMM'].includes(featCode)) return [...base, 'parking', 'pet_friendly'];
  return base;
}

/** Infer capacity max from facility type */
function capacityMax(featCode: string): number {
  const caps: Record<string, number> = {
    STAD: 5000, SCHL: 1200, COMM: 800, HSPT: 400,
    MEDL: 300,  SFST: 100,
  };
  return caps[featCode] ?? 500;
}

async function fetchAtlasPage(offset: number): Promise<AtlasFeature[]> {
  const params = new URLSearchParams({
    where: "FEAT_CODE IN ('HSPT','COMM','STAD','SCHL','SFST','MEDL')",
    outFields: 'FEAT_NAME,NAME,PLACE_NAME,ADDRESS,FULL_ADDRESS,STREET,LOCALITY,STATE,FEAT_CODE',
    resultRecordCount: '500',
    resultOffset: String(offset),
    f: 'json',
    outSR: '4326',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(`${ATLAS_URL}?${params}`, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn('Atlas returned non-200', { status: res.status, offset });
      return [];
    }

    const json = await res.json() as AtlasResponse;
    if (json.error) {
      logger.warn('Atlas error response', { error: json.error, offset });
      return [];
    }
    return json.features ?? [];
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('Atlas fetch failed', { error: msg, offset });
    return [];
  }
}

export async function enrichFromAtlas(): Promise<void> {
  logger.info('Starting Digital Atlas enrichment for safe spaces…');

  let inserted = 0;
  let offset = 0;

  /* Fetch up to 2 pages (1000 features). Stop early if a page returns empty. */
  for (let page = 0; page < 2; page++) {
    const features = await fetchAtlasPage(offset);

    if (features.length === 0) {
      logger.info('Atlas returned no more features — stopping', { offset });
      break;
    }

    for (const f of features) {
      const attr = f.attributes;
      const geom = f.geometry;

      const lat = geom?.y;
      const lng = geom?.x;

      if (!lat || !lng || lat === 0 || lng === 0) continue;
      // Reject clearly non-Australian coordinates
      if (lat < -44 || lat > -10 || lng < 112 || lng > 154) continue;

      const name = attr.FEAT_NAME ?? attr.NAME ?? attr.PLACE_NAME ?? 'Unnamed facility';

      const streetPart = [attr.ADDRESS ?? attr.FULL_ADDRESS ?? attr.STREET, attr.LOCALITY, attr.STATE]
        .filter(Boolean)
        .join(', ');
      const address = streetPart || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      const featCode = attr.FEAT_CODE ?? 'COMM';
      const tags = accessibilityTags(featCode);
      const capacity = capacityMax(featCode);

      try {
        const result = await pool.query(
          `INSERT INTO safe_spaces
             (name, address, latitude, longitude, accessibility, capacity_current, capacity_max, is_open)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
           ON CONFLICT (name) DO NOTHING`,
          [name, address, lat, lng, tags, 0, capacity],
        );
        inserted += result.rowCount ?? 0;
      } catch (dbErr) {
        logger.warn('Atlas insert failed for row', { name, error: String(dbErr) });
      }
    }

    offset += features.length;
    if (features.length < 500) break; // last page
  }

  logger.info('Digital Atlas enrichment complete', { inserted });

  // Second pass: OSM Overpass API — emergency assembly/evacuation points across Australia
  await enrichFromOsm();
}

/** OSM Overpass: nodes tagged as emergency assembly or evacuation points in Australia */
async function enrichFromOsm(): Promise<void> {
  const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
  const query = `[out:json][timeout:30];
(
  node["emergency"="assembly_point"](-44,112,-10,154);
  node["emergency"="evacuation_point"](-44,112,-10,154);
  node["amenity"="evacuation_centre"](-44,112,-10,154);
);
out body;`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35_000);

  let elements: OsmElement[];
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) { logger.warn('OSM Overpass non-200', { status: res.status }); return; }
    const json = await res.json() as { elements?: OsmElement[] };
    elements = json.elements ?? [];
  } catch (err) {
    clearTimeout(timer);
    logger.warn('OSM Overpass fetch failed (non-fatal)', { error: String(err) });
    return;
  }

  let inserted = 0;
  for (const el of elements) {
    const lat = el.lat;
    const lng = el.lon;
    if (!lat || !lng) continue;
    if (lat < -44 || lat > -10 || lng < 112 || lng > 154) continue;

    const name = el.tags?.name ?? el.tags?.['addr:housename'] ?? `Emergency Point ${el.id}`;
    const addrParts = [
      el.tags?.['addr:housenumber'],
      el.tags?.['addr:street'],
      el.tags?.['addr:suburb'] ?? el.tags?.['addr:city'],
      el.tags?.['addr:state'],
    ].filter(Boolean);
    const address = addrParts.length > 0 ? addrParts.join(' ') : el.tags?.['addr:full'] ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    const tags: string[] = [];
    if (el.tags?.wheelchair === 'yes' || el.tags?.wheelchair === 'designated') tags.push('wheelchair');
    if (el.tags?.toilets_wheelchair === 'yes') tags.push('accessible_toilet');
    if (el.tags?.parking) tags.push('parking');
    if (el.tags?.dogs === 'yes' || el.tags?.pets === 'yes') tags.push('pet_friendly');

    try {
      const result = await pool.query(
        `INSERT INTO safe_spaces
           (name, address, latitude, longitude, accessibility, capacity_current, capacity_max, is_open)
         VALUES ($1, $2, $3, $4, $5, 0, 500, TRUE)
         ON CONFLICT (name) DO NOTHING`,
        [name, address, lat, lng, tags],
      );
      inserted += result.rowCount ?? 0;
    } catch (dbErr) {
      logger.warn('OSM insert failed', { name, error: String(dbErr) });
    }
  }

  logger.info('OSM Overpass enrichment complete', { total: elements.length, inserted });
}

interface OsmElement {
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}
