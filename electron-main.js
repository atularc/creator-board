// Creator Board as a real desktop app (Electron). It runs the same local server inside the app and shows it in a window.
// Nothing here talks to the internet.
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path'), fs = require('fs');
const home = require('./home.js');

if (!app.requestSingleInstanceLock()) app.quit();
let win = null, server = null, base = '', HOME = '';
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

async function chooseHome() {
  if (process.env.HQ_HOME) return process.env.HQ_HOME;
  const saved = home.read(); if (saved) return saved;
  const lost = home.raw();                                          // a folder was chosen before, but it can't be found right now
  if (lost) {
    const r = await dialog.showMessageBox({ type: 'warning', title: 'Your data folder is missing', message: `Can't find your data folder:\n${lost}`,
      detail: 'If it is on a USB stick or another drive, plug it in and press Try again. Nothing has been deleted or changed.', buttons: ['Try again', 'Choose another folder…', 'Quit'], defaultId: 0, cancelId: 2 });
    if (r.response === 0) return chooseHome();
    if (r.response === 2) { app.exit(0); return null; }
    const o = await dialog.showOpenDialog({ title: 'Choose the folder that holds your Creator Board data', properties: ['openDirectory', 'createDirectory'] });
    if (o.canceled || !o.filePaths[0]) { app.exit(0); return null; }
    home.write(o.filePaths[0]); return o.filePaths[0];
  }
  const def = path.join(app.getPath('documents'), 'Creator Board');
  const r = await dialog.showMessageBox({ type: 'question', title: 'Welcome to Creator Board', message: 'Where should your data be kept?',
    detail: `Your video list, notes and backups are saved in one folder on this computer. Nothing goes online.\n\nRecommended:\n${def}`, buttons: ['Use the recommended folder', 'Choose another folder…'], defaultId: 0, cancelId: 0 });
  let h = def;
  if (r.response === 1) { const o = await dialog.showOpenDialog({ title: 'Choose a folder for your data', properties: ['openDirectory', 'createDirectory'] }); if (!o.canceled && o.filePaths[0]) h = o.filePaths[0]; }
  fs.mkdirSync(h, { recursive: true }); home.write(h); return h;
}

function buildMenu() {
  const t = [
    { label: 'File', submenu: [
      { label: 'Open my data folder', click: () => shell.openPath(HOME) },
      { label: 'Where is my data?', click: () => dialog.showMessageBox(win, { type: 'info', title: 'Your data', message: 'Your data is saved here:', detail: `${path.join(HOME, 'data', 'hq-data.json')}\n\nBackups:\n${path.join(HOME, 'backups')}` }) },
      { label: 'Change data folder…', click: changeHome },
      { label: 'Back up now', click: () => { try { server.hq.backupNow(); dialog.showMessageBox(win, { type: 'info', message: 'Backup made.' }); } catch (e) { dialog.showErrorBox('Backup failed', String(e)); } } },
      { type: 'separator' }, { role: 'quit', label: 'Quit' } ] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}
async function changeHome() {
  const o = await dialog.showOpenDialog(win, { title: 'Choose the folder for your data', properties: ['openDirectory', 'createDirectory'] });
  if (o.canceled || !o.filePaths[0]) return;
  const nh = o.filePaths[0]; if (path.resolve(nh) === path.resolve(HOME)) return;
  try {
    const nd = path.join(nh, 'data', 'hq-data.json');
    if (!fs.existsSync(nd)) { fs.mkdirSync(path.join(nh, 'data'), { recursive: true }); fs.mkdirSync(path.join(nh, 'backups'), { recursive: true }); fs.copyFileSync(server.hq.dataFile, nd); }
    server.hq.backupNow(); home.write(nh);
    await dialog.showMessageBox(win, { type: 'info', message: 'Data folder changed.', detail: 'The app will restart now. Your old folder was not deleted.' });
    app.relaunch(); app.exit(0);
  } catch (e) { dialog.showErrorBox('Could not change the folder', String(e)); }
}

app.whenReady().then(async () => {
  HOME = await chooseHome(); if (!HOME) return; fs.mkdirSync(HOME, { recursive: true });
  Object.assign(process.env, { HQ_HOME: HOME, HQ_PORT: '0', HQ_NO_OPEN: '1', HQ_EMBEDDED: '1' });
  try {
    server = require('./server.js');
    if (!server.listening) await new Promise((ok, bad) => { server.once('listening', ok); server.once('error', bad); });
  } catch (e) { dialog.showErrorBox('Creator Board could not start', String(e && e.message || e)); app.exit(1); return; }
  base = `http://127.0.0.1:${server.address().port}`;
  buildMenu();
  win = new BrowserWindow({ width: 1340, height: 900, minWidth: 900, minHeight: 600, title: 'Creator Board', icon: path.join(__dirname, 'icon.ico'), backgroundColor: '#f4f5f8', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url) && !url.startsWith(base)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(base)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.on('page-title-updated', (e) => e.preventDefault());
  win.on('closed', () => { win = null; });
  win.loadURL(base);
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { try { if (server && server.hq) server.hq.backupNow(); } catch (e) { /* ignore */ } });
