import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pool from './db';
import { getRecommendations } from './recommendationService';
import { enrichFromAtlas } from './atlasEnrich';
import { createLogger } from '@haven/shared';

const logger = createLogger('recommendation-service');
const app = express();
const PORT = parseInt(process.env.PORT ?? '3005');

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/recommendations', async (req, res) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const scenario = (req.query.scenario as string ?? 'ACTIVE_FIRE').toUpperCase() as 'ACTIVE_FIRE' | 'EVACUATION' | 'RECOVERY';

    const valid = ['ACTIVE_FIRE', 'EVACUATION', 'RECOVERY'];
    if (!valid.includes(scenario)) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: `scenario must be one of ${valid.join(', ')}` });
      return;
    }

    const recs = await getRecommendations(lat, lng, scenario);
    res.json(recs);
  } catch (err) {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'recommendation-service' }));

async function initDb(): Promise<void> {
  // Create table (without unique constraint first, to handle existing DBs)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recommendations (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scenario            TEXT NOT NULL,
      category            TEXT NOT NULL,
      title               TEXT NOT NULL,
      description         TEXT NOT NULL,
      provider            TEXT NOT NULL,
      eligibility_summary TEXT NOT NULL DEFAULT '',
      application_url     TEXT,
      confidence          DOUBLE PRECISION NOT NULL DEFAULT 0.9,
      is_verified         BOOLEAN NOT NULL DEFAULT TRUE,
      priority            INT NOT NULL DEFAULT 50
    )
  `);

  // Remove duplicates (keep lowest id per scenario+title) before adding constraint
  await pool.query(`
    DELETE FROM recommendations r
    WHERE r.id NOT IN (
      SELECT DISTINCT ON (scenario, title) id
      FROM recommendations
      ORDER BY scenario, title, id
    )
  `);

  // Add unique constraint idempotently
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE recommendations ADD CONSTRAINT recommendations_scenario_title_key UNIQUE (scenario, title);
    EXCEPTION WHEN duplicate_table THEN NULL;
             WHEN duplicate_object THEN NULL;
    END $$
  `);

  // Seed real Australian government services and grants
  await pool.query(`
    INSERT INTO recommendations (scenario, category, title, description, provider, eligibility_summary, application_url, confidence, priority)
    VALUES
      ('ACTIVE_FIRE',  'EMERGENCY', 'Call 000 – Emergency Services',
        'Call Triple Zero (000) immediately if you or someone is in danger from fire. Request Fire, Police or Ambulance.',
        'Australian Emergency Services', 'Anyone in immediate danger.', NULL, 0.99, 1),

      ('ACTIVE_FIRE',  'EMERGENCY', 'NSW RFS – Bush Fire Updates',
        'Check the NSW Rural Fire Service website for up-to-date fire maps, warnings and current fire danger ratings.',
        'NSW Rural Fire Service', 'NSW residents.', 'https://www.rfs.nsw.gov.au', 0.95, 2),

      ('EVACUATION',   'EMERGENCY', 'Find Your Nearest Evacuation Centre',
        'Use the Red Cross Emergency app or your state''s emergency website to find the closest open evacuation centre.',
        'Australian Red Cross', 'Anyone evacuating due to a declared emergency.', 'https://www.redcross.org.au', 0.95, 1),

      ('EVACUATION',   'HEALTH',    'NDIS Emergency Support',
        'If you have a disability, contact the NDIS Emergency Support Line for priority evacuation and support coordination.',
        'National Disability Insurance Scheme', 'NDIS participants and eligible persons with disability.',
        'https://www.ndis.gov.au', 0.90, 2),

      ('RECOVERY',     'GRANT',     'Disaster Recovery Payment',
        'A one-off payment of $1,000 per eligible adult and $400 per eligible child for people adversely affected by a major disaster.',
        'Services Australia',
        'Australian residents in declared disaster areas who have experienced significant damage or loss.',
        'https://www.servicesaustralia.gov.au/disaster-recovery-payment', 0.92, 1),

      ('RECOVERY',     'GRANT',     'Disaster Recovery Allowance',
        'Short-term income support (up to 13 weeks) for employees, sole traders and small businesses who have lost income due to a disaster.',
        'Services Australia',
        'Employees and self-employed persons in declared disaster areas who have lost income.',
        'https://www.servicesaustralia.gov.au/disaster-recovery-allowance', 0.90, 2),

      ('RECOVERY',     'HOUSING',   'Emergency Accommodation Assistance',
        'Provides short-term accommodation support for people who have lost their homes in a disaster.',
        'State Housing Authorities',
        'Residents whose primary residence has been damaged or destroyed.',
        NULL, 0.88, 3),

      ('RECOVERY',     'HEALTH',    'Mental Health Support – Beyond Blue',
        'Free 24/7 mental health phone and chat support for people experiencing stress, anxiety or grief after a disaster.',
        'Beyond Blue', 'All Australians.',
        'https://www.beyondblue.org.au', 0.95, 4),

      ('RECOVERY',     'GRANT',     'Primary Producer Recovery Grant',
        'Grants of up to $75,000 for eligible primary producers to replace and restore essential assets and infrastructure.',
        'State & Federal Government',
        'Primary producers (farmers, fishers) in declared disaster areas with demonstrated financial need.',
        NULL, 0.85, 5)
    ON CONFLICT (scenario, title) DO NOTHING
  `);

  logger.info('Database schema ready with seed data');
}

async function start(): Promise<void> {
  await initDb();
  // Fire-and-forget enrichment — never blocks startup
  enrichFromAtlas().catch(err => logger.warn('Atlas enrichment failed (non-fatal)', { error: String(err) }));
  app.listen(PORT, () => logger.info(`recommendation-service listening on port ${PORT}`));
}

start().catch((err) => { logger.error('Failed to start', { error: String(err) }); process.exit(1); });

export { app };
