'use client';

/**
 * Google Analytics 4.
 *
 * Two constraints shape everything here.
 *
 * The first is that this product's whole claim is that a user's photos and
 * listing details stay on their machine. Analytics that shipped an address or
 * a property title to Google would quietly make that claim false, so the event
 * API below only accepts primitives that describe the *shape* of a job —
 * counts, tiers, engine names, durations — and never its content. There is
 * deliberately no generic `track(name, anyObject)` to reach for in a hurry.
 *
 * The second is that errors are dangerous to log. A raw message can carry an
 * API key fragment, a file path or a signed URL, so failures are reported as a
 * fixed set of reason codes and the original text never leaves the browser.
 *
 * Consent is denied until the visitor says otherwise (see ConsentBanner), which
 * is both what the EU requires and the only setting consistent with the above.
 */

export { GA_ID, GA_ENABLED } from './ga';

/**
 * True only when the tag actually loaded — i.e. a Measurement ID is set AND
 * this page is on a host that reports. The snippet defines window.gtag only in
 * that case, so its presence is the single source of truth.
 */
export function analyticsActive(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

const CONSENT_KEY = 'vmx_consent_v1';

export type ConsentState = 'granted' | 'denied' | 'unset';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/* ── Consent ──────────────────────────────────────────────────────────────── */

/**
 * Global Privacy Control and Do Not Track are honoured as a standing "no", so
 * a visitor who has already expressed a preference in their browser is never
 * asked again and never measured.
 */
export function browserSaysNo(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string };
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1';
}

export function readConsent(): ConsentState {
  if (typeof window === 'undefined') return 'unset';
  if (browserSaysNo()) return 'denied';
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : 'unset';
  } catch {
    return 'unset';
  }
}

export function writeConsent(state: Exclude<ConsentState, 'unset'>) {
  try {
    localStorage.setItem(CONSENT_KEY, state);
  } catch {
    /* private mode — the session simply stays unconsented */
  }
  applyConsent(state);
}

/** Consent Mode v2. All four signals move together; we ask for none of them by default. */
export function applyConsent(state: Exclude<ConsentState, 'unset'>) {
  if (!analyticsActive()) return;
  window.gtag!('consent', 'update', {
    analytics_storage: state,
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}

/* ── Events ───────────────────────────────────────────────────────────────── */

type Primitive = string | number | boolean;

function send(name: string, params: Record<string, Primitive> = {}) {
  if (!analyticsActive() || readConsent() !== 'granted') return;
  window.gtag!('event', name, params);
}

export function pageView(path: string) {
  // The path only ever names a route. No query string is passed, because
  // nothing on this site should be putting anything in one.
  send('page_view', { page_path: path.split('?')[0] });
}

export function photosAdded(count: number, total: number) {
  send('photos_added', { count, total });
}

export function roomsClassified(o: {
  method: 'auto' | 'manual';
  photos: number;
  shots: number;
  needsReview: number;
}) {
  send('rooms_classified', o);
}

export function renderStarted(o: {
  tier: string;
  engine: string;
  shots: number;
  duration_s: number;
  resolution: string;
  aspects: string;
  narration: string;
  captions: boolean;
  template: string;
}) {
  send('render_started', o);
}

export function renderCompleted(o: {
  engine: string;
  aspect: string;
  video_seconds: number;
  wall_seconds: number;
  megabytes: number;
  container: string;
}) {
  send('render_completed', o);
}

/**
 * The closed set of things that can go wrong. Anything not on this list is
 * reported as `unknown` rather than risking the original message.
 */
export type FailureReason =
  | 'no_key'
  | 'insufficient_credits'
  | 'provider_rejected'
  | 'generation_timeout'
  | 'generation_failed'
  | 'decode_failed'
  | 'recorder_unsupported'
  | 'aborted'
  | 'unknown';

/** Maps a thrown error to a reason code without ever forwarding its text. */
export function classifyFailure(e: unknown): FailureReason {
  const m = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase();
  if (m.includes('not enough credits')) return 'insufficient_credits';
  if (m.includes('no openrouter key') || m.includes('no replicate key')) return 'no_key';
  if (m.includes('timed out')) return 'generation_timeout';
  if (m.includes('could not decode') || m.includes('could not load')) return 'decode_failed';
  if (m.includes('mediarecorder')) return 'recorder_unsupported';
  if (m.includes('abort')) return 'aborted';
  if (/\b(4\d\d|5\d\d)\b/.test(m)) return 'provider_rejected';
  if (m.includes('generation failed')) return 'generation_failed';
  return 'unknown';
}

export function renderFailed(o: { stage: string; engine: string; reason: FailureReason }) {
  send('render_failed', o);
}

export function checkoutStarted(usd: number, credits: number) {
  send('checkout_started', { usd, credits, currency: 'USD' });
}

export function keysSaved(o: { openrouter: boolean; replicate: boolean }) {
  // Whether a key is set, never any part of the key itself.
  send('byok_keys_saved', o);
}

export function estimatorUsed(o: { engine: string; shots: number; duration_s: number }) {
  send('estimator_used', o);
}
