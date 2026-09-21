import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rights and permission',
  description: 'Videamax is for listings you own or represent. Here is why, and what happens to your photos.',
};

export default function Legal() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-20 pt-16">
      <h1 className="font-display text-4xl text-chalk">Rights and permission</h1>

      <div className="mt-8 space-y-8 leading-relaxed text-mist">
        <section>
          <h2 className="font-display text-2xl text-chalk">This is for your own listings</h2>
          <p className="mt-3">
            Videamax is built for the person who owns the property, hosts it, or is the listing
            agent for it. That is not a formality — listing photos are owned by whoever took them,
            usually the photographer or the listing broker, and a promotional video made from
            someone else&apos;s photos is a copyright problem no matter how good it looks.
          </p>
          <p className="mt-3">
            The checkbox in the Studio is where you confirm that. It records the confirmation with a
            timestamp, which is what makes it worth anything.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-chalk">Where your photos go</h2>
          <p className="mt-3">
            They are read in your browser and stay there. Nothing is uploaded when you add photos,
            and the finished video is assembled on your own machine rather than on a server.
          </p>
          <p className="mt-3">
            Two things do leave, and only if you ask for them: a photo goes to the vision model when
            you use automatic room reading, and a photo goes to the video model for each shot you
            choose to animate. Neither is stored by us afterwards. On the free tier nothing leaves
            at all.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-chalk">What the voiceover may say</h2>
          <p className="mt-3">
            Only what you typed into the listing fields, plus what is visible in the photo. The
            script model is instructed never to invent a fact — no distances, no schools, no
            transport links, no renovations, no sizes you did not give it. A false claim in an
            advertisement is the agent&apos;s licence at risk, not ours, so the safe behaviour is
            the default and there is no switch to turn it off.
          </p>
          <p className="mt-3">
            For US listings the script is also constrained by fair-housing rules: it will not refer
            to race, religion, national origin, family status, sex or disability, and it will not
            imply who a property suits.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-chalk">The AI label</h2>
          <p className="mt-3">
            Videos carry a small &ldquo;AI-generated visualisation&rdquo; tag by default. Some
            portals and MLS rules require the disclosure, and the footage genuinely is synthesised
            from stills — a room that has been animated can show motion that never happened. You can
            turn the tag off; whether you should depends on where you are publishing.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-chalk">What we measure</h2>
          <p className="mt-3">
            If you allow it, Google Analytics counts page views and records which options get
            chosen — the engine, the number of shots, the length, whether captions were on,
            whether a render finished. That is how we know which parts are worth improving.
          </p>
          <p className="mt-3">
            What it never receives: your photos, your listing details, an address, a price, an
            agent name, or any part of an API key. None of those reach our servers either, so
            there is nothing to forward even by accident. When a render fails we log a reason
            code from a fixed list rather than the error text, because an error message can
            carry a key fragment or a signed URL.
          </p>
          <p className="mt-3">
            Nothing is measured until you say yes, and declining is one click. If your browser
            sends a Global Privacy Control or Do Not Track signal we treat that as a no and never
            ask. You can change your mind at any time from the link in the footer.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-chalk">Taking something down</h2>
          <p className="mt-3">
            If a video was made from photos that were not the maker&apos;s to use, write to us and
            it goes, along with everything derived from it.
          </p>
        </section>

        <section className="rounded-xl border border-gold/30 bg-gold/5 p-6">
          <h2 className="font-display text-xl text-chalk">Agencies</h2>
          <p className="mt-3 text-sm">
            If you need this operating inside your own compliance regime — your feed, your
            retention rules, your branding, your legal review —{' '}
            <a href="https://nexibeo.com" target="_blank" rel="noreferrer" className="text-gold hover:underline">
              nexibeo.com
            </a>{' '}
            builds the custom version.
          </p>
        </section>
      </div>
    </main>
  );
}
