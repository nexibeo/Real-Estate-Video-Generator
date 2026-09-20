'use client';

import { useMemo, useState } from 'react';
import { VIDEO_MODELS } from '@/lib/replicate';
import { estimate, fmtUsd, MARKUP, PACKS } from '@/lib/pricing';
import type { Duration, NarrationStyle } from '@/lib/types';

export function Estimator() {
  const [model, setModel] = useState('wan-video/wan-2.2-i2v-fast');
  const [shots, setShots] = useState(8);
  const [photos, setPhotos] = useState(24);
  const [duration, setDuration] = useState<Duration>(6);
  const [narration, setNarration] = useState<NarrationStyle>('friendly_host');

  const max = VIDEO_MODELS[model].maxDurationS;
  const effective: Duration = duration > max ? (max as Duration) : duration;

  const est = useMemo(
    () => estimate({ videoModel: model, durationS: effective, narrationStyle: narration, tier: 'credits' }, photos, shots),
    [model, effective, narration, photos, shots],
  );

  const videos = (usd: number) => (est.chargedUsd > 0 ? Math.floor(usd / est.chargedUsd) : Infinity);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* Controls */}
      <div className="rounded-xl border border-line bg-ink-2/60 p-6">
        <h3 className="font-display text-xl text-chalk">Your video</h3>

        <label className="mt-6 block text-sm text-mist">Engine</label>
        <select value={model} onChange={(e) => setModel(e.target.value)}
                className="mt-2 w-full rounded-lg border border-line bg-ink-3 px-3 py-2.5 text-chalk">
          {Object.values(VIDEO_MODELS).map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.label} — {m.usdPerSecond === 0 ? 'free' : `$${m.usdPerSecond.toFixed(3)}/s`}
            </option>
          ))}
        </select>

        <label className="mt-5 block text-sm text-mist">
          Shots (rooms) — <span className="font-mono text-chalk">{shots}</span>
        </label>
        <input type="range" min={3} max={16} value={shots}
               onChange={(e) => setShots(Number(e.target.value))} className="mt-2 w-full" />

        <label className="mt-5 block text-sm text-mist">
          Photos uploaded — <span className="font-mono text-chalk">{photos}</span>
        </label>
        <input type="range" min={0} max={60} step={2} value={photos}
               onChange={(e) => setPhotos(Number(e.target.value))} className="mt-2 w-full" />
        <p className="mt-1.5 text-xs text-mist/70">Every photo is read once to work out which room it is.</p>

        <label className="mt-5 block text-sm text-mist">Seconds per shot</label>
        <div className="mt-2 flex gap-2">
          {([6, 10, 15] as Duration[]).map((d) => (
            <button key={d} onClick={() => setDuration(d)} disabled={d > max}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      effective === d ? 'border-gold bg-gold/10 text-gold'
                      : d > max ? 'cursor-not-allowed border-line/50 text-mist/40'
                      : 'border-line bg-ink-3 text-mist hover:text-chalk'}`}>
              {d}s
            </button>
          ))}
        </div>
        {duration > max && (
          <p className="mt-1.5 text-xs text-gold">{VIDEO_MODELS[model].label} caps at {max}s.</p>
        )}

        <label className="mt-5 block text-sm text-mist">Voiceover</label>
        <select value={narration} onChange={(e) => setNarration(e.target.value as NarrationStyle)}
                className="mt-2 w-full rounded-lg border border-line bg-ink-3 px-3 py-2.5 text-chalk">
          <option value="friendly_host">Friendly host</option>
          <option value="luxury">Luxury</option>
          <option value="investor">Investor</option>
          <option value="none">None — music and captions only</option>
        </select>
      </div>

      {/* Result */}
      <div className="rounded-xl border border-gold/30 bg-gradient-to-b from-gold/[0.07] to-transparent p-6">
        <h3 className="font-display text-xl text-chalk">What it costs</h3>
        <table className="mt-5 w-full text-sm">
          <tbody className="divide-y divide-line/70">
            {est.lines.map((l) => (
              <tr key={l.label}>
                <td className="py-2.5 pr-4">
                  <div className="text-chalk">{l.label}</div>
                  <div className="text-xs text-mist">{l.detail}</div>
                </td>
                <td className="py-2.5 text-right font-mono text-mist">{fmtUsd(l.usd)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line">
              <td className="pt-3 text-mist">Provider cost, your own keys</td>
              <td className="pt-3 text-right font-mono text-chalk">{fmtUsd(est.apiUsd)}</td>
            </tr>
            <tr>
              <td className="pt-2">
                <div className="text-chalk">Paying with credits</div>
                <div className="text-xs text-mist">{MARKUP}x provider cost — hosting, keys, support</div>
              </td>
              <td className="pt-2 text-right">
                <div className="font-display text-2xl text-gold">{fmtUsd(est.chargedUsd)}</div>
                <div className="font-mono text-xs text-mist">{est.credits.toLocaleString()} credits</div>
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-6 rounded-lg border border-line bg-ink-2/70 p-4">
          <div className="text-xs uppercase tracking-wider text-mist">Videos per top-up</div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            {PACKS.map((p) => (
              <div key={p.usd}>
                <div className="font-display text-2xl text-chalk">
                  {est.chargedUsd > 0 ? Math.floor((p.credits / 100) / est.chargedUsd) : '∞'}
                </div>
                <div className="text-xs text-mist">for ${p.usd}</div>
              </div>
            ))}
          </div>
        </div>

        {est.chargedUsd === 0 && (
          <p className="mt-4 rounded-lg border border-jade/30 bg-jade/5 p-3 text-sm text-jade">
            Ken Burns with no narration costs nothing at all — it never leaves your browser.
          </p>
        )}
      </div>
    </div>
  );
}
