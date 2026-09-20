/**
 * Stage 5 — image to video on Replicate.
 *
 * POST starts a prediction, GET polls it. Long generations must not sit inside
 * a serverless request, so the browser holds the poll loop and the job survives
 * a reload: the prediction id is all the state there is.
 *
 * The photo goes up as a data URI, so no bucket, no public URL, and nothing of
 * the user's property is left on our storage after the clip is made.
 */
import { NextResponse } from 'next/server';
import { startPrediction, getPrediction, outputUrl, VIDEO_MODELS } from '@/lib/replicate';
import { resolveKey, charge, fail, ApiError } from '@/lib/api';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { modelSlug, imageUrl, prompt, durationS } = await req.json();
    const model = VIDEO_MODELS[modelSlug];
    if (!model) throw new ApiError(`Unknown model ${modelSlug}`, 400);
    if (model.usdPerSecond === 0) throw new ApiError('Ken Burns renders in the browser, not here', 400);

    const r = await resolveKey(req, 'replicate');
    const seconds = Math.min(durationS, model.maxDurationS);
    const balance = await charge(r, model.usdPerSecond * seconds, `clip — ${model.label}`);

    const p = await startPrediction(r.key, modelSlug, imageUrl, prompt, seconds);
    return NextResponse.json({ id: p.id, status: p.status, balance });
  } catch (e) {
    return fail(e);
  }
}

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) throw new ApiError('id is required', 400);
    const r = await resolveKey(req, 'replicate');
    const p = await getPrediction(r.key, id);
    return NextResponse.json({
      id: p.id,
      status: p.status,
      url: outputUrl(p),
      error: p.error,
    });
  } catch (e) {
    return fail(e);
  }
}
