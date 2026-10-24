// Local release QA. Independent Chrome, no user profile and no analytics events.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const {lexer,walkTokens}=require('../vendor/marked.cjs');
const catalog=require('../data/articles.json');
const view=require('../scripts/article-view.js');
const base=process.env.HOWTO_URL||'http://127.0.0.1:4176/';
const shots=path.resolve(process.env.HOWTO_SCREENSHOTS||path.join(__dirname,'../docs/v2.1/after'));
(async()=>{
  fs.mkdirSync(shots,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const errors=[],metrics={base,articles:catalog.articles.length,viewports:[1440,1280,1024,768,390,360],staticCodeBlocks:0,search:[],lab:[]};
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
    await context.route(/busuanzi/,r=>r.abort());
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    async function go(route){await page.goto(new URL(route,base).href,{waitUntil:'domcontentloaded'});await page.locator('.markdown-section h1').first().waitFor();await page.waitForFunction(()=>document.querySelector('.markdown-section')?.dataset.renderedRoute===location.hash);}
    async function capture(name,fullPage=false){await page.waitForTimeout(250);await page.screenshot({path:path.join(shots,name+'.png'),fullPage});}
    for(const route of ['','#/','#/README','#/README.md']){await go(route);assert.equal(await page.locator('.home-stats strong').last().textContent(),String(catalog.paths.length));}
    await capture('home-desktop',true);
    await page.locator('#article-query').fill('EXPLAIN BUFFERS');await page.locator('#article-query').press('Enter');
    await page.waitForURL(/#\/docs\/find/);await page.waitForFunction(()=>document.querySelector('.finder-results a')?.getAttribute('href')==='#/docs/1');
    for(const [query,id] of [['work_mem',92],['pg_stat_statements',5],['EXPLAIN BUFFERS',1],['autovacuum',102],['xmin',45],['replication lag',93],['锁等待',42],['索引膨胀',46],['WAL',31]]){
      const started=performance.now();await page.locator('#article-query').fill(query);
      await page.waitForFunction(query=>document.querySelector('#article-query')?.value===query&&document.querySelector('.markdown-section')?.dataset.renderedRoute===location.hash&&new URLSearchParams(location.hash.split('?')[1]).get('q')===query,query);
      await page.locator('.finder-results a[href="#/docs/'+id+'"]').waitFor();metrics.search.push({query,id,milliseconds:Math.round(performance.now()-started)});
      assert.equal(await page.locator('.finder-retry').isVisible(),false);
    }
    for(const shortcut of ['Control+k','Meta+k']){await page.locator('.finder-results a').first().focus();await page.keyboard.press(shortcut);assert.ok(await page.locator('#article-query').evaluate(e=>e===document.activeElement));}
    await page.locator('.finder-advanced summary').click();await page.locator('#article-query').press('Escape');assert.equal(await page.locator('.finder-advanced').getAttribute('open'),null);
    await page.locator('#article-query').fill('work_mem');await page.waitForFunction(()=>document.querySelector('.finder-results mark')?.textContent.toLowerCase().includes('work'));await capture('search');
    for(const topic of catalog.topics){await page.locator('[name=topic]').selectOption(topic.id);await page.locator('#article-query').fill('');await page.waitForFunction(id=>new URLSearchParams(location.hash.split('?')[1]).get('topic')===id&&!new URLSearchParams(location.hash.split('?')[1]).get('q'),topic.id);assert.ok((await page.locator('.finder-status').textContent()).startsWith(catalog.articles.filter(a=>a.topics.includes(topic.id)).length+' 篇'));}
    await go('#/docs/105');
    await page.locator('.catalog-navigation [data-topic=performance] summary').click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('howto-sidebar-v3')||'{}').performance===true);
    await go('#/docs/102');assert.ok(await page.locator('[data-topic=performance]').evaluate(e=>e.open));assert.ok(await page.locator('[data-topic=storage]').evaluate(e=>e.open));
    assert.ok((await page.locator('.sidebar-label').textContent()).includes('主归属'));
    await go('#/docs/105');assert.ok(await page.locator('.article-toc').evaluate(e=>e.open));
    await page.setViewportSize({width:390,height:900});await page.waitForFunction(()=>!document.querySelector('.article-toc').open);
    await page.locator('.article-toc summary').click();await go('#/docs/102');assert.ok(await page.locator('.article-toc').evaluate(e=>e.open));
    await page.setViewportSize({width:1440,height:1000});await page.locator('.article-toc summary').click();await page.setViewportSize({width:390,height:900});await page.waitForFunction(()=>document.querySelector('.article-toc').open);
    await page.locator('.article-toc a').nth(2).click();await page.waitForTimeout(100);
    const heading=await page.locator('.article-toc a').nth(2).getAttribute('data-heading');await page.reload();await page.locator('.article-toc').waitFor();await page.waitForTimeout(650);
    const top=await page.locator('[id="'+heading+'"]').evaluate(e=>e.getBoundingClientRect().top);assert.ok(top>=64&&top<190,'Refreshed anchor offset: '+top);
    await page.locator('.reading-settings summary').click();await page.keyboard.press('Escape');assert.equal(await page.locator('.reading-settings').getAttribute('open'),null);assert.ok(await page.locator('.reading-settings summary').evaluate(e=>e===document.activeElement));
    await page.locator('#sidebar-toggle').click();assert.equal(await page.locator('.site-header').getAttribute('inert'),'');await page.keyboard.press('Escape');assert.equal(await page.locator('.site-header').getAttribute('inert'),null);
    console.log('PASS: nine search queries, shortcuts, counts, preserved sidebar state, responsive TOC and refreshed anchors');

    const offlineContext=await browser.newContext();await offlineContext.route(/busuanzi/,r=>r.abort());await offlineContext.route('**/data/search-index.json*',r=>r.abort());
    const offline=await offlineContext.newPage();await offline.goto(base+'#/docs/find?q=WAL');await offline.waitForFunction(()=>document.querySelector('.finder-retry')&&!document.querySelector('.finder-retry').hidden);
    await offline.locator('#article-query').fill('');await offline.waitForFunction(()=>document.querySelector('.finder-retry').hidden);assert.ok(!(await offline.locator('.finder-status').textContent()).includes('索引'));
    await offlineContext.close();

    const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:1440,height:1000}});
    const raw=await nojs.newPage();
    for(const a of catalog.articles){
      const response=await raw.goto(new URL(view.url(a.id),base).href,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
      assert.equal(await raw.locator('.markdown-section h1').textContent(),a.title);
      assert.equal(await raw.locator('link[rel=canonical]').getAttribute('href'),view.canonical(a.id));
      const expected=[];walkTokens(lexer(fs.readFileSync(path.join(__dirname,'../docs/'+a.id+'.md'),'utf8')),t=>{if(t.type==='code')expected.push(t.text+(t.lang==='mermaid'?'':'\n'));});
      const actual=await raw.locator('.markdown-section pre > code').allTextContents();assert.deepEqual(actual,expected,'Code character fidelity in '+a.id);metrics.staticCodeBlocks+=actual.length;
      assert.ok(await raw.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      if(a.id===105){await raw.locator('.article-toc summary').click();await raw.locator('.article-toc a').nth(1).click();const id=await raw.locator('.article-toc a').nth(1).getAttribute('data-heading');const y=await raw.locator('[id="'+id+'"]').evaluate(e=>e.getBoundingClientRect().top);assert.ok(y>=64&&y<190);}
    }
    await raw.goto(new URL('/articles/',base).href);assert.equal(await raw.locator('.markdown-section li a[href^="/articles/"]').count(),catalog.articles.length);
    const missing=await nojs.request.get(new URL('/articles/99999/',base).href);assert.equal(missing.status(),404);
    await nojs.close();
    console.log('PASS: all 109 static HTML responses readable without JS, original fenced code byte-for-byte, canonical, native TOC and real 404');

    for(const width of metrics.viewports){
      await page.setViewportSize({width,height:900});
      for(const mode of ['light','dark']){
        await page.evaluate(mode=>localStorage.setItem('howto-theme',mode),mode);
        for(const route of ['#/docs/paths','/articles/1/','/articles/98/','/articles/105/','/articles/109/']){
          await go(route);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' '+mode+' '+route);
          if(route==='/articles/109/'&&width<=390){const table=page.locator('.table-scroll').first();await table.evaluate(e=>e.scrollLeft=90);assert.ok(await table.evaluate(e=>e.scrollLeft>0));}
          if(width===390&&mode==='dark'&&route==='/articles/98/'){await page.locator('table').first().scrollIntoViewIfNeeded();await capture('bpftrace-table-mobile-dark');}
        }
      }
    }
    await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>localStorage.setItem('howto-theme','light'));
    await go('#/docs/topics');await capture('topics',true);await go('#/docs/paths');await capture('paths',true);
    await go('#/docs/105');await capture('long-article');await go('#/docs/1');await page.locator('.code-block').first().scrollIntoViewIfNeeded();await capture('explain');
    await go('/articles/105/');await capture('static-article');assert.equal(await page.locator('#gitalk-container').count(),1);
    await page.keyboard.press('Meta+k');await page.waitForURL(/#\/docs\/find/);await page.locator('#article-query').waitFor();assert.ok(await page.locator('#article-query').evaluate(e=>e===document.activeElement));
    await go('/articles/109/');const code=page.locator('.code-block').first();const text=await code.locator('pre code').textContent();await code.locator('.code-copy').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),text);
    const anchor=await page.locator('.article-toc a').nth(2).getAttribute('data-heading');await page.locator('.article-toc a').nth(2).click();await page.reload();await page.waitForFunction(()=>document.querySelector('.markdown-section')?.dataset.renderedRoute===location.hash);
    await page.waitForFunction(id=>{const target=document.getElementById(id),y=target?.getBoundingClientRect().top;return y>=64&&y<190&&document.querySelector('.mermaid svg');},anchor);await page.waitForTimeout(100);
    const anchorTop=await page.locator('[id="'+anchor+'"]').evaluate(e=>e.getBoundingClientRect().top);assert.ok(anchorTop>=64&&anchorTop<190,'Static anchor refresh: '+anchorTop);
    for(const dialog of ['communityModal','imageModal']){
      await page.locator('.site-footer [data-dialog="'+dialog+'"]').click();const image=page.locator('#'+dialog+' img');await image.evaluate(e=>e.decode());const size=await image.evaluate(e=>({width:e.naturalWidth,height:e.naturalHeight}));assert.ok(size.width>0&&size.height>0);metrics[dialog]=size;await page.keyboard.press('Escape');assert.ok(await page.locator('.site-footer [data-dialog="'+dialog+'"]').evaluate(e=>e===document.activeElement));
    }
    await page.setViewportSize({width:390,height:900});await go('#/README');await page.evaluate(()=>scrollTo(0,0));await capture('home-mobile');
    console.log('PASS: static/legacy reading across six widths and both themes, copy, deep links, real QR images and focus');

    for(const {route,width} of [{route:'',width:1440},{route:'',width:390},{route:'/articles/105/',width:1440}]){
      const lab=await browser.newContext({viewport:{width,height:1000}});await lab.route(/busuanzi/,r=>r.abort());
      await lab.addInitScript(()=>{window.labVitals={lcp:0,cls:0};new PerformanceObserver(list=>{for(const e of list.getEntries())window.labVitals.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.labVitals.cls+=e.value;}).observe({type:'layout-shift',buffered:true});});
      const lp=await lab.newPage();await lp.goto(new URL(route,base).href,{waitUntil:'domcontentloaded'});await lp.locator('.markdown-section h1').first().waitFor();await lp.waitForTimeout(1000);
      const measured=await lp.evaluate(()=>({path:location.pathname,width:innerWidth,...window.labVitals,resources:performance.getEntriesByType('resource').filter(r=>r.name.startsWith(location.origin)).map(r=>({path:new URL(r.name).pathname,bytes:r.encodedBodySize})),conditions:'Local Chrome, height 1000px, no throttling, independent profile, 1s after content, analytics blocked; not field CWV'}));
      metrics.lab.push(measured);assert.ok(measured.cls<0.1,'Local startup layout shift: '+JSON.stringify(measured));
      await lab.close();
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(shots,'v2.1-metrics.json'),JSON.stringify(metrics,null,2)+'\n');
    await context.close();console.log('PASS: no browser exceptions; measured local LCP/CLS, resource and search records saved');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
