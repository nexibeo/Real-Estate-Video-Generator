/**
 * The image-to-video prompt library — PROJECT.md §6.
 *
 * Every prompt is PREFIX + motion + SUFFIX (+ duration modifier). The rule the
 * whole library exists to enforce: describe what the LENS does, never what the
 * room contains. Naming objects or rooms that aren't in the source photo is how
 * you get a model to invent them.
 */
import type { RoomType, CameraDepth, PrimaryAxis } from './taxonomy';

export const PREFIX =
  'Animate this photograph as a single continuous real-estate shot. Camera movement only — ' +
  'keep every surface, object, fixture, and light source exactly as photographed.';

export const SUFFIX =
  'Photorealistic, natural parallax, slow and steady gimbal-smooth motion, constant exposure ' +
  'and white balance. Nothing enters or leaves the frame. No new rooms, doorways, furniture, ' +
  'or objects appear. No people, no pets, no moving reflections. No cuts, no fades, no ' +
  'transitions, no speed ramps, no camera shake, no text or watermark.';

/** Longer clips travel further with the same clause, and travel is what warps. */
export const DURATION_MODIFIER: Record<number, string> = {
  6: '',
  10: 'Movement is slower and covers no more distance than a six-second version of this shot.',
  15: 'Movement is very slow and nearly imperceptible, covering no more distance than a ' +
      'six-second version of this shot; hold the final framing.',
};

export const MOTION: Record<RoomType, string> = {
  entry: 'slow forward dolly along the hallway already visible in frame, eye level, ending while the far wall is still fully in shot',
  hallway: 'slow forward dolly down the corridor already visible in frame, eye level, holding the end wall in shot throughout',
  living_room: 'very slow arc of a few degrees around the seating area already in frame, eye level, subtle parallax between the foreground furniture and the back wall',
  open_plan: 'slow forward glide along the sight line already visible in frame, holding the far end of the space in shot, no doorways entered',
  dining_room: 'very slow lateral drift of a few centimetres past the dining table already in frame, keeping the full table in shot',
  kitchen: 'slow lateral truck to the right across the counter line already in frame, cabinetry held parallel to the frame edge',
  bedroom: 'slow push-in toward the bed already in frame, stopping well before the headboard fills the frame',
  kids_room: 'slow push-in toward the centre of the room already in frame, gentle and short',
  bathroom: 'slow pan across the vanity and fixtures already visible in frame, no more than a few degrees, holding the mirror line steady',
  ensuite: 'slow pan across the fixtures already visible in frame, short and level',
  home_office: 'slow push-in toward the desk already in frame, stopping before it fills the frame',
  laundry: 'slow lateral drift across the appliances already visible in frame',
  garage: 'slow forward dolly into the bay already visible in frame, level and short',
  exterior_front: 'slow rising crane of a small distance in front of the facade as photographed, the whole building held in frame, no new sky or ground revealed',
  exterior_rear: 'slow rising crane of a small distance behind the building as photographed, the whole structure held in frame',
  balcony: 'slow forward dolly toward the railing already in frame, stopping at the railing',
  terrace: 'slow lateral drift across the terrace already visible in frame, level',
  garden: 'slow pull-back of a short distance from the vantage point as photographed, the garden edges held inside the frame',
  pool: 'slow pull-back of a short distance from the vantage point as photographed, the full pool held in frame, water surface calm',
  view: 'very slow push-in toward the horizon already visible in frame, no zoom snap',
  gym: 'slow lateral truck across the equipment already visible in frame',
  detail: 'extremely slow push-in on the detail already in frame, macro-steady, minimal movement',
  // Never generated, but the map must be total.
  floorplan: 'hold completely still',
  map: 'hold completely still',
  other: 'extremely slow push-in, minimal movement',
};

/**
 * PROJECT.md §6.3 — the preset is a default; the vision pass overrides it.
 * The wrong move on the wrong photo is where image-to-video most visibly breaks:
 * a push-in on an already-tight frame has nowhere to go, so it warps instead.
 */
export function refineMotionKey(
  roomType: RoomType,
  depth: CameraDepth | undefined,
  axis: PrimaryAxis | undefined,
): RoomType {
  if (depth === 'closeup') return 'detail';
  if (depth === 'wide' && axis === 'left_to_right') {
    const pushIns: RoomType[] = ['bedroom', 'kids_room', 'home_office', 'view'];
    if (pushIns.includes(roomType)) return 'kitchen'; // the lateral-truck clause
  }
  if (axis === 'into_frame') {
    const laterals: RoomType[] = ['kitchen', 'laundry', 'terrace', 'gym', 'dining_room'];
    if (laterals.includes(roomType)) return 'open_plan'; // the forward-glide clause
  }
  return roomType;
}

export interface PromptOptions {
  roomType: RoomType;
  durationS: number;
  depth?: CameraDepth;
  axis?: PrimaryAxis;
  peoplePresent?: boolean;
}

export function buildPrompt(o: PromptOptions): string {
  const motion = MOTION[refineMotionKey(o.roomType, o.depth, o.axis)];
  const parts = [
    PREFIX,
    motion.charAt(0).toUpperCase() + motion.slice(1) + '.',
    SUFFIX,
    o.peoplePresent ? 'Any people already in the photograph remain perfectly still.' : '',
    DURATION_MODIFIER[o.durationS] ?? DURATION_MODIFIER[6],
  ];
  return parts.filter(Boolean).join(' ');
}

/** Sent to the video model as a negative prompt where the model supports one. */
export const NEGATIVE_PROMPT =
  'warping, melting walls, bending furniture, morphing architecture, new objects appearing, ' +
  'people, text, watermark, logo, camera shake, jump cut, fade, transition, exposure shift, ' +
  'colour shift, distorted straight lines, duplicated windows';

/**
 * The same shot language, expressed as geometry instead of words.
 *
 * The free tier renders a Ken Burns move in the browser and the paid tier sends
 * a prompt to a video model. Both should produce the *same shot* for a kitchen —
 * so both read from this one map, and the two tiers stay visually consistent.
 */
export type MotionIntent =
  | 'push_in' | 'pull_back' | 'truck_left' | 'truck_right'
  | 'crane_up' | 'pan_right' | 'drift_left' | 'hold';

export const MOTION_INTENT: Record<RoomType, MotionIntent> = {
  entry: 'push_in', hallway: 'push_in', living_room: 'drift_left', open_plan: 'push_in',
  dining_room: 'drift_left', kitchen: 'truck_right', bedroom: 'push_in', kids_room: 'push_in',
  bathroom: 'pan_right', ensuite: 'pan_right', home_office: 'push_in', laundry: 'truck_right',
  garage: 'push_in', exterior_front: 'crane_up', exterior_rear: 'crane_up', balcony: 'push_in',
  terrace: 'truck_right', garden: 'pull_back', pool: 'pull_back', view: 'push_in',
  gym: 'truck_left', detail: 'push_in', floorplan: 'hold', map: 'hold', other: 'push_in',
};

export function intentFor(roomType: RoomType, depth?: CameraDepth, axis?: PrimaryAxis): MotionIntent {
  return MOTION_INTENT[refineMotionKey(roomType, depth, axis)];
}
