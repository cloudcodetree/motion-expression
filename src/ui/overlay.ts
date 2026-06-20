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
