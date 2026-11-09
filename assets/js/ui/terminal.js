// ── V8.0 TERMINAL UI / APPEARANCE / REASONING ─────────────────
const TERMINAL_THEMES={
  amber:{accent:'#ffb000',bg:'#030507',surface:'#070a0d',surface2:'#0b0f13',border:'#202830',border2:'#33404b',text:'#e8edf2',dim:'#a5b0ba',muted:'#64717d'},
  mono:{accent:'#f4f4f4',bg:'#020202',surface:'#070707',surface2:'#0c0c0c',border:'#252525',border2:'#404040',text:'#f1f1f1',dim:'#b8b8b8',muted:'#707070'},
  cyan:{accent:'#4ad7ff',bg:'#020609',surface:'#050b0f',surface2:'#091117',border:'#17303b',border2:'#275467',text:'#e4f7fb',dim:'#97b9c2',muted:'#54717a'},
  emerald:{accent:'#34e89e',bg:'#020704',surface:'#050c08',surface2:'#08140e',border:'#183426',border2:'#285c42',text:'#e8f7ef',dim:'#9abaaa',muted:'#567568'},
  violet:{accent:'#b48cff',bg:'#050307',surface:'#0a0710',surface2:'#100b18',border:'#302440',border2:'#503b6c',text:'#f1ebfa',dim:'#b8a7c9',muted:'#756487'},
  red:{accent:'#ff626e',bg:'#070203',surface:'#0d0506',surface2:'#15080a',border:'#3a1b20',border2:'#65303a',text:'#f8e9eb',dim:'#c3a0a5',muted:'#805c62'}
};
function hexToRgb(hex){const h=String(hex||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))return null;return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function applyTerminalTheme(themeName='amber',customAccent=null){
  const t=TERMINAL_THEMES[themeName]||TERMINAL_THEMES.amber,root=document.documentElement;
  const vars={'--terminal-accent':customAccent||t.accent,'--bg':t.bg,'--surface':t.surface,'--surface2':t.surface2,'--surface3':t.surface2,'--border':t.border,'--border2':t.border2,'--text':t.text,'--text-dim':t.dim,'--muted':t.muted};
  Object.entries(vars).forEach(([k,v])=>root.style.setProperty(k,v));
  localStorage.setItem('macroscope.ui.theme',themeName);if(customAccent)localStorage.setItem('macroscope.ui.customAccent',customAccent);else localStorage.removeItem('macroscope.ui.customAccent');
  document.querySelectorAll('.theme-grid button').forEach(b=>b.classList.toggle('active',b.dataset.theme===themeName&&!customAccent));
  const picker=document.getElementById('custom-accent'),code=document.getElementById('custom-accent-code');if(picker)picker.value=customAccent||t.accent;if(code)code.textContent=(customAccent||t.accent).toUpperCase();
  try{if(chartsVisible)renderCharts(compute());}catch(_){ }
}
function setTerminalTheme(name){applyTerminalTheme(name,null)}
function setCustomAccent(hex){const base=localStorage.getItem('macroscope.ui.theme')||'amber';applyTerminalTheme(base,hex)}
function openAppearancePanel(){document.getElementById('appearance-overlay')?.classList.add('open')}
function closeAppearancePanel(){document.getElementById('appearance-overlay')?.classList.remove('open')}
function setTerminalDensity(v){document.body.dataset.density=v;localStorage.setItem('macroscope.ui.density',v);document.getElementById('density-compact')?.classList.toggle('active',v==='compact');document.getElementById('density-comfort')?.classList.toggle('active',v==='comfortable')}
function setRailVisibility(show){document.body.classList.toggle('hide-ai-rail',!show);localStorage.setItem('macroscope.ui.rail',show?'1':'0')}
function setBootPreference(show){localStorage.setItem('macroscope.ui.boot',show?'1':'0')}
function toggleSidebarCompact(){document.body.classList.toggle('sidebar-compact');localStorage.setItem('macroscope.ui.sidebarCompact',document.body.classList.contains('sidebar-compact')?'1':'0')}
function toggleTerminalMenu(e){e?.stopPropagation();document.getElementById('terminal-menu')?.classList.toggle('open')}
function closeTerminalMenu(){document.getElementById('terminal-menu')?.classList.remove('open')}
document.addEventListener('click',e=>{if(!e.target.closest('.menu-wrap'))closeTerminalMenu()});
function initTerminalUI(){
  const th=localStorage.getItem('macroscope.ui.theme')||'amber',custom=localStorage.getItem('macroscope.ui.customAccent');applyTerminalTheme(th,custom||null);
  setTerminalDensity(localStorage.getItem('macroscope.ui.density')||'compact');
  const rail=localStorage.getItem('macroscope.ui.rail')!=='0';setRailVisibility(rail);const rt=document.getElementById('toggle-rail');if(rt)rt.checked=rail;
  const boot=localStorage.getItem('macroscope.ui.boot')!=='0';const bt=document.getElementById('toggle-boot');if(bt)bt.checked=boot;
  if(localStorage.getItem('macroscope.ui.sidebarCompact')==='1')document.body.classList.add('sidebar-compact');
  setScenarioReasoning(localStorage.getItem('macroscope.ai.reasoning')||0);
}
function getScenarioReasoningEffort(){return ['low','medium','high'][Math.max(0,Math.min(2,+localStorage.getItem('macroscope.ai.reasoning')||0))]||'low'}
function setScenarioReasoning(raw){
  const v=Math.max(0,Math.min(2,Math.round(+raw||0))),names=['LOW · FAST','MEDIUM · BALANCED','HIGH · DEEP'],notes=['Fastest. Best for routine counterfactual construction and lowest token usage.','More reasoning for multi-channel scenarios. Uses a larger completion budget.','Deepest supported scenario reasoning. Slower and more token intensive; use for complex structural scenarios.'];
  localStorage.setItem('macroscope.ai.reasoning',String(v));const sl=document.getElementById('scenario-reasoning');if(sl)sl.value=String(v);const lab=document.getElementById('scenario-reasoning-label');if(lab)lab.textContent=names[v];const note=document.getElementById('scenario-reasoning-note');if(note)note.textContent=notes[v];
  updateAIContextMeter?.();
}

// ── TERMINAL BOOT ────────────────────────────────────────────────
function runBootSequence() {
  const screen = document.getElementById('boot-screen');
  const log = document.getElementById('boot-log');
  const ready = document.getElementById('boot-ready');
  if (!screen || !log || !ready) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seen = sessionStorage.getItem('macroscope_boot_seen') === '1' || localStorage.getItem('macroscope.ui.boot') === '0';
  const finish = () => {
    sessionStorage.setItem('macroscope_boot_seen','1');
    screen.classList.add('done');
    setTimeout(() => screen.remove(), 350);
  };
  screen.addEventListener('click', finish, {once:true});
  document.addEventListener('keydown', finish, {once:true});
  if (reduced || seen) { setTimeout(finish, 80); return; }
  const lines = [
    ['OK','INITIALIZING ECONOMIC ENGINE'],
    ['OK','RESTORING LOCAL SCENARIO STATE'],
    ['OK','LOADING STRUCTURAL PARAMETERS'],
    ['OK','CONNECTING LIVE DATA GATEWAY'],
    ['OK','CHECKING RELEASE CALENDAR VINTAGE'],
    ['OK','RENDERING ANALYTICS WORKSPACE']
  ];
  lines.forEach((line,i) => setTimeout(() => {
    const div = document.createElement('div');
    div.className = 'boot-line';
    div.style.animationDelay = '0ms';
    div.innerHTML = `<span class="boot-ok">[${line[0]}]</span> ${line[1]}`;
    log.appendChild(div);
    if (i === lines.length - 1) setTimeout(() => { ready.style.display = 'block'; setTimeout(finish, 650); }, 180);
  }, 150 + i * 190));
}


// ── V8.1 COMMAND CENTER CONSOLIDATION ───────────────────────────
const CC_WORKSPACES = {
  home:{label:'Home',icon:'⌂',desc:'Current economy and recent work',defaultSection:'overview',sections:['overview']},
  scenario:{label:'Scenario Lab',icon:'◬',desc:'Build and stress the economy',defaultSection:'events',sections:[...CATEGORIES.map(c=>c.id),'events','branches','sensitivity','calibrate']},
  data:{label:'Data',icon:'↻',desc:'Observed data and releases',defaultSection:'observed',sections:['observed','data-copilot','calendar','surprises','news']},
  markets:{label:'Markets',icon:'▥',desc:'Financial consequences',defaultSection:'portfolio',sections:['portfolio','charts','compare']},
  library:{label:'Library',icon:'◩',desc:'Saved research and scenarios',defaultSection:'scenarios',sections:['scenarios','history','analyst']}
};
const CC_SECTION_META = (()=>{
  const out={overview:{label:'Command Center',icon:'⌂'},events:{label:'Events & Shocks',icon:'◬'},branches:{label:'Scenario Tree',icon:'⑂'},sensitivity:{label:'Sensitivity Analysis',icon:'◧'},calibrate:{label:'2026 Q2 Calibration',icon:'◎'},observed:{label:'Official Data',icon:'◉'},'data-copilot':{label:'Data Copilot',icon:'↻'},calendar:{label:'Economic Calendar',icon:'▤'},surprises:{label:'Release Surprises',icon:'⇄'},news:{label:'News Intelligence',icon:'◒'},portfolio:{label:'Portfolio Lab',icon:'▦'},charts:{label:'Charts & Analysis',icon:'◫'},compare:{label:'Country Compare',icon:'◈'},scenarios:{label:'Saved Scenarios',icon:'◩'},history:{label:'Historical Scenarios',icon:'◑'},analyst:{label:'Ask MACROSCOPE',icon:'✦'}};
  CATEGORIES.forEach(c=>out[c.id]={label:c.label,icon:c.icon});
  return out;
})();
let ccWorkspace='home', ccPaletteIndex=0, ccPaletteItems=[];
function ccWorkspaceForSection(id){return Object.keys(CC_WORKSPACES).find(k=>CC_WORKSPACES[k].sections.includes(id))||'home'}
function ccSetWorkspace(key,navigate=true){
  const ws=CC_WORKSPACES[key]||CC_WORKSPACES.home;ccWorkspace=key;
  document.querySelectorAll('.cc-workspace-btn').forEach(b=>b.classList.toggle('active',b.dataset.workspace===key));
  const head=document.getElementById('cc-workspace-head');if(head)head.innerHTML=`<span>${ws.label}</span><span>${ws.sections.length}</span>`;
  ccRenderWorkspaceNav(key);
  if(navigate&&currentSection!==ws.defaultSection)showSection(ws.defaultSection,sectionButton(ws.defaultSection));
}
function ccRenderWorkspaceNav(key){
  const box=document.getElementById('cc-workspace-nav');if(!box)return;const ws=CC_WORKSPACES[key]||CC_WORKSPACES.home;
  let html='';
  if(key==='scenario') html+=`<div class="cc-sub-search"><input id="slider-search" type="text" placeholder="Search 70+ controls…" oninput="onSearch(this.value)" onkeydown="onSearchKey(event)"><div class="search-results" id="search-results"></div></div>`;
  html+=ws.sections.map(id=>{const m=CC_SECTION_META[id]||{label:id,icon:'•'};return `<button class="nav-item${id===currentSection?' active':''}" onclick="showSection('${id}',this)"><span class="nav-icon">${m.icon}</span>${m.label}</button>`}).join('');
  box.innerHTML=html;
}
function buildSidebar(){
  const primary=document.getElementById('cc-primary-nav');if(!primary)return;
  primary.innerHTML=Object.entries(CC_WORKSPACES).map(([k,w])=>`<button class="cc-workspace-btn${k===ccWorkspace?' active':''}" data-workspace="${k}" onclick="ccSetWorkspace('${k}',true)"><span class="cc-ws-icon">${w.icon}</span><span>${w.label}</span><small>${k==='home'?'LIVE':''}</small></button>`).join('');
  ccWorkspace=ccWorkspaceForSection(currentSection||'overview');ccSetWorkspace(ccWorkspace,false);
}
const ccLegacyShowSection=showSection;
showSection=function(id,btn){
  const wk=ccWorkspaceForSection(id);if(wk!==ccWorkspace){ccWorkspace=wk;document.querySelectorAll('.cc-workspace-btn').forEach(b=>b.classList.toggle('active',b.dataset.workspace===wk));ccRenderWorkspaceNav(wk);btn=sectionButton(id)||btn;}
  ccLegacyShowSection(id,btn);
  document.querySelectorAll('#cc-workspace-nav .nav-item').forEach(n=>n.classList.toggle('active',(n.getAttribute('onclick')||'').includes(`'${id}'`)));
};
const ccLegacyBuildContent=buildContent;
buildContent=function(){ccLegacyBuildContent();ccEnhanceHome();};
function ccEnhanceHome(){
  const shell=document.querySelector('#sec-overview .ov-shell');if(!shell||shell.querySelector('.cc-home-intro'))return;
  const recent=ccCommandHistory().slice(0,4);
  shell.insertAdjacentHTML('afterbegin',`<div class="cc-home-intro"><div class="cc-home-top"><div><div class="cc-home-kicker">MACROSCOPE COMMAND CENTER</div><div class="cc-home-title">What would you like to explore?</div><div class="cc-home-sub">Observe the live economy, build a counterfactual, inspect market effects, or ask MACROSCOPE from one workspace.</div></div><div class="cc-home-recent"><div class="cc-home-recent-title">RECENT COMMANDS</div><div class="cc-home-history">${recent.length?recent.map(x=>`<button onclick="openCommandCenter('${escapeAttr(x)}')">${escapeHtml(x)}</button>`).join(''):'<span style="font:8px var(--font-mono);color:var(--muted)">No command history yet.</span>'}</div></div></div><div class="cc-home-actions"><button class="cc-home-action" onclick="ccSetWorkspace('scenario',true)"><b>◬ Run a Scenario</b><span>Test a new economic path</span></button><button class="cc-home-action" onclick="showSection('observed',null)"><b>↻ Update Data</b><span>Review current official observations</span></button><button class="cc-home-action" onclick="showSection('events',null)"><b>✦ Analyze an Event</b><span>Stage a validated counterfactual</span></button><button class="cc-home-action" onclick="showSection('branches',null)"><b>⑂ Compare Scenarios</b><span>Inspect alternative paths</span></button></div></div>`);
}
function ccCreatePalette(){
  if(document.getElementById('cc-palette-backdrop'))return;
  document.body.insertAdjacentHTML('beforeend',`<div id="cc-palette-backdrop" class="cc-palette-backdrop" onclick="if(event.target===this)closeCommandCenter()"><div class="cc-palette" role="dialog" aria-modal="true" aria-label="MACROSCOPE Command Center"><div class="cc-palette-head"><span class="cc-command-icon">⌕</span><input id="cc-palette-input" autocomplete="off" placeholder="Navigate, ask a question, or stage a scenario…" oninput="commandCenterInputChanged(this.value,true)" onkeydown="commandCenterKeydown(event,true)"><kbd>ESC</kbd></div><div id="cc-palette-results" class="cc-palette-results"></div><div class="cc-palette-foot"><span>↑↓ Select</span><span>Enter Run</span><span>Scenario changes are staged for review</span></div></div></div>`);
}
function openCommandCenter(seed){
  ccCreatePalette();const back=document.getElementById('cc-palette-backdrop'),inp=document.getElementById('cc-palette-input');if(!back||!inp)return;back.classList.add('open');if(typeof seed==='string')inp.value=seed;const hdr=document.getElementById('command-center-input');if(hdr&&typeof seed==='string')hdr.value=seed;ccPaletteIndex=0;ccRenderCommandResults(inp.value);setTimeout(()=>{inp.focus();inp.select();},0);
}
function closeCommandCenter(){document.getElementById('cc-palette-backdrop')?.classList.remove('open');const h=document.getElementById('command-center-input');if(h)h.value='';}
function commandCenterInputChanged(v,fromPalette=false){if(!fromPalette&&document.activeElement?.id==='command-center-input'){openCommandCenter(v);return;}ccPaletteIndex=0;ccRenderCommandResults(v)}
function ccAllNavItems(){return Object.entries(CC_SECTION_META).map(([id,m])=>({kind:'section',id,title:m.label,icon:m.icon,workspace:ccWorkspaceForSection(id),sub:CC_WORKSPACES[ccWorkspaceForSection(id)].label}))}
function ccControlItems(q){
  if(!q||q.length<2)return[];const n=q.toLowerCase(),out=[];for(const c of CATEGORIES)for(const sl of c.sliders||[])if(`${sl.label} ${sl.id} ${c.label}`.toLowerCase().includes(n))out.push({kind:'control',id:sl.id,section:c.id,title:sl.label,icon:c.icon,workspace:'scenario',sub:c.label});return out.slice(0,8);
}
function ccQuickItems(){return[
 {kind:'quick',action:'scenario',title:'Build a scenario',icon:'◬',sub:'Stage an AI counterfactual; review required'},
 {kind:'quick',action:'data',title:'Bring MACROSCOPE current',icon:'↻',sub:'Retrieve official observations; review gated'},
 {kind:'quick',action:'ask',title:'Ask MACROSCOPE',icon:'✦',sub:'Explain the current model state'},
 {kind:'quick',action:'save',title:'Save current scenario',icon:'◩',sub:'Store the current simulator state'}
]}
function ccRenderCommandResults(query=''){
  const el=document.getElementById('cc-palette-results');if(!el)return;const q=String(query||'').trim().toLowerCase();let items=[];
  if(!q)items=[...ccQuickItems(),...ccAllNavItems().filter(x=>['overview','events','observed','portfolio','scenarios','analyst'].includes(x.id))];
  else {const nav=ccAllNavItems().filter(x=>`${x.title} ${x.sub} ${x.id}`.toLowerCase().includes(q));const controls=ccControlItems(q);items=[...controls,...nav].slice(0,12);items.push({kind:'prompt',title:`Run “${query}”`,icon:'↵',sub:ccPromptRouteLabel(query),query});}
  ccPaletteItems=items;ccPaletteIndex=Math.min(ccPaletteIndex,Math.max(0,items.length-1));
  const groups=[];for(const item of items){const g=item.kind==='control'?'Controls':item.kind==='section'?'Navigate':item.kind==='quick'?'Quick Actions':'MACROSCOPE';let group=groups.find(x=>x.name===g);if(!group){group={name:g,items:[]};groups.push(group)}group.items.push(item)}
  let globalIdx=0;el.innerHTML=groups.map(g=>`<div class="cc-result-group">${g.name}</div>${g.items.map(item=>{const idx=globalIdx++;return `<button class="cc-result${idx===ccPaletteIndex?' active':''}" data-cc-index="${idx}" onclick="ccExecuteResult(${idx})"><span class="cc-result-icon">${item.icon||'•'}</span><span><span class="cc-result-title">${escapeHtml(item.title)}</span><span class="cc-result-sub">${escapeHtml(item.sub||'')}</span></span><span class="cc-result-tag">${item.kind==='prompt'?'ENTER':(item.workspace||item.kind).toUpperCase()}</span></button>`}).join('')}`).join('');
}
function ccPromptRouteLabel(q){if(isCurrentDataResearchPrompt(q))return'Official-data request → Data Copilot review gate';if(ccLooksLikeScenarioPrompt(q))return'Scenario request → validated draft; nothing applies automatically';return'Question → Ask MACROSCOPE (read-only explanation)'}
function ccLooksLikeScenarioPrompt(q){return /^\s*(raise|lower|cut|increase|decrease|set|change|simulate|create|build|model|apply|what if|what happens if)\b/i.test(q)||/\b(counterfactual|scenario|shock)\b/i.test(q)}
function commandCenterKeydown(e,fromPalette=false){
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommandCenter(document.getElementById('command-center-input')?.value||'');return}
  if(e.key==='Escape'){e.preventDefault();closeCommandCenter();return}
  if(e.key==='ArrowDown'){e.preventDefault();ccPaletteIndex=Math.min(ccPaletteItems.length-1,ccPaletteIndex+1);ccRenderCommandResults(document.getElementById('cc-palette-input')?.value||'');document.querySelector('.cc-result.active')?.scrollIntoView({block:'nearest'});return}
  if(e.key==='ArrowUp'){e.preventDefault();ccPaletteIndex=Math.max(0,ccPaletteIndex-1);ccRenderCommandResults(document.getElementById('cc-palette-input')?.value||'');document.querySelector('.cc-result.active')?.scrollIntoView({block:'nearest'});return}
  if(e.key==='Enter'){e.preventDefault();if(!document.getElementById('cc-palette-backdrop')?.classList.contains('open')){openCommandCenter(e.target.value||'');return}ccExecuteResult(ccPaletteIndex)}
}
function ccExecuteResult(i){const item=ccPaletteItems[i];if(!item)return;
  if(item.kind==='section'){ccLogCommand(`Open ${item.title}`);closeCommandCenter();showSection(item.id,null);return}
  if(item.kind==='control'){ccLogCommand(`Open ${item.title}`);closeCommandCenter();showSection(item.section,null);setTimeout(()=>{const card=document.getElementById('card-'+item.id);card?.scrollIntoView({behavior:'smooth',block:'center'});card?.classList.add('cc-control-flash');setTimeout(()=>card?.classList.remove('cc-control-flash'),1400)},80);return}
  if(item.kind==='quick'){closeCommandCenter();if(item.action==='scenario')showSection('events',null);else if(item.action==='data')ccRunPrompt('Bring MACROSCOPE current using the latest official U.S. macro data.');else if(item.action==='ask')showSection('analyst',null);else if(item.action==='save')saveScenario();ccLogCommand(item.title);return}
  if(item.kind==='prompt'){closeCommandCenter();ccRunPrompt(item.query);return}
}
function ccRunPrompt(query){const q=String(query||'').trim();if(!q)return;ccLogCommand(q);
  if(isCurrentDataResearchPrompt(q)){showSection('data-copilot',null);setTimeout(()=>{const ta=document.getElementById('data-copilot-prompt');if(ta)ta.value=q;requestDataCopilotUpdate(q)},50);return}
  if(ccLooksLikeScenarioPrompt(q)){showSection('events',null);setTimeout(()=>{const ta=document.getElementById('ai-scenario-prompt');if(ta){ta.value=q;updateAIContextMeter();generateAIScenario();}},50);return}
  showSection('analyst',null);setTimeout(()=>{const ta=document.getElementById('analyst-prompt');if(ta){ta.value=q;askMacroscope();}},50);
}
function ccCommandHistory(){try{return JSON.parse(localStorage.getItem('macroscope.cc.history')||'[]')}catch(_){return[]}}
function ccLogCommand(q){const x=String(q||'').trim();if(!x)return;let h=ccCommandHistory().filter(v=>v!==x);h.unshift(x);h=h.slice(0,12);localStorage.setItem('macroscope.cc.history',JSON.stringify(h))}
function initCommandCenterUI(){
  ccCreatePalette();document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommandCenter('')}});
}


