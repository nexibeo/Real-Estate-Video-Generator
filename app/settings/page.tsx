'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadKeys, saveKeys, clearKeys, type Keys } from '@/lib/keys';
import { keysSaved } from '@/lib/analytics';

export default function Settings() {
  const [keys, setKeys] = useState<Keys>({ openrouter: '', replicate: '' });
  const [saved, setSaved] = useState(false);
  const [reveal, setReveal] = useState(false);

  useEffect(() => { setKeys(loadKeys()); }, []);

  function save() {
    saveKeys(keys);
    // Whether each key is present, never any part of its value.
    keysSaved({
      openrouter: Boolean(keys.openrouter.trim()),
      replicate: Boolean(keys.replicate.trim()),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  const mask = (s: string) => (s.length > 10 ? `${s.slice(0, 6)}${'•'.repeat(18)}${s.slice(-4)}` : s);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-20 pt-16">
      <h1 className="font-display text-4xl text-chalk">Your API keys</h1>
      <p className="mt-4 leading-relaxed text-mist">
        Add your own keys and you pay OpenRouter and Replicate directly, at their prices, with
        nothing added. Leave them empty and the studio spends credits instead.
      </p>

      <div className="mt-8 rounded-xl border border-line bg-ink-2/60 p-6">
        <label className="block text-sm font-medium text-chalk">OpenRouter API key</label>
        <p className="mt-1 text-xs text-mist">
          Used for reading the photos, the Jev room decisions, the narration script and the voice.
          Get one at{' '}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-gold hover:underline">
            openrouter.ai/keys
          </a>.
        </p>
        <input
          type={reveal ? 'text' : 'password'}
          value={reveal ? keys.openrouter : keys.openrouter && !reveal ? mask(keys.openrouter) : keys.openrouter}
          onChange={(e) => setKeys({ ...keys, openrouter: e.target.value })}
          onFocus={() => setReveal(true)}
          placeholder="sk-or-v1-..."
          spellCheck={false}
          className="mt-3 w-full rounded-lg border border-line bg-ink-3 px-3.5 py-2.5 font-mono text-sm text-chalk placeholder:text-mist/40"
        />

        <label className="mt-7 block text-sm font-medium text-chalk">Replicate API token</label>
        <p className="mt-1 text-xs text-mist">
          Used only for turning a photo into a moving clip. Not needed for the free Ken Burns tier.
          Get one at{' '}
          <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noreferrer" className="text-gold hover:underline">
            replicate.com/account/api-tokens
          </a>.
        </p>
        <input
          type={reveal ? 'text' : 'password'}
          value={keys.replicate}
          onChange={(e) => setKeys({ ...keys, replicate: e.target.value })}
          onFocus={() => setReveal(true)}
          placeholder="r8_..."
          spellCheck={false}
          className="mt-3 w-full rounded-lg border border-line bg-ink-3 px-3.5 py-2.5 font-mono text-sm text-chalk placeholder:text-mist/40"
        />

        <div className="mt-7 flex items-center gap-3">
          <button onClick={save}
                  className="rounded-lg bg-gold px-5 py-2.5 font-medium text-ink transition-opacity hover:opacity-90">
            Save keys
          </button>
          <button onClick={() => { clearKeys(); setKeys({ openrouter: '', replicate: '' }); }}
                  className="rounded-lg border border-line px-5 py-2.5 text-mist transition-colors hover:text-chalk">
            Clear
          </button>
          {saved && <span className="text-sm text-jade">Saved to this browser</span>}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-ink-2/40 p-6 text-sm leading-relaxed text-mist">
        <h2 className="font-display text-lg text-chalk">Where these go</h2>
        <p className="mt-3">
          Into this browser&apos;s localStorage, and onto the requests that need them as headers.
          They are never stored on our side, never logged, and never sent anywhere except the
          provider they belong to.
        </p>
        <p className="mt-3">
          That does mean any script running on this page could read them, which is true of every
          site that stores a key in a browser. If that is not acceptable for your key,{' '}
          <Link href="/credits" className="text-gold hover:underline">use credits</Link> instead and
          the key stays on our server rather than yours.
        </p>
      </div>
    </main>
  );
}
