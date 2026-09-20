/**
 * Jev — TypeSafe's decision model on OpenRouter, used here to turn one photo's
 * text description into typed, calibrated room decisions.
 *
 * Why Jev rather than asking the vision model for JSON directly: Jev returns a
 * probability for every option and a confidence for the answer. That is what
 * drives the auto / flag / review split below. A vision model's free-form JSON
 * gives a label with no honest measure of how sure it is.
 *
 * Jev is TEXT ONLY (guide: "Convert non-text first"), so the vision pass runs
 * first and Jev judges its description.
 *
 * Endpoint: POST https://openrouter.ai/api/alpha/decisions   (not /api/v1)
 */
import { ROOM_TYPES, CAMERA_DEPTHS, PRIMARY_AXES, type RoomType } from './taxonomy';
import type { VisionRead, RoomDecision } from './types';

const JEV_URL = 'https://openrouter.ai/api/alpha/decisions';
const JEV_MODEL = '~typesafe/jev-latest';

/** Guide §Using confidence: set the bar by risk, start strict. */
export const CONFIDENCE_AUTO = 0.75;
export const CONFIDENCE_FLOOR = 0.5;

interface JevChoice { choice: string; confidence: number; probabilities: Record<string, number> }
interface JevScore { score: number; confidence: number }
interface JevNoul { noul: number }

export function buildQuestions(captionHint?: string) {
  const hint = captionHint
    ? ` The listing's own caption for this photo is "${captionHint}"; treat it as a strong hint but not as proof.`
    : '';
  return {
    room_type: {
      type: 'choice',
      instructions: {
        task: 'Which room or part of the property is shown in the photograph described by `photo.description`?' + hint,
        edge_cases:
          'Judge the space the photograph is of, not what is glimpsed through a door or window. ' +
          'A kitchen visible across an open-plan room is still one open-plan space only if no wall divides them. ' +
          'A drawing or plan is never a room, however detailed.',
      },
      criteria: ROOM_TYPES,
    },
    camera_depth: {
      type: 'choice',
      instructions: 'How much of the space does the photograph described by `photo.description` take in?',
      criteria: CAMERA_DEPTHS,
    },
    primary_axis: {
      type: 'choice',
      instructions: 'Which way does the space run in the photograph described by `photo.description`?',
      criteria: PRIMARY_AXES,
    },
    people_present: {
      type: 'noul',
      instructions: 'A person, a pet, or part of a person is visible in the photograph described by `photo.description`.',
    },
    is_photograph: {
      type: 'noul',
      instructions: {
        question: 'Is the image described by `photo.description` a photograph of a real place?',
        rules: 'A drawing, floor plan, diagram, map, aerial render, text card or logo is not a photograph of a real place.',
      },
    },
    suitability: {
      type: 'score',
      instructions:
        'How well would the photograph described by `photo.description` work as the single shot representing this room in a property tour video?',
      criteria: [
        'Unusable: dark, blurred, cluttered with rubbish, or showing almost none of the room',
        'Usable: the room is recognisable and correctly exposed, but the framing is partial, tight or awkward',
        'Excellent: bright, sharp, tidy, and takes in most of the room in one well-composed frame',
      ],
    },
  };
}

export async function classifyWithJev(
  apiKey: string,
  read: VisionRead,
  captionHint?: string,
): Promise<RoomDecision> {
  // Guide §Writing the state: trim hard, name fields clearly, no instructions here.
  const state = {
    photo: {
      description: read.description,
      visible_features: read.visibleFeatures,
      lighting: read.lighting,
    },
  };

  let res: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(JEV_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: JEV_MODEL, state, questions: buildQuestions(captionHint) }),
    });
    if ([429, 503, 529].includes(res.status) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    break;
  }
  if (!res || !res.ok) {
    throw new Error(`Jev ${res?.status}: ${(await res?.text())?.slice(0, 300)}`);
  }

  const { answers, model } = (await res.json()) as {
    answers: Record<string, JevChoice & JevScore & JevNoul>;
    model: string;
  };

  const rt = answers.room_type as unknown as JevChoice;
  const depth = answers.camera_depth as unknown as JevChoice;
  const axis = answers.primary_axis as unknown as JevChoice;
  const suit = answers.suitability as unknown as JevScore;

  const sorted = Object.entries(rt.probabilities ?? {}).sort((a, b) => b[1] - a[1]);
  const runnerUp = sorted[1] ? { type: sorted[1][0], p: sorted[1][1] } : undefined;

  return {
    roomType: rt.choice as RoomType,
    confidence: rt.confidence,
    probabilities: rt.probabilities ?? {},
    runnerUp,
    depth: depth.choice as RoomDecision['depth'],
    depthConfidence: depth.confidence,
    axis: axis.choice as RoomDecision['axis'],
    peoplePresent: (answers.people_present as unknown as JevNoul).noul,
    isPhotograph: (answers.is_photograph as unknown as JevNoul).noul,
    suitability: suit.score,
    needsReview: rt.confidence < CONFIDENCE_AUTO,
    model,
  };
}

/**
 * Jev bills input only, at $0.042 per 1M tokens, and output is free.
 *
 * Measured: a six-option version of this call ran 759 input tokens for
 * $0.0000319. The real question set carries all 25 room descriptions, so this
 * allows for roughly 2k tokens. It is an estimate, and the 10x credit markup
 * absorbs a wide error — but it is the number the pricing page quotes, so it
 * is kept close.
 */
export const JEV_COST_PER_PHOTO = 0.00009;
