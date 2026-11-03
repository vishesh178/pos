const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  printReceipt: (options) => ipcRenderer.invoke('print-receipt', options),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});

