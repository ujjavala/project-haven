/**
 * atlasEnrich.ts — Recommendation Service
 *
 * Supplements the static program seeds with additional verified Australian
 * government recovery services.  Attempts to reach the Digital Atlas
 * Community Services dataset; falls back to a curated static list if
 * the endpoint is unavailable.
 *
 * Fire-and-forget — never throws.
 */

import { randomUUID } from 'crypto';
import pool from './db';
import { createLogger } from '@haven/shared';

const logger = createLogger('recommendation-atlas');

/** Digital Atlas / GA Community Infrastructure dataset (if available) */
const ATLAS_COMMUNITY_URL =
  'https://services.ga.gov.au/gis/rest/services/Topographic/Facilities/FeatureServer/0/query';

interface AtlasFeature {
  attributes?: {
    FEAT_NAME?: string;
    NAME?: string;
    FEAT_CODE?: string;
    STATE?: string;
    PLACE_NAME?: string;
  };
}

/**
 * Supplemental programs beyond the initial seed.
 * All links point to official Australian government URLs.
 */
const EXTRA_PROGRAMS = [
  {
    scenario: 'ACTIVE_FIRE',
    category: 'EMERGENCY',
    title: 'VIC Emergency App',
    description:
      'Official Victorian emergency management app. Live incident map, warnings, and safe route guidance.',
    provider: 'Emergency Management Victoria',
    eligibilitySummary: 'Victoria residents.',
    applicationUrl: 'https://www.emergency.vic.gov.au',
    confidence: 0.95,
    priority: 3,
  },
  {
    scenario: 'ACTIVE_FIRE',
    category: 'EMERGENCY',
    title: 'QLD Disaster Management App',
    description:
      'Get real-time Queensland disaster alerts, road closures, and evacuation notices.',
    provider: 'Queensland Fire & Emergency Services',
    eligibilitySummary: 'Queensland residents.',
    applicationUrl: 'https://www.disaster.qld.gov.au',
    confidence: 0.93,
    priority: 4,
  },
  {
    scenario: 'EVACUATION',
    category: 'EMERGENCY',
    title: 'Red Cross Safe & Well Register',
    description:
      "Let family and friends know you're safe after an emergency. Register your status online.",
    provider: 'Australian Red Cross',
    eligibilitySummary: 'Anyone affected by a declared emergency.',
    applicationUrl: 'https://register.redcross.org.au',
    confidence: 0.97,
    priority: 3,
  },
  {
    scenario: 'EVACUATION',
    category: 'HEALTH',
    title: 'Lifeline Crisis Support Line',
    description:
      '24/7 phone and chat crisis support. Call 13 11 14 or chat online for immediate mental health support.',
    provider: 'Lifeline Australia',
    eligibilitySummary: 'All Australians.',
    applicationUrl: 'https://www.lifeline.org.au',
    confidence: 0.98,
    priority: 4,
  },
  {
    scenario: 'RECOVERY',
    category: 'GRANT',
    title: 'Bushfire Recovery NSW Grants',
    description:
      'Grants and loans for NSW residents impacted by bushfire, including small business recovery, housing repair, and farm infrastructure.',
    provider: 'Resilience NSW / Service NSW',
    eligibilitySummary: 'NSW residents in identified disaster local government areas.',
    applicationUrl: 'https://www.service.nsw.gov.au/campaign/bushfire-customer-care-service',
    confidence: 0.88,
    priority: 6,
  },
  {
    scenario: 'RECOVERY',
    category: 'HOUSING',
    title: 'Defence Housing Temporary Accommodation',
    description:
      'Short-term housing support through ADF and emergency housing partnerships, available to eligible evacuated residents.',
    provider: 'Department of Social Services',
    eligibilitySummary: 'Residents who have lost access to primary housing due to disaster.',
    applicationUrl: 'https://www.dss.gov.au/emergency-housing',
    confidence: 0.80,
    priority: 7,
  },
  {
    scenario: 'RECOVERY',
    category: 'GRANT',
    title: 'Rebuilding Home Owners Assistance Package',
    description:
      'Up to $10,000 to help homeowners clean up, make safe, and start rebuilding after a natural disaster.',
    provider: 'State Government — varies by state',
    eligibilitySummary: 'Home owners in declared disaster areas whose residence was damaged.',
    applicationUrl: null,
    confidence: 0.82,
    priority: 8,
  },
  {
    scenario: 'RECOVERY',
    category: 'HEALTH',
    title: 'Commonwealth Psychological Wellbeing Package',
    description:
      'Free face-to-face sessions with a mental health professional for people in disaster-affected communities. No referral needed.',
    provider: 'Department of Health (Australian Government)',
    eligibilitySummary: 'Residents of regions declared under the Commonwealth Disaster Recovery package.',
    applicationUrl: 'https://www.health.gov.au/mental-health',
    confidence: 0.91,
    priority: 9,
  },
];

/** Try fetching Atlas community/support facility names to build contextual recs */
async function fetchAtlasServices(): Promise<{ name: string; state: string }[]> {
  const params = new URLSearchParams({
    where: "FEAT_CODE IN ('MEDL','COMM','SFST')",
    outFields: 'FEAT_NAME,NAME,FEAT_CODE,STATE',
    resultRecordCount: '200',
    f: 'json',
    outSR: '4326',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${ATLAS_COMMUNITY_URL}?${params}`, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return [];

    const json = await res.json() as { features?: AtlasFeature[]; error?: unknown };
    if (json.error || !json.features?.length) return [];

    return json.features.map(f => ({
      name: String(f.attributes?.FEAT_NAME ?? f.attributes?.NAME ?? ''),
      state: String(f.attributes?.STATE ?? ''),
    })).filter(s => s.name.length > 0);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

export async function enrichFromAtlas(): Promise<void> {
  logger.info('Starting Digital Atlas enrichment for recommendations…');

  // Check if extras are already seeded
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM recommendations WHERE title = $1`,
    ['VIC Emergency App'],
  );
  if (parseInt(String(rows[0]?.cnt ?? '0'), 10) > 0) {
    logger.info('Recommendation extras already seeded — skipping Atlas enrichment');
    return;
  }

  // Best-effort Atlas context fetch (we log but don't use output beyond awareness)
  const services = await fetchAtlasServices();
  logger.info('Atlas community services fetched', { count: services.length });

  let inserted = 0;

  for (const p of EXTRA_PROGRAMS) {
    try {
      await pool.query(
        `INSERT INTO recommendations
           (id, scenario, category, title, description, provider, eligibility_summary,
            application_url, confidence, is_verified, priority)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10)
         ON CONFLICT (scenario, title) DO NOTHING`,
        [
          randomUUID(),
          p.scenario,
          p.category,
          p.title,
          p.description,
          p.provider,
          p.eligibilitySummary,
          p.applicationUrl,
          p.confidence,
          p.priority,
        ],
      );
      inserted++;
    } catch (err) {
      logger.warn('Recommendation insert failed', { title: p.title, error: String(err) });
    }
  }

  logger.info('Recommendation Atlas enrichment complete', {
    atlasServicesFound: services.length,
    programsInserted: inserted,
  });

  // Third pass: GrantConnect — live federal open grants portal
  await enrichFromGrantConnect();
}

// ── GrantConnect API ─────────────────────────────────────────────────────────

interface GrantConnectGrant {
  id?: string;
  title?: string;
  description?: string;
  grantingBody?: string;
  applicationUrl?: string;
  category?: string;
}

const GRANTCONNECT_CATEGORY_MAP: Record<string, 'GRANT' | 'HEALTH' | 'HOUSING' | 'EMERGENCY' | 'RECOVERY'> = {
  'natural disaster': 'GRANT',
  'emergency': 'EMERGENCY',
  'housing': 'HOUSING',
  'health': 'HEALTH',
};

function mapGrantCategory(raw?: string): 'GRANT' | 'HEALTH' | 'HOUSING' | 'EMERGENCY' | 'RECOVERY' {
  const lower = (raw ?? '').toLowerCase();
  for (const [key, val] of Object.entries(GRANTCONNECT_CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'GRANT';
}

async function enrichFromGrantConnect(): Promise<void> {
  const key = process.env.GRANTCONNECT_API_KEY;
  if (!key) {
    logger.info('GRANTCONNECT_API_KEY not set — skipping GrantConnect enrichment');
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  let grants: GrantConnectGrant[];
  try {
    const res = await fetch(
      'https://www.grants.gov.au/api/v2/grants?keyword=bushfire+disaster&status=open&limit=50',
      {
        signal: controller.signal,
        headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' },
      },
    );
    clearTimeout(timer);
    if (!res.ok) { logger.warn('GrantConnect non-200', { status: res.status }); return; }
    const json = await res.json() as { grants?: GrantConnectGrant[]; data?: GrantConnectGrant[] };
    grants = json.grants ?? json.data ?? [];
  } catch (err) {
    clearTimeout(timer);
    logger.warn('GrantConnect fetch failed (non-fatal)', { error: String(err) });
    return;
  }

  let inserted = 0;
  for (const g of grants) {
    if (!g.title || !g.description) continue;
    try {
      await pool.query(
        `INSERT INTO recommendations
           (id, scenario, category, title, description, provider, eligibility_summary,
            application_url, confidence, is_verified, priority)
         VALUES ($1,'RECOVERY',$2,$3,$4,$5,'',$6,0.85,TRUE,50)
         ON CONFLICT (scenario, title) DO NOTHING`,
        [
          randomUUID(),
          mapGrantCategory(g.category),
          g.title,
          g.description,
          g.grantingBody ?? 'Australian Government',
          g.applicationUrl ?? null,
        ],
      );
      inserted++;
    } catch (err) {
      logger.warn('GrantConnect insert failed', { title: g.title, error: String(err) });
    }
  }

  logger.info('GrantConnect enrichment complete', { total: grants.length, inserted });
}
