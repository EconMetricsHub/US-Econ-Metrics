let aiScenarioDraft = null;
let lastAIScenarioRun = null;
let aiRegistry = null;
const SLIDER_REGISTRY_URL = 'data/slider-registry.json';
const AI_REGISTRY_VERSION = '2.0.0';
// Public default Worker endpoint. After deploying the Cloudflare Worker, paste its HTTPS URL here.
// Visitors can still override this per-browser in the AI Studio endpoint field.
const DEFAULT_AI_ENDPOINT = '';

function normalizeAIEndpoint(value) {
  const raw=String(value||'').trim();
  if(!raw)return '';
  try {
    const url=new URL(raw);
    if(url.hostname.endsWith('.workers.dev'))return `${url.protocol}//${url.host}`;
    return raw.replace(/\/+$/,'');
  } catch {
    return raw;
  }
}
function saveAIEndpoint(v) { localStorage.setItem('macroscope.ai.endpoint',normalizeAIEndpoint(v)); }
function renderMarkdownSafe(text) {
  const raw=String(text||'');
  if(!window.marked||!window.DOMPurify)return escapeHtml(raw).replace(/\n/g,'<br>');
  return DOMPurify.sanitize(marked.parse(raw));
}

function inferRegistryUnit(sl) {
  const label=String(sl?.label||'').toLowerCase();
  if (label.includes('(bps)')) return 'basis_points';
  if (label.includes('($/bbl)')) return 'usd_per_barrel';
  if (label.includes('($/mmbtu)')) return 'usd_per_mmbtu';
  if (label.includes('($/hr)')) return 'usd_per_hour';
  if (label.includes('(%')) return 'percent';
  if (+sl?.min===1 && +sl?.max===10) return 'index_points';
  return 'model_units';
}

function runtimeRegistryFallback() {
  const sliders={};
  for (const cat of CATEGORIES) for (const sl of cat.sliders) sliders[sl.id]={
    id:sl.id,label:sl.label,description:sl.desc,variable:sl.id,unit:inferRegistryUnit(sl),
    minimum:sl.min,maximum:sl.max,step:sl.step,defaultValue:DEFAULTS[sl.id],
    regionAvailability:['us','eu','uk','jp','cn','em'],allowedOperations:['set','increase','decrease'],
    economicMeaning:sl.desc,downstreamEffects:[],source:'MACROSCOPE local simulator model',version:AI_REGISTRY_VERSION
  };
  const fallbackRanges={gdpA:[-5,5],cpiA:[-5,10],spA:[-50,50],ffr:[-5,5],oil:[-100,100],natgas:[-15,15],tariff:[-30,50],shippingCost:[-8,8],unemp:[-5,10],lfp:[-10,10],innovRate:[-2,2],aiAdoption:[-5,5],privateCapex:[-10,10],housingSupply:[-1.5,1.5],deficit:[-10,10],govSpend:[-10,10],igSpreads:[-300,1000],hySpreads:[-800,2000],creditImpulse:[-5,5],termPremium:[-200,300],foreignDemand:[-5,5],dxy:[-30,30],policyCert:[-5,5],ruleOfLaw:[-5,5],conflictIndex:[-5,5],commercialREStress:[-5,5],gridReliability:[-5,5],nearshoring:[-5,5]};
  const shockTargets={};
  for (const id of CUSTOM_SHOCK_TARGETS) { const r=fallbackRanges[id]||[-10,10]; shockTargets[id]={id,label:shockTargetLabel(id),minimum:r[0],maximum:r[1],unit:'model_units',economicMeaning:`Structured shock channel for ${shockTargetLabel(id)}.`,allowedOperations:['set'],regionAvailability:['us','eu','uk','jp','cn','em'],version:AI_REGISTRY_VERSION}; }
  return {registryVersion:AI_REGISTRY_VERSION,sliders,shockTargets,settings:{taylor_rule_enabled:{id:'taylor_rule_enabled',allowedValues:[false,true],version:AI_REGISTRY_VERSION}}};
}

async function loadSliderRegistry(force=false) {
  if (aiRegistry && !force) return aiRegistry;
  try {
    const r=await fetch(SLIDER_REGISTRY_URL+'?v='+AI_REGISTRY_VERSION,{cache:'no-store'});
    if (!r.ok) throw new Error('HTTP '+r.status);
    const data=await r.json();
    if (!data?.sliders || !data?.shockTargets) throw new Error('Registry structure invalid');
    const uiIds=CATEGORIES.flatMap(c=>c.sliders.map(x=>x.id));
    const missing=uiIds.filter(id=>!data.sliders[id]);
    if (missing.length) throw new Error(`Registry missing ${missing.slice(0,5).join(', ')}`);
    aiRegistry=data;
  } catch(e) {
    console.warn('Using in-page AI registry fallback:',e);
    aiRegistry=runtimeRegistryFallback();
  }
  return aiRegistry;
}

function scenarioRelevantSliderDefs(registry,prompt='') {
  const all=Object.values(registry.sliders||{}).filter(x=>(x.regionAvailability||[]).includes(currentCountry));
  const q=String(prompt||'').toLowerCase();
  const words=[...new Set((q.match(/[a-z][a-z0-9-]{3,}/g)||[]).filter(w=>!['that','with','from','this','into','over','than','current','using','model','assume','effects','effect','scenario','economic'].includes(w)))];
  const always=new Set(['ffr','unemp','lfp','oil','natgas','privateCapex','housingSupply','deficit','govSpend','termPremium','dxy','creditImpulse','policyCert','conflictIndex','foreignDemand','aiAdoption','innovRate']);
  const themeIds={
    energy:['oil','natgas','lngExport','oilConflict','spr','energyGeopolitics','shippingCost','gridReliability'],
    iran:['oil','oilConflict','energyGeopolitics','conflictIndex','shippingCost','allyRelations','foreignDemand','dxy'],
    hormuz:['oil','oilConflict','energyGeopolitics','shippingCost','conflictIndex'],
    inflation:['ffr','oil','natgas','shippingCost','tariff','wageGrowth','productivity','creditImpulse'],
    fed:['ffr','iorb','termPremium','creditImpulse','igSpreads','hySpreads'],
    rates:['ffr','termPremium','creditImpulse','igSpreads','hySpreads'],
    housing:['housingSupply','zoning','localPermitState','housingAct','ffr','constructionCost'],
    labor:['unemp','lfp','wageGrowth','highSkillImmig','interstateMigration'],
    immigration:['lfp','highSkillImmig','unemp','wageGrowth'],
    productivity:['aiAdoption','innovRate','rdSpend','privateCapex','vcFunding'],
    ai:['aiAdoption','innovRate','rdSpend','privateCapex','vcFunding'],
    fiscal:['deficit','govSpend','corpTax','persTax','debtGDP'],
    china:['foreignDemand','dxy','tariff','chinaMilRisk','shippingCost'],
    trade:['tariff','foreignDemand','dxy','shippingCost','nearshoring','fdiInflows'],
    geopolit:['conflictIndex','energyGeopolitics','allyRelations','chinaMilRisk','natoCommit','dollarReserve'],
    sanctions:['foreignDemand','dxy','oil','shippingCost','conflictIndex','policyCert']
  };
  const boost=new Set(always);
  for(const [theme,ids] of Object.entries(themeIds))if(q.includes(theme))for(const id of ids)boost.add(id);
  const scored=all.map(x=>{
    const hay=`${x.id} ${getCountryLabel(x.id)||x.label||''} ${x.economicMeaning||x.description||''}`.toLowerCase();
    let score=boost.has(x.id)?20:0;
    for(const w of words)if(hay.includes(w))score+=3;
    return {x,score};
  }).sort((a,b)=>b.score-a.score || String(a.x.label).localeCompare(String(b.x.label)));
  const picked=scored.filter(z=>z.score>0).slice(0,30).map(z=>z.x);
  if(picked.length<22) for(const z of scored){if(picked.length>=22)break;if(!picked.includes(z.x))picked.push(z.x);}
  return picked;
}

function compactRegistryPayload(registry,prompt='') {
  const sliders=scenarioRelevantSliderDefs(registry,prompt).map(x=>({
    id:x.id,label:getCountryLabel(x.id)||x.label,unit:x.unit,min:+x.minimum,max:+x.maximum,step:+x.step||1,
    cur:+vals[x.id],ops:x.allowedOperations||['set','increase','decrease']
  }));
  const shockTargets=Object.values(registry.shockTargets||{}).filter(x=>(x.regionAvailability||[]).includes(currentCountry)).map(x=>({
    id:x.id,label:x.label,unit:x.unit,min:+x.minimum,max:+x.maximum
  }));
  return {sliders,shockTargets};
}

async function aiContextPayload(prompt='') {
  const m=compute();
  const registry=await loadSliderRegistry();
  const compact=compactRegistryPayload(registry,prompt);
  return {
    registryVersion:registry.registryVersion||AI_REGISTRY_VERSION,
    country:currentCountry,
    horizonYears:timeHorizon,
    month:shockProjectionMonth,
    taylorRule:taylorRuleOn,
    aiOptions:{reasoningEffort:getScenarioReasoningEffort()},
    metrics:{gdp:+m.gdp.toFixed(3),cpi:+m.cpi.toFixed(3),unemp:+m.unemp.toFixed(2),ffr:+(m.taylorFFR??vals.ffr).toFixed(2),tenyr:+m.tenyr.toFixed(2),mortgage:+m.mortg.toFixed(2),recession:+m.recessionRisk.toFixed(1),sp500:+m.sp500.toFixed(1)},
    sliderRegistry:compact.sliders,
    shockTargets:compact.shockTargets,
    activeShocks:Object.keys(activeEventIds).map(id=>findShock(id)?.label).filter(Boolean).slice(0,8)
  };
}

function estimateScenarioRequestTokens(prompt,context){
  const payloadChars=String(prompt||'').length+JSON.stringify(context||{}).length;
  return Math.ceil(payloadChars/4)+850; // rough reserve for system prompt + structured schema
}

function snapToStep(v,def) {
  const min=+def.minimum, max=+def.maximum, step=Math.max(1e-9,+def.step||1);
  let x=Math.max(min,Math.min(max,+v));
  x=min+Math.round((x-min)/step)*step;
  const decimals=(String(step).split('.')[1]||'').length;
  return +Math.max(min,Math.min(max,x)).toFixed(Math.min(decimals+2,8));
}

function validateAIScenarioCommand(d) {
  if (!d || typeof d!=='object') throw new Error('Response did not contain a scenario command');
  const registry=aiRegistry||runtimeRegistryFallback();
  if (d.region && d.region!==currentCountry) throw new Error(`AI returned region ${d.region}; current simulator region is ${currentCountry}`);
  const changes=[];
  for (const c of (Array.isArray(d.sliderChanges)?d.sliderChanges:[]).slice(0,12)) {
    const def=registry.sliders?.[c.id];
    if (!def || !(def.regionAvailability||[]).includes(currentCountry)) continue;
    const op=(def.allowedOperations||[]).includes(c.operation)?c.operation:'set';
    const raw=+c.value; if(!Number.isFinite(raw)) continue;
    const delta=Math.abs(raw);
    const proposed=op==='set'?raw:op==='increase'?(+vals[c.id]+delta):(+vals[c.id]-delta);
    const finalValue=snapToStep(Number.isFinite(+c.finalValue)?+c.finalValue:proposed,def);
    changes.push({id:c.id,operation:op,value:op==='set'?finalValue:delta,finalValue,reason:String(c.reason||'').slice(0,500)});
  }
  const rawShock=d.shock||{};
  const channels=(Array.isArray(rawShock.channels)?rawShock.channels:[]).filter(c=>registry.shockTargets?.[c.target]&&Number.isFinite(+c.effect)).slice(0,5).map(c=>{
    const def=registry.shockTargets[c.target];
    return {target:c.target,effect:Math.max(+def.minimum,Math.min(+def.maximum,+c.effect)),lagMonths:Math.max(0,Math.min(60,Math.round(+c.lagMonths||0))),peakMonth:Math.max(1,Math.min(120,Math.round(+c.peakMonth||1)))};
  }).filter(c=>Math.abs(c.effect)>1e-12);
  const type=['temporary','persistent','structural'].includes(rawShock.shockType)?rawShock.shockType:'persistent';
  const shock={enabled:!!rawShock.enabled&&channels.length>0,label:String(rawShock.label||d.scenarioName||'AI scenario shock').slice(0,120),category:String(rawShock.category||'Custom').slice(0,40),shockType:type,durationMonths:Math.max(1,Math.min(240,Math.round(+rawShock.durationMonths||SHOCK_TYPE_DEFAULTS[type].durationMonths))),peakMonth:Math.max(1,Math.min(120,Math.round(+rawShock.peakMonth||SHOCK_TYPE_DEFAULTS[type].peakMonth))),decayRate:Math.max(0,Math.min(1,+rawShock.decayRate||0)),confidence:Math.max(.05,Math.min(1,+rawShock.confidence||.6)),magnitude:Math.max(.05,Math.min(3,+rawShock.magnitude||1)),rationale:String(rawShock.rationale||'').slice(0,1200),assumptions:Array.isArray(rawShock.assumptions)?rawShock.assumptions.slice(0,6).map(String):[],channels};
  const tr=d.settings?.taylorRule||{};
  const settings={taylorRule:{apply:!!tr.apply,enabled:!!tr.enabled,reason:String(tr.reason||'').slice(0,500)}};
  if(!changes.length&&!shock.enabled&&!settings.taylorRule.apply) throw new Error('AI returned no applicable simulator changes');
  return {registryVersion:String(d.registryVersion||registry.registryVersion||AI_REGISTRY_VERSION),scenarioName:String(d.scenarioName||'AI counterfactual').slice(0,120),region:currentCountry,confidence:Math.max(.05,Math.min(1,+d.confidence||.6)),rationale:String(d.rationale||'').slice(0,1500),assumptions:Array.isArray(d.assumptions)?d.assumptions.slice(0,8).map(String):[],sliderChanges:changes,settings,shock};
}

function aiModelSnapshot() {
  const m=compute(), pa=portfolioAnalytics(m);
  return {gdp:+m.gdp.toFixed(3),cpi:+m.cpi.toFixed(3),unemployment:+m.unemp.toFixed(3),policyRate:+(m.taylorFFR??vals.ffr).toFixed(3),tenYear:+m.tenyr.toFixed(3),mortgage:+m.mortg.toFixed(3),sp500Index:+m.sp500.toFixed(2),recessionRisk:+m.recessionRisk.toFixed(2),financialStability:+m.fsi.toFixed(2),consumerConfidence:+m.conf.toFixed(2),portfolioReturn:+pa.scenarioReturn.toFixed(3)};
}

function aiDelta(before,after) { const out={}; for(const k of Object.keys(after)) if(Number.isFinite(+before[k])&&Number.isFinite(+after[k])) out[k]=+(after[k]-before[k]).toFixed(3); return out; }

function withTemporaryAICommand(command,fn) {
  const savedVals=vals, savedTR=taylorRuleOn, savedActive=activeEventIds, savedSel=selectedShockId;
  const tempId='__ai_preview__'; let added=false;
  vals={...vals};
  for(const c of command.sliderChanges) vals[c.id]=c.finalValue;
  if(command.settings?.taylorRule?.apply) taylorRuleOn=command.settings.taylorRule.enabled;
  activeEventIds=JSON.parse(JSON.stringify(activeEventIds));
  if(command.shock?.enabled){
    const sh=command.shock; const ev=enrichEventDefinition({id:tempId,label:sh.label,cat:sh.category,pos:true,shockType:sh.shockType,durationMonths:sh.durationMonths,peakMonth:sh.peakMonth,decayRate:sh.decayRate,confidence:sh.confidence,channels:sh.channels,chips:[]});
    EVENTS.push(ev); added=true; activeEventIds[tempId]={...defaultShockConfig(ev),magnitude:sh.magnitude}; selectedShockId=tempId;
  }
  try{return fn();}
  finally{vals=savedVals;taylorRuleOn=savedTR;activeEventIds=savedActive;selectedShockId=savedSel;if(added){const i=EVENTS.findIndex(x=>x.id===tempId);if(i>=0)EVENTS.splice(i,1);}}
}

function previewAIScenarioCommand(command) {
  const before=aiModelSnapshot();
  const after=withTemporaryAICommand(command,()=>aiModelSnapshot());
  return {before,after,delta:aiDelta(before,after)};
}

function formatAIScenarioCommand(command,preview) {
  const registry=aiRegistry||runtimeRegistryFallback();
  const lines=[`${command.scenarioName} · confidence ${Math.round(command.confidence*100)}%`,`Registry ${command.registryVersion} · ${(COUNTRY_CONFIGS[currentCountry]||COUNTRY_CONFIGS.us).name}`,''];
  if(command.sliderChanges.length){ lines.push('SLIDER CHANGES'); for(const c of command.sliderChanges){const def=registry.sliders?.[c.id];lines.push(`• ${def?.label||c.id}: ${(+vals[c.id]).toFixed(3)} → ${c.finalValue} (${c.operation}) — ${c.reason}`);} lines.push(''); }
  if(command.settings.taylorRule.apply){lines.push(`SETTING · Taylor Rule → ${command.settings.taylorRule.enabled?'ON':'OFF'} — ${command.settings.taylorRule.reason}`,'');}
  if(command.shock.enabled){lines.push(`TIME-DEPENDENT SHOCK · ${command.shock.label} · ${command.shock.shockType} · ${command.shock.durationMonths} months`);for(const c of command.shock.channels)lines.push(`• ${shockTargetLabel(c.target)} ${formatShockEffect(c.target,c.effect)} · lag ${c.lagMonths}mo · peak M${c.peakMonth}`);lines.push('');}
  lines.push('MODEL PREVIEW AT CURRENT EVALUATION MONTH');
  for(const k of ['gdp','cpi','unemployment','policyRate','tenYear','mortgage','sp500Index','recessionRisk','portfolioReturn']){const b=preview.before[k],a=preview.after[k],d=preview.delta[k];lines.push(`• ${k}: ${b} → ${a} (${d>=0?'+':''}${d})`);}
  if(command.assumptions.length)lines.push('',`ASSUMPTIONS · ${command.assumptions.join(' | ')}`);
  if(command.rationale)lines.push('',`RATIONALE · ${command.rationale}`);
  return lines.join('\n');
}

function updateAIContextMeter(){
  const el=document.getElementById('ai-context-meter'),ta=document.getElementById('ai-scenario-prompt');
  if(!el||!ta)return;
  const promptTokens=Math.ceil((ta.value||'').length/4);
  el.textContent=`Prompt ~${promptTokens.toLocaleString()} tokens · lean registry · server-validated JSON`;
}

function clearAIScenarioDraft() {
  aiScenarioDraft=null;
  const r=document.getElementById('ai-scenario-result'); if(r)r.textContent='No AI command yet. The manual structured-shock builder remains available below.';
  const b=document.getElementById('ai-run-btn'); if(b)b.disabled=true;
  const st=document.getElementById('ai-scenario-status'); if(st)st.textContent='REGISTRY '+AI_REGISTRY_VERSION;
}

async function generateAIScenario() {
  const prompt=document.getElementById('ai-scenario-prompt')?.value.trim();
  const endpoint=normalizeAIEndpoint(document.getElementById('ai-scenario-endpoint')?.value||localStorage.getItem('macroscope.ai.endpoint')||DEFAULT_AI_ENDPOINT||'');
  const st=document.getElementById('ai-scenario-status'), out=document.getElementById('ai-scenario-result'), btn=document.getElementById('ai-run-btn');
  if(!prompt){toast('Describe a counterfactual or paste economic news first');return;}
  if(!endpoint){if(st)st.textContent='ADD ENDPOINT';toast('Add the Cloudflare Worker URL');return;}
  saveAIEndpoint(endpoint); const endpointField=document.getElementById('ai-scenario-endpoint'); if(endpointField)endpointField.value=endpoint; if(st)st.textContent='INTERPRETING…'; if(out)out.textContent='Loading registry and converting the question into validated simulator controls…'; if(btn)btn.disabled=true;
  try{
    await loadSliderRegistry();
    const context=await aiContextPayload(prompt);
    const est=estimateScenarioRequestTokens(prompt,context);
    if(st)st.textContent=`LEAN CONTEXT · ~${(est/1000).toFixed(1)}K TOKENS`;
    if(est>6800)throw new Error(`Scenario request is still too large (~${est} tokens). Shorten the prompt or split the scenario.`);
    const resp=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'scenario',prompt,context})});
    const payload=await resp.json().catch(()=>({}));
    if(!resp.ok)throw new Error(payload.error||`AI endpoint HTTP ${resp.status}`);
    aiScenarioDraft=validateAIScenarioCommand(payload.command||payload);
    const preview=previewAIScenarioCommand(aiScenarioDraft);
    if(out)out.textContent=formatAIScenarioCommand(aiScenarioDraft,preview);
    if(btn)btn.disabled=false; if(st)st.textContent=`VALIDATED · ${getScenarioReasoningEffort().toUpperCase()} · REVIEW REQUIRED`;
  }catch(err){aiScenarioDraft=null;if(out)out.textContent='Scenario interpretation failed: '+(err.message||err);if(st)st.textContent='ERROR';}
}

function injectAIScenarioShock(sh) {
  if(!sh?.enabled)return null;
  const id='ai_'+(++customEventCount)+'_'+Date.now().toString(36);
  const gdp=sh.channels.find(c=>c.target==='gdpA')?.effect||0,cpi=sh.channels.find(c=>c.target==='cpiA')?.effect||0,sp=sh.channels.find(c=>c.target==='spA')?.effect||0;
  const directional=gdp||sp/10||-cpi;
  const ev=enrichEventDefinition({id,label:sh.label,cat:sh.category,pos:directional>=0,shockType:sh.shockType,durationMonths:sh.durationMonths,peakMonth:sh.peakMonth,decayRate:sh.decayRate,confidence:sh.confidence,channels:sh.channels,chips:sh.channels.slice(0,3).map(c=>`${shockTargetLabel(c.target)} ${formatShockEffect(c.target,c.effect)}`)});
  EVENTS.push(ev); activeEventIds[id]={...defaultShockConfig(ev),magnitude:sh.magnitude}; selectedShockId=id;
  const grid=document.getElementById(ev.pos?'positive-shock-grid':'negative-shock-grid'); if(grid)grid.insertAdjacentHTML('beforeend',buildEventCard(ev));
  return id;
}

async function runAIScenarioDraft() {
  const command=aiScenarioDraft; if(!command)return;
  const out=document.getElementById('ai-scenario-result'),st=document.getElementById('ai-scenario-status');
  const endpoint=normalizeAIEndpoint(document.getElementById('ai-scenario-endpoint')?.value||localStorage.getItem('macroscope.ai.endpoint')||DEFAULT_AI_ENDPOINT||'');
  const before=aiModelSnapshot();
  for(const c of command.sliderChanges)vals[c.id]=c.finalValue;
  if(command.settings.taylorRule.apply)taylorRuleOn=command.settings.taylorRule.enabled;
  injectAIScenarioShock(command.shock);
  syncSliderDomFromVals(); syncTaylorRuleUi(); render(); renderEventLog(); commitChange();
  const after=aiModelSnapshot();
  const run={command,before,after,delta:aiDelta(before,after),executedAt:new Date().toISOString(),evaluationMonth:shockProjectionMonth}; lastAIScenarioRun=run;
  if(out)out.textContent=`SCENARIO EXECUTED\n${formatAIScenarioCommand(command,{before,after,delta:run.delta})}\n\nAI EXPLANATION\nGenerating explanation from simulator outputs…`;
  if(st)st.textContent='SCENARIO RUN · EXPLAINING…';
  if(!endpoint){if(st)st.textContent='SCENARIO RUN';return;}
  try{
    const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'analyst',prompt:'Explain the baseline-to-counterfactual result. Identify the strongest causal channels, countervailing forces, and assumptions. Do not introduce facts that are not in the supplied context.',context:{model:'MACROSCOPE v8.0 counterfactual',country:currentCountry,evaluationMonth:shockProjectionMonth,command,before,after,delta:run.delta,currentState:analystContextPayload()}})});
    const data=await r.json().catch(()=>({})); if(!r.ok)throw new Error(data.error||`AI endpoint HTTP ${r.status}`);
    const answer=String(data.answer||'').trim(); if(!answer)throw new Error('Empty analyst response');
    if(out)out.textContent=`SCENARIO EXECUTED\n${formatAIScenarioCommand(command,{before,after,delta:run.delta})}\n\nAI EXPLANATION\n${answer}`;
    if(st)st.textContent='SCENARIO RUN · GROUNDED EXPLANATION';
  }catch(e){if(out)out.textContent+=`\n\nExplanation request failed: ${e.message||e}`;if(st)st.textContent='SCENARIO RUN · EXPLANATION FAILED';}
}

