/**
 * The renderer. Everything below runs in the browser: no server render farm,
 * no ffmpeg, no upload of the finished file.
 *
 * How it works: a canvas is drawn frame by frame and captured as a MediaStream;
 * the voiceover is decoded into an AudioContext whose output is another
 * MediaStream track; the two tracks go into one MediaRecorder. The clock is
 * AudioContext.currentTime rather than performance.now, because the audio clock
 * is the one the recorded audio is actually on — using anything else drifts.
 *
 * The consequence worth knowing: MediaRecorder captures in real time, so a
 * 60-second video takes 60 seconds to render. That is the price of not running
 * a render farm, and for a one-listing-at-a-time tool it is the right trade.
 */
import { kenBurns, drawTransformed } from './kenburns';
import { PACKS, type Pack } from './template';
import * as ov from './overlays';
import { intentFor } from '../prompts';
import type { Aspect, JobOptions, Listing, Photo, Shot } from '../types';
import { frameSize } from '../types';
import type { CameraDepth, PrimaryAxis } from '../taxonomy';

export interface RenderShot {
  shot: Shot;
  photo: Photo;
  depth?: CameraDepth;
  axis?: PrimaryAxis;
  /** Present for AI clips; absent means render Ken Burns from the photo. */
  clipUrl?: string;
  /** MP3 bytes for this shot's narration line. */
  voice?: ArrayBuffer;
}

export interface RenderInput {
  shots: RenderShot[];
  listing: Listing;
  options: JobOptions;
  aspect: Aspect;
  hookVoice?: ArrayBuffer;
}

export interface RenderProgress {
  phase: 'loading' | 'recording' | 'paused' | 'finishing';
  message: string;
  progress: number;
}

const FPS = 30;

function pickMimeType(): string {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'video/webm';
}

export function outputExtension(mime: string): 'mp4' | 'webm' {
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm';
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode a photo'));
    img.src = src;
  });
}

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;            // the clip's own audio is never used
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('Could not load a generated clip'));
    v.src = src;
  });
}

export async function render(
  input: RenderInput,
  onProgress: (p: RenderProgress) => void,
  signal?: AbortSignal,
): Promise<{ blob: Blob; mime: string; durationS: number }> {
  const { shots, listing, options, aspect } = input;
  const pack: Pack = PACKS[options.templatePack];
  const { w, h } = frameSize(options.resolution, aspect);

  // ── Load every asset before recording starts ────────────────────────────
  // Nothing may be fetched mid-record: a stall would be captured as frozen frames.
  onProgress({ phase: 'loading', message: 'Loading photos and clips', progress: 0 });

  const audioCtx = new AudioContext();
  const assets = await Promise.all(
    shots.map(async (s, i) => {
      const media = s.clipUrl
        ? await loadVideo(`/api/proxy?url=${encodeURIComponent(s.clipUrl)}`)
        : await loadImage(s.photo.dataUrl);
      const voice = s.voice ? await audioCtx.decodeAudioData(s.voice.slice(0)) : undefined;
      onProgress({
        phase: 'loading',
        message: `Loading ${i + 1} of ${shots.length}`,
        progress: (i + 1) / shots.length,
      });
      return { ...s, media, voice };
    }),
  );
  const hook = input.hookVoice ? await audioCtx.decodeAudioData(input.hookVoice.slice(0)) : undefined;

  // ── Timeline ────────────────────────────────────────────────────────────
  // A shot never runs shorter than its narration; if the clip is short the last
  // frame is held rather than the audio being sped up (PROJECT.md §7.3).
  const segments = assets.map((a) => {
    const voiceS = a.voice?.duration ?? 0;
    const durationS = Math.max(a.shot.durationS, voiceS + 0.6);
    return { ...a, durationS };
  });
  const starts: number[] = [];
  let clock = 0;
  for (const s of segments) {
    starts.push(clock);
    clock += s.durationS;
  }
  const totalS = clock;

  // ── Canvas and streams ──────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.imageSmoothingQuality = 'high';

  const videoStream = canvas.captureStream(FPS);
  const audioDest = audioCtx.createMediaStreamDestination();
  const master = audioCtx.createGain();
  master.gain.value = 1;
  master.connect(audioDest);

  const stream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  const mime = pickMimeType();
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: h >= 1080 ? 8_000_000 : h >= 720 ? 4_500_000 : 2_000_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });

  // ── Go ──────────────────────────────────────────────────────────────────
  await audioCtx.resume();
  const t0 = audioCtx.currentTime + 0.25;   // a beat of headroom before frame 0

  if (hook) {
    const src = audioCtx.createBufferSource();
    src.buffer = hook;
    src.connect(master);
    src.start(t0 + 0.15);
  }
  segments.forEach((s, i) => {
    if (!s.voice) return;
    const src = audioCtx.createBufferSource();
    src.buffer = s.voice;
    src.connect(master);
    // Offset the first shot's line so it does not collide with the hook.
    src.start(t0 + starts[i] + (i === 0 && hook ? Math.min(hook.duration + 0.3, 1.8) : 0.3));
  });

  recorder.start(250);
  onProgress({ phase: 'recording', message: 'Rendering', progress: 0 });

  const hasIntro = Boolean(listing.title || listing.location || listing.price);
  let currentSegment = -1;

  /**
   * Keeping the recorder honest.
   *
   * requestAnimationFrame stops when a tab is hidden AND is throttled when the
   * window is merely occluded — but the AudioContext clock and the
   * MediaRecorder keep running regardless. Left alone, that records a frozen
   * canvas for as long as the user looks away: a video of the right length with
   * one frame repeated through it.
   *
   * document.hidden does not catch the occluded case, so the loop is policed by
   * what it actually needs to be true — that a frame was drawn recently. When
   * frames stop arriving the recorder and the audio clock are paused together;
   * when they resume, so is everything else. The timeline is measured from that
   * same audio clock, so nothing drifts and the only cost is wall-clock time.
   */
  let lastProgress = 0;
  let lastFrameAt = performance.now();
  let stalled = false;
  const STALL_MS = 250;

  const pause = () => {
    if (stalled) return;
    stalled = true;
    if (recorder.state === 'recording') recorder.pause();
    void audioCtx.suspend();
    onProgress({ phase: 'paused', message: 'Paused — bring this tab back to the front', progress: lastProgress });
  };

  const unpause = async () => {
    if (!stalled) return;
    await audioCtx.resume();
    if (recorder.state === 'paused') recorder.resume();
    stalled = false;
  };

  const watchdog = setInterval(() => {
    if (!stalled && performance.now() - lastFrameAt > STALL_MS) pause();
  }, 100);
  const onVisibility = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', onVisibility);

  await new Promise<void>((resolve) => {
    const frame = () => {
      lastFrameAt = performance.now();
      if (signal?.aborted) return resolve();
      if (stalled) {
        // Frames are flowing again; pick up exactly where the clock left off.
        void unpause().then(() => requestAnimationFrame(frame));
        return;
      }

      const elapsed = audioCtx.currentTime - t0;
      if (elapsed >= totalS) return resolve();

      let i = segments.findIndex((s, k) => elapsed >= starts[k] && elapsed < starts[k] + s.durationS);
      // Before t0 elapsed is negative; that is the first shot, not the last.
      if (i === -1) i = elapsed < 0 ? 0 : segments.length - 1;
      const seg = segments[i];
      const local = Math.max(0, elapsed - starts[i]);
      const t = Math.min(1, local / seg.durationS);

      if (i !== currentSegment) {
        currentSegment = i;
        if (seg.media instanceof HTMLVideoElement) {
          seg.media.currentTime = 0;
          void seg.media.play().catch(() => {});
        }
      }

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      if (seg.media instanceof HTMLVideoElement) {
        const v = seg.media;
        // The clip may be shorter than the segment; hold its final frame.
        if (v.duration && v.currentTime >= v.duration - 0.05) v.pause();
        drawTransformed(ctx, v, v.videoWidth || w, v.videoHeight || h, w, h, { scale: 1, dx: 0, dy: 0 });
      } else {
        const img = seg.media as HTMLImageElement;
        const intent = intentFor(seg.shot.roomType, seg.depth, seg.axis);
        drawTransformed(ctx, img, img.naturalWidth, img.naturalHeight, w, h, kenBurns(intent, t));
      }

      const d: ov.DrawCtx = { ctx, w, h, pack, aspect };
      // The intro card and the room label both live in the lower third, so on the
      // first shot the label waits until the card has cleared rather than
      // printing through it.
      let labelDelay = 0;
      if (i === 0) {
        ov.introCard(d, listing, local);
        ov.featureChips(d, listing, local);
        if (hasIntro) labelDelay = Math.min(3.1, seg.durationS * 0.55);
      }
      ov.roomLabel(d, seg.shot.roomLabel, local - labelDelay, seg.durationS - labelDelay);
      if (options.captions && seg.shot.narration) {
        const voiceS = seg.voice?.duration ?? Math.min(seg.durationS - 0.6, 4);
        ov.captionLine(d, seg.shot.narration, local - 0.3, voiceS + 0.4);
      }
      if (i === segments.length - 1) ov.outroCard(d, listing, local, seg.durationS);
      if (options.aiDisclosure) ov.disclosureTag(d);

      lastProgress = elapsed / totalS;
      onProgress({ phase: 'recording', message: `Rendering — ${seg.shot.roomLabel}`, progress: lastProgress });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  clearInterval(watchdog);
  document.removeEventListener('visibilitychange', onVisibility);
  await unpause();

  onProgress({ phase: 'finishing', message: 'Finishing the file', progress: 1 });
  recorder.stop();
  for (const s of segments) {
    if (s.media instanceof HTMLVideoElement) s.media.pause();
  }
  const blob = await done;
  await audioCtx.close();

  return { blob, mime, durationS: totalS };
}
