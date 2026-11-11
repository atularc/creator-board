// Creator Board: where your data lives. Priority: HQ_HOME (set by the app or for tests) > the folder you chose (config.json) > the folder above app/ (dev).
const fs = require('fs'), path = require('path'), os = require('os');
const baseDir = process.platform === 'win32' ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')) : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config');
const cfgDir = path.join(baseDir, 'Creator Board'), cfgFile = path.join(cfgDir, 'config.json');
const legacyFile = path.join(baseDir, 'Hot Explainer HQ', 'config.json');          // the app's earlier name: still read, so nobody loses their data folder setting
const noBom = (t) => (t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t);   // Windows PowerShell can add an invisible UTF-8 marker; ignore it
function raw() { for (const f of [cfgFile, legacyFile]) { try { const h = JSON.parse(noBom(fs.readFileSync(f, 'utf8'))).home; if (h) return h; } catch (e) { /* try the next */ } } return null; }   // what was saved, even if the folder is missing right now
function read() { const h = raw(); return h && fs.existsSync(h) ? h : null; }
function write(home) { fs.mkdirSync(cfgDir, { recursive: true }); fs.writeFileSync(cfgFile, JSON.stringify({ home }, null, 2)); }
function resolve() { return process.env.HQ_HOME || read() || path.join(__dirname, '..'); }
module.exports = { raw, read, write, resolve, cfgFile };
