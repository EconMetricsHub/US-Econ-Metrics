// ── PHASE B: OFFICIAL DATA SYNCHRONIZATION ───────────────────────
function emptyOfficialCalibration() { return {gdp:0,cpi:0,tenyr:0,twoyr:0,mortg:0}; }

function officialObservationForInput(id) {
  const obs = officialData?.observations || {};
  return Object.values(obs).find(o => o && o.inputTarget === id) || null;
}

function officialObservationForOutput(id) {
  const obs = officialData?.observations || {};
  return Object.values(obs).find(o => o && o.outputTarget === id) || null;
}

function formatOfficialValue(obs, value) {
  if (!obs || value === null || value === undefined || !Number.isFinite(+value)) return '—';
  const digits = Number.isFinite(+obs.precision) ? +obs.precision : 2;
  const num = (+value).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  if (String(obs.units||'').startsWith('$')) return '$' + num;
  return `${num}${String(obs.units||'').includes('%') ? '%' : ''}`;
}

function sliderOfficialSourceHtml(id) {
  const obs = officialObservationForInput(id);
  if (!obs || currentCountry !== 'us') return '';
  const baseline = officialBaselineVals?.[id];
  const overridden = officialSyncEnabled && Number.isFinite(+baseline) && Math.abs((vals[id]??0)-baseline)>1e-9;
  const cls = overridden ? 'sl-source user' : 'sl-source';
  const label = overridden ? 'USER OVERRIDE' : officialSyncEnabled ? 'OFFICIAL BASELINE' : 'OFFICIAL AVAILABLE';
  return `<div class="${cls}"><span class="sl-source-tag">${label}</span><span>FRED ${escapeCalendarHtml(obs.seriesId)} · ${escapeCalendarHtml(obs.observationDate||'')}</span></div>`;
}

function modelCountryDefaults() {
  const cc = COUNTRY_CONFIGS[currentCountry] || COUNTRY_CONFIGS.us;
  return Object.assign({}, DEFAULTS, cc.defaults || {});
}

function syncSliderDomFromVals() {
  for (const cat of CATEGORIES) for (const sl of cat.sliders) {
    const value = vals[sl.id];
    const range = document.getElementById('r-' + sl.id); if (range) range.value = value;
    const out = document.getElementById('v-' + sl.id); if (out) out.textContent = sl.fmt(value);
  }
  refreshAllModified();
}

function calculateOfficialCalibration() {
  const outputTargets = officialData?.baseline?.outputs || {};
  const savedVals = vals;
  const savedEvents = activeEventIds;
  const savedTaylor = taylorRuleOn;
  const savedMonth = shockProjectionMonth;
  const savedCalendarShockSync = calendarShockSyncEnabled;
  vals = {...(officialBaselineVals || modelCountryDefaults())};
  activeEventIds = {};
  taylorRuleOn = false;
  calendarShockSyncEnabled = false;
  shockProjectionMonth = 0;
  officialCalibration = emptyOfficialCalibration();
  officialCalibrationBypass = false;
  try {
    // Sequential anchoring respects transmission: CPI first, then yields,
    // mortgage, and finally GDP after all financial-condition effects.
    let baseline = compute();
    if (Number.isFinite(+outputTargets.cpi) && Number.isFinite(+baseline.cpi)) officialCalibration.cpi = +outputTargets.cpi - +baseline.cpi;
    baseline = compute();
    for (const key of ['tenyr','twoyr']) {
      if (Number.isFinite(+outputTargets[key]) && Number.isFinite(+baseline[key])) officialCalibration[key] = +outputTargets[key] - +baseline[key];
    }
    baseline = compute();
    if (Number.isFinite(+outputTargets.mortg) && Number.isFinite(+baseline.mortg)) officialCalibration.mortg = +outputTargets.mortg - +baseline.mortg;
    if (Number.isFinite(+outputTargets.gdp)) {
      // GDP feeds back through global spillovers and wealth effects, so solve
      // the additive anchor iteratively rather than assuming a one-pass offset.
      for (let i=0;i<4;i++) {
        baseline = compute();
        if (!Number.isFinite(+baseline.gdp)) break;
        officialCalibration.gdp += +outputTargets.gdp - +baseline.gdp;
      }
    }
  } finally {
    vals = savedVals;
    activeEventIds = savedEvents;
    taylorRuleOn = savedTaylor;
    calendarShockSyncEnabled = savedCalendarShockSync;
    shockProjectionMonth = savedMonth;
  }
}

function applyOfficialBaseline(options={}) {
  const {silent=false, skipRebuild=false, force=false} = options;
  if (!officialData || currentCountry !== 'us') { if (!silent) toast('Official U.S. data are not available'); return false; }
  const inputs = officialData.baseline?.inputs || {};
  if (!force && sharedStateRestored) return false;
  officialSyncEnabled = true;
  officialBaselineVals = Object.assign({}, DEFAULTS, (COUNTRY_CONFIGS.us||{}).defaults||{}, inputs);
  for (const [id,value] of Object.entries(inputs)) {
    const sl = getSliderDef(id);
    if (!sl || !Number.isFinite(+value)) continue;
    vals[id] = Math.max(sl.min, Math.min(sl.max, +value));
    officialBaselineVals[id] = vals[id];
  }
  calculateOfficialCalibration();
  officialAppliedAt = new Date().toISOString();
  overviewReference = null;
  if (!skipRebuild) {
    buildContent();
    const btn = Array.from(document.querySelectorAll('.nav-item')).find(b => (b.getAttribute('onclick')||'').includes(`'${currentSection}'`));
    showSection(currentSection, btn || null);
  } else syncSliderDomFromVals();
  renderOfficialData();
  render();
  if (!silent) { toast(`Official baseline synchronized from ${officialData.seriesCount||0} series`); commitChange(); }
  return true;
}

function restoreModelDefaults() {
  officialSyncEnabled = false;
  officialBaselineVals = null;
  officialCalibration = emptyOfficialCalibration();
  officialAppliedAt = null;
  vals = modelCountryDefaults();
  activeEventIds = {};
  selectedShockId = null;
  buildContent();
  const btn = Array.from(document.querySelectorAll('.nav-item')).find(b => (b.getAttribute('onclick')||'').includes(`'${currentSection}'`));
  showSection(currentSection, btn || null);
  renderEventLog();
  renderOfficialData();
  render();
  commitChange();
  toast('Restored model defaults');
}

function canAutoApplyOfficialBaseline() {
  if (sharedStateRestored || currentCountry !== 'us' || Object.keys(activeEventIds).length) return false;
  const base = modelCountryDefaults();
  return Object.keys(base).every(k => vals[k] === undefined || Math.abs((vals[k]??0)-(base[k]??0)) < 1e-9);
}

function ingestOfficialData(payload) {
  const next = payload?.officialData;
  if (!next || typeof next !== 'object' || !next.observations || !Object.keys(next.observations).length) { officialData = null; officialSyncEnabled=false; officialCalibration=emptyOfficialCalibration(); renderOfficialData(); return; }
  const priorBaseline = officialBaselineVals ? {...officialBaselineVals} : null;
  const priorVals = {...vals};
  const wasSynced = officialSyncEnabled && currentCountry === 'us' && !!priorBaseline;
  officialData = next;
  if (sharedStateRestored && officialSyncRequestedFromShare && currentCountry === 'us') {
    officialSyncEnabled = true;
    officialBaselineVals = Object.assign({}, DEFAULTS, (COUNTRY_CONFIGS.us||{}).defaults||{}, officialData.baseline?.inputs||{});
    vals = Object.assign({}, officialBaselineVals, pendingSharedSliderOverrides || {});
    calculateOfficialCalibration();
    officialAppliedAt = new Date().toISOString();
    buildContent();
    const btn = Array.from(document.querySelectorAll('.nav-item')).find(b => (b.getAttribute('onclick')||'').includes(`'${currentSection}'`));
    showSection(currentSection, btn || null);
    renderOfficialData();
    render();
  } else if (wasSynced) {
    // Rebase the open scenario onto the new official baseline. User changes are
    // preserved as deltas from the previous baseline, while newly released
    // observations replace the underlying economic state.
    officialBaselineVals = Object.assign({}, DEFAULTS, (COUNTRY_CONFIGS.us||{}).defaults||{}, officialData.baseline?.inputs||{});
    vals = {...officialBaselineVals};
    for (const [id,oldValue] of Object.entries(priorVals)) {
      if (!Number.isFinite(+oldValue) || !Number.isFinite(+priorBaseline[id]) || !Number.isFinite(+officialBaselineVals[id])) continue;
      const delta = +oldValue - +priorBaseline[id];
      const sl = getSliderDef(id);
      vals[id] = sl ? Math.max(sl.min,Math.min(sl.max,+officialBaselineVals[id]+delta)) : +officialBaselineVals[id]+delta;
    }
    calculateOfficialCalibration();
    officialAppliedAt = new Date().toISOString();
    overviewReference = null;
    buildContent();
    const btn = Array.from(document.querySelectorAll('.nav-item')).find(b => (b.getAttribute('onclick')||'').includes(`'${currentSection}'`));
    showSection(currentSection, btn || null);
    renderOfficialData();
    render();
    toast('Official snapshot updated; scenario deviations preserved');
  } else if (canAutoApplyOfficialBaseline()) applyOfficialBaseline({silent:true, skipRebuild:false, force:true});
  else renderOfficialData();
}

function renderOfficialData() {
  const content = document.getElementById('obs-content');
  const summary = document.getElementById('obs-summary');
  const syncStatus = document.getElementById('obs-sync-status');
  const generatedStatus = document.getElementById('obs-generated-status');
  if (!content || !summary) return;
  if (!officialData) {
    summary.innerHTML = '';
    content.innerHTML = '<div class="release-empty">Official observations are unavailable from both the Live Data Gateway and the static snapshot. The simulator itself remains usable.</div>';
    if (syncStatus) { syncStatus.className='obs-status off'; syncStatus.textContent='OFFICIAL DATA UNAVAILABLE'; }
    return;
  }
  if (syncStatus) {
    syncStatus.className = `obs-status ${officialSyncEnabled?'live':officialData.status==='partial'?'partial':'off'}`;
    syncStatus.textContent = officialSyncEnabled ? 'OFFICIAL BASELINE ACTIVE' : 'OFFICIAL DATA AVAILABLE';
  }
  const generated = officialData.generatedAt ? new Date(officialData.generatedAt) : null;
  if (generatedStatus) { const live=officialData.transport==='cloudflare-d1-live-gateway'; generatedStatus.textContent = generated && !Number.isNaN(generated.getTime()) ? `${live?'LIVE':'SNAPSHOT'} ${generated.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}` : (live?'LIVE DATA':'STATIC SNAPSHOT'); }
  const observations = Object.values(officialData.observations || {}).filter(Boolean);
  const inputCount = observations.filter(o=>o.inputTarget).length;
  const outputCount = observations.filter(o=>o.outputTarget).length;
  const staleCount = observations.filter(o=>o.isStale || o.fallback).length;
  summary.innerHTML = [
    ['Series loaded',observations.length,`${officialData.freshSeriesCount??observations.length} fresh`],
    ['Direct inputs',inputCount,'Mapped to sliders'],
    ['Output anchors',outputCount,'GDP · CPI · rates'],
    ['Stale / fallback',staleCount,officialData.status==='partial'?'Partial snapshot':'No material gaps']
  ].map(x=>`<div class="obs-summary-cell"><div class="obs-summary-label">${x[0]}</div><div class="obs-summary-value">${x[1]}</div><div class="obs-summary-sub">${x[2]}</div></div>`).join('');
  const groups = {};
  observations.forEach(o => (groups[o.category||'Other'] ||= []).push(o));
  content.innerHTML = Object.entries(groups).map(([category,items]) => `<div class="obs-category"><div class="obs-category-title">${escapeCalendarHtml(category)}</div><div class="obs-grid">${items.map(o => {
    const change = Number.isFinite(+o.change) ? `${+o.change>=0?'+':''}${formatOfficialValue(o,o.change)}` : '—';
    const revision = Number.isFinite(+o.revision) ? `${+o.revision>=0?'+':''}${formatOfficialValue(o,o.revision)}` : 'Not available';
    const badges = [o.inputTarget?`<span class="obs-badge input">Input → ${escapeCalendarHtml(o.inputTarget)}</span>`:'',o.outputTarget?`<span class="obs-badge output">Anchor → ${escapeCalendarHtml(o.outputTarget)}</span>`:'',(o.isStale?'<span class="obs-badge stale">Stale</span>':''),(o.fallback?'<span class="obs-badge fallback">Prior snapshot</span>':'')].join('');
    return `<div class="obs-card"><div class="obs-card-top"><div><div class="obs-name">${escapeCalendarHtml(o.label)}</div><div class="obs-series">FRED ${escapeCalendarHtml(o.seriesId)} · ${escapeCalendarHtml(o.frequency||'')}</div></div><div><div class="obs-value">${formatOfficialValue(o,o.actual)}</div><div class="obs-date">${escapeCalendarHtml(o.observationDate||'')}</div></div></div><div class="obs-details"><div><div class="obs-detail-label">Previous period</div><div class="obs-detail-value">${formatOfficialValue(o,o.previous)}</div></div><div><div class="obs-detail-label">Period change</div><div class="obs-detail-value">${change}</div></div><div><div class="obs-detail-label">Revision vs initial</div><div class="obs-detail-value">${revision}</div></div></div><div class="obs-badges">${badges}</div></div>`;
  }).join('')}</div></div>`).join('');
}


// ── PHASE C: RELEASE SURPRISE UI ─────────────────────────────────
function formatCalendarDatum(item,value) {
  if (value===null || value===undefined || !Number.isFinite(+value)) return '—';
  const digits=Number.isFinite(+item.precision)?+item.precision:2;
  const num=(+value).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  if (String(item.units||'').startsWith('$')) return '$'+num;
  return num + (String(item.units||'').includes('%') ? '%' : '');
}

function ingestSurpriseEngine(payload) {
  const next=payload?.surpriseEngine;
  surpriseEngine = next && typeof next==='object' && Array.isArray(next.shocks) ? next : null;
  renderReleaseSurprises();
}

function toggleCalendarShockSync() {
  calendarShockSyncEnabled = !calendarShockSyncEnabled;
  const btn=document.getElementById('surprise-toggle');
  if (btn) { btn.textContent=`Release signals: ${calendarShockSyncEnabled?'ON':'OFF'}`; btn.classList.toggle('primary',calendarShockSyncEnabled); }
  overviewReference=null;
  render();
  toast(`Calendar release signals ${calendarShockSyncEnabled?'enabled':'disabled'}`);
}

function renderReleaseSurprises() {
  const summary=document.getElementById('surprise-summary');
  const grid=document.getElementById('surprise-grid');
  const performance=document.getElementById('surprise-performance');
  if (!summary || !grid || !performance) return;
  const toggle=document.getElementById('surprise-toggle');
  if (toggle) { toggle.textContent=`Release signals: ${calendarShockSyncEnabled?'ON':'OFF'}`; toggle.classList.toggle('primary',calendarShockSyncEnabled); }
  if (!surpriseEngine) {
    summary.innerHTML='';
    grid.innerHTML='<div class="release-empty">Phase C data are not present. Run the updated GitHub Actions workflow.</div>';
    performance.innerHTML='<div class="release-empty">No forecast backtests are available.</div>';
    return;
  }
  const report=resolveCalendarShocks();
  const perf=surpriseEngine.performance?.aggregate||{};
  const latest=report.activeShocks[0];
  summary.innerHTML=[
    ['Active signals',report.activeShocks.length,'Currently transmitting'],
    ['Largest surprise',latest?`${Math.abs(+latest.surpriseZ||0).toFixed(2)}σ`:'—',latest?.label||'No active release'],
    ['Forecast backtests',perf.totalBacktests||0,`${perf.seriesCount||0} series`],
    ['Directional accuracy',Number.isFinite(+perf.meanDirectionalAccuracy)?`${Math.round(+perf.meanDirectionalAccuracy*100)}%`:'—','Simple trend model']
  ].map(x=>`<div class="surprise-summary-cell"><div class="surprise-summary-label">${x[0]}</div><div class="surprise-summary-value">${x[1]}</div><div class="surprise-summary-sub">${escapeCalendarHtml(x[2])}</div></div>`).join('');
  const active=report.activeShocks.slice().sort((a,b)=>Math.abs(+b.surpriseZ||0)-Math.abs(+a.surpriseZ||0));
  grid.innerHTML=active.length?active.map(s=>{
    const z=+s.surpriseZ||0, cls=z>.15?'pos':z<-.15?'neg':'hot';
    const effects=Object.entries(s.netEffects||{}).filter(([,v])=>Math.abs(+v)>.0001).slice(0,6);
    const obs=officialData?.observations?.[s.seriesKey]||s;
    return `<div class="surprise-card ${cls}"><div class="surprise-top"><div><div class="surprise-name">${escapeCalendarHtml(s.label||s.seriesKey)}</div><div class="surprise-series">${escapeCalendarHtml(s.releaseName||s.releaseFamily||'Official release')} · ${escapeCalendarHtml(s.releaseDate||'')} · FRED ${escapeCalendarHtml(s.seriesId||'')}</div></div><div class="surprise-z ${z>=0?'pos':'neg'}">${z>=0?'+':''}${z.toFixed(2)}σ</div></div><div class="surprise-values"><div class="surprise-value"><div class="surprise-value-lbl">Expected</div><div class="surprise-value-num">${formatCalendarDatum(obs,s.expected)}</div></div><div class="surprise-value"><div class="surprise-value-lbl">Actual</div><div class="surprise-value-num">${formatCalendarDatum(obs,s.actual)}</div></div><div class="surprise-value"><div class="surprise-value-lbl">Raw surprise</div><div class="surprise-value-num">${formatCalendarDatum(obs,s.surprise)}</div></div></div><div class="surprise-effects">${effects.map(([target,value])=>`<span class="surprise-effect">${escapeCalendarHtml(shockTargetLabel(target))} ${formatCalendarShockEffect(target,+value)}</span>`).join('')}</div><div class="surprise-meta">${escapeCalendarHtml(s.forecastMethod||'Trend forecast')} · ${Math.round((+s.path||0)*100)}% timing strength · ${Math.round((+s.confidence||0)*100)}% model confidence${s.revisionDetected?' · REVISION UPDATED':''}</div></div>`;
  }).join(''):'<div class="release-empty">No release shocks are currently transmitting at this projection month.</div>';
  const series=Object.values(surpriseEngine.performance?.series||{}).filter(x=>x&&x.backtestCount);
  performance.innerHTML=series.length?`<table class="perf-table"><thead><tr><th>Series</th><th>Backtests</th><th>MAE</th><th>RMSE</th><th>Direction</th></tr></thead><tbody>${series.map(p=>`<tr><td>${escapeCalendarHtml(p.label||p.seriesId)}</td><td>${p.backtestCount||0}</td><td>${Number.isFinite(+p.mae)?(+p.mae).toFixed(2):'—'}</td><td>${Number.isFinite(+p.rmse)?(+p.rmse).toFixed(2):'—'}</td><td>${Number.isFinite(+p.directionalAccuracy)?Math.round(+p.directionalAccuracy*100)+'%':'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="release-empty">No forecast backtests are available.</div>';
}

// ── LIVE OFFICIAL-DATA GATEWAY ───────────────────────────────────
let liveDataGatewayState = { status:'unknown', lastRefresh:null, error:null };

function liveDataGatewayEndpoint() {
  return normalizeAIEndpoint(localStorage.getItem('macroscope.ai.endpoint') || DEFAULT_AI_ENDPOINT || '');
}

async function loadLiveOfficialData(force = false) {
  const endpoint = liveDataGatewayEndpoint();
  if (!endpoint) return false;
  try {
    const suffix = force ? '?refresh=1' : '';
    const response = await fetch(`${endpoint}/api/data/latest${suffix}`, {cache:'no-store'});
    if (!response.ok) throw new Error(`Live gateway HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload?.officialData?.observations || !Object.keys(payload.officialData.observations).length) {
      liveDataGatewayState = {status:payload?.status || 'empty',lastRefresh:null,error:null};
      return false;
    }
    liveDataGatewayState = {status:payload.officialData.status || 'complete',lastRefresh:payload.officialData.generatedAt || null,error:null};
    if (economicCalendar) economicCalendar.officialData = payload.officialData;
    ingestOfficialData(payload);
    renderOfficialData();
    renderOverview(compute());
    return true;
  } catch (err) {
    liveDataGatewayState = {status:'offline',lastRefresh:null,error:String(err?.message || err)};
    return false;
  }
}

// ── STATIC ECONOMIC RELEASE CALENDAR ─────────────────────────────
const ECON_CALENDAR_URL = './data/economic-calendar.json';
let economicCalendar = null;
let calendarView = 'all';
let calendarLoading = false;

function escapeCalendarHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function localIsoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseCalendarDate(iso) {
  const [y,m,d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatCalendarDate(iso, options = {month:'short', day:'numeric', year:'numeric'}) {
  const d = parseCalendarDate(iso);
  if (Number.isNaN(d.getTime())) return iso || '—';
  return new Intl.DateTimeFormat('en-US', options).format(d);
}

async function loadEconomicCalendar(force = false) {
  if (calendarLoading || (economicCalendar && !force)) {
    renderEconomicCalendar();
    return;
  }
  calendarLoading = true;
  const list = document.getElementById('release-list');
  if (list) list.innerHTML = '<div class="release-empty">Loading generated calendar snapshot…</div>';
  try {
    const bust = force ? `?v=${Date.now()}` : '';
    const response = await fetch(ECON_CALENDAR_URL + bust, { cache: force ? 'no-store' : 'default' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.events)) throw new Error('Invalid calendar JSON');
    economicCalendar = payload;
    // Static Phase C/release data remain authoritative for the calendar. Latest
    // official observations are replaced by the live gateway when available.
    if (payload.officialData) ingestOfficialData(payload);
    ingestSurpriseEngine(payload);
    await loadLiveOfficialData(force);
    renderEconomicCalendar();
    renderOverview(compute());
  } catch (err) {
    economicCalendar = null;
    const liveAvailable = await loadLiveOfficialData(force);
    if (!liveAvailable) { officialData = null; officialSyncEnabled = false; officialCalibration = emptyOfficialCalibration(); }
    surpriseEngine = null;
    renderOfficialData();
    renderReleaseSurprises();
    renderOverview(compute());
    if (list) list.innerHTML = `<div class="release-empty"><strong style="color:var(--warn)">Release-calendar snapshot not available.</strong><br>Live official observations ${liveAvailable?'remain available':'are also unavailable'}; the calendar/surprise archive still comes from <code>scripts/update_calendar.py</code> or GitHub Actions.<br><span style="color:var(--muted)">${escapeCalendarHtml(err.message)}</span></div>`;
    const meta = document.getElementById('release-meta');
    if (meta) meta.innerHTML = '<span class="release-badge warn">STATIC FALLBACK</span><span class="release-badge">No API key is requested by the browser</span>';
  } finally {
    calendarLoading = false;
  }
}

function setCalendarView(view, btn) {
  calendarView = view;
  document.querySelectorAll('.cal-toolbar .btn[id^="cal-view-"]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderEconomicCalendar();
}

function calendarEventState(dateIso) {
  const today = localIsoDate();
  if (dateIso === today) return 'today';
  return dateIso < today ? 'past' : 'upcoming';
}

function renderEconomicCalendar() {
  const list = document.getElementById('release-list');
  const meta = document.getElementById('release-meta');
  if (!list || !meta || !economicCalendar) return;
  const today = localIsoDate();
  const search = (document.getElementById('release-search')?.value || '').trim().toLowerCase();
  let events = economicCalendar.events
    .filter(e => e && e.date && e.name)
    .filter(e => calendarView === 'past' ? e.date < today : calendarView === 'upcoming' ? e.date >= today : true)
    .filter(e => !search || `${e.name} ${e.source || ''}`.toLowerCase().includes(search))
    .sort((a,b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

  const generated = economicCalendar.generatedAt ? new Date(economicCalendar.generatedAt) : null;
  const ageHours = generated && !Number.isNaN(generated.getTime()) ? Math.max(0, (Date.now() - generated.getTime()) / 36e5) : null;
  const freshness = ageHours === null ? 'warn' : ageHours <= 36 ? 'good' : 'warn';
  const generatedLabel = generated && !Number.isNaN(generated.getTime())
    ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(generated)
    : 'Unknown';
  const upcomingCount = economicCalendar.events.filter(e => e.date >= today).length;
  const pastCount = economicCalendar.events.filter(e => e.date < today).length;
  meta.innerHTML = `
    <span class="release-badge ${freshness}">UPDATED ${escapeCalendarHtml(generatedLabel)}</span>
    <span class="release-badge">${pastCount} PAST RELEASES</span>
    <span class="release-badge">${upcomingCount} UPCOMING</span>
    <span class="release-badge">${events.length} SHOWN</span>
    <span class="release-badge ${officialData?.status==='complete'?'good':'warn'}">${officialData?.seriesCount||0} OFFICIAL SERIES</span>
    <span class="release-badge ${economicCalendar.surpriseEngine?.status==='active'?'good':'warn'}">${economicCalendar.surpriseEngine?.activeShockCount||0} RELEASE SIGNALS</span>`;

  if (!events.length) {
    list.innerHTML = '<div class="release-empty">No releases match the current filter.</div>';
    return;
  }

  let currentMonth = '';
  list.innerHTML = events.map(e => {
    const monthKey = e.date.slice(0,7);
    let monthHeading = '';
    if (monthKey !== currentMonth) {
      currentMonth = monthKey;
      monthHeading = `<div class="release-day">${escapeCalendarHtml(formatCalendarDate(e.date,{month:'long',year:'numeric'}))}</div>`;
    }
    const state = calendarEventState(e.date);
    const status = state === 'today' ? 'Today' : state === 'past' ? 'Released' : 'Scheduled';
    const data = Array.isArray(e.latestData) ? e.latestData.slice(0,3) : [];
    const actualHtml = data.length ? `<div class="release-actual">${data.map(d=>{const digits=Number.isFinite(+d.precision)?+d.precision:2;const n=Number(d.actual).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});return `<strong>${escapeCalendarHtml(d.label)}</strong> ${String(d.units||'').startsWith('$')?'$':''}${n}${String(d.units||'').includes('%')?'%':''}`;}).join('<br>')}</div>` : '';
    const surprises=Array.isArray(e.releaseSurprises)?e.releaseSurprises.slice(0,2):[];
    const forecasts=Array.isArray(e.modelForecasts)?e.modelForecasts.slice(0,2):[];
    const signalHtml=surprises.length?`<div class="release-surprise ${surprises.some(x=>+x.surpriseZ<0)?'neg':'pos'}">${surprises.map(x=>`${escapeCalendarHtml(x.label)}: expected ${formatCalendarDatum(x,x.expected)}, actual ${formatCalendarDatum(x,x.actual)} (${+x.surpriseZ>=0?'+':''}${(+x.surpriseZ).toFixed(2)}σ)`).join('<br>')}</div>`:forecasts.length?`<div class="release-forecast">${forecasts.map(x=>`${escapeCalendarHtml(x.label)} expected ${formatCalendarDatum(x,x.expected)}`).join('<br>')}</div>`:'';
    return `${monthHeading}<div class="release-row${data.length?' has-data':''}">
      <div class="release-date">${escapeCalendarHtml(formatCalendarDate(e.date,{month:'short',day:'numeric',weekday:'short'}))}</div>
      <div class="release-name">${escapeCalendarHtml(e.name)}${signalHtml}</div>
      ${actualHtml}
      <div class="release-source">${escapeCalendarHtml(e.source || 'FRED')}</div>
      <div class="release-state ${state}">${status}</div>
    </div>`;
  }).join('');
}


