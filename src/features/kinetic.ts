import type { SensedFrame, ImpactEvent, BodyPart } from '../types';

const TRACKED: { part: BodyPart; index: number }[] = [
  { part: 'head', index: 0 }, // nose — the one point always in frame on a phone selfie
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
  const speedThreshold = opts.speedThreshold ?? 0.025;
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
      // An impact is a frame where the limb was moving fast and then its speed
      // suddenly collapses (contact). The collapse alone is the signal — a real
      // slam may ease slightly before impact, so we do NOT require a strict
      // monotonic rise into the peak (that was both wrong and float-fragile).
      const peak = speeds[i - 1];
      const collapsed = speeds[i] <= peak * decelRatio;
      if (peak >= speedThreshold && collapsed) {
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
