/* Optional integration check. Requires Playwright and a server on TEST_BASE_URL. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const date=new Date().toISOString();
  const rss=`<rss><channel><item><title>Federal Reserve publishes monetary policy report</title><link>https://www.federalreserve.gov/news/policy.htm</link><pubDate>${date}</pubDate></item></channel></rss>`;
  const fulfill=(r,body,contentType='application/json')=>r.fulfill({body:typeof body==='string'?body:JSON.stringify(body),contentType,headers:{'access-control-allow-origin':'*'}});
  await page.route('https://www.federalreserve.gov/feeds/**',r=>fulfill(r,rss,'application/xml'));
  await page.route('https://www.bls.gov/feed/**',r=>r.abort('failed'));
  await page.route('https://apps.bea.gov/rss/**',r=>r.abort('failed'));
  await page.route('**/data/news-feed.json',r=>fulfill(r,{schemaVersion:2,items:[]}));
  await page.route('https://api.gdeltproject.org/**',r=>fulfill(r,{articles:[
   {title:'Oil prices surge after major Gulf supply disruption',url:'https://example.org/story-a',publishedAt:date},
   {title:'Crude oil prices surge after major Gulf supply disruption',url:'https://example.net/story-b',publishedAt:date},
   {title:'Unsafe item',url:'javascript:alert(1)',publishedAt:date}]}));
  await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:8000/',{waitUntil:'networkidle'});
  const baseline=await page.evaluate(()=>({gdp:compute().gdp,cpi:compute().cpi}));
  assert.ok(Number.isFinite(baseline.gdp));
  await page.evaluate(()=>openModelSection('news'));
  await page.locator('.news-card').first().waitFor();
  assert.equal(await page.locator('.news-card').count(),2); // one grouped media event + one official event
  assert.match(await page.locator('#news-meta').innerText(),/2 EVENTS \/ 3 ARTICLES/);
  await page.locator('#news-origin').selectOption('official');assert.equal(await page.locator('.news-card').count(),1);
  assert.match(await page.locator('.news-card').innerText(),/OFFICIAL RELEASE/);
  await page.locator('#news-origin').selectOption('media');assert.equal(await page.locator('.news-card').count(),1);
  assert.match(await page.locator('.news-card').innerText(),/2 linked articles/);
  await page.getByRole('button',{name:'Review local model effect',exact:true}).click();
  assert.equal(await page.locator('#local-news-preset').inputValue(),'energy_up');
  assert.equal(await page.locator('#local-news-apply').isDisabled(),true);
  const stateBefore=await page.evaluate(()=>JSON.stringify(snapshot()));
  await page.getByRole('button',{name:'Preview model change',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.stringify(snapshot())),stateBefore);
  assert.notEqual(await page.evaluate(()=>localNewsPreview.after.gdp),baseline.gdp);
  assert.match(await page.locator('#local-news-preview').innerText(),/Portfolio scenario return/);
  await page.locator('#local-news-gdp').fill('-0.25');assert.equal(await page.locator('#local-news-apply').isDisabled(),true);
  await page.getByRole('button',{name:'Preview model change',exact:true}).click();
  const proposed=await page.evaluate(()=>localNewsPreview.after);
  if(process.env.SCREENSHOT_DIR){
    await page.screenshot({path:process.env.SCREENSHOT_DIR+'/news-preview-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('#local-news-review').isVisible(),true);
    await page.screenshot({path:process.env.SCREENSHOT_DIR+'/news-preview-mobile.png'});
    await page.setViewportSize({width:1280,height:720});
  }
  await page.locator('#local-news-apply').click();
  const applied=await page.evaluate(()=>({metrics:NewsScenario.metrics(),defs:serializeCustomEvents(),active:Object.keys(activeEventIds)}));
  assert.ok(Math.abs(applied.metrics.gdp-proposed.gdp)<1e-10);assert.ok(Math.abs(applied.metrics.portfolioReturn-proposed.portfolioReturn)<1e-10);
  assert.equal(applied.defs.length,1);assert.equal(applied.defs[0].provenance.articles.length,2);
  assert.equal(await page.locator('.news-ledger-row').count(),1);
  // A different source article in the same group replaces the existing event.
  await page.getByRole('button',{name:'Review local model effect',exact:true}).click();
  await page.getByRole('button',{name:'Preview model change',exact:true}).click();
  assert.equal(await page.evaluate(()=>localNewsPreview.replaces),1);
  await page.locator('#local-news-apply').click();assert.equal(await page.evaluate(()=>Object.keys(activeEventIds).length),1);
  await page.locator('.news-ledger-row').getByRole('button',{name:'Disable',exact:true}).click();
  assert.ok(Math.abs((await page.evaluate(()=>compute().gdp))-baseline.gdp)<1e-10);
  await page.locator('.news-ledger-row').getByRole('button',{name:'Enable',exact:true}).click();
  await page.locator('.news-ledger-row').getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByRole('button',{name:'Preview model change',exact:true}).click();
  await page.evaluate(()=>{vals.oil+=1;}); // changes while preview is open invalidate acceptance
  await page.locator('#local-news-apply').click();assert.match(await page.locator('#local-news-status').innerText(),/Preview again/);
  await page.evaluate(()=>{vals.oil-=1;});
  await page.locator('.news-ledger-row').getByRole('button',{name:'Remove',exact:true}).click();
  assert.equal(await page.locator('.news-ledger-row').count(),0);
  assert.ok(Math.abs((await page.evaluate(()=>compute().gdp))-baseline.gdp)<1e-10);
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>serializeCustomEvents().filter(e=>e.provenance?.kind==='news').length),1);
  await page.evaluate(()=>redo());assert.equal(await page.evaluate(()=>serializeCustomEvents().filter(e=>e.provenance?.kind==='news').length),0);
  // RSS/Atom imports and plain text rendering of user headlines.
  await page.locator('#news-import').setInputFiles({name:'atom.xml',mimeType:'application/xml',buffer:Buffer.from(`<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>&lt;img src=x onerror=alert(1)&gt;</title><link href="https://example.org/import"/><updated>${date}</updated></entry></feed>`)});
  assert.equal(await page.locator('.news-card img').count(),0);assert.match(await page.locator('#news-meta').innerText(),/IMPORTED/);
  await page.evaluate(()=>{openModelSection('overview');openModelSection('portfolio');openModelSection('events');openModelSection('scenarios');});
  assert.deepEqual(errors,[]);
  console.log('PASS: source isolation + RSS, grouping/filtering, mutation-free previews, preview/apply agreement, event replacement, ledger edit/disable/remove, undo/redo, stale preview gate, Atom import, navigation; zero uncaught page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
