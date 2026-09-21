/** Stage 6 — one narration script for the whole tour (PROJECT.md §7.2). */
import { NextResponse } from 'next/server';
import { writeScript } from '@/lib/openrouter';
import { resolveKey, billed, fail } from '@/lib/api';
import { SCRIPT_COST } from '@/lib/pricing';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { listing, style, shots } = await req.json();
    if (style === 'none') return NextResponse.json({ hook: '', beats: [], cta: '' });

    const r = await resolveKey(req, 'openrouter');
    const { result: script, balance } = await billed(r, SCRIPT_COST, 'narration script', () =>
      writeScript(r.key, listing, style, shots),
    );

    return NextResponse.json({ ...script, balance });
  } catch (e) {
    return fail(e);
  }
}
