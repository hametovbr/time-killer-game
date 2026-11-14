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

  shot() {
    const n = this.now();
    if (n - this.lastShot < 60) return;
    this.lastShot = n;
    this.tone(320 + Math.random() * 40, 0.05, 'square', 0.04, 180);
  }
  gate(mult: number, good: boolean) {
    const n = this.now();
    if (n - this.lastGate < 70) return;
    this.lastGate = n;
    if (good) this.tone(440 + mult * 110, 0.09, 'triangle', 0.09, 700 + mult * 140);
    else this.tone(300, 0.12, 'sawtooth', 0.05, 140);
  }
  pop() {
    const n = this.now();
    if (n - this.lastPop < 45) return;
    this.lastPop = n;
    this.noise(0.06, 0.25, 900 + Math.random() * 900);
  }
  enemyBaseHit() {
    const n = this.now();
    if (n - this.lastHit < 80) return;
    this.lastHit = n;
    this.tone(110, 0.08, 'sine', 0.18, 70);
  }
  playerBaseHit() {
    this.tone(160, 0.25, 'sawtooth', 0.12, 60);
  }
  champReady() {
    this.tone(523, 0.1, 'triangle', 0.12);
    this.tone(784, 0.16, 'triangle', 0.12, undefined, 0.09);
  }
  champLaunch() {
    this.tone(90, 0.4, 'sawtooth', 0.15, 200);
  }
  boom() {
    this.noise(0.35, 0.6, 300);
    this.tone(70, 0.4, 'sine', 0.3, 35);
  }
  coin() {
    const n = this.now();
    if (n - this.lastPop < 50) return;
    this.lastPop = n;
    this.tone(988, 0.06, 'square', 0.04);
    this.tone(1319, 0.1, 'square', 0.04, undefined, 0.05);
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
