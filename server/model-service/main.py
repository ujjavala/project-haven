"""
Haven Model Service — FastAPI sidecar for the XGBoost bushfire model.

POST /predict  → given month, state, and optionally perim_km, returns:
  predicted_area_ha  — expected fire size in hectares (historical regression)
  normalized_scale   — 0-1 percentile relative to training distribution
  confidence         — 0-1 (higher when state is in training data)

GET /health    → {"status": "ok"}

The model is trained at Docker build time (see Dockerfile + train.py) so this
service starts immediately with no training overhead.

INTEGRATION NOTE
─────────────────
This service does NOT replace the FFDI weather-based score in engine.ts.
The prediction-service calls both:

  FFDI score  (engine.ts)   — real-time danger: temperature, humidity, wind
  Model score (this service) — historical context: state + month + fire size

  blendedSeverity = FFDI_severity × 0.80 + normalizedScale × 0.20

If this service is unreachable, the prediction-service falls back to
FFDI-only scoring — there is no hard dependency on the critical path.
"""

import json
import logging

import numpy as np
import pandas as pd
import xgboost as xgb
from fastapi import FastAPI
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("model-service")

# ── Load model and metadata at startup ───────────────────────────────────────
_model = xgb.Booster()
_model.load_model("xgb_bushfire.json")

with open("engine_meta.json") as f:
    _META = json.load(f)

FEATURE_COLS:  list[str] = _META["feature_cols"]
KNOWN_STATES:  list[str] = _META["known_states"]
MEDIAN_PERIM:  float     = _META["median_perim_km"]
P5:            float     = _META["normalization"]["p5"]
P95:           float     = _META["normalization"]["p95"]

logger.info("Model loaded. Known states: %s", KNOWN_STATES)
logger.info("Norm range: p5=%.1f ha, p95=%.1f ha", P5, P95)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Haven Model Service",
    description="XGBoost fire-size prediction sidecar",
    version="1.0",
)


class PredictRequest(BaseModel):
    month:    int   = Field(..., ge=1, le=12, description="Month of interest (1–12)")
    state:    str   = Field(..., description="AU state code: NSW VIC QLD SA WA TAS ACT")
    year:     int   = Field(default=2024, ge=1970, le=2100)
    perim_km: float = Field(default=None, ge=0, description="Known fire perimeter km (defaults to training median)")


class PredictResponse(BaseModel):
    predicted_area_ha: float
    normalized_scale:  float   # 0–1 percentile in training distribution
    confidence:        float   # 0–1


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": "xgb_bushfire", "states": KNOWN_STATES}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    perim  = req.perim_km if req.perim_km is not None else MEDIAN_PERIM
    state  = req.state.upper().strip()

    # Build a single-row feature frame matching training columns exactly
    row: dict = {
        "ignition_year":  req.year,
        "ignition_month": req.month,
        "perim_km":       perim,
    }
    # One-hot encode state; unseen states → all zeros (treated as 'other')
    for col in FEATURE_COLS:
        if col.startswith("state_") and col not in row:
            row[col] = 1 if col == f"state_{state}" else 0
    # Fill any remaining columns with 0
    for col in FEATURE_COLS:
        row.setdefault(col, 0)

    df  = pd.DataFrame([row])[FEATURE_COLS]
    dm  = xgb.DMatrix(df)
    raw = float(_model.predict(dm)[0])
    raw = max(0.0, raw)

    # Normalise to 0–1 using training p5/p95
    scale = (raw - P5) / (P95 - P5) if P95 > P5 else 0.5
    scale = float(np.clip(scale, 0.0, 1.0))

    # Confidence: lower when state is outside training distribution
    conf = 0.75 if state in KNOWN_STATES else 0.40

    logger.info(
        "predict month=%d state=%s → %.1f ha  scale=%.4f  conf=%.2f",
        req.month, state, raw, scale, conf,
    )

    return PredictResponse(
        predicted_area_ha=round(raw, 1),
        normalized_scale=round(scale, 4),
        confidence=round(conf, 4),
    )
