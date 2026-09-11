/**
 * Browser smoke test: does the world actually render, and does it render twice?
 *
 * Drives the installed Chrome rather than downloading a browser. Opens TWO pages
 * against the same invite code, because "two people in one place" is the product
 * and a single-page check would not exercise it.
 *
 * Evidence, not adjectives: writes screenshots to artefacts/ and reports pixel
 * statistics, console errors and the peer's reported presence.
 *
 * Requires `npm run dev` and `npm run worker:dev` to already be running.
 */
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';

const APP = process.env.POOKLET_APP ?? 'http://127.0.0.1:5173';
const API = process.env.POOKLET_API ?? 'http://127.0.0.1:8787';
const OUT = new URL('../artefacts/', import.meta.url);

let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  args: [
    // Headless Chrome needs coaxing to give us a GPU context at all.
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
    // Make getUserMedia succeed without a real microphone.
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

async function openParticipant(name, url) {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 640 },
    permissions: ['microphone'],
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  const missing = [];
  page.on('response', (res) => {
    if (res.status() === 404) missing.push(res.url());
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return { name, page, context, errors, missing };
}

/**
 * Exercise the MOBILE tier. It is the primary target, so it is what should be
 * checked by default — and two desktop-tier pages rendering the full foliage
 * budget under SwiftShader is slower than this harness can wait for.
 * Set POOKLET_TIER to override.
 */
const TIER = process.env.POOKLET_TIER ?? 'mobile';
const entryUrl = `${APP}/?tier=${TIER}`;

// --- Host mints the room by visiting with no code ----------------------------
const host = await openParticipant('host', entryUrl);
await host.page.click('#enter');
// Give the renderer time to init and the socket to settle.
await host.page.waitForTimeout(6000);

const shareUrl = host.page.url();
const code = new URL(shareUrl).searchParams.get('r');
check('host got an invite code in the URL', Boolean(code), code ?? 'none');

// --- Guest joins the same room ----------------------------------------------
const guest = await openParticipant('guest', shareUrl);
await guest.page.click('#enter');
await guest.page.waitForTimeout(6000);

// --- Did anything actually draw? --------------------------------------------
/**
 * Asks the app to sample its own framebuffer from inside the render loop.
 *
 * Reading the canvas from outside returns blank once the frame is composited —
 * that gave a false "nothing rendered" result on the first run while the
 * screenshot clearly showed a rendered scene. Measure where the pixels are live.
 */
async function canvasStats(page) {
  await page.evaluate(() => {
    window.__pookletProbe = undefined;
    window.__pookletWantProbe = true;
  });
  // Generous: two pages each rendering the full foliage budget under SwiftShader
  // is genuinely slow, and a short timeout here reads as "nothing rendered".
  await page.waitForFunction(() => window.__pookletProbe !== undefined, null, {
    timeout: 30000,
  });
  return page.evaluate(() => window.__pookletProbe);
}

for (const participant of [host, guest]) {
  const stats = await canvasStats(participant.page);
  check(`${participant.name}: canvas is sized`, Boolean(stats && stats.width > 0), stats ? `${stats.width}x${stats.height}` : 'no canvas');
  check(
    `${participant.name}: scene drew something`,
    Boolean(stats && stats.nonBlackRatio > 0.5),
    stats ? `${(stats.nonBlackRatio * 100).toFixed(1)}% lit` : '',
  );
  check(
    `${participant.name}: image has real variation`,
    Boolean(stats && stats.distinctColours > 12),
    stats ? `${stats.distinctColours} colour buckets` : '',
  );

  const status = await participant.page.textContent('#status');
  console.log(`        ${participant.name} status: "${status?.trim()}"`);

  await participant.page.screenshot({
    path: new URL(`${participant.name}.png`, OUT).pathname,
  });
}

// --- Did they see each other? ----------------------------------------------
const hostStatus = (await host.page.textContent('#status'))?.trim() ?? '';
// A connected WebRTC peer connection is itself proof the other person arrived and
// that signalling relayed both ways, which is a stronger signal than the arrival
// notice — that gets overwritten in the status line by the voice state.
check(
  'the two of them are connected',
  /hear each other/i.test(hostStatus),
  hostStatus,
);

// --- Console health ---------------------------------------------------------
for (const participant of [host, guest]) {
  // A 404 surfaces as a generic console error, so report the URLs rather than
  // filtering the noise and losing the cause.
  if (participant.missing.length > 0) {
    console.log(`        ${participant.name} 404s: ${[...new Set(participant.missing)].join(', ')}`);
  }
  const real = participant.errors.filter(
    (e) =>
      // Expected in headless: no real audio device, no GPU adapter, and the
      // favicon we have not drawn yet.
      !/getUserMedia|microphone|Permission|WebGPU|GPUAdapter|gpu|favicon|404/i.test(e),
  );
  check(`${participant.name}: no unexpected console errors`, real.length === 0, real.slice(0, 2).join(' | '));
}

await writeFile(
  new URL('smoke-report.json', OUT),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      app: APP,
      api: API,
      code,
      hostErrors: host.errors,
      guestErrors: guest.errors,
    },
    null,
    2,
  ),
);

await browser.close();
console.log(`\nscreenshots in artefacts/  •  ${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
