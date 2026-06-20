# Motion-to-Music Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure-browser app where a person records a short clip of themselves moving, and their body motion becomes sound events whose character is colored by their facial emotion ("angry foot-slam → angry boom").

**Architecture:** A six-module pipeline connected by typed data contracts. Two pure-logic modules (Features, Mapping) convert perception into musical intent and are fully unit-tested. Four thin browser-edge modules (Capture, Sensing, Sound, Playback) handle camera, ML inference, audio synthesis, and synced playback. Record-then-render decouples timing from compute: sense at any framerate, then schedule sound against known timestamps.

**Tech Stack:** TypeScript, Vite, Vitest, MediaPipe Tasks Vision (Pose + Face Landmarker), Tone.js, Canvas 2D.

## Global Constraints

- Language: TypeScript, `strict` mode on. All module seams typed via `src/types.ts`.
- Pure-logic modules (`src/features/*`, `src/mapping/*`, `src/util.ts`) MUST NOT import `tone`, `@mediapipe/tasks-vision`, or touch `window`/`document`. They take plain data in, return plain data out.
- No backend. App builds to a static bundle (`vite build`).
- npm runtime deps limited to: `@mediapipe/tasks-vision`, `tone`. Everything else is dev tooling.
- MediaPipe Pose landmark indices (BlazePose 33): left wrist 15, right wrist 16, left ankle 27, right ankle 28.
- Test command: `npm test` (runs `vitest run`).

## File Structure

```
package.json, tsconfig.json, vite.config.ts, index.html   # Task 1
src/types.ts            # all data contracts                # Task 2
src/util.ts             # clamp / clamp01 / lerp            # Task 2
src/features/kinetic.ts # impact detection from pose        # Task 3
src/features/affective.ts # blendshapes -> EmotionState     # Task 4
src/features/timeline.ts  # SensedFrame[] -> FeatureFrame[] # Task 5
src/mapping/mapping.ts  # FeatureFrame[] -> MusicalEvent[]   # Task 6 (the soul)
src/sound/soundEngine.ts # Tone.js realization             # Task 7
src/sensing/sensing.ts  # MediaPipe -> SensedFrame          # Task 8
src/capture/capture.ts  # webcam + MediaRecorder            # Task 9
src/ui/overlay.ts       # canvas skeleton + emotion readout # Task 10
src/main.ts             # state machine wiring              # Task 11
tests/*                 # vitest specs for Tasks 3-6
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `tests/sanity.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` and `npm run dev`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "motion-expression",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@mediapipe/tasks-vision": "^0.10.14",
    "tone": "^15.0.4"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"],
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: { globals: true, environment: 'node' },
});
```

- [ ] **Step 4: Create `index.html` (placeholder, fleshed out in Task 11)**

```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Motion → Music</title></head>
  <body>
    <div id="app">scaffold ok</div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/main.ts` (temporary stub so the dev server boots)**

```ts
document.querySelector('#app')!.textContent = 'scaffold ok';
```

- [ ] **Step 6: Create `tests/sanity.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Install and run the test**

Run: `npm install && npm test`
Expected: PASS — 1 test passed.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + typescript + vitest project"
```

---

### Task 2: Data contracts & math helpers

**Files:**
- Create: `src/types.ts`, `src/util.ts`, `tests/util.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Types: `Landmark`, `Blendshape`, `SensedFrame`, `BodyPart`, `ImpactEvent`, `EmotionState`, `FeatureFrame`, `Instrument`, `SoundCharacter`, `MusicalEvent`.
  - Functions: `clamp(lo, hi, v): number`, `clamp01(v): number`, `lerp(a, b, t): number`.

- [ ] **Step 1: Create `src/types.ts`**

```ts
export interface Landmark { x: number; y: number; z: number; visibility?: number; }
export interface Blendshape { name: string; score: number; }

export interface SensedFrame {
  t: number;                    // ms from recording start
  poseLandmarks: Landmark[];    // 33 BlazePose keypoints
  faceBlendshapes: Blendshape[];// 52 expression coefficients
}

export type BodyPart = 'leftFoot' | 'rightFoot' | 'leftHand' | 'rightHand';

export interface ImpactEvent {
  bodyPart: BodyPart;
  position: { x: number; y: number };
  force: number;                // 0..1, normalized peak velocity
}

export interface EmotionState {
  valence: number;              // -1 negative .. +1 positive
  arousal: number;              //  0 calm .. 1 intense
}

export interface FeatureFrame {
  t: number;
  impacts: ImpactEvent[];
  emotion: EmotionState;
}

export type Instrument = 'boom' | 'hit';

export interface SoundCharacter {
  distortion: number;           // 0..1
  detune: number;               // cents
  attack: number;               // seconds
  brightness: number;           // 0..1 filter cutoff factor
}

export interface MusicalEvent {
  t: number;
  instrument: Instrument;
  pitch: number;                // MIDI note number
  velocity: number;             // 0..1
  character: SoundCharacter;
}
```

- [ ] **Step 2: Write the failing test `tests/util.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { clamp, clamp01, lerp } from '../src/util';

describe('util', () => {
  it('clamps within bounds', () => {
    expect(clamp(0, 10, 5)).toBe(5);
    expect(clamp(0, 10, -3)).toBe(0);
    expect(clamp(0, 10, 99)).toBe(10);
  });
  it('clamp01 restricts to 0..1', () => {
    expect(clamp01(1.4)).toBe(1);
    expect(clamp01(-0.2)).toBe(0);
  });
  it('lerps linearly', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 0, 0.5)).toBe(5);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../src/util`.

- [ ] **Step 4: Create `src/util.ts`**

```ts
export const clamp = (lo: number, hi: number, v: number): number =>
  Math.max(lo, Math.min(hi, v));

export const clamp01 = (v: number): number => clamp(0, 1, v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add data contracts and math helpers"
```

---

### Task 3: Kinetic feature extraction (impact detection)

**Files:**
- Create: `src/features/kinetic.ts`, `tests/features/kinetic.test.ts`

**Interfaces:**
- Consumes: `SensedFrame`, `ImpactEvent`, `BodyPart` from `src/types.ts`.
- Produces:
  - `interface TaggedImpact { frameIndex: number; impact: ImpactEvent; }`
  - `detectImpacts(frames: SensedFrame[], opts?: { speedThreshold?: number; decelRatio?: number }): TaggedImpact[]`

- [ ] **Step 1: Write the failing test `tests/features/kinetic.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { detectImpacts } from '../../src/features/kinetic';
import type { SensedFrame, Landmark } from '../../src/types';

// Build a frame with all 33 landmarks at center, overriding specific indices.
function frame(t: number, overrides: Record<number, { x: number; y: number }> = {}): SensedFrame {
  const poseLandmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [i, p] of Object.entries(overrides)) poseLandmarks[+i] = { x: p.x, y: p.y, z: 0 };
  return { t, poseLandmarks, faceBlendshapes: [] };
}

describe('detectImpacts', () => {
  it('detects a foot slam: fast downward motion then a sudden stop', () => {
    // index 27 = left ankle. y grows = moving down the screen.
    const frames = [
      frame(0,   { 27: { x: 0.5, y: 0.20 } }),
      frame(33,  { 27: { x: 0.5, y: 0.30 } }), // speed 0.10
      frame(66,  { 27: { x: 0.5, y: 0.45 } }), // speed 0.15
      frame(99,  { 27: { x: 0.5, y: 0.60 } }), // speed 0.15 (peak)
      frame(132, { 27: { x: 0.5, y: 0.60 } }), // speed 0.00 -> contact
      frame(165, { 27: { x: 0.5, y: 0.60 } }),
    ];
    const impacts = detectImpacts(frames);
    expect(impacts.length).toBe(1);
    expect(impacts[0].impact.bodyPart).toBe('leftFoot');
    expect(impacts[0].frameIndex).toBe(4);
    expect(impacts[0].impact.force).toBeGreaterThan(0.8);
  });

  it('produces no impacts for a still body', () => {
    const frames = [frame(0), frame(33), frame(66), frame(99)];
    expect(detectImpacts(frames)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../../src/features/kinetic`.

- [ ] **Step 3: Create `src/features/kinetic.ts`**

```ts
import type { SensedFrame, ImpactEvent, BodyPart } from '../types';

const TRACKED: { part: BodyPart; index: number }[] = [
  { part: 'leftHand', index: 15 },
  { part: 'rightHand', index: 16 },
  { part: 'leftFoot', index: 27 },
  { part: 'rightFoot', index: 28 },
];

const HARD_HIT_SPEED = 0.12; // normalized units/frame that counts as max force

export interface TaggedImpact { frameIndex: number; impact: ImpactEvent; }

export function detectImpacts(
  frames: SensedFrame[],
  opts: { speedThreshold?: number; decelRatio?: number } = {},
): TaggedImpact[] {
  const speedThreshold = opts.speedThreshold ?? 0.04;
  const decelRatio = opts.decelRatio ?? 0.4;
  const result: TaggedImpact[] = [];

  for (const { part, index } of TRACKED) {
    const speeds: number[] = [0];
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1].poseLandmarks[index];
      const b = frames[i].poseLandmarks[index];
      if (!a || !b) { speeds.push(0); continue; }
      speeds.push(Math.hypot(b.x - a.x, b.y - a.y));
    }
    for (let i = 2; i < frames.length; i++) {
      const peak = speeds[i - 1];
      const rising = peak >= speeds[i - 2];
      const collapsed = speeds[i] <= peak * decelRatio;
      if (peak >= speedThreshold && rising && collapsed) {
        const lm = frames[i].poseLandmarks[index];
        result.push({
          frameIndex: i,
          impact: {
            bodyPart: part,
            position: { x: lm.x, y: lm.y },
            force: Math.min(1, peak / HARD_HIT_SPEED),
          },
        });
      }
    }
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: detect body impacts from pose landmark velocity"
```

---

### Task 4: Affective feature extraction (emotion from face)

**Files:**
- Create: `src/features/affective.ts`, `tests/features/affective.test.ts`

**Interfaces:**
- Consumes: `Blendshape`, `EmotionState` from `src/types.ts`; `clamp`, `clamp01` from `src/util.ts`.
- Produces: `blendshapesToEmotion(bs: Blendshape[]): EmotionState`

> **Decision point:** this function is the emotion model. The weights below are a sensible first pass — they are meant to be tuned by ear/eye later. Keep the signature stable.

- [ ] **Step 1: Write the failing test `tests/features/affective.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { blendshapesToEmotion } from '../../src/features/affective';
import type { Blendshape } from '../../src/types';

const bs = (m: Record<string, number>): Blendshape[] =>
  Object.entries(m).map(([name, score]) => ({ name, score }));

describe('blendshapesToEmotion', () => {
  it('reads an angry face as high arousal, negative valence', () => {
    const e = blendshapesToEmotion(bs({
      browDownLeft: 0.9, browDownRight: 0.9, jawOpen: 0.5,
      mouthPressLeft: 0.7, mouthPressRight: 0.7,
    }));
    expect(e.arousal).toBeGreaterThan(0.6);
    expect(e.valence).toBeLessThan(-0.3);
  });

  it('reads a smile as positive valence', () => {
    const e = blendshapesToEmotion(bs({ mouthSmileLeft: 0.9, mouthSmileRight: 0.9 }));
    expect(e.valence).toBeGreaterThan(0.5);
  });

  it('reads a neutral face as near-zero valence and low arousal', () => {
    const e = blendshapesToEmotion([]);
    expect(Math.abs(e.valence)).toBeLessThan(0.1);
    expect(e.arousal).toBeLessThan(0.1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../../src/features/affective`.

- [ ] **Step 3: Create `src/features/affective.ts`**

```ts
import type { Blendshape, EmotionState } from '../types';
import { clamp, clamp01 } from '../util';

function score(bs: Blendshape[], name: string): number {
  return bs.find((b) => b.name === name)?.score ?? 0;
}

// Decision point: weights mapping facial blendshapes to valence/arousal.
export function blendshapesToEmotion(bs: Blendshape[]): EmotionState {
  const browDown = (score(bs, 'browDownLeft') + score(bs, 'browDownRight')) / 2;
  const smile = (score(bs, 'mouthSmileLeft') + score(bs, 'mouthSmileRight')) / 2;
  const frown = (score(bs, 'mouthFrownLeft') + score(bs, 'mouthFrownRight')) / 2;
  const jawOpen = score(bs, 'jawOpen');
  const eyeWide = (score(bs, 'eyeWideLeft') + score(bs, 'eyeWideRight')) / 2;
  const mouthPress = (score(bs, 'mouthPressLeft') + score(bs, 'mouthPressRight')) / 2;

  const arousal = clamp01((browDown + jawOpen + eyeWide + mouthPress) / 2.0);
  const valence = clamp(-1, 1, smile - browDown - frown);
  return { valence, arousal };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: map facial blendshapes to valence/arousal emotion"
```

---

### Task 5: Feature timeline (combine kinetic + affective)

**Files:**
- Create: `src/features/timeline.ts`, `tests/features/timeline.test.ts`

**Interfaces:**
- Consumes: `detectImpacts` (Task 3), `blendshapesToEmotion` (Task 4); types `SensedFrame`, `FeatureFrame`, `ImpactEvent`, `EmotionState`.
- Produces:
  - `movingAverageEmotion(series: EmotionState[], window: number): EmotionState[]`
  - `buildFeatureTimeline(frames: SensedFrame[], opts?: { emotionWindow?: number; kinetic?: { speedThreshold?: number; decelRatio?: number } }): FeatureFrame[]`

- [ ] **Step 1: Write the failing test `tests/features/timeline.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildFeatureTimeline, movingAverageEmotion } from '../../src/features/timeline';
import type { SensedFrame, Landmark, Blendshape } from '../../src/types';

function frame(
  t: number,
  poseOverrides: Record<number, { x: number; y: number }> = {},
  face: Record<string, number> = {},
): SensedFrame {
  const poseLandmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [i, p] of Object.entries(poseOverrides)) poseLandmarks[+i] = { x: p.x, y: p.y, z: 0 };
  const faceBlendshapes: Blendshape[] = Object.entries(face).map(([name, sc]) => ({ name, score: sc }));
  return { t, poseLandmarks, faceBlendshapes };
}

describe('movingAverageEmotion', () => {
  it('smooths a spike across the window', () => {
    const series = [
      { valence: 0, arousal: 0 },
      { valence: 1, arousal: 1 },
      { valence: 0, arousal: 0 },
    ];
    const out = movingAverageEmotion(series, 3);
    expect(out[2].valence).toBeCloseTo(1 / 3, 5);
  });
});

describe('buildFeatureTimeline', () => {
  it('emits one FeatureFrame per SensedFrame with impacts and emotion attached', () => {
    const angry = { browDownLeft: 0.9, browDownRight: 0.9, mouthPressLeft: 0.7, mouthPressRight: 0.7 };
    const frames = [
      frame(0,   { 27: { x: 0.5, y: 0.20 } }, angry),
      frame(33,  { 27: { x: 0.5, y: 0.35 } }, angry),
      frame(66,  { 27: { x: 0.5, y: 0.55 } }, angry),
      frame(99,  { 27: { x: 0.5, y: 0.55 } }, angry), // contact here
      frame(132, { 27: { x: 0.5, y: 0.55 } }, angry),
    ];
    const timeline = buildFeatureTimeline(frames, { emotionWindow: 1 });
    expect(timeline).toHaveLength(5);
    const withImpact = timeline.find((f) => f.impacts.length > 0)!;
    expect(withImpact.impacts[0].bodyPart).toBe('leftFoot');
    expect(withImpact.emotion.valence).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../../src/features/timeline`.

- [ ] **Step 3: Create `src/features/timeline.ts`**

```ts
import type { SensedFrame, FeatureFrame, ImpactEvent, EmotionState } from '../types';
import { detectImpacts } from './kinetic';
import { blendshapesToEmotion } from './affective';

export function movingAverageEmotion(series: EmotionState[], window: number): EmotionState[] {
  return series.map((_, i) => {
    const lo = Math.max(0, i - window + 1);
    const slice = series.slice(lo, i + 1);
    const valence = slice.reduce((s, e) => s + e.valence, 0) / slice.length;
    const arousal = slice.reduce((s, e) => s + e.arousal, 0) / slice.length;
    return { valence, arousal };
  });
}

export function buildFeatureTimeline(
  frames: SensedFrame[],
  opts: { emotionWindow?: number; kinetic?: { speedThreshold?: number; decelRatio?: number } } = {},
): FeatureFrame[] {
  const tagged = detectImpacts(frames, opts.kinetic);
  const impactsByFrame = new Map<number, ImpactEvent[]>();
  for (const { frameIndex, impact } of tagged) {
    const arr = impactsByFrame.get(frameIndex) ?? [];
    arr.push(impact);
    impactsByFrame.set(frameIndex, arr);
  }

  const raw = frames.map((f) => blendshapesToEmotion(f.faceBlendshapes));
  const emotion = movingAverageEmotion(raw, opts.emotionWindow ?? 5);

  return frames.map((f, i) => ({
    t: f.t,
    impacts: impactsByFrame.get(i) ?? [],
    emotion: emotion[i],
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: build feature timeline combining impacts and smoothed emotion"
```

---

### Task 6: Mapping — feature timeline to musical events (the soul)

**Files:**
- Create: `src/mapping/mapping.ts`, `tests/mapping/mapping.test.ts`

**Interfaces:**
- Consumes: types `FeatureFrame`, `ImpactEvent`, `EmotionState`, `MusicalEvent`, `Instrument`, `SoundCharacter`; `clamp01`, `lerp` from `src/util.ts`.
- Produces:
  - `emotionToCharacter(e: EmotionState): SoundCharacter`
  - `impactToEvent(t: number, impact: ImpactEvent, emotion: EmotionState): MusicalEvent`
  - `mapToMusic(timeline: FeatureFrame[]): MusicalEvent[]`

> **Decision point:** the curves in `emotionToCharacter` and the pitch logic in `impactToEvent` are where the system's musical taste lives. Tune freely; keep signatures stable.

- [ ] **Step 1: Write the failing test `tests/mapping/mapping.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { mapToMusic, impactToEvent, emotionToCharacter } from '../../src/mapping/mapping';
import type { FeatureFrame, ImpactEvent } from '../../src/types';

const footImpact: ImpactEvent = { bodyPart: 'leftFoot', position: { x: 0.5, y: 0.8 }, force: 0.9 };
const handImpact: ImpactEvent = { bodyPart: 'rightHand', position: { x: 0.5, y: 0.2 }, force: 0.5 };

describe('emotionToCharacter', () => {
  it('makes angry emotion harsh: high distortion, short attack', () => {
    const c = emotionToCharacter({ valence: -0.8, arousal: 0.9 });
    expect(c.distortion).toBeGreaterThan(0.5);
    expect(c.attack).toBeLessThan(0.03);
  });
  it('makes calm emotion soft: low distortion, long attack', () => {
    const c = emotionToCharacter({ valence: 0.4, arousal: 0.1 });
    expect(c.distortion).toBeLessThan(0.2);
    expect(c.attack).toBeGreaterThan(0.05);
  });
});

describe('impactToEvent', () => {
  it('maps a foot to a boom and force to velocity', () => {
    const e = impactToEvent(100, footImpact, { valence: 0, arousal: 0 });
    expect(e.instrument).toBe('boom');
    expect(e.velocity).toBeCloseTo(0.9, 5);
    expect(e.t).toBe(100);
  });
  it('maps a hand to a hit, higher on screen => higher pitch', () => {
    const high = impactToEvent(0, handImpact, { valence: 0, arousal: 0 });
    const low = impactToEvent(0, { ...handImpact, position: { x: 0.5, y: 0.9 } }, { valence: 0, arousal: 0 });
    expect(high.instrument).toBe('hit');
    expect(high.pitch).toBeGreaterThan(low.pitch);
  });
});

describe('mapToMusic', () => {
  it('flattens all impacts across the timeline into events', () => {
    const timeline: FeatureFrame[] = [
      { t: 0, impacts: [], emotion: { valence: 0, arousal: 0 } },
      { t: 50, impacts: [footImpact], emotion: { valence: -0.8, arousal: 0.9 } },
      { t: 80, impacts: [handImpact], emotion: { valence: 0.4, arousal: 0.1 } },
    ];
    const events = mapToMusic(timeline);
    expect(events).toHaveLength(2);
    expect(events[0].t).toBe(50);
    expect(events[0].character.distortion).toBeGreaterThan(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../../src/mapping/mapping`.

- [ ] **Step 3: Create `src/mapping/mapping.ts`**

```ts
import type {
  FeatureFrame, ImpactEvent, EmotionState, MusicalEvent, Instrument, SoundCharacter,
} from '../types';
import { clamp01, lerp } from '../util';

// Decision point: emotion -> timbre character curves.
export function emotionToCharacter(e: EmotionState): SoundCharacter {
  const negativity = 1 - (e.valence + 1) / 2; // 0 positive .. 1 negative
  const arousal = clamp01(e.arousal);
  return {
    distortion: clamp01(arousal * (0.5 + negativity * 0.5)),
    detune: negativity * arousal * 30,
    attack: lerp(0.08, 0.005, arousal),
    brightness: clamp01((e.valence + 1) / 2),
  };
}

// Decision point: body part + position -> instrument and pitch.
export function impactToEvent(t: number, impact: ImpactEvent, emotion: EmotionState): MusicalEvent {
  const isFoot = impact.bodyPart === 'leftFoot' || impact.bodyPart === 'rightFoot';
  const instrument: Instrument = isFoot ? 'boom' : 'hit';
  const basePitch = isFoot ? 36 : 60; // low boom vs. mid hit (MIDI)
  const pitch = basePitch + Math.round((1 - impact.position.y) * 12);
  return {
    t,
    instrument,
    pitch,
    velocity: clamp01(impact.force),
    character: emotionToCharacter(emotion),
  };
}

export function mapToMusic(timeline: FeatureFrame[]): MusicalEvent[] {
  const events: MusicalEvent[] = [];
  for (const frame of timeline) {
    for (const impact of frame.impacts) {
      events.push(impactToEvent(frame.t, impact, frame.emotion));
    }
  }
  return events;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: map feature timeline to musical events with emotional character"
```

---

### Task 7: Sound engine (Tone.js)

**Files:**
- Create: `src/sound/soundEngine.ts`

**Interfaces:**
- Consumes: `MusicalEvent` from `src/types.ts`; `tone`.
- Produces: `class SoundEngine` with `resume(): Promise<void>`, `schedule(events: MusicalEvent[]): void`, `start(offsetSec?: number): void`, `stop(): void`.

This is a browser-edge module (Web Audio). It is verified manually, not unit-tested.

- [ ] **Step 1: Create `src/sound/soundEngine.ts`**

```ts
import * as Tone from 'tone';
import type { MusicalEvent } from '../types';

export class SoundEngine {
  private distortion: Tone.Distortion;
  private filter: Tone.Filter;
  private boom: Tone.MembraneSynth;
  private hit: Tone.MetalSynth;

  constructor() {
    this.distortion = new Tone.Distortion(0).toDestination();
    this.filter = new Tone.Filter(2000, 'lowpass').connect(this.distortion);
    this.boom = new Tone.MembraneSynth({ octaves: 6 }).connect(this.filter);
    this.hit = new Tone.MetalSynth().connect(this.filter);
  }

  /** Must be called from a user gesture before any sound plays. */
  async resume(): Promise<void> {
    await Tone.start();
  }

  /** Schedule events (timestamps in ms) onto the transport. */
  schedule(events: MusicalEvent[]): void {
    const transport = Tone.getTransport();
    transport.cancel(0);
    for (const e of events) {
      transport.schedule((time) => this.trigger(e, time), e.t / 1000);
    }
  }

  private trigger(e: MusicalEvent, time: number): void {
    this.distortion.distortion = e.character.distortion;
    this.filter.frequency.setValueAtTime(500 + e.character.brightness * 6000, time);
    const note = Tone.Frequency(e.pitch, 'midi').toFrequency();
    const synth = e.instrument === 'boom' ? this.boom : this.hit;
    synth.set({ detune: e.character.detune, envelope: { attack: e.character.attack } });
    synth.triggerAttackRelease(note, '8n', time, e.velocity);
  }

  /** Start the transport `offsetSec` into the timeline. */
  start(offsetSec = 0): void {
    Tone.getTransport().start('+0.05', offsetSec);
  }

  stop(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Tone.js sound engine realizing musical events"
```

---

### Task 8: Sensing (MediaPipe Pose + Face)

**Files:**
- Create: `src/sensing/sensing.ts`

**Interfaces:**
- Consumes: `SensedFrame`, `Landmark`, `Blendshape` from `src/types.ts`; `@mediapipe/tasks-vision`.
- Produces: `class Sensing` with `init(): Promise<void>` and `sense(video: HTMLVideoElement, t: number): SensedFrame`.

Browser-edge module (WebGL inference). Verified manually.

- [ ] **Step 1: Create `src/sensing/sensing.ts`**

```ts
import { FilesetResolver, PoseLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';
import type { SensedFrame, Landmark, Blendshape } from '../types';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export class Sensing {
  private pose!: PoseLandmarker;
  private face!: FaceLandmarker;

  async init(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM);
    this.pose = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
    this.face = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      outputFaceBlendshapes: true,
      numFaces: 1,
    });
  }

  sense(video: HTMLVideoElement, t: number): SensedFrame {
    const poseRes = this.pose.detectForVideo(video, t);
    const faceRes = this.face.detectForVideo(video, t);

    const poseLandmarks: Landmark[] = (poseRes.landmarks[0] ?? []).map((l) => ({
      x: l.x, y: l.y, z: l.z, visibility: l.visibility,
    }));
    const faceBlendshapes: Blendshape[] = (faceRes.faceBlendshapes[0]?.categories ?? []).map((c) => ({
      name: c.categoryName, score: c.score,
    }));

    return { t, poseLandmarks, faceBlendshapes };
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add MediaPipe pose+face sensing producing SensedFrame"
```

---

### Task 9: Capture (webcam + MediaRecorder)

**Files:**
- Create: `src/capture/capture.ts`

**Interfaces:**
- Consumes: nothing from our types.
- Produces: `class Capture` with `stream: MediaStream`, `init(video: HTMLVideoElement): Promise<void>`, `startRecording(): void`, `stopRecording(): Promise<Blob>`.

Browser-edge module. Verified manually.

- [ ] **Step 1: Create `src/capture/capture.ts`**

```ts
export class Capture {
  stream!: MediaStream;
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];

  async init(video: HTMLVideoElement): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });
    video.srcObject = this.stream;
    await video.play();
  }

  startRecording(): void {
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, { mimeType: 'video/webm' });
    this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.recorder.start();
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.recorder) return resolve(new Blob());
      this.recorder.onstop = () => resolve(new Blob(this.chunks, { type: 'video/webm' }));
      this.recorder.stop();
    });
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add webcam capture and clip recording"
```

---

### Task 10: Overlay (skeleton + emotion readout)

**Files:**
- Create: `src/ui/overlay.ts`

**Interfaces:**
- Consumes: `SensedFrame`, `EmotionState` from `src/types.ts`.
- Produces: `drawOverlay(ctx: CanvasRenderingContext2D, frame: SensedFrame, emotion: EmotionState): void`

Browser-edge module (Canvas). Verified manually.

- [ ] **Step 1: Create `src/ui/overlay.ts`**

```ts
import type { SensedFrame, EmotionState } from '../types';

// BlazePose skeleton bones (landmark index pairs).
const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  frame: SensedFrame,
  emotion: EmotionState,
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,255,180,0.8)';
  ctx.fillStyle = 'rgba(0,255,180,0.9)';
  const lm = frame.poseLandmarks;

  for (const [a, b] of BONES) {
    if (!lm[a] || !lm[b]) continue;
    ctx.beginPath();
    ctx.moveTo(lm[a].x * width, lm[a].y * height);
    ctx.lineTo(lm[b].x * width, lm[b].y * height);
    ctx.stroke();
  }
  for (const p of lm) {
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const mood = emotion.valence < -0.2 ? 'angry/tense'
    : emotion.valence > 0.2 ? 'bright/happy' : 'neutral';
  const bars = Math.round(emotion.arousal * 5);
  ctx.fillStyle = 'white';
  ctx.font = '20px sans-serif';
  ctx.fillText(`mood: ${mood}   arousal: ${'▓'.repeat(bars)}${'░'.repeat(5 - bars)}`, 16, 28);
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: draw skeleton overlay and emotion readout"
```

---

### Task 11: App wiring — state machine, HTML, end-to-end

**Files:**
- Modify: `index.html` (replace placeholder body)
- Modify: `src/main.ts` (replace stub with the full app)

**Interfaces:**
- Consumes: `Capture` (Task 9), `Sensing` (Task 8), `buildFeatureTimeline` (Task 5), `mapToMusic` (Task 6), `SoundEngine` (Task 7), `drawOverlay` (Task 10), `blendshapesToEmotion` (Task 4).
- Produces: the running app (no further consumers).

Integration module. Verified manually in the browser.

- [ ] **Step 1: Replace `index.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Motion → Music</title>
    <style>
      body { margin: 0; background: #0b0b10; color: #eee; font-family: sans-serif; display: grid; place-items: center; height: 100vh; }
      #stage { position: relative; width: 640px; height: 480px; }
      #stage video, #stage canvas { position: absolute; inset: 0; width: 640px; height: 480px; transform: scaleX(-1); }
      #controls { display: flex; gap: 12px; justify-content: center; margin-top: 16px; }
      button { font-size: 16px; padding: 10px 18px; border-radius: 8px; border: 0; cursor: pointer; }
      button:disabled { opacity: 0.4; cursor: default; }
    </style>
  </head>
  <body>
    <div>
      <div id="stage">
        <video id="video" playsinline muted></video>
        <canvas id="overlay" width="640" height="480"></canvas>
      </div>
      <div id="controls">
        <button id="rec">● REC</button>
        <button id="play" disabled>▶ PLAY</button>
        <button id="redo" disabled>↻ REDO</button>
      </div>
      <p id="status">loading models…</p>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace `src/main.ts`**

```ts
import { Capture } from './capture/capture';
import { Sensing } from './sensing/sensing';
import { buildFeatureTimeline } from './features/timeline';
import { blendshapesToEmotion } from './features/affective';
import { mapToMusic } from './mapping/mapping';
import { SoundEngine } from './sound/soundEngine';
import { drawOverlay } from './ui/overlay';
import type { SensedFrame } from './types';

const MAX_RECORD_MS = 20_000;

const video = document.querySelector<HTMLVideoElement>('#video')!;
const canvas = document.querySelector<HTMLCanvasElement>('#overlay')!;
const ctx = canvas.getContext('2d')!;
const recBtn = document.querySelector<HTMLButtonElement>('#rec')!;
const playBtn = document.querySelector<HTMLButtonElement>('#play')!;
const redoBtn = document.querySelector<HTMLButtonElement>('#redo')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;

const capture = new Capture();
const sensing = new Sensing();
const sound = new SoundEngine();

let recording = false;
let frames: SensedFrame[] = [];
let recordStart = 0;
let clipUrl: string | null = null;

async function boot() {
  await capture.init(video);
  await sensing.init();
  status.textContent = 'ready — press REC and move';
  requestAnimationFrame(liveLoop);
}

// Idle/record preview loop: draw skeleton + emotion; collect frames while recording.
function liveLoop() {
  if (video.readyState >= 2 && !video.paused && video.srcObject) {
    const t = recording ? performance.now() - recordStart : performance.now();
    const sensed = sensing.sense(video, t);
    drawOverlay(ctx, sensed, blendshapesToEmotion(sensed.faceBlendshapes));
    if (recording) {
      frames.push(sensed);
      if (t >= MAX_RECORD_MS) stopRecording();
    }
  }
  if (video.srcObject) requestAnimationFrame(liveLoop);
}

async function startRecording() {
  await sound.resume();
  frames = [];
  recordStart = performance.now();
  recording = true;
  capture.startRecording();
  recBtn.textContent = '■ STOP';
  status.textContent = 'recording…';
}

async function stopRecording() {
  if (!recording) return;
  recording = false;
  recBtn.disabled = true;
  const blob = await capture.stopRecording();
  if (clipUrl) URL.revokeObjectURL(clipUrl);
  clipUrl = URL.createObjectURL(blob);

  const timeline = buildFeatureTimeline(frames);
  const events = mapToMusic(timeline);
  sound.schedule(events);

  status.textContent = `rendered ${events.length} sound events — press PLAY`;
  recBtn.textContent = '● REC';
  playBtn.disabled = false;
  redoBtn.disabled = false;
}

function play() {
  if (!clipUrl) return;
  // Switch the video element from the live camera to the recorded clip.
  video.srcObject = null;
  video.src = clipUrl;
  video.muted = true;
  video.currentTime = 0;
  video.play();
  sound.start(0);
  status.textContent = 'playing your performance';
}

function redo() {
  sound.stop();
  if (clipUrl) { URL.revokeObjectURL(clipUrl); clipUrl = null; }
  video.removeAttribute('src');
  video.srcObject = capture.stream;
  video.muted = true;
  video.play();
  playBtn.disabled = true;
  redoBtn.disabled = true;
  recBtn.disabled = false;
  status.textContent = 'ready — press REC and move';
  requestAnimationFrame(liveLoop);
}

recBtn.addEventListener('click', () => { recording ? stopRecording() : startRecording(); });
playBtn.addEventListener('click', play);
redoBtn.addEventListener('click', redo);

boot().catch((err) => { status.textContent = `error: ${err.message}`; });
```

- [ ] **Step 3: Type-check the whole app**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual end-to-end verification**

Run: `npm run dev`, open the served URL in Chrome, grant camera access.
Verify, in order:
1. Skeleton overlay tracks your body; the emotion readout changes when you scowl vs. smile.
2. Press REC, stamp a foot hard with an angry face, stop.
3. Status shows a non-zero sound-event count.
4. Press PLAY — the recorded clip replays and you hear a boom at the foot-stamp, with a harsher timbre than the same stamp made with a calm face.
5. REDO returns to the live preview.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire end-to-end record-then-render motion-to-music app"
```

---

## Self-Review

**Spec coverage:**
- Vision (body→event, face→character) → Tasks 3, 4, 6, 11. ✓
- Six-module pipeline → Capture (9), Sensing (8), Features (3,4,5), Mapping (6), Sound (7), Playback (in 11). ✓
- Data contracts → Task 2. ✓
- "Angry foot-slam → angry boom" worked example → Tasks 3 (impact+force), 4 (emotion), 6 (character), verified in 11 Step 4. ✓
- PoC screen + record→render loop → Task 11. ✓
- Tech stack (TS, Vite, MediaPipe, Tone.js, Canvas, Vitest) → Tasks 1, 7, 8, 10. ✓
- Decision points (emotion model, mapping curves) → flagged in Tasks 4 and 6. ✓
- Testing strategy (synthetic SensedFrame fixtures; angry→distortion assertions) → Tasks 3, 4, 5, 6. ✓
- Scope "not yet" items (multiplayer, live, export, scales) → excluded; no tasks. ✓
- Risk: playback sync → addressed by locking sound start to playback start in Task 11 `play()`.

**Placeholder scan:** No TBD/TODO-as-work. The two `Decision point` notes mark tunable values that already have working defaults — not missing work.

**Type consistency:** `SensedFrame`, `FeatureFrame`, `ImpactEvent`, `EmotionState`, `MusicalEvent`, `SoundCharacter` used identically across Tasks 2–11. `detectImpacts` returns `TaggedImpact[]` (Task 3) and is consumed as such in Task 5. `blendshapesToEmotion`, `mapToMusic`, `buildFeatureTimeline`, `SoundEngine.{resume,schedule,start,stop}`, `drawOverlay`, `Capture.{init,startRecording,stopRecording,stream}`, `Sensing.{init,sense}` names match between producer and consumer tasks.
