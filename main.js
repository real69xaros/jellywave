const { app, BrowserWindow, shell, Menu, protocol, net, session } = require('electron');
const path = require('path');

// Must be called before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

let mainWindow;

async function createWindow() {
  Menu.setApplicationMenu(null);

  // Serve frontend files via app:// so requests have a real origin (not null)
  protocol.handle('app', (request) => {
    let url = request.url.slice('app://jellywave/'.length) || 'index.html';
    // Strip query strings / hash
    url = url.split('?')[0].split('#')[0];
    const filePath = path.join(__dirname, 'frontend', ...url.split('/'));
    return net.fetch('file://' + filePath);
  });

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

  // Patch Set-Cookie headers from the remote server so they work cross-origin
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    if (headers['set-cookie']) {
      headers['set-cookie'] = headers['set-cookie'].map(cookie => {
        let c = cookie.replace(/;\s*SameSite=\w+/gi, '');
        if (!c.toLowerCase().includes('secure')) c += '; Secure';
        return c + '; SameSite=None';
      });
    }
    callback({ responseHeaders: headers });
  });

  mainWindow.loadURL('app://jellywave/index.html');

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
