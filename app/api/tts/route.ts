/**
 * Text to speech. Returns raw MP3 bytes straight through to the browser, which
 * decodes them into the render's audio graph — the audio never touches disk.
 */
import { NextResponse } from 'next/server';
import { synthesize, FREE_TTS_MODEL, PAID_TTS_MODEL } from '@/lib/openrouter';
import { resolveKey, billed, fail } from '@/lib/api';
import { TTS_COST_PER_BEAT } from '@/lib/pricing';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { text, voice, free = true } = await req.json();
    if (!text?.trim()) throw new Error('text is required');

    const r = await resolveKey(req, 'openrouter');
    const model = free ? FREE_TTS_MODEL : PAID_TTS_MODEL;
    // The free Fish Audio model costs nothing, so it is never charged.
    const audio = free
      ? await synthesize(r.key, text, model, voice)
      : (await billed(r, TTS_COST_PER_BEAT, 'voiceover line', () => synthesize(r.key, text, model, voice))).result;
    return new NextResponse(audio, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return fail(e);
  }
}
