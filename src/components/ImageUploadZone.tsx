import { useCallback, useRef, useState } from 'react';
import { usePerformanceStore, type ImageEntry } from '../stores/performanceStore';

async function fileToEntry(file: File): Promise<ImageEntry> {
  const url = URL.createObjectURL(file);
  const bitmap = await createImageBitmap(file);
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    name: file.name,
    url,
    bitmap,
  };
}

export default function ImageUploadZone() {
  const images = usePerformanceStore((s) => s.images);
  const addImage = usePerformanceStore((s) => s.addImage);
  const removeImage = usePerformanceStore((s) => s.removeImage);
  const currentIdx = usePerformanceStore((s) => s.currentImageIndex);
  const setCurrentIdx = usePerformanceStore((s) => s.setCurrentImageIndex);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (arr.length === 0) {
        setError('No image files detected.');
        return;
      }
      for (const f of arr) {
        try {
          const e = await fileToEntry(f);
          addImage(e);
        } catch (err) {
          setError(
            `Failed to load "${f.name}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    },
    [addImage],
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer items-center justify-center rounded-md border border-dashed px-4 py-6 text-xs transition ${
          dragOver
            ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200'
            : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
        }`}
      >
        <span>Drop images here, or click to choose files (multi-select ok).</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            if (inputRef.current) inputRef.current.value = '';
          }}
        />
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setCurrentIdx(idx)}
              className={`group relative overflow-hidden rounded border transition ${
                idx === currentIdx
                  ? 'border-emerald-400 ring-1 ring-emerald-400'
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
                className="absolute right-1 top-1 hidden cursor-pointer rounded bg-black/70 px-1 text-[10px] text-zinc-200 group-hover:block"
              >
                ✕
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
