import { useEffect, useState } from 'react';
import { getAudioFeatures, getMode } from '../lib/audio';

export default function MicMeter() {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (getMode() !== 'mic') {
        setLevel(0);
        raf = requestAnimationFrame(tick);
        return;
      }
      const f = getAudioFeatures();
      setLevel(f.amplitude);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pct = Math.min(100, Math.round(level * 140));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-zinc-400">
        <span>Input level</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-zinc-800">
        <div
          className="h-full bg-emerald-400 transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
