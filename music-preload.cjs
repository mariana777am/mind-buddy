const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('music', {
  youtube: q => ipcRenderer.invoke('music-youtube', q),
  lyrics: meta => ipcRenderer.invoke('music-lyrics', meta),
  radio: q => ipcRenderer.invoke('music-radio', q),
  state: s => ipcRenderer.send('music-state', s),
  close: () => ipcRenderer.send('music-close'),
  log: m => ipcRenderer.send('music-log', m),
  onCommand: fn => ipcRenderer.on('music-cmd', (e, c) => fn(c)),
});
