const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
(async()=>{
  const base=process.env.HOWTO_URL||'http://127.0.0.1:4176/',out=path.resolve(process.env.HOWTO_SCREENSHOTS||'docs/visual-qa/details');fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const result={browser:browser.version(),base,fonts:[],images:[],navigation:[]};
  try{
    for(const mode of ['light','dark'])for(const width of [1440,390]){
      const c=await browser.newContext({viewport:{width,height:width===1440?900:844},colorScheme:mode,deviceScaleFactor:width===1440?2:3});
      await c.route(/busuanzi/,r=>r.abort());await c.addInitScript(mode=>localStorage.setItem('howto-theme',mode),mode);
      const p=await c.newPage();
      const go=async route=>{await p.goto(base+route);await p.waitForFunction(()=>document.querySelector('.markdown-section')?.dataset.renderedRoute===location.hash);await p.waitForTimeout(700);};
      await go('#/README');
      await p.locator('.site-header').screenshot({path:path.join(out,'header-'+width+'-'+mode+'.png')});
      const session=await c.newCDPSession(p);await session.send('DOM.enable');await session.send('CSS.enable');
      const fonts=async selector=>{const {root}=await session.send('DOM.getDocument');const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector});return session.send('CSS.getPlatformFontsForNode',{nodeId});};
      result.fonts.push({mode,width,heading:await fonts('.home-hero h1'),chinese:await fonts('.home-hero__lead')});
      const topic=p.locator('.topic-card').first();await topic.hover();
      result.navigation.push({mode,width,topicHover:await topic.locator('strong').evaluate(e=>({color:getComputedStyle(e).color,decoration:getComputedStyle(e).textDecorationLine}))});
      await topic.focus();assert.notEqual(await topic.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
      await go('#/docs/1');result.fonts.push({mode,width,code:await fonts('pre[data-code-kind="plan"] code')});
      await go('#/docs/42');const img=p.locator('img[data-zoomable]').first();await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.decode());
      const geometry=await img.evaluate(e=>({natural:[e.naturalWidth,e.naturalHeight],display:[e.getBoundingClientRect().width,e.getBoundingClientRect().height],src:e.currentSrc}));
      assert.ok(Math.abs(geometry.natural[0]/geometry.natural[1]-geometry.display[0]/geometry.display[1])<.01);
      result.images.push({mode,width,...geometry});await p.screenshot({path:path.join(out,'technical-image-'+width+'-'+mode+'.png'),scale:'css'});
      await go('#/docs/105');await p.locator('.mermaid svg').waitFor();
      if(width===1440){
        await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(150);
        await p.screenshot({path:path.join(out,'long-full-'+mode+'.png'),fullPage:true,scale:'css'});
      }
      await p.locator('.article-footer').scrollIntoViewIfNeeded();
      await p.screenshot({path:path.join(out,'article-footer-'+width+'-'+mode+'.png'),scale:'css'});
      const next=p.locator('.article-neighbors a').last(),href=await next.getAttribute('href');await next.click();
      await p.waitForFunction(()=>document.querySelector('.markdown-section')?.dataset.renderedRoute===location.hash);
      assert.ok(p.url().endsWith(href));result.navigation.push({mode,width,neighbor:href});
      if(width===1440&&mode==='light'){
        result.seo=await p.evaluate(async()=>{
          const xml=new DOMParser().parseFromString(await (await fetch('/sitemap.xml')).text(),'application/xml');
          const urls=[...xml.querySelectorAll('loc')].map(e=>e.textContent);
          return {sitemapUrls:urls.length,unique:new Set(urls).size,fragmentUrls:urls.filter(u=>u.includes('#')),canonical:document.querySelector('link[rel=canonical]').href};
        });
        assert.equal(result.seo.sitemapUrls,111);assert.equal(result.seo.unique,111);assert.deepEqual(result.seo.fragmentUrls,[]);
        const response=await c.request.get(base+'articles/99999/');assert.equal(response.status(),404);result.seo.missingStaticStatus=response.status();
      }
      await c.close();
    }
    console.log('PASS: actual platform fonts, technical image aspect ratios, hover/focus, neighbor links, sitemap and real 404');
  }finally{fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify(result,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
