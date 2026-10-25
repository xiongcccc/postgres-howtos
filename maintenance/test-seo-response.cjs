// Compare actual HTTP, generated HTML and JS DOM; no search-engine indexing claims.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const view=require('../scripts/article-view.js');
const root=path.resolve(__dirname,'..');
const base=process.env.HOWTO_URL||'http://127.0.0.1:4176/';
const ref=process.env.HOWTO_COMPARE_REF;
const output=path.resolve(process.env.HOWTO_SCREENSHOTS||'docs/visual-qa/latest/after/responses');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const normalize=text=>text.replace(/\s+/g,' ').trim();
fs.mkdirSync(output,{recursive:true});
(async()=>{
  const dom=await import('./html-tools.mjs');
  function summary(html){
    const tree=dom.parse(html),tags=name=>dom.elements(tree,n=>n.tagName===name),attr=dom.attribute;
    const main=dom.elements(tree,n=>attr(n,'id')==='main')[0];
    return {
      title:dom.textContent(tags('title')[0]),
      description:attr(tags('meta').find(n=>attr(n,'name')==='description'),'content'),
      canonical:tags('link').filter(n=>attr(n,'rel')==='canonical').map(n=>attr(n,'href')),
      h1:tags('h1').map(dom.textContent),bodyHash:hash(dom.textContent(main)),bodyLength:dom.textContent(main).length,
      paragraphs:dom.elements(main,n=>n.tagName==='p').map(n=>normalize(dom.textContent(n))).filter(Boolean),
      codes:dom.elements(main,n=>n.tagName==='pre'&&attr(n,'data-lang')!=='mermaid').map(n=>dom.textContent(n)),
      internalLinks:tags('a').map(n=>attr(n,'href')).filter(h=>h?.startsWith('/')||h?.startsWith('#')),
      schemas:tags('script').filter(n=>attr(n,'type')==='application/ld+json').map(n=>JSON.parse(dom.textContent(n)))
    };
  }
  const result={checkedAt:new Date().toISOString(),base,comparison:ref||'working-tree',rows:[],missing:null,errors:[]};
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    const routes=['/','/topics/','/paths/','/articles/',...[1,7,42,97,98,102,105].flatMap(id=>[view.url(id),'#/docs/'+id])];
    for(const [width,mode]of [[1440,'light'],[390,'dark']]){
      const c=await browser.newContext({viewport:{width,height:width===1440?900:844},colorScheme:mode,...(width===390?{isMobile:true,hasTouch:true}:{})});
      await c.route(/busuanzi/,r=>r.abort());await c.addInitScript(mode=>localStorage.setItem('howto-theme',mode),mode);
      const p=await c.newPage();p.on('pageerror',e=>result.errors.push(e.message));
      for(const route of routes){
        const url=new URL(route,base),file=route.startsWith('#')||route==='/'?'index.html':url.pathname.slice(1)+'index.html';
        const response=await fetch(url,{signal:AbortSignal.timeout(30000)}),raw=await response.text();
        const artifact=ref?execFileSync('git',['show',ref+':'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,file),'utf8');
        const initial=summary(raw),generated=summary(artifact);
        assert.equal(response.status,200);assert.equal(hash(raw),hash(artifact),file+': HTTP differs from comparison artifact');
        await p.goto(url.href);
        await p.waitForFunction(()=>document.body.hasAttribute('data-static-page')&&!document.body.dataset.staticArticle
          ?Boolean(window.HowtoUI):document.querySelector('.markdown-section')?.dataset.renderedRoute===location.hash);
        if(await p.locator('.mermaid').count())await p.waitForFunction(()=>[...document.querySelectorAll('.mermaid')].every(n=>n.querySelector('svg')));
        const rendered=await p.evaluate(()=>{
          const main=document.getElementById('main');
          return {title:document.title,description:document.querySelector('meta[name=description]')?.content,
            canonical:[...document.querySelectorAll('link[rel=canonical]')].map(n=>n.href),
            h1:[...main.querySelectorAll('h1')].map(n=>n.textContent),body:main.textContent,
            codes:[...main.querySelectorAll('pre')].filter(n=>!n.closest('.diagram-source')).map(n=>n.textContent),
            internalLinks:[...main.querySelectorAll('a')].map(n=>n.getAttribute('href')).filter(h=>h?.startsWith('/')||h?.startsWith('#')),
            schemas:[...document.querySelectorAll('script[type="application/ld+json"]')].map(n=>JSON.parse(n.textContent))};
        });
        const id=route.match(/(?:articles\/|docs\/)(\d+)/)?.[1];
        assert.deepEqual(rendered.canonical,[id?view.canonical(id):'https://postgres-howto.cn'+(route==='/'?'/':route)]);
        assert.equal(rendered.h1.length,1);
        if(!route.startsWith('#')){
          assert.equal(rendered.title,initial.title);assert.equal(rendered.description,initial.description);assert.deepEqual(rendered.h1,initial.h1);
          assert.ok(initial.paragraphs.every(text=>normalize(rendered.body).includes(text)),'Initial prose disappeared after enhancement');
          assert.deepEqual(rendered.codes,initial.codes,'Code changed after JS enhancement');assert.deepEqual(rendered.schemas,initial.schemas);
        }
        const body=rendered.body;delete rendered.body;rendered.bodyHash=hash(body);rendered.bodyLength=body.length;
        await p.screenshot({path:path.join(output,route.replace(/[^\w]+/g,'-')+'-'+width+'-'+mode+'.png'),scale:'css'});
        result.rows.push({route,width,mode,status:response.status,url:response.url,file,httpHash:hash(raw),artifactHash:hash(artifact),initial,generated,rendered,passed:true});
      }
      await c.close();
    }
    const missing=await fetch(new URL('/articles/99999/',base),{signal:AbortSignal.timeout(30000)});
    result.missing={url:missing.url,status:missing.status};assert.equal(missing.status,404);
    const c=await browser.newContext();await c.route(/busuanzi/,r=>r.abort());
    const p=await c.newPage();p.on('pageerror',e=>result.errors.push(e.message));
    const response=await p.goto(new URL('#/docs/does-not-exist',base).href);
    await p.waitForFunction(()=>document.querySelector('.markdown-section')?.dataset.renderedRoute===location.hash);
    result.legacyMissing={status:response.status(),title:await p.locator('.markdown-section h1').textContent(),robots:await p.locator('meta[name=robots]').getAttribute('content')};
    assert.equal(result.legacyMissing.status,200);assert.equal(result.legacyMissing.title,'没有找到这篇文章');assert.equal(result.legacyMissing.robots,'noindex,follow');await c.close();
    assert.deepEqual(result.errors,[]);console.log('PASS: '+result.rows.length+' HTTP/artifact/DOM comparisons and real HTTP 404');
  }finally{fs.writeFileSync(path.join(output,'responses.json'),JSON.stringify(result,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
