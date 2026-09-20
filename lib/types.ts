import type { RoomType, CameraDepth, PrimaryAxis } from './taxonomy';

export type Tier = 'free' | 'byok' | 'credits';
export type Aspect = '9:16' | '16:9';
export type Resolution = '480p' | '720p' | '1080p';
export type Duration = 6 | 10 | 15;

export interface Photo {
  id: string;
  name: string;
  dataUrl: string;        // stays in the browser; never uploaded except for a chosen shot
  width: number;
  height: number;
}

/** Output of the vision pass — plain text, because Jev cannot read images. */
export interface VisionRead {
  description: string;
  visibleFeatures: string[];
  lighting: string;
}

/** Output of the Jev decisions pass. Confidence is what makes it actionable. */
export interface RoomDecision {
  roomType: RoomType;
  confidence: number;
  probabilities: Record<string, number>;
  runnerUp?: { type: string; p: number };
  depth: CameraDepth;
  depthConfidence: number;
  axis: PrimaryAxis;
  peoplePresent: number;   // noul 0..1
  isPhotograph: number;    // noul 0..1
  suitability: number;     // score 0..2
  needsReview: boolean;
  model: string;           // which Jev version answered — log it (guide §Limits)
}

export interface Analysis extends VisionRead, RoomDecision {
  photoId: string;
}

export interface Shot {
  id: string;
  photoId: string;
  roomType: RoomType;
  roomLabel: string;       // editable: "Bedroom 2", "Primary Suite"
  groupIndex: number;
  order: number;
  durationS: Duration;
  prompt: string;
  enabled: boolean;
  narration: string;
  clipUrl?: string;
  clipStatus: 'pending' | 'running' | 'done' | 'failed' | 'kenburns';
  error?: string;
  predictionId?: string;
}

export interface Listing {
  title: string;
  location: string;
  price: string;
  beds: string;
  baths: string;
  area: string;
  features: string;
  agentName: string;
  agentPhone: string;
  agentUrl: string;
}

export const EMPTY_LISTING: Listing = {
  title: '', location: '', price: '', beds: '', baths: '', area: '',
  features: '', agentName: '', agentPhone: '', agentUrl: '',
};

export type NarrationStyle = 'luxury' | 'friendly_host' | 'investor' | 'none';
export type TemplatePack = 'clean_minimal' | 'luxury_serif' | 'bold_social';

export interface JobOptions {
  tier: Tier;
  videoModel: string;
  durationS: Duration;
  resolution: Resolution;
  aspects: Aspect[];
  maxClips: number;
  narrationStyle: NarrationStyle;
  ttsVoice: string;
  captions: boolean;
  templatePack: TemplatePack;
  aiDisclosure: boolean;
}

export const DEFAULT_OPTIONS: JobOptions = {
  tier: 'free',
  videoModel: 'kenburns',
  durationS: 6,
  resolution: '720p',
  aspects: ['9:16'],
  maxClips: 8,
  narrationStyle: 'friendly_host',
  ttsVoice: 'default',
  captions: true,
  templatePack: 'clean_minimal',
  aiDisclosure: true,
};

export const RESOLUTIONS: Record<Resolution, { w: number; h: number }> = {
  // Short edge. The long edge follows from the aspect.
  '480p': { w: 480, h: 854 },
  '720p': { w: 720, h: 1280 },
  '1080p': { w: 1080, h: 1920 },
};

export function frameSize(res: Resolution, aspect: Aspect): { w: number; h: number } {
  const short = RESOLUTIONS[res].w;
  const long = RESOLUTIONS[res].h;
  return aspect === '9:16' ? { w: short, h: long } : { w: long, h: short };
}
