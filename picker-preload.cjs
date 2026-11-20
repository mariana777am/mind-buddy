const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('picker', {
  get: () => ipcRenderer.invoke('announce-get'),
  save: cfg => ipcRenderer.send('announce-set', cfg),
  close: () => ipcRenderer.send('picker-close'),
});
