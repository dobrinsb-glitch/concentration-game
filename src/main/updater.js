'use strict';

const { isUpdateAllowed } = require('./update-policy');

const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000;
const INITIAL_UPDATE_DELAY_MS = 10_000;
const INSTALL_DELAY_MS = 5_000;

function createUpdater({ autoUpdater, isPackaged, getCurrentVersion, getSettings, onStatus }) {
  let updaterTimer;
  let restartTimer;
  let eventsConfigured = false;
  let status = { state: 'idle', message: 'Updates have not been checked yet.' };

  function setStatus(state, message, extra = {}) {
    status = { state, message, ...extra };
    onStatus(status);
  }

  function configureEvents() {
    if (eventsConfigured) return;
    eventsConfigured = true;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-not-available', () => {
      setStatus('current', `Version ${getCurrentVersion()} is up to date.`);
    });
    autoUpdater.on('update-available', (info) => {
      const settings = getSettings();
      if (!settings.updates.enabled) return;
      if (!isUpdateAllowed(getCurrentVersion(), info.version, settings.updates.scope)) {
        setStatus(
          'skipped',
          `Version ${info.version} is outside the ${settings.updates.scope} update policy.`,
          { version: info.version }
        );
        return;
      }
      setStatus('downloading', `Downloading version ${info.version}…`, { version: info.version });
      autoUpdater.downloadUpdate().catch((error) => {
        setStatus('error', `Update download failed: ${error.message}`);
      });
    });
    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.round(progress.percent || 0);
      setStatus('downloading', `Downloading update: ${percent}%`, { percent });
    });
    autoUpdater.on('update-downloaded', (info) => {
      setStatus('ready', `Version ${info.version} is ready. Restarting to install…`, { version: info.version });
      clearTimeout(restartTimer);
      restartTimer = setTimeout(() => autoUpdater.quitAndInstall(false, true), INSTALL_DELAY_MS);
    });
    autoUpdater.on('error', (error) => {
      setStatus('error', `Updater error: ${error.message}`);
    });
  }

  function configure() {
    clearTimeout(updaterTimer);
    if (!isPackaged) {
      setStatus('development', 'Update checks run only in an installed build.');
      return;
    }
    if (!getSettings().updates.enabled) {
      setStatus('disabled', 'Automatic updates are disabled.');
      return;
    }
    const check = () => {
      setStatus('checking', 'Checking GitHub for an update…');
      autoUpdater.checkForUpdates().catch((error) => {
        setStatus('error', `Update check failed: ${error.message}`);
      });
      updaterTimer = setTimeout(check, UPDATE_INTERVAL_MS);
    };
    updaterTimer = setTimeout(check, INITIAL_UPDATE_DELAY_MS);
  }

  function start() {
    configureEvents();
    configure();
  }

  function stop() {
    clearTimeout(updaterTimer);
    clearTimeout(restartTimer);
  }

  return {
    configure,
    getStatus: () => status,
    start,
    stop
  };
}

module.exports = { createUpdater };
