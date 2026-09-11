# Working Method

How work on this project gets done. Read alongside `concept.md`, which says *what* we are making.

## The order of operations

**Research, then decide, then build, then measure.** Every non-obvious choice on this project so
far has been settled by checking rather than assuming, and three of those checks reversed a
decision that felt safe:

- Assumed React Three Fiber was the modern default. Grepped the installed graphics pack: zero
  React, every example vanilla. Reversed to vanilla three.js.
- Assumed Quest at 90Hz was the target. Realised an invite link gets opened on a phone. Reversed
  to mobile-first, three tiers.
- Assumed Ready Player Me for avatars. It shut down in January 2026. Reversed to MakeHuman then
  Character Creator 4.

The lesson is not "be careful". It is that in this domain the confident default is frequently
stale, so **verify before committing**, especially licences, platform support, and anything with
a vendor dependency.

## Verify, don't assert

- Never claim a technique works without having run it or read the current source. "The build
  passed" is not evidence that the feature works.
- Check licences at the point of download and archive the licence page. Provenance evaporates.
- When stating a platform capability, cite the current doc or issue. WebGPU-on-WebXR, codec
  support and avatar vendors all moved within the last year.
- Say plainly what was checked and what was not. Do not launder an assumption into a claim.

## Build order

**One zone at a time, finished, not four zones roughed in.** The Garden goes first and goes all
the way to a finished bar, because it is where the grading, the audio signature and the two-person
mechanics get locked. Everything after it inherits those contracts. Four half-built zones would
mean re-art-directing four times.

Within a zone: greybox the space, land the lighting and grade, then add content. Not the reverse.

**Author against the weakest tier first.** Mobile flat is the primary target. A zone that only
holds up on desktop WebGPU has not been built, it has been prototyped. The analytic fallback is
the real product; the compute-shader version is the bonus.

**Vertical slice before breadth.** One zone plus real two-person presence, real voice, and the
real invite-link flow beats six beautiful empty rooms. The riskiest parts of this product are
networking and voice, not rendering — prove those early while they are cheap to change.

## Prove the risky things first

Ranked by "will sink the project if it does not work", highest first:

1. Two people actually connecting through a shared link, on phones, on different networks
2. Voice being clear and low-latency enough to feel like presence
3. Position/animation sync being smooth enough not to feel like a puppet show
4. A zone holding an acceptable framerate on a mid-range phone
5. Everything visual

Note that the ranking is roughly the inverse of how much tooling we installed. That is expected —
graphics has the best tooling because it is the best-understood part. Spend the attention where
the tooling cannot help.

## Using the skills

Route through `threejs-skill-router` for any visual system rather than loading graphics skills
speculatively. Load the one skill that changes the result.

- Realism systems: the `threejs-*` graphics pack (user-level install)
- Art-direction coherence across zones: `threejs-aaa-graphics-builder` and its visual scorecard
- XR comfort, spatial layout, XR accessibility: `hz-immersive-designer`
- Rooms, presence, signalling: `durable-objects`, `cloudflare`, `workers-best-practices`
- Frame budget: `threejs-debug-profiler`
- Evidence: `threejs-visual-validation`, `threejs-qa-release`, `webapp-testing`

`.kiro/skills-manifest.json` records what is installed, where, and why. Keep it reconciled — it
has been drift-free so far and is the fastest way to answer "do we already have something for
this".

## Evidence for visual work

Screenshots, not adjectives. "Looks good" is not a report.

Use `threejs-visual-validation` for fixed-view comparisons and seed sweeps, and
`threejs-debug-profiler` for draw calls, triangle counts, texture memory and shader cost. When a
change is claimed to improve performance, state the before and after numbers.

The dev machine is Intel Iris Xe integrated graphics. It cannot preview the top tier, and it is
not a proxy for a phone. Do not infer mobile performance from it.

## Scope discipline

The concept has an unusually clear priority order, so use it. The letter is the payload; the
Celebration is the end peak; the Shore is deliberately empty. **If something must be cut, cut from
the middle beats, never from the ending.**

Occasion is data, never a code branch. Any change that adds a `switch` on occasion type is wrong
by construction.

Features that would work just as well alone are suspect. Two-person co-presence is the product.

## Communication

Lead with the outcome and what changed. Flag reversals explicitly, with the evidence, because
several have already happened and quietly changing course would make the plan untrustworthy.
Distinguish verified from assumed. Keep the open questions list honest and short.
