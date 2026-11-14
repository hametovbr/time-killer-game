/** Tiny synthesized sound kit (WebAudio, no asset files). */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastShot = 0;
  private lastPop = 0;
  private lastGate = 0;
  private lastHit = 0;
  enabled = true;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq = 1200) {
    if (!this.enabled || !this.ctx || !this.master) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  private now() {
    return performance.now();
  }

  shot(weapon: number) {
    const n = this.now();
    if (n - this.lastShot < (weapon >= 4 ? 70 : 50)) return;
    this.lastShot = n;
    if (weapon === 5) this.tone(1400, 0.06, 'sine', 0.035, 600);
    else if (weapon === 2) this.noise(0.07, 0.18, 700);
    else this.tone(240 + weapon * 40 + Math.random() * 30, 0.045, 'square', 0.03, 120);
  }
  gate(good: boolean) {
    if (good) {
      this.tone(523, 0.08, 'triangle', 0.12);
      this.tone(784, 0.14, 'triangle', 0.12, 1047, 0.06);
    } else this.tone(300, 0.25, 'sawtooth', 0.08, 110);
  }
  tick() {
    const n = this.now();
    if (n - this.lastGate < 60) return;
    this.lastGate = n;
    this.tone(1200 + Math.random() * 200, 0.03, 'square', 0.02);
  }
  pop() {
    const n = this.now();
    if (n - this.lastPop < 45) return;
    this.lastPop = n;
    this.noise(0.07, 0.25, 600 + Math.random() * 700);
  }
  hurt() {
    const n = this.now();
    if (n - this.lastHit < 70) return;
    this.lastHit = n;
    this.tone(180, 0.12, 'sawtooth', 0.08, 80);
  }
  thud() {
    const n = this.now();
    if (n - this.lastHit < 90) return;
    this.lastHit = n;
    this.tone(100, 0.07, 'sine', 0.12, 60);
  }
  powerup() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.09, 'square', 0.05, undefined, i * 0.05));
  }
  roar() {
    this.tone(70, 0.7, 'sawtooth', 0.14, 45);
    this.noise(0.6, 0.25, 220);
  }
  boom() {
    this.noise(0.35, 0.6, 300);
    this.tone(70, 0.4, 'sine', 0.3, 35);
  }
  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, undefined, i * 0.1));
  }
  lose() {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.1, f * 0.9, i * 0.15));
  }
  click() {
    this.tone(660, 0.05, 'triangle', 0.08);
  }
  buy() {
    this.tone(660, 0.07, 'square', 0.06);
    this.tone(990, 0.12, 'square', 0.06, undefined, 0.06);
  }
}
