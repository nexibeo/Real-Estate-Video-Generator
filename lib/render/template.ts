/**
 * Scene style template packs — PROJECT.md §7.4, drawn straight onto the canvas.
 *
 * The spec called for HTML/CSS overlays rendered by headless Chrome. On the
 * client that machinery is unnecessary: the canvas is already there, and
 * drawing the overlays directly keeps the whole render in one pass with no
 * server round trip. The tradeoff is that layout is code rather than CSS, so
 * the packs are kept deliberately simple.
 *
 * Fonts are system stacks on purpose. A webfont that has not finished loading
 * renders as a fallback mid-video, and one wrong frame is worse than plainer type.
 */
import type { Aspect, TemplatePack } from '../types';

export interface Pack {
  name: string;
  display: string;
  body: string;
  ink: string;
  paper: string;
  accent: string;
  labelStyle: 'bar' | 'plate' | 'chunky';
  uppercaseLabels: boolean;
}

export const PACKS: Record<TemplatePack, Pack> = {
  clean_minimal: {
    name: 'Clean Minimal',
    display: '600 {size}px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
    body: '400 {size}px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
    ink: '#0F1419', paper: '#FFFFFF', accent: '#C8A24A',
    labelStyle: 'bar', uppercaseLabels: true,
  },
  luxury_serif: {
    name: 'Luxury Serif',
    display: '400 {size}px Georgia, "Times New Roman", serif',
    body: '400 {size}px Georgia, "Times New Roman", serif',
    ink: '#1A1712', paper: '#F7F3EC', accent: '#B08D57',
    labelStyle: 'plate', uppercaseLabels: false,
  },
  bold_social: {
    name: 'Bold Social',
    display: '800 {size}px "Helvetica Neue", Helvetica, Arial, sans-serif',
    body: '700 {size}px "Helvetica Neue", Helvetica, Arial, sans-serif',
    ink: '#FFFFFF', paper: '#101010', accent: '#FFE04D',
    labelStyle: 'chunky', uppercaseLabels: true,
  },
};

/** Fractions of frame height kept clear of platform UI — PROJECT.md §7.6. */
export const SAFE: Record<Aspect, { top: number; bottom: number }> = {
  '9:16': { top: 0.14, bottom: 0.2 },
  '16:9': { top: 0.06, bottom: 0.1 },
};

export const font = (spec: string, size: number) => spec.replace('{size}', String(Math.round(size)));

/** 0 at the edges, 1 in the middle — used to fade every overlay in and out. */
export function envelope(t: number, inS: number, outS: number, durationS: number): number {
  const fadeIn = Math.min(1, t / inS);
  const fadeOut = Math.min(1, (durationS - t) / outS);
  return Math.max(0, Math.min(fadeIn, fadeOut));
}

export function roundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Wrap text to a pixel width. Canvas has no layout engine, so this is on us. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (ctx.measureText(candidate).width > maxW && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) return lines;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

/** A soft dark gradient so light text stays readable over a bright photo. */
export function scrim(ctx: CanvasRenderingContext2D, w: number, h: number, from: number, strength = 0.65) {
  const g = ctx.createLinearGradient(0, h * from, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, h * from, w, h * (1 - from));
}
