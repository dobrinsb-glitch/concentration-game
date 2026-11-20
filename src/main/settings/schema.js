'use strict';

const crypto = require('node:crypto');
const path = require('node:path');

const UPDATE_SCOPES = new Set(['patch', 'minor', 'major']);
const BUNDLED_VIDEOS = [
  'Max & Mila’s World • din 12 Octombrie 2026.mp4',
  'SilverCrest. Прави живота ти лесен.mp4'
];

function id() {
  return crypto.randomUUID();
}

function defaultSettings() {
  return {
    schemaVersion: 1,
    configured: false,
    gameSeconds: 120,
    rewards: Array.from({ length: 8 }, (_, index) => ({
      id: `bundled-reward-${index}`,
      source: `bundled:assets/gift${index}.webp`,
      quantity: 0
    })),
    videos: BUNDLED_VIDEOS.map((name, index) => ({
      id: `bundled-video-${index}`,
      name,
      source: `bundled:Video/${name}`
    })),
    startAtLogin: false,
    updates: {
      enabled: true,
      scope: 'patch'
    },
    videoAutoplay: {
      enabled: false,
      idleMinutes: 5
    }
  };
}

function integer(value, fallback, minimum, maximum) {
  const result = Number(value);
  return Number.isInteger(result) && result >= minimum && result <= maximum ? result : fallback;
}

function safeSource(value, kind) {
  if (typeof value !== 'string') return null;
  const prefix = kind === 'reward' ? 'assets/' : 'Video/';
  if (value.startsWith(`bundled:${prefix}`) && !value.includes('..')) return value;
  if (value.startsWith(`user:${kind === 'reward' ? 'images' : 'videos'}/`) && !value.includes('..')) return value;
  return null;
}

function normalizeSettings(value) {
  const defaults = defaultSettings();
  const input = value && typeof value === 'object' ? value : {};
  const rewards = Array.isArray(input.rewards) ? input.rewards.slice(0, 100).map((reward) => {
    const source = safeSource(reward?.source, 'reward');
    if (!source) return null;
    return {
      id: typeof reward.id === 'string' && reward.id ? reward.id.slice(0, 100) : id(),
      source,
      quantity: integer(Number(reward.quantity), 0, 0, 999999)
    };
  }).filter(Boolean) : defaults.rewards;
  const videos = Array.isArray(input.videos) ? input.videos.slice(0, 100).map((video) => {
    const source = safeSource(video?.source, 'video');
    if (!source) return null;
    return {
      id: typeof video.id === 'string' && video.id ? video.id.slice(0, 100) : id(),
      name: typeof video.name === 'string' && video.name.trim()
        ? video.name.trim().slice(0, 300)
        : path.basename(source),
      source
    };
  }).filter(Boolean) : defaults.videos;
  const scope = UPDATE_SCOPES.has(input.updates?.scope) ? input.updates.scope : defaults.updates.scope;

  return {
    schemaVersion: 1,
    configured: input.configured === true,
    gameSeconds: integer(Number(input.gameSeconds), defaults.gameSeconds, 1, 24 * 60 * 60),
    rewards,
    videos,
    startAtLogin: input.startAtLogin === true,
    updates: {
      enabled: input.updates?.enabled !== false,
      scope
    },
    videoAutoplay: {
      enabled: input.videoAutoplay?.enabled === true,
      idleMinutes: integer(Number(input.videoAutoplay?.idleMinutes), defaults.videoAutoplay.idleMinutes, 1, 1440)
    }
  };
}

module.exports = { defaultSettings, normalizeSettings };
