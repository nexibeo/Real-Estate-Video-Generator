/**
 * Same-origin proxy for generated clips.
 *
 * Drawing a cross-origin <video> onto a canvas taints it, and a tainted canvas
 * cannot be captured — which would break client-side rendering entirely. Serving
 * the clip from our own origin keeps the canvas clean.
 *
 * The host allowlist is the whole security model here: without it this is an
 * open proxy anyone could point at an internal address.
 */
import { NextResponse } from 'next/server';

const ALLOWED = [
  'replicate.delivery',
  'pbxt.replicate.delivery',
  'replicate.com',
];

export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get('url');
  if (!target) return NextResponse.json({ error: 'url required' }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: 'bad url' }, { status: 400 });
  }

  const ok = parsed.protocol === 'https:' &&
    ALLOWED.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
  if (!ok) return NextResponse.json({ error: 'host not allowed' }, { status: 403 });

  const upstream = await fetch(parsed.toString());
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'video/mp4',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
