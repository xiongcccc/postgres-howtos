// Optional browser smoke test: PLAYWRIGHT_PACKAGE points to an installed playwright.
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const catalog=require('../data/articles.json');
const base=process.env.HOWTO_URL || 'http://127.0.0.1:4175/';
const shots=process.env.HOWTO_SCREENSHOTS || '/tmp/howto-reading-checks';
(async()=>{
  fs.mkdirSync(shots,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try {
    const context=await browser.newContext({viewport:{width:1536,height:960}});
    await context.route(/busuanzi|gitalk|api\.github\.com/,r=>r.abort());
    await context.addInitScript(()=>{
      window.commentRenders=[];
      window.Gitalk=function(config){this.render=function(id){window.commentRenders.push(config.id);document.getElementById(id).textContent='Test discussion';};};
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'networkidle'});
    await page.locator('.cover.show .cover-actions').waitFor();
    await page.screenshot({path:path.join(shots,'restored-cover.png')});
    await page.locator('.cover-actions a').first().click();
    await page.locator('#article-query').waitFor();
    assert.equal(await page.locator('.cover.show').count(),0);
    assert.equal(await page.locator('#gitalk-container').count(),0);
    assert.equal(await page.locator('select[name=type] option[value=editorial]').count(),0);
    assert.deepEqual(await page.locator('.recent-articles time').allTextContents(),['2026-09-10','2026-09-10','2026-05-20','2026-05-17']);
    await page.locator('.author-profile').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(shots,'author-profile.png')});
    assert.equal(await page.locator('.home-hero h1').textContent(),'PostgreSQL Howto 中文版');
    const homeLinks=await page.locator('.home-actions a[href^="#"],.problem-links a').evaluateAll(as=>as.map(a=>a.getAttribute('href')));
    for(const href of homeLinks){
      await page.goto(base+href);
      if(href.includes('/find'))await page.waitForFunction(()=>document.querySelector('.finder-results a'));
      else await page.waitForFunction(()=>document.querySelector('.markdown-section')?.textContent && !document.querySelector('.markdown-section')?.textContent.includes('404 - Not found'));
    }
    for(const a of catalog.articles){
      await page.goto(base+'#/docs/'+a.id);
      await page.waitForFunction(title=>document.querySelector('.markdown-section h1')?.textContent===title && document.title.includes(title) && document.querySelector('.article-meta'),a.title);
      assert.ok((await page.title()).includes(a.title),'Browser title: '+a.id);
      assert.equal(await page.locator('.article-meta').count(),1);
      assert.equal(await page.locator('#gitalk-container').count(),1);
    }
    console.log('PASS: all 100 article routes, Chinese headings and metadata; homepage entry routes');
    await page.goto(base+'#/docs/100');
    await page.waitForFunction(()=>document.querySelectorAll('.mermaid svg').length===2);
    await page.locator('.article-toc a').nth(2).click();
    await page.waitForFunction(()=>location.hash.includes('?id='));
    assert.ok(await page.locator('.article-toc').isVisible());
    await page.screenshot({path:path.join(shots,'desktop-article.png')});
    await page.goto(base+'#/docs/find?q=WAL暴涨');
    await page.waitForFunction(()=>document.querySelector('.finder-results a')?.getAttribute('href')==='#/docs/31');
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#article-query')?.value==='WAL暴涨');
    await page.locator('#article-query').fill('PreCommit_Notify');
    await page.waitForFunction(()=>document.querySelector('.finder-results a')?.getAttribute('href')==='#/docs/100');
    await page.locator('#article-query').fill('NoMatchxyz987654321');
    await page.waitForFunction(()=>document.querySelector('.finder-status')?.textContent.includes('没有找到'));
    console.log('PASS: alias/full-text search, reload query, empty results and TOC navigation');
    await page.goto(base+'#/README');
    await page.waitForFunction(()=>document.querySelector('.home-hero'));
    assert.equal(await page.locator('#gitalk-container').count(),0);
    await page.screenshot({path:path.join(shots,'desktop-home.png')});
    for(const width of [390,768,1280]){
      await page.setViewportSize({width,height:844});
      for(const route of ['#/README','#/docs/100']){
        await page.goto(base+route);
        await page.waitForFunction(()=>document.querySelector('.reading-controls #switchLightDarkModeDivBeforeArticle'));
        // The existing theme control cycles auto -> light -> dark.
        for(let n=0;n<3 && !(await page.locator('body').evaluate(b=>b.classList.contains('dark')));n++){
          await page.locator('#switchLightDarkModeDivBeforeArticle').click();
          await page.waitForTimeout(650);
        }
        assert.ok(await page.locator('body').evaluate(b=>b.classList.contains('dark')));
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        if(width<=768)assert.ok(await page.evaluate(()=>document.querySelector('.app-nav').getBoundingClientRect().bottom<=document.querySelector('.reading-controls').getBoundingClientRect().top),'Mobile navigation overlaps controls');
        if(route.includes('/100')){
          const scroller=page.locator('.table-scroll').first();
          await scroller.scrollIntoViewIfNeeded();
          if(width===390){
            assert.ok(await scroller.evaluate(e=>e.scrollWidth>e.clientWidth));
            await scroller.evaluate(e=>{e.scrollLeft=150;});
            assert.ok(await scroller.evaluate(e=>e.scrollLeft>0));
          }
        }
        await page.screenshot({path:path.join(shots,`${width}-${route.includes('100')?'table':'home'}-dark.png`)});
      }
    }
    console.log('PASS: dark mode, 390/768/1280 widths and mobile table scrolling');
    assert.deepEqual(errors,[],'Unexpected page errors');
    await context.close();
    const offline=await browser.newContext();
    await offline.route(/busuanzi|gitalk|api\.github\.com/,r=>r.abort());
    await offline.route('**/data/search-index.json*',r=>r.abort());
    const fallback=await offline.newPage();
    await fallback.goto(base+'#/docs/find?q=WAL暴涨');
    await fallback.waitForFunction(()=>document.querySelector('.finder-status')?.textContent.includes('全文索引暂不可用'));
    assert.equal(await fallback.locator('.finder-results a').first().getAttribute('href'),'#/docs/31');
    await offline.unroute('**/data/search-index.json*');
    await fallback.locator('.finder-retry').click();
    await fallback.waitForFunction(()=>!document.querySelector('.finder-status')?.textContent.includes('索引'));
    console.log('PASS: failed index falls back to metadata search; retry restores full text');
    await offline.close();
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
