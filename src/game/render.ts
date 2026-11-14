import { W, H, COLORS, ENEMY_BASE_BOTTOM, PLAYER_BASE_TOP, CANNON_Y } from './constants';
import { spinnerEnds, type Sim } from './sim';
import type { Fx } from './fx';

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

  /** Convert a client (CSS px) x coordinate to world x. */
  toWorldX(clientX: number): number {
    return (clientX - this.offX) / this.scale;
  }

  draw(sim: Sim, fx: Fx, time: number) {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#141830';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);

    let sx = 0;
    let sy = 0;
    if (fx.shake > 0) {
      sx = (Math.random() - 0.5) * fx.shake;
      sy = (Math.random() - 0.5) * fx.shake;
    }
    const k = this.scale * this.dpr;
    c.setTransform(k, 0, 0, k, (this.offX + sx * this.scale) * this.dpr, (this.offY + sy * this.scale) * this.dpr);

    this.drawTrack(sim, time);
    this.drawEnemyBase(sim, fx);
    this.drawPlayerBase(sim, fx);
    for (const s of sim.spinners) this.drawSpinnerShadow(s);
    this.drawGates(sim);
    this.drawWalls(sim);
    this.drawUnits(sim);
    this.drawSpinners(sim);
    this.drawCannon(sim);
    this.drawFx(fx);

    if (fx.flash > 0) {
      c.globalAlpha = fx.flash * 0.5;
      c.fillStyle = fx.flashColor;
      c.fillRect(-20, -20, W + 40, H + 40);
      c.globalAlpha = 1;
    }
  }

  private drawTrack(sim: Sim, time: number) {
    const c = this.ctx;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2b2347');
    g.addColorStop(1, '#22305a');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // Moving chevrons to suggest flow.
    c.strokeStyle = COLORS.trackLine;
    c.lineWidth = 3;
    const off = (time * 40) % 40;
    for (let y = H - off; y > 0; y -= 40) {
      c.beginPath();
      c.moveTo(W / 2 - 20, y + 8);
      c.lineTo(W / 2, y);
      c.lineTo(W / 2 + 20, y + 8);
      c.stroke();
    }
    // Side rails.
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(0, 0, 4, H);
    c.fillRect(W - 4, 0, 4, H);
    if (sim.level.type === 'bonus') {
      c.fillStyle = 'rgba(255,200,61,0.06)';
      c.fillRect(0, 0, W, H);
    }
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  private label(text: string, x: number, y: number, size: number, color = '#fff', stroke = 'rgba(0,0,0,0.45)') {
    const c = this.ctx;
    c.font = `900 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = Math.max(2, size * 0.18);
    c.strokeStyle = stroke;
    c.strokeText(text, x, y);
    c.fillStyle = color;
    c.fillText(text, x, y);
  }

  private drawEnemyBase(sim: Sim, fx: Fx) {
    const c = this.ctx;
    const boss = sim.level.type === 'boss';
    const bonus = sim.level.type === 'bonus';
    const punch = fx.enemyBasePunch;
    const w = (boss ? 330 : 280) + punch * 10;
    const h = 72 + punch * 4;
    const x = W / 2 - w / 2;
    const y = ENEMY_BASE_BOTTOM - h;
    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.3)';
    this.roundRect(x + 4, y + 8, w, h, 14);
    c.fill();
    if (bonus) {
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#ffe07a');
      g.addColorStop(1, '#d99a12');
      c.fillStyle = g;
      this.roundRect(x, y, w, h, 14);
      c.fill();
      this.label('💰 КОПИЛКА', W / 2, y + 24, 20, '#fff');
      this.label(`${sim.collected}`, W / 2, y + 52, 26, '#fff');
      return;
    }
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, boss ? '#7a1e3a' : '#e04a5f');
    g.addColorStop(1, boss ? '#3d0c1f' : '#9b2338');
    c.fillStyle = g;
    this.roundRect(x, y, w, h, 14);
    c.fill();
    // Crenellations
    c.fillStyle = boss ? '#5a1430' : '#b8344a';
    for (let i = 0; i < 7; i++) {
      const bx = x + 10 + i * ((w - 20) / 7);
      c.fillRect(bx, y - 10, (w - 20) / 7 - 8, 12);
    }
    // Gate opening
    c.fillStyle = 'rgba(0,0,0,0.35)';
    this.roundRect(W / 2 - 22, y + h - 30, 44, 30, 10);
    c.fill();
    // HP bar
    const ratio = Math.max(0, sim.enemyHp / sim.enemyHpMax);
    c.fillStyle = 'rgba(0,0,0,0.45)';
    this.roundRect(x + 16, y + 10, w - 32, 10, 5);
    c.fill();
    c.fillStyle = '#ffe36b';
    this.roundRect(x + 16, y + 10, Math.max(6, (w - 32) * ratio), 10, 5);
    c.fill();
    this.label(`${Math.ceil(sim.enemyHp)}`, W / 2, y + 40, 26 + punch * 6);
    if (boss) this.label('👑 БОСС', W / 2, y - 22, 16, '#ffd54a');
  }

  private drawPlayerBase(sim: Sim, fx: Fx) {
    const c = this.ctx;
    const p = fx.playerBasePunch;
    const y = PLAYER_BASE_TOP + p * 3;
    const g = c.createLinearGradient(0, y, 0, H);
    g.addColorStop(0, '#3a8fe0');
    g.addColorStop(1, '#1d4f8f');
    c.fillStyle = g;
    this.roundRect(10, y, W - 20, H - y + 20, 16);
    c.fill();
    if (p > 0) {
      c.fillStyle = `rgba(255,60,60,${p * 0.6})`;
      this.roundRect(10, y, W - 20, H - y + 20, 16);
      c.fill();
    }
    // HP bar
    const ratio = Math.max(0, sim.playerHp / sim.playerHpMax);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    this.roundRect(40, y + 30, W - 80, 10, 5);
    c.fill();
    c.fillStyle = ratio > 0.35 ? '#5cff9a' : '#ff6b6b';
    this.roundRect(40, y + 30, Math.max(6, (W - 80) * ratio), 10, 5);
    c.fill();
    this.label(`♥ ${Math.max(0, Math.ceil(sim.playerHp))}`, W / 2, y + 16, 15);
  }

  private drawGates(sim: Sim) {
    const c = this.ctx;
    for (const g of sim.gates) {
      const good = g.kind === 'mul';
      const base = g.gold ? COLORS.gold : good ? COLORS.good : COLORS.bad;
      const dark = g.gold ? COLORS.goldDark : good ? COLORS.goodDark : COLORS.badDark;
      const s = 1 + g.pulse * 0.12;
      const w = g.w * s;
      const h = 30 * s;
      const x = g.cx - w / 2;
      const y = g.y - h / 2;
      if (g.move) {
        c.strokeStyle = 'rgba(255,255,255,0.12)';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(g.x - g.move.amp - g.w / 2, g.y + 18);
        c.lineTo(g.x + g.move.amp + g.w / 2, g.y + 18);
        c.stroke();
      }
      c.globalAlpha = 0.85;
      c.fillStyle = dark;
      this.roundRect(x, y + 4, w, h, 9);
      c.fill();
      c.fillStyle = base;
      this.roundRect(x, y, w, h, 9);
      c.fill();
      c.globalAlpha = 1;
      // Gloss
      c.fillStyle = 'rgba(255,255,255,0.22)';
      this.roundRect(x + 4, y + 3, w - 8, h * 0.38, 6);
      c.fill();
      // Posts
      c.fillStyle = dark;
      c.fillRect(x - 3, y - 6, 6, h + 12);
      c.fillRect(x + w - 3, y - 6, 6, h + 12);
      this.label(`${good ? '×' : '÷'}${g.n}`, g.cx, g.y + 1, 20 * s);
    }
  }

  private drawWalls(sim: Sim) {
    const c = this.ctx;
    for (const w of sim.walls) {
      if (w.hp <= 0) continue;
      const x = w.x - w.w / 2 + (w.hit > 0 ? (Math.random() - 0.5) * 3 : 0);
      const y = w.y - w.h / 2;
      c.fillStyle = COLORS.wallDark;
      this.roundRect(x, y + 5, w.w, w.h, 6);
      c.fill();
      c.fillStyle = w.hit > 0.5 ? '#c9cff0' : COLORS.wall;
      this.roundRect(x, y, w.w, w.h, 6);
      c.fill();
      // bricks
      c.strokeStyle = 'rgba(0,0,0,0.18)';
      c.lineWidth = 1.5;
      for (let bx = x + 18; bx < x + w.w - 4; bx += 22) {
        c.beginPath();
        c.moveTo(bx, y + 2);
        c.lineTo(bx, y + w.h - 2);
        c.stroke();
      }
      this.label(`${w.hp}`, w.x, w.y + 1, 16);
    }
  }

  private drawSpinnerShadow(s: { x: number; y: number }) {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath();
    c.arc(s.x + 3, s.y + 6, 14, 0, Math.PI * 2);
    c.fill();
  }

  private drawSpinners(sim: Sim) {
    const c = this.ctx;
    for (const s of sim.spinners) {
      const [x1, y1, x2, y2] = spinnerEnds(s);
      c.lineCap = 'round';
      c.strokeStyle = '#3a2a10';
      c.lineWidth = 12;
      c.beginPath();
      c.moveTo(x1, y1 + 3);
      c.lineTo(x2, y2 + 3);
      c.stroke();
      c.strokeStyle = '#ffb02e';
      c.lineWidth = 10;
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
      c.setLineDash([6, 6]);
      c.strokeStyle = '#222';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#ddd';
      c.beginPath();
      c.arc(s.x, s.y, 8, 0, Math.PI * 2);
      c.fill();
    }
  }

  private drawBlobs(list: { x: number; y: number; r: number; alive: boolean; giant: boolean }[], fill: string, dark: string) {
    const c = this.ctx;
    // Shadow pass, outline pass, fill pass — 3 paths total regardless of unit count.
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.beginPath();
    for (const u of list) {
      if (!u.alive || u.giant) continue;
      c.moveTo(u.x + 1 + u.r, u.y + 3);
      c.arc(u.x + 1, u.y + 3, u.r, 0, Math.PI * 2);
    }
    c.fill();
    c.fillStyle = dark;
    c.beginPath();
    for (const u of list) {
      if (!u.alive || u.giant) continue;
      c.moveTo(u.x + u.r + 1, u.y);
      c.arc(u.x, u.y, u.r + 1, 0, Math.PI * 2);
    }
    c.fill();
    c.fillStyle = fill;
    c.beginPath();
    for (const u of list) {
      if (!u.alive || u.giant) continue;
      c.moveTo(u.x + u.r - 0.5, u.y - 0.8);
      c.arc(u.x, u.y - 0.8, u.r - 0.5, 0, Math.PI * 2);
    }
    c.fill();
  }

  private drawGiant(x: number, y: number, r: number, fill: string, dark: string, hp: number, crown: boolean) {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath();
    c.arc(x + 2, y + 5, r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = dark;
    c.beginPath();
    c.arc(x, y, r + 2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = fill;
    c.beginPath();
    c.arc(x, y - 1.5, r, 0, Math.PI * 2);
    c.fill();
    // eyes
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(x - r * 0.35, y - r * 0.25, r * 0.22, 0, Math.PI * 2);
    c.arc(x + r * 0.35, y - r * 0.25, r * 0.22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#111';
    c.beginPath();
    c.arc(x - r * 0.35, y - r * 0.3, r * 0.1, 0, Math.PI * 2);
    c.arc(x + r * 0.35, y - r * 0.3, r * 0.1, 0, Math.PI * 2);
    c.fill();
    if (crown) this.label('👑', x, y - r - 6, r * 0.9);
    this.label(`${Math.ceil(hp)}`, x, y + r * 0.35, Math.max(10, r * 0.75));
  }

  private drawUnits(sim: Sim) {
    this.drawBlobs(sim.enemies, COLORS.enemy, COLORS.enemyDark);
    this.drawBlobs(sim.units, COLORS.friend, COLORS.friendDark);
    for (const e of sim.enemies) if (e.alive && e.giant) this.drawGiant(e.x, e.y, e.r, COLORS.enemy, COLORS.enemyDark, e.hp, false);
    for (const ch of sim.champions) if (ch.alive) this.drawGiant(ch.x, ch.y, ch.r, '#6fd0ff', COLORS.friendDark, ch.hp, true);
  }

  private drawCannon(sim: Sim) {
    const c = this.ctx;
    const x = sim.cannonX;
    const y = CANNON_Y;
    const rec = sim.cannonRecoil * 4;
    // rail
    c.fillStyle = 'rgba(0,0,0,0.3)';
    this.roundRect(16, y + 10, W - 32, 8, 4);
    c.fill();
    // shadow
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(x + 2, y + 14, 26, 9, 0, 0, Math.PI * 2);
    c.fill();
    // barrel
    c.fillStyle = '#2b3a67';
    this.roundRect(x - 9, y - 34 + rec, 18, 34, 6);
    c.fill();
    c.fillStyle = '#4a63a8';
    this.roundRect(x - 7, y - 32 + rec, 8, 30, 4);
    c.fill();
    c.fillStyle = '#ffd54a';
    this.roundRect(x - 11, y - 36 + rec, 22, 7, 3);
    c.fill();
    // body
    c.fillStyle = '#1f6fb8';
    c.beginPath();
    c.arc(x, y + 2, 20, Math.PI, 0);
    c.fill();
    c.fillStyle = '#45b4ff';
    c.beginPath();
    c.arc(x, y, 16, Math.PI, 0);
    c.fill();
    // wheels
    c.fillStyle = '#222';
    c.beginPath();
    c.arc(x - 15, y + 8, 6, 0, Math.PI * 2);
    c.arc(x + 15, y + 8, 6, 0, Math.PI * 2);
    c.fill();
    if (sim.level.champion && sim.champReady) {
      c.strokeStyle = `rgba(255,213,74,${0.5 + Math.sin(sim.t * 10) * 0.4})`;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(x, y - 6, 28, 0, Math.PI * 2);
      c.stroke();
    }
  }

  private drawFx(fx: Fx) {
    const c = this.ctx;
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
