/**
 * Shot planning — PROJECT.md §4 Stage 4. Pure logic, no model calls.
 */
import {
  EXCLUDED_TYPES, NARRATIVE_ORDER, ROOM_LABELS, ROOM_PRIORITY, type RoomType,
} from './taxonomy';
import { buildPrompt } from './prompts';
import type { Analysis, Duration, Photo, Shot } from './types';

/**
 * Group photos of the same PHYSICAL room, so a three-bedroom listing yields
 * bedroom_1..3 rather than one merged "bedroom".
 *
 * Jev can't see the photos, so it can't be asked whether two are the same room.
 * What it does give is a description per photo, and rooms of the same type in
 * one property differ in describable ways. A token-overlap score on the
 * description plus features separates them well enough, and anything it gets
 * wrong is one click to fix in the review grid.
 */
const STOP = new Set(['the', 'a', 'an', 'of', 'with', 'and', 'in', 'on', 'is', 'are', 'to', 'this',
  'that', 'it', 'room', 'photo', 'photograph', 'image', 'shows', 'showing', 'view', 'space', 'from']);

function tokens(a: Analysis): Set<string> {
  const text = `${a.description} ${a.visibleFeatures.join(' ')}`.toLowerCase();
  return new Set(text.match(/[a-z]{3,}/g)?.filter((w) => !STOP.has(w)) ?? []);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared || 1);
}

/**
 * Cluster one room type's photos into physical rooms at a given threshold.
 * Higher threshold = harder to merge = more separate rooms.
 */
function clusterOne(items: Analysis[], threshold: number): Analysis[][] {
  const clusters: { tokens: Set<string>; items: Analysis[] }[] = [];
  for (const item of [...items].sort((x, y) => y.suitability - x.suitability)) {
    const t = tokens(item);
    let best: { c: (typeof clusters)[0]; score: number } | null = null;
    for (const c of clusters) {
      const score = jaccard(t, c.tokens);
      if (score >= threshold && (!best || score > best.score)) best = { c, score };
    }
    if (best) {
      best.c.items.push(item);
      for (const tok of t) best.c.tokens.add(tok);
    } else {
      clusters.push({ tokens: t, items: [item] });
    }
  }
  return clusters.map((c) => c.items);
}

export function groupByRoom(
  analyses: Analysis[],
  threshold = 0.34,
  expectedBedrooms?: number,
): Map<string, Analysis[]> {
  const groups = new Map<string, Analysis[]>();
  const byType = new Map<RoomType, Analysis[]>();
  for (const a of analyses) {
    if (!byType.has(a.roomType)) byType.set(a.roomType, []);
    byType.get(a.roomType)!.push(a);
  }

  for (const [type, items] of byType) {
    // Types that can only exist once in a property never split.
    const singleton = !['bedroom', 'bathroom', 'ensuite', 'kids_room', 'balcony', 'detail'].includes(type);
    if (singleton) {
      groups.set(`${type}_1`, items);
      continue;
    }
    let clusters = clusterOne(items, threshold);

    /**
     * Two bedrooms in one house describe alike — "beige room, bed, window" —
     * so text similarity merges them and the tour silently loses a bedroom.
     * Losing a room is much worse than showing one twice, and the listing
     * already states how many there are, so where that count is known it is
     * used: tighten the threshold until the clusters agree with it.
     */
    if (type === 'bedroom' && expectedBedrooms && expectedBedrooms > clusters.length) {
      for (const t of [0.5, 0.62, 0.74, 0.86]) {
        if (clusters.length >= expectedBedrooms || clusters.length >= items.length) break;
        clusters = clusterOne(items, t);
      }
    }

    clusters.forEach((c, i) => groups.set(`${type}_${i + 1}`, c));
  }
  return groups;
}

export interface PlanOptions {
  maxClips: number;
  durationS: Duration;
  /** From the listing's "Bedrooms" field, when the user filled it in. */
  expectedBedrooms?: number;
  minSuitability?: number;
}

export function planShots(
  analyses: Analysis[],
  photos: Photo[],
  opts: PlanOptions,
): { shots: Shot[]; dropped: { photoId: string; reason: string }[] } {
  const dropped: { photoId: string; reason: string }[] = [];
  // The room type is the only hard filter. A low `isPhotograph` used to drop a
  // photo outright, which quietly threw away every new-build listing advertised
  // with architectural renders — so it now only costs a photo the hero slot.
  const usable = analyses.filter((a) => {
    if (EXCLUDED_TYPES.includes(a.roomType)) {
      dropped.push({ photoId: a.photoId, reason: `classified as ${a.roomType}` });
      return false;
    }
    return true;
  });

  const groups = groupByRoom(usable, 0.34, opts.expectedBedrooms);

  // Hero photo per group, then rank groups so the cap keeps the right rooms.
  const candidates = [...groups.entries()].map(([key, items]) => {
    const hero = items.reduce((best, x) => {
      // People warp when a still is animated, so a photo with someone in it
      // loses to a clean one of the same room even if it is otherwise better.
      // A drawing loses to a photograph for the same reason — but only loses,
      // never gets excluded: new-build listings are advertised with renders,
      // and those are legitimate source material.
      const score = (a: Analysis) => a.suitability - a.peoplePresent * 1.5 - (1 - a.isPhotograph) * 0.4;
      return score(x) > score(best) ? x : best;
    });
    const type = hero.roomType;
    const index = Number(key.split('_').pop());
    return {
      key, hero, type, index,
      rank: (hero.suitability / 2) * ROOM_PRIORITY[type],
    };
  });

  const kept = candidates.sort((a, b) => b.rank - a.rank).slice(0, opts.maxClips);
  for (const c of candidates.slice(opts.maxClips)) {
    dropped.push({ photoId: c.hero.photoId, reason: 'over the shot limit' });
  }

  // Narrative order — PROJECT.md §4 Stage 4.4.
  kept.sort((a, b) => {
    const ai = NARRATIVE_ORDER.indexOf(a.type);
    const bi = NARRATIVE_ORDER.indexOf(b.type);
    if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    return a.index - b.index;
  });

  const multi = new Map<RoomType, number>();
  for (const c of kept) multi.set(c.type, (multi.get(c.type) ?? 0) + 1);

  const shots: Shot[] = kept.map((c, i) => {
    const needsNumber = (multi.get(c.type) ?? 0) > 1;
    const photo = photos.find((p) => p.id === c.hero.photoId);
    return {
      id: `${c.key}`,
      photoId: c.hero.photoId,
      roomType: c.type,
      roomLabel: needsNumber ? `${ROOM_LABELS[c.type]} ${c.index}` : ROOM_LABELS[c.type],
      groupIndex: c.index,
      order: i,
      durationS: opts.durationS,
      prompt: buildPrompt({
        roomType: c.type,
        durationS: opts.durationS,
        depth: c.hero.depth,
        axis: c.hero.axis,
        peoplePresent: c.hero.peoplePresent > 0.5,
      }),
      enabled: true,
      narration: '',
      clipStatus: 'pending',
      ...(photo ? {} : {}),
    };
  });

  return { shots, dropped };
}
