'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { analyticsActive, readConsent, writeConsent, browserSaysNo, pageView } from '@/lib/analytics';
import { usePathname } from 'next/navigation';

/**
 * The consent prompt.
 *
 * It only appears when there is actually something to consent to: analytics
 * configured, no prior answer, and no Global Privacy Control or Do Not Track
 * signal already saying no. Declining is a single click of equal weight to
 * accepting, which is both the legal requirement in the EU and the honest way
 * to ask.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Only ask when there is something to consent to: the tag loaded (right
    // host, ID set) and the browser has not already said no.
    if (!analyticsActive() || browserSaysNo()) return;
    setVisible(readConsent() === 'unset');
  }, []);

  if (!visible) return null;

  const decide = (state: 'granted' | 'denied') => {
    writeConsent(state);
    setVisible(false);
    if (state === 'granted') pageView(pathname);
  };

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      className="rise fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-2xl rounded-xl border border-line bg-ink-2/95 p-5 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-6"
    >
      <p className="text-sm leading-relaxed text-mist">
        <span className="text-chalk">Can we count visits?</span> Anonymous page views and which
        options get used, so we know what to improve. Never your photos, your listing details or
        your API keys — those never leave your browser at all.{' '}
        <Link href="/legal" className="text-gold hover:underline">
          More
        </Link>
      </p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => decide('granted')}
          className="flex-1 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-ink transition-opacity hover:opacity-90"
        >
          Allow
        </button>
        <button
          onClick={() => decide('denied')}
          className="flex-1 rounded-lg border border-line bg-ink-3 px-4 py-2 text-sm text-chalk transition-colors hover:border-gold/50"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}

/** Lets someone change their mind later, from the footer. */
export function ConsentReset() {
  const [state, setState] = useState<string>('unset');
  const [active, setActive] = useState(false);
  useEffect(() => {
    setState(readConsent());
    setActive(analyticsActive() && !browserSaysNo());
  }, []);
  if (!active) return null;

  return (
    <button
      onClick={() => {
        const next = state === 'granted' ? 'denied' : 'granted';
        writeConsent(next);
        setState(next);
      }}
      className="text-left hover:text-chalk"
    >
      Analytics: {state === 'granted' ? 'on' : 'off'}
    </button>
  );
}
