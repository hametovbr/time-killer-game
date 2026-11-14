import { Rng } from './rng';
import { RUN_SPEED } from './constants';
import { dps, damageMul, startSquad, WEAPONS } from './balance';

export type LevelType = 'normal' | 'boss';
export type GateOp = '+' | '-' | 'x' | '/';

export interface GateDef {
  z: number;
  lane: number;
  op: GateOp;
  v: number;
  shootable: boolean;
}
export interface EnemyDef {
  z: number;
  lane: number;
  hp: number;
  power: number; // soldiers it takes if it runs into the squad
  leak: number; // barricade damage if it gets past
  xp: number;
  big: boolean;
  chase: boolean;
  speed: number;
  expDps: number; // firepower the player is expected to have when this zombie arrives
}
export interface CrateDef {
  z: number;
  lane: number;
  kind: 'weapon';
  hp: number;
}
export interface BossDef {
  hp: number;
  /** Seconds the boss needs to walk from the top of the screen to the barricade (unblocked). */
  approachT: number;
  eat: number; // soldiers per second while it tramples the squad
  switchEvery: [number, number]; // seconds between lane switches (min, max)
  summonEvery: number; // seconds between minion packs
  minions: number; // zombies per pack
  minionHp: number;
  minionSpeed: number;
  minionPower: number;
  enrage: boolean; // boss levels: second phase at 50% HP
}
export interface LevelDef {
  n: number;
  type: LevelType;
  d: number;
  duration: number; // seconds of running before the finish line
  length: number;
  gatePoint: number; // damage needed to raise a shootable gate by 1
  gates: GateDef[];
  enemies: EnemyDef[];
  crates: CrateDef[];
  boss: BossDef;
  intro: string | null;
}

/** First level where each element appears (one new thing every 1–3 levels early on). */
export const UNLOCK = {
  minus: 2,
  weaponCrate: 3,
  shootable: 4,
  divide: 7,
  chasers: 8,
  big: 10,
  x3: 12,
};

const INTROS: Record<number, string> = {
  1: "Hold your finger over a lane. Zombies that slip past hit the barricade — don't let it fall!",
  2: 'Red gates take soldiers away — avoid them',
  3: 'Shoot the 🔫 crate to get a better weapon',
  4: 'Shoot +/− gates — their number goes up!',
  5: 'BOSS: it marches on your barricade and switches lanes — follow it and kill it in time!',
  6: 'Tip: Flank fire and Piercing rounds help you cover all three lanes',
  7: '÷ gates split your squad. Careful!',
  8: 'Yellow zombies switch lanes towards you',
  10: 'Brutes: tough, and they smash the barricade hard',
};

export const levelType = (n: number): LevelType => (n % 5 === 0 ? 'boss' : 'normal');

/** Sawtooth: spike on bosses, breather after. */
export function difficulty(n: number): number {
  let d = n;
  if (levelType(n) === 'boss') d += 2;
  if (n > 5 && levelType(n - 1) === 'boss') d -= 2;
  return Math.max(1, d);
}

export function generateLevel(n: number): LevelDef {
  const rng = new Rng(n * 9973 + 7);
  const type = levelType(n);
  const d = difficulty(n);
  const T = Math.min(65, 38 + n * 0.9) + (type === 'boss' ? 6 : 0);

  // Expected player state at this level (upgrades bought ~ every 3 levels) — used to scale HP.
  const expUp = Math.floor(n / 3);
  const start = startSquad(Math.min(20, expUp));
  const peakT = Math.min(450, 25 + 7 * n);
  const target = (t: number) => start + (peakT - start) * Math.min(1, t / T);
  let expWeapon = Math.min(WEAPONS.length - 1, Math.floor(n / 9));
  const expDmg = damageMul(Math.min(25, expUp));
  // In-run level-ups add roughly +1.2% firepower per second of play.
  // HP assumes ~half the target squad: you're busy defending, not just collecting gates.
  const HPC = 0.5;
  const expDps = (t: number) => dps(Math.max(start, target(t) * HPC), expWeapon, 0, expDmg) * (1 + 0.012 * t);

  // Pressure: share of the player's firepower the zombie stream demands. >1 means you cannot stop everything.
  const pressure = Math.min(1.5, (n <= 3 ? 0.45 : 0.7) + d * 0.042);
  const hpK = 0.15; // seconds of focused fire per regular zombie (many weak zombies = the ad's horde feel)
  const zSpeed = Math.min(65, 30 + d * 1.5);
  // Soldiers lost per zombie that reaches the squad (fractional — accumulated in the sim).
  const bite = (t: number) => Math.max(0.4, target(t) * HPC * 0.04 * (hpK / 0.35));
  const placeZ = (t: number, speed: number) => t * (RUN_SPEED + speed); // arrives at the squad line at time t

  const enemies: EnemyDef[] = [];
  const push = (t: number, lane: number, opts: Partial<EnemyDef> = {}) => {
    const big = !!opts.big;
    const speed = big ? zSpeed * 0.7 : zSpeed;
    const hp = Math.max(1, Math.round(expDps(t) * hpK * (big ? 6 : 1) * rng.range(0.85, 1.15)));
    enemies.push({
      z: placeZ(t, speed),
      lane,
      hp,
      power: big ? Math.max(2, Math.round(bite(t) * 10)) : bite(t),
      leak: big ? 6 : 1, // barricade damage per zombie that gets through
      xp: big ? 6 : 1,
      big,
      chase: !!opts.chase,
      speed,
      expDps: expDps(t),
    });
  };

  // 1) Continuous stream in all three lanes, ramping up through the level.
  const lambda0 = pressure / (3 * hpK); // zombies per second per lane at full ramp
  for (let lane = 0; lane < 3; lane++) {
    let t = (n <= 3 ? 6 : 4) + rng.range(0, 1.5); // first gate comes before the first zombies
    while (t < T) {
      push(t, lane, { chase: n >= UNLOCK.chasers && rng.chance(Math.min(0.25, 0.08 + d * 0.008)) });
      const ramp = 0.55 + 0.6 * (t / T);
      t += rng.range(0.6, 1.4) / (lambda0 * ramp);
    }
  }
  // 2) Hordes every ~12 s — the sawtooth inside a level.
  for (let t = 11; t < T - 3; t += rng.range(10, 14)) {
    const lanes = rng.shuffle([0, 1, 2]).slice(0, n < 4 ? 1 : 2);
    const size = Math.min(22, 6 + Math.round(d * 0.45));
    for (const lane of lanes) for (let i = 0; i < size; i++) push(t + i * 0.07, lane);
  }
  // 3) Brutes.
  if (n >= UNLOCK.big) for (let t = 14; t < T - 4; t += rng.range(13, 18)) push(t, rng.int(0, 2), { big: true });

  // Gate rows every ~6 s, values follow a target squad-size curve.
  const gates: GateDef[] = [];
  for (let t = 4; t < T - 2; t += rng.range(5.5, 7)) {
    const z = t * RUN_SPEED;
    const cur = target(t);
    const want = Math.max(2, target(t + 6) - cur);
    const lanes = rng.chance(n < 3 ? 0.3 : 0.6) ? [0, 1, 2] : rng.shuffle([0, 1, 2]).slice(0, 2).sort();
    const row: GateDef[] = [];
    for (const lane of lanes) {
      const good = t < 6 || rng.chance(n < UNLOCK.minus ? 1 : 0.55);
      let op: GateOp;
      let v: number;
      if (good) {
        const useX = cur >= 4 && cur <= want * 2.2 && rng.chance(0.4);
        op = useX ? 'x' : '+';
        v = useX ? (n >= UNLOCK.x3 && cur * 2 <= want * 3 && rng.chance(0.3) ? 3 : 2) : Math.max(2, Math.round(want * rng.range(0.6, 1.5)));
      } else {
        const useDiv = n >= UNLOCK.divide && cur >= 6 && rng.chance(0.3);
        op = useDiv ? '/' : '-';
        v = useDiv ? 2 : Math.max(2, Math.round(Math.min(want, cur * 0.6) * rng.range(0.6, 1.0)));
      }
      row.push({ z, lane, op, v, shootable: n >= UNLOCK.shootable && (op === '+' || op === '-') });
    }
    if (!row.some((g) => g.op === '+' || g.op === 'x')) {
      row[0].op = '+';
      row[0].v = Math.max(3, Math.round(want));
    }
    gates.push(...row);
  }

  // Weapon crates.
  const crates: CrateDef[] = [];
  if (n >= UNLOCK.weaponCrate) {
    const times = n < 10 ? [T * 0.35] : [T * 0.3, T * 0.7];
    for (const t of times) {
      crates.push({ z: t * RUN_SPEED + 60, lane: rng.int(0, 2), kind: 'weapon', hp: Math.round(expDps(t) * rng.range(1.0, 1.5) + 4) });
      expWeapon = Math.min(WEAPONS.length - 1, expWeapon + 1);
    }
    // Boss HP assumes the player got about half of them.
    expWeapon = Math.max(0, expWeapon - Math.floor(times.length / 2));
  }

  const length = T * RUN_SPEED;
  // The boss is a DPS check with a deadline: it walks to the barricade and smashes it.
  // It switches lanes (you must follow it) and summons minions into the other lanes (which you must also stop).
  const isBoss = type === 'boss';
  const approachT = isBoss ? 24 : 18;
  const boss: BossDef = {
    hp: Math.round(expDps(T) * approachT * (isBoss ? 0.5 : 0.42)),
    approachT,
    eat: Math.max(2, target(T) * HPC * 0.15),
    switchEvery: isBoss ? [2.2, 3.4] : [3, 4.5],
    summonEvery: isBoss ? 2.2 : 3,
    minions: Math.min(8, 2 + Math.round(d * 0.12)),
    minionHp: Math.max(1, Math.round(expDps(T) * hpK)),
    minionSpeed: zSpeed,
    minionPower: bite(T),
    enrage: isBoss,
  };

  return {
    n,
    type,
    d,
    duration: T,
    length,
    gatePoint: Math.max(1, expDps(T * 0.5) * 0.08),
    gates,
    enemies: enemies.sort((a, b) => a.z - b.z),
    crates,
    boss,
    intro: INTROS[n] ?? null,
  };
}
