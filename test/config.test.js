'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultSettings, normalizeSettings } = require('../electron/config');

test('new installations are unconfigured with safe app defaults', () => {
  const settings = defaultSettings();
  assert.equal(settings.configured, false);
  assert.equal(settings.updates.enabled, true);
  assert.equal(settings.updates.scope, 'patch');
  assert.deepEqual(settings.videoAutoplay, { enabled: false, idleMinutes: 5 });
});

test('normalization rejects unsafe media paths and bounds numbers', () => {
  const settings = normalizeSettings({
    configured: true,
    gameSeconds: -5,
    rewards: [{ id: 'bad', source: 'user:images/../../secret', quantity: 4 }],
    videos: [{ id: 'bad', name: 'bad', source: 'file:///secret' }],
    updates: { enabled: true, scope: 'everything' },
    videoAutoplay: { enabled: true, idleMinutes: 0 }
  });
  assert.equal(settings.gameSeconds, 120);
  assert.equal(settings.rewards.length, 0);
  assert.equal(settings.videos.length, 0);
  assert.equal(settings.updates.scope, 'patch');
  assert.equal(settings.videoAutoplay.idleMinutes, 5);
});
