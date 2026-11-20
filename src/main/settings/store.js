'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { defaultSettings, normalizeSettings } = require('./schema');

const CONFIG_FILE = 'settings.json';

function settingsPath(userDataPath) {
  return path.join(userDataPath, CONFIG_FILE);
}

function readSettings(userDataPath) {
  try {
    return normalizeSettings(JSON.parse(fs.readFileSync(settingsPath(userDataPath), 'utf8')));
  } catch {
    return defaultSettings();
  }
}

function writeSettings(userDataPath, settings) {
  const normalized = normalizeSettings(settings);
  fs.mkdirSync(userDataPath, { recursive: true });
  const destination = settingsPath(userDataPath);
  const temporary = `${destination}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, destination);
  return normalized;
}

function createSettingsStore(userDataPath) {
  let currentSettings;

  return {
    load() {
      currentSettings = readSettings(userDataPath);
      return currentSettings;
    },
    get() {
      if (!currentSettings) throw new Error('Settings have not been loaded.');
      return currentSettings;
    },
    save(settings) {
      currentSettings = writeSettings(userDataPath, settings);
      return currentSettings;
    }
  };
}

module.exports = { createSettingsStore, readSettings, writeSettings };
