from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, Optional

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent
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
    runtime.load()

@app.get("/health")
def health() -> dict:
    return {
        "ok": runtime.pipeline is not None,
        "model_path": str(MODEL_PATH),
        "label_map_path": str(LABEL_MAP_PATH),
        "features": runtime.features,
    }

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    try:
        return runtime.predict(req)
    except RuntimeError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    except Exception as err:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Prediction error: {err}") from err