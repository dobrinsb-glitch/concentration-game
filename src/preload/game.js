'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gameApp', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  openSettings: () => ipcRenderer.invoke('settings:open'),
  claimReward: (rewardId) => ipcRenderer.invoke('rewards:claim', rewardId),
  onSettingsChanged: (listener) => {
    const handler = (_event, settings) => listener(settings);
    ipcRenderer.on('settings:changed', handler);
    return () => ipcRenderer.removeListener('settings:changed', handler);
  }
});
