import { describe, it, expect } from 'vitest';
import { clamp, clamp01, lerp } from '../src/util';

describe('util', () => {
  it('clamps within bounds', () => {
    expect(clamp(0, 10, 5)).toBe(5);
    expect(clamp(0, 10, -3)).toBe(0);
    expect(clamp(0, 10, 99)).toBe(10);
  });
  it('clamp01 restricts to 0..1', () => {
    expect(clamp01(1.4)).toBe(1);
    expect(clamp01(-0.2)).toBe(0);
  });
  it('lerps linearly', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 0, 0.5)).toBe(5);
  });
});
