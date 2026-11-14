import { W, CANNON_Y } from './constants';
import type { Sim, Input } from './sim';

/**
 * Simple autoplayer used for balance simulation and the menu attract-mode.
 * skill 0..1: 1 = always aims at the best path, 0 = random wandering.
 */
export class Bot {
  private target = W / 2;
  private retarget = 0;
  constructor(private skill = 0.8) {}

  think(sim: Sim, dt: number): Input {
    this.retarget -= dt;
    if (this.retarget <= 0) {
      this.retarget = 0.35 + (1 - this.skill) * 0.6;
      this.target = this.choose(sim);
    }
    return { x: this.target, fire: true, champion: sim.champReady };
  }

  private choose(sim: Sim): number {
    if (Math.random() > this.skill) return 30 + Math.random() * (W - 60);
    let bestX = W / 2;
    let bestScore = -Infinity;
    for (let x = 30; x <= W - 30; x += 10) {
      let score = 0;
      // Path value through gates: look at gates in order bottom->top, the unit column widens after each mul gate.
      const gates = [...sim.gates].sort((a, b) => b.y - a.y);
      let col = x;
      let colW = 6;
      for (const g of gates) {
        const overlap = Math.max(0, Math.min(col + colW, g.cx + g.w / 2) - Math.max(col - colW, g.cx - g.w / 2));
        if (overlap <= 0) continue;
        const frac = Math.min(1, overlap / (colW * 2));
        const v = g.kind === 'mul' ? Math.log(g.n) : -Math.log(g.n) * 1.2;
        score += v * frac;
        if (g.kind === 'mul') {
          col = g.cx;
          colW = g.w * 0.4;
        }
      }
      for (const w of sim.walls) if (w.hp > 0 && Math.abs(x - w.x) < w.w / 2) score -= 0.4;
      for (const s of sim.spinners) if (Math.abs(x - s.x) < s.len / 2) score -= 0.5;
      // Defend: enemies close to our base in this column.
      for (const e of sim.enemies) {
        if (e.y > CANNON_Y - 300 && Math.abs(e.x - x) < 40) score += e.giant ? 0.4 : 0.1;
      }
      score -= Math.abs(x - sim.cannonX) * 0.0015;
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
      }
    }
    return bestX;
  }
}
