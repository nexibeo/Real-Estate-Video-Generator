/**
 * Stripe webhook — the only place credits are ever created.
 *
 * Two things matter here and both are easy to get wrong: the signature must be
 * verified against the RAW body (so no req.json()), and the credit must be
 * idempotent, because Stripe retries. The event id is the idempotency ref.
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStore } from '@/lib/credits';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  const raw = await req.text();
  const stripe = new Stripe(secret);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, webhookSecret);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'bad signature';
    return NextResponse.json({ error: `Signature check failed: ${message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === 'paid') {
      const accountId = session.metadata?.accountId;
      const credits = Number(session.metadata?.credits ?? 0);
      if (accountId && credits > 0) {
        await getStore().credit(accountId, credits, `top-up $${(session.amount_total ?? 0) / 100}`, event.id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
