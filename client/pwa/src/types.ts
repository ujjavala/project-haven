// Shared types mirroring server/shared/src/types.ts
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

export interface FeedDto {
  id: string;
  userId: string;
  content: string;
  latitude: number | null;
  longitude: number | null;
  verified: boolean;
  createdAt: string;
}

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

export interface UserLocation {
  latitude: number;
  longitude: number;
}
