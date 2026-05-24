import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createLogger } from '@haven/shared';

const logger = createLogger('api-gateway');
const app = express();
const PORT = parseInt(process.env.PORT ?? '8080');

const SERVICES = {
  users:           process.env.USER_SERVICE_URL           ?? 'http://user-service:3001',
  feeds:           process.env.FEED_SERVICE_URL           ?? 'http://feed-service:3002',
  predictions:     process.env.PREDICTION_SERVICE_URL     ?? 'http://prediction-service:3003',
  'safe-spaces':   process.env.SAFE_SPACE_SERVICE_URL     ?? 'http://safe-space-service:3004',
  recommendations: process.env.RECOMMENDATION_SERVICE_URL ?? 'http://recommendation-service:3005',
  alerts:          process.env.ALERT_SERVICE_URL          ?? 'http://alert-service:3006',
  weather:         process.env.PREDICTION_SERVICE_URL     ?? 'http://prediction-service:3003',
};

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Correlation ID
app.use((req, _res, next) => {
  req.headers['x-correlation-id'] ??= crypto.randomUUID();
  next();
});

// Health check (responds instantly without hitting upstream)
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

// Proxy routes — mount at root so Express doesn't strip the prefix.
// pathFilter ensures only matching paths are forwarded, and the full path
// (including the prefix) is forwarded to the upstream service.
for (const [prefix, target] of Object.entries(SERVICES)) {
  app.use(
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathFilter: `/${prefix}`,
      on: {
        error: (err, _req, res) => {
          logger.error('Proxy error', { prefix, target, error: String(err) });
          if (!('headersSent' in res && res.headersSent)) {
            (res as express.Response).status(502).json({ code: 'BAD_GATEWAY', message: 'Upstream unavailable' });
          }
        },
      },
    })
  );
}

app.listen(PORT, () => logger.info(`api-gateway listening on port ${PORT}`));

export { app };
