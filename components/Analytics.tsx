import Script from 'next/script';
import { GA_ID, GA_ENABLED, GA_HOSTS, GA_ANY_HOST } from '@/lib/ga';
import { AnalyticsPageViews } from './AnalyticsPageViews';

/**
 * Loads gtag.js — but only on the production domain (see lib/ga.ts).
 *
 * This is a server component on purpose: Next only hoists a `beforeInteractive`
 * script into <head> when it is rendered from the root layout on the server.
 *
 * The host check has to happen in the browser, since the server renders the
 * same HTML for every host. So the snippet checks location.hostname first and,
 * only if it passes, sets consent to denied, configures the tag, and injects
 * the library itself. On any other host window.gtag is never defined, and
 * every helper in lib/analytics.ts quietly does nothing.
 */
export function Analytics() {
  if (!GA_ENABLED) return null;

  const snippet = `
(function () {
  var hosts = ${JSON.stringify(GA_HOSTS)};
  if (!${GA_ANY_HOST} && hosts.indexOf(location.hostname) === -1) return;

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;

  // Consent Mode v2: nothing is stored or sent until the visitor says yes.
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });
  gtag('js', new Date());
  gtag('config', '${GA_ID}', {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=${GA_ID}';
  document.head.appendChild(s);
})();`;

  return (
    <>
      <Script id="ga-init" strategy="beforeInteractive">{snippet}</Script>
      <AnalyticsPageViews />
    </>
  );
}
