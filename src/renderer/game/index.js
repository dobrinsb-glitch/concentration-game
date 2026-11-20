import { mountBoard } from './board.mjs';
import { chooseReward } from './model.mjs';
import { mountVideo } from './video.mjs';

const stage = document.querySelector('main');
const api = window.gameApp;
const asset = (name) => `../../../assets/${name}`;
const screens = {
  home: 'GAME-001-HOME.jpg',
  board: 'board.jpg',
  win: 'win.jpg',
  lose: 'lose.jpg'
};
const unavailableSettings = {
  configured: false,
  gameSeconds: 120,
  rewards: [],
  videos: [],
  videoAutoplay: { enabled: false, idleMinutes: 5 }
};

let currentCleanup;
let idleTimer;
let page;
let pageDelay;
let playlist = [];
let settings = unavailableSettings;

function resize() {
  stage.style.setProperty('--scale', Math.min(innerWidth / 1080, innerHeight / 1920));
}

function createElement(tag, parent, className, text) {
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

function createHotspot(name, x, y, width, height, action) {
  const button = createElement('button', stage, 'hot');
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
  currentCleanup?.();
  currentCleanup = undefined;
  clearTimeout(pageDelay);
  pageDelay = undefined;
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
  const startButton = createHotspot('Start game', 262, 486, 556, 170, start);
  if (!settings.configured || !stock()) {
    startButton.disabled = true;
    startButton.classList.add('gray');
  }
  createHotspot('Open settings', 0, 0, 140, 134, openSettings);
  videoButton();
  if (showOutOfStock && settings.configured && !stock()) outOfStock();
}

function outOfStock() {
  const overlay = createElement('div', stage, 'shade');
  const box = createElement('div', overlay, 'panel stock');
  createElement('h1', box, '', 'OUT OF STOCK');
  const agree = createElement('button', box, '', 'AGREE');
  agree.addEventListener('click', () => overlay.remove());
}

function videoButton() {
  const button = createHotspot('Play videos', 443, 1730, 194, 168, playVideo);
  if (!playlist.length) {
    button.disabled = true;
    button.classList.add('gray');
    button.title = 'No videos added';
  }
}

function playVideo() {
  if (!playlist.length) return;
  setPage('video');
  currentCleanup = mountVideo({
    createElement,
    createHotspot,
    isActive: () => page === 'video',
    onExit: () => home(),
    playlist,
    stage
  });
}

function start() {
  if (!settings.configured || !stock()) return home(true);
  setPage('board');
  currentCleanup = mountBoard({
    asset,
    createElement,
    createHotspot,
    gameSeconds: settings.gameSeconds,
    onHome: () => home(),
    onRestart: start,
    onResult: result,
    position,
    stage
  });
}

async function result(won) {
  if (page !== 'board') return;
  setPage(won ? 'win' : 'lose');
  if (won) {
    const reward = chooseReward(settings.rewards);
    if (reward) {
      const image = createElement('img', stage, 'gift');
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
  }
  const leave = () => home(won && !stock());
  createHotspot('Home', 10, 4, 140, 134, leave);
  if (won && !stock()) {
    createHotspot('Acknowledge final reward', 140, 300, 810, 1070, leave);
    pageDelay = setTimeout(leave, 7000);
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
