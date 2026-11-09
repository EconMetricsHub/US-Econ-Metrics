/* News UI: ingestion never changes model state; review -> preview -> apply does. */
let newsSnapshot=null, newsCategory='all', newsOrigin='all', newsLoading=false;
let newsGroups=[], localNewsItem=null, localNewsPreview=null;
function escapeAttr(v){return escapeHtml(v).replace(/`/g,'&#96;');}
function buildNewsSection(){return `<div class="section" id="sec-news">
  <div class="sec-hdr"><div class="sec-title">News Intelligence</div><div class="sec-desc">Official releases and economic reporting, collected without an API key. Related stories share one event assumption.</div></div>
  <div class="annotation">News provides context, not measured economic observations. Suggested coefficients are scenario priors. Preview the actual model response before applying an assumption. Official-data release surprises remain separate: avoid applying the same information twice.</div>
  <div class="news-toolbar"><div class="news-tabs">
    ${[['all','All'],['economy','Economy'],['politics','U.S. Politics'],['geopolitics','Geopolitics']].map(([id,label])=>`<button class="news-tab ${id===newsCategory?'active':''}" data-cat="${id}" onclick="setNewsCategory('${id}',this)">${label}</button>`).join('')}
    </div><label>Sources <select id="news-origin" onchange="newsOrigin=this.value;renderNewsFeed()"><option value="all">All sources</option><option value="official">Official releases</option><option value="media">Media and user context</option></select></label></div>
  <p class="news-meta-line" id="news-meta">Open the feed to check sources.</p>
  <details class="news-source-health"><summary>Source health and freshness</summary><div id="news-source-health"></div></details>
  <div class="news-toolbar"><button class="btn" onclick="loadNewsFeed(true)">Refresh news</button><label class="btn">Import JSON / RSS / Atom <input id="news-import" type="file" accept=".json,.xml,.rss,.atom,application/json,application/xml,text/xml" onchange="importLocalNews(this)"></label></div>
  <div class="news-toolbar"><input id="manual-news-title" aria-label="Headline" placeholder="Paste a headline" maxlength="500"><input id="manual-news-url" aria-label="Source URL" placeholder="https://source.example/article" type="url"><button class="btn" onclick="addManualNews()">Add headline</button></div>
  <div id="local-news-review" class="annotation" hidden>
    <b id="local-news-title"></b><p id="local-news-context"></p>
    <p>Full-strength effects in percentage points. Temporary shock, 100% magnitude, low confidence (0.35), one-month channel lag, peak at month 3 or earlier, decay 0.25. Change advanced timing later in Events &amp; Shocks.</p>
    <div class="news-review-controls">
      <label>Assumption <select id="local-news-preset" onchange="setLocalNewsPreset()">${Object.entries(NewsClient.presets).map(([id,p])=>`<option value="${id}">${p.label}</option>`).join('')}</select></label>
      <label>GDP growth (pp)<input id="local-news-gdp" type="number" min="-1" max="1" step="0.05" oninput="invalidateNewsPreview()"></label>
      <label>CPI inflation (pp)<input id="local-news-cpi" type="number" min="-1" max="1" step="0.05" oninput="invalidateNewsPreview()"></label>
      <label>Duration (months)<input id="local-news-duration" type="number" min="1" max="24" step="1" oninput="invalidateNewsPreview()"></label>
      <label>Replace an existing event (optional)<select id="local-news-existing" onchange="invalidateNewsPreview()"><option value="">Automatic event matching</option></select></label>
    </div>
    <button class="btn" onclick="previewLocalNews()">Preview model change</button>
    <button class="btn primary" id="local-news-apply" onclick="applyLocalNews()" disabled>Apply previewed assumption</button>
    <button class="btn" onclick="document.getElementById('local-news-review').hidden=true">Close</button>
    <div id="local-news-preview"></div><p id="local-news-status" role="status"></p>
  </div>
  <div class="news-ledger"><div class="cal-grp-title">News assumption ledger</div><p>Source context, active effects and timing for this scenario. Save a scenario or export JSON to preserve it.</p><div id="news-ledger"></div></div>
  <div class="news-grid" id="news-grid"><div class="news-empty">Loading news…</div></div>
</div>`;}
async function loadNewsFeed(force=false){
  const grid=document.getElementById('news-grid');if(!grid)return;
  renderNewsLedger();
  if(newsLoading)return;
  if(newsSnapshot&&!force){renderNewsFeed();return;}
  newsLoading=true;grid.innerHTML='<div class="news-empty">Checking official releases and economic reporting…</div>';
  try{newsSnapshot=await NewsClient.load({force});renderNewsFeed();}
  catch(err){grid.textContent='Unable to load news: '+err.message;}
  finally{newsLoading=false;}
}
function visibleNewsGroups(){return newsGroups.filter(x=>(newsCategory==='all'||x.items.some(a=>a.category===newsCategory))&&(newsOrigin==='all'||(newsOrigin==='official'?x.items.some(a=>a.official):x.items.some(a=>!a.official))));}
function setNewsCategory(cat,btn){newsCategory=cat;document.querySelectorAll('.news-tab').forEach(x=>x.classList.remove('active'));btn?.classList.add('active');renderNewsFeed();}
function renderNewsFeed(){
  const grid=document.getElementById('news-grid'),meta=document.getElementById('news-meta');if(!grid||!newsSnapshot)return;
  newsGroups=NewsEvents.group(NewsClient.normalizeItems(newsSnapshot.items));
  const groups=visibleNewsGroups();
  if(meta)meta.textContent=`${String(newsSnapshot.mode||'saved').toUpperCase()} · ${groups.length} EVENTS / ${newsSnapshot.items.length} ARTICLES · checked ${newsSnapshot.checkedAt||'unknown'}${newsSnapshot.warning?' · '+newsSnapshot.warning:''}`;
  const origin=document.getElementById('news-origin');if(origin)origin.value=newsOrigin;
  renderNewsSourceHealth();renderNewsLedger();
  if(!groups.length){grid.innerHTML='<div class="news-empty">No articles in this filter. Try another source filter, import a feed, or add a headline.</div>';return;}
  grid.innerHTML=groups.slice(0,60).map((x,i)=>`<article class="news-card">
    <div class="news-card-top"><span class="news-cat">${x.official?'OFFICIAL RELEASE':escapeHtml(x.category)}</span><span class="news-time">${escapeHtml(formatNewsTime(x.publishedAt))}</span></div>
    <div class="news-title">${escapeHtml(x.title)}</div><div class="news-source">${escapeHtml(x.source||x.domain)} · ${x.articleCount} linked article${x.articleCount===1?'':'s'}</div>
    ${x.articleCount>1?`<details><summary>Related reporting</summary>${x.items.map(a=>`<p><a href="${escapeAttr(a.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a> · ${escapeHtml(a.domain)}</p>`).join('')}</details>`:''}
    <div class="news-actions"><a class="btn" href="${escapeAttr(x.url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a><button class="btn primary" onclick="reviewLocalNews(${i})">Review local model effect</button><button class="btn" onclick="modelNewsAsShock(${i})">Optional AI scenario</button></div>
  </article>`).join('');
}
function renderNewsSourceHealth(){
  const el=document.getElementById('news-source-health');if(!el)return;
  const direct=Object.entries(newsSnapshot?.sourceStatus||{}),saved=Object.entries(newsSnapshot?.snapshotStatus||{});
  const rows=(entries,label)=>entries.map(([id,s])=>`<tr><td>${escapeHtml(s.name||id)} (${label})</td><td>${s.ok?'Available':'Unavailable'}${s.fallback?' / saved content':''}</td><td>${escapeHtml(s.count??0)}</td><td>${escapeHtml(s.lastSuccess||s.checkedAt||'unknown')}</td><td>${escapeHtml(s.error||'')}</td></tr>`).join('');
  el.innerHTML=direct.length||saved.length?`<div class="news-table-wrap"><table class="news-table"><thead><tr><th>Source</th><th>Last check</th><th>Articles</th><th>Checked / last success</th><th>Detail</th></tr></thead><tbody>${rows(direct,'browser')}${rows(saved,'collector')}</tbody></table></div>`:'No source check metadata is available for imported or manually added articles.';
}
function formatNewsTime(v){if(!v)return 'Date unknown';const d=new Date(v);if(!Number.isFinite(d.getTime()))return 'Date unknown';const mins=Math.round((Date.now()-d.getTime())/60000);if(mins<0)return d.toLocaleString();if(mins<60)return `${mins}m ago`;if(mins<1440)return `${Math.floor(mins/60)}h ago`;return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});}
function newsLedgerEvents(){return EVENTS.filter(e=>e.provenance&&(e.provenance.kind==='news'||e.id.startsWith('custom_news_')));}
function reviewLocalNews(index){const item=visibleNewsGroups()[index];if(item)openNewsReview(item);}
function openNewsReview(item,existing=null){
  localNewsItem=item;
  document.getElementById('local-news-title').textContent=item.title;
  document.getElementById('local-news-context').textContent=`${item.items?.length||1} source article(s). Related or manually linked events replace an earlier assumption instead of adding another shock.`;
  const sel=document.getElementById('local-news-existing');sel.innerHTML='<option value="">Automatic event matching</option>'+newsLedgerEvents().map(e=>`<option value="${escapeAttr(e.id)}">${escapeHtml(e.label)}</option>`).join('');
  if(existing)sel.value=existing.id;
  document.getElementById('local-news-preset').value=existing?.provenance?.preset||NewsClient.suggest(item);
  setLocalNewsPreset();
  if(existing){document.getElementById('local-news-gdp').value=existing.channels.find(c=>c.target==='gdpA')?.effect||0;document.getElementById('local-news-cpi').value=existing.channels.find(c=>c.target==='cpiA')?.effect||0;document.getElementById('local-news-duration').value=activeEventIds[existing.id]?.durationMonths||existing.durationMonths;}
  document.getElementById('local-news-review').hidden=false;
  document.getElementById('local-news-review').scrollIntoView({behavior:'smooth',block:'center'});
}
function setLocalNewsPreset(){const p=NewsClient.presets[document.getElementById('local-news-preset').value]||NewsClient.presets.manual;document.getElementById('local-news-gdp').value=p.gdp;document.getElementById('local-news-cpi').value=p.cpi;document.getElementById('local-news-duration').value=6;invalidateNewsPreview();}
function invalidateNewsPreview(){localNewsPreview=null;const b=document.getElementById('local-news-apply');if(b)b.disabled=true;const out=document.getElementById('local-news-preview');if(out)out.innerHTML='';const s=document.getElementById('local-news-status');if(s)s.textContent='Preview required. No changes applied.';}
function readLocalNewsValues(){return {gdp:document.getElementById('local-news-gdp').value,cpi:document.getElementById('local-news-cpi').value,duration:document.getElementById('local-news-duration').value,preset:document.getElementById('local-news-preset').value};}
function reviewedNewsEvent(){
  if(!localNewsItem)throw new Error('Choose an event first.');
  const existing=findShock(document.getElementById('local-news-existing').value);
  if(!existing?.provenance)return localNewsItem;
  return {...localNewsItem,eventId:existing.provenance.eventId||localNewsItem.eventId,
    items:[...(localNewsItem.items||[localNewsItem]),...(existing.provenance.articles||[existing.provenance])]};
}
function previewLocalNews(){
  try{
    const event=reviewedNewsEvent(),values=readLocalNewsValues(),p=NewsScenario.preview(event,values);
    localNewsPreview={...p,fingerprint:NewsScenario.fingerprint(),eventKey:JSON.stringify(event),valuesKey:JSON.stringify(values)};
    const rows=[['gdp','GDP growth','%','pp'],['cpi','CPI inflation','%','pp'],['tenyr','10-year Treasury','%','pp'],['sp500','S&P index','','points'],['recessionRisk','Recession score','','points'],['portfolioReturn','Portfolio scenario return','%','pp'],['portfolioValue','Portfolio scenario value','$','$']];
    document.getElementById('local-news-preview').innerHTML=`<p>Current scenario → proposed scenario at evaluation month <b>${shockProjectionMonth}</b>, horizon ${timeHorizon} year(s). ${p.replaces?`Replaces ${p.replaces} active related assumption(s).`:'Adds one event assumption.'} Portfolio figures use your current holdings.</p><div class="news-table-wrap"><table class="news-table"><thead><tr><th>Metric</th><th>Current</th><th>Proposed</th><th>Change</th></tr></thead><tbody>${rows.map(([key,label,unit,deltaUnit])=>`<tr><td>${label}</td><td>${p.before[key].toFixed(3)} ${unit}</td><td>${p.after[key].toFixed(3)} ${unit}</td><td>${formatSigned(p.delta[key],3)} ${deltaUnit}</td></tr>`).join('')}</tbody></table></div>`;
    document.getElementById('local-news-apply').disabled=false;
    document.getElementById('local-news-status').textContent='Preview only. Apply to accept these assumptions.';
  }catch(err){invalidateNewsPreview();document.getElementById('local-news-status').textContent=err.message;}
}
function applyLocalNews(){
  const status=document.getElementById('local-news-status');
  try{
    const event=reviewedNewsEvent(),values=readLocalNewsValues();
    if(!localNewsPreview||localNewsPreview.fingerprint!==NewsScenario.fingerprint()||localNewsPreview.valuesKey!==JSON.stringify(values)||localNewsPreview.eventKey!==JSON.stringify(event)){
      invalidateNewsPreview();throw new Error('Inputs or model state changed. Preview again before applying.');
    }
    NewsScenario.apply(event,values);localNewsPreview=null;
    buildContent();syncSliderDomFromVals();render();renderEventLog();commitChange();openModelSection('news');
    toast('News assumption applied. Review, disable or remove it in the ledger.');
  }catch(err){status.textContent=err.message;}
}
function renderNewsLedger(){
  const el=document.getElementById('news-ledger');if(!el)return;
  const events=newsLedgerEvents();
  if(!events.length){el.innerHTML='<div class="news-empty">No news assumptions in this scenario.</div>';return;}
  el.innerHTML=events.map(e=>{
    const cfg=activeEventIds[e.id]||defaultShockConfig(e),p=e.provenance,sources=p.articles?.length?p.articles:[p];
    return `<article class="news-ledger-row"><div><b>${escapeHtml(p.title||e.label)}</b> <span class="news-cat">${activeEventIds[e.id]?'ACTIVE':'DISABLED'}</span><p>${e.channels.map(c=>`${escapeHtml(shockTargetLabel(c.target))} ${escapeHtml(formatShockEffect(c.target,c.effect))}`).join(' · ')} · magnitude ${Math.round(cfg.magnitude*100)}%</p><p>${escapeHtml(cfg.shockType)} · duration ${cfg.durationMonths}mo · peak M${cfg.peakMonth} · decay ${cfg.decayRate} · evaluating M${shockProjectionMonth} · reviewed ${escapeHtml(p.reviewedAt||'unknown')}</p><details><summary>${sources.length} source reference(s)</summary>${sources.map(s=>`<p><a href="${escapeAttr(NewsClient.safeURL(s.url)||'#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title||s.url)}</a> · ${escapeHtml(s.publishedAt||'date unknown')}</p>`).join('')}</details></div><div class="news-actions"><button class="btn" onclick="editNewsAssumption('${e.id}')">Edit</button><button class="btn" onclick="toggleEvent('${e.id}');renderNewsLedger();invalidateNewsPreview()">${activeEventIds[e.id]?'Disable':'Enable'}</button><button class="btn" onclick="removeNewsAssumption('${e.id}')">Remove</button></div></article>`;
  }).join('');
}
function editNewsAssumption(id){const e=findShock(id);if(!e?.provenance)return;const items=NewsClient.normalizeItems(e.provenance.articles||[e.provenance]);const groups=NewsEvents.group(items);const event={...(groups[0]||e.provenance),eventId:e.provenance.eventId,items};openNewsReview(event,e);}
function removeNewsAssumption(id){const e=findShock(id);if(!e?.provenance)return;delete activeEventIds[id];EVENTS.splice(EVENTS.indexOf(e),1);if(selectedShockId===id)selectedShockId=null;localNewsPreview=null;buildContent();syncSliderDomFromVals();render();renderEventLog();commitChange();openModelSection('news');toast('News assumption removed.');}
async function importLocalNews(input){
  const file=input.files?.[0];if(!file)return;
  try{
    if(file.size>2000000)throw new Error('News files must be under 2 MB.');
    const text=await file.text();const raw=text.trim().startsWith('<')?NewsClient.parseFeed(text,{id:'import',name:file.name,url:location.href}):JSON.parse(text);
    const items=NewsClient.normalizeItems(Array.isArray(raw)?raw:raw.items);if(!items.length)throw new Error('No usable HTTP(S) articles.');
    newsSnapshot={...(newsSnapshot||{}),items:NewsClient.normalizeItems([...items,...(newsSnapshot?.items||[])]),mode:'imported',warning:'Imported context included. Verify sources and publication dates.'};renderNewsFeed();
  }catch(err){toast('Import failed: '+err.message);}finally{input.value='';}
}
function addManualNews(){
  const title=document.getElementById('manual-news-title').value.trim(),url=NewsClient.safeURL(document.getElementById('manual-news-url').value);
  if(!title||!url){toast('Enter a headline and a valid HTTP(S) source URL.');return;}
  const item={title:title.slice(0,500),url,category:'economy',publishedAt:null,source:'User-added context'};
  newsSnapshot={...(newsSnapshot||{}),mode:'manual',items:NewsClient.normalizeItems([item,...(newsSnapshot?.items||[])])};newsCategory='all';newsOrigin='all';
  document.getElementById('manual-news-title').value='';document.getElementById('manual-news-url').value='';
  setNewsCategory('all',document.querySelector('.news-tab[data-cat="all"]'));
}
function modelNewsAsShock(index){
  const x=visibleNewsGroups()[index];if(!x)return;openModelSection('events');
  setTimeout(()=>{const ta=document.getElementById('ai-scenario-prompt');if(ta)ta.value=`Treat this grouped news event as a conditional scenario. Avoid duplicating any existing related event assumption. Translate it into a small reviewable scenario; state uncertainty.\nHeadline: ${x.title}\nSource: ${x.domain}\nPublished: ${x.publishedAt||'unknown'}\nURL: ${x.url}`;ta?.focus();toast('Optional AI interpretation requires a configured endpoint.');},0);
}
