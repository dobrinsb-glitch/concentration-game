'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultSettings, normalizeSettings } = require('../../src/main/settings/schema');

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
  assert.deepEqual(settings.rewards, defaultSettings().rewards);
  assert.equal(settings.videos.length, 0);
  assert.equal(settings.updates.scope, 'patch');
  assert.equal(settings.videoAutoplay.idleMinutes, 5);
});

test('legacy stock is discarded and bundled videos migrate to existing files', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const settings = normalizeSettings({
    rewards: [{ source: 'bundled:assets/gift0.webp', quantity: 50 }],
    videos: [{ source: 'bundled:Video/SilverCrest. Прави живота ти лесен.mp4' }]
  });
  assert.equal(settings.rewards.length, 1);
  assert.equal(settings.rewards[0].quantity, 0);
  assert.equal(settings.videos[0].source, defaultSettings().videos[1].source);
  for (const media of [...settings.rewards, ...defaultSettings().videos]) {
    assert.ok(fs.existsSync(path.resolve(__dirname, '../..', media.source.slice(8))));
  }
});
