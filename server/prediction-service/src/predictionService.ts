import { randomUUID } from 'node:crypto';
import pool from './db';
import { publish } from './bus';
import { predictBushfire } from './engine';
import { fetchModelPrediction } from './modelClient';
import { TOPICS, createEvent, createLogger } from '@haven/shared';
import type { WeatherUpdatedPayload, BushfirePredictedPayload } from '@haven/shared';

const logger = createLogger('prediction-service');
const SEVERITY_ALERT_THRESHOLD = 0.45;

// Blend weights: FFDI captures real-time conditions; XGBoost adds historical
// seasonal/regional context.  FFDI is the primary signal (80 %).
const FFDI_WEIGHT  = 0.8;
const MODEL_WEIGHT = 0.2;

export async function handleWeatherUpdate(event: { payload: WeatherUpdatedPayload; correlationId: string }): Promise<void> {
  const w = event.payload as WeatherUpdatedPayload & { season?: string; vegetationDensity?: number };
  const month = w.recordedAt ? new Date(w.recordedAt).getMonth() + 1 : new Date().getMonth() + 1;

  // ── FFDI engine (primary, always runs) ─────────────────────────────────────
  const result = predictBushfire({
    temperature: w.temperature,
    humidity: w.humidity,
    windSpeed: w.windSpeed,
    month,
    droughtFactor:     (w as any).droughtFactor,
    vegetationDensity: (w as any).vegetationDensity,
    windDirection:     (w as any).windDirection,
  });

  // ── XGBoost model sidecar (secondary, non-blocking, graceful fallback) ─────
  const modelPred = await fetchModelPrediction(month, w.latitude, w.longitude);

  const severity = modelPred
    ? Number.parseFloat(Math.min(
        result.severity * FFDI_WEIGHT + modelPred.normalizedScale * MODEL_WEIGHT, 1,
      ).toFixed(4))
    : result.severity;

  const confidence = modelPred
    ? Number.parseFloat(Math.min(
        result.confidence * 0.7 + modelPred.confidence * 0.3, 0.96,
      ).toFixed(4))
    : result.confidence;

  if (modelPred) {
    logger.info('XGBoost blend applied', {
      ffdiSeverity:   result.severity,
      modelScale:     modelPred.normalizedScale,
      blendedSeverity: severity,
      inferredState:  modelPred.state,
      predictedAreaHa: modelPred.predictedAreaHa,
    });
  }

  const predictionId = randomUUID();

  await pool.query(
    `INSERT INTO predictions (id, latitude, longitude, severity, confidence, radius_km, spread_direction, predicted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
    [predictionId, w.latitude, w.longitude, severity, confidence, result.radiusKm, result.spreadDirection]
  );

  const payload: BushfirePredictedPayload = {
    predictionId,
    latitude: w.latitude,
    longitude: w.longitude,
    severity,
    confidence,
    radiusKm: result.radiusKm,
    spreadDirection: result.spreadDirection,
    predictedAt: new Date().toISOString(),
  };

  await publish(TOPICS.BUSHFIRE_PREDICTED, createEvent('prediction-service', payload, event.correlationId));

  if (severity >= SEVERITY_ALERT_THRESHOLD) {
    logger.warn('High severity prediction — alert threshold crossed', {
      predictionId, severity, confidence,
    });
  }

  logger.info('Prediction completed', { predictionId, severity: result.severity });
}
