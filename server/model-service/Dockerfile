# ── Stage 1: train ────────────────────────────────────────────────────────────
# Trains the XGBoost model from the GA Historical Bushfire Boundaries CSV.
# The trained model is baked into the final image so startup is instant.
FROM python:3.11-slim AS trainer
WORKDIR /app

COPY server/model-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy training data and script
COPY notebooks/Historical_Bushfire_Boundaries.csv ./data/
COPY server/model-service/train.py .

RUN python train.py

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

COPY server/model-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/model-service/main.py .

# Bring in the trained model artefacts from the trainer stage
COPY --from=trainer /app/xgb_bushfire.json .
COPY --from=trainer /app/engine_meta.json  .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
