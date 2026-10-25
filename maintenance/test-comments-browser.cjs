// Independent browser, mocked provider: never logs in or writes a live comment.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const base = process.env.HOWTO_URL || 'http://127.0.0.1:4176/';
const output = path.resolve(process.env.HOWTO_SCREENSHOTS || '/tmp/howto-comments-qa');
const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
<p>Historical Issue <span id="issue"></span></p><textarea aria-label="Comment draft"></textarea>
<script>
const query = new URLSearchParams(location.search), origin = query.get('origin');
document.getElementById('issue').textContent = query.get('issue-number') || query.get('issue-term');
function theme(value) { document.body.dataset.theme=value; document.body.style.background=value==='github-dark'?'#0d1117':'#fff'; document.body.style.color=value==='github-dark'?'#e6edf3':'#24292f'; }
theme(query.get('theme')); addEventListener('message', event => { if(event.origin===origin && event.data.type==='set-theme') theme(event.data.theme); });
parent.postMessage({type:'resize', height:320}, origin);
</script></body></html>`;
(async () => {
  fs.mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const report = {checkedAt: new Date().toISOString(), provider: 'mocked, no live writes', cases: []};
  try {
    for (const mode of ['light', 'dark']) for (const width of [1440, 390]) {
      const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: mode, ...(width === 390 ? {isMobile: true, hasTouch: true} : {})});
      await context.addInitScript(mode => localStorage.setItem('howto-theme', mode), mode);
      await context.route(/busuanzi/, r => r.abort());
      const requests = [], errors = [];
      await context.route('https://utteranc.es/**', r => {requests.push(r.request().url()); return r.fulfill({contentType: 'text/html', body: fixture});});
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      const ready = () => page.waitForFunction(() => document.body.hasAttribute('data-static-page') && !document.body.dataset.staticArticle || document.querySelector('.markdown-section')?.dataset.renderedRoute === location.hash);
      const go = async route => {await page.goto(new URL(route, base).href); await ready();};
      const mount = async () => {
        await page.locator('#gitalk-container').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('.discussion-embed')?.style.height === '320px');
        return page.frameLocator('.discussion-frame');
      };
      for (const route of ['#/README', '#/docs/find?q=vacuum', '#/docs/topics.md', '#/docs/paths', '/topics/', '/paths/']) {
        await go(route); await page.locator('.site-footer').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('#gitalk-container').count(), 0);
      }
      assert.equal(requests.length, 0, 'Discovery pages must never contact the comment provider');
      for (const route of ['#/docs/1', '#/docs/1.md?id=explain-analyze-or-explain-analyze-buffers', '/articles/1/']) {
        await go(route);
        for (let n = 0; n < 3 && await page.locator('.theme-toggle').getAttribute('data-mode') !== mode; n++) await page.locator('.theme-toggle').click();
        if (!route.includes('?')) assert.equal(await page.locator('.discussion-frame').count(), 0, 'Comments must be lazy');
        const frame = await mount(), url = new URL(await page.locator('.discussion-frame').getAttribute('src'));
        assert.equal(url.searchParams.get('issue-number'), '6'); assert.equal(url.searchParams.has('issue-term'), false);
        assert.equal(url.searchParams.get('theme'), 'github-' + mode);
        assert.equal(await page.locator('.discussion-link').getAttribute('href'), 'https://github.com/xiongcccc/gitalk-comment/issues/6');
        await frame.getByLabel('Comment draft').fill('test draft - not submitted');
        const original = await page.locator('.discussion-frame').getAttribute('src');
        await page.evaluate(() => {
          const id = document.querySelector('.article-toc a[data-heading]')?.dataset.heading;
          location.hash = document.body.dataset.staticArticle ? '#' + encodeURIComponent(id) : location.hash.split('?')[0] + '?id=' + encodeURIComponent(id);
        });
        await page.waitForTimeout(150);
        assert.equal(await page.locator('.discussion-frame').getAttribute('src'), original);
        assert.equal(await frame.getByLabel('Comment draft').inputValue(), 'test draft - not submitted');
        const expected = mode === 'light' ? 'github-dark' : 'github-light';
        for (let n = 0; n < 3 && await page.locator('html').getAttribute('data-theme') === mode; n++) await page.locator('.theme-toggle').click();
        await frame.locator('body[data-theme="' + expected + '"]').waitFor();
        assert.equal(await frame.getByLabel('Comment draft').inputValue(), 'test draft - not submitted');
        await page.evaluate(() => {
          window.dispatchEvent(new MessageEvent('message', {origin: 'https://utteranc.es', source: window, data: {type: 'resize', height: 12345}}));
          window.dispatchEvent(new MessageEvent('message', {origin: 'https://example.com', source: document.querySelector('.discussion-frame').contentWindow, data: {type: 'resize', height: 12345}}));
        });
        assert.equal(await page.locator('.discussion-embed').evaluate(el => el.style.height), '320px');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.locator('#gitalk-container').screenshot({path: path.join(output, (route.startsWith('/articles') ? 'static' : route.includes('?') ? 'alias' : 'legacy') + '-' + width + '-' + mode + '.png')});
        report.cases.push({route, width, mode, issue: 6, draftPreserved: true, themeUpdated: true, noOverflow: true});
        await context.addInitScript(mode => localStorage.setItem('howto-theme', mode), mode);
      }
      await go('#/docs/109'); await mount();
      const fresh = new URL(await page.locator('.discussion-frame').getAttribute('src'));
      assert.equal(fresh.searchParams.get('issue-term'), 'postgres-howto-article-109');
      await page.evaluate(() => { location.hash = '#/docs/9'; }); await ready(); await mount();
      assert.equal(new URL(await page.locator('.discussion-frame').getAttribute('src')).searchParams.get('issue-number'), '25');
      assert.equal(await page.locator('.discussion-frame').count(), 1);
      await page.evaluate(() => { location.hash = '#/README'; }); await ready();
      assert.equal(await page.locator('.discussion-frame').count(), 0); assert.equal(await page.locator('#gitalk-container').count(), 0);
      await go('#/docs/99999'); assert.equal(await page.locator('#gitalk-container').count(), 0);
      await go('?utterances=mock-session-only&keep=1#/docs/1.md?id=chapter');
      assert.ok(!page.url().includes('utterances=')); assert.ok(page.url().includes('keep=1')); assert.ok(page.url().includes('#/docs/1.md?id=chapter'));
      assert.equal(await page.evaluate(() => localStorage.getItem('utterances-session')), 'mock-session-only');
      assert.deepEqual(errors, []); report.cases.push({width, mode, discoveryHidden: true, newIssueStable: true, spaIsolated: true, oauthQueryCleaned: true});
      await context.close();
    }
    const context = await browser.newContext();
    await context.route(/busuanzi/, r => r.abort());
    await context.addInitScript(() => {const original = window.setTimeout; window.setTimeout = (fn, delay, ...args) => original(fn, delay === 20000 ? 150 : delay, ...args);});
    let attempt = 0;
    await context.route('https://utteranc.es/**', r => ++attempt === 1 ? r.abort() : r.fulfill({contentType: 'text/html', body: fixture}));
    const page = await context.newPage();
    await page.goto(new URL('/articles/9/', base).href); await page.locator('#gitalk-container').scrollIntoViewIfNeeded();
    await page.getByRole('button', {name: '重新加载'}).click();
    await page.waitForFunction(() => document.querySelector('.discussion-embed')?.style.height === '320px');
    assert.equal(await page.locator('.discussion-frame').count(), 1); assert.equal(attempt, 2);
    report.cases.push({failureRetry: true}); await context.close();
    const callbackContext = await browser.newContext();
    await callbackContext.addInitScript(() => {const original = window.setTimeout; window.setTimeout = (fn, delay, ...args) => original(fn, delay === 2000 ? 50 : delay, ...args);});
    let statisticRequests = 0, releaseBundle;
    const bundleGate = new Promise(resolve => {releaseBundle = resolve;});
    await callbackContext.route(/busuanzi/, r => {statisticRequests++; return r.abort();});
    await callbackContext.route('**/scripts/comments.js*', async r => {await bundleGate; await r.continue();});
    const callbackPage = await callbackContext.newPage();
    try {
      await callbackPage.goto(new URL('?utterances=mock-session-only#/docs/1', base).href, {waitUntil: 'commit'});
      await callbackPage.waitForFunction(() => Boolean(window.HowtoUI));
      await callbackPage.waitForTimeout(200);
      assert.equal(statisticRequests, 0, 'OAuth callback parameters must never reach analytics');
      assert.ok(callbackPage.url().includes('utterances='), 'The bundle must actually be held during this check');
      releaseBundle();
      await callbackPage.waitForFunction(() => !location.search.includes('utterances='));
      report.cases.push({delayedCallbackExcludesAnalytics: true});
    } finally {releaseBundle(); await callbackContext.close();}
    if (process.env.HOWTO_LIVE_COMMENTS === '1') {
      // Anonymous read only. OAuth and actual comment posting are deliberately excluded.
      for (const mode of ['light', 'dark']) for (const width of [1440, 390]) {
        const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: mode});
        await context.addInitScript(mode => localStorage.setItem('howto-theme', mode), mode);
        await context.route(/busuanzi/, r => r.abort());
        const page = await context.newPage();
        const route = width === 390 ? '/articles/1/' : '#/docs/9';
        await page.goto(new URL(route, base).href); await page.locator('#gitalk-container').scrollIntoViewIfNeeded();
        const frame = page.frameLocator('.discussion-frame'), count = width === 390 ? 2 : 5;
        await frame.getByRole('heading', {name: new RegExp('^' + count + ' Comments')}).waitFor({timeout: 45000});
        await page.waitForFunction(() => document.querySelector('.discussion-embed')?.style.height !== '' && document.querySelector('.discussion-status')?.hidden);
        assert.ok(await frame.getByRole('link', {name: 'Sign in with GitHub'}).isVisible());
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        assert.ok(await frame.locator('body').evaluate(el => el.scrollWidth <= innerWidth + 1));
        await page.locator('#gitalk-container').screenshot({path: path.join(output, 'live-' + width + '-' + mode + '.png')});
        report.cases.push({route, width, mode, liveAnonymousRead: true, historicalComments: count});
        await context.close();
      }
    }
    console.log('PASS: ' + report.cases.length + ' comment cases, mobile/desktop, light/dark, no live writes');
  } finally {
    fs.writeFileSync(path.join(output, 'comments.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close();
  }
})().catch(e => {console.error(e); process.exitCode = 1;});
