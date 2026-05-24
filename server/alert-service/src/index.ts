import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pool from './db';
import { subscribe } from './bus';
import { handleBushfirePredicted, getAlerts } from './alertService';
import { TOPICS, createLogger } from '@haven/shared';
import type { BushfirePredictedPayload } from '@haven/shared';

const logger = createLogger('alert-service');
const app = express();
const PORT = parseInt(process.env.PORT ?? '3006');

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/alerts', async (req, res) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const alerts = await getAlerts(lat, lng);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
  }
});

// Manual alert trigger for testing
app.post('/alerts/trigger', async (req, res) => {
  try {
    await handleBushfirePredicted({ payload: req.body, correlationId: crypto.randomUUID() });
    res.status(202).json({ status: 'accepted' });
  } catch (err) {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'alert-service' }));

async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id                UUID PRIMARY KEY,
      type              TEXT NOT NULL,
      title             TEXT NOT NULL,
      description       TEXT NOT NULL,
      latitude          DOUBLE PRECISION NOT NULL,
      longitude         DOUBLE PRECISION NOT NULL,
      affected_radius_km INT NOT NULL,
      acknowledged      BOOLEAN NOT NULL DEFAULT FALSE,
      generated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  logger.info('Database schema ready');
}

async function start(): Promise<void> {
  await initDb();
  try {
    await subscribe(TOPICS.BUSHFIRE_PREDICTED, async (msg) => {
      await handleBushfirePredicted(msg as { payload: BushfirePredictedPayload; correlationId: string });
    });
  } catch (err) {
    logger.warn('RabbitMQ not available, running without event subscription', { error: String(err) });
  }
  app.listen(PORT, () => logger.info(`alert-service listening on port ${PORT}`));
}

start().catch((err) => { logger.error('Failed to start', { error: String(err) }); process.exit(1); });

export { app };
