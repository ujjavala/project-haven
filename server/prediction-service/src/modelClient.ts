/**
 * modelClient.ts
 *
 * Thin client for the Python model-service sidecar (XGBoost).
 *
 * The model was trained on the Geoscience Australia Historical Bushfire
 * Boundaries dataset and predicts expected fire size (area_ha) given
 * month, state, and fire perimeter. We normalise that prediction to a
 * 0–1 "historical scale factor" which is blended into the FFDI severity
 * score at a 20% weight.
 *
 * IMPORTANT: this is non-critical path. If model-service is unavailable
 * (down, starting up, timed out) we return null and the caller falls back
 * to FFDI-only scoring. The timeout is deliberately tight (2 s).
 */

import { createLogger } from '@haven/shared';

const logger = createLogger('prediction-service:model-client');
const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL ?? 'http://model-service:8000';

/**
 * Infer the Australian state from lat/lon using bounding boxes.
 * More-specific boxes are checked first (ACT, TAS) to avoid being swallowed
 * by surrounding states.
 */
const STATE_BOUNDS: Array<{
  state: string;
  latMin: number; latMax: number;
  lonMin: number; lonMax: number;
}> = [
  // Smallest first so they win over larger bounding boxes
  { state: 'ACT', latMin: -35.92, latMax: -35.1,  lonMin: 148.76, lonMax: 149.4 },
  { state: 'TAS', latMin: -43.7,  latMax: -39.5,  lonMin: 144,    lonMax: 148.5 },
  { state: 'VIC', latMin: -39.2,  latMax: -34,    lonMin: 141,    lonMax: 150 },
  { state: 'NSW', latMin: -37.5,  latMax: -28,    lonMin: 141,    lonMax: 154 },
  { state: 'SA',  latMin: -38,    latMax: -26,    lonMin: 129,    lonMax: 141 },
  { state: 'QLD', latMin: -29,    latMax: -10,    lonMin: 138,    lonMax: 154 },
  { state: 'WA',  latMin: -35.2,  latMax: -14,    lonMin: 114,    lonMax: 129 },
];

export function inferState(lat: number, lon: number): string {
  for (const b of STATE_BOUNDS) {
    if (lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax) {
      return b.state;
    }
  }
  return 'NSW'; // mainland default
}

export interface ModelPrediction {
  predictedAreaHa:  number;   // hectares
  normalizedScale:  number;   // 0–1 percentile in training distribution
  confidence:       number;   // 0–1
  state:            string;   // inferred state
}

/**
 * Call model-service /predict and return the XGBoost result.
 * Returns null on any failure (timeout, service down, bad response).
 */
export async function fetchModelPrediction(
  month:     number,
  latitude:  number,
  longitude: number,
): Promise<ModelPrediction | null> {
  const state = inferState(latitude, longitude);
  const year  = new Date().getFullYear();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_000);

  try {
    const resp = await fetch(`${MODEL_SERVICE_URL}/predict`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ month, state, year }),
      signal:  controller.signal,
    });

    if (!resp.ok) {
      logger.warn('model-service returned non-200', { status: resp.status });
      return null;
    }

    const data = await resp.json() as {
      predicted_area_ha: number;
      normalized_scale:  number;
      confidence:        number;
    };

    return {
      predictedAreaHa: data.predicted_area_ha,
      normalizedScale: data.normalized_scale,
      confidence:      data.confidence,
      state,
    };
  } catch (err) {
    // AbortError = timeout; any other error = service down
    logger.warn('model-service unavailable — using FFDI-only scoring', {
      reason: (err as Error).name,
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
