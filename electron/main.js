const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const http = require('http');

let mainWindow = null;
let serverInstance = null;

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}`, () => {
      req.destroy();
      resolve(true);
    });
    req.on('error', () => {
      // Fallback check on localhost in case dev server bound to IPv6 loopback
      const req2 = http.get(`http://localhost:${port}`, () => {
        req2.destroy();
        resolve(true);
      });
      req2.on('error', () => resolve(false));
      req2.setTimeout(1000, () => {
        req2.destroy();
        resolve(false);
      });
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startBackendServer() {
  return new Promise((resolve) => {
    try {
      const expressApp = require('../server/index');
      const PORT = process.env.PORT || 5001;
      serverInstance = expressApp.listen(PORT, '0.0.0.0', () => {
        console.log(`[Electron Main] Embedded Express server running on port ${PORT} (0.0.0.0)`);
        resolve();
      });
      serverInstance.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`[Electron Main] Server port ${PORT} already active, reusing existing instance`);
          resolve();
        } else {
          console.error('[Electron Main] Error in Express server:', err.message);
          resolve();
        }
      });
    } catch (err) {
      console.error('[Electron Main] Error starting embedded backend server:', err.message);
      resolve();
    }
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#090a0f',
    title: 'Curated Art — Luxury ERP & Billing Management',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 650,
        height: 750,
        backgroundColor: '#090a0f',
        autoHideMenuBar: true,
      },
    };
  });

  const isDev = process.env.NODE_ENV === 'development';
  let targetURL = 'http://127.0.0.1:5001';

  if (isDev) {
    const viteRunning = await checkPort(5173);
    if (viteRunning) {
      targetURL = 'http://127.0.0.1:5173';
    }
  }

  mainWindow.loadURL(targetURL).catch(() => {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('print-receipt', async (event, options = {}) => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  try {
    mainWindow.webContents.print({
      silent: options.silent ?? false,
      printBackground: true,
      deviceName: options.deviceName || '',
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  return mainWindow.webContents.getPrintersAsync();
});

ipcMain.handle('open-external', async (event, url) => {
  if (url) shell.openExternal(url);
});

app.whenReady().then(async () => {
  await startBackendServer();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverInstance) {
    serverInstance.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

