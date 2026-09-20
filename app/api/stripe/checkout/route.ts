/** Creates a Stripe Checkout session for one credit pack. One-off payment, no subscription. */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAccountId } from '@/lib/account';
import { PACKS } from '@/lib/pricing';
import { fail, ApiError } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new ApiError('Stripe is not configured on this deployment', 503, 'no_stripe');

    const { usd } = await req.json();
    const pack = PACKS.find((p) => p.usd === usd);
    if (!pack) throw new ApiError('Unknown credit pack', 400);

    const accountId = await getAccountId();
    const stripe = new Stripe(secret);
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
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
      // The webhook reads these back. The account id is the only identity we hold.
      metadata: { accountId, credits: String(pack.credits) },
      payment_intent_data: { metadata: { accountId, credits: String(pack.credits) } },
      success_url: `${origin}/credits?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/credits?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return fail(e);
  }
}
