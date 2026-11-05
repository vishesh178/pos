const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const http = require('http');

let mainWindow = null;
let serverInstance = null;

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
      req.destroy();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => {
      const req2 = http.get(`http://localhost:${port}/api/health`, (res2) => {
        req2.destroy();
        resolve(res2.statusCode === 200);
      });
      req2.on('error', () => resolve(false));
      req2.setTimeout(800, () => {
        req2.destroy();
        resolve(false);
      });
    });
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForHealth(port = 5001, timeoutMs = 6000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        req.destroy();
        if (res.statusCode === 200) {
          return resolve(true);
        }
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(check, 250);
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(check, 250);
      });
      req.setTimeout(600, () => req.destroy());
    };
    check();
  });
}

function startBackendServer() {
  return new Promise(async (resolve) => {
    const PORT = process.env.PORT || 5001;
    const isHealthy = await checkPort(PORT);
    if (isHealthy) {
      console.log(`[Electron Main] Embedded Express server already responsive on port ${PORT}`);
      return resolve();
    }

    try {
      const expressApp = require('../server/index');
      serverInstance = expressApp.listen(PORT, '0.0.0.0', () => {
        console.log(`[Electron Main] Embedded Express server listening on port ${PORT} (0.0.0.0)`);
        resolve();
      });
      serverInstance.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`[Electron Main] Port ${PORT} busy, waiting for service...`);
        } else {
          console.error('[Electron Main] Error in Express server:', err.message);
        }
        resolve();
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

  // Ensure server is responding before attempting navigation
  if (targetURL.includes('5001')) {
    await waitForHealth(5001, 5000);
  }

  mainWindow.loadURL(targetURL).catch((err) => {
    console.warn(`[Electron] Failed to load ${targetURL}:`, err.message);
    const splashHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Curated Art ERP</title>
        <style>
          body {
            background: #090a0f;
            color: #f5f5f4;
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .card {
            background: #1c1917;
            border: 1px solid #292524;
            padding: 36px 32px;
            border-radius: 24px;
            max-width: 440px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(245, 158, 11, 0.2);
            border-top-color: #f59e0b;
            border-radius: 50%;
            animation: spin 0.9s linear infinite;
            margin: 0 auto 20px auto;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          h2 { color: #f59e0b; margin: 0 0 10px 0; font-size: 20px; font-weight: bold; }
          p { color: #a8a29e; font-size: 13px; line-height: 1.6; margin: 0 0 20px 0; }
          button {
            background: #f59e0b;
            color: #0c0a09;
            border: none;
            padding: 11px 24px;
            border-radius: 12px;
            font-weight: bold;
            font-size: 13px;
            cursor: pointer;
            transition: opacity 0.2s;
          }
          button:hover { opacity: 0.9; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h2>Starting Curated Art ERP...</h2>
          <p>Initializing local business database and background server. You will be connected automatically in a moment.</p>
          <button onclick="window.location.href='http://127.0.0.1:5001'">Retry Connection</button>
        </div>
        <script>
          const poll = () => {
            fetch('http://127.0.0.1:5001/api/health')
              .then(r => { if (r.ok) window.location.href = 'http://127.0.0.1:5001'; })
              .catch(() => {});
          };
          setInterval(poll, 1000);
        </script>
      </body>
      </html>
    `;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
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
    if (BrowserWindow.getAllWindows().length === 0) {
      await startBackendServer();
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On Windows/Linux quit immediately; on macOS keep background server alive in dock
  if (process.platform !== 'darwin') {
    if (serverInstance) {
      serverInstance.close();
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverInstance) {
    serverInstance.close();
  }
});

