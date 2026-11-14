import {
  W,
  ENEMY_BASE_BOTTOM,
  PLAYER_BASE_TOP,
  CANNON_Y,
  UNIT_R,
  UNIT_SPEED,
  MAX_UNITS,
  MAX_ENEMIES,
  CHAMPION_HP,
  CHAMPION_R,
} from './constants';
import type { LevelDef, GateDef, WallDef, SpinnerDef } from './levels';

export interface Input {
  /** Target x for the cannon (world coords) or null when not steering. */
  x: number | null;
  fire: boolean;
  champion: boolean;
}

export interface SimConfig {
  fireRate: number;
  playerBaseHp: number;
  championShots: number;
  /** Adaptive easing: multiplies enemy wave size (1 = normal). */
  enemyScale?: number;
}

export type GameEvent =
  | { t: 'gate'; x: number; y: number; label: string; good: boolean; n: number }
  | { t: 'pop'; x: number; y: number; enemy: boolean }
  | { t: 'enemyBaseHit'; x: number; dmg: number }
  | { t: 'playerBaseHit'; x: number; dmg: number }
  | { t: 'shot'; x: number }
  | { t: 'champReady' }
  | { t: 'champLaunch'; x: number }
  | { t: 'champHit'; x: number; y: number }
  | { t: 'wallBreak'; x: number; y: number }
  | { t: 'coin'; x: number }
  | { t: 'win' }
  | { t: 'lose' };

export interface Unit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  mask: number; // bitmask of gates already passed
  alive: boolean;
  giant: boolean;
}

export interface Gate extends GateDef {
  cx: number; // current x (moving gates)
  pulse: number;
  counter: number;
  idx: number;
}
export interface Wall extends WallDef {
  maxHp: number;
  hit: number;
}
export interface Spinner extends SpinnerDef {
  angle: number;
}

export type SimState = 'playing' | 'won' | 'lost';

const CELL = 20;
const GRID_W = Math.ceil(W / CELL) + 1;

export class Sim {
  readonly level: LevelDef;
  readonly cfg: SimConfig;
  t = 0;
  state: SimState = 'playing';

  cannonX = W / 2;
  cannonRecoil = 0;
  fireAcc = 0;
  shots = 0;
  champCharge = 0;
  champReadyAnnounced = false;

  enemyHp: number;
  enemyHpMax: number;
  playerHp: number;
  playerHpMax: number;
  collected = 0; // bonus level

  units: Unit[] = [];
  enemies: Unit[] = [];
  champions: Unit[] = [];
  gates: Gate[];
  walls: Wall[];
  spinners: Spinner[];

  waveTimer: number;
  waveCount = 0;
  events: GameEvent[] = [];
  stats = { fired: 0, peakUnits: 0, killed: 0, reached: 0 };

  private grid: number[][] = [];
  private popBudget = 0;

  constructor(level: LevelDef, cfg: SimConfig) {
    this.level = level;
    this.cfg = cfg;
    this.enemyHp = this.enemyHpMax = level.enemyBaseHp;
    this.playerHp = this.playerHpMax = cfg.playerBaseHp;
    this.gates = level.gates.map((g, idx) => ({ ...g, cx: g.x, pulse: 0, counter: 0, idx }));
    this.walls = level.walls.map((w) => ({ ...w, maxHp: w.hp, hit: 0 }));
    this.spinners = level.spinners.map((s) => ({ ...s, angle: 0 }));
    this.waveTimer = level.enemy ? level.enemy.firstWaveDelay : Infinity;
  }

  get champReady(): boolean {
    return this.level.champion && this.champCharge >= this.cfg.championShots;
  }
  get champProgress(): number {
    return this.level.champion ? Math.min(1, this.champCharge / this.cfg.championShots) : 0;
  }
  get timeLeft(): number {
    return Math.max(0, this.level.bonusDuration - this.t);
  }

  private emit(e: GameEvent) {
    if (e.t === 'pop') {
      if (this.popBudget <= 0) return;
      this.popBudget--;
    }
    this.events.push(e);
  }

  step(dt: number, input: Input) {
    this.popBudget = 40;
    if (this.state !== 'playing') {
      // Let the world keep drifting for a nice end-screen backdrop.
      this.moveUnits(dt, false);
      return;
    }
    this.t += dt;

    // Cannon steering.
    if (input.x !== null) {
      const target = Math.max(24, Math.min(W - 24, input.x));
      const maxMove = 1100 * dt;
      this.cannonX += Math.max(-maxMove, Math.min(maxMove, target - this.cannonX));
    }
    this.cannonRecoil = Math.max(0, this.cannonRecoil - dt * 8);

    // Firing.
    if (input.fire) {
      this.fireAcc += dt * this.cfg.fireRate;
      while (this.fireAcc >= 1) {
        this.fireAcc -= 1;
        this.fire();
      }
    } else {
      this.fireAcc = Math.min(this.fireAcc, 0.999);
    }
    if (input.champion && this.champReady) this.launchChampion();

    // Moving gates and spinners.
    for (const g of this.gates) {
      if (g.move) g.cx = g.x + Math.sin(this.t * g.move.speed + g.move.phase) * g.move.amp;
      g.pulse = Math.max(0, g.pulse - dt * 4);
    }
    for (const s of this.spinners) s.angle += s.speed * dt;
    for (const w of this.walls) w.hit = Math.max(0, w.hit - dt * 6);

    // Enemy waves.
    const ed = this.level.enemy;
    if (ed) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.waveTimer += ed.waveInterval;
        this.spawnWave();
      }
    }

    this.moveUnits(dt, true);
    this.collide();
    this.cleanup();

    this.stats.peakUnits = Math.max(this.stats.peakUnits, this.units.length);

    if (this.level.type === 'bonus') {
      if (this.t >= this.level.bonusDuration) {
        this.state = 'won';
        this.emit({ t: 'win' });
      }
    } else if (this.enemyHp <= 0) {
      this.enemyHp = 0;
      this.state = 'won';
      for (const e of this.enemies) {
        e.alive = false;
        this.emit({ t: 'pop', x: e.x, y: e.y, enemy: true });
      }
      this.emit({ t: 'win' });
    } else if (this.playerHp <= 0) {
      this.playerHp = 0;
      this.state = 'lost';
      this.emit({ t: 'lose' });
    }
  }

  private fire() {
    this.stats.fired++;
    this.cannonRecoil = 1;
    if (this.level.champion && this.champCharge < this.cfg.championShots) {
      this.champCharge++;
      if (this.champReady && !this.champReadyAnnounced) {
        this.champReadyAnnounced = true;
        this.emit({ t: 'champReady' });
      }
    }
    if (this.units.length >= MAX_UNITS) return;
    this.units.push(this.makeUnit(this.cannonX + (Math.random() - 0.5) * 6, CANNON_Y - 20, 0));
    this.emit({ t: 'shot', x: this.cannonX });
  }

  private makeUnit(x: number, y: number, mask: number): Unit {
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 18,
      vy: -UNIT_SPEED * (0.95 + Math.random() * 0.1),
      r: UNIT_R,
      hp: 1,
      mask,
      alive: true,
      giant: false,
    };
  }

  private launchChampion() {
    this.champCharge = 0;
    this.champReadyAnnounced = false;
    this.champions.push({
      x: this.cannonX,
      y: CANNON_Y - 24,
      vx: 0,
      vy: -78,
      r: CHAMPION_R,
      hp: CHAMPION_HP,
      mask: 0,
      alive: true,
      giant: true,
    });
    this.emit({ t: 'champLaunch', x: this.cannonX });
  }

  private spawnWave() {
    const ed = this.level.enemy!;
    this.waveCount++;
    const cx = 40 + Math.random() * (W - 80);
    if (ed.giantEveryWaves > 0 && this.waveCount % ed.giantEveryWaves === 0) {
      this.enemies.push({
        x: cx,
        y: ENEMY_BASE_BOTTOM + 6,
        vx: 0,
        vy: ed.speed * 0.6,
        r: 12,
        hp: ed.giantHp,
        mask: 0,
        alive: true,
        giant: true,
      });
    }
    const spread = 10 + Math.sqrt(ed.waveSize) * 6;
    const size = Math.max(2, Math.round(ed.waveSize * (this.cfg.enemyScale ?? 1)));
    for (let i = 0; i < size && this.enemies.length < MAX_ENEMIES; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * spread;
      this.enemies.push({
        x: Math.max(10, Math.min(W - 10, cx + Math.cos(a) * r)),
        y: ENEMY_BASE_BOTTOM + 4 - Math.abs(Math.sin(a) * r) * 0.6,
        vx: 0,
        vy: ed.speed * (0.92 + Math.random() * 0.16),
        r: UNIT_R + 0.4,
        hp: 1,
        mask: 0,
        alive: true,
        giant: false,
      });
    }
  }

  private gateHit(g: Gate, prevY: number, u: Unit): boolean {
    if (u.mask & (1 << g.idx)) return false;
    if (!(prevY > g.y && u.y <= g.y)) return false;
    return Math.abs(u.x - g.cx) <= g.w / 2;
  }

  private moveUnits(dt: number, live: boolean) {
    const spawned: Unit[] = [];
    for (const u of this.units) {
      if (!u.alive) continue;
      const py = u.y;
      u.x += u.vx * dt;
      u.y += u.vy * dt;
      u.vx *= 1 - Math.min(1, dt * 2.5);
      if (u.x < 6) {
        u.x = 6;
        u.vx = Math.abs(u.vx);
      } else if (u.x > W - 6) {
        u.x = W - 6;
        u.vx = -Math.abs(u.vx);
      }
      if (!live) continue;

      for (const g of this.gates) {
        if (!this.gateHit(g, py, u)) continue;
        u.mask |= 1 << g.idx;
        g.pulse = 1;
        if (g.kind === 'mul') {
          const extra = g.n - 1;
          for (let k = 0; k < extra && this.units.length + spawned.length < MAX_UNITS; k++) {
            const c = this.makeUnit(
              Math.max(g.cx - g.w / 2 + 4, Math.min(g.cx + g.w / 2 - 4, u.x + (Math.random() - 0.5) * g.w * 0.8)),
              u.y - Math.random() * 10,
              u.mask,
            );
            c.vx = (c.x - u.x) * 1.5;
            spawned.push(c);
          }
          if (Math.random() < 0.08) this.emit({ t: 'gate', x: g.cx, y: g.y, label: `×${g.n}`, good: true, n: g.n });
        } else {
          g.counter++;
          if (g.counter % g.n !== 0) {
            u.alive = false;
            this.emit({ t: 'pop', x: u.x, y: u.y, enemy: false });
          }
          if (Math.random() < 0.08) this.emit({ t: 'gate', x: g.cx, y: g.y, label: `÷${g.n}`, good: false, n: g.n });
        }
        if (!u.alive) break;
      }
      if (!u.alive) continue;

      for (const w of this.walls) {
        if (w.hp <= 0) continue;
        if (Math.abs(u.x - w.x) <= w.w / 2 && Math.abs(u.y - w.y) <= w.h / 2) {
          u.alive = false;
          w.hp--;
          w.hit = 1;
          this.emit({ t: 'pop', x: u.x, y: u.y, enemy: false });
          if (w.hp <= 0) this.emit({ t: 'wallBreak', x: w.x, y: w.y });
          break;
        }
      }
      if (!u.alive) continue;

      for (const s of this.spinners) {
        if (segDist(u.x, u.y, s) < 7) {
          u.alive = false;
          this.emit({ t: 'pop', x: u.x, y: u.y, enemy: false });
          break;
        }
      }
      if (!u.alive) continue;

      if (u.y <= ENEMY_BASE_BOTTOM) {
        u.alive = false;
        this.stats.reached++;
        if (this.level.type === 'bonus') {
          this.collected++;
          if (Math.random() < 0.25) this.emit({ t: 'coin', x: u.x });
        } else {
          this.enemyHp -= 1;
          if (Math.random() < 0.3) this.emit({ t: 'enemyBaseHit', x: u.x, dmg: 1 });
        }
      }
    }
    if (spawned.length) this.units.push(...spawned);

    // Champions.
    for (const c of this.champions) {
      if (!c.alive) continue;
      const py = c.y;
      c.y += c.vy * dt;
      if (!live) continue;
      for (const g of this.gates) {
        if (!this.gateHit(g, py, c)) continue;
        c.mask |= 1 << g.idx;
        g.pulse = 1;
        if (g.kind === 'mul') {
          const count = g.n * 5;
          for (let k = 0; k < count && this.units.length < MAX_UNITS; k++) {
            const nu = this.makeUnit(c.x + (Math.random() - 0.5) * 40, c.y - Math.random() * 16, c.mask);
            nu.vx = (nu.x - c.x) * 2;
            this.units.push(nu);
          }
          this.emit({ t: 'gate', x: g.cx, y: g.y, label: `+${count}`, good: true, n: g.n });
        }
      }
      for (const w of this.walls) {
        if (w.hp <= 0) continue;
        if (Math.abs(c.x - w.x) <= w.w / 2 + c.r && Math.abs(c.y - w.y) <= w.h / 2 + c.r) {
          const dmg = Math.min(w.hp, c.hp);
          w.hp -= dmg;
          c.hp -= Math.ceil(dmg / 2);
          w.hit = 1;
          this.emit({ t: 'champHit', x: c.x, y: c.y });
          if (w.hp <= 0) this.emit({ t: 'wallBreak', x: w.x, y: w.y });
          if (c.hp <= 0) {
            c.alive = false;
            this.emit({ t: 'pop', x: c.x, y: c.y, enemy: false });
          }
        }
      }
      if (c.alive && c.y <= ENEMY_BASE_BOTTOM) {
        c.alive = false;
        const dmg = 20 + c.hp;
        if (this.level.type === 'bonus') this.collected += dmg;
        else this.enemyHp -= dmg;
        this.emit({ t: 'champHit', x: c.x, y: c.y });
        this.emit({ t: 'enemyBaseHit', x: c.x, dmg });
      }
    }

    // Enemies.
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.y += e.vy * dt;
      if (!live) continue;
      if (e.y >= PLAYER_BASE_TOP) {
        e.alive = false;
        const dmg = e.giant ? 3 : 1;
        this.playerHp -= dmg;
        this.emit({ t: 'playerBaseHit', x: e.x, dmg });
      }
    }
  }

  private collide() {
    // Spatial hash of friendly units.
    const rows = Math.ceil(800 / CELL);
    const cells = GRID_W * rows;
    if (this.grid.length !== cells) this.grid = Array.from({ length: cells }, () => []);
    for (const c of this.grid) c.length = 0;
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (!u.alive) continue;
      const gx = Math.floor(u.x / CELL);
      const gy = Math.floor(u.y / CELL);
      if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= rows) continue;
      this.grid[gy * GRID_W + gx].push(i);
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const gx = Math.floor(e.x / CELL);
      const gy = Math.floor(e.y / CELL);
      const reach = e.giant ? 1 : 1;
      outer: for (let oy = -reach; oy <= reach; oy++) {
        for (let ox = -reach; ox <= reach; ox++) {
          const x = gx + ox;
          const y = gy + oy;
          if (x < 0 || y < 0 || x >= GRID_W || y >= rows) continue;
          const cell = this.grid[y * GRID_W + x];
          for (const i of cell) {
            const u = this.units[i];
            if (!u.alive) continue;
            const dx = u.x - e.x;
            const dy = u.y - e.y;
            const rr = u.r + e.r;
            if (dx * dx + dy * dy > rr * rr) continue;
            u.alive = false;
            e.hp--;
            this.emit({ t: 'pop', x: (u.x + e.x) / 2, y: (u.y + e.y) / 2, enemy: true });
            if (e.hp <= 0) {
              e.alive = false;
              this.stats.killed++;
              break outer;
            }
          }
        }
      }
    }

    // Champions trample enemies.
    for (const c of this.champions) {
      if (!c.alive) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = c.x - e.x;
        const dy = c.y - e.y;
        const rr = c.r + e.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        const dmg = Math.min(e.hp, c.hp);
        e.hp -= dmg;
        c.hp -= e.giant ? dmg : 0.25;
        if (e.hp <= 0) {
          e.alive = false;
          this.stats.killed++;
          this.emit({ t: 'pop', x: e.x, y: e.y, enemy: true });
        }
        if (e.giant) this.emit({ t: 'champHit', x: c.x, y: c.y });
        if (c.hp <= 0) {
          c.alive = false;
          this.emit({ t: 'pop', x: c.x, y: c.y, enemy: false });
          break;
        }
      }
    }
  }

  private cleanup() {
    if (this.units.some((u) => !u.alive || u.y < -20)) this.units = this.units.filter((u) => u.alive && u.y > -20);
    if (this.enemies.some((u) => !u.alive)) this.enemies = this.enemies.filter((u) => u.alive);
    if (this.champions.some((u) => !u.alive)) this.champions = this.champions.filter((u) => u.alive);
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}

export function spinnerEnds(s: Spinner): [number, number, number, number] {
  const dx = Math.cos(s.angle) * s.len * 0.5;
  const dy = Math.sin(s.angle) * s.len * 0.5;
  return [s.x - dx, s.y - dy, s.x + dx, s.y + dy];
}

function segDist(px: number, py: number, s: Spinner): number {
  const [x1, y1, x2, y2] = spinnerEnds(s);
  const vx = x2 - x1;
  const vy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / (vx * vx + vy * vy)));
  const cx = x1 + vx * t - px;
  const cy = y1 + vy * t - py;
  return Math.sqrt(cx * cx + cy * cy);
}
