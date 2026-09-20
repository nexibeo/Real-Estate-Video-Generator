import type { Metadata } from 'next';
import Link from 'next/link';
import { Estimator } from '@/components/Estimator';
import { PACKS, MARKUP, priceMatrix, fmtUsd } from '@/lib/pricing';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Credits, no subscription. Estimate the exact cost of a video before you make it.',
};

export default function Pricing() {
  const matrix = priceMatrix(8);
  return (
    <main className="mx-auto max-w-6xl px-6 pb-20 pt-16">
      <h1 className="font-display text-4xl text-chalk">Pricing</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-mist">
        Credits, bought when you need them. Nothing renews, nothing expires, and the price of
        every job is shown before you spend anything.
      </p>

      <section className="mt-10 grid gap-5 sm:grid-cols-3">
        {PACKS.map((p) => (
          <div key={p.usd} className="rounded-xl border border-line bg-ink-2/60 p-6 transition-colors hover:border-gold/40">
            <div className="text-xs uppercase tracking-wider text-mist">{p.label}</div>
            <div className="mt-2 font-display text-4xl text-chalk">${p.usd}</div>
            <div className="mt-1 font-mono text-sm text-gold">{p.credits.toLocaleString()} credits</div>
            {'bonus' in p && p.bonus && <div className="mt-1 text-xs text-jade">{p.bonus}</div>}
            <Link href="/credits"
                  className="mt-5 block rounded-lg border border-line bg-ink-3 py-2.5 text-center text-sm text-chalk transition-colors hover:border-gold/50">
              Buy credits
            </Link>
          </div>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-chalk">Estimate your video</h2>
        <p className="mt-2 max-w-2xl text-mist">
          Drag the sliders. The numbers are the real ones the studio charges.
        </p>
        <div className="mt-6"><Estimator /></div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-chalk">A typical eight-shot video</h2>
        <p className="mt-2 max-w-2xl text-mist">
          Twenty photos read, eight rooms animated, narration and captions included.
        </p>
        <div className="mt-6 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-ink-3 text-xs uppercase tracking-wider text-mist">
              <tr>
                <th className="px-5 py-3 font-medium">Engine</th>
                <th className="px-5 py-3 font-medium">Length</th>
                <th className="px-5 py-3 text-right font-medium">Your own keys</th>
                <th className="px-5 py-3 text-right font-medium">With credits</th>
                <th className="px-5 py-3 text-right font-medium">Credits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {matrix.flatMap((row) =>
                row.cells.map((c, i) => (
                  <tr key={`${row.model.slug}-${c.durationS}`} className="bg-ink-2/40">
                    <td className="px-5 py-3 font-medium text-chalk">{i === 0 ? row.model.label : ''}</td>
                    <td className="px-5 py-3 font-mono text-mist">{c.durationS * 8}s total</td>
                    <td className="px-5 py-3 text-right font-mono text-mist">{fmtUsd(c.apiUsd)}</td>
                    <td className="px-5 py-3 text-right font-mono text-gold">{fmtUsd(c.chargedUsd)}</td>
                    <td className="px-5 py-3 text-right font-mono text-mist">
                      {c.credits === 0 ? '—' : c.credits.toLocaleString()}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-ink-2/60 p-6">
          <h3 className="font-display text-xl text-chalk">Where the {MARKUP}x goes</h3>
          <p className="mt-3 text-sm leading-relaxed text-mist">
            Credits cost {MARKUP} times what the underlying API calls cost us, and that multiple is
            the whole business: the keys, the hosting, the queue, the support, and the work of
            keeping the prompts and model choices current as providers change under us.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-mist">
            If you would rather not pay it, don&apos;t — put your own keys in{' '}
            <Link href="/settings" className="text-gold hover:underline">Settings</Link> and you pay
            the providers directly at cost. The app works exactly the same either way.
          </p>
        </div>
        <div className="rounded-xl border border-jade/30 bg-jade/5 p-6">
          <h3 className="font-display text-xl text-chalk">And the free tier is genuinely free</h3>
          <p className="mt-3 text-sm leading-relaxed text-mist">
            Ken Burns camera moves, motion graphics, captions and both aspect ratios cost nothing,
            need no key and never leave your browser. You label the rooms yourself instead of having
            a model do it.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-mist">
            It is a real product, not a teaser. For a lot of listings a well-moved photograph beats
            a generated clip that quietly bends a doorframe.
          </p>
        </div>
      </section>

      <section className="mt-12 rounded-xl border border-gold/30 bg-gold/5 p-6">
        <h3 className="font-display text-xl text-chalk">Agencies and portals</h3>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-mist">
          Bulk volume, your own branding, your listing feed, your infrastructure — that is a custom
          build rather than a credit pack.{' '}
          <a href="https://nexibeo.com" target="_blank" rel="noreferrer" className="text-gold hover:underline">
            Contact nexibeo.com
          </a>{' '}
          for a system built for your agency.
        </p>
      </section>
    </main>
  );
}
