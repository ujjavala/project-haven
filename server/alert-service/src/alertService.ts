import { randomUUID } from 'crypto';
import pool from './db';
import { publish } from './bus';
import { TOPICS, createEvent, createLogger } from '@haven/shared';
import type { BushfirePredictedPayload, AlertDto } from '@haven/shared';

const logger = createLogger('alert-service');

function severityToType(severity: number): AlertDto['type'] {
  if (severity >= 0.8) return 'CRITICAL';
  if (severity >= 0.6) return 'HIGH';
  if (severity >= 0.4) return 'MEDIUM';
  return 'LOW';
}

export async function handleBushfirePredicted(event: { payload: BushfirePredictedPayload; correlationId: string }): Promise<void> {
  const p = event.payload;
  if (p.confidence < 0.5) {
    logger.info('Skipping low-confidence prediction', { predictionId: p.predictionId, confidence: p.confidence });
    return;
  }

  const type = severityToType(p.severity);
  const alertId = randomUUID();
  const title = `Bushfire ${type === 'CRITICAL' ? '⚠️ CRITICAL' : type === 'HIGH' ? 'High Risk' : type === 'MEDIUM' ? 'Warning' : 'Advisory'}`;
  const description = `A bushfire risk has been detected ${p.radiusKm} km from your location. Severity: ${Math.round(p.severity * 100)}%. Confidence: ${Math.round(p.confidence * 100)}%. Predicted spread direction: ${p.spreadDirection}.`;

  await pool.query(
    `INSERT INTO alerts (id, type, title, description, latitude, longitude, affected_radius_km, acknowledged, generated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,NOW())`,
    [alertId, type, title, description, p.latitude, p.longitude, p.radiusKm]
  );

  await publish(TOPICS.ALERT_GENERATED, createEvent('alert-service', {
    alertId,
    type,
    title,
    description,
    latitude: p.latitude,
    longitude: p.longitude,
    affectedRadiusKm: p.radiusKm,
    generatedAt: new Date().toISOString(),
  }, event.correlationId));

  logger.info('Alert generated', { alertId, type, severity: p.severity });
}

export async function getAlerts(latitude?: number, longitude?: number): Promise<AlertDto[]> {
  let rows: Record<string, unknown>[];

  if (latitude !== undefined && longitude !== undefined) {
    const degPerKm = 1 / 111;
    const delta = 200 * degPerKm;
    const result = await pool.query(
      `SELECT * FROM alerts
       WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4
         AND generated_at > NOW() - INTERVAL '48 hours'
       ORDER BY generated_at DESC LIMIT 50`,
      [latitude - delta, latitude + delta, longitude - delta, longitude + delta]
    );
    rows = result.rows;
  } else {
    const result = await pool.query(
      `SELECT * FROM alerts
       WHERE generated_at > NOW() - INTERVAL '48 hours'
       ORDER BY generated_at DESC LIMIT 50`
    );
    rows = result.rows;
  }

  return rows.map((r) => ({
    id: r.id as string,
    type: r.type as AlertDto['type'],
    title: r.title as string,
    description: r.description as string,
    latitude: r.latitude as number,
    longitude: r.longitude as number,
    affectedRadiusKm: r.affected_radius_km as number,
    acknowledged: r.acknowledged as boolean,
    generatedAt: (r.generated_at as Date).toISOString(),
  }));
}
