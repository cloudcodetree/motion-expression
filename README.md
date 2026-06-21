# Motion → Music

Turn interpretive dance into music. A person performs with their whole body on
camera; their **movement becomes sound events** (a foot-slam becomes a *boom*,
harder = bigger) and their **facial emotion colors the sound** (an angry face
makes it an *angry* boom).

> **North star:** *a child who wishes for the power of a god — to make people
> feel what they feel.* This is a feeling-transmitter: the shortest path from one
> person's inner state to another's chest. The body is the verb, the face is the
> feeling, the sound is the spell.

**Live demo:** https://cloudcodetree.com/motion-expression/
(Chrome recommended; it asks for camera access and runs entirely in your browser
— no video ever leaves your device.)

## How it works

A six-module pipeline connected by typed data contracts:

```
Capture ─▶ Sensing ─▶ Features ─▶ Mapping ─▶ Sound Engine ─▶ Playback
(webcam)  (MediaPipe) (impacts +  (the soul)  (Tone.js)
                       emotion)
```

- **Body → what & how loud:** impact detection from pose-landmark velocity.
- **Face → what it sounds like:** facial blendshapes collapse into a
  valence/arousal emotion that shapes timbre (distortion, detune, attack,
  brightness).

The pure-logic core (`src/features`, `src/mapping`) carries no browser, ML, or
audio dependency, so it is unit-tested in milliseconds and could later run live
or server-side unchanged.

## Develop

```bash
npm install
npm run dev        # local dev server (open in Chrome, grant camera)
npm test           # unit tests for the pure-logic core
npm run typecheck  # type-check the whole app
npm run build      # static production bundle in dist/
```

> Note: npm scripts call `./node_modules/.bin/<tool>` explicitly because this
> project's working directory name contains a colon, which breaks `PATH`-based
> binary lookup. On CI (clean checkout) this is harmless.

## Roadmap (seed → redwood)

- 🌱 **Seed** (this) — record a clip, get music back, single player.
- 🌿 **Sapling** — same engine, live real-time mode.
- 🌳 **Tree** — tempo grid, scales, emotion-driven harmony, export/share.
- 🌲 **Redwood** — multiplayer game room; performers jam together.

Design and plan live in [`docs/superpowers/`](docs/superpowers/).

## License

MIT
