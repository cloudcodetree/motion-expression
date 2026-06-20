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
