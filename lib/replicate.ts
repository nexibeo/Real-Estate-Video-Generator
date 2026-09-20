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
  maxDurationS: number;
  supportsNegative: boolean;
  durationField?: string;
  imageField: string;
}

/**
 * Per-second prices are Replicate's published rates at the time of writing and
 * they do change. `npm run verify:models` re-checks the slugs against the API;
 * the prices still need a human eye on replicate.com/pricing.
 */
export const VIDEO_MODELS: Record<string, VideoModel> = {
  kenburns: {
    slug: 'kenburns',
    label: 'Ken Burns (free)',
    blurb: 'Camera move rendered in your browser from the photo itself. No AI, no key, no cost.',
    usdPerSecond: 0,
    maxDurationS: 15,
    supportsNegative: false,
    imageField: '',
  },
  'wan-video/wan-2.2-i2v-fast': {
    slug: 'wan-video/wan-2.2-i2v-fast',
    label: 'Wan 2.2 Fast',
    blurb: 'Cheapest real image-to-video. Good for drafts and for checking a shot list.',
    usdPerSecond: 0.02,
    maxDurationS: 10,
    supportsNegative: true,
    durationField: 'num_frames',
    imageField: 'image',
  },
  'wan-video/wan-2.5-i2v': {
    slug: 'wan-video/wan-2.5-i2v',
    label: 'Wan 2.5',
    blurb: 'The standard choice. Holds architectural lines better than the fast variants.',
    usdPerSecond: 0.05,
    maxDurationS: 10,
    supportsNegative: true,
    durationField: 'duration',
    imageField: 'image',
  },
  'kwaivgi/kling-v3-video': {
    slug: 'kwaivgi/kling-v3-video',
    label: 'Kling v3',
    blurb: 'Best motion quality and the only one that reaches 15s. Use it on the hero shots.',
    usdPerSecond: 0.1,
    maxDurationS: 15,
    supportsNegative: true,
    durationField: 'duration',
    imageField: 'start_image',
  },
  'xai/grok-imagine-video': {
    slug: 'xai/grok-imagine-video',
    label: 'Grok Imagine',
    blurb: 'xAI\'s model, via a real API rather than a browser script.',
    usdPerSecond: 0.05,
    maxDurationS: 10,
    supportsNegative: false,
    durationField: 'duration',
    imageField: 'image',
  },
};

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
  if (model.durationField === 'num_frames') input.num_frames = Math.round(durationS * 16);
  else if (model.durationField) input[model.durationField] = durationS;
  return input;
}

export async function startPrediction(
  token: string,
  modelSlug: string,
  imageUrl: string,
  prompt: string,
  durationS: number,
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
    body: JSON.stringify({ input: buildInput(model, imageUrl, prompt, durationS) }),
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
