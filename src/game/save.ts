import type { UpgradeId } from './balance';

export interface SaveData {
  v: 1;
  level: number; // next level to play
  coins: number;
  upgrades: Record<UpgradeId, number>;
  stars: Record<number, number>;
  fails: Record<number, number>; // consecutive fails per level → adaptive easing
  settings: { sound: boolean; vibration: boolean; reduceShake: boolean };
  stats: { played: number; won: number; kills: number; bestPeak: number; leaks: number };
}

const KEY = 'lanesquad.save.v1';

export function defaultSave(): SaveData {
  return {
    v: 1,
    level: 1,
    coins: 0,
    upgrades: { squad: 0, weapon: 0, damage: 0, wall: 0, income: 0 },
    stars: {},
    fails: {},
    settings: { sound: true, vibration: true, reduceShake: false },
    stats: { played: 0, won: 0, kills: 0, bestPeak: 0, leaks: 0 },
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const def = defaultSave();
    return {
      ...def,
      ...parsed,
      upgrades: { ...def.upgrades, ...(parsed.upgrades || {}) },
      settings: { ...def.settings, ...(parsed.settings || {}) },
      stats: { ...def.stats, ...(parsed.stats || {}) },
      stars: parsed.stars || {},
      fails: parsed.fails || {},
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(s: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage may be unavailable (private mode) — game still works in-memory */
  }
}

export function resetSave(): SaveData {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return defaultSave();
}
