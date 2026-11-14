# LANE SQUAD — Game Design Document (v3)

> History: v1 "Mob Cannon" (cannon, Mob Control-style) → v2 "Lane Squad" (3-lane runner) → **v3**: the v2 playtest showed that dodging zombies was a dominant strategy and killing had no purpose. v3 rebuilds the core around a **barricade (lives)**, a **continuous zombie stream** and an **XP → level-up → pick 1 of 3** loop. Reasoning and sources: `docs/research.md`, part 2.

Platform: browser, mobile portrait first. No ads, no in-app purchases, no timers.

## 1. Core loop in one sentence
> Hold the line: switch between three lanes to shoot the zombie stream before it reaches your barricade, grab gates to grow your squad, level up from kills, and finish the boss.

## 2. Controls
- Hold your finger (mouse) over a lane: the squad runs to it. Shooting is automatic.
- Level-up: tap one of three cards (the game pauses while you choose).
- PC: ←/→ or A/D, 1/2/3, Esc to pause.

## 3. Field
```
 ┌─────┬─────┬─────┐  ← BOSS after the finish line
 │ 🧟🧟 │ 🧟  │🧟🧟🧟│  ← continuous stream in ALL lanes, hordes every ~12 s
 │[+12]│[×2] │[−8] │  ← gate row every ~6 s
 │     │ 👥  │     │  ← your squad (auto-fire in its lane)
 │ 🧟→ │     │  🧟→│  ← zombies that got past walk to the barricade
 ├═════╧═════╧═════┤  ← 🧱 BARRICADE (HP) — 0 HP = defeat
```

## 4. Rules — every option has a price
| Situation | Cost / reward |
|---|---|
| Zombie gets past in **any** lane | barricade −1 (brute −6) |
| Zombie runs into your squad | it dies (barricade safe), you lose soldiers (fractional "bite", accumulated) |
| Kill a zombie | +1 XP (brute +6) → level-up |
| Gate +N / ×N | more soldiers = more firepower (soldiers^0.8) |
| Gate −N / ÷N | fewer soldiers, but never below 1 |
| Shoot a 🎯 gate | its number goes up — but those bullets aren't hitting zombies |
| Shoot a 🔫 crate | weapon +1 tier |
| Boss reaches you | eats soldiers; when only 1 is left it smashes the barricade |

**Win:** kill the boss. **Lose:** barricade reaches 0. One clear fail state, exactly like the ads' health bar.

The key decision every second: **which lane to defend right now** — the one with the most dangerous zombies, the one with the best gate, or the one with a crate. Standing still is a losing strategy (verified by the static-player bot).

## 5. Level-up perks (pick 1 of 3)
| Perk | Effect | Max |
|---|---|---|
| ↔️ Flank fire | also shoot neighbouring lanes at 20/33/45% damage | 3 |
| 🗡️ Piercing rounds | bullets pass through +1 zombie at full damage | 3 |
| ⏩ Rapid fire | +20% fire rate | 6 |
| 💥 Hollow points | +25% damage | 6 |
| 👥 Reinforcements | +30% soldiers (min +4) | — |
| 🧱 Repair barricade | +30% HP (offered only when damaged) | 3 |
| ⭐ Promotion | rank +1 (×1.3 … ×3.8 damage) | 5 |
| 🔫 New weapon | next weapon tier | 5 |

XP needed: `18 + 14k` for the k-th level-up → ~4–9 level-ups per level, front-loaded.
Overkill damage carries into the next zombie, so a big squad mows through hordes.

Weapons: Pistol → SMG → Shotgun → Rifle → Minigun → Laser.

## 6. Levels
- Duration 38–65 s of running, then the boss. Every 5th level is a boss level (longer, tougher boss); the next one is a breather.
- **Stream:** per-lane arrival rate `λ = pressure / (3 · 0.15 s)`, ramping from 55% to 115% over the level. `pressure = 0.7 + 0.042·d` (0.45 on levels 1–3), capped at 1.5 — i.e. the stream demands 70–150% of your expected firepower, so you can't hold all three lanes from one spot.
- **Hordes** every 10–14 s: 1–2 lanes, 6–22 zombies in a tight column.
- Brutes from level 10, lane-switching chasers from level 8.
- Gates every ~6 s follow a target squad-size curve; the first row is always positive; first zombies arrive after the first gate.
- Zombie HP = 0.15 s of expected firepower at arrival time (expected = ~half the target squad, expected upgrades, +1.2%/s for level-ups).
- **Quiet rubber-banding:** when a zombie comes into view and you're below the expected firepower, its HP is scaled down (to 50% at most). Never scaled up.

## 7. Meta progression
- Coins: `(30 + 8n + 0.15·kills) × stars × income`. Stars = barricade HP left (≥70% 3★, ≥35% 2★).
- Permanent upgrades: Starting squad, Starting weapon, Damage, **Barricade** (40 + 8/level HP), Income.
- A defeat pays coins for the track covered and eases the level (−10% enemy HP per consecutive loss, up to −50%).

## 8. Balance (bot, `npm run sim`)
| Player | Levels | Wins on 1st try |
|---|---|---|
| Bot 0.8 accuracy, expected upgrades | 1–40 | ~31–35 / 40 |
| Bot 0.95 | 1–40 | ~37 / 40 |
| Sloppy bot 0.6 | 1–20 | ~14–18 / 20 |
| **Static player (never changes lane)** | 1–40 | **~8–12 / 40** — dodging/standing still is no longer viable |
| Bot 0.8, no upgrades | 10–30 | ~3 / 21 — the meta layer matters |

`STATIC=1 npm run sim -- 1 40` runs the static-player check.

## 9. Save and tech
`localStorage` (`lanesquad.save.v1`, old saves migrate), PWA. Vite + TypeScript + Canvas 2D; logic in `src/game/sim.ts`; `?autoplay` makes the game play itself.
