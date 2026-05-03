import { useEffect } from 'react';
import PerformanceCanvas from './PerformanceCanvas';
import ControlPanel from './ControlPanel';
import { usePerformanceStore } from '../stores/performanceStore';

export default function PerformanceView() {
  const visible = usePerformanceStore((s) => s.controlsVisible);
  const toggleControls = usePerformanceStore((s) => s.toggleControls);
  const nextScene = usePerformanceStore((s) => s.nextScene);
  const setScene = usePerformanceStore((s) => s.setScene);
  const toggleAuto = usePerformanceStore((s) => s.toggleAutoProgress);
  const setFullscreen = usePerformanceStore((s) => s.setFullscreen);
  const audioMode = usePerformanceStore((s) => s.audioMode);
  const setAudioMode = usePerformanceStore((s) => s.setAudioMode);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        toggleControls();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen().then((on) => setFullscreen(on));
      } else if (e.key === ' ') {
        e.preventDefault();
        nextScene();
      } else if (e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        setScene(parseInt(e.key, 10) - 1);
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        toggleAuto();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const order: Array<'mic' | 'file' | 'none'> = ['mic', 'file', 'none'];
        const idx = order.indexOf(audioMode);
        setAudioMode(order[(idx + 1) % order.length]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    toggleControls,
    nextScene,
    setScene,
    toggleAuto,
    setFullscreen,
    audioMode,
    setAudioMode,
  ]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <PerformanceCanvas />
      {visible && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-black/60 px-2 py-1 text-[11px] uppercase tracking-wider text-zinc-300">
          ASCII Live
        </div>
      )}
      <ControlPanel />
    </div>
  );
}

async function toggleFullscreen(): Promise<boolean> {
  if (!document.fullscreenEnabled) return false;
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return false;
  }
  await document.documentElement.requestFullscreen();
  return true;
}
