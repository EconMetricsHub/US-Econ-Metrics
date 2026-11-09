// ── [#3] SLIDER SEARCH ────────────────────────────────────────────
let searchHits = [], searchSel = -1;
function onSearch(q) {
  q = (q || '').trim().toLowerCase();
  const clear = document.getElementById('search-clear');
  const res   = document.getElementById('search-results');
  if (clear) clear.style.display = q ? 'block' : 'none';
  if (!q) { res.classList.remove('active'); res.innerHTML = ''; searchHits = []; searchSel = -1; return; }
  const hits = [];
  for (const cat of CATEGORIES) {
    for (const sl of cat.sliders) {
      const label = (getCountryLabel(sl.id) || sl.label);
      const hay = (label + ' ' + sl.id + ' ' + (sl.desc || '') + ' ' + cat.label).toLowerCase();
      if (hay.includes(q)) hits.push({ id: sl.id, label, cat: cat.label, catId: cat.id });
    }
  }
  searchHits = hits; searchSel = hits.length ? 0 : -1;
  if (!hits.length) { res.innerHTML = '<div class="search-nohit">No matching inputs</div>'; res.classList.add('active'); return; }
  res.innerHTML = hits.slice(0, 40).map((h, i) =>
    `<button class="search-hit${i === 0 ? ' sel' : ''}" data-i="${i}" onclick="jumpToSlider('${h.id}','${h.catId}')">
      <span class="search-hit-lbl">${h.label}</span><span class="search-hit-cat">${h.cat}</span>
    </button>`).join('');
  res.classList.add('active');
}
function onSearchKey(e) {
  if (e.key === 'Escape') { clearSearch(); e.target.blur(); return; }
  if (!searchHits.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); searchSel = Math.min(searchHits.length - 1, searchSel + 1); updateSearchSel(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); searchSel = Math.max(0, searchSel - 1); updateSearchSel(); }
  else if (e.key === 'Enter') { e.preventDefault(); const h = searchHits[searchSel] || searchHits[0]; if (h) jumpToSlider(h.id, h.catId); }
}
function updateSearchSel() {
  document.querySelectorAll('.search-hit').forEach((el, i) => el.classList.toggle('sel', i === searchSel));
  const sel = document.querySelector('.search-hit.sel'); if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
}
function clearSearch() { const inp = document.getElementById('slider-search'); if (inp) inp.value = ''; onSearch(''); }
function focusSearch() { const i = document.getElementById('slider-search'); if (i) { i.focus(); i.select(); } }
function jumpToSlider(id, catId) {
  const btn = Array.from(document.querySelectorAll('.nav-item'))
    .find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + catId + "'"));
  showSection(catId, btn || null);
  setTimeout(() => {
    const card = document.getElementById('card-' + id);
    if (card) {
      if (card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.remove('sl-flash'); void card.offsetWidth; card.classList.add('sl-flash');
    }
  }, 50);
}

// ── [#8] CSV EXPORT ───────────────────────────────────────────────
function exportCSV() {
  const m = compute();
  const rows = [['Section', 'Field', 'Value']];
  for (const cat of CATEGORIES) for (const sl of cat.sliders)
    rows.push([cat.label, (getCountryLabel(sl.id) || sl.label), vals[sl.id]]);
  const outs = [
    ['GDP Growth %', m.gdp], ['CPI %', m.cpi], ['TFP %', m.tfp], ['10yr %', m.tenyr],
    ['2yr %', m.twoyr], ['30yr %', m.thirtyr], ['Mortgage %', m.mortg], ['2-10 Spread %', m.yldSprd],
    ['Housing Affordability', m.housingAff], ['S&P 500', m.sp500], ['Consumer Confidence', m.conf],
    ['Effective Deficit %', m.defAdj], ['Debt Service %GDP', m.interestCostPctGDP],
    ['Dollar DXY', m.dollarAdj], ['Financial Stability', m.fsi], ['Global Growth %', m.rowGrowth]
  ];
  for (const [k, v] of outs) rows.push(['OUTPUT', k, (typeof v === 'number' ? +v.toFixed(3) : v)]);
  rows.push(['META', 'Country', currentCountry]);
  rows.push(['META', 'Horizon (yr)', timeHorizon]);
  rows.push(['META', 'Taylor Rule', taylorRuleOn ? 'ON' : 'OFF']);
  rows.push(['META', 'Official Data Sync', officialSyncEnabled ? 'ON' : 'OFF']);
  rows.push(['META', 'Official Data Generated', officialData?.generatedAt || '']);
  rows.push(['META', 'Shock Evaluation Month', shockProjectionMonth]);
  rows.push(['META', 'Active Shocks', Object.entries(activeEventIds).map(([id,cfg]) => `${id}@${Math.round(normalizeActiveShockConfig(id,cfg).magnitude*100)}%`).join('; ')]);
  rows.push(['META', 'Generated', new Date().toISOString()]);
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const nm = (document.getElementById('sc-name').value || 'macroscope').replace(/\s+/g, '_');
  a.download = `macroscope_${nm}_${Date.now()}.csv`;
  a.click();
  toast('CSV exported');
}

// ── [#9] METRIC DRIVER TOOLTIPS ───────────────────────────────────
const METRIC_LABELS = {
  gdp:'GDP Growth', cpi:'CPI Inflation', tenyr:'10yr Treasury', mortg:'30yr Mortgage',
  housingAff:'Housing Affordability', sp500:'S&P 500', conf:'Consumer Confidence', fsi:'Financial Stability',
  twoyr:'2yr Treasury', yldSprd:'2-10 Spread', tfp:'TFP Growth', defAdj:'Effective Deficit',
  interestCostPctGDP:'Debt Service %GDP', dollarAdj:'Dollar (DXY)', rowGrowth:'Global Growth'
};

// Finite-difference decomposition: contribution ≈ (∂metric/∂input) × (input − default)
function explainMetric(key) {
  const saved = Object.assign({}, vals);
  const savedTR = taylorRuleOn;
  taylorRuleOn = false; // avoid FFR override + DOM writes during perturbation
  const contribs = [];
  for (const cat of CATEGORIES) {
    for (const sl of cat.sliders) {
      const cur = vals[sl.id];
      const def = getSliderDefault(sl.id);
      const dev = cur - def;
      if (Math.abs(dev) < 1e-9) continue;
      const delta = Math.max(sl.step, (sl.max - sl.min) * 0.02);
      vals[sl.id] = Math.min(sl.max, cur + delta); const up = compute()[key];
      vals[sl.id] = Math.max(sl.min, cur - delta); const dn = compute()[key];
      vals[sl.id] = cur;
      if (up === undefined || dn === undefined) continue;
      const slope = (up - dn) / (2 * delta);
      const contrib = slope * dev;
      if (Math.abs(contrib) > 0.005) contribs.push({ label: (getCountryLabel(sl.id) || sl.label), contrib });
    }
  }
  Object.assign(vals, saved);
  taylorRuleOn = savedTR;
  contribs.sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));
  return contribs.slice(0, 5);
}

function wireMetricTooltips() {
  const bar = document.getElementById('mbar');
  const tip = document.getElementById('metric-tip');
  if (!bar || !tip) return;
  bar.addEventListener('mouseover', e => {
    const mc = e.target.closest('.mc[data-metric]'); if (!mc) return;
    showMetricTip(mc.getAttribute('data-metric'), e);
  });
  bar.addEventListener('mousemove', e => { if (tip.style.display === 'block') positionTip(e); });
  bar.addEventListener('mouseout', e => {
    const mc = e.target.closest('.mc[data-metric]'); if (!mc) return;
    if (e.relatedTarget && mc.contains(e.relatedTarget)) return;
    tip.style.display = 'none';
  });
}
function showMetricTip(key, e) {
  const tip = document.getElementById('metric-tip');
  const drivers = explainMetric(key);
  const title = METRIC_LABELS[key] || key;
  let html = `<div class="mt-hd">${title} — top drivers vs. baseline</div>`;
  if (!drivers.length) html += '<div class="mt-empty">At baseline — no inputs moved from default.</div>';
  else html += drivers.map(d => {
    const cls = d.contrib > 0 ? 'pos' : 'neg';
    const s = (d.contrib > 0 ? '+' : '') + d.contrib.toFixed(2);
    return `<div class="mt-row"><span class="mt-name">${d.label}</span><span class="mt-val ${cls}">${s}</span></div>`;
  }).join('');
  tip.innerHTML = html;
  tip.style.display = 'block';
  positionTip(e);
}
function positionTip(e) {
  const tip = document.getElementById('metric-tip');
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = e.clientX + 14, y = e.clientY + 14;
  if (x + w > window.innerWidth - 10) x = e.clientX - w - 14;
  if (y + h > window.innerHeight - 10) y = e.clientY - h - 14;
  tip.style.left = Math.max(6, x) + 'px';
  tip.style.top  = Math.max(6, y) + 'px';
}

// ── [#2] KEYBOARD SHORTCUTS ───────────────────────────────────────
function toggleShortcuts() {
  const ov = document.getElementById('shortcuts-overlay');
  if (ov) ov.classList.toggle('active');
}
function cycleSection(dir) {
  const ids = ['overview', ...CATEGORIES.map(c => c.id), ...ANALYSIS_SECTIONS.map(s => s.id)];
  let idx = ids.indexOf(currentSection); if (idx < 0) idx = 0;
  idx = (idx + dir + ids.length) % ids.length;
  const id = ids[idx];
  const btn = Array.from(document.querySelectorAll('.nav-item'))
    .find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + id + "'"));
  showSection(id, btn || null);
  if (btn && btn.scrollIntoView) btn.scrollIntoView({ block: 'nearest' });
}
function wireKeyboard() {
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

    // Undo / redo — not while editing a text field (let native undo work there)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && tag !== 'input' && tag !== 'textarea') {
      e.preventDefault(); if (e.shiftKey) redo(); else undo(); return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y') && tag !== 'input' && tag !== 'textarea') {
      e.preventDefault(); redo(); return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (typing) {
      if (e.key === 'Escape') {
        e.target.blur();
        const ov = document.getElementById('shortcuts-overlay'); if (ov) ov.classList.remove('active');
      }
      return;
    }

    switch (e.key) {
      case '/': e.preventDefault(); focusSearch(); break;
      case '?': e.preventDefault(); toggleShortcuts(); break;
      case 'Escape': {
        const ov = document.getElementById('shortcuts-overlay');
        if (ov && ov.classList.contains('active')) toggleShortcuts();
        const pm = document.getElementById('pdf-modal-overlay');
        if (pm && pm.classList.contains('open')) closePdfModal();
        break;
      }
      case 'r': case 'R': resetAll(); toast('Reset to defaults'); break;
      case 't': case 'T': toggleTaylorRule(); break;
      case 's': case 'S': saveScenario(); toast('Scenario saved'); break;
      case 'e': case 'E': exportJSON(); break;
      case 'c': case 'C': exportCSV(); break;
      case 'l': case 'L': shareLink(); break;
      case 'j': case 'J': case 'ArrowDown': e.preventDefault(); cycleSection(1); break;
      case 'k': case 'K': case 'ArrowUp':   e.preventDefault(); cycleSection(-1); break;
    }
  });
}




