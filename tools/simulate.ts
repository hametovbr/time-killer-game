/**
 * Headless balance check: plays levels with a bot and prints duration / result.
 * Usage: npm run sim -- [fromLevel] [toLevel] [skill] [upgradeLevel]
 */
import { generateLevel } from '../src/game/levels';
import { Sim } from '../src/game/sim';
import { Bot } from '../src/game/bot';
import { startSquad, damageMul, barricadeHp, MAX_START_WEAPON } from '../src/game/balance';

const [from = 1, to = 30, skill = 0.8, upg = -1] = process.argv.slice(2).map(Number);
const DT = 1 / 60;

/** A player who never changes lane — the old "just dodge/stand still" strategy should fail. */
const STATIC = process.env.STATIC === '1';

let wins = 0;
let bossLosses = 0;
let reachedBoss = 0;
let fightT = 0;
for (let n = from; n <= to; n++) {
  const u = upg >= 0 ? upg : Math.floor(n / 3);
  const lvl = generateLevel(n);
  const sim = new Sim(lvl, {
    startCount: startSquad(Math.min(20, u)),
    startWeapon: Number(process.env.WEAPON ?? Math.min(MAX_START_WEAPON, Math.floor(n / 9))),
    dmgMul: damageMul(Math.min(25, u)),
    wallHp: barricadeHp(Math.min(20, u)),
  });
  if (process.env.NOCRATE) sim.crates = [];
  if (process.env.NOPERKWEAPON) sim.perks.weapon = 99;
  const bot = new Bot(skill);
  while (sim.state === 'playing' && sim.t < 240) {
    const inp = bot.think(sim, DT);
    sim.step(DT, STATIC ? { lane: 1 } : inp);
  }
  if (sim.state === 'won') wins++;
  if (sim.boss.active) {
    reachedBoss++;
    fightT += sim.t - sim.bossStartT;
    if (sim.state === 'lost') bossLosses++;
  }
  console.log(
    `L${String(n).padStart(2)} ${lvl.type.padEnd(6)} d=${String(lvl.d).padStart(2)} T=${lvl.duration.toFixed(0)}s z=${lvl.enemies.length} ` +
      `${sim.state.padEnd(5)} t=${sim.t.toFixed(1).padStart(5)} wall=${sim.wall}/${sim.wallMax} squad=${sim.count}/${sim.peak} ` +
      `kills=${sim.stats.kills} leaks=${sim.stats.leaks} ups=${sim.ups} w=${sim.weapon} boss=${Math.round(sim.boss.hp)}/${sim.boss.maxHp}${sim.boss.active ? ` fight=${(sim.t - sim.bossStartT).toFixed(1)}s` : ''}${sim.bossSmashed ? ' SMASHED' : ''}`,
  );
}
console.log(`wins ${wins}/${to - from + 1} · reached boss ${reachedBoss} · lost to boss ${bossLosses} · avg fight ${(fightT / Math.max(1, reachedBoss)).toFixed(1)}s`);
