export const clamp = (lo: number, hi: number, v: number): number =>
  Math.max(lo, Math.min(hi, v));

export const clamp01 = (v: number): number => clamp(0, 1, v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
