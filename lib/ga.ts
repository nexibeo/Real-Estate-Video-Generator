/**
 * Google Analytics configuration. No 'use client' here, so server components
 * can read it too — a constant exported from a client module is only a
 * reference on the server side, not a value.
 *
 * The Measurement ID is committed rather than left to an env var, because a
 * Measurement ID is public by design (it sits in every page's source) and this
 * way any deploy of the repo is measured without extra setup.
 *
 * But this repository is public, so the ID alone would mean every clone and
 * every `npm run dev` reports into the production property. So measurement
 * switches on only when the page is actually served from one of GA_HOSTS.
 * Anywhere else the tag never loads and nothing is sent — no pollution from
 * localhost, previews or forks.
 */
export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-JF6W1HVEDC';
export const GA_ENABLED = /^G-[A-Z0-9]+$/i.test(GA_ID);

/** Hostnames that report. Set NEXT_PUBLIC_GA_ANY_HOST=1 to measure anywhere (testing only). */
export const GA_HOSTS = ['videamax.com', 'www.videamax.com'];
export const GA_ANY_HOST = process.env.NEXT_PUBLIC_GA_ANY_HOST === '1';
