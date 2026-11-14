# Исследование: игры «как в рекламе»

## Что за игры на скриншоте

Скриншот — реклама **Mob Control** (Voodoo). Это поджанр гиперказуала «**gate runner / crowd shooter**»: игрок управляет пушкой или толпой, проводит юнитов через ворота-множители (×2, ×3, +N), толпа растёт и сносит вражескую базу. Близкие родственники:

| Игра | Издатель | Ядро |
|---|---|---|
| Mob Control | Voodoo | Пушка внизу стреляет юнитами вверх через ворота-множители, враги идут навстречу, цель — снести базу |
| Count Masters: Crowd Runner 3D | Freeplay | Толпа бежит сама, игрок ведёт влево-вправо через ворота «+/−/×/÷», в конце — бой толпа на толпу и босс |
| Count Run!, Crowd Evolution!, Join Clash | разные | Вариации той же «толпы с математикой» |
| Hero Rescue / How to Loot | разные | «Pull the pin» — второй классический «рекламный» жанр |

## Почему реклама не совпадает с игрой

- Отрасль называет это «fake ads» / «non-core gameplay ads». Классический пример — pull-the-pin у Playrix (Homescapes/Gardenscapes): британский регулятор ASA признал такую рекламу вводящей в заблуждение, а на старте эти головоломки составляли меньше 1% реального геймплея.
- Работает это потому, что ролик сжимает игру до одного действия и одного результата, без меню и шума, и дразнит зрителя ошибкой («я бы сделал лучше»).
- Обратная сторона: по данным Segwise, игры с честной рекламой удерживают заметно лучше (D1 ~32% против ~14%, D7 ~11% против ~1.5%).
- Сам Mob Control сегодня продаёт себя как «настоящая игра из той самой рекламы», но реальный опыт обвешан мета-слоем (карточки, чемпионы, лига), а игроки жалуются на частую рекламу (до нескольких 60-сек роликов на минуту игры) и pay-to-progress в PvP.
- Count Masters: рейтинг высокий, но основная жалоба пользователей — реклама рвёт поток игры.

**Вывод для нашей игры:** взять ровно то, что продаёт ролик (один жест, мгновенный рост толпы, взрыв базы), и *не* добавлять то, что игроки ненавидят (интерстишиалы, таймеры, платные ускорения, PvP с гиром).

## Best practices гиперказуала / «убивалки времени»

**Ядро**
- Одна механика, объяснимая одной фразой; понятна за секунды, минимум туториала; сессия 2–5 минут, уровень — до минуты.
- Мгновенная награда в первые секунды игры.
- Тест: если ядро нельзя сказать одним предложением — оно слишком сложное.

**Кривая сложности (Supersonic, гайд по gate runner)**
- Сложность растёт линейно, награды — экспоненциально; игрок должен чувствовать, что становится сильнее.
- Старт очень лёгкий; награды всегда опережают вызов. Сложность — инструмент удержания, а не проверка скилла.
- Не разгонять сложность до «неиграбельно».
- Главные ошибки: слишком мало разнообразия (скучно) и слишком много механик сразу (перегруз).
- Простейший рычаг сложности — скорость.

**Ритм контента**
- Новый элемент примерно каждые 5 уровней — чтобы оставалось любопытно, что дальше (Sunday.gg, интервью с левел-дизайнером).
- Кривая сложности должна идти *ниже* кривой сложности механик (difficulty < complexity).
- «Пила» (sawtooth): нарастание → пик (босс) → передышка → новое.

**Game feel («Juice it or lose it», GDC 2012)**
- Каждое значимое действие — 5–8 мелких откликов за ~100 мс: звук, частицы, вспышка, всплывающее число, лёгкая тряска.
- Hit-stop и тряску — только на важные удары, коротко (≈50–100 мс), масштабировать по важности, дать опцию «уменьшить тряску».
- Всё анимировать с easing, «pop» — с overshoot.

**Удержание без доната**
- Мета-слой: монеты → апгрейды → видимый рост силы.
- Звёзды за качество прохождения — повод перепройти.
- Бонус-уровни как «конфета» после серии.

## Источники
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
