/**
 * Shared request plumbing for the API routes.
 *
 * Key resolution is the heart of it. There are two ways to pay for a call:
 *   BYOK    — the browser sends the user's own keys in headers. We use them for
 *             this one request and never write them down.
 *   credits — no user key, so we use the server's key and debit the account at
 *             10x the measured API cost.
 * Anything else is refused. There is no path where someone spends our key for free.
 */
import { NextResponse } from 'next/server';
import { getAccountId } from './account';
import { getStore } from './credits';
import { MARKUP, CREDITS_PER_USD } from './pricing';

export type Provider = 'openrouter' | 'replicate';

export interface Resolved {
  key: string;
  mode: 'byok' | 'credits';
  accountId: string;
}

const HEADER: Record<Provider, string> = {
  openrouter: 'x-openrouter-key',
  replicate: 'x-replicate-token',
};

const ENV: Record<Provider, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  replicate: 'REPLICATE_API_TOKEN',
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

export async function resolveKey(req: Request, provider: Provider): Promise<Resolved> {
  const accountId = await getAccountId();
  const supplied = req.headers.get(HEADER[provider])?.trim();
  if (supplied) return { key: supplied, mode: 'byok', accountId };

  const serverKey = process.env[ENV[provider]];
  if (!serverKey) {
    throw new ApiError(
      `No ${provider} key. Add your own key in Settings, or buy credits to use ours.`,
      400,
      'no_key',
    );
  }
  return { key: serverKey, mode: 'credits', accountId };
}

/**
 * Charge for one operation; returns the new balance, or null in BYOK mode,
 * where the user pays the provider directly. Prefer billed() for new code —
 * it refunds automatically when the work fails.
 */
export async function charge(r: Resolved, apiUsd: number, reason: string, ref?: string): Promise<number | null> {
  if (r.mode === 'byok') return null;
  const credits = creditsFor(apiUsd);
  const balance = await getStore().debit(r.accountId, credits, reason, ref);
  if (balance === null) throw insufficient(credits);
  return balance;
}

export function creditsFor(apiUsd: number): number {
  return Math.max(1, Math.ceil(apiUsd * MARKUP * CREDITS_PER_USD));
}

export function insufficient(credits: number): ApiError {
  return new ApiError(
    `Not enough credits — this step costs ${credits}. Top up on the Credits page, or add your own API key in Settings.`,
    402,
    'insufficient_credits',
  );
}

/**
 * Charge, do the work, and give the credits back if the work fails.
 *
 * Credits are taken up front so a balance can't be spent twice by two
 * requests at once — but a provider outage must not bill anyone for work they
 * never got, so any failure hands the charge straight back.
 */
export async function billed<T>(
  r: Resolved,
  apiUsd: number,
  reason: string,
  work: () => Promise<T>,
): Promise<{ result: T; balance: number | null }> {
  const balance = await charge(r, apiUsd, reason);
  try {
    return { result: await work(), balance };
  } catch (e) {
    if (r.mode === 'credits') {
      await getStore()
        .credit(r.accountId, creditsFor(apiUsd), `refund — ${reason} failed`)
        .catch((err) => console.error('[billing] refund failed', err));
    }
    throw e;
  }
}

/**
 * Refund whatever was charged under `ref`, at most once — for work that fails
 * after the request that paid for it has finished (a video clip). The refund
 * goes to the account the ledger says was charged, never to whoever asked, and
 * the UNIQUE refund ref makes repeated calls harmless.
 */
export async function refundByRef(ref: string, why: string): Promise<boolean> {
  const store = getStore();
  const c = await store.findCharge(ref);
  if (!c) return false;
  await store.credit(c.accountId, c.credits, `refund — ${why}`, `refund:${ref}`);
  return true;
}

export function fail(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
  const message = e instanceof Error ? e.message : 'Unexpected error';
  console.error('[api]', message);
  return NextResponse.json({ error: message }, { status: 500 });
}
