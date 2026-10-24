// Post-release QA with exact viewport heights and reproducible browser evidence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const catalog = require('../data/articles.json');
const root = path.resolve(__dirname, '..');
const base = process.env.HOWTO_URL || 'http://127.0.0.1:4176/';
const output = path.resolve(process.env.HOWTO_SCREENSHOTS || path.join(root, 'docs/visual-qa/local'));
const baseline = process.env.HOWTO_BASELINE === '1';
const viewports = [[1440,900],[1280,800],[1024,768],[768,1024],[390,844],[360,800]];
const routes = [
  ['home','#/README'], ['topics','#/docs/topics'], ['paths','#/docs/paths'],
  ['all','#/docs/find'], ['search','#/docs/find?q=work_mem'],
  ['explain','#/docs/1'], ['ordinary','#/docs/7'], ['locks','#/docs/42'],
  ['bpftrace','#/docs/98'], ['autovacuum','#/docs/102'], ['long','#/docs/105'],
  ['about','#/docs/about'], ['static','/articles/105/'], ['directory','/articles/'],
  ['static-topics','/topics/'], ['static-paths','/paths/']
];
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
fs.mkdirSync(output, {recursive:true});

async function verifyVersion() {
  const files = ['index.html','docs/home.md','docs/topics.md','docs/paths.md','docs/about.md',
    'styles/custom.css','styles/reading.css','data/articles.json','data/search-index.json',
    'sitemap.xml','robots.txt','topics/index.html','paths/index.html', ...fs.readdirSync(path.join(root,'scripts')).filter(f=>f.endsWith('.js')).map(f=>'scripts/'+f),
    ...fs.readdirSync(path.join(root,'images/brand')).filter(f=>/\.(svg|png)$/.test(f)).map(f=>'images/brand/'+f),
    'articles/index.html', ...catalog.articles.map(a=>'articles/'+a.id+'/index.html')];
  const result = {checkedAt:new Date().toISOString(), base, comparison:'working-tree',
    head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    originMaster:execFileSync('git',['rev-parse','origin/master'],{cwd:root,encoding:'utf8'}).trim(), files:[]};
  for (const file of files) {
    const response = await fetch(new URL(file,base), {signal:AbortSignal.timeout(30000)});
    const bytes = Buffer.from(await response.arrayBuffer());
    result.files.push({file,status:response.status,sha256:sha(bytes),matchesLocal:sha(bytes)===sha(fs.readFileSync(path.join(root,file)))});
  }
  fs.writeFileSync(path.join(output,'version.json'),JSON.stringify(result,null,2)+'\n');
  assert.ok(result.files.every(f=>f.status===200&&f.matchesLocal),'HTTP content must match checked-out source');
  console.log('PASS: '+result.files.length+' HTTP files match working files (HEAD '+result.head+')');
}

(async () => {
  if (!process.argv.includes('--matrix-only')) await verifyVersion();
  if (process.argv.includes('--http-only')) return;
  const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
  const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const result = {checkedAt:new Date().toISOString(),base,baseline,browser:browser.version(),viewports,cases:[],components:[],errors:[],consoleErrors:[],httpErrors:[],failures:[]};
  const save = () => fs.writeFileSync(path.join(output,'matrix.json'),JSON.stringify(result,null,2)+'\n');
  try {
    for (const mode of ['light','dark']) for (const [width,height] of viewports) {
      const context = await browser.newContext({viewport:{width,height},colorScheme:mode,
        ...(width<768?{deviceScaleFactor:3,isMobile:true,hasTouch:true}:{}),permissions:['clipboard-read','clipboard-write']});
      await context.route(/busuanzi/,r=>r.abort());
      await context.addInitScript(mode=>localStorage.setItem('howto-theme',mode),mode);
      const page = await context.newPage();
      page.on('pageerror',e=>result.errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED|busuanzi/.test(m.text()))result.consoleErrors.push({url:page.url(),text:m.text()});});
      page.on('response',r=>{if(r.status()>=400)result.httpErrors.push({url:r.url(),status:r.status()});});
      const suffix = width+'x'+height+'-'+mode;
      async function go(route) {
        await page.goto(new URL(route,base).href,{waitUntil:'domcontentloaded'});
        await page.locator('.markdown-section h1').first().waitFor();
        if (!['/articles/','/topics/','/paths/'].some(prefix=>route.startsWith(prefix))) await page.waitForFunction(()=>document.querySelector('.markdown-section')?.dataset.renderedRoute===location.hash);
        if (route.includes('find')) await page.locator('.finder-results a').first().waitFor();
        if(await page.locator('.mermaid').count())await page.waitForFunction(()=>[...document.querySelectorAll('.mermaid')].every(e=>e.querySelector('svg')));
        await page.waitForTimeout(650);
      }
      async function capture(name,fullPage=false) {
        await page.screenshot({path:path.join(output,name+'-'+suffix+'.png'),fullPage,scale:'css'});
      }
      for (const [name,route] of routes) {
        try {
          await go(route);
          const metrics = await page.evaluate(()=>{
            const rect = sel => {const r=document.querySelector(sel).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
            const css = getComputedStyle(document.documentElement);
            return {pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,header:rect('.site-header'),brand:rect('.site-brand'),tools:rect('.header-tools'),
              content:rect('.markdown-section'),title:document.querySelector('.markdown-section h1').textContent,
              colors:Object.fromEntries(['--page','--ink','--muted','--brand','--accent','--border'].map(k=>[k,css.getPropertyValue(k).trim()])),
              arrowIcons:[...document.querySelectorAll('.icon')].filter(e=>/arrow|chevron/.test(e.className)).map(e=>e.className)};
          });
          assert.ok(metrics.pageWidth<=width+1,'Page horizontal overflow');
          assert.ok(metrics.brand.right<=metrics.tools.x&&metrics.brand.y>=0&&metrics.brand.bottom<=64,'Header overlap/crop');
          const logo = page.locator('.site-brand img:visible');
          assert.equal(await logo.count(),1);await logo.evaluate(img=>img.decode());
          assert.ok((await logo.getAttribute('src')).includes(mode==='dark'?'symbol-dark.svg':'symbol.svg'));
          if (name==='home') assert.equal(await page.locator('.home-hero .icon-arrow-up-right,.section-heading [aria-hidden],.topic-index,.path-number').count(),0);
          if (name==='long'||name==='static') {
            const toc = page.locator('.article-toc');
            if(width>=1280) {
              const box = await toc.boundingBox();assert.ok(box.y>=64&&box.y+box.height<=height,'Sticky TOC exceeds short viewport');
            } else assert.equal(await toc.getAttribute('open'),null,'Compact TOC initially folded');
          }
          await capture(name,['home','topics','paths','all','search','about'].includes(name)&&[1440,390].includes(width));
          result.cases.push({name,route,width,height,mode,...metrics,passed:true});
        } catch(e) {result.failures.push({route,width,height,mode,error:e.message});await capture('failure-'+name);}
      }
      try {
        await go('#/docs/98');
        const table = page.locator('.table-scroll').first();
        await table.scrollIntoViewIfNeeded();
        const tableState = await table.evaluate(e=>{
          e.scrollLeft=160;
          return {clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,scrollLeft:e.scrollLeft,
            rows:[...e.querySelectorAll('tr')].slice(0,5).map(row=>({background:getComputedStyle(row).backgroundColor,color:getComputedStyle(row.querySelector('td,th')).color}))};
        });
        if(width<768)assert.ok(tableState.scrollWidth>tableState.clientWidth&&tableState.scrollLeft>0,'Table local scroll');
        await table.evaluate(e=>{e.scrollLeft=0;});
        if([1440,390,360].includes(width))await capture('table');
        await go('#/docs/1');
        const block=page.locator('.code-block').first();await block.scrollIntoViewIfNeeded();
        const original=await block.locator('code').textContent();await block.locator('.code-copy').click();
        assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),original,'Code copy fidelity');
        const plan=page.locator('pre[data-code-kind="plan"]').first();await plan.scrollIntoViewIfNeeded();
        const code=await plan.evaluate(e=>{e.scrollLeft=200;return {clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,scrollLeft:e.scrollLeft,whiteSpace:getComputedStyle(e.firstElementChild).whiteSpace};});
        assert.equal(code.whiteSpace,'pre');
        if(width<768)assert.ok(code.scrollWidth>code.clientWidth&&code.scrollLeft>0,'Code local scroll');
        await plan.evaluate(e=>{e.scrollLeft=0;});
        if([1440,390,360].includes(width))await capture('sql');
        await go('#/docs/105');
        const toc=page.locator('.article-toc');
        if(width<1280)await toc.locator('summary').click();
        const link=toc.locator('a').nth(2),id=await link.getAttribute('data-heading');await link.click();
        await page.waitForFunction(id=>{const y=document.getElementById(id)?.getBoundingClientRect().top;return y>=64&&y<190;},id);
        if([1440,390].includes(width))await capture('toc');
        await page.reload();await page.locator('.article-meta').waitFor();
        await page.locator('.mermaid svg').last().waitFor();await page.waitForTimeout(700);
        const refreshTop=await page.evaluate(id=>document.getElementById(id)?.getBoundingClientRect().top,id);
        if(!baseline)assert.ok(refreshTop>=64&&refreshTop<190,'Anchor after diagrams settle: '+refreshTop);
        if([1440,390].includes(width))await capture('anchor-refresh');
        await page.keyboard.press('Control+k');await page.locator('#article-query').waitFor();
        assert.ok(await page.locator('#article-query').evaluate(e=>e===document.activeElement));
        await go('#/docs/about');
        for (const modal of ['communityModal','imageModal']) {
          await page.locator('.markdown-section [data-dialog="'+modal+'"]').click();
          const dialog=page.locator('#'+modal);assert.ok(await dialog.evaluate(e=>e.open));
          await dialog.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
          const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,'Dialog viewport fit');
          if([1280,390,360].includes(width))await capture(modal);
          await page.keyboard.press('Escape');
          assert.ok(await page.locator('.markdown-section [data-dialog="'+modal+'"]').evaluate(e=>e===document.activeElement),'Modal focus restored');
        }
        if(width<1024) {
          await page.locator('#sidebar-toggle').click();await page.waitForTimeout(200);
          assert.equal(await page.locator('.content').getAttribute('inert'),'');
          if(width<=390)await capture('sidebar');
          await page.keyboard.press('Escape');assert.equal(await page.locator('#sidebar-toggle').getAttribute('aria-expanded'),'false');
        }
        await go('#/README');
        await page.locator('.site-footer').scrollIntoViewIfNeeded();
        if([1440,390].includes(width))await capture('footer');
        await go('#/docs/7');
        await page.locator('.site-footer').scrollIntoViewIfNeeded();
        await page.locator('.site-brand').click();await page.waitForFunction(()=>scrollY<5);
        result.components.push({width,height,mode,table:tableState,code,copy:true,tocClick:true,refreshTop,tocRefresh:refreshTop>=64&&refreshTop<190,shortcut:true,dialogs:true,drawer:width<1024,brandReturnsHomeAndTop:true});
      } catch(e) {result.failures.push({component:true,width,height,mode,error:e.message});await capture('component-failure');}
      await context.close();save();
      console.log('CHECKED: '+suffix);
    }
    assert.deepEqual(result.errors,[],'Uncaught browser exceptions');
    if(!baseline)assert.deepEqual(result.consoleErrors,[],'Unexpected console errors');
    else assert.ok(result.httpErrors.every(r=>r.status===404&&r.url.endsWith('/docs/_sidebar.md')),'Only the recorded Docsify fallback may fail on baseline');
    assert.deepEqual(result.failures,[],'Matrix defects; see matrix.json and failure screenshots');
    console.log((baseline?'BASELINE RECORDED: ':'PASS: ')+result.cases.length+' pages and '+result.components.length+' component sets'+(baseline?'; '+result.components.filter(c=>!c.tocRefresh).length+' known anchor misalignments':''));
  } finally {save();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
