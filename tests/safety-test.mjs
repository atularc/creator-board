// Creator Board: data-safety disaster tests (run with: npm test).
// They start the real server against TEMPORARY sample data (never your real data) and try to break it:
// damaged, empty and deleted files, accidental mass deletes, stale saves, backup clean-up, the extra backup folder, and more.
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-board-test-'));
const DATA = path.join(T, 'data'), BK = path.join(T, 'backups'), EXTRA = path.join(T, 'extra'), F = path.join(DATA, 'hq-data.json');
const PORT = +process.env.HQ_TEST_PORT || 4195, U = (p) => `http://127.0.0.1:${PORT}${p}`;
const sha = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (name, cond, extra = '') => results.push([cond ? 'PASS' : 'FAIL', name, extra]);

function sampleData(n = 30) {
  const items = Array.from({ length: n }, (_, i) => ({
    id: `t-${i + 1}`, title: `Sample idea ${i + 1}`, kind: i % 5 === 0 ? 'long' : 'short', series: '', number: null, category: 'test', platforms: ['youtube'],
    status: 'idea', plannedDate: '', durationSec: 35, style: '', hook: '', notes: '', sources: '', videoPath: '', perf: {}, checks: {}, createdAt: '2026-01-01',
  }));
  return { meta: { app: 'Creator Board', version: 1, created: '2026-01-01' }, settings: { channelName: 'Test', handle: '', style: '', schedule: { long: [2, 5], short: [0, 1, 2, 3, 4, 5, 6] }, defaults: {}, seriesNames: {}, numberedSeries: [], rules: [] }, snapshots: [], targets: [], items, trash: [] };
}

let proc;
async function start() {
  proc = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, HQ_HOME: T, HQ_PORT: String(PORT), HQ_NO_OPEN: '1', HQ_EDITION: 'fresh' }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch(U('/api/mtime')); return; } catch (e) { await sleep(150); } }
  throw new Error('the server did not start');
}
async function stop() { proc.kill(); await sleep(400); }
const get = async () => (await fetch(U('/api/data'))).json();
const put = async (data, baseMtime, allowShrink) => { const r = await fetch(U('/api/data'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, baseMtime, allowShrink }) }); return { status: r.status, body: await r.json() }; };
const post = (p, body = {}) => fetch(U(p), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const bks = () => fs.readdirSync(BK).filter((f) => f.endsWith('.json'));

try {
  fs.mkdirSync(DATA, { recursive: true }); fs.mkdirSync(EXTRA, { recursive: true });
  fs.writeFileSync(F, JSON.stringify(sampleData(30), null, 2));
  await start();
  let g = await get(), d = g.data; const N = d.items.length;
  ok('1. starts and loads the data', N === 30, `${N} items`);
  ok('2. a backup is made when the app starts', bks().some((f) => f.includes('-on-start')));

  d.items[0].notes += ' edited'; let r = await put(d, g.mtime); ok('3. a normal save works', r.status === 200); let mt = r.body.mtime;
  d = (await get()).data; d.trash.push(d.items.shift()); r = await put(d, mt); ok('4. deleting (move to trash) is allowed', r.status === 200); mt = r.body.mtime;

  d = (await get()).data; const before = sha(F); d.items = d.items.slice(0, 10); r = await put(d, mt);
  ok('5. a save that wipes most items is BLOCKED', r.status === 409 && r.body.error === 'shrink', r.body.message || '');
  ok('5b. the data file was not touched by the blocked save', sha(F) === before);
  r = await put(d, mt, true); ok('6. a confirmed removal is allowed', r.status === 200);
  ok('6b. a "before-removal" backup was made first', bks().some((f) => f.includes('before-removal')));
  const bef = bks().filter((f) => f.includes('before-removal')).sort().pop();
  const rs = await post('/api/restore', { name: bef }); ok('7. restoring a backup works', rs.status === 200 && (await get()).data.items.length >= 25);

  g = await get(); r = await put(g.data, g.mtime - 5000); ok('8. a save based on an old copy is refused', r.status === 409 && r.body.error === 'file changed');

  g = await get(); g.data.settings.testMarker = 'SAVED-JUST-BEFORE'; await put(g.data, g.mtime);
  fs.writeFileSync(F, '{ "items": [ {"id": "x", broken json here'); g = await get();
  ok('9. a damaged file is auto-restored', !!(g.data && g.data.items.length > 0 && g.recovered), String(g.recovered && g.recovered.from));
  ok('9a. recovery loses nothing: the very last save is back', !!(g.data && g.data.settings.testMarker === 'SAVED-JUST-BEFORE'));
  ok('9b. the damaged file was kept, not destroyed', fs.readdirSync(DATA).some((f) => f.startsWith('hq-data.damaged-')));
  fs.writeFileSync(F, ''); g = await get(); ok('10. an EMPTY file is auto-restored', !!(g.data && g.data.items.length > 0));
  await stop(); fs.unlinkSync(F); await start(); g = await get();
  ok('11. a DELETED data file is restored on start (not replaced by an empty one)', g.data.items.length > 10, `${g.data.items.length} items`);

  const day = new Date(Date.now() - 10 * 864e5), p2 = (n) => String(n).padStart(2, '0'), ymd = `${day.getFullYear()}${p2(day.getMonth() + 1)}${p2(day.getDate())}`;
  const fake = []; for (let i = 0; i < 14; i++) fake.push(`hq-data-${ymd}-${p2(8 + i)}0000.json`); fake.push(`hq-data-${ymd}-090000-manual.json`, `hq-data-${ymd}-100000-before-restore.json`);
  fake.forEach((f) => { fs.copyFileSync(F, path.join(BK, f)); const t = new Date(Date.now() - 10 * 864e5); fs.utimesSync(path.join(BK, f), t, t); });
  const recentBefore = bks().filter((f) => !f.includes(ymd)).length; await post('/api/backup-now');
  const left = bks().filter((f) => f.includes(ymd));
  ok('12. old extra autosaves are cleaned but the newest of that day is kept', left.some((f) => f.includes('-210000.json')) && !left.some((f) => f.includes('-080000.json')), `${left.length} of 16 kept`);
  ok('12b. backups made on purpose (manual / before-restore) are never deleted', left.some((f) => f.includes('manual')) && left.some((f) => f.includes('before-restore')));
  ok('12c. recent backups (last 3 days) are all kept', bks().filter((f) => !f.includes(ymd)).length >= recentBefore);

  g = await get(); g.data.settings.extraBackupDir = EXTRA; r = await put(g.data, g.mtime);
  ok('13. the extra backup copy is written after a save', r.status === 200 && r.body.extra.ok && fs.existsSync(path.join(EXTRA, 'hq-data-latest.json')) && fs.readdirSync(EXTRA).length === 2);
  g = await get(); g.data.settings.extraBackupDir = path.join(T, 'no-such-folder'); r = await put(g.data, g.mtime);
  ok('13b. a missing extra folder never blocks saving (it just warns)', r.status === 200 && r.body.extra.ok === false);
  fs.writeFileSync(path.join(BK, 'hq-data-20200101-000000.json'), 'not json'); const rs2 = await post('/api/restore', { name: 'hq-data-20200101-000000.json' });
  ok('14. a damaged backup can not be restored over good data', rs2.status === 404);
  const rs3 = await post('/api/restore', { name: '../../../etc/passwd' }); ok('15. a path-trick restore request is refused', rs3.status === 404);
  ok('16. FOR-CLAUDE.md is saved next to the data file', fs.existsSync(path.join(DATA, 'FOR-CLAUDE.md')));
  g = await get(); const edited = g.data; edited.settings.testMarker = 'EDITED-BY-POWERSHELL'; fs.writeFileSync(F, '﻿' + JSON.stringify(edited, null, 2)); g = await get();
  ok('17. an edit saved with the Windows PowerShell marker is accepted (not "recovered" away)', !g.recovered && g.data.settings.testMarker === 'EDITED-BY-POWERSHELL');
} catch (e) {
  ok('the test run itself finished without crashing', false, String(e && e.message || e));
} finally {
  try { await stop(); } catch (e) { /* ignore */ }
  try { fs.rmSync(T, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}
console.log(results.map((x) => `${x[0]}  ${x[1]}${x[2] ? '  [' + x[2] + ']' : ''}`).join('\n'));
const failed = results.filter((x) => x[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
