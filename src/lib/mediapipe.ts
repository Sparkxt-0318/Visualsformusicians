import {
  FilesetResolver,
  ImageSegmenter,
  PoseLandmarker,
  type NormalizedLandmark,
  type ImageSegmenterResult,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';

const WASM_PATH = '/wasm';
const SEGMENTER_MODEL = '/models/selfie_segmenter.tflite';
const POSE_MODEL = '/models/pose_landmarker_lite.task';

export type ProcessedFrame = {
  /** 0..1 confidence, one float per pixel, in source video resolution. */
  maskData: Float32Array | null;
  maskWidth: number;
  maskHeight: number;
  landmarks: NormalizedLandmark[];
};

let segmenter: ImageSegmenter | null = null;
let pose: PoseLandmarker | null = null;
let initPromise: Promise<void> | null = null;
let lastTimestamp = -1;

export async function preflight(): Promise<void> {
  // Confirm vendored assets exist before init. Throw a useful error if not.
  const checks = [
    `${WASM_PATH}/vision_wasm_internal.js`,
    `${WASM_PATH}/vision_wasm_internal.wasm`,
    SEGMENTER_MODEL,
    POSE_MODEL,
  ];
  for (const url of checks) {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) {
      throw new Error(
        `Missing local asset "${url}". Place MediaPipe models under /public/models and vendor WASM into /public/wasm.`,
      );
    }
  }
}

export async function initMediapipe(): Promise<void> {
  if (segmenter && pose) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await preflight();
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);

    segmenter = await ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: SEGMENTER_MODEL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });

    pose = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: POSE_MODEL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  })();

  try {
    await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

/**
 * Process one frame. Segmentation runs every call; pose can be skipped to
 * preserve frame budget on slower hardware.
 */
export function processFrame(
  source: HTMLVideoElement,
  timestampMs: number,
  options: { runPose?: boolean } = {},
): ProcessedFrame {
  if (!segmenter || !pose) {
    throw new Error('MediaPipe not initialized — call initMediapipe() first.');
  }

  // MediaPipe requires monotonically increasing timestamps.
  let ts = Math.floor(timestampMs);
  if (ts <= lastTimestamp) ts = lastTimestamp + 1;
  lastTimestamp = ts;

  let maskData: Float32Array | null = null;
  let maskWidth = 0;
  let maskHeight = 0;
  let landmarks: NormalizedLandmark[] = [];

  segmenter.segmentForVideo(source, ts, (result: ImageSegmenterResult) => {
    const masks = result.confidenceMasks;
    if (masks && masks.length > 0) {
      const m = masks[0];
      maskWidth = m.width;
      maskHeight = m.height;
      const arr = m.getAsFloat32Array();
      // Copy out — the underlying buffer is reused by MediaPipe.
      maskData = new Float32Array(arr);
    }
    result.close();
  });

  if (options.runPose !== false) {
    pose.detectForVideo(source, ts, (result: PoseLandmarkerResult) => {
      if (result.landmarks && result.landmarks.length > 0) {
        landmarks = result.landmarks[0];
      }
    });
  }

  return { maskData, maskWidth, maskHeight, landmarks };
}

export function disposeMediapipe() {
  segmenter?.close();
  pose?.close();
  segmenter = null;
  pose = null;
  initPromise = null;
  lastTimestamp = -1;
}
