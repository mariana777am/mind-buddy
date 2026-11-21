const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('arcade', {
  info: () => ipcRenderer.invoke('info'),
  ask: text => ipcRenderer.invoke('ask', text),            // your Mind: trash talk only
  result: r => ipcRenderer.send('arcade-result', r),
  event: e => ipcRenderer.send('arcade-event', e),
  close: () => ipcRenderer.send('arcade-close'),
  weekly: () => ipcRenderer.invoke('arcade-weekly'),
  onGame: fn => ipcRenderer.on('arcade-game', (e, name) => fn(name)),
});
