import { NextResponse } from 'next/server';
import { getAccountId } from '@/lib/account';
import { getStore } from '@/lib/credits';
import { fail } from '@/lib/api';

export async function GET() {
  try {
    const id = await getAccountId();
    const store = getStore();
    return NextResponse.json({
      accountId: id,
      balance: await store.balance(id),
      history: await store.history(id),
      stripeEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
    });
  } catch (e) {
    return fail(e);
  }
}
