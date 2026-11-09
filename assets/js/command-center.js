
// ── V8.2 COMMAND CENTER HARDENING + CONSOLIDATION ───────────────
const CC_SCENARIO_GROUPS = [
  {id:'economy',label:'Economy',icon:'◎',sections:['innovation','infra']},
  {id:'monetary',label:'Monetary & Rates',icon:'⚡',sections:['monetary','bonds']},
  {id:'fiscal',label:'Fiscal',icon:'◆',sections:['fiscal','state']},
  {id:'labor',label:'Labor',icon:'◫',sections:['labor']},
  {id:'housing',label:'Housing & Credit',icon:'⌂',sections:['housing']},
  {id:'trade',label:'Trade & FX',icon:'↔',sections:['trade']},
  {id:'energy',label:'Energy & Commodities',icon:'◈',sections:['energy']},
  {id:'geopolitics',label:'Geopolitics',icon:'◬',sections:['geopolitics']},
  {id:'advanced',label:'Advanced & Tools',icon:'⋯',sections:['politecon','events','branches','sensitivity','calibrate']}
];
const CC_DATA_ALIASES = {
  cpi:'headline_cpi',inflation:'headline_cpi',unemployment:'unemployment',payroll:'payrolls',payrolls:'payrolls',
  gdp:'real_gdp_growth',fed:'fed_funds',rates:'fed_funds','10y':'treasury_10y','10 year':'treasury_10y',
  mortgage:'mortgage_rate',housing:'housing_starts',oil:'wti_oil',wti:'wti_oil',gas:'henry_hub',pce:'pce_inflation'
};
const CC_NAV_ALIASES = {
  home:{workspace:'home'},dashboard:{workspace:'home'},
  scenario:{workspace:'scenario'},'scenario lab':{workspace:'scenario'},simulator:{workspace:'scenario'},
  data:{workspace:'data'},markets:{workspace:'markets'},market:{workspace:'markets'},library:{workspace:'library'},
  monetary:{section:'monetary'},fiscal:{section:'fiscal'},labor:{section:'labor'},housing:{section:'housing'},trade:{section:'trade'},energy:{section:'energy'},geopolitics:{section:'geopolitics'},
  portfolio:{section:'portfolio'},charts:{section:'charts'},'official data':{section:'observed'},releases:{section:'calendar'},news:{section:'news'},scenarios:{section:'scenarios'},analyst:{section:'analyst'}
};
let ccSystemStatus={aiConfigured:null,data:null,lastChecked:null,lastRevision:null};
let ccHomeDetailsOpen=false;

function ccScenarioChangedSliders(limit=5){
  const out=[];
  for(const cat of CATEGORIES){
    for(const sl of cat.sliders||[]){
      const cur=Number(vals[sl.id]); const base=Number(getSliderDefault(sl.id));
      if(Number.isFinite(cur)&&Number.isFinite(base)&&Math.abs(cur-base)>Math.max(1e-9,Number(sl.step||.01)/100)) out.push({id:sl.id,label:sl.label,current:cur,base,delta:cur-base,cat:cat.label,fmt:sl.fmt});
    }
  }
  out.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
  return out.slice(0,limit);
}
function ccScenarioChangeCount(){let n=0;for(const cat of CATEGORIES)for(const sl of cat.sliders||[]){const a=Number(vals[sl.id]),b=Number(getSliderDefault(sl.id));if(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)>Math.max(1e-9,Number(sl.step||.01)/100))n++;}return n;}
function ccScenarioName(){return document.getElementById('sc-name')?.value?.trim()||'Baseline 2026';}
function ccFmtDelta(n,digits=1,suffix=''){const x=Number(n)||0;return `${x>0?'+':''}${x.toFixed(digits)}${suffix}`;}
function ccAgo(iso){if(!iso)return'Never';const t=Date.parse(iso);if(!Number.isFinite(t))return String(iso);const min=Math.max(0,Math.round((Date.now()-t)/60000));if(min<2)return'just now';if(min<60)return`${min} min ago`;const h=Math.round(min/60);if(h<48)return`${h} hr ago`;return new Date(t).toLocaleString();}

function ccFindNavigationTarget(q){
  const raw=String(q||'').trim().toLowerCase();
  if(!/^(open|go to|show|take me to|navigate to|switch to)\b/.test(raw))return null;
  const rest=raw.replace(/^(open|go to|show|take me to|navigate to|switch to)\s+(the\s+)?/,'').trim();
  const direct=CC_NAV_ALIASES[rest]; if(direct)return direct;
  const section=Object.entries(CC_SECTION_META).find(([id,m])=>rest===id||rest===String(m.label||'').toLowerCase());
  if(section)return{section:section[0]};
  const ws=Object.entries(CC_WORKSPACES).find(([id,m])=>rest===id||rest===String(m.label||'').toLowerCase());
  return ws?{workspace:ws[0]}:null;
}
function ccLooksLikeScenarioPromptV82(q){
  const s=String(q||'').trim().toLowerCase();
  if(!s)return false;
  if(/^(why|explain|what is|what are|how does|how do|which|who|when|where)\b/.test(s) && !/^what (if|happens if)\b/.test(s))return false;
  const mutate=/\b(raise|lower|cut|increase|decrease|set|change|adjust|move|boost|reduce|add|remove|tighten|loosen|turn on|turn off)\b/.test(s);
  const construct=/^(simulate|create|build|model|apply|stress[- ]?test|run)\b/.test(s)||/\b(counterfactual|scenario|shock)\b/.test(s);
  const hypothetical=/^(what if|what happens if|suppose|assume)\b/.test(s);
  const econ=/\b(oil|gas|cpi|inflation|fed|rate|rates|tariff|tax|taxes|spending|deficit|unemployment|payroll|labor|housing|mortgage|trade|dollar|yield|treasury|productivity|ai|immigration|regulation|energy|war|sanction|credit|bank|gdp)\b/.test(s);
  return construct || (mutate&&econ) || (hypothetical&&econ);
}
function ccClassifyPrompt(q){
  const text=String(q||'').trim();
  const nav=ccFindNavigationTarget(text);if(nav)return{kind:'navigate',...nav};
  if(isCurrentDataResearchPrompt(text))return{kind:'data'};
  if(ccLooksLikeScenarioPromptV82(text))return{kind:'scenario'};
  return{kind:'ask'};
}
// Keep old name compatible with V8.1 callers.
ccLooksLikeScenarioPrompt=ccLooksLikeScenarioPromptV82;

function ccNavigate(target){
  if(target?.section){showSection(target.section,null);return true;}
  if(target?.workspace){ccSetWorkspace(target.workspace,true);return true;}
  return false;
}
function ccLocalDeterministicCommand(q){
  const s=String(q||'').trim().toLowerCase();
  if(['undo','undo last change'].includes(s)){undo();return true;}
  if(['redo','redo last change'].includes(s)){redo();return true;}
  if(['save','save scenario','save current scenario'].includes(s)){saveScenario();return true;}
  if(['reset','reset scenario','reset all'].includes(s)){if(confirm('Reset all scenario inputs to defaults?'))resetAll();return true;}
  return false;
}

function ccDataSearchItems(q){
  const n=String(q||'').trim().toLowerCase();if(n.length<2)return[];
  const obs=officialData?.observations||{};const items=[];
  for(const [key,o] of Object.entries(obs)){
    const hay=`${key} ${o.label||''} ${o.seriesId||''} ${o.category||''}`.toLowerCase();
    if(hay.includes(n))items.push({kind:'dataitem',key,title:o.label||key,icon:'◉',workspace:'data',sub:`${o.seriesId||key} · ${o.observationDate||'latest'} · ${Number.isFinite(+o.actual)?(+o.actual).toFixed(o.precision??2):'—'}${String(o.units||'').includes('%')?'%':''}`});
  }
  if(!items.length){for(const [alias,key] of Object.entries(CC_DATA_ALIASES))if(alias.includes(n)||n.includes(alias))items.push({kind:'dataitem',key,title:`Latest ${alias}`,icon:'◉',workspace:'data',sub:'Official observation'});}
  return items.slice(0,6);
}
function ccSavedScenarioItems(q){
  const n=String(q||'').trim().toLowerCase();if(n.length<2)return[];const out=[];
  (scenarios||[]).forEach((s,i)=>{if(String(s.name||'').toLowerCase().includes(n))out.push({kind:'saved',source:'scenario',index:i,title:s.name,icon:'◩',workspace:'library',sub:`Saved scenario · ${s.date||''}`});});
  (scenarioBranches||[]).forEach((s,i)=>{if(String(s.name||'').toLowerCase().includes(n))out.push({kind:'saved',source:'branch',index:i,title:s.name,icon:'⑂',workspace:'library',sub:`Scenario branch · ${+s.probability||0}%`});});
  return out.slice(0,5);
}

const ccLegacyRenderCommandResultsV82=ccRenderCommandResults;
ccRenderCommandResults=function(query=''){
  const el=document.getElementById('cc-palette-results');if(!el)return;
  const raw=String(query||'').trim(),q=raw.toLowerCase();let items=[];
  if(!q)items=[...ccQuickItems(),...ccAllNavItems().filter(x=>['overview','events','observed','portfolio','scenarios','analyst'].includes(x.id))];
  else{
    const controls=ccControlItems(q),data=ccDataSearchItems(q),saved=ccSavedScenarioItems(q),nav=ccAllNavItems().filter(x=>`${x.title} ${x.sub} ${x.id}`.toLowerCase().includes(q)).slice(0,6);
    items=[...controls,...data,...saved,...nav].slice(0,16);
    const cls=ccClassifyPrompt(raw);items.push({kind:'prompt',title:`Run “${raw}”`,icon:'↵',sub:cls.kind==='data'?'Official data → Data Copilot review':cls.kind==='scenario'?'Scenario → validated draft and review':cls.kind==='navigate'?'Navigation command':'Question → read-only Ask MACROSCOPE',query:raw});
  }
  ccPaletteItems=items;ccPaletteIndex=Math.min(ccPaletteIndex,Math.max(0,items.length-1));
  const groupName=i=>i.kind==='control'?'Controls':i.kind==='dataitem'?'Live Data':i.kind==='saved'?'Saved Work':i.kind==='section'?'Navigate':i.kind==='quick'?'Quick Actions':'MACROSCOPE';
  const groups=[];for(const item of items){const g=groupName(item);let group=groups.find(x=>x.name===g);if(!group){group={name:g,items:[]};groups.push(group)}group.items.push(item)}
  let globalIdx=0;el.innerHTML=groups.map(g=>`<div class="cc-result-group">${g.name}</div>${g.items.map(item=>{const idx=globalIdx++;return `<button class="cc-result${idx===ccPaletteIndex?' active':''}" data-kind="${item.kind}" data-cc-index="${idx}" onclick="ccExecuteResult(${idx})"><span class="cc-result-icon">${item.icon||'•'}</span><span><span class="cc-result-title">${escapeHtml(item.title)}</span><span class="cc-result-sub">${escapeHtml(item.sub||'')}</span></span><span class="cc-result-tag ${item.kind!=='prompt'?'local':''}">${item.kind==='prompt'?'ENTER':(item.workspace||item.kind).toUpperCase()}</span></button>`}).join('')}`).join('');
};

const ccLegacyExecuteResultV82=ccExecuteResult;
ccExecuteResult=function(i){const item=ccPaletteItems[i];if(!item)return;
  if(item.kind==='dataitem'){ccLogCommand(`Open ${item.title}`);closeCommandCenter();showSection('observed',null);return;}
  if(item.kind==='saved'){ccLogCommand(`Load ${item.title}`);closeCommandCenter();if(item.source==='scenario')loadScenario(item.index);else loadBranch(item.index);return;}
  return ccLegacyExecuteResultV82(i);
};

ccRunPrompt=function(query){
  const q=String(query||'').trim();if(!q)return;ccLogCommand(q);
  if(ccLocalDeterministicCommand(q))return;
  const route=ccClassifyPrompt(q);
  if(route.kind==='navigate'){ccNavigate(route);return;}
  if(route.kind==='data'){showSection('data-copilot',null);setTimeout(()=>{const ta=document.getElementById('data-copilot-prompt');if(ta)ta.value=q;requestDataCopilotUpdate(q)},60);return;}
  if(route.kind==='scenario'){showSection('events',null);setTimeout(()=>{const ta=document.getElementById('ai-scenario-prompt');if(ta){ta.value=q;updateAIContextMeter();generateAIScenario();}},60);return;}
  showSection('analyst',null);setTimeout(()=>{const ta=document.getElementById('analyst-prompt');if(ta){ta.value=q;askMacroscope();}},60);
};

async function ccRouteAnalystPromptToScenario(prompt){
  const st=document.getElementById('analyst-status'),out=document.getElementById('analyst-answer');
  if(st)st.textContent='ROUTING → SCENARIO LAB';
  if(out)out.innerHTML='<div class="ai-route-notice"><b>Scenario instruction detected.</b><br>Routing to the validated Counterfactual Studio. Nothing will change until you review and run the proposed command.</div>';
  showSection('events',sectionButton('events'));
  await new Promise(r=>setTimeout(r,40));
  const ta=document.getElementById('ai-scenario-prompt');if(ta){ta.value=prompt;updateAIContextMeter();await generateAIScenario();}
}
const ccLegacyAskMacroscopeV82=askMacroscope;
askMacroscope=async function(){
  const prompt=document.getElementById('analyst-prompt')?.value.trim();if(!prompt){toast('Ask a question first');return;}
  const route=ccClassifyPrompt(prompt);
  if(route.kind==='navigate'){ccNavigate(route);return;}
  if(route.kind==='scenario'){await ccRouteAnalystPromptToScenario(prompt);return;}
  return ccLegacyAskMacroscopeV82();
};

function ccRenderScenarioGroups(){
  const box=document.getElementById('cc-workspace-nav');if(!box)return;
  let html=`<div class="cc-sub-search"><input id="slider-search" type="text" placeholder="Search 70+ controls…" oninput="onSearch(this.value)" onkeydown="onSearchKey(event)"><div class="search-results" id="search-results"></div></div>`;
  for(const g of CC_SCENARIO_GROUPS){
    const active=g.sections.includes(currentSection);html+=`<div class="cc-scenario-group${active?'':' closed'}" data-cc-group="${g.id}"><button class="cc-scenario-group-head" onclick="ccToggleScenarioGroup('${g.id}')"><span>${g.icon}</span><span>${escapeHtml(g.label)}</span><span>${active?'−':'+'}</span></button><div class="cc-scenario-group-items">${g.sections.map(id=>{const m=CC_SECTION_META[id]||{label:id,icon:'•'};return `<button class="nav-item${id===currentSection?' active':''}" onclick="showSection('${id}',this)"><span class="nav-icon">${m.icon}</span>${m.label}</button>`}).join('')}</div></div>`;
  }
  box.innerHTML=html;
}
function ccToggleScenarioGroup(id){const el=document.querySelector(`[data-cc-group="${id}"]`);if(!el)return;el.classList.toggle('closed');const sign=el.querySelector('.cc-scenario-group-head span:last-child');if(sign)sign.textContent=el.classList.contains('closed')?'+':'−';}
const ccLegacyRenderWorkspaceNavV82=ccRenderWorkspaceNav;
ccRenderWorkspaceNav=function(key){if(key==='scenario'){ccRenderScenarioGroups();return;}ccLegacyRenderWorkspaceNavV82(key);};

function ccHomeHtml(){return `<div class="cc-home-v82">
  <div class="cc-home-hero"><div><div class="cc-home-eyebrow">MACROSCOPE COMMAND CENTER</div><div class="cc-home-heading">Observe. Test. Compare. Explain.</div><div class="cc-home-copy">The live economy, your current scenario, market consequences, and MACROSCOPE intelligence now share one workflow. Use Ctrl+K to jump straight to a control, dataset, saved scenario, or question.</div></div><div class="cc-home-live"><button onclick="ccOpenDataStatus()" id="cc-home-data-chip">DATA CHECKING</button><button onclick="showSection('analyst',null)" id="cc-home-ai-chip">GROQ CHECKING</button></div></div>
  <div class="cc-home-kpis"><div class="cc-home-kpi"><label>GDP Growth</label><strong id="cc-home-gdp">—</strong><small id="cc-home-gdp-sub">Model output</small></div><div class="cc-home-kpi"><label>Inflation</label><strong id="cc-home-cpi">—</strong><small id="cc-home-cpi-sub">Model output</small></div><div class="cc-home-kpi"><label>Unemployment</label><strong id="cc-home-unemp">—</strong><small id="cc-home-unemp-sub">Model output</small></div><div class="cc-home-kpi"><label>10Y Treasury</label><strong id="cc-home-10y">—</strong><small id="cc-home-10y-sub">Model output</small></div></div>
  <div class="cc-home-actions-v82"><button class="cc-home-action-v82" onclick="ccSetWorkspace('scenario',true)"><b>◬ Run a Scenario</b><span>Change assumptions and stress the economy</span></button><button class="cc-home-action-v82" onclick="ccRunPrompt('Bring MACROSCOPE current using the latest official U.S. macro data.')"><b>↻ Update Data</b><span>Review sourced observations before applying</span></button><button class="cc-home-action-v82" onclick="showSection('events',null)"><b>✦ Analyze an Event</b><span>Generate a validated counterfactual draft</span></button><button class="cc-home-action-v82" onclick="showSection('branches',null)"><b>⑂ Compare Scenarios</b><span>Build branches and weighted comparisons</span></button></div>
  <div class="cc-home-grid"><div class="cc-home-panel"><div class="cc-home-panel-title"><span>Current Scenario</span><button onclick="ccSetWorkspace('scenario',true)">OPEN LAB →</button></div><div class="cc-home-scenario-name" id="cc-home-scenario-name">Baseline 2026</div><div id="cc-home-scenario-lines"></div></div><div class="cc-home-panel"><div class="cc-home-panel-title"><span>Latest Official Observations</span><button onclick="showSection('observed',null)">VIEW DATA →</button></div><div id="cc-home-releases"></div></div><div class="cc-home-panel"><div class="cc-home-panel-title"><span>Recent Activity</span><button onclick="openCommandCenter('')">COMMAND →</button></div><div id="cc-home-history" class="cc-home-history-v82"></div></div></div>
  <div class="cc-home-detail-toggle"><button onclick="ccToggleHomeDetail()" id="cc-home-detail-btn">SHOW DETAILED DASHBOARD ↓</button></div>
</div>`;}
function ccUpgradeHomeV82(){
  const shell=document.querySelector('#sec-overview .ov-shell');if(!shell||shell.querySelector('.cc-home-v82'))return;
  shell.querySelector('.cc-home-intro')?.remove();
  const legacy=document.createElement('div');legacy.className='cc-home-legacy';while(shell.firstChild)legacy.appendChild(shell.firstChild);
  shell.insertAdjacentHTML('afterbegin',ccHomeHtml());shell.appendChild(legacy);ccRefreshHome();
}
function ccToggleHomeDetail(){ccHomeDetailsOpen=!ccHomeDetailsOpen;document.querySelector('#sec-overview .cc-home-legacy')?.classList.toggle('open',ccHomeDetailsOpen);const b=document.getElementById('cc-home-detail-btn');if(b)b.textContent=ccHomeDetailsOpen?'HIDE DETAILED DASHBOARD ↑':'SHOW DETAILED DASHBOARD ↓';}
function ccOfficialObservationList(){return Object.values(officialData?.observations||{}).filter(o=>o&&o.observationDate).sort((a,b)=>String(b.observationDate).localeCompare(String(a.observationDate)));}
function ccRefreshHome(){
  const m=compute();const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  set('cc-home-gdp',`${m.gdp.toFixed(1)}%`);set('cc-home-cpi',`${m.cpi.toFixed(1)}%`);set('cc-home-unemp',`${m.unemp.toFixed(1)}%`);set('cc-home-10y',`${m.tenyr.toFixed(2)}%`);
  set('cc-home-scenario-name',ccScenarioName());const changes=ccScenarioChangedSliders(3),shocks=Object.keys(activeEventIds).length;
  const lines=document.getElementById('cc-home-scenario-lines');if(lines){let html=`<div class="cc-home-line"><span>Modified controls</span><b>${ccScenarioChangeCount()}</b></div><div class="cc-home-line"><span>Active shocks</span><b>${shocks}</b></div>`;for(const x of changes)html+=`<div class="cc-home-line"><span>${escapeHtml(x.label)}</span><b>${ccFmtDelta(x.delta,Math.abs(x.delta)<1?2:1)}</b></div>`;lines.innerHTML=html;}
  const releases=document.getElementById('cc-home-releases');if(releases){const obs=ccOfficialObservationList().slice(0,4);releases.innerHTML=obs.length?obs.map(o=>`<div class="cc-home-release"><b>${escapeHtml(o.label||o.key||o.seriesId)}</b><span>${escapeHtml(o.observationDate)} · ${Number.isFinite(+o.actual)?(+o.actual).toFixed(o.precision??2):'—'}${String(o.units||'').includes('%')?'%':''} · ${escapeHtml(o.seriesId||'')}</span></div>`).join(''):'<div class="cc-home-release"><b>Waiting for live observations</b><span>Open Data Status to refresh the gateway.</span></div>';}
  const hist=document.getElementById('cc-home-history');if(hist){const h=ccCommandHistory().slice(0,6);hist.innerHTML=h.length?h.map(x=>`<button onclick="openCommandCenter('${escapeAttr(x)}')">${escapeHtml(x)}</button>`).join(''):'<span style="font:8px var(--font-mono);color:var(--muted)">No commands yet. Ctrl+K is the fastest way to begin.</span>';}
  const dc=document.getElementById('cc-home-data-chip');if(dc)dc.textContent=ccSystemStatus.data?.status?`DATA ${String(ccSystemStatus.data.status).toUpperCase()}`:(officialData?'DATA LIVE':'DATA CHECKING');
  const ac=document.getElementById('cc-home-ai-chip');if(ac)ac.textContent=ccSystemStatus.aiConfigured===false?'GROQ OFFLINE':ccSystemStatus.aiConfigured===true?'GROQ READY':'GROQ CHECKING';
}

const ccLegacyBuildContentV82=buildContent;
buildContent=function(){ccLegacyBuildContentV82();ccUpgradeHomeV82();ccRenderWorkspaceNav(ccWorkspace);};

function ccRailScenario(m){
  const changes=ccScenarioChangedSliders(4),shocks=Object.keys(activeEventIds).length,pending=!!aiScenarioDraft;
  const bg=Number(BASELINES.gdp??2.5),bc=Number(BASELINES.cpi??2.5),bu=Number(officialData?.baseline?.outputs?.unemp??4),bt=Number(BASELINES.tenyr??4.2);
  return `<div class="rail-kicker"><span class="rail-live"></span> SCENARIO LAB</div><div class="rail-title">${escapeHtml(ccScenarioName())}</div>${pending?`<div class="cc-staged"><b>STAGED AI DRAFT</b><br>${escapeHtml(aiScenarioDraft.scenarioName||'Counterfactual')} · review required before application.</div>`:''}<div class="cc-rail-summary"><div class="cc-rail-row"><span>GDP</span><b>${bg.toFixed(1)} → ${m.gdp.toFixed(1)}%</b><em>${ccFmtDelta(m.gdp-bg,1,'pp')}</em></div><div class="cc-rail-row"><span>CPI</span><b>${bc.toFixed(1)} → ${m.cpi.toFixed(1)}%</b><em>${ccFmtDelta(m.cpi-bc,1,'pp')}</em></div><div class="cc-rail-row"><span>Unemployment</span><b>${bu.toFixed(1)} → ${m.unemp.toFixed(1)}%</b><em>${ccFmtDelta(m.unemp-bu,1,'pp')}</em></div><div class="cc-rail-row"><span>10Y</span><b>${bt.toFixed(2)} → ${m.tenyr.toFixed(2)}%</b><em>${ccFmtDelta(m.tenyr-bt,2,'pp')}</em></div></div><div class="rail-divider"></div><div class="rail-label">CHANGES · ${ccScenarioChangeCount()} CONTROLS · ${shocks} SHOCK${shocks===1?'':'S'}</div>${changes.length?changes.map(x=>`<div class="cc-rail-change"><b>${escapeHtml(x.label)}</b> ${ccFmtDelta(x.delta,Math.abs(x.delta)<1?2:1)}</div>`).join(''):'<div class="cc-rail-change">At baseline — no controls moved.</div>'}<div class="cc-rail-buttons"><button class="primary" onclick="${pending?'runAIScenarioDraft()':'ccRunCurrentScenario()'}">${pending?'APPLY & RUN':'RUN SCENARIO'}</button><button onclick="showSection('branches',null)">COMPARE</button><button onclick="ccExplainCurrentScenario()">EXPLAIN</button><button onclick="saveScenario()">SAVE</button>${undoStack?.length?'<button onclick="undo()">UNDO</button>':''}<button onclick="showSection('events',null)">STUDIO</button></div><div class="rail-foot">AI-generated changes are staged first. Manual and AI changes remain reversible through Undo.</div>`;
}
function ccRailData(m){
  const fresh=officialData?.freshSeriesCount??Object.values(officialData?.observations||{}).filter(o=>!o.isStale&&!o.fallback).length, total=officialData?.seriesCount??Object.keys(officialData?.observations||{}).length;
  return `<div class="rail-kicker"><span class="rail-live"></span> LIVE DATA</div><div class="rail-title">Official observations</div><div class="rail-snapshot"><div class="rail-metric"><span>Series</span><b>${total||0}</b></div><div class="rail-metric"><span>Fresh</span><b>${fresh||0}</b></div><div class="rail-state">Last gateway sync: ${ccAgo(liveDataGatewayState.lastRefresh||officialData?.generatedAt)} · ${escapeHtml(String(liveDataGatewayState.status||officialData?.status||'checking'))}</div></div><div class="cc-rail-buttons"><button class="primary" onclick="ccRefreshLiveDataNow()">REFRESH</button><button onclick="ccOpenDataStatus()">STATUS</button><button onclick="showSection('data-copilot',null)">COPILOT</button><button onclick="showSection('observed',null)">OBSERVATIONS</button></div><div class="rail-foot">Observed values and model assumptions stay separate until you explicitly approve a baseline update.</div>`;
}
function ccRailMarkets(m){const pa=portfolioAnalytics(m);return `<div class="rail-kicker"><span class="rail-live"></span> MARKETS</div><div class="rail-title">Scenario consequences</div><div class="rail-snapshot"><div class="rail-metric"><span>10Y</span><b>${m.tenyr.toFixed(2)}%</b></div><div class="rail-metric"><span>Mortgage</span><b>${m.mortg.toFixed(2)}%</b></div><div class="rail-metric"><span>S&P Index</span><b>${m.sp500.toFixed(0)}</b></div><div class="rail-metric"><span>Portfolio</span><b>${pa.scenarioReturn>=0?'+':''}${pa.scenarioReturn.toFixed(1)}%</b></div></div><div class="cc-rail-buttons"><button class="primary" onclick="showSection('portfolio',null)">PORTFOLIO</button><button onclick="showSection('charts',null)">CHARTS</button><button onclick="showSection('compare',null)">COMPARE</button></div><div class="rail-foot">Market outputs are scenario sensitivities, not market forecasts or investment recommendations.</div>`;}
function ccRailLibrary(){return `<div class="rail-kicker"><span class="rail-live"></span> LIBRARY</div><div class="rail-title">Saved work</div><div class="rail-snapshot"><div class="rail-metric"><span>Scenarios</span><b>${scenarios.length}</b></div><div class="rail-metric"><span>Branches</span><b>${scenarioBranches.length}</b></div><div class="rail-state">Recent command history: ${ccCommandHistory().length} entries</div></div><div class="cc-rail-buttons"><button class="primary" onclick="showSection('scenarios',null)">SCENARIOS</button><button onclick="showSection('history',null)">HISTORY</button><button onclick="showSection('analyst',null)">ASK</button></div><div class="rail-foot">Saved scenarios remain local to this browser unless you export or share them.</div>`;}
function ccRailHome(m){return `<div class="rail-kicker"><span class="rail-live"></span> MACROSCOPE COPILOT</div><div class="rail-title">One command, routed safely</div><div class="rail-action" onclick="openCommandCenter('')"><span>⌕</span><div><b>Command MACROSCOPE</b><small>Navigate, search, stage, or ask</small></div></div><div class="rail-action" onclick="ccSetWorkspace('scenario',true)"><span>◬</span><div><b>Scenario Lab</b><small>${ccScenarioChangeCount()} changed controls · ${Object.keys(activeEventIds).length} shocks</small></div></div><div class="rail-action" onclick="ccOpenDataStatus()"><span>↻</span><div><b>Live Data</b><small>${officialData?.seriesCount||0} tracked series · ${ccAgo(officialData?.generatedAt)}</small></div></div><div class="rail-divider"></div><div class="rail-label">LIVE SNAPSHOT</div><div class="rail-snapshot"><div class="rail-metric"><span>GDP</span><b>${m.gdp.toFixed(1)}%</b></div><div class="rail-metric"><span>CPI</span><b>${m.cpi.toFixed(1)}%</b></div><div class="rail-metric"><span>Unemployment</span><b>${m.unemp.toFixed(1)}%</b></div><div class="rail-metric"><span>10Y</span><b>${m.tenyr.toFixed(2)}%</b></div></div><div class="rail-foot">Navigation and simple searches run locally. Groq is used only when interpretation is actually needed.</div>`;}
renderAIRail=function(m){const rail=document.getElementById('ai-rail');if(!rail)return;rail.innerHTML=ccWorkspace==='scenario'?ccRailScenario(m):ccWorkspace==='data'?ccRailData(m):ccWorkspace==='markets'?ccRailMarkets(m):ccWorkspace==='library'?ccRailLibrary():ccRailHome(m);ccRefreshSystemStrip();};
function ccRunCurrentScenario(){render();renderEventLog();ccLogCommand(`Run ${ccScenarioName()}`);toast('Scenario recalculated from the current validated inputs');}
function ccExplainCurrentScenario(){showSection('analyst',null);setTimeout(()=>{setAnalystPrompt('Explain the current macro scenario and identify the three most important causal drivers, countervailing forces, and assumptions.');askMacroscope();},50);}

function ccEnsureStatusOverlay(){if(document.getElementById('cc-status-overlay'))return;document.body.insertAdjacentHTML('beforeend',`<div id="cc-status-overlay" class="cc-status-overlay" onclick="if(event.target===this)ccCloseDataStatus()"><div class="cc-status-card"><div class="cc-status-head"><b>MACROSCOPE SYSTEM STATUS</b><button onclick="ccCloseDataStatus()">×</button></div><div id="cc-status-body" class="cc-status-body">Checking…</div></div></div>`);}
function ccCloseDataStatus(){document.getElementById('cc-status-overlay')?.classList.remove('open');}
async function ccOpenDataStatus(){ccEnsureStatusOverlay();document.getElementById('cc-status-overlay')?.classList.add('open');await ccRefreshSystemStatus(true);ccRenderStatusModal();}
function ccRenderStatusModal(){
  const b=document.getElementById('cc-status-body');if(!b)return;const d=ccSystemStatus.data||{},obs=officialData||{},fresh=obs.freshSeriesCount??Object.values(obs.observations||{}).filter(o=>!o.isStale&&!o.fallback).length,total=obs.seriesCount??d.seriesCount??Object.keys(obs.observations||{}).length,stale=Math.max(0,total-fresh),rev=ccSystemStatus.lastRevision;
  b.innerHTML=`<div class="cc-status-grid"><div class="cc-status-stat"><span>Data gateway</span><b>${d.ok===false?'OFFLINE':String(d.status||liveDataGatewayState.status||'CHECKING').toUpperCase()}</b></div><div class="cc-status-stat"><span>Tracked series</span><b>${total||0}</b></div><div class="cc-status-stat"><span>Fresh / fallback</span><b>${fresh||0} / ${stale||0}</b></div><div class="cc-status-stat"><span>Last sync</span><b>${ccAgo(d.lastRefresh||obs.generatedAt)}</b></div><div class="cc-status-stat"><span>Groq</span><b>${ccSystemStatus.aiConfigured===false?'OFFLINE':ccSystemStatus.aiConfigured===true?'READY':'UNKNOWN'}</b></div><div class="cc-status-stat"><span>Model</span><b>READY</b></div></div><div class="cc-status-note">${rev?`Latest revision detected: ${escapeHtml(rev.series_id||rev.series_key)} · ${escapeHtml(rev.observation_date||'')} · ${rev.old_value} → ${rev.new_value} · ${ccAgo(rev.detected_at)}`:'No stored revision has been detected yet.'}<br>Live data failures do not disable the simulator; MACROSCOPE retains the last verified observations and the static release snapshot as fallback.</div><div class="cc-status-actions"><button onclick="ccRefreshLiveDataNow()">REFRESH DATA NOW</button><button onclick="showSection('observed',null);ccCloseDataStatus()">VIEW OBSERVATIONS</button><button onclick="showSection('data-copilot',null);ccCloseDataStatus()">DATA COPILOT</button></div>`;
}
async function ccRefreshSystemStatus(force=false){
  const endpoint=liveDataGatewayEndpoint();if(!endpoint)return;
  if(!force&&ccSystemStatus.lastChecked&&Date.now()-ccSystemStatus.lastChecked<60000){ccRefreshSystemStrip();return;}
  try{
    const [rootR,dataR,revR]=await Promise.all([fetch(endpoint,{cache:'no-store'}),fetch(`${endpoint}/api/data/status`,{cache:'no-store'}),fetch(`${endpoint}/api/data/revisions?limit=1`,{cache:'no-store'})]);
    const root=await rootR.json().catch(()=>({})),data=await dataR.json().catch(()=>({})),revs=await revR.json().catch(()=>({revisions:[]}));
    ccSystemStatus={aiConfigured:root?.ai?.configured ?? root?.groqConfigured ?? (rootR.ok?null:false),data,lastChecked:Date.now(),lastRevision:revs?.revisions?.[0]||null};
  }catch(e){ccSystemStatus={...ccSystemStatus,data:{ok:false,status:'offline',error:String(e?.message||e)},lastChecked:Date.now()};}
  ccRefreshSystemStrip();ccRefreshHome();
}
function ccRefreshSystemStrip(){
  const strip=document.getElementById('system-strip');if(!strip)return;const kids=[...strip.children];
  if(kids[0]){kids[0].id='sys-model';kids[0].innerHTML='<span class="cc-status-pill"><span class="sys-dot live"></span><b>MODEL</b> READY</span>';}
  if(kids[1]){kids[1].id='sys-groq';kids[1].classList.add('cc-system-click');kids[1].onclick=ccOpenDataStatus;const ai=ccSystemStatus.aiConfigured;kids[1].innerHTML=`<span class="cc-status-pill"><span class="sys-dot ${ai===false?'neg':'live'}"></span><b>GROQ</b> ${ai===false?'OFFLINE':ai===true?'READY':'CHECKING'}</span>`;}
  const d=document.getElementById('sys-data');if(d){d.classList.add('cc-system-click');d.onclick=ccOpenDataStatus;const st=ccSystemStatus.data?.status||liveDataGatewayState.status||(officialData?'ready':'checking'),bad=st==='offline'||st==='failed',warn=st==='partial'||st==='uninitialized';d.innerHTML=`<span class="cc-status-pill"><span class="sys-dot ${bad?'neg':warn?'warn':officialData||st==='ready'?'live':''}"></span><b>DATA</b> ${bad?'OFFLINE':warn?'PARTIAL':officialData||st==='ready'?'LIVE':'CHECKING'}</span>`;}
}
async function ccRefreshLiveDataNow(){const btn=document.querySelector('.cc-status-actions button');if(btn)btn.textContent='REFRESHING…';const ok=await loadLiveOfficialData(true);await ccRefreshSystemStatus(true);render();ccRenderStatusModal();toast(ok?'Live economic data refreshed':'Live refresh unavailable · keeping last verified data');}

const ccLegacyShowSectionV82=showSection;
showSection=function(id,btn){ccLegacyShowSectionV82(id,btn);ccWorkspace=ccWorkspaceForSection(id);ccRenderWorkspaceNav(ccWorkspace);renderAIRail(compute());if(id==='overview')ccRefreshHome();};

const ccLegacyRenderV82=render;
render=function(){ccLegacyRenderV82();ccRefreshHome();};

function ccInstallV82(){
  ccUpgradeHomeV82();ccRenderWorkspaceNav(ccWorkspace);ccEnsureStatusOverlay();ccRefreshSystemStrip();ccRefreshSystemStatus(false);
  setInterval(()=>ccRefreshSystemStatus(false),120000);
  const sc=document.getElementById('sc-name');if(sc&&!sc.dataset.ccV82){sc.dataset.ccV82='1';sc.addEventListener('input',()=>{ccRefreshHome();renderAIRail(compute());});}
}
setTimeout(ccInstallV82,50);

