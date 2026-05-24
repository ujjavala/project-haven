import { randomUUID } from 'crypto';
import pool from './db';
import { publish } from './publisher';
import { TOPICS, createEvent, createLogger } from '@haven/shared';
import type { FeedDto, CreateFeedDto, PaginationQuery } from '@haven/shared';

const logger = createLogger('feed-service');

function toDto(row: Record<string, unknown>): FeedDto {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    content: row.content as string,
    latitude: row.latitude as number | null,
    longitude: row.longitude as number | null,
    verified: row.verified as boolean,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function createFeed(userId: string, dto: CreateFeedDto): Promise<FeedDto> {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO feeds (id, user_id, content, latitude, longitude, verified, created_at)
     VALUES ($1, $2, $3, $4, $5, false, NOW()) RETURNING *`,
    [id, userId, dto.content, dto.latitude ?? null, dto.longitude ?? null]
  );
  const feed = toDto(rows[0]);

  await publish(TOPICS.FEED_CREATED, createEvent('feed-service', {
    feedId: feed.id,
    userId: feed.userId,
    content: feed.content,
    latitude: feed.latitude,
    longitude: feed.longitude,
    createdAt: feed.createdAt,
  }));

  logger.info('Feed created', { feedId: id, userId });
  return feed;
}

export async function getFeeds(query: PaginationQuery): Promise<FeedDto[]> {
  const limit = Math.min(query.limit ?? 20, 100);
  const offset = ((query.page ?? 1) - 1) * limit;
  const { rows } = await pool.query(
    'SELECT * FROM feeds WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return rows.map(toDto);
}

export async function deleteFeed(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'UPDATE feeds SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}

export async function getFeedById(id: string): Promise<FeedDto | null> {
  const { rows } = await pool.query(
    'SELECT * FROM feeds WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return rows.length ? toDto(rows[0]) : null;
}
