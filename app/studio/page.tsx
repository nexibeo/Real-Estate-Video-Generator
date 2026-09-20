'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Uploader } from '@/components/studio/Uploader';
import { ShotCard } from '@/components/studio/ShotCard';
import { loadKeys, keyHeaders } from '@/lib/keys';
import { guessRoomFromName } from '@/lib/photos';
import { planShots } from '@/lib/planner';
import { buildPrompt } from '@/lib/prompts';
import { VIDEO_MODELS } from '@/lib/replicate';
import { estimate, fmtUsd } from '@/lib/pricing';
import { render, outputExtension, type RenderShot } from '@/lib/render/engine';
import { ROOM_LABELS, type RoomType } from '@/lib/taxonomy';
import {
  DEFAULT_OPTIONS, EMPTY_LISTING,
  type Analysis, type Aspect, type Duration, type JobOptions,
  type Listing, type NarrationStyle, type Photo, type Shot, type TemplatePack,
} from '@/lib/types';

type Phase = 'idle' | 'classifying' | 'scripting' | 'generating' | 'rendering';

export default function Studio() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [listing, setListing] = useState<Listing>(EMPTY_LISTING);
  // Pre-ticked, as specified. The attestation is recorded either way; see /legal.
  const [attested, setAttested] = useState(true);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [options, setOptions] = useState<JobOptions>(DEFAULT_OPTIONS);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [outputs, setOutputs] = useState<{ aspect: Aspect; url: string; ext: string; size: number }[]>([]);
  const voices = useRef<Map<string, ArrayBuffer>>(new Map());
  const hookVoice = useRef<ArrayBuffer | undefined>(undefined);

  const isFree = options.videoModel === 'kenburns';
  const enabled = shots.filter((s) => s.enabled);
  const est = useMemo(
    () => estimate(
      { videoModel: options.videoModel, durationS: options.durationS, narrationStyle: options.narrationStyle, tier: options.tier },
      photos.length, enabled.length),
    [options, photos.length, enabled.length],
  );

  const photoById = useCallback((id: string) => photos.find((p) => p.id === id), [photos]);
  const analysisFor = useCallback((id: string) => analyses.find((a) => a.photoId === id), [analyses]);

  function reset(next: Photo[]) {
    setShots([]);
    setAnalyses([]);
    setOutputs([]);
    voices.current.clear();
    setPhotos(next);
  }

  // ── Rooms ───────────────────────────────────────────────────────────────

  async function classify() {
    setError('');
    setPhase('classifying');
    const keys = loadKeys();
    const headers = { 'Content-Type': 'application/json', ...keyHeaders(keys) };
    const found: Analysis[] = [];

    try {
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        setStatus(`Reading photo ${i + 1} of ${photos.length}`);
        setProgress((i + 1) / photos.length);
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers,
          body: JSON.stringify({ photoId: p.id, dataUrl: p.dataUrl, caption: p.name }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? 'Classification failed');
        found.push(d as Analysis);
        setAnalyses([...found]);
      }
      buildShots(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Classification failed');
    } finally {
      setPhase('idle');
      setStatus('');
      setProgress(0);
    }
  }

  /** Free tier: no vision model, so the filename guesses and the user corrects. */
  function labelManually() {
    const guessed: Analysis[] = photos.map((p) => ({
      photoId: p.id,
      description: p.name,
      visibleFeatures: [],
      lighting: '',
      roomType: guessRoomFromName(p.name) as RoomType,
      confidence: 1,
      probabilities: {},
      depth: 'wide',
      depthConfidence: 1,
      axis: 'centred',
      peoplePresent: 0,
      isPhotograph: 1,
      suitability: 1.5,
      needsReview: false,
      model: 'filename',
    }));
    setAnalyses(guessed);
    buildShots(guessed);
  }

  function buildShots(from: Analysis[]) {
    const { shots: planned } = planShots(from, photos, {
      maxClips: options.maxClips,
      durationS: options.durationS,
      expectedBedrooms: Number(listing.beds) || undefined,
    });
    setShots(planned);
  }

  function patchShot(id: string, patch: Partial<Shot>) {
    setShots((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      const next = { ...s, ...patch };
      if (patch.roomType && patch.roomType !== s.roomType) {
        const a = analysisFor(s.photoId);
        next.prompt = buildPrompt({
          roomType: patch.roomType, durationS: next.durationS,
          depth: a?.depth, axis: a?.axis, peoplePresent: (a?.peoplePresent ?? 0) > 0.5,
        });
        next.clipStatus = 'pending';
        next.clipUrl = undefined;
      }
      return next;
    }));
  }

  function moveShot(id: string, dir: -1 | 1) {
    setShots((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((s, k) => ({ ...s, order: k }));
    });
  }

  // ── Narration ───────────────────────────────────────────────────────────

  async function makeNarration() {
    if (options.narrationStyle === 'none') return;
    setPhase('scripting');
    setStatus('Writing the narration');
    const keys = loadKeys();
    const headers = { 'Content-Type': 'application/json', ...keyHeaders(keys) };

    const res = await fetch('/api/script', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        listing,
        style: options.narrationStyle,
        shots: enabled.map((s) => ({
          id: s.id,
          roomLabel: s.roomLabel,
          durationS: s.durationS,
          description: analysisFor(s.photoId)?.description ?? s.roomLabel,
        })),
      }),
    });
    const script = await res.json();
    if (!res.ok) throw new Error(script.error ?? 'Could not write the script');

    const byId = new Map<string, string>(
      (script.beats ?? []).map((b: { shotId: string; text: string }) => [b.shotId, b.text]),
    );
    setShots((prev) => prev.map((s) => ({ ...s, narration: byId.get(s.id) ?? s.narration })));

    // Speak every line. The free Fish Audio tier costs nothing, so it is the default.
    const lines: { key: string; text: string }[] = [];
    if (script.hook) lines.push({ key: '__hook', text: script.hook });
    for (const s of enabled) {
      const text = byId.get(s.id);
      if (text) lines.push({ key: s.id, text });
    }

    for (let i = 0; i < lines.length; i++) {
      setStatus(`Speaking line ${i + 1} of ${lines.length}`);
      setProgress((i + 1) / lines.length);
      const r = await fetch('/api/tts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: lines[i].text, free: true, voice: options.ttsVoice }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? 'Voice generation failed');
      }
      const buf = await r.arrayBuffer();
      if (lines[i].key === '__hook') hookVoice.current = buf;
      else voices.current.set(lines[i].key, buf);
    }
  }

  // ── Clips ───────────────────────────────────────────────────────────────

  async function makeClips() {
    if (isFree) return;
    setPhase('generating');
    const keys = loadKeys();
    const headers = { 'Content-Type': 'application/json', ...keyHeaders(keys) };
    const model = VIDEO_MODELS[options.videoModel];

    for (let i = 0; i < enabled.length; i++) {
      const shot = enabled[i];
      if (shot.clipStatus === 'done') continue;
      setStatus(`Generating ${shot.roomLabel} — ${i + 1} of ${enabled.length}`);
      setProgress(i / enabled.length);
      patchShot(shot.id, { clipStatus: 'running' });

      try {
        const photo = photoById(shot.photoId);
        if (!photo) throw new Error('Photo missing');
        const start = await fetch('/api/video', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            modelSlug: options.videoModel,
            imageUrl: photo.dataUrl,
            prompt: shot.prompt,
            durationS: Math.min(shot.durationS, model.maxDurationS),
          }),
        });
        const started = await start.json();
        if (!start.ok) throw new Error(started.error ?? 'Could not start generation');

        // The browser owns the poll loop: a serverless request must not wait
        // minutes, and the prediction id is enough state to survive a reload.
        let url: string | undefined;
        const deadline = Date.now() + 8 * 60_000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 3000));
          const poll = await fetch(`/api/video?id=${started.id}`, { headers });
          const p = await poll.json();
          if (p.status === 'succeeded') { url = p.url; break; }
          if (p.status === 'failed' || p.status === 'canceled') {
            throw new Error(p.error ?? 'Generation failed');
          }
        }
        if (!url) throw new Error('Timed out after 8 minutes');
        patchShot(shot.id, { clipStatus: 'done', clipUrl: url, predictionId: started.id });
      } catch (e) {
        patchShot(shot.id, {
          clipStatus: 'failed',
          error: e instanceof Error ? e.message : 'failed',
        });
      }
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  async function renderAll() {
    setPhase('rendering');
    const made: typeof outputs = [];

    for (const aspect of options.aspects) {
      const input = {
        listing,
        options,
        aspect,
        hookVoice: hookVoice.current,
        shots: enabled.map<RenderShot>((s) => {
          const a = analysisFor(s.photoId);
          return {
            shot: s,
            photo: photoById(s.photoId)!,
            depth: a?.depth,
            axis: a?.axis,
            clipUrl: s.clipStatus === 'done' ? s.clipUrl : undefined,
            voice: voices.current.get(s.id),
          };
        }),
      };
      const { blob, mime } = await render(input, (p) => {
        setStatus(`${aspect} — ${p.message}`);
        setProgress(p.progress);
      });
      made.push({
        aspect,
        url: URL.createObjectURL(blob),
        ext: outputExtension(mime),
        size: blob.size,
      });
      setOutputs([...made]);
    }
  }

  async function run() {
    setError('');
    setOutputs([]);
    try {
      await makeNarration();
      await makeClips();
      await renderAll();
      setStatus('Done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setPhase('idle');
      setProgress(0);
    }
  }

  const busy = phase !== 'idle';

  return (
    <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
      <h1 className="font-display text-4xl text-chalk">Studio</h1>
      <p className="mt-3 max-w-2xl text-mist">
        Photos in, tour out. Everything below happens in this browser except the model calls.
      </p>

      {/* ── 1. Photos ──────────────────────────────────────────────────── */}
      <Section n="01" title="Your photos">
        <Uploader
          photos={photos}
          onAdd={(p) => reset([...photos, ...p])}
          onRemove={(id) => reset(photos.filter((x) => x.id !== id))}
        />
      </Section>

      {/* ── 2. Listing ─────────────────────────────────────────────────── */}
      <Section n="02" title="Listing details"
               hint="Only what you enter here can be said in the voiceover. Leave a field blank and it simply goes unmentioned.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ['title', 'Property title'], ['location', 'Suburb or area'], ['price', 'Price'],
            ['beds', 'Bedrooms'], ['baths', 'Bathrooms'], ['area', 'Floor area'],
            ['agentName', 'Agent or agency'], ['agentPhone', 'Phone'], ['agentUrl', 'Website'],
          ] as [keyof Listing, string][]).map(([k, label]) => (
            <input key={k} value={listing[k]} placeholder={label}
                   onChange={(e) => setListing({ ...listing, [k]: e.target.value })}
                   className="rounded-lg border border-line bg-ink-3 px-3 py-2.5 text-sm text-chalk placeholder:text-mist/40" />
          ))}
        </div>
        <textarea value={listing.features} placeholder="Key features — one per line. Facts only; these are what the narration may mention."
                  onChange={(e) => setListing({ ...listing, features: e.target.value })}
                  rows={3}
                  className="mt-3 w-full rounded-lg border border-line bg-ink-3 px-3 py-2.5 text-sm text-chalk placeholder:text-mist/40" />

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-ink-2/60 p-4">
          <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)}
                 className="mt-0.5 h-4 w-4 accent-[#C8A24A]" />
          <span className="text-sm leading-relaxed text-mist">
            I own this property or am the authorised agent for this listing, and I have the right to
            use these photos and details to create and publish a promotional video.{' '}
            <Link href="/legal" className="text-gold hover:underline">Why this matters</Link>
          </span>
        </label>
      </Section>

      {/* ── 3. Rooms ───────────────────────────────────────────────────── */}
      <Section n="03" title="Which room is which">
        <div className="flex flex-wrap gap-3">
          <button onClick={classify} disabled={!photos.length || busy || !attested}
                  className="rounded-lg bg-gold px-5 py-2.5 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-40">
            Read the rooms automatically
          </button>
          <button onClick={labelManually} disabled={!photos.length || busy || !attested}
                  className="rounded-lg border border-line bg-ink-3 px-5 py-2.5 text-sm text-chalk transition-colors hover:border-gold/50 disabled:opacity-40">
            Label them myself — free
          </button>
        </div>
        <p className="mt-3 text-xs text-mist">
          Automatic costs about {fmtUsd(est.lines[0]?.usd ?? 0)} for {photos.length} photos: a vision
          model describes each photo, then Jev picks the room and tells you how sure it is.
        </p>
        {!attested && photos.length > 0 && (
          <p className="mt-3 rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm text-gold">
            Confirm you have the right to use these photos before continuing.
          </p>
        )}
      </Section>

      {/* ── 4. Options ─────────────────────────────────────────────────── */}
      {shots.length > 0 && (
        <Section n="04" title="How it should look">
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Engine">
                <select value={options.videoModel}
                        onChange={(e) => setOptions({ ...options, videoModel: e.target.value })}
                        className="w-full rounded-lg border border-line bg-ink-3 px-3 py-2.5 text-sm text-chalk">
                  {Object.values(VIDEO_MODELS).map((m) => (
                    <option key={m.slug} value={m.slug}>{m.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Seconds per shot">
                <div className="flex gap-2">
                  {([6, 10, 15] as Duration[]).map((d) => (
                    <button key={d}
                            onClick={() => {
                              setOptions({ ...options, durationS: d });
                              setShots((prev) => prev.map((s) => ({ ...s, durationS: d, clipStatus: 'pending' })));
                            }}
                            className={`flex-1 rounded-lg border py-2 text-sm transition-colors ${
                              options.durationS === d ? 'border-gold bg-gold/10 text-gold'
                                : 'border-line bg-ink-3 text-mist hover:text-chalk'}`}>
                      {d}s
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Resolution">
                <select value={options.resolution}
                        onChange={(e) => setOptions({ ...options, resolution: e.target.value as JobOptions['resolution'] })}
                        className="w-full rounded-lg border border-line bg-ink-3 px-3 py-2.5 text-sm text-chalk">
                  <option value="480p">480p — drafts</option>
                  <option value="720p">720p — standard</option>
                  <option value="1080p">1080p — full</option>
                </select>
              </Field>
              <Field label="Voiceover">
                <select value={options.narrationStyle}
                        onChange={(e) => setOptions({ ...options, narrationStyle: e.target.value as NarrationStyle })}
                        className="w-full rounded-lg border border-line bg-ink-3 px-3 py-2.5 text-sm text-chalk">
                  <option value="friendly_host">Friendly host</option>
                  <option value="luxury">Luxury</option>
                  <option value="investor">Investor</option>
                  <option value="none">None</option>
                </select>
              </Field>
              <Field label="Style">
                <select value={options.templatePack}
                        onChange={(e) => setOptions({ ...options, templatePack: e.target.value as TemplatePack })}
                        className="w-full rounded-lg border border-line bg-ink-3 px-3 py-2.5 text-sm text-chalk">
                  <option value="clean_minimal">Clean Minimal</option>
                  <option value="luxury_serif">Luxury Serif</option>
                  <option value="bold_social">Bold Social</option>
                </select>
              </Field>
              <Field label="Format">
                <div className="flex gap-2">
                  {(['9:16', '16:9'] as Aspect[]).map((a) => {
                    const on = options.aspects.includes(a);
                    return (
                      <button key={a}
                              onClick={() => setOptions({
                                ...options,
                                aspects: on
                                  ? (options.aspects.length > 1 ? options.aspects.filter((x) => x !== a) : options.aspects)
                                  : [...options.aspects, a],
                              })}
                              className={`flex-1 rounded-lg border py-2 text-sm transition-colors ${
                                on ? 'border-gold bg-gold/10 text-gold' : 'border-line bg-ink-3 text-mist hover:text-chalk'}`}>
                        {a}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-mist sm:col-span-2">
                <input type="checkbox" checked={options.captions}
                       onChange={(e) => setOptions({ ...options, captions: e.target.checked })}
                       className="h-4 w-4 accent-[#C8A24A]" />
                Burn in captions
              </label>
            </div>

            <div className="rounded-xl border border-gold/30 bg-gold/[0.06] p-5">
              <div className="text-xs uppercase tracking-wider text-mist">This video</div>
              <div className="mt-2 font-display text-3xl text-chalk">
                {est.apiUsd === 0 ? 'Free' : fmtUsd(est.apiUsd)}
              </div>
              <div className="text-xs text-mist">
                {est.apiUsd === 0 ? 'nothing leaves your browser' : 'with your own keys'}
              </div>
              {est.chargedUsd > 0 && (
                <div className="mt-3 border-t border-line pt-3">
                  <div className="font-display text-xl text-gold">{fmtUsd(est.chargedUsd)}</div>
                  <div className="text-xs text-mist">{est.credits.toLocaleString()} credits, if you have no keys set</div>
                </div>
              )}
              <ul className="mt-4 space-y-1 text-xs text-mist">
                <li>{enabled.length} shots · {enabled.length * options.durationS}s total</li>
                <li>{options.aspects.join(' and ')} · {options.resolution}</li>
              </ul>
            </div>
          </div>
        </Section>
      )}

      {/* ── 5. Shots ───────────────────────────────────────────────────── */}
      {shots.length > 0 && (
        <Section n="05" title={`${enabled.length} shots, in order`}
                 hint="One shot per room. Change a room type and its camera move changes with it.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shots.map((s, i) => (
              <ShotCard key={s.id} shot={s} photo={photoById(s.photoId)} analysis={analysisFor(s.photoId)}
                        onChange={(patch) => patchShot(s.id, patch)}
                        onMove={(d) => moveShot(s.id, d)}
                        isFirst={i === 0} isLast={i === shots.length - 1} />
            ))}
          </div>
        </Section>
      )}

      {/* ── 6. Make it ─────────────────────────────────────────────────── */}
      {shots.length > 0 && (
        <Section n="06" title="Make the video">
          <button onClick={run} disabled={busy || !enabled.length || !attested}
                  className="rounded-lg bg-gold px-7 py-3 font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-40">
            {busy ? 'Working…' : isFree ? 'Render now — free' : `Generate and render`}
          </button>
          <p className="mt-3 text-xs text-mist">
            {isFree
              ? 'Rendering runs in real time: a 48-second video takes about 48 seconds. Keep this tab in front.'
              : 'Clips generate one at a time, then the video renders in real time. Expect a few minutes. Keep this tab in front.'}
          </p>

          {busy && (
            <div className="mt-5 rounded-xl border border-line bg-ink-2/60 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-chalk">{status}</span>
                <span className="font-mono text-mist">{Math.round(progress * 100)}%</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-3">
                <div className="h-full rounded-full bg-gold transition-all duration-300"
                     style={{ width: `${Math.max(2, progress * 100)}%` }} />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-xl border border-rust/40 bg-rust/10 p-4 text-sm text-rust">
              {error}
              {error.includes('credits') && (
                <> <Link href="/credits" className="underline">Buy credits</Link> or{' '}
                  <Link href="/settings" className="underline">add your own key</Link>.</>
              )}
            </div>
          )}

          {outputs.length > 0 && (
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {outputs.map((o) => (
                <div key={o.aspect} className="rounded-xl border border-jade/30 bg-jade/5 p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-lg text-chalk">{o.aspect}</span>
                    <span className="font-mono text-xs text-mist">
                      {(o.size / 1_000_000).toFixed(1)} MB · .{o.ext}
                    </span>
                  </div>
                  <video src={o.url} controls
                         className={`mt-3 rounded-lg bg-ink ${
                           o.aspect === '9:16' ? 'mx-auto max-h-[30rem] w-auto' : 'w-full'
                         }`} />
                  <a href={o.url} download={`${(listing.title || 'property-tour').replace(/\W+/g, '-').toLowerCase()}-${o.aspect.replace(':', 'x')}.${o.ext}`}
                     className="mt-3 block rounded-lg bg-jade/20 py-2.5 text-center text-sm text-jade transition-colors hover:bg-jade/30">
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </main>
  );
}

function Section({ n, title, hint, children }: {
  n: string; title: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <section className="mt-12 border-t border-line/70 pt-8">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="font-mono text-xs text-gold">{n}</span>
        <h2 className="font-display text-2xl text-chalk">{title}</h2>
      </div>
      {hint && <p className="-mt-3 mb-5 max-w-2xl text-sm text-mist">{hint}</p>}
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-wider text-mist">{label}</label>
      {children}
    </div>
  );
}
