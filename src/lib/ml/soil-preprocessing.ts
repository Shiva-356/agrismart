import jpeg from "jpeg-js";
import { PNG } from "pngjs";

export const SOIL_IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const SOIL_IMAGE_MIN_DIMENSION = 64;
export const SOIL_PREPROCESSING_CONFIG = {
  version: "1.0.0",
  colorSpace: "RGB",
  exifTranspose: true,
  resizeShortestSide: 256,
  interpolation: "bilinear",
  centerCropSize: 224,
  normalization: "mobilenet_v1_minus1_to_plus1",
  scaleDivisor: 127.5,
  scaleOffset: -1.0,
  supportedMimeTypes: ["image/jpeg", "image/jpg", "image/png"] as const,
} as const;

export type SoilImageErrorCode =
  | "EMPTY_IMAGE"
  | "IMAGE_TOO_LARGE"
  | "UNSUPPORTED_IMAGE_FORMAT"
  | "CORRUPT_IMAGE"
  | "IMAGE_DIMENSIONS_TOO_SMALL";

export class SoilImageValidationError extends Error {
  readonly code: SoilImageErrorCode;
  readonly httpStatus: number;

  constructor(code: SoilImageErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = "SoilImageValidationError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type DecodedRgbImage = {
  width: number;
  height: number;
  format: "jpeg" | "png";
  exifOrientation: number;
  /** Interleaved RGB uint8 array of length width * height * 3 */
  rgb: Uint8Array;
};

export type PreprocessedSoilImage = {
  format: "jpeg" | "png";
  originalWidth: number;
  originalHeight: number;
  resizedWidth: number;
  resizedHeight: number;
  cropWidth: number;
  cropHeight: number;
  dhash64: string;
  /** Normalized float32 tensor values in [-1, 1] with shape [224, 224, 3] */
  tensorValues: Float32Array;
  /** Unnormalized center-crop RGB uint8 values [224 * 224 * 3] for OOD / exposure checks */
  croppedRgb: Uint8Array;
  /** Basic surface visual quality & scene statistics computed on the 224x224 center crop */
  sceneStats: {
    meanLuma: number;
    stdLuma: number;
    greenExcessRatio: number;
    skyBlueRatio: number;
    saturatedRatio: number;
    nearBlackRatio: number;
    nearWhiteRatio: number;
    edgeDensity: number;
  };
};

export function detectImageMagicFormat(bytes: Uint8Array): "jpeg" | "png" | "webp" | "gif" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "webp";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 && // G
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 // F
  ) {
    return "gif";
  }
  return null;
}

/**
 * Reads EXIF Orientation tag (0x0112) from a JPEG byte buffer if present.
 * Returns 1 (normal) when absent or unparseable.
 */
export function readJpegExifOrientation(bytes: Uint8Array): number {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let offset = 2;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break; // SOS or EOI
    const segLen = view.getUint16(offset + 2, false);
    if (segLen < 2 || offset + 2 + segLen > bytes.length) break;

    if (marker === 0xe1 && segLen >= 10) {
      // Check "Exif\0\0"
      const exifStart = offset + 4;
      if (
        bytes[exifStart] === 0x45 &&
        bytes[exifStart + 1] === 0x78 &&
        bytes[exifStart + 2] === 0x69 &&
        bytes[exifStart + 3] === 0x66 &&
        bytes[exifStart + 4] === 0x00 &&
        bytes[exifStart + 5] === 0x00
      ) {
        const tiffStart = exifStart + 6;
        if (tiffStart + 8 <= bytes.length) {
          const littleEndian = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
          const bigEndian = bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d;
          if (littleEndian || bigEndian) {
            const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
            const dirStart = tiffStart + ifdOffset;
            if (dirStart + 2 <= bytes.length) {
              const entries = view.getUint16(dirStart, littleEndian);
              for (let i = 0; i < entries; i++) {
                const entryOffset = dirStart + 2 + i * 12;
                if (entryOffset + 12 > bytes.length) break;
                const tag = view.getUint16(entryOffset, littleEndian);
                if (tag === 0x0112) {
                  const val = view.getUint16(entryOffset + 8, littleEndian);
                  return val >= 1 && val <= 8 ? val : 1;
                }
              }
            }
          }
        }
      }
    }
    offset += 2 + segLen;
  }
  return 1;
}

function applyExifOrientation(
  rgb: Uint8Array,
  width: number,
  height: number,
  orientation: number,
): { rgb: Uint8Array; width: number; height: number } {
  if (orientation <= 1 || orientation > 8) {
    return { rgb, width, height };
  }
  const swapDims = orientation >= 5 && orientation <= 8;
  const outW = swapDims ? height : width;
  const outH = swapDims ? width : height;
  const out = new Uint8Array(outW * outH * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let nx = x;
      let ny = y;
      switch (orientation) {
        case 2:
          nx = width - 1 - x;
          ny = y;
          break;
        case 3:
          nx = width - 1 - x;
          ny = height - 1 - y;
          break;
        case 4:
          nx = x;
          ny = height - 1 - y;
          break;
        case 5:
          nx = y;
          ny = x;
          break;
        case 6:
          nx = height - 1 - y;
          ny = x;
          break;
        case 7:
          nx = height - 1 - y;
          ny = width - 1 - x;
          break;
        case 8:
          nx = y;
          ny = width - 1 - x;
          break;
      }
      const srcIdx = (y * width + x) * 3;
      const dstIdx = (ny * outW + nx) * 3;
      out[dstIdx] = rgb[srcIdx]!;
      out[dstIdx + 1] = rgb[srcIdx + 1]!;
      out[dstIdx + 2] = rgb[srcIdx + 2]!;
    }
  }
  return { rgb: out, width: outW, height: outH };
}

export function decodeSoilImageBytes(
  rawInput: Uint8Array | ArrayBuffer,
  maxBytes: number = SOIL_IMAGE_MAX_BYTES,
): DecodedRgbImage {
  const bytes = rawInput instanceof Uint8Array ? rawInput : new Uint8Array(rawInput);

  if (bytes.byteLength === 0) {
    throw new SoilImageValidationError(
      "EMPTY_IMAGE",
      "Uploaded image file is empty (0 bytes). Please select a valid JPEG or PNG soil photograph.",
      400,
    );
  }

  if (bytes.byteLength > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(0);
    throw new SoilImageValidationError(
      "IMAGE_TOO_LARGE",
      `Image exceeds the ${mb} MB upload limit. Please upload a JPEG or PNG image under ${mb} MB.`,
      413,
    );
  }

  const format = detectImageMagicFormat(bytes);
  if (format === "webp" || format === "gif" || format === null) {
    const detectedMsg =
      format === "webp"
        ? "WebP images are not supported by the deterministic server decoder; please upload JPEG (.jpg/.jpeg) or PNG (.png)."
        : "Unsupported or unrecognized file format. Please upload a valid JPEG (.jpg/.jpeg) or PNG (.png) soil photograph.";
    throw new SoilImageValidationError("UNSUPPORTED_IMAGE_FORMAT", detectedMsg, 415);
  }

  let width = 0;
  let height = 0;
  let rgba: Uint8Array;
  let exifOrientation = 1;

  try {
    if (format === "jpeg") {
      exifOrientation = readJpegExifOrientation(bytes);
      const decoded = jpeg.decode(bytes, {
        useTArray: true,
        formatAsRGBA: true,
        maxMemoryUsageInMB: 512,
        maxResolutionInMP: 80,
      });
      width = decoded.width;
      height = decoded.height;
      rgba = decoded.data;
    } else {
      const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const decoded = PNG.sync.read(buf);
      width = decoded.width;
      height = decoded.height;
      rgba = new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength);
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : "decode error";
    throw new SoilImageValidationError(
      "CORRUPT_IMAGE",
      `Could not decode image pixels (${detail}). The file may be truncated or corrupted.`,
      400,
    );
  }

  if (width < SOIL_IMAGE_MIN_DIMENSION || height < SOIL_IMAGE_MIN_DIMENSION) {
    throw new SoilImageValidationError(
      "IMAGE_DIMENSIONS_TOO_SMALL",
      `Image resolution (${width}x${height}px) is too small for reliable soil texture analysis. Minimum size is ${SOIL_IMAGE_MIN_DIMENSION}x${SOIL_IMAGE_MIN_DIMENSION}px.`,
      400,
    );
  }

  // Convert RGBA -> RGB (compositing alpha against neutral mid-gray if transparent PNG)
  const pixelCount = width * height;
  const rawRgb = new Uint8Array(pixelCount * 3);
  for (let i = 0; i < pixelCount; i++) {
    const r = rgba[i * 4]!;
    const g = rgba[i * 4 + 1]!;
    const b = rgba[i * 4 + 2]!;
    const a = rgba[i * 4 + 3]!;
    if (a === 255) {
      rawRgb[i * 3] = r;
      rawRgb[i * 3 + 1] = g;
      rawRgb[i * 3 + 2] = b;
    } else {
      const alpha = a / 255;
      rawRgb[i * 3] = Math.round(r * alpha + 128 * (1 - alpha));
      rawRgb[i * 3 + 1] = Math.round(g * alpha + 128 * (1 - alpha));
      rawRgb[i * 3 + 2] = Math.round(b * alpha + 128 * (1 - alpha));
    }
  }

  const oriented = applyExifOrientation(rawRgb, width, height, exifOrientation);
  return {
    width: oriented.width,
    height: oriented.height,
    format,
    exifOrientation,
    rgb: oriented.rgb,
  };
}

/**
 * Deterministic bilinear resize matching standard half-pixel center alignment:
 * srcCoord = (dstCoord + 0.5) * (srcSize / dstSize) - 0.5
 */
export function bilinearResizeRgb(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8Array {
  if (srcW === dstW && srcH === dstH) {
    return new Uint8Array(src);
  }
  const dst = new Uint8Array(dstW * dstH * 3);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const sy = Math.max(0, Math.min(srcH - 1, (dy + 0.5) * scaleY - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(srcH - 1, y0 + 1);
    const wy = sy - y0;

    for (let dx = 0; dx < dstW; dx++) {
      const sx = Math.max(0, Math.min(srcW - 1, (dx + 0.5) * scaleX - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const wx = sx - x0;

      const idx00 = (y0 * srcW + x0) * 3;
      const idx10 = (y0 * srcW + x1) * 3;
      const idx01 = (y1 * srcW + x0) * 3;
      const idx11 = (y1 * srcW + x1) * 3;
      const outIdx = (dy * dstW + dx) * 3;

      for (let c = 0; c < 3; c++) {
        const top = src[idx00 + c]! * (1 - wx) + src[idx10 + c]! * wx;
        const bot = src[idx01 + c]! * (1 - wx) + src[idx11 + c]! * wx;
        dst[outIdx + c] = Math.round(top * (1 - wy) + bot * wy);
      }
    }
  }
  return dst;
}

export function cropRgb(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  offsetX: number,
  offsetY: number,
  cropW: number,
  cropH: number,
): Uint8Array {
  const dst = new Uint8Array(cropW * cropH * 3);
  for (let y = 0; y < cropH; y++) {
    const srcRowStart = ((offsetY + y) * srcW + offsetX) * 3;
    const dstRowStart = y * cropW * 3;
    dst.set(src.subarray(srcRowStart, srcRowStart + cropW * 3), dstRowStart);
  }
  return dst;
}

export function rgbCropToMobileNetFloat32(croppedRgb: Uint8Array): Float32Array {
  const out = new Float32Array(croppedRgb.length);
  const inv = 1 / SOIL_PREPROCESSING_CONFIG.scaleDivisor;
  const offset = SOIL_PREPROCESSING_CONFIG.scaleOffset;
  for (let i = 0; i < croppedRgb.length; i++) {
    out[i] = croppedRgb[i]! * inv + offset;
  }
  return out;
}

/**
 * 64-bit perceptual difference hash (9x8 grayscale horizontal gradient) encoded as 16 hex chars.
 * Used during dataset curation to detect near-duplicate images before train/val/test splitting.
 */
export function computeDHash64(rgb: Uint8Array, width: number, height: number): string {
  const small = bilinearResizeRgb(rgb, width, height, 9, 8);
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const iLeft = (y * 9 + x) * 3;
      const iRight = (y * 9 + x + 1) * 3;
      const lumaLeft = small[iLeft]! * 0.299 + small[iLeft + 1]! * 0.587 + small[iLeft + 2]! * 0.114;
      const lumaRight =
        small[iRight]! * 0.299 + small[iRight + 1]! * 0.587 + small[iRight + 2]! * 0.114;
      bits = (bits << 1n) | (lumaLeft < lumaRight ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, "0");
}

export function hammingDistanceHex64(a: string, b: string): number {
  let xor = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let dist = 0;
  while (xor > 0n) {
    dist += Number(xor & 1n);
    xor >>= 1n;
  }
  return dist;
}

export function computeSceneStats(croppedRgb: Uint8Array, size = 224) {
  const n = size * size;
  let sumLuma = 0;
  let sumSqLuma = 0;
  let greenDominant = 0;
  let skyBlue = 0;
  let highSat = 0;
  let nearBlack = 0;
  let nearWhite = 0;

  const lumaGrid = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const r = croppedRgb[i * 3]! / 255;
    const g = croppedRgb[i * 3 + 1]! / 255;
    const b = croppedRgb[i * 3 + 2]! / 255;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    lumaGrid[i] = luma;
    sumLuma += luma;
    sumSqLuma += luma * luma;

    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC > 1e-5 ? (maxC - minC) / maxC : 0;

    // Live chlorophyll vegetation check (excess green index ExG = 2g - r - b)
    if (2 * g - r - b > 0.16 && g > 0.22 && sat > 0.22) {
      greenDominant++;
    }
    // Open sky / blue screen check
    if (b - r > 0.18 && b > g && b > 0.35 && sat > 0.22) {
      skyBlue++;
    }
    if (sat > 0.68 && maxC > 0.35) {
      highSat++;
    }
    if (luma < 0.04) nearBlack++;
    if (luma > 0.96) nearWhite++;
  }

  let edgeCount = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const gx = Math.abs(lumaGrid[y * size + x + 1]! - lumaGrid[y * size + x - 1]!);
      const gy = Math.abs(lumaGrid[(y + 1) * size + x]! - lumaGrid[(y - 1) * size + x]!);
      if (gx + gy > 0.14) edgeCount++;
    }
  }

  const meanLuma = sumLuma / n;
  const variance = Math.max(0, sumSqLuma / n - meanLuma * meanLuma);

  return {
    meanLuma,
    stdLuma: Math.sqrt(variance),
    greenExcessRatio: greenDominant / n,
    skyBlueRatio: skyBlue / n,
    saturatedRatio: highSat / n,
    nearBlackRatio: nearBlack / n,
    nearWhiteRatio: nearWhite / n,
    edgeDensity: edgeCount / ((size - 2) * (size - 2)),
  };
}

/**
 * Canonical, deterministic preprocessing pipeline used identically at training
 * time and live inference time:
 * 1. Validate non-empty bytes, size <= 10 MB, and magic header (JPEG or PNG).
 * 2. Decode pixels to RGB and apply EXIF orientation transpose.
 * 3. Resize shortest side to 256px preserving aspect ratio via bilinear interpolation.
 * 4. Extract deterministic 224x224 center crop.
 * 5. Normalize to [-1, +1] via (pixel / 127.5) - 1.0.
 */
export function preprocessSoilImageBuffer(
  rawInput: Uint8Array | ArrayBuffer,
  maxBytes: number = SOIL_IMAGE_MAX_BYTES,
): PreprocessedSoilImage {
  const decoded = decodeSoilImageBytes(rawInput, maxBytes);
  const { width, height, rgb, format } = decoded;
  const dhash64 = computeDHash64(rgb, width, height);

  const targetShort = SOIL_PREPROCESSING_CONFIG.resizeShortestSide;
  const cropSize = SOIL_PREPROCESSING_CONFIG.centerCropSize;

  let resizedW: number;
  let resizedH: number;
  if (width <= height) {
    resizedW = targetShort;
    resizedH = Math.max(targetShort, Math.round((height * targetShort) / width));
  } else {
    resizedH = targetShort;
    resizedW = Math.max(targetShort, Math.round((width * targetShort) / height));
  }

  const resizedRgb = bilinearResizeRgb(rgb, width, height, resizedW, resizedH);
  const offsetX = Math.floor((resizedW - cropSize) / 2);
  const offsetY = Math.floor((resizedH - cropSize) / 2);
  const croppedRgb = cropRgb(resizedRgb, resizedW, resizedH, offsetX, offsetY, cropSize, cropSize);
  const tensorValues = rgbCropToMobileNetFloat32(croppedRgb);
  const sceneStats = computeSceneStats(croppedRgb, cropSize);

  return {
    format,
    originalWidth: width,
    originalHeight: height,
    resizedWidth: resizedW,
    resizedHeight: resizedH,
    cropWidth: cropSize,
    cropHeight: cropSize,
    dhash64,
    tensorValues,
    croppedRgb,
    sceneStats,
  };
}

/**
 * Generates deterministic geometric training-only views (center + 4 corner crops
 * + horizontal mirror of center crop) ONLY for images already assigned to the
 * training split. Never used on validation, test, or live inference images.
 */
export function generateTrainingAugmentedCrops(rawInput: Uint8Array | ArrayBuffer): Float32Array[] {
  const decoded = decodeSoilImageBytes(rawInput);
  const { width, height, rgb } = decoded;
  const targetShort = SOIL_PREPROCESSING_CONFIG.resizeShortestSide;
  const cropSize = SOIL_PREPROCESSING_CONFIG.centerCropSize;

  let resizedW: number;
  let resizedH: number;
  if (width <= height) {
    resizedW = targetShort;
    resizedH = Math.max(targetShort, Math.round((height * targetShort) / width));
  } else {
    resizedH = targetShort;
    resizedW = Math.max(targetShort, Math.round((width * targetShort) / height));
  }

  const resized = bilinearResizeRgb(rgb, width, height, resizedW, resizedH);
  const maxX = Math.max(0, resizedW - cropSize);
  const maxY = Math.max(0, resizedH - cropSize);
  const cx = Math.floor(maxX / 2);
  const cy = Math.floor(maxY / 2);

  const offsets: [number, number][] = [
    [cx, cy],
    [0, 0],
    [maxX, 0],
    [0, maxY],
    [maxX, maxY],
  ];

  const views: Float32Array[] = [];
  for (const [ox, oy] of offsets) {
    const crop = cropRgb(resized, resizedW, resizedH, ox, oy, cropSize, cropSize);
    views.push(rgbCropToMobileNetFloat32(crop));
  }

  // Horizontal mirror of center crop
  const centerCrop = cropRgb(resized, resizedW, resizedH, cx, cy, cropSize, cropSize);
  const flipped = new Uint8Array(centerCrop.length);
  for (let y = 0; y < cropSize; y++) {
    for (let x = 0; x < cropSize; x++) {
      const srcIdx = (y * cropSize + x) * 3;
      const dstIdx = (y * cropSize + (cropSize - 1 - x)) * 3;
      flipped[dstIdx] = centerCrop[srcIdx]!;
      flipped[dstIdx + 1] = centerCrop[srcIdx + 1]!;
      flipped[dstIdx + 2] = centerCrop[srcIdx + 2]!;
    }
  }
  views.push(rgbCropToMobileNetFloat32(flipped));
  return views;
}
