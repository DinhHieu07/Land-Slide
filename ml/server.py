from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Dict, Optional

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent

load_dotenv(ROOT / ".env")

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("ml-service")

ARTIFACTS_DIR = Path(os.getenv("ML_ARTIFACTS_DIR", str(ROOT / "artifacts")))
MODEL_PATH = ARTIFACTS_DIR / "alert_rf.joblib"
LABEL_MAP_PATH = ARTIFACTS_DIR / "label_map.json"

app = FastAPI(title="Landslide ML Service", version="1.0.0")

class PredictRequest(BaseModel):
    rain_percent: float
    soil_moisture: float
    tilt_angle: float
    vibration_count: float
    rain_warning_elapsed_sec: float = 0.0
    rain_danger_elapsed_sec: float = 0.0

class PredictResponse(BaseModel):
    predicted_label: str
    probabilities: Optional[Dict[str, float]] = None

class ModelRuntime:
    def __init__(self) -> None:
        self.pipeline = None
        self.features: list[str] = []

    def load(self) -> None:
        if not MODEL_PATH.is_file():
            raise RuntimeError(f"Khong tim thay model: {MODEL_PATH}")
        if not LABEL_MAP_PATH.is_file():
            raise RuntimeError(f"Khong tim thay label_map: {LABEL_MAP_PATH}")

        with open(LABEL_MAP_PATH, encoding="utf-8") as f:
            metadata = json.load(f)
        self.features = list(metadata.get("features", []))
        if not self.features:
            raise RuntimeError("label_map.json khong co danh sach features")

        self.pipeline = joblib.load(MODEL_PATH)

    def predict(self, payload: PredictRequest) -> PredictResponse:
        if self.pipeline is None or not self.features:
            raise RuntimeError("Model chua duoc khoi tao")

        row = payload.model_dump()
        missing = [c for c in self.features if c not in row]
        if missing:
            raise RuntimeError(f"Thieu features bat buoc: {missing}")

        x_frame = pd.DataFrame([{c: row[c] for c in self.features}])
        pred = self.pipeline.predict(x_frame)[0]

        probabilities = None
        if hasattr(self.pipeline, "predict_proba"):
            probs = self.pipeline.predict_proba(x_frame)[0]
            classes = self.pipeline.classes_
            probabilities = {str(classes[i]): float(probs[i]) for i in range(len(classes))}

        return PredictResponse(predicted_label=str(pred), probabilities=probabilities)

runtime = ModelRuntime()

@app.on_event("startup")
def on_startup() -> None:
    logger.info("Starting ML service")
    logger.info("Model path: %s", MODEL_PATH)
    logger.info("Label map path: %s", LABEL_MAP_PATH)
    try:
        runtime.load()
        logger.info("Model loaded successfully. features=%s", runtime.features)
    except Exception:
        logger.exception("Failed to load model on startup")
        raise

@app.get("/health")
def health() -> dict:
    logger.info("Health check called. model_ready=%s", runtime.pipeline is not None)
    return {
        "ok": runtime.pipeline is not None,
        "model_path": str(MODEL_PATH),
        "label_map_path": str(LABEL_MAP_PATH),
        "features": runtime.features,
    }

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    try:
        result = runtime.predict(req)
        logger.info(
            "Prediction success. label=%s probs=%s",
            result.predicted_label,
            result.probabilities,
        )
        return result
    except RuntimeError as err:
        logger.warning("Prediction runtime error: %s", err)
        raise HTTPException(status_code=400, detail=str(err)) from err
    except Exception as err:  # pragma: no cover
        logger.exception("Prediction unexpected error")
        raise HTTPException(status_code=500, detail=f"Prediction error: {err}") from err