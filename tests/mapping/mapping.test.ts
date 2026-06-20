import { describe, it, expect } from 'vitest';
import { mapToMusic, impactToEvent, emotionToCharacter } from '../../src/mapping/mapping';
import type { FeatureFrame, ImpactEvent } from '../../src/types';

const footImpact: ImpactEvent = { bodyPart: 'leftFoot', position: { x: 0.5, y: 0.8 }, force: 0.9 };
const handImpact: ImpactEvent = { bodyPart: 'rightHand', position: { x: 0.5, y: 0.2 }, force: 0.5 };

describe('emotionToCharacter', () => {
  it('makes angry emotion harsh: high distortion, short attack', () => {
    const c = emotionToCharacter({ valence: -0.8, arousal: 0.9 });
    expect(c.distortion).toBeGreaterThan(0.5);
    expect(c.attack).toBeLessThan(0.03);
  });
  it('makes calm emotion soft: low distortion, long attack', () => {
    const c = emotionToCharacter({ valence: 0.4, arousal: 0.1 });
    expect(c.distortion).toBeLessThan(0.2);
    expect(c.attack).toBeGreaterThan(0.05);
  });
});

describe('impactToEvent', () => {
  it('maps a foot to a boom and force to velocity', () => {
    const e = impactToEvent(100, footImpact, { valence: 0, arousal: 0 });
    expect(e.instrument).toBe('boom');
    expect(e.velocity).toBeCloseTo(0.9, 5);
    expect(e.t).toBe(100);
  });
  it('maps a hand to a hit, higher on screen => higher pitch', () => {
    const high = impactToEvent(0, handImpact, { valence: 0, arousal: 0 });
    const low = impactToEvent(0, { ...handImpact, position: { x: 0.5, y: 0.9 } }, { valence: 0, arousal: 0 });
    expect(high.instrument).toBe('hit');
    expect(high.pitch).toBeGreaterThan(low.pitch);
  });
});

describe('mapToMusic', () => {
  it('flattens all impacts across the timeline into events', () => {
    const timeline: FeatureFrame[] = [
      { t: 0, impacts: [], emotion: { valence: 0, arousal: 0 } },
      { t: 50, impacts: [footImpact], emotion: { valence: -0.8, arousal: 0.9 } },
      { t: 80, impacts: [handImpact], emotion: { valence: 0.4, arousal: 0.1 } },
    ];
    const events = mapToMusic(timeline);
    expect(events).toHaveLength(2);
    expect(events[0].t).toBe(50);
    expect(events[0].character.distortion).toBeGreaterThan(0.5);
  });
});
