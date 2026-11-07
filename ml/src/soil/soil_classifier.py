"""Supervised MobileNetV1 multi-scale soil texture classifier for AgriSmart.

Loads the saved supervised artifact (`ml/artifacts/soil/soil_classifier_artifact.json`)
and consolidated MobileNetV1 0.50 (224x224) pretrained weights (`ml/artifacts/soil/backbone/`).
Never uses RGB colour heuristics or fabricates soil chemistry values.
"""

from __future__ import annotations

import hashlib
import io
import json
import math
import os
from typing import Any

SOIL_IMAGE_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
SOIL_IMAGE_MIN_DIMENSION = 64

SOIL_DATA_INTEGRITY_CAVEATS = [
    "Visual estimate only: Camera-based classification estimates surface soil texture class and never measures N, P, K, soil pH, electrical conductivity, organic carbon, or volumetric moisture.",
    "Environmental sensitivity: Surface wetness (rain/irrigation), shadows, direct sun glare, camera white balance, crop residue, and gravel cover can shift apparent colour and roughness.",
    "Laboratory verification: Use accredited soil laboratory particle-size (hydrometer/pipette) and chemical analysis before making fertilizer or liming investments.",
]

SOIL_CLASS_AGRONOMIC_NOTES: dict[str, dict[str, str]] = {
    "Sandy": {
        "summary": "Coarse-grained mineral texture dominated by visible sand particles with rapid drainage and low cohesion.",
        "visualIndicators": "Loose, gritty individual grains, low clod cohesion, matte granular surface reflectance.",
        "fieldGuidance": "Warms quickly and drains fast, but leaches nitrogen and moisture rapidly. Verify organic matter and nutrient retention via laboratory testing before scheduling split fertilizer applications.",
    },
    "Clayey": {
        "summary": "Fine-grained cohesive soil texture exhibiting dense plastic aggregates when moist and polygonal shrinkage cracks when dry.",
        "visualIndicators": "Compact, smooth or blocky plates, cohesive clods, or characteristic desiccation fissures.",
        "fieldGuidance": "High cation-exchange and water-holding capacity, but prone to waterlogging and compaction if worked when wet. Confirm pH and drainage conditions in the field.",
    },
    "Loamy": {
        "summary": "Balanced mineral-organic surface texture with friable, crumbly aggregates and moderate moisture retention.",
        "visualIndicators": "Darker earthy tone with mixed crumb structure, porous clods, and balanced granular-fine matrix.",
        "fieldGuidance": "Generally favourable tilth, aeration, and root penetration. Laboratory NPK and pH testing is still required to determine actual nutrient availability.",
    },
    "Silty": {
        "summary": "Fine, smooth floury sediment texture (such as alluvial silt or loess) with low coarse grit and high capillary water movement.",
        "visualIndicators": "Uniform, smooth or finely layered powdery surface lacking coarse sand grains or deep plastic clay plates.",
        "fieldGuidance": "Retains plant-available moisture well but is susceptible to surface crusting and wind/water erosion when bare. Confirm particle-size fractions via lab hydrometer/pipette analysis.",
    },
}


class SoilImageValidationError(ValueError):
    """Raised when uploaded bytes are empty, oversized, unsupported, or corrupt."""

    def __init__(self, code: str, message: str, http_status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.http_status = http_status


class SoilModelUnavailableError(RuntimeError):
    """Raised when the trained soil classifier artifact or backbone is missing."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.code = "SOIL_MODEL_UNAVAILABLE"
        self.http_status = 503


def detect_magic_format(data: bytes) -> str | None:
    if len(data) >= 3 and data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if len(data) >= 6 and data[:3] == b"GIF":
        return "gif"
    return None


def resolve_soil_artifact_paths() -> tuple[str, str]:
    ml_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    default_art = os.path.join(ml_root, "artifacts", "soil", "soil_classifier_artifact.json")
    art_path = os.environ.get("AGRISMART_SOIL_MODEL_PATH", "").strip() or default_art
    backbone_dir = (
        os.environ.get("AGRISMART_SOIL_BACKBONE_DIR", "").strip()
        or os.path.join(os.path.dirname(art_path), "backbone")
    )
    return art_path, backbone_dir


def preprocess_soil_image_bytes(
    raw_bytes: bytes,
    max_bytes: int = SOIL_IMAGE_MAX_BYTES,
) -> dict[str, Any]:
    """Deterministic preprocessing identical to `src/lib/ml/soil-preprocessing.ts`."""
    if not raw_bytes:
        raise SoilImageValidationError(
            "EMPTY_IMAGE",
            "Uploaded image file is empty (0 bytes). Please select a valid JPEG or PNG soil photograph.",
            400,
        )
    if len(raw_bytes) > max_bytes:
        mb = max_bytes // (1024 * 1024)
        raise SoilImageValidationError(
            "IMAGE_TOO_LARGE",
            f"Image exceeds the {mb} MB upload limit.",
            413,
        )

    fmt = detect_magic_format(raw_bytes)
    if fmt not in ("jpeg", "png"):
        raise SoilImageValidationError(
            "UNSUPPORTED_IMAGE_FORMAT",
            "Unsupported or unrecognized file format. Please upload a valid JPEG (.jpg/.jpeg) or PNG (.png) soil photograph.",
            415,
        )

    try:
        import numpy as np
        from PIL import Image, ImageOps
    except ImportError as exc:
        raise SoilModelUnavailableError(
            f"Python vision dependencies (Pillow, numpy) are not installed: {exc}"
        ) from exc

    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            oriented = ImageOps.exif_transpose(img)
            if oriented.mode == "RGBA":
                bg = Image.new("RGBA", oriented.size, (128, 128, 128, 255))
                rgb_img = Image.alpha_composite(bg, oriented).convert("RGB")
            else:
                rgb_img = oriented.convert("RGB")
            orig_w, orig_h = rgb_img.size
    except Exception as exc:
        raise SoilImageValidationError(
            "CORRUPT_IMAGE",
            f"Could not decode image pixels ({exc}).",
            400,
        ) from exc

    if orig_w < SOIL_IMAGE_MIN_DIMENSION or orig_h < SOIL_IMAGE_MIN_DIMENSION:
        raise SoilImageValidationError(
            "IMAGE_DIMENSIONS_TOO_SMALL",
            f"Image resolution ({orig_w}x{orig_h}px) is below minimum {SOIL_IMAGE_MIN_DIMENSION}x{SOIL_IMAGE_MIN_DIMENSION}px.",
            400,
        )

    short_side = 256
    crop_size = 224
    if orig_w <= orig_h:
        res_w = short_side
        res_h = max(short_side, round((orig_h * short_side) / orig_w))
    else:
        res_h = short_side
        res_w = max(short_side, round((orig_w * short_side) / orig_h))

    resized = rgb_img.resize((res_w, res_h), Image.Resampling.BILINEAR)
    ox = (res_w - crop_size) // 2
    oy = (res_h - crop_size) // 2
    cropped = resized.crop((ox, oy, ox + crop_size, oy + crop_size))
    crop_np = np.asarray(cropped, dtype=np.float32)  # [224, 224, 3] in 0..255
    tensor_224 = (crop_np / 127.5) - 1.0

    # Scene statistics on 224x224 crop
    rgb01 = crop_np / 255.0
    r, g, b = rgb01[..., 0], rgb01[..., 1], rgb01[..., 2]
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    sat = np.where(max_c > 1e-5, (max_c - min_c) / np.maximum(max_c, 1e-5), 0.0)

    green_dom = float(np.mean((2.0 * g - r - b > 0.16) & (g > 0.22) & (sat > 0.22)))
    sky_blue = float(np.mean((b - r > 0.18) & (b > g) & (b > 0.35) & (sat > 0.22)))
    high_sat = float(np.mean((sat > 0.68) & (max_c > 0.35)))
    near_black = float(np.mean(luma < 0.04))
    near_white = float(np.mean(luma > 0.96))

    gx = np.abs(luma[1:-1, 2:] - luma[1:-1, :-2])
    gy = np.abs(luma[2:, 1:-1] - luma[:-2, 1:-1])
    edge_density = float(np.mean((gx + gy) > 0.14))

    return {
        "format": fmt,
        "originalWidth": orig_w,
        "originalHeight": orig_h,
        "tensor224": tensor_224,
        "sha256": hashlib.sha256(raw_bytes).hexdigest(),
        "sceneStats": {
            "meanLuma": float(np.mean(luma)),
            "stdLuma": float(np.std(luma)),
            "greenExcessRatio": green_dom,
            "skyBlueRatio": sky_blue,
            "saturatedRatio": high_sat,
            "nearBlackRatio": near_black,
            "nearWhiteRatio": near_white,
            "edgeDensity": edge_density,
        },
    }


class SoilClassifierRuntime:
    """Loads saved backbone + calibrated linear head artifact for FastAPI / CLI inference."""

    def __init__(self, artifact_path: str | None = None, backbone_dir: str | None = None) -> None:
        resolved_art, resolved_bb = resolve_soil_artifact_paths()
        self.artifact_path = artifact_path or resolved_art
        self.backbone_dir = backbone_dir or resolved_bb

        if not os.path.exists(self.artifact_path):
            raise SoilModelUnavailableError(
                f"Soil classifier artifact missing at '{self.artifact_path}'. Run 'node scripts/train-soil-model.mjs' or 'python3 ml/train_soil.py'."
            )
        with open(self.artifact_path, encoding="utf-8") as f:
            self.artifact = json.load(f)

        self._extractor: Any = None

    def _ensure_extractor(self) -> Any:
        if self._extractor is not None:
            return self._extractor
        try:
            import numpy as np
            import tensorflow as tf
        except ImportError as exc:
            raise SoilModelUnavailableError(
                f"TensorFlow is required for Python backbone execution ({exc}). Alternatively use the Node server endpoint /api/soil-analysis."
            ) from exc

        model_json_path = os.path.join(self.backbone_dir, "model.json")
        weights_bin_path = os.path.join(self.backbone_dir, "weights.bin")
        if not (os.path.exists(model_json_path) and os.path.exists(weights_bin_path)):
            raise SoilModelUnavailableError(
                f"Backbone weights missing at '{self.backbone_dir}'."
            )

        base = tf.keras.applications.MobileNet(
            input_shape=(224, 224, 3),
            alpha=0.5,
            include_top=True,
            weights="imagenet",
        )
        deep_gap = base.get_layer("global_average_pooling2d").output
        mid_conv = base.get_layer("conv_pw_11_relu").output
        early_conv = base.get_layer("conv_pw_5_relu").output
        self._extractor = tf.keras.Model(
            inputs=base.input,
            outputs=[deep_gap, mid_conv, early_conv],
        )
        return self._extractor

    @staticmethod
    def _compute_surface_physics_32(tensor_224: Any) -> Any:
        import numpy as np

        rgb01 = (np.asarray(tensor_224, dtype=np.float32) + 1.0) * 0.5
        r, g, b = rgb01[..., 0], rgb01[..., 1], rgb01[..., 2]
        luma = 0.299 * r + 0.587 * g + 0.114 * b
        rgb_sum = r + g + b + 1e-5
        rn, gn, bn = r / rgb_sum, g / rgb_sum, b / rgb_sum
        max_c = np.maximum(np.maximum(r, g), b)
        min_c = np.minimum(np.minimum(r, g), b)
        sat = np.where(max_c > 1e-5, (max_c - min_c) / np.maximum(max_c, 1e-5), 0.0)
        red = (r - g) / (r + g + 1e-5)
        och = (r + g - 2.0 * b) / rgb_sum

        desc = np.zeros(32, dtype=np.float32)
        channels = [r, g, b, luma, rn, gn, bn, sat, red, och]
        for idx, ch in enumerate(channels):
            desc[idx * 2] = float(np.mean(ch))
            desc[idx * 2 + 1] = float(np.std(ch))

        desc[20] = float(np.mean(luma < 0.25))
        desc[21] = float(np.mean(luma > 0.65))

        for s_idx, st in enumerate((1, 2, 4, 8)):
            dx = np.abs(luma[:-st, st:] - luma[:-st, :-st])
            dy = np.abs(luma[st:, :-st] - luma[:-st, :-st])
            d = 1.5 * (dx + dy)
            desc[22 + s_idx * 2] = float(np.mean(d))
            desc[23 + s_idx * 2] = float(np.std(d))

        desc[30] = float(np.mean(sat < 0.08))
        desc[31] = float(np.mean((sat > 0.25) & (r >= b)))
        return desc / (np.linalg.norm(desc) + 1e-8)

    def extract_embedding(self, tensor_224: Any) -> Any:
        import numpy as np

        extractor = self._ensure_extractor()
        phys_norm = self._compute_surface_physics_32(tensor_224)
        batch = np.expand_dims(tensor_224, axis=0)
        deep_gap, mid_map, early_map = extractor(batch, training=False)
        deep_vec = np.asarray(deep_gap[0], dtype=np.float32)
        mid_np = np.asarray(mid_map[0], dtype=np.float32)
        early_np = np.asarray(early_map[0], dtype=np.float32)

        deep_norm = deep_vec / (np.linalg.norm(deep_vec) + 1e-8)
        mid_concat = np.concatenate([np.mean(mid_np, axis=(0, 1)), np.std(mid_np, axis=(0, 1))], axis=0)
        mid_norm = mid_concat / (np.linalg.norm(mid_concat) + 1e-8)
        early_concat = np.concatenate([np.mean(early_np, axis=(0, 1)), np.std(early_np, axis=(0, 1))], axis=0)
        early_norm = early_concat / (np.linalg.norm(early_concat) + 1e-8)

        combined = np.concatenate(
            [deep_norm, mid_norm, early_norm * 0.85, phys_norm * 0.75],
            axis=0,
        )
        return combined / (np.linalg.norm(combined) + 1e-8)

    def predict_bytes(self, raw_bytes: bytes) -> dict[str, Any]:
        import numpy as np

        prep = preprocess_soil_image_bytes(raw_bytes)
        emb = self.extract_embedding(prep["tensor224"])
        art = self.artifact
        classes: list[str] = art["classes"]
        k = len(classes)
        temp = max(0.05, float(art.get("temperature", 1.0)))

        w = np.asarray(art["weights"], dtype=np.float64)
        b = np.asarray(art["biases"], dtype=np.float64)
        logits = (w @ emb.astype(np.float64) + b) / temp
        logits -= np.max(logits)
        exps = np.exp(logits)
        probs = exps / np.sum(exps)

        entropy = -float(np.sum(np.where(probs > 1e-12, probs * np.log(np.maximum(probs, 1e-12)), 0.0)))
        norm_entropy = entropy / math.log(k) if k > 1 else 0.0

        order = sorted(range(k), key=lambda i: (-float(probs[i]), i))
        agri_map = art.get("agriSoilTypeMap", {})
        scores = [
            {
                "soilClass": classes[i],
                "agriSoilType": agri_map.get(classes[i], classes[i]),
                "probability": round(float(probs[i]), 4),
                "percentage": round(float(probs[i]) * 100.0, 1),
            }
            for i in order
        ]

        protos = np.asarray(art["manifoldPrototypes"], dtype=np.float32)
        cents = np.asarray(art["classCentroids"], dtype=np.float32)
        max_proto_sim = float(np.max(protos @ emb))
        max_cent_sim = float(np.max(cents @ emb))

        stats = prep["sceneStats"]
        gates = art["oodGates"]
        diagnostics = {
            "manifoldSimilarity": round(max_proto_sim, 4),
            "centroidSimilarity": round(max_cent_sim, 4),
            "normalizedEntropy": round(norm_entropy, 4),
            "imageWidth": prep["originalWidth"],
            "imageHeight": prep["originalHeight"],
            "format": prep["format"],
        }
        model_meta = {
            "name": art["modelName"],
            "backbone": art["backboneArchitecture"],
            "runtime": "fastapi",
            "supportedClasses": classes,
        }

        def unsupported(code: str, msg: str) -> dict[str, Any]:
            return {
                "status": "unsupported_input",
                "predictedClass": None,
                "agriSoilType": None,
                "closestCandidate": None,
                "confidence": None,
                "confidencePct": None,
                "calibrated": bool(art.get("calibrated", True)),
                "scoringMethod": art.get("calibrationMethod", "softmax"),
                "scores": [],
                "explanation": msg,
                "visualIndicators": None,
                "fieldGuidance": None,
                "rejectionReasonCode": code,
                "diagnostics": diagnostics,
                "model": model_meta,
                "caveats": SOIL_DATA_INTEGRITY_CAVEATS,
            }

        if (
            stats["nearBlackRatio"] > gates["maxExtremeExposureRatio"]
            or stats["nearWhiteRatio"] > gates["maxExtremeExposureRatio"]
            or stats["stdLuma"] < gates["minLumaStd"]
        ):
            return unsupported(
                "POOR_IMAGE_QUALITY",
                "Image lacks sufficient exposure or surface detail to classify soil texture reliably.",
            )
        if stats["greenExcessRatio"] > gates["maxGreenExcessRatio"]:
            return unsupported(
                "VEGETATION_DOMINATED",
                "Image appears dominated by green vegetation or foliage rather than bare soil.",
            )
        if stats["skyBlueRatio"] > gates["maxSkyBlueRatio"]:
            return unsupported(
                "NON_SOIL_SCENE",
                "Image includes substantial sky or open water background rather than bare soil.",
            )
        ood_protos = art.get("oodPrototypes") or []
        max_ood_sim = -1.0
        if len(ood_protos) > 0:
            ood_mat = np.asarray(ood_protos, dtype=np.float32)
            max_ood_sim = float(np.max(ood_mat @ emb))
        ood_margin_limit = float(gates.get("maxOodPrototypeMargin", 0.025))
        fails_ood_anchor = max_ood_sim > 0.0 and (max_ood_sim - max_proto_sim > ood_margin_limit)

        if (
            max_proto_sim < gates["minManifoldCosineSim"]
            or max_cent_sim < gates["minCentroidCosineSim"]
            or fails_ood_anchor
        ):
            return unsupported(
                "OUT_OF_DISTRIBUTION_OBJECT",
                "Image features fall outside the trained soil-texture distribution.",
            )

        top = scores[0]
        if top["probability"] < gates["minTopProbability"] or norm_entropy > gates["maxNormalizedEntropy"]:
            notes = SOIL_CLASS_AGRONOMIC_NOTES[top["soilClass"]]
            return {
                "status": "uncertain",
                "predictedClass": None,
                "agriSoilType": None,
                "closestCandidate": top["soilClass"],
                "confidence": top["probability"],
                "confidencePct": top["percentage"],
                "calibrated": bool(art.get("calibrated", True)),
                "scoringMethod": art.get("calibrationMethod", "softmax"),
                "scores": scores,
                "explanation": f"Uncertain soil texture: visual cues are ambiguous around {top['soilClass']} ({top['percentage']:.1f}%).",
                "visualIndicators": notes["visualIndicators"],
                "fieldGuidance": notes["fieldGuidance"],
                "rejectionReasonCode": "LOW_CONFIDENCE_AMBIGUOUS",
                "diagnostics": diagnostics,
                "model": model_meta,
                "caveats": SOIL_DATA_INTEGRITY_CAVEATS,
            }

        notes = SOIL_CLASS_AGRONOMIC_NOTES[top["soilClass"]]
        return {
            "status": "classified",
            "predictedClass": top["soilClass"],
            "agriSoilType": top["agriSoilType"],
            "closestCandidate": top["soilClass"],
            "confidence": top["probability"],
            "confidencePct": top["percentage"],
            "calibrated": bool(art.get("calibrated", True)),
            "scoringMethod": art.get("calibrationMethod", "softmax"),
            "scores": scores,
            "explanation": f"{notes['summary']} Top visual match: {top['soilClass']} ({top['percentage']:.1f}%).",
            "visualIndicators": notes["visualIndicators"],
            "fieldGuidance": notes["fieldGuidance"],
            "rejectionReasonCode": None,
            "diagnostics": diagnostics,
            "model": model_meta,
            "caveats": SOIL_DATA_INTEGRITY_CAVEATS,
        }


_DEFAULT_RUNTIME: SoilClassifierRuntime | None = None


def classify_soil_image_bytes(raw_bytes: bytes) -> dict[str, Any]:
    global _DEFAULT_RUNTIME
    if _DEFAULT_RUNTIME is None:
        _DEFAULT_RUNTIME = SoilClassifierRuntime()
    return _DEFAULT_RUNTIME.predict_bytes(raw_bytes)
