import { PerspectiveCamera, Scene, WebGPURenderer } from 'three/webgpu';

/**
 * Decides which rendering backend to use, before the real renderer is built.
 *
 * `WebGPURenderer` falls back to WebGL2 when WebGPU is *absent*, but not when
 * WebGPU is nominally present and then fails to actually draw. That case is real
 * and it was reproduced here: a Chrome without a working Vulkan path reports
 * `navigator.gpu`, returns a valid adapter, returns a device that does not report
 * itself lost — and then renders nothing at all, with a single
 * "Instance dropped in popErrorScope" as the only clue.
 *
 * Adapter and device checks both pass in that state, so neither is sufficient.
 * The only reliable test is to render and look at the pixels, which is what this
 * does on a throwaway 8x8 canvas before committing to a backend.
 *
 * A blank screen is the worst possible failure for this product — someone opened
 * a gift and got nothing — so this pays ~100ms at startup to rule it out.
 */

export interface BackendChoice {
  readonly forceWebGL: boolean;
  /** Why, for the startup log. Diagnosing this from a screenshot is miserable. */
  readonly reason: string;
}

/** Clear colour for the probe. Any strong non-black value works. */
const PROBE_RGB = { r: 0, g: 255, b: 0 };

export async function pickBackend(): Promise<BackendChoice> {
  // Explicit override. WebGL2 is what most phones and all of Quest will run, so
  // it has to be forceable on a desktop that would otherwise pick WebGPU.
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('gl')) {
    return { forceWebGL: true, reason: 'forced by ?gl' };
  }

  if (!('gpu' in navigator)) {
    return { forceWebGL: true, reason: 'no navigator.gpu' };
  }

  try {
    const drew = await probeWebGPUDraws();
    return drew
      ? { forceWebGL: false, reason: 'webgpu verified by test render' }
      : { forceWebGL: true, reason: 'webgpu present but drew nothing' };
  } catch (error) {
    return {
      forceWebGL: true,
      reason: `webgpu probe threw: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Clears a tiny offscreen WebGPU canvas to a known colour and reads it back.
 * Uses the same renderer class the app will use, so the probe exercises the real
 * code path rather than a synthetic approximation.
 */
async function probeWebGPUDraws(): Promise<boolean> {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;

  let renderer: WebGPURenderer | null = null;
  try {
    renderer = new WebGPURenderer({ canvas, antialias: false });
    await renderer.init();
    renderer.setSize(8, 8, false);
    renderer.setClearColor(
      (PROBE_RGB.r << 16) | (PROBE_RGB.g << 8) | PROBE_RGB.b,
      1,
    );

    // An empty scene is enough — we are testing whether a clear reaches the
    // canvas, not whether geometry shades correctly.
    await renderer.renderAsync(new Scene(), new PerspectiveCamera());

    const readback = document.createElement('canvas');
    readback.width = 8;
    readback.height = 8;
    const ctx = readback.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(canvas, 0, 0);
    const { data } = ctx.getImageData(0, 0, 8, 8);

    // Any pixel meaningfully brighter than black means the clear landed.
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] > 60) return true;
    }
    return false;
  } finally {
    try {
      await renderer?.dispose();
    } catch {
      // Nothing useful to do if teardown of a broken device also fails.
    }
    canvas.remove();
  }
}
