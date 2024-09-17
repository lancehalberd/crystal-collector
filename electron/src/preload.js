// preload with contextIsolation enabled
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setCloseButton: (isClosed) => ipcRenderer.send('close-app', isClosed),
  setWindowedButton: (isWindowed) => ipcRenderer.send('window-app', isWindowed),
  setFullscreenButton: (isFullscreen) => ipcRenderer.send('fullscreen-app', isFullscreen),
})

contextBridge.exposeInMainWorld('steamAPI', {
  steamLogUser: () => {
    ipcRenderer.invoke('steam-log-user')
      .then((response) => {
        return response;
      });
  },
  activateOverlay: () => {
    ipcRenderer.send('steam-activate-overlay');
  },
  steamFetchSteamAchievement: (achievementName) => {
    return ipcRenderer.invoke('steam-fetch-steam-achievements', achievementName);
  },
  steamSetSteamAchievement: (achievementName) => {
    return ipcRenderer.invoke('steam-set-steam-achievements', achievementName)
      .then((response) => {
        return response;
      });
  },
  steamClearSteamAchievement: (achievementName) => {
    return ipcRenderer.invoke('steam-clear-steam-achievements', achievementName);
  },
})
