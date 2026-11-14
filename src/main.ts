import './style.css';
import { W, SQUAD_Y } from './game/constants';
import { generateLevel, type LevelDef } from './game/levels';
import { Sim, type GameEvent, type Input } from './game/sim';
import { Renderer } from './game/render';
import { Fx } from './game/fx';
import { Sfx } from './game/audio';
import { Bot } from './game/bot';
import { loadSave, writeSave, resetSave, type SaveData } from './game/save';
import { UPGRADES, WEAPONS, RANK_NAMES, PERKS, startSquad, damageMul, barricadeHp, upgradeCost, starsFor, levelReward } from './game/balance';
import { BARRICADE_Y } from './game/constants';

type Mode = 'menu' | 'playing' | 'paused' | 'result';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('game');
const hud = $('hud');
const hudLevel = $('hud-level');
const hudCoins = $('hud-coins');
const hudProgress = $('hud-progress');
const hudProgressBar = hudProgress.firstElementChild as HTMLElement;
const hudGear = $('hud-gear');
const hudXp = $('hud-xp');
const hudXpBar = hudXp.firstElementChild as HTMLElement;
const hudXpLabel = hudXp.lastElementChild as HTMLElement;
const levelupEl = $('levelup');
const btnPause = $<HTMLButtonElement>('btn-pause');
const intro = $('intro');
const screen = $('screen');

let save: SaveData = loadSave();
const renderer = new Renderer(canvas);
const fx = new Fx();
const sfx = new Sfx();
sfx.enabled = save.settings.sound;
fx.reduceShake = save.settings.reduceShake;

let mode: Mode = 'menu';
let sim: Sim;
let level: LevelDef;
let bot: Bot | null = null; // autoplayer behind the menu
let resultTimer = 0;
let resultShown = false;
let gearKey = '';
// ?autoplay — the bot plays for you (handy for demos and screenshots).
const autoplay = new URLSearchParams(location.search).has('autoplay') ? new Bot(0.95) : null;

// ---------- Input: put your finger where you want the squad ----------
const input: Input = { lane: null };
let pointerDown = false;

const laneFromClientX = (cx: number) => {
  const x = renderer.toWorldX(cx);
  return x < W / 3 ? 0 : x < (2 * W) / 3 ? 1 : 2;
};

canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (mode !== 'playing') return;
  pointerDown = true;
  canvas.setPointerCapture(e.pointerId);
  input.lane = laneFromClientX(e.clientX);
  hideIntro();
});
canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'playing' || !pointerDown) return;
  input.lane = laneFromClientX(e.clientX);
});
const release = () => (pointerDown = false);
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

window.addEventListener('keydown', (e) => {
  sfx.unlock();
  if (mode !== 'playing') return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    input.lane = Math.max(0, (input.lane ?? sim.lane) - 1);
    hideIntro();
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    input.lane = Math.min(2, (input.lane ?? sim.lane) + 1);
    hideIntro();
  } else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
    input.lane = Number(e.code.slice(-1)) - 1;
    hideIntro();
  } else if (e.code === 'Escape' || e.code === 'KeyP') pause();
});
window.addEventListener('blur', () => {
  pointerDown = false;
  if (mode === 'playing') pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'playing') pause();
});
window.addEventListener('resize', () => renderer.resize());
btnPause.addEventListener('click', () => pause());

// ---------- Game flow ----------
function simConfig(n: number) {
  const fails = save.fails[n] ?? 0;
  return {
    startCount: startSquad(save.upgrades.squad),
    startWeapon: save.upgrades.weapon,
    dmgMul: damageMul(save.upgrades.damage),
    wallHp: barricadeHp(save.upgrades.wall),
    ease: Math.max(0.5, 1 - fails * 0.1),
  };
}

function levelLabel(n: number, l: LevelDef) {
  return l.type === 'boss' ? `👑 Boss ${n}` : `Level ${n}`;
}

function startLevel(n: number) {
  level = generateLevel(n);
  sim = new Sim(level, simConfig(n));
  fx.clear();
  bot = null;
  mode = 'playing';
  resultShown = false;
  resultTimer = 0;
  input.lane = null;
  pointerDown = false;
  gearKey = '';
  screen.classList.add('hidden');
  for (const el of [hud, hudProgress, hudGear, hudXp]) el.classList.remove('hidden');
  levelupEl.classList.add('hidden');
  hudLevel.textContent = levelLabel(n, level);
  if (level.intro) {
    intro.textContent = level.intro;
    intro.classList.remove('hidden');
  } else intro.classList.add('hidden');
  updateHud();
}

function startAttract() {
  level = generateLevel(save.level);
  sim = new Sim(level, simConfig(save.level));
  bot = new Bot(0.9);
  fx.clear();
}

function hideIntro() {
  intro.classList.add('hidden');
}

function hideHud() {
  for (const el of [hud, hudProgress, hudGear, hudXp, intro, levelupEl]) el.classList.add('hidden');
}

function pause() {
  if (mode !== 'playing') return;
  mode = 'paused';
  pointerDown = false;
  showPanel(`
    <h2>Paused</h2>
    <button class="btn big" data-act="resume">Resume</button>
    <button class="btn blue" data-act="restart">Restart</button>
    <button class="btn grey" data-act="menu">Main menu</button>
  `);
}

function vibrate(ms: number | number[]) {
  if (save.settings.vibration && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}

const screenY = (z: number) => SQUAD_Y - (z - sim.dist);

function handleEvents(events: GameEvent[], audible: boolean) {
  for (const e of events) {
    switch (e.t) {
      case 'volley':
        if (audible) sfx.shot(e.weapon);
        break;
      case 'gate':
        fx.text(e.x, SQUAD_Y - 50, e.delta >= 0 ? `+${e.delta}` : `${e.delta}`, e.good ? '#b6f0ff' : '#ffb3b3', 32);
        fx.burst(e.x, SQUAD_Y - 20, e.good ? '#7fd0ff' : '#ff7a7a', 24, 170, 3);
        fx.flash = 0.25;
        fx.flashColor = e.good ? '#9fdcff' : '#ff4a4a';
        if (!e.good) fx.addShake(5);
        if (audible) {
          sfx.gate(e.good);
          if (!e.good) vibrate(40);
        }
        break;
      case 'gateShot':
        fx.burst(e.x, screenY(e.z) - 20, '#ffffff', 2, 60, 2);
        if (audible) sfx.tick();
        break;
      case 'hit':
        fx.burst(e.x, screenY(e.z), e.kill ? '#9be36a' : '#ffe36b', e.kill ? (e.big ? 24 : 7) : 2, e.kill ? 120 : 50, e.kill ? 3 : 2);
        if (e.kill && e.big) {
          fx.addShake(5);
          fx.addHitStop(60);
        }
        if (audible && e.kill) sfx.pop();
        break;
      case 'squadHit':
        fx.burst(e.x, SQUAD_Y, '#ff6b6b', 6 + e.lost, 130, 2.6);
        if (e.lost > 0) fx.text(e.x + (Math.random() - 0.5) * 30, SQUAD_Y - 30, `-${e.lost}`, '#ff8080', 20 + Math.min(14, e.lost * 2));
        fx.flash = Math.max(fx.flash, 0.2);
        fx.flashColor = '#ff2a2a';
        fx.addShake(2 + Math.min(6, e.lost));
        if (audible) {
          sfx.hurt();
          vibrate(25);
        }
        break;
      case 'crateHit':
        fx.burst(e.x, screenY(e.z) - 26, '#e0b070', 2, 70, 2);
        if (audible) sfx.tick();
        break;
      case 'crateOpen':
        fx.burst(e.x, screenY(e.z) - 26, '#ffd54a', 40, 220, 3.5);
        fx.text(W / 2, SQUAD_Y - 110, e.label, '#ffd54a', 30);
        fx.addShake(6);
        fx.addHitStop(70);
        if (audible) {
          sfx.powerup();
          vibrate([20, 40, 20]);
        }
        break;
      case 'leak':
        fx.burst(e.x, BARRICADE_Y + 6, '#d9b77a', 10 + e.dmg * 4, 150, 3);
        fx.text(e.x, BARRICADE_Y - 12, `-${e.dmg} 🧱`, '#ffb070', 18 + e.dmg * 2);
        fx.addShake(2 + e.dmg);
        if (audible) {
          sfx.thud();
          vibrate(e.dmg > 1 ? 60 : 15);
        }
        break;
      case 'levelUp':
        if (audible) sfx.powerup();
        break;
      case 'perk':
        fx.text(W / 2, SQUAD_Y - 110, e.label, '#e4c8ff', 24);
        fx.burst(sim.squadX, SQUAD_Y, '#c86bff', 30, 200, 3);
        break;
      case 'bossArrive':
        if (audible) sfx.roar();
        break;
      case 'bossHit':
        fx.burst(e.x, screenY(sim.boss.z) - 60, '#ffe36b', 1, 80, 2.5);
        if (audible) sfx.thud();
        break;
      case 'win':
        if (!audible) break;
        fx.addHitStop(140);
        fx.addShake(12);
        fx.flash = 0.8;
        fx.flashColor = '#fff6c0';
        for (let i = 0; i < 6; i++) fx.burst(60 + i * 56, screenY(sim.boss.z) - 60, i % 2 ? '#ffd54a' : '#ff6b7d', 30, 260, 3.5);
        sfx.boom();
        setTimeout(() => sfx.win(), 250);
        vibrate([40, 60, 80]);
        break;
      case 'lose':
        if (!audible) break;
        fx.addShake(10);
        sfx.lose();
        vibrate([100, 50, 100]);
        break;
    }
  }
}

function updateHud() {
  hudCoins.textContent = String(save.coins);
  hudProgressBar.style.width = `${sim.progress * 100}%`;
  hudXpBar.style.width = `${sim.xpProgress * 100}%`;
  hudXpLabel.textContent = `LV ${sim.ups + 1}`;
  if (sim.choices && levelupEl.classList.contains('hidden') && !autoplay) showLevelUp();
  const perkIcons = PERKS.filter((p) => p.id !== 'recruits' && p.id !== 'repair' && p.id !== 'rank' && p.id !== 'weapon' && sim.perks[p.id] > 0)
    .map((p) => `${p.icon}${sim.perks[p.id]}`)
    .join(' ');
  const key = `${sim.weapon}-${sim.rank}-${perkIcons}`;
  if (key !== gearKey) {
    const w = WEAPONS[sim.weapon];
    hudGear.textContent = `${w.icon} ${w.name} · ⭐ ${RANK_NAMES[sim.rank]}${perkIcons ? ' · ' + perkIcons : ''}`;
    if (gearKey) {
      hudGear.classList.remove('pop');
      void hudGear.offsetWidth;
      hudGear.classList.add('pop');
    }
    gearKey = key;
  }
}

function showLevelUp() {
  const ch = sim.choices!;
  levelupEl.innerHTML =
    `<h2>LEVEL UP!</h2>` +
    ch
      .map(
        (p, i) => `<button class="perk" data-i="${i}">
          <div class="pi">${p.icon}</div>
          <div><div class="pt">${p.title}</div><div class="pd">${p.describe(sim.perks[p.id])}</div>
          ${p.max < 99 ? `<div class="pl">${sim.perks[p.id]}/${p.max}</div>` : ''}</div>
        </button>`,
      )
      .join('');
  levelupEl.classList.remove('hidden');
  pointerDown = false;
}

levelupEl.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.perk') as HTMLElement | null;
  if (!btn || !sim.choices) return;
  sfx.click();
  sim.choose(Number(btn.dataset.i));
  levelupEl.classList.add('hidden');
});

function finishLevel() {
  const n = level.n;
  const won = sim.state === 'won';
  save.stats.played++;
  save.stats.kills += sim.stats.kills;
  save.stats.bestPeak = Math.max(save.stats.bestPeak, sim.peak);
  save.stats.leaks = (save.stats.leaks ?? 0) + sim.stats.leaks;
  let reward: number;
  let stars = 0;
  if (won) {
    save.stats.won++;
    stars = starsFor(sim.wall, sim.wallMax);
    reward = levelReward(n, stars, sim.stats.kills, save.upgrades.income);
    save.stars[n] = Math.max(save.stars[n] ?? 0, stars);
    delete save.fails[n];
    if (save.level === n) save.level = n + 1;
  } else {
    reward = Math.max(5, Math.round(levelReward(n, 1, 0, save.upgrades.income) * 0.4 * sim.progress));
    save.fails[n] = (save.fails[n] ?? 0) + 1;
  }
  save.coins += reward;
  writeSave(save);
  showResult(won, stars, reward);
}

// ---------- Screens ----------
function showPanel(html: string) {
  screen.innerHTML = `<div class="panel">${html}</div>`;
  screen.classList.remove('hidden');
}

screen.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (!target || (target as HTMLButtonElement).disabled) return;
  sfx.unlock();
  const act = target.dataset.act!;
  switch (act) {
    case 'play':
    case 'next':
      sfx.click();
      startLevel(save.level);
      break;
    case 'retry':
    case 'restart':
      sfx.click();
      startLevel(level.n);
      break;
    case 'resume':
      sfx.click();
      mode = 'playing';
      screen.classList.add('hidden');
      break;
    case 'menu':
      sfx.click();
      showMenu();
      break;
    case 'upgrades':
      sfx.click();
      showUpgrades(target.dataset.back ?? 'menu');
      break;
    case 'settings':
      sfx.click();
      showSettings();
      break;
    case 'buy': {
      const u = UPGRADES.find((x) => x.id === target.dataset.id)!;
      const lvl = save.upgrades[u.id];
      const cost = upgradeCost(u, lvl);
      if (lvl < u.max && save.coins >= cost) {
        save.coins -= cost;
        save.upgrades[u.id] = lvl + 1;
        writeSave(save);
        sfx.buy();
        vibrate(15);
        showUpgrades(screen.dataset.back ?? 'menu');
      }
      break;
    }
    case 'toggle': {
      const k = target.dataset.key as keyof SaveData['settings'];
      save.settings[k] = !save.settings[k];
      sfx.enabled = save.settings.sound;
      fx.reduceShake = save.settings.reduceShake;
      writeSave(save);
      sfx.click();
      showSettings();
      break;
    }
    case 'reset':
      if (target.dataset.confirm === '1') {
        save = resetSave();
        sfx.enabled = save.settings.sound;
        fx.reduceShake = save.settings.reduceShake;
        showMenu();
      } else {
        target.dataset.confirm = '1';
        target.textContent = 'Sure? Tap again';
      }
      break;
  }
});

const affordableUpgrades = () =>
  UPGRADES.filter((u) => save.upgrades[u.id] < u.max && save.coins >= upgradeCost(u, save.upgrades[u.id])).length;

function showMenu() {
  mode = 'menu';
  hideHud();
  startAttract();
  const n = save.level;
  const can = affordableUpgrades();
  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  showPanel(`
    <div class="title">LANE<br>SQUAD</div>
    <div class="subtitle">the game from the ads — but honest</div>
    <div class="coins-big">🪙 ${save.coins} &nbsp; ⭐ ${totalStars}</div>
    <button class="btn big" data-act="play">▶ ${levelLabel(n, generateLevel(n))}</button>
    <div class="row">
      <button class="btn blue" data-act="upgrades">⬆ Upgrades${can ? ` (${can})` : ''}</button>
      <button class="btn grey" data-act="settings" style="flex:0 0 64px">⚙</button>
    </div>
    <div class="small">No ads. No in-app purchases. Progress is saved in your browser.</div>
  `);
}

function showResult(won: boolean, stars: number, reward: number) {
  mode = 'result';
  hideHud();
  const can = affordableUpgrades();
  if (won) {
    showPanel(`
      ${level.type === 'boss' ? '<div class="badge">BOSS DEFEATED</div>' : ''}
      <h2>Victory!</h2>
      <div class="stars">${[1, 2, 3].map((i) => `<span data-s="${i}">⭐</span>`).join('')}</div>
      <div class="reward">+${reward} 🪙</div>
      <div class="stat">🧱 Barricade: ${Math.ceil(sim.wall)}/${sim.wallMax} · Zombies: ${sim.stats.kills} killed, ${sim.stats.leaks} got through</div>
      <div class="stat">Squad: ${sim.count} (peak ${sim.peak}) · Level-ups: ${sim.ups}</div>
      <div class="stat">${WEAPONS[sim.weapon].icon} ${WEAPONS[sim.weapon].name} · ⭐ ${RANK_NAMES[sim.rank]}</div>
      <button class="btn big" data-act="next">Next ▶</button>
      <div class="row">
        <button class="btn blue" data-act="upgrades" data-back="result">⬆ Upgrades${can ? ` (${can})` : ''}</button>
        <button class="btn grey" data-act="menu">Menu</button>
      </div>
    `);
    screen.querySelectorAll<HTMLElement>('.stars span').forEach((el) => {
      const i = Number(el.dataset.s);
      if (i <= stars) setTimeout(() => el.classList.add('on'), 250 + i * 280);
    });
  } else {
    const fails = save.fails[level.n] ?? 0;
    showPanel(`
      <h2>Barricade broken 🧱</h2>
      <div class="stat">${sim.stats.leaks} zombies got past you — switch lanes to cover them</div>
      <div class="stat">Track covered: ${Math.round(sim.progress * 100)}% · Peak squad: ${sim.peak}</div>
      <div class="reward">+${reward} 🪙</div>
      ${fails >= 1 ? `<div class="stat">Enemies weakened (−${Math.min(50, fails * 10)}% HP)</div>` : ''}
      ${can ? `<div class="stat">💡 Upgrades available: ${can}</div>` : ''}
      <button class="btn big" data-act="retry">Try again ↻</button>
      <div class="row">
        <button class="btn blue" data-act="upgrades" data-back="result">⬆ Upgrades</button>
        <button class="btn grey" data-act="menu">Menu</button>
      </div>
    `);
  }
}

function showUpgrades(back: string) {
  const items = UPGRADES.map((u) => {
    const lvl = save.upgrades[u.id];
    const maxed = lvl >= u.max;
    const cost = upgradeCost(u, lvl);
    return `
      <div class="upg">
        <div class="ico">${u.icon}</div>
        <div class="info">
          <div class="name">${u.title}</div>
          <div class="desc">${u.describe(lvl)}${maxed ? '' : ` → <b>${u.describe(lvl + 1)}</b>`}</div>
          <div class="lvl">lvl ${lvl}/${u.max}</div>
        </div>
        <button class="btn" data-act="buy" data-id="${u.id}" ${maxed || save.coins < cost ? 'disabled' : ''}>
          ${maxed ? 'MAX' : `🪙 ${cost}`}
        </button>
      </div>`;
  }).join('');
  const backBtn =
    back === 'result'
      ? `<button class="btn big" data-act="${sim.state === 'won' ? 'next' : 'retry'}">${sim.state === 'won' ? 'Next ▶' : 'Try again ↻'}</button>`
      : `<button class="btn grey" data-act="menu">Back</button>`;
  showPanel(`
    <h2>Upgrades</h2>
    <div class="coins-big">🪙 ${save.coins}</div>
    ${items}
    ${backBtn}
  `);
  screen.dataset.back = back;
}

function showSettings() {
  const t = (key: keyof SaveData['settings'], label: string) =>
    `<div class="toggle ${save.settings[key] ? 'on' : ''}" data-act="toggle" data-key="${key}">${label}<div class="sw"></div></div>`;
  const s = save.stats;
  showPanel(`
    <h2>Settings</h2>
    ${t('sound', '🔊 Sound')}
    ${t('vibration', '📳 Vibration')}
    ${t('reduceShake', '🫨 Reduce screen shake')}
    <div class="stat" style="margin-top:12px">Played: ${s.played} · Won: ${s.won}</div>
    <div class="stat">Zombies total: ${s.kills} · Best squad: ${s.bestPeak}</div>
    <button class="btn red" data-act="reset">Reset progress</button>
    <button class="btn grey" data-act="menu">Back</button>
    <div class="small">Controls: hold your finger/mouse over a lane. PC: ←/→ (A/D) or 1/2/3, Esc to pause.</div>
  `);
}

// ---------- Main loop ----------
const STEP = 1 / 60;
let acc = 0;
let last = performance.now();
let time = 0;

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  time += dt;

  if (mode !== 'paused') {
    if (fx.hitStop > 0) fx.hitStop -= dt;
    else {
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        acc -= STEP;
        steps++;
        const inp: Input =
          mode === 'menu' && bot
            ? bot.think(sim, STEP)
            : mode === 'playing'
              ? autoplay
                ? autoplay.think(sim, STEP)
                : input
              : { lane: null };
        sim.step(STEP, inp);
        handleEvents(sim.drainEvents(), mode === 'playing');
        if (mode === 'menu' && sim.state !== 'playing') startAttract();
      }
      if (acc > STEP * 5) acc = 0;
    }
    fx.update(dt, sim.state === 'playing' ? sim.speed : 0);
  }

  if (mode === 'playing') {
    updateHud();
    if (sim.state !== 'playing' && !resultShown) {
      resultTimer += dt;
      if (resultTimer > 1.3) {
        resultShown = true;
        finishLevel();
      }
    }
  }

  renderer.draw(sim, fx, time);
  requestAnimationFrame(frame);
}

showMenu();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
