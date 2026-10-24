// Independent browser capture and visual regression; no personal browser state.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const catalog = require('../data/articles.json');
const root = path.resolve(__dirname, '..');
const base = process.env.HOWTO_URL || 'http://127.0.0.1:4176/';
const phase = process.env.HOWTO_PHASE || 'after';
const output = path.resolve(process.env.HOWTO_SCREENSHOTS || path.join(root, 'docs/v2.2', phase));

(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
  const metrics = {phase, base, viewports:[1440,1280,1024,768,390,360], themes:[], logo:[], codeFonts:[]};
  const errors = [];
  try {
    for (const mode of ['light','dark']) {
      const context = await browser.newContext({viewport:{width:1440,height:1000}, colorScheme:mode});
      await context.route(/busuanzi/, r => r.abort());
      await context.addInitScript(mode => localStorage.setItem('howto-theme',mode), mode);
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      async function go(route, width=1440) {
        await page.setViewportSize({width,height:width<768?900:1000});
        await page.goto(new URL(route,base).href,{waitUntil:'domcontentloaded'});
        await page.locator('.markdown-section h1').first().waitFor();
        if (!route.startsWith('/articles/')) await page.waitForFunction(() => document.querySelector('.markdown-section')?.dataset.renderedRoute===location.hash);
        await page.waitForTimeout(150);
      }
      async function capture(name, fullPage=false) {
        await page.waitForTimeout(550);
        await page.screenshot({path:path.join(output,name+'.png'),fullPage});
      }
      await go('#/README');
      const decorativeArrows = await page.locator('.site-header .icon-arrow-up-right,.markdown-section .icon-arrow-up-right,.section-heading [aria-hidden]').count();
      metrics.themes.push({mode,decorativeArrows});
      await capture('home-desktop-'+mode,true);
      await page.locator('.site-header').screenshot({path:path.join(output,'header-desktop-'+mode+'.png')});
      await page.locator('[aria-labelledby="home-recent"]').screenshot({path:path.join(output,'recent-'+mode+'.png')});
      if (phase==='after') {
        assert.equal(decorativeArrows,0,'No decorative arrows on the homepage/header');
        assert.equal(await page.locator('.section-eyebrow,.topic-index,.path-number').count(),0);
        assert.equal(await page.locator('.topic-card').count(),catalog.topics.length);
        assert.equal(await page.locator('.home-paths > a').count(),catalog.paths.length);
        const visible=page.locator('.site-brand img:visible');
        assert.equal(await visible.count(),1);
        await visible.evaluate(img=>img.decode());
        assert.ok((await visible.getAttribute('src')).includes(mode==='dark'?'symbol-dark.svg':'symbol.svg'));
        for(const href of [await page.locator('link[type="image/svg+xml"]').getAttribute('href'),await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'),await page.locator('meta[property="og:image"]').getAttribute('content')]){
          const url=new URL(href,page.url());
          assert.equal((await context.request.get(new URL(url.pathname+url.search,base).href)).status(),200,'Brand asset '+href);
        }
      }
      for (const width of metrics.viewports) {
        for (const route of ['#/README','#/docs/topics','#/docs/paths','#/docs/find?q=work_mem','#/docs/105','/articles/109/']) {
          await go(route,width);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1),mode+' '+width+' '+route);
          assert.ok(await page.locator('.site-brand').evaluate(e => {
            const a=e.getBoundingClientRect(), b=document.querySelector('.header-tools').getBoundingClientRect();
            return a.right<=b.left+1 && a.top>=0 && a.bottom<=64;
          }),'Header brand/tools overlap: '+mode+' '+width);
        }
      }
      await go('#/README',390);await capture('home-mobile-'+mode,true);
      await page.locator('.site-header').screenshot({path:path.join(output,'header-mobile-'+mode+'.png')});
      await go('#/docs/topics');await capture('topics-'+mode,true);
      await go('#/docs/paths');await capture('paths-'+mode,true);
      await go('#/docs/105');await capture('long-article-'+mode);
      await go('/articles/105/');await page.locator('.mermaid svg').first().waitFor();await capture('static-article-'+mode);
      await go('#/docs/1');await page.locator('.code-block').first().scrollIntoViewIfNeeded();await capture('explain-'+mode);
      const session=await context.newCDPSession(page);
      await session.send('DOM.enable');await session.send('CSS.enable');
      const {root:document}=await session.send('DOM.getDocument');
      const {nodeId}=await session.send('DOM.querySelector',{nodeId:document.nodeId,selector:'.code-block pre code'});
      metrics.codeFonts.push({mode,...await session.send('CSS.getPlatformFontsForNode',{nodeId})});
      await session.detach();
      await go('#/docs/98',390);await page.locator('table').first().scrollIntoViewIfNeeded();await capture('table-mobile-'+mode);
      await go('#/docs/find?q=work_mem');await page.locator('.finder-results mark').first().waitFor();await capture('search-'+mode);
      await context.close();
    }
    for (const scale of [1,2]) {
      const context = await browser.newContext({viewport:{width:900,height:460},deviceScaleFactor:scale});
      const page = await context.newPage();
      const light = phase==='before'?'images/favicon.png':'images/brand/symbol.svg';
      const dark = phase==='before'?light:'images/brand/symbol-dark.svg';
      await page.goto(base);
      await page.setContent('<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;font:14px system-ui}.row{height:180px;display:flex;align-items:center;gap:44px;padding:24px 40px}.row>div{width:90px;height:116px;display:grid;grid-template-rows:80px 24px;align-items:center;justify-items:center;gap:12px}.light{background:#fff;color:#262b33}.dark{background:#181c21;color:#e8ebee}img{display:block}</style></head><body>'+[['light',light],['dark',dark]].map(([theme,file])=>'<div class="row '+theme+'">'+[16,24,32,48,64].map(size=>'<div><img src="'+new URL(file,base).href+'" width="'+size+'" height="'+size+'" alt="'+theme+' '+size+'"><span>'+size+'px</span></div>').join('')+'</div>').join('')+'</body></html>');
      await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
      const pixels = await page.locator('img').evaluateAll(imgs=>imgs.map(img=>{
        const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
        const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,img.width,img.height);
        const data=ctx.getImageData(0,0,img.width,img.height).data;
        let occupied=0;for(let i=3;i<data.length;i+=4)if(data[i]>128)occupied++;
        return {size:img.width,source:img.getAttribute('src'),occupied,total:img.width*img.height};
      }));
      if (phase==='after') for(const p of pixels) assert.ok(p.occupied>p.total*.2 && p.occupied<p.total*.8,'Nonblank, unframed vector symbol '+p.size);
      metrics.logo.push({deviceScaleFactor:scale,pixels});
      await page.screenshot({path:path.join(output,'logo-sizes-'+scale+'x.png')});
      await context.close();
    }
    if (phase==='after') {
      const lockups=await browser.newContext({viewport:{width:740,height:240},deviceScaleFactor:2});
      const preview=await lockups.newPage();
      await preview.setContent('<!doctype html><style>*{box-sizing:border-box}body{margin:0}section{height:120px;display:flex;align-items:center;padding:32px}section+section{background:#181c21}svg{height:48px;width:316px;display:block}</style>'+['logo.svg','logo-dark.svg'].map(file=>'<section>'+fs.readFileSync(path.join(root,'images/brand',file),'utf8')+'</section>').join(''));
      const bounds=await preview.locator('svg text').evaluateAll(nodes=>nodes.map(t=>{const b=t.getBBox(),r=t.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,viewWidth:t.ownerSVGElement.viewBox.baseVal.width,top:r.top,bottom:r.bottom};}));
      for(const box of bounds)assert.ok(box.width>0&&box.x+box.width<=box.viewWidth&&box.top>=0&&box.bottom<=240,'Complete visible wordmark');
      await preview.screenshot({path:path.join(output,'logo-lockups.png')});
      fs.writeFileSync(path.join(output,'logo-lockups.json'),JSON.stringify({browser:browser.version(),bounds},null,2)+'\n');
      await lockups.close();
      const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
      await context.route(/busuanzi/,r=>r.abort());
      await context.addInitScript(()=>{window.anchorTweenCalls=0;const original=window.scrollTo;window.scrollTo=function(...args){window.anchorTweenCalls++;return original.apply(this,args);};});
      const page=await context.newPage();
      await page.goto(base+'#/docs/105');await page.locator('.article-toc a').nth(2).waitFor();
      const id=await page.locator('.article-toc a').nth(2).getAttribute('data-heading');
      await page.locator('.article-toc a').nth(2).click();
      await page.waitForFunction(id=>{const y=document.getElementById(id)?.getBoundingClientRect().top;return y>=64&&y<190;},id);
      await page.waitForTimeout(550);assert.equal(await page.evaluate(()=>window.anchorTweenCalls),0,'Reduced-motion anchor must not start Docsify tween');
      await page.reload();await page.locator('.article-meta').waitFor();
      await page.waitForFunction(id=>{const y=document.getElementById(id)?.getBoundingClientRect().top;return y>=64&&y<190;},id);
      await page.waitForTimeout(550);assert.equal(await page.evaluate(()=>window.anchorTweenCalls),0,'Reduced-motion refresh must not start Docsify tween');
      metrics.reducedMotion={anchorAndRefresh:true,javascriptTweenCalls:0};
      await context.close();
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify(metrics,null,2)+'\n');
    console.log('PASS: V2.2 '+phase+' captures, six widths, both themes, brand alignment and logo pixel checks');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
