"""AgriSmart FastAPI inference service.

Serves the model trained by ml/train.py. It never invents a prediction: if the
model artifact is missing the service returns 503.

Run:
    python -m pip install -r ml/requirements.txt
    uvicorn ml.api.main:app --reload --port 8000
"""

from __future__ import annotations

import json
import os
from typing import Any

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "artifacts")

app = FastAPI(title="AgriSmart ML API", version="1.0.0")
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
    N: float = Field(..., ge=0, le=300)
    P: float = Field(..., ge=0, le=300)
    K: float = Field(..., ge=0, le=300)
    temperature: float = Field(..., ge=-20, le=60)
    humidity: float = Field(..., ge=0, le=100)
    ph: float = Field(..., ge=0, le=14)
    rainfall: float = Field(..., ge=0, le=1000)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "modelLoaded": BUNDLE is not None,
        "selectedModel": (EVALUATION or {}).get("selectedModel"),
    }


@app.get("/evaluation")
def evaluation() -> dict:
    if EVALUATION is None:
        raise HTTPException(503, "evaluation_results.json missing - run python ml/train.py")
    return EVALUATION


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
    x = np.array([[getattr(req, f) for f in features]], dtype=float)
    pred = model.predict(x)[0]
    ranked = []
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(x)[0]
        order = np.argsort(proba)[::-1]
        ranked = [
            {"crop": str(model.classes_[i]), "probability": float(proba[i])} for i in order[:5]
        ]
    return {
        "crop": str(pred),
        "ranked": ranked,
        "model": (EVALUATION or {}).get("selectedModel"),
        "featuresUsed": features,
        "classCount": len(classes),
        "note": "Probability is the model's estimate on the benchmark dataset, not a field guarantee.",
    }
