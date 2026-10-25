// Boundary regressions found while reviewing the static-discovery release.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const base=process.env.HOWTO_URL||'http://127.0.0.1:4176/';
const output=path.resolve(process.env.HOWTO_SCREENSHOTS||'docs/visual-qa/latest/after/boundaries');
const baseline=process.env.HOWTO_BASELINE==='1';
fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const result={checkedAt:new Date().toISOString(),base,baseline,browser:browser.version(),cases:[],errors:[]};
  try{
    for(const mode of ['light','dark'])for(const width of [1440,390]){
      const c=await browser.newContext({viewport:{width,height:width===1440?900:844},colorScheme:mode,
        ...(width===390?{isMobile:true,hasTouch:true}:{}),permissions:['clipboard-read','clipboard-write']});
      await c.route(/busuanzi/,r=>r.abort());await c.addInitScript(mode=>localStorage.setItem('howto-theme',mode),mode);
      async function check(name,fn){
        const p=await c.newPage(),record={name,width,mode,passed:false,errors:[]};
        p.on('pageerror',e=>{record.errors.push(e.message);result.errors.push(e.message);});
        try{await fn(p,record);assert.deepEqual(record.errors,[]);record.passed=true;}
        catch(e){record.failure=e.message;}
        finally{
          record.final=await p.evaluate(()=>({route:location.hash,title:document.querySelector('.markdown-section h1')?.textContent,renderedRoute:document.querySelector('.markdown-section')?.dataset.renderedRoute}));
          await p.screenshot({path:path.join(output,name+'-'+width+'-'+mode+'.png'),scale:'css'});
          result.cases.push(record);await p.close();
        }
      }
      const ready=async p=>p.waitForFunction(()=>document.querySelector('.markdown-section')?.dataset.renderedRoute===location.hash);
      for(const [name,label]of [['topics','专题'],['paths','学习路径']])await check('alias-'+name,async(p,record)=>{
        await p.goto(new URL('#/docs/'+name+'.md',base).href);await ready(p);
        if(width===390){
          await p.locator('#sidebar-toggle').click();
          await p.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().x>=-1);
        }
        record.active=await p.locator('.app-nav [aria-current=page]').allTextContents();
        record.sidebar=await p.locator('.catalog-pages [aria-current=page]').allTextContents();
        assert.deepEqual(record.active,[label]);assert.deepEqual(record.sidebar,[label]);
      });
      for(const slow of [false,true])await check('search-leave-'+(slow?'slow':'fast'),async(p,record)=>{
        let intercepted=0;
        if(slow)await p.route('**/docs/92.md',async r=>{intercepted++;await new Promise(resolve=>setTimeout(resolve,350));await r.continue();});
        await p.goto(new URL('#/docs/find?q=work_mem',base).href);await ready(p);
        await p.locator('.finder-results a[href="#/docs/13"]').waitFor();
        // Both events run before the 120ms debounce, as in a fast result click.
        await p.evaluate(()=>{
          const input=document.querySelector('#article-query');input.value='xmin';input.dispatchEvent(new Event('input',{bubbles:true}));
          document.querySelector('.finder-results a[href="#/docs/92"]').click();
        });
        await p.locator('.article-id').waitFor();await p.waitForTimeout(500);
        record.delayedDocumentRequests=intercepted;
        record.afterNavigation=await p.evaluate(()=>({route:location.hash,title:document.querySelector('.markdown-section h1')?.textContent}));
        await p.screenshot({path:path.join(output,'navigated-'+(slow?'slow':'fast')+'-'+width+'-'+mode+'.png'),scale:'css'});
        if(slow)assert.equal(intercepted,1,'Delayed article response must actually be exercised');
        assert.equal(record.afterNavigation.route,'#/docs/92');assert.equal(record.afterNavigation.title,'work_mem 调优');
        await p.reload();await ready(p);assert.equal(await p.locator('.article-id').textContent(),'#92');
        await p.goBack();await p.locator('#article-query').waitFor();
        await p.waitForFunction(()=>document.querySelector('#article-query')?.value==='work_mem');
        record.refreshAndBack=true;
      });
      await check('clear-loading-search',async(p,record)=>{
        let release;const gate=new Promise(resolve=>{release=resolve;});
        await p.route('**/data/search-index.json*',async r=>{await gate;await r.continue();});
        try{
          await p.goto(new URL('#/README',base).href);await ready(p);await p.locator('#article-query').fill('xmin');
          await p.waitForFunction(()=>document.querySelector('.finder-results')?.getAttribute('aria-busy')==='true');
          await p.locator('.finder-clear').click();record.busy=await p.locator('.finder-results').getAttribute('aria-busy');
          assert.equal(record.busy,'false');assert.equal(await p.locator('.finder-status').textContent(),'');
        }finally{release();}
      });
      await c.close();
    }
    if(!baseline){assert.equal(result.cases.filter(c=>!c.passed).length,0,'Boundary regression; see boundaries.json');assert.deepEqual(result.errors,[]);}
    console.log((baseline?'BASELINE: ':'PASS: ')+result.cases.length+' boundary cases; '+result.cases.filter(c=>!c.passed).length+' failures');
  }finally{fs.writeFileSync(path.join(output,'boundaries.json'),JSON.stringify(result,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
