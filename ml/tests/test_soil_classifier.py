"""Automated unit and artifact-integrity tests for `ml/src/soil/soil_classifier.py`.

Runs with standard library `unittest` (and `pytest` when installed):
    python3 -m unittest discover -s ml/tests -v
"""

from __future__ import annotations

import json
import os
import sys
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml.src.soil.soil_classifier import (  # noqa: E402
    SOIL_IMAGE_MAX_BYTES,
    SoilClassifierRuntime,
    SoilImageValidationError,
    SoilModelUnavailableError,
    detect_magic_format,
    preprocess_soil_image_bytes,
)


def _has_pillow_and_tf() -> bool:
    try:
        import numpy  # noqa: F401
        import PIL  # noqa: F401
        import tensorflow  # noqa: F401

        return True
    except ImportError:
        return False


class SoilClassifierTests(unittest.TestCase):
    def setUp(self) -> None:
        self._orig_model_path = os.environ.get("AGRISMART_SOIL_MODEL_PATH")

    def tearDown(self) -> None:
        if self._orig_model_path is None:
            os.environ.pop("AGRISMART_SOIL_MODEL_PATH", None)
        else:
            os.environ["AGRISMART_SOIL_MODEL_PATH"] = self._orig_model_path

    def test_magic_byte_detection(self) -> None:
        self.assertEqual(detect_magic_format(b"\xff\xd8\xff\xe0" + b"\x00" * 32), "jpeg")
        self.assertEqual(detect_magic_format(b"\x89PNG\r\n\x1a\n" + b"\x00" * 32), "png")
        self.assertEqual(detect_magic_format(b"RIFF\x24\x00\x00\x00WEBP"), "webp")
        self.assertIsNone(detect_magic_format(b"plain text file"))

    def test_empty_oversized_and_unsupported_uploads_rejected(self) -> None:
        with self.assertRaises(SoilImageValidationError) as ctx_empty:
            preprocess_soil_image_bytes(b"")
        self.assertEqual(ctx_empty.exception.code, "EMPTY_IMAGE")
        self.assertEqual(ctx_empty.exception.http_status, 400)

        with self.assertRaises(SoilImageValidationError) as ctx_large:
            preprocess_soil_image_bytes(b"\xff\xd8\xff" + b"\x00" * (SOIL_IMAGE_MAX_BYTES + 10))
        self.assertEqual(ctx_large.exception.code, "IMAGE_TOO_LARGE")
        self.assertEqual(ctx_large.exception.http_status, 413)

        with self.assertRaises(SoilImageValidationError) as ctx_fmt:
            preprocess_soil_image_bytes(b"PDF-1.5 not an image" * 30)
        self.assertEqual(ctx_fmt.exception.code, "UNSUPPORTED_IMAGE_FORMAT")
        self.assertEqual(ctx_fmt.exception.http_status, 415)

    def test_missing_model_file_raises_503_error(self) -> None:
        os.environ["AGRISMART_SOIL_MODEL_PATH"] = "/tmp/nonexistent_soil_model_artifact.json"
        with self.assertRaises(SoilModelUnavailableError) as ctx:
            SoilClassifierRuntime()
        self.assertEqual(ctx.exception.http_status, 503)

    def test_saved_artifact_schema_and_classes(self) -> None:
        os.environ.pop("AGRISMART_SOIL_MODEL_PATH", None)
        runtime = SoilClassifierRuntime()
        art = runtime.artifact
        self.assertEqual(art["schemaVersion"], "1.0.0")
        self.assertEqual(art["classes"], ["Sandy", "Clayey", "Loamy", "Silty"])
        self.assertEqual(len(art["weights"]), 4)
        self.assertEqual(len(art["biases"]), 4)
        self.assertGreater(len(art["manifoldPrototypes"]), 50)

    @unittest.skipUnless(_has_pillow_and_tf(), "Pillow + TensorFlow not installed in system Python")
    def test_full_python_inference_on_sandy_fixture(self) -> None:
        fixture = os.path.join(REPO_ROOT, "tests", "fixtures", "soil", "sandy_test_1.jpg")
        with open(fixture, "rb") as f:
            raw = f.read()
        runtime = SoilClassifierRuntime()
        res = runtime.predict_bytes(raw)
        self.assertEqual(res["status"], "classified")
        self.assertEqual(res["predictedClass"], "Sandy")


if __name__ == "__main__":
    unittest.main()
