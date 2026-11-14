import { LANES, LANE_W, RUN_SPEED, BULLET_SPEED, MAX_SQUAD, FIRE_RANGE } from './constants';
import { WEAPONS, RANK_MUL, squadPower } from './balance';
import type { LevelDef, GateOp } from './levels';

export interface Input {
  /** Desired lane 0..2, or null to keep the current one. */
  lane: number | null;
}

export interface SimConfig {
  startCount: number;
  startWeapon: number;
  dmgMul: number;
  /** Adaptive easing after repeated losses: scales enemy/boss HP (1 = normal). */
  ease?: number;
}

export type GameEvent =
  | { t: 'gate'; x: number; label: string; good: boolean; delta: number }
  | { t: 'gateShot'; x: number; z: number }
  | { t: 'hit'; x: number; z: number; kill: boolean; big: boolean }
  | { t: 'squadHit'; x: number; lost: number }
  | { t: 'crateHit'; x: number; z: number }
  | { t: 'crateOpen'; x: number; z: number; kind: 'weapon' | 'rank'; label: string }
  | { t: 'volley'; weapon: number }
  | { t: 'bossHit'; x: number; dmg: number }
  | { t: 'bossArrive' }
  | { t: 'win' }
  | { t: 'lose' };

export interface Gate {
  z: number;
  lane: number;
  op: GateOp;
  val: number; // signed for +/- gates; multiplier/divisor otherwise
  cap: number;
  shootable: boolean;
  acc: number;
  flash: number;
  done: boolean;
}
export interface Enemy {
  z: number;
  x: number;
  lane: number;
  hp: number;
  maxHp: number;
  power: number;
  big: boolean;
  chase: boolean;
  speed: number;
  flash: number;
  alive: boolean;
  wobble: number;
}
export interface Crate {
  z: number;
  lane: number;
  kind: 'weapon' | 'rank';
  hp: number;
  maxHp: number;
  flash: number;
  alive: boolean;
}
export interface Bullet {
  x: number;
  z: number;
  z0: number;
  dmg: number;
  alive: boolean;
}
export interface Boss {
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  eat: number;
  flash: number;
  active: boolean;
  eatAcc: number;
}

export type SimState = 'playing' | 'won' | 'lost';

export class Sim {
  readonly level: LevelDef;
  readonly cfg: SimConfig;
  t = 0;
  state: SimState = 'playing';

  dist = 0; // squad front position on the track
  speed = RUN_SPEED;
  lane = 1;
  squadX: number = LANES[1];
  count: number;
  peak: number;
  weapon: number;
  rank = 0;
  fireAcc = 0;
  recoil = 0;

  gates: Gate[];
  enemies: Enemy[];
  crates: Crate[];
  bullets: Bullet[] = [];
  boss: Boss;
  events: GameEvent[] = [];
  stats = { kills: 0, gatesTaken: 0, shots: 0 };

  constructor(level: LevelDef, cfg: SimConfig) {
    this.level = level;
    this.cfg = cfg;
    const ease = cfg.ease ?? 1;
    this.count = this.peak = cfg.startCount;
    this.weapon = cfg.startWeapon;
    this.gates = level.gates.map((g) => {
      const val = g.op === '-' ? -g.v : g.v;
      return { z: g.z, lane: g.lane, op: g.op, val, cap: Math.abs(g.v) + 12 + level.d, shootable: g.shootable, acc: 0, flash: 0, done: false };
    });
    this.enemies = level.enemies.map((e) => {
      const hp = Math.max(1, Math.round(e.hp * ease));
      return { z: e.z, x: LANES[e.lane], lane: e.lane, hp, maxHp: hp, power: e.power, big: e.big, chase: e.chase, speed: e.speed, flash: 0, alive: true, wobble: Math.random() * 6 };
    });
    this.crates = level.crates.map((c) => ({ ...c, maxHp: c.hp, flash: 0, alive: true }));
    const bhp = Math.max(10, Math.round(level.boss.hp * ease));
    this.boss = { z: level.boss.z, hp: bhp, maxHp: bhp, speed: level.boss.speed, eat: level.boss.eat, flash: 0, active: false, eatAcc: 0 };
  }

  get weaponInfo() {
    return WEAPONS[this.weapon];
  }
  get progress(): number {
    return Math.min(1, this.dist / this.level.length);
  }
  get currentDps(): number {
    const w = WEAPONS[this.weapon];
    return squadPower(this.count) * w.rate * w.dmg * RANK_MUL[this.rank] * this.cfg.dmgMul;
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  step(dt: number, input: Input) {
    if (this.state !== 'playing') {
      for (const e of this.enemies) e.wobble += dt * 8;
      this.moveBullets(dt);
      return;
    }
    this.t += dt;

    if (input.lane !== null) this.lane = Math.max(0, Math.min(2, input.lane));
    const tx = LANES[this.lane];
    const mv = 900 * dt;
    this.squadX += Math.max(-mv, Math.min(mv, tx - this.squadX));
    const curLane = this.nearestLane(this.squadX);

    // Running stops at the end of the track; the boss walks in.
    if (this.dist >= this.level.length) {
      this.speed = Math.max(0, this.speed - dt * 400);
      if (!this.boss.active) {
        this.boss.active = true;
        this.events.push({ t: 'bossArrive' });
      }
    }
    this.dist += this.speed * dt;
    if (this.boss.active) this.boss.z = Math.max(this.dist + 40, this.boss.z - this.boss.speed * dt);

    // Fire.
    const w = WEAPONS[this.weapon];
    this.fireAcc += dt * w.rate;
    this.recoil = Math.max(0, this.recoil - dt * 10);
    while (this.fireAcc >= 1) {
      this.fireAcc -= 1;
      this.volley();
    }
    this.moveBullets(dt);

    // Gates.
    for (const g of this.gates) {
      g.flash = Math.max(0, g.flash - dt * 4);
      if (g.done || g.z > this.dist) continue;
      g.done = true;
      if (g.lane !== curLane) continue;
      const before = this.count;
      if (g.op === '+' || g.op === '-') this.count += Math.round(g.val);
      else if (g.op === 'x') this.count *= g.val;
      else this.count = Math.ceil(this.count / g.val);
      this.count = Math.min(MAX_SQUAD, this.count);
      this.stats.gatesTaken++;
      const delta = this.count - before;
      this.events.push({ t: 'gate', x: LANES[g.lane], label: gateLabel(g), good: delta >= 0, delta });
    }

    // Enemies.
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.flash = Math.max(0, e.flash - dt * 6);
      e.wobble += dt * 8;
      e.z -= e.speed * dt;
      const ahead = e.z - this.dist;
      if (e.chase && ahead < 420 && ahead > 60) {
        const target = LANES[curLane];
        e.x += Math.max(-60 * dt, Math.min(60 * dt, target - e.x));
        e.lane = this.nearestLane(e.x);
      }
      if (ahead <= 10 && ahead > -30 && Math.abs(e.x - this.squadX) < LANE_W * 0.55) {
        e.alive = false;
        const lost = Math.min(this.count, e.power);
        this.count -= e.power;
        this.events.push({ t: 'squadHit', x: e.x, lost });
      } else if (ahead < -60) e.alive = false;
    }

    // Crates passed without being broken are lost.
    for (const c of this.crates) {
      c.flash = Math.max(0, c.flash - dt * 6);
      if (c.alive && c.z < this.dist - 10) c.alive = false;
    }

    // Boss contact: eats soldiers.
    this.boss.flash = Math.max(0, this.boss.flash - dt * 6);
    if (this.boss.active && this.boss.z <= this.dist + 45) {
      this.boss.eatAcc += this.boss.eat * dt;
      while (this.boss.eatAcc >= 1 && this.count > 0) {
        this.boss.eatAcc -= 1;
        this.count--;
        this.events.push({ t: 'squadHit', x: this.squadX, lost: 1 });
      }
    }

    this.peak = Math.max(this.peak, this.count);
    if (this.enemies.length > 60 && this.enemies.filter((e) => !e.alive).length > 30) this.enemies = this.enemies.filter((e) => e.alive);

    if (this.boss.hp <= 0) {
      this.boss.hp = 0;
      this.state = 'won';
      this.events.push({ t: 'win' });
    } else if (this.count <= 0) {
      this.count = 0;
      this.state = 'lost';
      this.events.push({ t: 'lose' });
    }
  }

  private nearestLane(x: number): number {
    let best = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(LANES[i] - x) < Math.abs(LANES[best] - x)) best = i;
    return best;
  }

  private volley() {
    if (this.count <= 0) return;
    const w = WEAPONS[this.weapon];
    const total = squadPower(this.count) * w.dmg * RANK_MUL[this.rank] * this.cfg.dmgMul;
    const k = Math.min(this.weapon === 2 ? 7 : 5, Math.ceil(this.count / 4));
    const spread = Math.min(LANE_W * 0.7, 10 + Math.sqrt(this.count) * 8);
    for (let i = 0; i < k; i++) {
      const x = this.squadX + (k === 1 ? 0 : (i / (k - 1) - 0.5) * spread) + (Math.random() - 0.5) * 6;
      this.bullets.push({ x, z: this.dist + 14, z0: this.dist, dmg: total / k, alive: true });
    }
    this.stats.shots++;
    this.recoil = 1;
    this.events.push({ t: 'volley', weapon: this.weapon });
  }

  private moveBullets(dt: number) {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      const prev = b.z;
      b.z += BULLET_SPEED * dt;
      if (this.state !== 'playing') {
        if (b.z - b.z0 > FIRE_RANGE) b.alive = false;
        continue;
      }
      const lane = this.nearestLane(b.x);
      // Find the nearest target crossed this step.
      let best: { z: number; kind: 'e' | 'g' | 'c' | 'b'; ref: Enemy | Gate | Crate | null } | null = null;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const r = e.big ? 20 : 10;
        if (Math.abs(e.x - b.x) > r + 14) continue;
        if (e.z - r > b.z || e.z + r < prev) continue;
        if (!best || e.z < best.z) best = { z: e.z, kind: 'e', ref: e };
      }
      for (const c of this.crates) {
        if (!c.alive || c.lane !== lane) continue;
        if (c.z - 18 > b.z || c.z + 18 < prev) continue;
        if (!best || c.z < best.z) best = { z: c.z, kind: 'c', ref: c };
      }
      for (const g of this.gates) {
        if (g.done || !g.shootable || g.lane !== lane) continue;
        if (g.z > b.z || g.z < prev) continue;
        if (!best || g.z < best.z) best = { z: g.z, kind: 'g', ref: g };
      }
      if (this.boss.active || this.boss.z - this.dist < FIRE_RANGE) {
        if (this.boss.z - 30 <= b.z && (!best || this.boss.z - 30 < best.z)) best = { z: this.boss.z - 30, kind: 'b', ref: null };
      }
      if (best) {
        b.alive = false;
        this.applyHit(best.kind, best.ref, b);
      } else if (b.z - b.z0 > FIRE_RANGE) b.alive = false;
    }
    if (this.bullets.length > 80) this.bullets = this.bullets.filter((b) => b.alive);
  }

  private applyHit(kind: 'e' | 'g' | 'c' | 'b', ref: Enemy | Gate | Crate | null, b: Bullet) {
    if (kind === 'e') {
      const e = ref as Enemy;
      e.hp -= b.dmg;
      e.flash = 1;
      const kill = e.hp <= 0;
      if (kill) {
        e.alive = false;
        this.stats.kills++;
      }
      this.events.push({ t: 'hit', x: e.x, z: e.z, kill, big: e.big });
    } else if (kind === 'g') {
      const g = ref as Gate;
      g.acc += b.dmg / this.level.gatePoint;
      if (g.acc >= 1) {
        const inc = Math.floor(g.acc);
        g.acc -= inc;
        g.val = Math.min(g.cap, g.val + inc);
        if (g.val >= 0 && g.op === '-') g.op = '+';
        g.flash = 1;
        this.events.push({ t: 'gateShot', x: LANES[g.lane], z: g.z });
      }
    } else if (kind === 'c') {
      const c = ref as Crate;
      c.hp -= b.dmg;
      c.flash = 1;
      if (c.hp <= 0) {
        c.alive = false;
        let label: string;
        if (c.kind === 'weapon') {
          this.weapon = Math.min(WEAPONS.length - 1, this.weapon + 1);
          label = WEAPONS[this.weapon].name.toUpperCase() + '!';
        } else {
          this.rank = Math.min(RANK_MUL.length - 1, this.rank + 1);
          label = `РАНГ ${this.rank + 1}!`;
        }
        this.events.push({ t: 'crateOpen', x: LANES[c.lane], z: c.z, kind: c.kind, label });
      } else this.events.push({ t: 'crateHit', x: LANES[c.lane], z: c.z });
    } else {
      this.boss.hp -= b.dmg;
      this.boss.flash = 1;
      this.events.push({ t: 'bossHit', x: b.x, dmg: b.dmg });
    }
  }
}

export function gateLabel(g: { op: GateOp; val: number }): string {
  if (g.op === 'x') return `×${g.val}`;
  if (g.op === '/') return `÷${g.val}`;
  const v = Math.round(g.val);
  return v >= 0 ? `+${v}` : `${v}`;
}
