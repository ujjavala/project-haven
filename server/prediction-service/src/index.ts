import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pool from './db';
import { subscribe } from './bus';
import { handleWeatherUpdate } from './predictionService';
import { enrichFromAtlas } from './atlasEnrich';
import { TOPICS, createLogger } from '@haven/shared';
import type { WeatherUpdatedPayload } from '@haven/shared';

const logger = createLogger('prediction-service');
const app = express();
const PORT = parseInt(process.env.PORT ?? '3003');

app.use(helmet());
app.use(cors());
app.use(express.json());

// Expose latest predictions for a lat/lng bounding box
app.get('/predictions', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 100;

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'lat and lng required' });
      return;
    }

    // Haversine approximation via bounding box (simplified for spike)
    const degPerKm = 1 / 111;
    const latDelta = radius * degPerKm;
    const lngDelta = radius * degPerKm / Math.cos((lat * Math.PI) / 180);

    const { rows } = await pool.query(
      `SELECT
         id, latitude, longitude, severity, confidence,
         radius_km        AS "radiusKm",
         spread_direction AS "spreadDirection",
         predicted_at     AS "predictedAt"
       FROM predictions
       WHERE latitude  BETWEEN $1 AND $2
         AND longitude BETWEEN $3 AND $4
         AND predicted_at > NOW() - INTERVAL '24 hours'
       ORDER BY predicted_at DESC LIMIT 50`,
      [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
  }
});

// Manual weather ingest endpoint (for testing / spike)
// Accepts both {lat,lng} and {latitude,longitude} forms, fills in defaults.
app.post('/weather', async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const payload = {
      locationId:    (b.locationId   as string)  ?? 'manual',
      latitude:      (b.latitude     as number)  ?? (b.lat as number),
      longitude:     (b.longitude    as number)  ?? (b.lng as number),
      temperature:   b.temperature   as number,
      humidity:      b.humidity      as number,
      windSpeed:     b.windSpeed     as number,
      windDirection: (b.windDirection as string) ?? 'N',
      recordedAt:    (b.recordedAt   as string)  ?? new Date().toISOString(),
      season:        b.season,
      vegetationDensity: b.vegetationDensity,
    };
    await handleWeatherUpdate({ payload: payload as Parameters<typeof handleWeatherUpdate>[0]['payload'], correlationId: crypto.randomUUID() });
    res.status(202).json({ status: 'accepted' });
  } catch (err) {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'prediction-service' }));

async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS predictions (
      id               UUID PRIMARY KEY,
      latitude         DOUBLE PRECISION NOT NULL,
      longitude        DOUBLE PRECISION NOT NULL,
      severity         DOUBLE PRECISION NOT NULL,
      confidence       DOUBLE PRECISION NOT NULL,
      radius_km        INT NOT NULL,
      spread_direction TEXT NOT NULL,
      predicted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  logger.info('Database schema ready');
}

async function start(): Promise<void> {
  await initDb();
  // Fire-and-forget enrichment — never blocks startup
  enrichFromAtlas().catch(err => logger.warn('Atlas enrichment failed (non-fatal)', { error: String(err) }));
  // Subscribe to weather events from message broker
  try {
    await subscribe(TOPICS.WEATHER_UPDATED, async (msg) => {
      await handleWeatherUpdate(msg as { payload: WeatherUpdatedPayload; correlationId: string });
    });
  } catch (err) {
    logger.warn('RabbitMQ not available, running without event subscription', { error: String(err) });
  }
  app.listen(PORT, () => logger.info(`prediction-service listening on port ${PORT}`));
}

start().catch((err) => { logger.error('Failed to start', { error: String(err) }); process.exit(1); });

export { app };
