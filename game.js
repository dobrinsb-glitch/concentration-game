'use strict';

const stage = document.querySelector('main');
const api = window.gameApp;
const asset = (name) => `assets/${name}`;
const screens = {
  home: 'GAME-001-HOME.jpg',
  board: 'board.jpg',
  win: 'win.jpg',
  lose: 'lose.jpg'
};
const bundledVideos = [
  'Max & Mila’s World • din 12 Octombrie 2026.mp4',
  'SilverCrest. Прави живота ти лесен.mp4'
];
const fallbackSettings = {
  configured: false,
  gameSeconds: 120,
  rewards: Array.from({ length: 8 }, (_, index) => ({
    id: `bundled-reward-${index}`,
    url: asset(`gift${index}.webp`),
    quantity: 0
  })),
  videos: bundledVideos.map((name, index) => ({
    id: `bundled-video-${index}`,
    name,
    url: `Video/${encodeURIComponent(name)}`
  })),
  videoAutoplay: { enabled: false, idleMinutes: 5 }
};

let settings = fallbackSettings;
let playlist = settings.videos;
let page;
let tick;
let delay;
let idleTimer;
let deadline;
let picked;
let matched;
let locked;

function resize() {
  stage.style.setProperty('--scale', Math.min(innerWidth / 1080, innerHeight / 1920));
}

function el(tag, parent, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  parent.append(node);
  return node;
}

function position(node, x, y, width, height) {
  Object.assign(node.style, {
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`
  });
}

function hot(name, x, y, width, height, action) {
  const button = el('button', stage, 'hot');
  button.ariaLabel = name;
  button.title = name;
  position(button, x, y, width, height);
  button.addEventListener('click', action);
  return button;
}

function scheduleVideoAutoplay() {
  clearTimeout(idleTimer);
  if (
    page !== 'video' &&
    playlist.length &&
    settings.videoAutoplay?.enabled &&
    settings.videoAutoplay.idleMinutes > 0
  ) {
    idleTimer = setTimeout(playVideo, settings.videoAutoplay.idleMinutes * 60 * 1000);
  }
}

function setPage(nextPage) {
  clearInterval(tick);
  clearTimeout(delay);
  page = nextPage;
  stage.replaceChildren();
  stage.style.backgroundImage = screens[nextPage] ? `url("${asset(screens[nextPage])}")` : 'none';
  scheduleVideoAutoplay();
}

function stock() {
  return settings.rewards.reduce((sum, reward) => sum + reward.quantity, 0);
}

function openSettings() {
  if (api) api.openSettings();
  else window.alert('Settings are available in the Electron application.');
}

function home(showOutOfStock = false) {
  setPage('home');
  const startButton = hot('Start game', 262, 486, 556, 170, start);
  if (!settings.configured || !stock()) {
    startButton.disabled = true;
    startButton.classList.add('gray');
  }
  hot('Open settings', 0, 0, 140, 134, openSettings);
  videoButton();
  if (showOutOfStock && settings.configured && !stock()) outOfStock();
}

function outOfStock() {
  const overlay = el('div', stage, 'shade');
  const box = el('div', overlay, 'panel stock');
  el('h1', box, '', 'OUT OF STOCK');
  const agree = el('button', box, '', 'AGREE');
  agree.addEventListener('click', () => overlay.remove());
}

function videoButton() {
  const button = hot('Play videos', 443, 1730, 194, 168, playVideo);
  if (!playlist.length) {
    button.disabled = true;
    button.classList.add('gray');
    button.title = 'No videos added';
  }
}

function playVideo() {
  if (!playlist.length) return;
  setPage('video');
  const video = el('video', stage);
  video.playsInline = true;
  let index = 0;
  let failed = 0;

  function load() {
    video.src = playlist[index].url;
    video.play().catch(() => {});
  }

  function next() {
    if (page !== 'video') return;
    index = (index + 1) % playlist.length;
    load();
  }

  video.addEventListener('playing', () => { failed = 0; });
  video.addEventListener('ended', next);
  video.addEventListener('error', () => {
    if (page !== 'video') return;
    failed += 1;
    if (failed >= playlist.length) home();
    else next();
  });
  load();
  hot('Return home', 0, 0, 1080, 1920, () => home());
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function start() {
  if (!settings.configured || !stock()) return home(true);
  setPage('board');
  picked = [];
  matched = 0;
  locked = false;
  hot('Home', 10, 4, 140, 134, () => home());
  const refresh = hot('Restart game', 930, 15, 130, 110, start);
  refresh.style.background = 'url(assets/refresh.png) center/contain no-repeat';
  const timer = el('div', stage, 'timer');
  deadline = Date.now() + settings.gameSeconds * 1000;

  function update() {
    const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    timer.textContent = [Math.floor(seconds / 60), seconds % 60]
      .map((value) => String(value).padStart(2, '0'))
      .join(':');
    if (!seconds) result(false);
  }

  update();
  tick = setInterval(update, 100);
  const ids = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10];
  const deck = shuffle([...ids, ...ids]);
  const backs = shuffle([...Array(20).keys()]);

  deck.forEach((id, index) => {
    const button = el('button', stage, 'tile');
    position(
      button,
      [128, 345, 562, 778][index % 4],
      [288, 585, 882, 1179, 1476][Math.floor(index / 4)],
      174,
      260
    );
    button.ariaLabel = `Tile ${index + 1}`;
    const flip = el('span', button);
    el('img', flip).src = asset(`back${backs[index]}.jpg`);
    el('img', flip, 'face').src = asset(`face${id}.jpg`);
    button.addEventListener('click', () => {
      if (Date.now() >= deadline) return result(false);
      if (locked || button.disabled) return;
      button.disabled = true;
      button.classList.add('turned');
      picked.push({ button, id });
      if (picked.length < 2) return;
      if (picked[0].id === id) {
        picked = [];
        matched += 1;
        if (matched === 10) result(true);
      } else {
        locked = true;
        delay = setTimeout(() => {
          picked.forEach(({ button: pickedButton }) => {
            pickedButton.disabled = false;
            pickedButton.classList.remove('turned');
          });
          picked = [];
          locked = false;
        }, 900);
      }
    });
  });
}

async function result(won) {
  if (page !== 'board') return;
  setPage(won ? 'win' : 'lose');
  if (won) {
    const choices = settings.rewards.filter((reward) => reward.quantity > 0);
    const reward = choices[Math.floor(Math.random() * choices.length)];
    const image = el('img', stage, 'gift');
    image.src = reward.url;
    image.alt = 'Your reward';
    if (api) {
      try {
        settings = await api.claimReward(reward.id);
        playlist = settings.videos;
      } catch {
        reward.quantity = Math.max(0, reward.quantity - 1);
      }
    } else {
      reward.quantity -= 1;
    }
  }
  const leave = () => home(won && !stock());
  hot('Home', 10, 4, 140, 134, leave);
  if (won && !stock()) {
    hot('Acknowledge final reward', 140, 300, 810, 1070, leave);
    delay = setTimeout(leave, 7000);
  }
  videoButton();
}

function applySettings(nextSettings) {
  settings = nextSettings;
  playlist = settings.videos;
  scheduleVideoAutoplay();
  if (page === 'home') home();
}

async function load() {
  if (api) {
    applySettings(await api.getSettings());
    api.onSettingsChanged(applySettings);
  }
  home();
}

window.addEventListener('resize', resize);
window.addEventListener('pointerdown', scheduleVideoAutoplay, { passive: true });
window.addEventListener('keydown', scheduleVideoAutoplay);
resize();
load().catch(() => home());
