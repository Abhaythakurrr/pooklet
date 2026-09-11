# Concept and Art Direction

One person builds a small world as a gift. Two people walk through it together.

This document is the source of truth for what we are making and why. Implementation decisions
should be traceable back to a line in here. If a feature does not serve the arc below, it is
probably decoration.

## The core premise

A host prepares a private world for someone they love, choosing the occasion, the song, the
memories and the words. They receive a link — a door only that person can open. When both
arrive, they enter as characters, side by side, with their real voices, and walk a path the
host laid out for them.

It ends with a cake, a candle and a letter.

The product is not a scene viewer. It is a **keepsake** — the world stays open and can be
revisited.

## Naming

Working title: **Pooklet**. Alternatives worth considering: *The Long Way Round*, *A Place For Us*.
Not settled. The name should sound like a pet name, not a platform.

## The arc

Seven beats, in a deliberate emotional order.

**Each beat is its own separate space, not a district of one continuous world.** A zone has its
own geometry, its own lighting, its own environment map, its own audio bed and its own parameter
set. You arrive, the space does its work, it reaches its completion condition, and the next space
begins. They are never simultaneously present.

This is a sequence of discrete places, not a map you roam. See "Zone architecture" for what that
means in code and for the memory budget.

### 0. The Making — host, alone, 2D

Not "setup". The host is preparing a place, and the interface should feel like that.

Collected here: the occasion and who it is for, a song that means something, images and videos,
and a letter written last and sealed. Then the invite is minted.

Tone rule: never make this feel like a form. No "Step 2 of 5" progress bars. Ask one thing at a
time, in warm language, and let the world assemble visibly as answers arrive.

### 1. The Gate — arrival, both present

The threshold. The occasion is inscribed **into the world** — carved, floral, or lit letters
worked into the arch. Never floating 2D UI text.

Both characters appear here. The first beat is simply: *you came*.

This is the first emotional peak. Nothing should be asked of the user before it lands. No
tutorial, no settings prompt, no "click to continue" overlay.

### 2. The Garden — presence

Nature, growth, unhurried. Deliberately taskless.

Purpose is physical and social, not narrative: let two people get used to having bodies near
each other, hear each other's voices, learn to walk side by side. The song is faint here,
carried on the air — a promise of what is ahead, not the thing itself.

### 3. The Café — the song

Interior warmth. Two chairs. The uploaded song plays here properly, with room ambience around it.

Critical detail: the song must feel like it is being played *by the room*, not by the app. It
occupies space, it is quieter near the door, it competes slightly with the ambience. This is the
"sit with me" beat.

### 4. The Reel Room — the memories

The uploaded images and videos. A private screening, not a slideshow. Two seats, warm projector
spill, the screen lighting both faces.

This is the emotional core of the middle. The host's chosen memories, watched together.

**The media is environmental, not a player.** Explicitly not 360 video — a flat screen in a real
room. But the screen is not a rectangle pasted on a wall that happens to be showing something.
It is the room's light source, and the room answers to it:

- The screen drives real lighting. Downsample the current video frame to a tiny texture and use it
  to drive light colour and intensity, so a warm sunset shot washes the room warm and a dark shot
  lets the room fall dark.
- That light lands on both characters' faces and on the seats, walls and floor. When the memory
  changes, the colour on her face changes.
- A faint volumetric shaft from the projector, with dust in it.
- Bloom and reflections carry the screen onto surfaces.
- Audio from the media plays into the room's acoustic, not into the headset.

The test: with the screen blacked out, the room should look obviously wrong — underlit and dead.
If the room looks fine without the media, the media is not environmental.

This principle generalises. Uploaded content should always affect its space rather than sit inside
it: the song colours the café, the memories light the Reel Room.

### 5. The Shore — the exhale

Ocean, dusk, horizon. Contains no content whatsoever, on purpose.

After feeling a great deal, people need somewhere to put it down. This rest beat is what makes
the finale land. Resist every temptation to fill it.

### 6. The Celebration — the gift

Cake, candles, the letter.

The candles are lit and blown out as a real shared interaction, performed together rather than
watched. Then the letter, which has been sealed and unopenable until this moment, opens. The
host's words, read at the recipient's own pace.

By the peak-end rule this must be the strongest moment in the experience. Budget accordingly —
if something has to be cut, cut it from the middle, never from here.

### Afterwards

The world stays open. Revisitable, unchanged, theirs.

## Zone architecture

Each zone is a self-contained, independently loaded space. One is resident at a time.

### The zone contract

Every zone is a module exposing the same lifecycle, and declares its own parameters as data:

- `preload()` — fetch and decode this zone's assets. Runs while the previous zone is still on
  screen, so the transition is not a loading screen.
- `enter(state)` — build the scene, place both characters, start the audio bed. Receives the
  accumulated state carried in from earlier zones.
- `update(dt)` — per-frame work.
- `isComplete()` — the zone's own completion condition.
- `exit()` — hand back any state that must persist forward.
- `dispose()` — release geometry, textures, render targets. Non-negotiable; a leak here ends the
  session on a phone.

Zone parameters are a data record, never hardcoded: time of day and sun angle, palette, fog and
aerial-perspective settings, material set, audio bed, content slots (which uploads appear here),
locomotion bounds, completion condition, and quality-tier overrides.

### Why this is good news for the budget

This is the single biggest performance win available to us, and it fell out of your correction.

Because only one zone is ever resident, the **GPU texture ceiling of roughly 200–300 MB applies
per zone rather than cumulatively.** Four photoreal spaces were never going to coexist in a
phone's memory. Sequentially, each one gets the entire budget to itself. The ~8–12 MB per zone
download figure also becomes a streaming target rather than a total, because the next zone
preloads behind the current one.

Strict rule: `dispose()` must actually free everything. Verify with `threejs-debug-profiler` that
texture memory returns to baseline between zones. An accumulating leak across five transitions is
the most likely way this crashes on a mid-range phone.

### Progression and completion

Each zone ends on its own condition, and most of them are two-key by design:

| Zone | Completion condition |
|---|---|
| The Gate | Both stand at the arch together |
| The Garden | The memory motes have been found, together |
| The Café | The song has played through, seated |
| The Reel Room | The reel finishes |
| The Shore | Neither. They leave when they choose — deliberately untasked |
| The Celebration | Candles out together, then the letter |

Both participants must be ready before a transition fires. One person cannot drag the other
forward, and nobody gets left behind in a space that is being disposed.

### Continuity is now the hard problem

Separate spaces create a real risk: five unrelated demos wearing the same colour palette. With no
continuous ground to walk, the connective tissue has to be carried by things that are not
spatial:

- **The song**, running across all five spaces as the through-line
- **The single grading contract** — one owner of tone mapping, exposure and LUT, unchanged between
  zones
- **The two characters**, persistent and unchanged across transitions
- **Accumulated state** — the bloomed path, the collected memory motes, the footprints. Each zone
  should show some evidence of the ones before it. This is what makes the sequence feel like one
  evening rather than five scenes.

The memory motes matter especially here: found in the Garden, they must carry into the Reel Room
and be what plays there. That single thread turns a set of rooms into a journey.

### Transitions

A transition is part of the experience, not a loading gap. Both characters present, previous zone
still rendering while the next preloads, then a deliberate passage — a door, a threshold, a
dissolve through light. Never a spinner, never a black screen, and in VR never a movement the
user did not initiate.

## One architecture, many occasions

The arc is occasion-agnostic. Only the dressing changes. **Occasion is data, never a code branch.**

An occasion preset shifts: gate inscription and typography, palette and time of day, floral and
prop language, the celebration object, and the tone of the ambient bed.

| Occasion | Time of day | Florals / props | Celebration object |
|---|---|---|---|
| Birthday | Warm dusk | Blossom, paper lanterns, playful | Cake with candles |
| Anniversary | Golden hour | Roses, engraved gate | Tiered cake marked with years |
| Proposal | Twilight into starlight | White florals, still water | Ring box on the table; the letter *is* the question |
| Wedding / vows | Dawn | White and green, flower arch | Shared vows read aloud |
| Reunion / long distance | Sunrise | Two paths converging into one | "Welcome back" table |
| Remembrance | Soft overcast | Lanterns released at the shore | A gentler, quieter space |

Adding an occasion must mean adding a preset record, not editing zone code.

## Why exactly two people

This is the defining constraint, not a limitation. It is also, per the research, the reason this
can work where social VR did not.

The documented failure of consumer social VR is the **ghost town**: worlds that are empty, so
nobody comes, so they stay empty. Horizon Worlds is the end state of that spiral — Meta is
removing it from the Quest Store by 31 March 2026 and pulling VR access entirely on 15 June 2026.
Social VR also reliably "dies after the first wow", because the headset was treated as the
motivation rather than the delivery vehicle.

**A world built for exactly two people cannot be empty.** If she is there, it is full. The
ghost-town failure mode is structurally impossible here.

And we are not asking for retention. This is a gift with an ending, consumed once and revisited
occasionally. "Engagement collapses after the novelty" is not a threat to something that was
never trying to become a habit.

Do not add a third participant. It breaks the emotional frame, the voice architecture, and the
one structural advantage the product has.

## Signature mechanics

Generic venue products (Spatial, FrameVR, Teams Immersive) let two people stand in a room
together. Nothing distinguishes that from a video call with extra steps. What makes this specific
is mechanics that **cannot happen alone** — co-presence made literal rather than incidental.

These are the differentiators. They are also all cheap relative to photoreal rendering, which
matters given the mobile budget.

**The path blooms only where both have walked.** Flowers and light grow on the trail only where
both characters have passed. Walk apart and it stays bare; walk together and it blooms behind
you. Togetherness becomes visible and literal. Implemented as a shared trail texture written
only where both presence trails overlap.

**The world is scored to their song.** The uploaded track drives the journey's clock — light
angle, colour temperature and time of day advance with the song's timeline and energy. The sunset
happens *because* of their song. Audio analyser into global uniforms; technically cheap,
emotionally enormous.

**Voice moves the world.** Mic amplitude perturbs the environment: blossom drifts when they
laugh, water ripples on speech, candle flames lean toward whoever is speaking. This directly
answers a documented weakness of avatars, which strip out the micro-expressions that normally
regulate conversation. If the face cannot carry expression, the world will.

**Two-key moments.** The gate opens only when both stand at it. The candles need both breaths.
The cake is cut together. These are the beats that would be meaningless alone.

**Memory motes.** Uploaded photos are seeded through the garden as soft glowing motes. Pick one
up and it blooms into the image, in place. Memories are discovered rather than presented, and the
Reel Room becomes the collected finale of what they found together.

**The shore keeps their footprints.** Persisted to room state, so on revisit the footprints are
still in the sand. This is what makes "keepsake" a real promise rather than a tagline.

**The letter may be read in the host's own voice.** Optional recorded audio alongside the text.
Nearly free to build, and probably the single highest-impact detail in the product.

## Avatar realism

**Target genuine realism.** The characters are procedurally/parametrically generated humans and
they should read as real people, not as stylised stand-ins.

The way to get there is not polygon count. The research is unusually clear about where realism
actually comes from, and it is not where most projects spend:

> Artificial faces are visually processed like real ones and **mostly are not assessed as
> artificial, as long as the eye regions are not considered**
> ([Uncanny Valley and the Importance of Eye Contact](https://www.researchgate.net/publication/285322181_The_Uncanny_Valley_and_the_Importance_of_Eye_Contact))

> **Correct avatar gaze, over photorealism**, improves the immersive experience — provided the
> character has a sufficient level of realism
> ([Maddock et al.](https://staffwww.dcs.shef.ac.uk/people/s.maddock/publications/MaddockEtal2005_HCI.pdf))

So the uncanny valley is not caused by realism. It is caused by **good geometry with dead eyes and
dead motion.** Realism is safe, and is in fact the goal, provided the eyes and the motion carry it.

### The realism hierarchy

Spend the budget strictly in this order. Each tier buys more perceived realism per byte and per
millisecond than the one below it.

1. **Eyes.** The deciding factor, per the studies above. Wet specular highlight, cornea refraction,
   iris parallax so the iris has depth, a limbal ring, correct sclera shading. Small textures,
   enormous payoff.
2. **Gaze.** They look at each other. They look at what the other is looking at. Saccades between
   fixations, not a locked stare. This single system outranks photorealism outright.
3. **Living motion.** Blink at irregular human intervals, breathing that moves the chest and
   shoulders, weight shifting between feet in idle, head leading turns before the body. A still
   character reads as a corpse regardless of its shading.
4. **Mouth driven by real voice.** We already have both mics. Drive jaw and viseme blendshapes from
   mic amplitude and rough spectral content. A mouth that moves when she actually speaks does more
   for presence than any texture.
5. **Skin.** Subsurface scattering — three.js ships `SubsurfaceScatteringShader` as an addon
   (`three/addons/shaders/SubsurfaceScatteringShader.js`), with screen-space SSS as a desktop-tier
   upgrade. Skin without SSS reads as plastic no matter how good the albedo is.
6. **Hair.** Cards with anisotropic specular, never solid meshes. This is the documented weak point
   of every parametric human generator, so it needs deliberate attention.
7. **Cloth.** `sheen` on `MeshPhysicalMaterial` for fabric, plus normal detail.
8. **Geometry density.** Last. The least efficient realism lever available, and the one that
   actually threatens the mobile budget.

Note that tiers 1–4 are nearly free in bytes and cost almost nothing on a phone. That is the whole
argument: **realism is achievable within the mobile budget, but only if it is bought in this
order.**

`MeshPhysicalMaterial` costs more per pixel than other materials, effects are off by default, and
it needs an environment map to look right. Enable only what a given tier can afford.

Legless floating torsos are a documented source of weirdness. Give them full bodies.

### Pipeline

MakeHuman/MPFB2 for the prototype — parametric, and its exports are CC0 by explicit licence
exception. Its realism ceiling is mid and its hair is weak, so treat it as the blockout for the
character system, not the final look.

Reallusion Character Creator 4 for production: realistic, royalty-free perpetual content
licensing, good LODs, one-time cost. Commit to it once the eye, gaze and motion systems are proven
on the MakeHuman blockout, because those systems are what carry the realism and they are
character-agnostic.

## Asset strategy

Build from **CC0 sources only.** Poly Haven is the backbone: its licence explicitly permits
commercial use, requires no attribution, and expressly allows redistribution inside a product you
sell — the only licence surveyed that unambiguously survives shipping GLB files to a browser.
ambientCG (also CC0) covers materials: garden ground, café wood and plaster, beach sand, theatre
carpet and fabric.

Deliberately avoided:

- **Fab / Quixel Megascans and MetaHuman.** The Standard Licence permits distribution inside a
  packaged product but forbids standalone distribution of the content, and a GLB served over HTTP
  is trivially extractable. Epic's own support declined to answer this exact question for a
  revenue-generating web app. Stay off it until there is written confirmation.
- **Sketchfab.** Store closed and free licensing is being withdrawn as content moves to Fab. Do
  not build a dependency on it.
- **CC BY-NC** (kills commercial use) and **CC BY-ND** (a decimated, recompressed mesh is a
  derivative, so it kills our compression pipeline).
- **CC BY** is workable but needs visible attribution, which fights "never break the fiction with
  chrome". Credits live in the 2D shell, never in-world.

No usable prebuilt garden/café/beach scenes exist under permissive licences. Assemble from CC0
kit parts. Archive the licence page for every asset at download time — Sketchfab is a live
example of provenance evaporating.

## Delivery budget

- **Meshopt, not Draco.** Far faster decode, and Draco cannot compress morph targets, which we
  need for facial blendshapes.
- **KTX2/Basis is mandatory** on mobile: ETC1S for albedo, UASTC for normals. One asset serves
  iOS and Android and it cuts VRAM, which is the real constraint on phones.
- **HDRIs at 1K–2K**, converted to UltraHDR gainmap and loaded via `UltraHDRLoader`. A 4K EXR
  blocks the main thread for roughly 0.5–1.25s.
- Roughly **8–12 MB per zone**, about **40 MB total**, streamed progressively between beats.
- Treat **GPU texture memory (~200–300 MB)** as the harder ceiling than download size.
- Neither codec improves framerate. Vertex count and draw calls are separate work.

## Design principles

**The letter is the payload.** Everything else is staging for it.

**Voice is the feature, not a bonus.** Most of the emotion will come from hearing each other,
not from the render. When voice quality and visual fidelity compete, voice wins. This is
counterintuitive given how much of the toolchain is graphics, and it is still true.

**Protect the guest's surprise.** The two participants have asymmetric knowledge: the host knows
what is coming, the guest does not. The host must never see spoiler UI while inside, and the
guest must never see authoring controls.

**Never break the fiction with chrome.** Occasion text, prompts and the letter all live as
objects in the world. Floating 2D panels are a last resort, and in VR they are a comfort
hazard as well as an aesthetic one.

**Two bodies, one world.** Presence is the point. If a feature would work just as well alone,
question whether it belongs.

## Visual coherence

Five separate spaces must read as one loving world. That is a light and colour problem before it
is a modelling problem, and because the spaces are discrete rather than continuous it is harder
than it would be in a connected map. See "Continuity is now the hard problem".

There is exactly **one** owner of tone mapping, exposure and the output LUT, applied across all
zones. Per-zone grading is forbidden — it is what makes an anthology feel like four unrelated
demos. Zones differentiate through time of day, material palette and content, never through
their own colour pipeline.

Build the Garden to a finished bar first. Lock the grading and the audio signature there, then
carry that contract into the other three.

## Platform reality

**Assume a phone.** A link shared with a partner will most often be opened on a phone, not a
headset. Mobile flat mode is the primary target, desktop second, VR the enhanced mode.

This inverts the usual priority order and it drives the whole performance budget. Compute-shader
techniques (FFT ocean cascades, GPU-culled grass) are desktop-WebGPU only. Every zone needs an
analytic fallback that holds up on a mid-range phone, and those fallbacks are what most people
will actually see. Author against the weakest tier first.

## Technical shape

Decided elsewhere and recorded here for context. See `.kiro/skills-manifest.json` for the
reasoning and evidence behind each.

- **Rendering**: vanilla three.js + TypeScript + Vite, `WebGPURenderer` with TSL, relying on its
  automatic WebGL 2 backend fallback. Not React Three Fiber.
- **2D shell**: the Making, character select and invite screens are ordinary web UI.
- **Rooms**: one Cloudflare Durable Object per invite — occasion config, presence, position sync
  over WebSockets, and WebRTC signalling.
- **Media**: uploaded song, images and video in R2.
- **Voice**: peer-to-peer WebRTC between the two participants, with the Durable Object as
  signalling. Positional audio so a voice comes from where the body is.
- **Avatars**: realistic parametric humans. See "Avatar realism" for the hierarchy that gets us
  there — eyes, gaze and living motion before geometry. Base clip set (idle, walk, sit, dance,
  gesture) blended through `AnimationMixer`, layered with procedural blink, breathing, weight
  shift, gaze targeting and mic-driven visemes. Skin via `SubsurfaceScatteringShader`.
  Pipeline: MakeHuman/MPFB2 blockout, then Reallusion Character Creator 4. Mixamo for motion
  clips — free and royalty-free for commercial use, but bake them into our own character GLB,
  since redistributing raw Mixamo files is prohibited.
  **Ready Player Me is not an option.** Netflix acquired it in December 2025 and the avatar
  creator and developer APIs shut down 31 January 2026. Do not design against it.
- **Media as light**: the Reel Room screen and the café's song both drive their room's lighting.
  Uploaded content affects its space; it never merely sits in it.

## Open questions

- Can the guest revisit alone later, or only together? Affects whether room state outlives the
  session.

Settled, not revisitable:

- **Strictly two people.** See "Why exactly two people".
- **Five discrete spaces**, sequentially loaded, not one continuous world. See "Zone architecture".
- **Flat screen in the Reel Room, not 360** — but environmental, driving the room's light. The
  `XRMediaBinding` quad-layer path therefore applies.
- **Genuine character realism**, bought through eyes, gaze and living motion rather than geometry
  density. See "Avatar realism".
