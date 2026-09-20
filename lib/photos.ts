'use client';

import type { Photo } from './types';

/**
 * Read a file into a data URL, downscaled.
 *
 * Listing photos are routinely 4000px wide. At that size a dozen of them will
 * exhaust a tab's memory, and the vision call would be paying for detail no
 * room classifier needs. 1600px on the long edge is well past what either the
 * classifier or a 1080p frame can use.
 */
const MAX_EDGE = 1600;

export async function readPhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return {
    id: `p_${Math.random().toString(36).slice(2, 10)}`,
    name: file.name,
    dataUrl: canvas.toDataURL('image/jpeg', 0.86),
    width: w,
    height: h,
  };
}

/**
 * A free guess at the room from the filename, for the tier with no vision model.
 * Photographers name files "kitchen-02.jpg" more often than you would expect,
 * and when they don't this costs nothing and the user fixes it in one click.
 */
const HINTS: [RegExp, string][] = [
  [/front|facade|exterior|street|elevation/i, 'exterior_front'],
  [/rear|back(yard)?|garden|lawn/i, 'garden'],
  [/pool|swim/i, 'pool'],
  [/kitchen|cook/i, 'kitchen'],
  [/living|lounge|sitting|family/i, 'living_room'],
  [/dining|dinner/i, 'dining_room'],
  [/master|primary|bed(room)?/i, 'bedroom'],
  [/ensuite|en-suite/i, 'ensuite'],
  [/bath|shower|wc|toilet/i, 'bathroom'],
  [/office|study|desk/i, 'home_office'],
  [/hall|entry|foyer|entrance/i, 'entry'],
  [/balcon/i, 'balcony'],
  [/terrace|patio|deck/i, 'terrace'],
  [/garage|carport/i, 'garage'],
  [/laundry|utility/i, 'laundry'],
  [/gym|fitness/i, 'gym'],
  [/view|vista|panorama/i, 'view'],
  [/plan|floorplan/i, 'floorplan'],
];

export function guessRoomFromName(name: string): string {
  for (const [re, type] of HINTS) if (re.test(name)) return type;
  return 'living_room';
}
