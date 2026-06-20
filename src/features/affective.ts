import type { Blendshape, EmotionState } from '../types';
import { clamp, clamp01 } from '../util';

function score(bs: Blendshape[], name: string): number {
  return bs.find((b) => b.name === name)?.score ?? 0;
}

// Decision point: weights mapping facial blendshapes to valence/arousal.
// This is the performer's feeling made measurable — tune by eye/ear.
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
