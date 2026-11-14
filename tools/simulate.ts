/**
 * Headless balance check: plays levels with a bot and prints duration / result.
 * Usage: npm run sim -- [fromLevel] [toLevel] [skill] [upgradeLevel]
 */
import { generateLevel } from '../src/game/levels';
import { Sim } from '../src/game/sim';
import { Bot } from '../src/game/bot';
import { startSquad, damageMul, barricadeHp, WEAPONS } from '../src/game/balance';

const [from = 1, to = 30, skill = 0.8, upg = -1] = process.argv.slice(2).map(Number);
const DT = 1 / 60;

/** A player who never changes lane — the old "just dodge/stand still" strategy should fail. */
const STATIC = process.env.STATIC === '1';

let wins = 0;
for (let n = from; n <= to; n++) {
  const u = upg >= 0 ? upg : Math.floor(n / 3);
  const lvl = generateLevel(n);
  const sim = new Sim(lvl, {
    startCount: startSquad(Math.min(20, u)),
    startWeapon: Math.min(WEAPONS.length - 1, Math.floor(n / 9)),
    dmgMul: damageMul(Math.min(25, u)),
    wallHp: barricadeHp(Math.min(20, u)),
  });
  const bot = new Bot(skill);
  while (sim.state === 'playing' && sim.t < 240) {
    const inp = bot.think(sim, DT);
    sim.step(DT, STATIC ? { lane: 1 } : inp);
  }
  if (sim.state === 'won') wins++;
  console.log(
    `L${String(n).padStart(2)} ${lvl.type.padEnd(6)} d=${String(lvl.d).padStart(2)} T=${lvl.duration.toFixed(0)}s z=${lvl.enemies.length} ` +
      `${sim.state.padEnd(5)} t=${sim.t.toFixed(1).padStart(5)} wall=${sim.wall}/${sim.wallMax} squad=${sim.count}/${sim.peak} ` +
      `kills=${sim.stats.kills} leaks=${sim.stats.leaks} ups=${sim.ups} w=${sim.weapon} boss=${Math.round(sim.boss.hp)}/${sim.boss.maxHp}`,
  );
}
console.log(`wins ${wins}/${to - from + 1}`);
