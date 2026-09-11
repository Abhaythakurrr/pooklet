/**
 * Verifies the room Durable Object end to end against a running `wrangler dev`.
 *
 * Networking is the highest-risk part of this product, so it gets checked rather
 * than assumed. Run with the worker already listening:
 *
 *   npm run worker:dev          # in one terminal
 *   node scripts/verify-room.mjs
 */

const BASE = process.env.POOKLET_API ?? 'http://127.0.0.1:8787';
const WS_BASE = BASE.replace(/^http/, 'ws');

let failures = 0;

function check(label, condition, detail = '') {
  const mark = condition ? 'PASS' : 'FAIL';
  if (!condition) failures += 1;
  console.log(`  ${mark}  ${label}${detail ? ` — ${detail}` : ''}`);
}

/** Resolves with the next message, or rejects on timeout. */
function next(socket, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for message')), timeoutMs);
    socket.addEventListener(
      'message',
      (event) => {
        clearTimeout(timer);
        resolve(JSON.parse(event.data));
      },
      { once: true },
    );
  });
}

function open(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener('open', () => resolve(socket), { once: true });
    socket.addEventListener('error', () => reject(new Error(`could not open ${url}`)), { once: true });
  });
}

console.log('\nRoom verification\n');

// --- Mint a room -------------------------------------------------------------
const created = await fetch(`${BASE}/api/rooms`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ occasion: 'anniversary', recipient: 'her' }),
});
check('room mints', created.ok, `status ${created.status}`);
const { code } = await created.json();
check('invite code returned', typeof code === 'string' && code.length >= 8, code);

const socketUrl = `${WS_BASE}/api/rooms/${code}/socket`;

// --- First participant -------------------------------------------------------
const host = await open(socketUrl);
const hostWelcome = await next(host);
check('host gets welcome', hostWelcome.t === 'welcome');
check('host is slot 0', hostWelcome.slot === 0, `slot ${hostWelcome.slot}`);
check('host sees empty room', hostWelcome.peerPresent === false);
check('host does not offer', hostWelcome.shouldOffer === false);
check(
  'occasion config persisted',
  hostWelcome.config?.occasion === 'anniversary',
  hostWelcome.config?.occasion,
);

// --- Second participant ------------------------------------------------------
const guestJoined = next(host);
const guest = await open(socketUrl);
const guestWelcome = await next(guest);
check('guest is slot 1', guestWelcome.slot === 1, `slot ${guestWelcome.slot}`);
check('guest sees host present', guestWelcome.peerPresent === true);
check('guest initiates the offer', guestWelcome.shouldOffer === true);

const joinNotice = await guestJoined;
check('host is told she arrived', joinNotice.t === 'peer-join');

// --- Pose relay --------------------------------------------------------------
const posePromise = next(guest);
host.send(JSON.stringify({ t: 'pose', pose: { x: 1.25, z: -3.5, ry: 0.8 } }));
const relayedPose = await posePromise;
check('pose relays to peer', relayedPose.t === 'pose' && relayedPose.pose.x === 1.25);

// --- Ready gating ------------------------------------------------------------
const readyPromise = next(host);
guest.send(JSON.stringify({ t: 'ready', zone: 'garden' }));
const relayedReady = await readyPromise;
check(
  'ready gate relays',
  relayedReady.t === 'ready' && relayedReady.zone === 'garden',
);

// --- Signalling relay --------------------------------------------------------
const signalPromise = next(guest);
host.send(JSON.stringify({ t: 'signal', data: { kind: 'sdp', description: { type: 'offer' } } }));
const relayedSignal = await signalPromise;
check('webrtc signalling relays verbatim', relayedSignal.data?.kind === 'sdp');

// --- Two-person cap ----------------------------------------------------------
// Strictly two is a product decision, not a tunable. Verified with a real third
// socket: Node's fetch refuses to send an Upgrade header, so this cannot be
// checked with a plain request.
const thirdRefused = await new Promise((resolve) => {
  const socket = new WebSocket(socketUrl);
  const settle = (value) => resolve(value);
  socket.addEventListener('open', () => {
    socket.close();
    settle(false);
  }, { once: true });
  socket.addEventListener('error', () => settle(true), { once: true });
  socket.addEventListener('close', () => settle(true), { once: true });
  setTimeout(() => settle(false), 3000);
});
check('third participant refused', thirdRefused);

// --- Departure ---------------------------------------------------------------
const leavePromise = next(host);
guest.close();
const leaveNotice = await leavePromise;
check('host is told she left', leaveNotice.t === 'peer-leave');

host.close();

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
