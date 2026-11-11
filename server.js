// Creator Board: a tiny local server. No internet, no packages, no cloud.
// Saves everything in <home>/data/hq-data.json (plain text: you and Claude can both edit it) and keeps backups in <home>/backups/.
//   node server.js            normal: opens your browser
//   node server.js --app      desktop-app mode: opens its own window (no browser bars) and stops itself when you close it
//
// DATA SAFETY (the rules this file follows):
//   1. Every save is written to a temp file first, then swapped in, so a crash can never leave half a file.
//   2. A backup of the current data is taken before changes (at most one every 2 minutes), when the app starts, and when it closes.
//   3. Backups are never thrown away at random: everything from the last 3 days is kept, and the newest backup of EVERY older day is kept forever.
//   4. If the data file is missing or damaged, the newest good backup is restored automatically (the damaged file is kept next to it).
//   5. A save that would remove several records is refused, unless the user confirmed it (import).
//   6. A save is refused if the file was changed by someone else since it was loaded.
//   7. Optional: a second copy goes to a folder of your choice (USB, Google Drive...) after every save.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), { exec, spawn } = require('child_process');

const ROOT = __dirname, PUB = path.join(ROOT, 'public'), HOME = require('./home.js').resolve();   // your data + backups live in <HOME>/data and <HOME>/backups
const DATA_DIR = process.env.HQ_DATA_DIR || path.join(HOME, 'data'), BK = process.env.HQ_BACKUP_DIR || path.join(HOME, 'backups');
const DATA = path.join(DATA_DIR, 'hq-data.json'), LASTGOOD = path.join(DATA_DIR, 'hq-data.last-good.json');
const PORT = process.env.HQ_PORT !== undefined ? +process.env.HQ_PORT : 4177;     // HQ_PORT=0 picks a free port (used by the desktop .exe)
const VERSION = (() => { try { return require('./package.json').version; } catch (e) { return ''; } })();
const EMBEDDED = process.env.HQ_EMBEDDED === '1';                                // running inside the Electron app: never exit the process
const LAN = process.env.HQ_LAN === '1';           // HQ_LAN=1 lets your phone on the same Wi-Fi open it (no password, home use only)
const HOST = LAN ? '0.0.0.0' : '127.0.0.1';
const APP = process.argv.includes('--app');
const URL_ = `http://localhost:${PORT}`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

// ---------- the app window (Edge, Chrome or Brave in "app" mode: a real window with no address bar or tabs)
function findBrowser() {
  const e = process.env, w = process.platform === 'win32';
  const list = w ? [
    `${e['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`, `${e.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${e.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`, `${e['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`, `${e.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    `${e.ProgramFiles}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`, `${e.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ] : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  return list.find((p) => p && fs.existsSync(p)) || null;
}
function openWindow(owner) {
  const b = findBrowser();
  if (!b) { exec(process.platform === 'win32' ? `start "" "${URL_}"` : process.platform === 'darwin' ? `open "${URL_}"` : `xdg-open "${URL_}"`); return null; }
  const profile = path.join(os.homedir(), '.creator-board-window');
  const child = spawn(b, [`--app=${URL_}`, `--user-data-dir=${profile}`, '--window-size=1340,900', '--no-first-run', '--no-default-browser-check', '--disable-sync'], { stdio: 'ignore', detached: !owner });
  if (!owner) { child.unref(); return child; }
  const t0 = Date.now();
  child.on('exit', () => { if (Date.now() - t0 > 5000) { console.log('Window closed. Stopping Creator Board.'); shutdown(); } });   // a quick exit means the window handed over to another process: the heartbeat below handles that case
  return child;
}

// ---------- backups
fs.mkdirSync(DATA_DIR, { recursive: true }); fs.mkdirSync(BK, { recursive: true });
const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
const noBom = (t) => (t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t);   // tolerates the invisible UTF-8 marker that Windows PowerShell adds
const validJson = (f) => { try { const d = JSON.parse(noBom(fs.readFileSync(f, 'utf8'))); return d && Array.isArray(d.items) ? d : null; } catch (e) { return null; } };   // tolerates the invisible UTF-8 marker that Windows PowerShell adds
const sha = (f) => { try { return crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex'); } catch (e) { return ''; } };
const listBackups = () => fs.readdirSync(BK).filter((f) => /^hq-data-.*\.json$/.test(f)).sort();
function newestValidBackup() { for (const f of listBackups().reverse()) if (validJson(path.join(BK, f))) return f; return null; }
const PRECIOUS = /-(manual|before-[a-z-]+|claude)\.json$/;      // backups made on purpose are never pruned
function prune() {
  try {
    const now = Date.now(), perDay = {};
    listBackups().forEach((f) => { const m = f.match(/^hq-data-(\d{8})-/); if (!m || PRECIOUS.test(f)) return; if (now - fs.statSync(path.join(BK, f)).mtimeMs <= 3 * 864e5) return; (perDay[m[1]] = perDay[m[1]] || []).push(f); });
    Object.values(perDay).forEach((l) => { l.sort(); l.slice(0, -1).forEach((f) => fs.unlinkSync(path.join(BK, f))); });     // older than 3 days: keep only the newest of each day
  } catch (e) { /* never block saving because of cleanup */ }
}
let lastBackup = 0;
function backup(force = false, tag = '') {
  if (!fs.existsSync(DATA) || !validJson(DATA)) return;          // never "back up" a damaged file over good backups
  if (!force && Date.now() - lastBackup < 120000) return;        // at most one automatic backup every 2 minutes
  fs.copyFileSync(DATA, path.join(BK, `hq-data-${stamp()}${tag}.json`)); lastBackup = Date.now(); prune();
}
function markGood() { try { if (validJson(DATA)) fs.copyFileSync(DATA, LASTGOOD); } catch (e) { /* ignore */ } }      // a copy of the last file that was verified good
function writeData(obj) { const tmp = DATA + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(obj, null, 2)); fs.renameSync(tmp, DATA); markGood(); }
function copyExtra(obj) {                                         // optional second copy (USB, Google Drive...)
  const dir = obj && obj.settings && obj.settings.extraBackupDir; if (!dir) return { ok: true, skipped: true };
  try {
    if (!fs.existsSync(dir)) return { ok: false, error: 'Folder not found: ' + dir };
    const s = JSON.stringify(obj, null, 2), d = new Date(), p = (n) => String(n).padStart(2, '0');
    fs.writeFileSync(path.join(dir, 'hq-data-latest.json'), s); fs.writeFileSync(path.join(dir, `hq-data-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`), s);
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// ---------- start-up checks: missing or damaged data is restored from the newest good backup, never replaced by an empty file
let damaged = false, lastRecovery = null;
function recover(why) {
  const c = []; if (validJson(LASTGOOD)) c.push({ f: LASTGOOD, name: 'the last good copy' }); const nb = newestValidBackup(); if (nb) c.push({ f: path.join(BK, nb), name: nb });
  c.sort((a, b) => fs.statSync(b.f).mtimeMs - fs.statSync(a.f).mtimeMs); const best = c[0]; if (!best) return false;   // the newest of: the last good copy, the newest backup
  if (fs.existsSync(DATA)) { try { fs.copyFileSync(DATA, path.join(DATA_DIR, `hq-data.damaged-${stamp()}.json`)); } catch (e) { /* ignore */ } }
  fs.copyFileSync(best.f, DATA); lastRecovery = { from: best.name, why, at: Date.now() };
  console.log(`Recovered your data from ${best.name} (${why}).`); return true;
}
if (!fs.existsSync(DATA)) {
  if (!recover('The data file was missing')) {
    const fresh = process.env.HQ_EDITION === 'fresh' || !fs.existsSync(path.join(__dirname, 'seed.js'));
    fs.writeFileSync(DATA, JSON.stringify(require(fresh ? './seed-fresh.js' : './seed.js')(), null, 2)); console.log('Created the starting data file' + (fresh ? ' (empty)' : '') + '.');
  }
} else if (!validJson(DATA)) { if (!recover('The data file was damaged')) { damaged = true; console.error('The data file is damaged and there is no backup. Nothing was changed.'); } }
else { const nb = newestValidBackup(); if (!nb || sha(DATA) !== sha(path.join(BK, nb))) backup(true, '-on-start'); markGood(); }   // keeps anything changed outside the app (for example by Claude)
try { const g = path.join(__dirname, 'FOR-CLAUDE.md'); if (fs.existsSync(g)) fs.writeFileSync(path.join(DATA_DIR, 'FOR-CLAUDE.md'), fs.readFileSync(g)); } catch (e) { /* not important */ }

const mtime = () => fs.statSync(DATA).mtimeMs;
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((ok, bad) => { let s = ''; req.on('data', (c) => { s += c; if (s.length > 8e6) { bad(new Error('too big')); req.destroy(); } }); req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { bad(e); } }); });
async function readData() {
  let d = validJson(DATA);
  if (!d) { await new Promise((r) => setTimeout(r, 700)); d = validJson(DATA); }       // someone may be in the middle of writing the file: look again before judging
  if (!d) { if (!recover('The data file was damaged')) throw new Error('The data file is damaged and there is no backup to restore. Nothing was overwritten.'); d = validJson(DATA); } else markGood();
  return d;
}

let lastPing = 0;
const server = http.createServer(async (req, res) => {
  try {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/api/ping') { lastPing = Date.now(); return json(res, 200, { ok: true }); }
    if (u === '/api/data' && req.method === 'GET') { const data = await readData(); const rec = lastRecovery; lastRecovery = null; return json(res, 200, { data, mtime: mtime(), recovered: rec }); }
    if (u === '/api/mtime') return json(res, 200, { mtime: mtime() });
    if (u === '/api/info') return json(res, 200, { app: 'hot-explainer-hq', version: VERSION, dataFile: DATA, backupFolder: BK, lan: LAN, port: PORT });
    if (u === '/api/data' && req.method === 'PUT') {
      const { data, baseMtime, allowShrink } = await body(req);
      if (!data || !Array.isArray(data.items)) return json(res, 400, { error: 'bad data' });
      if (damaged) return json(res, 500, { error: 'The data file is damaged and there is no backup. Nothing was overwritten.' });
      if (Math.abs(mtime() - baseMtime) > 1) return json(res, 409, { error: 'file changed', mtime: mtime() });
      const old = validJson(DATA);
      if (old) {
        const o = old.items.length + (old.trash || []).length, n = data.items.length + (data.trash || []).length, loss = o - n;
        if (loss > 0) { if (!allowShrink && loss >= 2 && loss >= o * 0.1) return json(res, 409, { error: 'shrink', message: `Saving was blocked: it would remove ${loss} of your ${o} saved items.`, mtime: mtime() }); backup(true, '-before-removal'); }
      }
      backup(); writeData(data); return json(res, 200, { mtime: mtime(), extra: copyExtra(data) });
    }
    if (u === '/api/extra-now' && req.method === 'POST') { const d = validJson(DATA); return json(res, 200, { extra: d ? copyExtra(d) : { ok: false, error: 'no data' } }); }
    if (u === '/api/backups') return json(res, 200, listBackups().reverse().slice(0, 60).map((f) => ({ name: f, kb: Math.round(fs.statSync(path.join(BK, f)).size / 1024) })));
    if (u === '/api/restore' && req.method === 'POST') {
      const { name } = await body(req); const f = path.join(BK, path.basename(name || ''));
      if (!fs.existsSync(f) || !validJson(f)) return json(res, 404, { error: 'no such backup' });
      backup(true, '-before-restore'); fs.copyFileSync(f, DATA); return json(res, 200, { mtime: mtime() });
    }
    if (u === '/api/backup-now' && req.method === 'POST') { backup(true, '-manual'); return json(res, 200, { ok: true }); }
    const f = path.join(PUB, u === '/' ? 'index.html' : u);
    if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
  } catch (e) { json(res, 500, { error: String(e.message || e) }); }
});
module.exports = server; server.hq = { backupNow: () => backup(true, '-on-close'), home: HOME, dataFile: DATA, backupDir: BK };
function shutdown() { try { backup(true, '-on-close'); } catch (e) { /* ignore */ } server.close(); setTimeout(() => process.exit(0), 300); }

server.on('error', async (e) => {
  if (EMBEDDED) { console.error(e); return; }
  if (e.code !== 'EADDRINUSE') { console.error(e); process.exit(1); }
  let mine = false; try { mine = (await (await fetch(`http://127.0.0.1:${PORT}/api/info`)).json()).app === 'hot-explainer-hq'; } catch (x) { /* not ours */ }
  if (mine) { console.log('Creator Board is already running: opening it.'); if (APP) openWindow(false); else exec(process.platform === 'win32' ? `start "" "${URL_}"` : `open "${URL_}"`); setTimeout(() => process.exit(0), 800); }
  else { console.error(`Port ${PORT} is used by another program. Set HQ_PORT=4190 and try again.`); process.exit(1); }
});
server.listen(PORT, HOST, () => {
  console.log(`\n  Creator Board is running.\n  Open:  ${URL_}\n  Data:  ${DATA}\n  Backups: ${BK}\n`);
  if (LAN) console.log('  !! LAN mode is ON: anyone on your Wi-Fi can open and change this. Use it at home only.\n');
  if (process.env.HQ_NO_OPEN) return;
  if (APP) {
    openWindow(true);
    lastPing = Date.now();
    setInterval(() => { if (Date.now() - lastPing > 180000) { console.log('No window for 3 minutes. Stopping Creator Board.'); shutdown(); } }, 15000);   // the window pings every 15 s
  } else { exec(process.platform === 'win32' ? `start "" "${URL_}"` : process.platform === 'darwin' ? `open "${URL_}"` : `xdg-open "${URL_}"`); }
});
