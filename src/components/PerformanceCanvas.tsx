import { useEffect, useRef, useState } from 'react';
import { getWebcam } from '../lib/webcam';
import { initMediapipe, processFrame, disposeMediapipe } from '../lib/mediapipe';
import { renderAscii, type AudioFeatures } from '../lib/asciiRenderer';
import { drawContour, PoseOverlay } from '../lib/poseOverlay';
import { getAudioFeatures } from '../lib/audio';
import { usePerformanceStore } from '../stores/performanceStore';
import { getScene } from '../lib/scenes';

const SILENT: AudioFeatures = {
  amplitude: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  beat: false,
};

export default function PerformanceCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const handle = getWebcam();
    if (!handle) {
      setError('Webcam handle missing. Return to setup.');
      return;
    }

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }
    resize();
    window.addEventListener('resize', resize);

    const overlay = new PoseOverlay();

    let frames = 0;
    let lastFpsTick = performance.now();
    let lastSceneTick = performance.now();
    let lastSceneIdx = usePerformanceStore.getState().currentSceneIndex;
    let frameCounter = 0;
    // Throttle pose if fps drops below 25.
    let recentFps = 30;
    let posePer = 1; // 1 = every frame, 2 = every other.

    initMediapipe()
      .then(() => {
        if (cancelled) return;
        const tick = (tsMs: number) => {
          if (cancelled) return;
          const state = usePerformanceStore.getState();
          const video = handle.video;

          if (video.readyState >= 2 && video.videoWidth > 0) {
            try {
              const runPose = frameCounter % posePer === 0;
              const { maskData, maskWidth, maskHeight, landmarks } =
                processFrame(video, tsMs, { runPose });

              const audio: AudioFeatures = (() => {
                try {
                  return getAudioFeatures(tsMs);
                } catch {
                  return SILENT;
                }
              })();

              if (maskData && maskWidth > 0 && maskHeight > 0) {
                const scene = getScene(state.currentSceneIndex);
                const cellSize = state.cellSizeOverride ?? scene.cellSize;
                const ramp = state.rampOverride ?? scene.charRamp;
                const colorMode = state.colorModeOverride ?? scene.colorMode;
                const bg =
                  state.images.length > 0
                    ? state.images[
                        state.currentImageIndex % state.images.length
                      ].bitmap
                    : null;

                renderAscii({
                  ctx,
                  canvasWidth: canvas.width,
                  canvasHeight: canvas.height,
                  scene,
                  cellSize,
                  charRamp: ramp,
                  colorMode,
                  maskData,
                  maskWidth,
                  maskHeight,
                  mirrorX: true,
                  bgImage: bg,
                  audio,
                  timestampMs: tsMs,
                });

                if (scene.effects.contour) {
                  drawContour(
                    ctx,
                    maskData,
                    maskWidth,
                    maskHeight,
                    canvas.width,
                    canvas.height,
                    true,
                    scene.monoColor ?? '#e5e7eb',
                    audio,
                  );
                }

                overlay.draw(
                  ctx,
                  canvas.width,
                  canvas.height,
                  landmarks,
                  scene,
                  audio,
                  tsMs,
                  true,
                );
              }

              frameCounter++;
            } catch (err) {
              if (!cancelled) {
                setError(err instanceof Error ? err.message : String(err));
                return;
              }
            }
          }

          frames++;
          const now = performance.now();
          if (now - lastFpsTick >= 1000) {
            recentFps = Math.round((frames * 1000) / (now - lastFpsTick));
            setFps(recentFps);
            frames = 0;
            lastFpsTick = now;
            // Throttle pose detection if we're dragging.
            posePer = recentFps < 25 ? 2 : 1;
          }

          // Auto-progression
          if (state.autoProgress) {
            if (now - lastSceneTick >= state.autoProgressInterval) {
              const cur = usePerformanceStore.getState().currentSceneIndex;
              const sceneCount = 6;
              const next = (cur + 1) % sceneCount;
              usePerformanceStore.getState().setScene(next);
              // Advance background image every other scene change (default).
              if (next % 2 === 0) usePerformanceStore.getState().cycleImage();
              lastSceneTick = now;
            }
          } else {
            lastSceneTick = now;
          }

          // If the scene was changed manually, reset hand trails so they don't
          // look like ghosts of the previous scene's color/style.
          if (state.currentSceneIndex !== lastSceneIdx) {
            overlay.resetTrails();
            lastSceneIdx = state.currentSceneIndex;
          }

          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      disposeMediapipe();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full bg-black"
      />
      <div className="pointer-events-none absolute right-3 top-3 rounded bg-black/60 px-2 py-1 text-[11px] tabular-nums text-zinc-300">
        {fps} fps
      </div>
      {error && (
        <div className="absolute inset-x-0 bottom-3 mx-auto w-fit max-w-[90%] rounded bg-rose-950/80 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}
    </>
  );
}
