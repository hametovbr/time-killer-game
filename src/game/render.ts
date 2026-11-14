import { W, H, COLORS, LANES, LANE_W, ROAD_L, ROAD_R, SQUAD_Y, BARRICADE_Y, BARRICADE_GAP } from './constants';
import { WEAPONS } from './balance';
import { gateLabel, BOSS_R, BOSS_START, type Sim } from './sim';
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
    // The crate shows what's inside: the next weapon, or a gift once you have the best one.
    const nextW = WEAPONS[sim.weapon + 1];
    for (const cr of sim.crates) if (cr.alive) this.drawCrate(cr, sy0(cr.z), nextW ? nextW.icon : '🎁');
    this.drawGates(sim, sy0, extraTop);
    this.drawEnemies(sim, sy0, extraTop);
    this.drawBullets(sim, sy0);
    this.drawSquad(sim, time);
    this.drawBarricade(sim);
    this.drawBossHud(sim);
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

  private drawCrate(cr: { lane: number; hp: number; maxHp: number; flash: number }, y: number, icon: string) {
    if (y < -120 || y > H + 60) return;
    const c = this.ctx;
    const x = LANES[cr.lane] + (cr.flash > 0 ? (Math.random() - 0.5) * 4 : 0);
    const w = 64;
    const h = 52;
    c.fillStyle = 'rgba(0,0,0,0.3)';
    this.rr(x - w / 2 + 3, y - h + 6, w, h, 6);
    c.fill();
    c.fillStyle = cr.flash > 0.5 ? '#f0c890' : '#b9783a';
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
    this.label(icon, x, y - h / 2 - 6, 22);
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
      // How many soldiers this zombie takes if it reaches you.
      if (e.big) this.label(`-${e.power}`, x, y - 2, 13, "#fff");
    }
  }

  private drawBoss(sim: Sim, y: number) {
    const b = sim.boss;
    if (!b.active) return;
    const c = this.ctx;
    const x = b.x;
    const r = BOSS_R;
    const bob = Math.sin(sim.t * (b.enraged ? 9 : 5)) * 3;

    // Telegraph: flashing arrow + lane highlight where the boss is about to go.
    if (b.telegraph > 0) {
      const tx = LANES[b.nextLane];
      const a = 0.25 + 0.25 * Math.sin(sim.t * 30);
      c.fillStyle = `rgba(255,60,80,${a})`;
      c.fillRect(tx - LANE_W / 2, 0, LANE_W, BARRICADE_Y);
      this.label(b.nextLane < b.lane ? '⬅' : '➡', (x + tx) / 2, y - r * 0.6, 34, '#ff5a6a');
    }
    // Danger lane: the path the boss is walking down.
    c.fillStyle = b.enraged ? 'rgba(255,40,60,0.16)' : 'rgba(255,60,80,0.09)';
    c.fillRect(LANES[b.lane] - LANE_W / 2, y, LANE_W, Math.max(0, BARRICADE_Y - y));

    if (y < -200 || y > H + 100) return;
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(x, y + 8, r * 1.2, 16, 0, 0, Math.PI * 2);
    c.fill();
    // arms
    c.strokeStyle = '#5a1a2a';
    c.lineWidth = 15;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - r * 0.75, y - r * 0.5);
    c.lineTo(x - r * 1.15, y + 12 + bob);
    c.moveTo(x + r * 0.75, y - r * 0.5);
    c.lineTo(x + r * 1.15, y + 12 - bob);
    c.stroke();
    c.fillStyle = b.flash > 0.5 ? '#ffd0d8' : b.enraged ? '#e0203f' : '#c2304d';
    c.strokeStyle = '#5a1a2a';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(x, y - r * 0.6 + bob, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // face
    c.fillStyle = b.enraged ? '#ffffff' : '#ffe36b';
    c.beginPath();
    c.arc(x - 16, y - r * 0.6 + bob + 2, 8, 0, Math.PI * 2);
    c.arc(x + 16, y - r * 0.6 + bob + 2, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2a0a12';
    this.rr(x - 18, y - r * 0.6 + bob + 17, 36, 10, 5);
    c.fill();
    // horns
    c.fillStyle = '#eee';
    c.beginPath();
    c.moveTo(x - 34, y - r * 1.25 + bob);
    c.lineTo(x - 44, y - r * 1.8 + bob);
    c.lineTo(x - 18, y - r * 1.45 + bob);
    c.moveTo(x + 34, y - r * 1.25 + bob);
    c.lineTo(x + 44, y - r * 1.8 + bob);
    c.lineTo(x + 18, y - r * 1.45 + bob);
    c.fill();
    if (b.trampling) this.label('NOM', x, y + 18, 13, '#ffb0b0');
  }

  /** Boss HP + "distance to barricade" meter, pinned under the HUD. */
  private drawBossHud(sim: Sim) {
    const b = sim.boss;
    if (!b.active || sim.state === 'won') return;
    const c = this.ctx;
    const bw = 300;
    const x = W / 2 - bw / 2;
    const y = 96;
    c.fillStyle = 'rgba(10,12,30,0.8)';
    this.rr(x - 6, y - 20, bw + 12, 46, 10);
    c.fill();
    this.label(`${sim.level.type === 'boss' ? '👑 ' : ''}BOSS${b.enraged ? ' — ENRAGED' : ''}`, W / 2, y - 9, 12, b.enraged ? '#ff6b7d' : '#ffd54a');
    c.fillStyle = 'rgba(255,255,255,0.12)';
    this.rr(x, y, bw, 10, 5);
    c.fill();
    c.fillStyle = '#ff4d6a';
    this.rr(x, y, Math.max(6, bw * Math.max(0, b.hp / b.maxHp)), 10, 5);
    c.fill();
    // distance meter: how close the boss is to your barricade
    const total = BOSS_START + BARRICADE_GAP;
    const left = Math.max(0, Math.min(1, (b.z - sim.dist + BARRICADE_GAP) / total));
    c.fillStyle = 'rgba(255,255,255,0.12)';
    this.rr(x, y + 14, bw, 5, 2.5);
    c.fill();
    c.fillStyle = left < 0.3 ? '#ff5a5a' : '#ffc83d';
    this.rr(x, y + 14, Math.max(4, bw * left), 5, 2.5);
    c.fill();
  }

  private drawBullets(sim: Sim, sy: (z: number) => number) {
    const c = this.ctx;
    const w = WEAPONS[sim.weapon];
    c.strokeStyle = w.color;
    c.lineWidth = w.bulletW ?? 3;
    c.lineCap = 'round';
    const len = w.bulletL ?? 16;
    c.beginPath();
    for (const b of sim.bullets) {
      if (!b.alive) continue;
      const y = sy(b.z);
      c.moveTo(b.x, y);
      c.lineTo(b.x, y + len);
    }
    c.stroke();
  }

  private drawSquad(sim: Sim, time: number) {
    const c = this.ctx;
    const n = Math.min(sim.count, 36);
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

  private drawBarricade(sim: Sim) {
    const c = this.ctx;
    const y = BARRICADE_Y;
    const shake = sim.wallFlash > 0 ? (Math.random() - 0.5) * 4 * sim.wallFlash : 0;
    const ratio = Math.max(0, sim.wall / sim.wallMax);
    // Sandbag wall across the road.
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.fillRect(ROAD_L, y + 6, ROAD_R - ROAD_L, 30);
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 10; i++) {
        const bx = ROAD_L + 4 + i * 36 + (row ? 18 : 0) + shake;
        if (bx > ROAD_R - 20) continue;
        c.fillStyle = sim.wallFlash > 0.5 ? '#ffb0a0' : row ? '#b89a62' : '#c9ab70';
        this.rr(bx, y + row * 13, 34, 14, 6);
        c.fill();
        c.strokeStyle = 'rgba(60,40,10,0.45)';
        c.lineWidth = 1.5;
        c.stroke();
      }
    }
    // HP bar + number.
    const bw = 200;
    const bx = W / 2 - bw / 2;
    const by = y + 34;
    c.fillStyle = 'rgba(10,12,30,0.75)';
    this.rr(bx - 4, by - 3, bw + 8, 18, 9);
    c.fill();
    c.fillStyle = ratio > 0.5 ? '#5cdb7a' : ratio > 0.25 ? '#ffc83d' : '#ff5a5a';
    this.rr(bx, by, Math.max(8, bw * ratio), 12, 6);
    c.fill();
    this.label(`🧱 ${Math.max(0, Math.ceil(sim.wall))}`, W / 2, by + 6, 12);
  }

  private drawFx(fx: Fx, sim: Sim) {
    const c = this.ctx;
    // explosion rings
    for (const r of fx.rings) {
      const a = r.life / 0.3;
      c.globalAlpha = a;
      c.strokeStyle = '#ffb347';
      c.lineWidth = 4 * a + 1;
      c.beginPath();
      c.arc(r.x, r.y, r.r * (1.1 - a * 0.5), 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = 'rgba(255,170,60,0.25)';
      c.fill();
    }
    // lightning
    for (const b of fx.bolts) {
      c.globalAlpha = Math.min(1, b.life / 0.12);
      c.strokeStyle = '#d8ccff';
      c.lineWidth = 3;
      c.lineJoin = 'round';
      c.beginPath();
      b.pts.forEach(([x, y], i) => {
        if (i === 0) c.moveTo(x, y);
        else {
          const [px, py] = b.pts[i - 1];
          const mx = (px + x) / 2 + (Math.random() - 0.5) * 18;
          const my = (py + y) / 2 + (Math.random() - 0.5) * 18;
          c.lineTo(mx, my);
          c.lineTo(x, y);
        }
      });
      c.stroke();
    }
    c.globalAlpha = 1;
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
