/* Stretch/Contraction Log — app logic. All data lives on this phone (localStorage), with JSON backup/restore. */
(function () {
"use strict";
const APP_VERSION = "1.4.0";
const P = window.SC_PLAN;
const { PLAN, EXT, TIER, TIER_H } = P;
const DEFAULT_START = P.DEFAULT_START;
const WORK_S = 45; // seconds per working set, for time estimates

const SLOT = {}, SESS_OF = {};
PLAN.forEach(sess => {
  let n = 0; const gi = {};
  sess.slots.forEach(s => {
    SLOT[s.id] = s; SESS_OF[s.id] = sess;
    s.seq = s.g ? s.g + (gi[s.g] = (gi[s.g] || 0) + 1) : String(++n);
  });
});

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const parseISO = s => { const p = String(s).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const mondayOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const num = v => { if (v == null) return null; const t = String(v).trim().replace(",", "."); if (t === "") return null; const n = Number(t); return isFinite(n) ? n : null; };
const fmtW = n => n == null ? "" : String(Math.round(n * 100) / 100);
const roundW = x => { const step = x >= 20 ? 2.5 : 0.5; return Math.round(x / step) * step; };
const fmtMin = s => { const m = Math.max(0, Math.round(s / 60)); return m >= 60 ? Math.floor(m / 60) + " h " + (m % 60) + " min" : m + " min"; };
const fmtRest = s => Math.floor(s / 60) + ":" + pad(s % 60);
const dayShort = s => s ? DOW[parseISO(s).getDay()] : "";
const dateShort = s => { const d = parseISO(s); return d.getDate() + " " + MON[d.getMonth()]; };
const todayISO = () => iso(new Date());
const thisWeek = () => iso(mondayOf(new Date()));
const daysSince = isoTs => isoTs ? Math.floor((Date.now() - new Date(isoTs).getTime()) / 864e5) : null;
const isStandalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const ICON_TICK = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8"/></svg>';
const ICON_CHEV = '<svg class="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.5 6 4.5 4.5L12.5 6"/></svg>';
const LOCN = { work: "Work", home: "Home" }, LOCL = { work: "work", home: "home" };
const otherLoc = l => l === "work" ? "home" : "work";
// Machines and cable stacks are calibrated differently at each gym; free weights are the same everywhere.
const isMachineKit = k => (k || []).some(t => t.split("|").some(x => x === "machines" || x === "cable"));

/* ================= storage (this phone) ================= */
const KEY = "sc44:data", UIKEY = "sc44:ui";
function normalise(d){
  if (!d || typeof d !== "object") d = {};
  const settings = Object.assign({ blockStart: DEFAULT_START }, d.settings || {});
  // your own exercises per slot: { slotId: [{ n, machine }] }
  settings.custom = (settings.custom && typeof settings.custom === "object") ? settings.custom : {};
  // the exercise you picked in Swap, per slot: { slotId: { v: name, loc: "work" | "home" | null } }
  settings.choice = (settings.choice && typeof settings.choice === "object") ? settings.choice : {};
  // 1.1–1.2 kept per-gym defaults: carry them over as your current pick
  if (settings.defaults && typeof settings.defaults === "object") {
    const w = settings.defaults.work || {}, h = settings.defaults.home || {};
    Object.keys(Object.assign({}, h, w)).forEach(id => {
      if (!settings.choice[id]) settings.choice[id] = w[id] ? { v: w[id], loc: "work" } : { v: h[id], loc: "home" };
    });
    delete settings.defaults;
  }
  delete settings.homeKit;
  return {
    v: 1,
    weeks: (d.weeks && typeof d.weeks === "object") ? d.weeks : {},
    settings,
    lastBackup: d.lastBackup || null
  };
}
function loadData(){ try { return normalise(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return normalise(null); } }
let D = loadData();
function save(){
  try { localStorage.setItem(KEY, JSON.stringify(D)); }
  catch (e) { toast("Couldn't save on this phone. Export a backup from Settings now."); }
}
const UI = Object.assign({ tab: "week", show: "all", budget: 0, collapsed: {}, installHidden: false, keepFiled: {} },
  (() => { try { return JSON.parse(localStorage.getItem(UIKEY)) || {}; } catch (e) { return {}; } })());
["loc", "exLoc", "lastGym", "variant"].forEach(k => delete UI[k]); // gym switches from 1.1–1.2
const saveUI = () => { try { localStorage.setItem(UIKEY, JSON.stringify(UI)); } catch (e) {} };
saveUI();
save();
let persistAsked = false;
function askPersist(){
  if (persistAsked) return; persistAsked = true;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
}

const S = { week: thisWeek(), drafts: {}, nav: false }; // nav: you moved to another week on purpose
let HIST = {}, PICK = {};

/* ================= derived ================= */
const weekNo = wk => Math.round((parseISO(wk) - mondayOf(parseISO(D.settings.blockStart || DEFAULT_START))) / 864e5 / 7) + 1;
const isDeload = wk => { const n = weekNo(wk); return n === 6 || n === 12; };
const target = slot => isDeload(S.week) ? 1 : slot.w.length;
const setsOf = wk => (D.weeks[wk] && D.weeks[wk].sets) || {};
function doneCount(slot, sets){
  let c = 0; const t = target(slot);
  for (let i = 0; i < t; i++) if (sets[slot.id + "_" + i]) c++;
  return c;
}
const remaining = (slot, sets) => target(slot) - doneCount(slot, sets);
const slotSecs = (slot, sets) => remaining(slot, sets) * (WORK_S + slot.rest);

// Exercises available for a slot: the plan's, its built-in swaps, then your own.
function variantsFor(slot){
  return [{ n: slot.name, machine: isMachineKit(slot.kit), primary: true }]
    .concat((slot.swaps || []).map(s => ({ n: s.n, machine: isMachineKit(s.k), note: s.note })),
      (D.settings.custom[slot.id] || []).map(c => ({ n: c.n, machine: c.machine == null ? isMachineKit(slot.kit) : !!c.machine, custom: true })));
}
// What Swap offers: machines and cables once per gym, everything else once.
function optionsFor(slot){
  const out = [];
  variantsFor(slot).forEach(v => {
    if (v.machine) ["work", "home"].forEach(loc => out.push({ v: v.n, loc, primary: !!v.primary, note: v.note }));
    else out.push({ v: v.n, loc: null, primary: !!v.primary, note: v.note });
  });
  return out;
}
const optKey = o => (o.loc || "") + "|" + o.v;
function latestLog(slot){
  let best = null;
  Object.keys(D.weeks).forEach(wk => {
    const sets = setsOf(wk);
    for (let i = 0; i < slot.w.length; i++) {
      const e = sets[slot.id + "_" + i];
      if (e && e.v && (!best || (e.d || wk) + (e.t || "") > (best.d || "") + (best.t || ""))) best = e;
    }
  });
  return best;
}
// The exercise (and gym, for machines) a slot is set to: your pick in Swap, else what you last logged for it, else the plan at work.
function chosen(slot){
  if (PICK[slot.id]) return PICK[slot.id];
  const opts = optionsFor(slot);
  const match = c => c && opts.find(o => o.v === c.v && (o.loc === null || o.loc === (c.loc || "work")));
  const o = match(D.settings.choice[slot.id]) || match(latestLog(slot)) || opts[0];
  return (PICK[slot.id] = o);
}

function buildHist(){
  HIST = {}; PICK = {};
  Object.keys(D.weeks).sort().reverse().forEach(wk => {
    const sets = setsOf(wk), dl = isDeload(wk);
    Object.keys(sets).sort().forEach(k => {
      const e = sets[k]; if (!e || !e.v) return;
      const i = Number(k.split("_").pop());
      (HIST[e.v] = HIST[e.v] || []).push({ wk, i, w: e.w, r: e.r, x: e.x, d: e.d, dl, loc: e.loc || "work" });
    });
  });
}
// Machine weights only ever come from the same gym; free-weight history is shared.
const sameGym = (e, o) => !o.loc || e.loc === o.loc;
function basePrefill(slot, i, o){
  const h = HIST[o.v] || [];
  const ok = e => e.wk < S.week && e.w != null && !e.dl && sameGym(e, o);
  const exact = h.find(e => ok(e) && e.i === i);
  if (exact) return exact.w;
  if (i > 0) { // a back-off with no history of its own: nearest earlier back-off from the latest week
    const prev = h.filter(e => ok(e) && e.i > 0 && e.i < i);
    if (prev.length) { const wk = prev[0].wk; return prev.filter(e => e.wk === wk).sort((a, b) => b.i - a.i)[0].w; }
  }
  if (o.v === slot.name && slot.w[i] != null && o.loc !== "home") return slot.w[i]; // plan weights are work-gym numbers
  if (i > 0) { const top = h.find(e => ok(e) && e.i === 0); if (top) return roundW(top.w * 0.9); }
  return null;
}
function prefill(slot, i, o){
  if (slot.bw) return null;
  if (isDeload(S.week)) { const top = basePrefill(slot, 0, o); return top == null ? null : roundW(top * 0.65); }
  return basePrefill(slot, i, o);
}
const lastTop = (v, loc) => (HIST[v] || []).find(e => e.wk < S.week && e.i === 0 && !e.dl && e.r != null && (!loc || e.loc === loc)) || null;
const totalLogged = () => Object.values(D.weeks).reduce((a, w) => a + Object.keys((w && w.sets) || {}).length, 0);

/* ================= rendering ================= */
function segHTML(key, opts){
  return '<div class="seg" role="group">' + opts.map(o =>
    '<button type="button" data-set="' + key + ':' + o[0] + '" aria-pressed="' + (String(UI[key]) === String(o[0])) + '">' + o[1] + '</button>').join("") + '</div>';
}

function exHTML(slot, sets){
  const o = chosen(slot), opts = optionsFor(slot);
  const ext = EXT[slot.ext], dl = isDeload(S.week);
  const restTxt = slot.rest > 0 ? "rest " + fmtRest(slot.rest) : "straight into the next exercise";
  const topTxt = dl ? "Deload: one set at ~65%, stop 3 short" : (ext.flat ? ext.top : ext.top + "; back-offs ~10% lighter, to failure");
  let rows = "";
  for (let i = 0; i < target(slot); i++) rows += setRowHTML(slot, i, ext, dl);
  const notes = [slot.note, o.note].filter(Boolean);
  const sub = (o.loc ? '<span class="gymtag ' + o.loc + '">' + LOCN[o.loc] + ' machine</span>' : '') +
    (o.v !== slot.name ? 'in place of ' + esc(slot.name) : '');
  return '<article class="ex" data-slot="' + slot.id + '">' +
    '<div class="ex-head"><span class="seq">' + slot.seq + '</span><div class="ex-title"><h3>' + esc(o.v) + '</h3>' +
      (sub ? '<div class="for">' + sub + '</div>' : '') +
    '</div><span class="tier t' + slot.tier + '">' + TIER[slot.tier] + '</span></div>' +
    '<div class="meta">' + slot.lo + '–' + slot.hi + ' reps · ' + restTxt + ' · ' + topTxt + '</div>' +
    '<div class="acts">' +
      '<span class="pill-sel"><select data-variant="' + slot.id + '" id="v-' + slot.id + '" aria-label="Swap ' + esc(o.v) + ' for another exercise or gym">' +
        '<option value="" selected disabled>Swap</option>' +
        opts.map(x => '<option value="' + esc(optKey(x)) + '">' + (optKey(x) === optKey(o) ? "✓ " : "") + esc(x.v) +
          (x.loc ? " · " + LOCN[x.loc] : "") + (x.primary ? " (plan)" : "") + '</option>').join("") +
        '<option value="__add__">+ Add your own…</option>' +
        '</select></span>' +
      (notes.length ? '<button type="button" class="mini" data-notes="' + slot.id + '" aria-expanded="false" aria-controls="n-' + slot.id + '">Notes</button>' : '') +
    '</div>' +
    (notes.length ? '<div class="notes" id="n-' + slot.id + '" hidden>' + notes.map(n => '<p>' + esc(n) + '</p>').join("") + '</div>' : '') +
    '<div class="last"></div>' +
    '<div class="sets">' + rows + '</div></article>';
}

function setRowHTML(slot, i, ext, dl){
  const key = slot.id + "_" + i;
  const lab = ext.flat ? String(i + 1) : (i === 0 ? "Top" : "B" + i);
  const xl = (!ext.flat && i === 0 && ext.label && !dl) ? ext.label : null;
  // Fields are filled from the app's own number pad, never the iPhone keyboard, so iOS has no typing to "Shake to Undo".
  const ro = ' readonly tabindex="-1" inputmode="none" autocomplete="off"';
  const wf = slot.bw ? '<span class="bw">BW</span>' :
    '<div class="fld w" data-fld><input id="w-' + key + '" data-f="w"' + ro + ' aria-label="' + lab + ' weight in kg"><span>' + (slot.added ? "+kg" : "kg") + '</span></div>';
  const xf = xl ? '<div class="fld x" data-fld><span>' + xl + '</span><input id="x-' + key + '" data-f="x"' + ro + ' aria-label="' + lab + ' ' + xl + ' count"></div>' : '<span></span>';
  return '<div class="set" data-key="' + key + '" data-slot="' + slot.id + '" data-i="' + i + '">' +
    '<span class="sl"><b>' + lab + '</b><small></small></span>' + wf +
    '<div class="fld r" data-fld><input id="r-' + key + '" data-f="r"' + ro + ' placeholder="' + slot.lo + '–' + slot.hi + '" aria-label="' + lab + ' reps, target ' + slot.lo + ' to ' + slot.hi + '"></div>' +
    xf + '<button type="button" class="tick" data-tick="' + key + '" aria-label="Log ' + lab + ' set" aria-pressed="false">' + ICON_TICK + '</button>' +
    '<div class="alt"></div></div>';
}

function groupCards(slots, sets, label){
  // consecutive slots sharing a superset letter share one card
  let html = "", i = 0;
  while (i < slots.length) {
    const s = slots[i];
    if (s.g) {
      const run = [s]; let j = i + 1;
      while (j < slots.length && slots[j].g === s.g && SESS_OF[slots[j].id] === SESS_OF[s.id]) run.push(slots[j++]);
      if (run.length > 1) {
        const mixed = new Set(run.map(r => r.tier)).size > 1;
        html += '<div class="card"><div class="card-h"><span>Superset ' + s.g + (mixed ? ' · fillers go in the rests' : ' · alternate sets') + '</span>' +
          (label ? '<span>' + esc(label(s)) + '</span>' : '') + '</div>' + run.map(r => exHTML(r, sets)).join("") + '</div>';
        i = j; continue;
      }
    }
    html += '<div class="card">' + (label ? '<div class="card-h"><span>' + esc(label(s)) + '</span></div>' : '') + exHTML(s, sets) + '</div>';
    i++;
  }
  return html;
}

function sessionsHTML(sets){
  return PLAN.map(sess => {
    const slots = sess.slots.filter(s => UI.show === "all" || remaining(s, sets) > 0);
    const open = !UI.collapsed[sess.id];
    return '<section class="sess" data-sess="' + sess.id + '">' +
      '<button type="button" class="sess-head" data-toggle="' + sess.id + '" aria-expanded="' + open + '">' +
        '<span class="sess-name">' + esc(sess.name) + '<small>' + sess.day + '</small></span>' +
        '<span class="sess-meta"><b data-scount="' + sess.id + '"></b><span data-stime="' + sess.id + '"></span></span>' + ICON_CHEV +
      '</button>' +
      '<div class="stack"' + (open ? "" : " hidden") + '>' +
        (slots.length ? groupCards(slots, sets) : '<p class="empty">Every set in this session is logged.</p>') +
      '</div></section>';
  }).join("");
}

function buildUnits(){
  const out = [];
  PLAN.forEach((sess, si) => {
    const seen = {};
    sess.slots.forEach((s, pi) => {
      if (!s.g) { out.push({ slots: [s], tier: s.tier, si, pi, sess }); return; }
      const key = s.g + "|" + s.tier;
      if (seen[key]) { seen[key].slots.push(s); return; }
      seen[key] = { slots: [s], tier: s.tier, si, pi, sess };
      out.push(seen[key]);
    });
  });
  return out.sort((a, b) => a.tier - b.tier || a.si - b.si || a.pi - b.pi);
}

function nextUpHTML(sets){
  const units = buildUnits().filter(u => UI.show === "all" || u.slots.some(s => remaining(s, sets) > 0));
  const budget = Number(UI.budget) * 60;
  let html = "", cum = 0, cutDone = false, lastTier = 0;
  const label = s => SESS_OF[s.id].name + " · " + SESS_OF[s.id].day;
  units.forEach(u => {
    if (u.tier !== lastTier) { html += '<h2 class="tier-h">' + TIER_H[u.tier] + '</h2>'; lastTier = u.tier; }
    const secs = u.slots.reduce((a, s) => a + slotSecs(s, sets), 0);
    let over = false;
    if (budget) {
      if (!cutDone && cum + secs > budget && secs > 0) { html += '<div class="cut">' + UI.budget + ' min ends here</div>'; cutDone = true; }
      over = cutDone;
      cum += secs;
    }
    html += '<div class="unit' + (over ? " over" : "") + '">' + groupCards(u.slots, sets, label) + '</div>';
  });
  if (!units.length) html += '<p class="empty">Every set this week is logged.</p>';
  return html;
}

function settingsHTML(){
  const bk = daysSince(D.lastBackup);
  const n = totalLogged();
  return myExHTML() +
    '<section class="sec"><h2>Gyms</h2><p>Machine and cable exercises appear twice in each <b>Swap</b> list, once for Work and once for Home, because their weight stacks are calibrated differently. Each version keeps its own weights and progress.</p>' +
      '<p>Free-weight exercises appear once and share their history between gyms. Whatever you pick in Swap stays picked until you change it.</p></section>' +
    '<section class="sec"><h2>Block</h2><p>Week 1 starts on this Monday. Deloads fall in weeks 6 and 12.</p>' +
      '<label class="datef" for="blockStart">Week 1 begins <input type="date" id="blockStart" value="' + esc(D.settings.blockStart || DEFAULT_START) + '"></label></section>' +
    '<section class="sec"><h2>Backup</h2><p>Your log is stored on this phone only. Export a backup now and then and keep it in iCloud Drive or Files.</p>' +
      '<dl class="kv"><dt>Sets logged</dt><dd>' + n + '</dd><dt>Last backup</dt><dd>' + (bk == null ? "Never" : bk === 0 ? "Today" : bk + (bk === 1 ? " day ago" : " days ago")) + '</dd></dl>' +
      '<div class="btns" style="margin-top:14px"><button type="button" class="btn primary" id="exportBtn">Export backup</button><button type="button" class="btn" id="restoreBtn">Restore from file</button></div></section>' +
    '<section class="sec"><h2>Install</h2>' + (isStandalone()
      ? '<p>Running from your home screen. It works offline; updates arrive the next time you open it with a connection.</p>'
      : '<ol class="steps"><li>Open this page in Safari.</li><li>Tap the Share button.</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>') + '</section>' +
    '<section class="sec"><h2>About</h2><dl class="kv"><dt>Programme</dt><dd>Stretch/Contraction v' + esc(P.version) + '</dd><dt>App</dt><dd>' + APP_VERSION + '</dd></dl></section>';
}

function myExHTML(){
  const blocks = [];
  PLAN.forEach(sess => sess.slots.forEach(slot => {
    const cus = variantsFor(slot).filter(v => v.custom);
    if (!cus.length) return;
    blocks.push('<div class="myx"><div class="myx-h"><b>' + esc(slot.name) + '</b><small>' + esc(sess.name) + ' · ' + slot.seq + '</small></div>' +
      cus.map((c, ix) => '<div class="myx-r"><span>' + esc(c.n) + ' <small>· ' + (c.machine ? "machine: Work and Home kept separate" : "free weight") + '</small></span>' +
        '<button type="button" class="linkb" data-rmx="' + slot.id + '|' + ix + '">Remove</button></div>').join("") +
      '</div>');
  }));
  return '<section class="sec"><h2>My exercises</h2><p>Add your own alternative to any exercise. It appears in that exercise\'s <b>Swap</b> list, as Work and Home versions if it\'s a machine.</p>' +
    blocks.join("") +
    '<div class="btns" style="margin-top:12px"><button type="button" class="btn primary" data-addx="">Add an exercise</button></div></section>';
}

// Sets saved under an earlier week than the day they were ticked (the app stayed on last week after a weekend).
function misfiled(){
  const keep = UI.keepFiled || {}, out = [];
  Object.keys(D.weeks).forEach(wk => {
    const sets = setsOf(wk);
    Object.keys(sets).forEach(k => {
      const e = sets[k]; if (!e || !e.d) return;
      const real = iso(mondayOf(parseISO(e.d)));
      if (real > wk && !keep[wk + "|" + k]) out.push({ wk, k, real });
    });
  });
  return out;
}
function moveMisfiled(){
  let moved = 0, clash = 0;
  UI.keepFiled = UI.keepFiled || {};
  misfiled().forEach(m => {
    const e = D.weeks[m.wk].sets[m.k];
    D.weeks[m.real] = D.weeks[m.real] || { sets: {} };
    if (D.weeks[m.real].sets[m.k]) { clash++; UI.keepFiled[m.wk + "|" + m.k] = 1; return; } // that set is already logged there
    D.weeks[m.real].sets[m.k] = e;
    delete D.weeks[m.wk].sets[m.k];
    if (!Object.keys(D.weeks[m.wk].sets).length) delete D.weeks[m.wk];
    moved++;
  });
  save(); saveUI();
  S.week = thisWeek(); S.nav = false; render(); window.scrollTo(0, 0);
  toast("Moved " + moved + " set" + (moved === 1 ? "" : "s") + (clash ? ". " + clash + " stayed put: that set was already logged in its own week." : ""));
}
function keepMisfiled(){
  UI.keepFiled = UI.keepFiled || {};
  misfiled().forEach(m => { UI.keepFiled[m.wk + "|" + m.k] = 1; });
  saveUI(); render();
}
const weekRange = wk => {
  const a = parseISO(wk), b = parseISO(addDays(wk, 6));
  return a.getMonth() === b.getMonth() ? a.getDate() + "–" + b.getDate() + " " + MON[b.getMonth()]
    : a.getDate() + " " + MON[a.getMonth()] + " – " + b.getDate() + " " + MON[b.getMonth()];
};

function bannersHTML(){
  let html = "";
  const cur = thisWeek();
  if (S.week !== cur) html += '<div class="banner warn"><span><b>' + (S.week < cur ? "This is a past week." : "This is a future week.") +
    '</b> Sets you tick here are saved to ' + weekRange(S.week) + '.</span><button type="button" class="linkb" id="thisWk2">Go to this week</button></div>';
  const mf = misfiled();
  if (mf.length) {
    const from = Array.from(new Set(mf.map(m => m.wk))), to = Array.from(new Set(mf.map(m => m.real)));
    html += '<div class="banner warn col"><span><b>' + mf.length + ' set' + (mf.length === 1 ? " was" : "s were") + ' saved to the wrong week.</b> ' +
      (mf.length === 1 ? "It was" : "They were") + ' ticked during ' + to.map(weekRange).join(", ") + ' but saved under ' + from.map(weekRange).join(", ") +
      ', because the app was still showing that week.</span><span class="bbtns"><button type="button" class="btn primary" data-movefiled>Move to the right week</button>' +
      '<button type="button" class="btn" data-keepfiled>Leave them</button></span></div>';
  }
  const n = weekNo(S.week);
  if (isDeload(S.week)) html += '<div class="banner"><span><b>Deload week.</b> One top set per exercise at ~65% of your normal load, stopping 3 reps short. Weights below are already scaled.</span></div>';
  else if (n < 1) html += '<div class="banner info"><span>This week is before the block starts (' + dateShort(D.settings.blockStart || DEFAULT_START) + ').</span><button type="button" class="linkb" data-tab="settings">Change</button></div>';
  const bk = daysSince(D.lastBackup), logged = totalLogged();
  if (logged >= 30 && (bk == null || bk >= 14)) html += '<div class="banner"><span>' + (bk == null ? "You haven't backed up your log yet." : "Last backup was " + bk + " days ago.") + '</span><button type="button" class="linkb" data-tab="settings">Back up</button></div>';
  if (!isStandalone() && isIOS() && !UI.installHidden) html += '<div class="banner info"><span>Install it: tap Share, then <b>Add to Home Screen</b>.</span><button type="button" class="linkb" id="hideInstall">Hide</button></div>';
  return html;
}

function render(){
  if (PAD.inp) closePad(true);
  buildHist();
  const sets = setsOf(S.week);
  document.querySelectorAll(".tabs [data-tab]").forEach(b => { if (b.dataset.tab === UI.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  let html = "";
  if (UI.tab === "settings") html = settingsHTML();
  else {
    html += '<div class="controls">' + segHTML("show", [["all", "All"], ["todo", "To do"]]) +
      (UI.tab === "next" ? '<span class="ctl-l">Time</span>' + segHTML("budget", [[20, "20"], [30, "30"], [45, "45"], [0, "Any"]]) : '') + '</div>';
    html += bannersHTML();
    html += UI.tab === "next" ? nextUpHTML(sets) : sessionsHTML(sets);
  }
  $("#main").innerHTML = html;
  refresh();
}
// Redraw one exercise in place (after a swap), so nothing else on the page moves.
function rerenderSlot(id){
  buildHist();
  const old = document.querySelector('.ex[data-slot="' + id + '"]');
  if (!old) { render(); return; }
  const tmp = document.createElement("div");
  tmp.innerHTML = exHTML(SLOT[id], setsOf(S.week));
  old.replaceWith(tmp.firstElementChild);
  refresh();
}

function refresh(){
  buildHist();
  const sets = setsOf(S.week);
  const active = PAD.inp;
  document.querySelectorAll(".set[data-key]").forEach(row => {
    const key = row.dataset.key, slot = SLOT[row.dataset.slot], i = Number(row.dataset.i);
    const o = chosen(slot), log = sets[key];
    row.classList.toggle("done", !!log);
    const tick = row.querySelector(".tick");
    tick.setAttribute("aria-pressed", String(!!log));
    tick.setAttribute("aria-label", (log ? "Undo " : "Log ") + row.querySelector(".sl b").textContent + " set");
    row.querySelector(".sl small").textContent = log ? dayShort(log.d) : "";
    const bits = [];
    if (log && log.v && log.v !== o.v) bits.push("as " + log.v);
    if (log && o.loc && (log.loc || "work") !== o.loc) bits.push("at " + LOCL[log.loc || "work"]);
    row.querySelector(".alt").textContent = bits.length ? "Logged " + bits.join(" ") : "";
    row.querySelectorAll("input[data-f]").forEach(inp => {
      if (inp === active) return;
      const f = inp.dataset.f, dk = S.week + "|" + inp.id;
      let val;
      if (log) val = log[f];
      else if (dk in S.drafts) val = S.drafts[dk];
      else val = f === "w" ? prefill(slot, i, o) : null;
      inp.value = val == null ? "" : (typeof val === "number" ? fmtW(val) : val);
    });
  });
  document.querySelectorAll(".ex[data-slot]").forEach(ex => {
    const slot = SLOT[ex.dataset.slot];
    ex.classList.toggle("complete", remaining(slot, sets) === 0);
    ex.querySelector(".last").innerHTML = lastHTML(slot, chosen(slot));
  });
  PLAN.forEach(sess => {
    const b = document.querySelector('[data-scount="' + sess.id + '"]'); if (!b) return;
    const tot = sess.slots.reduce((a, s) => a + target(s), 0);
    const dn = sess.slots.reduce((a, s) => a + doneCount(s, sets), 0);
    const secs = sess.slots.reduce((a, s) => a + slotSecs(s, sets), 0);
    b.textContent = dn + " / " + tot;
    document.querySelector('[data-stime="' + sess.id + '"]').textContent = dn >= tot ? "Done" : "≈ " + fmtMin(secs) + " left";
    b.closest(".sess").classList.toggle("full", dn >= tot);
  });
  renderHeader(sets);
}

function lastHTML(slot, o){
  const ext = EXT[slot.ext];
  const fmt = x => ((slot.bw || x.w == null) ? "" : fmtW(x.w) + (slot.added ? " kg added × " : " kg × ")) + x.r + " reps" +
    (x.x ? " " + (ext.label || "+") + x.x : "") + " · " + dateShort(x.d || x.wk);
  const hint = e => {
    if (isDeload(S.week)) return "";
    if (e.r >= slot.hi) return ' <span class="hint up">Top of range: add load</span>';
    if (e.r < slot.lo) return ' <span class="hint down">Under range: hold the load</span>';
    return "";
  };
  const lead = ext.flat ? "Last set 1" : "Last top set";
  if (!o.loc) { const e = lastTop(o.v, null); return e ? esc(lead + ": " + fmt(e)) + hint(e) : ""; }
  const here = o.loc, there = otherLoc(here);
  const e = lastTop(o.v, here), x = lastTop(o.v, there);
  let s = e ? esc(lead + " at " + LOCL[here] + ": " + fmt(e)) + hint(e) : "";
  // the other gym's numbers, for reference only (different calibration), when they're newer or all there is
  if (x && (!e || (x.d || x.wk) > (e.d || e.wk))) s += (s ? "<br>" : "") + '<span class="other">' + esc("At " + LOCL[there] + ": " + fmt(x)) + '</span>';
  return s;
}

function renderHeader(sets){
  sets = sets || setsOf(S.week);
  const n = weekNo(S.week);
  $("#wkN").innerHTML = (n < 1 ? "Before block" : n > 12 ? "Week " + n + " · block done" : "Week " + n + " of 12") + (isDeload(S.week) ? ' <span class="badge">Deload</span>' : "");
  $("#wkD").textContent = weekRange(S.week);
  $("#thisWk").hidden = S.week === thisWeek();
  let tot = 0, dn = 0, secs = 0, today = 0;
  const td = todayISO();
  $("#bar").innerHTML = PLAN.map(sess => {
    const t = sess.slots.reduce((acc, s) => acc + target(s), 0);
    const d = sess.slots.reduce((acc, s) => acc + doneCount(s, sets), 0);
    tot += t; dn += d; secs += sess.slots.reduce((acc, s) => acc + slotSecs(s, sets), 0);
    return '<div class="bseg' + (d >= t ? " full" : "") + '" style="--n:' + t + '"><div class="btrack"><i style="--p:' + (t ? Math.round(d / t * 100) : 0) + '%"></i></div><span>' + sess.short + '</span></div>';
  }).join("");
  for (const k in sets) if (sets[k] && sets[k].d === td) today++;
  $("#setsDone").textContent = dn + " / " + tot;
  $("#timeLeft").textContent = (dn >= tot ? "Week complete" : "≈ " + fmtMin(secs) + " left") + (today ? " · " + today + " today" : "");
}

/* ================= writing ================= */
function putSet(wk, key, val){
  D.weeks[wk] = D.weeks[wk] || { sets: {} };
  if (val) D.weeks[wk].sets[key] = val; else delete D.weeks[wk].sets[key];
  if (!Object.keys(D.weeks[wk].sets).length) delete D.weeks[wk];
  save(); askPersist();
}

/* ================= interactions ================= */
function onTick(key){
  const row = document.querySelector('.set[data-key="' + key + '"]'); if (!row) return;
  const slot = SLOT[row.dataset.slot];
  const sets = setsOf(S.week), log = sets[key];
  const inp = f => row.querySelector('input[data-f="' + f + '"]');
  if (log) {
    ["w", "r", "x"].forEach(f => { const el = inp(f); if (el) S.drafts[S.week + "|" + el.id] = log[f] == null ? "" : fmtW(log[f]); });
    putSet(S.week, key, null);
  } else {
    const r = inp("r") ? num(inp("r").value) : null;
    if (r == null || r < 0) {
      row.classList.add("need"); openPad(inp("r"));
      setTimeout(() => row.classList.remove("need"), 1200);
      return;
    }
    if (PAD.inp && row.contains(PAD.inp)) closePad(false);
    const o = chosen(slot);
    const entry = { w: slot.bw ? null : num(inp("w") && inp("w").value), r, x: inp("x") ? num(inp("x").value) : null,
                    v: o.v, d: todayISO(), t: new Date().toISOString(), loc: o.loc };
    ["w", "r", "x"].forEach(f => { const el = inp(f); if (el) delete S.drafts[S.week + "|" + el.id]; });
    putSet(S.week, key, entry);
    startRest(slot);
    keepAwake();
  }
  refresh();
}
function onEditDone(inputEl){
  const row = inputEl.closest(".set"); if (!row || !row.classList.contains("done")) return;
  const key = row.dataset.key, log = setsOf(S.week)[key]; if (!log) return;
  const f = inputEl.dataset.f, v = num(inputEl.value);
  if (f === "r" && v == null) { inputEl.value = fmtW(log.r); return; }
  putSet(S.week, key, Object.assign({}, log, { [f]: v }));
  refresh();
}
/* number pad */
const PAD = { inp: null, fresh: true, start: "", step: 1 };
const padOpen = () => !!PAD.inp;
const rowFields = row => Array.from(row.querySelectorAll("input[data-f]"));
function openPad(inp){
  if (!inp) return;
  if (PAD.inp && PAD.inp !== inp) commitPad();
  PAD.inp = inp; PAD.fresh = true; PAD.start = inp.value;
  document.querySelectorAll(".fld.editing").forEach(x => x.classList.remove("editing"));
  inp.closest(".fld").classList.add("editing");
  const row = inp.closest(".set"), slot = SLOT[row.dataset.slot], f = inp.dataset.f;
  const done = row.classList.contains("done"), fields = rowFields(row);
  $("#padTitle").textContent = chosen(slot).v;
  $("#padSub").textContent = row.querySelector(".sl b").textContent + " · " +
    (f === "w" ? (slot.added ? "added kg" : "kg") : f === "r" ? "reps, target " + slot.lo + "–" + slot.hi : (inp.closest(".fld").querySelector("span").textContent + " count"));
  PAD.step = f === "w" ? 2.5 : 1;
  $("#padMinus").textContent = "−" + fmtW(PAD.step);
  $("#padPlus").textContent = "+" + fmtW(PAD.step);
  $("#padDot").disabled = f !== "w";
  $("#padNext").disabled = fields.indexOf(inp) >= fields.length - 1;
  $("#padGo").textContent = done ? "Done" : "Log set";
  showPadVal();
  const pad = $("#pad");
  pad.hidden = false; document.body.classList.add("pad-open");
  // keep the set being edited visible above the pad
  requestAnimationFrame(() => {
    const r = row.getBoundingClientRect(), below = window.innerHeight - pad.offsetHeight - 10, above = $(".top").getBoundingClientRect().bottom + 8;
    if (r.bottom > below) window.scrollBy({ top: r.bottom - below, behavior: "smooth" });
    else if (r.top < above) window.scrollBy({ top: r.top - above, behavior: "smooth" });
  });
}
function showPadVal(){
  const v = PAD.inp.value, el = $("#padVal");
  el.textContent = v === "" ? (PAD.inp.placeholder || "–") : v;
  el.classList.toggle("ph", v === "");
}
function setPadVal(v){ PAD.inp.value = v; S.drafts[S.week + "|" + PAD.inp.id] = v; PAD.fresh = false; showPadVal(); }
function padKey(k){
  if (!PAD.inp) return;
  const f = PAD.inp.dataset.f;
  let v = PAD.fresh ? "" : PAD.inp.value;
  if (k === "back") v = PAD.inp.value.slice(0, -1);
  else if (k === ".") { if (f !== "w" || v.indexOf(".") >= 0) return; v = (v || "0") + "."; }
  else {
    const [a, b] = v.split(".");
    if (b != null ? b.length >= 2 : (a || "").length >= 3) return;
    v = (v === "0" ? "" : v) + k;
  }
  setPadVal(v);
}
function padAdjust(sign){
  if (!PAD.inp) return;
  const slot = SLOT[PAD.inp.closest(".set").dataset.slot];
  const cur = num(PAD.inp.value);
  const n = cur == null ? (PAD.inp.dataset.f === "r" ? slot.lo : 0) : Math.max(0, cur + sign * PAD.step);
  setPadVal(fmtW(n));
  PAD.fresh = true; // typing straight after −/+ starts a new number rather than adding digits to this one
}
// edits to an already-logged set are saved when you leave the field
function commitPad(){
  const inp = PAD.inp; if (!inp) return;
  if (inp.value !== PAD.start && inp.closest(".set").classList.contains("done")) onEditDone(inp);
}
function closePad(commit){
  if (!PAD.inp) return;
  if (commit !== false) commitPad();
  document.querySelectorAll(".fld.editing").forEach(x => x.classList.remove("editing"));
  PAD.inp = null;
  $("#pad").hidden = true; document.body.classList.remove("pad-open");
  if (renderLater) { renderLater = false; render(); }
}
function padNext(){
  if (!PAD.inp) return;
  const fields = rowFields(PAD.inp.closest(".set")), i = fields.indexOf(PAD.inp);
  if (i < fields.length - 1) openPad(fields[i + 1]);
}
function padGo(){
  if (!PAD.inp) return;
  const row = PAD.inp.closest(".set");
  if (row.classList.contains("done")) { closePad(true); return; }
  onTick(row.dataset.key);
}

function pickOption(slot, key){
  const o = optionsFor(slot).find(x => optKey(x) === key); if (!o) return;
  D.settings.choice[slot.id] = { v: o.v, loc: o.loc };
  save(); rerenderSlot(slot.id);
}

/* rest timer */
let restEnd = 0, restTimer = null, restHide = null, restHideAt = 0;
function hideRest(){ clearInterval(restTimer); clearTimeout(restHide); restEnd = 0; restHideAt = 0; $("#rest").hidden = true; }
function startRest(slot){
  const sess = SESS_OF[slot.id];
  let nextTxt = "Next set";
  if (slot.g) {
    const grp = sess.slots.filter(s => s.g === slot.g);
    const nx = grp[(grp.indexOf(slot) + 1) % grp.length], no = chosen(nx);
    nextTxt = (slot.rest > 0 ? "Then " : "Now ") + nx.seq + " · " + no.v + (no.loc ? " (" + LOCL[no.loc] + ")" : "");
  }
  clearInterval(restTimer); clearTimeout(restHide);
  const box = $("#rest");
  box.hidden = false; box.classList.remove("go");
  $("#restL").textContent = nextTxt;
  if (slot.rest <= 0) {
    $("#restH").textContent = "Superset"; $("#restT").textContent = "Go";
    box.classList.add("go");
    restEnd = 0; restHideAt = Date.now() + 4000;
    restHide = setTimeout(hideRest, 4000);
    return;
  }
  $("#restH").textContent = "Rest";
  restEnd = Date.now() + slot.rest * 1000;
  restHideAt = restEnd + 6000;
  tickRest();
  restTimer = setInterval(tickRest, 250);
}
function tickRest(){
  const left = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000));
  $("#restT").textContent = fmtRest(left);
  if (left <= 0) {
    clearInterval(restTimer);
    $("#rest").classList.add("go"); $("#restH").textContent = "Rest over";
    clearTimeout(restHide);
    restHide = setTimeout(hideRest, Math.max(0, restHideAt - Date.now()));
  }
}
let wakeLock = null;
async function keepAwake(){
  try { if (!wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch (e) {}
}

let toastT = null;
function toast(msg){
  const t = $("#toast");
  t.innerHTML = '<span>' + esc(msg) + '</span>';
  t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3500);
}

/* your own exercises */
function openAdd(slotId){
  const sel = $("#axSlot");
  sel.innerHTML = PLAN.map(sess => '<optgroup label="' + esc(sess.name + " · " + sess.day) + '">' +
    sess.slots.map(s => '<option value="' + s.id + '">' + s.seq + " · " + esc(s.name) + '</option>').join("") + '</optgroup>').join("");
  sel.value = slotId || PLAN[0].slots[0].id;
  $("#axName").value = "";
  $("#axUse").checked = true;
  $("#axErr").hidden = true;
  syncAdd();
  $("#addSheet").hidden = false;
  setTimeout(() => $("#axName").focus(), 50);
}
function syncAdd(){
  const s = SLOT[$("#axSlot").value];
  $("#axMachine").checked = s ? isMachineKit(s.kit) : true;
  $("#axUseL").textContent = "Switch " + (s ? s.name : "the exercise") + " to it now";
}
function closeAdd(){ $("#addSheet").hidden = true; }
function saveAdd(){
  const slot = SLOT[$("#axSlot").value];
  const name = $("#axName").value.trim().replace(/\s+/g, " ");
  const machine = $("#axMachine").checked;
  const err = m => { const e = $("#axErr"); e.textContent = m; e.hidden = false; };
  if (!slot) return err("Pick the exercise this replaces.");
  if (!name) return err("Give the exercise a name.");
  if (name.indexOf("|") >= 0) return err("Leave out the | character.");
  const clash = variantsFor(slot).find(v => v.n.toLowerCase() === name.toLowerCase());
  if (clash) return err(slot.name + " already has " + clash.n + ". Pick it from Swap instead.");
  (D.settings.custom[slot.id] = D.settings.custom[slot.id] || []).push({ n: name, machine });
  if ($("#axUse").checked) {
    const cur = chosen(slot);
    D.settings.choice[slot.id] = { v: name, loc: machine ? (cur.loc || "work") : null };
  }
  save(); closeAdd();
  if (UI.tab === "settings") render(); else rerenderSlot(slot.id);
  toast("Added " + name);
}
function removeCustom(slotId, ix){
  const list = D.settings.custom[slotId] || [], c = list[ix]; if (!c) return;
  if (!window.confirm("Remove " + c.n + " from " + SLOT[slotId].name + "? Sets you've logged with it stay in your history.")) return;
  list.splice(ix, 1);
  if (!list.length) delete D.settings.custom[slotId];
  const ch = D.settings.choice[slotId];
  if (ch && ch.v === c.n) delete D.settings.choice[slotId];
  save(); render();
}

/* backup */
async function exportData(){
  const stamp = new Date().toISOString();
  const json = JSON.stringify({ app: "stretch-contraction-log", format: 1, exportedAt: stamp, data: D });
  const name = "gym-log-backup-" + todayISO() + ".json";
  let shared = false;
  try {
    const file = new File([json], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Gym log backup" });
      shared = true;
    }
  } catch (e) { if (e && e.name === "AbortError") return; }
  if (!shared) {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  D.lastBackup = stamp; save();
  toast("Backup exported");
  if (UI.tab === "settings") render();
}
function restoreFrom(file){
  const rd = new FileReader();
  rd.onload = () => {
    let obj = null;
    try { obj = JSON.parse(rd.result); } catch (e) {}
    if (!obj || obj.app !== "stretch-contraction-log" || !obj.data || typeof obj.data.weeks !== "object") { toast("That file isn't a Gym Log backup."); return; }
    const incoming = normalise(obj.data);
    const count = Object.values(incoming.weeks).reduce((a, w) => a + Object.keys((w && w.sets) || {}).length, 0);
    if (!window.confirm("Replace the log on this phone (" + totalLogged() + " sets) with this backup (" + count + " sets, " + (obj.exportedAt || "").slice(0, 10) + ")?")) return;
    D = incoming; save(); render();
    toast("Restored " + count + " sets");
  };
  rd.readAsText(file);
}

let renderLater = false;
function safeRender(){ if (padOpen()) renderLater = true; else render(); }

document.addEventListener("click", e => {
  const pad = $("#pad");
  const fld = e.target.closest("[data-fld]");
  if (fld && $("#main").contains(fld)) { openPad(fld.querySelector("input[data-f]")); return; }
  if (PAD.inp && !pad.contains(e.target)) closePad(true); // tapping anywhere else puts the pad away
  const t = e.target.closest("button"); if (!t) return;
  if (pad.contains(t)) {
    if (t.dataset.k) padKey(t.dataset.k);
    else if (t.id === "padMinus") padAdjust(-1);
    else if (t.id === "padPlus") padAdjust(1);
    else if (t.id === "padNext") padNext();
    else if (t.id === "padGo") padGo();
    else if (t.id === "padClose") closePad(true);
    return;
  }
  if (t.dataset.tick) { onTick(t.dataset.tick); return; }
  if (t.dataset.tab) { closePad(true); UI.tab = t.dataset.tab; saveUI(); render(); window.scrollTo(0, 0); return; }
  if (t.hasAttribute("data-movefiled")) { moveMisfiled(); return; }
  if (t.hasAttribute("data-keepfiled")) { keepMisfiled(); return; }
  if (t.dataset.set) {
    const p = t.dataset.set.split(":"), k = p[0], v = k === "budget" ? Number(p[1]) : p[1];
    UI[k] = v; saveUI(); render(); return;
  }
  if (t.dataset.toggle) {
    const id = t.dataset.toggle; UI.collapsed[id] = !UI.collapsed[id]; saveUI();
    t.setAttribute("aria-expanded", String(!UI.collapsed[id]));
    t.nextElementSibling.hidden = !!UI.collapsed[id]; return;
  }
  if (t.dataset.notes) {
    const box = document.getElementById("n-" + t.dataset.notes), open = box.hidden;
    box.hidden = !open; t.setAttribute("aria-expanded", String(open)); return;
  }
  if (t.hasAttribute("data-addx")) { openAdd(t.dataset.addx); return; }
  if (t.dataset.rmx) { const p = t.dataset.rmx.split("|"); removeCustom(p[0], Number(p[1])); return; }
  switch (t.id) {
    case "prevWk": S.week = addDays(S.week, -7); S.nav = S.week !== thisWeek(); render(); break;
    case "nextWk": S.week = addDays(S.week, 7); S.nav = S.week !== thisWeek(); render(); break;
    case "thisWk": case "thisWk2": S.week = thisWeek(); S.nav = false; render(); window.scrollTo(0, 0); break;
    case "hideInstall": UI.installHidden = true; saveUI(); render(); break;
    case "exportBtn": exportData(); break;
    case "restoreBtn": $("#restoreFile").click(); break;
    case "axCancel": closeAdd(); break;
    case "reloadBtn": location.reload(); break;
    case "restSkip": hideRest(); break;
    case "restAdd":
      clearTimeout(restHide);
      if (restEnd > Date.now()) restEnd += 15000;
      else { restEnd = Date.now() + 15000; $("#rest").classList.remove("go"); $("#restH").textContent = "Rest"; clearInterval(restTimer); restTimer = setInterval(tickRest, 250); }
      restHideAt = restEnd + 6000;
      tickRest(); break;
  }
});
$("#restoreFile").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) restoreFrom(f); e.target.value = ""; });
$("#addForm").addEventListener("submit", e => { e.preventDefault(); saveAdd(); });
$("#axSlot").addEventListener("change", syncAdd);
$("#addSheet").addEventListener("click", e => { if (e.target.id === "addSheet") closeAdd(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("#addSheet").hidden) { closeAdd(); return; }
  if (!PAD.inp) return;
  // a hardware keyboard (or desktop) can drive the pad too
  if (/^[0-9]$/.test(e.key)) padKey(e.key);
  else if (e.key === "." || e.key === ",") padKey(".");
  else if (e.key === "Backspace") padKey("back");
  else if (e.key === "Enter") padGo();
  else if (e.key === "Tab") padNext();
  else if (e.key === "Escape") closePad(true);
  else return;
  e.preventDefault();
});
const main = $("#main");
main.addEventListener("change", e => {
  const sel = e.target.closest("select[data-variant]");
  if (sel) {
    const slot = SLOT[sel.dataset.variant], pick = sel.value;
    sel.value = "";
    if (pick === "__add__") { openAdd(slot.id); return; }
    if (pick) pickOption(slot, pick);
    return;
  }
  if (e.target.id === "blockStart" && e.target.value) {
    D.settings.blockStart = iso(mondayOf(parseISO(e.target.value)));
    e.target.value = D.settings.blockStart;
    save(); renderHeader(); return;
  }
});

/* coming back to the app */
// Move to the new week unless you deliberately went to another week. iOS doesn't always report the app
// coming back to the front, so this also runs on focus, on pageshow and every 30 seconds.
function checkWeek(){
  const now = thisWeek();
  if (S.week !== now && !S.nav) { S.week = now; safeRender(); return true; }
  return false;
}
function onResume(){
  if (checkWeek()) return;
  const box = $("#rest"), t = Date.now();
  if (!box.hidden) {
    if (restEnd > t) { tickRest(); clearInterval(restTimer); restTimer = setInterval(tickRest, 250); }
    else if (t >= restHideAt) hideRest(); // it ran out while the phone was locked
  }
  if (wakeLock === null && !box.hidden) keepAwake();
  if (!padOpen()) refresh();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") onResume(); });
window.addEventListener("pageshow", onResume);
window.addEventListener("focus", onResume);
setInterval(() => { if (document.visibilityState === "visible") onResume(); }, 30000);
window.addEventListener("storage", e => { if (e.key === KEY) { D = loadData(); safeRender(); } });

/* ================= offline + updates ================= */
function showUpdate(){
  const t = $("#toast");
  t.innerHTML = '<span>A new version is ready.</span> <button type="button" class="toast-act" id="reloadBtn">Reload</button>';
  t.hidden = false; clearTimeout(toastT);
}
const hadController = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then(reg => {
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (nw) nw.addEventListener("statechange", () => { if (nw.state === "activated" && hadController) showUpdate(); });
      });
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}

if (["week", "next", "settings"].indexOf(UI.tab) < 0) UI.tab = "week";
render();
window.__gymlog = { get data(){ return D; }, version: APP_VERSION }; // for testing/debugging
})();
