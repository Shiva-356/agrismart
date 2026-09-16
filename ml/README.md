# AgriSmart ML pipeline

Real scikit-learn training, evaluation and a FastAPI inference service.
Nothing in `ml/artifacts/` is hand-written — every number is produced by `train.py`.

## Dataset

- File: `ml/data/Crop_recommendation.csv`
- Source: https://raw.githubusercontent.com/atharvaingle/Crop-Recommendation-System/master/Crop_recommendation.csv
- Verified on download: 2200 rows, 22 classes, 0 missing values, 0 duplicate rows
- Features: N, P, K, temperature, humidity, ph, rainfall — target: `label`
- Benchmark dataset only. Scores are not evidence of real-world field accuracy.

## Methodology

1. Column/row/class/missing/duplicate validation (`dataset_metadata.json`).
2. Stratified 80/20 train/test split, `random_state=42`. The test set is untouched
   until final evaluation.
3. `StandardScaler` inside a `Pipeline` for Logistic Regression, KNN and SVM
   (fitted per CV fold, so no leakage).
4. Stratified 5-fold CV on the training split only, primary metric Macro-F1.
5. `GridSearchCV` hyperparameter tuning per model (same CV splitter).
6. Final evaluation of every tuned model on the held-out test set: accuracy,
   macro precision/recall/F1; plus confusion matrix, per-class report,
   impurity feature importance and permutation importance for the selected model.
7. Feature-ablation / missing-data experiments via CV on the training split.

Selection rule: highest CV Macro-F1, tie-broken by test Macro-F1.

## Commands

Train and write all artifacts:

```bash
python -m pip install -r ml/requirements.txt
python ml/train.py
```

Run the inference API:

```bash
uvicorn ml.api.main:app --reload --port 8000
```

## Endpoints

| Method | Path          | Purpose                                              |
| ------ | ------------- | ---------------------------------------------------- |
| GET    | `/health`     | Service + model-loaded status                        |
| GET    | `/evaluation` | The real `evaluation_results.json`                   |
| GET    | `/dataset`    | Dataset provenance metadata                          |
| POST   | `/predict`    | Crop prediction from N,P,K,temp,humidity,ph,rainfall |

## Artifacts

| File                                   | Contents                                    |
| -------------------------------------- | ------------------------------------------- |
| `ml/artifacts/dataset_metadata.json`   | Provenance, class distribution, environment |
| `ml/artifacts/evaluation_results.json` | All measured metrics                        |
| `ml/artifacts/model.joblib`            | Fitted selected pipeline (Python inference) |
| `ml/artifacts/model_export.json`       | Same forest exported for the JS runtime     |

Copies of the two JSON artifacts and the model export are checked into
`src/services/ml/` so the web app serves the real results and can run the real
model without Python.

## Hosting note

The web app's hosting runs JavaScript only — it cannot execute Python. The web
app therefore evaluates the exported random forest directly (identical trees and
thresholds). Set `AGRISMART_ML_API_URL` to a deployed FastAPI base URL and the
app's `/api/predict` route proxies to the Python service instead.
