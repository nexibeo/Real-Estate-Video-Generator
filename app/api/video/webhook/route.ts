/**
 * Replicate's completion webhook, so a failed clip is refunded even when the
 * customer closed the tab before it finished.
 *
 * The body is treated only as a hint of which prediction to look at. The real
 * status comes from Replicate's API with our own token, and the refund goes to
 * whichever account the ledger says was charged for that prediction, once. So
 * a forged call can at worst trigger a refund that was genuinely owed, to the
 * person it was owed to — there is nothing to gain by sending one.
 */
import { NextResponse } from 'next/server';
import { getPrediction, isFailed } from '@/lib/replicate';
import { refundByRef } from '@/lib/api';

export async function POST(req: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return NextResponse.json({ error: 'not configured' }, { status: 503 });

  let id: unknown;
  try {
    ({ id } = await req.json());
  } catch {
    return NextResponse.json({ error: 'bad body' }, { status: 400 });
  }
  if (typeof id !== 'string' || !/^[a-z0-9]{10,64}$/i.test(id)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 });
  }

  try {
    const p = await getPrediction(token, id);
    const refunded = isFailed(p) ? await refundByRef(`clip:${p.id}`, 'clip generation failed') : false;
    return NextResponse.json({ received: true, status: p.status, refunded });
  } catch (e) {
    // Not one of ours, or Replicate is unreachable: acknowledge, and let the
    // browser's poll catch a genuine failure instead.
    console.warn('[video-webhook]', e instanceof Error ? e.message : e);
    return NextResponse.json({ received: true });
  }
}
