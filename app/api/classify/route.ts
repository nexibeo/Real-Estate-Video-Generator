/**
 * Stage 3 — vision read, then Jev decision. One photo per request so the UI can
 * show progress honestly and a single bad photo cannot fail the batch.
 */
import { NextResponse } from 'next/server';
import { describePhoto } from '@/lib/openrouter';
import { classifyWithJev } from '@/lib/jev';
import { resolveKey, billed, fail } from '@/lib/api';
import { VISION_COST_PER_PHOTO } from '@/lib/pricing';
import { JEV_COST_PER_PHOTO } from '@/lib/jev';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { photoId, dataUrl, caption } = await req.json();
    if (!dataUrl) throw new Error('dataUrl is required');

    const r = await resolveKey(req, 'openrouter');
    const { result, balance } = await billed(r, VISION_COST_PER_PHOTO + JEV_COST_PER_PHOTO, 'classify photo', async () => {
      const read = await describePhoto(r.key, dataUrl);
      const decision = await classifyWithJev(r.key, read, caption);
      return { ...read, ...decision };
    });

    return NextResponse.json({ photoId, ...result, balance });
  } catch (e) {
    return fail(e);
  }
}
