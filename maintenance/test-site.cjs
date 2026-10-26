// Browser regression. Uses an independent profile; no user browser/account state.
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const catalog=require('../data/articles.json');
const base=process.env.HOWTO_URL||'http://127.0.0.1:4176/';
const shots=path.resolve(process.env.HOWTO_SCREENSHOTS||path.join(__dirname,'../docs/redesign/after'));
(async()=>{
  fs.mkdirSync(shots,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const errors=[],metrics={viewports:[1440,1280,1024,768,390,360],articles:catalog.articles.length};
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
    await context.route(/busuanzi/,route=>route.abort());
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    async function go(route){await page.goto(base+route);await page.locator('.markdown-section h1').first().waitFor();await page.waitForFunction(()=>document.querySelector('.markdown-section')?.dataset.renderedRoute===location.hash);}
    async function article(id){
      await go('#/docs/'+id);
      await page.waitForFunction(record=>document.querySelector('.markdown-section h1')?.textContent===record.title && document.querySelector('.article-id')?.textContent==='#'+record.id && document.querySelector('#gitalk-container'),catalog.articles.find(a=>a.id===id));
    }
    async function theme(mode){
      for(let n=0;n<3 && await page.locator('.theme-toggle').getAttribute('data-mode')!==mode;n++)await page.locator('.theme-toggle').click();
      assert.equal(await page.locator('.theme-toggle').getAttribute('data-mode'),mode);
    }
    async function noOverflow(label){
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow: '+label);
    }
    for(const route of ['','#/','#/README']){
      await go(route);await page.locator('#article-query').waitFor();
      assert.equal(await page.locator('.home-hero h1').textContent(),'PostgreSQL Howto');
      assert.equal(await page.locator('.cover.show').count(),0);
      assert.equal(await page.locator('#gitalk-container').count(),0);
      assert.equal(await page.locator('.topic-card').count(),catalog.topics.length);
      assert.equal(await page.locator('.problem-links a').count(),catalog.problems.length);
    }
    assert.deepEqual(await page.locator('.recent-articles time').allTextContents(),catalog.featured.map(id=>catalog.articles.find(a=>a.id===id)).sort((a,b)=>b.addedOn.localeCompare(a.addedOn)||b.id-a.id).map(a=>a.addedOn));
    await page.locator('[data-skip]').focus();await page.keyboard.press('Enter');
    assert.ok(await page.evaluate(()=>document.activeElement.id==='main'));
    assert.ok(await page.evaluate(()=>location.hash==='#/README'));
    metrics.homeResources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.startsWith(location.origin)).map(r=>({name:new URL(r.name).pathname,bytes:r.encodedBodySize})));
    assert.ok(!metrics.homeResources.some(r=>r.name.endsWith('/mermaid.min.js')),'Homepage must not load Mermaid');
    await page.screenshot({path:path.join(shots,'home-desktop.png'),fullPage:true});
    for(const href of await page.locator('.problem-links a,.topic-card,.home-paths>a').evaluateAll(links=>links.map(a=>a.getAttribute('href')))){
      await go(href);assert.ok(!(await page.locator('.markdown-section h1').textContent()).includes('没有找到'));
      if(href.includes('/find'))await page.waitForFunction(()=>document.querySelector('.finder-results a'));
    }
    console.log('PASS: root/home, generated counts, dates, all problem/topic/path entry links');
    for(const a of catalog.articles){
      await article(a.id);
      assert.equal(await page.locator('.article-meta').count(),1);
      assert.equal(await page.locator('.markdown-section h1').count(),1);
      assert.equal(await page.locator('#gitalk-container').count(),1);
      assert.equal(await page.locator('.catalog-navigation>details[open]').count(),1);
      assert.equal(await page.locator('.catalog-navigation details a[aria-current]').getAttribute('href'),'#/docs/'+a.id);
      assert.equal(await page.locator('.breadcrumbs a').last().getAttribute('href'),'#/docs/topics?id=topic-'+a.topics[0]);
      assert.ok((await page.title()).includes(a.title));
      const source=fs.readFileSync(path.join(__dirname,'../docs/'+a.id+'.md'),'utf8');
      const diagrams=[...source.matchAll(/^```mermaid\s*$/gm)].length;
      if(diagrams)await page.waitForFunction(count=>document.querySelectorAll('.mermaid svg').length===count,diagrams);
      assert.equal(await page.locator('#article-schema').count(),1);
      await noOverflow('article '+a.id);
    }
    console.log('PASS: all numbered routes, Chinese headings, attribution, primary categories and diagrams');
    await article(110);
    assert.equal(await page.locator('pre[data-lang="sql"]').count(),10);
    assert.equal(await page.locator('pre[data-lang="text"]').count(),6);
    assert.ok((await page.locator('.article-meta').textContent()).includes('19rc1'));
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:path.join(shots,'110-desktop.png')});
    await go('#/docs/find?q='+encodeURIComponent('计划突变')+'&series=interpretation&type=conference');
    await page.waitForFunction(()=>document.querySelector('.finder-results a')?.getAttribute('href')==='#/docs/110');
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('.finder-results a')?.getAttribute('href')==='#/docs/110');
    assert.equal(await page.locator('[name=series]').inputValue(),'interpretation');
    assert.equal(await page.locator('[name=type]').inputValue(),'conference');
    await page.locator('.finder-results a').first().click();
    await page.waitForFunction(()=>document.querySelector('.article-id')?.textContent==='#110');
    await go('#/docs/12.md');assert.equal(await page.locator('.article-id').textContent(),'#12');
    await go('#/README?id=about-author');assert.equal(await page.locator('#about-author').count(),1);
    assert.ok(await page.evaluate(()=>location.hash.includes('id=about-author')));
    await go('#/docs/find?q=WAL暴涨');
    await page.waitForFunction(()=>document.querySelector('.finder-results a')?.getAttribute('href')==='#/docs/31');
    await go('#/docs/find?q='+encodeURIComponent('清理不掉'));
    await page.waitForFunction(()=>document.querySelector('#article-query')?.value==='清理不掉'&&document.querySelector('.finder-results a')?.getAttribute('href')==='#/docs/102');
    await go('#/docs/find?q=WAL暴涨');
    await page.waitForFunction(()=>document.querySelector('#article-query')?.value==='WAL暴涨'&&document.querySelector('.finder-results a')?.getAttribute('href')==='#/docs/31');
    await page.locator('.finder-results a').first().click();await page.locator('.article-meta').waitFor();
    await page.goBack();await page.waitForFunction(()=>document.querySelector('#article-query')?.value==='WAL暴涨');
    await page.reload();await page.waitForFunction(()=>document.querySelector('#article-query')?.value==='WAL暴涨');
    await page.locator('.finder-clear').click();
    assert.equal(await page.locator('.finder-results a').count(),20);
    await page.locator('.finder-more').click();assert.equal(await page.locator('.finder-results a').count(),40);
    await page.locator('.finder-advanced summary').click();
    await page.locator('[name=series]').selectOption('interpretation');
    await page.locator('[name=type]').selectOption('blog');
    await page.reload();await page.waitForFunction(()=>document.querySelector('[name=type]')?.value==='blog');
    assert.ok(await page.locator('.finder-advanced').getAttribute('open')!==null);
    assert.equal(await page.locator('.finder-results a').count(),catalog.articles.filter(a=>a.series==='interpretation'&&a.type==='blog').length);
    await page.locator('[name=topic]').selectOption('replication');
    assert.equal(await page.locator('.finder-results a').count(),1);
    assert.equal(await page.locator('.finder-results a').getAttribute('href'),'#/docs/109');
    await page.locator('.finder-clear').click();
    const times=[];
    for(const [query,id] of [['清理不掉',102],['备库查询取消',109],['递归去重',108],['热点账户',104],['WAL暴涨',31]]){
      const start=Date.now();await page.locator('#article-query').fill(query);
      await page.waitForFunction(id=>document.querySelector('.finder-results a')?.getAttribute('href')==='#/docs/'+id,id);
      times.push(Date.now()-start);
    }
    metrics.localSearchUiMilliseconds=times;
    await page.locator('#article-query').fill('work mem');
    await page.waitForFunction(()=>document.querySelector('.finder-results mark'));
    assert.ok((await page.locator('.finder-results').textContent()).toLowerCase().includes('work_mem'));
    await page.locator('#article-query').focus();await page.keyboard.press('ArrowDown');
    assert.ok(await page.evaluate(()=>document.activeElement.matches('.finder-results a')));
    await page.keyboard.press('Escape');assert.equal(await page.locator('#article-query').evaluate(e=>e===document.activeElement),true);
    await page.screenshot({path:path.join(shots,'search.png')});
    await page.locator('#article-query').fill('<img src=x onerror=alert(1)>');
    await page.waitForFunction(()=>document.querySelector('.finder-status')?.textContent.includes('没有找到'));
    assert.equal(await page.locator('.finder-results img,.finder-results script').count(),0);
    await page.screenshot({path:path.join(shots,'search-empty.png')});
    console.log('PASS: normalized highlights, excerpts, keyboard navigation, pagination, filters and history restoration');
    await article(109);
    await page.locator('.article-toc a').nth(2).click();
    await page.waitForFunction(()=>location.hash.includes('?id='));
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.article-meta').count(),1);
    assert.equal(await page.locator('.article-footer').count(),1);
    const target=await page.locator('.article-toc a').nth(2).getAttribute('data-heading');
    assert.ok(await page.locator('[id="'+target+'"]').evaluate(e=>e.getBoundingClientRect().top>=64),'Anchor behind header');
    const pre=page.locator('.code-block').first();
    const original=await pre.locator('pre code').textContent();
    await pre.locator('.code-copy').click();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),original);
    await page.locator('.reading-settings summary').click();
    await page.locator('[data-font="1"]').click();
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--reading-size').trim()),'17px');
    await page.locator('[data-font="reset"]').click();
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(shots,'article.png')});
    await go('#/docs/topics');await page.screenshot({path:path.join(shots,'topics.png')});
    await go('#/docs/does-not-exist');
    assert.equal(await page.locator('.markdown-section h1').textContent(),'没有找到这篇文章');
    assert.equal(await page.locator('.article-meta').count(),0);
    await page.screenshot({path:path.join(shots,'not-found.png')});
    console.log('PASS: TOC offsets, copy fidelity, font settings and recoverable 404');
    for(const width of metrics.viewports){
      await page.setViewportSize({width,height:900});
      for(const mode of ['light','dark']){
        await theme(mode);
        for(const route of ['#/README','#/docs/topics','#/docs/find?q=work_mem','#/docs/1','#/docs/5','#/docs/22','#/docs/98','#/docs/102','#/docs/109','#/docs/110','#/docs/111','#/docs/25']){
          await go(route);await noOverflow(width+' '+mode+' '+route);
          if(route.includes('/111'))await page.locator('.mermaid svg').waitFor();
          if(route.includes('/109')){
            await page.locator('.mermaid svg').waitFor();
            const table=page.locator('.table-scroll').first();
            if(width<768){
              await table.scrollIntoViewIfNeeded();
              assert.ok(await table.evaluate(e=>e.scrollWidth>e.clientWidth));
              await table.evaluate(e=>{e.scrollLeft=120;});assert.ok(await table.evaluate(e=>e.scrollLeft>0));await table.evaluate(e=>{e.scrollLeft=0;});
              const code=page.locator('pre[data-lang="sql"]').first();
              assert.ok(await code.evaluate(e=>e.scrollWidth>e.clientWidth));
              await code.evaluate(e=>{e.scrollLeft=100;});assert.ok(await code.evaluate(e=>e.scrollLeft>0));
            }
            if(width===390&&mode==='dark'){await table.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(shots,'article-mobile-dark.png')});}
          }
          if(route==='#/README'&&width===390){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(shots,mode==='light'?'home-mobile.png':'home-mobile-dark.png')});}
          if(route.includes('/110')){
            const table=page.locator('.table-scroll').first();
            if(width<768){
              await table.scrollIntoViewIfNeeded();
              assert.ok(await table.evaluate(e=>e.scrollWidth>e.clientWidth));
              await table.evaluate(e=>{e.scrollLeft=120;});
              assert.ok(await table.evaluate(e=>e.scrollLeft>0));
              await table.evaluate(e=>{e.scrollLeft=0;});
            }
            if([390,1440].includes(width)){
              await table.scrollIntoViewIfNeeded();
              await page.screenshot({path:path.join(shots,`110-${width}-${mode}-table.png`)});
              const result=page.locator('pre[data-lang="text"]').filter({hasText:'matched, inapplicable, failed'});
              await result.scrollIntoViewIfNeeded();
              if(width===390){
                assert.ok(await result.evaluate(e=>e.scrollWidth>e.clientWidth));
                await result.evaluate(e=>{e.scrollLeft=180;});
                assert.ok(await result.evaluate(e=>e.scrollLeft>0));
                await result.evaluate(e=>{e.scrollLeft=0;});
              }
              await page.screenshot({path:path.join(shots,`110-${width}-${mode}-feedback.png`)});
            }
          }
        }
      }
      if(width<1024){
        await go('#/README');
        await page.locator('#sidebar-toggle').click();
        await page.waitForFunction(()=>document.body.classList.contains('nav-open'));
        assert.ok(await page.locator('.sidebar').isVisible());
        assert.equal(await page.locator('.content').getAttribute('inert'),'');
        assert.ok(await page.evaluate(()=>document.activeElement.closest('.sidebar')));
        await page.locator('.sidebar-resources a').last().focus();await page.keyboard.press('Tab');
        assert.ok(await page.evaluate(()=>document.activeElement.matches('[data-close-nav]')));
        if(width===390)await page.screenshot({path:path.join(shots,'navigation-mobile.png')});
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#sidebar-toggle').getAttribute('aria-expanded'),'false');
        assert.ok(await page.evaluate(()=>document.activeElement.id==='sidebar-toggle'));
        await page.locator('#sidebar-toggle').click();await page.locator('.sidebar a[href="#/docs/find"]').click();
        await page.waitForFunction(()=>document.querySelector('.markdown-section')?.dataset.renderedRoute==='#/docs/find');
        assert.equal(await page.locator('#sidebar-toggle').getAttribute('aria-expanded'),'false');
      }
    }
    console.log('PASS: six viewport widths, both themes, wide SQL/table local scrolling and accessible drawer');
    await page.setViewportSize({width:1440,height:1000});
    await go('#/docs/about');await page.locator('.markdown-section [data-dialog="communityModal"]').click();
    assert.ok(await page.locator('#communityModal').evaluate(e=>e.open));
    await page.keyboard.press('Escape');
    assert.ok(await page.locator('.markdown-section [data-dialog="communityModal"]').evaluate(e=>e===document.activeElement));
    await page.locator('.markdown-section [data-dialog="imageModal"]').click();
    await page.locator('#imageModal [data-close-dialog]').click();
    await article(42);
    const image=page.locator('img[data-zoomable]').first();await image.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.querySelector('img[data-zoomable]')?.naturalWidth>0);
    metrics.technicalImage=await image.evaluate(e=>({url:e.currentSrc,width:e.naturalWidth,height:e.naturalHeight}));
    await image.press('Enter');await page.locator('#image-viewer').waitFor();
    assert.ok(await page.locator('#image-viewer').evaluate(e=>e.open));
    assert.equal(await page.locator('#image-viewer img').getAttribute('src'),metrics.technicalImage.url);
    await page.screenshot({path:path.join(shots,'image-viewer.png')});
    await page.keyboard.press('Escape');assert.ok(await image.evaluate(e=>e===document.activeElement));
    await article(109);await page.keyboard.press('Control+k');await page.locator('#article-query').waitFor();
    assert.ok(await page.locator('#article-query').evaluate(e=>e===document.activeElement));
    const fallback=await browser.newContext();
    await fallback.route(/busuanzi/,r=>r.abort());
    await fallback.route('**/data/search-index.json*',r=>r.abort());
    const offline=await fallback.newPage();
    await offline.goto(base+'#/docs/find?q=WAL暴涨');
    await offline.waitForFunction(()=>document.querySelector('.finder-status')?.textContent.includes('全文索引暂不可用'));
    assert.equal(await offline.locator('.finder-results a').first().getAttribute('href'),'#/docs/31');
    await offline.screenshot({path:path.join(shots,'search-failed.png')});
    await fallback.unroute('**/data/search-index.json*');await offline.locator('.finder-retry').click();
    await offline.waitForFunction(()=>!document.querySelector('.finder-status')?.textContent.includes('索引'));
    await fallback.close();
    const slow=await browser.newContext();await slow.route(/busuanzi/,r=>r.abort());
    await slow.route('**/data/search-index.json*',async r=>{await new Promise(resolve=>setTimeout(resolve,500));await r.continue();});
    const loading=await slow.newPage();await loading.goto(base+'#/docs/find?q=work_mem');
    await loading.waitForFunction(()=>document.querySelector('.finder-status')?.textContent.includes('正在加载全文索引'));
    await loading.waitForFunction(()=>!document.querySelector('.finder-status')?.textContent.includes('索引'));await slow.close();
    assert.deepEqual(errors,[],'Unexpected page errors');
    fs.writeFileSync(path.join(shots,'metrics.json'),JSON.stringify(metrics,null,2)+'\n');
    await context.close();
    console.log('PASS: native dialogs, global search shortcut, index failure fallback/retry; screenshots and measured local metrics saved');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
