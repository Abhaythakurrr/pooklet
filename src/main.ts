import { App } from '@/core/App';
import { pickBackend } from '@/core/backend';

/**
 * Entry point.
 *
 * The 2D shell stays ordinary web UI — only the world is three.js. Right now this
 * is the minimum needed to get two people into the Garden together, because
 * networking and voice are the risky parts and they need proving on real devices
 * before anything else is built on top.
 *
 * The Making (the host's authoring flow) is not here yet by design.
 */

const canvas = document.querySelector<HTMLCanvasElement>('#world');
const shell = document.querySelector<HTMLDivElement>('#shell');
const enterButton = document.querySelector<HTMLButtonElement>('#enter');
const statusEl = document.querySelector<HTMLDivElement>('#status');

if (!canvas || !shell || !enterButton || !statusEl) {
  throw new Error('shell markup missing');
}

function setStatus(text: string): void {
  statusEl!.textContent = text;
}

/**
 * Always same-origin. In dev, Vite proxies /api to the worker (see vite.config.ts),
 * so there is one URL in dev and in production and no CORS surface.
 */
const API_BASE = window.location.origin;

/**
 * The invite code lives in the URL. Possession of the link is the only
 * credential, which is deliberate for a private gift — no account, no install.
 * If there is no code, we mint a room so the first visitor becomes the host.
 *
 * Returns null when the room service is unreachable, which is a normal state in
 * development if only the app server is running. The world is still explorable
 * alone in that case — see `solo` below.
 */
async function resolveRoomCode(): Promise<string | null> {
  const fromUrl = new URLSearchParams(window.location.search).get('r');
  if (fromUrl) return fromUrl;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ occasion: 'birthday', recipient: '' }),
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    // Connection refused or timed out: the worker is not running.
    return null;
  }

  if (!response.ok) return null;

  const { code } = (await response.json()) as { code: string };

  // Put it in the URL so the link is shareable and a refresh rejoins.
  const url = new URL(window.location.href);
  url.searchParams.set('r', code);
  history.replaceState({}, '', url);
  return code;
}

let app: App | null = null;

enterButton.addEventListener('click', async () => {
  enterButton.disabled = true;
  setStatus('opening the door…');

  try {
    const roomCode = await resolveRoomCode();

    if (!roomCode) {
      // Degrade rather than dead-end. The garden is worth walking alone while the
      // room service is down, and a blank screen with "Failed to fetch" told
      // nobody anything useful.
      console.warn(
        '[pooklet] The room service is not reachable, so this is a solo visit.\n' +
          'Run both servers together with:  npm run dev',
      );
    }

    // Resolve the backend before building the renderer. Async, because it really
    // requests a WebGPU adapter rather than trusting that `navigator.gpu` exists.
    const backend = await pickBackend();

    shell.hidden = true;

    app = new App({
      canvas,
      apiBase: API_BASE,
      roomCode,
      backend,
      onStatus: setStatus,
    });
    // Called straight from the click so getUserMedia and AudioContext both have
    // the user gesture they require, which mobile Safari enforces strictly.
    await app.start();

    if (roomCode) {
      console.info(`[pooklet] share this link:\n${window.location.href}`);
    }
  } catch (error) {
    shell.hidden = false;
    enterButton.disabled = false;
    const message = error instanceof Error ? error.message : String(error);
    setStatus(message);
    console.error('[pooklet] could not start', error);
  }
});

window.addEventListener('pagehide', () => app?.dispose());
