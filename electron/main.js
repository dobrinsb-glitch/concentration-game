'use strict';

const path = require('node:path');
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain
} = require('electron');
const { autoUpdater } = require('electron-updater');
const {
  copyUserMedia,
  hydrateSettings,
  normalizeSettings,
  readSettings,
  writeSettings
} = require('./config');
const { isUpdateAllowed } = require('./update-policy');

const APP_ROOT = path.join(__dirname, '..');
const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000;
const isDevelopment = !app.isPackaged || process.env.NODE_ENV === 'development';
let mainWindow;
let settingsWindow;
let currentSettings;
let updaterTimer;
let restartTimer;
let updateStatus = { state: 'idle', message: 'Updates have not been checked yet.' };

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

function publicSettings() {
  return hydrateSettings(currentSettings, app.getAppPath(), app.getPath('userData'), app.getVersion());
}

function sendSettings() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:changed', publicSettings());
  }
}

function setUpdateStatus(state, message, extra = {}) {
  updateStatus = { state, message, ...extra };
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('updates:status', updateStatus);
  }
}

function applyStartupPreference() {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({
    openAtLogin: currentSettings.startAtLogin,
    path: process.execPath
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: "Max & Mila's World",
    width: 720,
    height: 1280,
    minWidth: 405,
    minHeight: 720,
    fullscreen: false,
    frame: true,
    autoHideMenuBar: true,
    backgroundColor: '#26251d',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'game-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(APP_ROOT, 'index.html'));
  mainWindow.once('ready-to-show', () => {
    if (!isDevelopment) mainWindow.maximize();
    mainWindow.show();
  });
  mainWindow.webContents.once('did-finish-load', () => {
    if (!currentSettings.configured) createSettingsWindow();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    title: 'Settings',
    width: 780,
    height: 900,
    minWidth: 640,
    minHeight: 650,
    parent: mainWindow || undefined,
    modal: Boolean(mainWindow),
    autoHideMenuBar: true,
    backgroundColor: '#f6f1e7',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  settingsWindow.loadFile(path.join(APP_ROOT, 'settings.html'));
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
    settingsWindow.webContents.send('updates:status', updateStatus);
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
  settingsWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function persistSettings(value, applyApplicationSettings = true) {
  currentSettings = writeSettings(app.getPath('userData'), value);
  sendSettings();
  if (applyApplicationSettings) {
    applyStartupPreference();
    configureUpdater();
  }
  return publicSettings();
}

function registerIpc() {
  ipcMain.handle('settings:get', () => publicSettings());
  ipcMain.handle('settings:open', () => {
    createSettingsWindow();
    return true;
  });
  ipcMain.handle('settings:save', (_event, value) => {
    const normalized = normalizeSettings(value);
    normalized.configured = true;
    const result = persistSettings(normalized);
    setImmediate(() => {
      if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close();
    });
    return result;
  });
  ipcMain.handle('rewards:claim', (_event, rewardId) => {
    const reward = currentSettings.rewards.find((candidate) => candidate.id === rewardId);
    if (!reward || reward.quantity <= 0) throw new Error('That reward is no longer in stock.');
    reward.quantity -= 1;
    return persistSettings(currentSettings, false);
  });
  ipcMain.handle('media:select-image', async () => {
    const result = await dialog.showOpenDialog(settingsWindow || mainWindow, {
      title: 'Choose a reward image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const source = copyUserMedia(result.filePaths[0], 'images', app.getPath('userData'));
    return hydrateSettings({
      rewards: [{ id: `reward-${Date.now()}`, source, quantity: 0 }],
      videos: []
    }, app.getAppPath(), app.getPath('userData'), app.getVersion()).rewards[0];
  });
  ipcMain.handle('media:select-videos', async () => {
    const result = await dialog.showOpenDialog(settingsWindow || mainWindow, {
      title: 'Choose videos',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'm4v', 'webm', 'mov'] }]
    });
    if (result.canceled) return [];
    const videos = result.filePaths.map((filePath, index) => ({
      id: `video-${Date.now()}-${index}`,
      name: path.basename(filePath),
      source: copyUserMedia(filePath, 'videos', app.getPath('userData'))
    }));
    return hydrateSettings({ rewards: [], videos }, app.getAppPath(), app.getPath('userData'), app.getVersion()).videos;
  });
}

function configureUpdater() {
  clearTimeout(updaterTimer);
  if (!app.isPackaged) {
    setUpdateStatus('development', 'Update checks run only in an installed build.');
    return;
  }
  if (!currentSettings.updates.enabled) {
    setUpdateStatus('disabled', 'Automatic updates are disabled.');
    return;
  }
  const check = () => {
    setUpdateStatus('checking', 'Checking GitHub for an update…');
    autoUpdater.checkForUpdates().catch((error) => {
      setUpdateStatus('error', `Update check failed: ${error.message}`);
    });
    updaterTimer = setTimeout(check, UPDATE_INTERVAL_MS);
  };
  updaterTimer = setTimeout(check, 10_000);
}

function configureUpdaterEvents() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-not-available', () => {
    setUpdateStatus('current', `Version ${app.getVersion()} is up to date.`);
  });
  autoUpdater.on('update-available', (info) => {
    if (!currentSettings.updates.enabled) return;
    if (!isUpdateAllowed(app.getVersion(), info.version, currentSettings.updates.scope)) {
      setUpdateStatus(
        'skipped',
        `Version ${info.version} is outside the ${currentSettings.updates.scope} update policy.`,
        { version: info.version }
      );
      return;
    }
    setUpdateStatus('downloading', `Downloading version ${info.version}…`, { version: info.version });
    autoUpdater.downloadUpdate().catch((error) => {
      setUpdateStatus('error', `Update download failed: ${error.message}`);
    });
  });
  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent || 0);
    setUpdateStatus('downloading', `Downloading update: ${percent}%`, { percent });
  });
  autoUpdater.on('update-downloaded', (info) => {
    setUpdateStatus('ready', `Version ${info.version} is ready. Restarting to install…`, { version: info.version });
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => autoUpdater.quitAndInstall(false, true), 5_000);
  });
  autoUpdater.on('error', (error) => {
    setUpdateStatus('error', `Updater error: ${error.message}`);
  });
}

if (hasSingleInstanceLock) {
  app.whenReady().then(() => {
    currentSettings = readSettings(app.getPath('userData'));
    registerIpc();
    configureUpdaterEvents();
    applyStartupPreference();
    createMainWindow();
    configureUpdater();

    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createMainWindow();
    });
  });

  app.on('window-all-closed', () => app.quit());
}

