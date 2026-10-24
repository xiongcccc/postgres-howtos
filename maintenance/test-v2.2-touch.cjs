const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
  const base=process.env.HOWTO_URL||'http://127.0.0.1:4176/',out=path.resolve(process.env.HOWTO_SCREENSHOTS||'docs/visual-qa/details');fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const rows=[];
  try{
    for(const width of [390,360])for(const mode of ['light','dark']){
      const c=await browser.newContext({viewport:{width,height:width===390?844:800},isMobile:true,hasTouch:true,deviceScaleFactor:3,colorScheme:mode});
      await c.route(/busuanzi/,r=>r.abort());await c.addInitScript(mode=>localStorage.setItem('howto-theme',mode),mode);
      const p=await c.newPage(),session=await c.newCDPSession(p);
      const swipe=async locator=>{
        await locator.scrollIntoViewIfNeeded();await p.waitForTimeout(250);
        const box=await locator.boundingBox(),y=Math.min(650,Math.max(100,box.y+70)),start=Math.min(width-35,box.x+box.width-20);
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y}]});
        for(let i=1;i<=8;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start-(start-40)*i/8,y}]});await p.waitForTimeout(25);}
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(200);
        const state=await locator.evaluate(e=>({scrollLeft:e.scrollLeft,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth}));
        assert.ok(state.scrollLeft>0,'Real touch sequence should pan the local scroll region');return state;
      };
      await p.goto(base+'#/docs/98');await p.locator('.table-scroll').first().waitFor();
      const table=await swipe(p.locator('.table-scroll').first());
      await p.screenshot({path:path.join(out,'touch-table-'+width+'-'+mode+'.png'),scale:'css'});
      await p.goto(base+'#/docs/1');await p.locator('pre[data-code-kind="plan"]').waitFor();
      const code=await swipe(p.locator('pre[data-code-kind="plan"]').first());
      rows.push({width,mode,table,code,pageWidth:await p.evaluate(()=>document.documentElement.scrollWidth)});await c.close();
    }
    console.log('PASS: mobile CDP touch swipes move tables and execution plans in all four width/theme cases');
  }finally{fs.writeFileSync(path.join(out,'touch.json'),JSON.stringify({base,browser:browser.version(),method:'CDP touchStart/touchMove/touchEnd; mobile emulation, not physical Safari',cases:rows},null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
