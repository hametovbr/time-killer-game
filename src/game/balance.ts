export interface Weapon {
  name: string;
  icon: string;
  rate: number; // volleys per second
  dmg: number; // damage per soldier per volley
  color: string;
}

export const WEAPONS: Weapon[] = [
  { name: 'Pistol', icon: '🔫', rate: 2.2, dmg: 1, color: '#ffe36b' },
  { name: 'SMG', icon: '🔫', rate: 4.5, dmg: 0.9, color: '#ffd04a' },
  { name: 'Shotgun', icon: '💥', rate: 2.6, dmg: 2.6, color: '#ffa94a' },
  { name: 'Rifle', icon: '🎯', rate: 5, dmg: 1.7, color: '#ff8a4a' },
  { name: 'Minigun', icon: '⚙️', rate: 10, dmg: 1.2, color: '#ff6b4a' },
  { name: 'Laser', icon: '⚡', rate: 8, dmg: 2.4, color: '#7af0ff' },
];
export const RANK_MUL = [1, 1.3, 1.7, 2.2, 2.9, 3.8];
export const RANK_NAMES = ['Private', 'Corporal', 'Sergeant', 'Lieutenant', 'Captain', 'Major'];

/** Firepower grows sub-linearly with headcount: ×-gates feel great but don't trivialise everything. */
export const squadPower = (count: number) => Math.pow(Math.max(0, count), 0.8);
export const dps = (count: number, weapon: number, rank: number, dmgMul: number) =>
  squadPower(count) * WEAPONS[weapon].rate * WEAPONS[weapon].dmg * RANK_MUL[rank] * dmgMul;

export type UpgradeId = 'squad' | 'weapon' | 'damage' | 'income';

export interface UpgradeInfo {
  id: UpgradeId;
  title: string;
  icon: string;
  max: number;
  baseCost: number;
  growth: number;
  describe: (lvl: number) => string;
}

export const UPGRADES: UpgradeInfo[] = [
  { id: 'squad', title: 'Starting squad', icon: '👥', max: 20, baseCost: 30, growth: 1.42, describe: (l) => `${startSquad(l)} soldiers` },
  { id: 'weapon', title: 'Starting weapon', icon: '🔫', max: WEAPONS.length - 1, baseCost: 150, growth: 2.6, describe: (l) => WEAPONS[l].name },
  { id: 'damage', title: 'Damage', icon: '💪', max: 25, baseCost: 40, growth: 1.38, describe: (l) => `+${Math.round((damageMul(l) - 1) * 100)}%` },
  { id: 'income', title: 'Income', icon: '💰', max: 15, baseCost: 50, growth: 1.45, describe: (l) => `+${Math.round((incomeMul(l) - 1) * 100)}% coins` },
];

export const startSquad = (l: number) => 3 + l;
export const damageMul = (l: number) => 1 + 0.1 * l;
export const incomeMul = (l: number) => 1 + 0.15 * l;
export const upgradeCost = (u: UpgradeInfo, l: number) => Math.round((u.baseCost * Math.pow(u.growth, l)) / 5) * 5;

export function starsFor(endCount: number, peak: number): number {
  const r = endCount / Math.max(1, peak);
  return r >= 0.6 ? 3 : r >= 0.3 ? 2 : 1;
}

export function levelReward(n: number, stars: number, endCount: number, incomeLvl: number): number {
  const mult = stars === 3 ? 2 : stars === 2 ? 1.5 : 1;
  return Math.round((30 + 8 * n + Math.min(endCount, 300) * 0.3) * mult * incomeMul(incomeLvl));
}
