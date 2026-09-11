/**
 * Occasion is DATA, never a code branch.
 *
 * The arc never changes; only the dressing does. Adding a seventh occasion must
 * mean adding a record here, not editing zone code. Any `switch` on occasion
 * type elsewhere in the codebase is wrong by construction.
 *
 * See .kiro/steering/concept.md -> "One architecture, many occasions".
 */
export type OccasionId =
  | 'birthday'
  | 'anniversary'
  | 'proposal'
  | 'wedding'
  | 'reunion'
  | 'remembrance';

export interface OccasionPreset {
  readonly id: OccasionId;
  /** Shown carved into the Gate. Never rendered as floating 2D UI. */
  readonly inscription: string;
  /**
   * Multiplies each zone's sun elevation, shifting the whole sequence earlier or
   * later in the day without touching zone code.
   */
  readonly timeOfDayShift: number;
  /** Warm/cool bias applied to sun colour, in mireds. Negative is cooler. */
  readonly warmthShift: number;
  /** Accent colour for florals, petals and the bloom trail. */
  readonly accent: number;
  /** Secondary floral colour. */
  readonly accentAlt: number;
  /** What waits in the Celebration space. */
  readonly celebrationObject: 'cake-candles' | 'tiered-cake' | 'ring-box' | 'flower-arch' | 'welcome-table' | 'lanterns';
  /** Ambient bed identifier, resolved by the audio layer. */
  readonly ambienceTone: 'playful' | 'tender' | 'still' | 'bright' | 'gentle';
}

export const OCCASIONS: Record<OccasionId, OccasionPreset> = {
  birthday: {
    id: 'birthday',
    inscription: 'Happy Birthday',
    timeOfDayShift: 0,
    warmthShift: 0,
    accent: 0xffb3c7,
    accentAlt: 0xfff1a8,
    celebrationObject: 'cake-candles',
    ambienceTone: 'playful',
  },
  anniversary: {
    id: 'anniversary',
    inscription: 'To Us',
    timeOfDayShift: -4,
    warmthShift: 12,
    accent: 0xd94f6a,
    accentAlt: 0xf0c9a8,
    celebrationObject: 'tiered-cake',
    ambienceTone: 'tender',
  },
  proposal: {
    id: 'proposal',
    inscription: 'Stay',
    timeOfDayShift: -9,
    warmthShift: -8,
    accent: 0xf6f2ea,
    accentAlt: 0xbcc9e0,
    celebrationObject: 'ring-box',
    ambienceTone: 'still',
  },
  wedding: {
    id: 'wedding',
    inscription: 'Today',
    timeOfDayShift: 10,
    warmthShift: 4,
    accent: 0xfdfbf6,
    accentAlt: 0xb7cf9a,
    celebrationObject: 'flower-arch',
    ambienceTone: 'bright',
  },
  reunion: {
    id: 'reunion',
    inscription: 'Welcome Back',
    timeOfDayShift: 12,
    warmthShift: 6,
    accent: 0xffd39b,
    accentAlt: 0xa8d5c2,
    celebrationObject: 'welcome-table',
    ambienceTone: 'bright',
  },
  remembrance: {
    id: 'remembrance',
    inscription: 'Still Here',
    timeOfDayShift: -2,
    warmthShift: -14,
    accent: 0xdfe4e8,
    accentAlt: 0xc3b6c9,
    celebrationObject: 'lanterns',
    ambienceTone: 'gentle',
  },
};

export function occasionFrom(value: string | null | undefined): OccasionPreset {
  if (value && value in OCCASIONS) return OCCASIONS[value as OccasionId];
  return OCCASIONS.birthday;
}
