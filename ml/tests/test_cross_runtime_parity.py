"""Reproducible cross-runtime Random Forest parity test (Python <-> TypeScript).

Run:
    python3 ml/tests/test_cross_runtime_parity.py

Verifies:
1. Artifact integrity: `ml/artifacts/model_export.json` and `src/services/ml/model_export.json`
   match byte-for-byte, preserve all 7 features in exact training order, preserve all 22 classes,
   preserve full IEEE-754 thresholds, and use `random_forest_predict_proba`.
2. Direct `model.joblib` binary tree vs TypeScript `predictWithLocalForest` parity across
   benchmark, boundary (`rainfall=0.0`), and near-threshold split inputs (including thresholds
   where 6-decimal rounding previously diverged from IEEE-754 float64).
3. Live `scikit-learn` `model.predict_proba()` + FastAPI `PredictRequest` parity against
   TypeScript `predictWithLocalForest` when `joblib`, `numpy`, `scikit-learn`, and `pydantic`
   are installed in the active Python environment (explicitly marked `SKIPPED` if those
   third-party Python packages are not installed in the container).
"""

from __future__ import annotations

import ctypes
import json
import math
import os
import struct
import subprocess
import unittest
from typing import Any

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
JOBLIB_PATH = os.path.join(ROOT_DIR, "ml", "artifacts", "model.joblib")
ML_EXPORT_PATH = os.path.join(ROOT_DIR, "ml", "artifacts", "model_export.json")
TS_EXPORT_PATH = os.path.join(ROOT_DIR, "src", "services", "ml", "model_export.json")

EXPECTED_FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]

VALID_TEST_CASES: list[dict[str, float]] = [
    # Rice benchmark sample
    {
        "N": 90.0,
        "P": 42.0,
        "K": 43.0,
        "temperature": 20.87974371,
        "humidity": 82.00274423,
        "ph": 6.502985292,
        "rainfall": 202.9355362,
    },
    # Genuine zero seasonal rainfall boundary case
    {
        "N": 40.0,
        "P": 68.0,
        "K": 82.0,
        "temperature": 18.5,
        "humidity": 16.2,
        "ph": 7.1,
        "rainfall": 0.0,
    },
    # Near-split-threshold precision case (6-decimal rounding previously shifted split comparisons)
    {
        "N": 55.0,
        "P": 58.0,
        "K": 21.0,
        "temperature": 25.4999996,
        "humidity": 65.1234564,
        "ph": 6.4999996,
        "rainfall": 95.3333334,
    },
    # High NPK orchard / fruit profile
    {
        "N": 105.0,
        "P": 25.0,
        "K": 50.0,
        "temperature": 26.8,
        "humidity": 85.4,
        "ph": 6.3,
        "rainfall": 52.0,
    },
    # Cotton / black-soil profile
    {
        "N": 118.0,
        "P": 46.0,
        "K": 20.0,
        "temperature": 24.2,
        "humidity": 79.8,
        "ph": 6.9,
        "rainfall": 80.5,
    },
    # Temperate orchard profile
    {
        "N": 20.0,
        "P": 134.0,
        "K": 198.0,
        "temperature": 22.1,
        "humidity": 92.3,
        "ph": 5.9,
        "rainfall": 112.6,
    },
]

INVALID_TEST_CASES: list[dict[str, Any]] = [
    # Missing seasonal rainfall
    {"N": 90, "P": 42, "K": 43, "temperature": 21, "humidity": 82, "ph": 6.5},
    # Out-of-bounds pH
    {"N": 90, "P": 42, "K": 43, "temperature": 21, "humidity": 82, "ph": 14.5, "rainfall": 200},
    # Negative seasonal rainfall
    {"N": 90, "P": 42, "K": 43, "temperature": 21, "humidity": 82, "ph": 6.5, "rainfall": -0.1},
    # Extra unexpected hourly rainfallMm field
    {
        "N": 90,
        "P": 42,
        "K": 43,
        "temperature": 21,
        "humidity": 82,
        "ph": 6.5,
        "rainfall": 200,
        "rainfallMm": 3.4,
    },
    # Boolean masquerading as number
    {"N": True, "P": 42, "K": 43, "temperature": 21, "humidity": 82, "ph": 6.5, "rainfall": 200},
    # String instead of number
    {"N": "90", "P": 42, "K": 43, "temperature": 21, "humidity": 82, "ph": 6.5, "rainfall": 200},
]


def _run_typescript_batch(
    valid_inputs: list[dict[str, float]],
    invalid_inputs: list[dict[str, Any]],
) -> dict[str, Any]:
    script = """
import { predictWithLocalForest } from "@/lib/ml/forest";
const payload = JSON.parse(process.argv[1]);
const validOut = payload.valid.map((inp) => predictWithLocalForest(inp));
const invalidOut = payload.invalid.map((inp) => predictWithLocalForest(inp));
process.stdout.write(JSON.stringify({ validOut, invalidOut }));
"""
    proc = subprocess.run(
        [
            "node",
            "--import",
            "./tests/register-loader.mjs",
            "--input-type=module",
            "-e",
            script,
            json.dumps({"valid": valid_inputs, "invalid": invalid_inputs}),
        ],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(proc.stdout)


def _decode_joblib_trees_and_predict(
    classes: list[str],
    tree_node_counts: list[int],
    sample: dict[str, float],
) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]]:
    """Evaluates raw IEEE-754 tree arrays directly from ml/artifacts/model.joblib."""
    with open(JOBLIB_PATH, "rb") as f:
        data = f.read()

    marker = b"K\x10ub"
    wrappers: list[int] = []
    pos = 0
    while True:
        idx = data.find(marker, pos)
        if idx == -1:
            break
        wrappers.append(idx)
        pos = idx + 1

    # Match sklearn Cython Tree float32 input cast (`DTYPE_t`)
    x_f32 = [ctypes.c_float(sample[feat]).value for feat in EXPECTED_FEATURES]
    score_sums = [0.0] * len(classes)
    n_trees = len(tree_node_counts)

    for ti, node_count in enumerate(tree_node_counts):
        w_nodes = wrappers[1 + 4 * ti + 2]
        nodes_start = w_nodes + 5 + data[w_nodes + 4]
        w_vals = wrappers[1 + 4 * ti + 3]
        vals_start = w_vals + 5 + data[w_vals + 4]

        node = 0
        while True:
            left_c, right_c, feat, thresh = struct.unpack_from(
                "<qqqd", data, nodes_start + node * 64
            )
            if left_c == -1:
                vals = struct.unpack_from("<22d", data, vals_start + node * 22 * 8)
                total = sum(vals)
                for ci, val in enumerate(vals):
                    score_sums[ci] += (val / total) if total > 0.0 else 0.0
                break
            node = left_c if x_f32[feat] <= thresh else right_c

    probs = [s / n_trees for s in score_sums]
    order = sorted(range(len(classes)), key=lambda i: (-probs[i], i))
    all_scores = [{"crop": classes[i], "probability": probs[i]} for i in order]
    ranked = [item for item in all_scores[:5] if item["probability"] > 0.0]
    return classes[order[0]], ranked, all_scores


try:
    import joblib  # type: ignore
    import numpy as np  # type: ignore
    import pydantic  # type: ignore
    import sklearn  # type: ignore

    HAS_SKLEARN_RUNTIME = True
except ImportError:
    HAS_SKLEARN_RUNTIME = False


class CrossRuntimeRandomForestParityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with open(ML_EXPORT_PATH, "r") as f:
            cls.ml_export_raw = f.read()
        with open(TS_EXPORT_PATH, "r") as f:
            cls.ts_export_raw = f.read()
        cls.export_data = json.loads(cls.ts_export_raw)
        cls.ts_results = _run_typescript_batch(VALID_TEST_CASES, INVALID_TEST_CASES)

    def test_exported_artifacts_match_and_preserve_schema(self) -> None:
        self.assertEqual(self.ml_export_raw, self.ts_export_raw)
        self.assertTrue(self.export_data["supported"])
        self.assertEqual(self.export_data["kind"], "random_forest_predict_proba")
        self.assertEqual(
            self.export_data["scoringMethod"], "predict_proba_mean_leaf_distribution"
        )
        self.assertFalse(self.export_data["calibrated"])
        self.assertEqual(self.export_data["features"], EXPECTED_FEATURES)
        self.assertEqual(len(self.export_data["classes"]), 22)
        self.assertEqual(len(self.export_data["trees"]), 200)

    def test_typescript_rejects_all_invalid_inputs(self) -> None:
        for idx, res in enumerate(self.ts_results["invalidOut"]):
            self.assertIsNone(res, f"Invalid case #{idx} should have been rejected: {res}")

    def test_binary_joblib_tree_and_typescript_parity(self) -> None:
        classes = self.export_data["classes"]
        node_counts = [len(t["l"]) for t in self.export_data["trees"]]
        for idx, sample in enumerate(VALID_TEST_CASES):
            py_crop, py_ranked, py_all = _decode_joblib_trees_and_predict(
                classes, node_counts, sample
            )
            ts_res = self.ts_results["validOut"][idx]
            self.assertIsNotNone(ts_res, f"Valid case #{idx} returned null in TypeScript")
            self.assertEqual(ts_res["crop"], py_crop, f"Top crop mismatch on case #{idx}")
            self.assertEqual(len(ts_res["ranked"]), len(py_ranked))
            for r_idx, (ts_r, py_r) in enumerate(zip(ts_res["ranked"], py_ranked)):
                self.assertEqual(ts_r["crop"], py_r["crop"], f"Rank #{r_idx} crop mismatch")
                self.assertTrue(
                    math.isclose(ts_r["probability"], py_r["probability"], rel_tol=0.0, abs_tol=1e-12),
                    f"Rank #{r_idx} score diff: TS={ts_r['probability']} vs PY={py_r['probability']}",
                )
            for ts_c, py_c in zip(ts_res["allClassScores"], py_all):
                self.assertEqual(ts_c["crop"], py_c["crop"])
                self.assertLessEqual(abs(ts_c["probability"] - py_c["probability"]), 1e-12)

    @unittest.skipUnless(
        HAS_SKLEARN_RUNTIME,
        "Live scikit-learn/joblib/pydantic packages are not installed in this Python environment",
    )
    def test_live_sklearn_predict_proba_and_fastapi_validation_parity(self) -> None:
        from ml.api.main import PredictRequest, predict  # type: ignore

        bundle = joblib.load(JOBLIB_PATH)
        model = bundle["model"]
        features = bundle["features"]
        self.assertEqual(features, EXPECTED_FEATURES)

        for idx, sample in enumerate(VALID_TEST_CASES):
            req = PredictRequest(**sample)
            py_resp = predict(req)
            ts_res = self.ts_results["validOut"][idx]
            self.assertEqual(ts_res["crop"], py_resp["crop"])
            self.assertEqual(len(ts_res["ranked"]), len(py_resp["ranked"]))
            for ts_r, py_r in zip(ts_res["ranked"], py_resp["ranked"]):
                self.assertEqual(ts_r["crop"], py_r["crop"])
                self.assertLessEqual(abs(ts_r["probability"] - py_r["probability"]), 1e-12)

            # Also compare all 22 classes directly against sklearn predict_proba
            x = np.array([[sample[f] for f in features]], dtype=np.float64)
            proba = model.predict_proba(x)[0]
            ts_by_crop = {c["crop"]: c["probability"] for c in ts_res["allClassScores"]}
            for ci, cls_name in enumerate(model.classes_):
                self.assertLessEqual(abs(ts_by_crop[str(cls_name)] - float(proba[ci])), 1e-12)

        for inv in INVALID_TEST_CASES:
            with self.assertRaises(Exception):
                PredictRequest(**inv)


if __name__ == "__main__":
    unittest.main(verbosity=2)
