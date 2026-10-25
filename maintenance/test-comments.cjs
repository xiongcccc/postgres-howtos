const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const comments = require('../scripts/comments.js');
const config = require('../data/comment-threads.json');
const catalog = require('../data/articles.json');

test('all historical route spellings and static URLs resolve to the same article', () => {
  for (const route of ['/docs/1', '#/docs/1.md', '/./docs/1', '#/./docs/1?id=example', '/articles/1/']) assert.equal(comments.articleId(route), 1);
  for (const route of ['/', '#/', '/README', '#/README.md', '/docs/topics', '/docs/paths', '/docs/find?q=1', '/articles/', '/docs/1/evil', '/docs/1.md/evil']) assert.equal(comments.articleId(route), null);
});
test('commented Gitalk Issues are pinned by number, not title or current pathname', () => {
  for (const [id, number] of [[1, 6], [9, 25], [10, 9], [95, 99]]) assert.equal(comments.thread(id, config).number, number);
  assert.equal(comments.thread(94, config).number, null, 'Postscript comments must not appear under ANALYZE');
  assert.deepEqual(comments.thread(1, config).other, [109, 111]);
  assert.equal(comments.thread(1, config).href, 'https://github.com/xiongcccc/gitalk-comment/issues/6');
});
test('new articles use stable, distinct terms across Hash and static entry points', () => {
  assert.equal(comments.thread(109, config).term, 'postgres-howto-article-109');
  assert.equal(comments.thread(109, config).number, null);
  assert.notEqual(comments.thread(109, config).term, comments.thread(108, config).term);
});
test('public thread map contains no ambiguous or duplicate Issue ownership', () => {
  const seen = new Set();
  for (const [id, record] of Object.entries(config.threads)) {
    assert.ok(catalog.articles.some(a => a.id === Number(id)));
    for (const number of [record.issue, ...record.other]) {
      assert.ok(Number.isSafeInteger(number) && number > 0);
      assert.equal(seen.has(number), false, 'Issue assigned twice: ' + number); seen.add(number);
    }
  }
});
test('audit retains duplicates, excludes home and never silently changes a pinned thread', async () => {
  const {mapThreads} = await import('./sync-comment-threads.mjs');
  const issues = [
    {number: 6, comments: 2, labels: ['/./docs/1']},
    {number: 111, comments: 0, labels: [{name: '/docs/1'}]},
    {number: 109, comments: 0, labels: ['/./docs/1?id=chapter']},
    {number: 3, comments: 2, labels: ['/README']},
    {number: 99, comments: 1, labels: ['/./docs/94'], title: '后记'},
    {number: 112, comments: 0, labels: ['/./docs/95']},
    {number: 120, comments: 1, title: 'postgres-howto-article-109', labels: []}
  ];
  const map = mapThreads(issues);
  assert.deepEqual(map[1], {issue: 6, other: [109, 111]});
  assert.equal(map[109].issue, 120); assert.equal(Object.keys(map).length, 3);
  assert.deepEqual(map[95], {issue: 99, other: [112]}); assert.equal(map[94], undefined);
  issues[1].comments = 10;
  assert.equal(mapThreads(issues, map)[1].issue, 6);
});
test('all static articles retain no-JavaScript links to their exact historical thread', () => {
  for (const a of catalog.articles) {
    const html = fs.readFileSync(path.join(__dirname, '../articles', String(a.id), 'index.html'), 'utf8');
    assert.ok(html.includes(comments.markup(a.id, config)));
    assert.match(html, /src="\/scripts\/comments\.js\?v=/);
  }
  for (const file of ['index.html', 'topics/index.html', 'paths/index.html', 'articles/index.html']) assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), /id="gitalk-container"/);
});
test('published configuration contains no application secrets or legacy Gitalk runtime', () => {
  for (const file of ['index.html', 'scripts/comments.js', 'scripts/catalog-data.js', ...catalog.articles.map(a => `articles/${a.id}/index.html`)]) {
    const text = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(text, /client[_-]?secret\s*["']?\s*[:=]|new Gitalk\s*\(|gitalk(?:\.min)?\.js|gh[pousr]_[A-Za-z0-9]{20,}/i, file);
  }
});
