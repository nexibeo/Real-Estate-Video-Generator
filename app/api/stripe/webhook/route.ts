/**
 * Stripe webhook — the only place credits are ever created.
 *
 * Four rules, each for a failure that would cost someone money:
 *
 * 1. The signature is verified against the RAW body, so no req.json().
 * 2. Only sessions stamped `app: videamax` are handled. The Stripe account is
 *    shared with other products; their completed checkouts arrive here too,
 *    and must be acknowledged and ignored rather than credited.
 * 3. The amount paid must match a real pack for the credits claimed. Metadata
 *    is written by our server, but cross-checking costs nothing.
 * 4. The credit is idempotent on the checkout session id, enforced by a
 *    UNIQUE column in the ledger. Stripe retries, and a card payment and an
 *    async-payment success can both mention one session; either way it pays
 *    out once.
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStore } from '@/lib/credits';
import { PACKS } from '@/lib/pricing';
import { APP_TAG } from '@/lib/payments';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  const raw = await req.text();
  const stripe = new Stripe(secret, { httpClient: Stripe.createFetchHttpClient() });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      raw, signature, webhookSecret, undefined, Stripe.createSubtleCryptoProvider(),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'bad signature';
    return NextResponse.json({ error: `Signature check failed: ${message}` }, { status: 400 });
  }

  const paidEvent =
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded';
  if (!paidEvent) return NextResponse.json({ received: true, ignored: event.type });

  const session = event.data.object as Stripe.Checkout.Session;
  const meta = session.metadata ?? {};
  if (meta.app !== APP_TAG) {
    // Another product on the same Stripe account. 200 so Stripe stops retrying.
    return NextResponse.json({ received: true, ignored: 'not a videamax session' });
  }
  if (session.payment_status !== 'paid') {
    // An async method still settling; async_payment_succeeded will follow.
    return NextResponse.json({ received: true, pending: session.payment_status });
  }

  const accountId = meta.videamax_account;
  const credits = Number(meta.videamax_credits ?? 0);
  const pack = PACKS.find((p) => p.credits === credits && p.usd * 100 === session.amount_total);
  if (!accountId || !pack || session.currency !== 'usd') {
    console.error('[webhook] videamax session did not match a pack', {
      session: session.id, credits, amount: session.amount_total, currency: session.currency,
    });
    // 500 so it stays visible in Stripe's dashboard as failed, and retries.
    return NextResponse.json({ error: 'Session does not match a credit pack' }, { status: 500 });
  }

  await getStore().credit(accountId, pack.credits, `top-up $${pack.usd}`, `stripe_session:${session.id}`);
  return NextResponse.json({ received: true, credited: pack.credits });
}
