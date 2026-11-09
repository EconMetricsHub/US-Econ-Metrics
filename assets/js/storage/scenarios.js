// ── SCENARIOS ────────────────────────────────────────────────────
let scenarios = (()=>{try{const x=JSON.parse(localStorage.getItem('macroscope_scenarios')||'[]');return Array.isArray(x)?x:[];}catch{return [];}})();

function saveScenario() {
  const name = document.getElementById('sc-name').value.trim() || 'Unnamed';
  const m    = compute();
  const sc   = {
    name, date: new Date().toLocaleString(),
    vals: {...vals}, activeEventIds: JSON.parse(JSON.stringify(activeEventIds)),
    shockProjectionMonth, customEvents:serializeCustomEvents(), officialSyncEnabled,
    out: { gdp: m.gdp, cpi: m.cpi, tenyr: m.tenyr, mortg: m.mortg, housingAff: m.housingAff, sp500: m.sp500, conf: m.conf }
  };
  if (scenarios.length >= 3) scenarios.shift();
  scenarios.push(sc);
  localStorage.setItem('macroscope_scenarios', JSON.stringify(scenarios));
  const scBtn = Array.from(document.querySelectorAll('.nav-item')).find(b => b.textContent.trim().startsWith('Scenarios'));
  showSection('scenarios', scBtn || null);
  renderScenarios();
}

function renderScenarios() {
  const grid = document.getElementById('sc-grid');
  if (!grid) return;
  const slots = [0,1,2].map(i => {
    const sc = scenarios[i];
    if (!sc) return `<div class="sc-slot"><div class="sc-empty">Empty slot</div></div>`;
    return `<div class="sc-slot filled">
      <div class="sc-name">${escapeHtml(sc.name)}</div>
      <div class="sc-date">${escapeHtml(sc.date)}</div>
      <div class="sc-metrics">
        <div class="sc-m">GDP <span>${sc.out.gdp.toFixed(1)}%</span></div>
        <div class="sc-m">CPI <span>${sc.out.cpi.toFixed(1)}%</span></div>
        <div class="sc-m">10yr <span>${sc.out.tenyr.toFixed(2)}%</span></div>
        <div class="sc-m">Mortg <span>${sc.out.mortg.toFixed(2)}%</span></div>
        <div class="sc-m">Housing <span>${Math.round(sc.out.housingAff)}/100</span></div>
        <div class="sc-m">S&amp;P <span>${Math.round(sc.out.sp500)}</span></div>
        <div class="sc-m">Conf <span>${Math.round(sc.out.conf)}</span></div>
      </div>
      <div class="sc-actions">
        <button class="sc-btn" onclick="loadScenario(${i})">Load</button>
        <button class="sc-btn danger" onclick="deleteScenario(${i})">Delete</button>
      </div>
    </div>`;
  });
  grid.innerHTML = slots.join('');
}

function loadScenario(i) {
  const sc = scenarios[i];
  if (!sc) return;
  officialSyncEnabled = !!sc.officialSyncEnabled && currentCountry==='us' && !!officialData;
  if (officialSyncEnabled) { officialBaselineVals = Object.assign({}, DEFAULTS, (COUNTRY_CONFIGS.us||{}).defaults||{}, officialData.baseline?.inputs||{}); calculateOfficialCalibration(); }
  else { officialBaselineVals=null; officialCalibration=emptyOfficialCalibration(); }
  vals = {...DEFAULTS, ...sc.vals};
  restoreCustomEvents(sc.customEvents);
  activeEventIds = JSON.parse(JSON.stringify(sc.activeEventIds || {}));
  normalizeAllActiveShocks();
  shockProjectionMonth = Number.isFinite(sc.shockProjectionMonth) ? sc.shockProjectionMonth : 3;
  selectedShockId = Object.keys(activeEventIds)[0] || null;
  // Rebuild content so restored custom event cards are available.
  buildContent();
  const sectionBtn = Array.from(document.querySelectorAll('.nav-item')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + currentSection + "'"));
  showSection(currentSection, sectionBtn || null);
  // Update all range inputs
  for (const [k, v] of Object.entries(vals)) {
    const el = document.getElementById('r-' + k);
    if (el) el.value = v;
    // Update displayed value
    const sl2 = getSliderDef(k);
    if (sl2) {
      const vEl = document.getElementById("v-" + k);
      if (vEl) vEl.textContent = sl2.fmt(v);
    }
  }
  // Reset event cards
  document.querySelectorAll('.ev-card').forEach(card => card.classList.remove('active'));
  for (const id of Object.keys(activeEventIds)) {
    const card = document.getElementById('ec-' + id);
    if (card) card.classList.add('active');
  }
  render();
  renderEventLog();
  document.getElementById('sc-name').value = sc.name;
}

function deleteScenario(i) {
  scenarios.splice(i, 1);
  localStorage.setItem('macroscope_scenarios', JSON.stringify(scenarios));
  renderScenarios();
}

