import { LANES, LANE_W, RUN_SPEED, BULLET_SPEED, MAX_SQUAD, FIRE_RANGE, BARRICADE_GAP } from './constants';
import { WEAPONS, RANK_MUL, SIDE_MUL, PERKS, squadPower, xpNeed, type PerkId, type PerkInfo } from './balance';
import { Rng } from './rng';
import type { LevelDef, GateOp } from './levels';

export interface Input {
  /** Desired lane 0..2, or null to keep the current one. */
  lane: number | null;
}

export interface SimConfig {
  startCount: number;
  startWeapon: number;
  dmgMul: number;
  wallHp: number;
  /** Adaptive easing after repeated losses: scales enemy/boss HP (1 = normal). */
  ease?: number;
}

export type GameEvent =
  | { t: 'gate'; x: number; label: string; good: boolean; delta: number }
  | { t: 'gateShot'; x: number; z: number }
  | { t: 'hit'; x: number; z: number; kill: boolean; big: boolean }
  | { t: 'squadHit'; x: number; lost: number }
  | { t: 'leak'; x: number; dmg: number }
  | { t: 'crateHit'; x: number; z: number }
  | { t: 'crateOpen'; x: number; z: number; label: string }
  | { t: 'levelUp' }
  | { t: 'perk'; label: string }
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
  leak: number;
  xp: number;
  big: boolean;
  chase: boolean;
  speed: number;
  flash: number;
  alive: boolean;
  passed: boolean; // got past the squad line, heading for the barricade
  expDps: number;
  seen: boolean;
  wobble: number;
}
export interface Crate {
  z: number;
  lane: number;
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
  pierce: number;
  hit: Enemy[];
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

  dist = 0;
  speed = RUN_SPEED;
  lane = 1;
  squadX: number = LANES[1];
  count: number;
  peak: number;
  weapon: number;
  rank = 0;
  fireAcc = 0;
  recoil = 0;

  wall: number;
  wallMax: number;
  wallFlash = 0;
  private biteAcc = 0;

  // In-run progression.
  xp = 0;
  ups = 0;
  perks: Record<PerkId, number> = { side: 0, pierce: 0, firerate: 0, damage: 0, recruits: 0, repair: 0, rank: 0, weapon: 0 };
  /** When set, the game is frozen until the player picks one. */
  choices: PerkInfo[] | null = null;
  private rng = new Rng((Math.random() * 1e9) | 0);

  gates: Gate[];
  enemies: Enemy[];
  crates: Crate[];
  bullets: Bullet[] = [];
  boss: Boss;
  events: GameEvent[] = [];
  stats = { kills: 0, leaks: 0, gatesTaken: 0 };

  constructor(level: LevelDef, cfg: SimConfig) {
    this.level = level;
    this.cfg = cfg;
    const ease = cfg.ease ?? 1;
    this.count = this.peak = cfg.startCount;
    this.weapon = cfg.startWeapon;
    this.wall = this.wallMax = cfg.wallHp;
    this.gates = level.gates.map((g) => ({
      z: g.z,
      lane: g.lane,
      op: g.op,
      val: g.op === '-' ? -g.v : g.v,
      cap: Math.abs(g.v) + 12 + level.d,
      shootable: g.shootable,
      acc: 0,
      flash: 0,
      done: false,
    }));
    this.enemies = level.enemies.map((e) => {
      const hp = Math.max(1, Math.round(e.hp * ease));
      return { ...e, x: LANES[e.lane], hp, maxHp: hp, flash: 0, alive: true, passed: false, seen: false, wobble: Math.random() * 6 };
    });
    this.crates = level.crates.map((c) => ({ z: c.z, lane: c.lane, hp: c.hp, maxHp: c.hp, flash: 0, alive: true }));
    const bhp = Math.max(10, Math.round(level.boss.hp * ease));
    this.boss = { z: level.boss.z, hp: bhp, maxHp: bhp, speed: level.boss.speed, eat: level.boss.eat, flash: 0, active: false, eatAcc: 0 };
  }

  get progress(): number {
    return Math.min(1, this.dist / this.level.length);
  }
  get xpProgress(): number {
    return Math.min(1, this.xp / xpNeed(this.ups));
  }
  get fireRate(): number {
    return WEAPONS[this.weapon].rate * (1 + 0.2 * this.perks.firerate);
  }
  get volleyDamage(): number {
    return squadPower(this.count) * WEAPONS[this.weapon].dmg * RANK_MUL[this.rank] * this.cfg.dmgMul * (1 + 0.25 * this.perks.damage);
  }
  get currentDps(): number {
    return this.volleyDamage * this.fireRate;
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---------- Level-up ----------
  private offerChoices() {
    const pool = PERKS.filter((p) => {
      if (this.perks[p.id] >= p.max) return false;
      if (p.id === 'repair' && this.wall > this.wallMax * 0.75) return false;
      if (p.id === 'rank' && this.rank >= RANK_MUL.length - 1) return false;
      if (p.id === 'weapon' && this.weapon >= WEAPONS.length - 1) return false;
      return true;
    });
    const picks: PerkInfo[] = [];
    while (picks.length < 3 && pool.length) {
      const total = pool.reduce((a, p) => a + p.weight, 0);
      let r = this.rng.next() * total;
      const idx = pool.findIndex((p) => (r -= p.weight) < 0);
      picks.push(pool.splice(Math.max(0, idx), 1)[0]);
    }
    this.choices = picks;
    this.events.push({ t: 'levelUp' });
  }

  choose(i: number) {
    if (!this.choices) return;
    const p = this.choices[i] ?? this.choices[0];
    this.choices = null;
    this.perks[p.id]++;
    if (p.id === 'recruits') this.count = Math.min(MAX_SQUAD, this.count + Math.max(4, Math.round(this.count * 0.3)));
    if (p.id === 'repair') this.wall = Math.min(this.wallMax, this.wall + Math.ceil(this.wallMax * 0.3));
    if (p.id === 'rank') this.rank = Math.min(RANK_MUL.length - 1, this.rank + 1);
    if (p.id === 'weapon') this.weapon = Math.min(WEAPONS.length - 1, this.weapon + 1);
    this.peak = Math.max(this.peak, this.count);
    this.events.push({ t: 'perk', label: `${p.icon} ${p.title.toUpperCase()}` });
  }

  private gainXp(n: number) {
    this.xp += n;
    if (!this.choices && this.xp >= xpNeed(this.ups)) {
      this.xp -= xpNeed(this.ups);
      this.ups++;
      this.offerChoices();
    }
  }

  // ---------- Main step ----------
  step(dt: number, input: Input) {
    if (this.choices) return; // frozen while choosing
    if (this.state !== 'playing') {
      for (const e of this.enemies) e.wobble += dt * 8;
      this.moveBullets(dt);
      return;
    }
    this.t += dt;

    if (input.lane !== null) this.lane = Math.max(0, Math.min(2, input.lane));
    const tx = LANES[this.lane];
    const mv = 950 * dt;
    this.squadX += Math.max(-mv, Math.min(mv, tx - this.squadX));
    const curLane = this.nearestLane(this.squadX);

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
    this.fireAcc += dt * this.fireRate;
    this.recoil = Math.max(0, this.recoil - dt * 10);
    while (this.fireAcc >= 1) {
      this.fireAcc -= 1;
      this.volley(curLane);
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
      // Gates can hurt a lot, but never wipe the squad on their own — only zombies can.
      this.count = Math.max(1, Math.min(MAX_SQUAD, this.count));
      this.stats.gatesTaken++;
      const delta = this.count - before;
      this.events.push({ t: 'gate', x: LANES[g.lane], label: gateLabel(g), good: delta >= 0, delta });
    }

    // Enemies: contact with the squad, or slip past to the barricade.
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.flash = Math.max(0, e.flash - dt * 6);
      e.wobble += dt * 8;
      e.z -= e.speed * dt;
      const ahead = e.z - this.dist;
      if (ahead > FIRE_RANGE + 400) continue; // far away, nothing to do yet
      if (!e.seen && ahead < FIRE_RANGE + 60) {
        // Quiet rubber-banding: if you're behind the expected power curve, zombies come in softer
        // (never harder) — this breaks the "fewer soldiers → more leaks" death spiral.
        e.seen = true;
        const k = Math.max(0.5, Math.min(1, this.currentDps / Math.max(1, e.expDps)));
        e.hp = e.maxHp = Math.max(1, Math.round(e.hp * k));
      }
      if (e.chase && ahead < 420 && ahead > 60) {
        e.x += Math.max(-55 * dt, Math.min(55 * dt, LANES[curLane] - e.x));
        e.lane = this.nearestLane(e.x);
      }
      if (!e.passed && ahead <= 8) {
        if (Math.abs(e.x - this.squadX) < LANE_W * 0.55) {
          // Runs into the squad: soldiers block it with their bodies (the barricade is safe),
          // but you lose firepower. The squad never drops below 1 — only the barricade ends a run.
          e.alive = false;
          this.biteAcc += e.power;
          const lost = Math.min(this.count - 1, Math.floor(this.biteAcc));
          this.biteAcc -= Math.floor(this.biteAcc);
          this.count -= lost;
          this.events.push({ t: 'squadHit', x: e.x, lost });
          continue;
        }
        e.passed = true;
      }
      if (e.passed && ahead <= -BARRICADE_GAP) {
        e.alive = false;
        this.wall -= e.leak;
        this.wallFlash = 1;
        this.stats.leaks++;
        this.events.push({ t: 'leak', x: e.x, dmg: e.leak });
      }
    }
    this.wallFlash = Math.max(0, this.wallFlash - dt * 4);

    for (const c of this.crates) {
      c.flash = Math.max(0, c.flash - dt * 6);
      if (c.alive && c.z < this.dist - 10) c.alive = false;
    }

    // Boss contact: eats soldiers.
    this.boss.flash = Math.max(0, this.boss.flash - dt * 6);
    if (this.boss.active && this.boss.z <= this.dist + 45) {
      this.boss.eatAcc += this.boss.eat * dt;
      while (this.boss.eatAcc >= 1) {
        this.boss.eatAcc -= 1;
        if (this.count > 1) {
          this.count--;
          this.events.push({ t: 'squadHit', x: this.squadX, lost: 1 });
        } else {
          // Nothing left to eat — the boss smashes through to the barricade.
          this.wall -= 1;
          this.wallFlash = 1;
          this.events.push({ t: 'leak', x: this.squadX, dmg: 1 });
        }
      }
    }

    this.peak = Math.max(this.peak, this.count);
    if (this.enemies.length > 80 && this.t % 1 < dt) this.enemies = this.enemies.filter((e) => e.alive);

    if (this.boss.hp <= 0) {
      this.boss.hp = 0;
      this.state = 'won';
      this.events.push({ t: 'win' });
    } else if (this.wall <= 0) {
      this.wall = 0;
      this.state = 'lost';
      this.events.push({ t: 'lose' });
    }
  }

  private nearestLane(x: number): number {
    let best = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(LANES[i] - x) < Math.abs(LANES[best] - x)) best = i;
    return best;
  }

  private volley(curLane: number) {
    if (this.count <= 0) return;
    const total = this.volleyDamage;
    const k = Math.min(this.weapon === 2 ? 7 : 5, Math.ceil(this.count / 4));
    const spread = Math.min(LANE_W * 0.7, 10 + Math.sqrt(this.count) * 8);
    const pierce = this.perks.pierce;
    for (let i = 0; i < k; i++) {
      const x = this.squadX + (k === 1 ? 0 : (i / (k - 1) - 0.5) * spread) + (Math.random() - 0.5) * 6;
      this.bullets.push({ x, z: this.dist + 14, z0: this.dist, dmg: total / k, pierce, hit: [], alive: true });
    }
    // Flank fire: a couple of bullets into each neighbouring lane.
    const side = SIDE_MUL[this.perks.side];
    if (side > 0) {
      for (const l of [curLane - 1, curLane + 1]) {
        if (l < 0 || l > 2) continue;
        for (let i = 0; i < 2; i++) {
          const x = LANES[l] + (i - 0.5) * 24;
          this.bullets.push({ x, z: this.dist + 14, z0: this.dist, dmg: (total * side) / 2, pierce, hit: [], alive: true });
        }
      }
    }
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
      let best: { z: number; kind: 'e' | 'g' | 'c' | 'b'; ref: Enemy | Gate | Crate | null } | null = null;
      for (const e of this.enemies) {
        if (!e.alive || e.passed) continue;
        const r = e.big ? 20 : 10;
        if (Math.abs(e.x - b.x) > r + 14) continue;
        if (e.z - r > b.z || e.z + r < prev) continue;
        if (b.hit.includes(e)) continue;
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
        if (best.kind === 'e') {
          const e = best.ref as Enemy;
          const hpBefore = e.hp;
          this.applyHit('e', e, b);
          b.hit.push(e);
          if (b.pierce > 0) b.pierce--; // piercing: full damage carries on
          else if (b.dmg > hpBefore) b.dmg -= hpBefore; // overkill carries into the next zombie
          else b.alive = false;
        } else {
          b.alive = false;
          this.applyHit(best.kind, best.ref, b);
        }
      } else if (b.z - b.z0 > FIRE_RANGE) b.alive = false;
    }
    if (this.bullets.length > 120) this.bullets = this.bullets.filter((b) => b.alive);
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
        this.gainXp(e.xp);
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
        this.weapon = Math.min(WEAPONS.length - 1, this.weapon + 1);
        this.events.push({ t: 'crateOpen', x: LANES[c.lane], z: c.z, label: WEAPONS[this.weapon].name.toUpperCase() + '!' });
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
