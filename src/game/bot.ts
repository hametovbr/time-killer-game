import { LANES, RUN_SPEED } from './constants';
import type { Sim, Input } from './sim';

/** Autoplayer for balance simulation and the menu backdrop. skill 0..1. */
export class Bot {
  private lane = 1;
  private timer = 0;
  constructor(private skill = 0.8) {}

  think(sim: Sim, dt: number): Input {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.25 + (1 - this.skill) * 0.5;
      this.lane = Math.random() > this.skill ? Math.floor(Math.random() * 3) : this.choose(sim);
    }
    return { lane: this.lane };
  }

  private choose(sim: Sim): number {
    const dps = Math.max(0.1, sim.currentDps);
    let bestLane = sim.lane;
    let bestScore = -Infinity;
    // Next gate row ahead.
    const next = sim.gates.filter((g) => !g.done && g.z > sim.dist).sort((a, b) => a.z - b.z);
    const rowZ = next.length ? next[0].z : sim.dist + 600;
    for (let lane = 0; lane < 3; lane++) {
      let count = sim.count;
      // Enemies in this lane before the gate row: those we can't shoot down in time hit us.
      let budget = dps * ((rowZ - sim.dist) / (RUN_SPEED + 40));
      const threats = sim.enemies
        .filter((e) => e.alive && Math.abs(e.x - LANES[lane]) < 50 && e.z > sim.dist && e.z < rowZ + 40)
        .sort((a, b) => a.z - b.z);
      for (const e of threats) {
        if (budget >= e.hp) budget -= e.hp;
        else count -= e.power;
      }
      const g = next.find((x) => x.z === rowZ && x.lane === lane);
      if (g) {
        if (g.op === '+' || g.op === '-') count += g.val;
        else if (g.op === 'x') count *= g.val;
        else count = Math.ceil(count / g.val);
      }
      let score = Math.log(Math.max(0.5, count));
      const crate = sim.crates.find((c) => c.alive && c.lane === lane && c.z > sim.dist && c.z < sim.dist + 500);
      if (crate && dps * 2.5 > crate.hp) score += 0.35;
      score -= Math.abs(lane - sim.lane) * 0.02;
      if (score > bestScore) {
        bestScore = score;
        bestLane = lane;
      }
    }
    return bestLane;
  }
}
