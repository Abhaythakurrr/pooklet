import type { ZoneParams } from '@/core/Zone';
import type { OccasionPreset } from '@/occasions/presets';

/**
 * The Garden's own parameter set. Each space has its own; nothing here is shared
 * with another zone, and the occasion preset only shifts values — it never
 * branches behaviour.
 */
export function gardenParams(occasion: OccasionPreset): ZoneParams {
  // Late afternoon, warm, but high enough that the ground actually reads. At 14
  // degrees the grazing angle left the ground nearly black while the vertical
  // foliage caught all the light — physically correct and visually dead.
  const sunElevation = 26 + occasion.timeOfDayShift;

  return {
    id: 'garden',
    title: 'The Garden',
    sunElevation,
    sunAzimuth: 118,
    sunColor: warmShift(0xffd9a8, occasion.warmthShift),
    sunIntensity: 2.4,
    skyColor: 0xbcd6ee,
    groundColor: 0x6b7a52,
    ambientIntensity: 1.15,
    exposure: 1.05,
    environmentIntensity: 0.9,
    fogColor: 0xdcc6a8,
    fogNear: 18,
    fogFar: 78,
    bounds: 20,
  };
}

/** Garden extent in metres. The trail map and ground plane are sized from this. */
export const GARDEN_EXTENT = 44;

/**
 * Where actual grass blades are planted, in metres.
 *
 * Smaller than the ground plane on purpose. Coverage is instances per square
 * metre, so spending the foliage budget across the full 44m leaves the lawn
 * visibly bald. Beyond this the ground material's turf green carries it.
 */
export const GRASS_EXTENT = 26;

/** How much of the garden must be bloomed together before the space completes. */
export const BLOOM_TARGET = 0.055;

/**
 * Nudge a colour warmer or cooler. Positive is warmer. Crude but predictable,
 * and it keeps occasion presets to a single number instead of a palette each.
 */
function warmShift(hex: number, mireds: number): number {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const k = mireds / 255;
  const nr = clamp255(r + 255 * k * 0.12);
  const nb = clamp255(b - 255 * k * 0.16);
  return (nr << 16) | (g << 8) | nb;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}
