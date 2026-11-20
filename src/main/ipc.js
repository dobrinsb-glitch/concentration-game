'use strict';

const path = require('node:path');
const { copyUserMedia, hydrateSettings } = require('./settings/media');
const { normalizeSettings } = require('./settings/schema');
const { applyStartupPreference } = require('./startup');

function registerIpc({ app, dialog, ipcMain, store, updater, windows }) {
  const toPublicSettings = (settings = store.get()) => hydrateSettings(
    settings,
    app.getAppPath(),
    app.getPath('userData'),
    app.getVersion()
  );

  function persistSettings(value, applyApplicationSettings = true) {
    const settings = store.save(value);
    const publicSettings = toPublicSettings(settings);
    windows.sendSettings(publicSettings);
    if (applyApplicationSettings) {
      applyStartupPreference(app, settings);
      updater.configure();
    }
    return publicSettings;
  }

  ipcMain.handle('settings:get', () => toPublicSettings());
  ipcMain.handle('settings:open', () => {
    windows.createSettingsWindow();
    return true;
  });
  ipcMain.handle('settings:save', (_event, value) => {
    const normalized = normalizeSettings(value);
    normalized.configured = true;
    const result = persistSettings(normalized);
    setImmediate(() => {
      const settingsWindow = windows.getSettingsWindow();
      if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close();
    });
    return result;
  });
  ipcMain.handle('rewards:claim', (_event, rewardId) => {
    let claimed = false;
    const currentSettings = store.get();
    const rewards = currentSettings.rewards.map((reward) => {
      if (reward.id !== rewardId) return reward;
      if (reward.quantity <= 0) return reward;
      claimed = true;
      return { ...reward, quantity: reward.quantity - 1 };
    });
    if (!claimed) throw new Error('That reward is no longer in stock.');
    return persistSettings({ ...currentSettings, rewards }, false);
  });
  ipcMain.handle('media:select-image', async () => {
    const options = {
      title: 'Choose a reward image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }]
    };
    const owner = windows.getSettingsWindow() || windows.getMainWindow();
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    const source = copyUserMedia(result.filePaths[0], 'images', app.getPath('userData'));
    return hydrateSettings({
      rewards: [{ id: `reward-${Date.now()}`, source, quantity: 0 }],
      videos: []
    }, app.getAppPath(), app.getPath('userData'), app.getVersion()).rewards[0];
  });
  ipcMain.handle('media:select-videos', async () => {
    const options = {
      title: 'Choose videos',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'm4v', 'webm', 'mov'] }]
    };
    const owner = windows.getSettingsWindow() || windows.getMainWindow();
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (result.canceled) return [];
    const videos = result.filePaths.map((filePath, index) => ({
      id: `video-${Date.now()}-${index}`,
      name: path.basename(filePath),
      source: copyUserMedia(filePath, 'videos', app.getPath('userData'))
    }));
    return hydrateSettings({ rewards: [], videos }, app.getAppPath(), app.getPath('userData'), app.getVersion()).videos;
  });

  return { toPublicSettings };
}

module.exports = { registerIpc };
