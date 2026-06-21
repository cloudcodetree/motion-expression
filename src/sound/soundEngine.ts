import * as Tone from 'tone';
import type { MusicalEvent } from '../types';

export class SoundEngine {
  private distortion: Tone.Distortion;
  private filter: Tone.Filter;
  private boom: Tone.MembraneSynth;
  private hit: Tone.MetalSynth;

  /** Called (synced to playback) each time an event sounds — for diagnostics. */
  onTrigger?: (e: MusicalEvent) => void;

  constructor() {
    this.distortion = new Tone.Distortion(0).toDestination();
    this.filter = new Tone.Filter(2000, 'lowpass').connect(this.distortion);
    this.boom = new Tone.MembraneSynth({ octaves: 6 }).connect(this.filter);
    this.hit = new Tone.MetalSynth().connect(this.filter);
  }

  /** Must be called from a user gesture before any sound plays. */
  async resume(): Promise<void> {
    await Tone.start();
  }

  /** Current AudioContext state: 'running' | 'suspended' | 'closed'. */
  audioState(): string {
    return Tone.getContext().state;
  }

  /** Immediate, clean beep to confirm the audio path works, independent of detection. */
  testBeep(): void {
    this.distortion.distortion = 0;
    this.filter.frequency.value = 4000;
    this.boom.set({ detune: 0, envelope: { attack: 0.005 } });
    this.boom.triggerAttackRelease('C2', '8n', Tone.now(), 0.9);
  }

  /** Schedule events (timestamps in ms) onto the transport. */
  schedule(events: MusicalEvent[]): void {
    const transport = Tone.getTransport();
    transport.cancel(0);
    for (const e of events) {
      transport.schedule((time) => this.trigger(e, time), e.t / 1000);
    }
  }

  private trigger(e: MusicalEvent, time: number): void {
    this.distortion.distortion = e.character.distortion;
    this.filter.frequency.setValueAtTime(500 + e.character.brightness * 6000, time);
    const note = Tone.Frequency(e.pitch, 'midi').toFrequency();
    const synth = e.instrument === 'boom' ? this.boom : this.hit;
    synth.set({ detune: e.character.detune, envelope: { attack: e.character.attack } });
    synth.triggerAttackRelease(note, '8n', time, e.velocity);
    // Fire the diagnostic callback in visual sync with the sound.
    Tone.getDraw().schedule(() => this.onTrigger?.(e), time);
  }

  /** Start the transport `offsetSec` into the timeline. */
  start(offsetSec = 0): void {
    Tone.getTransport().start('+0.05', offsetSec);
  }

  stop(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
  }
}
