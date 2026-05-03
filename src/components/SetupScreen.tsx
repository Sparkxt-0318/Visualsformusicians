import { useEffect, useState } from 'react';
import { startWebcam, stopWebcam } from '../lib/webcam';
import { preflight } from '../lib/mediapipe';
import { usePerformanceStore } from '../stores/performanceStore';
import ImageUploadZone from './ImageUploadZone';
import AudioControls from './AudioControls';
import MicMeter from './MicMeter';

type Props = {
  onStart: () => void;
};

type AssetStatus = 'checking' | 'ok' | 'error';

export default function SetupScreen({ onStart }: Props) {
  const webcamReady = usePerformanceStore((s) => s.webcamReady);
  const setWebcamReady = usePerformanceStore((s) => s.setWebcamReady);
  const audioMode = usePerformanceStore((s) => s.audioMode);
  const audioFile = usePerformanceStore((s) => s.audioFile);
  const images = usePerformanceStore((s) => s.images);

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

  const audioReady =
    audioMode === 'none' || audioMode === 'mic' || (audioMode === 'file' && !!audioFile);
  const canStart =
    webcamReady && assetStatus === 'ok' && images.length > 0 && audioReady;

  return (
    <div className="flex min-h-full items-start justify-center overflow-y-auto bg-black p-8 text-zinc-100">
      <div className="w-full max-w-xl space-y-5 py-4">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">ASCII Live</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Webcam silhouette → ASCII rendering of your background image, reactive to audio.
          </p>
        </header>

        <Section title="Local assets" status={assetStatus}>
          {assetStatus === 'error' ? (
            <p className="text-xs text-rose-300">{assetError}</p>
          ) : (
            <p className="text-xs text-zinc-500">
              Models and WASM resolve from /public. No CDN calls at runtime.
            </p>
          )}
        </Section>

        <Section
          title="Webcam"
          status={webcamReady ? 'ok' : 'pending'}
          rightSlot={
            <button
              onClick={handleEnableWebcam}
              disabled={webcamReady}
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {webcamReady ? 'Enabled' : 'Allow webcam'}
            </button>
          }
        >
          {webcamError && <p className="text-xs text-rose-300">{webcamError}</p>}
          <p className="text-xs text-zinc-500">
            The raw webcam frame is never drawn to the screen — only the ASCII output, pose lines, and trails.
          </p>
        </Section>

        <Section
          title="Background images"
          status={images.length > 0 ? 'ok' : 'pending'}
        >
          <ImageUploadZone />
        </Section>

        <Section title="Audio source" status={audioReady ? 'ok' : 'pending'}>
          <AudioControls />
          {audioMode === 'mic' && (
            <div className="mt-2">
              <MicMeter />
            </div>
          )}
        </Section>

        <button
          onClick={() => canStart && onStart()}
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

function Section({
  title,
  status,
  rightSlot,
  children,
}: {
  title: string;
  status: 'ok' | 'pending' | 'error' | 'checking';
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  const label =
    status === 'ok'
      ? 'ok'
      : status === 'error'
        ? 'error'
        : status === 'checking'
          ? 'checking…'
          : 'needed';
  const cls =
    status === 'ok'
      ? 'text-emerald-400'
      : status === 'error'
        ? 'text-rose-400'
        : 'text-zinc-400';

  return (
    <section className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-200">{title}</h2>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${cls}`}>{label}</span>
          {rightSlot}
        </div>
      </div>
      {children}
    </section>
  );
}
