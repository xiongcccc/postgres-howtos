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
  assert.deepEqual(find('',{type:'conference'}),[99,100,101,102,103,104]);
  assert.ok(find('',{topic:'performance'}).includes(96));
  assert.deepEqual(find('WAL暴涨',{type:'conference'}),[]);
  assert.deepEqual(find('<script>alert(1)</script>'),[]);
});
test('series and source are independent and preserve old routes',()=>{
  assert.deepEqual(find('',{series:'interpretation'}),[101,102,103,104]);
  assert.deepEqual(find('',{series:'interpretation',topic:'ops'}),[102,103]);
  assert.deepEqual(find('',{series:'interpretation',type:'conference',topic:'performance'}),[101,104]);
  assert.deepEqual(find('',{series:'interpretation',type:'translation'}),[]);
  assert.deepEqual(find('',{series:'guide',type:'conference'}),[99]);
  assert.deepEqual(find('',{series:'practice',type:'conference'}),[100]);
  assert.equal(find('Stop Guessing')[0],101);
  for(const file of ['README.md','docs/series.md','docs/conferences.md','docs/topics.md']) {
    assert.match(fs.readFileSync(path.join(root,file),'utf8'),/\/docs\/101(?:\.md|")/);
  }
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
  for(const file of ['README.md','docs/series.md','docs/conferences.md','docs/topics.md']) {
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
  for(const file of ['README.md','docs/series.md','docs/conferences.md','docs/topics.md']) {
    assert.match(fs.readFileSync(path.join(root,file),'utf8'),/\/docs\/103(?:\.md|")/);
  }
});
test('generated internal article links exist and titles come from metadata',()=>{
  const files=['README.md','_sidebar.md','docs/topics.md','docs/paths.md','docs/conferences.md','docs/series.md','docs/101.md','docs/102.md','docs/103.md','docs/104.md'];
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
  assert.deepEqual(find('',{series:'interpretation',topic:'locks'}),[104]);
  const entry=catalog.articles.find(a=>a.id===104);
  assert.equal(entry.validation.status,'tested');
  assert.ok(fs.existsSync(path.join(root,entry.validation.record)));
  const article=fs.readFileSync(path.join(root,'docs/104.md'),'utf8');
  assert.equal([...article.matchAll(/```sql\n/g)].length,8);
  assert.doesNotMatch(article.split('## 参考资料')[0],/https:\/\/www\.postgresql\.org/);
  assert.doesNotMatch(article,/先把.+说具体|材料没有提供可供复现|反人类|反直觉|讲者/);
  for(const file of ['README.md','docs/series.md','docs/conferences.md','docs/topics.md']) {
    assert.match(fs.readFileSync(path.join(root,file),'utf8'),/\/docs\/104(?:\.md|")/);
  }
});
test('cover is scoped to root and local assets exist',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(html.includes("coverpage: { '/': '_coverpage.md' }"));
  assert.ok(html.includes('onlyCover: false'));
  assert.ok(!html.includes('lib/plugins/search.min.js'));
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^" ]*)?"/g)) assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);
});
