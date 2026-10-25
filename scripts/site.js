(function () {
  'use strict';
  var preference = 'auto';
  var menuFocus = null;
  var dialogFocus = null;
  var pendingSearch = false;
  var pendingContentFocus = false;
  var media = matchMedia('(prefers-color-scheme: dark)');
  var compact = matchMedia('(max-width: 1023px)');
  function icon(name) { return '<span class="icon icon-' + name + '" aria-hidden="true"></span>'; }
  function getSaved(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  preference = getSaved('howto-theme', 'auto');
  if (!['auto', 'light', 'dark'].includes(preference)) preference = 'auto';
  function applyTheme() {
    var dark = preference === 'dark' || (preference === 'auto' && media.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.body.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]').content = dark ? '#181c21' : '#ffffff';
    document.querySelectorAll('.theme-toggle').forEach(function (button) {
      var label = {auto: '跟随系统', light: '浅色', dark: '深色'}[preference];
      button.innerHTML = icon({auto: 'monitor', light: 'sun', dark: 'moon'}[preference]);
      button.title = button.getAttribute('aria-label') === '切换阅读主题' ? '阅读主题：' + label : label;
      button.setAttribute('aria-label', '阅读主题：' + label + '，点击切换');
      button.dataset.mode = preference;
    });
  }
  function closeNavigation(restore) {
    document.body.classList.remove('nav-open');
    document.querySelector('.sidebar-backdrop').hidden = true;
    document.getElementById('sidebar-toggle').setAttribute('aria-expanded', 'false');
    document.getElementById('sidebar-toggle').setAttribute('aria-label', '打开导航');
    document.querySelector('.content')?.removeAttribute('inert');
    document.querySelector('.site-footer')?.removeAttribute('inert');
    document.querySelector('.site-header')?.removeAttribute('inert');
    var sidebar = document.querySelector('.sidebar');
    if (sidebar) { sidebar.inert = compact.matches; sidebar.removeAttribute('aria-modal'); sidebar.setAttribute('role', 'navigation'); }
    if (restore && menuFocus?.isConnected) menuFocus.focus();
  }
  function openNavigation() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar || !compact.matches) return;
    menuFocus = document.activeElement;
    document.body.classList.add('nav-open');
    document.querySelector('.sidebar-backdrop').hidden = false;
    document.getElementById('sidebar-toggle').setAttribute('aria-expanded', 'true');
    document.getElementById('sidebar-toggle').setAttribute('aria-label', '关闭导航');
    document.querySelector('.content')?.setAttribute('inert', '');
    document.querySelector('.site-footer')?.setAttribute('inert', '');
    document.querySelector('.site-header')?.setAttribute('inert', '');
    sidebar.inert = false;
    sidebar.setAttribute('role', 'dialog');
    sidebar.setAttribute('aria-modal', 'true');
    Array.from(sidebar.querySelectorAll('button,a,summary')).find(function(el){return el.getClientRects().length;})?.focus();
  }
  function search() {
    closeNavigation(false);
    var input = document.querySelector('#article-query');
    if (input) { input.focus(); input.select(); input.scrollIntoView({block: 'center'}); }
    else if(document.body.hasAttribute('data-static-page'))location.href='/#/docs/find?focus=search';
    else { pendingSearch = true; location.hash = '/docs/find'; }
  }
  function finishNavigation() {
    closeNavigation(false);
    document.querySelectorAll('.app-nav a').forEach(function (a) {
      var current = (location.hash.split('?')[0] || '#/README').replace(/\.md$/,'');
      var route=a.dataset.docsRoute?'#'+a.dataset.docsRoute:a.hash;
      if (route === current || (route === '#/README' && current === '#/')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (pendingSearch) { pendingSearch = false; document.querySelector('#article-query')?.focus(); }
    else if (pendingContentFocus) { pendingContentFocus = false; document.querySelector('.markdown-section')?.focus(); }
  }
  async function copy(button) {
    var code = button.closest('.code-block').querySelector('pre code').textContent;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
      else {
        var field = document.createElement('textarea');
        field.value = code; field.className = 'clipboard-fallback'; document.body.append(field); field.select();
        var ok = document.execCommand('copy'); field.remove(); button.focus();
        if (!ok) throw new Error('clipboard');
      }
      button.innerHTML = icon('check'); button.title = '已复制'; button.setAttribute('aria-label', '代码已复制');
      document.querySelector('#copy-status').textContent = '代码已复制';
      setTimeout(function () { if (button.isConnected) { button.innerHTML = icon('copy'); button.title = '复制代码'; button.setAttribute('aria-label', '复制代码'); } }, 1800);
    } catch (_) { button.title = '复制失败，请选择代码复制'; document.querySelector('#copy-status').textContent = '复制失败，请选择代码复制'; }
  }
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.reading-settings')) document.querySelectorAll('.reading-settings[open]').forEach(function(el){el.open=false;});
    var target = event.target.closest('a,button');
    if (!target) return;
    if(target.tagName==='A'&&target.closest('.sidebar')&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){
      pendingContentFocus=target.hash!==location.hash;closeNavigation(false);
      if(!pendingContentFocus)document.querySelector('.markdown-section')?.focus();
    }
    if (target.matches('.theme-toggle')) { preference = {auto:'light', light:'dark', dark:'auto'}[preference]; save('howto-theme', preference); applyTheme(); }
    if (target.id === 'sidebar-toggle') document.body.classList.contains('nav-open') ? closeNavigation(true) : openNavigation();
    if (target.matches('.sidebar-backdrop,[data-close-nav]')) closeNavigation(true);
    if (target.hasAttribute('data-open-search')) search();
    if (target.hasAttribute('data-skip')) { event.preventDefault(); event.stopImmediatePropagation(); document.querySelector('#main')?.focus(); document.querySelector('#main')?.scrollIntoView(); }
    if (target.hasAttribute('data-dialog')) {
      var dialog = document.getElementById(target.dataset.dialog);
      if (!dialog) return;
      dialogFocus = target;
      dialog.querySelectorAll('img[data-src]').forEach(function (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); });
      dialog.showModal();
    }
    if (target.hasAttribute('data-close-dialog')) target.closest('dialog').close();
    if (target.matches('.code-copy')) copy(target);
    if (target.dataset.font) {
      var current = Number(getSaved('howto-font', '16'));
      var size = target.dataset.font === 'reset' ? 16 : Math.min(20, Math.max(14, current + Number(target.dataset.font)));
      save('howto-font', String(size)); document.documentElement.style.setProperty('--reading-size', size + 'px');
    }
    // Keep old Markdown and data-docs-route links working without a document request.
    if (target.tagName === 'A' && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && target.target !== '_blank' && !target.hasAttribute('download')) {
      var href = target.getAttribute('href') || '';
      var match = href.match(/^\/?(?:\.\/)?(README|docs\/[\w-]+|maintenance\/[\w-]+)\.md(\?[^#]*)?$/);
      var route = target.dataset.docsRoute || (match ? '/' + match[1] + (match[2] || '') : '');
      if (route) {
        event.preventDefault();
        if(document.body.hasAttribute('data-static-page'))location.href='/#'+route;
        else if(location.hash==='#'+route&&target.closest('.site-header')){
          window.scrollTo(0,0);
          document.getElementById('main')?.focus({preventScroll:true});
        }else location.hash=route;
      }
    }
  });
  document.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) { event.preventDefault(); search(); }
    if(event.key==='Escape'&&!document.querySelector('dialog[open]')){
      var settings=document.querySelector('.reading-settings[open]');
      if(settings){settings.open=false;settings.querySelector('summary').focus();event.preventDefault();}
    }
    if (!document.body.classList.contains('nav-open')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeNavigation(true); }
    if (event.key === 'Tab') {
      var buttons = Array.from(document.querySelector('.sidebar').querySelectorAll('a,button,summary')).filter(function (e) { return e.getClientRects().length; });
      var first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  document.querySelectorAll('dialog').forEach(function (dialog) {
    dialog.addEventListener('close', function () { if (dialogFocus?.isConnected) dialogFocus.focus(); });
    dialog.addEventListener('click', function (event) { if (event.target === dialog) { var r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  });
  function zoomImage(img) {
    var viewer=document.getElementById('image-viewer');
    if(!viewer){
      viewer=document.createElement('dialog');viewer.id='image-viewer';viewer.className='image-viewer';viewer.setAttribute('aria-label','文章图片预览');
      viewer.innerHTML='<div class="image-viewer-toolbar"><button type="button" class="icon-button" data-image-size aria-label="原始尺寸" title="原始尺寸" aria-pressed="false">'+icon('zoom-in')+'</button><button type="button" class="icon-button" data-close-dialog aria-label="关闭图片预览" title="关闭图片预览">'+icon('x')+'</button></div><div class="image-viewport" tabindex="0" role="region" aria-label="图片预览区域"><img alt=""></div>';
      document.body.append(viewer);
      var viewport=viewer.querySelector('.image-viewport');
      var preview=viewer.querySelector('img');
      var toggle=viewer.querySelector('[data-image-size]');
      function setSize(original){
        viewer.dataset.original=String(original);
        toggle.innerHTML=icon(original?'zoom-out':'zoom-in');
        toggle.title=original?'适应窗口':'原始尺寸';
        toggle.setAttribute('aria-label',toggle.title);
        toggle.setAttribute('aria-pressed',String(original));
        viewport.scrollTo(0,0);
      }
      function updateSize(){
        if(!viewer.open)return;
        viewer.style.setProperty('--image-width',preview.naturalWidth+'px');
        toggle.disabled=!preview.naturalWidth||(preview.naturalWidth<=viewport.clientWidth-32&&preview.naturalHeight<=viewport.clientHeight-32);
        if(toggle.disabled)setSize(false);
      }
      toggle.addEventListener('click',function(){setSize(viewer.dataset.original!=='true');});
      preview.addEventListener('load',updateSize);
      preview.addEventListener('error',function(){toggle.disabled=true;setSize(false);});
      window.addEventListener('resize',updateSize);
      viewer.resetImage=function(){setSize(false);toggle.disabled=true;};
      viewer.updateImageSize=updateSize;
      viewer.addEventListener('close',function(){if(dialogFocus?.isConnected)dialogFocus.focus();});
      viewer.addEventListener('click',function(event){if(event.target===viewer){var r=viewer.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)viewer.close();}});
    }
    dialogFocus=img;viewer.resetImage();viewer.querySelector('img').src=img.currentSrc||img.src;viewer.querySelector('img').alt=img.alt;viewer.showModal();
    if(viewer.querySelector('img').complete)viewer.updateImageSize();
  }
  document.addEventListener('click',function(event){if(event.target.matches('img[data-zoomable]'))zoomImage(event.target);});
  document.addEventListener('keydown',function(event){if(event.target.matches('img[data-zoomable]')&&(event.key==='Enter'||event.key===' ')){event.preventDefault();zoomImage(event.target);}});
  media.addEventListener('change', function () { if (preference === 'auto') applyTheme(); });
  compact.addEventListener('change', function () { closeNavigation(false); });
  document.documentElement.style.setProperty('--reading-size', Math.min(20, Math.max(14, Number(getSaved('howto-font', '16')) || 16)) + 'px');
  var status = document.createElement('span'); status.id = 'copy-status'; status.className = 'sr-only'; status.setAttribute('role', 'status'); document.body.append(status);
  applyTheme();
  document.documentElement.classList.add('has-js');
  window.HowtoUI = {icon: icon, finishNavigation: finishNavigation};
  // Statistics are non-blocking and never add fixed UI over the article.
  setTimeout(function () {
    // A delayed comment bundle must not expose an OAuth hand-off URL to analytics.
    if (new URL(location.href).searchParams.has('utterances')) return;
    var script = document.createElement('script'); script.async = true;
    script.src = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
    document.body.append(script);
  }, 2000);
})();
