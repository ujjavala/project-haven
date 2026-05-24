import { randomUUID } from 'crypto';
import pool from './db';
import { publish } from './bus';
import { predictBushfire } from './engine';
import { TOPICS, createEvent, createLogger } from '@haven/shared';
import type { WeatherUpdatedPayload, BushfirePredictedPayload } from '@haven/shared';

const logger = createLogger('prediction-service');
const SEVERITY_ALERT_THRESHOLD = 0.45;

export async function handleWeatherUpdate(event: { payload: WeatherUpdatedPayload; correlationId: string }): Promise<void> {
  const w = event.payload as WeatherUpdatedPayload & { season?: string; vegetationDensity?: number };
  const month = w.recordedAt ? new Date(w.recordedAt).getMonth() + 1 : new Date().getMonth() + 1;

  const result = predictBushfire({
    temperature: w.temperature,
    humidity: w.humidity,
    windSpeed: w.windSpeed,
    month,
  });

  const predictionId = randomUUID();

  await pool.query(
    `INSERT INTO predictions (id, latitude, longitude, severity, confidence, radius_km, spread_direction, predicted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
    [predictionId, w.latitude, w.longitude, result.severity, result.confidence, result.radiusKm, result.spreadDirection]
  );

  const payload: BushfirePredictedPayload = {
    predictionId,
    latitude: w.latitude,
    longitude: w.longitude,
    severity: result.severity,
    confidence: result.confidence,
    radiusKm: result.radiusKm,
    spreadDirection: result.spreadDirection,
    predictedAt: new Date().toISOString(),
  };

  await publish(TOPICS.BUSHFIRE_PREDICTED, createEvent('prediction-service', payload, event.correlationId));

  if (result.severity >= SEVERITY_ALERT_THRESHOLD) {
    logger.warn('High severity prediction — alert threshold crossed', {
      predictionId, severity: result.severity, confidence: result.confidence,
    });
  }

  logger.info('Prediction completed', { predictionId, severity: result.severity });
}
