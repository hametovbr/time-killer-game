/** Visual-only effects: particles, floating text, shake, flash, hit-stop. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
}
export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
}

const MAX_PARTICLES = 700;

export class Fx {
  particles: Particle[] = [];
  texts: FloatText[] = [];
  shake = 0;
  flash = 0;
  flashColor = '#fff';
  hitStop = 0;
  reduceShake = false;
  /** Lightning bolts (polylines in screen space) and explosion rings. */
  bolts: { pts: [number, number][]; life: number }[] = [];
  rings: { x: number; y: number; r: number; life: number }[] = [];

  bolt(pts: [number, number][]) {
    if (this.bolts.length > 20) this.bolts.shift();
    this.bolts.push({ pts, life: 0.18 });
  }
  ring(x: number, y: number, r: number) {
    if (this.rings.length > 30) this.rings.shift();
    this.rings.push({ x, y, r, life: 0.3 });
  }

  burst(x: number, y: number, color: string, count: number, speed = 90, size = 2.5) {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const life = 0.25 + Math.random() * 0.35;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, r: size * (0.6 + Math.random() * 0.8), color });
    }
  }

  text(x: number, y: number, text: string, color: string, size = 22) {
    if (this.texts.length > 24) this.texts.shift();
    this.texts.push({ x, y, text, color, life: 0.9, max: 0.9, size });
  }

  addShake(amount: number) {
    this.shake = Math.min(14, this.shake + (this.reduceShake ? amount * 0.3 : amount));
  }

  addHitStop(ms: number) {
    this.hitStop = Math.max(this.hitStop, ms / 1000);
  }

  /** scroll: world scroll speed so effects stick to the track. */
  update(dt: number, scroll = 0) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt + scroll * dt;
      p.vx *= 1 - dt * 3;
      p.vy *= 1 - dt * 3;
      p.life -= dt;
    }
    if (this.particles.some((p) => p.life <= 0)) this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.y -= 40 * dt - scroll * dt * 0.5;
      t.life -= dt;
    }
    if (this.texts.some((t) => t.life <= 0)) this.texts = this.texts.filter((t) => t.life > 0);
    for (const b of this.bolts) {
      b.life -= dt;
      for (const p of b.pts) p[1] += scroll * dt;
    }
    if (this.bolts.some((b) => b.life <= 0)) this.bolts = this.bolts.filter((b) => b.life > 0);
    for (const r of this.rings) {
      r.life -= dt;
      r.y += scroll * dt;
    }
    if (this.rings.some((r) => r.life <= 0)) this.rings = this.rings.filter((r) => r.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  clear() {
    this.particles = [];
    this.texts = [];
    this.bolts = [];
    this.rings = [];
    this.shake = this.flash = this.hitStop = 0;
  }
}
