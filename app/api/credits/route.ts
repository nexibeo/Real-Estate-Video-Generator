import { NextResponse } from 'next/server';
import { getAccountId } from '@/lib/account';
import { getStore } from '@/lib/credits';
import { fail } from '@/lib/api';
import { paymentReadiness } from '@/lib/payments';

export async function GET() {
  try {
    const id = await getAccountId();
    const store = getStore();
    return NextResponse.json({
      accountId: id,
      balance: await store.balance(id),
      history: await store.history(id),
      // Only whether credits can be bought — never which setting is missing.
      stripeEnabled: paymentReadiness().ready,
    });
  } catch (e) {
    return fail(e);
  }
}
