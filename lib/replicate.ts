/**
 * Replicate — image-to-video generation.
 *
 * This replaces PROJECT.md's original plan of driving grok.com/imagine through
 * Selenium. Same model is available here as a first-party API
 * (xai/grok-imagine-video), which removes the ToS problem, the bot-detection
 * problem and the "breaks whenever the UI changes" problem in one move.
 */

import { NEGATIVE_PROMPT } from './prompts';

const API = 'https://api.replicate.com/v1';

export interface VideoModel {
  slug: string;
  label: string;
  blurb: string;
  usdPerSecond: number;
  minDurationS: number;
  maxDurationS: number;
  supportsNegative: boolean;
  /** Which input field carries the source photo. Differs per model. */
  imageField: string;
  /** How length is expressed: seconds, or a frame count at `fps`. */
  durationField?: 'duration' | 'num_frames';
  fps?: number;
}

/**
 * Field names, duration limits and negative-prompt support below were read from
 * each model's own OpenAPI schema on Replicate, not from memory — they differ
 * more than you would expect (`image` vs `start_image`, seconds vs frames).
 *
 * The per-second PRICES are the one thing not machine-checked: Replicate does
 * not expose them through the API. They are its published rates at the time of
 * writing and they do change. Verify against replicate.com/pricing before
 * charging anyone real money, because these numbers set the credit price.
 */
export const VIDEO_MODELS: Record<string, VideoModel> = {
  kenburns: {
    slug: 'kenburns',
    label: 'Ken Burns (free)',
    blurb: 'Camera move rendered in your browser from the photo itself. No AI, no key, no cost.',
    usdPerSecond: 0,
    minDurationS: 1,
    maxDurationS: 15,
    supportsNegative: false,
    imageField: '',
  },
  'wan-video/wan-2.2-i2v-fast': {
    slug: 'wan-video/wan-2.2-i2v-fast',
    label: 'Wan 2.2 Fast',
    blurb: 'Cheapest real image-to-video. Good for drafts and for checking a shot list. Caps at 7s.',
    usdPerSecond: 0.02,
    // Schema: num_frames 81–121 at 16fps, so roughly 5.0s to 7.5s. It cannot
    // reach the 10s or 15s tiers at all, and asking for them used to send an
    // out-of-range frame count that the model rejected.
    minDurationS: 5,
    maxDurationS: 7,
    supportsNegative: false,
    durationField: 'num_frames',
    fps: 16,
    imageField: 'image',
  },
  'wan-video/wan-2.5-i2v': {
    slug: 'wan-video/wan-2.5-i2v',
    label: 'Wan 2.5',
    blurb: 'The standard choice. Holds architectural lines better than the fast variants.',
    usdPerSecond: 0.05,
    minDurationS: 5,
    maxDurationS: 10,
    supportsNegative: true,
    durationField: 'duration',
    imageField: 'image',
  },
  'kwaivgi/kling-v3-video': {
    slug: 'kwaivgi/kling-v3-video',
    label: 'Kling v3',
    blurb: 'Best motion quality and the only one that comfortably reaches 15s. Use it on hero shots.',
    usdPerSecond: 0.1,
    minDurationS: 3,
    maxDurationS: 15,
    supportsNegative: true,
    durationField: 'duration',
    imageField: 'start_image',
  },
  'xai/grok-imagine-video': {
    slug: 'xai/grok-imagine-video',
    label: 'Grok Imagine',
    blurb: "xAI's model, via a real API rather than a browser script.",
    usdPerSecond: 0.05,
    minDurationS: 1,
    maxDurationS: 15,
    supportsNegative: false,
    durationField: 'duration',
    imageField: 'image',
  },
};

/** Clamp a requested length into what this model can actually produce. */
export function clampDuration(model: VideoModel, durationS: number): number {
  return Math.min(model.maxDurationS, Math.max(model.minDurationS, durationS));
}

export const DEFAULT_VIDEO_MODEL = 'wan-video/wan-2.2-i2v-fast';

export interface PredictionResult {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
}

function buildInput(model: VideoModel, imageUrl: string, prompt: string, durationS: number) {
  const input: Record<string, unknown> = { prompt, [model.imageField]: imageUrl };
  if (model.supportsNegative) input.negative_prompt = NEGATIVE_PROMPT;

  const seconds = clampDuration(model, durationS);
  if (model.durationField === 'num_frames') {
    const fps = model.fps ?? 16;
    // The schema's frame bounds are the real constraint; seconds are derived.
    const min = Math.round(model.minDurationS * fps);
    const max = Math.round(model.maxDurationS * fps) + 1;
    input.num_frames = Math.min(max, Math.max(min, Math.round(seconds * fps)));
  } else if (model.durationField) {
    input[model.durationField] = seconds;
  }
  return input;
}

export async function startPrediction(
  token: string,
  modelSlug: string,
  imageUrl: string,
  prompt: string,
  durationS: number,
  /** Called by Replicate when the prediction finishes, whatever the outcome. */
  webhook?: string,
): Promise<PredictionResult> {
  const model = VIDEO_MODELS[modelSlug];
  if (!model) throw new Error(`Unknown video model: ${modelSlug}`);
  const res = await fetch(`${API}/models/${model.slug}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify({
      input: buildInput(model, imageUrl, prompt, durationS),
      ...(webhook ? { webhook, webhook_events_filter: ['completed'] } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Replicate ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export async function getPrediction(token: string, id: string): Promise<PredictionResult> {
  const res = await fetch(`${API}/predictions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Replicate ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export function outputUrl(p: PredictionResult): string | undefined {
  if (!p.output) return undefined;
  return Array.isArray(p.output) ? p.output[p.output.length - 1] : p.output;
}

export async function cancelPrediction(token: string, id: string): Promise<void> {
  await fetch(`${API}/predictions/${id}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Replicate's own record of what a prediction was asked to make, for pricing it after the fact. */
export function isFailed(p: PredictionResult): boolean {
  return p.status === 'failed' || p.status === 'canceled';
}
