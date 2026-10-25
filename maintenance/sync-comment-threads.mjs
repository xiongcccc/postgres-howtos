// Read-only public Issue audit. No token, Issue mutation or comment migration.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import comments from '../scripts/comments.js';

const target = new URL('../data/comment-threads.json', import.meta.url);
const repo = 'xiongcccc/gitalk-comment';
// Commit 6532988 moved the postscript from docs/94.md to docs/95.md.
const legacyArticleByIssue = {99: 95};
export function mapThreads(issues, previous = {}) {
  const groups = new Map();
  for (const issue of issues) {
    if (issue.pull_request) continue;
    const routes = (issue.labels || []).map(label => typeof label === 'string' ? label : label.name);
    const stable = issue.title?.match(/^postgres-howto-article-(\d+)$/);
    if (stable) routes.push('/docs/' + stable[1]);
    for (const route of routes) {
      const routeId = comments.articleId(route);
      if (!routeId) continue;
      const id = legacyArticleByIssue[issue.number] || routeId;
      const entries = groups.get(id) || [];
      if (!entries.some(entry => entry.number === issue.number)) entries.push({...issue, base: !route.includes('?')});
      groups.set(id, entries);
    }
  }
  return Object.fromEntries([...groups].sort(([a], [b]) => a - b).map(([id, entries]) => {
    entries.sort((a, b) => b.comments - a.comments || Number(b.base) - Number(a.base) || a.number - b.number);
    const pinned = entries.findIndex(entry => entry.number === previous[id]?.issue);
    if (pinned > 0) entries.unshift(...entries.splice(pinned, 1));
    return [id, {issue: entries[0].number, other: entries.slice(1).map(i => i.number).sort((a, b) => a - b)}];
  }));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let issues = [];
  const snapshot = process.argv.indexOf('--snapshot');
  if (snapshot !== -1) issues = JSON.parse(fs.readFileSync(process.argv[snapshot + 1], 'utf8'));
  else for (let page = 1; ; page++) {
    const response = await fetch(`https://api.github.com/repos/${repo}/issues?state=all&per_page=100&page=${page}`, {headers: {Accept: 'application/vnd.github+json'}});
    if (!response.ok) throw new Error('Issue audit failed: HTTP ' + response.status);
    const batch = await response.json(); issues.push(...batch);
    if (batch.length < 100) break;
  }
  const previous = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')).threads : {};
  const threads = mapThreads(issues, previous);
  if (!Object.keys(threads).length) throw new Error('Empty Issue audit; refusing to replace the historical map');
  if (Object.keys(previous).some(id => !threads[id])) throw new Error('Historical threads missing from audit; refusing to drop their mappings');
  fs.writeFileSync(target, JSON.stringify({repo, auditedOn: new Date().toISOString().slice(0, 10), threads}, null, 2) + '\n');
  console.log(`Mapped ${Object.keys(threads).length} articles from ${issues.length} Issues; no remote data changed.`);
}
