import { W, H, COLORS, LANES, LANE_W, ROAD_L, ROAD_R, SQUAD_Y } from './constants';
import { WEAPONS } from './balance';
import { gateLabel, type Sim } from './sim';
import type { Fx } from './fx';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  scale = 1;
  offX = 0;
  offY = 0;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(vw * this.dpr);
    this.canvas.height = Math.round(vh * this.dpr);
    this.canvas.style.width = vw + 'px';
    this.canvas.style.height = vh + 'px';
    this.scale = Math.min(vw / W, vh / H);
    this.offX = (vw - W * this.scale) / 2;
    this.offY = (vh - H * this.scale) / 2;
  }

  /** Client x (CSS px) → world x. */
  toWorldX(clientX: number): number {
    return (clientX - this.offX) / this.scale;
  }

  draw(sim: Sim, fx: Fx, time: number) {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = COLORS.grassDark;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    let sx = 0;
    let sy = 0;
    if (fx.shake > 0) {
      sx = (Math.random() - 0.5) * fx.shake;
      sy = (Math.random() - 0.5) * fx.shake;
    }
    const k = this.scale * this.dpr;
    // Extend drawing beyond the 400×720 box so tall/wide screens show more scenery.
    c.setTransform(k, 0, 0, k, (this.offX + sx * this.scale) * this.dpr, (this.offY + sy * this.scale) * this.dpr);
    const extraTop = this.offY / this.scale + 20;
    const extraSide = this.offX / this.scale + 20;

    this.drawRoad(sim, extraTop, extraSide);
    const sy0 = (z: number) => SQUAD_Y - (z - sim.dist);

    // Draw back-to-front (far objects first).
    this.drawBoss(sim, sy0(sim.boss.z));
    for (const cr of sim.crates) if (cr.alive) this.drawCrate(cr, sy0(cr.z));
    this.drawGates(sim, sy0, extraTop);
    this.drawEnemies(sim, sy0, extraTop);
    this.drawBullets(sim, sy0);
    this.drawSquad(sim, time);
    this.drawFx(fx, sim);
    void time;

    if (fx.flash > 0) {
      c.globalAlpha = fx.flash * 0.45;
      c.fillStyle = fx.flashColor;
      c.fillRect(-extraSide, -extraTop, W + extraSide * 2, H + extraTop * 2);
      c.globalAlpha = 1;
    }
  }

  private rr(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  private label(text: string, x: number, y: number, size: number, color = '#fff', stroke = 'rgba(0,0,0,0.5)') {
    const c = this.ctx;
    c.font = `900 ${size}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = Math.max(2, size * 0.2);
    c.strokeStyle = stroke;
    c.strokeText(text, x, y);
    c.fillStyle = color;
    c.fillText(text, x, y);
  }

  private drawRoad(sim: Sim, extraTop: number, extraSide: number) {
    const c = this.ctx;
    const top = -extraTop;
    const bottom = H + extraTop;
    c.fillStyle = COLORS.grass;
    c.fillRect(-extraSide, top, W + extraSide * 2, bottom - top);
    // grass stripes
    c.fillStyle = COLORS.grassDark;
    const stripe = 80;
    const off = sim.dist % (stripe * 2);
    for (let y = top - stripe * 2 + off; y < bottom; y += stripe * 2) c.fillRect(-extraSide, y, W + extraSide * 2, stripe);
    // road
    c.fillStyle = COLORS.road;
    c.fillRect(ROAD_L, top, ROAD_R - ROAD_L, bottom - top);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.fillRect(ROAD_L - 4, top, 4, bottom - top);
    c.fillRect(ROAD_R, top, 4, bottom - top);
    // dashed lane separators
    c.fillStyle = COLORS.laneLine;
    const dash = 46;
    const doff = sim.dist % (dash * 2);
    for (const x of [140, 260]) {
      for (let y = top - dash * 2 + doff; y < bottom; y += dash * 2) c.fillRect(x - 2, y, 4, dash);
    }
    // Finish line at the end of the track.
    const fy = SQUAD_Y - (sim.level.length - sim.dist);
    if (fy > top - 20 && fy < bottom) {
      for (let i = 0; i < 18; i++) {
        c.fillStyle = i % 2 ? '#fff' : '#222';
        c.fillRect(ROAD_L + i * 20, fy, 20, 10);
        c.fillStyle = i % 2 ? '#222' : '#fff';
        c.fillRect(ROAD_L + i * 20, fy + 10, 20, 10);
      }
    }
  }

  private drawGates(sim: Sim, sy: (z: number) => number, extraTop: number) {
    const c = this.ctx;
    for (const g of sim.gates) {
      const y = sy(g.z);
      if (y < -extraTop - 60 || y > H + 60) continue;
      if (g.done && y > SQUAD_Y + 30) continue;
      const good = g.op === '+' || g.op === 'x' ? g.val >= 0 : false;
      const x = LANES[g.lane];
      const w = LANE_W - 8;
      const h = 46;
      const base = good ? COLORS.good : COLORS.bad;
      const dark = good ? COLORS.goodDark : COLORS.badDark;
      c.globalAlpha = g.done ? 0.35 : 0.55;
      c.fillStyle = base;
      this.rr(x - w / 2, y - h, w, h, 6);
      c.fill();
      c.globalAlpha = 1;
      if (g.flash > 0) {
        c.globalAlpha = g.flash * 0.6;
        c.fillStyle = '#fff';
        this.rr(x - w / 2, y - h, w, h, 6);
        c.fill();
        c.globalAlpha = 1;
      }
      c.strokeStyle = dark;
      c.lineWidth = 3;
      this.rr(x - w / 2, y - h, w, h, 6);
      c.stroke();
      // posts
      c.fillStyle = dark;
      c.fillRect(x - w / 2 - 3, y - h - 6, 6, h + 10);
      c.fillRect(x + w / 2 - 3, y - h - 6, 6, h + 10);
      this.label(gateLabel(g), x, y - h / 2 + 1, 24 + g.flash * 5);
      if (g.shootable && !g.done) this.label('🎯', x + w / 2 - 12, y - h + 9, 11);
    }
  }

  private drawCrate(cr: { lane: number; kind: string; hp: number; maxHp: number; flash: number }, y: number) {
    if (y < -120 || y > H + 60) return;
    const c = this.ctx;
    const x = LANES[cr.lane] + (cr.flash > 0 ? (Math.random() - 0.5) * 4 : 0);
    const w = 64;
    const h = 52;
    c.fillStyle = 'rgba(0,0,0,0.3)';
    this.rr(x - w / 2 + 3, y - h + 6, w, h, 6);
    c.fill();
    c.fillStyle = cr.flash > 0.5 ? '#f0c890' : cr.kind === 'weapon' ? '#b9783a' : '#7a5bd6';
    this.rr(x - w / 2, y - h, w, h, 6);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x - w / 2 + 4, y - h + 4);
    c.lineTo(x + w / 2 - 4, y - 4);
    c.moveTo(x + w / 2 - 4, y - h + 4);
    c.lineTo(x - w / 2 + 4, y - 4);
    c.stroke();
    this.label(cr.kind === 'weapon' ? '🔫' : '⭐', x, y - h / 2 - 6, 22);
    this.label(`${Math.ceil(cr.hp)}`, x, y - 12, 15);
  }

  private drawEnemies(sim: Sim, sy: (z: number) => number, extraTop: number) {
    const c = this.ctx;
    for (const e of sim.enemies) {
      if (!e.alive) continue;
      const y = sy(e.z);
      if (y < -extraTop - 40 || y > H + 40) continue;
      const r = e.big ? 20 : 10;
      const x = e.x + Math.sin(e.wobble) * 1.5;
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath();
      c.ellipse(x + 2, y + r * 0.7, r, r * 0.45, 0, 0, Math.PI * 2);
      c.fill();
      // arms reaching forward (towards the squad)
      c.strokeStyle = COLORS.enemyDark;
      c.lineWidth = e.big ? 6 : 3.5;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x - r * 0.6, y);
      c.lineTo(x - r * 0.8, y + r * 1.1 + Math.sin(e.wobble) * 2);
      c.moveTo(x + r * 0.6, y);
      c.lineTo(x + r * 0.8, y + r * 1.1 - Math.sin(e.wobble) * 2);
      c.stroke();
      c.fillStyle = e.flash > 0.5 ? '#ffffff' : e.chase ? '#c3e04a' : COLORS.enemy;
      c.strokeStyle = COLORS.enemyDark;
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      // eyes
      c.fillStyle = '#ff3b3b';
      c.beginPath();
      c.arc(x - r * 0.35, y + r * 0.15, r * 0.18, 0, Math.PI * 2);
      c.arc(x + r * 0.35, y + r * 0.15, r * 0.18, 0, Math.PI * 2);
      c.fill();
      if (e.big || e.hp < e.maxHp) {
        const bw = e.big ? 40 : 22;
        c.fillStyle = 'rgba(0,0,0,0.5)';
        c.fillRect(x - bw / 2, y - r - 9, bw, 4);
        c.fillStyle = '#ff5a5a';
        c.fillRect(x - bw / 2, y - r - 9, bw * Math.max(0, e.hp / e.maxHp), 4);
      }
      if (e.big) this.label(`${e.power}`, x, y - 2, 13);
    }
  }

  private drawBoss(sim: Sim, y: number) {
    if (y < -200 || y > H + 100) return;
    const c = this.ctx;
    const b = sim.boss;
    const x = W / 2;
    const r = 70;
    const bob = Math.sin(sim.t * 4) * 3;
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(x, y + 10, r * 1.6, 22, 0, 0, Math.PI * 2);
    c.fill();
    // arms
    c.strokeStyle = '#5a1a2a';
    c.lineWidth = 22;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - r * 0.8, y - r * 0.5);
    c.lineTo(x - r * 1.6, y + 10 + bob);
    c.moveTo(x + r * 0.8, y - r * 0.5);
    c.lineTo(x + r * 1.6, y + 10 - bob);
    c.stroke();
    c.fillStyle = b.flash > 0.5 ? '#ffd0d8' : '#c2304d';
    c.strokeStyle = '#5a1a2a';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(x, y - r * 0.6 + bob, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // face
    c.fillStyle = '#ffe36b';
    c.beginPath();
    c.arc(x - 24, y - r * 0.6 + bob + 4, 11, 0, Math.PI * 2);
    c.arc(x + 24, y - r * 0.6 + bob + 4, 11, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2a0a12';
    this.rr(x - 26, y - r * 0.6 + bob + 26, 52, 14, 6);
    c.fill();
    // horns
    c.fillStyle = '#eee';
    c.beginPath();
    c.moveTo(x - 50, y - r * 1.2 + bob);
    c.lineTo(x - 62, y - r * 1.75 + bob);
    c.lineTo(x - 30, y - r * 1.4 + bob);
    c.moveTo(x + 50, y - r * 1.2 + bob);
    c.lineTo(x + 62, y - r * 1.75 + bob);
    c.lineTo(x + 30, y - r * 1.4 + bob);
    c.fill();
    // HP bar
    const bw = 220;
    const by = y - r * 1.95;
    c.fillStyle = 'rgba(0,0,0,0.55)';
    this.rr(x - bw / 2, by, bw, 14, 7);
    c.fill();
    c.fillStyle = '#ff4d6a';
    this.rr(x - bw / 2, by, Math.max(8, bw * Math.max(0, b.hp / b.maxHp)), 14, 7);
    c.fill();
    this.label(`${Math.ceil(b.hp)}`, x, by + 7, 13);
    this.label(sim.level.type === 'boss' ? '👑 БОСС' : 'БОСС', x, by - 14, 15, '#ffd54a');
  }

  private drawBullets(sim: Sim, sy: (z: number) => number) {
    const c = this.ctx;
    const w = WEAPONS[sim.weapon];
    c.strokeStyle = w.color;
    c.lineWidth = sim.weapon === 5 ? 4 : 3;
    c.lineCap = 'round';
    c.beginPath();
    for (const b of sim.bullets) {
      if (!b.alive) continue;
      const y = sy(b.z);
      c.moveTo(b.x, y);
      c.lineTo(b.x, y + (sim.weapon === 5 ? 34 : 16));
    }
    c.stroke();
  }

  private drawSquad(sim: Sim, time: number) {
    const c = this.ctx;
    const n = Math.min(sim.count, 48);
    if (sim.count <= 0) return;
    // Hex-ish formation growing backwards from the front.
    const cols = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(n * 1.3))));
    const sp = 15;
    const run = Math.sin(time * 18);
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const inRow = Math.min(cols, n - row * cols);
      const x = sim.squadX + (col - (inRow - 1) / 2) * sp + (row % 2 ? 3 : -3);
      const y = SQUAD_Y + 10 + row * 13 + ((i % 2 ? run : -run) * 1.5);
      pts.push([x, y]);
    }
    // shadows
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath();
    for (const [x, y] of pts) {
      c.moveTo(x + 8, y + 6);
      c.ellipse(x + 1, y + 6, 7, 3.5, 0, 0, Math.PI * 2);
    }
    c.fill();
    // guns
    const w = WEAPONS[sim.weapon];
    c.strokeStyle = '#222';
    c.lineWidth = sim.weapon >= 4 ? 4 : 3;
    c.beginPath();
    for (const [x, y] of pts) {
      c.moveTo(x + 4, y - 2);
      c.lineTo(x + 4, y - 14 + sim.recoil * 2);
    }
    c.stroke();
    // bodies
    c.fillStyle = COLORS.friendDark;
    c.beginPath();
    for (const [x, y] of pts) {
      c.moveTo(x + 7.5, y);
      c.arc(x, y, 7.5, 0, Math.PI * 2);
    }
    c.fill();
    c.fillStyle = sim.rank >= 3 ? '#ffd54a' : COLORS.friend;
    c.beginPath();
    for (const [x, y] of pts) {
      c.moveTo(x + 6, y - 1);
      c.arc(x, y - 1, 6, 0, Math.PI * 2);
    }
    c.fill();
    // muzzle flash
    if (sim.recoil > 0.6) {
      c.fillStyle = w.color;
      c.beginPath();
      for (const [x, y] of pts.slice(0, cols)) {
        c.moveTo(x + 7, y - 16);
        c.arc(x + 4, y - 16, 3, 0, Math.PI * 2);
      }
      c.fill();
    }
    // count badge
    const bx = sim.squadX;
    const by = SQUAD_Y - 18;
    c.fillStyle = 'rgba(15,20,45,0.85)';
    this.rr(bx - 26, by - 13, 52, 26, 13);
    c.fill();
    this.label(`${sim.count}`, bx, by + 1, 17, '#fff', 'rgba(0,0,0,0)');
  }

  private drawFx(fx: Fx, sim: Sim) {
    const c = this.ctx;
    void sim;
    for (const p of fx.particles) {
      const a = p.life / p.max;
      c.globalAlpha = a;
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.r * (0.4 + a * 0.6), 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    for (const t of fx.texts) {
      const a = t.life / t.max;
      const pop = a > 0.8 ? 1 + (a - 0.8) * 2.5 : 1;
      c.globalAlpha = Math.min(1, a * 1.6);
      this.label(t.text, t.x, t.y, t.size * pop, t.color);
    }
    c.globalAlpha = 1;
  }
}
