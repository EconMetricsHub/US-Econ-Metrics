/* Conservative event clustering. Shared topics alone never establish identity. */
(function(root){
  'use strict';
  const STOP=new Set('a an the and or of to in for on at by with from after amid as is are has have its us u s says said report reports new latest breaking update prices price'.split(' '));
  const MONTHS='january february march april may june july august september october november december'.split(' ');
  function titleKey(value){return String(value||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9% .-]/g,' ').replace(/\s+/g,' ').trim();}
  function tokens(item){return new Set(titleKey(item.title).split(/[^a-z0-9]+/).filter(x=>x.length>1&&!STOP.has(x)));}
  function descriptor(item){
    const t=titleKey(item.title);
    const topic=/\bcpi\b|consumer price index/.test(t)?'cpi':/\bpce\b|personal income and outlays/.test(t)?'pce':/\bgdp\b|gross domestic product/.test(t)?'gdp':/employment situation|nonfarm payroll|jobs report/.test(t)?'jobs':/\bfed\b|federal reserve|fomc/.test(t)?'fed':/\boil\b|\bcrude\b/.test(t)?'oil':/\btariff/.test(t)?'tariff':null;
    let period=null;
    const m=t.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/);
    if(m)period=`${m[2]}-${String(MONTHS.indexOf(m[1])+1).padStart(2,'0')}`;
    if(!period&&['cpi','pce','jobs'].includes(topic)){
      const month=t.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/);
      const date=new Date(item.publishedAt||NaN);
      if(month&&Number.isFinite(date.getTime())){const mi=MONTHS.indexOf(month[1]);const year=date.getUTCFullYear()-(mi>date.getUTCMonth()?1:0);period=`${year}-${String(mi+1).padStart(2,'0')}`;}
    }
    const q=t.match(/\bq([1-4])\s+(20\d{2})\b/)||t.match(/\b([1-4])(?:st|nd|rd|th) quarter (20\d{2})\b/);if(q)period=`${q[2]}-q${q[1]}`;
    const direction=/\b(cuts?|lowers?|falls?|drops?|declines?|plunges?|easing)\b/.test(t)?'down':/\b(raises?|hikes?|rises?|jumps?|surges?|increases?|soars?|tightening)\b/.test(t)?'up':null;
    return {topic,period,direction};
  }
  function related(a,b){
    if(a.id&&b.id&&a.id===b.id)return true;
    const ka=titleKey(a.title),kb=titleKey(b.title);
    if(!ka||!kb)return false;
    const da=Date.parse(a.publishedAt),db=Date.parse(b.publishedAt);
    if(Number.isFinite(da)&&Number.isFinite(db)&&Math.abs(da-db)>72*3600000)return false;
    if(ka===kb)return true;
    if(!Number.isFinite(da)||!Number.isFinite(db))return false;
    const x=descriptor(a),y=descriptor(b);
    if(x.topic&&y.topic&&x.topic!==y.topic)return false;
    if(x.period&&y.period&&x.period!==y.period)return false;
    // Explicit macro reporting periods identify a release even if articles disagree on interpretation.
    if(['cpi','pce','gdp','jobs'].includes(x.topic)&&x.topic===y.topic&&x.period&&x.period===y.period)return true;
    if(x.direction&&y.direction&&x.direction!==y.direction)return false;
    const ta=tokens(a),tb=tokens(b),intersection=[...ta].filter(t=>tb.has(t)).length;
    const union=ta.size+tb.size-intersection;
    return intersection>=4&&intersection/Math.max(1,union)>=.6;
  }
  function hash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(36);}
  function group(items){
    const groups=[];
    for(const item of items){
      // Complete linkage avoids chaining two unrelated events through a generic headline.
      let g=groups.find(g=>g.items.every(x=>related(item,x)));
      if(!g){g={items:[]};groups.push(g);}g.items.push(item);
    }
    return groups.map(g=>{
      const representative=g.items.find(x=>x.official)||g.items[0];
      const d=descriptor(representative);
      const key=d.topic&&d.period?`${d.topic}:${d.period}`:g.items.map(x=>x.id||x.url).sort()[0];
      return {...representative,eventId:'event_'+hash(key),items:g.items,articleCount:g.items.length};
    });
  }
  function conflicts(event,provenance){
    if(!provenance)return false;
    if(event.eventId&&event.eventId===provenance.eventId)return true;
    const old=Array.isArray(provenance.articles)&&provenance.articles.length?provenance.articles:[provenance];
    const current=Array.isArray(event.items)&&event.items.length?event.items:[event];
    return current.some(a=>old.some(b=>related(a,b)||a.url===b.url));
  }
  root.NewsEvents={related,group,conflicts,descriptor};
  if(typeof module!=='undefined')module.exports=root.NewsEvents;
})(typeof window==='undefined'?globalThis:window);
