/**
 * Quality tiers.
 *
 * Mobile is the PRIMARY target, not the fallback. An invite link gets opened on
 * a phone far more often than in a headset, so `mobile` is what most people will
 * actually see. Author against it first; treat `desktop` as the bonus.
 *
 * See .kiro/steering/concept.md -> "Platform reality".
 */
export type TierName = 'mobile' | 'desktop' | 'vr';

export interface TierBudget {
  readonly name: TierName;
  /** Device pixel ratio ceiling. Phones lie about how many pixels they can push. */
  readonly maxPixelRatio: number;
  /** Shadow map edge length, or 0 for no real-time shadows. */
  readonly shadowMapSize: number;
  /** Ambient occlusion is a desktop luxury. */
  readonly ambientOcclusion: boolean;
  /** Bloom is cheap enough to keep everywhere, but at different quality. */
  readonly bloomPasses: number;
  /** Instanced foliage count for a zone's ground cover. */
  readonly foliageBudget: number;
  /**
   * Compute-shader systems (FFT ocean cascades, GPU-culled grass) only exist on
   * the WebGPU backend. When false, zones MUST use their analytic fallback.
   */
  readonly computeAvailable: boolean;
  /** Equirect environment map edge length. */
  readonly envMapSize: number;
}

const MOBILE: TierBudget = {
  name: 'mobile',
  maxPixelRatio: 2,
  shadowMapSize: 1024,
  ambientOcclusion: false,
  bloomPasses: 3,
  // Grass clump instances. Coverage needs roughly one clump per 0.1m², so this is
  // deliberately sparse on mobile and the ground colour is tuned to read as turf
  // where blades do not reach.
  foliageBudget: 16000,
  computeAvailable: false,
  envMapSize: 1024,
};

const DESKTOP: TierBudget = {
  name: 'desktop',
  maxPixelRatio: 2,
  shadowMapSize: 2048,
  ambientOcclusion: true,
  bloomPasses: 5,
  // 28k clumps is ~1.4M vertices. Comfortable on a real GPU; note that software
  // rendering (SwiftShader in headless CI) will crawl at this level.
  foliageBudget: 34000,
  computeAvailable: true,
  envMapSize: 2048,
};

/**
 * VR is deliberately closer to mobile than to desktop. Stereo rendering roughly
 * doubles the pixel cost and the frame budget is ~11ms at 90Hz, so this is a
 * constrained tier even on capable hardware.
 */
const VR: TierBudget = {
  name: 'vr',
  maxPixelRatio: 1,
  shadowMapSize: 1024,
  ambientOcclusion: false,
  bloomPasses: 3,
  foliageBudget: 16000,
  computeAvailable: false,
  envMapSize: 1024,
};

const BUDGETS: Record<TierName, TierBudget> = {
  mobile: MOBILE,
  desktop: DESKTOP,
  vr: VR,
};

function isProbablyMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  // `maxTouchPoints` is more reliable than sniffing the UA string, which lies.
  const touch = navigator.maxTouchPoints > 1;
  const narrow = Math.min(window.screen.width, window.screen.height) < 820;
  return touch && narrow;
}

export function detectTier(hasWebGPU: boolean): TierBudget {
  // `?tier=mobile` forces the primary tier from a desktop. Mobile is what most
  // people will actually see, so it has to be previewable and testable without a
  // phone in hand — and it is the tier automated checks should exercise.
  const override = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('tier')
    : null;
  if (override === 'mobile') return MOBILE;
  if (override === 'vr') return VR;
  if (override === 'desktop') return hasWebGPU ? DESKTOP : { ...DESKTOP, computeAvailable: false };

  if (isProbablyMobile()) return MOBILE;
  // No WebGPU means no compute, which rules out the desktop systems regardless
  // of how strong the GPU is.
  if (!hasWebGPU) return { ...DESKTOP, computeAvailable: false };
  return DESKTOP;
}

export function budgetFor(name: TierName): TierBudget {
  return BUDGETS[name];
}
