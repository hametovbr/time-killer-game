import { BASE_FIRE_RATE, CHAMPION_SHOTS } from './constants';

export type UpgradeId = 'fire' | 'hp' | 'champ' | 'income';

export interface UpgradeInfo {
  id: UpgradeId;
  title: string;
  icon: string;
  max: number;
  baseCost: number;
  describe: (lvl: number) => string;
}

export const UPGRADES: UpgradeInfo[] = [
  {
    id: 'fire',
    title: 'Скорострельность',
    icon: '🔥',
    max: 20,
    baseCost: 40,
    describe: (l) => `${fireRate(l).toFixed(1)} выстр/с`,
  },
  {
    id: 'hp',
    title: 'Прочность базы',
    icon: '🛡️',
    max: 15,
    baseCost: 35,
    describe: (l) => `${playerBaseHp(l)} HP`,
  },
  {
    id: 'champ',
    title: 'Заряд чемпиона',
    icon: '👑',
    max: 10,
    baseCost: 60,
    describe: (l) => `${championShots(l)} выстрелов`,
  },
  {
    id: 'income',
    title: 'Доход',
    icon: '💰',
    max: 15,
    baseCost: 50,
    describe: (l) => `+${Math.round((incomeMul(l) - 1) * 100)}% монет`,
  },
];

export const fireRate = (l: number) => BASE_FIRE_RATE * (1 + 0.12 * l);
export const playerBaseHp = (l: number) => 10 + 3 * l;
export const championShots = (l: number) => Math.round(CHAMPION_SHOTS * Math.pow(0.9, l));
export const incomeMul = (l: number) => 1 + 0.15 * l;
export const upgradeCost = (u: UpgradeInfo, l: number) => Math.round((u.baseCost * Math.pow(1.45, l)) / 5) * 5;

export function starsFor(hpLeft: number, hpMax: number): number {
  const r = hpLeft / hpMax;
  return r >= 0.7 ? 3 : r >= 0.35 ? 2 : 1;
}

export function levelReward(n: number, stars: number, incomeLvl: number): number {
  const mult = stars === 3 ? 2 : stars === 2 ? 1.5 : 1;
  return Math.round((30 + 8 * n) * mult * incomeMul(incomeLvl));
}

export function bonusReward(unitsCollected: number, incomeLvl: number): number {
  return Math.round(unitsCollected * 0.12 * incomeMul(incomeLvl));
}
