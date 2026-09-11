# Pooklet

A world built by one person, walked by two.

One partner authors a private space as a gift — the occasion, a song, photos, a
sealed letter — and receives a link. Both enter as characters, talk over live mic,
and walk a sequence of spaces that ends with a cake, a candle and the letter.

Design intent lives in `.kiro/steering/concept.md`. How work gets done lives in
`.kiro/steering/working-method.md`. Read those before changing anything — most
decisions here were settled by evidence and are recorded with their reasoning.

## Restoring on a new machine

```bash
# 1. Node 22 (the project needs >=20.19; Node 18 will not work)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.7/install.sh | bash
source ~/.nvm/nvm.sh && nvm install 22 && nvm alias default 22

# 2. Dependencies
npm install

# 3. User-level agent skills that are not in this repo (68M of example assets)
bash scripts/restore-skills.sh
```

The workspace skills in `.kiro/skills` and `.claude/skills` arrive with the clone.
Only the three.js graphics pack needs restoring.

## Running

```bash
npm run dev     # starts BOTH the Worker (:8787) and the app (:5173)
```

Open <http://localhost:5173> and click "Step inside". The `?r=<code>` that appears
in the address bar is the shareable invite — open it in a second window to be the
other participant.

If the Worker is not running the app degrades to a solo visit rather than failing,
so the garden stays walkable.

## Verifying

```bash
npm run verify        # typecheck + room protocol + two-participant browser check
npm run diagnose      # which servers are up, which backend, did pixels draw
```

`npm run verify:room` checks the Durable Object end to end — invite codes, slot
assignment, pose and signalling relay, the two-person cap, departure. 16 checks.

`npm run verify:smoke` drives two real browsers against one invite code and
confirms both render and that WebRTC voice connects. Screenshots land in
`artefacts/`.

### Useful URL overrides

| Parameter | Effect |
|---|---|
| `?r=<code>` | Join an existing room |
| `?gl=1` | Force the WebGL2 backend — what phones and Quest actually run |
| `?tier=mobile` | Force the mobile quality tier from a desktop |
| `?tier=desktop` / `?tier=vr` | Force the other tiers |

Mobile is the primary target, so `?tier=mobile` is the tier that matters most.

## Architecture

| Path | Role |
|---|---|
| `src/core/` | Renderer, backend selection, quality tiers, zone lifecycle, the single grade owner |
| `src/zones/garden/` | The Garden — grass, trees, flowers, the both-walked bloom trail |
| `src/characters/` | Body geometry, and the living layer (gaze, blink, breath, mic-driven jaw) |
| `src/net/` | Room socket client and peer-to-peer voice |
| `src/occasions/` | Occasion presets — data, never a code branch |
| `worker/` | Cloudflare Worker and the per-invite Durable Object |
| `shared/` | Wire protocol, imported by both sides so they cannot drift |

Rendering is vanilla three.js with `WebGPURenderer` and TSL shaders, relying on its
automatic WebGL2 fallback. Not React Three Fiber — see `.kiro/skills-manifest.json`
for the evidence behind that.

## Current state

Working and verified: invite links, two-person rooms on a Durable Object, live
positional voice, the zone lifecycle with full disposal, the Garden with wind-driven
grass, the both-walked bloom trail, memory motes, and a procedural bride and groom
with gaze, blink, breath and mic-driven mouth.

Not built yet: The Making (the host's authoring flow), the other four spaces, and
character selection. Roles are currently assigned by slot.

Known ceiling: everything is procedural, with no textures, no HDRI lighting and no
post-processing. Those are the next big visual step and they need assets, not code
— CC0 textures from ambientCG, HDRIs from Poly Haven, and an authored character
mesh. Licensing constraints are recorded in the concept doc under "Asset strategy".
