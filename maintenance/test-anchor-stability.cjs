// Reproduce deferred Mermaid layout changes without relying on a fast cache.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const base = process.env.HOWTO_URL || 'http://127.0.0.1:4176/';
const output = path.resolve(process.env.HOWTO_SCREENSHOTS || 'docs/visual-qa/anchors');
const id = 'sql-语法背后，还要考虑后续-ddl';

(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const metrics={base,browser:browser.version(),cases:[],errors:[]};
  try {
    for(const width of [1440,390])for(const kind of ['legacy','static'])for(const reduced of [false,true]) {
      const context=await browser.newContext({viewport:{width,height:width===1440?900:844},reducedMotion:reduced?'reduce':'no-preference'});
      await context.route(/busuanzi/,r=>r.abort());
      await context.addInitScript(()=>{
        window.anchorCalls=[];
        const original=Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView=function(...args){window.anchorCalls.push({id:this.id,at:performance.now()});return original.apply(this,args);};
      });
      const route=kind==='legacy'?'#/docs/105?id='+encodeURIComponent(id):'/articles/105/#'+encodeURIComponent(id);
      for(const interrupt of [false,true]) {
        let release;
        const gate=new Promise(resolve=>{release=resolve;});
        const page=await context.newPage();page.on('pageerror',e=>metrics.errors.push(e.message));
        await page.route('**/vendor/mermaid.min.js',async r=>{await gate;await r.continue();});
        await page.goto(new URL(route,base).href,{waitUntil:'domcontentloaded'});
        await page.locator('.article-meta').waitFor();await page.waitForTimeout(700);
        const before=await page.evaluate(id=>document.getElementById(id).getBoundingClientRect().top,id);
        if(interrupt)await page.mouse.wheel(0,400);
        const cutoff=await page.evaluate(()=>performance.now());
        release();
        await page.locator('.mermaid svg').waitFor();await page.waitForTimeout(800);
        const after=await page.evaluate(id=>document.getElementById(id).getBoundingClientRect().top,id);
        const restoresAfterInput=await page.evaluate(({id,cutoff})=>window.anchorCalls.filter(c=>c.id===id&&c.at>cutoff).length,{id,cutoff});
        if(interrupt)assert.equal(restoresAfterInput,0,'Do not pull a reader back after wheel/touch/key input');
        else assert.ok(after>=64&&after<190,kind+' '+width+' settled target: '+after);
        metrics.cases.push({width,kind,reduced,interrupt,before,after,restoresAfterInput});
        if(!interrupt&&!reduced)await page.screenshot({path:path.join(output,kind+'-'+width+'.png')});
        await page.close();
      }
      await context.close();
    }
    assert.deepEqual(metrics.errors,[]);
    console.log('PASS: 16 deferred-diagram cases; static/legacy, desktop/mobile, reduced motion and reader interruption');
  } finally {
    fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify(metrics,null,2)+'\n');
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
