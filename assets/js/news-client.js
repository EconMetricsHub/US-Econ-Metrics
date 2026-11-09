/* Key-free ingestion. News remains context; only reviewed assumptions enter the model. */
(function(root) {
  'use strict';
  const CACHE_KEY='macroscope.news.v2', MAX_AGE=7*86400000;
  const DEFAULT_SOURCES=[
    {id:'fed',name:'Federal Reserve releases',kind:'rss',url:'https://www.federalreserve.gov/feeds/press_all.xml'},
    {id:'bls-cpi',name:'BLS Consumer Price Index',kind:'rss',url:'https://www.bls.gov/feed/cpi.rss'},
    {id:'bls-jobs',name:'BLS Employment Situation',kind:'rss',url:'https://www.bls.gov/feed/empsit.rss'},
    {id:'bea',name:'Bureau of Economic Analysis releases',kind:'rss',url:'https://apps.bea.gov/rss/rss.xml'},
    {id:'gdelt',name:'GDELT economic headlines',kind:'gdelt',url:'https://api.gdeltproject.org/api/v2/doc/doc'}
  ];
  function safeURL(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
  function isOfficial(url){try{const h=new URL(url).hostname;return ['federalreserve.gov','bls.gov','bea.gov'].some(x=>h===x||h.endsWith('.'+x));}catch{return false;}}
  function canonicalURL(url){const u=new URL(url);u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.href;}
  function normalizeItems(items){
    const seen=new Set();
    return (Array.isArray(items)?items:[]).slice(0,1000).flatMap(raw=>{
      if(!raw||typeof raw!=='object')return [];
      const url=safeURL(raw.url),title=String(raw.title||'').trim().slice(0,500);
      if(!url||!title)return [];
      const id=canonicalURL(url);if(seen.has(id))return [];seen.add(id);
      let time=raw.publishedAt||raw.seendate;
      if(/^\d{8}T\d{6}Z$/.test(time||''))time=time.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,'$1-$2-$3T$4:$5:$6Z');
      const date=new Date(time||NaN),publishedAt=Number.isFinite(date.getTime())?date.toISOString():null;
      const t=title.toLowerCase(),official=isOfficial(url);
      const category=official?'economy':['economy','politics','geopolitics'].includes(raw.category)?raw.category:
        /war|sanction|nato|taiwan|ukraine/.test(t)?'geopolitics':/congress|election|senate|president/.test(t)?'politics':'economy';
      return [{id,url:id,title,category,publishedAt,domain:new URL(url).hostname,official,
        sourceId:String(raw.sourceId||'').slice(0,40),source:String(raw.source||new URL(url).hostname).slice(0,150)}];
    }).sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0)).slice(0,200);
  }
  function parseFeed(xml,source){
    if(typeof DOMParser==='undefined')throw new Error('XML parsing requires a browser');
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror'))throw new Error('Invalid RSS/Atom XML');
    const nodes=[...doc.querySelectorAll('item, entry')];
    const text=(node,names)=>{for(const name of names){const el=[...node.children].find(e=>e.localName===name);if(el)return el.textContent.trim();}return '';};
    return nodes.slice(0,100).map(node=>{
      const link=[...node.children].find(e=>e.localName==='link'&&(!e.getAttribute('rel')||e.getAttribute('rel')==='alternate'));
      let url=link?.getAttribute('href')||link?.textContent.trim()||text(node,['guid']);
      try{url=new URL(url,source.url).href;}catch{}
      return {title:text(node,['title']),url,publishedAt:text(node,['pubDate','published','updated','date']),sourceId:source.id,source:source.name};
    });
  }
  async function response(url){const r=await fetch(url,{signal:AbortSignal.timeout(10000),credentials:'omit'});if(!r.ok)throw new Error('HTTP '+r.status);return r;}
  async function json(url){return(await response(url)).json();}
  async function fetchSource(source){
    if(source.kind==='gdelt'){
      const params=new URLSearchParams({query:'("US economy" OR "Federal Reserve" OR inflation OR tariffs OR "oil prices") sourcelang:english',mode:'artlist',format:'json',timespan:'24h',maxrecords:'75',sort:'datedesc'});
      const data=await json(source.url+'?'+params);
      if(!Array.isArray(data.articles))throw new Error('Invalid provider response');
      return normalizeItems(data.articles.map(x=>({...x,sourceId:source.id,source:source.name})));
    }
    const r=await response(source.url);const xml=await r.text();if(xml.length>2000000)throw new Error('Feed exceeds 2 MB');
    return normalizeItems(parseFeed(xml,source));
  }
  async function load({force=false}={}){
    let cached;try{cached=JSON.parse(localStorage.getItem(CACHE_KEY));}catch{}
    const age=Date.now()-Date.parse(cached?.checkedAt);
    if(!force&&age>=0&&age<15*60000&&normalizeItems(cached?.items).length)
      return {...cached,items:normalizeItems(cached.items),mode:'cached',warning:'Browser cache; source statuses reflect the last check.'};
    let sources=DEFAULT_SOURCES;
    try{const config=await json('data/news-sources.json');if(Array.isArray(config.sources)&&config.sources.length)sources=config.sources.slice(0,10);}catch{}
    const checkedAt=new Date().toISOString();
    const results=await Promise.allSettled([...sources.map(fetchSource),json('data/news-feed.json')]);
    const sourceStatus={},live=[];
    sources.forEach((source,i)=>{
      const r=results[i],ok=r.status==='fulfilled';
      sourceStatus[source.id]={name:source.name,url:source.url,ok,count:ok?r.value.length:0,checkedAt,error:ok?null:String(r.reason?.message||r.reason)};
      if(ok)live.push(...r.value);
    });
    const snapshotResult=results[sources.length],snapshot=snapshotResult.status==='fulfilled'?snapshotResult.value:null;
    const archives=[cached,snapshot].filter(x=>normalizeItems(x?.items).length).sort((a,b)=>(Date.parse(b.generatedAt)||0)-(Date.parse(a.generatedAt)||0));
    const items=normalizeItems([...live,...archives.flatMap(x=>normalizeItems(x.items))]);
    const failed=Object.values(sourceStatus).filter(x=>!x.ok).length;
    const result={schemaVersion:2,generatedAt:live.length?checkedAt:archives[0]?.generatedAt||null,checkedAt,
      provider:'Official releases and GDELT',sourceStatus,snapshotStatus:snapshot?.sourceStatus||snapshot?.status||{},items,
      mode:live.length?'live':archives.length?'saved':'offline',
      warning:failed?`${failed}/${sources.length} direct sources unavailable. Saved articles may be included; inspect publication dates.`:''};
    if(!items.length)result.warning+=' No saved articles. Import a feed or add a headline.';
    if(live.length)try{localStorage.setItem(CACHE_KEY,JSON.stringify(result));}catch{}
    return result;
  }
  // Small scenario priors, not extracted economic measurements or calibrated forecasts.
  // Ambiguous, negative, future and question headlines require a manual choice.
  const presets = {
    manual: {label:'Manual assumption',gdp:0,cpi:0},
    energy_up: {label:'Energy supply pressure',gdp:-0.15,cpi:0.25},
    energy_down: {label:'Energy price relief',gdp:0.10,cpi:-0.20},
    tariff_up: {label:'Higher trade barriers',gdp:-0.15,cpi:0.15},
    rate_cut: {label:'Monetary easing',gdp:0.10,cpi:0.05},
    rate_hike: {label:'Monetary tightening',gdp:-0.10,cpi:-0.05}
  };
  function suggest(item, now=Date.now()) {
    const age = now - Date.parse(item.publishedAt);
    if (!Number.isFinite(age) || age < -3600000 || age > MAX_AGE) return 'manual';
    const t = item.title.toLowerCase();
    if (/\?|\b(no|not|never|may|might|could|would|if|expects?|expected|forecasts?|plans?|considers?|denies|unlikely)\b/.test(t)) return 'manual';
    const matches = [];
    if (/\b(oil|energy|crude) prices? (surge|jump|rise|spike|soar)s?\b/.test(t)) matches.push('energy_up');
    if (/\b(oil|energy|crude) prices? (fall|drop|decline|plunge)s?\b/.test(t)) matches.push('energy_down');
    if (/\b(raises|increases|hikes) tariffs\b|\btariffs (rise|increase)\b/.test(t)) matches.push('tariff_up');
    if (/\b(fed|federal reserve) (cuts|lowers) (interest )?rates\b/.test(t)) matches.push('rate_cut');
    if (/\b(fed|federal reserve) (raises|hikes) (interest )?rates\b/.test(t)) matches.push('rate_hike');
    return matches.length === 1 ? matches[0] : 'manual';
  }
  function draft(item, values) {
    const gdp = Number(values.gdp), cpi = Number(values.cpi), duration = Number(values.duration);
    if (![gdp,cpi,duration].every(Number.isFinite) || Math.abs(gdp)>1 || Math.abs(cpi)>1 || duration<1 || duration>24 || !Number.isInteger(duration))
      throw new Error('Use effects between −1 and +1 percentage points and a whole duration of 1–24 months.');
    if (!gdp && !cpi) throw new Error('Choose at least one nonzero scenario effect.');
    return {enabled:true,label:('News assumption: '+item.title).slice(0,180),category:'Custom',shockType:'temporary',
      magnitude:1,durationMonths:duration,peakMonth:Math.min(3,duration),decayRate:0.25,confidence:0.35,
      channels:[{target:'gdpA',effect:gdp},{target:'cpiA',effect:cpi}].filter(x=>x.effect),
      provenance:{url:safeURL(item.url),title:item.title,publishedAt:item.publishedAt,method:'User-reviewed local scenario prior',reviewedAt:new Date().toISOString()}};
  }
  root.NewsClient={load,normalizeItems,safeURL,canonicalURL,isOfficial,parseFeed,suggest,presets,draft,DEFAULT_SOURCES};
  if(typeof module!=='undefined')module.exports=root.NewsClient;
})(typeof window==='undefined'?globalThis:window);
