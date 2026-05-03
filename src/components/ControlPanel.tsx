import { usePerformanceStore } from '../stores/performanceStore';
import { RAMPS, SCENES } from '../lib/scenes';
import AudioControls from './AudioControls';

export default function ControlPanel() {
  const visible = usePerformanceStore((s) => s.controlsVisible);
  const toggle = usePerformanceStore((s) => s.toggleControls);
  const sceneIdx = usePerformanceStore((s) => s.currentSceneIndex);
  const setScene = usePerformanceStore((s) => s.setScene);
  const auto = usePerformanceStore((s) => s.autoProgress);
  const toggleAuto = usePerformanceStore((s) => s.toggleAutoProgress);
  const interval = usePerformanceStore((s) => s.autoProgressInterval);
  const setInterval = usePerformanceStore((s) => s.setAutoProgressInterval);
  const cellOverride = usePerformanceStore((s) => s.cellSizeOverride);
  const setCellOverride = usePerformanceStore((s) => s.setCellSizeOverride);
  const rampOverride = usePerformanceStore((s) => s.rampOverride);
  const setRampOverride = usePerformanceStore((s) => s.setRampOverride);
  const colorOverride = usePerformanceStore((s) => s.colorModeOverride);
  const setColorOverride = usePerformanceStore((s) => s.setColorModeOverride);
  const images = usePerformanceStore((s) => s.images);
  const currentImage = usePerformanceStore((s) => s.currentImageIndex);
  const setCurrentImage = usePerformanceStore((s) => s.setCurrentImageIndex);
  const removeImage = usePerformanceStore((s) => s.removeImage);
  const addImage = usePerformanceStore((s) => s.addImage);

  if (!visible) return null;

  const handleAdd = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files) return;
      for (const f of Array.from(input.files)) {
        try {
          const url = URL.createObjectURL(f);
          const bitmap = await createImageBitmap(f);
          addImage({
            id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
            name: f.name,
            url,
            bitmap,
          });
        } catch {
          /* ignore */
        }
      }
    };
    input.click();
  };

  return (
    <div className="pointer-events-auto absolute right-3 top-12 z-10 w-72 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/85 p-3 text-xs text-zinc-200 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Controls</h3>
        <button
          onClick={toggle}
          className="text-[11px] text-zinc-400 hover:text-zinc-100"
        >
          Hide (H)
        </button>
      </div>

      <Group label="Scene">
        <div className="grid grid-cols-3 gap-1.5">
          {SCENES.map((sc, i) => (
            <button
              key={sc.id}
              onClick={() => setScene(i)}
              className={`rounded px-2 py-1 text-[11px] transition ${
                i === sceneIdx
                  ? 'bg-emerald-500 text-black'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {i + 1}. {sc.name}
            </button>
          ))}
        </div>
      </Group>

      <Group label="Auto-progress">
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={auto} onChange={toggleAuto} />
          Cycle scenes every
          <input
            type="number"
            min={3}
            max={120}
            value={Math.round(interval / 1000)}
            onChange={(e) => setInterval(Math.max(3, +e.target.value) * 1000)}
            className="w-12 rounded bg-zinc-800 px-1 py-0.5 text-zinc-100"
          />
          s
        </label>
      </Group>

      <Group label="Render">
        <label className="flex items-center justify-between text-[11px]">
          Cell size
          <input
            type="range"
            min={4}
            max={20}
            step={1}
            value={cellOverride ?? SCENES[sceneIdx].cellSize}
            onChange={(e) => setCellOverride(+e.target.value)}
            className="w-32"
          />
          <span className="w-6 text-right tabular-nums">
            {cellOverride ?? SCENES[sceneIdx].cellSize}
          </span>
        </label>
        <button
          onClick={() => setCellOverride(null)}
          className="text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          reset to scene default
        </button>

        <div className="flex items-center justify-between text-[11px]">
          <span>Ramp</span>
          <select
            value={rampOverride ?? 'scene'}
            onChange={(e) =>
              setRampOverride(e.target.value === 'scene' ? null : e.target.value)
            }
            className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-100"
          >
            <option value="scene">scene default</option>
            {Object.keys(RAMPS).map((k) => (
              <option key={k} value={RAMPS[k]}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span>Color</span>
          <select
            value={colorOverride ?? 'scene'}
            onChange={(e) =>
              setColorOverride(
                e.target.value === 'scene'
                  ? null
                  : (e.target.value as 'mono' | 'imageSampled' | 'palette'),
              )
            }
            className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-100"
          >
            <option value="scene">scene default</option>
            <option value="mono">mono</option>
            <option value="imageSampled">image-sampled</option>
            <option value="palette">palette</option>
          </select>
        </div>
      </Group>

      <Group label={`Images (${images.length})`}>
        <div className="grid grid-cols-4 gap-1">
          {images.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => setCurrentImage(idx)}
              className={`relative overflow-hidden rounded border ${
                idx === currentImage
                  ? 'border-emerald-400'
                  : 'border-zinc-800 hover:border-zinc-600'
              }`}
              title={img.name}
            >
              <img
                src={img.url}
                alt={img.name}
                className="aspect-square h-full w-full object-cover"
              />
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(img.id);
                }}
                className="absolute right-0.5 top-0.5 rounded bg-black/70 px-1 text-[9px]"
              >
                ✕
              </span>
            </button>
          ))}
          <button
            onClick={handleAdd}
            className="flex aspect-square items-center justify-center rounded border border-dashed border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-200"
          >
            +
          </button>
        </div>
      </Group>

      <Group label="Audio">
        <AudioControls variant="panel" />
      </Group>

      <p className="mt-3 border-t border-zinc-800 pt-2 text-[10px] leading-relaxed text-zinc-500">
        F fullscreen · H hide UI · Space next scene · 1–6 jump · A toggle auto · M cycle audio source
      </p>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}
