import axios from 'axios';
import type { AlertDto, SafeSpaceDto, FeedDto, RecommendationDto, PredictionDto } from './types';

const api = axios.create({ baseURL: '/api' });

export async function fetchAlerts(lat?: number, lng?: number): Promise<AlertDto[]> {
  const params = lat !== undefined && lng !== undefined ? { lat, lng } : {};
  const { data } = await api.get<AlertDto[]>('/alerts', { params });
  return data;
}

export async function fetchSafeSpaces(lat?: number, lng?: number): Promise<SafeSpaceDto[]> {
  const params = lat !== undefined && lng !== undefined ? { lat, lng } : {};
  const { data } = await api.get<SafeSpaceDto[]>('/safe-spaces', { params });
  return data;
}

export async function fetchFeeds(): Promise<FeedDto[]> {
  const { data } = await api.get<FeedDto[]>('/feeds');
  return data;
}

export async function postFeed(content: string, lat?: number, lng?: number): Promise<FeedDto> {
  const token = localStorage.getItem('haven_token');
  const { data } = await api.post<FeedDto>(
    '/feeds',
    { content, latitude: lat, longitude: lng },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

export async function fetchRecommendations(
  scenario: 'ACTIVE_FIRE' | 'EVACUATION' | 'RECOVERY' = 'ACTIVE_FIRE',
  lat?: number,
  lng?: number
): Promise<RecommendationDto[]> {
  const params: Record<string, unknown> = { scenario };
  if (lat !== undefined) params.lat = lat;
  if (lng !== undefined) params.lng = lng;
  const { data } = await api.get<RecommendationDto[]>('/recommendations', { params });
  return data;
}

export async function fetchPredictions(lat: number, lng: number): Promise<PredictionDto[]> {
  const { data } = await api.get<PredictionDto[]>('/predictions', { params: { lat, lng } });
  return data;
}

export async function triggerWeather(payload: {
  latitude: number; longitude: number;
  temperature: number; humidity: number; windSpeed: number; windDirection: string;
}): Promise<void> {
  await api.post('/weather', {
    ...payload,
    locationId: 'manual-test',
    recordedAt: new Date().toISOString(),
  });
}
