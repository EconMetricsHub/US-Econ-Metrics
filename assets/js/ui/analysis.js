// ── SENSITIVITY ANALYSIS ─────────────────────────────────────────
let sensitivityVisible = false;
function renderSensitivity(m, force) {
  if (!sensitivityVisible && !force) return;
  const grid = document.getElementById('sens-grid');
  if (!grid) return;
  const base  = m.gdp;
  const items = [];
  for (const cat of CATEGORIES) {
    for (const sl of cat.sliders) {
      const orig = vals[sl.id];
      const step = (sl.max - sl.min) * 0.1;
      vals[sl.id] = Math.min(sl.max, orig + step);
      const up   = compute().gdp;
      vals[sl.id] = Math.max(sl.min, orig - step);
      const dn   = compute().gdp;
      vals[sl.id] = orig;
      const sens = Math.abs(up - dn) / (2 * step) * 1; // per-unit sensitivity
      items.push({ label: sl.label, cat: cat.label, sens, pos: (up - dn) > 0 });
    }
  }
  items.sort((a, b) => b.sens - a.sens);
  const top   = items.slice(0, 20);
  const maxS  = top[0]?.sens || 1;
  grid.innerHTML = top.map((it, i) => {
    const pct = Math.round((it.sens / maxS) * 100);
    const col = it.pos ? 'var(--pos)' : 'var(--neg)';
    return `<div class="sens-row">
      <div class="sens-lbl">${i+1}. ${it.label} <span style="font-size:10px;color:var(--muted)">(${it.cat})</span></div>
      <div class="sens-track"><div class="sens-fill" style="width:${pct}%;background:${col}"></div></div>
      <div class="sens-v" style="color:${col}">${it.sens.toFixed(3)} Δ</div>
    </div>`;
  }).join('');
}

// ── CHARTS ───────────────────────────────────────────────────────
let chartsVisible = false;
let chartObjs = {};

function destroyChart(id) {
  if (chartObjs[id]) { chartObjs[id].destroy(); delete chartObjs[id]; }
}

function renderCharts(m) {
  renderGdpChart(m);
  renderYieldChart(m);
  renderRadarChart(m);
  renderCpiChart(m);
  renderSectorChart(m);
  renderPolChart(m);
}

function renderGdpChart(m) {
  // [6+MONTE CARLO] GDP fan chart: Monte Carlo uncertainty quantification
  // Each frame runs 220 simulations perturbing the 8 most uncertain inputs,
  // producing empirically-grounded 10th–90th percentile confidence intervals.
  destroyChart('gdp');

  const axisLabels = timeHorizon === 10
    ? ['Now','Yr 1','Yr 2','Yr 3','Yr 4','Yr 5','Yr 6','Yr 7','Yr 8','Yr 9','Yr 10','Yr 11']
    : timeHorizon === 3
    ? ['Now','Q2','Q3','Q4','Y2Q1','Y2Q2','Y2Q3','Y2Q4','Y3Q1','Y3Q2','Y3Q3','Y3Q4']
    : ['Now','M+1','M+2','M+3','M+4','M+5','M+6','M+7','M+8','M+9','M+10','M+11'];
  const months = axisLabels;
  const base = m.gdp;

  // Run Monte Carlo for current-period uncertainty spread
  const mc = runMonteCarlo(220);
  const spread90 = Math.max(0.3, (mc.p90 - mc.p10) / 2);
  const spread50 = Math.max(0.15, (mc.p75 - mc.p25) / 2);

  const tfpDelta   = (m.tfp - 1.2) / 12;
  const compRate   = timeHorizon === 10 ? 0.040 : timeHorizon === 3 ? 0.025 : 0.008;

  const trend = months.map((_, i) => {
    const cyclical   = (base - 2.5) * Math.exp(-i * 0.12);
    const tfpCompound = tfpDelta * i * (0.35 + compRate * 5);
    const cyc = Math.sin(i * 0.6) * 0.06;
    return +(2.5 + cyclical * 0.5 + tfpCompound + cyc).toFixed(2);
  });

  // Fan bands: spread grows with horizon (epistemic uncertainty compounds)
  const p90hi = trend.map((v, i) => +(v + spread90 * (1 + i * 0.07)).toFixed(2));
  const p90lo = trend.map((v, i) => +(v - spread90 * (1 + i * 0.07)).toFixed(2));
  const p50hi = trend.map((v, i) => +(v + spread50 * (1 + i * 0.03)).toFixed(2));
  const p50lo = trend.map((v, i) => +(v - spread50 * (1 + i * 0.03)).toFixed(2));
  const tfpPath = months.map((_, i) => +(2.5 + tfpDelta * i * (0.35 + compRate * 5)).toFixed(2));

    chartObjs.gdp = new Chart(document.getElementById('gdpChart'), {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label:'90th Pct',     data:p90hi, borderWidth:0, pointRadius:0, fill:'+1', backgroundColor:'rgba(0,212,122,0.05)' },
        { label:'IQR High',     data:p50hi, borderWidth:0, pointRadius:0, fill:'+1', backgroundColor:'rgba(0,212,122,0.10)' },
        { label:'Projected GDP',data:trend, borderColor:'#00d47a', backgroundColor:'transparent', tension:0.4, pointRadius:3, borderWidth:2, fill:false },
        { label:'IQR Low',      data:p50lo, borderWidth:0, pointRadius:0, fill:'+1', backgroundColor:'rgba(0,212,122,0.10)' },
        { label:'10th Pct',     data:p90lo, borderWidth:0, pointRadius:0, fill:false, backgroundColor:'transparent' },
        { label:'TFP Path',     data:tfpPath, borderColor:'rgba(240,160,48,0.55)', borderDash:[3,3], borderWidth:1.5, pointRadius:0, fill:false },
        { label:'Baseline 2.5%',data:months.map(()=>2.5), borderColor:'rgba(255,255,255,0.18)', borderDash:[5,4], borderWidth:1.5, pointRadius:0, fill:false },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ display:true, labels:{ color:'#4a6080', font:{ family:"'Space Mono',monospace", size:9 }, boxWidth:20, padding:10,
          filter: item => !['90th Pct','10th Pct','IQR High','IQR Low'].includes(item.label) }
        }
      },
      scales:{
        y:{ min:Math.min(...p90lo)-0.3, max:Math.max(...p90hi)+0.3,
            grid:{color:'rgba(255,255,255,0.05)'},
            ticks:{color:'#4a6080',callback:v=>`${v}%`,font:{family:"'Space Mono',monospace",size:10}} },
        x:{ grid:{display:false}, ticks:{color:'#4a6080',font:{family:"'Space Mono',monospace",size:10}} }
      }
    }
  });
}

function renderYieldChart(m) {
  destroyChart('yld');
  const labels = ['Fed Funds','3-mo','2yr','5yr','10yr','30yr','Mortgage'];
  const three_mo = Math.max(0.1, m.twoyr - 0.3);
  const data    = [vals.ffr, three_mo, m.twoyr, m.fiveyr, m.tenyr, m.thirtyr, m.mortg];
  chartObjs.yld = new Chart(document.getElementById('yldChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'Current', data, borderColor:'#4a9eff', backgroundColor:'rgba(74,158,255,0.07)', tension:0.3, pointBackgroundColor: data.map(v => v > 7 ? '#ff4055' : v > 5.5 ? '#ffd44a' : '#4a9eff'), pointRadius:5, borderWidth:2, fill:true },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false},
        tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${ctx.raw.toFixed(2)}%` } }
      },
      scales:{
        y:{ min:0, grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#4a6080',callback:v=>`${v.toFixed(1)}%`,font:{family:"'Space Mono',monospace",size:10}} },
        x:{ grid:{display:false}, ticks:{color:'#4a6080',font:{family:"'Space Mono',monospace",size:10},maxRotation:25} }
      }
    }
  });
}

function renderRadarChart(m) {
  destroyChart('radar');
  const secs = m.sectors;
  chartObjs.radar = new Chart(document.getElementById('radarChart'), {
    type: 'radar',
    data: {
      labels: Object.keys(secs),
      datasets: [
        { label:'Current', data:Object.values(secs), borderColor:'#f0a030', backgroundColor:'rgba(240,160,48,0.08)', pointBackgroundColor:'#f0a030', borderWidth:2, pointRadius:4 },
        { label:'Baseline', data:[50,80,75,50,50,60,50], borderColor:'rgba(255,255,255,0.15)', backgroundColor:'transparent', borderDash:[4,4], borderWidth:1, pointRadius:0 },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{ r:{ min:0, max:100, ticks:{stepSize:25,color:'#3a5470',font:{family:"'Space Mono',monospace",size:9}}, pointLabels:{color:'#7a9abf',font:{family:"'Barlow',sans-serif",size:11}}, grid:{color:'rgba(255,255,255,0.06)'}, angleLines:{color:'rgba(255,255,255,0.06)'} } }
    }
  });
}

function renderCpiChart(m) {
  destroyChart('cpi');
  const s = vals;
  const drivers = [
    { lbl:'Oil prices',        v: (s.oil - 70) * 0.016 },
    { lbl:'Tariffs',           v: (s.tariff - 10) * 0.022 },
    { lbl:'Gov\'t deficit',    v: (s.deficit - 4) * 0.038 },
    { lbl:'Fed rate policy',   v: -(s.ffr - 3) * 0.18 },
    { lbl:'Innovation (TFP)',  v: -(s.innovRate-1.5) * 0.15 },
    { lbl:'Shipping costs',    v: (s.shippingCost-4) * 0.035 },
    { lbl:'QE stimulus',       v: s.qePace > 0 ? s.qePace * 0.007 : 0 },
    { lbl:'Natural gas',       v: (s.natgas-3.5) * 0.04 },
    { lbl:'Gov\'t spending',   v: s.govSpend * 0.025 },
    { lbl:'Wage floors',       v: (s.minWage-7.25)*0.012 + (s.unionMem-10)*0.018 },
  ].filter(d => Math.abs(d.v) > 0.02).sort((a,b)=>Math.abs(b.v)-Math.abs(a.v)).slice(0,8);
  chartObjs.cpi = new Chart(document.getElementById('cpiChart'), {
    type:'bar',
    data:{
      labels: drivers.map(d=>d.lbl),
      datasets:[{ label:'CPI Contribution', data:drivers.map(d=>+d.v.toFixed(3)), backgroundColor:drivers.map(d=>d.v>0?'rgba(255,64,85,0.7)':'rgba(0,212,122,0.7)'), borderColor:drivers.map(d=>d.v>0?'#ff4055':'#00d47a'), borderWidth:1 }]
    },
    options:{
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{
        x:{ grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#4a6080',callback:v=>`${v>0?'+':''}${v.toFixed(2)}%`,font:{family:"'Space Mono',monospace",size:9}} },
        y:{ grid:{display:false}, ticks:{color:'#7a9abf',font:{family:"'Barlow',sans-serif",size:10}} }
      }
    }
  });
}

function renderSectorChart(m) {
  destroyChart('sector');
  if (!m.sectorOutputs) return;
  const so = m.sectorOutputs;
  const labels = Object.keys(so);
  const data   = Object.values(so);
  const colors = data.map(v => v >= 60 ? 'rgba(0,212,122,0.75)' : v >= 40 ? 'rgba(255,212,74,0.75)' : 'rgba(255,64,85,0.75)');
  const borders= data.map(v => v >= 60 ? '#00d47a' : v >= 40 ? '#ffd44a' : '#ff4055');
  chartObjs.sector = new Chart(document.getElementById('sectorChart'), {
    type:'bar',
    data:{ labels, datasets:[{ label:'Sector Health', data, backgroundColor:colors, borderColor:borders, borderWidth:1.5, borderRadius:3 }] },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false},
        tooltip:{ callbacks:{ label: ctx => `${ctx.label}: ${ctx.raw.toFixed(0)}/100` } }
      },
      scales:{
        y:{ min:0, max:100, grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#4a6080',callback:v=>`${v}`,font:{family:"'Space Mono',monospace",size:9}} },
        x:{ grid:{display:false}, ticks:{color:'#7a9abf',font:{family:"'Barlow',sans-serif",size:10}} }
      }
    }
  });
}

function renderPolChart(m) {
  destroyChart('pol');
  const s = vals;
  const factors = [
    { lbl:'Policy Certainty',      v: (s.policyCert-4)*0.072 },
    { lbl:'Rule of Law',           v: (s.ruleOfLaw-7)*0.042 },
    { lbl:'CB Independence',       v: (s.cbIndependence-7)*0.048 },
    { lbl:'Gov\'t Effectiveness',  v: (s.govEffective-5)*0.030 },
    { lbl:'Social Capital',        v: (s.socialCapital-5)*0.025 },
    { lbl:'Electoral Stability',   v: (s.electoralStab-7)*0.020 },
    { lbl:'Polarization (drag)',   v: -(s.polarization-5)*0.022 },
    { lbl:'Reg. Capture',          v: -(s.regCapture-5)*0.018 },
  ].sort((a,b)=>Math.abs(b.v)-Math.abs(a.v));
  chartObjs.pol = new Chart(document.getElementById('polChart'), {
    type:'bar',
    data:{
      labels: factors.map(d=>d.lbl),
      datasets:[{ label:'Δ GDP', data:factors.map(d=>+d.v.toFixed(3)), backgroundColor:factors.map(d=>d.v>0?'rgba(240,160,48,0.7)':'rgba(255,64,85,0.6)'), borderColor:factors.map(d=>d.v>0?'#f0a030':'#ff4055'), borderWidth:1 }]
    },
    options:{
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{
        x:{ grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#4a6080',callback:v=>`${v>=0?'+':''}${v.toFixed(3)}%`,font:{family:"'Space Mono',monospace",size:9}} },
        y:{ grid:{display:false}, ticks:{color:'#7a9abf',font:{family:"'Barlow',sans-serif",size:10}} }
      }
    }
  });
}

// ── EXPORT / RESET ───────────────────────────────────────────────
function exportJSON() {
  const m    = compute();
  const data = { metadata:{ name:document.getElementById('sc-name').value, timestamp:new Date().toISOString(), version:'MACROSCOPE v8.0', shockProjectionMonth, officialSyncEnabled, officialDataGeneratedAt:officialData?.generatedAt||null, surpriseEngineGeneratedAt:surpriseEngine?.generatedAt||null, activeReleaseSignals:compute().calendarShockReport?.activeShocks?.length||0 }, inputs:vals, activeShocks:JSON.parse(JSON.stringify(activeEventIds)), customShockDefinitions:serializeCustomEvents(), shockAttribution:m.shockReport, releaseShockAttribution:m.calendarShockReport, outputs:{ gdp:m.gdp, cpi:m.cpi, tfp:m.tfp, tenyr:m.tenyr, twoyr:m.twoyr, thirtyr:m.thirtyr, mortgage:m.mortg, yieldSpread:m.yldSprd, housingAffordability:m.housingAff, sp500:m.sp500, consumerConfidence:m.conf, deficitPctGDP:m.defAdj, dollar:m.dollarAdj } };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `macroscope_${document.getElementById('sc-name').value.replace(/\s+/g,'_')}_${Date.now()}.json`;
  a.click();
}

function resetAll() {
  const base = (currentCountry==='us' && officialSyncEnabled && officialBaselineVals) ? officialBaselineVals : Object.assign({}, DEFAULTS, (COUNTRY_CONFIGS[currentCountry]||{}).defaults||{});
  vals = {...base};
  activeEventIds = {};
  selectedShockId = null;
  shockProjectionMonth = 3;
  for (const cat of CATEGORIES) {
    for (const sl of cat.sliders) {
      const el = document.getElementById('r-' + sl.id);
      const baseVal = base[sl.id] !== undefined ? base[sl.id] : DEFAULTS[sl.id];
      if (el) el.value = baseVal;
      const vEl = document.getElementById('v-' + sl.id);
      if (vEl) vEl.textContent = sl.fmt(baseVal);
    }
  }
  document.querySelectorAll('.ev-card').forEach(c => c.classList.remove('active'));
  refreshAllModified();
  render();
  renderEventLog();
  commitChange();
}
let pendingPdfChanges = [];
let pendingPdfScenarioCommand = null;

function openPdfModal() {
  document.getElementById('pdf-modal-overlay').classList.add('open');
  resetPdfModal();
}
function closePdfModal() {
  document.getElementById('pdf-modal-overlay').classList.remove('open');
}
function resetPdfModal() {
  pendingPdfChanges = [];
  pendingPdfScenarioCommand = null;
  document.getElementById('pdf-drop-zone').classList.remove('drag-over');
  document.getElementById('pdf-status').style.display = 'none';
  document.getElementById('pdf-results').style.display = 'none';
  document.getElementById('pdf-error').style.display = 'none';
  document.getElementById('ps-fill').style.width = '0%';
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('pdf-drop-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') processPdfFile(file);
  else showPdfError('Please drop a PDF file.');
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processPdfFile(file);
}

function showPdfError(msg) {
  document.getElementById('pdf-status').style.display = 'none';
  document.getElementById('pdf-results').style.display = 'none';
  const el = document.getElementById('pdf-error');
  el.style.display = 'block';
  el.textContent = '⚠ ' + msg;
}

function animateProgress(targetPct, duration) {
  const fill = document.getElementById('ps-fill');
  const start = parseFloat(fill.style.width) || 0;
  const startTime = performance.now();
  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    fill.style.width = (start + (targetPct - start) * t) + '%';
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

async function extractPdfText(file,maxChars=10000) {
  if (!window.pdfjsLib) throw new Error('PDF text reader failed to load. Check the PDF.js CDN connection.');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const bytes=await file.arrayBuffer();
  const pdf=await window.pdfjsLib.getDocument({data:bytes}).promise;
  let text='';
  const pages=Math.min(pdf.numPages,30);
  for(let i=1;i<=pages&&text.length<maxChars;i++){
    const page=await pdf.getPage(i); const content=await page.getTextContent();
    const line=content.items.map(x=>x.str||'').join(' ').replace(/\s+/g,' ').trim();
    if(line)text+=`\n[Page ${i}] ${line}`;
  }
  return text.slice(0,maxChars).trim();
}

async function processPdfFile(file) {
  resetPdfModal();
  const status=document.getElementById('pdf-status');
  status.style.display='block';
  document.getElementById('ps-filename').textContent=file.name;
  animateProgress(20,400);
  try {
    const endpoint=normalizeAIEndpoint(localStorage.getItem('macroscope.ai.endpoint')||DEFAULT_AI_ENDPOINT||'');
    if(!endpoint) throw new Error('Configure the Cloudflare Worker URL in AI Counterfactual Studio or Ask MACROSCOPE before analyzing a PDF.');
    const text=await extractPdfText(file,10000);
    if(!text||text.length<80) throw new Error('Could not extract enough text from this PDF. Scanned/image-only PDFs need OCR before upload.');
    animateProgress(55,500);
    await loadSliderRegistry();
    const context=await aiContextPayload();
    const prompt=`Analyze the following PDF text as economic or financial information. Treat claims as document content, not independently verified facts. Translate only well-supported implications into the smallest defensible set of MACROSCOPE slider changes and, if the document describes a temporary or lagged event, a structured shock. Preserve uncertainty and do not invent missing numbers.\n\nFILE: ${file.name}\n\nDOCUMENT EXCERPT:\n${text}`;
    animateProgress(72,500);
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'scenario',prompt,context})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||`AI endpoint HTTP ${response.status}`);
    const command=validateAIScenarioCommand(payload.command||payload);
    pendingPdfScenarioCommand=command;
    const extra=[];
    if(command.shock.enabled)extra.push(`${command.shock.shockType} shock: ${command.shock.label}`);
    if(command.settings.taylorRule.apply)extra.push(`Taylor Rule → ${command.settings.taylorRule.enabled?'ON':'OFF'}`);
    const parsed={headline:command.scenarioName||'Document scenario',summary:`${command.rationale||'AI-generated counterfactual interpretation.'}${extra.length?` Additional controls: ${extra.join(' · ')}.`:''}`,changes:command.sliderChanges.map(c=>({id:c.id,newValue:c.finalValue,reason:c.reason}))};
    animateProgress(100,250);
    setTimeout(()=>renderPdfResults(parsed),220);
  } catch(err) {
    showPdfError(err.message||'Unknown error analyzing the PDF.');
  }
}

function renderPdfResults(parsed) {
  document.getElementById('pdf-status').style.display = 'none';
  document.getElementById('pdf-results').style.display = 'block';

  // Summary box
  const box = document.getElementById('pr-summary-box');
  box.innerHTML = `<strong>${parsed.headline || 'Article Analysis'}</strong>${parsed.summary || ''}`;

  // Build change rows
  const list = document.getElementById('pr-changes-list');
  const changes = (parsed.changes || []).filter(c => {
    const sl = getSliderDef(c.id);
    return sl && typeof c.newValue === 'number' && !isNaN(c.newValue);
  });

  const hasExtraControls = !!pendingPdfScenarioCommand?.shock?.enabled || !!pendingPdfScenarioCommand?.settings?.taylorRule?.apply;
  if (!changes.length && !hasExtraControls) {
    list.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px;">No specific simulator changes identified in this document.</div>';
    document.getElementById('pr-apply-btn').style.display = 'none';
    pendingPdfChanges = [];
    return;
  }

  pendingPdfChanges = changes;
  document.getElementById('pr-apply-btn').style.display = 'block';
  if (!changes.length && hasExtraControls) list.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:8px;">No direct slider changes. The approved command contains a structured shock and/or Taylor Rule setting.</div>';

  if (changes.length) list.innerHTML = changes.map(c => {
    const sl = getSliderDef(c.id);
    if (!sl) return '';
    const oldVal = vals[c.id];
    const newVal = Math.max(sl.min, Math.min(sl.max, c.newValue));
    const up = newVal > oldVal;
    const dir = newVal !== oldVal ? (up ? 'up' : 'dn') : '';
    return `<div class="pr-change ${dir}">
      <div class="prc-arrow ${dir}">${newVal > oldVal ? '▲' : newVal < oldVal ? '▼' : '—'}</div>
      <div class="prc-name">${sl.label}</div>
      <div class="prc-old">${sl.fmt(oldVal)}</div>
      <div style="color:var(--muted);font-size:11px;">→</div>
      <div class="prc-new ${dir}">${sl.fmt(newVal)}</div>
      <div class="prc-reason" style="width:100%;padding-top:4px;border-top:1px solid var(--border);margin-top:4px">${c.reason || ''}</div>
    </div>`;
  }).join('');
}

function applyPdfChanges() {
  const command=pendingPdfScenarioCommand;
  if(command){
    for(const c of command.sliderChanges||[]) vals[c.id]=c.finalValue;
    if(command.settings?.taylorRule?.apply)taylorRuleOn=command.settings.taylorRule.enabled;
    injectAIScenarioShock(command.shock);
    syncSliderDomFromVals(); syncTaylorRuleUi(); render(); renderEventLog(); commitChange();
    closePdfModal();
    const mbar=document.getElementById('mbar'); if(mbar){mbar.style.transition='opacity 0.15s';mbar.style.opacity='0.3';setTimeout(()=>{mbar.style.opacity='1';},200);}
    toast('Document-derived scenario applied after registry validation');
    return;
  }
  if (!pendingPdfChanges.length) return;
  for (const c of pendingPdfChanges) {
    const sl = getSliderDef(c.id); if (!sl) continue;
    vals[c.id] = Math.max(sl.min, Math.min(sl.max, c.newValue));
  }
  syncSliderDomFromVals(); render(); closePdfModal(); commitChange();
}

// ── 2026 Q2 CALIBRATION ──────────────────────────────────────────
// Estimated Q2 2026 baseline values (based on trend extrapolation to mid-2026)
// Users should override with actual released data when available
const Q2_2026_ESTIMATES = {
  gdp:    2.1,   // Annualized real GDP growth — moderate expansion
  cpi:    3.0,   // YoY CPI — sticky services, easing goods
  ffr:    4.25,  // FOMC cut 25bp in Q1 2026; on hold Q2
  tenyr:  4.35,  // Term premium rising; modest fiscal concerns
  unemp:  4.2,   // Slight softening from peak employment
  oil:    69,    // WTI — supply/demand roughly balanced, Iran risk eased
  dxy:    103,   // Dollar modestly softer vs 2025 peak
  housing:1.35,  // Starts still below trend; tight supply continuing
  natgas: 3.2,   // Normalizing from 2024-25 volatility
  mortg:  6.75,  // Mortgage spread compression; still affordability-challenged
};

const CAL_FIELDS = [
  { id:'cal-gdp',     sliders:null,          label:'GDP Growth',      unit:'%',     fmt:v=>v.toFixed(1)+'%' },
  { id:'cal-cpi',     sliders:null,          label:'CPI Inflation',   unit:'%',     fmt:v=>v.toFixed(1)+'%' },
  { id:'cal-ffr',     sliders:['ffr','ioer'],label:'Fed Funds Rate',  unit:'%',     fmt:v=>v.toFixed(2)+'%', applyFn: v => ({ ffr: v, ioer: Math.max(0, v - 0.1) }) },
  { id:'cal-tenyr',   sliders:null,          label:'10yr Treasury',   unit:'%',     fmt:v=>v.toFixed(2)+'%' },
  { id:'cal-unemp',   sliders:['unemp'],     label:'Unemployment',    unit:'%',     fmt:v=>v.toFixed(1)+'%', applyFn: v => ({ unemp: v }) },
  { id:'cal-oil',     sliders:['oil'],       label:'WTI Oil',         unit:'$/bbl', fmt:v=>'$'+v.toFixed(0), applyFn: v => ({ oil: v }) },
  { id:'cal-dxy',     sliders:['dxy'],       label:'DXY Dollar',      unit:'index', fmt:v=>v.toFixed(1),     applyFn: v => ({ dxy: v }) },
  { id:'cal-housing', sliders:['housingSupply'],label:'Housing Starts',unit:'M',    fmt:v=>v.toFixed(2)+'M', applyFn: v => ({ housingSupply: Math.max(0.5, Math.min(3.0, v)) }) },
  { id:'cal-natgas',  sliders:['natgas'],    label:'Natural Gas',     unit:'$/MMBtu',fmt:v=>'$'+v.toFixed(1),applyFn: v => ({ natgas: v }) },
  { id:'cal-mortg',   sliders:null,          label:'30yr Mortgage',   unit:'%',     fmt:v=>v.toFixed(2)+'%' },
];

function loadQ2Preset() {
  const p = (COUNTRY_CONFIGS[currentCountry] && COUNTRY_CONFIGS[currentCountry].q2) || Q2_2026_ESTIMATES;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('cal-gdp',     p.gdp);
  set('cal-cpi',     p.cpi);
  set('cal-ffr',     p.ffr);
  set('cal-tenyr',   p.tenyr);
  set('cal-unemp',   p.unemp);
  set('cal-oil',     p.oil);
  set('cal-dxy',     p.dxy);
  set('cal-housing', p.housing);
  set('cal-natgas',  p.natgas);
  set('cal-mortg',   p.mortg);
}

function clearCalibration() {
  CAL_FIELDS.forEach(f => {
    const el = document.getElementById(f.id);
    if (el) el.value = '';
  });
  document.getElementById('cal-results').style.display = 'none';
}

function getCalVal(id) {
  const el = document.getElementById(id);
  if (!el || el.value === '') return null;
  return parseFloat(el.value);
}

function applyCalibration() {
  let applied = 0;
  for (const f of CAL_FIELDS) {
    const v = getCalVal(f.id);
    if (v === null || !f.applyFn) continue;
    const updates = f.applyFn(v);
    for (const [k, nv] of Object.entries(updates)) {
      const sl = getSliderDef(k);
      if (!sl) continue;
      const clamped = Math.max(sl.min, Math.min(sl.max, nv));
      vals[k] = clamped;
      const rangeEl = document.getElementById('r-' + k);
      if (rangeEl) rangeEl.value = clamped;
      const valEl = document.getElementById('v-' + k);
      if (valEl) valEl.textContent = sl.fmt(clamped);
      applied++;
    }
  }

  // Try to back-solve 10yr yield via foreignDemand + termPremium adjustment
  const tenyrObs = getCalVal('cal-tenyr');
  if (tenyrObs !== null) {
    const m = compute();
    const tenyrGap = tenyrObs - m.tenyr; // observed minus model-implied
    // Adjust foreignDemand down/up to match (each unit ≈ 0.07% on 10yr)
    const demAdj = Math.round(-tenyrGap / 0.07);
    const newDemand = Math.max(1, Math.min(10, vals.foreignDemand + demAdj));
    vals.foreignDemand = newDemand;
    const r = document.getElementById('r-foreignDemand');
    if (r) r.value = newDemand;
    const v2 = document.getElementById('v-foreignDemand');
    const sl = getSliderDef('foreignDemand');
    if (v2 && sl) v2.textContent = sl.fmt(newDemand);
    applied++;
  }

  refreshAllModified();
  render();
  commitChange();

  // Flash metrics bar
  const mbar = document.getElementById('mbar');
  if (mbar) {
    mbar.style.transition = 'opacity 0.15s';
    mbar.style.opacity = '0.3';
    setTimeout(() => { mbar.style.opacity = '1'; }, 220);
  }

  runCalibrationCheck();
  const notice = document.createElement('div');
  notice.className = 'annotation';
  notice.style.marginTop = '10px';
  notice.textContent = `✓ Applied ${applied} observable values to simulator sliders. Calibration gap report below.`;
  const res = document.getElementById('cal-results');
  if (res && res.firstChild) res.insertBefore(notice, res.firstChild);
  setTimeout(() => notice.remove(), 4000);
}

function runCalibrationCheck() {
  const m = compute();
  const results = document.getElementById('cal-results');
  if (!results) return;
  results.style.display = 'block';

  const checks = [
    { lbl:'GDP Growth',       obs: getCalVal('cal-gdp'),     model: m.gdp,      unit:'%',     fmt: v => v.toFixed(1)+'%' },
    { lbl:'CPI Inflation',    obs: getCalVal('cal-cpi'),     model: m.cpi,      unit:'%',     fmt: v => v.toFixed(1)+'%' },
    { lbl:'10yr Treasury',    obs: getCalVal('cal-tenyr'),   model: m.tenyr,    unit:'%',     fmt: v => v.toFixed(2)+'%' },
    { lbl:'30yr Mortgage',    obs: getCalVal('cal-mortg'),   model: m.mortg,    unit:'%',     fmt: v => v.toFixed(2)+'%' },
    { lbl:'Effective Deficit',obs: null,                     model: m.effectiveDeficit, unit:'% GDP', fmt: v => v.toFixed(1)+'%' },
    { lbl:'Housing Afford.',  obs: null,                     model: m.housingAff,unit:'/100', fmt: v => Math.round(v)+'/100' },
    { lbl:'Consumer Conf.',   obs: null,                     model: m.conf,     unit:'',      fmt: v => Math.round(v) },
    { lbl:'S&P 500 Index',    obs: null,                     model: m.sp500,    unit:'(base=100)', fmt: v => Math.round(v) },
    { lbl:'Debt Svc % GDP',   obs: null,                     model: m.interestCostPctGDP, unit:'%', fmt: v => v.toFixed(1)+'%' },
  ];

  const rows = checks.map(c => {
    if (c.obs === null) {
      // Model-only output
      return `<div class="cal-row-item">
        <div class="cri-lbl">${c.lbl}</div>
        <div class="cri-actual" style="color:var(--muted)">—</div>
        <div class="cri-model">${c.fmt(c.model)}</div>
        <div class="cri-gap neu">model only</div>
      </div>`;
    }
    const gap = c.obs - c.model;
    const pct = Math.abs(gap) / Math.max(0.01, Math.abs(c.model));
    const cls = pct < 0.05 ? 'ok' : pct < 0.15 ? 'warn' : 'miss';
    const gapCls = gap > 0.01 ? 'pos' : gap < -0.01 ? 'neg' : 'neu';
    const gapStr = (gap > 0 ? '+' : '') + (Math.abs(gap) < 5 ? gap.toFixed(2) : gap.toFixed(1));
    return `<div class="cal-row-item ${cls}">
      <div class="cri-lbl">${c.lbl}</div>
      <div class="cri-actual">${c.fmt(c.obs)}</div>
      <div class="cri-model">${c.fmt(c.model)}</div>
      <div class="cri-gap ${gapCls}">${gapStr}</div>
    </div>`;
  }).join('');

  const header = `<div class="cal-results-title">
    <span style="display:inline-flex;gap:20px;font-family:var(--font-mono);font-size:9px;color:var(--muted);width:100%;justify-content:space-between;padding:0 11px;box-sizing:border-box;">
      <span>INDICATOR</span><span style="display:flex;gap:48px"><span>ACTUAL</span><span>MODEL</span><span>GAP</span></span>
    </span>
  </div>`;

  const legend = `<div style="display:flex;gap:10px;margin-top:8px;font-family:var(--font-mono);font-size:9px;color:var(--muted);">
    <span style="color:var(--pos)">■</span> <5% gap &nbsp;
    <span style="color:var(--warn)">■</span> 5-15% gap &nbsp;
    <span style="color:var(--neg)">■</span> >15% gap
  </div>`;

  results.innerHTML = header + rows + legend;
}


// ── HISTORICAL GRID BUILDER ───────────────────────────────────────
function buildHistoricalGrid() {
  const grid = document.getElementById('hist-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(HISTORICAL_PRESETS).map(([id, p]) => {
    const tags = p.stats.map(s => `<span class="hist-tag ${s.c}">${s.t}</span>`).join('');
    return `<div class="hist-card ${p.type}" onclick="loadHistoricalPreset('${id}')">
      <div class="hist-name">${p.name}</div>
      <div class="hist-period">${p.period}</div>
      <div class="hist-desc">${p.desc}</div>
      <div class="hist-stats">${tags}</div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
//  ENHANCEMENTS — added features
// ═══════════════════════════════════════════════════════════════════

// ── Small toast helper ───────────────────────────────────────────
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'ms-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity 0.4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 420); }, 1600);
}

function refreshAllModified() {
  for (const cat of CATEGORIES) for (const sl of cat.sliders) updateModifiedState(sl.id);
}

