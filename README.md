# ASCII Live

Browser-based live performance tool: webcam → silhouette + pose → ASCII rendering of an uploaded background image, reactive to audio. The performer's body is never displayed — only the masked ASCII region, pose skeleton, and motion trails.

All processing is client-side. Models and WASM are vendored locally so the app runs offline at venues with no Wi-Fi.

## Status

**Phase 1 — pipeline skeleton.** Webcam capture and MediaPipe selfie segmentation are wired up; the silhouette mask renders to a debug canvas. The raw webcam frame is never drawn to the visible canvas.

Subsequent phases add the ASCII renderer, pose overlays, audio reactivity, scenes, and polish.

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:5173, click **Allow webcam**, then **Start performance**.

## Build

```bash
npm run build
```

Produces a static bundle in `dist/`.

## Vendored assets

The app loads MediaPipe entirely from local paths. Do not point `FilesetResolver` at a CDN.

- `public/models/selfie_segmenter.tflite` — ImageSegmenter (selfie, float16).
- `public/models/pose_landmarker_lite.task` — PoseLandmarker (lite, float16).
- `public/wasm/*` — copied from `node_modules/@mediapipe/tasks-vision/wasm`.

The setup screen runs a HEAD-check on these paths and fails loudly if any are missing.

## Permissions

Chrome will prompt for webcam (and later, microphone). Grant both. Camera/mic permissions require an HTTPS origin or `localhost`.
