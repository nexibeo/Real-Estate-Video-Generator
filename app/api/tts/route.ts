/**
 * Text to speech. Returns raw MP3 bytes straight through to the browser, which
 * decodes them into the render's audio graph — the audio never touches disk.
 */
import { NextResponse } from 'next/server';
import { synthesize, FREE_TTS_MODEL, PAID_TTS_MODEL } from '@/lib/openrouter';
import { resolveKey, charge, fail } from '@/lib/api';
import { TTS_COST_PER_BEAT } from '@/lib/pricing';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { text, voice = 'default', free = true } = await req.json();
    if (!text?.trim()) throw new Error('text is required');

    const r = await resolveKey(req, 'openrouter');
    const model = free ? FREE_TTS_MODEL : PAID_TTS_MODEL;
    if (!free) await charge(r, TTS_COST_PER_BEAT, 'voiceover line');

    const audio = await synthesize(r.key, text, model, voice);
    return new NextResponse(audio, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return fail(e);
  }
}
