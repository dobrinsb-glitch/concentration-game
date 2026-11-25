'use strict';

const crypto = require('node:crypto');
const path = require('node:path');

const UPDATE_SCOPES = new Set(['patch', 'minor', 'major']);
const MEDALLION = 'bundled:assets/gift8-MEDALLION.webp';
const LEGACY_VIDEOS = [
  'Max & Mila’s World • din 12 Octombrie 2026.mp4',
  'SilverCrest. Прави живота ти лесен.mp4'
];

const BUNDLED_VIDEOS = [
  'KW42_MMW_Image_DS.mp4',
  'KW42_MMW_Image_LoveLanguage_SoMe_9x16_20s.mp4'
];

function id() {
  return crypto.randomUUID();
}

function defaultSettings() {
  return {
    schemaVersion: 1,
    configured: false,
    gameSeconds: 120,
    rewards: [{ id: 'bundled-reward-8', source: MEDALLION, quantity: 0 }],
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
  const medallion = Array.isArray(input.rewards)
    ? input.rewards.find((reward) => reward?.source === MEDALLION)
    : undefined;
  const rewards = defaults.rewards;
  rewards[0].quantity = integer(medallion?.quantity, 0, 0, 999999);
  const videos = Array.isArray(input.videos) ? input.videos.slice(0, 100).map((video) => {
    const source = safeSource(video?.source, 'video');
    if (!source) return null;
    const legacyIndex = LEGACY_VIDEOS.findIndex((name) => source === `bundled:Video/${name}`);
    if (legacyIndex >= 0) return defaults.videos[legacyIndex];
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
