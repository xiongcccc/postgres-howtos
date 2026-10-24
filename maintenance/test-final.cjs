// Focused post-release regression for static discovery, bootstrap, metadata and search semantics.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const catalog=require('../data/articles.json');
const base=process.env.HOWTO_URL||'http://127.0.0.1:4176/';
const output=path.resolve(process.env.HOWTO_SCREENSHOTS||'docs/visual-qa/final/focused');
fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const result={base,browser:browser.version(),noJS:[],discovery:[],queries:[],bootstrap:[],lab:[],errors:[]};
  try{
    for(const width of [1440,390]){
      const c=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:width===1440?900:844}}),p=await c.newPage();
      for(const route of ['/','/topics/','/paths/','/articles/']){
        const response=await p.goto(new URL(route,base).href);assert.equal(response.status(),200);
        assert.equal(await p.locator('#main').count(),1);assert.equal(await p.locator('h1').count(),1);
        assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        if(route==='/'){
          assert.equal(await p.locator('.topic-card').count(),catalog.topics.length);
          assert.equal(await p.locator('.home-paths>a').count(),catalog.paths.length);
        }
        await p.screenshot({path:path.join(output,'no-js-'+(route==='/'?'home':route.split('/')[1])+'-'+width+'.png'),fullPage:width===1440,scale:'css'});
        result.noJS.push({width,route,status:response.status(),main:true});
      }
      await p.goto(base);await p.locator('.topic-card').first().click();
      assert.ok(p.url().includes('/topics/#topic-'));const topicId=decodeURIComponent(new URL(p.url()).hash.slice(1));
      assert.ok(await p.locator('[id="'+topicId+'"]').evaluate(e=>e.getBoundingClientRect().top>=64));
      await p.goto(base);await p.locator('.home-paths>a').first().click();assert.ok(p.url().includes('/paths/#path-'));
      await c.close();
    }
    for(const mode of ['light','dark'])for(const width of [1440,390]){
      const c=await browser.newContext({viewport:{width,height:width===1440?900:844},colorScheme:mode,
        ...(width===390?{isMobile:true,hasTouch:true,deviceScaleFactor:3}:{}),permissions:['clipboard-read','clipboard-write']});
      await c.route(/busuanzi/,r=>r.abort());await c.addInitScript(mode=>localStorage.setItem('howto-theme',mode),mode);
      const p=await c.newPage();p.on('pageerror',e=>result.errors.push(e.message));
      const go=async route=>{
        await p.goto(new URL(route,base).href);await p.locator('.markdown-section h1').waitFor();
        if(route.startsWith('#'))await p.waitForFunction(()=>document.querySelector('.markdown-section')?.dataset.renderedRoute===location.hash);
      };
      for(const name of ['topics','paths']){
        await go('/'+name+'/');
        assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'),'https://postgres-howto.cn/'+name+'/');
        assert.equal(await p.locator('.app-nav [aria-current=page]').getAttribute('href'),'/'+name+'/');
        assert.equal(await p.locator('meta[name=robots]').count(),0);
        assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        if(width===390){await p.locator('#sidebar-toggle').tap();assert.equal(await p.locator('#sidebar-toggle').getAttribute('aria-expanded'),'true');await p.keyboard.press('Escape');}
        await p.screenshot({path:path.join(output,'static-'+name+'-'+width+'-'+mode+'.png'),scale:'css'});
        await p.keyboard.press('Control+k');await p.waitForURL(/#\/docs\/find/);await p.locator('#article-query').waitFor();
        assert.ok(await p.locator('#article-query').evaluate(e=>e===document.activeElement));
        await go('#/docs/'+name);
        assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'),'https://postgres-howto.cn/'+name+'/');
        assert.equal(await p.locator('meta[name=robots]').count(),0);
        result.discovery.push({width,mode,name,static:true,legacy:true,canonical:true,shortcut:true});
      }
      await go('#/docs/find');
      for(const [query,id] of [['work_mem',92],['pg_stat_statements',5],['EXPLAIN BUFFERS',1],['autovacuum',102],['xmin',45],['replication lag',93],['WAL',31],['锁等待',42],['索引膨胀',46],['vacuum freeze',44],['WORK_MEM',92],['pg stat statements',5],['锁 等待',42]]){
        await p.locator('#article-query').fill(query);
        await p.waitForFunction(({query,id})=>new URLSearchParams(location.hash.split('?')[1]).get('q')===query&&Boolean(document.querySelector('.finder-results a[href="#/docs/'+id+'"]')),{query,id});
        await p.waitForFunction(()=>!document.querySelector('.finder-status').textContent.includes('正在加载'));
        assert.equal(await p.locator('.finder-retry').isVisible(),false);result.queries.push({width,mode,query,id});
      }
      await p.locator('#article-query').fill('work_mem');await p.waitForFunction(()=>new URLSearchParams(location.hash.split('?')[1]).get('q')==='work_mem');
      const excerpt=p.locator('.finder-results li').filter({has:p.locator('a[href="#/docs/13"]')}).locator('p');
      await excerpt.waitFor();assert.ok((await excerpt.textContent()).includes('"差异"'));assert.ok(!(await excerpt.textContent()).includes('&quot;'));
      await p.screenshot({path:path.join(output,'search-'+width+'-'+mode+'.png'),fullPage:width===1440,scale:'css'});
      await p.locator('#article-query').fill('<img src=x onerror=alert(1)>');
      await p.waitForFunction(()=>document.querySelector('.finder-status').textContent.startsWith('没有找到'));
      assert.equal(await p.locator('.finder-results img').count(),0);
      await go('#/docs/1');const copy=p.locator('.code-copy').first(),code=p.locator('.code-block pre code').first();
      const literal=await code.textContent();await copy.focus();await copy.press('Enter');
      assert.equal(await p.evaluate(()=>navigator.clipboard.readText()),literal);assert.equal(await copy.getAttribute('aria-label'),'代码已复制');
      await go('#/README');await p.locator('.site-footer').scrollIntoViewIfNeeded();await p.locator('.site-brand').click();
      await p.waitForFunction(()=>scrollY<5);assert.equal(await p.locator('#main').count(),1);assert.equal(await p.locator('.home-prerender').count(),0);
      await c.close();
    }
    for(const route of ['#/README','#/docs/42']){
      const c=await browser.newContext({viewport:{width:390,height:844}});await c.route(/busuanzi/,r=>r.abort());
      const p=await c.newPage();p.on('pageerror',e=>result.errors.push(e.message));
      let release;const gate=new Promise(resolve=>{release=resolve;});
      await p.route('**/vendor/docsify.min.js',async r=>{await gate;await r.continue();});
      try{
        await p.goto(new URL(route,base).href,{waitUntil:'commit'});
        const home=route.includes('README');
        if(home){await p.locator('.home-prerender h1').waitFor();assert.equal(await p.locator('.route-loading').isVisible(),false);}
        else{await p.locator('.route-loading').waitFor();assert.equal(await p.locator('.home-prerender').isVisible(),false);}
        await p.screenshot({path:path.join(output,'delayed-'+(home?'home':'article')+'.png'),scale:'css'});
        release();await p.waitForFunction(()=>document.querySelector('.markdown-section')?.dataset.renderedRoute===location.hash);
        assert.equal(await p.locator('#main').count(),1);assert.equal(await p.locator('.markdown-section h1').count(),1);
        assert.equal(await p.locator('.home-prerender').count(),0);result.bootstrap.push({route,initialContent:home?'home':'loading',noFlash:true,noDuplicate:true});
      }finally{release();await c.close();}
    }
    for(const width of [1440,390]){
      const c=await browser.newContext({viewport:{width,height:1000}});await c.route(/busuanzi/,r=>r.abort());
      await c.addInitScript(()=>{
        window.lab={cls:0,lcp:0};
        new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.lab.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
        new PerformanceObserver(list=>{for(const e of list.getEntries())window.lab.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
      });
      const p=await c.newPage();await p.goto(base);await p.waitForFunction(()=>!document.body.hasAttribute('data-loading'));
      await p.waitForTimeout(1000);
      const metrics=await p.evaluate(()=>({...window.lab,width:innerWidth,conditions:'Local Chrome, 1000px height, no throttling, independent profile, 1s after content; not field CWV'}));
      result.lab.push(metrics);assert.ok(metrics.cls<0.1,'Home bootstrap layout shift: '+JSON.stringify(metrics));await c.close();
    }
    assert.deepEqual(result.errors,[]);
    console.log('PASS: no-JS discovery, four responsive/theme sets, 13 search queries per set, safe excerpts, keyboard copy and delayed Docsify takeover');
  }finally{fs.writeFileSync(path.join(output,'focused.json'),JSON.stringify(result,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
