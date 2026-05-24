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

// Hermes Agent self-hosted sidecar (OpenAI-compatible API server on port 8642)
const HERMES_BASE = process.env.HERMES_URL ?? 'http://hermes:8642';

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

// ── Hermes AI proxy (/assistant/* → Hermes Agent sidecar) ────────────────
// The API_SERVER_KEY is injected server-side; clients never see it.
app.use(
  createProxyMiddleware({
    target: HERMES_BASE,
    changeOrigin: true,
    pathFilter: '/assistant',
    pathRewrite: { '^/assistant': '/v1' },
    on: {
      proxyReq: (proxyReq) => {
        // Strip any client-side auth header, inject the server's API_SERVER_KEY.
        proxyReq.removeHeader('authorization');
        proxyReq.setHeader('Authorization', `Bearer ${process.env.HERMES_API_KEY ?? ''}`);
      },
      error: (err, _req, res) => {
        logger.error('Hermes proxy error', { error: String(err) });
        if (!('headersSent' in res && res.headersSent)) {
          (res as express.Response).status(502).json({ code: 'BAD_GATEWAY', message: 'AI service unavailable' });
        }
      },
    },
  })
);

// ── Recovery grant research (/recommendations/research) ────────────────────
// Delegates a web-grounded research task to Hermes and returns structured grants.
app.post('/recommendations/research', express.json(), async (req, res) => {
  const { postcode, situation } = req.body as { postcode?: string; situation?: string };
  if (!postcode || !situation) {
    res.status(400).json({ code: 'MISSING_FIELDS', message: 'postcode and situation are required' });
    return;
  }

  try {
    const hermesRes = await fetch(`${HERMES_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HERMES_API_KEY ?? ''}`,
      },
      body: JSON.stringify({
        model: 'hermes-agent',
        messages: [
          {
            role: 'system',
            content: 'You are an Australian emergency recovery specialist. Return ONLY a valid JSON array — no markdown fences, no commentary, just the array.',
          },
          {
            role: 'user',
            content: `Research current Australian government disaster recovery grants available for postcode ${postcode}. Situation: ${situation}. Return a JSON array where each object has: title (string), provider (string), description (string), applicationUrl (string), eligibilitySummary (string). Only include programs that are currently verifiable and open.`,
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!hermesRes.ok) {
      throw new Error(`Hermes API responded with ${hermesRes.status}`);
    }

    const data = await hermesRes.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '[]';

    // Strip accidental markdown code fences if model wraps them
    const cleaned = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const grants = JSON.parse(cleaned);
    res.json({ grants });
  } catch (err) {
    logger.error('Grant research failed', { error: String(err) });
    res.status(502).json({ code: 'RESEARCH_FAILED', message: 'Failed to retrieve grant data' });
  }
});

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
