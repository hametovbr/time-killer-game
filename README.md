# Lane Squad 🪖

**The game from the ads — but honest.** A squad, three lanes, multiplier gates and zombies. No ads, no in-app purchases, no timers. Runs right in the browser (and offline once added to your home screen).

▶ **Play:** https://hametovbr.github.io/time-killer-game/

## How to play
- Hold your finger (or mouse) over a lane — the squad runs there and shoots automatically.
- Zombies stream down all three lanes. **Any zombie that gets past hits your barricade** — when it breaks, you lose. Keep switching lanes to cover them.
- Kills give XP. On level-up, pick 1 of 3 upgrades: flank fire, piercing rounds, rapid fire, damage, reinforcements, repair, promotion, new weapon.
- Blue **+N / ×N** gates add soldiers (more firepower), red **−N / ÷N** gates take them away. Gates marked 🎯 can be shot to raise their number. Shoot 🔫 crates for a better weapon.
- Kill the boss at the end to win.
- PC: ←/→ or A/D, 1/2/3 to pick a lane, Esc to pause. Add `?autoplay` to the URL to watch the bot play.

## Docs
- [docs/research.md](docs/research.md) — why "fake ad" games exist, and hyper-casual design best practices
- [docs/GDD.md](docs/GDD.md) — game design: mechanics, difficulty curve, meta progression
- [docs/STATUS.md](docs/STATUS.md) — current state and backlog

## Development
```bash
npm install
npm run dev               # local dev server
npm run build             # production build into dist/
npm run sim -- 1 40 0.8   # headless balance check: a bot plays levels 1–40
STATIC=1 npm run sim -- 1 40   # a player who never changes lane should mostly lose
```
Stack: Vite + TypeScript + Canvas 2D, no game engine. Game logic (`src/game/sim.ts`) is separate from rendering (`src/game/render.ts`).
On every push to `main`, GitHub Actions builds `dist/` and publishes it to the `gh-pages` branch.

> History: v1 "Mob Cannon" (cannon) → v2 "Lane Squad" (3-lane runner) → v3 (barricade, zombie stream, level-up perks) — see `docs/GDD.md`.

## License
[MIT](LICENSE)
