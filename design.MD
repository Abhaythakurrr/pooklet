# Pooklet — Three Private Love Stories

> A celebration that feels made for them.  
> A love letter that feels like home.  
> An apology that makes room for their feelings.

**Document type:** Implementation-ready product, design, content, and interaction specification  
**Templates:** Celebrating · Loving · I Am Sorry  
**Primary platform:** Mobile web  
**Visual direction:** Layered 2D low-poly illustration, realistic lighting and materials, modern editorial typography, intimate retro objects  
**Status:** Concept specification; implementation and testing are still required.

---

## 1. Product Definition

Pooklet lets someone turn their words, photographs, videos, voice, and music into a private, personal website for someone they love.

The creator chooses a template first. The application then asks only the questions that belong to that template.

The recipient does not receive a dashboard, slideshow, or collection of uploaded files.

They receive a small, authored experience with a beginning, a meaningful progression, and a personal letter at its center.

### The three emotional promises

| Template | Emotional promise | Recipient should feel |
|---|---|---|
| Celebrating | “This moment deserves a world of its own.” | Seen, appreciated, delighted |
| Loving | “You live inside the little things in my life.” | Cherished, remembered, close |
| I Am Sorry | “I want to take responsibility without asking you to make this easier for me.” | Respected, heard, unpressured |

### What makes these templates different

These must not be one website with three color schemes.

Each template has its own:

- Setting.
- Narrative structure.
- Questions.
- Object language.
- Layout rhythm.
- Movement.
- Sound treatment.
- Relationship to memories.
- Ending.

Shared components provide consistency and accessibility, not identical storytelling.

### Scope decision

This version is a 2D, recipient-led keepsake experience.

It does not require:

- A live call.
- Simultaneous arrival.
- Avatars.
- Character movement.
- A shared microphone.
- A real-time multiplayer connection.

One person creates. One intended recipient opens.

Future live features must remain optional and must not prevent someone from experiencing their gift alone.

---

## 2. Resolve the Visual Direction

### “2D low-poly, highly realistic” means:

Use simplified, faceted geometry for the illustrated environment, while making its materials and lighting believable.

Examples:

- A faceted paper envelope with realistic fiber texture.
- A simplified cassette with convincing plastic reflections.
- Angular plants with soft, natural shadows.
- A low-poly window frame with believable rain and reflected light.
- A geometric rooftop with warm light falling across textured surfaces.

### It does not mean:

- Photorealistic human characters.
- A real-time 3D environment.
- Pixel art.
- Cartoon sticker collections.
- Heavy polygon filters over personal photographs.
- Hearts floating over every screen.

Personal photographs and videos remain faithful to the originals.

### Design formula

**Simple geometry + believable materials + restrained animation + real personal content.**

### Shared art rules

- Use layered SVG or raster illustrations with HTML content above them.
- Keep meaningful text out of flattened artwork.
- Use perspective consistently within each scene.
- Build depth through overlapping planes, light, shadow, and small parallax shifts.
- Limit each scene to one primary focal object.
- Keep atmospheric effects behind readable content.
- Never sacrifice readability for visual realism.
- Treat film grain as a subtle texture, not a full-screen moving noise effect.
- Illustrated objects are metaphors, not claims about objects the couple actually owns.

### Typography

Use three locally bundled font roles:

- **Display:** An expressive editorial serif, such as Cormorant Garamond.
- **Reading and interface:** A highly legible sans serif, such as Inter.
- **Object labels:** A restrained monospace face, such as IBM Plex Mono.

Handwriting may appear on short decorative labels. Never use it for the main letter.

---

## 3. Complete Application Journey

### Creator journey

Choose a feeling  
→ See a short template preview  
→ Enter recipient and sender names  
→ Answer template-specific questions  
→ Add optional memories and media  
→ Review the story  
→ Preview the recipient experience  
→ Seal and publish  
→ Copy the private invitation

### Recipient journey

Open invitation  
→ Choose to enter  
→ Move through the story at their own pace  
→ Play optional media  
→ Read the personal letter  
→ Remain, replay, or leave

### First screen: choose the template

**Heading:**  
“What would you like them to feel?”

**Supporting copy:**  
“Choose the kind of moment you want to make.”

Three large, visually distinct cards:

#### Celebrating
“A little world for their big moment.”

Preview object: an illuminated rooftop marquee.

#### Loving
“For everything you feel in the ordinary moments.”

Preview object: a warm window with a cassette on its sill.

#### I Am Sorry
“For the words that need care, honesty, and room.”

Preview object: an envelope beside a rain-covered window.

**Primary action:** “Choose this feeling”

Do not ask for names, an account, payment, or uploads before this choice.

### Creator layout

- One clear question group per screen.
- Plain-language progress: “Your words,” “Your memories,” “Their experience.”
- A compact preview that changes as answers are added.
- Back navigation without losing answers.
- Optional sections visibly labeled “Optional.”
- A clear “Skip for now” action.
- Actual save status: “Saving…,” “Saved,” or “Not saved—try again.”
- Never show “Saved” before storage confirms success.

On desktop, use a form and preview side by side.

On mobile, use the form first with a persistent “Preview” action.

### Changing templates

Allow template changes before publishing.

Preserve:

- Recipient name.
- Sender name.
- Uploaded assets in the creator’s asset library.

Do not automatically move:

- Apology wording into a celebration.
- Celebration copy into a love letter.
- Media into a new narrative without confirmation.

Explain which answers will need to be rewritten.

---

## 4. Shared Content and Placeholder Contract

All three templates must work with real creator content, example content, and absent optional content.

### Shared required fields

| Field | Question | Validation | Used in |
|---|---|---|---|
| `toName` | “Who is this for?” | 1–60 characters | Invitation, opening, letter |
| `fromName` | “Who is it from?” | 1–60 characters | Invitation signature, cassette label, letter signature |

Do not require:

- Gender.
- Relationship labels.
- A shared address.
- An age.
- A public profile.
- A profile photograph.

Write default copy without gendered assumptions.

### Placeholder rules

Use explicit bindings such as:

- `{{toName}}`
- `{{fromName}}`
- `{{occasionDisplayLabel}}`
- `{{spotlight}}`
- `{{letter}}`

Rules:

- Escape all user text.
- Preserve paragraphs and intentional line breaks.
- Do not render raw HTML supplied by creators.
- Never expose unresolved placeholder syntax.
- Do not truncate the main letter.
- Long content expands into a readable document area.
- Optional empty fields remove their related object or passage.
- Missing media must not leave broken frames or empty players.
- Example content must never be published accidentally.
- Never invent memories, quotations, dates, or relationship facts.

### Example content

Template previews may use clearly labeled fictional stories.

When creating a real gift:

- Clear example answers.
- Keep example text as hints, not field values.
- Require creators to supply their own required answers.
- Show exactly what will be published.

### Media philosophy

Uploads are optional. Emotional expression must not depend on having a photo library.

**Minimum images for every template: 0.**

A text-only experience must feel intentionally designed, not incomplete.

---

## 5. Media Limits and Placement

### Per-template allowances

| Asset | Celebrating | Loving | I Am Sorry |
|---|---|---|---|
| Images | 0–8; recommend 3–5 | 0–10; recommend 4–6 | 0–3; recommend 0–1 |
| Videos | 0–2 | 0–3 | 0–1 |
| Voice note | 0–1 | 0–1 | 0–1 |
| Song | 0–1 | 0–1 | 0–1; off initially |
| Written memories | 0–8 | 0–10 | 0–2; after the apology only |

Recommendations are guidance, not requirements.

### Per-file limits

| Asset | Accepted input | Limit | Required supporting information |
|---|---|---|---|
| Image | JPEG, PNG, WebP | 20 MB | Short visual description |
| Video | MP4, MOV, WebM | 100 MB and 90 seconds | Title; captions for meaningful speech |
| Voice | Recorded audio or MP3, M4A, WAV, OGG | 25 MB and 180 seconds | Editable transcript |
| Song | MP3, M4A, WAV, OGG | 50 MB and 5 minutes | Display title; artist if known |

These are upload formats, not a promise that every browser can play every source codec.

Process accepted media into supported playback derivatives.

### Upload behavior

- Validate file type, duration, dimensions, and size on the server.
- Show upload and processing as separate states.
- Generate responsive image versions.
- Generate video posters and mobile-friendly video derivatives.
- Strip image location metadata.
- Keep originals private.
- Allow replacing and deleting assets.
- Never publish a gift with a required asset still processing.
- Allow removing a failed optional upload and continuing.

### Voice recording

Before requesting microphone access, explain:

“Record a little message in your own voice. You can listen back, redo it, or skip this.”

Controls:

- Record.
- Stop.
- Listen.
- Record again.
- Use this recording.

Show a visible timer and a 180-second limit.

If permission is denied or recording is unsupported:

- Offer audio upload.
- Offer written words.
- Do not block progress.

Ask the creator to supply or review the transcript.

### Each asset must affect the composition

An uploaded asset must have a narrative position and an environmental consequence.

Examples:

- A celebration memory adds a lit point to the rooftop skyline.
- A loving memory adds a postcard to the room and changes the arrangement of its shelf.
- An apology voice note adds a deliberately optional cassette beside the letter.
- A song adds a playable object and a labeled sleeve.
- Removing an asset recomposes the scene rather than leaving a hole.

Media may open into accessible viewers. The viewer is not its only contribution to the design.

### Important limitation for the apology template

Adding content must not make the world appear “healed.”

No asset, playback event, or recipient action signifies forgiveness.

---

# 6. Template One — Celebrating

## Concept: “A Night With Your Name on It”

### Core idea

The creator prepares a private rooftop celebration above a quiet city.

The occasion is written into the environment. Shared memories become small lights along the way. The final destination is not a generic birthday cake: it is a table prepared for this specific milestone, with a letter waiting at its center.

### Emotional arc

Anticipation  
→ Recognition  
→ Shared history  
→ Joy  
→ Personal appreciation

### Visual identity

- Midnight blue: `#192239`
- Warm ivory: `#FFF5E7`
- Apricot: `#F3B089`
- Muted brass: `#C7A263`
- Soft rose: `#D78D99`

Use midnight and ivory for primary text contrast. Treat brass, rose, and apricot mainly as accents unless the specific pairing passes contrast testing.

Materials:

- Brushed brass.
- Textured invitation stock.
- Linen.
- Warm bulb glass.
- Faceted stone.
- Translucent paper lanterns.

Retro reference:

A private rooftop supper with a small vintage sound system—not an arcade or nightclub.

### Signature interaction

**The skyline remembers.**

Opening a memory illuminates its corresponding small light in the illustrated skyline.

There is no score or collection requirement.

“Continue to your letter” remains available.

---

## 6.1 Questions

Ask these after names.

| Field | Exact question | Required | Destination |
|---|---|---|---|
| `occasion` | “What are we celebrating?” | Yes | Scene variant and invitation |
| `customOccasionLabel` | “What would you like to call this occasion?” | Only for Custom | Marquee and table card |
| `occasionDate` | “Is there a date you want to keep with this?” | No | Printed invitation date |
| `anniversaryYears` | “Would you like to include how many years?” | No; anniversary only | Optional table inscription |
| `spotlight` | “What do you most want them to feel celebrated for?” | Yes; 8–240 characters | Main rooftop dedication |
| `wish` | “What do you wish for their next chapter?” | No; up to 280 characters | Folded wish card |
| `memories` | “Which moments brought you here together?” | No; up to 8 | Skyline memory lights |
| `letter` | “What would you say if you had this whole evening to tell them?” | Yes; 30–5,000 characters | Final letter |

### Occasion choices

- Birthday.
- Anniversary.
- Graduation.
- Achievement.
- Reunion.
- Just because.
- Custom.

Do not ask for a birthday age by default.

Do not require a year count for anniversaries.

### Memory questions

For each memory:

- “Give this moment a little title.” — up to 80 characters.
- “What made it special?” — up to 400 characters.
- “Add a photo or video, if you want.”
- “Would you like to include a date?” — optional.

Allow text-only memories.

### Voice prompt

“If you could raise a toast just for them, what would you say?”

Suggested structure:

- Say their name.
- Name what you admire.
- Share one wish.

Do not prefill claims about them.

### Song prompt

“What song belongs to this celebration?”

Optional follow-up:

“Why this song?” — up to 240 characters.

This answer is printed inside the music sleeve.

---

## 6.2 Occasion Variants

Keep the rooftop setting, but change meaningful objects and language.

| Occasion | Environmental treatment | Heading |
|---|---|---|
| Birthday | One sculptural candle and a wrapped paper parcel | “A night for you, {{toName}}.” |
| Anniversary | Two intersecting light paths and paired place cards | “A night for us.” |
| Graduation | A folded program and ribbon | “For everything it took to get here.” |
| Achievement | A brass dedication card displaying the achievement | “Look at what you made possible.” |
| Reunion | Two chairs beside a single warm lantern | “Here, together.” |
| Just because | Flowers and an unnumbered invitation | “No special date. Just you.” |
| Custom | Neutral lantern table and the creator’s occasion label | “{{occasionDisplayLabel}}” |

Only display milestone-specific props when the creator selected that occasion.

Do not show birthday candles for every celebration.

---

## 6.3 Exact Recipient Storyline

### Scene 1 — The Invitation

A thick paper invitation rests against a softly illuminated city background.

**Copy:**

“{{toName}}, a little night has been made for you.”

“From {{fromName}}.”

**Button:** “Open your invitation”

Interaction:

The paper cover lifts in a short, gentle animation.

No audio starts automatically.

### Scene 2 — Your Name Above the City

The composition opens onto a rooftop.

A physical marquee displays the occasion. A dedication card displays `spotlight`.

**Copy:**

“Tonight is for you.”

For anniversaries:

“Tonight is for us.”

**Button:** “Look around”

Interaction:

Lights warm on over 700 milliseconds after entry.

The recipient can continue immediately.

### Scene 3 — The Lights That Brought Us Here

Memory cards occupy lantern stands along a short illustrated walkway.

**Copy:**

“A few moments worth bringing into tonight.”

Each memory opens into a photograph, video, or written card.

Opening it also illuminates its skyline marker.

**Buttons:**

- “Next memory.”
- “Continue to the table.”

If there are no memories:

Remove this scene and connect the rooftop dedication directly to the table.

Do not invent a shared history.

### Scene 4 — A Toast in Your Voice

If a voice note exists, a brass-and-cream cassette deck sits on the table.

**Label:**

“A little toast from {{fromName}}.”

**Button:** “Play their message”

The cassette rolls only during actual playback.

The transcript is available beside the controls.

If only a song exists:

Show the song player and its sleeve instead.

If neither exists:

Remove the listening stop.

### Scene 5 — The Table Prepared for This Moment

The occasion-specific arrangement fills the foreground.

If `wish` exists, a small folded card reads:

“For what comes next.”

Opening it reveals the creator’s wish.

The main envelope remains visible.

**Button:** “Open your letter”

No candle-blowing microphone interaction is required.

If a birthday candle is present, it is decorative and can be extinguished with an accessible tap or button. This does not unlock the letter.

### Scene 6 — The Letter

The envelope opens into a spacious reading layout.

**Opening:**

“{{toName}},”

Display the creator’s letter verbatim.

**Signature:**

“With love,  
{{fromName}}”

Let the creator change the sign-off in preview if it does not fit their relationship.

**Closing interface copy:**

“Stay a little. This moment is yours.”

**Actions:**

- Read again.
- Listen again, if available.
- Revisit the memories.

### Fictional preview letter

“Maya,

Happy birthday. I wanted to celebrate more than a date. I wanted to celebrate the way you keep showing up for the things and people you love, even when life is asking a lot of you.

I wish I could pull out your chair tonight. Until I can, here is a little evening with your name on it.

I hope this next year brings you more room to breathe, more reasons to laugh, and a few beautiful surprises.

With love,
Alex”

---

# 7. Template Two — Loving

## Concept: “The House of Little Things”

### Core idea

Love is expressed through an imagined little home assembled from the ordinary things the creator notices.

A cup. A window. A shelf. A cassette. A place to leave a note.

This is not a claim that the couple lives together.

It is a visual metaphor:

“You have a place in my everyday life.”

### Emotional arc

Recognition  
→ Familiarity  
→ Being noticed  
→ Closeness  
→ Quiet commitment

### Visual identity

- Warm cream: `#F5EBDD`
- Deep evergreen: `#284C42`
- Faded coral: `#CB8374`
- Walnut: `#60473E`
- Soft butter: `#E9D89C`

Materials:

- Walnut veneer.
- Woven fabric.
- Ceramic.
- Translucent curtains.
- Cream cassette plastic.
- Slightly aged paper.

Retro reference:

A thoughtfully kept apartment with a good stereo and handwritten notes—not a cluttered nostalgia shop.

### Signature interaction

**The room becomes personal through noticing.**

Each creator-supplied detail occupies a small object in the room.

A note beside a cup might hold:

“The way you remind me to eat when the day gets away from me.”

A bookmark might hold:

“How you always want to tell me the ending of a story you loved.”

These words must come from the creator.

The room composition adapts to how many details they provide.

---

## 7.1 Questions

| Field | Exact question | Required | Destination |
|---|---|---|---|
| `littleThings` | “What little things about them stay with you?” | Yes; 1–5 answers, each 8–240 characters | Notes attached to room objects |
| `distanceDetail` | “When do you feel close to them, even when you are apart?” | No; up to 400 characters | Window-side note |
| `memories` | “Which ordinary moments would you keep forever?” | No; up to 10 | Postcards, shelf, contact strip |
| `futureWish` | “What is one simple thing you would love to do together?” | No; up to 280 characters | Future postcard |
| `letter` | “What do you want them to know about being loved by you?” | Yes; 30–5,000 characters | Final letter |

### Helpful hints for `littleThings`

Use these as hints only:

- A phrase they say.
- A habit that makes you smile.
- Something they do to care for you.
- A detail you notice on calls.
- A moment that feels ordinary to everyone else.

Avoid making this a quiz about the relationship.

### Memory questions

- “What would you call this moment?”
- “What do you remember most?”
- “Add a photo or video, if you want.”

Dates remain optional.

### Voice prompt

“Say something you would want them to hear on an ordinary evening.”

Suggested direction:

- Speak naturally.
- A simple message is enough.
- It does not need to sound like a speech.

### Song prompt

“What song feels like the two of you?”

Optional follow-up:

“What should they remember when it plays?”

Print the answer inside the cassette sleeve or song card.

---

## 7.2 Exact Recipient Storyline

### Scene 1 — The Window

A warm window appears against a quiet evening exterior.

Inside, a small lamp is already on.

**Copy:**

“{{toName}}, you have a place in my everyday.”

“Made with love by {{fromName}}.”

**Button:** “Come a little closer”

No doorbell, login, or puzzle.

### Scene 2 — The Room of Small Things

The composition moves inside to a table, shelf, and reading chair.

The creator’s `littleThings` become visible notes attached to selected objects.

**Copy:**

“It is often the smallest things.”

**Instruction, after the room is visible:**

“Open a note, or keep going.”

Tapping a note brings its text forward without requiring precision dragging.

The number and arrangement of objects follow the actual answer count.

One thoughtful answer produces a complete, uncluttered scene.

Five answers produce a richer room.

### Scene 3 — The Shelf of Us

If memories exist, they appear as an intentional arrangement:

- Up to three prominent postcards.
- A contact strip for additional photographs.
- A labeled television screen for a selected video.

Do not stack ten identical cards.

**Copy:**

“Nothing extraordinary to anyone else. Everything to me.”

A memory expands when selected. The room stays visible behind it.

If there are no memories:

Skip this scene.

### Scene 4 — The Tape on the Sill

If voice exists, a cream cassette player rests beside the window.

The handwritten label reads:

“For an ordinary evening.”

Below it:

“{{fromName}} → {{toName}}”

**Button:** “Press play”

Curtains move subtly while the scene is visible.

Their movement is ambient, not driven by invented audio analysis.

If `distanceDetail` exists, it appears as a note beside the player.

If there is no audio but `distanceDetail` exists:

The window becomes a quiet reading scene.

If neither exists:

Skip the scene.

### Scene 5 — One Day, Something Simple

If `futureWish` exists, a postcard is tucked beneath a cup.

Front:

“One day, something simple.”

Inside:

The creator’s wish.

Examples may include making breakfast, taking a walk, or sharing a train ride—but never prefill these as facts.

**Button:** “There is one more thing”

This is a hope, not a promise the recipient must accept.

If no wish exists, go directly to the letter.

### Scene 6 — The Letter in the Warmest Corner

The final letter sits beside the reading lamp.

**Copy:**

“Not just for today.”

Display the letter verbatim.

**Closing interface copy:**

“A little place to return to.”

**Actions:**

- Read again.
- Hear their voice, if available.
- Return to the room.

Do not add streaks, daily check-ins, or relationship scores.

### Fictional preview letter

“Sam,

I love the way you ask whether I got home, and the way you tell a story with three beginnings because you keep remembering something important.

Sometimes we only have ten tired minutes on a call. Somehow, those ten minutes still change my day.

I made this little room because you are already in so much of my ordinary life. In the songs I save. In the things I want to tell you. In the quiet after something makes me laugh.

One day, I would like an unhurried breakfast with you.

Until then, and after then, I love you.

Robin”

---

# 8. Template Three — I Am Sorry

## Concept: “A Letter Beside the Rain”

### Core idea

A quiet room. A rain-covered window. A letter placed where it can be read without interruption.

The design does not dramatize the sender’s suffering.

It creates space for a clear apology, specific responsibility, and a practical next step.

It remains warm without pressuring the recipient to reconcile.

### Emotional arc

Permission  
→ Acknowledgment  
→ Responsibility  
→ Concrete intention  
→ Space

The ending is not forgiveness.

The ending is the recipient retaining control.

### Visual identity

- Mist: `#E9E8E1`
- Deep slate: `#344954`
- Muted sage: `#91A395`
- Paper ivory: `#FAF5EA`
- Soft clay: `#BA9484`

Materials:

- Uncoated paper.
- Matte ceramic.
- Rain-covered glass.
- Pale wood.
- A simple graphite-colored cassette.

Retro reference:

A letter and a carefully recorded tape left on a writing desk.

### Signature interaction

**Nothing demands an answer.**

The letter can be opened immediately.

Memories and voice are optional supporting material, not obstacles before the apology.

Rain does not stop because the recipient reads.

A broken object does not repair itself.

No action is labeled “Forgive,” “Fix us,” or “Make things right.”

---

## 8.1 Questions

| Field | Exact question | Required | Destination |
|---|---|---|---|
| `whatHappened` | “What are you apologizing for? Name the specific action.” | Yes; 15–600 characters | Opening of the letter |
| `responsibility` | “What responsibility are you taking, without explaining it away?” | Yes; 15–600 characters | Accountability paragraph |
| `impact` | “What do you understand about how this may have affected them?” | Yes; 15–600 characters | Impact paragraph |
| `repairStep` | “What will you do differently that is concrete and within your control?” | Yes; 15–600 characters | Action paragraph |
| `timeframe` | “Is there a realistic timeframe worth including?” | No; up to 120 characters | Added to action paragraph |
| `closing` | “What would you like to say without asking them to respond or forgive?” | Yes; 10–1,500 characters | Closing paragraph |
| `boundaryNote` | “Would you like to explicitly give them space?” | Optional, editable suggested line | Closing note |
| `memories` | “Would a memory add care here, or would it add pressure?” | No; up to 2 | Optional section after letter |

### Suggested boundary note

“You do not need to reply before you are ready.”

The creator must review this before publishing.

Do not silently add promises or commitments on their behalf.

### Guidance beneath the questions

For `whatHappened`:

“Describe what you did, rather than what they made you feel.”

For `impact`:

“Name what you understand. Leave room for their experience to be different.”

For `repairStep`:

“Choose an action you can actually follow through on.”

For `closing`:

“A sincere apology does not need a request for reassurance.”

These are writing aids, not an automated judgment of the relationship.

### Voice prompt

“Would hearing you take responsibility help? If so, record a calm message in your own words.”

Suggested structure:

- Name the action.
- Acknowledge the impact.
- State what you will change.
- Leave room for no response.

Never make voice mandatory.

### Song prompt

“Would music support this message, or distract from it?”

Music is:

- Optional.
- Off on entry.
- Never started automatically by opening the letter.
- Controlled independently by the recipient.

### Memory restrictions

Memories must appear after the apology.

Do not position them as evidence that the recipient owes the sender another chance.

Avoid default captions such as:

- “Remember how happy we were?”
- “Do not throw this away.”
- “After everything we have been through.”

### Letter assembly

Do not ask the creator to write the same apology twice.

Assemble one letter from the required answer blocks in this order:

1. Recipient name.
2. What happened.
3. Responsibility.
4. Understood impact.
5. Concrete action.
6. Optional timeframe.
7. Closing.
8. Optional boundary note.
9. Sender name.

Preserve the creator’s wording.

Show the complete assembled letter in preview.

No automatic emotional embellishment or invented promises.

---

## 8.2 Exact Recipient Storyline

### Scene 1 — The Quiet Invitation

An envelope rests beside a rain-covered window.

**Copy:**

“{{toName}}, I have something I want to say carefully.”

“From {{fromName}}.”

**Actions:**

- “Read the letter.”
- “Not right now.”

“Not right now” returns to a calm cover state.

It does not trigger a notification, guilt message, or countdown.

### Scene 2 — The Letter, Without Obstacles

The letter opens directly.

No memory sequence, cassette, or animation must be completed first.

Display the assembled apology in a readable editorial layout.

Small section labels may help:

- “What I did.”
- “What I understand.”
- “What I will change.”

Keep the actual apology as paragraphs, not a corporate checklist.

**Persistent actions:**

- Pause here.
- Return to the cover.
- Listen, if voice exists.

### Scene 3 — In Their Own Voice

Only after the letter has been opened, offer:

“There is also a voice message, if you would like to hear it.”

**Button:** “Listen”

The cassette sits beside the letter rather than occupying the whole screen.

Playback is never automatic.

The recipient can read the transcript without playing the recording.

The creator’s voice note is not assumed to match the written letter word for word.

### Scene 4 — Something Gently Remembered

Show this only when optional memories exist.

**Copy:**

“A memory they chose to include.”

**Actions:**

- View memory.
- Skip.

Do not use celebratory motion.

Do not intensify music here.

If no memories exist, omit the scene entirely.

### Scene 5 — Room to Leave

Return to the desk.

The rain continues softly as a visual element. Rain sound is off unless deliberately enabled.

**Interface copy:**

“You can take your time. You do not need to do anything here.”

**Actions:**

- Read again.
- Return to the cover.

No reply form is required in the first release.

Do not reveal reading progress or replay counts to the sender.

### Fictional preview letter

“Jamie,

I am sorry I ended our call while you were still trying to explain what had hurt you.

That was my decision. Being frustrated does not excuse shutting you out.

I understand that it may have made you feel dismissed, especially when you were trying to have an honest conversation with me. I also know I may not understand all of its impact yet.

If I feel overwhelmed in a future conversation, I will say that clearly and ask for a pause instead of abruptly leaving. I will suggest a time to return, rather than leaving you waiting.

I care about you, and I want my actions to reflect that more reliably.

You do not need to reply before you are ready.

Taylor”

---

## 9. Shared Retro Cassette System

### Purpose

The cassette is a meaningful listening object, not a decorative animation pretending to play audio.

### Template-specific skins

| Template | Cassette design | Mood |
|---|---|---|
| Celebrating | Brushed brass deck, cream shell, occasion label | A personal toast |
| Loving | Cream portable player, walnut surface, handwritten sleeve | Familiar and everyday |
| I Am Sorry | Matte graphite player, plain paper label, minimal detail | Careful and unobtrusive |

### Required controls

- Play.
- Pause.
- Seek.
- Elapsed and total time.
- Mute or volume control where supported.
- Transcript.
- Close or minimize.

All illustrated controls must map to real semantic buttons.

### Reel behavior

- Reels start when playback actually starts.
- Reels pause when audio pauses.
- Reels stop at the end.
- Buffering does not continue the normal playing animation.
- Seeking updates the visible tape position.
- Reduced-motion mode replaces rotation with a static playing indicator.
- Audio errors show “This recording could not play” with Retry and Transcript actions.

The tape distribution may reflect playback progress. It does not need a physically exact reel simulation.

### Optional tactile details

- A brief button depression.
- A mechanical click after a user action.
- A soft indicator light.
- A slight sleeve lift when selected.

Mechanical sounds must respect the sound setting.

Do not add hiss over the creator’s recording.

### Audio priority

Only one foreground audio source plays at a time.

- Playing voice pauses other voice and video.
- Playing video pauses voice.
- Background music lowers by approximately 14 dB during foreground speech.
- If reliable ducking is unavailable, pause music instead.
- Restore music gradually after speech ends.
- Do not restart sound unexpectedly when the tab returns from the background.

Song and voice may be labeled Side A and Side B only when both exist.

If only one exists, do not show a dead second side.

### Reading pace

The recipient controls reading.

Do not:

- Automatically scroll the letter with the voice note.
- Require audio completion.
- Reveal paragraphs on a timer.
- Assume a recording is a synchronized narration.

---

## 10. Motion and Interaction Language

### Shared principles

- Motion explains a change or reinforces a feeling.
- Content appears without waiting for long animation.
- The recipient may always continue.
- No precision dragging is required.
- No scroll hijacking.
- No obligatory horizontal swipe.
- No rapid flashes.
- No motion behind long-form letter text.

### Motion specification

| Interaction | Celebrating | Loving | I Am Sorry |
|---|---|---|---|
| Scene entry | Warm light rise, 600–800 ms | Gentle curtain or light shift, 600–900 ms | Short fade, 200–350 ms |
| Card reveal | Small lift, 240 ms | Soft unfold, 280 ms | Direct reveal, 180 ms |
| Primary button | Subtle press, 120 ms | Subtle press, 120 ms | Subtle press, 120 ms |
| Letter opening | Envelope fold, 450 ms | Paper unfold, 400 ms | Simple open, 200 ms |
| Scene transition | Shared skyline/light continuity | Shared window/room continuity | Same desk composition |
| Completion | Small local light flourish | Lamp settles into warm state | No completion celebration |

### Ambient movement

Celebrating:

- Slow lantern drift.
- Occasional light shimmer.
- One restrained flourish at the occasion table.

Loving:

- Slow curtain movement.
- Soft light change.
- A subtle steam loop, if a cup is present.

I Am Sorry:

- Slow rain.
- Very slight reflected light.
- No shaking envelope, pulsing plea, or dramatic storm.

### Reduced motion

When reduced motion is requested:

- Remove parallax.
- Stop ambient loops.
- Replace scene travel with direct changes.
- Show letter content immediately.
- Keep all content and actions available.

Provide a manual “Less motion” setting as well.

---

## 11. Layout and Accessibility

### Mobile-first composition

Design from a 360-pixel viewport upward.

- One main object per scene.
- Text stays in the normal document flow.
- Media viewers respect safe areas.
- Navigation never covers the letter.
- Primary actions remain easy to reach.
- Use at least 44-by-44 CSS pixel interaction targets.
- Support browser zoom and text resizing.
- Avoid fixed-height text containers.

### Recipient navigation

Use a small, unobtrusive page-level utility area for:

- Sound.
- Less motion.
- Transcript, when relevant.
- Return to cover.

This is interface chrome, not a floating panel inside the artwork.

Do not show:

- A public lobby.
- An account dashboard.
- A world map.
- Other users.
- Related gifts.
- Ads inside the story.

### Readability

- Main body text: at least 16 pixels.
- Letter text: approximately 18–20 pixels.
- Comfortable line spacing.
- Letter width: approximately 55–70 characters on wider screens.
- Solid or sufficiently opaque paper behind long text.
- Validate actual text/background contrast combinations.

### Interaction accessibility

- Every meaningful illustrated hotspot has a keyboard equivalent.
- Focus order follows reading order.
- Focus moves predictably after a scene transition.
- Restore focus when closing a memory viewer.
- Decorative artwork is hidden from assistive technology.
- Scene headings communicate progress without requiring sight.
- Captions and transcripts are accessible without playing media.
- Never communicate “selected,” “playing,” or “failed” through color alone.

---

## 12. Content-to-Environment Mapping

| Input | Celebrating | Loving | I Am Sorry |
|---|---|---|---|
| Recipient name | Marquee and place card | Envelope and window note | Envelope and letter |
| Sender name | Invitation and toast label | Cassette and signature | Signature and voice label |
| Main answers | Dedication and wish card | Notes on room objects | Letter paragraphs |
| Image | Lantern memory and skyline point | Postcard and shelf composition | Optional small desk photograph |
| Video | Small rooftop projection screen | Vintage television frame | Optional viewer after the letter |
| Voice | Toast cassette | Sill-side cassette | Optional cassette beside letter |
| Song | Tabletop player and sleeve | Stereo and sleeve | Optional closed music sleeve |
| Final message | Celebration letter | Love letter | Assembled accountability letter |

### Composition rules

- Asset count changes layout.
- Fewer assets produce larger breathing spaces.
- More assets produce grouped arrangements, not endless repeated cards.
- Never automatically recolor personal photographs.
- Decorative colors may be selected from a safe palette, but text contrast remains fixed.
- Dates are shown only when supplied.
- Location names are shown only when supplied.
- Do not infer private facts from uploaded media.

---

## 13. Implementation Architecture

### Recommended default

If no existing application stack constrains the project:

- React and TypeScript.
- A conventional web build system.
- CSS and SVG for scene composition.
- Native browser audio/video elements.
- Web Audio only where useful for supported audio mixing.
- Server-side validation and media processing.
- Private object storage for uploads.
- A database for drafts, published versions, and invitations.

Reuse the repository’s established framework when available.

Do not introduce a real-time 3D engine for this release.

### Main modules

- `TemplatePicker`
- `CreatorShell`
- `QuestionRenderer`
- `MediaLibrary`
- `VoiceRecorder`
- `LivePreview`
- `StoryCompiler`
- `RecipientShell`
- `SceneRenderer`
- `CelebratingScenes`
- `LovingScenes`
- `SorryScenes`
- `MemoryViewer`
- `RetroCassette`
- `LetterReader`
- `AudioCoordinator`
- `AccessibilityControls`
- `DraftService`
- `PublishingService`
- `InvitationService`

### Separation of responsibilities

**Question schema**
Defines what the creator is asked.

**Content schema**
Defines validated stored answers.

**Story compiler**
Converts answers into an ordered scene model.

**Template scenes**
Render that model with template-specific composition.

**Shared media components**
Handle real playback, errors, and accessibility.

Do not embed business rules separately in every scene.

---

## 14. Core Data Contract

```ts
type TemplateId = "celebrating" | "loving" | "sorry";

type AssetKind = "image" | "video" | "voice" | "song";

type AssetRef = {
  id: string;
  kind: AssetKind;
  status: "uploading" | "processing" | "ready" | "failed";
  storageKey: string;
  title?: string;
  description?: string;
  transcript?: string;
  captionsKey?: string;
  durationSeconds?: number;
  posterKey?: string;
};

type Memory = {
  id: string;
  title: string;
  text: string;
  date?: string;
  assetIds: string[];
};

type SharedContent = {
  toName: string;
  fromName: string;
  voiceAssetId?: string;
  songAssetId?: string;
  songReason?: string;
};

type CelebrationContent = {
  occasion:
    | "birthday"
    | "anniversary"
    | "graduation"
    | "achievement"
    | "reunion"
    | "just-because"
    | "custom";
  customOccasionLabel?: string;
  occasionDate?: string;
  anniversaryYears?: number;
  spotlight: string;
  wish?: string;
  memories: Memory[];
  letter: string;
};

type LovingContent = {
  littleThings: string[];
  distanceDetail?: string;
  memories: Memory[];
  futureWish?: string;
  letter: string;
};

type SorryContent = {
  whatHappened: string;
  responsibility: string;
  impact: string;
  repairStep: string;
  timeframe?: string;
  closing: string;
  boundaryNote?: string;
  memories: Memory[];
};

type TemplateContent =
  | {
      templateId: "celebrating";
      content: CelebrationContent;
    }
  | {
      templateId: "loving";
      content: LovingContent;
    }
  | {
      templateId: "sorry";
      content: SorryContent;
    };

type Gift = SharedContent &
  TemplateContent & {
    id: string;
    ownerId: string;
    schemaVersion: 1;
    status: "draft" | "published" | "revoked";
    publishedVersion?: number;
    assets: AssetRef[];
    createdAt: string;
    updatedAt: string;
  };
```

### Validation

Runtime validation must enforce:

- Required fields.
- Character limits.
- Per-template media counts.
- Maximum memory counts.
- Asset ownership.
- Asset readiness.
- Expected media kinds.
- Custom occasion label when Custom is selected.
- Positive whole-number anniversary years when supplied.
- No unresolved example content.
- No empty required letter blocks.

A TypeScript type is not server-side validation.

Store occasion dates as date-only values when they represent a calendar day. Do not accidentally shift them through timezone conversion.

---

## 15. Story Compiler Rules

The compiler returns scenes based on actual content.

```ts
type SceneDescriptor = {
  id: string;
  componentKey: string;
  title: string;
  assetIds: string[];
  contentBindings: Record<string, unknown>;
};

type CompiledStory = {
  templateId: TemplateId;
  scenes: SceneDescriptor[];
  letterSceneId: string;
};
```

### Celebrating order

Invitation  
→ Rooftop dedication  
→ Memories, if present  
→ Listening stop, if media exists  
→ Occasion table  
→ Letter

### Loving order

Window invitation  
→ Little things  
→ Memories, if present  
→ Window/listening scene, if relevant content exists  
→ Future postcard, if present  
→ Letter

### Sorry order

Quiet invitation  
→ Letter  
→ Voice, if present  
→ Memories, if present  
→ Space to leave

Music for Sorry is a utility option, not a required chapter.

### Compiler invariants

- Every published story has a letter.
- Every displayed asset has an intentional scene placement.
- No absent optional asset creates an empty scene.
- Text-only stories remain complete.
- Recipient actions never modify the creator’s letter.
- No scene requires media playback to continue.
- The Sorry template always offers direct letter access.
- Gift content and recipient navigation state remain separate.

---

## 16. Draft, Preview, and Publishing Behavior

### Drafts

- Save answers incrementally.
- Preserve edits when moving backward.
- Show recoverable errors.
- Warn before discarding unsaved work.
- Allow removing uploads from both the story and storage.
- Do not silently place intimate answers in analytics logs.

### Preview

Use the real recipient renderer.

Preview must support:

- Mobile width.
- Desktop width.
- Reduced motion.
- Sound off.
- Long names.
- Long letters.
- No images.
- No audio.

Label creator preview as “Preview.”

Do not expose editor labels to recipients.

### Seal and publish

Before publishing, show:

- Recipient and sender.
- Template.
- Required answers.
- Media readiness.
- Full letter.
- Any optional sections that will be omitted.
- A final confirmation.

**Button:** “Seal this story”

Published content is a versioned snapshot.

Further edits create a new draft. They do not silently change an already-opened letter until the creator explicitly republishes.

### Private invitation

- Use a cryptographically random invitation token.
- Store a hash rather than the raw token where practical.
- Keep recipient access separate from creator editing access.
- Make invitations revocable.
- Serve media through authorized, short-lived access.
- Exclude invitation pages from search indexing.
- Use generic social-preview metadata without private names or message text.

A bearer link can be forwarded. Do not promise that it technically identifies the intended person.

If strict two-person access is required, add recipient verification or a separately shared access code and bind access to the recipient slot.

Creator preview must not consume recipient access.

---

## 17. Loading, Failure, and Empty States

### Initial load

Show the invitation and readable text first.

Do not wait for every memory video to download.

### Scene transitions

- Preload the next scene’s artwork.
- Keep the current scene visible until the next is ready.
- Reserve media dimensions to prevent layout jumps.
- Use a crossfade or shared object transition.
- Never show a black gap.

### Error handling

| Situation | Required behavior |
|---|---|
| Image fails | Keep memory title and text; offer Retry |
| Video fails | Show poster and a clear retry action |
| Voice fails | Keep transcript available |
| Song fails | Continue silently; do not block |
| Connection drops | Preserve currently loaded content and offer Retry |
| Upload fails | Keep form answers and allow replacing the file |
| Invitation revoked | Show a neutral unavailable page |
| Invitation invalid | Do not reveal whether names or private content exist |
| Optional media absent | Remove or redesign the related scene |
| Browser blocks playback | Keep an explicit Play action |

Never describe a technical failure as a relationship event.

Avoid error copy such as:

“They are not ready for you.”

Use:

“This page could not load. Please try again.”

---

## 18. Performance Targets

Treat these as implementation targets to verify, not guaranteed outcomes.

- Initial usable invitation: under 2.5 seconds on the agreed mobile test profile.
- Initial transfer budget: approximately 1 MB compressed, excluding user media loaded later.
- Do not preload all full-resolution images.
- Do not preload full videos before intent to watch.
- Use posters and small responsive image variants.
- Pause offscreen animations.
- Pause ambient loops when the document is hidden.
- Prefer transform and opacity animation.
- Avoid large animated blur filters.
- Keep letter reading independent of decorative rendering.
- Test on a mid-range Android phone and iPhone Safari.

Personal content and reliable audio take priority over particle effects.

---

## 19. Working Concept Deliverables

The first working concept must demonstrate all three templates through the same authoring system.

### Required creator functionality

- Choose template first.
- Enter names.
- See the correct conditional questions.
- Add, replace, reorder, and remove supported media.
- Record or upload a voice note.
- Supply a transcript.
- Save and resume a draft.
- Preview the actual recipient experience.
- Publish a private invitation.

### Required recipient functionality

- Open an invitation on mobile.
- Enter without seeing creator controls.
- Navigate every scene.
- Open real memories.
- Play, pause, and seek real audio.
- See cassette animation reflect playback state.
- Watch optional videos.
- Read the entire letter.
- Use the experience without sound.
- Use reduced motion.
- Leave without completing anything.
- Return without requiring the sender to be online.

### Fidelity requirement

Build one polished scene set for each template.

Do not spend the first milestone building:

- More occasion families.
- Avatars.
- VR.
- Public profiles.
- Live multiplayer.
- Relationship games.
- Reply scoring.
- AI-written personal memories.

### Demo content

Provide three explicitly fictional demo gifts:

- Celebrating: Maya and Alex — birthday.
- Loving: Sam and Robin — everyday affection.
- I Am Sorry: Jamie and Taylor — taking responsibility after abruptly ending a call.

Each demo must include:

- A complete written story.
- At least one playable voice fixture with transcript.
- A text-only variant.
- A missing-media test variant.

Use licensed or project-owned media fixtures.

---

## 20. Acceptance Checklist

### Product and content

- [ ] The first action is choosing a template.
- [ ] Names are requested after template selection.
- [ ] Questions change meaningfully by template.
- [ ] Celebration works for birthdays, anniversaries, milestones, reunions, and custom occasions.
- [ ] Loving does not assume the couple lives together.
- [ ] Sorry takes responsibility before showing optional memories.
- [ ] Every template works with zero images.
- [ ] Optional media can be skipped without an incomplete-looking result.
- [ ] No unresolved placeholders appear in published content.
- [ ] No fictional preview answers leak into a real gift.

### Visual distinctiveness

- [ ] The three templates are recognizable without their titles.
- [ ] Each has different composition, props, pacing, and ending.
- [ ] Personal images are not distorted by low-poly filters.
- [ ] Uploads change the scene arrangement.
- [ ] Main letters remain readable over all backgrounds.
- [ ] Decorative effects do not compete with emotional content.

### Interaction

- [ ] The cassette follows actual audio playback.
- [ ] Audio does not autoplay on invitation open.
- [ ] Voice remains clear over any music.
- [ ] Recipient reading pace is never controlled by playback.
- [ ] No media must be completed to reach the letter.
- [ ] No black transition gaps occur.
- [ ] All touch interactions have keyboard equivalents.
- [ ] Reduced motion preserves all content.

### Apology-specific

- [ ] The letter can be opened immediately.
- [ ] No action implies forgiveness.
- [ ] Rain or scenery does not “heal” when the recipient engages.
- [ ] Music starts off.
- [ ] Memories appear only after the apology.
- [ ] There are no guilt-based exit messages.
- [ ] The sender cannot see reading or replay counts.
- [ ] No reply is demanded.

### Technical

- [ ] Required fields are validated on the server.
- [ ] Media limits are enforced by template.
- [ ] Private assets cannot be fetched without authorization.
- [ ] Creator controls cannot be accessed through a recipient invitation.
- [ ] Revoked invitations stop granting access.
- [ ] Failed uploads are recoverable.
- [ ] Publishing waits for included assets to be ready.
- [ ] Published content is versioned.
- [ ] Long names and 5,000-character letters work.
- [ ] Mobile Safari and Android playback are tested.

---

## 21. Final Creative Test

Before accepting a design, ask:

### Celebrating

“Does this feel like someone prepared a particular evening for me, or like my name was inserted into a birthday website?”

### Loving

“Does this make me feel specifically noticed, or does it only tell me that love is beautiful?”

### I Am Sorry

“Does this give me a clear apology and room to feel what I feel, or does it use atmosphere to ask me for forgiveness?”

If the answer is the second option, revise the design.

---

## Final Product Principle

**Celebrating gives a moment its own night.**

**Loving gives ordinary affection a place to live.**

**I Am Sorry gives honest words room to be heard.**

The environment carries the feeling.

The personal content makes it true.

The recipient always controls the pace.