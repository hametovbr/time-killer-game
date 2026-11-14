/**
 * Headless balance check: plays levels with a bot and prints duration / result.
 * Usage: npm run sim -- [fromLevel] [toLevel] [skill] [upgradeLevel]
 */
import { generateLevel } from '../src/game/levels';
import { Sim } from '../src/game/sim';
import { Bot } from '../src/game/bot';
import { startSquad, damageMul, WEAPONS } from '../src/game/balance';

const [from = 1, to = 30, skill = 0.8, upg = -1] = process.argv.slice(2).map(Number);
const DT = 1 / 60;

let wins = 0;
for (let n = from; n <= to; n++) {
  const u = upg >= 0 ? upg : Math.floor(n / 3);
  const lvl = generateLevel(n);
  const sim = new Sim(lvl, {
    startCount: startSquad(Math.min(20, u)),
    startWeapon: Math.min(WEAPONS.length - 1, Math.floor(n / 9)),
    dmgMul: damageMul(Math.min(25, u)),
  });
  const bot = new Bot(skill);
  while (sim.state === 'playing' && sim.t < 240) sim.step(DT, bot.think(sim, DT));
  if (sim.state === 'won') wins++;
  console.log(
    `L${String(n).padStart(2)} ${lvl.type.padEnd(6)} d=${String(lvl.d).padStart(2)} len=${Math.round(lvl.length)} boss=${lvl.boss.hp} ` +
      `${sim.state.padEnd(7)} t=${sim.t.toFixed(1).padStart(5)}s end=${sim.count} peak=${sim.peak} w=${sim.weapon} r=${sim.rank} kills=${sim.stats.kills}/${lvl.enemies.length} bossLeft=${Math.round(sim.boss.hp)}`,
  );
}
console.log(`wins ${wins}/${to - from + 1}`);
