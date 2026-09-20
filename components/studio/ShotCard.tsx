'use client';

import { ROOM_KEYS, ROOM_LABELS } from '@/lib/taxonomy';
import type { Analysis, Photo, Shot } from '@/lib/types';

export function ShotCard({ shot, photo, analysis, onChange, onMove, isFirst, isLast }: {
  shot: Shot;
  photo?: Photo;
  analysis?: Analysis;
  onChange: (patch: Partial<Shot>) => void;
  onMove: (dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const lowConfidence = analysis && analysis.confidence < 0.75;

  return (
    <div className={`overflow-hidden rounded-xl border bg-ink-2/50 transition-opacity ${
      shot.enabled ? 'border-line' : 'border-line/50 opacity-45'
    }`}>
      <div className="relative aspect-[16/10] bg-ink-3">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.dataUrl} alt={shot.roomLabel} className="h-full w-full object-cover" />
        )}
        {shot.clipStatus === 'done' && shot.clipUrl && (
          <video src={shot.clipUrl} className="absolute inset-0 h-full w-full object-cover"
                 muted loop playsInline autoPlay />
        )}
        <div className="absolute left-2 top-2 flex gap-1.5">
          <span className="rounded bg-ink/85 px-2 py-0.5 font-mono text-[11px] text-gold">
            {String(shot.order + 1).padStart(2, '0')}
          </span>
          {shot.clipStatus === 'running' && (
            <span className="pulse rounded bg-ink/85 px-2 py-0.5 text-[11px] text-chalk">generating…</span>
          )}
          {shot.clipStatus === 'done' && (
            <span className="rounded bg-jade/20 px-2 py-0.5 text-[11px] text-jade">clip ready</span>
          )}
          {shot.clipStatus === 'failed' && (
            <span className="rounded bg-rust/20 px-2 py-0.5 text-[11px] text-rust">failed</span>
          )}
        </div>
        {lowConfidence && (
          <span className="absolute right-2 top-2 rounded bg-gold/90 px-2 py-0.5 text-[11px] font-medium text-ink">
            check this
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          <select
            value={shot.roomType}
            onChange={(e) => {
              const t = e.target.value as Shot['roomType'];
              onChange({ roomType: t, roomLabel: ROOM_LABELS[t] });
            }}
            className="min-w-0 flex-1 rounded-lg border border-line bg-ink-3 px-2.5 py-2 text-sm text-chalk"
          >
            {ROOM_KEYS.map((k) => <option key={k} value={k}>{ROOM_LABELS[k]}</option>)}
          </select>
          <button onClick={() => onChange({ enabled: !shot.enabled })}
                  title={shot.enabled ? 'Exclude from the video' : 'Include in the video'}
                  className="rounded-lg border border-line bg-ink-3 px-3 text-sm text-mist transition-colors hover:text-chalk">
            {shot.enabled ? '✓' : '＋'}
          </button>
        </div>

        <input
          value={shot.roomLabel}
          onChange={(e) => onChange({ roomLabel: e.target.value })}
          placeholder="On-screen label"
          className="w-full rounded-lg border border-line bg-ink-3 px-2.5 py-2 text-sm text-chalk placeholder:text-mist/40"
        />

        {analysis && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-mist">
            <span className={analysis.confidence >= 0.75 ? 'text-jade' : 'text-gold'}>
              {(analysis.confidence * 100).toFixed(0)}% sure
            </span>
            {analysis.runnerUp && analysis.confidence < 0.9 && (
              <span>or {ROOM_LABELS[analysis.runnerUp.type as Shot['roomType']] ?? analysis.runnerUp.type}</span>
            )}
            <span>·</span>
            <span>{analysis.depth}</span>
            <span>·</span>
            <span>quality {analysis.suitability.toFixed(1)}/2</span>
          </div>
        )}

        {shot.narration && (
          <p className="rounded-lg bg-ink-3/70 p-2.5 text-xs leading-relaxed text-mist">
            <span className="text-gold">“</span>{shot.narration}<span className="text-gold">”</span>
          </p>
        )}

        <details className="text-xs">
          <summary className="cursor-pointer text-mist transition-colors hover:text-chalk">Prompt</summary>
          <textarea
            value={shot.prompt}
            onChange={(e) => onChange({ prompt: e.target.value })}
            rows={5}
            className="mt-2 w-full resize-y rounded-lg border border-line bg-ink-3 p-2.5 font-mono text-[11px] leading-relaxed text-mist"
          />
        </details>

        <div className="flex gap-2 pt-1">
          <button onClick={() => onMove(-1)} disabled={isFirst}
                  className="flex-1 rounded-lg border border-line py-1.5 text-xs text-mist transition-colors hover:text-chalk disabled:opacity-30">
            ↑ earlier
          </button>
          <button onClick={() => onMove(1)} disabled={isLast}
                  className="flex-1 rounded-lg border border-line py-1.5 text-xs text-mist transition-colors hover:text-chalk disabled:opacity-30">
            ↓ later
          </button>
        </div>
      </div>
    </div>
  );
}
