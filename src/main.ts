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
