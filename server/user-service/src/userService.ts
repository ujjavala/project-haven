import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db';
import { publish } from './publisher';
import { TOPICS, createEvent, createLogger } from '@haven/shared';
import type {
  UserDto, CreateUserDto, UpdateUserDto, LoginDto, AuthTokenDto, UserPreferences,
} from '@haven/shared';

const logger = createLogger('user-service');
const JWT_SECRET = process.env.JWT_SECRET ?? 'changeme-secret';
const JWT_EXPIRES_IN = 3600;

function toDto(row: Record<string, unknown>): UserDto {
  return {
    id: row.id as string,
    name: row.name as string,
    emailHash: row.email_hash as string,
    locationId: row.location_id as string | null,
    preferences: (row.preferences as UserPreferences) ?? {
      enablePushNotifications: true,
      alertRadius: 50,
      language: 'en',
    },
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function createUser(dto: CreateUserDto): Promise<UserDto> {
  const id = randomUUID();
  const emailHash = await bcrypt.hash(dto.email, 10);
  const passwordHash = await bcrypt.hash(dto.password, 12);
  const prefs: UserPreferences = {
    enablePushNotifications: true,
    alertRadius: 50,
    language: 'en',
    ...(dto.preferences ?? {}),
  };

  const { rows } = await pool.query(
    `INSERT INTO users (id, name, email_hash, password_hash, preferences, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING *`,
    [id, dto.name, emailHash, passwordHash, JSON.stringify(prefs)]
  );

  const user = toDto(rows[0]);

  await publish(TOPICS.USER_CREATED, createEvent('user-service', {
    userId: user.id,
    name: user.name,
    locationId: null,
  }));

  logger.info('User created', { userId: id });
  return user;
}

export async function getUserById(id: string): Promise<UserDto | null> {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows.length ? toDto(rows[0]) : null;
}

export async function updateUser(id: string, dto: UpdateUserDto): Promise<UserDto | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (dto.name !== undefined) { sets.push(`name = $${i++}`); values.push(dto.name); }
  if (dto.preferences !== undefined) { sets.push(`preferences = $${i++}`); values.push(JSON.stringify(dto.preferences)); }

  if (sets.length === 0) return getUserById(id);

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );

  if (!rows.length) return null;

  if (dto.latitude !== undefined && dto.longitude !== undefined) {
    await publish(TOPICS.LOCATION_UPDATED, createEvent('user-service', {
      userId: id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      updatedAt: new Date().toISOString(),
    }));
  }

  return toDto(rows[0]);
}

export async function deleteUser(id: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

export async function login(dto: LoginDto): Promise<AuthTokenDto | null> {
  // Find by matching email prefix pattern (we store hashes, compare via bcrypt)
  // For lookup we store a searchable token: sha256(normalised email)
  const { rows } = await pool.query('SELECT * FROM users WHERE email_search = $1', [
    dto.email.toLowerCase().trim(),
  ]);

  if (!rows.length) return null;
  const row = rows[0];
  const valid = await bcrypt.compare(dto.password, row.password_hash as string);
  if (!valid) return null;

  const token = jwt.sign({ sub: row.id, name: row.name }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  logger.info('User logged in', { userId: row.id });
  return { accessToken: token, userId: row.id as string, expiresIn: JWT_EXPIRES_IN };
}
