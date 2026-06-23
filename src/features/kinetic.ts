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
  opts: { speedThreshold?: number; refractoryFrames?: number } = {},
): TaggedImpact[] {
  const speedThreshold = opts.speedThreshold ?? 0.015;
  const refractoryFrames = opts.refractoryFrames ?? 4;
  const result: TaggedImpact[] = [];

  for (const { part, index } of TRACKED) {
    const speeds: number[] = [0];
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1].poseLandmarks[index];
      const b = frames[i].poseLandmarks[index];
      speeds.push(a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0);
    }
    // An impact is a LOCAL MAXIMUM of speed above threshold — the moment the
    // limb is moving fastest. MediaPipe smooths landmarks, so a real motion is a
    // gentle bump that never "collapses" in one frame; peak-picking fires on the
    // burst regardless of how gradually it decays. A refractory gap stops a
    // single gesture from registering several times.
    let lastImpact = -Infinity;
    for (let i = 1; i < frames.length - 1; i++) {
      const isPeak = speeds[i] >= speeds[i - 1] && speeds[i] > speeds[i + 1];
      if (isPeak && speeds[i] >= speedThreshold && i - lastImpact >= refractoryFrames) {
        const lm = frames[i].poseLandmarks[index];
        result.push({
          frameIndex: i,
          impact: {
            bodyPart: part,
            position: { x: lm.x, y: lm.y },
            force: Math.min(1, speeds[i] / HARD_HIT_SPEED),
          },
        });
        lastImpact = i;
      }
    }
  }
  return result;
}
