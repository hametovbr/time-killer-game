# Status

## v3.1 (2026-11-14) — real boss fights
Feedback: bosses were trivial; once at the finish you couldn't lose.
- [x] Boss marches on the barricade — reaching it = defeat (DPS check with a deadline)
- [x] Telegraphed lane switches, minion packs into the other lanes, body-blocking trade-off
- [x] Enrage phase at 50% HP on boss levels
- [x] Boss HP scales to the player's current firepower (gentler on levels 1–6)
- [x] Boss HP + distance-to-barricade HUD, defeat screen explains what happened
- [x] Simulator reports boss reach/loss rate and fight length

## v3.0 (2026-11-14) — gameplay rework
Feedback on v2: dodging zombies was a dominant strategy, killing was pointless, no constant stream of zombies or bonuses.
- [x] Research: dominant strategies, tower-defense lives, Vampire Survivors loop, death-spiral mitigation (`docs/research.md` part 2)
- [x] Barricade with HP — any zombie that gets past damages it; 0 HP = defeat
- [x] Continuous zombie stream in all lanes + hordes every ~12 s
- [x] XP from kills → level-up → pick 1 of 3 perks (8 perks)
- [x] Overkill carries over, fractional soldier "bite", gates can't wipe the squad
- [x] Quiet rubber-banding for players behind the power curve
- [x] Barricade permanent upgrade; stars = barricade HP left
- [x] Static-player check in the simulator (`STATIC=1`)

## v2.0 "Lane Squad" (2026-11-14)
Gameplay reworked based on feedback: three lanes, enemies, multipliers, weapon/rank upgrades, squad size changes.
- [x] Core: 3 lanes, +/−/×/÷ gates, auto-fire, zombies, end-of-level boss
- [x] Shootable gates, 🔫 crates (6 weapon tiers) and ⭐ crates (6 ranks)
- [x] Chasers, brutes, ×3 gates
- [x] Deterministic procedural levels, sawtooth difficulty, boss levels every 5
- [x] Meta: coins, stars, 4 upgrades, adaptive easing after losses
- [x] Juice, sound, vibration, PWA, local save
- [x] Bot + `npm run sim`, `?autoplay`
- [x] Publishing to the `gh-pages` branch via Actions
- [x] MIT license, everything in English

## v1.0 "Mob Cannon" — replaced (kept in git history)

## Backlog / ideas
- Soldier skins unlocked with stars
- Daily level seeded by date
- Lane obstacles (saws, barrels), helicopter ally
- Bonus "gates only, no enemies" level every 10 levels
