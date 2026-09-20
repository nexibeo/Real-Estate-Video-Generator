'use client';

/**
 * BYOK key storage.
 *
 * Keys live in this browser's localStorage and are attached as headers to the
 * request that needs them. They are never written to our database, never logged,
 * and never leave this device except to the provider the key belongs to.
 *
 * localStorage is readable by any script on this origin, so this is exactly as
 * safe as the site itself — which is why the UI says so plainly rather than
 * implying the keys are encrypted.
 */
export interface Keys { openrouter: string; replicate: string }

const K = 'vmx_keys_v1';

export function loadKeys(): Keys {
  if (typeof window === 'undefined') return { openrouter: '', replicate: '' };
  try {
    const raw = localStorage.getItem(K);
    if (!raw) return { openrouter: '', replicate: '' };
    const p = JSON.parse(raw);
    return { openrouter: p.openrouter ?? '', replicate: p.replicate ?? '' };
  } catch {
    return { openrouter: '', replicate: '' };
  }
}

export function saveKeys(keys: Keys) {
  try { localStorage.setItem(K, JSON.stringify(keys)); } catch { /* private mode */ }
}

export function clearKeys() {
  try { localStorage.removeItem(K); } catch { /* ignore */ }
}

/** Headers for a request, omitting any key that is not set. */
export function keyHeaders(keys: Keys): Record<string, string> {
  const h: Record<string, string> = {};
  if (keys.openrouter.trim()) h['x-openrouter-key'] = keys.openrouter.trim();
  if (keys.replicate.trim()) h['x-replicate-token'] = keys.replicate.trim();
  return h;
}
