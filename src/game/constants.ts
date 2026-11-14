export const W = 400;
export const H = 720;

export const LANES = [80, 200, 320] as const; // lane centre x
export const LANE_W = 116;
export const ROAD_L = 20;
export const ROAD_R = 380;

export const SQUAD_Y = 590; // screen y of the squad front
export const RUN_SPEED = 150; // px per second of track
export const BULLET_SPEED = 950;
export const MAX_SQUAD = 999;
export const FIRE_RANGE = SQUAD_Y - 40; // bullets travel this far ahead (track px)

export const COLORS = {
  grass: '#2f6b3e',
  grassDark: '#285d36',
  road: '#3b4160',
  roadDark: '#333852',
  laneLine: 'rgba(255,255,255,0.35)',
  friend: '#45b4ff',
  friendDark: '#1f6fb8',
  enemy: '#7bd34a',
  enemyDark: '#3c7a1f',
  good: '#3fb4ff',
  goodDark: '#1f6fb8',
  bad: '#ff5a5a',
  badDark: '#a82c2c',
  gold: '#ffc83d',
  text: '#ffffff',
};
