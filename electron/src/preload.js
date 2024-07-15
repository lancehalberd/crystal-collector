// preload with contextIsolation enabled
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  setCloseButton: (isClosed) => ipcRenderer.send('close-app', isClosed)
})
