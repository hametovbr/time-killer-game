/**
 * Headless balance check: plays levels with a bot and prints duration / result.
 * Usage: npm run sim -- [fromLevel] [toLevel] [skill] [upgradeLevel]
 */
import { generateLevel } from '../src/game/levels';
import { Sim } from '../src/game/sim';
import { Bot } from '../src/game/bot';
import { fireRate, playerBaseHp, championShots } from '../src/game/balance';

const [from = 1, to = 30, skill = 0.8, upg = -1] = process.argv.slice(2).map(Number);
const DT = 1 / 60;

let wins = 0;
for (let n = from; n <= to; n++) {
  // Default: assume the player bought roughly n/3 levels of each upgrade by level n.
  const u = upg >= 0 ? upg : Math.floor(n / 3);
  const lvl = generateLevel(n);
  const sim = new Sim(lvl, { fireRate: fireRate(u), playerBaseHp: playerBaseHp(u), championShots: championShots(Math.floor(u / 2)) });
  const bot = new Bot(skill);
  while (sim.state === 'playing' && sim.t < 180) sim.step(DT, bot.think(sim, DT));
  if (sim.state === 'won') wins++;
  console.log(
    `L${String(n).padStart(2)} ${lvl.type.padEnd(6)} d=${String(lvl.d).padStart(2)} baseHP=${String(lvl.enemyBaseHp).padStart(5)} ` +
      `${sim.state.padEnd(7)} t=${sim.t.toFixed(1).padStart(5)}s hp=${sim.playerHp}/${sim.playerHpMax} ` +
      `peak=${sim.stats.peakUnits} kills=${sim.stats.killed} gates=${lvl.gates.length} walls=${lvl.walls.length} spin=${lvl.spinners.length}` +
      (lvl.type === 'bonus' ? ` collected=${sim.collected}` : ''),
  );
}
console.log(`wins ${wins}/${to - from + 1}`);
