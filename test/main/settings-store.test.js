'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSettingsStore } = require('../../src/main/settings/store');

test('settings store loads defaults and persists normalized data without hydrated URLs', () => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'concentration-settings-'));
  try {
    const store = createSettingsStore(userDataPath);
    const defaults = store.load();
    assert.equal(defaults.configured, false);

    const saved = store.save({
      ...defaults,
      configured: true,
      rewards: [{
        id: 'reward',
        source: 'bundled:assets/gift8-MEDALLION.webp',
        quantity: 3,
        url: 'file:///should-not-persist'
      }]
    });
    assert.equal(saved.configured, true);
    assert.equal(saved.rewards[0].quantity, 3);

    const persisted = JSON.parse(fs.readFileSync(path.join(userDataPath, 'settings.json'), 'utf8'));
    assert.equal(persisted.rewards[0].url, undefined);
    assert.equal(fs.existsSync(path.join(userDataPath, 'settings.json.tmp')), false);
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});
