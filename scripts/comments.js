(function () {
  window.$docsify.plugins = (window.$docsify.plugins || []).concat(function (hook) {
    hook.doneEach(function () {
      var route = (location.hash.slice(1).split('?')[0] || '/').replace(/\/$/, '') || '/';
      var home = /^\/(?:README(?:\.md)?)?$/i.test(route);
      document.body.classList.toggle('reading-home', home);
      var previous = document.getElementById('gitalk-container');
      if (previous) previous.remove();
      if (home || typeof Gitalk === 'undefined') return;
      var main = document.getElementById('main');
      if (!main) return;
      var container = document.createElement('div');
      container.id = 'gitalk-container';
      container.style.cssText = 'max-width:80%;margin:0 auto 20px';
      main.parentNode.append(container);
      // Keep the existing issue IDs so article discussions remain attached.
      new Gitalk(Object.assign({}, window.$docsify.gitalkWithFooter.gitalkConfig, {
        id: location.href.split('#')[1]
      })).render('gitalk-container');
    });
  });
})();
