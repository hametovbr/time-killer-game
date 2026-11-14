export interface Weapon {
  name: string;
  icon: string;
  rate: number; // volleys per second
  dmg: number; // damage per soldier per volley
  color: string;
  /** One-line description of what makes this weapon different (shown on pickup). */
  trait: string;
  pierce?: number; // built-in pierce (Infinity = beam through the whole lane)
  side?: number; // pellets that also fly into neighbouring lanes (damage share)
  splash?: { r: number; mul: number }; // explosion on impact
  chain?: { jumps: number; r: number; mul: number }; // lightning arcs to nearby zombies (crosses lanes)
  barrage?: number; // also shells the other lanes at this damage share (with the weapon's splash)
  bulletW?: number; // visual thickness
  bulletL?: number; // visual length
}

/**
 * The weapon ladder. Early tiers grow raw firepower; later tiers add mechanics that help with the
 * real problem of the game — covering three lanes and hordes at once.
 */
export const WEAPONS: Weapon[] = [
  { name: 'Pistol', icon: '🔫', rate: 2.2, dmg: 1, color: '#ffe36b', trait: 'Basic sidearm' },
  { name: 'SMG', icon: '🔫', rate: 4.5, dmg: 0.9, color: '#ffd04a', trait: 'Twice the fire rate' },
  { name: 'Shotgun', icon: '💥', rate: 2.6, dmg: 2.6, color: '#ffa94a', side: 0.12, trait: 'Pellets spill into neighbouring lanes' },
  { name: 'Rifle', icon: '🎯', rate: 5, dmg: 1.7, color: '#ff8a4a', pierce: 1, trait: 'Every shot pierces one zombie' },
  { name: 'Minigun', icon: '⚙️', rate: 10, dmg: 1.2, color: '#ff6b4a', trait: 'A wall of lead' },
  { name: 'Laser', icon: '⚡', rate: 8, dmg: 2.0, color: '#7af0ff', pierce: Infinity, bulletW: 4, bulletL: 34, trait: 'Beam burns through the whole lane' },
  { name: 'Rocket launcher', icon: '🚀', rate: 6, dmg: 4.6, color: '#ff7b3a', splash: { r: 62, mul: 0.85 }, bulletW: 6, bulletL: 18, trait: 'Explodes — shreds hordes' },
  { name: 'Tesla coil', icon: '🌩️', rate: 7, dmg: 4.4, color: '#b7a6ff', chain: { jumps: 5, r: 150, mul: 0.85 }, bulletW: 4, bulletL: 14, trait: 'Lightning jumps to 5 more zombies, even across lanes' },
  { name: 'Artillery', icon: '💣', rate: 3.2, dmg: 8, color: '#ffd23a', splash: { r: 48, mul: 0.6 }, barrage: 0.6, bulletW: 7, bulletL: 14, trait: 'Also shells both other lanes' },
];
/** Highest weapon you can start with via permanent upgrades — the rest come from crates and perks. */
export const MAX_START_WEAPON = 5;
export const RANK_MUL = [1, 1.3, 1.7, 2.2, 2.9, 3.8];
export const RANK_NAMES = ['Private', 'Corporal', 'Sergeant', 'Lieutenant', 'Captain', 'Major'];

/** Firepower grows sub-linearly with headcount: ×-gates feel great but don't trivialise everything. */
export const squadPower = (count: number) => Math.pow(Math.max(0, count), 0.8);
export const dps = (count: number, weapon: number, rank: number, dmgMul: number) =>
  squadPower(count) * WEAPONS[weapon].rate * WEAPONS[weapon].dmg * RANK_MUL[rank] * dmgMul;

// ---------- In-run perks (level-up: pick 1 of 3) ----------
export type PerkId = 'side' | 'pierce' | 'firerate' | 'damage' | 'recruits' | 'repair' | 'rank' | 'weapon';
export interface PerkInfo {
  id: PerkId;
  icon: string;
  title: string;
  max: number;
  weight: number;
  describe: (lvl: number) => string;
}
export const SIDE_MUL = [0, 0.2, 0.33, 0.45];
export const PERKS: PerkInfo[] = [
  { id: 'side', icon: '↔️', title: 'Flank fire', max: 3, weight: 3, describe: (l) => `Also shoot the neighbouring lanes at ${Math.round(SIDE_MUL[l + 1] * 100)}% damage` },
  { id: 'pierce', icon: '🗡️', title: 'Piercing rounds', max: 3, weight: 2, describe: (l) => `Bullets pass through ${l + 1} more zombie${l ? 's' : ''}` },
  { id: 'firerate', icon: '⏩', title: 'Rapid fire', max: 6, weight: 3, describe: () => '+20% fire rate' },
  { id: 'damage', icon: '💥', title: 'Hollow points', max: 6, weight: 3, describe: () => '+25% damage' },
  { id: 'recruits', icon: '👥', title: 'Reinforcements', max: 99, weight: 2, describe: () => '+30% soldiers (min +4)' },
  { id: 'repair', icon: '🧱', title: 'Repair barricade', max: 3, weight: 2, describe: () => 'Restore 30% of barricade HP' },
  { id: 'rank', icon: '⭐', title: 'Promotion', max: 5, weight: 2, describe: (l) => `Rank → ${RANK_NAMES[Math.min(5, l + 1)]} (damage ×${RANK_MUL[Math.min(5, l + 1)]})` },
  { id: 'weapon', icon: '🔫', title: 'New weapon', max: WEAPONS.length - 1, weight: 1, describe: () => 'Upgrade to the next weapon tier' },
];
/** XP needed for the k-th level-up in a run (k = 0, 1, 2…). */
export const xpNeed = (k: number) => 18 + 14 * k;

// ---------- Permanent upgrades ----------
export type UpgradeId = 'squad' | 'weapon' | 'damage' | 'wall' | 'income';

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
  { id: 'weapon', title: 'Starting weapon', icon: '🔫', max: MAX_START_WEAPON, baseCost: 150, growth: 2.6, describe: (l) => WEAPONS[l].name },
  { id: 'damage', title: 'Damage', icon: '💪', max: 25, baseCost: 40, growth: 1.38, describe: (l) => `+${Math.round((damageMul(l) - 1) * 100)}%` },
  { id: 'wall', title: 'Barricade', icon: '🧱', max: 20, baseCost: 35, growth: 1.4, describe: (l) => `${barricadeHp(l)} HP` },
  { id: 'income', title: 'Income', icon: '💰', max: 15, baseCost: 50, growth: 1.45, describe: (l) => `+${Math.round((incomeMul(l) - 1) * 100)}% coins` },
];

export const startSquad = (l: number) => 3 + l;
export const damageMul = (l: number) => 1 + 0.1 * l;
export const barricadeHp = (l: number) => 40 + 8 * l;
export const incomeMul = (l: number) => 1 + 0.15 * l;
export const upgradeCost = (u: UpgradeInfo, l: number) => Math.round((u.baseCost * Math.pow(u.growth, l)) / 5) * 5;

/** Stars = how much of the barricade survived. */
export function starsFor(wallHp: number, wallMax: number): number {
  const r = wallHp / Math.max(1, wallMax);
  return r >= 0.7 ? 3 : r >= 0.35 ? 2 : 1;
}

export function levelReward(n: number, stars: number, kills: number, incomeLvl: number): number {
  const mult = stars === 3 ? 2 : stars === 2 ? 1.5 : 1;
  return Math.round((30 + 8 * n + Math.min(kills, 400) * 0.15) * mult * incomeMul(incomeLvl));
}
