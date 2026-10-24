(function () {
  'use strict';
  var loading;
  function load() {
    if (!loading) loading = new Promise(function (resolve, reject) {
      var script = document.createElement('script'); script.src = '/vendor/mermaid.min.js';
      script.onload = function () { mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'neutral',fontFamily:'Inter, Noto Sans SC, sans-serif'}); resolve(); };
      script.onerror = function () { script.remove(); loading = null; reject(new Error('diagram load')); };
      document.head.append(script);
    });
    return loading;
  }
  function mount(section) {
    var diagrams = [];
    section.querySelectorAll('pre[data-lang="mermaid"]').forEach(function (pre) {
      var source = pre.querySelector('code').textContent;
      var wrapper = document.createElement('figure'); wrapper.className = 'diagram';
      var graph = document.createElement('div'); graph.className = 'mermaid'; graph.textContent = source;
      var details = document.createElement('details'); details.className = 'diagram-source';
      var summary = document.createElement('summary'); summary.textContent = '图表源代码';
      var code = document.createElement('pre'); code.textContent = source; details.append(summary, code);
      wrapper.append(graph, details); pre.replaceWith(wrapper); diagrams.push(graph);
    });
    if (!diagrams.length) return;
    function render() {
      return load().then(function () {
        var live = diagrams.filter(function (node) { return node.isConnected; });
        if (live.length) return mermaid.run({nodes:live});
      }).catch(function () {
        diagrams.forEach(function (graph) {
          if (!graph.isConnected) return;
          graph.replaceChildren();
          var button = document.createElement('button'); button.type = 'button'; button.className = 'button button-secondary'; button.textContent = '重试加载图表';
          button.onclick = function () { graph.textContent = graph.parentElement.querySelector('.diagram-source pre').textContent; graph.removeAttribute('data-processed'); render(); };
          graph.append(button); graph.parentElement.querySelector('details').open = true;
        });
      });
    }
    return render();
  }
  window.HowtoDiagrams = {mount:mount};
})();
