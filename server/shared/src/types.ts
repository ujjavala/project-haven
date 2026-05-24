// ─── Common DTOs ──────────────────────────────────────────────────────────────

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserDto {
  id: string;
  name: string;
  emailHash: string;
  locationId: string | null;
  preferences: UserPreferences;
  createdAt: string;
}

export interface UserPreferences {
  enablePushNotifications: boolean;
  alertRadius: number; // km
  language: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  latitude?: number;
  longitude?: number;
  preferences?: Partial<UserPreferences>;
}

export interface UpdateUserDto {
  name?: string;
  latitude?: number;
  longitude?: number;
  preferences?: Partial<UserPreferences>;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokenDto {
  accessToken: string;
  userId: string;
  expiresIn: number;
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export interface FeedDto {
  id: string;
  userId: string;
  content: string;
  latitude: number | null;
  longitude: number | null;
  verified: boolean;
  createdAt: string;
}

export interface CreateFeedDto {
  content: string;
  latitude?: number;
  longitude?: number;
}

// ─── Prediction ───────────────────────────────────────────────────────────────

export interface PredictionDto {
  id: string;
  latitude: number;
  longitude: number;
  severity: number;
  confidence: number;
  radiusKm: number;
  spreadDirection: string;
  predictedAt: string;
}

// ─── Safe Space ───────────────────────────────────────────────────────────────

export interface SafeSpaceDto {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  etaMinutes: number | null;
  accessibility: string[];
  capacityCurrent: number;
  capacityMax: number;
  distanceKm: number | null;
  isOpen: boolean;
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export interface AlertDto {
  id: string;
  type: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  affectedRadiusKm: number;
  acknowledged: boolean;
  generatedAt: string;
}

// ─── Recommendation ───────────────────────────────────────────────────────────

export interface RecommendationDto {
  id: string;
  category: 'GRANT' | 'HOUSING' | 'EMERGENCY' | 'RECOVERY' | 'HEALTH';
  title: string;
  description: string;
  provider: string;
  eligibilitySummary: string;
  applicationUrl: string | null;
  confidence: number;
  isVerified: boolean;
}

// ─── JWT Payload ──────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;   // userId
  name: string;
  iat?: number;
  exp?: number;
}
