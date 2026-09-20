import Link from 'next/link';
import { PipelineDiagram } from '@/components/PipelineDiagram';
import { VIDEO_MODELS } from '@/lib/replicate';
import { estimate, fmtUsd } from '@/lib/pricing';

const free = estimate(
  { videoModel: 'kenburns', durationS: 6, narrationStyle: 'friendly_host', tier: 'credits' }, 0, 8);
const fast = estimate(
  { videoModel: 'wan-video/wan-2.2-i2v-fast', durationS: 6, narrationStyle: 'friendly_host', tier: 'credits' }, 20, 8);

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="rise pt-20 pb-16">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-ink-2 px-3 py-1 text-xs text-mist">
          <span className="h-1.5 w-1.5 rounded-full bg-jade" />
          Free tier renders entirely in your browser — no key, no account
        </p>
        <h1 className="max-w-3xl font-display text-5xl leading-[1.08] tracking-tight text-chalk sm:text-6xl">
          Your listing photos are already a video.
          <span className="block text-gold">They just aren&apos;t moving yet.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-mist">
          Upload the photos you already have. Videamax works out which room each one is,
          gives every room the camera move that suits it, writes and speaks the narration,
          and renders a finished tour in both social and portal formats.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/studio"
                className="rounded-lg bg-gold px-6 py-3 font-medium text-ink transition-opacity hover:opacity-90">
            Make a video — free
          </Link>
          <Link href="/pricing"
                className="rounded-lg border border-line bg-ink-2 px-6 py-3 text-chalk transition-colors hover:border-gold/50">
            What it costs
          </Link>
        </div>
      </section>

      {/* ── Pipeline ─────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-line bg-ink-2/60 p-8">
        <PipelineDiagram className="w-full" />
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="grid gap-6 py-20 md:grid-cols-3">
        {[
          {
            n: '01',
            h: 'It reads the rooms',
            p: 'A vision model describes each photo in words. Jev — a decision model — then picks the room type from a fixed list and returns how sure it is. Anything under the confidence bar is flagged for you rather than quietly guessed.',
          },
          {
            n: '02',
            h: 'Every room gets its own shot',
            p: 'A kitchen gets a lateral truck along the counter. A bedroom gets a slow push-in. A close-up gets almost nothing, because a push-in on a tight frame has nowhere to go and warps. The prompt describes the lens, never the room.',
          },
          {
            n: '03',
            h: 'It renders on your machine',
            p: 'Clips, voiceover, captions and motion graphics are composited on a canvas in your browser and captured straight to a file. Nothing is uploaded to be assembled, and the finished video never sits on our disk.',
          },
        ].map((c) => (
          <div key={c.n} className="rounded-xl border border-line bg-ink-2/40 p-6">
            <div className="font-mono text-xs text-gold">{c.n}</div>
            <h3 className="mt-3 font-display text-xl text-chalk">{c.h}</h3>
            <p className="mt-3 text-sm leading-relaxed text-mist">{c.p}</p>
          </div>
        ))}
      </section>

      {/* ── Tiers ────────────────────────────────────────────────────────── */}
      <section className="py-4">
        <h2 className="font-display text-3xl text-chalk">Three ways to pay for it</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-xl border border-jade/30 bg-jade/5 p-6">
            <div className="text-xs uppercase tracking-wider text-jade">Free</div>
            <div className="mt-2 font-display text-3xl text-chalk">{fmtUsd(free.apiUsd)}</div>
            <p className="mt-3 text-sm leading-relaxed text-mist">
              Ken Burns camera moves on your own photos, captions, motion graphics, both aspect
              ratios. Rendered in your browser with no API key at all. You label the rooms yourself.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-ink-2/60 p-6">
            <div className="text-xs uppercase tracking-wider text-mist">Your own keys</div>
            <div className="mt-2 font-display text-3xl text-chalk">cost price</div>
            <p className="mt-3 text-sm leading-relaxed text-mist">
              Paste an OpenRouter key and a Replicate token in Settings and you pay those providers
              directly — about {fmtUsd(fast.apiUsd)} for an eight-shot video. We add nothing and
              never store the keys.
            </p>
          </div>
          <div className="rounded-xl border border-gold/40 bg-gold/5 p-6">
            <div className="text-xs uppercase tracking-wider text-gold">Credits</div>
            <div className="mt-2 font-display text-3xl text-chalk">$10 / $20 / $50</div>
            <p className="mt-3 text-sm leading-relaxed text-mist">
              No keys, no subscription. Buy credits, spend them, stop whenever. Roughly{' '}
              {fmtUsd(fast.chargedUsd)} for that same video — every price is shown before you spend.
            </p>
          </div>
        </div>
      </section>

      {/* ── Models ───────────────────────────────────────────────────────── */}
      <section className="py-20">
        <h2 className="font-display text-3xl text-chalk">Pick the engine per job</h2>
        <p className="mt-3 max-w-2xl text-mist">
          A draft to check the shot list costs cents. A hero listing can have the good model.
          Same pipeline either way.
        </p>
        <div className="mt-8 overflow-hidden rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-3 text-xs uppercase tracking-wider text-mist">
              <tr>
                <th className="px-5 py-3 font-medium">Engine</th>
                <th className="px-5 py-3 font-medium">Best for</th>
                <th className="px-5 py-3 text-right font-medium">Per second</th>
                <th className="px-5 py-3 text-right font-medium">Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {Object.values(VIDEO_MODELS).map((m) => (
                <tr key={m.slug} className="bg-ink-2/40">
                  <td className="px-5 py-3.5 font-medium text-chalk">{m.label}</td>
                  <td className="px-5 py-3.5 text-mist">{m.blurb}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-chalk">
                    {m.usdPerSecond === 0 ? 'free' : `$${m.usdPerSecond.toFixed(3)}`}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-mist">{m.maxDurationS}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Agency CTA ───────────────────────────────────────────────────── */}
      <section className="mb-8 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-transparent p-10">
        <h2 className="font-display text-3xl text-chalk">Running an agency?</h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-mist">
          Videamax is the self-serve version. If you want this wired into your own systems —
          your listing feed, your branding, your templates, bulk rendering across a whole
          portfolio, your own models and your own infrastructure — that is a build, not a signup.
        </p>
        <a href="https://nexibeo.com" target="_blank" rel="noreferrer"
           className="mt-7 inline-flex items-center gap-2 rounded-lg bg-gold px-6 py-3 font-medium text-ink transition-opacity hover:opacity-90">
          Talk to Nexibeo →
        </a>
        <p className="mt-3 text-sm text-mist">
          nexibeo.com — custom real estate video systems.
        </p>
      </section>
    </main>
  );
}
