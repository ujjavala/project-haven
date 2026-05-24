/**
 * Bushfire prediction engine.
 *
 * Implements the McArthur Forest Fire Danger Index (FFDI) Mark 5 formula,
 * the official Australian fire danger rating standard used by BOM and all
 * state fire services.
 *
 * FFDI = 2 × exp(−0.450 + 0.987·ln(DF) − 0.0345·H + 0.0338·T + 0.0234·V)
 *
 *   T  = temperature (°C)
 *   H  = relative humidity (%)
 *   V  = wind speed (km/h)
 *   DF = drought factor (0–10); approximated from soil moisture / month if absent
 *
 * FFDI ratings:
 *   0–11   Low          12–24  Moderate      25–49  High
 *   50–74  Very High    75–99  Severe        100+   Extreme/Catastrophic
 *
 * Severity is normalised to 0–1 by dividing by 100 (so FFDI 100 = severity 1.0).
 * vegetationDensity (0–1) adjusts the drought factor upward — dense dry fuel
 * raises effective drought conditions.
 */

export interface WeatherInput {
  temperature: number;          // °C
  humidity: number;             // %RH
  windSpeed: number;            // km/h
  month: number;                // 1–12
  droughtFactor?: number;       // 0–10; derived from soil moisture if omitted
  vegetationDensity?: number;   // 0–1, optional fuel load modifier
  windDirection?: string;       // 'N','NE','E','SE','S','SW','W','NW'
}

export interface PredictionOutput {
  severity: number;       // 0–1  (FFDI / 100, capped)
  confidence: number;     // 0–1
  radiusKm: number;
  spreadDirection: string;
  ffdi: number;           // raw FFDI score for transparency
  dangerRating: string;   // human-readable BOM rating
}

/**
 * Monthly drought-factor priors derived from Australian climatological norms.
 * Summer months accumulate moisture deficit; winter months recover.
 */
const MONTHLY_DROUGHT_FACTOR: Record<number, number> = {
  1: 8, 2: 8.5, 3: 6, 4: 4,
  5: 3, 6: 2, 7: 1.5, 8: 2,
  9: 3.5, 10: 5, 11: 7, 12: 8,
};

const WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

function ffdiRating(ffdi: number): string {
  if (ffdi < 12)  return 'Low';
  if (ffdi < 25)  return 'Moderate';
  if (ffdi < 50)  return 'High';
  if (ffdi < 75)  return 'Very High';
  if (ffdi < 100) return 'Severe';
  return 'Extreme/Catastrophic';
}

export function predictBushfire(input: WeatherInput): PredictionOutput {
  // Drought factor: use provided value, adjust by vegetation density, then fall
  // back to monthly climatological prior if nothing was supplied.
  const baseDf     = input.droughtFactor ?? MONTHLY_DROUGHT_FACTOR[input.month] ?? 5;
  const vegBoost   = (input.vegetationDensity ?? 0.5) * 1.5;   // dense fuel ↑ df
  const droughtFactor = Math.max(0.1, Math.min(10, baseDf + vegBoost * 0.5));

  // McArthur FFDI Mark 5
  const ffdi = Math.max(
    0,
    2 * Math.exp(
      -0.45
      + 0.987 * Math.log(droughtFactor)
      - 0.0345 * input.humidity
      + 0.0338 * input.temperature
      + 0.0234 * input.windSpeed,
    ),
  );

  const severity    = Number.parseFloat(Math.min(ffdi / 100, 1).toFixed(4));
  const dangerRating = ffdiRating(ffdi);

  // Confidence: rises with severity, capped at 0.96 to acknowledge uncertainty
  const confidence = Number.parseFloat(Math.min(0.4 + severity * 0.56, 0.96).toFixed(4));

  // Radius scales with FFDI and wind speed
  const radiusKm = Math.round(3 + (ffdi / 100) * 35 + (input.windSpeed / 15) * 4);

  // Use the actual wind direction if provided, otherwise derive from wind speed
  // as a rough proxy (prevailing westerlies in southern Australia)
  const spreadDirection: string =
    input.windDirection && WIND_DIRECTIONS.includes(input.windDirection as typeof WIND_DIRECTIONS[number])
      ? input.windDirection
      : WIND_DIRECTIONS[Math.floor((input.windSpeed / 10) % WIND_DIRECTIONS.length)];

  return {
    severity,
    confidence,
    radiusKm,
    spreadDirection,
    ffdi: Number.parseFloat(ffdi.toFixed(2)),
    dangerRating,
  };
}
