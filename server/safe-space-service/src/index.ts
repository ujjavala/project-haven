import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pool from './db';
import { getSafeSpaces } from './safeSpaceService';
import { enrichFromAtlas } from './atlasEnrich';
import { createLogger } from '@haven/shared';

const logger = createLogger('safe-space-service');
const app = express();
const PORT = parseInt(process.env.PORT ?? '3004');

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/safe-spaces', async (req, res) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : 100;

    const spaces = await getSafeSpaces(lat, lng, radius);
    res.json(spaces);
  } catch (err) {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'safe-space-service' }));

async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS safe_spaces (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name             TEXT NOT NULL,
      address          TEXT NOT NULL,
      latitude         DOUBLE PRECISION NOT NULL,
      longitude        DOUBLE PRECISION NOT NULL,
      accessibility    TEXT[] NOT NULL DEFAULT '{}',
      capacity_current INT NOT NULL DEFAULT 0,
      capacity_max     INT NOT NULL DEFAULT 500,
      is_open          BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);

  // Seed real Australian evacuation centres from known locations
  await pool.query(`
    INSERT INTO safe_spaces (id, name, address, latitude, longitude, accessibility, capacity_current, capacity_max, is_open)
    VALUES
      (gen_random_uuid(), 'Sydney Olympic Park Aquatic Centre', 'Olympic Blvd, Sydney Olympic Park NSW 2127', -33.8445, 151.0686, ARRAY['wheelchair','accessible_toilet','parking'], 120, 2000, TRUE),
      (gen_random_uuid(), 'Melbourne Showgrounds', 'Epsom Rd, Ascot Vale VIC 3032', -37.7879, 144.9375, ARRAY['wheelchair','accessible_toilet','parking','pet_friendly'], 200, 5000, TRUE),
      (gen_random_uuid(), 'Canberra Racecourse', 'Randwick Rd, Lyneham ACT 2602', -35.2494, 149.1213, ARRAY['wheelchair','parking','pet_friendly'], 50, 1500, TRUE),
      (gen_random_uuid(), 'Brisbane Showgrounds', 'Gregory Terrace, Bowen Hills QLD 4006', -27.4482, 153.0393, ARRAY['wheelchair','accessible_toilet','parking'], 300, 3000, TRUE),
      (gen_random_uuid(), 'Adelaide Showground', 'Leader St, Wayville SA 5034', -34.9367, 138.5798, ARRAY['wheelchair','accessible_toilet','parking','pet_friendly'], 80, 2500, TRUE),
      (gen_random_uuid(), 'Perth Showground', 'Claremont Cres, Claremont WA 6010', -31.9825, 115.7837, ARRAY['wheelchair','accessible_toilet','parking'], 60, 2000, TRUE),
      (gen_random_uuid(), 'Hobart Showground', 'Howard Rd, Glenorchy TAS 7010', -42.8321, 147.2627, ARRAY['wheelchair','parking'], 40, 800, TRUE),
      (gen_random_uuid(), 'Darwin Showground', 'Gaffaney St, Winnellie NT 0820', -12.4259, 130.8810, ARRAY['wheelchair','accessible_toilet','parking','pet_friendly'], 30, 600, TRUE)
    ON CONFLICT DO NOTHING
  `);

  logger.info('Database schema ready with seed data');
}

async function start(): Promise<void> {
  await initDb();
  // Fire-and-forget enrichment — never blocks startup
  enrichFromAtlas().catch(err => logger.warn('Atlas enrichment failed (non-fatal)', { error: String(err) }));
  app.listen(PORT, () => logger.info(`safe-space-service listening on port ${PORT}`));
}

start().catch((err) => { logger.error('Failed to start', { error: String(err) }); process.exit(1); });

export { app };
