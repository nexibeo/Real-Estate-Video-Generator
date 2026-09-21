/** Creates a Stripe Checkout session for one credit pack. One-off payment, no subscription. */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAccountId } from '@/lib/account';
import { PACKS } from '@/lib/pricing';
import { paymentReadiness, APP_TAG } from '@/lib/payments';
import { fail, ApiError } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const readiness = paymentReadiness();
    if (!readiness.ready) {
      console.warn('[checkout] refused, missing:', readiness.missing.join(', '));
      throw new ApiError('Credit packs are not on sale yet.', 503, 'payments_not_ready');
    }

    const { usd } = await req.json();
    const pack = PACKS.find((p) => p.usd === usd);
    if (!pack) throw new ApiError('Unknown credit pack', 400);

    const accountId = await getAccountId();
    // The fetch client works in every runtime, including Cloudflare Workers,
    // where the default Node http client is not a given.
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { httpClient: Stripe.createFetchHttpClient() });
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;

    // Namespaced, because the Stripe account is shared with other products and
    // their webhooks see this session too.
    const metadata = {
      app: APP_TAG,
      videamax_account: accountId,
      videamax_credits: String(pack.credits),
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: accountId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: pack.usd * 100,
            product_data: {
              name: `Videamax — ${pack.credits.toLocaleString()} credits`,
              description: `${pack.label} pack. Credits never expire and there is no subscription.`,
            },
          },
        },
      ],
      metadata,
      payment_intent_data: { metadata },
      success_url: `${origin}/credits?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/credits?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return fail(e);
  }
}
