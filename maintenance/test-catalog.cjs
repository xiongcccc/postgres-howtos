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
  assert.equal(find('').length,100);
  assert.deepEqual(find('does-not-exist-xyz987654321'),[]);
  assert.ok(find('',{type:'conference'}).every(id=>[99,100].includes(id)));
  assert.ok(find('',{topic:'performance'}).includes(96));
  assert.deepEqual(find('WAL暴涨',{type:'conference'}),[]);
  assert.deepEqual(find('<script>alert(1)</script>'),[]);
});
test('generated internal article links exist and titles come from metadata',()=>{
  const files=['README.md','_sidebar.md','docs/topics.md','docs/paths.md','docs/conferences.md'];
  const map=new Map(catalog.articles.map(a=>[a.id,a]));
  for(const file of files){
    const text=fs.readFileSync(path.join(root,file),'utf8');
    for(const match of text.matchAll(/(?:\/docs\/)(\d+)(?:\.md|["?])/g)) assert.ok(map.has(Number(match[1])),file+': '+match[0]);
    assert.ok(!text.includes('](./docs/'),file+': relative routes');
  }
  const sidebar=fs.readFileSync(path.join(root,'_sidebar.md'),'utf8');
  for(const a of catalog.articles) assert.equal(sidebar.split('](/docs/'+a.id+'.md)').length,2);
});
test('cover is scoped to root and local assets exist',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(html.includes("coverpage: { '/': '_coverpage.md' }"));
  assert.ok(html.includes('onlyCover: false'));
  assert.ok(!html.includes('lib/plugins/search.min.js'));
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^" ]*)?"/g)) assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);
});
