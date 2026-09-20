/**
 * The overlay set: room label, intro card, feature chips, captions, outro, tag.
 * Each takes the frame, the pack and a local time, and draws nothing when its
 * envelope is zero — so the caller can just call them all, every frame.
 */
import { font, envelope, roundRect, wrap, scrim, SAFE, type Pack } from './template';
import type { Aspect, Listing } from '../types';

export interface DrawCtx {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  pack: Pack;
  aspect: Aspect;
}

const px = (h: number, frac: number) => h * frac;

export function roomLabel({ ctx, w, h, pack, aspect }: DrawCtx, label: string, t: number, clipS: number) {
  const a = envelope(t - 0.4, 0.4, 0.5, Math.max(0.1, Math.min(2.6, clipS - 0.4)));
  if (a <= 0) return;

  const size = px(h, aspect === '9:16' ? 0.032 : 0.05);
  const text = pack.uppercaseLabels ? label.toUpperCase() : label;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = font(pack.display, size);
  ctx.textBaseline = 'middle';

  const padX = size * 0.75;
  const padY = size * 0.5;
  const tw = ctx.measureText(text).width;
  const x = px(w, 0.06);
  const y = h * (1 - SAFE[aspect].bottom) - size * 1.6;

  if (pack.labelStyle === 'chunky') {
    ctx.fillStyle = pack.accent;
    roundRect(ctx, x, y - size / 2 - padY, tw + padX * 2, size + padY * 2, size * 0.18);
    ctx.fill();
    ctx.fillStyle = '#101010';
    // Slide in from the left as it fades up.
    ctx.fillText(text, x + padX + (1 - a) * -size, y);
  } else if (pack.labelStyle === 'plate') {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRect(ctx, x, y - size / 2 - padY, tw + padX * 2, size + padY * 2, 2);
    ctx.fill();
    ctx.fillStyle = pack.ink;
    ctx.fillText(text, x + padX, y);
  } else {
    ctx.fillStyle = pack.accent;
    ctx.fillRect(x, y - size * 0.62, size * 0.14, size * 1.24);
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = size * 0.4;
    ctx.fillText(text, x + size * 0.45, y);
  }
  ctx.restore();
}

export function introCard({ ctx, w, h, pack, aspect }: DrawCtx, listing: Listing, t: number) {
  const a = envelope(t - 0.2, 0.5, 0.6, 2.4);
  if (a <= 0) return;

  ctx.save();
  ctx.globalAlpha = a;
  scrim(ctx, w, h, 0.45, 0.72);

  const rise = (1 - a) * px(h, 0.02);
  const titleSize = px(h, aspect === '9:16' ? 0.046 : 0.07);
  const metaSize = px(h, aspect === '9:16' ? 0.024 : 0.036);
  const x = px(w, 0.07);
  let y = h * (1 - SAFE[aspect].bottom) - metaSize * 3.4 + rise;

  ctx.font = font(pack.display, titleSize);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  const lines = wrap(ctx, listing.title || 'Property Tour', w - x * 2, 2);
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += titleSize * 1.15;
  }

  const meta = [listing.location, listing.price].filter(Boolean).join('  ·  ');
  if (meta) {
    ctx.font = font(pack.body, metaSize);
    ctx.fillStyle = pack.accent;
    ctx.fillText(meta, x, y + metaSize * 0.4);
  }
  ctx.restore();
}

export function featureChips({ ctx, w, h, pack, aspect }: DrawCtx, listing: Listing, t: number) {
  const chips = [
    listing.beds && `${listing.beds} bed`,
    listing.baths && `${listing.baths} bath`,
    listing.area,
  ].filter(Boolean) as string[];
  if (!chips.length) return;

  const a = envelope(t - 2.6, 0.4, 0.5, 2.2);
  if (a <= 0) return;

  const size = px(h, aspect === '9:16' ? 0.022 : 0.032);
  ctx.save();
  ctx.font = font(pack.body, size);
  ctx.textBaseline = 'middle';

  const padX = size * 0.8;
  const gap = size * 0.5;
  const widths = chips.map((c) => ctx.measureText(c).width + padX * 2);
  let x = (w - (widths.reduce((s, v) => s + v, 0) + gap * (chips.length - 1))) / 2;
  const y = h * (1 - SAFE[aspect].bottom) - size * 4.6;

  chips.forEach((chip, i) => {
    // Stagger, so they land one after another rather than all at once.
    const ca = envelope(t - 2.6 - i * 0.12, 0.35, 0.5, 2.2 - i * 0.12);
    ctx.globalAlpha = Math.max(0, ca);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, x, y - size, widths[i], size * 2, size);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(chip, x + padX, y);
    x += widths[i] + gap;
  });
  ctx.restore();
}

export function captionLine(
  { ctx, w, h, pack, aspect }: DrawCtx, text: string, t: number, spanS: number,
) {
  if (!text) return;
  const a = envelope(t, 0.15, 0.2, spanS);
  if (a <= 0) return;

  const size = px(h, aspect === '9:16' ? 0.028 : 0.038);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = font(pack.body, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxW = w * 0.84;
  const lines = wrap(ctx, text, maxW, 2);
  const lineH = size * 1.32;
  // Sits above the platform's own caption bar, not under it.
  let y = h * (1 - SAFE[aspect].bottom) - lineH * lines.length - size * 0.2;

  for (const line of lines) {
    const tw = ctx.measureText(line).width;
    if (pack.labelStyle === 'chunky') {
      ctx.fillStyle = 'rgba(16,16,16,0.85)';
      roundRect(ctx, w / 2 - tw / 2 - size * 0.5, y - lineH / 2, tw + size, lineH, size * 0.2);
      ctx.fill();
      ctx.fillStyle = pack.accent;
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = size * 0.5;
    }
    ctx.fillText(line, w / 2, y);
    y += lineH;
  }
  ctx.restore();
}

export function outroCard({ ctx, w, h, pack, aspect }: DrawCtx, listing: Listing, t: number, clipS: number) {
  const start = Math.max(0, clipS - 2.4);
  const a = envelope(t - start, 0.5, 0.4, 2.4);
  if (a <= 0) return;

  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = pack.labelStyle === 'chunky' ? 'rgba(16,16,16,0.82)' : 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);

  const bigSize = px(h, aspect === '9:16' ? 0.042 : 0.06);
  const smallSize = px(h, aspect === '9:16' ? 0.024 : 0.034);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cy = h / 2 - (1 - a) * px(h, 0.015);
  ctx.font = font(pack.display, bigSize);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(listing.agentName || listing.title || 'Book a viewing', w / 2, cy - bigSize * 0.4);

  const contact = [listing.agentPhone, listing.agentUrl].filter(Boolean).join('   ·   ');
  if (contact) {
    ctx.font = font(pack.body, smallSize);
    ctx.fillStyle = pack.accent;
    ctx.fillText(contact, w / 2, cy + bigSize * 0.7);
  }
  ctx.restore();
}

/** PROJECT.md §3 — small, permanent, and on by default. */
export function disclosureTag({ ctx, w, h, aspect }: DrawCtx) {
  const size = px(h, aspect === '9:16' ? 0.013 : 0.018);
  ctx.save();
  ctx.font = font('400 {size}px -apple-system, "Segoe UI", Helvetica, sans-serif', size);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = size * 0.6;
  ctx.fillText('AI-generated visualisation', w - px(w, 0.04), h * SAFE[aspect].top * 0.55);
  ctx.restore();
}
