import { Rng } from './rng';
import { W, FIELD_TOP, FIELD_BOTTOM, BASE_FIRE_RATE } from './constants';

export type LevelType = 'normal' | 'boss' | 'bonus';

export interface GateDef {
  x: number;
  y: number;
  w: number;
  kind: 'mul' | 'div';
  n: number;
  gold?: boolean;
  move?: { amp: number; speed: number; phase: number };
}
export interface WallDef {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
}
export interface SpinnerDef {
  x: number;
  y: number;
  len: number;
  speed: number;
}
export interface EnemyDef {
  speed: number;
  waveInterval: number;
  waveSize: number;
  giantEveryWaves: number; // 0 = none
  giantHp: number;
  firstWaveDelay: number;
}
export interface LevelDef {
  n: number;
  type: LevelType;
  d: number;
  enemyBaseHp: number;
  bonusDuration: number;
  enemy: EnemyDef | null;
  gates: GateDef[];
  walls: WallDef[];
  spinners: SpinnerDef[];
  champion: boolean;
  intro: string | null;
}

/** Level number at which each element first appears. */
export const UNLOCK = {
  enemies: 3,
  div: 4,
  champion: 6,
  moving: 8,
  giants: 10,
  walls: 11,
  spinners: 13,
  gold: 20,
};

export function levelType(n: number): LevelType {
  if (n % 5 === 0) return 'boss';
  if (n % 10 === 7) return 'bonus';
  return 'normal';
}

/** Sawtooth difficulty: spike on bosses, breather right after. */
export function difficulty(n: number): number {
  let d = n;
  if (levelType(n) === 'boss') d += 3;
  if (n > 5 && levelType(n - 1) === 'boss') d -= 2;
  return Math.max(1, d);
}

const INTROS: Record<number, string> = {
  1: 'Зажми и веди пальцем — пушка стреляет толпой',
  2: 'Выбирай ворота с бо́льшим множителем',
  3: 'Враги! Твоя толпа уничтожает их 1 к 1',
  4: 'Красные ворота делят толпу — объезжай их',
  5: 'БОСС: крепость прочнее обычного',
  6: 'Новое: ЧЕМПИОН. Копи шкалу и жми кнопку',
  7: 'Бонус! Набери как можно больше монет',
  8: 'Ворота начали двигаться',
  10: 'Осторожно: вражеские гиганты',
  11: 'Стены поглощают юнитов, пока не сломаются',
  13: 'Спиннер сносит всё, что задевает',
  20: 'Золотые ворота ×5 — узкие, но жирные',
};

function makeGateRow(rng: Rng, n: number, y: number, type: LevelType): GateDef[] {
  const count = n <= 1 ? 2 : rng.pick(n < 6 ? [2, 2, 3] : [1, 2, 2, 3, 3]);
  const margin = 18;
  const slot = (W - margin * 2) / count;
  const gates: GateDef[] = [];
  const divP = n >= UNLOCK.div ? Math.min(0.42, 0.22 + n * 0.008) : 0;
  const maxMul = n < 3 ? 3 : n < 12 ? 3 : 4;
  for (let i = 0; i < count; i++) {
    const w = Math.min(slot - 14, rng.range(84, 128));
    const cx = margin + slot * i + slot / 2;
    const x = count === 1 ? rng.range(110, W - 110) : cx + rng.range(-6, 6);
    const isDiv = type !== 'bonus' && rng.chance(divP);
    const g: GateDef = isDiv
      ? { x, y, w, kind: 'div', n: rng.pick([2, 2, 3]) }
      : { x, y, w, kind: 'mul', n: rng.int(2, maxMul) };
    if (n === 1) g.n = 2;
    gates.push(g);
  }
  // Guarantee at least one multiplier in the row.
  if (!gates.some((g) => g.kind === 'mul')) {
    const g = rng.pick(gates);
    g.kind = 'mul';
    g.n = 2;
  }
  // Gold gate: rare, narrow, ×5.
  if (n >= UNLOCK.gold && rng.chance(0.18)) {
    const g = rng.pick(gates);
    g.kind = 'mul';
    g.n = 5;
    g.gold = true;
    g.w = 54;
  }
  // Moving gates.
  if (n >= UNLOCK.moving) {
    const p = Math.min(0.55, 0.25 + (n - UNLOCK.moving) * 0.02);
    for (const g of gates) {
      if (rng.chance(p)) {
        const room = count === 1 ? 120 : Math.max(18, slot / 2 - g.w / 2 + 10);
        g.move = { amp: Math.min(room, 60), speed: rng.range(0.9, 1.8), phase: rng.range(0, Math.PI * 2) };
      }
    }
  }
  return gates;
}

/** Expected per-row multiplier for a reasonably good player. */
function rowValue(gates: GateDef[]): number {
  const vals = gates.map((g) => (g.kind === 'mul' ? g.n : 1 / g.n));
  const best = Math.max(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return 0.75 * best + 0.25 * avg;
}

export function generateLevel(n: number): LevelDef {
  const rng = new Rng(n * 7919 + 13);
  const type = levelType(n);
  const d = difficulty(n);

  // Vertical layout: a list of "bands" — gate rows plus obstacles.
  const rows = type === 'boss' ? 3 : n <= 2 ? 2 : n < 9 ? rng.pick([2, 3]) : rng.pick([3, 3, 4]);
  const bands: ('gates' | 'wall' | 'spinner')[] = [];
  for (let i = 0; i < rows; i++) bands.push('gates');
  if (type !== 'bonus') {
    if (n >= UNLOCK.walls && (type === 'boss' || rng.chance(0.55))) bands.splice(rng.int(1, bands.length - 1), 0, 'wall');
    if (n >= UNLOCK.spinners && (type === 'boss' || rng.chance(0.45)))
      bands.splice(rng.int(1, bands.length - 1), 0, 'spinner');
  }
  const gates: GateDef[] = [];
  const walls: WallDef[] = [];
  const spinners: SpinnerDef[] = [];
  const step = (FIELD_BOTTOM - FIELD_TOP) / Math.max(1, bands.length - 1);
  let expectMul = 1;
  bands.forEach((b, i) => {
    const y = bands.length === 1 ? (FIELD_TOP + FIELD_BOTTOM) / 2 : FIELD_TOP + step * i;
    if (b === 'gates') {
      const row = makeGateRow(rng, n, y, type);
      gates.push(...row);
      expectMul *= rowValue(row);
    } else if (b === 'wall') {
      const w = rng.range(90, 150);
      walls.push({ x: rng.range(w / 2 + 10, W - w / 2 - 10), y, w, h: 26, hp: Math.round(12 + d * 3.2) });
    } else {
      spinners.push({ x: rng.range(120, W - 120), y, len: rng.range(80, 110), speed: rng.pick([-1, 1]) * rng.range(1.4, 2.4) });
    }
  });

  // Base HP from expected throughput × target duration (20s → 45s, bosses ~60s).
  // Player's fire-rate upgrades are expected to grow ~4%/level; HP grows slower (3%) so rewards outpace challenge.
  const throughput = BASE_FIRE_RATE * Math.min(expectMul, 30) * 0.5 * (1 + 0.03 * n);
  const targetT = type === 'boss' ? Math.min(55, 32 + n * 0.5) : Math.min(40, 16 + n * 1.0);
  const enemyBaseHp = Math.round((throughput * targetT) / 10) * 10;

  let enemy: EnemyDef | null = null;
  if (type !== 'bonus' && n >= UNLOCK.enemies) {
    enemy = {
      speed: Math.min(88, 45 + d * 1.4),
      waveInterval: Math.max(1.9, 3.8 - d * 0.06),
      waveSize: Math.min(18, Math.round(3 + d * 0.42)),
      giantEveryWaves: n >= UNLOCK.giants ? (type === 'boss' ? 3 : n >= 14 ? 5 : 0) : 0,
      giantHp: Math.round(10 + d * 1.2),
      firstWaveDelay: n === UNLOCK.enemies ? 4 : 2.2,
    };
  }

  return {
    n,
    type,
    d,
    enemyBaseHp: type === 'bonus' ? 0 : Math.max(60, enemyBaseHp),
    bonusDuration: 15,
    enemy,
    gates,
    walls,
    spinners,
    champion: n >= UNLOCK.champion,
    intro: INTROS[n] ?? null,
  };
}
