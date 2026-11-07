#!/usr/bin/env python3
"""Reproducible training entrypoint for AgriSmart's Soil Texture Image Classifier.

Ensures the open-licensed soil photograph dataset and Apache-2.0 MobileNetV1
backbone are cached locally, then runs the deterministic deduplication,
stratified cluster-grouped split, class-balanced L2 logistic head training,
validation temperature scaling, OOD gate calibration, and held-out evaluation.

Usage:
    python3 ml/train_soil.py
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

ML_ROOT = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(ML_ROOT)


def main() -> int:
    raw_manifest = os.path.join(ML_ROOT, "data", "soil_images_cache", "raw_manifest.json")
    backbone_json = os.path.join(ML_ROOT, "artifacts", "soil", "backbone", "model.json")

    if not (os.path.exists(raw_manifest) and os.path.exists(backbone_json)):
        print("[train_soil] Fetching open-licensed soil dataset & MobileNet backbone ...")
        fetch_script = os.path.join(ML_ROOT, "scripts", "fetch_soil_dataset.py")
        res = subprocess.run([sys.executable, fetch_script], cwd=REPO_ROOT, check=False)
        if res.returncode != 0:
            return res.returncode

    node_bin = shutil.which("node")
    if not node_bin:
        print("ERROR: Node.js runtime is required to execute the shared TFJS training graph.", file=sys.stderr)
        return 1

    cmd = [
        node_bin,
        "--import",
        "./tests/register-loader.mjs",
        "scripts/train-soil-model.mjs",
    ]
    print("[train_soil] Running supervised training & held-out evaluation:", " ".join(cmd))
    completed = subprocess.run(cmd, cwd=REPO_ROOT, check=False)
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
