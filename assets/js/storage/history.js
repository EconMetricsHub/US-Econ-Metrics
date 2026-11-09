// ── [#1] SHAREABLE URL STATE ──────────────────────────────────────
function encodeState() {
  const o = {};
  if (currentCountry !== 'us') o.c = currentCountry;
  if (timeHorizon !== 1) o.h = timeHorizon;
  if (taylorRuleOn) o.t = 1;
  o.x = officialSyncEnabled ? 1 : 0;
  const ev = Object.fromEntries(Object.entries(activeEventIds).filter(([id]) => !id.startsWith('custom_')).map(([id,cfg]) => [id, normalizeActiveShockConfig(id,cfg)]));
  if (Object.keys(ev).length) o.e = ev;
  if (shockProjectionMonth !== 3) o.m = shockProjectionMonth;
  if (portfolioHoldings.length) o.p = portfolioHoldings.map(h=>[h.symbol,+h.weight||0]);
  if (portfolioValue !== 100000) o.pv = portfolioValue;
  const d = {};
  for (const id in vals) {
    const def = getSliderDefault(id);
    if (def !== undefined && Math.abs(vals[id] - def) > 1e-9) d[id] = vals[id];
  }
  if (Object.keys(d).length) o.v = d;
  return o;
}

function _b64encode(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
function _b64decode(str) { return JSON.parse(decodeURIComponent(escape(atob(str)))); }

let _urlTimer = null;
function scheduleURLUpdate() {
  if (_urlTimer) clearTimeout(_urlTimer);
  _urlTimer = setTimeout(() => {
    _urlTimer = null;
    try {
      const o = encodeState();
      if (Object.keys(o).length === 0) { history.replaceState(null, '', location.pathname + location.search); return; }
      history.replaceState(null, '', '#s=' + _b64encode(o));
    } catch (e) {}
  }, 450);
}

function shareLink() {
  try {
    const o = encodeState();
    const url = location.origin + location.pathname + location.search + (Object.keys(o).length ? '#s=' + _b64encode(o) : '');
    history.replaceState(null, '', url);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => toast('🔗 Link copied to clipboard'), () => toast('🔗 Link set in address bar'));
    } else {
      toast('🔗 Link set in address bar');
    }
  } catch (e) { toast('Could not build link'); }
}

function applyStateFromURL() {
  const h = location.hash || '';
  if (h.length < 3) return false;
  let raw = h.slice(1);
  if (raw.startsWith('s=')) raw = raw.slice(2);
  let o;
  try { o = _b64decode(raw); } catch (e) { return false; }
  if (!o || typeof o !== 'object') return false;
  if (o.c && COUNTRY_CONFIGS[o.c]) {
    currentCountry = o.c;
    const cc = COUNTRY_CONFIGS[o.c];
    Object.assign(BASELINES, COUNTRY_CONFIGS.us.baselines);
    Object.assign(BASELINES, cc.baselines);
    vals = Object.assign({}, DEFAULTS, cc.defaults);
    const flagEl = document.getElementById('country-flag'); if (flagEl) flagEl.textContent = cc.flag;
    const sel = document.getElementById('country-select'); if (sel) sel.value = o.c;
  }
  if (o.h) timeHorizon = +o.h;
  taylorRuleOn = !!o.t;
  officialSyncRequestedFromShare = o.x === 1;
  officialSyncEnabled = false;
  activeEventIds = {};
  if (typeof o.e === 'string') o.e.split(',').forEach(id => { if (findShock(id)) activeEventIds[id] = defaultShockConfig(findShock(id)); });
  else if (o.e && typeof o.e === 'object') for (const [id,cfg] of Object.entries(o.e)) { if (findShock(id)) activeEventIds[id] = normalizeActiveShockConfig(id,cfg); }
  shockProjectionMonth = Number.isFinite(+o.m) ? Math.max(0,Math.min(120,+o.m)) : 3;
  selectedShockId = Object.keys(activeEventIds)[0] || null;
  if (Array.isArray(o.p)) portfolioHoldings=o.p.filter(x=>Array.isArray(x)&&PORTFOLIO_ASSETS[x[0]]).map(x=>({symbol:x[0],weight:+x[1]||0}));
  if (Number.isFinite(+o.pv)) portfolioValue=Math.max(0,+o.pv);
  savePortfolioState();
  pendingSharedSliderOverrides = o.v && typeof o.v === 'object' ? {...o.v} : {};
  if (o.v) for (const id in o.v) { if (vals[id] !== undefined) vals[id] = o.v[id]; }
  return true;
}

// Sync header/sidebar controls (horizon, Taylor, country, events) to state
function syncControlsToState() {
  [1, 3, 10].forEach(x => { const b = document.getElementById('hz-' + x); if (b) b.classList.toggle('active', x === timeHorizon); });
  const hint = document.getElementById('hz-hint'); if (hint) hint.textContent = HZ_HINTS[timeHorizon] || '';
  const trb = document.getElementById('tr-toggle');
  if (trb) { trb.textContent = taylorRuleOn ? 'TAYLOR ON' : 'TAYLOR OFF'; trb.classList.toggle('on', taylorRuleOn); }
  const ffrCard = document.getElementById('r-ffr');
  if (ffrCard && ffrCard.closest('.slider-card')) ffrCard.closest('.slider-card').classList.toggle('tr-active', taylorRuleOn);
  normalizeAllActiveShocks();
  refreshShockCards();
  const range = document.getElementById('shock-month-range'); if (range) range.value = shockProjectionMonth;
  renderEventLog();
}

// ── [#7] UNDO / REDO ──────────────────────────────────────────────
let undoStack = [], redoStack = [];
function snapshot() { return { vals:{...vals}, events:JSON.parse(JSON.stringify(activeEventIds)), customEvents:serializeCustomEvents(), shockProjectionMonth, timeHorizon, currentCountry, taylorRuleOn, officialSyncEnabled }; }
let committed = snapshot();

function commitChange() {
  const cur = snapshot();
  if (JSON.stringify(cur) === JSON.stringify(committed)) return; // no-op
  undoStack.push(committed);
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  committed = cur;
  updateUndoRedoButtons();
}

function restoreSnapshot(s) {
  currentCountry = s.currentCountry;
  timeHorizon    = s.timeHorizon;
  taylorRuleOn   = s.taylorRuleOn;
  officialSyncEnabled = !!s.officialSyncEnabled && currentCountry==='us' && !!officialData;
  vals           = {...s.vals};
  restoreCustomEvents(s.customEvents);
  activeEventIds = JSON.parse(JSON.stringify(s.events || {}));
  normalizeAllActiveShocks();
  shockProjectionMonth = Number.isFinite(s.shockProjectionMonth) ? s.shockProjectionMonth : 3;
  selectedShockId = Object.keys(activeEventIds)[0] || null;
  Object.assign(BASELINES, COUNTRY_CONFIGS.us.baselines);
  const cc = COUNTRY_CONFIGS[currentCountry];
  if (cc) {
    Object.assign(BASELINES, cc.baselines);
    const flagEl = document.getElementById('country-flag'); if (flagEl) flagEl.textContent = cc.flag;
    const sel = document.getElementById('country-select'); if (sel) sel.value = currentCountry;
  }
  if (officialSyncEnabled && officialData && currentCountry==='us') {
    officialBaselineVals = Object.assign({}, DEFAULTS, (COUNTRY_CONFIGS.us||{}).defaults||{}, officialData.baseline?.inputs||{});
    calculateOfficialCalibration();
  } else {
    officialCalibration = emptyOfficialCalibration();
    officialBaselineVals = null;
  }
  buildContent(); // rebuilds sliders (values + modified state) from vals
  const btn = Array.from(document.querySelectorAll('.nav-item'))
    .find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + currentSection + "'"));
  showSection(currentSection, btn || null);
  syncControlsToState();
  render();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(committed);
  committed = undoStack.pop();
  restoreSnapshot(committed);
  updateUndoRedoButtons();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(committed);
  committed = redoStack.pop();
  restoreSnapshot(committed);
  updateUndoRedoButtons();
}
function updateUndoRedoButtons() {
  const u = document.getElementById('undo-btn'), r = document.getElementById('redo-btn');
  if (u) u.disabled = !undoStack.length;
  if (r) r.disabled = !redoStack.length;
}

