"""AgriSmart real ML training + evaluation pipeline.

Run:  python ml/train.py

Reads  : ml/data/Crop_recommendation.csv
Writes : ml/artifacts/dataset_metadata.json
         ml/artifacts/evaluation_results.json
         ml/artifacts/model.joblib
         ml/artifacts/model_export.json   (selected forest exported for JS inference)

No metric in the artifacts is hand-written: everything is computed here.
"""

from __future__ import annotations

import json
import os
import platform
import sys
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_val_score, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "Crop_recommendation.csv")
ART = os.path.join(HERE, "artifacts")
SEED = 42
FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
TARGET = "label"
DATASET_SOURCE = (
    "https://raw.githubusercontent.com/atharvaingle/Crop-Recommendation-System/"
    "master/Crop_recommendation.csv"
)


def fail(msg: str) -> None:
    print(f"DATASET VALIDATION FAILED: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    os.makedirs(ART, exist_ok=True)
    if not os.path.exists(DATA):
        fail(f"dataset missing at {DATA}")

    df = pd.read_csv(DATA)
    missing_cols = [c for c in FEATURES + [TARGET] if c not in df.columns]
    if missing_cols:
        fail(f"expected columns absent: {missing_cols}; found {list(df.columns)}")

    n_missing = int(df.isna().sum().sum())
    n_dupes = int(df.duplicated().sum())
    classes = sorted(df[TARGET].unique().tolist())
    dist = {k: int(v) for k, v in df[TARGET].value_counts().sort_index().items()}

    dataset_meta = {
        "name": "Crop Recommendation dataset",
        "source": DATASET_SOURCE,
        "localPath": "ml/data/Crop_recommendation.csv",
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "samples": int(len(df)),
        "classCount": len(classes),
        "classes": classes,
        "classDistribution": dist,
        "features": FEATURES,
        "missingValues": n_missing,
        "duplicateRows": n_dupes,
        "split": "Stratified 80/20 train/test, random_state=42",
        "crossValidation": "Stratified 5-fold on the training split only",
        "license": "Not stated by the source repository",
        "note": (
            "Benchmark dataset. Scores measure performance on this dataset only and are "
            "not evidence of real-world field accuracy."
        ),
        "environment": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
            "numpy": np.__version__,
            "pandas": pd.__version__,
        },
    }
    with open(os.path.join(ART, "dataset_metadata.json"), "w") as f:
        json.dump(dataset_meta, f, indent=2)
    print(json.dumps({k: dataset_meta[k] for k in ("samples", "classCount", "missingValues", "duplicateRows")}))

    X = df[FEATURES].to_numpy(dtype=float)
    y = df[TARGET].to_numpy()
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=SEED
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)

    def pipe(est, scale: bool) -> Pipeline:
        steps = ([("scaler", StandardScaler())] if scale else []) + [("model", est)]
        return Pipeline(steps)

    candidates = {
        "Logistic Regression": (
            pipe(LogisticRegression(max_iter=2000, random_state=SEED), True),
            {"model__C": [0.1, 1.0, 10.0]},
        ),
        "KNN": (pipe(KNeighborsClassifier(), True), {"model__n_neighbors": [3, 5, 7]}),
        "Decision Tree": (
            pipe(DecisionTreeClassifier(random_state=SEED), False),
            {"model__max_depth": [None, 10, 20], "model__min_samples_leaf": [1, 2]},
        ),
        "Random Forest": (
            pipe(RandomForestClassifier(random_state=SEED, n_jobs=-1), False),
            {"model__n_estimators": [200, 400], "model__max_depth": [None, 20]},
        ),
        "SVM": (pipe(SVC(random_state=SEED), True), {"model__C": [1.0, 10.0], "model__gamma": ["scale"]}),
        "Gradient Boosting": (
            pipe(GradientBoostingClassifier(random_state=SEED), False),
            {"model__n_estimators": [100], "model__learning_rate": [0.1]},
        ),
    }

    benchmarks, tuning, fitted = [], [], {}
    for name, (estimator, grid) in candidates.items():
        print(f"[cv] {name}", flush=True)
        base_cv = cross_val_score(estimator, X_tr, y_tr, cv=cv, scoring="f1_macro", n_jobs=-1)
        search = GridSearchCV(estimator, grid, cv=cv, scoring="f1_macro", n_jobs=-1, refit=True)
        search.fit(X_tr, y_tr)
        best = search.best_estimator_
        fitted[name] = best
        y_pred = best.predict(X_te)
        benchmarks.append(
            {
                "model": name,
                "accuracy": float(accuracy_score(y_te, y_pred)),
                "precision": float(precision_score(y_te, y_pred, average="macro", zero_division=0)),
                "recall": float(recall_score(y_te, y_pred, average="macro", zero_division=0)),
                "macroF1": float(f1_score(y_te, y_pred, average="macro", zero_division=0)),
                "crossValidation": float(search.best_score_),
                "crossValidationStd": float(
                    search.cv_results_["std_test_score"][search.best_index_]
                ),
                "defaultParamsCvMacroF1": float(base_cv.mean()),
                "defaultParamsCvStd": float(base_cv.std()),
            }
        )
        tuning.append(
            {
                "model": name,
                "parametersEvaluated": sorted(grid.keys()),
                "bestParams": {k: str(v) for k, v in search.best_params_.items()},
                "bestCvScore": float(search.best_score_),
            }
        )

    selected = max(benchmarks, key=lambda b: (b["crossValidation"], b["macroF1"]))["model"]
    model = fitted[selected]
    y_pred = model.predict(X_te)
    labels = sorted(np.unique(y).tolist())
    cm = confusion_matrix(y_te, y_pred, labels=labels).tolist()
    report = classification_report(y_te, y_pred, labels=labels, output_dict=True, zero_division=0)
    per_class = [
        {
            "className": c,
            "precision": float(report[c]["precision"]),
            "recall": float(report[c]["recall"]),
            "f1": float(report[c]["f1-score"]),
            "support": int(report[c]["support"]),
        }
        for c in labels
    ]

    est = model.named_steps["model"]
    feature_importance = []
    if hasattr(est, "feature_importances_"):
        feature_importance = [
            {"feature": f, "importance": float(v)}
            for f, v in sorted(
                zip(FEATURES, est.feature_importances_), key=lambda t: -t[1]
            )
        ]

    perm = permutation_importance(model, X_te, y_te, n_repeats=10, random_state=SEED, scoring="f1_macro")
    permutation_imp = [
        {"feature": f, "importance": float(m), "std": float(s)}
        for f, m, s in sorted(
            zip(FEATURES, perm.importances_mean, perm.importances_std), key=lambda t: -t[1]
        )
    ]

    # Feature-ablation / missing-data experiments, actually run via CV on the training split.
    subsets = {
        "All features": FEATURES,
        "Without N-P-K": ["temperature", "humidity", "ph", "rainfall"],
        "Without pH": ["N", "P", "K", "temperature", "humidity", "rainfall"],
        "Weather only (no soil data)": ["temperature", "humidity", "rainfall"],
        "Soil only (no weather data)": ["N", "P", "K", "ph"],
    }
    ablation, missing_experiment = [], []
    for label, cols in subsets.items():
        idx = [FEATURES.index(c) for c in cols]
        clone = candidates[selected][0]
        f1_cv = cross_val_score(clone, X_tr[:, idx], y_tr, cv=cv, scoring="f1_macro", n_jobs=-1)
        acc_cv = cross_val_score(clone, X_tr[:, idx], y_tr, cv=cv, scoring="accuracy", n_jobs=-1)
        ablation.append(
            {
                "featureSet": label,
                "accuracy": float(acc_cv.mean()),
                "macroF1": float(f1_cv.mean()),
                "crossValidation": float(f1_cv.mean()),
            }
        )
        missing_experiment.append(
            {"scenario": label, "accuracy": float(acc_cv.mean()), "macroF1": float(f1_cv.mean())}
        )

    evaluation = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "dataset": {
            "name": dataset_meta["name"],
            "source": dataset_meta["source"],
            "samples": dataset_meta["samples"],
            "classCount": dataset_meta["classCount"],
            "features": FEATURES,
            "split": dataset_meta["split"],
            "crossValidation": dataset_meta["crossValidation"],
            "license": dataset_meta["license"],
            "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        },
        "selectedModel": selected,
        "primaryMetric": "Macro-F1 (stratified 5-fold CV on the training split)",
        "trainSize": int(len(X_tr)),
        "testSize": int(len(X_te)),
        "benchmarks": benchmarks,
        "classes": labels,
        "confusionMatrix": cm,
        "perClass": per_class,
        "featureImportance": feature_importance,
        "permutationImportance": permutation_imp,
        "tuning": tuning,
        "ablation": ablation,
        "missingDataExperiment": missing_experiment,
        "shap": [],
        "lime": [],
        "limitations": (
            "Metrics come from a single benchmark dataset with a clean, balanced class "
            "distribution. They do not guarantee accuracy on real fields."
        ),
    }
    with open(os.path.join(ART, "evaluation_results.json"), "w") as f:
        json.dump(evaluation, f, indent=2)

    joblib.dump({"model": model, "features": FEATURES, "classes": labels}, os.path.join(ART, "model.joblib"))

    export_model(model, labels, os.path.join(ART, "model_export.json"))
    print(f"selected={selected} macroF1={max(b['macroF1'] for b in benchmarks):.4f}")


def export_model(pipeline: Pipeline, labels: list[str], path: str) -> None:
    """Export a fitted tree-ensemble pipeline to JSON for the JS runtime.

    Only supported for forests of decision trees; other estimators are skipped
    (the app then requires the FastAPI service for predictions).
    """
    est = pipeline.named_steps["model"]
    if not isinstance(est, RandomForestClassifier):
        with open(path, "w") as f:
            json.dump({"supported": False, "reason": type(est).__name__}, f)
        return
    trees = []
    for e in est.estimators_:
        t = e.tree_
        trees.append(
            {
                "l": t.children_left.tolist(),
                "r": t.children_right.tolist(),
                "f": t.feature.tolist(),
                "t": [round(float(v), 6) for v in t.threshold.tolist()],
                "v": [
                    int(np.argmax(t.value[i][0])) if t.children_left[i] == -1 else -1
                    for i in range(t.node_count)
                ],
            }
        )
    with open(path, "w") as f:
        json.dump(
            {
                "supported": True,
                "kind": "random_forest_majority_vote",
                "features": FEATURES,
                "classes": labels,
                "trees": trees,
            },
            f,
            separators=(",", ":"),
        )


if __name__ == "__main__":
    main()
