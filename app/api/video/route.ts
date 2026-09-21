/**
 * Stage 5 — image to video on Replicate.
 *
 * POST starts a prediction, GET polls it. Long generations must not sit inside
 * a serverless request, so the browser holds the poll loop and the job survives
 * a reload: the prediction id is all the state there is.
 *
 * The photo goes up as a data URI, so no bucket, no public URL, and nothing of
 * the user's property is left on our storage after the clip is made.
 *
 * Billing a clip is different from billing a quick call, because a clip fails
 * minutes later, out of band. So on the credits path the charge is recorded
 * under the prediction's own id (`clip:<id>`), and a failure — seen by the
 * poll below, or by Replicate's completion webhook if the tab was closed —
 * refunds it exactly once.
 */
import { NextResponse } from 'next/server';
import {
  startPrediction, getPrediction, cancelPrediction, outputUrl, isFailed, VIDEO_MODELS, clampDuration,
} from '@/lib/replicate';
import { resolveKey, fail, ApiError, creditsFor, insufficient, refundByRef } from '@/lib/api';
import { getStore } from '@/lib/credits';

export async function POST(req: Request) {
  try {
    const { modelSlug, imageUrl, prompt, durationS } = await req.json();
    const model = VIDEO_MODELS[modelSlug];
    if (!model) throw new ApiError(`Unknown model ${modelSlug}`, 400);
    if (model.usdPerSecond === 0) throw new ApiError('Ken Burns renders in the browser, not here', 400);

    const r = await resolveKey(req, 'replicate');
    const seconds = clampDuration(model, durationS);

    if (r.mode === 'byok') {
      const p = await startPrediction(r.key, modelSlug, imageUrl, prompt, seconds);
      return NextResponse.json({ id: p.id, status: p.status, balance: null });
    }

    // Credits: check first so unaffordable work is never started…
    const credits = creditsFor(model.usdPerSecond * seconds);
    const store = getStore();
    if ((await store.balance(r.accountId)) < credits) throw insufficient(credits);

    // …then start it, with a completion webhook when we are publicly reachable…
    const origin = new URL(req.url).origin;
    const webhook = origin.startsWith('https://') ? `${origin}/api/video/webhook` : undefined;
    const p = await startPrediction(r.key, modelSlug, imageUrl, prompt, seconds, webhook);

    // …then charge it under the prediction's id. If a concurrent request spent
    // the balance in between, the conditional debit fails: cancel, don't bill.
    const balance = await store.debit(r.accountId, credits, `clip — ${model.label}`, `clip:${p.id}`);
    if (balance === null) {
      await cancelPrediction(r.key, p.id).catch(() => {});
      throw insufficient(credits);
    }
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

    let refunded = false;
    if (r.mode === 'credits' && isFailed(p)) {
      refunded = await refundByRef(`clip:${p.id}`, 'clip generation failed');
    }

    return NextResponse.json({
      id: p.id,
      status: p.status,
      url: outputUrl(p),
      error: p.error,
      refunded,
    });
  } catch (e) {
    return fail(e);
  }
}
