'use strict';

const api = window.settingsApp;
const form = document.querySelector('#settings-form');
const gameTime = document.querySelector('#game-time');
const rewardList = document.querySelector('#reward-list');
const videoList = document.querySelector('#video-list');
const autoplay = document.querySelector('#video-autoplay');
const idleMinutes = document.querySelector('#idle-minutes');
const idleField = document.querySelector('#idle-field');
const startAtLogin = document.querySelector('#start-at-login');
const updatesEnabled = document.querySelector('#updates-enabled');
const updateScope = document.querySelector('#update-scope');
const updateScopeField = document.querySelector('#update-scope-field');
const updateStatus = document.querySelector('#update-status');
const message = document.querySelector('#form-message');
const saveButton = document.querySelector('#save');
let draft;

function button(text, className, action, label = text) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = text;
  element.className = className;
  element.ariaLabel = label;
  element.addEventListener('click', action);
  return element;
}

function renderRewards() {
  rewardList.replaceChildren();
  for (const reward of draft.rewards) {
    const row = document.createElement('div');
    row.className = 'item-row';
    const image = document.createElement('img');
    image.src = reward.url;
    image.alt = 'Reward preview';
    const change = button('Change image', 'secondary', async () => {
      const replacement = await api.selectRewardImage();
      if (!replacement) return;
      reward.source = replacement.source;
      reward.url = replacement.url;
      image.src = reward.url;
    });
    const quantityLabel = document.createElement('label');
    quantityLabel.className = 'quantity';
    quantityLabel.textContent = 'Quantity';
    const quantity = document.createElement('input');
    quantity.type = 'number';
    quantity.min = '0';
    quantity.max = '999999';
    quantity.step = '1';
    quantity.required = true;
    quantity.value = String(reward.quantity);
    quantity.addEventListener('input', () => { reward.quantity = Number(quantity.value); });
    quantityLabel.append(quantity);
    const remove = button('×', 'icon', () => {
      draft.rewards.splice(draft.rewards.indexOf(reward), 1);
      row.remove();
    }, 'Remove reward');
    row.append(image, change, quantityLabel, remove);
    rewardList.append(row);
  }
}

function renderVideos() {
  videoList.replaceChildren();
  for (const video of draft.videos) {
    const row = document.createElement('div');
    row.className = 'item-row';
    const preview = document.createElement('video');
    preview.src = video.url;
    preview.muted = true;
    preview.preload = 'metadata';
    const name = document.createElement('span');
    name.className = 'item-name';
    name.textContent = video.name;
    const remove = button('×', 'icon', () => {
      draft.videos.splice(draft.videos.indexOf(video), 1);
      row.remove();
    }, `Remove ${video.name}`);
    row.append(preview, name, remove);
    videoList.append(row);
  }
}

function secondsToTime(seconds) {
  return [Math.floor(seconds / 60), seconds % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function setConditionalFields() {
  idleField.hidden = !autoplay.checked;
  idleMinutes.disabled = !autoplay.checked;
  updateScopeField.hidden = !updatesEnabled.checked;
  updateScope.disabled = !updatesEnabled.checked;
}

async function load() {
  draft = await api.getSettings();
  document.querySelector('#version').textContent = `Version ${draft.appVersion}`;
  gameTime.value = secondsToTime(draft.gameSeconds);
  autoplay.checked = draft.videoAutoplay.enabled;
  idleMinutes.value = String(draft.videoAutoplay.idleMinutes);
  startAtLogin.checked = draft.startAtLogin;
  updatesEnabled.checked = draft.updates.enabled;
  updateScope.value = draft.updates.scope;
  renderRewards();
  renderVideos();
  setConditionalFields();
}

document.querySelector('#add-reward').addEventListener('click', async () => {
  const reward = await api.selectRewardImage();
  if (!reward) return;
  draft.rewards.push(reward);
  renderRewards();
});

document.querySelector('#add-videos').addEventListener('click', async () => {
  const videos = await api.selectVideos();
  if (!videos.length) return;
  draft.videos.push(...videos);
  renderVideos();
});

autoplay.addEventListener('change', setConditionalFields);
updatesEnabled.addEventListener('change', setConditionalFields);
api.onUpdateStatus((status) => { updateStatus.textContent = status.message; });

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  const [minutes, seconds] = gameTime.value.split(':').map(Number);
  const gameSeconds = minutes * 60 + seconds;
  if (!gameSeconds) {
    message.textContent = 'Game time must be longer than zero.';
    return;
  }
  draft = {
    ...draft,
    configured: true,
    gameSeconds,
    rewards: draft.rewards.map(({ id, source, quantity }) => ({ id, source, quantity })),
    videos: draft.videos.map(({ id, name, source }) => ({ id, name, source })),
    startAtLogin: startAtLogin.checked,
    updates: {
      enabled: updatesEnabled.checked,
      scope: updateScope.value
    },
    videoAutoplay: {
      enabled: autoplay.checked,
      idleMinutes: Number(idleMinutes.value)
    }
  };
  saveButton.disabled = true;
  message.textContent = 'Saving…';
  try {
    await api.saveSettings(draft);
  } catch (error) {
    saveButton.disabled = false;
    message.textContent = error.message || 'Could not save the settings.';
  }
});

load().catch((error) => {
  message.textContent = error.message || 'Could not load the settings.';
  saveButton.disabled = true;
});
