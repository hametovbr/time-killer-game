# Research: games "like in the ads"

## What these games are

The ad that started this project was for **Mob Control** (Voodoo), a "**gate runner / crowd shooter**": the player steers a cannon or a crowd through multiplier gates (×2, ×3, +N), the crowd grows and smashes the enemy base. The final game (v2) follows the closely related **three-lane squad runner** format. Relatives:

| Game | Publisher | Core |
|---|---|---|
| Mob Control | Voodoo | Cannon at the bottom fires units up through multiplier gates; enemies come the other way; destroy the base |
| Count Masters: Crowd Runner 3D | Freeplay | Crowd runs by itself; steer left/right through "+/−/×/÷" gates; crowd-vs-crowd fight and a boss at the end |
| Last War-style ads | various | A squad runs down lanes, shooting zombies and gates, picking up weapon upgrades |
| Count Run!, Crowd Evolution!, Join Clash | various | Variations on "crowd + math" |
| Hero Rescue / How to Loot | various | "Pull the pin" — the other classic "ad genre" |

## Why the ads don't match the games

- The industry calls them "fake ads" or "non-core gameplay ads". The textbook case is Playrix's pull-the-pin ads for Homescapes/Gardenscapes: the UK ASA ruled them misleading, and at launch those puzzles made up less than 1% of actual gameplay.
- They work because a video compresses a game into one action and one result, with no menus or noise, and teases the viewer with a mistake ("I could do better").
- The downside: according to Segwise, games with authentic ads retain noticeably better (D1 ~32% vs ~14%, D7 ~11% vs ~1.5%).
- Mob Control now markets itself as "the real game from that ad", but the real experience is wrapped in a meta layer (cards, champions, a league), and players complain about very frequent ads (several 60-second videos per minute of play) and pay-to-progress PvP.
- Count Masters: high rating, but the main user complaint is that ads break the flow.

**Takeaway for our game:** keep exactly what the ad sells (one gesture, instant crowd growth, a big payoff) and leave out what players hate (interstitials, timers, paid boosts, gear-gated PvP).

## Hyper-casual / "time killer" best practices

**Core**
- One mechanic, explainable in one sentence; understood in seconds, minimal tutorial; sessions of 2–5 minutes, levels under a minute.
- Instant gratification in the first seconds.
- Test: if the core loop can't be said in one sentence, it's too complex.

**Difficulty curve (Supersonic gate runner guide)**
- Difficulty grows linearly, rewards grow exponentially; players should feel they're getting stronger.
- Start very easy; rewards always outpace challenge. Difficulty is a retention tool, not a skill test.
- Don't ramp difficulty until the game is unplayable.
- The main mistakes: too little variety (boring) and too many mechanics at once (overwhelming).
- The simplest difficulty lever is speed.

**Content pacing**
- Introduce something new roughly every 5 levels so players stay curious about what's next (Sunday.gg, level designer interview).
- The difficulty curve should stay *below* the complexity curve.
- Sawtooth: build-up → peak (boss) → breather → something new.

**Game feel ("Juice it or lose it", GDC 2012)**
- Every meaningful action gets 5–8 small responses within ~100 ms: sound, particles, flash, pop-up number, light shake.
- Hit-stop and shake only on important hits, short (~50–100 ms), scaled by importance, with a "reduce shake" option.
- Ease every animation; use overshoot for "pop".

**Retention without monetization pressure**
- Meta layer: coins → upgrades → visible power growth.
- Stars for quality of completion — a reason to replay.
- Boss levels as payoff peaks in the sawtooth.

## Sources
- [Mob Control — App Store](https://apps.apple.com/ae/app/id1562817072)
- [AppiReview — Mob Control](https://appireview.pages.dev/com.vincentb.MobControl)
- [Marlvel — Count Masters audit](https://marlvel.ai/intel-report/games/count-masters-crowd-runner-3d)
- [Udonis — Fake Mobile Game Ads](https://www.blog.udonis.co/mobile-marketing/mobile-games/fake-mobile-game-ads)
- [Segwise — Fake Ads & Mobile Gaming](https://segwise.ai/blog/fake-ads-and-mobile-gaming-how-studios-balance-clickbait-gameplay-integrity-and-profitability-cm7j2hc9s00bvip0l0r4k59lw)
- [AdMapix — Fake mobile game ads](https://www.admapix.com/blog/ad-intelligence/fake-mobile-game-ads)
- [Supersonic — How to design a hit gate runner](https://supersonic.com/learn/blog/how-to-design-a-hit-gate-runner-the-basics-and-best-practices/)
- [Sunday.gg — Level design for ad-monetized casual games](https://sunday.gg/?p=6020)
- [GDevelop — Casual game loops](https://gdevelop.io/blog/casual-game-loops)
- [StudioKrew — Hybrid casual vs traditional](https://studiokrew.com/blog/hybrid-casual-games-vs-traditional-mobile-games/)
- [Game feel skill (juice checklist)](https://claudeskills.info/ko/skills/gamedev-skills/awesome-gamedev-agent-skills/game-feel/)
- [Webiano — Difficulty curve](https://webiano.digital/knowledge-base/gaming/game-design/difficulty-curve/)
