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
  | { t: 'crateOpen'; x: number; z: number; label: string; trait: string }
  | { t: 'levelUp' }
  | { t: 'perk'; label: string }
  | { t: 'volley'; weapon: number }
  | { t: 'boom'; x: number; z: number; r: number }
  | { t: 'chain'; pts: { x: number; z: number }[] }
  | { t: 'bossHit'; x: number; dmg: number }
  | { t: 'bossArrive' }
  | { t: 'bossTelegraph'; lane: number }
  | { t: 'bossSummon'; lanes: number[] }
  | { t: 'bossEnrage' }
  | { t: 'bossSmash' }
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
  splash?: { r: number; mul: number };
  chain?: { jumps: number; r: number; mul: number };
}
export interface Boss {
  z: number;
  x: number;
  lane: number;
  nextLane: number;
  hp: number;
  maxHp: number;
  speed: number;
  flash: number;
  active: boolean;
  eatAcc: number;
  switchT: number;
  telegraph: number; // >0 while warning about an upcoming lane switch
  summonT: number;
  enraged: boolean;
  trampling: boolean;
}

/** Where the boss appears (track px ahead of the squad) and its hit radius. */
export const BOSS_START = 500;
export const BOSS_R = 46;

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
  bossStartT = 0;
  bossSmashed = false;
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
    this.boss = {
      z: Infinity,
      x: LANES[1],
      lane: 1,
      nextLane: 1,
      hp: bhp,
      maxHp: bhp,
      speed: (BOSS_START + BARRICADE_GAP) / level.boss.approachT,
      flash: 0,
      active: false,
      eatAcc: 0,
      switchT: 2,
      telegraph: 0,
      summonT: 1.2,
      enraged: false,
      trampling: false,
    };
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
        this.boss.z = this.dist + BOSS_START + 30;
        // The boss sizes itself to your army: a real DPS check whether you snowballed or not.
        // You need roughly k of its approach time on target while also handling its minions.
        const n = this.level.n;
        const intro = n <= 3 ? 0.65 : n <= 6 ? 0.8 : 1; // first bosses are gentler
        const k = (this.level.type === 'boss' ? 1.0 : 0.88) * intro * (this.cfg.ease ?? 1);
        const scaled = Math.round(this.currentDps * this.level.boss.approachT * k);
        this.boss.hp = this.boss.maxHp = Math.max(this.boss.maxHp, scaled);
        this.bossStartT = this.t;
        this.boss.lane = this.boss.nextLane = this.rng.int(0, 2);
        this.boss.x = LANES[this.boss.lane];
        this.events.push({ t: 'bossArrive' });
      }
    }
    this.dist += this.speed * dt;
    if (this.boss.active) this.updateBoss(dt);

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


    this.peak = Math.max(this.peak, this.count);
    if (this.enemies.length > 80 && this.t % 1 < dt) this.enemies = this.enemies.filter((e) => e.alive);

    if (this.boss.hp <= 0) {
      this.boss.hp = 0;
      this.state = 'won';
      for (const e of this.enemies) if (e.alive) {
        e.alive = false;
        this.events.push({ t: 'hit', x: e.x, z: e.z, kill: true, big: e.big });
      }
      this.events.push({ t: 'win' });
    } else if (this.wall <= 0) {
      this.wall = 0;
      this.state = 'lost';
      this.events.push({ t: 'lose' });
    }
  }

  // ---------- Boss ----------
  private updateBoss(dt: number) {
    const b = this.boss;
    const def = this.level.boss;
    b.flash = Math.max(0, b.flash - dt * 6);
    if (def.enrage && !b.enraged && b.hp < b.maxHp / 2) {
      b.enraged = true;
      b.summonT = 0;
      this.events.push({ t: 'bossEnrage' });
    }
    const rage = b.enraged ? 1.35 : 1;

    // Lane switching, telegraphed so the player can react.
    if (b.telegraph > 0) {
      b.telegraph -= dt;
      if (b.telegraph <= 0) b.lane = b.nextLane;
    } else {
      b.switchT -= dt * rage;
      if (b.switchT <= 0) {
        const options = [0, 1, 2].filter((l) => l !== b.lane);
        b.nextLane = options[this.rng.int(0, options.length - 1)];
        b.telegraph = b.enraged ? 0.6 : 0.85;
        b.switchT = this.rng.range(def.switchEvery[0], def.switchEvery[1]);
        this.events.push({ t: 'bossTelegraph', lane: b.nextLane });
      }
    }
    const tx = LANES[b.lane];
    b.x += Math.max(-280 * dt, Math.min(280 * dt, tx - b.x));

    // Minion packs into the lanes the boss is NOT in — you can't just tunnel on the boss.
    b.summonT -= dt * rage;
    if (b.summonT <= 0) {
      b.summonT = def.summonEvery;
      const others = this.rng.shuffle([0, 1, 2].filter((l) => l !== b.lane));
      const lanes = others.slice(0, b.enraged ? 2 : 1 + (this.rng.chance(0.4) ? 1 : 0));
      for (const lane of lanes) {
        for (let i = 0; i < def.minions; i++) {
          const hp = def.minionHp;
          this.enemies.push({
            z: this.dist + 470 + i * 22,
            x: LANES[lane],
            lane,
            hp,
            maxHp: hp,
            power: def.minionPower,
            leak: 1,
            xp: 1,
            big: false,
            chase: false,
            speed: def.minionSpeed,
            expDps: 0,
            seen: true,
            flash: 0,
            alive: true,
            passed: false,
            wobble: Math.random() * 6,
          });
        }
      }
      this.events.push({ t: 'bossSummon', lanes });
    }

    // Walk towards the barricade. Standing in its way slows it down, but it tramples soldiers.
    const ahead = b.z - this.dist;
    b.trampling = ahead <= 34 && Math.abs(b.x - this.squadX) < LANE_W * 0.6 && this.count > 1;
    b.z -= b.speed * rage * (b.trampling ? 0.3 : 1) * dt;
    if (b.trampling) {
      b.eatAcc += def.eat * dt;
      while (b.eatAcc >= 1 && this.count > 1) {
        b.eatAcc -= 1;
        this.count--;
        this.events.push({ t: 'squadHit', x: this.squadX, lost: 1 });
      }
    }
    if (b.z - this.dist <= -BARRICADE_GAP + 20 && b.hp > 0) {
      // The boss reached the barricade: it's over.
      this.wall = 0;
      this.wallFlash = 1;
      this.bossSmashed = true;
      this.events.push({ t: 'bossSmash' });
    }
  }

  private nearestLane(x: number): number {
    let best = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(LANES[i] - x) < Math.abs(LANES[best] - x)) best = i;
    return best;
  }

  private volley(curLane: number) {
    if (this.count <= 0) return;
    const w = WEAPONS[this.weapon];
    const total = this.volleyDamage;
    const k = Math.min(this.weapon === 2 ? 7 : 5, Math.ceil(this.count / 4));
    const spread = Math.min(LANE_W * 0.7, 10 + Math.sqrt(this.count) * 8);
    const pierce = this.perks.pierce + (w.pierce ?? 0);
    const shot = (x: number, dmg: number, extra: Partial<Bullet> = {}) =>
      this.bullets.push({ x, z: this.dist + 14, z0: this.dist, dmg, pierce, hit: [], alive: true, splash: w.splash, chain: w.chain, ...extra });
    // Explosive / chain weapons fire fewer, heavier projectiles.
    const n = w.splash || w.chain ? Math.min(3, k) : k;
    for (let i = 0; i < n; i++) {
      const x = this.squadX + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread) + (Math.random() - 0.5) * 6;
      shot(x, total / n);
    }
    const neighbours = [curLane - 1, curLane + 1].filter((l) => l >= 0 && l <= 2);
    // Shotgun pellets spill into neighbouring lanes.
    if (w.side) for (const l of neighbours) shot(LANES[l] + (Math.random() - 0.5) * 30, total * w.side);
    // Artillery shells every other lane.
    if (w.barrage) for (const l of [0, 1, 2]) if (l !== curLane) shot(LANES[l] + (Math.random() - 0.5) * 20, total * w.barrage);
    // Flank fire perk: a couple of bullets into each neighbouring lane.
    const side = SIDE_MUL[this.perks.side];
    if (side > 0) {
      for (const l of neighbours) {
        for (let i = 0; i < 2; i++) shot(LANES[l] + (i - 0.5) * 24, (total * side) / 2);
      }
    }
    this.recoil = 1;
    this.events.push({ t: 'volley', weapon: this.weapon });
  }

  /** Deal damage to a zombie; returns true if it died. */
  private damageEnemy(e: Enemy, dmg: number): boolean {
    e.hp -= dmg;
    e.flash = 1;
    const kill = e.hp <= 0;
    if (kill) {
      e.alive = false;
      this.stats.kills++;
      this.gainXp(e.xp);
    }
    this.events.push({ t: 'hit', x: e.x, z: e.z, kill, big: e.big });
    return kill;
  }

  private explode(x: number, z: number, splash: { r: number; mul: number }, dmg: number, skip: Enemy | null) {
    for (const o of this.enemies) {
      if (!o.alive || o.passed || o === skip) continue;
      const dx = o.x - x;
      const dz = o.z - z;
      if (dx * dx + dz * dz <= splash.r * splash.r) this.damageEnemy(o, dmg * splash.mul);
    }
    this.events.push({ t: 'boom', x, z, r: splash.r });
  }

  private arc(from: Enemy, chain: { jumps: number; r: number; mul: number }, dmg: number) {
    const pts = [{ x: from.x, z: from.z }];
    const hit = new Set<Enemy>([from]);
    let cur = from;
    let d = dmg;
    for (let j = 0; j < chain.jumps; j++) {
      let next: Enemy | null = null;
      let best = chain.r * chain.r;
      for (const o of this.enemies) {
        if (!o.alive || o.passed || hit.has(o)) continue;
        const dx = o.x - cur.x;
        const dz = o.z - cur.z;
        const dd = dx * dx + dz * dz;
        if (dd < best) {
          best = dd;
          next = o;
        }
      }
      if (!next) break;
      d *= chain.mul;
      hit.add(next);
      pts.push({ x: next.x, z: next.z });
      this.damageEnemy(next, d);
      cur = next;
    }
    if (pts.length > 1) this.events.push({ t: 'chain', pts });
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
      // Gates never block bullets: a bullet flying through a 🎯 gate pumps its number and keeps going,
      // so zombies behind a gate row can always be shot (otherwise some leaks were unavoidable).
      for (const g of this.gates) {
        if (g.done || !g.shootable || g.lane !== lane) continue;
        if (g.z > b.z || g.z < prev) continue;
        this.applyHit('g', g, b);
      }
      if (this.boss.active && Math.abs(b.x - this.boss.x) < BOSS_R + 6) {
        const bz = this.boss.z - 30;
        if (bz <= b.z && (!best || bz < best.z)) best = { z: bz, kind: 'b', ref: null };
      }
      if (best) {
        if (best.kind === 'e') {
          const e = best.ref as Enemy;
          const hpBefore = e.hp;
          this.damageEnemy(e, b.dmg);
          b.hit.push(e);
          if (b.splash) {
            this.explode(e.x, e.z, b.splash, b.dmg, e);
            b.alive = false;
          } else if (b.chain) {
            this.arc(e, b.chain, b.dmg);
            b.alive = false;
          } else if (b.pierce > 0) b.pierce--; // piercing: full damage carries on
          else if (b.dmg > hpBefore) b.dmg -= hpBefore; // overkill carries into the next zombie
          else b.alive = false;
        } else if (best.kind === 'c') {
          const c = best.ref as Crate;
          const hpBefore = c.hp;
          this.applyHit('c', c, b);
          if (b.dmg > hpBefore) b.dmg -= hpBefore; // breaking a crate doesn't waste the rest of the bullet
          else b.alive = false;
        } else {
          b.alive = false;
          this.applyHit(best.kind, best.ref, b);
          // Rockets/shells hitting the boss also blast the minions around it.
          if (best.kind === 'b' && b.splash) this.explode(b.x, this.boss.z - 30, b.splash, b.dmg, null);
        }
      } else if (b.z - b.z0 > FIRE_RANGE) b.alive = false;
    }
    if (this.bullets.length > 120) this.bullets = this.bullets.filter((b) => b.alive);
  }

  private applyHit(kind: 'e' | 'g' | 'c' | 'b', ref: Enemy | Gate | Crate | null, b: Bullet) {
    if (kind === 'e') {
      this.damageEnemy(ref as Enemy, b.dmg);
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
        if (this.weapon < WEAPONS.length - 1) {
          this.weapon++;
          const w = WEAPONS[this.weapon];
          this.events.push({ t: 'crateOpen', x: LANES[c.lane], z: c.z, label: `${w.icon} ${w.name.toUpperCase()}!`, trait: w.trait });
        } else {
          // Top weapon already: the crate is a supply drop — a free level-up.
          this.events.push({ t: 'crateOpen', x: LANES[c.lane], z: c.z, label: '🎁 SUPPLY DROP!', trait: 'Free upgrade' });
          if (!this.choices) {
            this.ups++;
            this.offerChoices();
          } else this.xp += xpNeed(this.ups);
        }
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
