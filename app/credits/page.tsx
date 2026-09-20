'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PACKS } from '@/lib/pricing';

interface Entry { at: number; delta: number; reason: string }

export default function Credits() {
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [paid, setPaid] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/credits', { cache: 'no-store' });
    const d = await res.json();
    setBalance(d.balance);
    setHistory(d.history ?? []);
    setStripeEnabled(d.stripeEnabled);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paid')) setPaid(true);
    void refresh();
  }, [refresh]);

  async function buy(usd: number) {
    setBusy(usd);
    setError('');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usd }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Checkout failed');
      window.location.href = d.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-20 pt-16">
      <h1 className="font-display text-4xl text-chalk">Credits</h1>
      <p className="mt-4 leading-relaxed text-mist">
        One credit is one US cent of charge. Buy them when you need them; there is no subscription
        and nothing expires.
      </p>

      {paid && (
        <div className="mt-6 rounded-lg border border-jade/40 bg-jade/10 p-4 text-sm text-jade">
          Payment received. Your balance updates as soon as Stripe confirms it — refresh in a moment
          if it still shows the old number.
        </div>
      )}

      <div className="mt-8 rounded-xl border border-gold/30 bg-gradient-to-b from-gold/[0.08] to-transparent p-8 text-center">
        <div className="text-xs uppercase tracking-wider text-mist">Balance</div>
        <div className="mt-2 font-display text-6xl text-chalk">
          {balance === null ? <span className="pulse">—</span> : balance.toLocaleString()}
        </div>
        <div className="mt-1 text-sm text-mist">
          credits {balance !== null && balance > 0 && <>· about ${(balance / 100).toFixed(2)} of rendering</>}
        </div>
      </div>

      {!stripeEnabled && (
        <div className="mt-6 rounded-lg border border-line bg-ink-2/60 p-4 text-sm text-mist">
          <strong className="text-chalk">Stripe is not configured on this deployment.</strong> Set{' '}
          <code className="font-mono text-xs text-gold">STRIPE_SECRET_KEY</code> and{' '}
          <code className="font-mono text-xs text-gold">STRIPE_WEBHOOK_SECRET</code> to take
          payments. Until then, use the free tier or{' '}
          <Link href="/settings" className="text-gold hover:underline">your own API keys</Link>.
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {PACKS.map((p) => (
          <button key={p.usd} onClick={() => buy(p.usd)} disabled={!stripeEnabled || busy !== null}
                  className="rounded-xl border border-line bg-ink-2/60 p-6 text-left transition-colors hover:border-gold/50 disabled:cursor-not-allowed disabled:opacity-50">
            <div className="text-xs uppercase tracking-wider text-mist">{p.label}</div>
            <div className="mt-2 font-display text-3xl text-chalk">${p.usd}</div>
            <div className="mt-1 font-mono text-sm text-gold">{p.credits.toLocaleString()} credits</div>
            {'bonus' in p && p.bonus && <div className="mt-1 text-xs text-jade">{p.bonus}</div>}
            <div className="mt-4 text-sm text-mist">{busy === p.usd ? 'Opening Stripe…' : 'Buy →'}</div>
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg border border-rust/40 bg-rust/10 p-3 text-sm text-rust">{error}</p>}

      {history.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl text-chalk">Recent activity</h2>
          <div className="mt-4 divide-y divide-line rounded-xl border border-line">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <div className="text-chalk">{h.reason}</div>
                  <div className="text-xs text-mist">{new Date(h.at).toLocaleString()}</div>
                </div>
                <div className={`font-mono ${h.delta > 0 ? 'text-jade' : 'text-mist'}`}>
                  {h.delta > 0 ? '+' : ''}{h.delta.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
