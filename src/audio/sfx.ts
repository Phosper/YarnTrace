/**
 * Every sound is synthesised on the fly, so the game ships no audio files.
 * The context is created on the first user gesture, as browsers require.
 */
const SCALE = [0, 2, 4, 7, 9];
const ROOT = 261.63;
const TOP_STEP = 14;

type Ctor = typeof AudioContext;

export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  unlock(): void {
    if (!this.enabled) return;
    if (!this.ctx) {
      const Ctx: Ctor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
      if (!Ctx) return;
      try {
        this.ctx = new Ctx();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      const length = Math.floor(this.ctx.sampleRate * 0.3);
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(
    type: OscillatorType,
    from: number,
    to: number,
    gain: number,
    seconds: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled) return;
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + seconds);
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(gain, at + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    osc.connect(amp).connect(this.master);
    osc.start(at);
    osc.stop(at + seconds + 0.03);
  }

  private swish(frequency: number, gain: number, seconds: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise || !this.enabled) return;
    const at = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(frequency, at);
    filter.frequency.exponentialRampToValueAtTime(frequency * 2.6, at + seconds);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, at);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    src.connect(filter).connect(amp).connect(this.master);
    src.start(at);
    src.stop(at + seconds + 0.02);
  }

  /** A pluck that climbs a pentatonic scale as the streak grows. */
  pop(streak: number): void {
    const step = Math.min(TOP_STEP, Math.max(0, streak));
    const semis = Math.floor(step / SCALE.length) * 12 + SCALE[step % SCALE.length];
    const f = ROOT * 2 ** (semis / 12);
    this.tone('triangle', f, f, 0.34, 0.2);
    this.tone('sine', f * 2, f * 2, 0.1, 0.14);
    this.swish(1500, 0.07, 0.11);
  }

  thud(): void {
    this.tone('sine', 170, 62, 0.5, 0.17);
    this.tone('square', 96, 70, 0.06, 0.06);
  }

  tick(): void {
    this.tone('sine', 880, 880, 0.08, 0.05);
  }

  win(): void {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this.tone('triangle', f, f, 0.3, 0.5, i * 0.085);
      this.tone('sine', f * 2, f * 2, 0.08, 0.4, i * 0.085);
    });
  }

  star(index: number): void {
    const f = 880 * 2 ** ((index * 4) / 12);
    this.tone('sine', f, f, 0.26, 0.42);
    this.tone('triangle', f * 2, f * 2, 0.07, 0.3);
  }
}

export function buzz(enabled: boolean, pattern: number | number[]): void {
  if (!enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* vibration blocked */
  }
}
