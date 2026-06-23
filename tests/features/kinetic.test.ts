import { describe, it, expect } from 'vitest';
import { detectImpacts } from '../../src/features/kinetic';
import type { SensedFrame, Landmark } from '../../src/types';

// Build a frame with all 33 landmarks at center, overriding specific indices.
function frame(t: number, overrides: Record<number, { x: number; y: number }> = {}): SensedFrame {
  const poseLandmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [i, p] of Object.entries(overrides)) poseLandmarks[+i] = { x: p.x, y: p.y, z: 0 };
  return { t, poseLandmarks, faceBlendshapes: [] };
}

describe('detectImpacts', () => {
  it('detects a foot slam: fast downward motion then a sudden stop', () => {
    // index 27 = left ankle. y grows = moving down the screen. One clear speed peak.
    const frames = [
      frame(0,   { 27: { x: 0.5, y: 0.20 } }),
      frame(33,  { 27: { x: 0.5, y: 0.30 } }), // speed 0.10
      frame(66,  { 27: { x: 0.5, y: 0.50 } }), // speed 0.20 (peak)
      frame(99,  { 27: { x: 0.5, y: 0.58 } }), // speed 0.08
      frame(132, { 27: { x: 0.5, y: 0.58 } }), // speed 0.00
    ];
    const impacts = detectImpacts(frames);
    expect(impacts.length).toBe(1);
    expect(impacts[0].impact.bodyPart).toBe('leftFoot');
    expect(impacts[0].frameIndex).toBe(2); // the peak frame
    expect(impacts[0].impact.force).toBeGreaterThan(0.8);
  });

  it('detects a smooth motion bump with NO sharp stop (smoothed landmarks)', () => {
    // Gradual rise and gradual fall — like MediaPipe's temporally smoothed output.
    // index 16 = right wrist.
    const ys = [0.20, 0.25, 0.32, 0.40, 0.45, 0.47, 0.47];
    const frames = ys.map((y, i) => frame(i * 33, { 16: { x: 0.5, y } }));
    const impacts = detectImpacts(frames);
    expect(impacts.length).toBe(1);
    expect(impacts[0].impact.bodyPart).toBe('rightHand');
  });

  it('detects a head jab: nose moves fast then stops', () => {
    // index 0 = nose. Always in frame on a phone selfie, so it's a reliable trigger.
    const frames = [
      frame(0,   { 0: { x: 0.5, y: 0.30 } }),
      frame(33,  { 0: { x: 0.5, y: 0.36 } }), // speed 0.06
      frame(66,  { 0: { x: 0.5, y: 0.44 } }), // speed 0.08 (peak)
      frame(99,  { 0: { x: 0.5, y: 0.44 } }), // stop -> contact
      frame(132, { 0: { x: 0.5, y: 0.44 } }),
    ];
    const impacts = detectImpacts(frames);
    expect(impacts.length).toBe(1);
    expect(impacts[0].impact.bodyPart).toBe('head');
  });

  it('produces no impacts for a still body', () => {
    const frames = [frame(0), frame(33), frame(66), frame(99)];
    expect(detectImpacts(frames)).toEqual([]);
  });
});
