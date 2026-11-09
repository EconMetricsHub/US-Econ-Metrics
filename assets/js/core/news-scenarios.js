/* The only bridge between news context and model state. Preview is transactional. */
(function(root){
  'use strict';
  function buildDraft(event,values){
    const sh=NewsClient.draft(event,values);
    sh.provenance={...sh.provenance,kind:'news',eventId:event.eventId||null,
      articles:NewsClient.normalizeItems(event.items||[event]).map(x=>({title:x.title,url:x.url,publishedAt:x.publishedAt})),
      preset:String(values.preset||'manual'),origin:event.official?'official release':'media/user context'};
    return sh;
  }
  function matching(event){return EVENTS.filter(e=>NewsEvents.conflicts(event,e.provenance));}
  function make(sh,id){return enrichEventDefinition({id,label:sh.label,cat:'Custom',pos:(sh.channels.find(c=>c.target==='gdpA')?.effect||-sh.channels[0].effect)>=0,
    shockType:sh.shockType,durationMonths:sh.durationMonths,peakMonth:sh.peakMonth,decayRate:sh.decayRate,
    confidence:sh.confidence,channels:sh.channels,chips:[],provenance:sh.provenance});}
  function metrics(){const m=compute(),p=portfolioAnalytics(m);return {gdp:m.gdp,cpi:m.cpi,tenyr:m.tenyr,sp500:m.sp500,recessionRisk:m.recessionRisk,portfolioReturn:p.scenarioReturn,portfolioValue:portfolioValue*(1+p.scenarioReturn/100)};}
  function fingerprint(){return JSON.stringify({state:snapshot(),portfolioHoldings,portfolioValue,metrics:metrics()});}
  function preview(event,values){
    const sh=buildDraft(event,values),before=metrics(),matches=matching(event),saved=activeEventIds;
    const id='preview_news_'+Date.now().toString(36),ev=make(sh,id);
    try{
      activeEventIds={...saved};for(const old of matches)delete activeEventIds[old.id];
      EVENTS.push(ev);activeEventIds[id]=defaultShockConfig(ev);
      const after=metrics(),delta=Object.fromEntries(Object.keys(before).map(k=>[k,after[k]-before[k]]));
      return {before,after,delta,draft:sh,replaces:matches.filter(e=>saved[e.id]).length};
    }finally{
      activeEventIds=saved;const i=EVENTS.indexOf(ev);if(i>=0)EVENTS.splice(i,1);
    }
  }
  function apply(event,values){
    const sh=buildDraft(event,values),matches=matching(event);
    for(const old of matches){delete activeEventIds[old.id];const i=EVENTS.indexOf(old);if(i>=0)EVENTS.splice(i,1);}
    const id='custom_news_'+(++customEventCount),ev=make(sh,id);
    EVENTS.push(ev);activeEventIds[id]=defaultShockConfig(ev);selectedShockId=id;
    return ev;
  }
  root.NewsScenario={buildDraft,matching,metrics,fingerprint,preview,apply};
})(window);
