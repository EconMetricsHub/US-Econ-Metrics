const {test}=require('node:test'),assert=require('node:assert/strict');
const events=require('../assets/js/news-events.js');
const date='2026-11-09T12:00:00Z';
const row=(title,url,publishedAt=date)=>({title,url,id:url,publishedAt});
test('groups closely matching stories but separates direction and event dates',()=>{
 const a=row('Oil prices surge after major Gulf supply disruption','https://a.test/oil');
 const b=row('Crude oil prices surge after major Gulf supply disruption','https://b.test/oil');
 const c=row('Oil prices fall after major Gulf supply disruption','https://c.test/oil');
 const d={...a,url:'https://d.test/oil',id:'https://d.test/oil',publishedAt:'2026-11-01T12:00:00Z'};
 assert.equal(events.related(a,b),true);assert.equal(events.related(a,c),false);assert.equal(events.related(a,d),false);
 assert.deepEqual(events.group([a,b,c,d]).map(g=>g.articleCount),[2,1,1]);
});
test('explicit release periods join official releases and reporting',()=>{
 const a={...row('Consumer Price Index for October 2026','https://www.bls.gov/cpi'),official:true};
 const b=row('October 2026 CPI inflation rises in new release','https://news.test/cpi');
 const c=row('September 2026 CPI inflation rises in new release','https://news.test/previous');
 assert.equal(events.related(a,b),true);assert.equal(events.related(a,c),false);
 const g=events.group([b,a]);assert.equal(g[0].official,true);assert.equal(g[0].articleCount,2);
 assert.equal(events.conflicts(g[0],{eventId:g[0].eventId,articles:[b]}),true);
});
test('does not infer a connection from vague undated headlines',()=>{
 assert.equal(events.related(row('Inflation concerns increase','https://a.test',null),row('Inflation concerns continue increasing','https://b.test',null)),false);
});
