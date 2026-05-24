import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pool from './db';
import router from './routes';
import { createLogger } from '@haven/shared';

const logger = createLogger('user-service');
const app = express();
const PORT = parseInt(process.env.PORT ?? '3001');

app.use(helmet());
app.use(cors());
app.use(express.json());

// Correlation ID middleware
app.use((req, _res, next) => {
  req.headers['x-correlation-id'] ??= crypto.randomUUID();
  next();
});

app.use('/users', router);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'user-service' }));

async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY,
      name          TEXT NOT NULL,
      email_hash    TEXT NOT NULL,
      email_search  TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      location_id   UUID,
      preferences   JSONB NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  logger.info('Database schema ready');
}

async function start(): Promise<void> {
  await initDb();
  app.listen(PORT, () => logger.info(`user-service listening on port ${PORT}`));
}

start().catch((err) => {
  logger.error('Failed to start', { error: String(err) });
  process.exit(1);
});

export { app };
