import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it, afterEach } from "node:test";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

import {
  preprocessSoilImageBuffer,
  SOIL_IMAGE_MAX_BYTES,
  SOIL_PREPROCESSING_CONFIG,
  SoilImageValidationError,
} from "../src/lib/ml/soil-preprocessing.ts";
import {
  clearSoilClassifierCacheForTests,
  loadSoilClassifierRuntime,
  scoreEmbeddingWithArtifact,
} from "../src/lib/ml/soil-classifier-server.ts";
import { handleSoilAnalysisPost } from "../src/lib/ml/soil-analysis-handler.ts";
import {
  deriveSoilAnalyzerDisplayState,
  validateSoilUploadFile,
} from "../src/lib/soil-analysis-client.ts";

const ROOT = process.cwd();
const FIXTURES_DIR = path.join(ROOT, "tests", "fixtures", "soil");
const ARTIFACT_DIR = path.join(ROOT, "ml", "artifacts", "soil");

function buildMultipartRequest(
  bytes,
  filename = "sample.jpg",
  mime = "image/jpeg",
  fieldName = "image",
) {
  const form = new FormData();
  form.append(fieldName, new Blob([bytes], { type: mime }), filename);
  return new Request("http://localhost:3000/api/soil-analysis", {
    method: "POST",
    body: form,
  });
}

function encodeSyntheticSolidOrPatternJpeg(width, height, pixelFn) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y);
      const idx = (y * width + x) * 4;
      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = 255;
    }
  }
  return jpeg.encode({ data: rgba, width, height }, 92).data;
}

describe("AgriSmart Soil Analyzer — End-to-End Verification Suite", () => {
  const origModelPath = process.env.AGRISMART_SOIL_MODEL_PATH;
  const origMlApiUrl = process.env.AGRISMART_ML_API_URL;
  const origFetch = globalThis.fetch;

  afterEach(() => {
    if (origModelPath === undefined) delete process.env.AGRISMART_SOIL_MODEL_PATH;
    else process.env.AGRISMART_SOIL_MODEL_PATH = origModelPath;

    if (origMlApiUrl === undefined) delete process.env.AGRISMART_ML_API_URL;
    else process.env.AGRISMART_ML_API_URL = origMlApiUrl;

    globalThis.fetch = origFetch;
    clearSoilClassifierCacheForTests();
  });

  it("1. verifies saved artifacts, label map, preprocessing config, and non-fabricated evaluation metrics exist", () => {
    for (const file of [
      "soil_classifier_artifact.json",
      "label_map.json",
      "preprocessing_config.json",
      "training_config.json",
      "evaluation_results.json",
      "dataset_manifest.json",
    ]) {
      assert.equal(
        fs.existsSync(path.join(ARTIFACT_DIR, file)),
        true,
        `Expected ${file} in ml/artifacts/soil/`,
      );
    }

    const evalRes = JSON.parse(
      fs.readFileSync(path.join(ARTIFACT_DIR, "evaluation_results.json"), "utf8"),
    );
    assert.deepEqual(evalRes.classes, ["Sandy", "Clayey", "Loamy", "Silty"]);
    assert.ok(evalRes.metrics.heldOutTest.sampleCount >= 16);
    assert.ok(evalRes.metrics.heldOutTest.accuracy >= 0.65);

    const prepSaved = JSON.parse(
      fs.readFileSync(path.join(ARTIFACT_DIR, "preprocessing_config.json"), "utf8"),
    );
    assert.deepEqual(prepSaved, SOIL_PREPROCESSING_CONFIG);
  });

  it("2. classifies held-out real Sandy soil photographs as Sandy and is invariant to file byte length", async () => {
    delete process.env.AGRISMART_ML_API_URL;
    const sandyBytes = fs.readFileSync(path.join(FIXTURES_DIR, "sandy_test_1.jpg"));

    const res1 = await handleSoilAnalysisPost(
      buildMultipartRequest(sandyBytes, "sandy_test_1.jpg", "image/jpeg"),
    );
    assert.equal(res1.status, 200);
    const body1 = await res1.json();

    assert.equal(body1.status, "classified");
    assert.equal(body1.predictedClass, "Sandy");
    assert.equal(body1.agriSoilType, "Sandy");
    assert.ok(body1.confidence > 0.43 && body1.confidence <= 1.0);
    assert.equal(body1.scores.length, 4);

    // Probabilities sum to ~100%
    const pctSum = body1.scores.reduce((acc, s) => acc + s.percentage, 0);
    assert.ok(Math.abs(pctSum - 100) <= 0.5, `Expected score sum ~100%, got ${pctSum}`);

    // Phase 6 Data Integrity: response must NEVER contain fabricated NPK, pH, or moisture values
    for (const forbidden of [
      "N",
      "P",
      "K",
      "nitrogen",
      "phosphorus",
      "potassium",
      "ph",
      "pH",
      "moisture",
    ]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(body1, forbidden),
        false,
        `Response must not fabricate ${forbidden}`,
      );
    }

    // Regression proof against old `Math.sin(file.size % 97)` bug:
    // Append trailing comment padding after EOI so file.size % 97 changes, verify identical pixel prediction!
    const paddedBytes = new Uint8Array(sandyBytes.length + 37);
    paddedBytes.set(sandyBytes, 0);
    const res2 = await handleSoilAnalysisPost(
      buildMultipartRequest(paddedBytes, "sandy_padded.jpg", "image/jpeg"),
    );
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.predictedClass, "Sandy");
    assert.equal(body2.confidencePct, body1.confidencePct);
  });

  it("3. evaluates held-out Clayey, Loamy, and Silty soil test fixtures through the live API handler", async () => {
    delete process.env.AGRISMART_ML_API_URL;
    const manifest = JSON.parse(
      fs.readFileSync(path.join(FIXTURES_DIR, "fixtures_manifest.json"), "utf8"),
    );
    const soilFixtures = manifest.filter((f) => !f.isOod);
    assert.ok(soilFixtures.length >= 8, "Expected held-out fixtures across all 4 soil classes");

    let correctCount = 0;
    const byClassCorrect = { Sandy: 0, Clayey: 0, Loamy: 0, Silty: 0 };

    for (const item of soilFixtures) {
      const bytes = fs.readFileSync(path.join(FIXTURES_DIR, item.filename));
      const res = await handleSoilAnalysisPost(
        buildMultipartRequest(bytes, item.filename, "image/jpeg"),
      );
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(["classified", "uncertain"].includes(body.status));
      const topGuess = body.predictedClass ?? body.closestCandidate;
      if (topGuess === item.expectedClass) {
        correctCount++;
        byClassCorrect[item.expectedClass]++;
      }
    }

    // Require strong multi-class accuracy across held-out real soil fixtures
    assert.ok(
      correctCount >= Math.ceil(soilFixtures.length * 0.75),
      `Expected >=75% held-out fixture match, got ${correctCount}/${soilFixtures.length}`,
    );
    assert.ok(byClassCorrect.Sandy >= 1, "Expected Sandy held-out fixture classified accurately");
    assert.ok(byClassCorrect.Clayey >= 1, "Expected Clayey held-out fixture classified accurately");
    assert.ok(byClassCorrect.Loamy >= 1, "Expected Loamy held-out fixture classified accurately");
  });

  it("4. verifies PNG support and training-vs-inference preprocessing parity", async () => {
    delete process.env.AGRISMART_ML_API_URL;
    const sandyJpg = fs.readFileSync(path.join(FIXTURES_DIR, "sandy_test_1.jpg"));
    const decodedJpg = jpeg.decode(sandyJpg, { useTArray: true, formatAsRGBA: true });

    // Re-encode identical pixels as PNG and run through API
    const png = new PNG({ width: decodedJpg.width, height: decodedJpg.height });
    png.data = Buffer.from(decodedJpg.data);
    const pngBytes = PNG.sync.write(png);

    const prepJpg = preprocessSoilImageBuffer(sandyJpg);
    const prepPng = preprocessSoilImageBuffer(pngBytes);

    assert.equal(prepPng.format, "png");
    assert.equal(prepPng.cropWidth, 224);
    assert.equal(prepPng.cropHeight, 224);
    assert.equal(prepPng.tensorValues.length, 224 * 224 * 3);

    // Exact pixel-identical tensor values between decoded JPG buffer and lossless PNG re-encode
    let maxAbsDiff = 0;
    for (let i = 0; i < prepJpg.tensorValues.length; i++) {
      const d = Math.abs(prepJpg.tensorValues[i] - prepPng.tensorValues[i]);
      if (d > maxAbsDiff) maxAbsDiff = d;
      assert.ok(prepPng.tensorValues[i] >= -1.0001 && prepPng.tensorValues[i] <= 1.0001);
    }
    assert.equal(maxAbsDiff, 0);

    const pngRes = await handleSoilAnalysisPost(
      buildMultipartRequest(pngBytes, "sandy_test_1.png", "image/png"),
    );
    assert.equal(pngRes.status, 200);
    const pngBody = await pngRes.json();
    assert.equal(pngBody.predictedClass, "Sandy");
    assert.equal(pngBody.diagnostics.format, "png");
  });

  it("5. rejects non-soil OOD scenes (green plants, sky, blank images, and held-out OOD photos)", async () => {
    delete process.env.AGRISMART_ML_API_URL;

    // 5a. Lush green plant foliage frame
    const greenLeafJpg = encodeSyntheticSolidOrPatternJpeg(256, 256, (x, y) => [
      35 + ((x * 7 + y * 3) % 25),
      155 + ((x * 11 + y * 5) % 55),
      30 + ((x * 3 + y * 7) % 25),
    ]);
    const leafRes = await handleSoilAnalysisPost(
      buildMultipartRequest(greenLeafJpg, "leaves.jpg", "image/jpeg"),
    );
    assert.equal(leafRes.status, 200);
    const leafBody = await leafRes.json();
    assert.equal(leafBody.status, "unsupported_input");
    assert.equal(leafBody.predictedClass, null);
    assert.equal(leafBody.rejectionReasonCode, "VEGETATION_DOMINATED");

    // 5b. Open blue sky frame
    const skyJpg = encodeSyntheticSolidOrPatternJpeg(256, 256, (x, y) => [
      55 + ((x + y) % 20),
      135 + ((x * 3) % 25),
      225 + ((y * 5) % 25),
    ]);
    const skyRes = await handleSoilAnalysisPost(
      buildMultipartRequest(skyJpg, "sky.jpg", "image/jpeg"),
    );
    const skyBody = await skyRes.json();
    assert.equal(skyBody.status, "unsupported_input");
    assert.equal(skyBody.predictedClass, null);
    assert.equal(skyBody.rejectionReasonCode, "NON_SOIL_SCENE");

    // 5c. Blank / near-black camera cap image
    const blackJpg = encodeSyntheticSolidOrPatternJpeg(256, 256, () => [3, 3, 3]);
    const blackRes = await handleSoilAnalysisPost(
      buildMultipartRequest(blackJpg, "dark.jpg", "image/jpeg"),
    );
    const blackBody = await blackRes.json();
    assert.equal(blackBody.status, "unsupported_input");
    assert.equal(blackBody.rejectionReasonCode, "POOR_IMAGE_QUALITY");

    // 5d. Held-out real OOD photographs from fixtures
    const manifest = JSON.parse(
      fs.readFileSync(path.join(FIXTURES_DIR, "fixtures_manifest.json"), "utf8"),
    );
    const oodFixtures = manifest.filter((f) => f.isOod);
    let rejectedCount = 0;
    for (const item of oodFixtures) {
      const bytes = fs.readFileSync(path.join(FIXTURES_DIR, item.filename));
      const res = await handleSoilAnalysisPost(
        buildMultipartRequest(bytes, item.filename, "image/jpeg"),
      );
      assert.equal(res.status, 200);
      const body = await res.json();
      if (body.status !== "classified") {
        rejectedCount++;
      }
    }
    assert.ok(
      rejectedCount >= Math.ceil(oodFixtures.length * 0.75),
      `Expected majority of held-out OOD fixtures rejected, got ${rejectedCount}/${oodFixtures.length}`,
    );
  });

  it("6. returns status='uncertain' when class probabilities are ambiguous", async () => {
    const runtime = await loadSoilClassifierRuntime();
    const sandyBytes = fs.readFileSync(path.join(FIXTURES_DIR, "sandy_test_1.jpg"));
    const prep = preprocessSoilImageBuffer(sandyBytes);

    // Zero-weight copy of artifact produces uniform [25%, 25%, 25%, 25%] scores while passing manifold gate
    const zeroWeightArtifact = {
      ...runtime.artifact,
      weights: runtime.artifact.weights.map((row) => row.map(() => 0)),
      biases: runtime.artifact.biases.map(() => 0),
    };
    const proto0 = new Float32Array(runtime.artifact.manifoldPrototypes[0]);
    const uncertainOut = scoreEmbeddingWithArtifact(proto0, prep, zeroWeightArtifact);

    assert.equal(uncertainOut.status, "uncertain");
    assert.equal(uncertainOut.predictedClass, null);
    assert.ok(uncertainOut.closestCandidate !== null);
    assert.equal(uncertainOut.rejectionReasonCode, "LOW_CONFIDENCE_AMBIGUOUS");
  });

  it("7. rejects invalid formats, empty uploads, corrupt files, and oversized uploads with accurate HTTP codes", async () => {
    // Empty 0-byte upload -> 400
    const emptyRes = await handleSoilAnalysisPost(
      buildMultipartRequest(new Uint8Array(0), "empty.jpg", "image/jpeg"),
    );
    assert.equal(emptyRes.status, 400);
    assert.equal((await emptyRes.json()).errorCode, "EMPTY_IMAGE");

    // Text file disguised as .jpg -> 415
    const textBytes = new TextEncoder().encode("not an image at all");
    const badFmtRes = await handleSoilAnalysisPost(
      buildMultipartRequest(textBytes, "fake.jpg", "image/jpeg"),
    );
    assert.equal(badFmtRes.status, 415);
    assert.equal((await badFmtRes.json()).errorCode, "UNSUPPORTED_IMAGE_FORMAT");

    // WebP magic header -> 415 with explicit message
    const webpHeader = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38,
      0x20,
    ]);
    const webpRes = await handleSoilAnalysisPost(
      buildMultipartRequest(webpHeader, "photo.webp", "image/webp"),
    );
    assert.equal(webpRes.status, 415);
    assert.equal((await webpRes.json()).errorCode, "UNSUPPORTED_IMAGE_FORMAT");

    // Corrupt JPEG magic bytes with garbage body -> 400 CORRUPT_IMAGE
    const corruptJpg = new Uint8Array(512);
    corruptJpg[0] = 0xff;
    corruptJpg[1] = 0xd8;
    corruptJpg[2] = 0xff;
    const corruptRes = await handleSoilAnalysisPost(
      buildMultipartRequest(corruptJpg, "corrupt.jpg", "image/jpeg"),
    );
    assert.equal(corruptRes.status, 400);
    assert.equal((await corruptRes.json()).errorCode, "CORRUPT_IMAGE");

    // Oversized > 10 MB upload -> 413 IMAGE_TOO_LARGE
    const oversized = new Uint8Array(SOIL_IMAGE_MAX_BYTES + 128);
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;
    const overRes = await handleSoilAnalysisPost(
      buildMultipartRequest(oversized, "huge.jpg", "image/jpeg"),
    );
    assert.equal(overRes.status, 413);
    assert.equal((await overRes.json()).errorCode, "IMAGE_TOO_LARGE");

    // Non-multipart JSON request -> 400 INVALID_CONTENT_TYPE
    const jsonReq = new Request("http://localhost:3000/api/soil-analysis", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const jsonRes = await handleSoilAnalysisPost(jsonReq);
    assert.equal(jsonRes.status, 400);
    assert.equal((await jsonRes.json()).errorCode, "INVALID_CONTENT_TYPE");
  });

  it("8. returns HTTP 503 SOIL_MODEL_UNAVAILABLE when the trained model artifact is missing", async () => {
    delete process.env.AGRISMART_ML_API_URL;
    process.env.AGRISMART_SOIL_MODEL_PATH = "/tmp/agrismart-missing-soil-artifact-xyz.json";
    clearSoilClassifierCacheForTests();

    const sandyBytes = fs.readFileSync(path.join(FIXTURES_DIR, "sandy_test_1.jpg"));
    const res = await handleSoilAnalysisPost(
      buildMultipartRequest(sandyBytes, "sandy_test_1.jpg", "image/jpeg"),
    );
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.errorCode, "SOIL_MODEL_UNAVAILABLE");
    assert.equal(body.predictedClass, undefined);
  });

  it("9. handles upstream FastAPI connection errors (503) and malformed model responses (502)", async () => {
    const sandyBytes = fs.readFileSync(path.join(FIXTURES_DIR, "sandy_test_1.jpg"));
    process.env.AGRISMART_ML_API_URL = "http://127.0.0.1:59999";

    // 9a. Unreachable upstream -> 503
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed: ECONNREFUSED");
    };
    const downRes = await handleSoilAnalysisPost(
      buildMultipartRequest(sandyBytes, "sandy_test_1.jpg", "image/jpeg"),
    );
    assert.equal(downRes.status, 503);
    assert.equal((await downRes.json()).errorCode, "SOIL_ML_SERVICE_UNAVAILABLE");

    // 9b. Upstream returns malformed JSON missing required contract fields -> 502 INVALID_MODEL_RESPONSE
    globalThis.fetch = async () =>
      Response.json({ soil: "Sandy", confidence: "high-maybe" }, { status: 200 });
    const badContractRes = await handleSoilAnalysisPost(
      buildMultipartRequest(sandyBytes, "sandy_test_1.jpg", "image/jpeg"),
    );
    assert.equal(badContractRes.status, 502);
    assert.equal((await badContractRes.json()).errorCode, "INVALID_MODEL_RESPONSE");
  });

  it("10. verifies client upload validation and UI display-state derivation (including retry & uncertainty)", () => {
    assert.equal(
      validateSoilUploadFile({ name: "field.jpg", size: 204800, type: "image/jpeg" }).valid,
      true,
    );
    assert.equal(
      validateSoilUploadFile({ name: "empty.png", size: 0, type: "image/png" }).valid,
      false,
    );
    assert.equal(
      validateSoilUploadFile({
        name: "huge.jpg",
        size: SOIL_IMAGE_MAX_BYTES + 1,
        type: "image/jpeg",
      }).valid,
      false,
    );
    assert.equal(
      validateSoilUploadFile({ name: "notes.pdf", size: 1024, type: "application/pdf" }).valid,
      false,
    );

    const errState = deriveSoilAnalyzerDisplayState({
      isAnalyzing: false,
      errorMessage: "Service unavailable",
      hasSelectedFile: true,
      result: null,
    });
    assert.equal(errState.kind, "error");
    assert.equal(errState.canRetry, true);

    const loadingState = deriveSoilAnalyzerDisplayState({
      isAnalyzing: true,
      errorMessage: null,
      hasSelectedFile: true,
      result: null,
    });
    assert.equal(loadingState.kind, "loading");
    assert.equal(loadingState.canRetry, false);
  });
});
