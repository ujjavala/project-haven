import pool from './db';
import { createLogger } from '@haven/shared';
import type { SafeSpaceDto } from '@haven/shared';

const logger = createLogger('safe-space-service');

function toDto(row: Record<string, unknown>, userLat?: number, userLng?: number): SafeSpaceDto {
  const lat = row.latitude as number;
  const lng = row.longitude as number;
  let distanceKm: number | null = null;
  let etaMinutes: number | null = null;

  if (userLat !== undefined && userLng !== undefined) {
    // Haversine distance
    const R = 6371;
    const dLat = ((lat - userLat) * Math.PI) / 180;
    const dLng = ((lng - userLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((userLat * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    distanceKm = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
    etaMinutes = Math.round((distanceKm / 60) * 60); // ~60 km/h avg speed
  }

  return {
    id: row.id as string,
    name: row.name as string,
    address: row.address as string,
    latitude: lat,
    longitude: lng,
    etaMinutes,
    accessibility: (row.accessibility as string[]) ?? [],
    capacityCurrent: row.capacity_current as number,
    capacityMax: row.capacity_max as number,
    distanceKm,
    isOpen: row.is_open as boolean,
  };
}

export async function getSafeSpaces(
  userLat?: number,
  userLng?: number,
  radiusKm = 100
): Promise<SafeSpaceDto[]> {
  let rows: Record<string, unknown>[];

  if (userLat !== undefined && userLng !== undefined) {
    const degPerKm = 1 / 111;
    const latDelta = radiusKm * degPerKm;
    const lngDelta = radiusKm * degPerKm / Math.cos((userLat * Math.PI) / 180);

    const result = await pool.query(
      `SELECT * FROM safe_spaces
       WHERE is_open = TRUE
         AND latitude  BETWEEN $1 AND $2
         AND longitude BETWEEN $3 AND $4
       ORDER BY latitude`,
      [userLat - latDelta, userLat + latDelta, userLng - lngDelta, userLng + lngDelta]
    );
    rows = result.rows;
  } else {
    const result = await pool.query('SELECT * FROM safe_spaces WHERE is_open = TRUE LIMIT 50');
    rows = result.rows;
  }

  const spaces = rows.map((r) => toDto(r, userLat, userLng));
  // Sort by distance if available
  spaces.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  logger.info('Safe spaces fetched', { count: spaces.length });
  return spaces;
}
