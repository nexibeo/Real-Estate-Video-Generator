/**
 * The credit system — flat 10x markup on measured API cost, no subscription.
 *
 * 1 credit = 1 US cent, so a $10 top-up is 1000 credits and the arithmetic
 * stays legible to the person spending it. Nothing expires; nothing renews.
 */
import { VIDEO_MODELS } from './replicate';
import { JEV_COST_PER_PHOTO } from './jev';
import type { Duration, JobOptions } from './types';

export const MARKUP = 10;
export const CREDITS_PER_USD = 100;

export const PACKS = [
  { usd: 10, credits: 1000, label: 'Starter' },
  { usd: 20, credits: 2100, label: 'Standard', bonus: '+100 bonus credits' },
  { usd: 50, credits: 5500, label: 'Pro', bonus: '+500 bonus credits' },
] as const;

/** Vision description, one per photo, on a Flash-class model. */
export const VISION_COST_PER_PHOTO = 0.0004;
/** Fish Audio S2.1 Pro, per beat. The free variant costs nothing at all. */
export const TTS_COST_PER_BEAT = 0.0012;
/** One narration script for the whole video. */
export const SCRIPT_COST = 0.0015;

export interface CostBreakdown {
  photos: number;
  shots: number;
  lines: { label: string; detail: string; usd: number }[];
  apiUsd: number;
  chargedUsd: number;
  credits: number;
}

export function estimate(
  opts: Pick<JobOptions, 'videoModel' | 'durationS' | 'narrationStyle' | 'tier'>,
  photoCount: number,
  shotCount: number,
): CostBreakdown {
  const model = VIDEO_MODELS[opts.videoModel] ?? VIDEO_MODELS.kenburns;
  const lines: CostBreakdown['lines'] = [];

  const visionUsd = photoCount * (VISION_COST_PER_PHOTO + JEV_COST_PER_PHOTO);
  if (photoCount > 0) {
    lines.push({
      label: 'Room classification',
      detail: `${photoCount} photo${photoCount === 1 ? '' : 's'} — vision read + Jev decision`,
      usd: visionUsd,
    });
  }

  const videoUsd = model.usdPerSecond * opts.durationS * shotCount;
  lines.push({
    label: model.usdPerSecond === 0 ? 'Ken Burns render' : `Video — ${model.label}`,
    detail:
      model.usdPerSecond === 0
        ? `${shotCount} shots rendered in your browser`
        : `${shotCount} shots x ${opts.durationS}s x $${model.usdPerSecond.toFixed(3)}/s`,
    usd: videoUsd,
  });

  let narrationUsd = 0;
  if (opts.narrationStyle !== 'none') {
    narrationUsd = SCRIPT_COST + shotCount * TTS_COST_PER_BEAT;
    lines.push({
      label: 'Voiceover',
      detail: `script + ${shotCount} spoken lines`,
      usd: narrationUsd,
    });
  }

  lines.push({ label: 'Assembly & export', detail: 'rendered in your browser', usd: 0 });

  const apiUsd = visionUsd + videoUsd + narrationUsd;
  const chargedUsd = opts.tier === 'credits' ? apiUsd * MARKUP : 0;
  return {
    photos: photoCount,
    shots: shotCount,
    lines,
    apiUsd,
    chargedUsd,
    credits: Math.ceil(chargedUsd * CREDITS_PER_USD),
  };
}

export function fmtUsd(n: number): string {
  if (n === 0) return 'free';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

/** Rows for the pricing page: what a typical video costs at each quality. */
export function priceMatrix(shots = 8) {
  const durations: Duration[] = [6, 10, 15];
  return Object.values(VIDEO_MODELS).map((m) => ({
    model: m,
    cells: durations
      .filter((d) => d <= m.maxDurationS)
      .map((d) => {
        const e = estimate(
          { videoModel: m.slug, durationS: d, narrationStyle: 'friendly_host', tier: 'credits' },
          20,
          shots,
        );
        return { durationS: d, apiUsd: e.apiUsd, chargedUsd: e.chargedUsd, credits: e.credits };
      }),
  }));
}
