'use client';

import { useCallback, useRef, useState } from 'react';
import { readPhoto } from '@/lib/photos';
import type { Photo } from '@/lib/types';

export function Uploader({ photos, onAdd, onRemove }: {
  photos: Photo[];
  onAdd: (p: Photo[]) => void;
  onRemove: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const ingest = useCallback(async (files: FileList | File[]) => {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setBusy(true);
    try {
      const read = await Promise.all(images.map(readPhoto));
      onAdd(read);
    } finally {
      setBusy(false);
    }
  }, [onAdd]);

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void ingest(e.dataTransfer.files); }}
        onClick={() => input.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          over ? 'border-gold bg-gold/5' : 'border-line bg-ink-2/40 hover:border-gold/40'
        }`}
      >
        <input ref={input} type="file" accept="image/*" multiple hidden
               onChange={(e) => e.target.files && void ingest(e.target.files)} />
        <div className="font-display text-xl text-chalk">
          {busy ? 'Reading photos…' : 'Drop your listing photos here'}
        </div>
        <p className="mt-2 text-sm text-mist">
          JPEG or PNG, one or more per room. They stay in this browser.
        </p>
      </div>

      {photos.length > 0 && (
        <>
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-mist">{photos.length} photo{photos.length === 1 ? '' : 's'}</span>
            <button onClick={() => photos.forEach((p) => onRemove(p.id))}
                    className="text-mist transition-colors hover:text-rust">Remove all</button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
            {photos.map((p) => (
              <div key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.dataUrl} alt={p.name} className="h-full w-full object-cover" />
                <button onClick={() => onRemove(p.id)}
                        className="absolute right-1.5 top-1.5 hidden rounded-md bg-ink/85 px-2 py-1 text-xs text-chalk group-hover:block">
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
