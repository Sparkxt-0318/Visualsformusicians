import PerformanceCanvas from './PerformanceCanvas';

export default function PerformanceView() {
  return (
    <div className="relative h-full w-full bg-black">
      <PerformanceCanvas />
      <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-[11px] uppercase tracking-wider text-zinc-300">
        ASCII Live · Phase 1 (mask only)
      </div>
    </div>
  );
}
