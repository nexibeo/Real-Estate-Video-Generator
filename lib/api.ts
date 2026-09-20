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

/** Charge for one operation. No-op in BYOK mode — they are paying the provider directly. */
export async function charge(r: Resolved, apiUsd: number, reason: string): Promise<number | null> {
  if (r.mode === 'byok') return null;
  const credits = Math.max(1, Math.ceil(apiUsd * MARKUP * CREDITS_PER_USD));
  const balance = await getStore().debit(r.accountId, credits, reason);
  if (balance === null) {
    throw new ApiError(
      `Not enough credits — this step costs ${credits}. Top up on the Credits page, or add your own API key in Settings.`,
      402,
      'insufficient_credits',
    );
  }
  return balance;
}

export function fail(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
  const message = e instanceof Error ? e.message : 'Unexpected error';
  console.error('[api]', message);
  return NextResponse.json({ error: message }, { status: 500 });
}
