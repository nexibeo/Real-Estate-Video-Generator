/**
 * Ken Burns — the free tier's camera move, computed per frame.
 *
 * It is not a fallback for AI video so much as a different honest product: a
 * real photograph moved with a real camera path, with no chance of a melting
 * wall. For a lot of listings that is the better output.
 */
import type { MotionIntent } from '../prompts';

export interface Transform { scale: number; dx: number; dy: number }

/** Ease in and out, so the move starts and stops like a gimbal rather than a slide. */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * `t` is 0..1 across the clip. Amounts are deliberately small — the same
 * restraint the prompt library applies, for the same reason: travel is what
 * reveals that there is no real parallax in a still.
 */
export function kenBurns(intent: MotionIntent, t: number): Transform {
  const e = ease(Math.min(1, Math.max(0, t)));
  const base = 1.06;          // always slightly over-scanned so panning has room
  const zoom = 0.1;           // total scale travel
  const pan = 0.045;          // fraction of frame travelled sideways or vertically

  switch (intent) {
    case 'push_in':    return { scale: base + zoom * e, dx: 0, dy: 0 };
    case 'pull_back':  return { scale: base + zoom * (1 - e), dx: 0, dy: 0 };
    case 'truck_right':return { scale: base + zoom * 0.35, dx: -pan * (e - 0.5) * 2, dy: 0 };
    case 'truck_left': return { scale: base + zoom * 0.35, dx: pan * (e - 0.5) * 2, dy: 0 };
    case 'drift_left': return { scale: base + zoom * 0.5 * e, dx: pan * 0.6 * e, dy: 0 };
    case 'pan_right':  return { scale: base + zoom * 0.25, dx: -pan * 0.7 * e, dy: 0 };
    case 'crane_up':   return { scale: base + zoom * 0.5 * e, dx: 0, dy: pan * 0.8 * e };
    case 'hold':
    default:           return { scale: base, dx: 0, dy: 0 };
  }
}

/**
 * Draw an image into the frame with the transform applied, cover-fitted.
 * Cover rather than contain: letterboxing a property photo looks like a mistake,
 * and the over-scan is what gives the pan somewhere to go.
 */
export function drawTransformed(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  frameW: number,
  frameH: number,
  tf: Transform,
) {
  const coverScale = Math.max(frameW / srcW, frameH / srcH) * tf.scale;
  const w = srcW * coverScale;
  const h = srcH * coverScale;
  const x = (frameW - w) / 2 + tf.dx * frameW;
  const y = (frameH - h) / 2 + tf.dy * frameH;
  ctx.drawImage(src, x, y, w, h);
}
