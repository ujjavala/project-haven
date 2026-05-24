/**
 * Bushfire prediction engine.
 *
 * Uses a rule-based heuristic that mirrors the XGBoost model trained in the
 * notebooks. Real deployment would call the serialised model via a Python
 * sidecar; here we replicate the key feature weights as coefficients so the
 * service is fully self-contained and testable in Docker.
 *
 * Features used (matching training dataset):
 *  - temperature  (°C)   weight: +0.35
 *  - windSpeed    (km/h) weight: +0.25
 *  - humidity     (%)    weight: -0.30   (inverse: drier = higher risk)
 *  - month        (1-12) peak bushfire season = Nov-Feb (months 11,12,1,2)
 */

export interface WeatherInput {
  temperature: number;
  humidity: number;
  windSpeed: number;
  month: number;
}

export interface PredictionOutput {
  severity: number;       // 0–1 normalised
  confidence: number;     // 0–1
  radiusKm: number;
  spreadDirection: string;
}

const SEASON_BONUS: Record<number, number> = {
  1: 0.20, 2: 0.18, 11: 0.20, 12: 0.22,   // peak
  3: 0.08, 10: 0.06,                        // shoulder
};

export function predictBushfire(input: WeatherInput): PredictionOutput {
  const tempScore     = Math.min(input.temperature / 45, 1) * 0.35;
  const windScore     = Math.min(input.windSpeed   / 100, 1) * 0.25;
  const humidityScore = Math.max(1 - input.humidity / 100, 0) * 0.30;
  const seasonBonus   = SEASON_BONUS[input.month] ?? 0;

  const rawSeverity = tempScore + windScore + humidityScore + seasonBonus;
  const severity    = Math.min(parseFloat(rawSeverity.toFixed(4)), 1);

  // Confidence increases with extreme values
  const confidence = parseFloat(Math.min(0.5 + severity * 0.5, 0.98).toFixed(4));

  // Radius scales with severity and wind
  const radiusKm = Math.round(5 + severity * 30 + (input.windSpeed / 10) * 2);

  // Wind direction approximation from wind speed as placeholder
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const spreadDirection = directions[Math.floor((input.windSpeed * 13) % 8)];

  return { severity, confidence, radiusKm, spreadDirection };
}
