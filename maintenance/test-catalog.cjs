const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');
const catalog = require('../data/articles.json');
const index = require('../data/search-index.json');
const search = require('../scripts/search-core.js').search;
const bodies = Object.fromEntries(index.articles.map(a=>[a.id,a.text]));
const find = (q,filter={}) => search(catalog,q,filter,bodies).map(r=>r.article.id);

test('generated files match the catalog and all numbered documents',()=>{
  execFileSync(process.execPath,[path.join(__dirname,'build-catalog.mjs'),'--check']);
});
test('Chinese, English, aliases, article numbers and normalized spelling',()=>{
  assert.equal(find('WAL暴涨')[0],31);
  assert.equal(find('100')[0],100);
  assert.ok(find('pg stat statements').includes(5));
  assert.ok(find('索引清理').includes(75));
  assert.ok(find('EXPLAIN ANALYZE').includes(1));
  assert.ok(find('锁等待').includes(100));
  assert.ok(find('复制延迟').includes(93));
});
test('full text, empty input, no result and filters',()=>{
  assert.ok(find('PreCommit_Notify').includes(100));
  assert.equal(find('').length,catalog.articles.length);
  assert.deepEqual(find('does-not-exist-xyz987654321'),[]);
  assert.deepEqual(find('',{type:'conference'}),[99,100,101,102,103,104,105,106]);
  assert.ok(find('',{topic:'performance'}).includes(96));
  assert.deepEqual(find('WAL暴涨',{type:'conference'}),[]);
  assert.deepEqual(find('<script>alert(1)</script>'),[]);
});
test('series and source are independent and preserve old routes',()=>{
  assert.deepEqual(find('',{series:'interpretation'}),[101,102,103,104,105,106,107,108,109]);
  assert.deepEqual(find('',{series:'interpretation',topic:'ops'}),[102,103,108,109]);
  assert.deepEqual(find('',{series:'interpretation',type:'conference',topic:'performance'}),[101,104,106]);
  assert.deepEqual(find('',{series:'interpretation',type:'translation'}),[]);
  assert.deepEqual(find('',{series:'guide',type:'conference'}),[99]);
  assert.deepEqual(find('',{series:'practice',type:'conference'}),[100]);
  assert.equal(find('Stop Guessing')[0],101);
  for(const file of ['docs/conferences.md','docs/topics.md']) {
    assert.match(fs.readFileSync(path.join(root,file),'utf8'),/\/docs\/101(?:\.md|")/);
  }
  assert.match(fs.readFileSync(path.join(root,'docs/series.md'),'utf8'),/\/docs\/find\.md\?series=interpretation/);
  assert.equal(catalog.articles.find(a=>a.id===101).validation.status,'tested');
  const article=fs.readFileSync(path.join(root,'docs/101.md'),'utf8');
  assert.ok(article.includes('## 参考资料'));
  assert.doesNotMatch(article.split('## 参考资料')[0],/https:\/\/www\.postgresql\.org/);
  assert.doesNotMatch(article,/先把.+说具体|材料没有提供可供复现|反人类|反直觉/);
});
test('autovacuum interpretation is discoverable and has verification evidence',()=>{
  assert.equal(find('清理不掉')[0],102);
  assert.equal(find('Autovacuum Blocked')[0],102);
  const entry=catalog.articles.find(a=>a.id===102);
  assert.equal(entry.validation.status,'tested');
  assert.ok(fs.existsSync(path.join(root,entry.validation.record)));
  const article=fs.readFileSync(path.join(root,'docs/102.md'),'utf8');
  assert.match(article,/5,000/);
  assert.doesNotMatch(article.split('## 参考资料')[0],/https:\/\/www\.postgresql\.org/);
  assert.doesNotMatch(article,/先把.+说具体|材料没有提供可供复现|反人类|反直觉|讲者/);
  for(const file of ['docs/conferences.md','docs/topics.md']) {
    assert.match(fs.readFileSync(path.join(root,file),'utf8'),/\/docs\/102(?:\.md|")/);
  }
});
test('collation interpretation is discoverable and has verification evidence',()=>{
  assert.equal(find('排序版本不匹配')[0],103);
  assert.equal(find('Everything you need to know about collations')[0],103);
  assert.deepEqual(find('',{series:'interpretation',topic:'sql'}),[103]);
  const entry=catalog.articles.find(a=>a.id===103);
  assert.equal(entry.validation.status,'tested');
  assert.ok(fs.existsSync(path.join(root,entry.validation.record)));
  const article=fs.readFileSync(path.join(root,'docs/103.md'),'utf8');
  assert.doesNotMatch(article.split('## 参考资料')[0],/https:\/\/www\.postgresql\.org/);
  assert.doesNotMatch(article,/先把.+说具体|材料没有提供可供复现|反人类|反直觉|讲者/);
  for(const file of ['docs/series.md','docs/conferences.md','docs/topics.md']) {
    assert.match(fs.readFileSync(path.join(root,file),'utf8'),/\/docs\/103(?:\.md|")/);
  }
});
test('generated internal article links exist and titles come from metadata',()=>{
  const files=['README.md','docs/home.md','_sidebar.md','docs/topics.md','docs/paths.md','docs/conferences.md','docs/series.md','docs/101.md','docs/102.md','docs/103.md','docs/104.md','docs/105.md','docs/106.md','docs/107.md','docs/108.md','docs/109.md'];
  const map=new Map(catalog.articles.map(a=>[a.id,a]));
  for(const file of files){
    const text=fs.readFileSync(path.join(root,file),'utf8');
    for(const match of text.matchAll(/(?:\/docs\/)(\d+)(?:\.md|["?])/g)) assert.ok(map.has(Number(match[1])),file+': '+match[0]);
    assert.ok(!text.includes('](./docs/'),file+': relative routes');
  }
  const sidebar=fs.readFileSync(path.join(root,'_sidebar.md'),'utf8');
  for(const a of catalog.articles) assert.equal(sidebar.split('](/docs/'+a.id+'.md)').length,2);
});
test('OLTP lock interpretation is discoverable and has verification evidence',()=>{
  assert.equal(find('热点账户')[0],104);
  assert.equal(find('Hey, I\'m using that')[0],104);
  assert.deepEqual(find('',{series:'interpretation',topic:'locks'}),[104,107]);
  const entry=catalog.articles.find(a=>a.id===104);
  assert.equal(entry.validation.status,'tested');
  assert.ok(fs.existsSync(path.join(root,entry.validation.record)));
  const article=fs.readFileSync(path.join(root,'docs/104.md'),'utf8');
  assert.equal([...article.matchAll(/```sql\n/g)].length,8);
  assert.doesNotMatch(article.split('## 参考资料')[0],/https:\/\/www\.postgresql\.org/);
  assert.doesNotMatch(article,/先把.+说具体|材料没有提供可供复现|反人类|反直觉|讲者/);
  for(const file of ['docs/series.md','docs/conferences.md','docs/topics.md']) {
    assert.match(fs.readFileSync(path.join(root,file),'utf8'),/\/docs\/104(?:\.md|")/);
  }
});
test('logical replication interpretation is discoverable and has verification evidence',()=>{
  assert.equal(find('逻辑复制开发')[0],105);
  assert.equal(find('How to Hack on Logical Replication')[0],105);
  assert.deepEqual(find('',{series:'interpretation',topic:'replication'}),[105,106,109]);
  const entry=catalog.articles.find(a=>a.id===105);
  assert.equal(entry.validation.status,'tested');
  assert.ok(fs.existsSync(path.join(root,entry.validation.record)));
  const article=fs.readFileSync(path.join(root,'docs/105.md'),'utf8');
  assert.equal([...article.matchAll(/```sql\n/g)].length,3);
  assert.equal([...article.matchAll(/```bash\n/g)].length,1);
  assert.equal([...article.matchAll(/```mermaid\n/g)].length,1);
  assert.doesNotMatch(article.split('## 参考资料')[0],/https:\/\/www\.postgresql\.org/);
  assert.doesNotMatch(article,/先把.+说具体|材料没有提供可供复现|反人类|反直觉|讲者/);
  for(const file of ['docs/home.md','docs/conferences.md','docs/topics.md']) {
    assert.match(fs.readFileSync(path.join(root,file),'utf8'),/\/docs\/105(?:\.md|")/);
  }
});
test('PG19 preview is discoverable and distinguishes documentation checks from experiments',()=>{
  assert.equal(find('PG19')[0],106);
  assert.equal(find('What to Expect from the Upcoming Release')[0],106);
  const entry=catalog.articles.find(a=>a.id===106);
  assert.equal(entry.series,'interpretation');
  assert.equal(entry.addedOn,'2026-09-30');
  assert.equal(entry.validation.status,'tested');
  assert.match(entry.validation.note,/仅实测 plan advice/);
  assert.ok(fs.existsSync(path.join(root,'maintenance/106-verify.py')));
  assert.ok(fs.existsSync(path.join(root,entry.validation.record)));
  assert.match(entry.versionNote,/Beta 4/);
  const article=fs.readFileSync(path.join(root,'docs/106.md'),'utf8');
  assert.equal([...article.matchAll(/```sql\n/g)].length,6);
  assert.match(article,/SEQ_SCAN\(d\) \/\* matched \*\//);
  assert.equal([...article.matchAll(/```mermaid\n/g)].length,1);
  assert.match(article,/REPACK \(CONCURRENTLY\)/);
  assert.doesNotMatch(article.split('## 参考资料')[0],/https:\/\/www\.postgresql\.org/);
  assert.doesNotMatch(article,/先把.+说具体|材料没有提供可供复现|反人类|反直觉|讲者/);
  for(const file of ['docs/home.md','docs/series.md','docs/conferences.md','docs/topics.md']) {
    assert.match(fs.readFileSync(path.join(root,file),'utf8'),/\/docs\/106(?:\.md|")/);
  }
});
test('technical blog interpretation has its own source filter and verification evidence',()=>{
  assert.equal(find('multixact_offset_buffers')[0],107);
  assert.equal(find('外键写入')[0],107);
  assert.deepEqual(find('',{type:'blog'}),[107,108,109]);
  assert.deepEqual(find('',{series:'interpretation',type:'blog',topic:'locks'}),[107]);
  assert.deepEqual(find('',{series:'guide',type:'blog'}),[]);
  const entry=catalog.articles.find(a=>a.id===107);
  assert.equal(entry.source.url,'https://thebuild.com/blog/all-your-gucs-in-a-row-multixact_member_buffers-and-multixact_offset_buffers/');
  assert.equal(entry.source.date,'2026-10-04');
  assert.equal(entry.addedOn,'2026-10-09');
  assert.equal(entry.validation.status,'tested');
  assert.match(entry.validation.note,/未进行吞吐压测/);
  assert.ok(fs.existsSync(path.join(root,entry.validation.record)));
  assert.ok(fs.existsSync(path.join(root,'maintenance/107-verify.py')));
  const article=fs.readFileSync(path.join(root,'docs/107.md'),'utf8');
  const steps=[...article.matchAll(/<!-- verify:([a-z-]+) -->\s*```sql\n/g)].map(m=>m[1]);
  assert.deepEqual(steps,['setup','a','observe-a','b','observe-ab','b-commit','c','observe-ac','finish','final','cleanup','slru','activity']);
  assert.equal([...article.matchAll(/```sql\n/g)].length,steps.length);
  assert.equal([...article.matchAll(/<!-- result:([a-z-]+) -->\s*```text\n/g)].length,8);
  assert.equal([...article.matchAll(/```mermaid\n/g)].length,1);
  assert.doesNotMatch(article.split('## 参考资料')[0],/https:\/\/www\.postgresql\.org/);
  for(const file of ['docs/home.md','docs/series.md','docs/topics.md']) {
    assert.match(fs.readFileSync(path.join(root,file),'utf8'),/\/docs\/107(?:\.md|")/);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(root,'docs/conferences.md'),'utf8'),/\/docs\/107(?:\.md|")/);
});
test('query memory interpretation includes bounded experiments and accurate failure scope',()=>{
  assert.equal(find('递归去重')[0],108);
  assert.equal(find('Can your Postgres survive a bad query')[0],108);
  assert.deepEqual(find('',{series:'interpretation',type:'blog',topic:'ops'}),[108,109]);
  const entry=catalog.articles.find(a=>a.id===108);
  assert.equal(entry.source.url,'https://clickhouse.com/blog/can-your-postgres-survive-a-bad-query');
  assert.equal(entry.source.date,'2026-09-28');
  assert.equal(entry.addedOn,'2026-10-09');
  assert.equal(entry.validation.status,'tested');
  assert.match(entry.validation.note,/未制造 OOM/);
  assert.ok(fs.existsSync(path.join(root,entry.validation.record)));
  assert.ok(fs.existsSync(path.join(root,'maintenance/108-verify.py')));
  const article=fs.readFileSync(path.join(root,'docs/108.md'),'utf8');
  const steps=[...article.matchAll(/<!-- verify:([a-z-]+) -->\s*```sql\n/g)].map(m=>m[1]);
  assert.deepEqual(steps,['setup','sample','sort-low','sort-high','probe','recursive',
    'after-recursive','temp-limit','after-temp-limit','timeout','after-timeout','cleanup']);
  assert.equal([...article.matchAll(/```sql\n/g)].length,13);
  assert.equal([...article.matchAll(/<!-- result:([a-z-]+) -->\s*```text\n/g)].length,9);
  assert.equal([...article.matchAll(/```mermaid\n/g)].length,1);
  assert.match(article,/100000 \|\s+4\.00/);
  assert.match(article,/显式.*BEGIN.*ROLLBACK/s);
  assert.match(article,/53200/);
  assert.match(article,/53400/);
  assert.doesNotMatch(article.split('## 参考资料')[0],/https:\/\/www\.postgresql\.org/);
  assert.doesNotMatch(article,/先把.+说具体|材料没有提供可供复现|反人类|反直觉|讲者/);
  for(const file of ['docs/home.md','docs/series.md','docs/topics.md']) {
    assert.match(fs.readFileSync(path.join(root,file),'utf8'),/\/docs\/108(?:\.md|")/);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(root,'docs/conferences.md'),'utf8'),/\/docs\/108(?:\.md|")/);
});
test('standby recovery interpretation includes reproducible physical replication experiments',()=>{
  assert.equal(find('备库查询取消')[0],109);
  assert.equal(find('All Your GUCs in a Row max_standby_archive_delay')[0],109);
  assert.deepEqual(find('',{type:'blog',topic:'replication'}),[109]);
  const entry=catalog.articles.find(a=>a.id===109);
  assert.equal(entry.series,'interpretation');
  assert.equal(entry.source.date,'2026-09-26');
  assert.equal(entry.addedOn,'2026-10-09');
  assert.equal(entry.validation.status,'tested');
  assert.match(entry.validation.note,/归档路径按文档和源码核对/);
  assert.ok(fs.existsSync(path.join(root,entry.validation.record)));
  assert.ok(fs.existsSync(path.join(root,'maintenance/109-verify.py')));
  const article=fs.readFileSync(path.join(root,'docs/109.md'),'utf8');
  const steps=[...article.matchAll(/<!-- verify:([a-z-]+) -->\s*```sql\n/g)].map(m=>m[1]);
  assert.deepEqual(steps,['configure','setup','hold-a','clean-a','observe','clean-c','hold-b',
    'conflicts','feedback-config','feedback-setup','feedback-hold','feedback-check',
    'feedback-delete','feedback-clean','truncate-setup','truncate-clean','truncate-hold',
    'truncate-vacuum','replication-status','cleanup']);
  assert.equal([...article.matchAll(/```sql\n/g)].length,20);
  assert.equal([...article.matchAll(/```mermaid\n/g)].length,1);
  assert.equal([...article.matchAll(/<!-- result:([a-z-]+) -->\s*```text\n/g)].length,7);
  assert.match(article,/10000 are dead but not yet removable/);
  assert.match(article,/backend_xmin.*不一定变成 NULL/);
  assert.match(article,/remote_apply/);
  assert.match(article,/预算.*硬上限|参数.*硬上限/);
  assert.doesNotMatch(article.split('## 参考资料')[0],/https:\/\/www\.postgresql\.org/);
  assert.doesNotMatch(article,/先把.+说具体|材料没有提供可供复现|反人类|反直觉|讲者/);
  for(const file of ['docs/home.md','docs/series.md','docs/topics.md']) {
    assert.match(fs.readFileSync(path.join(root,file),'utf8'),/\/docs\/109(?:\.md|")/);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(root,'docs/conferences.md'),'utf8'),/\/docs\/109(?:\.md|")/);
});
test('root opens the searchable homepage and local assets exist',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(html.includes('coverpage: false'));
  assert.ok(html.includes("homepage: 'docs/home.md'"));
  assert.ok(html.includes("'/README"));
  assert.ok(!html.includes('clientSecret'));
  assert.ok(!html.includes('lib/plugins/search.min.js'));
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^" ]*)?"/g)) assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);
});
test('catalog totals distinguish technical articles, editorial records and topic memberships',()=>{
  const vm=require('node:vm');const context={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'scripts/catalog-data.js'),'utf8'),context);
  const stats=context.window.HowtoCatalog.statistics;
  assert.equal(stats.total,catalog.articles.length);
  assert.equal(stats.technical,catalog.articles.filter(a=>a.type!=='editorial').length);
  assert.equal(stats.editorial,catalog.articles.filter(a=>a.type==='editorial').length);
  assert.equal(stats.topics,catalog.topics.length);
  assert.equal(stats.technical+stats.editorial,stats.total);
  const home=fs.readFileSync(path.join(root,'docs/home.md'),'utf8');
  assert.equal([...home.matchAll(/class="topic-card"/g)].length,catalog.topics.length);
  assert.equal([...home.matchAll(/class="path-copy"/g)].length,catalog.paths.length);
  assert.equal(stats.paths,catalog.paths.length);
  assert.match(home,new RegExp('<strong>'+catalog.paths.length+'</strong> 条学习路径'));
  assert.match(home,new RegExp('<strong>'+stats.technical+'</strong> 篇技术文章'));
  for(const p of catalog.paths){assert.ok(p.id&&p.goal);assert.ok(p.articles.every(id=>catalog.articles.some(a=>a.id===id)));}
  assert.doesNotMatch(fs.readFileSync(path.join(root,'sitemap.xml'),'utf8'),/#/);
});
test('normalized excerpts and highlights use the same matching semantics',()=>{
  const api=require('../scripts/search-core.js');
  const text='排序内存：ＷＯＲＫ＿ＭＥＭ / work_mem / Work-Mem';
  const ranges=api.ranges(text,'work mem');
  assert.ok(ranges.length>=3);
  assert.ok(api.snippet('无关内容'.repeat(80)+' pg_stat_statements 查询样例','pg stat statements').includes('pg_stat_statements'));
  assert.equal(api.normalize('ＰＧ_ＳＴＡＴ-Statements'),'pgstatstatements');
  assert.deepEqual(api.ranges('abc',''),[]);
  assert.equal(api.snippet('', 'x'),'');
  assert.ok(api.snippet('<script>alert(1)</script>','<script>').includes('<script>'));
});
test('all static articles have initial content and canonical metadata without fragment URLs',()=>{
  const view=require('../scripts/article-view.js');
  const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
  const locations=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  assert.equal(locations.length,catalog.articles.length+4);
  assert.equal(new Set(locations).size,locations.length);
  for(const a of catalog.articles){
    const html=fs.readFileSync(path.join(root,'articles',String(a.id),'index.html'),'utf8');
    assert.ok(locations.includes(view.canonical(a.id)));
    assert.ok(html.includes('<link rel="canonical" href="'+view.canonical(a.id)+'">'));
    assert.match(html,/<article id="main"[^>]*>[\s\S]+<\/article>/);
    assert.ok(html.includes(view.escape(a.title)));
    assert.equal([...html.matchAll(/<h1(?:\s[^>]*)?>/g)].length,1);
    const schema=JSON.parse(html.match(/<script id="article-schema" type="application\/ld\+json">([^]*?)<\/script>/)[1]);
    assert.equal(schema.headline,a.title);assert.equal(schema.citation,a.source.url);
    assert.equal(schema.url,view.canonical(a.id));
    for(const m of html.matchAll(/href="\/articles\/(\d+)\//g))assert.ok(catalog.articles.some(a=>a.id===Number(m[1])));
    for(const m of html.matchAll(/href="\/articles\/(\d+)\/#([^"]+)"/g)){
      const target=fs.readFileSync(path.join(root,'articles',m[1],'index.html'),'utf8');
      assert.ok(target.includes('id="'+view.escape(decodeURIComponent(m[2]))+'"'),a.id+': cross-article anchor '+m[0]);
    }
    assert.doesNotMatch(html,/<script[^>]+src="[^">]*docsify/);
    assert.doesNotMatch(html,/href="\/docs\/\d+\.md/);
  }
});
test('static directory discovers every document and README is separate from the website homepage',()=>{
  const directory=fs.readFileSync(path.join(root,'articles/index.html'),'utf8');
  for(const a of catalog.articles)assert.ok(directory.includes('href="/articles/'+a.id+'/"'));
  const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
  assert.ok(readme.length<6000);assert.doesNotMatch(readme,/class="home-/);
  assert.match(readme,/来源与致谢/);assert.match(readme,/贡献与反馈/);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(html.includes('href="/articles/"'));
  assert.doesNotMatch(html,/<link rel="canonical"/,'Hash views must not inherit a hardcoded homepage canonical');
});
test('search quality matrix and topic count semantics are derived from actual metadata',()=>{
  for(const [query,id] of [['work_mem',92],['pg_stat_statements',5],['EXPLAIN BUFFERS',1],['autovacuum',102],['xmin',45],['replication lag',93],['锁等待',42],['索引膨胀',46],['WAL',31],['vacuum freeze',44]])assert.ok(find(query).includes(id),query);
  const topics=fs.readFileSync(path.join(root,'docs/topics.md'),'utf8');
  for(const t of catalog.topics){
    const all=catalog.articles.filter(a=>a.topics.includes(t.id)).length,primary=catalog.articles.filter(a=>a.topics[0]===t.id).length;
    assert.match(topics,new RegExp('收录 '+all+' 篇 · 主归属 '+primary+' 篇'));
    assert.equal(find('',{topic:t.id}).length,all);
  }
  for(const p of catalog.paths)assert.equal(new Set(p.articles).size,p.articles.length);
});
test('code language aliases and execution plans preserve their display semantics',()=>{
  const view=require('../scripts/article-view.js');
  assert.equal(view.codeInfo('SQL','select 1').language,'sql');
  assert.equal(view.codeInfo('shell','echo hello').language,'bash');
  assert.equal(view.codeInfo('conf','shared_buffers=128MB').language,'ini');
  assert.equal(view.codeInfo('sql','QUERY PLAN\nSeq Scan (cost=0.00..5.00)').kind,'plan');
  assert.equal(view.codeInfo('sql','test=# select 1;').kind,'terminal');
});
test('vendored browser libraries are pinned and match recorded checksums',()=>{
  const crypto=require('node:crypto');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'vendor/manifest.json'),'utf8'));
  assert.ok(manifest.length>=10);
  for(const entry of manifest){
    const data=fs.readFileSync(path.join(root,'vendor',entry.file));
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'),entry.sha256,entry.file);
    assert.ok(!entry.source.includes('@latest'));
  }
});
test('text and interactive colors retain AA contrast in both themes',()=>{
  const css=fs.readFileSync(path.join(root,'styles/custom.css'),'utf8');
  const blocks=[...css.matchAll(/:root(?:\[data-theme="dark"\])?\s*\{([^}]+)\}/g)].slice(0,2);
  const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;};
  for(const block of blocks){
    const tokens=Object.fromEntries([...block[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/g)].map(m=>[m[1],m[2]]));
    for(const [text,bg] of [['ink','page'],['muted','page'],['brand','page'],['accent','page'],['code-ink','code']]){
      const values=[luminance(tokens[text]),luminance(tokens[bg])].sort((a,b)=>b-a);
      assert.ok((values[0]+.05)/(values[1]+.05)>=4.5,text+' on '+bg);
    }
  }
});
test('brand SVGs and raster exports share one original symbol',()=>{
  const crypto=require('node:crypto');
  const directory=path.join(root,'images/brand');
  const symbol=fs.readFileSync(path.join(directory,'symbol.svg'),'utf8').match(/<path[^>]* d="([^"]+)"/)[1];
  for(const name of ['symbol.svg','symbol-dark.svg','favicon.svg','logo.svg','logo-dark.svg','social.svg']){
    const svg=fs.readFileSync(path.join(directory,name),'utf8');
    assert.match(svg,/viewBox="0 0 \d+ \d+"/);
    assert.ok(svg.includes('d="'+symbol+'"'),name+' must use the same core geometry');
    assert.doesNotMatch(svg,/<image|data:image|@font-face|https?:\/\/(?!www\.w3\.org)/);
  }
  const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
  for(const item of JSON.parse(fs.readFileSync(path.join(directory,'raster-manifest.json'),'utf8')).assets){
    const bytes=fs.readFileSync(path.join(directory,item.output));
    assert.equal(hash(bytes),item.sha256,item.output);
    assert.equal(hash(fs.readFileSync(path.join(directory,item.source))),item.sourceSha256,item.source);
    assert.equal(bytes.readUInt32BE(16),item.width);assert.equal(bytes.readUInt32BE(20),item.height);
  }
});
test('ordinary homepage links are quiet, while real navigation states remain explicit',()=>{
  const home=fs.readFileSync(path.join(root,'docs/home.md'),'utf8');
  assert.doesNotMatch(home,/icon-arrow|[→↗]|class="(?:section-eyebrow|topic-index|path-number)"/);
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.doesNotMatch(index,/images\/(?:favicon|logo)\.png|icon-arrow-up-right/);
  assert.match(index,/images\/brand\/favicon\.svg\?v=[a-f0-9]+/);
  for(const file of ['index.html','articles/1/index.html','articles/index.html']){
    const html=fs.readFileSync(path.join(root,file),'utf8');
    assert.match(html,/class="brand-light"/);assert.match(html,/class="brand-dark"/);
    assert.match(html,/og:image:width" content="1200"/);
  }
  const footer=require('../scripts/article-view.js').footer(catalog,catalog.articles.find(a=>a.id===5),id=>'#/docs/'+id);
  assert.match(footer,/rel="prev"/);assert.match(footer,/rel="next"/);
  assert.match(footer,/icon-arrow-left/);assert.match(footer,/icon-arrow-right/);
});
