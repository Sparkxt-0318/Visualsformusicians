import type { Scene } from './scenes';

export type AudioFeatures = {
  amplitude: number;
  bass: number;
  mid: number;
  treble: number;
  beat: boolean;
};

export type AsciiRenderInput = {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  scene: Scene;
  cellSize: number;
  charRamp: string;
  colorMode: Scene['colorMode'];
  /** Source-resolution mask. */
  maskData: Float32Array;
  maskWidth: number;
  maskHeight: number;
  /** Mirrored to match the on-screen orientation. */
  mirrorX: boolean;
  bgImage: ImageBitmap | null;
  audio: AudioFeatures;
  /** Frame timestamp in ms, used for churn / pulse phase. */
  timestampMs: number;
};

const sampleCanvas = document.createElement('canvas');
const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true })!;
let cachedSourceId = -1;
let cachedSourceBitmap: ImageBitmap | null = null;
let cachedSampleData: ImageData | null = null;
let cachedSampleW = 0;
let cachedSampleH = 0;

function ensureSampleBuffer(
  bgImage: ImageBitmap,
  cols: number,
  rows: number,
  bgId: number,
) {
  // Render the background image into a low-res buffer matching the ASCII grid,
  // then sample brightness/color per cell from it.
  if (
    cachedSourceId === bgId &&
    cachedSourceBitmap === bgImage &&
    cachedSampleW === cols &&
    cachedSampleH === rows &&
    cachedSampleData
  ) {
    return cachedSampleData;
  }
  sampleCanvas.width = cols;
  sampleCanvas.height = rows;
  sampleCtx.imageSmoothingEnabled = true;

  // Cover-fit the source into the grid to avoid stretching.
  const srcAspect = bgImage.width / bgImage.height;
  const dstAspect = cols / rows;
  let sx = 0,
    sy = 0,
    sw = bgImage.width,
    sh = bgImage.height;
  if (srcAspect > dstAspect) {
    sw = bgImage.height * dstAspect;
    sx = (bgImage.width - sw) / 2;
  } else {
    sh = bgImage.width / dstAspect;
    sy = (bgImage.height - sh) / 2;
  }
  sampleCtx.clearRect(0, 0, cols, rows);
  sampleCtx.drawImage(bgImage, sx, sy, sw, sh, 0, 0, cols, rows);
  cachedSampleData = sampleCtx.getImageData(0, 0, cols, rows);
  cachedSampleW = cols;
  cachedSampleH = rows;
  cachedSourceId = bgId;
  cachedSourceBitmap = bgImage;
  return cachedSampleData;
}

/** Bilinear sample of mask at normalized [0..1] coords. */
function sampleMask(
  mask: Float32Array,
  w: number,
  h: number,
  u: number,
  v: number,
): number {
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
  const x = u * (w - 1);
  const y = v * (h - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = x - x0;
  const fy = y - y0;
  const a = mask[y0 * w + x0];
  const b = mask[y0 * w + x1];
  const c = mask[y1 * w + x0];
  const d = mask[y1 * w + x1];
  return (
    a * (1 - fx) * (1 - fy) +
    b * fx * (1 - fy) +
    c * (1 - fx) * fy +
    d * fx * fy
  );
}

function rgbToHex(r: number, g: number, b: number): string {
  return `rgb(${r},${g},${b})`;
}

let bgImageCounter = 0;
const bgIdMap = new WeakMap<ImageBitmap, number>();
function bgIdOf(img: ImageBitmap): number {
  let id = bgIdMap.get(img);
  if (id === undefined) {
    id = bgImageCounter++;
    bgIdMap.set(img, id);
  }
  return id;
}

export function renderAscii(input: AsciiRenderInput) {
  const {
    ctx,
    canvasWidth,
    canvasHeight,
    scene,
    cellSize,
    charRamp,
    colorMode,
    maskData,
    maskWidth,
    maskHeight,
    mirrorX,
    bgImage,
    audio,
    timestampMs,
  } = input;

  const cols = Math.max(2, Math.floor(canvasWidth / cellSize));
  const rows = Math.max(2, Math.floor(canvasHeight / cellSize));

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  if (scene.backgroundEffect === 'noise') {
    drawNoise(ctx, canvasWidth, canvasHeight, audio);
  }

  const bgId = bgImage ? bgIdOf(bgImage) : -1;
  const sample = bgImage ? ensureSampleBuffer(bgImage, cols, rows, bgId) : null;

  const fontPx = Math.max(8, Math.floor(cellSize * 1.4));
  ctx.font = `${fontPx}px ui-monospace, "JetBrains Mono", "Menlo", monospace`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const ramp = charRamp.length > 0 ? charRamp : ' .:-=+*#%@';
  const rampLen = ramp.length;

  // Audio modulation
  const densityShift =
    audio.amplitude * scene.audioReactivity.amplitudeToDensity;
  const pulse = audio.bass * scene.audioReactivity.bassToPulse;
  // Bass dilates the silhouette; threshold drops slightly on heavy bass.
  const maskThreshold = Math.max(0.15, 0.5 - pulse * 0.35);
  const churn = audio.beat ? scene.audioReactivity.beatChurn : 0;
  const churnSeed = Math.floor(timestampMs / 33);

  const inverted = scene.inverted === true;
  const monoColor = scene.monoColor ?? '#f4f4f5';
  const palette = scene.palette ?? ['#f4f4f5'];

  // Track grid in column-major order so we can iterate left→right by row.
  for (let r = 0; r < rows; r++) {
    const v = (r + 0.5) / rows;
    for (let c = 0; c < cols; c++) {
      const u = (c + 0.5) / cols;
      const sampleU = mirrorX ? 1 - u : u;
      const m = sampleMask(maskData, maskWidth, maskHeight, sampleU, v);
      const inside = m > maskThreshold;
      const draw = inverted ? !inside : inside;
      if (!draw) continue;

      let brightness = 0.5;
      let color = monoColor;
      if (sample) {
        const i = (r * cols + c) * 4;
        const rr = sample.data[i];
        const gg = sample.data[i + 1];
        const bb = sample.data[i + 2];
        // Rec. 709 luminance.
        brightness = (0.2126 * rr + 0.7152 * gg + 0.0722 * bb) / 255;
        if (colorMode === 'imageSampled') {
          color = rgbToHex(rr, gg, bb);
        } else if (colorMode === 'palette') {
          const idx = Math.floor(brightness * (palette.length - 1));
          color = palette[idx] ?? palette[0];
        }
      } else if (colorMode === 'palette') {
        color = palette[(c + r) % palette.length];
      }

      // Density-shift (push brighter cells toward denser glyphs on loud passages).
      let bDriven = Math.min(1, Math.max(0, brightness + densityShift * 0.3));

      let charIndex = Math.floor(bDriven * (rampLen - 1));

      // Beat churn: shuffle character within a small neighborhood.
      if (churn > 0) {
        const jitter = pseudoRand(c * 73856093 ^ r * 19349663 ^ churnSeed);
        if (jitter < churn) {
          const span = Math.max(1, Math.floor(rampLen * 0.4));
          charIndex = Math.min(
            rampLen - 1,
            Math.max(0, charIndex + (Math.floor(pseudoRand(jitter * 1e6) * span * 2) - span)),
          );
        }
      }

      const ch = ramp[charIndex] ?? ' ';
      if (ch === ' ') continue;

      ctx.fillStyle = color;
      ctx.fillText(ch, c * cellSize, r * cellSize);
    }
  }
}

function pseudoRand(seed: number): number {
  // xorshift-ish. Deterministic, fast.
  let x = (seed | 0) ^ 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) % 10_000) / 10_000;
}

function drawNoise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  audio: AudioFeatures,
) {
  const density = 0.002 + audio.treble * 0.02;
  const count = Math.floor(w * h * density * 0.001);
  ctx.fillStyle = 'rgba(120, 120, 140, 0.18)';
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillRect(x, y, 1, 1);
  }
}
