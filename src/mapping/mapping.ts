import type {
  FeatureFrame, ImpactEvent, EmotionState, MusicalEvent, Instrument, SoundCharacter,
} from '../types';
import { clamp01, lerp } from '../util';

// Decision point: emotion -> timbre character curves. This is where feeling
// becomes audible — the bar is "a listener feels it," not "a sound fired."
export function emotionToCharacter(e: EmotionState): SoundCharacter {
  const negativity = 1 - (e.valence + 1) / 2; // 0 positive .. 1 negative
  const arousal = clamp01(e.arousal);
  return {
    distortion: clamp01(arousal * (0.5 + negativity * 0.5)),
    detune: negativity * arousal * 30,
    attack: lerp(0.08, 0.005, arousal),
    brightness: clamp01((e.valence + 1) / 2),
  };
}

// Decision point: body part + position -> instrument and pitch.
export function impactToEvent(t: number, impact: ImpactEvent, emotion: EmotionState): MusicalEvent {
  const isFoot = impact.bodyPart === 'leftFoot' || impact.bodyPart === 'rightFoot';
  const instrument: Instrument = isFoot ? 'boom' : 'hit';
  const basePitch = isFoot ? 36 : 60; // low boom vs. mid hit (MIDI)
  const pitch = basePitch + Math.round((1 - impact.position.y) * 12);
  return {
    t,
    instrument,
    pitch,
    velocity: clamp01(impact.force),
    character: emotionToCharacter(emotion),
  };
}

export function mapToMusic(timeline: FeatureFrame[]): MusicalEvent[] {
  const events: MusicalEvent[] = [];
  for (const frame of timeline) {
    for (const impact of frame.impacts) {
      events.push(impactToEvent(frame.t, impact, frame.emotion));
    }
  }
  return events;
}
