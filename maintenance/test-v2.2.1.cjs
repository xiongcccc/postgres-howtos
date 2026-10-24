// Scoped image-reading and keyboard-focus regression; screenshots use real article images.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const base = process.env.HOWTO_URL || 'http://127.0.0.1:4176/';
const output = path.resolve(process.env.HOWTO_SCREENSHOTS || 'docs/visual-qa/v2.2.1/reading');
const sizes = [[1440,900],[1280,800],[1024,768],[768,1024],[390,844],[360,800]];
fs.mkdirSync(output, {recursive:true});

(async () => {
  const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const result = {base,browser:browser.version(),cases:[],fixtures:[],errors:[],consoleErrors:[],httpErrors:[]};
  try {
    for (const mode of ['light','dark']) for (const [width,height] of sizes) {
      const context = await browser.newContext({viewport:{width,height},colorScheme:mode,
        ...(width<768?{isMobile:true,hasTouch:true,deviceScaleFactor:3}:{})});
      await context.route(/busuanzi/, r=>r.abort());
      await context.addInitScript(mode=>localStorage.setItem('howto-theme',mode), mode);
      const page = await context.newPage();
      page.on('pageerror', e=>result.errors.push(e.message));
      page.on('console', m=>{if(m.type()==='error'&&!/ERR_FAILED|busuanzi/.test(m.text()))result.consoleErrors.push(m.text());});
      page.on('response', r=>{if(r.status()>=400)result.httpErrors.push({url:r.url(),status:r.status()});});
      const suffix = width+'x'+height+'-'+mode;
      const viewer = page.locator('#image-viewer');
      const viewport = page.locator('.image-viewport');
      const toggle = page.locator('[data-image-size]');
      const geometry = () => viewer.evaluate(e=>{
        const img=e.querySelector('img'),v=e.querySelector('.image-viewport');
        return {natural:[img.naturalWidth,img.naturalHeight],image:img.getBoundingClientRect().toJSON(),
          dialog:e.getBoundingClientRect().toJSON(),toolbar:e.querySelector('.image-viewer-toolbar').getBoundingClientRect().toJSON(),
          viewport:{width:v.clientWidth,height:v.clientHeight,scrollWidth:v.scrollWidth,scrollHeight:v.scrollHeight,scrollLeft:v.scrollLeft},
          original:e.dataset.original,pageWidth:document.documentElement.scrollWidth};
      });
      const fits = state => {
        assert.ok(state.dialog.left>=0&&state.dialog.right<=width&&state.dialog.top>=0&&state.dialog.bottom<=height,'Dialog viewport fit');
        assert.ok(state.image.width<=state.viewport.width&&state.image.height<=state.viewport.height,'Fit image stays inside region');
        assert.ok(Math.abs(state.image.width/state.image.height-state.natural[0]/state.natural[1])<.01,'Uncropped original aspect ratio');
        assert.ok(state.pageWidth<=width+1,'No page-level overflow');
      };
      for (const route of ['#/docs/42','articles/42/']) {
        await page.goto(new URL(route,base).href);
        const image = page.locator('img[data-zoomable]').first();
        await image.waitFor({state:'attached'});await image.evaluate(async e=>{e.scrollIntoView();await e.decode();});
        const inline = await image.evaluate(e=>e.getBoundingClientRect().width);
        await image.press('Enter');await viewer.locator('img').evaluate(e=>e.decode());
        await page.waitForFunction(()=>!document.querySelector('[data-image-size]').disabled);
        const fit = await geometry();fits(fit);
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-pressed'),'true');
        assert.equal(await toggle.getAttribute('aria-label'),'适应窗口');
        const original = await geometry();
        assert.equal(original.image.width,original.natural[0],'Natural CSS-pixel image width');
        assert.ok(original.viewport.scrollWidth>original.viewport.width,'Local horizontal pan available');
        assert.ok(original.toolbar.top>=0&&original.toolbar.bottom<=height,'Controls remain visible');
        assert.ok(original.pageWidth<=width+1,'Large image does not widen document');
        await viewport.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);
        assert.ok((await geometry()).viewport.scrollLeft>0,'Native keyboard pan');
        let touch = null;
        if (width<768) {
          await viewport.evaluate(e=>e.scrollTo(0,0));
          const session=await context.newCDPSession(page),box=await viewport.boundingBox();
          const x=box.x+box.width-24,y=box.y+80;
          await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
          for(let i=1;i<=8;i++){
            await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-(box.width-60)*i/8,y}]});
            await page.waitForTimeout(25);
          }
          await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
          await page.waitForTimeout(250);touch=(await geometry()).viewport.scrollLeft;
          assert.ok(touch>0,'Real CDP touch events pan image region');await session.detach();
        }
        if(route.startsWith('#')&&[1440,390,360].includes(width)){
          await viewport.evaluate(e=>e.scrollTo(0,0));
          await page.screenshot({path:path.join(output,'image-original-'+suffix+'.png'),scale:'css'});
        }
        await toggle.click();const reset=await geometry();fits(reset);assert.equal(reset.viewport.scrollLeft,0);
        if(route.startsWith('#')&&[1440,390].includes(width))await page.screenshot({path:path.join(output,'image-fit-'+suffix+'.png'),scale:'css'});
        await page.keyboard.press('Escape');assert.equal(await viewer.evaluate(e=>e.open),false);
        assert.ok(await image.evaluate(e=>e===document.activeElement),'Escape returns focus');
        await image.press('Space');assert.equal(await viewer.getAttribute('data-original'),'false');
        await toggle.click();await viewer.locator('[data-close-dialog]').click();
        assert.ok(await image.evaluate(e=>e===document.activeElement),'Close button returns focus');
        await image.press('Enter');assert.equal(await toggle.getAttribute('aria-pressed'),'false');
        await page.mouse.click(2,Math.floor(height/2));assert.equal(await viewer.evaluate(e=>e.open),false);
        result.cases.push({mode,width,height,route,inline,fit,original,touch,keyboardPan:true,focusRestored:true,reopenReset:true,backdrop:true});
      }
      await page.goto(new URL('#/docs/1',base).href);
      const block=page.locator('.code-block').first(),copy=block.locator('.code-copy');
      await copy.waitFor();await copy.scrollIntoViewIfNeeded();await page.keyboard.press('Tab');await copy.focus();
      const focus=await copy.evaluate(e=>({visible:e.matches(':focus-visible'),offset:getComputedStyle(e).outlineOffset,width:getComputedStyle(e).outlineWidth}));
      assert.equal(focus.visible,true);assert.equal(focus.offset,'-3px');assert.equal(focus.width,'2px');
      if([1440,390].includes(width))await block.screenshot({path:path.join(output,'code-focus-'+suffix+'.png'),scale:'css'});
      if(width===390){
        // Existing assets are test fixtures for very small / portrait images, not article evidence.
        for(const src of ['/images/brand/symbol.svg','/images/wechatgroup.jpeg']){
          await page.evaluate(src=>{
            const img=document.createElement('img');img.id='image-test-fixture';img.src=src;img.dataset.zoomable='true';img.tabIndex=0;img.alt='Size regression fixture';
            document.querySelector('.markdown-section').append(img);
          },src);
          const fixture=page.locator('#image-test-fixture');await fixture.evaluate(e=>e.decode());await fixture.press('Enter');
          await viewer.locator('img').evaluate(e=>e.decode());const fit=await geometry();fits(fit);
          if(src.endsWith('.svg'))assert.equal(await toggle.isDisabled(),true,'Small image is not unnecessarily enlarged');
          else{
            await toggle.click();const original=await geometry();assert.ok(original.viewport.scrollHeight>original.viewport.height,'Tall image can pan vertically');
            await viewport.evaluate(e=>e.scrollTop=100);assert.ok(await viewport.evaluate(e=>e.scrollTop>0));
            await page.setViewportSize({width:844,height:390});
            const resized=await geometry();assert.equal(resized.image.width,resized.natural[0]);
            assert.ok(resized.toolbar.bottom<390&&resized.dialog.bottom<=390,'Landscape controls remain visible');
            await page.setViewportSize({width,height});
          }
          result.fixtures.push({mode,src,fit});await page.keyboard.press('Escape');await fixture.evaluate(e=>e.remove());
        }
      }
      await context.close();console.log('CHECKED image reader: '+suffix);
    }
    assert.deepEqual(result.errors,[]);assert.deepEqual(result.consoleErrors,[]);assert.deepEqual(result.httpErrors,[]);
    console.log('PASS: 24 image-reader route/viewport/theme cases, native keyboard and mobile touch pan, focus, portrait/small fixtures and resize');
  } finally {
    fs.writeFileSync(path.join(output,'reading.json'),JSON.stringify(result,null,2)+'\n');
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
