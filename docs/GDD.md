# LANE SQUAD — Game Design Document (v2)

> v1 ("Mob Cannon", a Mob Control-style cannon game) was replaced based on feedback: the goal is simpler **three-lane** gameplay with enemies, multipliers, unit/weapon upgrades and a changing squad size. This is the "squad runner" genre from Last War / Count Masters / "zombie gate shooter" ads.

Platform: browser, mobile portrait first. No ads, no in-app purchases, no timers.

## 1. Core loop in one sentence
> Steer your squad across three lanes, run through gates that change your soldier count, shoot zombies and upgrade crates, and reach the boss with the biggest squad you can.

## 2. Controls
- Hold your finger (mouse) over a lane: the squad runs to it. Tapping a lane also works.
- Shooting is automatic, always straight ahead in the current lane.
- PC: ←/→ or A/D (one lane), 1/2/3 (jump to lane), Esc to pause.

## 3. Field
```
 ┌─────┬─────┬─────┐   ← BOSS (full width) after the finish line
 │ 🧟  │     │ 🧟  │   ← zombies walk towards you along the lanes
 │[+12]│[×2] │[−8] │   ← a gate row: each lane has its own gate
 │     │ 📦  │     │   ← 🔫/⭐ crate (shoot it before you run past)
 │     │ 👥  │     │   ← your squad (count above it)
 └─────┴─────┴─────┘
```

## 4. Mechanics (one new element every 1–3 levels)
| # | Element | Rule | From level |
|---|---|---|---|
| 1 | **+N / ×N** gates (blue) | change the soldier count when passed | 1 |
| 2 | Zombies | walk towards you along a lane; killed by bullets. A zombie that reaches the squad **in your lane** takes `bite` soldiers (~3% of the squad size expected at that point, min 1; shown as `-N` on the zombie). Zombies in other lanes pass by harmlessly — dodging is a valid choice | 1 |
| 3 | **−N** gates (red) | remove soldiers; 0 soldiers = defeat | 2 |
| 4 | 🔫 crate | shoot it open → weapon +1 tier (for this run) | 3 |
| 5 | Shootable gates 🎯 | bullets raise the number on +/− gates (a "−10" can be shot up into a plus) | 4 |
| 6 | ⭐ crate | soldier rank +1 → damage multiplier | 6 |
| 7 | **÷2** gates | split the squad | 7 |
| + | Chasers | switch to your lane | 8 |
| + | Brutes | lots of HP, take 4× bite | 10 |
| + | ×3 gates | | 12 |
| ★ | Boss | at the end of every level; eats soldiers on contact; kill it to win | 1 |

**Weapons (🔫 crates):** Pistol → SMG → Shotgun → Rifle → Minigun → Laser.
**Ranks (⭐ crates):** Private ×1 → Corporal ×1.3 → Sergeant ×1.7 → Lieutenant ×2.2 → Captain ×2.9 → Major ×3.8.
**Firepower** = `soldiers^0.8 × fire rate × weapon damage × rank × damage upgrade`. The 0.8 exponent keeps ×-gates exciting without trivialising difficulty.

The key decision at every moment: **the lane with the best gate vs the lane without zombies vs the lane with a crate**. One decision at a time, readable in a second.

## 5. Levels — sawtooth
- A level is 9–20 "beats" (gate row / zombie group / guarded crate), then the finish line and the boss. 30–60 seconds each.
- Every **5th** level is a **BOSS level**: longer, with a boss ~1.7× tougher. The level after it is a breather.
- The generator is deterministic (seed = level number) and endless.
- Gate values follow a **target squad-size curve** (from the starting squad up to `25 + 7n`); zombie and boss HP follow the expected firepower given expected upgrades. The first gate row never has negative gates; negative gates never wipe out a squad that is on the target curve.

## 6. Meta progression
- **Coins** per win: `(30 + 8n + 0.3·squad_at_end) × stars × income`.
- **Stars:** share of the peak squad that survived to the end (≥60% — 3★, ≥30% — 2★).
- **Permanent upgrades:** Starting squad (+1), Starting weapon, Damage (+10%), Income (+15%).
- **A defeat** still pays coins proportional to the track covered and **adaptively eases** the level: −10% enemy HP per consecutive loss (up to −40%).

## 7. Game feel
Pop-up "+12/−8" numbers and a screen flash on gates, particles on hits and kills, hit-stop and screen shake on crates/brutes/victory, a "pop" of the weapon panel on upgrades, a bobbing running squad, a distinct sound per weapon, vibration on Android, and a "reduce screen shake" option.

## 8. Balance (bot, `npm run sim`)
- Bot with 0.8 accuracy and expected upgrades: 31/40 levels on the first try (adaptive easing covers retries).
- Bot with 0.95 accuracy: 40/40. Bot with 0.6 accuracy, levels 1–20: 16/20.
- Without upgrades, levels 10–30: ~3/21 — the meta layer genuinely matters.

## 9. Save and tech
`localStorage` (`lanesquad.save.v1`), PWA (offline, installable). Vite + TypeScript + Canvas 2D; logic in `src/game/sim.ts` is separate from rendering; `?autoplay` in the URL makes the game play itself (demo).
