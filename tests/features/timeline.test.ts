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
