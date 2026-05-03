import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { Scene } from './scenes';
import type { AudioFeatures } from './asciiRenderer';

// MediaPipe pose landmark indices we care about.
export const POSE = {
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
} as const;

// Subset of POSE_CONNECTIONS for a clean stick figure. (Pairs of landmark indices.)
const CONNECTIONS: [number, number][] = [
  [11, 12], // shoulders
  [11, 13],
  [13, 15], // left arm
  [12, 14],
  [14, 16], // right arm
  [11, 23],
  [12, 24],
  [23, 24], // torso
  [23, 25],
  [25, 27],
  [27, 29],
  [29, 31], // left leg
  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32], // right leg
  [9, 10], // mouth (subtle face hint)
  [0, 11],
  [0, 12], // neck
];

type Trail = { x: number; y: number; t: number }[];

export class PoseOverlay {
  private leftTrail: Trail = [];
  private rightTrail: Trail = [];
  private maxTrailLen = 60;
  private trailLifetimeMs = 1100;

  resetTrails() {
    this.leftTrail = [];
    this.rightTrail = [];
  }

  draw(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    landmarks: NormalizedLandmark[],
    scene: Scene,
    audio: AudioFeatures,
    timestampMs: number,
    mirrorX: boolean,
  ) {
    if (!landmarks || landmarks.length === 0) {
      // Still age trails out so we don't see a frozen ghost.
      this.ageTrails(timestampMs);
      this.drawTrails(ctx, width, height, scene, audio);
      return;
    }

    const project = (lm: NormalizedLandmark) => ({
      x: (mirrorX ? 1 - lm.x : lm.x) * width,
      y: lm.y * height,
      v: lm.visibility ?? 1,
    });

    if (scene.effects.skeleton) {
      this.drawSkeleton(ctx, landmarks.map(project), scene, audio);
    }

    if (scene.effects.handTrails) {
      const lw = landmarks[POSE.LEFT_WRIST];
      const rw = landmarks[POSE.RIGHT_WRIST];
      if (lw && (lw.visibility ?? 1) > 0.4) {
        const p = project(lw);
        this.leftTrail.push({ x: p.x, y: p.y, t: timestampMs });
      }
      if (rw && (rw.visibility ?? 1) > 0.4) {
        const p = project(rw);
        this.rightTrail.push({ x: p.x, y: p.y, t: timestampMs });
      }
      this.trimTrails();
    }

    this.ageTrails(timestampMs);
    this.drawTrails(ctx, width, height, scene, audio);
  }

  private drawSkeleton(
    ctx: CanvasRenderingContext2D,
    pts: { x: number; y: number; v: number }[],
    scene: Scene,
    audio: AudioFeatures,
  ) {
    const baseAlpha = 0.85;
    const stroke = scene.monoColor ?? '#e5e7eb';
    const widthBoost = 1 + audio.bass * scene.audioReactivity.bassToPulse * 1.6;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = stroke;
    ctx.shadowBlur = 8 * widthBoost;
    ctx.strokeStyle = stroke;
    ctx.globalAlpha = baseAlpha;
    ctx.lineWidth = 1.6 * widthBoost;
    ctx.beginPath();
    for (const [a, b] of CONNECTIONS) {
      const pa = pts[a];
      const pb = pts[b];
      if (!pa || !pb) continue;
      if (pa.v < 0.4 || pb.v < 0.4) continue;
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
    }
    ctx.stroke();

    // Joint dots
    ctx.fillStyle = stroke;
    for (const p of pts) {
      if (!p || p.v < 0.4) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 * widthBoost, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private trimTrails() {
    if (this.leftTrail.length > this.maxTrailLen) {
      this.leftTrail.splice(0, this.leftTrail.length - this.maxTrailLen);
    }
    if (this.rightTrail.length > this.maxTrailLen) {
      this.rightTrail.splice(0, this.rightTrail.length - this.maxTrailLen);
    }
  }

  private ageTrails(now: number) {
    const cutoff = now - this.trailLifetimeMs;
    while (this.leftTrail.length && this.leftTrail[0].t < cutoff) {
      this.leftTrail.shift();
    }
    while (this.rightTrail.length && this.rightTrail[0].t < cutoff) {
      this.rightTrail.shift();
    }
  }

  private drawTrails(
    ctx: CanvasRenderingContext2D,
    _width: number,
    _height: number,
    scene: Scene,
    audio: AudioFeatures,
  ) {
    if (!scene.effects.handTrails) return;
    const baseColor = scene.monoColor ?? '#22d3ee';
    const widthBoost = 1 + audio.amplitude * 1.2;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = baseColor;
    const drawTrail = (trail: Trail) => {
      if (trail.length < 2) return;
      const now = trail[trail.length - 1].t;
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        const age = (now - b.t) / this.trailLifetimeMs;
        const alpha = Math.max(0, 1 - age);
        ctx.globalAlpha = 0.85 * alpha;
        ctx.lineWidth = 2 + 4 * alpha * widthBoost;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    };
    drawTrail(this.leftTrail);
    drawTrail(this.rightTrail);
    ctx.restore();
  }
}

/**
 * Trace the silhouette outline on the downsampled grid. Approximate marching
 * squares: for each grid cell, if the mask transitions from inside↔outside
 * across an edge, emit a short segment. Cheap and good enough at 120×80.
 */
export function drawContour(
  ctx: CanvasRenderingContext2D,
  maskData: Float32Array,
  maskWidth: number,
  maskHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  mirrorX: boolean,
  color: string,
  audio: AudioFeatures,
) {
  const cols = Math.min(maskWidth, 200);
  const rows = Math.min(maskHeight, 150);
  const sx = canvasWidth / cols;
  const sy = canvasHeight / rows;
  const threshold = 0.5 - audio.bass * 0.3;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();

  const sample = (cx: number, cy: number) => {
    const u = (cx + 0.5) / cols;
    const v = (cy + 0.5) / rows;
    const mu = mirrorX ? 1 - u : u;
    const x = Math.min(maskWidth - 1, Math.floor(mu * maskWidth));
    const y = Math.min(maskHeight - 1, Math.floor(v * maskHeight));
    return maskData[y * maskWidth + x] > threshold ? 1 : 0;
  };

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = sample(c, r);
      const tr = sample(c + 1, r);
      const bl = sample(c, r + 1);
      const br = sample(c + 1, r + 1);
      const sum = tl + tr + bl + br;
      if (sum === 0 || sum === 4) continue;

      const x = c * sx;
      const y = r * sy;
      // Mid-edge points
      const top = { x: x + sx * 0.5, y };
      const bottom = { x: x + sx * 0.5, y: y + sy };
      const left = { x, y: y + sy * 0.5 };
      const right = { x: x + sx, y: y + sy * 0.5 };

      const code = (tl << 3) | (tr << 2) | (br << 1) | bl;
      const seg = MARCHING[code];
      if (!seg) continue;
      for (const pair of seg) {
        const p1 = pickEdge(pair[0], top, right, bottom, left);
        const p2 = pickEdge(pair[1], top, right, bottom, left);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
    }
  }
  ctx.stroke();
  ctx.restore();
}

type Pt = { x: number; y: number };
function pickEdge(idx: number, top: Pt, right: Pt, bottom: Pt, left: Pt): Pt {
  switch (idx) {
    case 0:
      return top;
    case 1:
      return right;
    case 2:
      return bottom;
    default:
      return left;
  }
}

// Marching squares lookup — segments per cell. Edge indices: 0=top 1=right 2=bottom 3=left.
const MARCHING: Record<number, [number, number][]> = {
  1: [[2, 3]],
  2: [[1, 2]],
  3: [[1, 3]],
  4: [[0, 1]],
  5: [
    [0, 3],
    [1, 2],
  ],
  6: [[0, 2]],
  7: [[0, 3]],
  8: [[0, 3]],
  9: [[0, 2]],
  10: [
    [0, 1],
    [2, 3],
  ],
  11: [[0, 1]],
  12: [[1, 3]],
  13: [[1, 2]],
  14: [[2, 3]],
};
