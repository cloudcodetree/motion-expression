import { Capture } from './capture/capture';
import { Sensing } from './sensing/sensing';
import { buildFeatureTimeline } from './features/timeline';
import { blendshapesToEmotion } from './features/affective';
import { mapToMusic } from './mapping/mapping';
import { SoundEngine } from './sound/soundEngine';
import { drawOverlay } from './ui/overlay';
import type { SensedFrame, Landmark } from './types';

const MAX_RECORD_MS = 20_000;

const video = document.querySelector<HTMLVideoElement>('#video')!;
const canvas = document.querySelector<HTMLCanvasElement>('#overlay')!;
const ctx = canvas.getContext('2d')!;
const recBtn = document.querySelector<HTMLButtonElement>('#rec')!;
const playBtn = document.querySelector<HTMLButtonElement>('#play')!;
const redoBtn = document.querySelector<HTMLButtonElement>('#redo')!;
const testBtn = document.querySelector<HTMLButtonElement>('#test')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const flashEl = document.querySelector<HTMLDivElement>('#flash')!;
const diagEl = document.querySelector<HTMLPreElement>('#diag')!;

const capture = new Capture();
const sensing = new Sensing();
const sound = new SoundEngine();

let recording = false;
let frames: SensedFrame[] = [];
let recordStart = 0;
let clipUrl: string | null = null;

// --- diagnostics ---
let eventCount = 0;
let playedCount = 0;
let lastEvent = '—';
let senseErrors = 0;
let lastError = '';

// Live motion meter: per body part, the fastest motion seen this take and the
// current tracking confidence. Reveals whether a part is even detected and how
// fast it moves — the data we need to tune detection for phone framing.
let prevLM: Landmark[] | null = null;
const maxSpeed = { head: 0, hand: 0, foot: 0 };
const curVis = { head: 0, hand: 0, foot: 0 };

function updateMotion(sensed: SensedFrame) {
  const lm = sensed.poseLandmarks;
  if (prevLM && lm.length) {
    const sp = (i: number) =>
      prevLM![i] && lm[i] ? Math.hypot(lm[i].x - prevLM![i].x, lm[i].y - prevLM![i].y) : 0;
    maxSpeed.head = Math.max(maxSpeed.head, sp(0));
    maxSpeed.hand = Math.max(maxSpeed.hand, sp(15), sp(16));
    maxSpeed.foot = Math.max(maxSpeed.foot, sp(27), sp(28));
    const vis = (i: number) => lm[i]?.visibility ?? -1;
    curVis.head = vis(0);
    curVis.hand = Math.max(vis(15), vis(16));
    curVis.foot = Math.max(vis(27), vis(28));
  }
  prevLM = lm.length ? lm : prevLM;
}

function resetMotion() {
  prevLM = null;
  maxSpeed.head = maxSpeed.hand = maxSpeed.foot = 0;
}

const f3 = (n: number) => n.toFixed(3);
const f2 = (n: number) => n.toFixed(2);

function renderDiag() {
  diagEl.textContent =
    `audio:   ${sound.audioState()}\n` +
    `frames:  ${frames.length} captured\n` +
    `events:  ${eventCount} scheduled\n` +
    `played:  ${playedCount}\n` +
    `last:    ${lastEvent}\n` +
    `errors:  ${senseErrors}${lastError ? ' — ' + lastError : ''}\n` +
    `motion (maxSpeed / trackConf):\n` +
    `  head ${f3(maxSpeed.head)} / ${f2(curVis.head)}\n` +
    `  hand ${f3(maxSpeed.hand)} / ${f2(curVis.hand)}\n` +
    `  foot ${f3(maxSpeed.foot)} / ${f2(curVis.foot)}`;
}

function flash() {
  flashEl.classList.add('on');
  setTimeout(() => flashEl.classList.remove('on'), 110);
}

sound.onTrigger = (e) => {
  playedCount++;
  lastEvent = `${e.instrument} pitch${e.pitch} vel${e.velocity.toFixed(2)} dist${e.character.distortion.toFixed(2)}`;
  flash();
  renderDiag();
};

setInterval(renderDiag, 500); // keep the audio-state line fresh

async function boot() {
  await capture.init(video);
  await sensing.init();
  status.textContent = 'ready — press REC and move';
  requestAnimationFrame(liveLoop);
}

// Idle/record preview loop: draw skeleton + emotion; collect frames while recording.
function liveLoop() {
  if (video.readyState >= 2 && !video.paused && video.srcObject) {
    try {
      const t = recording ? performance.now() - recordStart : performance.now();
      const sensed = sensing.sense(video, t);
      updateMotion(sensed);
      drawOverlay(ctx, sensed, blendshapesToEmotion(sensed.faceBlendshapes));
      if (recording) {
        frames.push(sensed);
        if (t >= MAX_RECORD_MS) stopRecording();
      }
    } catch (err) {
      // A single bad frame must not kill the loop — record it and keep going.
      senseErrors++;
      lastError = (err as Error).message;
    }
  }
  if (video.srcObject) requestAnimationFrame(liveLoop);
}

async function startRecording() {
  await sound.resume();
  frames = [];
  resetMotion();
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

  eventCount = events.length;
  playedCount = 0;
  renderDiag();
  status.textContent = events.length
    ? `rendered ${events.length} sound events — press PLAY`
    : `no impacts detected in ${frames.length} frames — try bigger/faster claps closer to the camera`;
  recBtn.textContent = '● REC';
  playBtn.disabled = false;
  redoBtn.disabled = false;
}

async function play() {
  if (!clipUrl) return;
  await sound.resume(); // re-unlock audio on mobile (context may have suspended)
  playedCount = 0;
  renderDiag();
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
  eventCount = 0;
  playedCount = 0;
  lastEvent = '—';
  renderDiag();
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
testBtn.addEventListener('click', async () => {
  await sound.resume();
  sound.testBeep();
  flash();
  status.textContent = 'test beep fired — did you hear it?';
  renderDiag();
});

boot().catch((err) => { status.textContent = `error: ${err.message}`; });
