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

## Part 2 — design principles behind the v3 rework

Playtest feedback on v2: *"Why kill zombies at all? You can just dodge them. There's no constant stream of zombies or bonuses, and no reason to enter a lane with zombies. In the ad, you had health and lost if too many zombies got past."*

That is a textbook design failure, and the literature names it precisely:

**1. Dominant strategy kills choice.** A choice that is always better than the alternatives is not a choice (Jesse Schell, *The Art of Game Design*, "Game mechanics must be in balance"). Alexander Brazie (ex-Riot/Blizzard) lists the four ways meaningful decisions get lost: a dominant strategy appears, decisions get too hard, decisions become meaningless, or they disappear. In v2, "dodge every zombie lane" was dominant and killing was meaningless. Ernest Adams: every option should have an upside *and* a downside, otherwise it isn't a decision.
→ **Fix:** dodging must cost something. Every option now has a price: shoot this lane = the others leak; stand in a zombie lane = lose soldiers but protect the barricade; shoot a gate = fewer bullets on zombies.

**2. Lives / leak limit (tower defense).** In Bloons TD, lives are explicitly the number of enemies you are allowed to let through. This is exactly what the ad shows: a health bar that drops when zombies get past. It turns *every* zombie into a problem, not only the ones in your lane.
→ **Fix:** a barricade with HP behind the squad. Any zombie in any lane that gets past it deals damage. Barricade at 0 = defeat. It is the single, readable fail state.

**3. Killing must pay (Vampire Survivors loop).** The core loop of the most successful "simple but addictive" game of recent years is: kill → collect XP → level up → pick 1 of 3 upgrades → kill faster. Rewards land every few seconds, and the upgrade choice gives agency without slowing the pace. Enemy swarms are an *opportunity* (XP), not only an obstacle.
→ **Fix:** every kill gives XP; a level-up pauses the game and offers 3 perks (flank fire, piercing, rapid fire, damage, reinforcements, repair, promotion, new weapon). That is the "constant stream of bonuses".

**4. Constant pressure, sawtooth inside a level.** Last War's ad mode is described as "dodge and combat waves of zombies" where "each lane presents unique obstacles and zombies" — waves from several lanes at once, and you must prioritise threats. Pressure should be continuous, with peaks.
→ **Fix:** a continuous zombie stream in all three lanes that ramps up, plus hordes roughly every 12 s. Total zombie HP per second is tuned to exceed what one lane of fire can handle, so you must keep switching (pressure ≈ 0.7–1.5× expected firepower).

**5. Avoid the death spiral.** In tower defense, "kill → gold" is a positive feedback loop that also works against the player: one mistake leads to inevitable failure. Common mitigations: partial rewards on failure, recovery options, and quiet rubber-banding.
→ **Fix:** gates can never wipe the squad (minimum 1 soldier); zombies arriving while you are behind the expected power curve spawn softer (never harder); repair is a perk; overkill damage carries into the next zombie so a big squad mows hordes instead of wasting bullets; defeats still pay coins and ease the level.

**6. Verify with a "static player".** A simple test for a dominant strategy: a bot that never changes lane should lose. Our simulator has `STATIC=1` mode for exactly that.

### Sources (part 2)
- [Daniel Doan — The power of meaningful choices](https://medium.com/@doandaniel/gamedev-thoughts-the-power-of-meaningful-choices-in-game-design-50dbdeb0348a)
- [Notes on Schell — Meaningful choices](https://notesbylex.com/meaningful-choices-in-games)
- [Alexander Brazie — Video game balance guide](https://gamedesignskills.com/game-design/game-balance/)
- [Ernest Adams — Achieving and enhancing gameplay](https://www.peachpit.com/articles/article.aspx?p=102309)
- [Bloons Wiki — Lives](https://www.bloonswiki.com/Life)
- [Whitevale Defender — Feedback loops & the death spiral](https://www.moddb.com/games/whitevale-defender/features/the-one-problem-with-all-tower-defense-games)
- [Why Vampire Survivors feels so addictive](https://geekchamp.com/?p=789863)
- [Last War: Survival — App Store description](https://apps.apple.com/th/app/id6448786147)
- [Bugnet — Difficulty curves (sawtooth, adaptive easing)](https://bugnet.io/blog/difficulty-curves-how-to-get-them-right)
