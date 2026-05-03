import { useEffect, useRef, useState } from 'react';
import { getWebcam } from '../lib/webcam';
import { initMediapipe, processFrame, disposeMediapipe } from '../lib/mediapipe';

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

    // Sized to viewport, but pixel-perfect via DPR.
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }
    resize();
    window.addEventListener('resize', resize);

    // Offscreen buffer for the mask at the source resolution.
    const maskCanvas = document.createElement('canvas');
    const maskCtx = maskCanvas.getContext('2d')!;
    let maskImageData: ImageData | null = null;

    let frames = 0;
    let lastFpsTick = performance.now();

    initMediapipe()
      .then(() => {
        if (cancelled) return;
        const tick = (tsMs: number) => {
          if (cancelled) return;
          const video = handle.video;
          if (video.readyState >= 2 && video.videoWidth > 0) {
            try {
              const { maskData, maskWidth, maskHeight } = processFrame(
                video,
                tsMs,
                { runPose: false },
              );

              if (maskData && maskWidth > 0 && maskHeight > 0) {
                if (
                  !maskImageData ||
                  maskCanvas.width !== maskWidth ||
                  maskCanvas.height !== maskHeight
                ) {
                  maskCanvas.width = maskWidth;
                  maskCanvas.height = maskHeight;
                  maskImageData = maskCtx.createImageData(maskWidth, maskHeight);
                }

                const px = maskImageData.data;
                // Selfie segmenter: confidence = probability the pixel belongs
                // to the foreground (person).
                for (let i = 0; i < maskData.length; i++) {
                  const v = Math.round(maskData[i] * 255);
                  const j = i * 4;
                  px[j] = v;
                  px[j + 1] = v;
                  px[j + 2] = v;
                  px[j + 3] = 255;
                }
                maskCtx.putImageData(maskImageData, 0, 0);

                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Cover-fit the mask to the canvas, mirrored (selfie view).
                const cw = canvas.width;
                const ch = canvas.height;
                const scale = Math.max(cw / maskWidth, ch / maskHeight);
                const dw = maskWidth * scale;
                const dh = maskHeight * scale;
                const dx = (cw - dw) / 2;
                const dy = (ch - dh) / 2;

                ctx.save();
                ctx.translate(cw, 0);
                ctx.scale(-1, 1);
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(maskCanvas, cw - dx - dw, dy, dw, dh);
                ctx.restore();
              }
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
            setFps(Math.round((frames * 1000) / (now - lastFpsTick)));
            frames = 0;
            lastFpsTick = now;
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
