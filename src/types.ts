export interface Landmark { x: number; y: number; z: number; visibility?: number; }
export interface Blendshape { name: string; score: number; }

export interface SensedFrame {
  t: number;                    // ms from recording start
  poseLandmarks: Landmark[];    // 33 BlazePose keypoints
  faceBlendshapes: Blendshape[];// 52 expression coefficients
}

export type BodyPart = 'head' | 'leftFoot' | 'rightFoot' | 'leftHand' | 'rightHand';

export interface ImpactEvent {
  bodyPart: BodyPart;
  position: { x: number; y: number };
  force: number;                // 0..1, normalized peak velocity
}

export interface EmotionState {
  valence: number;              // -1 negative .. +1 positive
  arousal: number;              //  0 calm .. 1 intense
}

export interface FeatureFrame {
  t: number;
  impacts: ImpactEvent[];
  emotion: EmotionState;
}

export type Instrument = 'boom' | 'hit';

export interface SoundCharacter {
  distortion: number;           // 0..1
  detune: number;               // cents
  attack: number;               // seconds
  brightness: number;           // 0..1 filter cutoff factor
}

export interface MusicalEvent {
  t: number;
  instrument: Instrument;
  pitch: number;                // MIDI note number
  velocity: number;             // 0..1
  character: SoundCharacter;
}
