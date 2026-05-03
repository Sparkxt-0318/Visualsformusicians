# ASCII Live

Browser-based live performance tool: webcam → silhouette + pose → ASCII rendering of an uploaded background image, reactive to audio. The performer's body is never displayed — only the masked ASCII region, pose skeleton, and motion trails.

All processing is client-side. Models and WASM are vendored locally so the app runs offline at venues with no Wi-Fi.

## Status

**Phases 1–5 complete.** Polish (Phase 6 — IndexedDB persistence, perf tuning, fullscreen edge cases) is deferred until live verification on real hardware.

- Phase 1 — webcam + MediaPipe segmentation/pose pipeline, vendored locally
- Phase 2 — image upload + ASCII renderer, ASCII characters fill the silhouette and sample the user's background image
- Phase 3 — pose skeleton, marching-squares contour, fading hand trails
- Phase 4 — mic + file audio modes; amplitude / bass / mid / treble / beat features; reactive density, pulse, churn, stroke width
- Phase 5 — six scene presets with auto-progression (default 20 s) and manual switching

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:5173, click **Allow webcam**, drop one or more background images, pick an audio source, then **Start performance**.

## Build

```bash
npm run build
```

Produces a static bundle in `dist/`.

## Keyboard shortcuts (during performance)

| Key | Action |
| --- | --- |
| F   | Fullscreen toggle |
| H   | Hide/show control panel |
| Space | Next scene |
| 1–6 | Jump to scene N |
| A   | Toggle auto-progression |
| M   | Cycle audio source (mic → file → off) |

## Audio source notes

- **Microphone.** Captures room sound — handy when music plays on external speakers. Browser DSP (echo cancellation / noise suppression / AGC) is disabled by default; flip the toggles in the panel if your OS still appears to scrub the input. If reactivity is flat even after that, route the music through a virtual audio device like [BlackHole](https://existential.audio/blackhole/) and select it as the input device — it shows up in the same `getUserMedia` device picker, no special handling needed.
- **Audio file.** Upload `.mp3` / `.wav`. Plays through the browser, reactive features run from the same signal.
- The setup screen shows a real-time amplitude meter so you can confirm the input is live before starting.

## Permissions (Chrome)

You'll be prompted for **camera** and (in mic mode) **microphone**. Both require an HTTPS origin or `localhost`.

## Vendored assets

The app loads MediaPipe entirely from local paths. Do not point `FilesetResolver` at a CDN.

- `public/models/selfie_segmenter.tflite` — ImageSegmenter (selfie, float16).
- `public/models/pose_landmarker_lite.task` — PoseLandmarker (lite, float16).
- `public/wasm/*` — copied from `node_modules/@mediapipe/tasks-vision/wasm`.

The setup screen runs a HEAD-check on these paths and fails loudly if any are missing.

## Layout

```
src/
  App.tsx
  main.tsx, index.css
  lib/
    webcam.ts          getUserMedia, hidden <video>
    mediapipe.ts       ImageSegmenter + PoseLandmarker, local WASM/models
    asciiRenderer.ts   silhouette → ASCII grid, sampled background, audio modulation
    poseOverlay.ts     skeleton, marching-squares contour, hand trails
    audio.ts           mic + file modes, FFT bands, beat detection
    scenes.ts          6 scene presets + ramps
  stores/
    performanceStore.ts  Zustand state for scene, images, audio, panel, fullscreen
  components/
    SetupScreen.tsx, PerformanceView.tsx, PerformanceCanvas.tsx
    ControlPanel.tsx, AudioControls.tsx, ImageUploadZone.tsx, MicMeter.tsx
```
