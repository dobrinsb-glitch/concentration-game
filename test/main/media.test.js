'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { hydrateSettings, sourcePath } = require('../../src/main/settings/media');

test('media descriptors resolve only beneath their controlled roots', () => {
  const appPath = path.resolve('/application');
  const userDataPath = path.resolve('/user-data');
  assert.equal(
    sourcePath('bundled:assets/gift0.webp', appPath, userDataPath),
    path.join(appPath, 'assets', 'gift0.webp')
  );
  assert.equal(
    sourcePath('user:images/reward.webp', appPath, userDataPath),
    path.join(userDataPath, 'media', 'images', 'reward.webp')
  );
  assert.throws(
    () => sourcePath('user:../secret.txt', appPath, userDataPath),
    /outside its allowed directory/
  );
});

test('hydration adds runtime URLs without replacing persisted descriptors', () => {
  const settings = {
    rewards: [{ id: 'reward', source: 'bundled:assets/gift0.webp', quantity: 1 }],
    videos: []
  };
  const hydrated = hydrateSettings(settings, path.resolve('/application'), path.resolve('/user-data'), '1.2.3');
  assert.match(hydrated.rewards[0].url, /^file:/);
  assert.equal(hydrated.rewards[0].source, settings.rewards[0].source);
  assert.equal(hydrated.appVersion, '1.2.3');
});
