const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const server = require('./backend/server'); // Launch internal Express backend

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset' // Mac friendly
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Connect to the remote production platform
  // const backendApp = await server.startServer();
  // const port = process.env.APP_PORT || 1075;

  mainWindow.loadURL(`https://jellywave.verbelnodes.com/app/`);

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
