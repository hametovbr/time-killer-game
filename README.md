# Lane Squad 🪖

**The game from the ads — but honest.** A squad, three lanes, multiplier gates and zombies. No ads, no in-app purchases, no timers. Runs right in the browser (and offline once added to your home screen).

▶ **Play:** https://hametovbr.github.io/time-killer-game/

## How to play
- Hold your finger (or mouse) over a lane — the squad runs there. Shooting is automatic.
- Blue **+N / ×N** gates add soldiers, red **−N / ÷N** gates take them away. Gates marked 🎯 can be shot — their number goes up.
- Shoot crates before you run past them: 🔫 upgrades your weapon, ⭐ promotes your soldiers (more damage).
- Zombies take soldiers on contact. A boss waits at the end of every level.
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
```
Stack: Vite + TypeScript + Canvas 2D, no game engine. Game logic (`src/game/sim.ts`) is separate from rendering (`src/game/render.ts`).
On every push to `main`, GitHub Actions builds `dist/` and publishes it to the `gh-pages` branch.

> History: v1 "Mob Cannon" (a Mob Control-style cannon game) was replaced by v2 "Lane Squad" — see `docs/GDD.md`.

## License
[MIT](LICENSE)
