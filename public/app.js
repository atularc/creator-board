// Creator Board: plain JavaScript, no libraries, no internet.
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const PLATS = ['youtube', 'instagram', 'facebook'];
const PNAME = { youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook' };
const PCOL = { youtube: '#ef4444', instagram: '#c13584', facebook: '#1877f2' };
const KIND = { long: 'Long video', short: 'Short' };
const CAT_HINTS = ['science', 'history', 'tech', 'money', 'health', 'animals', 'lifestyle', 'other'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CHECKS = [['watched', 'I watched the whole video'], ['honestTitle', 'Title is honest'], ['sources', 'Sources are in the description'], ['aiLabel', 'AI label ticked only if it looks realistic'], ['kids', '"Made for kids" set honestly']];
const COLS = [['idea', 'To make', 'var(--idea)'], ['ready', 'Ready to post', 'var(--ready)'], ['posted', 'Posted', 'var(--done)']];

const S = { data: null, mtime: 0, typing: false, tab: 'home', week: 0, ver: 0, dirty: false, saving: false, modalOpen: false, kind: '', q: '', showAll: {}, conflict: null, undoData: null, editing: null };

// ---------- helpers
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const ds = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ds(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ds(d); };
const nice = (s) => (s ? parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');
const dayName = (s) => parse(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmt = (n) => (n == null || n === '' ? '–' : Number(n).toLocaleString('en-GB'));
const dur = (s) => (!s ? '' : s >= 120 ? `${Math.round(s / 60)} min` : `${s} sec`);
const num = (v) => (v === '' || v == null ? null : Number.isFinite(+v) ? +v : null);
const uid = () => 'i-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const items = () => S.data.items;
const settings = () => S.data.settings;
const slug = (t) => String(t || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const seriesName = (id) => (id ? ((settings().seriesNames || {})[id] || id) : '');
const seriesId = (text) => { const t = String(text || '').trim(); if (!t) return ''; const hit = Object.entries(settings().seriesNames || {}).find(([, n]) => n.toLowerCase() === t.toLowerCase()); return hit ? hit[0] : slug(t); };
const dflt = (p) => { const d = settings().defaults || {}, x = (p === 'youtube' ? d.youtube : d.other) || {}; return { kind: x.kind || (p === 'youtube' ? 'long' : 'short'), series: x.series || '', category: x.category || '', durationSec: x.durationSec ?? (p === 'youtube' ? 540 : 35), platforms: x.platforms || [p] }; };
const getItem = (id) => items().find((i) => i.id === id);
const perf = (it, p) => (it.perf && it.perf[p]) || null;
const isPosted = (it, p) => !!(perf(it, p) && perf(it, p).posted);
const allPosted = (it) => it.platforms.length > 0 && it.platforms.every((p) => isPosted(it, p));
const made = (it) => ['made', 'ready', 'posted'].includes(it.status);
const stage = (it, p) => (isPosted(it, p) ? 'posted' : made(it) ? 'ready' : 'idea');
const titleOf = (it, p) => (it.number && p !== 'youtube' ? `<span class="num">#${it.number}</span>` : '') + esc(it.title);
const dots = (it) => it.platforms.map((p) => `<span class="dot d-${p}" title="${PNAME[p]}" style="${isPosted(it, p) ? '' : 'opacity:.4'}"></span>`).join('');
const byDate = (a, b) => (a.plannedDate || '9').localeCompare(b.plannedDate || '9');
function toast(msg, undo) { const t = $('#toast'); t.innerHTML = esc(msg) + (undo ? ' <button data-act="undo">Undo</button>' : ''); t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), undo ? 7000 : 2400); }
const snap = () => { S.undoData = JSON.stringify(S.data); };

// ---------- saving (automatic, with a file-changed guard)
function setState(msg) { const e = $('#savestate'); if (e) e.textContent = msg; S.state = msg; }
function touch() { S.dirty = true; S.ver++; setState('Saving…'); clearTimeout(touch.t); touch.t = setTimeout(flush, 350); }
async function flush() {
  if (S.saving) { touch.t = setTimeout(flush, 300); return; }
  S.saving = true; const v = S.ver;
  try {
    const r = await fetch('/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: S.data, baseMtime: S.mtime, allowShrink: !!S.allowShrink }) });
    const j = await r.json();
    if (r.status === 409 && j.error === 'shrink') { S.blocked = j.message; setState('Save blocked'); showBanner(); }
    else if (r.status === 409) { S.conflict = j.mtime; setState('File changed'); showBanner(); }
    else if (!r.ok) setState('Not saved: ' + (j.error || r.status));
    else { S.mtime = j.mtime; S.allowShrink = false; S.blocked = null; if (j.extra && j.extra.ok === false) toast('The extra backup copy failed: ' + j.extra.error); if (S.ver === v) { S.dirty = false; setState('Saved ✓'); } else touch(); }
  } catch (e) { setState('Not saved (server stopped?)'); }
  S.saving = false;
}
function showBanner() {
  const b = $('#banner');
  if (S.blocked) { b.hidden = false; b.innerHTML = `<b>${esc(S.blocked)}</b> Your saved file has NOT been changed. <button class="btn sm" data-act="loadfile">Reload from the file</button> <button class="btn sm" data-act="forcesave">Save anyway…</button>`; return; }
  if (S.notice) { b.hidden = false; b.innerHTML = `<b>${esc(S.notice)}</b> <button class="btn sm" data-act="dismiss">OK</button>`; return; }
  if (!S.conflict) { b.hidden = true; return; }
  b.hidden = false; b.innerHTML = `<b>The data file was changed outside this window (maybe by Claude).</b> <button class="btn sm" data-act="loadfile">Use the file version</button> <button class="btn sm" data-act="keepmine">Keep what I see</button>`;
}
function normalise() { const d = S.data; d.items.forEach((i) => { i.perf = i.perf || {}; i.checks = i.checks || {}; i.platforms = i.platforms || []; }); d.trash = d.trash || []; d.snapshots = d.snapshots || []; d.targets = d.targets || []; d.settings = d.settings || { rules: [], schedule: { long: [2, 5], short: [0, 1, 2, 3, 4, 5, 6] } }; d.settings.seriesNames = d.settings.seriesNames || {}; d.settings.numberedSeries = d.settings.numberedSeries || []; d.settings.defaults = d.settings.defaults || {}; d.settings.rules = d.settings.rules || []; }
async function load(fromFile) {
  const j = await (await fetch('/api/data')).json();
  if (!j.data) throw new Error(j.error || 'Could not read the data file');
  S.data = j.data; S.mtime = j.mtime; S.dirty = false; S.conflict = null; S.blocked = null; normalise();
  if (j.recovered) S.notice = `${j.recovered.why}, so your newest backup (${j.recovered.from}) was restored. The damaged file was kept in your data folder.`;
  showBanner(); render(); setState('Saved ✓');
  if (fromFile) toast('Updated from the data file');
}
setInterval(async () => {
  try {
    const j = await (await fetch('/api/mtime')).json();
    if (Math.abs(j.mtime - S.mtime) <= 1 || S.saving) return;
    if (!S.dirty && !S.modalOpen && !S.typing) load(true); else { S.conflict = j.mtime; showBanner(); }
  } catch (e) { /* server stopped */ }
}, 4000);
setInterval(() => fetch('/api/ping').catch(() => {}), 15000);

// ---------- shell
function counts(p) {
  const all = items().filter((i) => i.platforms.includes(p));
  return { posted: all.filter((i) => stage(i, p) === 'posted').length, ready: all.filter((i) => stage(i, p) === 'ready').length, ideas: all.filter((i) => stage(i, p) === 'idea').length, views: all.reduce((a, i) => a + (perf(i, p)?.views || 0), 0) };
}
function side() {
  const nav = (k, label, extra = '') => `<button class="nav ${S.tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${extra}${label}</button>`;
  const pl = (p) => { const c = counts(p); return nav(p, PNAME[p], `<span class="d" style="background:${PCOL[p]}"></span>`).replace('</button>', `<span class="n">${c.ready ? c.ready + ' ready' : ''}</span></button>`); };
  const dn = () => { const due = S.data.settings.lastDaily !== today(); return nav('daily', 'Daily update').replace('</button>', due ? '<span class="n" style="color:var(--accent)">● due</span></button>' : '<span class="n">✓ done</span></button>'); };
  $('#side').innerHTML = `<div class="brand"><img src="icon.png" alt=""><div><b>${esc(S.data.settings.channelName || 'My channel')}</b><small>Creator Board</small></div></div>
    ${nav('home', 'Home')}${PLATS.map(pl).join('')}${nav('calendar', 'Calendar')}${dn()}
    <div class="sep">More</div>${nav('progress', 'Progress')}${nav('backups', 'Backups')}${nav('help', 'Help')}
    <div class="sidefoot"><span id="savestate">${esc(S.state || 'Loading…')}</span><button data-act="theme">${document.documentElement.dataset.theme === 'dark' ? '☀ Light' : '☾ Dark'}</button></div>`;
}
function render() {
  if (!S.data) return; side(); const v = S.tab;
  $('#app').innerHTML = v === 'home' ? vHome() : PLATS.includes(v) ? vPlatform(v) : v === 'calendar' ? vCalendar() : v === 'daily' ? vDaily() : v === 'progress' ? vProgress() : v === 'help' ? vHelp() : vBackups();
  if (v === 'backups') loadBackups();
  if (v === 'help') loadHelp();
}

// ---------- HOME
function vWelcome() {
  return `<h1>Welcome</h1><p class="lead">This is your planning board. Everything stays on this computer.</p>
  <div class="card"><h2>Start in 3 steps</h2>
    <ol style="line-height:2;padding-left:20px;margin:10px 0 14px"><li>Add your first idea. Pick the platform page you use, then press <b>+ Add</b>.</li>
    <li>Drag the card across the board: <b>To make → Ready to post → Posted</b>.</li>
    <li>Once a day, open <b>Daily update</b> and type your numbers.</li></ol>
    <button class="btn pri" data-act="new" data-p="youtube">+ Add my first idea</button> <button class="btn" data-act="tab" data-v="progress">Set my channel name</button></div>
  <div class="card"><h2>Let Claude help</h2><p class="mini" style="margin:6px 0 0">If you use Claude on this computer, tell it: "Read FOR-CLAUDE.md in my Creator Board data folder and keep it updated." Choose <b>File &gt; Open my data folder</b> (installed app) to find it.</p></div>`;
}
function snapLatest(p) { const s = [...S.data.snapshots].sort((a, b) => a.date.localeCompare(b.date)); for (let i = s.length - 1; i >= 0; i--) if (s[i][p] != null) return s[i][p]; return null; }
function vHome() {
  const t = today(), week = addDays(t, 7);
  if (!items().length) return vWelcome();
  const due = items().filter((i) => i.plannedDate && i.plannedDate <= t && !allPosted(i)).sort(byDate);
  const soon = items().filter((i) => i.plannedDate && i.plannedDate > t && i.plannedDate <= week && !allPosted(i)).sort(byDate);
  const next = items().filter((i) => !made(i) && !allPosted(i)).sort(byDate).slice(0, 6);
  const tiles = PLATS.map((p) => { const c = counts(p); return `<button class="tile" style="--c:${PCOL[p]}" data-act="tab" data-v="${p}"><b>${PNAME[p]}</b><div class="big">${fmt(snapLatest(p))}</div><div class="mini">${p === 'youtube' ? 'subscribers' : 'followers'}</div><div class="mini" style="margin-top:8px">${c.posted} posted · ${c.ready} ready · ${c.ideas} to make</div></button>`; }).join('');
  const dueRows = due.map((i) => {
    const left = i.platforms.filter((p) => !isPosted(i, p)), late = i.plannedDate < t;
    return `<div class="row"><div class="t" data-act="edit" data-id="${i.id}">${dots(i)}${titleOf(i)}<div class="chips"><span class="chip">${KIND[i.kind]}</span>${late ? `<span class="chip warn late">was due ${nice(i.plannedDate)}</span>` : ''}${made(i) ? '' : '<span class="chip warn">Not made yet</span>'}</div></div>
      ${made(i) ? left.map((p) => `<button class="btn sm ok" data-act="posted" data-id="${i.id}" data-p="${p}">✓ Posted on ${PNAME[p]}</button>`).join('') : `<button class="btn sm" data-act="made" data-id="${i.id}">Mark as made</button>`}</div>`;
  }).join('');
  return `<h1>Home</h1><p class="lead">${parse(t).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
  <div class="tiles">${tiles}</div>${S.data.settings.lastDaily !== t ? `<div class="card nudge"><b>Daily update</b><span class="mini">Your numbers have not been updated today. It takes about a minute.</span><span class="sp"></span><button class="btn sm pri" data-act="tab" data-v="daily">Update numbers</button></div>` : ''}
  <div class="card"><div class="head"><h2>Post today</h2><span class="sp"></span><button class="btn sm ghost" data-act="autoplan">⚡ Auto-plan dates</button></div>
    ${due.length ? dueRows : `<div class="empty">Nothing planned for today.<br><button class="btn sm" style="margin-top:10px" data-act="autoplan">⚡ Plan the next ideas onto the calendar</button></div>`}</div>
  <div class="cols" style="margin-top:16px">
    <div class="card"><div class="head"><h2>Coming up (next 7 days)</h2></div>${soon.length ? soon.map((i) => `<div class="row"><span class="when">${dayName(i.plannedDate)}</span><div class="t" data-act="edit" data-id="${i.id}">${dots(i)}${titleOf(i)}</div></div>`).join('') : '<div class="empty">Nothing yet.</div>'}</div>
    <div class="card"><div class="head"><h2>Make next</h2></div>${next.length ? next.map((i) => `<div class="row"><div class="t" data-act="edit" data-id="${i.id}">${dots(i)}${titleOf(i)}</div><span class="chip">${KIND[i.kind]}</span></div>`).join('') : '<div class="empty">Nothing left to make. Add new ideas on a platform page.</div>'}</div>
  </div>`;
}

// ---------- PLATFORM BOARD
function boardList(p) {
  let l = items().filter((i) => i.platforms.includes(p));
  if (S.kind) l = l.filter((i) => i.kind === S.kind);
  if (S.q) { const q = S.q.toLowerCase(); l = l.filter((i) => (i.title + ' ' + i.notes + ' ' + i.category).toLowerCase().includes(q)); }
  return l;
}
function card(i, p, st) {
  const pf = perf(i, p) || {};
  const meta = [KIND[i.kind], dur(i.durationSec)].filter(Boolean);
  if (st === 'posted') meta.push('Posted ' + nice(pf.date), fmt(pf.views) + ' views'); else if (i.plannedDate) meta.push('Planned ' + nice(i.plannedDate));
  const act = st === 'idea' ? `<button class="btn sm" data-act="made" data-id="${i.id}">Mark as made</button>` : st === 'ready' ? `<button class="btn sm ok" data-act="posted" data-id="${i.id}" data-p="${p}">✓ Posted</button>` : (pf.url ? `<a class="mini" href="${esc(pf.url)}" target="_blank" rel="noopener" data-stop>Open link ↗</a>` : '');
  return `<div class="kc" draggable="true" data-drag="${i.id}" data-act="edit" data-id="${i.id}"><div class="kt">${titleOf(i, p)}</div><div class="km">${esc(meta.join(' · '))}</div>${act ? `<div class="ka" data-stop>${act}</div>` : ''}</div>`;
}
function board(p) {
  const l = boardList(p);
  return COLS.map(([k, name, col]) => {
    let list = l.filter((i) => stage(i, p) === k);
    list = k === 'posted' ? list.sort((a, b) => (perf(b, p)?.date || '').localeCompare(perf(a, p)?.date || '')) : list.sort(byDate);
    const key = p + k, lim = k === 'posted' ? 8 : 8, show = S.showAll[key] ? list : list.slice(0, lim);
    return `<div class="col" data-stage="${k}" style="--c:${col}"><h3><span class="bar"></span>${name}<span class="cnt">${list.length}</span></h3>${show.map((i) => card(i, p, k)).join('') || '<div class="empty mini">Nothing here</div>'}${list.length > lim ? `<button class="btn sm ghost more" data-act="more" data-k="${key}">${S.showAll[key] ? 'Show fewer' : 'Show all ' + list.length}</button>` : ''}</div>`;
  }).join('');
}
function vPlatform(p) {
  const c = counts(p);
  return `<h1>${PNAME[p]}</h1><p class="lead">${c.posted} posted · ${fmt(c.views)} total views · ${c.ready} ready to post · ${c.ideas} still to make</p>
  <div class="tools"><button class="btn pri" data-act="new" data-p="${p}">+ Add</button>
    <div class="seg">${[['', 'All'], ['long', 'Long videos'], ['short', 'Shorts']].map(([v, l]) => `<button class="${S.kind === v ? 'on' : ''}" data-act="kind" data-v="${v}">${l}</button>`).join('')}</div>
    <input data-q placeholder="Search…" value="${esc(S.q)}" style="width:200px"><span class="sp"></span></div>
  <div class="board" id="board">${board(p)}</div>`;
}

// ---------- CALENDAR
function weekStart(off) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7); return ds(d); }
function vCalendar() {
  const start = weekStart(S.week), t = today(); let h = '<div class="week">';
  for (let k = 0; k < 7; k++) {
    const d = addDays(start, k), plan = items().filter((i) => i.plannedDate === d && !allPosted(i)), done = items().filter((i) => i.platforms.some((p) => perf(i, p)?.posted && perf(i, p).date === d));
    h += `<div class="day ${d === t ? 'today' : ''}"><h4>${DOW[parse(d).getDay()]} ${nice(d)}</h4>${plan.map((i) => `<span class="ev ${i.kind}" data-act="edit" data-id="${i.id}">${dots(i)}${i.number ? '#' + i.number + ' ' : ''}${esc(i.title)}</span>`).join('')}${done.map((i) => `<span class="ev done" data-act="edit" data-id="${i.id}">✓ ${esc(i.title)}</span>`).join('')}</div>`;
  }
  return `<h1>Calendar</h1><p class="lead">Week of ${nice(start)}. Orange = long video, purple = short, green = posted.</p>
  <div class="tools"><button class="btn" data-act="wk" data-v="-1">← Previous</button><button class="btn" data-act="wk" data-v="0">This week</button><button class="btn" data-act="wk" data-v="1">Next →</button><span class="sp"></span><button class="btn pri" data-act="autoplan">⚡ Auto-plan dates</button></div>${h}</div>
  <p class="mini" style="margin-top:14px">Auto-plan puts long videos on Tue + Fri and one short per day, starting today. It only fills empty days and never moves an item that already has a date.</p>`;
}
function nextNumber(series) { return Math.max(0, ...items().filter((i) => i.series === series).map((i) => i.number || 0)) + 1; }
function autoPlan() {
  snap(); const sch = S.data.settings.schedule, used = new Set(); let placed = 0;
  items().forEach((i) => { if (i.plannedDate) i.platforms.forEach((p) => used.add(`${p}|${i.kind}|${i.plannedDate}`)); });
  items().filter((i) => !i.plannedDate && !allPosted(i)).forEach((i) => {
    const days = sch[i.kind] || [0, 1, 2, 3, 4, 5, 6]; let d = today();
    for (let n = 0; n < 400; n++, d = addDays(d, 1)) {
      if (!days.includes(parse(d).getDay()) || i.platforms.some((p) => used.has(`${p}|${i.kind}|${d}`))) continue;
      i.plannedDate = d; i.platforms.forEach((p) => used.add(`${p}|${i.kind}|${d}`)); placed++; break;
    }
  });
  (settings().numberedSeries || []).forEach((sr) => { let nx = nextNumber(sr); items().filter((i) => i.series === sr && !i.number && i.plannedDate && !allPosted(i)).sort(byDate).forEach((i) => { i.number = nx++; }); });
  touch(); render(); toast(placed ? `Planned ${placed} item(s) onto the calendar` : 'Everything already has a date', !!placed);
}

// ---------- PROGRESS
function chart() {
  const s = [...S.data.snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (s.length < 2) return '<div class="empty">Add your follower numbers once a week. The chart shows up after two entries.</div>';
  const W = 560, H = 200, L = 36, B = 26, max = Math.max(...s.flatMap((x) => PLATS.map((p) => x[p] || 0)), 10), X = (i) => L + (i * (W - L - 12)) / (s.length - 1), Y = (v) => H - B - (v / max) * (H - B - 12);
  const lines = PLATS.map((p) => { const pts = s.map((x, i) => (x[p] != null ? `${X(i)},${Y(x[p])}` : null)).filter(Boolean); return pts.length > 1 ? `<polyline fill="none" stroke="${PCOL[p]}" stroke-width="3" points="${pts.join(' ')}"/>` + s.map((x, i) => (x[p] != null ? `<circle cx="${X(i)}" cy="${Y(x[p])}" r="4" fill="${PCOL[p]}"/>` : '')).join('') : ''; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%"><line x1="${L}" y1="${H - B}" x2="${W - 6}" y2="${H - B}" stroke="currentColor" opacity=".2"/><text x="2" y="14">${max}</text><text x="2" y="${H - B}">0</text>${lines}${s.map((x, i) => `<text x="${X(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === s.length - 1 ? 'end' : 'middle'}">${nice(x.date)}</text>`).join('')}</svg>
  <div class="mini">${PLATS.map((p) => `<span class="dot d-${p}"></span>${PNAME[p]}`).join(' &nbsp; ')}</div>`;
}
function vProgress() {
  return `<h1>Progress</h1><p class="lead">Followers and the 30-day check. Judge after 30 days, not before.</p>
  <div class="card"><div class="head"><h2>Followers over time</h2></div>${chart()}
    <form data-form="snap" class="tools" style="margin:14px 0 0"><input type="date" name="date" value="${today()}"><input type="number" name="youtube" placeholder="YouTube" style="width:110px"><input type="number" name="instagram" placeholder="Instagram" style="width:110px"><input type="number" name="facebook" placeholder="Facebook" style="width:110px"><button class="btn pri">Add today's numbers</button></form></div>
  <div class="card"><div class="head"><h2>30-day targets</h2></div>${S.data.targets.map((x) => `<div class="target"><b>${esc(x.name)}</b> <span class="mini">· target: ${esc(x.target)}</span><input data-target="${x.id}" value="${esc(x.current)}" placeholder="Where are we now?"></div>`).join('') || '<div class="empty">No targets.</div>'}</div>
  <div class="card"><div class="head"><h2>Your channel</h2></div><div class="three"><div class="fld"><label>Channel name</label><input data-setting="channelName" value="${esc(settings().channelName || '')}"></div><div class="fld"><label>Handle</label><input data-setting="handle" value="${esc(settings().handle || '')}" placeholder="@yourchannel"></div><div class="fld"><label>Your look / style</label><input data-setting="style" value="${esc(settings().style || '')}"></div></div>
    <div class="fld"><label>Your rules (one per line)</label><textarea data-rules rows="5">${esc((settings().rules || []).join('\n'))}</textarea></div></div>`;
}


// ---------- HELP (everything a new user needs, inside the app)
const CLAUDE_PROMPT = 'Read FOR-CLAUDE.md in my Creator Board data folder and keep my Creator Board updated whenever we plan, make or post a video. Tell me in one line what you changed.';
function vHelp() {
  return `<h1>Help</h1><p class="lead">Everything you need, in one place.</p>
  <div class="card"><div class="head"><h2>Four things to do</h2></div><ol style="line-height:2;margin:0;padding-left:20px">
    <li><b>Add ideas.</b> Open YouTube, Instagram or Facebook and press <b>+ Add</b>.</li>
    <li><b>Drag the card</b> across the board: <b>To make → Ready to post → Posted</b>. Click a card to edit it, add the link and your notes.</li>
    <li><b>Plan the week.</b> Calendar > <b>⚡ Auto-plan</b> puts your ideas on free days.</li>
    <li><b>Once a day,</b> open <b>Daily update</b> and type your followers, views, likes and comments.</li></ol></div>
  <div class="card"><div class="head"><h2>Where is my data?</h2></div>
    <p class="mini" id="helpPaths" style="margin:0 0 8px">Loading…</p>
    <p style="margin:0">It is one plain file on <b>this computer</b>. Nothing is uploaded and nothing goes online. In the installed app: <b>File &gt; Open my data folder</b>. To move it: <b>File &gt; Change data folder…</b>. Uninstalling never deletes your data.</p></div>
  <div class="card"><div class="head"><h2>How your data is kept safe</h2></div><ul style="margin:0;padding-left:20px;line-height:1.8">
    <li>Everything saves by itself, with a backup before changes, when the app opens and when it closes.</li>
    <li>Backups are never deleted at random. The last 3 days are all kept, and the newest backup of every older day is kept forever.</li>
    <li>A damaged or missing data file is restored automatically.</li>
    <li>Deleting only moves an item to <b>Backups &gt; Deleted items</b>. Every action has an <b>Undo</b> for a few seconds.</li>
    <li>Tip: on the <b>Backups</b> page, add an <b>Extra backup copy</b> folder (a USB stick or Google Drive folder).</li></ul></div>
  <div class="card"><div class="head"><h2>Let Claude update it for you (optional)</h2></div>
    <p class="mini" style="margin:0 0 10px">Your data is a plain file, so Claude on your computer can edit it. Copy this and give it to Claude:</p>
    <div class="fld"><textarea readonly rows="3">${esc(CLAUDE_PROMPT)}</textarea></div><button class="btn" data-act="copyprompt">Copy</button></div>
  <div class="card"><div class="head"><h2>About</h2></div>
    <p style="margin:0"><b>Creator Board</b> <span class="mini" id="helpVer"></span><br>Free to use. No account, no tracking, no internet needed. Made by <b>The Hot Explainer</b>.<br>Need a custom app for your business? Message the maker.</p></div>`;
}
async function loadHelp() {
  try { const i = await (await fetch('/api/info')).json(), a = $('#helpPaths'), v = $('#helpVer'); if (a) a.innerHTML = `Your data file: <b>${esc(i.dataFile)}</b><br>Your backups: <b>${esc(i.backupFolder)}</b>`; if (v && i.version) v.textContent = 'version ' + i.version; } catch (e) { /* ignore */ }
}

// ---------- BACKUPS
function vBackups() {
  const trash = S.data.trash;
  return `<h1>Backups</h1><p class="lead">Everything is saved on this computer in one plain file. Nothing goes online.</p>
  <div class="card"><div class="head"><h2>Your data</h2></div><p class="mini" id="paths">Loading…</p>
    <div class="tools" style="margin:10px 0 0"><button class="btn" data-act="backupnow">Back up now</button><button class="btn" data-act="exportjson">Download JSON</button><button class="btn" data-act="exportcsv">Download for Excel (CSV)</button><label class="btn">Import JSON<input type="file" id="imp" accept=".json" hidden></label></div>
    <p class="mini">A backup is made automatically when you save (at most once per 2 minutes), when the app opens and when you close it. Nothing is deleted at random: see the safety list below.</p></div>
  <div class="card"><div class="head"><h2>Restore a backup</h2></div><div id="bk">Loading…</div></div>
  <div class="card"><div class="head"><h2>How your data is kept safe</h2></div><ul style="margin:0;padding-left:20px;line-height:1.8">
    <li>Everything is saved automatically, and a backup is made before changes, when the app opens and when it closes.</li>
    <li>Backups are never thrown away at random: the last 3 days are all kept, and the newest backup of every older day is kept forever.</li>
    <li>If the data file goes missing or gets damaged, the newest good backup is restored automatically and the damaged file is kept.</li>
    <li>A save that would remove several items is blocked until you confirm.</li>
    <li>Deleting an item only moves it to "Deleted items" below.</li></ul></div>
  <div class="card"><div class="head"><h2>Extra backup copy (recommended)</h2></div>
    <p class="mini" style="margin:0 0 10px">Keep one more copy somewhere else, such as a USB stick or a Google Drive or Dropbox folder. It is updated after every save.</p>
    <div class="tools" style="margin:0"><input data-setting="extraBackupDir" value="${esc(settings().extraBackupDir || '')}" placeholder="Folder, e.g. D:\\Google Drive\\Creator Board backup" style="flex:1;min-width:260px"><button class="btn" data-act="extranow">Copy now</button></div></div>
  <div class="card"><div class="head"><h2>Deleted items (${trash.length})</h2></div>${trash.length ? trash.map((i) => `<div class="row"><div class="t">${esc(i.title)}</div><button class="btn sm" data-act="restore" data-id="${i.id}">Restore</button></div>`).join('') : '<div class="empty">Nothing deleted.</div>'}</div>`;
}
async function loadBackups() {
  try {
    const info = await (await fetch('/api/info')).json(), el = $('#paths'); if (el) el.innerHTML = `Data file: <b>${esc(info.dataFile)}</b><br>Backups folder: <b>${esc(info.backupFolder)}</b>`;
    const list = await (await fetch('/api/backups')).json(), b = $('#bk');
    if (b) b.innerHTML = list.length ? list.slice(0, 12).map((x) => `<div class="row"><div class="t" style="cursor:default">${esc(x.name.replace('hq-data-', '').replace('.json', ''))}</div><span class="mini">${x.kb} KB</span><button class="btn sm" data-act="restorebk" data-name="${esc(x.name)}">Restore</button></div>`).join('') : '<div class="empty">No backups yet. The first one is made when you change something.</div>';
  } catch (e) { /* ignore */ }
}
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function csv() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`, head = ['title', 'type', 'series', 'number', 'topic', 'platforms', 'status', 'planned', 'length_s', ...PLATS.flatMap((p) => [p + '_posted', p + '_date', p + '_views', p + '_url'])];
  return [head.join(','), ...items().map((i) => [i.title, i.kind, i.series, i.number, i.category, i.platforms.join('+'), i.status, i.plannedDate, i.durationSec, ...PLATS.flatMap((p) => { const x = perf(i, p) || {}; return [x.posted ? 'yes' : '', x.date, x.views, x.url]; })].map(q).join(','))].join('\n');
}

// ---------- EDITOR
function openModal(id, preset) {
  const d0 = dflt(preset || 'youtube'), isNew = !id, it = isNew ? { id: uid(), title: '', kind: d0.kind, series: d0.series, number: null, category: d0.category, platforms: d0.platforms, status: 'idea', plannedDate: '', durationSec: d0.durationSec, style: settings().style || '', hook: '', notes: '', sources: '', videoPath: '', perf: {}, checks: {}, createdAt: today() } : getItem(id);
  if (!it) return; S.modalOpen = true; S.editing = { id: it.id, isNew };
  const opt = (list, cur) => list.map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
  $('#modal').hidden = false;
  $('#modal').innerHTML = `<form class="modal" data-form="item"><h2>${isNew ? 'Add a video idea' : 'Edit'}</h2>
    <div class="fld"><label>Title</label><input name="title" value="${esc(it.title)}" required placeholder="What is the video about?"></div>
    <div class="two"><div class="fld"><label>Type</label><select name="kind">${opt(Object.entries(KIND), it.kind)}</select></div>
      <div class="fld"><label>Stage</label><select name="stage">${opt([['idea', 'To make'], ['ready', 'Made: ready to post']], made(it) ? 'ready' : 'idea')}</select></div></div>
    <div class="two"><div class="fld"><label>Planned date</label><input type="date" name="plannedDate" value="${esc(it.plannedDate)}"></div>
      <div class="fld"><label>Length (seconds)</label><input type="number" name="durationSec" value="${it.durationSec ?? ''}"></div></div>
    <div class="lab">Where does it go?</div>
    ${PLATS.map((p) => { const x = perf(it, p) || {}, on = it.platforms.includes(p); return `<div class="prow ${on ? '' : 'off'}" data-perf="${p}"><div class="ph"><label class="sw"><input type="checkbox" name="plat_${p}" data-plat="${p}" ${on ? 'checked' : ''}> <span class="dot d-${p}"></span>${PNAME[p]}</label><span class="sp"></span><label class="sw"><input type="checkbox" name="posted_${p}" ${x.posted ? 'checked' : ''}> Posted</label></div>
      <div class="pf"><input type="date" name="date_${p}" value="${esc(x.date || '')}" title="Date posted"><input name="url_${p}" value="${esc(x.url || '')}" placeholder="Link to the post"><input type="number" name="views_${p}" value="${x.views ?? ''}" placeholder="Views"></div></div>`; }).join('')}
    <details><summary>More details</summary>
      <div class="two"><div class="fld"><label>Series (optional)</label><input name="series" list="serlist" value="${esc(seriesName(it.series))}" placeholder="e.g. Weekly facts"><datalist id="serlist">${[...new Set([...Object.values(settings().seriesNames || {}), ...items().map((x) => seriesName(x.series))].filter(Boolean))].map((n) => `<option value="${esc(n)}">`).join('')}</datalist></div>
        <div class="fld"><label>Episode number (optional)</label><div style="display:flex;gap:6px"><input type="number" name="number" value="${it.number ?? ''}"><button type="button" class="btn sm" data-act="nextnum">Next</button></div></div></div>
      <div class="two"><div class="fld"><label>Topic</label><input name="category" list="catlist" value="${esc(it.category)}" placeholder="e.g. science"><datalist id="catlist">${[...new Set([...CAT_HINTS, ...items().map((x) => x.category)].filter(Boolean))].map((n) => `<option value="${esc(n)}">`).join('')}</datalist></div><div class="fld"><label>Style</label><input name="style" value="${esc(it.style)}"></div></div>
      <div class="fld"><label>Hook (the first line)</label><input name="hook" value="${esc(it.hook)}"></div>
      <div class="fld"><label>Notes / script</label><textarea name="notes">${esc(it.notes)}</textarea></div>
      <div class="fld"><label>Sources (links to where the facts came from)</label><textarea name="sources">${esc(it.sources)}</textarea></div>
      <div class="fld"><label>Video file on this computer</label><input name="videoPath" value="${esc(it.videoPath)}" placeholder="C:\\Users\\…\\renders\\video.mp4"></div>
      ${PLATS.map((p) => { const x = perf(it, p) || {}; return `<div class="two"><div class="fld"><label>${PNAME[p]} likes</label><input type="number" name="likes_${p}" value="${x.likes ?? ''}"></div><div class="fld"><label>${PNAME[p]} comments</label><input type="number" name="comments_${p}" value="${x.comments ?? ''}"></div></div>`; }).join('')}
      <div class="lab">Before uploading</div><div class="checks">${CHECKS.map(([k, l]) => `<label><input type="checkbox" name="chk_${k}" ${it.checks && it.checks[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div></details>
    <div class="actions">${isNew ? '' : `<button type="button" class="btn ghost danger" data-act="del" data-id="${it.id}">Delete</button>`}<span class="sp"></span><button type="button" class="btn" data-act="closemodal">Cancel</button><button class="btn pri">Save</button></div></form>`;
  setTimeout(() => { const f = $('form[data-form=item]'); if (f && isNew) f.elements.title.focus(); }, 30);
}
function closeModal() { S.modalOpen = false; S.editing = null; $('#modal').hidden = true; $('#modal').innerHTML = ''; }
function saveModal(form) {
  const fd = new FormData(form), { id, isNew } = S.editing, it = isNew ? { id, perf: {}, createdAt: today() } : getItem(id);
  const plats = PLATS.filter((p) => fd.get('plat_' + p)); if (!plats.length) { toast('Pick at least one platform'); return; }
  snap();
  { const typed = String(fd.get('series') || '').trim(), id2 = seriesId(typed); if (typed && id2 && !(settings().seriesNames || {})[id2]) { settings().seriesNames = settings().seriesNames || {}; settings().seriesNames[id2] = typed; } }
  Object.assign(it, { title: String(fd.get('title')).trim(), kind: fd.get('kind'), series: seriesId(fd.get('series')), number: num(fd.get('number')), category: fd.get('category'), plannedDate: fd.get('plannedDate') || '', durationSec: num(fd.get('durationSec')), style: fd.get('style'), hook: fd.get('hook'), notes: fd.get('notes'), sources: fd.get('sources'), videoPath: fd.get('videoPath'), platforms: plats });
  const wanted = fd.get('stage'); it.status = wanted === 'ready' ? (['made', 'ready'].includes(it.status) ? it.status : 'ready') : (['idea', 'script'].includes(it.status) ? it.status : 'idea');
  it.perf = it.perf || {};
  PLATS.forEach((p) => { if (!plats.includes(p)) { delete it.perf[p]; return; } it.perf[p] = { ...(it.perf[p] || {}), posted: !!fd.get('posted_' + p), date: fd.get('date_' + p) || '', url: fd.get('url_' + p) || '', views: num(fd.get('views_' + p)), likes: num(fd.get('likes_' + p)), comments: num(fd.get('comments_' + p)) }; if (it.perf[p].posted && !it.perf[p].date) it.perf[p].date = today(); });
  if (plats.some((p) => it.perf[p].posted) && !made(it)) it.status = 'ready';
  if (allPosted(it)) it.status = 'posted'; else if (it.status === 'posted') it.status = 'ready';
  it.checks = {}; CHECKS.forEach(([k]) => { it.checks[k] = !!fd.get('chk_' + k); });
  if (isNew) items().unshift(it);
  if (isNew && PLATS.includes(S.tab)) S.showAll[S.tab + 'idea'] = true;
  touch(); closeModal(); render(); toast(isNew ? 'Added. Ideas without a date sit at the bottom of "To make".' : 'Saved');
}

// ---------- clicks and forms
document.addEventListener('click', (e) => {
  const stop = e.target.closest('[data-stop]'), a = e.target.closest('[data-act]');
  if (stop && (!a || !stop.contains(a) || a === stop.closest('[data-act=edit]'))) { if (!(a && a.matches('button[data-act]'))) return; }
  if (!a) return; const act = a.dataset.act, id = a.dataset.id;
  if (act === 'tab') { S.tab = a.dataset.v; S.typing = false; if (PLATS.includes(S.tab)) { S.kind = ''; S.q = ''; } render(); window.scrollTo(0, 0); }
  else if (act === 'savedaily') saveDaily();
  else if (act === 'edit') openModal(id);
  else if (act === 'new') openModal(null, a.dataset.p);
  else if (act === 'closemodal') closeModal();
  else if (act === 'kind') { S.kind = a.dataset.v; render(); }
  else if (act === 'more') { S.showAll[a.dataset.k] = !S.showAll[a.dataset.k]; render(); }
  else if (act === 'wk') { S.week = a.dataset.v === '0' ? 0 : S.week + +a.dataset.v; render(); }
  else if (act === 'autoplan') autoPlan();
  else if (act === 'theme') { const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; try { localStorage.setItem('hq-theme', n); } catch (x) { /* ignore */ } render(); }
  else if (act === 'made') { const it = getItem(id); snap(); it.status = 'ready'; touch(); render(); toast('Marked as made', true); }
  else if (act === 'posted') { const it = getItem(id), p = a.dataset.p; snap(); it.perf[p] = { ...(it.perf[p] || {}), posted: true, date: (it.perf[p] && it.perf[p].date) || today() }; if (!made(it)) it.status = 'ready'; if (allPosted(it)) it.status = 'posted'; touch(); render(); toast(`Marked as posted on ${PNAME[p]}. Add the link and views by clicking it.`, true); }
  else if (act === 'undo') { if (S.undoData) { S.data = JSON.parse(S.undoData); S.undoData = null; normalise(); touch(); render(); toast('Undone'); } }
  else if (act === 'del') { const it = getItem(id); if (!it || !confirm(`Delete "${it.title}"?\n\nIt goes to Backups > Deleted items, so you can bring it back.`)) return; snap(); S.data.trash.unshift(it); S.data.items = items().filter((x) => x.id !== id); touch(); closeModal(); render(); toast('Deleted', true); }
  else if (act === 'restore') { const k = S.data.trash.findIndex((x) => x.id === id); if (k >= 0) { items().unshift(S.data.trash.splice(k, 1)[0]); touch(); render(); toast('Restored'); } }
  else if (act === 'nextnum') { const f = $('form[data-form=item]'); f.elements.number.value = nextNumber(seriesId(f.elements.series.value)); }
  else if (act === 'loadfile') load(true);
  else if (act === 'copyprompt') { (navigator.clipboard ? navigator.clipboard.writeText(CLAUDE_PROMPT) : Promise.reject()).then(() => toast('Copied. Paste it to Claude.')).catch(() => toast('Select the text and copy it.')); }
  else if (act === 'dismiss') { S.notice = null; showBanner(); }
  else if (act === 'forcesave') { if (confirm('Save anyway? This removes records from your data file. A backup is made first.')) { S.allowShrink = true; S.blocked = null; showBanner(); touch(); } }
  else if (act === 'extranow') fetch('/api/extra-now', { method: 'POST' }).then((r) => r.json()).then((j) => toast(j.extra.skipped ? 'Type a folder first.' : j.extra.ok ? 'Copied to the extra folder.' : 'Failed: ' + j.extra.error));
  else if (act === 'keepmine') { S.mtime = S.conflict; S.conflict = null; showBanner(); touch(); }
  else if (act === 'backupnow') fetch('/api/backup-now', { method: 'POST' }).then(() => { toast('Backup made'); loadBackups(); });
  else if (act === 'exportjson') download('hq-data-' + today() + '.json', JSON.stringify(S.data, null, 2), 'application/json');
  else if (act === 'exportcsv') download('creator-board-' + today() + '.csv', '\ufeff' + csv(), 'text/csv');
  else if (act === 'restorebk') { if (confirm('Restore this backup? Your current data is backed up first.')) fetch('/api/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: a.dataset.name }) }).then(() => load(true)); }
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form'); if (!f) return; e.preventDefault();
  if (f.dataset.form === 'item') saveModal(f);
  if (f.dataset.form === 'snap') { const fd = new FormData(f), row = { date: fd.get('date') || today() }; PLATS.forEach((p) => { if (fd.get(p) !== '') row[p] = num(fd.get(p)); }); const ex = S.data.snapshots.find((x) => x.date === row.date); if (ex) Object.assign(ex, row); else S.data.snapshots.push(row); touch(); render(); toast('Numbers added'); }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.setting) { settings()[t.dataset.setting] = t.value; touch(); render(); }
  if (t.dataset.rules !== undefined) { settings().rules = t.value.split('\n').map((x) => x.trim()).filter(Boolean); touch(); }
  if (t.dataset.plat) { const b = $(`[data-perf=${t.dataset.plat}]`); if (b) b.classList.toggle('off', !t.checked); }
  if (t.dataset.target) { const x = S.data.targets.find((y) => y.id === t.dataset.target); if (x) { x.current = t.value; touch(); } }
  if (t.id === 'imp' && t.files[0]) { const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (!Array.isArray(d.items)) throw new Error('not an HQ file'); if (!confirm('Replace everything with this file? Your current data is backed up first.')) return; fetch('/api/backup-now', { method: 'POST' }).then(() => { S.data = d; normalise(); S.allowShrink = true; touch(); render(); toast('Imported'); }); } catch (err) { alert('That file could not be read: ' + err.message); } }; r.readAsText(t.files[0]); }
});
document.addEventListener('input', (e) => { if (e.target.dataset.q !== undefined) { S.q = e.target.value; const b = $('#board'); if (b) b.innerHTML = board(S.tab); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.modalOpen) closeModal(); });
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });
window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });



// ---------- DAILY UPDATE: type today's numbers in one place
function vDaily() {
  const t = today(), last = S.data.settings.lastDaily;
  const flw = PLATS.map((p) => `<div class="fld"><label><span class="dot d-${p}"></span>${p === 'youtube' ? 'YouTube subscribers' : PNAME[p] + ' followers'}</label><div class="dcell"><input type="number" min="0" data-f="${p}" data-prev="${snapLatest(p) ?? ''}" value="${snapLatest(p) ?? ''}"><span class="delta" data-fdelta="${p}"></span></div></div>`).join('');
  const sections = PLATS.map((p) => {
    const rows = items().filter((i) => i.platforms.includes(p) && isPosted(i, p)).sort((a, b) => (perf(b, p).date || '').localeCompare(perf(a, p).date || ''));
    const cell = (i, f) => { const v = perf(i, p)[f]; const key = `${i.id}|${p}|${f}`; return `<td><div class="dcell"><input type="number" min="0" data-d="${key}" data-prev="${v ?? ''}" value="${v ?? ''}"><span class="delta" data-delta="${key}"></span></div></td>`; };
    return `<div class="card"><div class="head"><span class="dot d-${p}"></span><h2>${PNAME[p]}</h2><span class="mini">${rows.length} posted</span></div>
      ${rows.length ? `<div class="scroll"><table class="dtab"><thead><tr><th>Video</th><th>Posted</th><th>Views</th><th>Likes</th><th>Comments</th></tr></thead><tbody>${rows.map((i) => `<tr><td class="dt">${esc(i.title)}${i.kind === 'long' ? ' <span class="chip">Long</span>' : ''}</td><td class="mini">${nice(perf(i, p).date)}</td>${cell(i, 'views')}${cell(i, 'likes')}${cell(i, 'comments')}</tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nothing posted here yet. Videos you mark as posted show up here.</div>'}</div>`;
  }).join('');
  return `<h1>Daily update</h1><p class="lead">${last === t ? 'Done for today \u2713. You can still change numbers and save again.' : 'Type today\'s numbers, then press Save. Leave a box as it is if nothing changed.'}${last && last !== t ? ' Last update: ' + nice(last) + '.' : ''}</p>
  <div class="tools"><button class="btn pri" data-act="savedaily">Save today's numbers</button><span class="mini">Press Enter to jump to the box below. Green means it went up since last time.</span></div>
  <div class="card"><div class="head"><h2>Followers and subscribers</h2></div><div class="three">${flw}</div></div>${sections}
  <div class="tools" style="margin-top:16px"><button class="btn pri" data-act="savedaily">Save today's numbers</button></div>
  <p class="mini">Where to find them: YouTube Studio > Content. Instagram > Professional dashboard, or open a Reel. Facebook > Meta Business Suite > Insights.</p>`;
}
function saveDaily() {
  snap(); const t = today(); let gained = 0;
  document.querySelectorAll('input[data-d]').forEach((inp) => {
    const [id, p, f] = inp.dataset.d.split('|'), it = getItem(id), x = it && it.perf[p]; if (!x || inp.value === '') return;
    const v = +inp.value; if (x[f] !== v) { if (f === 'views') gained += v - (x.views || 0); x[f] = v; }
  });
  items().forEach((it) => PLATS.forEach((p) => { const x = perf(it, p); if (x && x.posted) { x.history = (x.history || []).filter((h) => h.date !== t); x.history.push({ date: t, views: x.views ?? null, likes: x.likes ?? null, comments: x.comments ?? null }); } }));
  const row = { date: t }; document.querySelectorAll('input[data-f]').forEach((inp) => { if (inp.value !== '') row[inp.dataset.f] = +inp.value; });
  if (Object.keys(row).length > 1) { const ex = S.data.snapshots.find((x) => x.date === t); if (ex) Object.assign(ex, row); else S.data.snapshots.push(row); }
  S.data.settings.lastDaily = t; S.typing = false; touch(); render();
  toast(`Saved today's numbers. Views ${gained >= 0 ? 'up' : 'down'} by ${Math.abs(gained).toLocaleString('en-GB')}.`, true);
}
document.addEventListener('input', (e) => {
  const t = e.target, key = t.dataset.d || t.dataset.f; if (!key) return;
  S.typing = true;
  const el = t.dataset.d ? $(`[data-delta="${CSS.escape(t.dataset.d)}"]`) : $(`[data-fdelta="${t.dataset.f}"]`); if (!el) return;
  const prev = t.dataset.prev === '' ? null : +t.dataset.prev, v = t.value === '' ? null : +t.value;
  if (v == null || prev == null || v === prev) { el.textContent = ''; el.className = 'delta'; } else { const d = v - prev; el.textContent = (d > 0 ? '+' : '') + d.toLocaleString('en-GB'); el.className = 'delta ' + (d > 0 ? 'up' : 'down'); }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.dataset || !e.target.dataset.d) return; e.preventDefault();
  const f = e.target.dataset.d.split('|')[2], col = [...e.target.closest('table').querySelectorAll('input[data-d$="|' + f + '"]')], n = col[col.indexOf(e.target) + 1];
  if (n) { n.focus(); n.select(); }
});

// ---------- drag and drop between the three columns (like Trello)
function unpost(it, p) { it.perf[p] = { ...(it.perf[p] || {}), posted: false, date: '' }; if (it.status === 'posted') it.status = 'ready'; }
function moveCard(id, p, target) {
  const it = getItem(id); if (!it || !PLATS.includes(p) || stage(it, p) === target) return;
  snap();
  if (target === 'idea') { if (isPosted(it, p)) unpost(it, p); it.status = 'idea'; }
  else if (target === 'ready') { if (isPosted(it, p)) unpost(it, p); if (!made(it)) it.status = 'ready'; }
  else { if (!made(it)) it.status = 'ready'; it.perf[p] = { ...(it.perf[p] || {}), posted: true, date: (it.perf[p] && it.perf[p].date) || today() }; if (allPosted(it)) it.status = 'posted'; }
  touch(); render();
  toast(target === 'posted' ? `Posted on ${PNAME[p]}. Click the card to add the link and views.` : target === 'ready' ? 'Moved to Ready to post' : 'Moved to To make', true);
}
const colOf = (e) => e.target.closest && e.target.closest('.col[data-stage]');
document.addEventListener('dragstart', (e) => {
  const c = e.target.closest && e.target.closest('.kc[data-drag]'); if (!c) return;
  S.dragId = c.dataset.drag; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', S.dragId); } catch (x) { /* ignore */ }
  setTimeout(() => c.classList.add('dragging'), 0);
});
document.addEventListener('dragover', (e) => { const c = colOf(e); if (!c || !S.dragId) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; document.querySelectorAll('.col.over').forEach((x) => { if (x !== c) x.classList.remove('over'); }); c.classList.add('over'); });
document.addEventListener('dragleave', (e) => { const c = colOf(e); if (c && !c.contains(e.relatedTarget)) c.classList.remove('over'); });
document.addEventListener('drop', (e) => { const c = colOf(e); if (!c || !S.dragId) return; e.preventDefault(); const id = S.dragId; S.dragId = null; document.querySelectorAll('.col.over,.kc.dragging').forEach((x) => x.classList.remove('over', 'dragging')); moveCard(id, S.tab, c.dataset.stage); });
document.addEventListener('dragend', () => { S.dragId = null; document.querySelectorAll('.col.over,.kc.dragging').forEach((x) => x.classList.remove('over', 'dragging')); });

load().catch((e) => { $('#app').innerHTML = `<div class="card"><h2>Can't reach Creator Board</h2><p>Open the app again with the <b>Creator Board</b> icon.</p><p class="mini">${esc(e.message)}</p></div>`; });
})();
