import { Rng } from './rng';
import { LANES } from './constants';
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
  power: number; // soldiers it takes on contact
  big: boolean;
  chase: boolean;
  speed: number;
}
export interface CrateDef {
  z: number;
  lane: number;
  kind: 'weapon' | 'rank';
  hp: number;
}
export interface BossDef {
  z: number;
  hp: number;
  speed: number;
  eat: number; // soldiers per second while in contact
}
export interface LevelDef {
  n: number;
  type: LevelType;
  d: number;
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
  rankCrate: 6,
  divide: 7,
  chasers: 8,
  big: 10,
  x3: 12,
};

const INTROS: Record<number, string> = {
  1: 'Веди пальцем: отряд встаёт на полосу под пальцем. Проходи синие ворота!',
  2: 'Красные ворота отнимают солдат — обходи их',
  3: 'Расстреляй ящик 🔫 — получишь оружие лучше',
  4: 'Стреляй по воротам +/− — число на них растёт!',
  5: 'БОСС! Набери отряд побольше до конца трассы',
  6: 'Ящик ⭐ повышает ранг солдат — больше урона',
  7: 'Ворота ÷ делят отряд. Осторожно!',
  8: 'Некоторые зомби бегут на твою полосу',
  10: 'Громилы: много HP, забирают 6 солдат',
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

  // Expected player state at this level (upgrades bought ~ every 3 levels) — used to scale HP.
  const expUp = Math.floor(n / 3);
  let expWeapon = Math.min(WEAPONS.length - 1, Math.floor(n / 9));
  let expRank = 0;
  const start = startSquad(Math.min(20, expUp));
  // Designed squad-size curve over the level: gates are tuned to roughly follow it.
  const peakT = Math.min(450, 25 + 7 * n);
  let expCount = start;
  const expDmg = damageMul(Math.min(25, expUp));
  const expDps = () => dps(Math.max(1, expCount), expWeapon, expRank, expDmg);

  const gates: GateDef[] = [];
  const enemies: EnemyDef[] = [];
  const crates: CrateDef[] = [];
  const beats = Math.round(9 + Math.min(9, n * 0.45) + (type === 'boss' ? 2 : 0));
  const enemyHp = () => Math.max(1, Math.round(expDps() * (0.1 + Math.min(0.08, d * 0.004)) * rng.range(0.8, 1.2)));
  const enemySpeed = Math.min(70, 25 + d * 2);
  let z = 520;
  const estLen = 520 + beats * 360;
  const target = (zz: number) => start + (peakT - start) * Math.min(1, zz / estLen);
  let weaponCrates = 0;
  let rankCrates = 0;

  for (let b = 0; b < beats; b++) {
    const roll = rng.next();
    const lastBeats = b >= beats - 2;
    let kind: 'gates' | 'enemies' | 'crate';
    if (b === 0 || b % 2 === 0) kind = 'gates';
    else if (n >= UNLOCK.weaponCrate && weaponCrates < (n < 10 ? 1 : 2) && roll < 0.35 && !lastBeats) kind = 'crate';
    else if (n >= UNLOCK.rankCrate && rankCrates < 1 && roll < 0.5 && !lastBeats) kind = 'crate';
    else kind = n <= 2 && b < 3 ? 'gates' : 'enemies';

    if (kind === 'gates') {
      expCount = target(z);
      const want = Math.max(2, target(z + 700) - expCount);
      const lanes = rng.chance(n < 3 ? 0.3 : 0.6) ? [0, 1, 2] : rng.shuffle([0, 1, 2]).slice(0, 2).sort();
      const row: GateDef[] = [];
      for (const lane of lanes) {
        const good = b === 0 || rng.chance(n < UNLOCK.minus ? 1 : 0.55);
        let op: GateOp;
        let v: number;
        if (good) {
          const useX = expCount >= 4 && expCount * 2 <= expCount + want * 2.2 && rng.chance(0.45);
          op = useX ? 'x' : '+';
          v = useX ? (n >= UNLOCK.x3 && expCount * 3 <= expCount + want * 3 && rng.chance(0.3) ? 3 : 2) : Math.max(2, Math.round(want * rng.range(0.6, 1.5)));
        } else {
          const useDiv = n >= UNLOCK.divide && expCount >= 6 && rng.chance(0.3);
          op = useDiv ? '/' : '-';
          v = useDiv ? 2 : Math.max(2, Math.round(Math.min(want, expCount * 0.6) * rng.range(0.6, 1.0)));
        }
        row.push({ z, lane, op, v, shootable: n >= UNLOCK.shootable && (op === '+' || op === '-') });
      }
      if (!row.some((g) => g.op === '+' || g.op === 'x')) {
        row[0].op = '+';
        row[0].v = Math.max(3, Math.round(want));
      }
      gates.push(...row);
      z += rng.range(300, 380);
    } else if (kind === 'crate') {
      const isWeapon = n >= UNLOCK.weaponCrate && weaponCrates < (n < 10 ? 1 : 2) && (rankCrates >= 1 || n < UNLOCK.rankCrate || rng.chance(0.5));
      const lane = rng.int(0, 2);
      crates.push({ z: z + 40, lane, kind: isWeapon ? 'weapon' : 'rank', hp: Math.round(expDps() * rng.range(1.2, 1.8) + 4) });
      if (isWeapon) {
        weaponCrates++;
        expWeapon = Math.min(WEAPONS.length - 1, expWeapon + 1);
      } else {
        rankCrates++;
        expRank = Math.min(5, expRank + 1);
      }
      // Guards in other lanes.
      for (const l of [0, 1, 2]) {
        if (l === lane || rng.chance(0.5)) continue;
        for (let i = 0; i < 2 + Math.floor(d / 6); i++)
          enemies.push({ z: z + i * 26, lane: l, hp: enemyHp(), power: 1, big: false, chase: false, speed: enemySpeed });
      }
      z += rng.range(320, 400);
    } else {
      const groupLanes = rng.chance(0.3 + Math.min(0.3, d * 0.012)) ? rng.shuffle([0, 1, 2]).slice(0, 2) : [rng.int(0, 2)];
      for (const lane of groupLanes) {
        const k = Math.min(8, 2 + Math.round(d * 0.18) + rng.int(0, 2));
        for (let i = 0; i < k; i++) {
          enemies.push({
            z: z + i * 24,
            lane,
            hp: enemyHp(),
            power: 1,
            big: false,
            chase: n >= UNLOCK.chasers && rng.chance(Math.min(0.35, 0.1 + d * 0.01)),
            speed: enemySpeed,
          });
        }
      }
      if (n >= UNLOCK.big && rng.chance(Math.min(0.6, 0.25 + d * 0.015))) {
        enemies.push({ z: z + 60, lane: rng.int(0, 2), hp: enemyHp() * 7, power: 6, big: true, chase: false, speed: enemySpeed * 0.6 });
      }
      z += rng.range(330, 420);
    }
  }

  const length = z + 100;
  // Boss HP assumes the player got about half of the crate upgrades.
  expCount = peakT * 0.85;
  expWeapon = Math.max(0, expWeapon - Math.floor(weaponCrates / 2));
  expRank = Math.max(0, expRank - 1);
  const bossT = type === 'boss' ? 10 : 6;
  const boss: BossDef = {
    z: length + 520,
    hp: Math.round(expDps() * bossT),
    speed: Math.min(60, 26 + d * 1.2),
    eat: 6 + d * 0.6,
  };

  return {
    n,
    type,
    d,
    length,
    gatePoint: Math.max(1, expDps() * 0.08),
    gates,
    enemies,
    crates,
    boss,
    intro: INTROS[n] ?? null,
  };
}

export const laneX = (lane: number) => LANES[lane];
