// ── UI HELPERS ───────────────────────────────────────────────────
const BASELINES = { gdp:2.5, cpi:2.5, tfp:1.2, tenyr:4.2, twoyr:4.8, mortg:6.9, housingAff:50, sp500:100, conf:55, defAdj:6.5, dollarAdj:104, fsi:80, interestCostPctGDP:3.5, rowGrowth:2.8 };
// BASELINES is mutated by switchCountry() to reflect current country

let _heavyTimer = null;
function renderAIRail(m){
  const el=document.getElementById('rail-snapshot');if(!el)return;
  const shocks=Object.keys(activeEventIds).length;
  const dataAge=officialData?.generatedAt?Math.max(0,(Date.now()-new Date(officialData.generatedAt).getTime())/36e5):null;
  el.innerHTML=`<div class="rail-metric"><span>GDP</span><b>${m.gdp.toFixed(1)}%</b></div><div class="rail-metric"><span>CPI</span><b>${m.cpi.toFixed(1)}%</b></div><div class="rail-metric"><span>Unemployment</span><b>${m.unemp.toFixed(1)}%</b></div><div class="rail-metric"><span>10Y</span><b>${m.tenyr.toFixed(2)}%</b></div><div class="rail-state">${shocks?`${shocks} active scenario shock${shocks===1?'':'s'}`:'No active scenario shocks'} · ${officialData?`official baseline ${dataAge!==null&&dataAge<48?'fresh':'loaded'}`:'model baseline'}</div>`;
  const data=document.getElementById('sys-data');if(data){data.innerHTML=`<span class="sys-dot ${officialData?'live':''}"></span><b>DATA</b> ${officialData?'VERIFIED':'MODEL BASELINE'}`;}
}

function updateSystemSection(id){const el=document.getElementById('sys-section');if(el)el.textContent=String(id||'overview').replace(/-/g,' ').toUpperCase();}

function render() {
  const m = compute();
  renderMetrics(m);          // cheap — always immediate
  renderOverview(m);         // dashboard narrative + releases + diagnostics
  renderShockWorkbench(m);   // active shock inspector + attribution (self-guards)
  renderReleaseSurprises();   // release-signal diagnostics (self-guards)
  renderPortfolioLab(m);      // portfolio stress test (self-guards)
  renderScenarioTreeSummary();// probability-weighted branch summary (self-guards)
  renderAnalystSnapshot(m);   // analyst context panel (self-guards)
  renderAIRail(m);          // persistent research rail
  scheduleHeavyRender();     // charts + sensitivity (Monte Carlo) debounced
  scheduleURLUpdate();       // keep shareable hash current
}

// Debounce the expensive renders (Monte Carlo fan chart, sensitivity sweep)
// so dragging a slider stays smooth.
function scheduleHeavyRender() {
  if (_heavyTimer) clearTimeout(_heavyTimer);
  _heavyTimer = setTimeout(() => {
    _heavyTimer = null;
    const m = compute();
    if (chartsVisible) renderCharts(m);
    renderSensitivity(m);   // self-guards on sensitivityVisible
  }, 130);
}

function renderMetrics(m) {
  const bar = document.getElementById('mbar');
  if (!bar) return;
  const metrics = [
    { key:'gdp', label:'GDP Nowcast', value:`${m.gdp.toFixed(1)}%`, note:'Model output', cls:m.gdp<0?'bad':m.gdp<1.5?'warn':'' },
    { key:'cpi', label:'Inflation', value:`${m.cpi.toFixed(1)}%`, note:'Model output', cls:m.cpi>5?'bad':m.cpi>3.5?'warn':'' },
    { key:'unemp', label:'Unemployment', value:`${m.unemp.toFixed(1)}%`, note:'Input state', cls:m.unemp>6?'bad':m.unemp>4.8?'warn':'' },
    { key:'recessionRisk', label:'Recession Risk', value:`${Math.round(m.recessionRisk)}%`, note:'Model risk score', cls:m.recessionRisk>60?'bad':m.recessionRisk>35?'warn':'' },
    { key:'tenyr', label:'10yr Treasury', value:`${m.tenyr.toFixed(2)}%`, note:'Model output', cls:m.tenyr>6?'bad':m.tenyr>5?'warn':'' }
  ];
  bar.innerHTML = `<div class="mbar-row mbar-primary">${metrics.map(d => `<div class="mc" data-metric="${d.key}">
    <div class="mc-lbl">${d.label}</div>
    <div class="mc-val ${d.cls}">${d.value}</div>
    <div class="mc-delta neu">${d.note}</div>
  </div>`).join('')}</div>`;
}

const RELEASE_METADATA = [
  {pattern:'employment situation', category:'Labor', importance:5, channels:['Payrolls','Unemployment','Wages','Fed'], description:'The principal monthly report on payroll employment, unemployment, participation, and wage growth.'},
  {pattern:'consumer price index', category:'Inflation', importance:5, channels:['Inflation','Fed','Treasuries','Mortgages'], description:'The primary monthly measure of consumer-price inflation and a major input into monetary-policy expectations.'},
  {pattern:'producer price index', category:'Inflation', importance:4, channels:['Pipeline inflation','Margins','Fed'], description:'Measures price pressure received by domestic producers and can foreshadow consumer-price changes.'},
  {pattern:'gross domestic product', category:'Growth', importance:5, channels:['Growth','Profits','Fiscal ratios'], description:'The broadest official measure of U.S. output, demand composition, and economic momentum.'},
  {pattern:'personal income and outlays', category:'Consumption', importance:5, channels:['PCE inflation','Income','Consumption','Fed'], description:'Includes personal income, spending, saving, and the Federal Reserve’s preferred PCE inflation measures.'},
  {pattern:'retail sales', category:'Consumption', importance:4, channels:['Consumption','GDP','Inventories'], description:'A high-frequency reading on household goods spending and near-term consumption momentum.'},
  {pattern:'industrial production', category:'Production', importance:4, channels:['Manufacturing','Capacity','GDP'], description:'Tracks real output in manufacturing, mining, and utilities.'},
  {pattern:'housing starts', category:'Housing', importance:4, channels:['Housing supply','Construction','Rates'], description:'Measures new residential construction and permits, an interest-rate-sensitive leading indicator.'},
  {pattern:'new residential construction', category:'Housing', importance:4, channels:['Housing supply','Construction','Rates'], description:'Measures starts, permits, and completions in residential construction.'},
  {pattern:'international trade', category:'Trade', importance:3, channels:['Net exports','Dollar','Inventories'], description:'Tracks exports and imports and directly affects the net-export component of GDP.'},
  {pattern:'productivity and costs', category:'Productivity', importance:4, channels:['TFP','Unit labor costs','Inflation'], description:'Measures labor productivity and unit labor costs, linking potential growth to inflation pressure.'},
  {pattern:'federal open market committee', category:'Monetary policy', importance:5, channels:['Fed funds','Yield curve','Credit','Dollar'], description:'Federal Reserve policy decisions and communications that reprice rates and financial conditions.'},
  {pattern:'fomc', category:'Monetary policy', importance:5, channels:['Fed funds','Yield curve','Credit','Dollar'], description:'Federal Reserve policy decisions and communications that reprice rates and financial conditions.'},
  {pattern:'weekly claims', category:'Labor', importance:3, channels:['Layoffs','Unemployment','Recession risk'], description:'A weekly high-frequency indicator of layoffs and labor-market deterioration.'},
  {pattern:'job openings', category:'Labor', importance:4, channels:['Labor demand','Wages','Fed'], description:'JOLTS data measure openings, hires, quits, and separations across the labor market.'}
];

let overviewReference = null;

function classifyRegime(m) {
  let code = 'LATE-CYCLE SLOWDOWN', tone = 'neutral', confidence = 65;
  if (m.inRecession || m.gdp < 0) { code='RECESSION'; tone='negative'; confidence=90; }
  else if (m.gdp < 1.2 && m.cpi > 4) { code='STAGFLATION RISK'; tone='warning'; confidence=80; }
  else if (m.vigilantePremium > .3 || m.effectiveDeficit > 10) { code='FISCAL DOMINANCE RISK'; tone='warning'; confidence=76; }
  else if (m.gdp >= 2.5 && m.cpi <= 3 && m.tfp >= 1.4) { code='PRODUCTIVITY-LED EXPANSION'; tone='positive'; confidence=78; }
  else if (m.gdp >= 2 && m.cpi <= 3.4) { code='MODERATE EXPANSION'; tone='positive'; confidence=72; }
  else if (m.gdp >= 1.2 && m.cpi <= 3.2) { code='SOFT-LANDING PATH'; tone='positive'; confidence=68; }
  else if (m.cpi > 4.2) { code='INFLATION PRESSURE'; tone='warning'; confidence=74; }
  const constraints = [];
  if (m.interestCostPctGDP > 3.8) constraints.push('elevated debt-service costs');
  if (m.housingAff < 40) constraints.push('weak housing affordability');
  if (m.fsi < 70) constraints.push('tight financial conditions');
  if (m.cpi > 3.2) constraints.push('persistent price pressure');
  if (m.tfp > 1.5) constraints.push('strong productivity support');
  const conditionText = constraints.length ? `with ${constraints.slice(0,3).join(', ')}` : 'while most major stress channels remain contained';
  const summary = `${m.gdp >= 2 ? 'Growth remains above stall speed' : 'Growth momentum is subdued'}, ${conditionText}. The classification reflects current simulator inputs and is not an official forecast.`;
  return {code,tone,confidence,summary};
}

function overviewSnapshot(m) {
  return { country:currentCountry, horizon:timeHorizon, capturedAt:new Date().toISOString(), gdp:m.gdp, cpi:m.cpi, unemp:m.unemp, recessionRisk:m.recessionRisk, tenyr:m.tenyr, mortg:m.mortg, fsi:m.fsi, housingAff:m.housingAff, defAdj:m.defAdj };
}

function getOverviewReference(m) {
  if (overviewReference) return overviewReference;
  try {
    const stored = JSON.parse(localStorage.getItem('macroscope_overview_reference') || 'null');
    if (stored && stored.country === currentCountry && stored.horizon === timeHorizon) overviewReference = stored;
  } catch (_) {}
  if (!overviewReference && officialSyncEnabled && officialBaselineVals) {
    const saveVals = vals, saveEvents = activeEventIds, saveCalendarShockSync = calendarShockSyncEnabled;
    vals = {...officialBaselineVals}; activeEventIds = {}; calendarShockSyncEnabled = false;
    const anchored = compute();
    vals = saveVals; activeEventIds = saveEvents; calendarShockSyncEnabled = saveCalendarShockSync;
    overviewReference = overviewSnapshot(anchored);
    overviewReference.capturedAt = null;
  }
  if (!overviewReference) overviewReference = {
    country:currentCountry, horizon:timeHorizon, capturedAt:null,
    gdp:BASELINES.gdp, cpi:BASELINES.cpi, unemp:4.0, recessionRisk:20,
    tenyr:BASELINES.tenyr, mortg:BASELINES.mortg, fsi:BASELINES.fsi,
    housingAff:BASELINES.housingAff, defAdj:BASELINES.defAdj
  };
  return overviewReference;
}

function releaseMeta(name='') {
  const n = name.toLowerCase();
  return RELEASE_METADATA.find(r => n.includes(r.pattern)) || {category:'Macro release',importance:3,channels:['Growth','Inflation','Rates'],description:'An official economic release that may alter the model baseline and forecast interpretation.'};
}

function daysUntil(iso) {
  const target = parseCalendarDate(iso);
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.max(0, Math.round((target-now)/86400000));
}

function openModelSection(id) {
  const btn = Array.from(document.querySelectorAll('.nav-item')).find(b => (b.getAttribute('onclick')||'').includes(`'${id}'`));
  showSection(id, btn || null);
}

function renderOverview(m) {
  const section = document.getElementById('sec-overview');
  if (!section) return;
  const regime = classifyRegime(m);
  const regimeEl = document.getElementById('ov-regime');
  if (regimeEl) {
    regimeEl.className = `ov-regime ${regime.tone}`;
    const economyName = (COUNTRY_CONFIGS[currentCountry] || COUNTRY_CONFIGS.us).name;
    regimeEl.innerHTML = `<div class="ov-regime-kicker">${economyName} Economic Regime · ${timeHorizon} Year Horizon</div>
      <div class="ov-regime-row"><div><div class="ov-regime-title">${regime.code}</div><div class="ov-regime-summary">${regime.summary}</div></div>
      <div class="ov-confidence"><div class="ov-confidence-value">${regime.confidence}%</div><div class="ov-confidence-label">Model confidence score</div></div></div>`;
  }

  const cards = [
    ['GDP Nowcast',`${m.gdp.toFixed(1)}%`,officialSyncEnabled?'Official-anchored model':'Model output',m.gdp<0?'bad':m.gdp<1.5?'warn':'good'],
    ['Inflation',`${m.cpi.toFixed(1)}%`,officialSyncEnabled?'Official-anchored model':'Model output',m.cpi>5?'bad':m.cpi>3.5?'warn':''],
    ['Unemployment',`${m.unemp.toFixed(1)}%`,officialSyncEnabled?'Observed baseline / scenario':'Input state',m.unemp>6?'bad':m.unemp>4.8?'warn':''],
    ['Recession Risk',`${Math.round(m.recessionRisk)}%`,'Deterministic model score',m.recessionRisk>60?'bad':m.recessionRisk>35?'warn':'good'],
    ['10yr Treasury',`${m.tenyr.toFixed(2)}%`,officialSyncEnabled?'Official-anchored model':'Model output',m.tenyr>6?'bad':m.tenyr>5?'warn':'']
  ];
  const cardEl = document.getElementById('ov-headlines');
  if (cardEl) cardEl.innerHTML = cards.map(c => `<div class="ov-headline"><div class="ov-headline-label">${c[0]}</div><div class="ov-headline-value ${c[3]}">${c[1]}</div><div class="ov-headline-meta">${c[2]}</div></div>`).join('');

  const ref = getOverviewReference(m);
  const defs = [
    ['GDP forecast','gdp','pp',.03],['Inflation forecast','cpi','pp',.03],['Unemployment','unemp','pp',.03],['10yr Treasury','tenyr','pp',.02],['Mortgage rate','mortg','pp',.02],['Financial stability','fsi','pts',.5],['Housing affordability','housingAff','pts',.5],['Effective deficit','defAdj','pp',.05]
  ];
  const changes = defs.map(([label,key,unit,cut]) => ({label,key,unit,old:ref[key],now:m[key],delta:m[key]-ref[key],cut})).filter(x => Number.isFinite(x.old) && Math.abs(x.delta)>=x.cut).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,5);
  const changeEl = document.getElementById('ov-changes');
  const changeSub = document.getElementById('ov-change-sub');
  if (changeSub) changeSub.textContent = ref.capturedAt ? 'Since previous saved visit' : 'Versus model baseline';
  if (changeEl) {
    const metricHtml = changes.length ? changes.map(x => {
      const favorable = ['gdp','fsi','housingAff'].includes(x.key) ? x.delta>0 : ['cpi','unemp','tenyr','mortg','defAdj'].includes(x.key) ? x.delta<0 : false;
      const cls = Math.abs(x.delta)<x.cut?'neu':favorable?'pos':'neg';
      const digits = x.unit==='pts' ? 1 : 2;
      return `<div class="ov-change-row"><div class="ov-change-name">${x.label}</div><div class="ov-change-values">${x.old.toFixed(digits)} → ${x.now.toFixed(digits)}</div><div class="ov-change-delta ${cls}">${x.delta>=0?'+':''}${x.delta.toFixed(digits)}${x.unit==='pp'?'pp':''}</div></div>`;
    }).join('') : '<div class="ov-empty">No material changes relative to the reference snapshot.</div>';
    const releaseDrivers = (m.calendarShockReport?.activeShocks || []).filter(s=>Math.abs(s.surpriseZ||0)>=.15).slice(0,3);
    const releaseHtml = releaseDrivers.length ? `<div class="ov-release-impact"><strong>ACTIVE RELEASE SIGNALS</strong><br>${releaseDrivers.map(s=>`${escapeCalendarHtml(s.label)}: ${(s.surpriseZ>=0?'+':'')}${(+s.surpriseZ).toFixed(2)}σ · GDP ${formatCalendarShockEffect('gdpA',s.netEffects?.gdpA||0)}`).join('<br>')}</div>` : '';
    changeEl.innerHTML = metricHtml + releaseHtml;
  }

  renderOverviewReleases();

  const contrib = Object.entries(m.gdpContributions || {}).filter(([k])=>k!=='baseline').map(([label,value])=>({label,value:+value||0})).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).slice(0,8);
  const maxAbs = Math.max(.01,...contrib.map(x=>Math.abs(x.value)));
  const water = document.getElementById('ov-waterfall');
  if (water) water.innerHTML = contrib.map(x => { const cls=x.value>0.005?'pos':x.value<-.005?'neg':'neu'; return `<div class="ov-water-row"><div class="ov-water-label">${x.label}</div><div class="ov-water-track"><div class="ov-water-bar ${cls}" style="width:${Math.max(2,Math.abs(x.value)/maxAbs*100)}%"></div></div><div class="ov-water-value ${cls}">${x.value>=0?'+':''}${x.value.toFixed(2)}pp</div></div>`; }).join('') + `<div class="ov-water-total"><span>Final GDP nowcast</span><strong>${m.gdp.toFixed(1)}%</strong></div>`;

  const bounded = v => Math.max(0,Math.min(100,v));
  const risks = [
    {name:'Fiscal sustainability',score:bounded((m.effectiveDeficit-4)*11 + Math.max(0,m.interestCostPctGDP-3)*14),section:'fiscal'},
    {name:'Inflation persistence',score:bounded((m.cpi-2)*27 + m.wagePriceSpiral*130),section:'monetary'},
    {name:'Labor deterioration',score:bounded((m.unemp-3.5)*22 + Math.max(0,1.5-m.gdp)*18),section:'labor'},
    {name:'Financial stress',score:bounded(100-m.fsi),section:'bonds'},
    {name:'Housing affordability',score:bounded(100-m.housingAff),section:'housing'},
    {name:'Geopolitical disruption',score:bounded(((vals.conflictIndex+vals.chinaMilRisk+vals.energyGeopolitics+vals.cyberRisk)/4-3)*14),section:'geopolitics'}
  ];
  const riskEl = document.getElementById('ov-risks');
  if (riskEl) riskEl.innerHTML = risks.map(r => { const cls=r.score>=70?'high':r.score>=48?'elevated':r.score>=25?'moderate':'low'; const level=cls==='high'?'High':cls==='elevated'?'Elevated':cls==='moderate'?'Moderate':'Low'; return `<div class="ov-risk-row" onclick="openModelSection('${r.section}')" title="Open ${r.name} inputs"><div class="ov-risk-name">${r.name}</div><div class="ov-risk-track"><div class="ov-risk-fill ${cls}" style="width:${r.score.toFixed(0)}%"></div></div><div class="ov-risk-level ${cls}">${level}</div></div>`; }).join('');

  const hzStatus = document.getElementById('ov-horizon-status');
  if (hzStatus) hzStatus.textContent = `${timeHorizon}YR HORIZON`;
  const generated = economicCalendar?.generatedAt ? new Date(economicCalendar.generatedAt) : null;
  const ageHours = generated && !Number.isNaN(generated.getTime()) ? (Date.now()-generated.getTime())/36e5 : null;
  const dataPill = document.getElementById('ov-data-status');
  if (dataPill) { const synced=officialSyncEnabled&&officialData; dataPill.className=`ov-pill ${synced?'live':ageHours!==null&&ageHours<=36?'live':'stale'}`; dataPill.textContent=synced?`OFFICIAL ${officialData.seriesCount||0} SERIES`:ageHours===null?'CALENDAR PENDING':ageHours<=36?`CALENDAR ${Math.round(ageHours)}H AGO`:`CALENDAR ${Math.round(ageHours/24)}D OLD`; }
}

function renderOverviewReleases() {
  const nextEl = document.getElementById('ov-next-release');
  const listEl = document.getElementById('ov-upcoming-list');
  if (!nextEl || !listEl) return;
  if (!economicCalendar || !Array.isArray(economicCalendar.events)) {
    nextEl.innerHTML='<div class="ov-empty">Loading the static economic-calendar snapshot…</div>';
    listEl.innerHTML=''; return;
  }
  const today = localIsoDate();
  const upcoming = economicCalendar.events.filter(e=>e?.date>=today&&e?.name).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
  if (!upcoming.length) { nextEl.innerHTML='<div class="ov-empty">No upcoming releases are present in the current snapshot.</div>'; listEl.innerHTML=''; return; }
  const next=upcoming[0], meta=releaseMeta(next.name), days=daysUntil(next.date);
  const forecasts = Array.isArray(next.modelForecasts) ? next.modelForecasts.slice(0,2) : [];
  const forecastHtml = forecasts.length ? `<div class="ov-release-impact"><strong>MACROSCOPE EXPECTED</strong><br>${forecasts.map(f=>`${escapeCalendarHtml(f.label)} ${formatCalendarDatum(f,f.expected)} · typical error ±${formatCalendarDatum(f,f.errorScale)}`).join('<br>')}</div>` : '';
  nextEl.innerHTML=`<div class="ov-next-date">${formatCalendarDate(next.date,{month:'short',day:'numeric',year:'numeric'})}<br>${days===0?'TODAY':days===1?'IN 1 DAY':`IN ${days} DAYS`}</div><div><div class="ov-next-name">${escapeCalendarHtml(next.name)}</div><div class="ov-next-desc">${meta.description}</div><div class="ov-impact">${meta.channels.map(c=>`<span class="ov-impact-chip">${c}</span>`).join('')}</div>${forecastHtml}</div>`;
  listEl.innerHTML=upcoming.slice(1,6).map(e=>{const md=releaseMeta(e.name);return `<div class="ov-release-row"><div class="ov-release-date">${formatCalendarDate(e.date,{month:'short',day:'numeric'})}</div><div class="ov-release-name">${escapeCalendarHtml(e.name)}</div><div class="ov-release-importance">${'●'.repeat(Math.min(5,md.importance))}</div></div>`;}).join('') || '<div class="ov-empty">No additional releases in the current snapshot.</div>';
}

// ── BUILD SECTIONS ───────────────────────────────────────────────
function buildSidebar() {
  const terminal = document.getElementById('nav-terminal');
  terminal.innerHTML = `<button class="nav-item active" onclick="showSection('overview',this)">
    <span class="nav-icon">⌂</span>Terminal Overview
  </button>`;
  const inp = document.getElementById('nav-inputs');
  inp.innerHTML = CATEGORIES.map(c =>
    `<button class="nav-item" onclick="showSection('${c.id}',this)">
      <span class="nav-icon">${c.icon}</span>${c.label}${c.warn?'<span class="nav-warn">★</span>':''}
    </button>`).join('');
  const ana = document.getElementById('nav-analysis');
  ana.innerHTML = ANALYSIS_SECTIONS.map(s =>
    `<button class="nav-item" onclick="showSection('${s.id}',this)">
      <span class="nav-icon">${s.icon}</span>${s.label}
    </button>`).join('');
}

function buildContent() {
  const el = document.getElementById('content');
  let html = `<div class="section active" id="sec-overview">
    <div class="ov-shell">
      <div class="ov-statusbar">
        <div class="ov-status-left"><span class="ov-pill live">LIVE BASELINE</span><span class="ov-pill">MODEL v8.0</span><span class="ov-pill">${(COUNTRY_CONFIGS[currentCountry]||COUNTRY_CONFIGS.us).name}</span></div>
        <div class="ov-status-right"><span class="ov-pill" id="ov-data-status">CALENDAR PENDING</span><span class="ov-pill" id="ov-horizon-status">${timeHorizon}YR HORIZON</span></div>
      </div>
      <div class="ov-regime neutral" id="ov-regime"></div>
      <div class="ov-headline-grid" id="ov-headlines"></div>
      <div class="ov-grid">
        <div class="ov-panel"><div class="ov-panel-hd"><div class="ov-panel-title">What Changed</div><div class="ov-panel-sub" id="ov-change-sub">Versus model baseline</div></div><div class="ov-panel-body" id="ov-changes"></div></div>
        <div class="ov-panel"><div class="ov-panel-hd"><div class="ov-panel-title">Next Major Release</div><button class="btn" onclick="openModelSection('calendar')">Full Calendar</button></div><div class="ov-panel-body"><div class="ov-next-release" id="ov-next-release"></div><div class="ov-release-list" id="ov-upcoming-list"></div></div></div>
      </div>
      <div class="ov-grid">
        <div class="ov-panel"><div class="ov-panel-hd"><div class="ov-panel-title">GDP Driver Waterfall</div><div class="ov-panel-sub">Contribution to annualized growth</div></div><div class="ov-panel-body"><div class="ov-waterfall" id="ov-waterfall"></div></div></div>
        <div class="ov-panel"><div class="ov-panel-hd"><div class="ov-panel-title">Risk Monitor</div><div class="ov-panel-sub">Click a risk to open its inputs</div></div><div class="ov-panel-body"><div class="ov-risk-list" id="ov-risks"></div></div></div>
      </div>
    </div>
  </div>`;
  for (const cat of CATEGORIES) {
    html += `<div class="section" id="sec-${cat.id}">
      <div class="sec-hdr">
        <div class="sec-title">${cat.label}</div>
        <div class="sec-desc">${cat.desc}</div>
        ${cat.warn ? `<div class="sec-warn">${cat.warn}</div>` : ''}
      </div>
      <div class="slider-grid">
        ${cat.sliders.map(sl => buildSlider(sl)).join('')}
      </div>
    </div>`;
  }


  // V7.2 sourced-data copilot: prompt → official series → review → apply
  html += `<div class="section" id="sec-data-copilot">
    <div class="sec-hdr">
      <div class="sec-title">Data Copilot</div>
      <div class="sec-desc">Ask for current U.S. macro data here—or from Ask MACROSCOPE. Current-data requests are auto-routed to this review gate. The Worker uses the LLM only to select approved series, then reads validated observations from the Live Data Gateway (with direct FRED fallback) including source, series, observation date, and retrieval time. Nothing changes until you approve it.</div>
    </div>
    <div class="data-copilot-shell">
      <div class="data-copilot-panel">
        <div class="data-copilot-title">Research request</div>
        <div class="data-copilot-desc">Examples: “Bring MACROSCOPE current.” · “Update inflation, labor and rates.” · “Get the latest oil, mortgage and Treasury data.”</div>
        <textarea id="data-copilot-prompt" class="data-copilot-prompt" placeholder="Bring MACROSCOPE current. Retrieve the latest major U.S. macro observations, cite every source and date, compare them with the current model, and prepare updates for my approval."></textarea>
        <div class="quick-prompts">
          <button class="btn" onclick="setDataCopilotPrompt('Bring MACROSCOPE current. Retrieve the latest major U.S. macro observations, cite every source and date, compare them with the current model, and prepare updates for my approval.')">Bring current</button>
          <button class="btn" onclick="setDataCopilotPrompt('Update inflation, unemployment, payrolls, labor-force participation and consumer spending using the latest official data.')">Inflation + labor</button>
          <button class="btn" onclick="setDataCopilotPrompt('Update the effective fed funds rate, 2-year and 10-year Treasury yields, and the 30-year mortgage rate using the latest official observations.')">Rates</button>
          <button class="btn" onclick="setDataCopilotPrompt('Update WTI crude oil, Henry Hub natural gas and housing starts using the latest official observations.')">Energy + housing</button>
        </div>
        <input id="data-copilot-endpoint" class="data-copilot-endpoint" placeholder="Cloudflare Worker endpoint" onchange="saveAIEndpoint(this.value)">
        <div class="data-copilot-actions"><button class="btn primary" onclick="requestDataCopilotUpdate()">Research current data</button><button class="btn" onclick="clearDataCopilotProposal()">Clear</button><span id="data-copilot-status" class="data-copilot-status">REVIEW-GATED</span></div>
        <div class="data-copilot-proof"><div><b>LLM ROLE</b><span>Select approved series; never invent values.</span></div><div><b>DATA ROLE</b><span>Live Gateway stores verified FRED observations and revisions.</span></div><div><b>USER ROLE</b><span>Review every proposed model change before apply.</span></div></div>
        <div class="provenance-legend"><span class="provenance-chip official">OFFICIAL</span><span class="provenance-chip model">MODEL</span><span class="provenance-chip scenario">SCENARIO</span><span class="provenance-chip user">USER OVERRIDE</span></div>
      </div>
      <div class="data-copilot-panel">
        <div class="data-update-toolbar"><div><div class="data-copilot-title" style="margin-bottom:2px">Proposed updates</div><div id="data-copilot-meta" class="data-update-meta">No research request yet.</div></div><div><button class="btn" id="data-select-all" onclick="setAllDataCopilotChecks(true)" disabled>Select all</button> <button class="btn" id="data-select-none" onclick="setAllDataCopilotChecks(false)" disabled>None</button> <button class="btn primary" id="data-apply-btn" onclick="applyDataCopilotProposal()" disabled>Apply approved updates</button></div></div>
        <div id="data-copilot-results" class="data-copilot-empty">Ask the Data Copilot for current observations. Each result will show the official value, source, series, observation date, model mapping, and current-model comparison.</div>
      </div>
    </div>
    <div class="portfolio-note">Applying approved updates creates a new official-data baseline. Direct-input observations update compatible sliders; GDP, headline CPI, Treasury yields and mortgage rates update transparent calibration anchors. Existing event shocks remain scenario assumptions. Display-only observations such as core CPI are retained as sourced context without forcing an unsupported slider.</div>
  </div>`;

  // Official economic observations and live-baseline synchronization
  html += `<div class="section" id="sec-observed">
    <div class="sec-hdr">
      <div class="sec-title">Official U.S. Economic Data</div>
      <div class="sec-desc">Latest mapped FRED observations, previous-period values, revisions, freshness, and the inputs or outputs they anchor in MACROSCOPE. Synchronization changes the U.S. live baseline; scenario deviations remain editable.</div>
    </div>
    <div class="obs-toolbar">
      <div class="obs-toolbar-left"><span class="obs-status off" id="obs-sync-status">DATA PENDING</span><span class="obs-status" id="obs-generated-status">STATIC SNAPSHOT</span></div>
      <div class="obs-toolbar-right"><button class="btn primary" onclick="applyOfficialBaseline({force:true})">Synchronize Official Baseline</button><button class="btn" onclick="restoreModelDefaults()">Use Model Defaults</button><button class="btn" onclick="loadEconomicCalendar(true)">&#8635; Refresh Snapshot</button></div>
    </div>
    <div class="obs-summary" id="obs-summary"></div>
    <div id="obs-content"><div class="release-empty">Loading official observations…</div></div>
    <div class="obs-note">Observed input mappings directly set compatible sliders. GDP, CPI, Treasury yields, and mortgage rates are used as transparent additive calibration anchors so scenario changes continue to move the model around the latest observed state. “Previous” means the prior observation period; “revision” compares the current value with FRED’s initial-release value when available.</div>
  </div>`;

  // Economic release calendar
  html += `<div class="section" id="sec-calendar">
    <div class="sec-hdr">
      <div class="sec-title">U.S. Economic Release Calendar</div>
      <div class="sec-desc">Rolling one-year release archive and upcoming schedule generated from the FRED release calendar. Data are loaded from a static JSON snapshot so no API key is exposed to visitors.</div>
    </div>
    <div class="cal-toolbar">
      <button class="btn active" id="cal-view-all" onclick="setCalendarView('all',this)">Past Year + Upcoming</button>
      <button class="btn" id="cal-view-past" onclick="setCalendarView('past',this)">Past Year</button>
      <button class="btn" id="cal-view-upcoming" onclick="setCalendarView('upcoming',this)">Upcoming</button>
      <input class="release-search" id="release-search" type="search" placeholder="Filter releases…" oninput="renderEconomicCalendar()">
      <button class="btn" onclick="loadEconomicCalendar(true)">&#8635; Refresh Snapshot</button>
    </div>
    <div class="release-meta" id="release-meta"></div>
    <div class="release-list" id="release-list"><div class="release-empty">Loading economic release calendar…</div></div>
    <div class="release-source-note">
      Source: Federal Reserve Bank of St. Louis FRED® release calendar. Release dates are supplied by the originating statistical agencies and may change. This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.
    </div>
  </div>`;


  // Phase C release-surprise diagnostics
  html += `<div class="section" id="sec-surprises">
    <div class="sec-hdr"><div class="sec-title">Release Surprise Engine</div><div class="sec-desc">Compares official actuals with MACROSCOPE's pre-release trend forecasts, standardizes the miss, and applies transparent decaying information shocks to the live outlook.</div></div>
    <div class="annotation">Forecasts are generated from prior official observations—not commercial economist consensus. Transmission coefficients are explicit expert priors and should be evaluated using the performance table below.</div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn primary" id="surprise-toggle" onclick="toggleCalendarShockSync()">Release signals: ON</button></div>
    <div class="surprise-summary" id="surprise-summary"></div>
    <div class="cal-grp-title">Active Release Signals</div>
    <div class="surprise-grid" id="surprise-grid"><div class="release-empty">Loading release surprises…</div></div>
    <div class="cal-grp-title">Forecast Performance</div>
    <div id="surprise-performance"><div class="release-empty">Performance data are not available until the Phase C updater runs.</div></div>
  </div>`;


  html += buildNewsSection();

  // Events section
  html += buildEventsSection();

  // V6 portfolio stress testing
  html += buildPortfolioSection();

  // V6 probability-weighted scenario tree
  html += buildScenarioTreeSection();

  // V6 analyst interface
  html += buildAnalystSection();

  // Charts section
  html += `<div class="section" id="sec-charts">
    <div class="sec-hdr"><div class="sec-title">Charts &amp; Analysis</div><div class="sec-desc">Live economic projections, yield curve, sector health, and inflation decomposition.</div></div>
    <div class="charts-grid">
      <div class="chart-panel wide">
        <div class="chart-title">GDP Growth Projection — 12-Month Forward</div>
        <div class="chart-sub">Projected monthly GDP growth path based on current settings vs. baseline 2.5% trend</div>
        <div class="chart-wrap" style="height:200px"><canvas id="gdpChart" role="img" aria-label="GDP growth projection chart"></canvas></div>
      </div>
      <div class="chart-panel">
        <div class="chart-title">Live Yield Curve</div>
        <div class="chart-sub">Fed Funds → 30yr Treasury → 30yr Mortgage</div>
        <div class="chart-wrap" style="height:200px"><canvas id="yldChart" role="img" aria-label="Yield curve chart"></canvas></div>
      </div>
      <div class="chart-panel">
        <div class="chart-title">Sector Health Radar</div>
        <div class="chart-sub">Composite score across 7 economic dimensions (0–100)</div>
        <div class="chart-wrap" style="height:200px"><canvas id="radarChart" role="img" aria-label="Sector health radar chart"></canvas></div>
      </div>
      <div class="chart-panel">
        <div class="chart-title">CPI Inflation Decomposition</div>
        <div class="chart-sub">Contribution of each driver to headline inflation vs. 2.5% baseline</div>
        <div class="chart-wrap" style="height:200px"><canvas id="cpiChart" role="img" aria-label="CPI inflation decomposition chart"></canvas></div>
      </div>
      <div class="chart-panel">
        <div class="chart-title">Six-Sector Health Breakdown</div>
        <div class="chart-sub">Current output health score by sector (0–100). Housing, manufacturing, services, finance, energy, technology.</div>
        <div class="chart-wrap" style="height:200px"><canvas id="sectorChart" role="img" aria-label="Sector health chart"></canvas></div>
      </div>
      <div class="chart-panel">
        <div class="chart-title">Political Economy Impact on GDP</div>
        <div class="chart-sub">Δ GDP contribution from political economy factors vs. neutral baseline</div>
        <div class="chart-wrap" style="height:200px"><canvas id="polChart" role="img" aria-label="Political economy impact chart"></canvas></div>
      </div>
    </div>
  </div>`;
  // Scenarios
  html += `<div class="section" id="sec-scenarios">
    <div class="sec-hdr"><div class="sec-title">Scenario Comparison</div><div class="sec-desc">Save up to 3 named scenarios and compare outputs side by side.</div></div>
    <div class="sc-grid" id="sc-grid"></div>
    <div class="annotation">Scenarios are saved to browser localStorage. Use Export JSON to preserve them externally.</div>
  </div>`;
  // Sensitivity
  // ── CALIBRATION SECTION ──
  html += `<div class="section" id="sec-calibrate">
    <div class="sec-hdr">
      <div class="sec-title">2026 Q2 — Real Data Calibration</div>
      <div class="sec-desc">Enter actual observed values for key indicators. The simulator will map them to sliders and show where the model diverges from reality (calibration gap).</div>
    </div>
    <div class="annotation">💡 Tip: start from a preset, then fine-tune with your own data. The calibration gap tells you which structural factors the model may be mis-weighting.</div>
    <div class="cal-grp-title">Preset: Load Estimated Q2 2026 Values</div>
    <div style="display:flex;gap:7px;margin-bottom:14px;">
      <button class="btn primary" style="flex:1" onclick="loadQ2Preset()">📊 Load Q2 2026 Estimates</button>
      <button class="btn" style="flex:1" onclick="clearCalibration()">Clear Fields</button>
    </div>
    <div class="cal-grp-title">Observed Data Inputs</div>
    <div class="cal-grid">
      <div class="cal-field">
        <div class="cal-lbl">Real GDP Growth (annualized)</div>
        <div class="cal-row"><input class="cal-inp" id="cal-gdp" type="number" step="0.1" placeholder="2.1"><span class="cal-unit">%</span></div>
      </div>
      <div class="cal-field">
        <div class="cal-lbl">CPI Inflation (YoY)</div>
        <div class="cal-row"><input class="cal-inp" id="cal-cpi" type="number" step="0.1" placeholder="3.0"><span class="cal-unit">%</span></div>
      </div>
      <div class="cal-field">
        <div class="cal-lbl">Fed Funds Rate (upper bound)</div>
        <div class="cal-row"><input class="cal-inp" id="cal-ffr" type="number" step="0.25" placeholder="4.25"><span class="cal-unit">%</span></div>
      </div>
      <div class="cal-field">
        <div class="cal-lbl">10yr Treasury Yield</div>
        <div class="cal-row"><input class="cal-inp" id="cal-tenyr" type="number" step="0.05" placeholder="4.35"><span class="cal-unit">%</span></div>
      </div>
      <div class="cal-field">
        <div class="cal-lbl">Unemployment Rate (U-3)</div>
        <div class="cal-row"><input class="cal-inp" id="cal-unemp" type="number" step="0.1" placeholder="4.2"><span class="cal-unit">%</span></div>
      </div>
      <div class="cal-field">
        <div class="cal-lbl">WTI Crude Oil ($/bbl)</div>
        <div class="cal-row"><input class="cal-inp" id="cal-oil" type="number" step="1" placeholder="69"><span class="cal-unit">$</span></div>
      </div>
      <div class="cal-field">
        <div class="cal-lbl">DXY Dollar Index</div>
        <div class="cal-row"><input class="cal-inp" id="cal-dxy" type="number" step="0.5" placeholder="103"><span class="cal-unit">index</span></div>
      </div>
      <div class="cal-field">
        <div class="cal-lbl">Housing Starts (M units/yr)</div>
        <div class="cal-row"><input class="cal-inp" id="cal-housing" type="number" step="0.05" placeholder="1.35"><span class="cal-unit">M</span></div>
      </div>
      <div class="cal-field">
        <div class="cal-lbl">Natural Gas ($/MMBtu)</div>
        <div class="cal-row"><input class="cal-inp" id="cal-natgas" type="number" step="0.1" placeholder="3.2"><span class="cal-unit">$</span></div>
      </div>
      <div class="cal-field">
        <div class="cal-lbl">30yr Mortgage Rate</div>
        <div class="cal-row"><input class="cal-inp" id="cal-mortg" type="number" step="0.05" placeholder="6.75"><span class="cal-unit">%</span></div>
      </div>
    </div>
    <div class="cal-actions">
      <button class="btn primary" onclick="applyCalibration()">↗ Apply to Simulator Sliders</button>
      <button class="btn" onclick="runCalibrationCheck()">⊡ Show Calibration Gap</button>
    </div>
    <div id="cal-results" class="cal-results" style="display:none"></div>
    <div class="cal-note">
      <strong style="color:var(--text)">How it works:</strong><br>
      <em>Apply:</em> Directly observable values (FFR, oil, unemployment, etc.) are mapped to their sliders. Model-implied values (CPI, yields) are shown in the gap report.<br>
      <em>Gap report:</em> Shows actual vs model-implied for each metric. Large gaps suggest the model needs structural adjustments — look for systematic mis-pricings in pol-econ or credit variables.
    </div>
  </div>`;

  html += `<div class="section" id="sec-compare">
    <div class="sec-hdr">
      <div class="sec-title">Country Comparison</div>
      <div class="sec-desc">Side-by-side key outputs for all six economies at their default 2026 settings. Current country highlighted. Switch economies from the header dropdown.</div>
    </div>
    <div class="annotation">&#9432; Each country uses its own calibrated baseline values. GDP and CPI figures reflect each country's trend growth — not deviations from a common baseline.</div>
    <div class="cc-section-hdr">
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);">All outputs use country-specific defaults &amp; coefficient adjustments</div>
      <button class="btn primary" onclick="renderCountryComparison()">&#8635; Refresh</button>
    </div>
    <div id="cc-table-wrap"><div style="color:var(--muted);font-family:var(--font-mono);font-size:11px">Click Refresh or switch to this tab to load comparison\u2026</div></div>
    <div class="cc-note">
      <strong style="color:var(--text)">Reading the table:</strong>
      Green = healthy relative to each economy's own norms &nbsp;&bull;&nbsp; Amber = caution &nbsp;&bull;&nbsp; Red = stress.
      All values are model-implied from current slider settings for each economy. The highlighted row is your currently active economy.
      <br><br>
      <strong style="color:var(--text)">Key structural differences:</strong>
      Japan carries 260% debt/GDP (highest debt service burden). The Eurozone lacks fiscal union (lower fiscal multiplier). China's investment/GDP (~43%) is nearly 2.5x the US. EM economies have 2x the institutional quality sensitivity on GDP.
    </div>
  </div>`;

  html += `<div class="section" id="sec-history">
    <div class="sec-hdr">
      <div class="sec-title">Historical Scenario Validation</div>
      <div class="sec-desc">Load slider configurations calibrated to major historical episodes. See how the model performs vs. known outcomes — and use as a starting point for counterfactual analysis.</div>
    </div>
    <div class="annotation">&#9432; After loading, check the Sensitivity Analysis and Charts panels to see which factors drove each episode. Then use Events &amp; Shocks to layer on counterfactuals.</div>
    <div class="hist-grid" id="hist-grid"></div>
    <div class="sec-warn" style="margin-top:0">&#9888; Slider ranges are calibrated for contemporary analysis. Some historical extremes (e.g. Volcker-era 20% FFR) are capped at slider bounds — the directional story is still accurate.</div>
  </div>`;

  html += `<div class="section" id="sec-sensitivity">
    <div class="sec-hdr"><div class="sec-title">Sensitivity Analysis</div><div class="sec-desc">Which sliders have the largest impact on GDP growth under current settings? Ranked by absolute marginal effect.</div></div>
    <div class="sec-warn" style="margin-bottom:12px;">⚠ Values show Δ GDP per unit change in each input at current settings. Political economy effects are often among the largest but are typically underweighted in models.</div>
    <div class="sens-grid" id="sens-grid"></div>
  </div>`;
  el.innerHTML = html;
}

function getSliderDef(id) {
  for (const cat of CATEGORIES) {
    const sl = cat.sliders.find(s => s.id === id);
    if (sl) return sl;
  }
  return null;
}

function buildSlider(sl) {
  const v = vals[sl.id];
  const label = getCountryLabel(sl.id) || sl.label;
  const def = getSliderDefault(sl.id);
  const isMod = Math.abs(v - def) > 1e-9;
  return `<div class="slider-card${isMod?' modified':''}" id="card-${sl.id}">
    <div class="sl-top">
      <div class="sl-label">${label}</div>
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
        <button class="sl-reset" id="rst-${sl.id}" title="Reset to default (${sl.fmt(def)})" onclick="resetSlider('${sl.id}')">&#8634;</button>
        <div class="sl-val" id="v-${sl.id}">${sl.fmt(v)}</div>
      </div>
    </div>
    <div class="sl-desc">${sl.desc}</div>
    ${sliderOfficialSourceHtml(sl.id)}
    <input type="range" min="${sl.min}" max="${sl.max}" step="${sl.step}" value="${v}" id="r-${sl.id}"
      oninput="onSlider('${sl.id}', this.value)" onchange="commitChange()">
    <div class="sl-range"><span>${sl.fmt(sl.min)}</span><span>${sl.fmt(sl.max)}</span></div>
  </div>`;
}

// Default value for a slider, accounting for current country overrides
function getSliderDefault(id) {
  if (currentCountry === 'us' && officialSyncEnabled && officialBaselineVals && officialBaselineVals[id] !== undefined) return officialBaselineVals[id];
  const cc = COUNTRY_CONFIGS[currentCountry];
  if (cc && cc.defaults && cc.defaults[id] !== undefined) return cc.defaults[id];
  return DEFAULTS[id];
}

// Update the modified-state visuals for a single slider card
function updateModifiedState(id) {
  const card = document.getElementById('card-' + id);
  if (!card) return;
  const def = getSliderDefault(id);
  card.classList.toggle('modified', Math.abs(vals[id] - def) > 1e-9);
}

// Reset a single slider to its (country-aware) default
function resetSlider(id) {
  const sl = getSliderDef(id);
  if (!sl) return;
  const def = getSliderDefault(id);
  vals[id] = def;
  const r = document.getElementById('r-' + id);
  if (r) r.value = def;
  const vEl = document.getElementById('v-' + id);
  if (vEl) vEl.textContent = sl.fmt(def);
  updateModifiedState(id);
  const card = document.getElementById('card-' + id);
  if (card) { card.classList.remove('sl-flash'); void card.offsetWidth; card.classList.add('sl-flash'); }
  render();
  commitChange();
}

function onSlider(id, rawVal) {
  const v = parseFloat(rawVal);
  vals[id] = v;
  const sl = getSliderDef(id);
  if (sl) {
    const vEl = document.getElementById('v-' + id);
    if (vEl) vEl.textContent = sl.fmt(v);
  }
  updateModifiedState(id);
  render();
}

function customTargetOptions(selected='') {
  return CUSTOM_SHOCK_TARGETS.map(id => `<option value="${id}"${id===selected?' selected':''}>${escapeHtml(shockTargetLabel(id))}</option>`).join('');
}

function buildEventsSection() {
  const pos = EVENTS.filter(e => e.pos);
  const neg = EVENTS.filter(e => !e.pos);
  const customRows = [0,1,2].map((_,i) => `<div class="custom-channel-row">
    <select id="custom-target-${i}">${customTargetOptions(i===0?'gdpA':i===1?'cpiA':'spA')}</select>
    <input id="custom-effect-${i}" type="number" step="0.05" value="${i===0?'0.25':i===1?'0':'3'}" aria-label="Channel effect">
    <input id="custom-lag-${i}" type="number" min="0" max="60" step="1" value="${i===2?'0':'1'}" aria-label="Lag months">
    <input id="custom-peak-${i}" type="number" min="1" max="120" step="1" value="${i===2?'1':'3'}" aria-label="Peak month">
  </div>`).join('');
  return `<div class="section" id="sec-events">
    <div class="sec-hdr">
      <div class="sec-title">Events &amp; Structured Shock Engine</div>
      <div class="sec-desc">Build time-dependent scenarios with magnitude, persistence, transmission lags, interaction effects, and overlap controls. Metrics show the state at the selected month after shock onset.</div>
    </div>

    <div class="ai-studio">
      <div class="pipeline-strip"><span class="pipeline-step">Question / news</span><span class="pipeline-arrow">→</span><span class="pipeline-step">Groq interprets</span><span class="pipeline-arrow">→</span><span class="pipeline-step">Registry validation</span><span class="pipeline-arrow">→</span><span class="pipeline-step">MACROSCOPE runs</span><span class="pipeline-arrow">→</span><span class="pipeline-step">AI explains outputs</span></div>
      <div class="ai-studio-grid">
        <div class="ai-box">
          <div class="ai-box-title">AI Counterfactual Studio · structured-control workflow</div>
          <textarea id="ai-scenario-prompt" class="ai-prompt" oninput="updateAIContextMeter()" placeholder="Ask a counterfactual — e.g. What happens if inflation rises by 2 percentage points for a year? Simulate a recession with higher unemployment and lower consumption. What if the Fed responds aggressively? Compare a persistent oil-price shock with baseline. Enable the Taylor Rule."></textarea>
          <input id="ai-scenario-endpoint" class="ai-endpoint" placeholder="Cloudflare Worker URL (Groq API key stays server-side)" onchange="saveAIEndpoint(this.value)">
          <div class="reasoning-control">
            <div class="reasoning-head"><span>SCENARIO REASONING</span><b id="scenario-reasoning-label">LOW · FAST</b></div>
            <input id="scenario-reasoning" type="range" min="0" max="2" step="1" value="0" oninput="setScenarioReasoning(this.value)">
            <div class="reasoning-scale"><span>LOW</span><span>MEDIUM</span><span>HIGH</span></div>
            <div id="scenario-reasoning-note" class="reasoning-note">Fastest. Best for routine counterfactual construction and lowest token usage.</div>
          </div>
          <div class="ai-actions">
            <button class="btn primary" onclick="generateAIScenario()">Interpret counterfactual</button>
            <button class="btn" onclick="clearAIScenarioDraft()">Clear</button>
            <span class="ai-status" id="ai-scenario-status">LEAN CONTEXT READY</span>
          </div>
          <div class="ai-context-meter"><span>LEAN SCENARIO PAYLOAD</span><b id="ai-context-meter">Lean registry · JSON object mode · server-validated</b></div>
          <div class="ai-note">The LLM cannot touch the interface or execute code. It can only propose IDs from the local slider/shock registry. MACROSCOPE validates the command, previews it, and waits for you to run it. The same Worker then explains the simulator's own outputs.</div>
        </div>
        <div class="ai-box">
          <div class="ai-box-title">Validated command + counterfactual preview</div>
          <div class="ai-result" id="ai-scenario-result">No AI command yet. The manual structured-shock builder remains available below.</div>
          <div class="ai-actions" style="margin-top:8px"><button class="btn primary" id="ai-run-btn" onclick="runAIScenarioDraft()" disabled>Run validated scenario ↗</button></div>
        </div>
      </div>
    </div>

    <div class="shock-toolbar">
      <div class="shock-panel">
        <div class="shock-panel-title">Scenario evaluation point</div>
        <div class="shock-time-row">
          <input id="shock-month-range" type="range" min="0" max="120" step="1" value="${shockProjectionMonth}" oninput="setShockProjectionMonth(this.value)">
          <div class="shock-time-value" id="shock-month-value">Month ${shockProjectionMonth}</div>
        </div>
        <div class="shock-kpi-sub">Move through the shock path to see delayed, peak, and decaying effects.</div>
      </div>
      <div class="shock-panel"><div class="shock-panel-title">Active shocks</div><div class="shock-kpi" id="shock-active-count">0</div><div class="shock-kpi-sub">Scenario layers</div></div>
      <div class="shock-panel"><div class="shock-panel-title">Active channels</div><div class="shock-kpi" id="shock-channel-count">0</div><div class="shock-kpi-sub">Transmitting now</div></div>
      <div class="shock-panel"><div class="shock-panel-title">Overlap control</div><div class="shock-kpi" id="shock-overlap-kpi">0%</div><div class="shock-kpi-sub">Raw impact removed</div></div>
    </div>

    <div class="shock-workbench">
      <div class="shock-inspector" id="shock-inspector"></div>
      <div class="shock-attribution" id="shock-attribution"></div>
    </div>

    <details class="custom-builder">
      <summary>Create a custom structured shock <span style="font-family:var(--font-mono);font-size:9px;color:var(--muted);font-weight:400">No AI or backend required</span></summary>
      <div class="custom-builder-body">
        <div class="custom-core-grid">
          <input id="custom-shock-name" placeholder="Shock name — e.g. Semiconductor export embargo">
          <select id="custom-shock-category"><option>Energy</option><option>Monetary</option><option>Fiscal</option><option>Trade</option><option>Housing</option><option>Labor</option><option>Innovation</option><option>Bonds</option><option>Geopolitical</option><option>Custom</option></select>
          <select id="custom-shock-type"><option value="temporary">Temporary</option><option value="persistent" selected>Persistent</option><option value="structural">Structural</option></select>
          <input id="custom-shock-duration" type="number" min="1" max="240" value="24" title="Duration in months" placeholder="Duration">
        </div>
        <div class="custom-core-grid" style="grid-template-columns:1fr 1fr 1fr 1fr">
          <input id="custom-shock-magnitude" type="number" min="0.05" max="3" step="0.05" value="1" title="Initial magnitude multiplier">
          <input id="custom-shock-confidence" type="number" min="5" max="100" step="5" value="75" title="Impact confidence percent">
          <input id="custom-shock-peak" type="number" min="1" max="120" step="1" value="4" title="Default peak month">
          <input id="custom-shock-decay" type="number" min="0" max="1" step="0.01" value="0.08" title="Monthly decay rate">
        </div>
        <div class="custom-channel-head"><span>Target metric / input</span><span>Full effect</span><span>Lag</span><span>Peak</span></div>
        ${customRows}
        <div class="custom-builder-note">Effects are signed changes at 100% magnitude. GDP and CPI use percentage points; S&amp;P uses percent; spreads use basis points. Lag and peak are measured in months.</div>
        <button class="btn primary" onclick="addCustomEvent()">Inject structured shock ↗</button>
      </div>
    </details>

    <div class="shock-library-head"><div class="sec-title" style="font-size:13px">Preset shock library</div><input id="shock-filter" placeholder="Filter shocks…" oninput="filterShockCards(this.value)"></div>
    <div class="sec-title" style="font-size:13px;margin-bottom:8px;color:var(--pos);">▲ Positive Scenarios</div>
    <div class="ev-grid" id="positive-shock-grid" style="margin-bottom:14px">${pos.map(e => buildEventCard(e)).join('')}</div>
    <div class="sec-title" style="font-size:13px;margin-bottom:8px;color:var(--neg);">▼ Negative Shocks</div>
    <div class="ev-grid" id="negative-shock-grid">${neg.map(e => buildEventCard(e)).join('')}</div>
  </div>`;
}

function buildEventCard(e) {
  const cfg = activeEventIds[e.id] ? normalizeActiveShockConfig(e.id, activeEventIds[e.id]) : null;
  const mag = cfg ? Math.round(cfg.magnitude * 100) : 100;
  return `<div class="ev-card ${e.pos?'pos-ev':'neg-ev'}${cfg?' active':''}" id="ec-${e.id}" data-search="${escapeHtml((e.label+' '+e.cat+' '+e.shockType).toLowerCase())}" onclick="toggleEvent('${e.id}')">
    <div class="ev-card-top"><div class="ev-title">${escapeHtml(e.label)}</div><span class="shock-badge ${e.shockType}">${e.shockType}</span></div>
    <div class="ev-cat">${escapeHtml(e.cat)} · ${e.durationMonths}mo · peak M${e.peakMonth} · ${Math.round(e.confidence*100)}% confidence</div>
    <div class="ev-chips">${(e.chips||[]).map(c=>`<span class="ev-chip ${e.pos?'pos':'neg'}">${escapeHtml(c)}</span>`).join('')}</div>
    <div class="ev-live" id="ev-live-${e.id}"><span>${mag}% magnitude · Month ${shockProjectionMonth}</span><button class="ev-config-btn" onclick="event.stopPropagation();selectShock('${e.id}')">Configure</button></div>
  </div>`;
}

function showSection(id, btn) {
  currentSection = id;
  updateSystemSection(id);
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById('sec-' + id);
  if (sec) sec.classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'overview') { chartsVisible = false; sensitivityVisible = false; renderOverview(compute()); }
  else if (id === 'charts') { chartsVisible = true; renderCharts(compute()); }
  else if (id === 'data-copilot') { loadAIEndpoint(); renderDataCopilotProposal(); }
  else if (id === 'observed') { renderOfficialData(); }
  else if (id === 'calendar') { loadEconomicCalendar(); }
  else if (id === 'surprises') { loadEconomicCalendar(); renderReleaseSurprises(); }
  else if (id === 'news') { loadNewsFeed(); }
  else if (id === 'events') { renderShockWorkbench(compute()); loadAIEndpoint(); }
  else if (id === 'portfolio') { renderPortfolioLab(compute()); }
  else if (id === 'branches') { renderScenarioTree(); }
  else if (id === 'analyst') { loadAIEndpoint(); renderAnalystSnapshot(compute()); }
  else if (id === 'compare') { setTimeout(renderCountryComparison, 0); }
  else if (id === 'scenarios') { renderScenarios(); }
  else if (id === 'sensitivity') { sensitivityVisible = true; renderSensitivity(compute(), true); }
  else { chartsVisible = false; if (id !== 'sensitivity') sensitivityVisible = false; }
}


