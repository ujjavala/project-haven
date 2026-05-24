import pool from './db';
import { createLogger } from '@haven/shared';
import type { RecommendationDto } from '@haven/shared';

const logger = createLogger('recommendation-service');

export async function getRecommendations(
  latitude?: number,
  longitude?: number,
  scenario: 'ACTIVE_FIRE' | 'EVACUATION' | 'RECOVERY' = 'ACTIVE_FIRE'
): Promise<RecommendationDto[]> {
  const { rows } = await pool.query(
    `SELECT * FROM recommendations
     WHERE scenario = $1 AND is_verified = TRUE
     ORDER BY priority ASC, title ASC
     LIMIT 20`,
    [scenario]
  );

  logger.info('Recommendations fetched', { count: rows.length, scenario, latitude, longitude });

  return rows.map((r) => ({
    id: r.id as string,
    category: r.category as RecommendationDto['category'],
    title: r.title as string,
    description: r.description as string,
    provider: r.provider as string,
    eligibilitySummary: r.eligibility_summary as string,
    applicationUrl: r.application_url as string | null,
    confidence: r.confidence as number,
    isVerified: r.is_verified as boolean,
  }));
}
