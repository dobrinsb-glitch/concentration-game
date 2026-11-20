'use strict';

function applyStartupPreference(app, settings) {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({
    openAtLogin: settings.startAtLogin,
    path: process.execPath
  });
}

module.exports = { applyStartupPreference };
