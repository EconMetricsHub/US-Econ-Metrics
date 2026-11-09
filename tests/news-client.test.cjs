const {test}=require('node:test');
const assert=require('node:assert/strict');
const news=require('../assets/js/news-client.js');
const now=Date.now();
const article={title:'Oil prices surge after supply disruption',url:'https://example.org/story',publishedAt:new Date(now).toISOString()};
test('normalizes dates, rejects unsafe links and deduplicates tracking variants',()=>{
 const items=news.normalizeItems([{...article,url:article.url+'?utm_source=a#top',seendate:'20261109T120000Z',publishedAt:null},{...article,url:article.url+'?utm_source=b'}, {...article,url:'javascript:alert(1)'},null]);
 assert.equal(items.length,1);assert.equal(items[0].publishedAt,'2026-11-09T12:00:00.000Z');
 assert.equal(news.safeURL('data:text/html,bad'),'');
 assert.equal(news.normalizeItems([{...article,publishedAt:null}])[0].publishedAt,null);
});
test('official labels derive from verified source hostnames',()=>{
 assert.equal(news.isOfficial('https://www.bls.gov/news.release/cpi.htm'),true);
 assert.equal(news.isOfficial('https://bls.gov.example.org/fake'),false);
 assert.equal(news.normalizeItems([{...article,official:true}])[0].official,false);
});
test('only clear recent headlines get automatic suggestions',()=>{
 assert.equal(news.suggest(article,now),'energy_up');
 for(const title of ['Oil prices may surge','Will oil prices surge?','Oil prices do not surge','Fed cuts rates and oil prices surge'])assert.equal(news.suggest({...article,title},now),'manual');
 assert.equal(news.suggest({...article,publishedAt:null},now),'manual');
 assert.equal(news.suggest({...article,publishedAt:new Date(now-8*86400000).toISOString()},now),'manual');
});
test('drafts validate limits and preserve attribution',()=>{
 const sh=news.draft(article,{gdp:-.15,cpi:.25,duration:6});
 assert.equal(sh.provenance.url,article.url);assert.equal(sh.channels[0].effect,-.15);
 for(const values of [{gdp:2,cpi:0,duration:6},{gdp:0,cpi:0,duration:6},{gdp:.1,cpi:0,duration:1.5},{gdp:'abc',cpi:0,duration:6}])assert.throws(()=>news.draft(article,values));
});
test('isolates source failures, caches valid results, and preserves saved publication times',async()=>{
 let stored,calls=0;
 global.localStorage={getItem:()=>stored,setItem:(k,v)=>stored=v};
 const config={sources:[{id:'gdelt',name:'Media',kind:'gdelt',url:'https://provider.test/news'},{id:'failed',name:'Failed feed',kind:'rss',url:'https://failed.test/rss'}]};
 global.fetch=async(url)=>{calls++;if(url==='data/news-sources.json')return {ok:true,json:async()=>config};if(url.startsWith('https://provider'))return {ok:true,json:async()=>({articles:[article]})};if(url.startsWith('https:'))throw new Error('CORS');return {ok:true,json:async()=>({items:[]})};};
 const live=await news.load();assert.equal(live.mode,'live');assert.equal(live.items.length,1);assert.equal(live.sourceStatus.failed.ok,false);
 const checkedCalls=calls;assert.equal((await news.load()).mode,'cached');assert.equal(calls,checkedCalls);
 global.fetch=async(url)=>{if(url==='data/news-sources.json')return {ok:true,json:async()=>config};if(url.startsWith('https:'))throw new Error('Offline');return {ok:true,json:async()=>({items:[]})};};
 const fallback=await news.load({force:true});assert.equal(fallback.mode,'saved');assert.equal(fallback.items[0].publishedAt,article.publishedAt);assert.match(fallback.warning,/unavailable/);
 stored=undefined;const empty=await news.load({force:true});assert.equal(empty.items.length,0);assert.match(empty.warning,/No saved articles/);
});
