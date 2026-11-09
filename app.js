/* Stretch/Contraction Log — app logic. All data lives on this phone (localStorage), with JSON backup/restore. */
(function () {
"use strict";
const APP_VERSION = "1.0.0";
const P = window.SC_PLAN;
const { PLAN, KIT, DEFAULT_HOME, EXT, TIER, TIER_H } = P;
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

/* ================= storage (this phone) ================= */
const KEY = "sc44:data", UIKEY = "sc44:ui";
function normalise(d){
  if (!d || typeof d !== "object") d = {};
  return {
    v: 1,
    weeks: (d.weeks && typeof d.weeks === "object") ? d.weeks : {},
    settings: Object.assign({ blockStart: DEFAULT_START, homeKit: null }, d.settings || {}),
    lastBackup: d.lastBackup || null
  };
}
function loadData(){ try { return normalise(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return normalise(null); } }
let D = loadData();
let storageOK = true;
function save(){
  try { localStorage.setItem(KEY, JSON.stringify(D)); storageOK = true; }
  catch (e) { storageOK = false; toast("Couldn't save on this phone. Export a backup from Settings now."); }
}
const UI = Object.assign({ loc: "work", tab: "week", show: "all", budget: 0, collapsed: {}, variant: {}, installHidden: false },
  (() => { try { return JSON.parse(localStorage.getItem(UIKEY)) || {}; } catch (e) { return {}; } })());
const saveUI = () => { try { localStorage.setItem(UIKEY, JSON.stringify(UI)); } catch (e) {} };
let persistAsked = false;
function askPersist(){
  if (persistAsked) return; persistAsked = true;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
}

const S = { week: thisWeek(), drafts: {} };
let HIST = {};

/* ================= derived ================= */
const weekNo = wk => Math.round((parseISO(wk) - mondayOf(parseISO(D.settings.blockStart || DEFAULT_START))) / 864e5 / 7) + 1;
const isDeload = wk => { const n = weekNo(wk); return n === 6 || n === 12; };
const homeKit = () => D.settings.homeKit || DEFAULT_HOME;
function kitOK(k){
  if (UI.loc === "work") return true;
  const have = homeKit();
  return (k || []).every(tag => tag.split("|").some(t => have.includes(t)));
}
const variantsFor = slot => [{ n: slot.name, k: slot.kit, primary: true }].concat(slot.swaps || []);
const slotAvailable = slot => variantsFor(slot).some(v => kitOK(v.k));
const target = slot => isDeload(S.week) ? 1 : slot.w.length;
const setsOf = wk => (D.weeks[wk] && D.weeks[wk].sets) || {};
function doneCount(slot, sets){
  let c = 0; const t = target(slot);
  for (let i = 0; i < t; i++) if (sets[slot.id + "_" + i]) c++;
  return c;
}
const remaining = (slot, sets) => target(slot) - doneCount(slot, sets);
const slotSecs = (slot, sets) => remaining(slot, sets) * (WORK_S + slot.rest);
const variantKey = slot => S.week + ":" + UI.loc + ":" + slot.id;

function chosenVariant(slot, sets){
  const manual = UI.variant[variantKey(slot)];
  const vs = variantsFor(slot);
  if (manual && vs.some(v => v.n === manual)) return manual;
  sets = sets || setsOf(S.week);
  let lastLogged = null;
  for (let i = 0; i < slot.w.length; i++) { const e = sets[slot.id + "_" + i]; if (e && e.v) lastLogged = e.v; }
  const lv = lastLogged && vs.find(v => v.n === lastLogged);
  if (lv && kitOK(lv.k)) return lastLogged;
  const ok = vs.find(v => kitOK(v.k));
  return (ok || vs[0]).n;
}

function buildHist(){
  HIST = {};
  Object.keys(D.weeks).sort().reverse().forEach(wk => {
    const sets = setsOf(wk), dl = isDeload(wk);
    Object.keys(sets).sort().forEach(k => {
      const e = sets[k]; if (!e || !e.v) return;
      const i = Number(k.split("_").pop());
      (HIST[e.v] = HIST[e.v] || []).push({ wk, i, w: e.w, r: e.r, x: e.x, d: e.d, dl });
    });
  });
}
function basePrefill(slot, i, v){
  const h = HIST[v] || [];
  const ok = e => e.wk < S.week && e.w != null && !e.dl;
  const exact = h.find(e => ok(e) && e.i === i);
  if (exact) return exact.w;
  if (i > 0) { // a back-off with no history of its own: nearest earlier back-off from the latest week
    const prev = h.filter(e => ok(e) && e.i > 0 && e.i < i);
    if (prev.length) { const wk = prev[0].wk; return prev.filter(e => e.wk === wk).sort((a, b) => b.i - a.i)[0].w; }
  }
  if (v === slot.name && slot.w[i] != null) return slot.w[i];
  if (i > 0) { const top = h.find(e => ok(e) && e.i === 0); if (top) return roundW(top.w * 0.9); }
  return null;
}
function prefill(slot, i, v){
  if (slot.bw) return null;
  if (isDeload(S.week)) { const top = basePrefill(slot, 0, v); return top == null ? null : roundW(top * 0.65); }
  return basePrefill(slot, i, v);
}
const lastTop = (slot, v) => (HIST[v] || []).find(e => e.wk < S.week && e.i === 0 && !e.dl && e.r != null) || null;
const totalLogged = () => Object.values(D.weeks).reduce((a, w) => a + Object.keys((w && w.sets) || {}).length, 0);

/* ================= rendering ================= */
function segHTML(key, opts){
  return '<div class="seg" role="group">' + opts.map(o =>
    '<button type="button" data-set="' + key + ':' + o[0] + '" aria-pressed="' + (String(UI[key]) === String(o[0])) + '">' + o[1] + '</button>').join("") + '</div>';
}

function exHTML(slot, sets){
  const vs = variantsFor(slot), cur = chosenVariant(slot, sets);
  const curV = vs.find(v => v.n === cur) || vs[0];
  const ext = EXT[slot.ext], dl = isDeload(S.week);
  const avail = slotAvailable(slot);
  const restTxt = slot.rest > 0 ? "rest " + fmtRest(slot.rest) : "straight into the next exercise";
  const topTxt = dl ? "Deload: one set at ~65%, stop 3 short" : (ext.flat ? ext.top : ext.top + "; back-offs ~10% lighter, to failure");
  let rows = "";
  for (let i = 0; i < target(slot); i++) rows += setRowHTML(slot, i, ext, dl);
  const notes = [slot.note, curV.note].filter(Boolean);
  return '<article class="ex' + (avail ? "" : " na") + '" data-slot="' + slot.id + '">' +
    '<div class="ex-head"><span class="seq">' + slot.seq + '</span><div class="ex-title"><h3>' + esc(cur) + '</h3>' +
      (cur !== slot.name ? '<div class="for">in place of ' + esc(slot.name) + '</div>' : '') +
    '</div><span class="tier t' + slot.tier + '">' + TIER[slot.tier] + '</span></div>' +
    '<div class="meta">' + slot.lo + '–' + slot.hi + ' reps · ' + restTxt + ' · ' + topTxt + '</div>' +
    ((vs.length > 1 || notes.length) ? '<div class="acts">' +
      (vs.length > 1 ? '<span class="pill-sel"><select data-variant="' + slot.id + '" id="v-' + slot.id + '" aria-label="Swap ' + esc(cur) + ' for another exercise">' +
        '<option value="" selected disabled>Swap</option>' +
        vs.map(v => '<option value="' + esc(v.n) + '">' + (v.n === cur ? "✓ " : "") + esc(v.n) + (v.primary ? " (plan)" : "") + (kitOK(v.k) ? "" : " · no kit") + '</option>').join("") +
        '</select></span>' : '') +
      (notes.length ? '<button type="button" class="mini" data-notes="' + slot.id + '" aria-expanded="false" aria-controls="n-' + slot.id + '">Notes</button>' : '') +
      '</div>' : '') +
    (notes.length ? '<div class="notes" id="n-' + slot.id + '" hidden>' + notes.map(n => '<p>' + esc(n) + '</p>').join("") + '</div>' : '') +
    (!avail ? '<p class="na-note">Needs the gym: none of the swaps fit your home kit.</p>' : '') +
    '<div class="last"></div>' +
    '<div class="sets">' + rows + '</div></article>';
}

function setRowHTML(slot, i, ext, dl){
  const key = slot.id + "_" + i;
  const lab = ext.flat ? String(i + 1) : (i === 0 ? "Top" : "B" + i);
  const xl = (!ext.flat && i === 0 && ext.label && !dl) ? ext.label : null;
  const wf = slot.bw ? '<span class="bw">BW</span>' :
    '<label class="fld w"><input id="w-' + key + '" data-f="w" inputmode="decimal" autocomplete="off" enterkeyhint="next" aria-label="' + lab + ' weight in kg"><span>' + (slot.added ? "+kg" : "kg") + '</span></label>';
  const xf = xl ? '<label class="fld x"><span>' + xl + '</span><input id="x-' + key + '" data-f="x" inputmode="numeric" autocomplete="off" enterkeyhint="done" aria-label="' + xl + ' count"></label>' : '<span></span>';
  return '<div class="set" data-key="' + key + '" data-slot="' + slot.id + '" data-i="' + i + '">' +
    '<span class="sl"><b>' + lab + '</b><small></small></span>' + wf +
    '<label class="fld r"><input id="r-' + key + '" data-f="r" inputmode="numeric" autocomplete="off" enterkeyhint="done" placeholder="' + slot.lo + '–' + slot.hi + '" aria-label="' + lab + ' reps, target ' + slot.lo + ' to ' + slot.hi + '"></label>' +
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
  const avail = units.filter(u => u.slots.every(slotAvailable));
  const gym = units.filter(u => !u.slots.every(slotAvailable));
  const budget = Number(UI.budget) * 60;
  let html = "", cum = 0, cutDone = false, lastTier = 0;
  const label = s => SESS_OF[s.id].name + " · " + SESS_OF[s.id].day;
  avail.forEach(u => {
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
  if (!avail.length) html += '<p class="empty">Nothing left that your kit here can do.</p>';
  if (gym.length) {
    html += '<h2 class="tier-h">Needs the gym</h2>';
    gym.forEach(u => { html += '<div class="unit">' + groupCards(u.slots, sets, label) + '</div>'; });
  }
  return html;
}

function settingsHTML(){
  const have = homeKit();
  const bk = daysSince(D.lastBackup);
  const n = totalLogged();
  return '<section class="sec"><h2>Home kit</h2><p>Tick what you have at home. With Home selected, each exercise switches to the first swap your kit allows. At work the full gym is assumed.</p>' +
      '<div class="kit">' + KIT.map(k => '<label for="kit-' + k[0] + '"><input type="checkbox" id="kit-' + k[0] + '" data-kit="' + k[0] + '"' + (have.includes(k[0]) ? " checked" : "") + '>' + k[1] + '</label>').join("") + '</div></section>' +
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

function bannersHTML(){
  let html = "";
  const n = weekNo(S.week);
  if (isDeload(S.week)) html += '<div class="banner"><span><b>Deload week.</b> One top set per exercise at ~65% of your normal load, stopping 3 reps short. Weights below are already scaled.</span></div>';
  else if (n < 1) html += '<div class="banner info"><span>This week is before the block starts (' + dateShort(D.settings.blockStart || DEFAULT_START) + ').</span><button type="button" class="linkb" data-tab="settings">Change</button></div>';
  if (UI.loc === "home" && !D.settings.homeKit) html += '<div class="banner info"><span>Home kit isn\'t set yet, so this assumes dumbbells and a bench.</span><button type="button" class="linkb" data-tab="settings">Set kit</button></div>';
  const bk = daysSince(D.lastBackup), logged = totalLogged();
  if (logged >= 30 && (bk == null || bk >= 14)) html += '<div class="banner"><span>' + (bk == null ? "You haven't backed up your log yet." : "Last backup was " + bk + " days ago.") + '</span><button type="button" class="linkb" data-tab="settings">Back up</button></div>';
  if (!isStandalone() && isIOS() && !UI.installHidden) html += '<div class="banner info"><span>Install it: tap Share, then <b>Add to Home Screen</b>.</span><button type="button" class="linkb" id="hideInstall">Hide</button></div>';
  return html;
}

function render(){
  buildHist();
  const sets = setsOf(S.week);
  document.querySelectorAll(".tabs [data-tab]").forEach(b => { if (b.dataset.tab === UI.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  $("#locSeg").innerHTML = segHTML("loc", [["work", "Work"], ["home", "Home"]]);
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

function refresh(){
  buildHist();
  const sets = setsOf(S.week);
  const active = document.activeElement;
  document.querySelectorAll(".set[data-key]").forEach(row => {
    const key = row.dataset.key, slot = SLOT[row.dataset.slot], i = Number(row.dataset.i);
    const log = sets[key], cur = chosenVariant(slot, sets);
    row.classList.toggle("done", !!log);
    const tick = row.querySelector(".tick");
    tick.setAttribute("aria-pressed", String(!!log));
    tick.setAttribute("aria-label", (log ? "Undo " : "Log ") + row.querySelector(".sl b").textContent + " set");
    row.querySelector(".sl small").textContent = log ? dayShort(log.d) : "";
    row.querySelector(".alt").textContent = (log && log.v && log.v !== cur) ? "Logged as " + log.v : "";
    row.querySelectorAll("input[data-f]").forEach(inp => {
      if (inp === active) return;
      const f = inp.dataset.f, dk = S.week + "|" + inp.id;
      let val;
      if (log) val = log[f];
      else if (dk in S.drafts) val = S.drafts[dk];
      else val = f === "w" ? prefill(slot, i, cur) : null;
      inp.value = val == null ? "" : (typeof val === "number" ? fmtW(val) : val);
    });
  });
  document.querySelectorAll(".ex[data-slot]").forEach(ex => {
    const slot = SLOT[ex.dataset.slot];
    ex.classList.toggle("complete", remaining(slot, sets) === 0);
    ex.querySelector(".last").innerHTML = lastHTML(slot, chosenVariant(slot, sets));
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

function lastHTML(slot, v){
  const e = lastTop(slot, v); if (!e) return "";
  const ext = EXT[slot.ext];
  const load = (slot.bw || e.w == null) ? "" : fmtW(e.w) + (slot.added ? " kg added × " : " kg × ");
  let s = esc((ext.flat ? "Last set 1: " : "Last top set: ") + load + e.r + " reps" +
    (e.x ? " " + (ext.label || "+") + e.x : "") + " · " + dateShort(e.d || e.wk));
  if (!isDeload(S.week)) {
    if (e.r >= slot.hi) s += ' <span class="hint up">Top of range: add load</span>';
    else if (e.r < slot.lo) s += ' <span class="hint down">Under range: hold the load</span>';
  }
  return s;
}

function renderHeader(sets){
  sets = sets || setsOf(S.week);
  const n = weekNo(S.week);
  $("#wkN").innerHTML = (n < 1 ? "Before block" : n > 12 ? "Week " + n + " · block done" : "Week " + n + " of 12") + (isDeload(S.week) ? ' <span class="badge">Deload</span>' : "");
  const end = addDays(S.week, 6), a = parseISO(S.week), b = parseISO(end);
  $("#wkD").textContent = a.getMonth() === b.getMonth()
    ? a.getDate() + "–" + b.getDate() + " " + MON[b.getMonth()]
    : a.getDate() + " " + MON[a.getMonth()] + " – " + b.getDate() + " " + MON[b.getMonth()];
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
      row.classList.add("need"); inp("r").focus();
      setTimeout(() => row.classList.remove("need"), 1200);
      return;
    }
    const entry = { w: slot.bw ? null : num(inp("w") && inp("w").value), r, x: inp("x") ? num(inp("x").value) : null,
                    v: chosenVariant(slot, sets), d: todayISO(), loc: UI.loc };
    ["w", "r", "x"].forEach(f => { const el = inp(f); if (el) delete S.drafts[S.week + "|" + el.id]; });
    if (document.activeElement && row.contains(document.activeElement)) document.activeElement.blur();
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

/* rest timer */
let restEnd = 0, restTimer = null, restHide = null;
function startRest(slot){
  const sess = SESS_OF[slot.id];
  let nextTxt = "Next set";
  if (slot.g) {
    const grp = sess.slots.filter(s => s.g === slot.g);
    const nx = grp[(grp.indexOf(slot) + 1) % grp.length];
    nextTxt = (slot.rest > 0 ? "Then " : "Now ") + nx.seq + " · " + chosenVariant(nx);
  }
  clearInterval(restTimer); clearTimeout(restHide);
  const box = $("#rest");
  box.hidden = false; box.classList.remove("go");
  $("#restL").textContent = nextTxt;
  if (slot.rest <= 0) {
    $("#restH").textContent = "Superset"; $("#restT").textContent = "Go";
    box.classList.add("go");
    restHide = setTimeout(() => { box.hidden = true; }, 4000);
    return;
  }
  $("#restH").textContent = "Rest";
  restEnd = Date.now() + slot.rest * 1000;
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
    restHide = setTimeout(() => { $("#rest").hidden = true; }, 6000);
  }
}
let wakeLock = null;
async function keepAwake(){
  try { if (!wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch (e) {}
}

let toastT = null;
function toast(msg){
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3500);
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

const mainFocused = () => { const a = document.activeElement; return a && a.tagName === "INPUT" && a.dataset.f && $("#main").contains(a); };
let renderLater = false;
function safeRender(){ if (mainFocused()) renderLater = true; else render(); }

document.addEventListener("click", e => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.tick) { onTick(t.dataset.tick); return; }
  if (t.dataset.tab) { UI.tab = t.dataset.tab; saveUI(); render(); window.scrollTo(0, 0); return; }
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
  switch (t.id) {
    case "prevWk": S.week = addDays(S.week, -7); render(); break;
    case "nextWk": S.week = addDays(S.week, 7); render(); break;
    case "thisWk": S.week = thisWeek(); render(); break;
    case "hideInstall": UI.installHidden = true; saveUI(); render(); break;
    case "exportBtn": exportData(); break;
    case "restoreBtn": $("#restoreFile").click(); break;
    case "reloadBtn": location.reload(); break;
    case "restSkip": clearInterval(restTimer); clearTimeout(restHide); $("#rest").hidden = true; break;
    case "restAdd":
      clearTimeout(restHide);
      if (restEnd > Date.now()) restEnd += 15000;
      else { restEnd = Date.now() + 15000; $("#rest").classList.remove("go"); $("#restH").textContent = "Rest"; clearInterval(restTimer); restTimer = setInterval(tickRest, 250); }
      tickRest(); break;
  }
});
$("#restoreFile").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) restoreFrom(f); e.target.value = ""; });
const main = $("#main");
main.addEventListener("input", e => { const i = e.target.closest("input[data-f]"); if (i) S.drafts[S.week + "|" + i.id] = i.value; });
main.addEventListener("change", e => {
  const sel = e.target.closest("select[data-variant]");
  if (sel) { if (sel.value) { UI.variant[variantKey(SLOT[sel.dataset.variant])] = sel.value; saveUI(); } render(); return; }
  if (e.target.dataset.kit) {
    D.settings.homeKit = Array.from(document.querySelectorAll("[data-kit]:checked")).map(c => c.dataset.kit);
    save(); return;
  }
  if (e.target.id === "blockStart" && e.target.value) {
    D.settings.blockStart = iso(mondayOf(parseISO(e.target.value)));
    e.target.value = D.settings.blockStart;
    save(); renderHeader(); return;
  }
  const inp = e.target.closest("input[data-f]"); if (inp) onEditDone(inp);
});
main.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const inp = e.target.closest("input[data-f]"); if (!inp) return;
  e.preventDefault();
  const row = inp.closest(".set");
  if (row && !row.classList.contains("done")) onTick(row.dataset.key); else inp.blur();
});
main.addEventListener("focusout", () => { setTimeout(() => { if (renderLater && !mainFocused()) { renderLater = false; render(); } }, 0); });

let shownWeek = S.week; // follow into a new week if you were on the current one when the app was last open
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const now = thisWeek();
  if (now !== shownWeek) { if (S.week === shownWeek) { S.week = now; safeRender(); } shownWeek = now; }
  if (wakeLock === null && !$("#rest").hidden) keepAwake();
  if (restEnd > Date.now()) tickRest();
  refresh();
});
window.addEventListener("storage", e => { if (e.key === KEY) { D = loadData(); safeRender(); } });

/* ================= offline + updates ================= */
function showUpdate(){
  const t = $("#toast");
  t.innerHTML = 'A new version is ready. <button type="button" class="linkb" id="reloadBtn" style="color:inherit;text-decoration:underline;font-size:14px">Reload</button>';
  t.hidden = false; clearTimeout(toastT);
}
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
const hadController = !!(navigator.serviceWorker && navigator.serviceWorker.controller);

if (["week", "next", "settings"].indexOf(UI.tab) < 0) UI.tab = "week";
render();
window.__gymlog = { get data(){ return D; }, version: APP_VERSION }; // for testing/debugging
})();
