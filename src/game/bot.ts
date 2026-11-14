import { LANES, RUN_SPEED } from './constants';
import type { PerkId } from './balance';
import type { Sim, Input } from './sim';

const PERK_PRIORITY: PerkId[] = ['side', 'damage', 'firerate', 'pierce', 'rank', 'weapon', 'recruits', 'repair'];

/** Autoplayer for balance simulation and the menu backdrop. skill 0..1. */
export class Bot {
  private lane = 1;
  private timer = 0;
  constructor(private skill = 0.8) {}

  think(sim: Sim, dt: number): Input {
    if (sim.choices) {
      sim.choose(this.pickPerk(sim));
      return { lane: this.lane };
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.2 + (1 - this.skill) * 0.6;
      this.lane = Math.random() > this.skill ? Math.floor(Math.random() * 3) : this.choose(sim);
    }
    return { lane: this.lane };
  }

  private pickPerk(sim: Sim): number {
    const ch = sim.choices!;
    if (sim.wall < sim.wallMax * 0.4) {
      const r = ch.findIndex((p) => p.id === 'repair');
      if (r >= 0) return r;
    }
    let best = 0;
    for (let i = 1; i < ch.length; i++) if (PERK_PRIORITY.indexOf(ch[i].id) < PERK_PRIORITY.indexOf(ch[best].id)) best = i;
    return best;
  }

  private choose(sim: Sim): number {
    const dps = Math.max(0.1, sim.currentDps);
    const next = sim.gates.filter((g) => !g.done && g.z > sim.dist).sort((a, b) => a.z - b.z);
    const row = next.length && next[0].z - sim.dist < 260 ? next.filter((g) => g.z === next[0].z) : [];
    let bestLane = sim.lane;
    let bestScore = -Infinity;
    for (let lane = 0; lane < 3; lane++) {
      // Threat: seconds of fire needed for zombies in this lane, weighted by how soon they arrive.
      let threat = 0;
      for (const e of sim.enemies) {
        if (!e.alive || e.passed || Math.abs(e.x - LANES[lane]) > 50) continue;
        const ahead = e.z - sim.dist;
        if (ahead < -5 || ahead > 520) continue;
        threat += (e.hp / dps) * (e.big ? 3 : 1) * (1 / (1 + ahead / 160));
      }
      let score = threat;
      const boss = sim.boss;
      if (boss.active) {
        // The boss is the main threat: follow it (anticipating telegraphed switches), but not blindly.
        const bossLane = boss.telegraph > 0 && boss.telegraph < 0.5 ? boss.nextLane : boss.lane;
        const urgency = 1 - Math.max(0, Math.min(1, (boss.z - sim.dist) / 500));
        if (lane === bossLane) score += 1.5 + 4 * urgency;
      }
      const g = row.find((x) => x.lane === lane);
      if (row.length) {
        let after = sim.count;
        if (g) {
          if (g.op === '+' || g.op === '-') after += g.val;
          else if (g.op === 'x') after *= g.val;
          else after = Math.ceil(after / g.val);
        }
        score += Math.log(Math.max(0.5, after) / Math.max(1, sim.count)) * 2.5;
      }
      const crate = sim.crates.find((c) => c.alive && c.lane === lane && c.z > sim.dist && c.z - sim.dist < 400);
      if (crate && crate.hp < dps * ((crate.z - sim.dist) / RUN_SPEED)) score += 0.6;
      score += lane === sim.lane ? 0.08 : 0;
      if (score > bestScore) {
        bestScore = score;
        bestLane = lane;
      }
    }
    return bestLane;
  }
}
