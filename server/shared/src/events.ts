import { randomUUID } from 'crypto';

// ─── Base Event ──────────────────────────────────────────────────────────────

export interface HavenEvent<T = Record<string, unknown>> {
  eventId: string;
  correlationId: string;
  timestamp: string;
  source: string;
  version: string;
  payload: T;
}

export function createEvent<T>(
  source: string,
  payload: T,
  correlationId?: string
): HavenEvent<T> {
  return {
    eventId: randomUUID(),
    correlationId: correlationId ?? randomUUID(),
    timestamp: new Date().toISOString(),
    source,
    version: '1.0',
    payload,
  };
}

// ─── Event Topics ─────────────────────────────────────────────────────────────

export const TOPICS = {
  USER_CREATED: 'user.created',
  LOCATION_UPDATED: 'location.updated',
  WEATHER_UPDATED: 'weather.updated',
  BUSHFIRE_PREDICTED: 'bushfire.predicted',
  ALERT_GENERATED: 'alert.generated',
  FEED_CREATED: 'feed.created',
  SAFE_SPACE_UPDATED: 'safe-space.updated',
} as const;

export type Topic = typeof TOPICS[keyof typeof TOPICS];

// ─── Event Payloads ───────────────────────────────────────────────────────────

export interface UserCreatedPayload {
  userId: string;
  name: string;
  locationId: string | null;
}

export interface LocationUpdatedPayload {
  userId: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
}

export interface WeatherUpdatedPayload {
  locationId: string;
  latitude: number;
  longitude: number;
  temperature: number;   // °C
  humidity: number;      // %
  windSpeed: number;     // km/h
  windDirection: string;
  recordedAt: string;
}

export interface BushfirePredictedPayload {
  predictionId: string;
  latitude: number;
  longitude: number;
  severity: number;        // 0–1
  confidence: number;      // 0–1
  radiusKm: number;
  spreadDirection: string;
  predictedAt: string;
}

export interface AlertGeneratedPayload {
  alertId: string;
  type: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  affectedRadiusKm: number;
  generatedAt: string;
}

export interface FeedCreatedPayload {
  feedId: string;
  userId: string;
  content: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}

export interface SafeSpaceUpdatedPayload {
  safeSpaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  capacityCurrent: number;
  capacityMax: number;
  updatedAt: string;
}
