import { app, BrowserWindow, shell, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let serverUrl = null;
let mainWindow = null;

async function boot() {
  // Port 0: let the OS pick, so a second copy or a busy 4317 is never a problem.
  const { start } = await import('../server/index.js');
  const { url } = await start({ port: 0 });
  console.log(`[gitboard] server on ${url}`);
  return url;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#FEF7FF',
    title: 'Gitboard',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  mainWindow.loadURL(url);

  // Links to anything outside the app open in the real browser, not in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(url)) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  try {
    serverUrl = await boot();
  } catch (err) {
    dialog.showErrorBox('Gitboard не смог запуститься', String(err?.stack ?? err));
    app.quit();
    return;
  }
  createWindow(serverUrl);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(serverUrl);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
