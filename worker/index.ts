import type { RoomConfig } from '../shared/protocol';
import { RoomDO } from './RoomDO';

export { RoomDO };

interface Env {
  ROOMS: DurableObjectNamespace;
}

/** Invite codes are user-facing, so avoid characters that get misread aloud. */
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function newCode(length = 9): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // Liveness, so tooling can check the room service is up without POSTing a
    // real room or hitting a POST-only route and logging a misleading 404.
    if (url.pathname === '/api/health') {
      return Response.json({ ok: true }, { headers: CORS });
    }

    // Mint a room. Returns the code the host shares — the door only she opens.
    //
    // NOTE ON ACCESS CONTROL: possession of the invite code is currently the only
    // credential. That is deliberate for a private gift link (no account, no
    // install is a core product requirement), and the code has ~44 bits of
    // entropy, so it is not guessable. But it is a bearer token in a URL: anyone
    // it is forwarded to can enter, and it will sit in browser history. Before
    // launch, decide whether the guest slot should be pinned to the first device
    // that claims it. Tracked in .kiro/steering/concept.md open questions.
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const config = (await request.json().catch(() => ({}))) as Partial<RoomConfig>;
      const code = newCode();
      const room = env.ROOMS.get(env.ROOMS.idFromName(code));
      await room.fetch(new Request('https://room/config', {
        method: 'PUT',
        body: JSON.stringify({
          occasion: config.occasion ?? 'birthday',
          recipient: config.recipient ?? '',
          songKey: config.songKey,
          mediaKeys: config.mediaKeys ?? [],
        } satisfies RoomConfig),
        headers: { 'Content-Type': 'application/json' },
      }));
      return Response.json({ code }, { headers: CORS });
    }

    // Everything else is scoped to a room: /api/rooms/:code/...
    const match = url.pathname.match(/^\/api\/rooms\/([a-z0-9]+)(\/.*)?$/);
    if (match) {
      const [, code, rest] = match;
      const room = env.ROOMS.get(env.ROOMS.idFromName(code));
      const forwarded = new Request(
        `https://room${rest ?? '/socket'}`,
        request,
      );
      const response = await room.fetch(forwarded);
      if (response.status === 101) return response;
      const headers = new Headers(response.headers);
      for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
      return new Response(response.body, { status: response.status, headers });
    }

    return new Response('not found', { status: 404, headers: CORS });
  },
};
