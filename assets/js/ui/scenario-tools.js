// ── V6 PORTFOLIO LAB ─────────────────────────────────────────────
function savePortfolioState(){
  localStorage.setItem('macroscope.portfolio.holdings',JSON.stringify(portfolioHoldings));
  localStorage.setItem('macroscope.portfolio.value',String(portfolioValue));
}
function portfolioAssetOptions(selected){return Object.entries(PORTFOLIO_ASSETS).map(([sym,a])=>`<option value="${sym}"${sym===selected?' selected':''}>${sym} — ${escapeHtml(a.name)}</option>`).join('');}
function effectiveScenarioInputs(){
  const x={...vals};
  const sr=resolveActiveShocks(x), cr=resolveCalendarShocks();
  applyShockInputEffects(x,sr.inputEffects); applyShockInputEffects(x,cr.inputEffects);
  return x;
}
function assetScenarioReturn(sym,m,inputs=null){
  const a=PORTFOLIO_ASSETS[sym]; if(!a) return 0;
  const x=inputs||effectiveScenarioInputs();
  const market=(m.sp500-(BASELINES.sp500||100));
  const rateGap=m.tenyr-(BASELINES.tenyr||4.2);
  const inflGap=m.cpi-(BASELINES.cpi||2.5);
  const dollarGap=m.dollarAdj-(BASELINES.dollarAdj||104);
  const riskGap=Math.max(0,80-(m.fsi||80));
  const oilBase=getSliderDefault('oil')||72;
  const oilDelta=(x.oil??oilBase)-oilBase;
  const oilPct=oilBase?oilDelta/oilBase*100:0;
  if(a.type==='cash') return +(Math.max(0,x.ffr||0)).toFixed(2);
  if(a.type==='bond') return +(a.base - (a.duration||0)*rateGap + riskGap*.025).toFixed(2);
  if(a.type==='credit') {
    const spreadGap=(x.hySpreads??350)-(getSliderDefault('hySpreads')||350);
    return +(a.base + (a.beta||0)*market - (a.duration||0)*rateGap + (a.spreadK||0)*spreadGap).toFixed(2);
  }
  if(a.type==='gold') return +(a.base+(a.inflK||0)*inflGap+(a.dollarK||0)*dollarGap+(a.rateK||0)*rateGap+(a.riskK||0)*riskGap).toFixed(2);
  if(a.type==='oil') return +(a.base+(a.oilPctK||0)*oilPct).toFixed(2);
  let r=a.base+(a.beta||0)*market+(a.rateK||0)*rateGap+(a.oilK||0)*oilDelta+(a.shippingK||0)*((x.shippingCost??4)-(getSliderDefault('shippingCost')||4))+(a.defenseK||0)*((x.defenseSpend??3.5)-(getSliderDefault('defenseSpend')||3.5));
  if(a.sector && m.sectorOutputs?.[a.sector]!=null) r+=(a.sectorK||0)*(m.sectorOutputs[a.sector]-50);
  return +Math.max(-80,Math.min(80,r)).toFixed(2);
}
function portfolioAnalytics(m,holdings=portfolioHoldings,inputs=null){
  const rows=holdings.map((h,i)=>{const w=Math.max(0,+h.weight||0);const ret=assetScenarioReturn(h.symbol,m,inputs);return {...h,index:i,weight:w,ret,contribution:ret*w/100,asset:PORTFOLIO_ASSETS[h.symbol]};});
  const totalW=rows.reduce((a,r)=>a+r.weight,0);
  const scale=totalW?100/totalW:0;
  const scenarioReturn=rows.reduce((a,r)=>a+r.contribution,0)*scale;
  const baseReturn=rows.reduce((a,r)=>a+(r.asset?.base||0)*r.weight/100,0)*scale;
  const weightedVol=rows.reduce((a,r)=>a+(r.asset?.vol||0)*r.weight/100,0)*scale;
  const diversification=.78+Math.min(.16,rows.length*.012);
  const volProxy=weightedVol*diversification;
  const stressLoss=Math.min(0,scenarioReturn)*portfolioValue/100;
  return {rows,totalW,scenarioReturn,baseReturn,volProxy,stressLoss,valueEnd:portfolioValue*(1+scenarioReturn/100)};
}
function setPortfolioValue(v){portfolioValue=Math.max(0,+v||0);savePortfolioState();renderPortfolioLab(compute());renderScenarioTreeSummary();}
function updatePortfolioRow(i,field,v){if(!portfolioHoldings[i])return;if(field==='weight')portfolioHoldings[i].weight=Math.max(0,Math.min(100,+v||0));else if(field==='symbol'&&PORTFOLIO_ASSETS[v])portfolioHoldings[i].symbol=v;savePortfolioState();renderPortfolioLab(compute());renderScenarioTreeSummary();}
function addPortfolioHolding(){const used=new Set(portfolioHoldings.map(x=>x.symbol));const sym=Object.keys(PORTFOLIO_ASSETS).find(x=>!used.has(x))||'SPY';portfolioHoldings.push({symbol:sym,weight:0});savePortfolioState();renderPortfolioLab(compute());}
function removePortfolioHolding(i){portfolioHoldings.splice(i,1);savePortfolioState();renderPortfolioLab(compute());renderScenarioTreeSummary();}
function normalizePortfolio(){const t=portfolioHoldings.reduce((a,h)=>a+(+h.weight||0),0);if(!t)return;portfolioHoldings.forEach(h=>h.weight=+(100*(+h.weight||0)/t).toFixed(2));savePortfolioState();renderPortfolioLab(compute());renderScenarioTreeSummary();}
function loadPortfolioPreset(kind){
  const presets={
    '60_40':[{symbol:'SPY',weight:60},{symbol:'IEF',weight:40}],
    balanced:[{symbol:'SPY',weight:40},{symbol:'QQQ',weight:10},{symbol:'IWM',weight:10},{symbol:'IEF',weight:20},{symbol:'GLD',weight:10},{symbol:'CASH',weight:10}],
    growth:[{symbol:'SPY',weight:35},{symbol:'QQQ',weight:25},{symbol:'SOXX',weight:15},{symbol:'IWM',weight:10},{symbol:'GLD',weight:5},{symbol:'CASH',weight:10}],
    defensive:[{symbol:'SPY',weight:25},{symbol:'XLU',weight:10},{symbol:'IEF',weight:30},{symbol:'TLT',weight:10},{symbol:'GLD',weight:15},{symbol:'CASH',weight:10}]
  }; portfolioHoldings=JSON.parse(JSON.stringify(presets[kind]||DEFAULT_PORTFOLIO));savePortfolioState();renderPortfolioLab(compute());renderScenarioTreeSummary();
}
function portfolioFactorSummary(m){
  const x=effectiveScenarioInputs(); return [
    ['Equity regime',m.sp500-100],['GDP gap',m.gdp-(BASELINES.gdp||2.5)],['Inflation gap',m.cpi-(BASELINES.cpi||2.5)],['10yr shift',m.tenyr-(BASELINES.tenyr||4.2)],['Dollar shift',m.dollarAdj-(BASELINES.dollarAdj||104)],['Oil shift',(x.oil||72)-(getSliderDefault('oil')||72)]
  ];
}
function buildPortfolioSection(){return `<div class="section" id="sec-portfolio"><div class="sec-hdr"><div class="sec-title">Portfolio Lab</div><div class="sec-desc">Translate the current macro scenario into transparent, factor-based asset and portfolio stress results. This is a scenario sensitivity engine—not a security price forecast.</div></div><div class="pipeline-strip"><span class="pipeline-step">News</span><span class="pipeline-arrow">→</span><span class="pipeline-step">AI / manual shock</span><span class="pipeline-arrow">→</span><span class="pipeline-step">MACROSCOPE economy</span><span class="pipeline-arrow">→</span><span class="pipeline-step">Portfolio stress</span></div><div class="portfolio-toolbar"><label style="font:10px var(--font-mono);color:var(--muted)">Portfolio value $ <input id="portfolio-value" type="number" step="1000" min="0" value="${portfolioValue}" onchange="setPortfolioValue(this.value)" style="width:130px"></label><button class="btn" onclick="loadPortfolioPreset('60_40')">60/40</button><button class="btn" onclick="loadPortfolioPreset('balanced')">Balanced</button><button class="btn" onclick="loadPortfolioPreset('growth')">Growth</button><button class="btn" onclick="loadPortfolioPreset('defensive')">Defensive</button><button class="btn" onclick="normalizePortfolio()">Normalize 100%</button><button class="btn primary" onclick="addPortfolioHolding()">+ Asset</button></div><div class="v6-kpis" id="portfolio-kpis"></div><div class="portfolio-top"><div class="portfolio-panel"><div class="ai-box-title">Holdings & scenario returns</div><div class="portfolio-table"><div class="portfolio-head"><span>Ticker</span><span>Proxy / factor model</span><span>Weight</span><span>12m stress return</span><span>Contribution</span><span></span></div><div id="portfolio-rows"></div></div></div><div class="portfolio-panel"><div class="ai-box-title">Scenario factor map</div><div class="factor-bars" id="portfolio-factors"></div></div></div><div class="portfolio-note">Method: broad equity proxies inherit the simulator's S&amp;P regime plus transparent sector/rate/oil tilts; bond proxies use approximate duration sensitivity to the modeled 10-year yield; credit adds spread sensitivity; gold responds to inflation, dollar, rates and financial stress. Coefficients are scenario priors, not estimated security-specific betas. No live price target is produced.</div></div>`;}
function renderPortfolioLab(m){
  const rowsEl=document.getElementById('portfolio-rows'); if(!rowsEl)return;
  const a=portfolioAnalytics(m); const k=document.getElementById('portfolio-kpis');
  if(k) k.innerHTML=[['Scenario return',`${a.scenarioReturn>=0?'+':''}${a.scenarioReturn.toFixed(1)}%`,'12-month stress estimate'],['Scenario P/L',`${a.stressLoss<0?'-':'+'}$${Math.abs(portfolioValue*a.scenarioReturn/100).toLocaleString(undefined,{maximumFractionDigits:0})}`,'On entered portfolio value'],['Baseline return',`${a.baseReturn.toFixed(1)}%`,'Long-run prior, not forecast'],['Volatility proxy',`${a.volProxy.toFixed(1)}%`,'Rough annualized risk'],['Weight total',`${a.totalW.toFixed(1)}%`,Math.abs(a.totalW-100)<.1?'Normalized':'Normalize recommended']].map(([l,v,sub])=>`<div class="v6-kpi"><div class="v6-kpi-lbl">${l}</div><div class="v6-kpi-val">${v}</div><div class="v6-kpi-sub">${sub}</div></div>`).join('');
  rowsEl.innerHTML=a.rows.map(r=>`<div class="portfolio-row"><select onchange="updatePortfolioRow(${r.index},'symbol',this.value)">${portfolioAssetOptions(r.symbol)}</select><span>${escapeHtml(r.asset?.name||'')}</span><input type="number" min="0" max="100" step="1" value="${r.weight}" onchange="updatePortfolioRow(${r.index},'weight',this.value)"><span class="portfolio-return ${r.ret>=0?'pos':'neg'}">${r.ret>=0?'+':''}${r.ret.toFixed(1)}%</span><span>${r.contribution>=0?'+':''}${r.contribution.toFixed(2)}pp</span><button class="btn" onclick="removePortfolioHolding(${r.index})">×</button></div>`).join('');
  const f=document.getElementById('portfolio-factors'); if(f){const factors=portfolioFactorSummary(m);const max=Math.max(1,...factors.map(x=>Math.abs(x[1])));f.innerHTML=factors.map(([name,val])=>`<div class="factor-row"><span>${name}</span><div class="factor-track"><div class="factor-fill" style="width:${Math.min(100,Math.abs(val)/max*100)}%"></div></div><span class="factor-val">${val>=0?'+':''}${val.toFixed(2)}</span></div>`).join('');}
}

// Evaluate a draft shock without permanently mutating scenario state.
function previewAIShockPortfolioImpact(d){
  if(!d?.channels?.length)return '';
  const savedEvents=JSON.parse(JSON.stringify(activeEventIds)); const savedSel=selectedShockId; const tempId='__preview_ai__';
  const ev=enrichEventDefinition({id:tempId,label:d.label||'Draft',cat:d.category||'Custom',pos:true,shockType:d.shockType,durationMonths:d.durationMonths,peakMonth:d.peakMonth,decayRate:d.decayRate,confidence:d.confidence,channels:d.channels,chips:[]});
  EVENTS.push(ev); activeEventIds[tempId]={...defaultShockConfig(ev),magnitude:d.magnitude||1};
  try{const m=compute(),pa=portfolioAnalytics(m);const top=pa.rows.slice().sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution)).slice(0,3);return `Portfolio: ${pa.scenarioReturn>=0?'+':''}${pa.scenarioReturn.toFixed(1)}% on current holdings\nLargest contributions: ${top.map(r=>`${r.symbol} ${r.contribution>=0?'+':''}${r.contribution.toFixed(2)}pp`).join(' · ')}`;}
  catch(e){return '';}
  finally{activeEventIds=savedEvents;selectedShockId=savedSel;const i=EVENTS.findIndex(x=>x.id===tempId);if(i>=0)EVENTS.splice(i,1);}
}

// ── V6 SCENARIO TREE ─────────────────────────────────────────────
function branchSnapshot(){const m=compute();return {country:currentCountry,horizon:timeHorizon,taylor:taylorRuleOn,officialSyncEnabled,vals:{...vals},activeEventIds:JSON.parse(JSON.stringify(activeEventIds)),shockProjectionMonth,customEvents:serializeCustomEvents(),out:{gdp:m.gdp,cpi:m.cpi,tenyr:m.tenyr,sp500:m.sp500,recessionRisk:m.recessionRisk,fsi:m.fsi,dollarAdj:m.dollarAdj,sectorOutputs:m.sectorOutputs},inputs:effectiveScenarioInputs(),capturedAt:new Date().toISOString()};}
function addScenarioBranch(){if(scenarioBranches.length>=6){toast('Scenario Tree supports up to 6 branches');return;}const name=document.getElementById('branch-new-name')?.value.trim()||`Branch ${scenarioBranches.length+1}`;const defaultProb=scenarioBranches.length?Math.max(5,Math.round(100/(scenarioBranches.length+1))):100;scenarioBranches.push({id:'br_'+Date.now().toString(36),name,probability:defaultProb,snapshot:branchSnapshot()});localStorage.setItem('macroscope.branches',JSON.stringify(scenarioBranches));renderScenarioTree();}
function updateBranch(i,field,v){const b=scenarioBranches[i];if(!b)return;if(field==='probability')b.probability=Math.max(0,Math.min(100,+v||0));else if(field==='name')b.name=String(v||'Branch').slice(0,80);localStorage.setItem('macroscope.branches',JSON.stringify(scenarioBranches));renderScenarioTreeSummary();}
function recaptureBranch(i){if(!scenarioBranches[i])return;scenarioBranches[i].snapshot=branchSnapshot();localStorage.setItem('macroscope.branches',JSON.stringify(scenarioBranches));renderScenarioTree();toast('Branch recaptured from current scenario');}
function deleteBranch(i){scenarioBranches.splice(i,1);localStorage.setItem('macroscope.branches',JSON.stringify(scenarioBranches));renderScenarioTree();}
function normalizeBranchProbabilities(){const t=scenarioBranches.reduce((a,b)=>a+(+b.probability||0),0);if(!t)return;scenarioBranches.forEach(b=>b.probability=+(100*(+b.probability||0)/t).toFixed(1));localStorage.setItem('macroscope.branches',JSON.stringify(scenarioBranches));renderScenarioTree();}
function loadBranch(i){const b=scenarioBranches[i];if(!b?.snapshot)return;const sc=b.snapshot;if(sc.country&&sc.country!==currentCountry){toast('Branch country differs; switch country first, then load');return;}vals={...DEFAULTS,...sc.vals};restoreCustomEvents(sc.customEvents);activeEventIds=JSON.parse(JSON.stringify(sc.activeEventIds||{}));normalizeAllActiveShocks();shockProjectionMonth=Number.isFinite(+sc.shockProjectionMonth)?+sc.shockProjectionMonth:3;taylorRuleOn=!!sc.taylor;selectedShockId=Object.keys(activeEventIds)[0]||null;buildContent();const btn=Array.from(document.querySelectorAll('.nav-item')).find(x=>(x.getAttribute('onclick')||'').includes("'branches'"));showSection('branches',btn||null);syncSliderDomFromVals();render();renderEventLog();toast(`Loaded ${b.name}`);}
function branchPortfolioAnalytics(branch){const s=branch?.snapshot;if(!s)return null;return portfolioAnalytics(s.out,portfolioHoldings,s.inputs);}
function scenarioTreeWeighted(){const valid=scenarioBranches.filter(b=>b.snapshot&&(+b.probability||0)>0);const total=valid.reduce((a,b)=>a+(+b.probability||0),0);if(!total)return null;const avg=k=>valid.reduce((a,b)=>a+(+b.probability||0)/total*(+b.snapshot.out[k]||0),0);const pret=valid.reduce((a,b)=>a+(+b.probability||0)/total*(branchPortfolioAnalytics(b)?.scenarioReturn||0),0);return {total,gdp:avg('gdp'),cpi:avg('cpi'),tenyr:avg('tenyr'),sp500:avg('sp500'),recessionRisk:avg('recessionRisk'),portfolioReturn:pret};}
function buildScenarioTreeSection(){return `<div class="section" id="sec-branches"><div class="sec-hdr"><div class="sec-title">Scenario Tree</div><div class="sec-desc">Capture distinct macro scenarios, assign subjective probabilities, and compute probability-weighted macro and portfolio outcomes. Branches are snapshots, so later slider changes do not silently rewrite them.</div></div><div class="branch-toolbar"><input id="branch-new-name" placeholder="Branch name — e.g. Soft landing"><button class="btn primary" onclick="addScenarioBranch()">Capture current as branch</button><button class="btn" onclick="normalizeBranchProbabilities()">Normalize probabilities</button><span id="branch-prob-total" style="font:10px var(--font-mono);color:var(--muted)"></span></div><div class="branch-grid" id="branch-grid"></div><div class="tree-summary" id="tree-summary"></div><div class="portfolio-note">Probabilities are user judgments, not model-estimated event probabilities. Expected values are useful for comparing scenario sets but can hide tail risk; inspect each branch independently.</div></div>`;}
function renderScenarioTree(){const grid=document.getElementById('branch-grid');if(!grid)return;grid.innerHTML=scenarioBranches.length?scenarioBranches.map((b,i)=>{const o=b.snapshot?.out||{},pa=branchPortfolioAnalytics(b);return `<div class="branch-card"><input value="${escapeAttr(b.name)}" onchange="updateBranch(${i},'name',this.value)" style="width:100%;background:transparent;border:0;border-bottom:1px solid var(--border);color:var(--text);font:700 13px var(--font-ui);padding:3px 0"><div class="branch-meta">Captured ${b.snapshot?.capturedAt?new Date(b.snapshot.capturedAt).toLocaleString():'—'} · ${escapeHtml(String(b.snapshot?.country||'').toUpperCase())}</div><div class="branch-prob">Probability <input type="number" min="0" max="100" step="1" value="${+b.probability||0}" onchange="updateBranch(${i},'probability',this.value)">%</div><div class="branch-metrics"><div class="branch-metric"><b>${(+o.gdp||0).toFixed(1)}%</b><span>GDP</span></div><div class="branch-metric"><b>${(+o.cpi||0).toFixed(1)}%</b><span>CPI</span></div><div class="branch-metric"><b>${(+o.tenyr||0).toFixed(2)}%</b><span>10yr</span></div><div class="branch-metric"><b>${(+o.sp500||0).toFixed(0)}</b><span>S&amp;P idx</span></div><div class="branch-metric"><b>${pa?`${pa.scenarioReturn>=0?'+':''}${pa.scenarioReturn.toFixed(1)}%`:'—'}</b><span>Portfolio</span></div></div><div class="branch-actions"><button class="btn primary" onclick="loadBranch(${i})">Load</button><button class="btn" onclick="recaptureBranch(${i})">Recapture</button><button class="btn" onclick="deleteBranch(${i})">Delete</button></div></div>`;}).join(''):'<div class="news-empty">No branches yet. Configure a scenario, then capture it here.</div>';renderScenarioTreeSummary();}
function renderScenarioTreeSummary(){const el=document.getElementById('tree-summary');const totalEl=document.getElementById('branch-prob-total');const w=scenarioTreeWeighted();if(totalEl)totalEl.textContent=`Total probability: ${scenarioBranches.reduce((a,b)=>a+(+b.probability||0),0).toFixed(1)}%`;if(!el)return;if(!w){el.innerHTML='<div class="news-empty">Capture at least one branch with a nonzero probability.</div>';return;}el.innerHTML=`<div class="ai-box-title">Probability-weighted outlook</div><div class="v6-kpis" style="margin-top:9px"><div class="v6-kpi"><div class="v6-kpi-lbl">Expected GDP</div><div class="v6-kpi-val">${w.gdp.toFixed(2)}%</div></div><div class="v6-kpi"><div class="v6-kpi-lbl">Expected CPI</div><div class="v6-kpi-val">${w.cpi.toFixed(2)}%</div></div><div class="v6-kpi"><div class="v6-kpi-lbl">Expected 10yr</div><div class="v6-kpi-val">${w.tenyr.toFixed(2)}%</div></div><div class="v6-kpi"><div class="v6-kpi-lbl">Expected S&amp;P index</div><div class="v6-kpi-val">${w.sp500.toFixed(1)}</div></div><div class="v6-kpi"><div class="v6-kpi-lbl">Expected portfolio</div><div class="v6-kpi-val">${w.portfolioReturn>=0?'+':''}${w.portfolioReturn.toFixed(1)}%</div></div></div>${Math.abs(w.total-100)>.2?`<div class="sec-warn" style="margin-top:8px">Probabilities sum to ${w.total.toFixed(1)}%. Weighted values above normalize them to 100% for calculation.</div>`:''}`;}

// ── V6 ASK MACROSCOPE ────────────────────────────────────────────
function topModelDrivers(m,n=6){return Object.entries(m.gdpContributions||{}).filter(([k])=>k!=='baseline').sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,n).map(([name,value])=>({name,value:+value.toFixed(3)}));}
function analystContextPayload(){const m=compute(),pa=portfolioAnalytics(m),tree=scenarioTreeWeighted();return {model:'MACROSCOPE v8.0',country:currentCountry,horizonYears:timeHorizon,projectionMonth:shockProjectionMonth,metrics:{gdp:m.gdp,cpi:m.cpi,unemployment:m.unemp,tenYear:m.tenyr,mortgage:m.mortg,sp500Index:m.sp500,financialStability:m.fsi,recessionRisk:m.recessionRisk,consumerConfidence:m.conf,effectiveDeficit:m.effectiveDeficit},topGdpDrivers:topModelDrivers(m),activeScenarioShocks:(m.shockReport?.eventSummaries||[]).map(x=>({label:x.label,path:+x.path?.toFixed?.(2)||x.path,activeChannels:x.activeChannels})),releaseSignals:(m.calendarShockReport?.activeShocks||[]).slice(0,5).map(x=>({label:x.label,surpriseZ:x.surpriseZ,path:x.path})),portfolio:{value:portfolioValue,scenarioReturn:pa.scenarioReturn,volatilityProxy:pa.volProxy,holdings:pa.rows.map(r=>({symbol:r.symbol,weight:r.weight,scenarioReturn:r.ret,contribution:r.contribution}))},scenarioTree:tree};}
function buildAnalystSection(){return `<div class="section" id="sec-analyst"><div class="sec-hdr"><div class="sec-title">Ask MACROSCOPE</div><div class="sec-desc">Use one prompt for model explanation or sourced data research. Requests for current/latest official observations are automatically routed to Data Copilot so the LLM never fabricates live values.</div></div><div class="analyst-layout"><div class="analyst-box"><div class="ai-box-title">Question</div><textarea id="analyst-prompt" class="analyst-prompt" placeholder="Explain the current model—or ask for the latest official CPI, labor, rates, housing, energy or GDP data."></textarea><div class="quick-prompts"><button class="btn" onclick="setAnalystPrompt('Explain the current macro scenario and identify the three most important drivers.')">Explain scenario</button><button class="btn" onclick="setAnalystPrompt('What is driving inflation, and which changes would reduce it with the least damage to growth?')">Inflation drivers</button><button class="btn" onclick="setAnalystPrompt('Bring MACROSCOPE current using the latest official U.S. macro data, cite every source and date, compare the observations with the model, and prepare updates for my approval.')">Update current data</button><button class="btn" onclick="setAnalystPrompt('Explain the current portfolio risk and identify the holdings most sensitive to this scenario.')">Portfolio risk</button><button class="btn" onclick="setAnalystPrompt('What assumptions could invalidate this outlook? Distinguish model uncertainty from real-world uncertainty.')">Challenge outlook</button></div><div class="ai-route-strip"><span><b>EXPLAIN</b> model state</span><span>•</span><span><b>UPDATE DATA</b> official FRED-backed observations</span><span>•</span><span><b>SCENARIO</b> use AI Counterfactual Studio</span></div><input id="analyst-endpoint" class="analyst-endpoint" placeholder="Serverless AI endpoint (same Worker as Shock Studio)" onchange="saveAIEndpoint(this.value)"><div class="analyst-toolbar" style="margin-top:8px"><button class="btn primary" onclick="askMacroscope()">Ask MACROSCOPE</button><button class="btn" onclick="localMacroscopeExplain()">Local model summary</button><span id="analyst-status" class="ai-status">AUTO ROUTER READY</span></div></div><div class="analyst-box"><div class="ai-box-title">Analyst answer</div><div class="analyst-answer" id="analyst-answer">Ask a model question or request current official data. Data-update requests will open a reviewable sourced update table before anything changes.</div></div></div><div class="portfolio-panel" style="margin-top:10px"><div class="ai-box-title">Current context sent to the analyst</div><div id="analyst-snapshot" class="news-meta-line" style="line-height:1.7"></div></div><div class="portfolio-note">Provenance rule: official observations come from the Worker's validated Live Data Gateway or direct approved FRED fallback; the LLM may select series and explain results, but it cannot supply the factual observations itself. Scenario assumptions and user overrides remain separate.</div></div>`;}
function setAnalystPrompt(t){const el=document.getElementById('analyst-prompt');if(el){el.value=t;el.focus();}}
function loadAIEndpoint(){const v=normalizeAIEndpoint(localStorage.getItem('macroscope.ai.endpoint')||DEFAULT_AI_ENDPOINT||'');saveAIEndpoint(v);const a=document.getElementById('ai-scenario-endpoint');if(a&&!a.value)a.value=v;const b=document.getElementById('analyst-endpoint');if(b&&!b.value)b.value=v;const c=document.getElementById('data-copilot-endpoint');if(c&&!c.value)c.value=v;}
function renderAnalystSnapshot(m){const el=document.getElementById('analyst-snapshot');if(!el)return;const pa=portfolioAnalytics(m),drivers=topModelDrivers(m,4);el.innerHTML=`GDP <b>${m.gdp.toFixed(1)}%</b> · CPI <b>${m.cpi.toFixed(1)}%</b> · 10yr <b>${m.tenyr.toFixed(2)}%</b> · Recession score <b>${m.recessionRisk.toFixed(0)}</b> · Portfolio <b>${pa.scenarioReturn>=0?'+':''}${pa.scenarioReturn.toFixed(1)}%</b><br>Top GDP drivers: ${drivers.map(x=>`${escapeHtml(x.name)} ${x.value>=0?'+':''}${x.value.toFixed(2)}pp`).join(' · ')}`;}
function localMacroscopeText(){const m=compute(),pa=portfolioAnalytics(m),d=topModelDrivers(m,5),shockCount=Object.keys(activeEventIds).length,tree=scenarioTreeWeighted();const direction=m.gdp<0?'recessionary':m.gdp<1.5?'weak-growth':m.gdp>3.5?'high-growth':'moderate-growth';return `MACROSCOPE currently describes a ${direction} regime: GDP ${m.gdp.toFixed(1)}%, CPI ${m.cpi.toFixed(1)}%, 10-year Treasury ${m.tenyr.toFixed(2)}%, and a recession-risk score of ${m.recessionRisk.toFixed(0)}/100.\n\nThe largest GDP contributions are ${d.map(x=>`${x.name} (${x.value>=0?'+':''}${x.value.toFixed(2)}pp)`).join(', ')}. ${shockCount?`${shockCount} user scenario shock${shockCount===1?' is':'s are'} active at month ${shockProjectionMonth}.`:'No user-created scenario shock is active.'}\n\nThe current portfolio stress result is ${pa.scenarioReturn>=0?'+':''}${pa.scenarioReturn.toFixed(1)}% on a $${portfolioValue.toLocaleString()} portfolio, with an approximate volatility proxy of ${pa.volProxy.toFixed(1)}%. The largest portfolio contributions are ${pa.rows.slice().sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution)).slice(0,3).map(r=>`${r.symbol} ${r.contribution>=0?'+':''}${r.contribution.toFixed(2)}pp`).join(', ')}.${tree?`\n\nThe probability-weighted scenario tree implies GDP ${tree.gdp.toFixed(2)}%, CPI ${tree.cpi.toFixed(2)}%, and portfolio return ${tree.portfolioReturn>=0?'+':''}${tree.portfolioReturn.toFixed(1)}%.`:''}\n\nThese are model outputs based on transparent scenario priors; they are not forecasts with statistically estimated confidence intervals.`;}
function localMacroscopeExplain(){const out=document.getElementById('analyst-answer');if(out)out.textContent=localMacroscopeText();const st=document.getElementById('analyst-status');if(st)st.textContent='LOCAL MODEL';}

function isCurrentDataResearchPrompt(prompt){
  const q=String(prompt||'').toLowerCase();
  const broad=/\b(bring|make|keep)\s+(macroscope|the model|model)\s+(fully\s+)?current\b|\b(refresh|sync)\s+(the\s+)?(macro|economic|official|model)\s*data\b/.test(q);
  const freshness=/\b(latest|current|today|now|newest|most recent|up[- ]?to[- ]?date|update|refresh|sync|retrieve|fetch|source|cite)\b/.test(q);
  const data=/\b(cpi|inflation|pce|unemployment|payroll|labor[- ]?force|participation|gdp|fed(eral)? funds|iorb|treasury|2[- ]?year|10[- ]?year|mortgage|housing starts?|wti|oil|natural gas|henry hub|industrial production|consumer spending|macro(?:economic)? data|economic data|official data|observations?)\b/.test(q);
  const explicitlyHistorical=/\b(in|during|from)\s+(19|20)\d{2}\b|\bhistorical\b/.test(q);
  return !explicitlyHistorical && (broad || (freshness && data));
}

function sectionButton(id){return Array.from(document.querySelectorAll('.nav-item')).find(b=>(b.getAttribute('onclick')||'').includes(`'${id}'`))||null;}

async function routeAnalystPromptToDataCopilot(prompt){
  const st=document.getElementById('analyst-status'),out=document.getElementById('analyst-answer');
  if(st)st.textContent='ROUTING → DATA COPILOT';
  if(out)out.innerHTML='<div class="ai-route-notice"><b>Official-data request detected.</b><br>Routing to Data Copilot so current values come from approved FRED series rather than LLM-generated text.</div>';
  showSection('data-copilot',sectionButton('data-copilot'));
  const ta=document.getElementById('data-copilot-prompt');if(ta)ta.value=prompt;
  await requestDataCopilotUpdate(prompt);
}
async function askMacroscope(){
  const prompt=document.getElementById('analyst-prompt')?.value.trim();
  const endpoint=normalizeAIEndpoint(document.getElementById('analyst-endpoint')?.value||localStorage.getItem('macroscope.ai.endpoint')||DEFAULT_AI_ENDPOINT||'');
  const out=document.getElementById('analyst-answer'),st=document.getElementById('analyst-status');
  if(!prompt){toast('Ask a question first');return;}
  if(!endpoint){localMacroscopeExplain();toast('No endpoint configured · showing local model summary');return;}
  if(isCurrentDataResearchPrompt(prompt)){await routeAnalystPromptToDataCopilot(prompt);return;}
  saveAIEndpoint(endpoint);
  const endpointField=document.getElementById('analyst-endpoint');if(endpointField)endpointField.value=endpoint;
  if(st)st.textContent='THINKING…';
  if(out)out.textContent='Analyzing current simulator state…';
  try{
    const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'analyst',prompt,context:analystContextPayload()})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||`AI endpoint HTTP ${r.status}`);
    const answer=String(data.answer||data.text||'').trim();
    if(!answer)throw new Error('Empty analyst response');
    analystHistory.push({prompt,answer,at:new Date().toISOString()});
    if(out)out.innerHTML=renderMarkdownSafe(answer);
    if(st)st.textContent='GROUNDED IN MODEL STATE';
  }catch(e){
    if(out)out.textContent=`Analyst request failed: ${e.message||e}

${localMacroscopeText()}`;
    if(st)st.textContent='LOCAL FALLBACK';
  }
}


// ── V7.2: SOURCED DATA COPILOT ──────────────────────────────────
function setDataCopilotPrompt(t){const el=document.getElementById('data-copilot-prompt');if(el){el.value=t;el.focus();}}

function dataCopilotContext(){
  const m=compute();
  return {
    country:currentCountry,
    model:'MACROSCOPE v8.0',
    currentInputs:{...vals},
    currentOutputs:{gdp:m.gdp,cpi:m.cpi,twoyr:m.twoyr,tenyr:m.tenyr,mortg:m.mortg,sp500:m.sp500,recessionRisk:m.recessionRisk},
    officialSyncEnabled,
    officialGeneratedAt:officialData?.generatedAt||null
  };
}

function formatDataCopilotValue(u,v){
  if(v===null||v===undefined||!Number.isFinite(+v))return '—';
  const d=Number.isFinite(+u.precision)?+u.precision:2;
  const n=(+v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  if(String(u.units||'').startsWith('$'))return '$'+n+(u.units==='$/bbl'?'/bbl':u.units==='$/MMBtu'?'/MMBtu':'');
  if(String(u.units||'').includes('%'))return n+'%';
  return n+(u.units?` ${u.units}`:'');
}

function dataCopilotMappingBadge(u){
  if(u.inputTarget)return `<span class="data-map-badge input">OFFICIAL INPUT → ${escapeHtml(u.inputTarget)}</span>`;
  if(u.outputTarget)return `<span class="data-map-badge output">OUTPUT ANCHOR → ${escapeHtml(u.outputTarget)}</span>`;
  return `<span class="data-map-badge display">SOURCED CONTEXT · DISPLAY ONLY</span>`;
}

function safeSourceHref(v){try{const u=new URL(String(v||''));return /^https?:$/.test(u.protocol)?u.href:'#';}catch{return '#';}}

function dataCopilotDeltaText(u,cur,nxt){
  if(cur===null||nxt===null)return '—';
  const d=nxt-cur;
  const digits=Number.isFinite(+u.precision)?+u.precision:2;
  const abs=Math.abs(d).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const sign=d>0?'+':d<0?'−':'';
  if(String(u.units||'').startsWith('$'))return `${sign}$${abs}`;
  if(String(u.units||'').includes('%'))return `${sign}${abs} pp`;
  return `${sign}${abs}${u.units?` ${escapeHtml(u.units)}`:''}`;
}

function renderDataCopilotProposal(){
  const box=document.getElementById('data-copilot-results'),meta=document.getElementById('data-copilot-meta'),apply=document.getElementById('data-apply-btn'),all=document.getElementById('data-select-all'),none=document.getElementById('data-select-none');
  if(!box||!meta)return;
  const p=dataCopilotProposal;
  if(!p||!Array.isArray(p.updates)||!p.updates.length){box.className='data-copilot-empty';box.innerHTML='Ask the Data Copilot for current observations. Each result will show the official value, source, series, observation date, model mapping, and current-model comparison.';meta.textContent='No research request yet.';if(apply)apply.disabled=true;if(all)all.disabled=true;if(none)none.disabled=true;return;}
  box.className='data-update-table-wrap';
  const when=p.generatedAt?new Date(p.generatedAt):null;
  const actionable=p.updates.filter(u=>u.inputTarget||u.outputTarget).length;
  const contextOnly=p.updates.length-actionable;
  meta.innerHTML=`<strong>${p.updates.length} official observations</strong> · ${actionable} model-mapped · ${contextOnly} context-only · ${when&&!Number.isNaN(when.getTime())?when.toLocaleString():'retrieved now'}<br>${escapeHtml(p.provenanceNote||'Official values retrieved from approved data series.')}`;
  const rows=p.updates.map((u,i)=>{
    const cur=Number.isFinite(+u.currentValue)?+u.currentValue:null;
    const nxt=Number.isFinite(+u.modelValue)?+u.modelValue:null;
    const source=safeSourceHref(u.sourceUrl);
    const mapping=u.inputTarget?`INPUT → ${escapeHtml(u.inputTarget)}`:u.outputTarget?`ANCHOR → ${escapeHtml(u.outputTarget)}`:'CONTEXT ONLY';
    const action=u.inputTarget||u.outputTarget?'Model update':'Context update';
    return `<tr class="selected" id="data-update-card-${i}"><td class="data-check-cell"><input class="data-update-check" type="checkbox" data-index="${i}" checked onchange="syncDataCopilotCard(${i},this.checked)"></td><td><b>${escapeHtml(u.label||u.key)}</b><div class="data-table-sub">${escapeHtml(u.seriesId||'')}</div></td><td>${cur===null?'—':formatDataCopilotValue(u,cur)}</td><td class="data-latest-value">${formatDataCopilotValue(u,u.modelValue)}</td><td>${dataCopilotDeltaText(u,cur,nxt)}</td><td>${escapeHtml(u.observationDate||'—')}<div class="data-table-sub">prior ${escapeHtml(u.previousDate||'—')}</div></td><td><b>${escapeHtml(u.sourceAgency||u.source||'Official source')}</b><div class="data-table-sub"><a href="${escapeAttr(source)}" target="_blank" rel="noopener">FRED ${escapeHtml(u.seriesId||'series')} ↗</a></div></td><td><span class="data-map-inline ${u.inputTarget?'input':u.outputTarget?'output':'display'}">${mapping}</span><div class="data-table-sub">${action}</div></td></tr>`;
  }).join('');
  box.innerHTML=`<table class="data-review-table"><thead><tr><th>Apply</th><th>Metric</th><th>Current model</th><th>Latest official</th><th>Δ</th><th>Observation</th><th>Source</th><th>Model action</th></tr></thead><tbody>${rows}</tbody></table>`+(Array.isArray(p.errors)&&p.errors.length?`<div class="data-update-error">Some requested series could not be retrieved: ${p.errors.map(e=>`${escapeHtml(e.key)} — ${escapeHtml(e.error)}`).join('<br>')}</div>`:'');
  if(apply)apply.disabled=false;if(all)all.disabled=false;if(none)none.disabled=false;
}

function syncDataCopilotCard(i,checked){document.getElementById('data-update-card-'+i)?.classList.toggle('selected',!!checked);}
function setAllDataCopilotChecks(v){document.querySelectorAll('.data-update-check').forEach(x=>{x.checked=!!v;syncDataCopilotCard(+x.dataset.index,!!v);});}
function clearDataCopilotProposal(){dataCopilotProposal=null;renderDataCopilotProposal();const st=document.getElementById('data-copilot-status');if(st)st.textContent='REVIEW-GATED';}

let dataResearchProgressTimer=null;
function startDataResearchProgress(){
  const box=document.getElementById('data-copilot-results'),st=document.getElementById('data-copilot-status');
  const stages=['Interpreting research request','Selecting approved official series','Retrieving FRED observations','Validating dates and provenance','Building reviewable model diff'];let i=0;
  const draw=()=>{if(st)st.textContent=`RESEARCHING · ${i+1}/${stages.length}`;if(box){box.className='data-copilot-empty';box.innerHTML=`<div class="research-progress">${stages.map((s,j)=>`<div class="${j<i?'done':j===i?'active':'pending'}"><span>${j<i?'✓':j===i?'◉':'○'}</span><span>${escapeHtml(s)}</span></div>`).join('')}</div>`;}};
  draw();if(dataResearchProgressTimer)clearInterval(dataResearchProgressTimer);dataResearchProgressTimer=setInterval(()=>{if(i<stages.length-1){i++;draw();}},1700);
}
function stopDataResearchProgress(){if(dataResearchProgressTimer){clearInterval(dataResearchProgressTimer);dataResearchProgressTimer=null;}}

async function requestDataCopilotUpdate(promptOverride=''){
  const prompt=(String(promptOverride||'').trim()||document.getElementById('data-copilot-prompt')?.value||'').trim()||'Bring MACROSCOPE current. Retrieve the latest major U.S. macro observations, cite every source and date, compare them with the current model, and prepare updates for my approval.';
  const promptBox=document.getElementById('data-copilot-prompt');if(promptBox&&promptBox.value!==prompt)promptBox.value=prompt;
  const endpoint=normalizeAIEndpoint(document.getElementById('data-copilot-endpoint')?.value||localStorage.getItem('macroscope.ai.endpoint')||DEFAULT_AI_ENDPOINT||'');
  const st=document.getElementById('data-copilot-status'),box=document.getElementById('data-copilot-results');
  if(currentCountry!=='us'){toast('Data Copilot v8.0 currently maps official U.S. series only');return;}
  if(!endpoint){toast('Configure the Cloudflare Worker endpoint');return;}
  saveAIEndpoint(endpoint);startDataResearchProgress();
  try{
    const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'data_update',prompt,context:dataCopilotContext()})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||`Data endpoint HTTP ${r.status}`);
    dataCopilotProposal=data.proposal||data;
    stopDataResearchProgress();renderDataCopilotProposal();if(st)st.textContent='REVIEW REQUIRED';
  }catch(e){stopDataResearchProgress();dataCopilotProposal=null;if(box){box.className='data-copilot-empty';box.innerHTML=`<span style="color:var(--neg)">Data research failed:</span><br>${escapeHtml(e.message||e)}`;}if(st)st.textContent='ERROR';}
}

function applyDataCopilotProposal(){
  const p=dataCopilotProposal;if(!p?.updates?.length)return;
  if(currentCountry!=='us'){toast('Official baseline mapping currently supports the U.S. model');return;}
  const selected=[...document.querySelectorAll('.data-update-check:checked')].map(x=>p.updates[+x.dataset.index]).filter(Boolean);
  if(!selected.length){toast('Select at least one observation');return;}
  const base=officialData&&typeof officialData==='object'?JSON.parse(JSON.stringify(officialData)):{observations:{},baseline:{inputs:{},outputs:{}},status:'complete'};
  base.observations=base.observations||{};base.baseline=base.baseline||{};base.baseline.inputs=base.baseline.inputs||{};base.baseline.outputs=base.baseline.outputs||{};
  for(const u of selected){
    if(!Number.isFinite(+u.modelValue))continue;
    base.observations[u.key]={key:u.key,label:u.label,seriesId:u.seriesId,category:u.category,actual:+u.modelValue,previous:Number.isFinite(+u.previousModelValue)?+u.previousModelValue:null,rawActual:u.rawValue,rawPrevious:u.rawPrevious,observationDate:u.observationDate,previousDate:u.previousDate,units:u.units,precision:u.precision,inputTarget:u.inputTarget||null,outputTarget:u.outputTarget||null,source:u.sourceAgency||u.source,sourceUrl:u.sourceUrl,retrievedAt:u.retrievedAt||p.generatedAt,isStale:false,fallback:false};
    if(u.inputTarget)base.baseline.inputs[u.inputTarget]=+u.modelValue;
    if(u.outputTarget)base.baseline.outputs[u.outputTarget]=+u.modelValue;
  }
  base.generatedAt=p.generatedAt||new Date().toISOString();base.status=p.errors?.length?'partial':'complete';base.seriesCount=Object.keys(base.observations).length;base.freshSeriesCount=Object.values(base.observations).filter(o=>!o.isStale&&!o.fallback).length;base.source='MACROSCOPE Data Copilot · FRED official series';
  officialData=base;
  applyOfficialBaseline({force:true,silent:true,skipRebuild:false});
  renderOfficialData();render();commitChange();
  const st=document.getElementById('data-copilot-status');if(st)st.textContent=`APPLIED ${selected.length} UPDATES`;
  toast(`Applied ${selected.length} sourced official-data updates`);
}

// ── EVENTS & STRUCTURED SHOCKS ───────────────────────────────────
let customEventCount = 0;

function setShockProjectionMonth(raw) {
  shockProjectionMonth = Math.max(0, Math.min(120, +raw || 0));
  const label = document.getElementById('shock-month-value'); if (label) label.textContent = `Month ${shockProjectionMonth}`;
  render();
  renderEventLog();
  commitChange();
}

function toggleEvent(id) {
  const card = document.getElementById('ec-' + id);
  const ev = findShock(id);
  if (!ev) return;
  if (activeEventIds[id]) {
    delete activeEventIds[id];
    if (selectedShockId === id) selectedShockId = Object.keys(activeEventIds)[0] || null;
    if (card) card.classList.remove('active');
  } else {
    activeEventIds[id] = defaultShockConfig(ev);
    selectedShockId = id;
    if (card) card.classList.add('active');
  }
  refreshShockCards();
  render();
  renderEventLog();
  commitChange();
}

function selectShock(id) {
  if (!activeEventIds[id]) activeEventIds[id] = defaultShockConfig(findShock(id));
  selectedShockId = id;
  refreshShockCards();
  renderShockWorkbench(compute());
  renderEventLog();
}

function updateShockConfig(id, field, raw) {
  const ev = findShock(id); if (!ev) return;
  const cfg = normalizeActiveShockConfig(id, activeEventIds[id]);
  let value = raw;
  if (field !== 'shockType') value = +raw;
  cfg[field] = value;
  if (field === 'shockType') {
    const d = SHOCK_TYPE_DEFAULTS[value] || SHOCK_TYPE_DEFAULTS.persistent;
    cfg.durationMonths = d.durationMonths; cfg.peakMonth = d.peakMonth; cfg.decayRate = d.decayRate;
  }
  activeEventIds[id] = normalizeActiveShockConfig(id, cfg);
  refreshShockCards();
  render();
  renderEventLog();
  commitChange();
}

function resetShockConfig(id) {
  const ev = findShock(id); if (!ev) return;
  activeEventIds[id] = defaultShockConfig(ev);
  render(); renderEventLog(); commitChange();
}

function clearAllShocks() {
  activeEventIds = {}; selectedShockId = null;
  refreshShockCards(); render(); renderEventLog(); commitChange();
}

function refreshShockCards() {
  document.querySelectorAll('.ev-card').forEach(card => {
    const id = card.id.replace(/^ec-/, '');
    const cfg = activeEventIds[id] ? normalizeActiveShockConfig(id, activeEventIds[id]) : null;
    card.classList.toggle('active', !!cfg);
    const live = document.getElementById('ev-live-' + id);
    if (live && cfg) {
      const span = live.querySelector('span');
      if (span) span.textContent = `${Math.round(cfg.magnitude*100)}% magnitude · Month ${shockProjectionMonth}`;
    }
  });
}

function renderShockWorkbench(m) {
  const report = m?.shockReport || resolveActiveShocks(vals);
  const countEl = document.getElementById('shock-active-count'); if (countEl) countEl.textContent = Object.keys(activeEventIds).length;
  const chEl = document.getElementById('shock-channel-count'); if (chEl) chEl.textContent = report.contributions.length;
  const overlapPct = report.rawAbsolute > 0 ? report.overlapReduction / report.rawAbsolute * 100 : 0;
  const ovEl = document.getElementById('shock-overlap-kpi'); if (ovEl) ovEl.textContent = `${Math.round(overlapPct)}%`;
  const range = document.getElementById('shock-month-range'); if (range) range.value = shockProjectionMonth;
  const label = document.getElementById('shock-month-value'); if (label) label.textContent = `Month ${shockProjectionMonth}`;
  renderShockInspector(report);
  renderShockAttribution(report);
  refreshShockCards();
}

function renderShockInspector(report) {
  const host = document.getElementById('shock-inspector'); if (!host) return;
  const ids = Object.keys(activeEventIds);
  if (!ids.length) {
    host.innerHTML = '<div class="shock-panel-title">Active shock inspector</div><div class="shock-empty">Activate a preset shock or create a custom one. The inspector will expose magnitude, timing, persistence, confidence, channel lags, interactions, and net effects.</div>';
    return;
  }
  if (!selectedShockId || !activeEventIds[selectedShockId]) selectedShockId = ids[0];
  const ev = findShock(selectedShockId); const cfg = normalizeActiveShockConfig(selectedShockId, activeEventIds[selectedShockId]);
  const parts = report.contributions.filter(c => c.eventId === selectedShockId);
  const rows = ev.channels.map(ch => {
    const part = parts.find(c => c.target === ch.target);
    const net = part ? formatShockEffect(ch.target, part.adjusted) : '—';
    const residual = part && part.residualWeight < .999 ? `direct-output residual ×${part.residualWeight.toFixed(2)}` : '';
    const interactionText = part?.interactionReasons?.length ? part.interactionReasons.join('; ') : 'No state interaction at this month';
    const reason = [residual, interactionText].filter(Boolean).join('; ');
    const overlap = part && part.overlapWeight < .999 ? ` · overlap ×${part.overlapWeight.toFixed(2)}` : '';
    return `<tr><td>${escapeHtml(shockTargetLabel(ch.target))}<div class="shock-channel-note">${escapeHtml(ch.group)} · lag ${ch.lagMonths}mo · peak M${ch.peakMonth}</div></td><td>${formatShockEffect(ch.target,ch.effect)}</td><td>${part ? part.timingFactor.toFixed(2) : '0.00'}</td><td>${part ? part.interactionMultiplier.toFixed(2) : '—'}<div class="shock-channel-note">${escapeHtml(reason)}${overlap}</div></td><td>${net}</td></tr>`;
  }).join('');
  host.innerHTML = `<div class="shock-panel-title">Active shock inspector</div>
    <div class="si-head"><div><div class="si-name">${escapeHtml(ev.label)}</div><div class="si-meta"><span class="shock-badge ${cfg.shockType}">${cfg.shockType}</span><span class="shock-badge">${escapeHtml(ev.cat)}</span><span class="shock-badge">${Math.round(cfg.confidence*100)}% confidence</span></div></div><button class="btn" onclick="toggleEvent('${ev.id}')">Remove</button></div>
    <div class="si-controls">
      <div class="si-field wide"><div class="si-label"><span>Magnitude</span><strong>${Math.round(cfg.magnitude*100)}%</strong></div><input type="range" min="0" max="2.5" step="0.05" value="${cfg.magnitude}" oninput="updateShockConfig('${ev.id}','magnitude',this.value)"></div>
      <div class="si-field"><div class="si-label"><span>Shock class</span></div><select onchange="updateShockConfig('${ev.id}','shockType',this.value)"><option value="temporary"${cfg.shockType==='temporary'?' selected':''}>Temporary</option><option value="persistent"${cfg.shockType==='persistent'?' selected':''}>Persistent</option><option value="structural"${cfg.shockType==='structural'?' selected':''}>Structural</option></select></div>
      <div class="si-field"><div class="si-label"><span>Confidence</span><strong>${Math.round(cfg.confidence*100)}%</strong></div><input type="range" min="0.05" max="1" step="0.05" value="${cfg.confidence}" oninput="updateShockConfig('${ev.id}','confidence',this.value)"></div>
      <div class="si-field"><div class="si-label"><span>Onset month</span></div><input type="number" min="0" max="60" value="${cfg.onsetMonth}" onchange="updateShockConfig('${ev.id}','onsetMonth',this.value)"></div>
      <div class="si-field"><div class="si-label"><span>Duration months</span></div><input type="number" min="1" max="240" value="${cfg.durationMonths}" onchange="updateShockConfig('${ev.id}','durationMonths',this.value)"></div>
      <div class="si-field"><div class="si-label"><span>Peak month</span></div><input type="number" min="1" max="120" value="${cfg.peakMonth}" onchange="updateShockConfig('${ev.id}','peakMonth',this.value)"></div>
      <div class="si-field"><div class="si-label"><span>Decay / month</span></div><input type="number" min="0" max="1" step="0.01" value="${cfg.decayRate}" onchange="updateShockConfig('${ev.id}','decayRate',this.value)"></div>
    </div>
    <div class="si-actions"><button class="btn" onclick="resetShockConfig('${ev.id}')">Reset shock</button><button class="btn" onclick="clearAllShocks()">Clear all</button></div>
    <table class="shock-channel-table"><thead><tr><th>Channel</th><th>Full</th><th>Timing</th><th>Interaction</th><th>Net</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderShockAttribution(report) {
  const host = document.getElementById('shock-attribution'); if (!host) return;
  const out = report.outputEffects;
  const outputCard = (label,target,value) => `<div class="attr-output"><div class="attr-output-lbl">${label}</div><div class="attr-output-val ${value>0?'pos':value<0?'neg':''}">${formatShockEffect(target,value)}</div></div>`;
  if (!report.eventSummaries.length) {
    host.innerHTML = '<div class="shock-panel-title">Shock attribution</div><div class="shock-empty">Net scenario transmission will appear here. Related shocks are automatically discounted using diminishing overlap weights rather than stacked one-for-one.</div>';
    return;
  }
  const events = report.eventSummaries.map(s => {
    const cfg=s.config; const parts=[];
    if (Math.abs(s.output.gdpA)>.001) parts.push(`GDP ${formatShockEffect('gdpA',s.output.gdpA)}`);
    if (Math.abs(s.output.cpiA)>.001) parts.push(`CPI ${formatShockEffect('cpiA',s.output.cpiA)}`);
    if (Math.abs(s.output.spA)>.001) parts.push(`S&P ${formatShockEffect('spA',s.output.spA)}`);
    const uncertainty = Math.round((1-cfg.confidence)*100);
    return `<div class="attr-event"><div class="attr-event-head"><span>${escapeHtml(s.label)}</span><span>${Math.round(cfg.magnitude*100)}% · ${s.activeChannels} active channels</span></div><div class="attr-event-sub">${parts.join(' · ') || 'Direct input channels only'} · peak transmission ${(s.timing*100).toFixed(0)}% · impact uncertainty ±${uncertainty}%</div></div>`;
  }).join('');
  const overlapPct = report.rawAbsolute ? report.overlapReduction/report.rawAbsolute*100 : 0;
  host.innerHTML = `<div class="shock-panel-title">Shock attribution · Month ${report.month}</div><div class="attr-output-grid">${outputCard('GDP direct','gdpA',out.gdpA)}${outputCard('CPI direct','cpiA',out.cpiA)}${outputCard('S&P proxy','spA',out.spA)}</div>${events}${report.overlapReduction>0.001?`<div class="attr-overlap">Overlap control removed ${overlapPct.toFixed(1)}% of gross same-channel impact. Largest shock receives full weight; additional same-direction shocks receive diminishing weights.</div>`:''}`;
}

function addCustomEvent() {
  const name = document.getElementById('custom-shock-name')?.value.trim();
  if (!name) { toast('Enter a custom shock name'); return; }
  const type = document.getElementById('custom-shock-type').value;
  const channels = [];
  for (let i=0;i<3;i++) {
    const target = document.getElementById(`custom-target-${i}`).value;
    const effect = +document.getElementById(`custom-effect-${i}`).value;
    if (!target || !Number.isFinite(effect) || Math.abs(effect)<1e-9) continue;
    channels.push({target,effect,lagMonths:+document.getElementById(`custom-lag-${i}`).value||0,peakMonth:+document.getElementById(`custom-peak-${i}`).value||1});
  }
  if (!channels.length) { toast('Add at least one non-zero channel'); return; }
  const id = 'custom_' + (++customEventCount);
  const gdp = channels.find(c=>c.target==='gdpA')?.effect || 0;
  const cpi = channels.find(c=>c.target==='cpiA')?.effect || 0;
  const sp = channels.find(c=>c.target==='spA')?.effect || 0;
  const directional = gdp || sp/10 || -cpi;
  const ev = enrichEventDefinition({
    id,label:name,cat:document.getElementById('custom-shock-category').value,pos:directional>=0,
    shockType:type,durationMonths:+document.getElementById('custom-shock-duration').value||SHOCK_TYPE_DEFAULTS[type].durationMonths,
    peakMonth:+document.getElementById('custom-shock-peak').value||SHOCK_TYPE_DEFAULTS[type].peakMonth,
    decayRate:+document.getElementById('custom-shock-decay').value||0,
    confidence:(+document.getElementById('custom-shock-confidence').value||75)/100,
    channels,
    chips:channels.slice(0,3).map(c=>`${shockTargetLabel(c.target)} ${formatShockEffect(c.target,c.effect)}`)
  });
  EVENTS.push(ev);
  activeEventIds[id] = {...defaultShockConfig(ev), magnitude:+document.getElementById('custom-shock-magnitude').value||1};
  selectedShockId = id;
  const grid = document.getElementById(ev.pos?'positive-shock-grid':'negative-shock-grid');
  if (grid) grid.insertAdjacentHTML('beforeend', buildEventCard(ev));
  document.getElementById('custom-shock-name').value='';
  render(); renderEventLog(); commitChange();
  toast('Structured shock injected');
}

function filterShockCards(query) {
  const q=String(query||'').trim().toLowerCase();
  document.querySelectorAll('.ev-card').forEach(card => { card.style.display = !q || (card.dataset.search||'').includes(q) ? '' : 'none'; });
}

function renderEventLog() {
  const log = document.getElementById('elog'); if (!log) return;
  const ids = Object.keys(activeEventIds);
  if (!ids.length) { log.innerHTML='<span class="elog-empty">No shocks active — build a scenario in Events &amp; Shocks</span>'; return; }
  const report=resolveActiveShocks(vals);
  const label='<span class="elog-label">ACTIVE SHOCKS:</span>';
  const chips=ids.map(id=>{
    const ev=findShock(id); const cfg=normalizeActiveShockConfig(id,activeEventIds[id]); const summary=report.eventSummaries.find(s=>s.id===id);
    if(!ev||!cfg)return'';
    return `<span class="elog-chip ${ev.pos?'pos':'neg'}" onclick="selectShock('${id}')">${escapeHtml(ev.label)} · ${Math.round(cfg.magnitude*100)}%${summary?.activeChannels===0?' · pending':''}<span class="elog-x" onclick="event.stopPropagation();toggleEvent('${id}')">✕</span></span>`;
  }).join('');
  log.innerHTML=label+chips;
}

