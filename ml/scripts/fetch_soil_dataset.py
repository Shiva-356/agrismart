#!/usr/bin/env python3
"""Reproducible downloader for AgriSmart's open-licensed soil texture dataset & backbone.

Sources used (100% open-licensed real photographs, zero synthetic/GAN images):
1. Poly Haven (https://polyhaven.com) — CC0 1.0 Public Domain calibrated overhead DSLR captures.
2. AmbientCG (https://ambientcg.com) — CC0 1.0 Public Domain flat overhead material captures
   (extracts the flat `*_Color.jpg` diffuse photograph from `1K-JPG` archives, never 3D sphere renders).
3. Wikimedia Commons (https://commons.wikimedia.org) — Public Domain, CC0, CC BY, and CC BY-SA
   field photographs of sandy, clayey, loamy, and silty/loess soils.
4. Pretrained Backbone: Google MobileNetV1 (0.50, 224x224) ImageNet weights (Apache-2.0)
   consolidated into `ml/artifacts/soil/backbone/model.json` + `weights.bin`.

Usage:
    python3 ml/scripts/fetch_soil_dataset.py
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import time
import urllib.parse
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT, "data", "soil_images_cache")
BACKBONE_DIR = os.path.join(ROOT, "artifacts", "soil", "backbone")

USER_AGENT = "AgriSmartSoilTrainer/1.0 (https://agrismart.local; agricultural research)"

# ---------------------------------------------------------------------------
# 1. Verified Poly Haven CC0 1.0 flat overhead camera captures (`Diffuse 1k jpg`)
#    Every asset below was audited against Poly Haven's official physical
#    surface description so labels reflect genuine soil texture.
# ---------------------------------------------------------------------------
POLYHAVEN_SOIL_ASSETS: list[tuple[str, str, str]] = [
    # (asset_id, class_label, source_group)
    # --- Sandy (21 captures: verified quartz/coastal/dune/granular sand) ---
    ("aerial_beach_01", "Sandy", "ph_aerial_beach_01"),
    ("aerial_beach_02", "Sandy", "ph_aerial_beach_02"),
    ("aerial_beach_03", "Sandy", "ph_aerial_beach_03"),
    ("aerial_sand", "Sandy", "ph_aerial_sand"),
    ("baseball_playground", "Sandy", "ph_baseball_playground"),
    ("coast_sand_01", "Sandy", "ph_coast_sand_01"),
    ("coast_sand_02", "Sandy", "ph_coast_sand_02"),
    ("coast_sand_05", "Sandy", "ph_coast_sand_05"),
    ("damp_beach_sand", "Sandy", "ph_damp_beach_sand"),
    ("damp_beach_sand_02", "Sandy", "ph_damp_beach_sand_02"),
    ("damp_sand", "Sandy", "ph_damp_sand"),
    ("dense_sand", "Sandy", "ph_dense_sand"),
    ("forrest_sand_01", "Sandy", "ph_forrest_sand_01"),
    ("gravelly_sand", "Sandy", "ph_gravelly_sand"),
    ("park_dirt", "Sandy", "ph_park_dirt"),
    ("park_sand", "Sandy", "ph_park_sand"),
    ("playground_sand", "Sandy", "ph_playground_sand"),
    ("red_sand", "Sandy", "ph_red_sand"),
    ("sand_02", "Sandy", "ph_sand_02"),
    ("sand_03", "Sandy", "ph_sand_03"),
    ("sandy_gravel_02", "Sandy", "ph_sandy_gravel_02"),
    # --- Clayey (9 captures: plastic red/brown clay & desiccation-cracked clay) ---
    ("cracked_red_ground", "Clayey", "ph_cracked_red_ground"),
    ("mud_cracked_dry_03", "Clayey", "ph_mud_cracked_dry_03"),
    ("mud_cracked_dry_riverbed_002", "Clayey", "ph_mud_cracked_dry_riverbed_002"),
    ("red_mud_stones", "Clayey", "ph_red_mud_stones"),
    ("red_laterite_soil_stones", "Clayey", "ph_red_laterite_soil_stones"),
    ("dry_ground_01", "Clayey", "ph_dry_ground_01"),
    ("dry_ground_rocks", "Clayey", "ph_dry_ground_rocks"),
    ("red_dirt_mud_01", "Clayey", "ph_red_dirt_mud_01"),
    ("dirt_aerial_02", "Clayey", "ph_dirt_aerial_02"),
    # --- Loamy (12 captures: ploughed arable topsoil, dark crumbly humus & garden earth) ---
    ("farm_furrows", "Loamy", "ph_farm_furrows"),
    ("farm_soil", "Loamy", "ph_farm_soil"),
    ("brown_mud", "Loamy", "ph_brown_mud"),
    ("brown_mud_02", "Loamy", "ph_brown_mud_02"),
    ("brown_mud_03", "Loamy", "ph_brown_mud_03"),
    ("brown_mud_dry", "Loamy", "ph_brown_mud_dry"),
    ("dry_mud_field_001", "Loamy", "ph_dry_mud_field_001"),
    ("forest_ground_05", "Loamy", "ph_forest_ground_05"),
    ("forest_ground_06", "Loamy", "ph_forest_ground_06"),
    ("raked_dirt", "Loamy", "ph_raked_dirt"),
    ("muddy_tracks", "Loamy", "ph_muddy_tracks"),
    ("aerial_mud_1", "Loamy", "ph_aerial_mud_1"),
]

# Non-soil OOD benchmark images from Poly Haven CC0 (asphalt, brick, foliage, wood, fabric)
POLYHAVEN_OOD_ASSETS: list[tuple[str, str]] = [
    ("asphalt_02", "road_asphalt"),
    ("asphalt_04", "road_asphalt"),
    ("red_brick", "building_brick"),
    ("brick_wall_001", "building_brick"),
    ("concrete_layers_02", "building_concrete"),
    ("wood_planks", "wood_surface"),
    ("bark_brown_02", "plant_bark"),
    ("leaves_forest_ground", "plant_foliage"),
    ("denim_fabric", "manmade_fabric"),
    ("corrugated_iron", "manmade_metal"),
]

# ---------------------------------------------------------------------------
# 2. Verified AmbientCG CC0 1.0 flat overhead camera captures (`1K-JPG` Color)
#    At most ONE variant per capture series ID (e.g. Ground093A only, never B/C)
#    so capture-series leakage across train/val/test is structurally impossible.
# ---------------------------------------------------------------------------
AMBIENTCG_SOIL_ASSETS: list[tuple[str, str, str]] = [
    # --- Sandy (15 distinct series) ---
    ("Ground027", "Sandy", "acg_Ground027"),
    ("Ground033", "Sandy", "acg_Ground033"),
    ("Ground043", "Sandy", "acg_Ground043"),
    ("Ground046", "Sandy", "acg_Ground046"),
    ("Ground052", "Sandy", "acg_Ground052"),
    ("Ground054", "Sandy", "acg_Ground054"),
    ("Ground055L", "Sandy", "acg_Ground055"),
    ("Ground057", "Sandy", "acg_Ground057"),
    ("Ground059", "Sandy", "acg_Ground059"),
    ("Ground080", "Sandy", "acg_Ground080"),
    ("Ground088", "Sandy", "acg_Ground088"),
    ("Ground092A", "Sandy", "acg_Ground092"),
    ("Ground093A", "Sandy", "acg_Ground093"),
    ("Ground097", "Sandy", "acg_Ground097"),
    ("Ground101", "Sandy", "acg_Ground101"),
    # --- Clayey (12 distinct series: Clay001..009 + cracked/plastic clay Ground) ---
    ("Clay001", "Clayey", "acg_Clay001"),
    ("Clay002", "Clayey", "acg_Clay002"),
    ("Clay003", "Clayey", "acg_Clay003"),
    ("Clay004", "Clayey", "acg_Clay004"),
    ("Clay005", "Clayey", "acg_Clay005"),
    ("Clay006", "Clayey", "acg_Clay006"),
    ("Clay007", "Clayey", "acg_Clay007"),
    ("Clay008", "Clayey", "acg_Clay008"),
    ("Clay009", "Clayey", "acg_Clay009"),
    ("Ground025", "Clayey", "acg_Ground025"),
    ("Ground026", "Clayey", "acg_Ground026"),
    ("Ground031", "Clayey", "acg_Ground031"),
    # --- Loamy (13 distinct series: dark crumbly earth, humus & bare topsoil) ---
    ("Ground012", "Loamy", "acg_Ground012"),
    ("Ground015", "Loamy", "acg_Ground015"),
    ("Ground018", "Loamy", "acg_Ground018"),
    ("Ground036", "Loamy", "acg_Ground036"),
    ("Ground048", "Loamy", "acg_Ground048"),
    ("Ground049A", "Loamy", "acg_Ground049"),
    ("Ground051", "Loamy", "acg_Ground051"),
    ("Ground066", "Loamy", "acg_Ground066"),
    ("Ground071", "Loamy", "acg_Ground071"),
    ("Ground082L", "Loamy", "acg_Ground082"),
    ("Ground103", "Loamy", "acg_Ground103"),
    ("Ground104", "Loamy", "acg_Ground104"),
    ("Ground050", "Loamy", "acg_Ground050"),
    # --- Silty (7 distinct series: fine-grained water-deposited layered silt/alluvial sediment) ---
    ("Ground091", "Silty", "acg_Ground091"),
    ("Ground094A", "Silty", "acg_Ground094"),
    ("Ground095C", "Silty", "acg_Ground095"),
    ("Ground100", "Silty", "acg_Ground100"),
    ("Ground102", "Silty", "acg_Ground102"),
    ("Ground105", "Silty", "acg_Ground105"),
    ("Ground109", "Silty", "acg_Ground109"),
]

# ---------------------------------------------------------------------------
# 3. Verified Wikimedia Commons open-licensed close-up bare soil photographs
#    (Zero wide horizon/sky landscape cliffs or product boxes)
# ---------------------------------------------------------------------------
WIKIMEDIA_SOIL_FILES: list[tuple[str, str, str]] = [
    # --- Sandy ---
    ("File:A close-up of river sand.JPG", "Sandy", "wm_river_sand"),
    ("File:161 - Sandy Lines (7175397263).jpg", "Sandy", "wm_sandy_lines"),
    ("File:Beach Sand (14558905425).jpg", "Sandy", "wm_beach_sand_1455"),
    ("File:Beach Sand - 3252.jpg", "Sandy", "wm_beach_sand_3252"),
    # --- Clayey ---
    ('File:"Dry land.".JPG', "Clayey", "wm_dry_land_cracked"),
    ("File:12082013-Iphone V Death Valley (9675271197).jpg", "Clayey", "wm_death_valley_mudcrack"),
    ("File:Dirt and Mud 008 - Mud.jpg", "Clayey", "wm_dirt_mud_008"),
    ("File:A depiction of clay for pot making.JPG", "Clayey", "wm_raw_clay"),
    ("File:Análise física do solo.jpg", "Clayey", "wm_analise_solo_clay"),
    ("File:Clay cracked.jpg", "Clayey", "wm_clay_cracked_india"),
    ("File:Angular blocky soil structure.jpg", "Clayey", "wm_angular_blocky_clay"),
    ("File:Prismatisches Gefüge.JPG", "Clayey", "wm_prismatic_clay"),
    # --- Loamy ---
    ("File:2018 chernozem soil on limestone .jpeg", "Loamy", "wm_chernozem_1"),
    ("File:Dirt Mulch Texture.jpg", "Loamy", "wm_dirt_mulch"),
    ("File:Dirt (4903252983).jpg", "Loamy", "wm_dirt_4903"),
    ("File:Dirt texture.jpg", "Loamy", "wm_dirt_texture_loam"),
    ("File:Krümelgefüge.JPG", "Loamy", "wm_kruemel_loam"),
    ("File:Great Soil Structure in Stehly Crop Field in Eastern, SD (21480483232).jpg", "Loamy", "wm_usda_stehly_loam"),
    ("File:Douglas County, SD, Soil Structure on April 27, 2015 (17207379368).jpg", "Loamy", "wm_usda_douglas_loam"),
    # --- Silty (wind-blown loess close-ups, floodplain silts/limos, estuarine & alluvial silt) ---
    ("File:Loess Close Up.jpg", "Silty", "wm_loess_closeup"),
    ("File:Löss feingemahlen nah.jpg", "Silty", "wm_loess_fine"),
    ("File:Loess (9940595213).jpg", "Silty", "wm_loess_9940"),
    ("File:Amas de limon.JPG", "Silty", "wm_amas_limon"),
    ("File:Butte de limon.JPG", "Silty", "wm_butte_limon"),
    ("File:Filtration du limon.JPG", "Silty", "wm_filtration_limon"),
    ("File:Rill on silt, Passeio do Tejo, Lisbon, Portugal july 2015.jpg", "Silty", "wm_rill_on_silt"),
    ("File:Earthworm in silty soil.jpg", "Silty", "wm_earthworm_silty"),
    ("File:Mudflat channel. Kincaid Park, Alaska (54293909537).jpg", "Silty", "wm_kincaid_silt"),
    ("File:Silty soil outside of Pedro Bay (ec313871-9c40-4637-b6a4-fa847db144c4).jpg", "Silty", "wm_pedro_bay_silt"),
    ("File:Upland soil sample.JPG", "Silty", "wm_upland_silt_sample"),
    ("File:Polyedergefüge.JPG", "Silty", "wm_polyeder_silty"),
    ("File:Dumblas.jpg", "Silty", "wm_dumblas_silt"),
    ("File:Río Tinto, cauce 30.jpg", "Silty", "wm_tinto_berrocal_silt"),
    ("File:Río Tinto, limos 04.jpg", "Silty", "wm_tinto_berrocal_silt"),
    ("File:Río Tinto, limos 01.jpg", "Silty", "wm_tinto_zalamea_silt"),
    ("File:Río Tinto, limos 15.jpg", "Silty", "wm_tinto_zalamea_silt"),
]

WIKIMEDIA_OOD_FILES: list[tuple[str, str]] = [
    ("File:Asphalt road in Finland.jpg", "road_asphalt"),
    ("File:Green leaves background.jpg", "plant_foliage"),
    ("File:Tomato plant leaves.jpg", "plant_foliage"),
    ("File:Modern office building facade.jpg", "building_facade"),
    ("File:Portrait of a smiling farmer.jpg", "person_portrait"),
]


def http_get_bytes(url: str, retries: int = 3) -> bytes:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=25) as r:
                return r.read()
        except Exception as err:
            last_err = err
            time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(f"Failed to GET {url}: {last_err}")


def is_valid_jpeg_or_png(data: bytes) -> bool:
    if len(data) < 256:
        return False
    return data[:3] == b"\xff\xd8\xff" or data[:8] == b"\x89PNG\r\n\x1a\n"


def fetch_backbone() -> None:
    os.makedirs(BACKBONE_DIR, exist_ok=True)
    model_json_path = os.path.join(BACKBONE_DIR, "model.json")
    weights_bin_path = os.path.join(BACKBONE_DIR, "weights.bin")
    if os.path.exists(model_json_path) and os.path.exists(weights_bin_path):
        print("[backbone] Already cached at", BACKBONE_DIR)
        return

    base_url = "https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.50_224"
    print("[backbone] Downloading MobileNetV1 0.50 224 model.json ...")
    mj = json.loads(http_get_bytes(f"{base_url}/model.json").decode("utf-8"))

    shard_paths: list[str] = []
    merged_weights: list[dict[str, Any]] = []
    for group in mj.get("weightsManifest", []):
        for p in group.get("paths", []):
            shard_paths.append(p)
        for w in group.get("weights", []):
            merged_weights.append(w)

    print(f"[backbone] Downloading & consolidating {len(shard_paths)} weight shards ...")
    shard_bytes_map: dict[str, bytes] = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = {pool.submit(http_get_bytes, f"{base_url}/{sp}"): sp for sp in shard_paths}
        for fut in as_completed(futs):
            sp = futs[fut]
            shard_bytes_map[sp] = fut.result()

    consolidated = b"".join(shard_bytes_map[sp] for sp in shard_paths)
    with open(weights_bin_path, "wb") as f:
        f.write(consolidated)

    mj["weightsManifest"] = [
        {
            "paths": ["weights.bin"],
            "weights": merged_weights,
        }
    ]
    mj["sourceInfo"] = {
        "upstreamUrl": f"{base_url}/model.json",
        "architecture": "MobileNetV1_0.50_224",
        "license": "Apache-2.0",
        "sha256Weights": hashlib.sha256(consolidated).hexdigest(),
    }
    with open(model_json_path, "w", encoding="utf-8") as f:
        json.dump(mj, f)
    print(f"[backbone] Saved consolidated backbone ({len(consolidated) / 1e6:.2f} MB)")


def fetch_polyhaven_item(asset_id: str, label: str, group: str, is_ood: bool = False) -> dict[str, Any] | None:
    sub = "ood" if is_ood else label
    out_dir = os.path.join(CACHE_DIR, sub)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"ph_{asset_id}.jpg")

    files_meta = json.loads(http_get_bytes(f"https://api.polyhaven.com/files/{asset_id}").decode("utf-8"))
    diff = (
        files_meta.get("Diffuse", {}).get("1k", {}).get("jpg")
        or files_meta.get("diff", {}).get("1k", {}).get("jpg")
        or files_meta.get("col_1", {}).get("1k", {}).get("jpg")
        or files_meta.get("col", {}).get("1k", {}).get("jpg")
    )
    if not diff or not diff.get("url"):
        print(f"  [skip] PolyHaven {asset_id}: no 1k Diffuse jpg")
        return None
    dl_url = diff["url"]
    if not os.path.exists(out_path):
        data = http_get_bytes(dl_url)
        if not is_valid_jpeg_or_png(data):
            return None
        with open(out_path, "wb") as f:
            f.write(data)
    else:
        with open(out_path, "rb") as f:
            data = f.read()

    return {
        "id": f"ph_{asset_id}",
        "label": label,
        "isOod": is_ood,
        "sourceGroup": group,
        "sourcePlatform": "Poly Haven",
        "sourceAssetId": asset_id,
        "sourceUrl": f"https://polyhaven.com/a/{asset_id}",
        "downloadUrl": dl_url,
        "license": "CC0 1.0",
        "localPath": os.path.relpath(out_path, ROOT),
        "sha256": hashlib.sha256(data).hexdigest(),
        "bytes": len(data),
    }


def fetch_ambientcg_item(asset_id: str, label: str, group: str) -> dict[str, Any] | None:
    out_dir = os.path.join(CACHE_DIR, label)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"acg_{asset_id}.jpg")

    meta_url = f"https://ambientcg.com/api/v2/full_json?id={urllib.parse.quote(asset_id)}&include=downloadData"
    meta = json.loads(http_get_bytes(meta_url).decode("utf-8"))
    found = meta.get("foundAssets") or []
    if not found:
        print(f"  [skip] AmbientCG {asset_id}: not found")
        return None
    dl_url = None
    try:
        downloads = found[0]["downloadFolders"]["default"]["downloadFiletypeCategories"]["zip"]["downloads"]
        for d in downloads:
            if d.get("attribute") == "1K-JPG":
                dl_url = d.get("downloadLink")
                break
    except Exception:
        pass
    if not dl_url:
        print(f"  [skip] AmbientCG {asset_id}: no 1K-JPG zip")
        return None

    if not os.path.exists(out_path):
        zip_bytes = http_get_bytes(dl_url)
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            color_names = [n for n in zf.namelist() if "Color" in n and n.lower().endswith((".jpg", ".jpeg"))]
            if not color_names:
                print(f"  [skip] AmbientCG {asset_id}: no Color.jpg in zip")
                return None
            data = zf.read(color_names[0])
        if not is_valid_jpeg_or_png(data):
            return None
        with open(out_path, "wb") as f:
            f.write(data)
    else:
        with open(out_path, "rb") as f:
            data = f.read()

    return {
        "id": f"acg_{asset_id}",
        "label": label,
        "isOod": False,
        "sourceGroup": group,
        "sourcePlatform": "AmbientCG",
        "sourceAssetId": asset_id,
        "sourceUrl": f"https://ambientcg.com/view?id={asset_id}",
        "downloadUrl": dl_url,
        "license": "CC0 1.0",
        "localPath": os.path.relpath(out_path, ROOT),
        "sha256": hashlib.sha256(data).hexdigest(),
        "bytes": len(data),
    }


def fetch_wikimedia_batch(items: list[tuple[str, str, str]], is_ood: bool = False) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for item in items:
        if is_ood:
            title, ood_cat = item[0], item[1]
            label, group = ood_cat, f"wm_ood_{ood_cat}"
        else:
            title, label, group = item
        time.sleep(0.35)
        api_url = (
            "https://commons.wikimedia.org/w/api.php?action=query"
            f"&titles={urllib.parse.quote(title)}"
            "&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1024&format=json"
        )
        try:
            res = json.loads(http_get_bytes(api_url).decode("utf-8"))
            pages = list((res.get("query", {}).get("pages") or {}).values())
            if not pages or "missing" in pages[0]:
                # Fallback search if exact filename varied
                continue
            ii = (pages[0].get("imageinfo") or [{}])[0]
            dl_url = ii.get("thumburl") or ii.get("url")
            if not dl_url:
                continue
            ext = ii.get("extmetadata") or {}
            lic = (ext.get("LicenseShortName") or {}).get("value", "CC BY-SA")
            artist = (ext.get("Artist") or {}).get("value", "")

            sub = "ood" if is_ood else label
            out_dir = os.path.join(CACHE_DIR, sub)
            os.makedirs(out_dir, exist_ok=True)
            safe_id = group + "_" + hashlib.md5(title.encode("utf-8")).hexdigest()[:6]
            out_path = os.path.join(out_dir, f"{safe_id}.jpg")
            if not os.path.exists(out_path):
                time.sleep(0.25)
                data = http_get_bytes(dl_url)
                if not is_valid_jpeg_or_png(data):
                    continue
                with open(out_path, "wb") as f:
                    f.write(data)
            else:
                with open(out_path, "rb") as f:
                    data = f.read()

            records.append(
                {
                    "id": safe_id,
                    "label": label,
                    "isOod": is_ood,
                    "sourceGroup": group,
                    "sourcePlatform": "Wikimedia Commons",
                    "sourceAssetId": title,
                    "sourceUrl": f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
                    "downloadUrl": dl_url,
                    "license": lic,
                    "attribution": " ".join(artist.split())[:160],
                    "localPath": os.path.relpath(out_path, ROOT),
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "bytes": len(data),
                }
            )
        except Exception as err:
            print(f"  [skip] Wikimedia {title}: {err}")
    return records


def fetch_wikimedia_ood_search() -> list[dict[str, Any]]:
    """Fetches real open-licensed non-soil photos (roads, plants, buildings, people) from Commons."""
    queries = [
        ('"asphalt road" surface', "road_asphalt", 3),
        ('"green leaves" plant close', "plant_foliage", 3),
        ('"office building" facade', "building_facade", 3),
        ('"smiling person" portrait outdoor', "person_portrait", 3),
    ]
    records: list[dict[str, Any]] = []
    for q, cat, want in queries:
        time.sleep(0.4)
        url = (
            "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6"
            f"&gsrsearch={urllib.parse.quote(q + ' filetype:bitmap')}&gsrlimit=10"
            "&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1024&format=json"
        )
        try:
            res = json.loads(http_get_bytes(url).decode("utf-8"))
            pages = list((res.get("query", {}).get("pages") or {}).values())
            got = 0
            for p in pages:
                if got >= want:
                    break
                ii = (p.get("imageinfo") or [{}])[0]
                if ii.get("mime") != "image/jpeg":
                    continue
                dl_url = ii.get("thumburl") or ii.get("url")
                if not dl_url:
                    continue
                title = p.get("title", "")
                lic = ((ii.get("extmetadata") or {}).get("LicenseShortName") or {}).get("value", "CC BY-SA")
                out_dir = os.path.join(CACHE_DIR, "ood")
                os.makedirs(out_dir, exist_ok=True)
                safe_id = f"wm_ood_{cat}_{hashlib.md5(title.encode('utf-8')).hexdigest()[:6]}"
                out_path = os.path.join(out_dir, f"{safe_id}.jpg")
                if not os.path.exists(out_path):
                    time.sleep(0.25)
                    data = http_get_bytes(dl_url)
                    if not is_valid_jpeg_or_png(data):
                        continue
                    with open(out_path, "wb") as f:
                        f.write(data)
                else:
                    with open(out_path, "rb") as f:
                        data = f.read()
                records.append(
                    {
                        "id": safe_id,
                        "label": cat,
                        "isOod": True,
                        "sourceGroup": safe_id,
                        "sourcePlatform": "Wikimedia Commons",
                        "sourceAssetId": title,
                        "sourceUrl": f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
                        "downloadUrl": dl_url,
                        "license": lic,
                        "localPath": os.path.relpath(out_path, ROOT),
                        "sha256": hashlib.sha256(data).hexdigest(),
                        "bytes": len(data),
                    }
                )
                got += 1
        except Exception as err:
            print(f"  [skip] Wikimedia OOD {q}: {err}")
    return records


def main() -> None:
    os.makedirs(CACHE_DIR, exist_ok=True)
    fetch_backbone()

    manifest: list[dict[str, Any]] = []

    print(f"[dataset] Fetching {len(POLYHAVEN_SOIL_ASSETS)} Poly Haven soil scans ...")
    with ThreadPoolExecutor(max_workers=6) as pool:
        futs = [pool.submit(fetch_polyhaven_item, a, lbl, grp, False) for a, lbl, grp in POLYHAVEN_SOIL_ASSETS]
        for fut in as_completed(futs):
            rec = fut.result()
            if rec:
                manifest.append(rec)

    print(f"[dataset] Fetching {len(POLYHAVEN_OOD_ASSETS)} Poly Haven OOD non-soil scans ...")
    with ThreadPoolExecutor(max_workers=6) as pool:
        futs = [pool.submit(fetch_polyhaven_item, a, cat, f"ph_ood_{a}", True) for a, cat in POLYHAVEN_OOD_ASSETS]
        for fut in as_completed(futs):
            rec = fut.result()
            if rec:
                manifest.append(rec)

    print(f"[dataset] Fetching {len(AMBIENTCG_SOIL_ASSETS)} AmbientCG flat Color soil scans ...")
    with ThreadPoolExecutor(max_workers=6) as pool:
        futs = [pool.submit(fetch_ambientcg_item, a, lbl, grp) for a, lbl, grp in AMBIENTCG_SOIL_ASSETS]
        for fut in as_completed(futs):
            rec = fut.result()
            if rec:
                manifest.append(rec)

    print(f"[dataset] Fetching {len(WIKIMEDIA_SOIL_FILES)} Wikimedia Commons soil photographs ...")
    manifest.extend(fetch_wikimedia_batch(WIKIMEDIA_SOIL_FILES, is_ood=False))

    print("[dataset] Fetching Wikimedia Commons OOD non-soil photographs ...")
    manifest.extend(fetch_wikimedia_ood_search())

    # Deterministic sort by id
    manifest.sort(key=lambda r: r["id"])
    manifest_path = os.path.join(CACHE_DIR, "raw_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    by_class: dict[str, int] = {}
    ood_count = 0
    for r in manifest:
        if r["isOod"]:
            ood_count += 1
        else:
            by_class[r["label"]] = by_class.get(r["label"], 0) + 1

    print("[dataset] Completed! Soil class counts:", by_class, "| OOD non-soil count:", ood_count)


if __name__ == "__main__":
    main()
