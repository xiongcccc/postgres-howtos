(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else api.start(root);
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var provider = 'https://utteranc.es';
  function escape(value) {
    return String(value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
  }
  function articleId(route) {
    var match = String(route).match(/^(?:#?\/(?:\.\/)?docs\/(\d+)(?:\.md)?(?:\?.*)?|\/articles\/(\d+)\/?)$/);
    return match ? Number(match[1] || match[2]) : null;
  }
  function thread(id, config) {
    var record = config.threads[id];
    var term = 'postgres-howto-article-' + id;
    return {number: record?.issue || null, term: term, other: record?.other || [],
      href: 'https://github.com/' + config.repo + '/issues' + (record ? '/' + record.issue : '?q=' + encodeURIComponent('is:issue in:title "' + term + '"'))};
  }
  function markup(id, config) {
    var discussion = thread(id, config);
    return '<section id="gitalk-container" class="article-discussion" aria-label="文章讨论" data-comment-article="' + id + '"><h2>讨论与补充</h2>' +
      '<a class="discussion-link" href="' + escape(discussion.href) + '" target="_blank" rel="noopener noreferrer">在 GitHub 查看讨论</a>' +
      (discussion.other.length ? '<details class="discussion-history"><summary>其他历史讨论（' + discussion.other.length + '）</summary><ul>' + discussion.other.map(function (number) {
        return '<li><a href="https://github.com/' + escape(config.repo) + '/issues/' + number + '" target="_blank" rel="noopener noreferrer">历史讨论 #' + number + '</a></li>';
      }).join('') + '</ul></details>' : '') + '</section>';
  }
  function start(win) {
    var doc = win.document, catalog = win.HowtoCatalog, config = catalog?.comments;
    if (!config) return;
    var current = null, observer = null, timer = null, session = '';
    // Follow the hosted client's session hand-off; no OAuth application secret lives here.
    var callback = new URL(win.location.href);
    session = callback.searchParams.get('utterances') || '';
    if (session) {
      callback.searchParams.delete('utterances');
      win.history.replaceState(win.history.state, '', callback.href);
      try { win.localStorage.setItem('utterances-session', session); } catch (_) {}
    } else {
      try { session = win.localStorage.getItem('utterances-session') || ''; } catch (_) {}
    }
    function theme() { return doc.documentElement.dataset.theme === 'dark' ? 'github-dark' : 'github-light'; }
    function id() {
      var number = doc.body.dataset.staticArticle ? Number(doc.body.dataset.staticArticle) : articleId(win.location.hash);
      return catalog.articles.some(function (a) { return a.id === number; }) ? number : null;
    }
    function cleanup() {
      observer?.disconnect(); observer = null;
      win.clearTimeout(timer); timer = null;
      current?.container.querySelector('.discussion-embed')?.remove();
      current?.container.querySelector('.discussion-status')?.remove();
      current = null;
    }
    function mount(state) {
      if (current !== state || id() !== state.id || !state.container.isConnected || state.frame) return;
      observer?.disconnect(); observer = null;
      var discussion = thread(state.id, config), article = catalog.articles.find(function (a) { return a.id === state.id; });
      var params = new URLSearchParams({repo: config.repo, origin: win.location.origin, theme: theme(),
        url: 'https://postgres-howto.cn/articles/' + state.id + '/', title: article.title, description: article.title,
        session: session});
      params.set(discussion.number ? 'issue-number' : 'issue-term', discussion.number || discussion.term);
      var status = doc.createElement('p'); status.className = 'discussion-status'; status.setAttribute('role', 'status');
      status.textContent = '正在加载评论…';
      var embed = doc.createElement('div'); embed.className = 'discussion-embed';
      var frame = doc.createElement('iframe');
      frame.className = 'discussion-frame'; frame.title = '文章评论'; frame.scrolling = 'no';
      frame.referrerPolicy = 'no-referrer'; frame.src = provider + '/utterances.html?' + params;
      state.frame = frame; state.status = status; state.embed = embed;
      state.container.append(status, embed); embed.append(frame);
      function failed() {
        if (current !== state || state.ready) return;
        status.replaceChildren(doc.createTextNode('评论暂未加载成功，可重试或在 GitHub 查看。'));
        var retry = doc.createElement('button'); retry.type = 'button'; retry.className = 'discussion-retry'; retry.textContent = '重新加载';
        retry.addEventListener('click', function () {
          if (current !== state) return;
          win.clearTimeout(timer); embed.remove(); status.remove(); state.frame = null; mount(state);
        });
        status.append(retry);
      }
      frame.addEventListener('error', failed, {once: true});
      timer = win.setTimeout(failed, 20000);
    }
    function enhance() {
      var number = id(), section = doc.querySelector('.markdown-section');
      if (!number || !section || /没有找到这篇文章/.test(section.querySelector('h1')?.textContent || '')) { cleanup(); return; }
      if (current?.id === number && current.container.isConnected) return;
      cleanup();
      var container = section.querySelector('#gitalk-container');
      if (!container || Number(container.dataset.commentArticle) !== number) {
        container?.remove(); section.insertAdjacentHTML('beforeend', markup(number, config));
        container = section.querySelector('#gitalk-container');
      }
      current = {id: number, container: container};
      var state = current;
      if ('IntersectionObserver' in win) {
        observer = new win.IntersectionObserver(function (entries) {
          if (entries.some(function (entry) { return entry.isIntersecting; })) mount(state);
        }, {rootMargin: '200px 0px'});
        observer.observe(container);
      } else mount(state);
    }
    // Validate both origin and frame identity: late messages must never resize another article.
    win.addEventListener('message', function (event) {
      var state = current, data = event.data;
      if (event.origin !== provider || !state?.frame || event.source !== state.frame.contentWindow || id() !== state.id ||
          !state.container.isConnected || data?.type !== 'resize' || !Number.isFinite(data.height) || data.height <= 0 || data.height > 100000) return;
      state.embed.style.height = Math.ceil(data.height) + 'px';
      if (!state.ready) state.frame.contentWindow.postMessage({type: 'set-theme', theme: theme()}, provider);
      state.ready = true;
      win.clearTimeout(timer); state.status.hidden = true;
    });
    new win.MutationObserver(function () {
      current?.frame?.contentWindow.postMessage({type: 'set-theme', theme: theme()}, provider);
    }).observe(doc.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    win.addEventListener('hashchange', function () { if (current && id() !== current.id) cleanup(); });
    if (doc.body.dataset.staticArticle) enhance();
    else {
      win.$docsify = win.$docsify || {};
      win.$docsify.plugins = (win.$docsify.plugins || []).concat(function (hook) { hook.doneEach(enhance); });
    }
  }
  return {articleId: articleId, thread: thread, markup: markup, start: start};
});
