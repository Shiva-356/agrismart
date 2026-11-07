"""AgriSmart FastAPI inference service.

Serves the model trained by ml/train.py. It never invents a prediction: if the
model artifact is missing the service returns 503.

Run:
    python -m pip install -r ml/requirements.txt
    uvicorn ml.api.main:app --reload --port 8000
"""

from __future__ import annotations

import json
import math
import os
from typing import Any

import joblib
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from ml.src.soil.soil_classifier import (
    SOIL_IMAGE_MAX_BYTES,
    SoilImageValidationError,
    SoilModelUnavailableError,
    classify_soil_image_bytes,
    resolve_soil_artifact_paths,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "artifacts")

UNCALIBRATED_SCORE_NOTE = (
    "Scores are uncalibrated Random Forest class score averages from the benchmark dataset, "
    "not calibrated field probabilities or yield guarantees."
)

app = FastAPI(title="AgriSmart ML API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("AGRISMART_CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load(name: str) -> Any:
    path = os.path.join(ART, name)
    if not os.path.exists(path):
        return None
    if name.endswith(".joblib"):
        return joblib.load(path)
    with open(path) as f:
        return json.load(f)


BUNDLE = _load("model.joblib")
EVALUATION = _load("evaluation_results.json")
DATASET = _load("dataset_metadata.json")


class PredictRequest(BaseModel):
    """Strict 7-feature ML input contract.

    `rainfall` represents cumulative growing-season rainfall in mm (never 1-hour
    weather station precipitation). Extra fields, booleans, strings, NaN, and
    infinite numbers are rejected with HTTP 422.
    """

    model_config = ConfigDict(extra="forbid")

    N: float = Field(..., ge=0, le=300, allow_inf_nan=False)
    P: float = Field(..., ge=0, le=300, allow_inf_nan=False)
    K: float = Field(..., ge=0, le=300, allow_inf_nan=False)
    temperature: float = Field(..., ge=-20, le=60, allow_inf_nan=False)
    humidity: float = Field(..., ge=0, le=100, allow_inf_nan=False)
    ph: float = Field(..., ge=0, le=14, allow_inf_nan=False)
    rainfall: float = Field(..., ge=0, le=1000, allow_inf_nan=False)

    @field_validator("N", "P", "K", "temperature", "humidity", "ph", "rainfall", mode="before")
    @classmethod
    def _require_strict_finite_number(cls, v: Any) -> float:
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            raise ValueError("Must be a finite numeric value")
        fv = float(v)
        if not math.isfinite(fv):
            raise ValueError("Must be a finite numeric value")
        return fv


@app.get("/health")
def health() -> dict:
    soil_art_path, _ = resolve_soil_artifact_paths()
    return {
        "status": "ok",
        "modelLoaded": BUNDLE is not None,
        "selectedModel": (EVALUATION or {}).get("selectedModel"),
        "soilModelAvailable": os.path.exists(soil_art_path),
    }


@app.get("/evaluation")
def evaluation() -> dict:
    if EVALUATION is None:
        raise HTTPException(503, "evaluation_results.json missing - run python ml/train.py")
    return EVALUATION


@app.get("/evaluation/soil")
def soil_evaluation() -> dict:
    soil_eval_path = os.path.join(ART, "soil", "evaluation_results.json")
    if not os.path.exists(soil_eval_path):
        raise HTTPException(
            503, "soil/evaluation_results.json missing - run python3 ml/train_soil.py"
        )
    with open(soil_eval_path, encoding="utf-8") as f:
        return json.load(f)


@app.get("/dataset")
def dataset() -> dict:
    if DATASET is None:
        raise HTTPException(503, "dataset_metadata.json missing - run python ml/train.py")
    return DATASET


@app.post("/predict")
def predict(req: PredictRequest) -> dict:
    if BUNDLE is None:
        raise HTTPException(503, "model.joblib missing - run python ml/train.py")
    model, features, classes = BUNDLE["model"], BUNDLE["features"], BUNDLE["classes"]
    x = np.array([[getattr(req, f) for f in features]], dtype=np.float64)
    ranked = []
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(x)[0]
        model_classes = [str(c) for c in getattr(model, "classes_", classes)]
        # Deterministic ordering: descending class score, ties broken by ascending class index
        # (matches numpy.argmax tie-breaking used by RandomForestClassifier.predict).
        order = sorted(range(len(model_classes)), key=lambda i: (-float(proba[i]), i))
        pred_crop = model_classes[order[0]]
        ranked = [
            {"crop": model_classes[i], "probability": float(proba[i])}
            for i in order[:5]
            if float(proba[i]) > 0.0
        ]
    else:
        pred_crop = str(model.predict(x)[0])
    return {
        "crop": pred_crop,
        "ranked": ranked,
        "model": (EVALUATION or {}).get("selectedModel"),
        "scoringMethod": "predict_proba_mean_leaf_distribution",
        "calibrated": False,
        "featuresUsed": features,
        "classCount": len(classes),
        "note": UNCALIBRATED_SCORE_NOTE,
    }


@app.post("/predict/soil")
async def predict_soil(image: UploadFile = File(...)) -> JSONResponse:
    raw_bytes = await image.read(SOIL_IMAGE_MAX_BYTES + 1)
    try:
        result = classify_soil_image_bytes(raw_bytes)
        return JSONResponse(status_code=200, content=result)
    except SoilImageValidationError as err:
        return JSONResponse(
            status_code=err.http_status,
            content={"error": str(err), "errorCode": err.code},
        )
    except SoilModelUnavailableError as err:
        return JSONResponse(
            status_code=503,
            content={"error": str(err), "errorCode": err.code},
        )

