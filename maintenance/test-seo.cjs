const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {parse:markdown,lexer,walkTokens}=require('../vendor/marked.cjs');
const catalog=require('../data/articles.json');
const view=require('../scripts/article-view.js');
const root=path.resolve(__dirname,'..'),origin='https://postgres-howto.cn';
let dom;
const ready=import('./html-tools.mjs').then(module=>{dom=module;});
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fileFor=pathname=>pathname==='/'?'index.html':pathname.endsWith('/')?pathname.slice(1)+'index.html':pathname.slice(1);
function document(file){return dom.parse(read(file),{scriptingEnabled:false});}
const tags=(tree,name)=>dom.elements(tree,n=>n.tagName===name);
const attr=(node,name)=>dom.attribute(node,name);
const meta=(tree,name)=>tags(tree,'meta').find(n=>attr(n,'name')===name||attr(n,'property')===name);
const content=(tree,name)=>attr(meta(tree,name),'content');
const id=(tree,name)=>dom.elements(tree,n=>attr(n,'id')===name)[0];

test('initial home, topics and paths are real content, not loading placeholders',async()=>{
  await ready;
  const home=document('index.html'),main=id(home,'main');
  assert.ok(main);assert.equal(tags(home,'h1').length,1);
  assert.ok(dom.textContent(main).includes('最近收录'));
  assert.ok(dom.textContent(main).includes('从 Howto 出发'));
  assert.equal(dom.elements(main,n=>(attr(n,'class')||'').split(' ').includes('topic-card')).length,catalog.topics.length);
  for(const a of catalog.featured)assert.ok(tags(main,'a').some(n=>attr(n,'href')===view.url(a)));
  assert.doesNotMatch(dom.textContent(main),/正在载入|\{\{HOME|\{\{BODY/);
  assert.equal(tags(home,'link').filter(n=>attr(n,'rel')==='canonical').length,0,'Shared Hash shell must not initially canonicalize every article to home');
  for(const name of ['topics','paths']){
    const tree=document(name+'/index.html'),info=view.discovery('/docs/'+name);
    assert.equal(dom.textContent(tags(tree,'title')[0]),info.title+' | PostgreSQL Howto 中文版');
    assert.equal(content(tree,'description'),info.description);
    assert.equal(attr(tags(tree,'link').find(n=>attr(n,'rel')==='canonical'),'href'),origin+info.url);
    assert.equal(content(tree,'og:url'),origin+info.url);
    assert.equal(tags(tree,'h1').length,1);
    assert.ok(id(tree,'main'));assert.equal(tags(tree,'script').filter(n=>/parse5|marked|docsify/.test(attr(n,'src')||'')).length,0);
  }
});

test('all article metadata, primary body, structured data and fenced code survive the static build',async()=>{
  await ready;
  let blocks=0;
  for(const a of catalog.articles){
    const file='articles/'+a.id+'/index.html',tree=document(file),main=id(tree,'main');
    assert.ok(main,file);assert.equal(dom.textContent(tags(tree,'title')[0]),a.title+' | PostgreSQL Howto 中文版');
    assert.equal(content(tree,'description'),a.title+'。'+a.versionNote);
    const canonicals=tags(tree,'link').filter(n=>attr(n,'rel')==='canonical');
    assert.equal(canonicals.length,1);assert.equal(attr(canonicals[0],'href'),view.canonical(a.id));
    assert.equal(content(tree,'og:url'),view.canonical(a.id));assert.equal(content(tree,'og:type'),'article');
    assert.ok(content(tree,'og:image').startsWith(origin+'/images/brand/'));
    assert.equal(tags(main,'h1').length,1);assert.equal(dom.textContent(tags(main,'h1')[0]),a.title);
    assert.ok(dom.textContent(main).trim().length>80,file+': missing primary content');
    const schema=JSON.parse(dom.textContent(id(tree,'article-schema')));
    assert.equal(schema.headline,a.title);assert.equal(schema.url,view.canonical(a.id));assert.equal(schema.citation,a.source.url);
    const expected=[];walkTokens(lexer(read('docs/'+a.id+'.md')),t=>{if(t.type==='code')expected.push(t.text+(t.lang==='mermaid'?'':'\n'));});
    const actual=tags(main,'pre').map(n=>dom.textContent(tags(n,'code')[0]));
    assert.deepEqual(actual,expected,file+': code whitespace or literal entities changed');blocks+=actual.length;
    const ids=dom.elements(tree,n=>attr(n,'id')!==undefined).map(n=>attr(n,'id'));assert.equal(new Set(ids).size,ids.length,file+': duplicate anchor');
  }
  assert.ok(blocks>=650);
});

test('sitemap and crawlable internal links discover every canonical article without fragments',async()=>{
  await ready;
  const sitemap=dom.parseFragment(read('sitemap.xml'));
  const locations=tags(sitemap,'loc').map(dom.textContent);
  const expected=['/','/topics/','/paths/','/articles/',...catalog.articles.map(a=>view.url(a.id))].map(p=>origin+p);
  assert.deepEqual(locations,expected);assert.equal(new Set(locations).size,locations.length);
  assert.ok(locations.every(u=>!new URL(u).hash&&!new URL(u).search));
  assert.match(read('robots.txt'),/Sitemap: https:\/\/postgres-howto\.cn\/sitemap\.xml/);
  const discovered=new Set(),graph=new Map();
  for(const url of locations){
    const pathname=new URL(url).pathname,tree=document(fileFor(pathname));
    const links=[];
    for(const a of tags(tree,'a')){
      const href=attr(a,'href');if(!href)continue;
      const target=new URL(href,url);if(target.origin!==origin||!/^\/(?:articles|topics|paths)\//.test(target.pathname))continue;
      const file=fileFor(target.pathname);assert.ok(fs.existsSync(path.join(root,file)),pathname+' -> '+href);
      if(target.hash)assert.ok(id(document(file),decodeURIComponent(target.hash.slice(1))),pathname+' -> '+href+': missing anchor');
      links.push(origin+target.pathname);
    }
    graph.set(url,links);
  }
  const queue=[origin+'/'];
  for(let i=0;i<queue.length;i++)for(const target of graph.get(queue[i])||[])if(!discovered.has(target)){discovered.add(target);queue.push(target);}
  for(const a of catalog.articles)assert.ok(discovered.has(view.canonical(a.id)),a.id+': orphan article');
  for(const t of catalog.topics){
    const tree=document('topics/index.html'),anchor=id(tree,'topic-'+t.id);
    assert.ok(anchor);assert.ok(dom.textContent(id(tree,'main')).includes('收录 '+catalog.articles.filter(a=>a.topics.includes(t.id)).length+' 篇'));
  }
  for(const p of catalog.paths)assert.ok(id(document('paths/index.html'),'path-'+p.id));
});

test('HTML extraction decodes prose once while preserving inline and fenced code literals',async()=>{
  await ready;
  const source='段落 &quot;引号&quot; &copy; &#x1F418;\n\n`&quot;` 和 `<script>`\n\n```sql\nSELECT \'&quot;\', \'&amp;\';\n```\n\n<script>hidden()</script>\n\n| 列 | 值 |\n|---|---|\n| x | &gt; |';
  const text=dom.visibleText(markdown(source));
  assert.ok(text.includes('段落 "引号" ©'));assert.ok(text.includes('&quot; 和 <script>'));
  assert.ok(text.includes("SELECT '&quot;', '&amp;';"));assert.ok(!text.includes('hidden()'));assert.ok(text.includes(' > '));
  assert.equal(dom.staticHref('/docs/42.md?id=lock-tree'),'/articles/42/#lock-tree');
  assert.equal(dom.staticHref('#/docs/topics?id=topic-locks'),'/topics/#topic-locks');
  assert.equal(dom.staticHref('#/docs/find?q=work_mem'),'/#/docs/find?q=work_mem');
  const image=tags(document('articles/42/index.html'),'img').find(n=>attr(n,'alt')?.includes('forest of lock trees'));
  assert.equal(attr(image,'alt'),'Example output that shows the "forest of lock trees"');
});
