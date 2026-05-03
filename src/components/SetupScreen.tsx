import { useEffect, useState } from 'react';
import { startWebcam, stopWebcam } from '../lib/webcam';
import { preflight } from '../lib/mediapipe';

type Props = {
  onStart: () => void;
};

type AssetStatus = 'checking' | 'ok' | 'error';

export default function SetupScreen({ onStart }: Props) {
  const [webcamReady, setWebcamReady] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [assetStatus, setAssetStatus] = useState<AssetStatus>('checking');
  const [assetError, setAssetError] = useState<string | null>(null);

  useEffect(() => {
    preflight()
      .then(() => setAssetStatus('ok'))
      .catch((err: unknown) => {
        setAssetStatus('error');
        setAssetError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  async function handleEnableWebcam() {
    setWebcamError(null);
    try {
      await startWebcam();
      setWebcamReady(true);
    } catch (err) {
      setWebcamError(err instanceof Error ? err.message : String(err));
    }
  }

  const canStart = webcamReady && assetStatus === 'ok';

  return (
    <div className="flex min-h-full items-center justify-center bg-black p-8 text-zinc-100">
      <div className="w-full max-w-xl space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">ASCII Live</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Phase 1 — webcam + segmentation pipeline.
          </p>
        </header>

        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-200">Local assets</h2>
            <span
              className={
                assetStatus === 'ok'
                  ? 'text-xs text-emerald-400'
                  : assetStatus === 'error'
                    ? 'text-xs text-rose-400'
                    : 'text-xs text-zinc-400'
              }
            >
              {assetStatus === 'checking'
                ? 'checking…'
                : assetStatus === 'ok'
                  ? 'ok'
                  : 'missing'}
            </span>
          </div>
          {assetStatus === 'error' && (
            <p className="text-xs text-rose-300">{assetError}</p>
          )}
          {assetStatus === 'ok' && (
            <p className="text-xs text-zinc-500">
              Models and WASM resolved locally. No CDN calls at runtime.
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-200">Webcam</h2>
            <span
              className={
                webcamReady ? 'text-xs text-emerald-400' : 'text-xs text-zinc-400'
              }
            >
              {webcamReady ? 'ready' : 'not allowed'}
            </span>
          </div>
          <button
            onClick={handleEnableWebcam}
            disabled={webcamReady}
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {webcamReady ? 'Webcam enabled' : 'Allow webcam'}
          </button>
          {webcamError && <p className="text-xs text-rose-300">{webcamError}</p>}
          <p className="text-xs text-zinc-500">
            The raw webcam frame is never drawn to the screen. Only segmentation
            output is rendered.
          </p>
        </section>

        <button
          onClick={() => {
            if (!canStart) return;
            onStart();
          }}
          disabled={!canStart}
          className="w-full rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start performance
        </button>

        <button
          onClick={() => {
            stopWebcam();
            setWebcamReady(false);
          }}
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          Reset webcam
        </button>
      </div>
    </div>
  );
}
