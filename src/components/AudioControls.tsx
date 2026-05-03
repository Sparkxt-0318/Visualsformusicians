import { useEffect, useRef, useState } from 'react';
import { usePerformanceStore } from '../stores/performanceStore';
import { getAudioElement, getMode, startFile, startMic, stopAudio } from '../lib/audio';

type Props = {
  variant?: 'setup' | 'panel';
};

export default function AudioControls({ variant = 'setup' }: Props) {
  const audioMode = usePerformanceStore((s) => s.audioMode);
  const setAudioMode = usePerformanceStore((s) => s.setAudioMode);
  const audioFile = usePerformanceStore((s) => s.audioFile);
  const setAudioFile = usePerformanceStore((s) => s.setAudioFile);
  const micSettings = usePerformanceStore((s) => s.micSettings);
  const setMicSettings = usePerformanceStore((s) => s.setMicSettings);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  // (Re)attach audio source when the mode changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (audioMode === 'mic') {
          await startMic(micSettings);
        } else if (audioMode === 'file' && audioFile) {
          const el = startFile(audioFile);
          el.onplay = () => setPlaying(true);
          el.onpause = () => setPlaying(false);
        } else {
          await stopAudio();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [audioMode, audioFile, micSettings]);

  const onPickFile = (file: File | null) => {
    setAudioFile(file);
    if (file) setAudioMode('file');
  };

  const togglePlay = () => {
    const el = getAudioElement();
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const compact = variant === 'panel';

  return (
    <div className={compact ? 'space-y-2 text-xs' : 'space-y-3'}>
      <div className="flex gap-2">
        <button
          onClick={() => setAudioMode('mic')}
          className={`flex-1 rounded px-2 py-1.5 text-xs transition ${
            audioMode === 'mic'
              ? 'bg-emerald-500 text-black'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          Microphone
        </button>
        <button
          onClick={() => setAudioMode('file')}
          className={`flex-1 rounded px-2 py-1.5 text-xs transition ${
            audioMode === 'file'
              ? 'bg-emerald-500 text-black'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          Audio file
        </button>
        <button
          onClick={() => setAudioMode('none')}
          className={`flex-1 rounded px-2 py-1.5 text-xs transition ${
            audioMode === 'none'
              ? 'bg-zinc-100 text-black'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          Off
        </button>
      </div>

      {audioMode === 'mic' && (
        <div className="space-y-1.5">
          <p className="text-[11px] leading-snug text-zinc-500">
            Mic captures room sound. If reactivity feels flat, your OS may be
            scrubbing the signal — try{' '}
            <a
              href="https://existential.audio/blackhole/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              BlackHole
            </a>{' '}
            (or a virtual audio driver) and pick it as the input device.
          </p>
          <details className="text-[11px] text-zinc-400">
            <summary className="cursor-pointer">Mic processing</summary>
            <div className="mt-2 space-y-1">
              {(
                ['echoCancellation', 'noiseSuppression', 'autoGainControl'] as const
              ).map((key) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={micSettings[key]}
                    onChange={(e) =>
                      setMicSettings({ [key]: e.target.checked } as Partial<typeof micSettings>)
                    }
                  />
                  <span>{key}</span>
                </label>
              ))}
              <p className="text-[10px] text-zinc-500">
                Some OS/browser combos apply system-level processing that can't
                be disabled here.
              </p>
            </div>
          </details>
        </div>
      )}

      {audioMode === 'file' && (
        <div className="space-y-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
          >
            {audioFile ? `File: ${audioFile.name}` : 'Choose audio file'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/*"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
          {audioFile && getMode() === 'file' && (
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-medium text-black hover:bg-white"
              >
                {playing ? 'Pause' : 'Play'}
              </button>
              <label className="flex items-center gap-1 text-[11px] text-zinc-400">
                <input
                  type="checkbox"
                  defaultChecked
                  onChange={(e) => {
                    const el = getAudioElement();
                    if (el) el.loop = e.target.checked;
                  }}
                />
                Loop
              </label>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
