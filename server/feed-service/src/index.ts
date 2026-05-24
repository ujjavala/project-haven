import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pool from './db';
import router from './routes';
import { createLogger } from '@haven/shared';

const logger = createLogger('feed-service');
const app = express();
const PORT = parseInt(process.env.PORT ?? '3002');

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/feeds', router);
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'feed-service' }));

async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feeds (
      id         UUID PRIMARY KEY,
      user_id    UUID NOT NULL,
      content    TEXT NOT NULL,
      latitude   DOUBLE PRECISION,
      longitude  DOUBLE PRECISION,
      verified   BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `);
  logger.info('Database schema ready');
}

async function start(): Promise<void> {
  await initDb();
  app.listen(PORT, () => logger.info(`feed-service listening on port ${PORT}`));
}

start().catch((err) => { logger.error('Failed to start', { error: String(err) }); process.exit(1); });

export { app };
