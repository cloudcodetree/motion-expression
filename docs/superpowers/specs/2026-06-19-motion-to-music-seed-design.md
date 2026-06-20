# Motion-to-Music — Seed Design

**Date:** 2026-06-19
**Status:** Approved design (seed / PoC stage)
**Author:** Chris Harper + Claude

## Vision

A person performs with their whole body in front of a camera. Their physical
actions become sound events — a foot-slam becomes a *boom*, and how hard they
slam sets how big the boom is. Meanwhile their facial/emotional expression
colors the sound — an angry face makes it an *angry* boom. It turns interpretive
dance into music.

The body decides **what note and how loud**. The face decides **what it sounds
like**. That separation is what makes "angry boom" expressible.

## Growth path (seed → redwood)

We build a seed that contains the genetics of the redwood. Every stage reuses
the same core engine (motion features → mapping → sound); each later stage only
adds a *wrapper* around it. Nothing gets thrown away.

| Stage | What it is | What it proves |
|-------|-----------|----------------|
| 🌱 Seed (this spec) | Single person records a short clip in-browser, gets a music track back synced to the video. Body motion → sound events; face emotion → sound character. | The core magic: "my movement + my feeling became music." |
| 🌿 Sapling | Same engine flipped to live/real-time mode. A few instrument/mood palettes; calibration. | Real-time feel works. |
| 🌳 Tree | Real musicality: tempo grid, scales, emotion-driven harmony; record, replay, share/export. | It sounds genuinely good. |
| 🌲 Redwood | Multiplayer game room — several performers jam together, ensemble music, play modes. | The dream. |

This spec covers the **Seed only**. Sapling/Tree/Redwood are recorded here for
direction but are explicitly out of scope.

## Approach (and alternatives considered)

**Chosen: pure browser, no backend.** Deploys as a static site; the camera feed
never leaves the device (privacy); and the same in-browser engine that renders a
recorded clip can later run continuously for live mode and stream to peers for
the game room.

Alternatives set aside:
- **Browser + Python backend for analysis** — more ML power, but adds infra and a
  network round-trip that fights the eventual real-time dream.
- **Hybrid (backend only for final high-quality render)** — premature complexity
  for a seed.

## Architecture — modules & data contracts

The system is a pipeline of six modules, each with one job, connected by simple
typed messages. The messages are the contract; the modules behind them are
swappable.

```
 Capture ──frames──▶ Sensing ──SensedFrame──▶ Features ──FeatureFrame──▶ Mapping
 (webcam)            (MediaPipe)              (kinetic +                 (the soul,
                                               affective)                swappable)
                                                                            │
                                                                     MusicalEvent
                                                                            ▼
 Playback ◀──audio── Sound Engine ◀──────────────────────────────────── (schedule)
 (video + sound)     (Tone.js)
```

### Data contracts (the seams that matter)

```ts
// Raw perception — what the camera saw this frame.
interface SensedFrame {
  t: number;                       // ms from recording start
  poseLandmarks: Landmark[];       // 33 body keypoints (normalized x,y,z + visibility)
  faceBlendshapes: Blendshape[];   // 52 expression coefficients (name, score 0..1)
}

// Meaning — what the frame means musically.
interface FeatureFrame {
  t: number;
  impacts: ImpactEvent[];          // discrete movement hits detected at/around t
  emotion: EmotionState;           // continuous affect at t
}

interface ImpactEvent {
  bodyPart: 'leftFoot' | 'rightFoot' | 'leftHand' | 'rightHand';
  position: { x: number; y: number }; // normalized screen position of the hit
  force: number;                       // peak velocity at impact, normalized 0..1
}

interface EmotionState {
  valence: number;   // -1 (negative) .. +1 (positive)
  arousal: number;   //  0 (calm) .. 1 (intense)
}

// Musical intent — instrument-agnostic description of a sound to make.
interface MusicalEvent {
  t: number;
  instrument: 'boom' | 'hit';      // seed palette (expand later)
  pitch: number;                   // semitone offset or Hz target
  velocity: number;                // loudness 0..1
  character: SoundCharacter;       // timbre shaping from emotion
}

interface SoundCharacter {
  distortion: number;   // 0..1
  detune: number;       // cents
  attack: number;       // seconds (hard vs soft)
  brightness: number;   // filter cutoff factor 0..1
}
```

**`FeatureFrame` is the most important seam.** It is the boundary between
perception (replaceable sensing tech) and intent (replaceable musical taste).
Live mode later feeds `FeatureFrame`s continuously instead of from a recording;
Mapping and Sound never know the difference.

### Module responsibilities

1. **Capture** — request webcam, run a frame loop, record the clip via
   `MediaRecorder`. Emits raw frames + records video for playback. *(browser edge)*
2. **Sensing** — run MediaPipe Pose Landmarker + Face Landmarker on each frame →
   `SensedFrame`. *(browser edge)*
3. **Features** — pure logic. Convert landmark streams into `FeatureFrame`s:
   - *Kinetic:* track limb velocity/acceleration; detect impacts (a sudden
     deceleration of a foot/hand = a hit); `force` = peak velocity before impact.
   - *Affective:* collapse the 52 blendshapes into `EmotionState`
     (valence/arousal), smoothed over a short window. **Decision point.**
4. **Mapping** — pure logic, the swappable soul. Turn `FeatureFrame`s into
   `MusicalEvent`s: body part + position → instrument/pitch; force → loudness +
   pitch-drop depth; emotion → `SoundCharacter`. **Decision point.**
5. **Sound Engine** — Tone.js instruments realize `MusicalEvent`s; emotion
   character drives distortion/detune/attack/filter. *(browser edge)*
6. **Playback** — replay recorded video while the Sound Engine fires events at
   their timestamps. *(browser edge)*

Pure modules (Features, Mapping) take plain data in and return plain data out —
no browser, MediaPipe, or Tone.js dependency — so they are unit-testable in
milliseconds and can later run live or server-side unchanged.

## Worked example — "angry foot-slam → angry boom"

1. **Kinetic detection:** the ankle landmark's downward velocity spikes, then
   snaps toward zero as it hits the floor — that deceleration is the impact.
   Detected at time `t`; `force` = peak velocity just before impact.
2. **Body → which sound:** foot impact selects the `boom` instrument. `force`
   sets loudness and how deep the pitch drops (harder = bigger).
3. **Affective read at `t`:** blendshapes (brows-down + lids-tight +
   lips-pressed) resolve to high arousal, negative valence → "angry."
4. **Emotion → character:** angry biases toward distortion, slight detune, a
   harder/faster attack, darker register. Calm softens the attack and warms the
   timbre instead.

Same physical slam, but the feeling on the face re-skins the sound: an angry
boom vs. a gentle thud.

## The PoC experience

One screen, three states:

```
┌─────────────────────────────────────────────┐
│   webcam feed with skeleton overlay          │
│   [emotion readout: angry · arousal ▓▓▓░]    │
│        ● REC        ▶ PLAY        ↻ REDO       │
└─────────────────────────────────────────────┘
```

Record-then-render loop:
1. **Idle** — camera live; skeleton + emotion readout draw so the user sees it
   sensing them (instant feedback builds trust).
2. **Record** — press REC. For up to ~20s, run Pose+Face per frame, push
   `FeatureFrame`s into an in-memory timeline, and save video via `MediaRecorder`.
3. **Render** — on stop, Mapping turns the timeline into `MusicalEvent`s.
4. **Play** — replay the recorded video while Tone.js fires each event at its
   timestamp. REDO loops back to Idle.

Record-then-render decouples timing from compute: we sense at whatever framerate
we get, then schedule sound against known timestamps. This proves the mapping is
good before we fight real-time latency.

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript | Types enforce the data contracts across module seams. |
| Build/dev | Vite | Zero-config TS, static-site output. |
| UI shell | Vanilla TS + HTML/CSS (no framework yet) | Seed is ~one screen; a framework is YAGNI now. |
| Body sensing | MediaPipe Tasks — Pose Landmarker | 33 keypoints, in-browser WebGL, no install. |
| Face/emotion | MediaPipe Tasks — Face Landmarker (52 blendshapes) | Expression coefficients → valence/arousal. |
| Sound | Tone.js (Web Audio) | Synths + effects + precise scheduling. |
| Visuals | Canvas 2D | Skeleton + impact reactions; secondary in seed. |
| Recording | MediaRecorder API + in-memory feature timeline | Replay video + fire sound in sync. |
| Testing | Vitest | Vite-native; unit-test the pure modules without a browser. |

npm deps: `@mediapipe/tasks-vision`, `tone`, plus dev tooling (`vite`, `vitest`,
`typescript`).

## Scope

**In the seed:**
- One performer, one camera.
- Record ≤20s, render, playback synced to video.
- Foot + hand impacts → booms/hits.
- Emotion → timbre character with at least two contrasting moods (e.g. angry vs.
  calm).
- Skeleton + emotion overlay.
- Unit-tested Features and Mapping modules.

**Not yet (later stages):**
- Multiplayer / game room (redwood).
- Live real-time mode (sapling).
- Full instrument library, melody from limbs.
- Fine-grained emotion palette, harmony/scales, tempo grid/quantization (tree).
- Export/share files (tree).

## Decision points (where the user's taste shapes the feel)

These are the soul of the system, not boilerplate. Each is ~5–10 lines, marked
`TODO` in code, and instantly audible:

1. **Emotion model** (Features) — how the 52 blendshapes collapse into
   valence/arousal.
2. **Mapping curves** (Mapping) — exactly how force→loudness/pitch and
   emotion→`SoundCharacter` behave.

## Testing strategy

- **Features** — feed synthetic `SensedFrame` sequences (a scripted ankle drop);
  assert an `ImpactEvent` with expected `force`; feed blendshape fixtures; assert
  expected `EmotionState`.
- **Mapping** — feed `FeatureFrame`s; assert `MusicalEvent`s (angry emotion →
  high `distortion`/short `attack`; calm → low/long).
- **Edges (Capture/Sensing/Sound/Playback)** — verified manually in-browser;
  thin by design.

## Open questions / risks

- **Impact detection robustness** — velocity-threshold onset detection may need
  tuning per framerate; mitigated by the synthetic-fixture tests.
- **Emotion stability** — raw blendshapes are jittery; smoothing window TBD
  during implementation (a decision-point detail).
- **Playback sync** — drift between recorded video element time and Tone.js
  transport; will lock sound scheduling to the video element's `currentTime`.
