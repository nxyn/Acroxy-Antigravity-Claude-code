const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startProxy: () => ipcRenderer.invoke('proxy:start'),
    stopProxy: () => ipcRenderer.invoke('proxy:stop'),
    getProxyStatus: () => ipcRenderer.invoke('proxy:status'),
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close'),
});
