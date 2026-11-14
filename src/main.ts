import './style.css';
import { W } from './game/constants';
import { generateLevel, type LevelDef } from './game/levels';
import { Sim, type GameEvent, type Input } from './game/sim';
import { Renderer } from './game/render';
import { Fx } from './game/fx';
import { Sfx } from './game/audio';
import { Bot } from './game/bot';
import { loadSave, writeSave, resetSave, type SaveData } from './game/save';
import {
  UPGRADES,
  fireRate,
  playerBaseHp,
  championShots,
  upgradeCost,
  starsFor,
  levelReward,
  bonusReward,
} from './game/balance';

type Mode = 'menu' | 'playing' | 'paused' | 'result';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('game');
const hud = $('hud');
const hudLevel = $('hud-level');
const hudCoins = $('hud-coins');
const hudUnits = $('hud-units');
const hudTimer = $('hud-timer');
const btnChamp = $<HTMLButtonElement>('btn-champ');
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
let bot: Bot | null = null; // attract-mode autoplayer for the menu backdrop
let resultTimer = 0;
let resultShown = false;

// ---------- Input ----------
const input: Input = { x: null, fire: false, champion: false };
const keys = new Set<string>();
let pointerDown = false;

canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (mode !== 'playing') return;
  pointerDown = true;
  canvas.setPointerCapture(e.pointerId);
  input.x = renderer.toWorldX(e.clientX);
  hideIntro();
});
canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'playing' || !pointerDown) return;
  input.x = renderer.toWorldX(e.clientX);
});
const release = () => {
  pointerDown = false;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

window.addEventListener('keydown', (e) => {
  sfx.unlock();
  keys.add(e.code);
  if (mode === 'playing') {
    if (e.code === 'KeyE' || e.code === 'Enter') input.champion = true;
    if (e.code === 'Escape' || e.code === 'KeyP') pause();
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space'].includes(e.code)) hideIntro();
  }
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  pointerDown = false;
  if (mode === 'playing') pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'playing') pause();
});
window.addEventListener('resize', () => renderer.resize());

btnChamp.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  sfx.unlock();
  input.champion = true;
});
btnPause.addEventListener('click', () => pause());

function readKeyboard(dt: number) {
  const left = keys.has('ArrowLeft') || keys.has('KeyA');
  const right = keys.has('ArrowRight') || keys.has('KeyD');
  if (left || right) {
    const base = input.x ?? sim.cannonX;
    input.x = Math.max(0, Math.min(W, base + (right ? 1 : -1) * 420 * dt));
  }
  input.fire = pointerDown || keys.has('Space') || left || right;
}

// ---------- Game flow ----------
function simConfig(n: number) {
  const fails = save.fails[n] ?? 0;
  return {
    fireRate: fireRate(save.upgrades.fire),
    playerBaseHp: playerBaseHp(save.upgrades.hp),
    championShots: championShots(save.upgrades.champ),
    enemyScale: Math.max(0.6, 1 - fails * 0.1),
  };
}

function startLevel(n: number) {
  level = generateLevel(n);
  sim = new Sim(level, simConfig(n));
  fx.clear();
  bot = null;
  mode = 'playing';
  resultShown = false;
  resultTimer = 0;
  input.x = null;
  input.fire = false;
  input.champion = false;
  pointerDown = false;
  screen.classList.add('hidden');
  hud.classList.remove('hidden');
  hudLevel.textContent =
    level.type === 'boss' ? `👑 Босс ${n}` : level.type === 'bonus' ? `💰 Бонус ${n}` : `Уровень ${n}`;
  btnChamp.classList.toggle('hidden', !level.champion);
  hudTimer.classList.toggle('hidden', level.type !== 'bonus');
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

function pause() {
  if (mode !== 'playing') return;
  mode = 'paused';
  pointerDown = false;
  showPanel(`
    <h2>Пауза</h2>
    <button class="btn big" data-act="resume">Продолжить</button>
    <button class="btn blue" data-act="restart">Заново</button>
    <button class="btn grey" data-act="menu">В меню</button>
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

function handleEvents(events: GameEvent[], audible: boolean) {
  for (const e of events) {
    switch (e.t) {
      case 'shot':
        if (audible) sfx.shot();
        break;
      case 'gate':
        fx.text(e.x, e.y - 20, e.label, e.good ? '#b6ffcf' : '#ffb3b3', 20 + Math.min(e.n, 5) * 2);
        if (audible) sfx.gate(e.n, e.good);
        break;
      case 'pop':
        fx.burst(e.x, e.y, e.enemy ? '#ff8a98' : '#8fd3ff', 3, 70, 2.2);
        if (audible) sfx.pop();
        break;
      case 'enemyBaseHit':
        fx.enemyBasePunch = Math.min(1, fx.enemyBasePunch + (e.dmg > 1 ? 1 : 0.25));
        fx.burst(e.x, 100, '#ffe36b', e.dmg > 1 ? 30 : 2, e.dmg > 1 ? 200 : 60);
        if (e.dmg > 1) {
          fx.text(e.x, 120, `-${e.dmg}`, '#ffe36b', 30);
          fx.addShake(9);
          if (audible) sfx.boom();
        } else {
          fx.addShake(0.6);
          if (audible) sfx.enemyBaseHit();
        }
        break;
      case 'playerBaseHit':
        fx.playerBasePunch = 1;
        fx.addShake(4);
        fx.burst(e.x, 672, '#ff6b6b', 8, 120);
        fx.flash = 0.35;
        fx.flashColor = '#ff2a2a';
        if (audible) {
          sfx.playerBaseHit();
          vibrate(30);
        }
        break;
      case 'champReady':
        if (audible) sfx.champReady();
        break;
      case 'champLaunch':
        fx.addShake(5);
        fx.burst(e.x, 600, '#ffd54a', 24, 160, 3);
        if (audible) {
          sfx.champLaunch();
          vibrate(40);
        }
        break;
      case 'champHit':
        fx.addHitStop(80);
        fx.addShake(7);
        fx.burst(e.x, e.y, '#ffffff', 18, 180, 3);
        break;
      case 'wallBreak':
        fx.burst(e.x, e.y, '#c9cff0', 40, 220, 3.5);
        fx.addShake(6);
        fx.text(e.x, e.y, 'БАХ!', '#fff', 26);
        if (audible) sfx.boom();
        break;
      case 'coin':
        fx.burst(e.x, 96, '#ffd54a', 4, 90, 2.5);
        if (audible) sfx.coin();
        break;
      case 'win':
        if (!audible) break;
        fx.addHitStop(120);
        fx.addShake(12);
        fx.flash = 0.8;
        fx.flashColor = '#fff6c0';
        for (let i = 0; i < 6; i++) fx.burst(60 + i * 56, 60, i % 2 ? '#ffd54a' : '#ff6b7d', 30, 260, 3.5);
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
  hudUnits.textContent = String(sim.units.length);
  btnChamp.style.setProperty('--p', String(sim.champProgress));
  btnChamp.classList.toggle('ready', sim.champReady);
  if (level.type === 'bonus') hudTimer.textContent = `⏱ ${sim.timeLeft.toFixed(1)}`;
}

function finishLevel() {
  const n = level.n;
  const won = sim.state === 'won';
  save.stats.played++;
  save.stats.unitsFired += sim.stats.fired;
  save.stats.bestPeak = Math.max(save.stats.bestPeak, sim.stats.peakUnits);
  let reward: number;
  let stars = 0;
  if (won) {
    save.stats.won++;
    stars = level.type === 'bonus' ? 3 : starsFor(sim.playerHp, sim.playerHpMax);
    reward = level.type === 'bonus' ? bonusReward(sim.collected, save.upgrades.income) : levelReward(n, stars, save.upgrades.income);
    save.stars[n] = Math.max(save.stars[n] ?? 0, stars);
    delete save.fails[n];
    if (save.level === n) save.level = n + 1;
  } else {
    const dealt = 1 - sim.enemyHp / Math.max(1, sim.enemyHpMax);
    reward = Math.max(5, Math.round(levelReward(n, 1, save.upgrades.income) * 0.35 * dealt));
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
      sfx.click();
      startLevel(save.level);
      break;
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
        target.textContent = 'Точно? Нажми ещё раз';
      }
      break;
  }
});

function affordableUpgrades(): number {
  return UPGRADES.filter((u) => save.upgrades[u.id] < u.max && save.coins >= upgradeCost(u, save.upgrades[u.id])).length;
}

function showMenu() {
  mode = 'menu';
  hud.classList.add('hidden');
  btnChamp.classList.add('hidden');
  hudTimer.classList.add('hidden');
  intro.classList.add('hidden');
  startAttract();
  const n = save.level;
  const t = generateLevel(n).type;
  const label = t === 'boss' ? `👑 Босс ${n}` : t === 'bonus' ? `💰 Бонус ${n}` : `Уровень ${n}`;
  const can = affordableUpgrades();
  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  showPanel(`
    <div class="title">MOB<br>CANNON</div>
    <div class="subtitle">та самая игра из рекламы — только честная</div>
    <div class="coins-big">🪙 ${save.coins} &nbsp; ⭐ ${totalStars}</div>
    <button class="btn big" data-act="play">▶ ${label}</button>
    <div class="row">
      <button class="btn blue" data-act="upgrades">⬆ Улучшения${can ? ` (${can})` : ''}</button>
      <button class="btn grey" data-act="settings">⚙</button>
    </div>
    <div class="small">Без рекламы. Без доната. Прогресс хранится в браузере.</div>
  `);
}

function showResult(won: boolean, stars: number, reward: number) {
  mode = 'result';
  hud.classList.add('hidden');
  btnChamp.classList.add('hidden');
  hudTimer.classList.add('hidden');
  const can = affordableUpgrades();
  if (won) {
    const isBonus = level.type === 'bonus';
    showPanel(`
      ${level.type === 'boss' ? '<div class="badge">БОСС ПОВЕРЖЕН</div>' : ''}
      <h2>${isBonus ? 'Копилка полна!' : 'Победа!'}</h2>
      <div class="stars">${[1, 2, 3].map((i) => `<span data-s="${i}">⭐</span>`).join('')}</div>
      <div class="reward">+${reward} 🪙</div>
      ${isBonus ? `<div class="stat">Собрано юнитов: ${sim.collected}</div>` : ''}
      <div class="stat">Выстрелов: ${sim.stats.fired} · Пик толпы: ${sim.stats.peakUnits} · Врагов: ${sim.stats.killed}</div>
      <button class="btn big" data-act="next">Дальше ▶</button>
      <div class="row">
        <button class="btn blue" data-act="upgrades" data-back="result">⬆ Улучшения${can ? ` (${can})` : ''}</button>
        <button class="btn grey" data-act="menu">Меню</button>
      </div>
    `);
    screen.querySelectorAll<HTMLElement>('.stars span').forEach((el) => {
      const i = Number(el.dataset.s);
      if (i <= stars) setTimeout(() => el.classList.add('on'), 250 + i * 280);
    });
  } else {
    const fails = save.fails[level.n] ?? 0;
    showPanel(`
      <h2>База пала 💥</h2>
      <div class="stat">Крепость врага: осталось ${Math.ceil(sim.enemyHp)} из ${sim.enemyHpMax}</div>
      <div class="reward">+${reward} 🪙</div>
      ${fails >= 1 ? `<div class="stat">Враги стали чуть слабее (−${Math.min(40, fails * 10)}%)</div>` : ''}
      ${can ? `<div class="stat">💡 Доступно улучшений: ${can}</div>` : ''}
      <button class="btn big" data-act="retry">Ещё раз ↻</button>
      <div class="row">
        <button class="btn blue" data-act="upgrades" data-back="result">⬆ Улучшения</button>
        <button class="btn grey" data-act="menu">Меню</button>
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
          <div class="lvl">ур. ${lvl}/${u.max}</div>
        </div>
        <button class="btn" data-act="buy" data-id="${u.id}" ${maxed || save.coins < cost ? 'disabled' : ''}>
          ${maxed ? 'MAX' : `🪙 ${cost}`}
        </button>
      </div>`;
  }).join('');
  const backBtn =
    back === 'result'
      ? `<button class="btn big" data-act="${sim.state === 'won' ? 'next' : 'retry'}">${sim.state === 'won' ? 'Дальше ▶' : 'Ещё раз ↻'}</button>`
      : `<button class="btn grey" data-act="menu">Назад</button>`;
  showPanel(`
    <h2>Улучшения</h2>
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
    <h2>Настройки</h2>
    ${t('sound', '🔊 Звук')}
    ${t('vibration', '📳 Вибрация')}
    ${t('reduceShake', '🫨 Меньше тряски')}
    <div class="stat" style="margin-top:12px">Сыграно: ${s.played} · Побед: ${s.won}</div>
    <div class="stat">Выстрелов всего: ${s.unitsFired} · Рекорд толпы: ${s.bestPeak}</div>
    <button class="btn red" data-act="reset">Сбросить прогресс</button>
    <button class="btn grey" data-act="menu">Назад</button>
    <div class="small">Управление: зажми и веди пальцем/мышью. ПК: ←/→ или A/D, пробел — огонь, E — чемпион.</div>
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

  if (mode === 'playing' || mode === 'menu' || mode === 'result') {
    if (fx.hitStop > 0) {
      fx.hitStop -= dt;
    } else {
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        acc -= STEP;
        steps++;
        let inp: Input;
        if (mode === 'menu' && bot) inp = bot.think(sim, STEP);
        else if (mode === 'playing') {
          readKeyboard(STEP);
          inp = input;
        } else inp = { x: null, fire: false, champion: false };
        sim.step(STEP, inp);
        input.champion = false;
        handleEvents(sim.drainEvents(), mode === 'playing');
        if (mode === 'menu' && sim.state !== 'playing') startAttract();
      }
      if (acc > STEP * 5) acc = 0;
    }
    fx.update(dt);
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

// PWA: offline + install to home screen.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
