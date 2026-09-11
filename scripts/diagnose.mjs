/**
 * Reproduces a first-run failure and reports the actual cause.
 *
 * Deliberately makes no assumptions about which server is up: it probes both,
 * then drives the page and prints every console line, failed request and visible
 * status message.
 */
import { chromium } from 'playwright-core';

const APP = process.env.POOKLET_APP ?? 'http://127.0.0.1:5173';
const API = process.env.POOKLET_API ?? 'http://127.0.0.1:8787';

async function probe(label, url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    console.log(`  ${label}: reachable (${res.status})`);
    return true;
  } catch (error) {
    console.log(`  ${label}: UNREACHABLE — ${error.cause?.code ?? error.name}`);
    return false;
  }
}

console.log('\nServers');
const appUp = await probe('vite  (app)   ', APP);
const apiUp = await probe('worker (api)  ', `${API}/api/health`);

if (!appUp) {
  console.log('\nThe app server is not running. Start it with: npm run dev\n');
  process.exit(1);
}

console.log('\nBrowser run');
/**
 * Without `--enable-features=Vulkan`, headless Chrome reports WebGPU, hands back a
 * valid adapter and device, and then draws nothing. That is a useful regression
 * environment for the backend fallback, so it is the default here. Set
 * POOKLET_VULKAN=1 to get a WebGPU path that actually works.
 */
const args = [
  '--enable-unsafe-webgpu',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--ignore-gpu-blocklist',
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
];
if (process.env.POOKLET_VULKAN) args.push('--enable-features=Vulkan');

const browser = await chromium.launch({ channel: 'chrome', args });

const page = await browser.newPage({ viewport: { width: 900, height: 560 } });

page.on('console', (msg) => console.log(`  [${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => console.log(`  [pageerror] ${err.message}`));
page.on('requestfailed', (req) =>
  console.log(`  [requestfailed] ${req.url()} — ${req.failure()?.errorText}`),
);
page.on('response', (res) => {
  if (res.status() >= 400) console.log(`  [http ${res.status()}] ${res.url()}`);
});

const target = process.env.POOKLET_FORCE_GL ? `${APP}/?gl=1` : APP;
console.log(`  loading ${target}`);
await page.goto(target, { waitUntil: 'domcontentloaded' });
await page.click('#enter');
await page.waitForTimeout(7000);

const status = (await page.textContent('#status'))?.trim();
const shellVisible = await page.isVisible('#shell');
const canvasSized = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return c ? `${c.width}x${c.height}` : 'no canvas';
});

// Sample from inside the render loop — reading the canvas from out here returns
// blank once the frame is composited.
await page.evaluate(() => {
  window.__pookletProbe = undefined;
  window.__pookletWantProbe = true;
});
const frame = await page
  // Generous: software rendering at desktop foliage density is very slow, and a
  // timeout here previously looked like "nothing rendered".
  .waitForFunction(() => window.__pookletProbe !== undefined, null, { timeout: 25000 })
  .then(() => page.evaluate(() => window.__pookletProbe))
  .catch(() => null);

console.log('\nResult');
console.log(`  status line : "${status}"`);
console.log(`  still on the entry screen: ${shellVisible}`);
console.log(`  canvas: ${canvasSized}`);
console.log(`  worker running: ${apiUp}`);
console.log(
  `  drew: ${frame ? `${(frame.nonBlackRatio * 100).toFixed(1)}% lit, ${frame.distinctColours} colour buckets` : 'NO FRAME SAMPLED'}`,
);

const name = process.env.POOKLET_FORCE_GL ? 'diagnose-webgl2.png' : 'diagnose.png';
await page.screenshot({ path: `artefacts/${name}` });
await browser.close();
console.log(`\nscreenshot: artefacts/${name}\n`);
