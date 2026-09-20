/**
 * Anonymous accounts. Credits have to belong to someone, but a video tool does
 * not need names or passwords to sell $10 of rendering — so an account here is
 * a random id in an HMAC-signed, httpOnly cookie. Stripe carries it through
 * checkout in metadata and the webhook credits it back.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'vmx_acct';
const MAX_AGE = 60 * 60 * 24 * 365 * 2;

function secret(): string {
  const s = process.env.ACCOUNT_COOKIE_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ACCOUNT_COOKIE_SECRET must be set in production');
  }
  return 'dev-only-insecure-secret';
}

function sign(id: string): string {
  return createHmac('sha256', secret()).update(id).digest('hex').slice(0, 32);
}

function verify(value: string): string | null {
  const [id, mac] = value.split('.');
  if (!id || !mac) return null;
  const expected = sign(id);
  if (mac.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(mac), Buffer.from(expected)) ? id : null;
}

/** Reads the account from the request, creating one if this is a first visit. */
export async function getAccountId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) {
    const id = verify(existing);
    if (id) return id;
  }
  const id = `acct_${randomBytes(12).toString('hex')}`;
  jar.set(COOKIE, `${id}.${sign(id)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
  return id;
}

/** Read-only variant for routes that must not mint an account (the webhook). */
export async function peekAccountId(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value;
  return v ? verify(v) : null;
}
