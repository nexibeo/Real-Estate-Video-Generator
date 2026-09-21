'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { pageView, readConsent, applyConsent } from '@/lib/analytics';

/**
 * Client-side navigations never reload the page, so gtag never sees them on
 * its own. This reports each route change, and nothing at all until the
 * visitor has said yes.
 */
export function AnalyticsPageViews() {
  const pathname = usePathname();

  useEffect(() => {
    const state = readConsent();
    if (state !== 'unset') applyConsent(state);
    if (state === 'granted') pageView(pathname);
  }, [pathname]);

  return null;
}
