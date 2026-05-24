import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cron from 'node-cron';
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

// Ollama OpenAI-compatible endpoint — nous-hermes2, no separate agent container needed
const HERMES_BASE       = process.env.HERMES_URL    ?? 'http://host.docker.internal:11434';
const HERMES_MODEL      = process.env.HERMES_MODEL  ?? 'nous-hermes2';
const FEED_URL_INTERNAL = process.env.FEED_SERVICE_URL_INTERNAL ?? process.env.FEED_SERVICE_URL ?? 'http://feed-service:3002';

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

// ── Ollama AI proxy (/assistant/* → Ollama OpenAI-compatible endpoint) ──────
// Rewrites /assistant/v1/chat/completions → Ollama /v1/chat/completions
// Local Ollama does not require authentication.
app.use(
  createProxyMiddleware({
    target: HERMES_BASE,
    changeOrigin: true,
    pathFilter: '/assistant',
    pathRewrite: { '^/assistant': '' },
    on: {
      error: (err, _req, res) => {
        logger.error('Ollama proxy error', { error: String(err) });
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
      },
      body: JSON.stringify({
        model: HERMES_MODEL,
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

// ── Daily fire-season morning briefing ──────────────────────────────────────
// Fires at 6 AM daily. Skips outside Australian fire season (Apr–Sep).
// Prompts nous-hermes2 for a structured briefing, then POSTs to the feed service.
cron.schedule('0 6 * * *', async () => {
  const month = new Date().getMonth() + 1;
  const inFireSeason = month >= 10 || month <= 3;
  if (!inFireSeason) return;

  logger.info('Running daily fire-risk briefing');
  try {
    const ollamaRes = await fetch(`${HERMES_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: HERMES_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an Australian bushfire risk analyst. Return ONLY valid JSON — no markdown, no commentary.',
          },
          {
            role: 'user',
            content: `Today is ${new Date().toDateString()}. Produce a morning fire-risk briefing for NSW, VIC, SA, and WA based on seasonal conditions. State the overall severity, highest-risk regions, and one practical action for residents. Keep summary under 80 words. Respond with JSON only: {"severity":"LOW|MEDIUM|HIGH|EXTREME|CATASTROPHIC","summary":"..."}`,
          },
        ],
        max_tokens: 300,
      }),
    });

    if (!ollamaRes.ok) throw new Error(`Ollama responded with ${ollamaRes.status}`);

    const data = await ollamaRes.json() as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const { severity, summary } = JSON.parse(cleaned) as { severity: string; summary: string };

    await fetch(`${FEED_URL_INTERNAL}/feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'FIRE_BRIEFING',
        severity,
        content: summary,
        source: 'haven-ai',
        correlationId: crypto.randomUUID(),
      }),
    });

    logger.info('Fire-risk briefing published', { severity });
  } catch (err) {
    logger.error('Fire briefing cron failed', { error: String(err) });
  }
});

app.listen(PORT, () => logger.info(`api-gateway listening on port ${PORT}`));

export { app };
