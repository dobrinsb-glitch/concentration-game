'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'max-mila-smoke-'));
app.setPath('userData', userData);
require('../src/main');

async function waitForWindows() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const windows = BrowserWindow.getAllWindows();
    const game = windows.find((window) => window.webContents.getURL().endsWith('/renderer/game/index.html'));
    const settings = windows.find((window) => window.webContents.getURL().endsWith('/renderer/settings/settings.html'));
    if (game && settings && !game.webContents.isLoading() && !settings.webContents.isLoading()) {
      return { game, settings };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Game and first-run Settings windows did not finish loading.');
}

app.whenReady().then(async () => {
  try {
    const windows = await waitForWindows();
    const gameResult = await windows.game.webContents.executeJavaScript(`({
      title: document.title,
      hasApi: Boolean(window.gameApp),
      hasSettingsButton: [...document.querySelectorAll('button')].some(
        (button) => button.getAttribute('aria-label') === 'Open settings'
      )
    })`);
    const settingsResult = await windows.settings.webContents.executeJavaScript(`(async () => {
      const value = await window.settingsApp.getSettings();
      return {
        title: document.title,
        hasApi: Boolean(window.settingsApp),
        formPresent: Boolean(document.querySelector('#settings-form')),
        configured: value.configured,
        autoplayMinutes: value.videoAutoplay.idleMinutes
      };
    })()`);
    const passed = gameResult.title === 'Max & Mila’s World'
      && gameResult.hasApi
      && gameResult.hasSettingsButton
      && settingsResult.title === 'Settings'
      && settingsResult.hasApi
      && settingsResult.formPresent
      && settingsResult.configured === false
      && settingsResult.autoplayMinutes === 5;
    console.log(JSON.stringify({ game: gameResult, settings: settingsResult }, null, 2));
    fs.rmSync(userData, { recursive: true, force: true });
    app.exit(passed ? 0 : 1);
  } catch (error) {
    console.error(error);
    fs.rmSync(userData, { recursive: true, force: true });
    app.exit(1);
  }
});
