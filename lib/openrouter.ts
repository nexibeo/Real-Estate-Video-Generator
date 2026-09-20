/**
 * OpenRouter: the vision pass, the narration script, and text-to-speech.
 * Jev lives in ./jev.ts because it uses a different endpoint entirely.
 */
import type { Listing, NarrationStyle, VisionRead } from './types';

const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SPEECH_URL = 'https://openrouter.ai/api/v1/audio/speech';

export const VISION_MODEL = 'google/gemini-3-flash';
export const SCRIPT_MODEL = 'google/gemini-3-flash';
/** Free tier of Fish Audio's S2.1 Pro. No production latency guarantee, but it costs nothing. */
export const FREE_TTS_MODEL = 'fish-audio/s2.1-pro-free:free';
export const PAID_TTS_MODEL = 'fish-audio/s2.1-pro';

const REFERER = { 'HTTP-Referer': 'https://videamax.com', 'X-Title': 'Videamax' };

async function chat(apiKey: string, model: string, messages: unknown[], jsonSchema?: object) {
  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...REFERER },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      ...(jsonSchema ? { response_format: { type: 'json_schema', json_schema: jsonSchema } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return { text, usage: data.usage };
}

function parseJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.search(/[[{]/);
  return JSON.parse(start > 0 ? raw.slice(start) : raw) as T;
}

/**
 * Vision pass — PROJECT.md §4 Stage 3, first half.
 * Deliberately NOT asked to classify: it describes, Jev judges. Keeping the two
 * apart is what lets Jev's confidence mean something.
 */
export async function describePhoto(apiKey: string, dataUrl: string): Promise<VisionRead> {
  const { text } = await chat(apiKey, VISION_MODEL, [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text:
            'Describe this photograph of a property for someone who cannot see it. Report only what is ' +
            'actually visible — never guess at rooms beyond a doorway. Reply as JSON with exactly these keys:\n' +
            '"description": 2-3 sentences covering what kind of space it is, the furniture and fixtures in it, ' +
            'how much of the space the frame takes in, and whether the space runs away from the camera or across the frame.\n' +
            '"visibleFeatures": an array of up to 8 short noun phrases for things actually in the frame.\n' +
            '"lighting": a short phrase such as "bright daylight through a large window" or "dim, lamps on".\n' +
            'If the image is a floor plan, map, logo or text card, say so plainly in "description".',
        },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ]);
  const parsed = parseJson<Partial<VisionRead>>(text);
  return {
    description: parsed.description ?? '',
    visibleFeatures: parsed.visibleFeatures ?? [],
    lighting: parsed.lighting ?? '',
  };
}

const STYLE_BRIEF: Record<Exclude<NarrationStyle, 'none'>, string> = {
  luxury: 'Measured and sparse. Short declarative sentences. Restraint sells; never gush.',
  friendly_host: 'Warm and conversational, second person, the voice of a good host. Contractions are fine.',
  investor: 'Factual and numbers-forward. Lead with figures that are actually given. No adjectives of taste.',
};

export interface ScriptBeat { shotId: string; text: string }
export interface NarrationScript { hook: string; beats: ScriptBeat[]; cta: string }

/**
 * One call for the whole tour, not one per shot — PROJECT.md §7.2. Coherence
 * across the video matters more than per-shot cleverness, and the model can
 * only avoid repeating itself if it writes every line at once.
 */
export async function writeScript(
  apiKey: string,
  listing: Listing,
  style: Exclude<NarrationStyle, 'none'>,
  shots: { id: string; roomLabel: string; description: string; durationS: number }[],
  wordsPerSecond = 2.4,
): Promise<NarrationScript> {
  const budget = (d: number) => Math.max(4, Math.floor(d * wordsPerSecond * 0.85));
  const shotLines = shots
    .map((s) => `- id "${s.id}" | ${s.roomLabel} | ${s.durationS}s | max ${budget(s.durationS)} words | on screen: ${s.description}`)
    .join('\n');

  const facts = Object.entries(listing)
    .filter(([, v]) => String(v).trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n') || '(no listing details supplied)';

  const { text } = await chat(apiKey, SCRIPT_MODEL, [
    {
      role: 'system',
      content:
        'You write voiceover for property tour videos. You are bound by three rules that override ' +
        'every other instruction:\n' +
        '1. NEVER state a fact that is not in the supplied listing details or the on-screen description. ' +
        'No invented distances, schools, transport links, renovations, sizes or prices. A false claim in ' +
        'an advertisement puts the agent\'s licence at risk. If you have few facts, write fewer words.\n' +
        '2. NEVER reference race, religion, national origin, family status, sex or disability, and never ' +
        'imply who the property suits ("perfect for families", "great for a young couple", "safe ' +
        'neighbourhood"). This is US fair-housing law.\n' +
        '3. NEVER narrate the camera ("as we move through", "let\'s head into"). The picture does that.\n' +
        'Speak numbers naturally. One idea per beat. The beats must read as continuous prose when joined.',
    },
    {
      role: 'user',
      content:
        `Style: ${STYLE_BRIEF[style]}\n\nLISTING DETAILS:\n${facts}\n\nSHOTS IN ORDER:\n${shotLines}\n\n` +
        'Write one beat per shot, respecting each word budget exactly. Reply as JSON: ' +
        '{"hook": string, "beats": [{"shotId": string, "text": string}], "cta": string}. ' +
        'The hook is spoken over the first shot before its beat, so keep it under 12 words. ' +
        'The cta is under 8 words and must not invent a phone number or website.',
    },
  ]);

  const parsed = parseJson<NarrationScript>(text);
  // Trust nothing: clamp to budget rather than let a beat overrun its clip.
  const byId = new Map(shots.map((s) => [s.id, s]));
  parsed.beats = (parsed.beats ?? []).map((b) => {
    const shot = byId.get(b.shotId);
    if (!shot) return b;
    const words = b.text.trim().split(/\s+/);
    const max = budget(shot.durationS);
    return { ...b, text: words.length <= max ? b.text : words.slice(0, max).join(' ') };
  });
  return parsed;
}

/** Returns MP3 bytes. OpenRouter's speech endpoint replies with raw audio, not JSON. */
export async function synthesize(
  apiKey: string,
  input: string,
  model: string,
  voice: string,
): Promise<ArrayBuffer> {
  const res = await fetch(SPEECH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...REFERER },
    body: JSON.stringify({ model, input, voice, response_format: 'mp3' }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.arrayBuffer();
}
