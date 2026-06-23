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
  opts: { emotionWindow?: number; kinetic?: { speedThreshold?: number; refractoryFrames?: number } } = {},
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
