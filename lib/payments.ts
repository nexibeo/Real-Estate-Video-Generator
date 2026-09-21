/**
 * Whether this deployment may take money.
 *
 * Selling a credit is a promise to do work later, so checkout only opens when
 * every part of keeping that promise is in place: Stripe itself, a webhook to
 * hear about the payment, a ledger that survives a restart, and the provider
 * keys that paid work is actually run on. Missing any one of them, a customer
 * could pay and get nothing — so the site says credits are not on sale yet
 * rather than taking the payment.
 */
import { isDurableStore } from './credits';

export interface Readiness {
  ready: boolean;
  /** Names of what is missing. For server logs only; never sent to a browser. */
  missing: string[];
}

export function paymentReadiness(): Readiness {
  const checks: Record<string, boolean> = {
    STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY),
    STRIPE_WEBHOOK_SECRET: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    'durable ledger (CREDIT_STORE=d1|upstash)': isDurableStore(),
    OPENROUTER_API_KEY: Boolean(process.env.OPENROUTER_API_KEY),
    REPLICATE_API_TOKEN: Boolean(process.env.REPLICATE_API_TOKEN),
  };
  const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  return { ready: missing.length === 0, missing };
}

/**
 * Metadata that marks a Checkout session as ours. The Stripe account is shared
 * with other products, and every one of their completed checkouts is delivered
 * to this webhook too — anything without this stamp is someone else's.
 */
export const APP_TAG = 'videamax';
