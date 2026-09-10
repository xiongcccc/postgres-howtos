(function () {
  'use strict';
  var catalog = window.HowtoCatalog;
  if (!catalog || !window.HowtoSearch) return;
  var byId = new Map(catalog.articles.map(function (a) { return [a.id,a]; }));
  var bodies = null;
  var indexRequest = null;
  var tocObserver = null;
  var navObserver = null;
  function escape(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
  }
  function route() { return location.hash.slice(1).split('?')[0].replace(/\/$/,'') || '/'; }
  function currentArticle() {
    var m = route().match(/^\/docs\/(\d+)(?:\.md)?$/);
    return m ? byId.get(Number(m[1])) : null;
  }
  function readState() { try { return JSON.parse(localStorage.getItem('howto-sidebar-v2') || '{}'); } catch (_) { return {}; } }
  function saveState(s) { try { localStorage.setItem('howto-sidebar-v2',JSON.stringify(s)); } catch (_) {} }
  function loadIndex() {
    if (bodies) return Promise.resolve(bodies);
    if (!indexRequest) indexRequest = fetch('data/search-index.json?v='+catalog.revision).then(function (r) {
      if (!r.ok) throw new Error('search index');
      return r.json();
    }).then(function (data) {
      if (data.revision !== catalog.revision) throw new Error('search index version');
      bodies = Object.fromEntries(data.articles.map(function (a) { return [a.id,a.text]; }));
      return bodies;
    }).catch(function (e) { indexRequest = null; throw e; });
    return indexRequest;
  }
  function mountFinder(el) {
    if (el.dataset.ready) return;
    el.dataset.ready = 'true';
    var home = el.hasAttribute('data-home');
    var params = new URLSearchParams(location.hash.split('?')[1] || '');
    var query = params.get('q') || '';
    var limit = 20;
    var failed = false;
    el.innerHTML = '<form role="search" class="finder-form"><label for="article-query">查找文章</label><div class="finder-input"><input id="article-query" type="search" placeholder="输入问题、中文标题或技术关键词" autocomplete="off"><button type="submit" aria-label="搜索文章">搜索</button></div><div class="finder-filters"><label>主题 <select name="topic"><option value="">全部主题</option>'+catalog.topics.map(function(t){return '<option value="'+t.id+'">'+escape(t.title)+'</option>';}).join('')+'</select></label><label>内容 <select name="type"><option value="">全部类型</option>'+Object.entries(catalog.types).map(function(t){return '<option value="'+t[0]+'">'+escape(t[1])+'</option>';}).join('')+'</select></label></div></form><p class="finder-status" role="status" aria-live="polite"></p><ol class="finder-results"></ol><button type="button" class="finder-more" hidden>显示更多</button><button type="button" class="finder-retry" hidden>重试全文搜索</button>';
    var form = el.querySelector('form');
    var input = el.querySelector('input');
    var topic = el.querySelector('[name=topic]');
    var type = el.querySelector('[name=type]');
    type.querySelector('option[value="editorial"]')?.remove();
    var status = el.querySelector('.finder-status');
    var results = el.querySelector('.finder-results');
    var more = el.querySelector('.finder-more');
    var retry = el.querySelector('.finder-retry');
    input.value = query;
    topic.value = params.get('topic') || '';
    type.value = params.get('type') || '';
    function url() {
      var p = new URLSearchParams();
      if (input.value.trim()) p.set('q',input.value.trim());
      if (topic.value) p.set('topic',topic.value);
      if (type.value) p.set('type',type.value);
      return '#/docs/find'+(p.size?'?'+p.toString():'');
    }
    function render() {
      if (!el.isConnected) return;
      var empty = !input.value.trim() && !topic.value && !type.value;
      if (empty && home) {
        status.textContent = catalog.articles.filter(function(a){return a.type!=='editorial';}).length+' 篇文章 · 支持中文、原题与关键词查找';
        results.replaceChildren(); more.hidden = true; retry.hidden = true; return;
      }
      var matches = window.HowtoSearch.search(catalog,input.value,{topic:topic.value,type:type.value},bodies);
      status.textContent = (matches.length ? matches.length+' 条匹配结果' : '没有找到匹配文章，试试更短的关键词或清除筛选。')+(input.value.trim() && !bodies ? (failed?' · 全文索引暂不可用，当前仅匹配标题与别名。':' · 正在加载全文索引…'):'');
      results.replaceChildren();
      matches.slice(0,limit).forEach(function(result){
        var a=result.article;
        var li=document.createElement('li');
        var link=document.createElement('a');
        link.href='#/docs/'+a.id; link.textContent=a.title;
        var info=document.createElement('small');
        info.textContent=catalog.types[a.type]+' · '+catalog.topics.find(function(t){return t.id===a.topics[0];}).title+' · #'+a.id;
        li.append(link,info);
        if (bodies && input.value.trim()) {
          var text=bodies[a.id] || '';
          var at=text.toLowerCase().indexOf(input.value.trim().toLowerCase());
          var snippet=document.createElement('p');
          snippet.textContent=(at>60?'…':'')+text.slice(Math.max(0,at-40),Math.max(0,at-40)+135)+'…';
          li.append(snippet);
        }
        results.append(li);
      });
      more.hidden=matches.length<=limit;
      retry.hidden=!failed;
    }
    function update() {
      limit=20;
      if (!home) history.replaceState(null,'',url());
      render();
      if (input.value.trim() && !bodies) loadIndex().then(function(){failed=false;render();}).catch(function(){failed=true;render();});
    }
    var timer;
    input.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(update,120);});
    topic.addEventListener('change',update); type.addEventListener('change',update);
    form.addEventListener('submit',function(e){e.preventDefault();clearTimeout(timer);if(home) location.hash=url();else update();});
    more.addEventListener('click',function(){limit+=20;render();});
    retry.addEventListener('click',function(){failed=false;update();});
    update();
  }
  function mountSidebar() {
    var nav=document.querySelector('.sidebar-nav');
    if (!nav) return;
    var active=currentArticle();
    var state=readState();
    var links=[['首页','/'],['查找文章','/docs/find'],['专题索引','/docs/topics'],['推荐路径','/docs/paths'],['会议精选','/docs/conferences']];
    nav.innerHTML='<nav class="catalog-navigation" aria-label="文章分类"><ul class="catalog-pages">'+links.map(function(pair){var selected=pair[1]===route() || (pair[1]==='/'&&route()==='/README');return '<li><a href="#'+pair[1]+'"'+(selected?' aria-current="page"':'')+'>'+pair[0]+'</a></li>';}).join('')+'</ul>'+catalog.topics.map(function(t){
      var items=catalog.articles.filter(function(a){return a.topics[0]===t.id;});
      var open=(active && active.topics[0]===t.id) || (state[t.id]===undefined ? !active&&t.id==='performance' : state[t.id]);
      return '<details data-topic="'+t.id+'"'+(open?' open':'')+'><summary>'+escape(t.title)+' <small>'+items.length+'</small></summary><ul>'+items.map(function(a){return '<li><a href="#/docs/'+a.id+'"'+(active&&active.id===a.id?' aria-current="page"':'')+'><span class="article-number">'+a.id+'.</span> '+escape(a.title)+'</a></li>';}).join('')+'</ul></details>';
    }).join('')+'</nav>';
    nav.querySelectorAll('details').forEach(function(d){
      var userToggle=false;
      d.querySelector('summary').addEventListener('click',function(){userToggle=true;});
      d.addEventListener('toggle',function(){if(userToggle){state[d.dataset.topic]=d.open;saveState(state);userToggle=false;}});
    });
    var current=nav.querySelector('details a[aria-current="page"]');
    if(current) current.scrollIntoView({block:'nearest'});
    if (!navObserver) {
      navObserver=new MutationObserver(function(){if(!nav.querySelector('.catalog-navigation')) mountSidebar();});
      navObserver.observe(nav,{childList:true});
    }
  }
  function mountArticle() {
    if (tocObserver) {tocObserver.disconnect();tocObserver=null;}
    var a=currentArticle();
    document.body.classList.toggle('reading-article',Boolean(a));
    var section=document.querySelector('.markdown-section');
    if (!section || !a) return;
    var h1=section.querySelector('h1');
    if(h1 && /^404\b/.test(h1.textContent.trim())) return;
    if (!h1) {h1=document.createElement('h1');section.prepend(h1);}
    var headingText=h1.querySelector('a span') || h1.querySelector('a') || h1;
    headingText.textContent=a.title;
    document.title=a.title+' | PostgreSQL Howto 中文版';
    var old=section.querySelector('.article-meta');if(old)old.remove();
    var meta=document.createElement('div');meta.className='article-meta';
    meta.innerHTML='<p class="article-kicker">'+escape(catalog.types[a.type])+' · '+escape(catalog.topics.find(function(t){return t.id===a.topics[0];}).title)+' · #'+a.id+'</p><p>'+escape(a.versionNote)+'</p><details><summary>来源与验证说明</summary><dl><dt>原题</dt><dd>'+escape(a.originalTitle)+'</dd><dt>来源</dt><dd><a href="'+escape(a.source.url)+'" target="_blank" rel="noopener">'+escape(a.source.label)+'</a></dd><dt>验证状态</dt><dd>'+escape(a.validation.note)+(a.validation.date?'（'+escape(a.validation.date)+'）':'')+(a.validation.record?' <a href="#'+a.validation.record.replace(/\.md$/,'')+'">验证记录</a>':'')+'</dd></dl></details>';
    h1.after(meta);
    var attribution=meta.nextElementSibling;
    if(attribution && attribution.tagName==='BLOCKQUOTE' && /^(原作者：|会议精选\s*·)/.test(attribution.textContent.trim())) {
      meta.querySelector('details').append(attribution);
    }
    var previous=section.querySelector('.article-toc');if(previous)previous.remove();
    var headings=Array.from(section.querySelectorAll('h2,h3')).filter(function(h){return h.id;});
    if (!headings.length) return;
    var toc=document.createElement('details');toc.className='article-toc';toc.open=window.matchMedia('(min-width: 1440px)').matches;
    toc.innerHTML='<summary>本页目录</summary><nav aria-label="本页目录"><ol>'+headings.map(function(h){return '<li'+(h.tagName==='H3'?' class="toc-sub"':'')+'><a href="#'+route()+'?id='+encodeURIComponent(h.id)+'">'+escape(h.textContent)+'</a></li>';}).join('')+'</ol></nav>';
    meta.after(toc);
    if ('IntersectionObserver' in window) {
      tocObserver=new IntersectionObserver(function(entries){
        var visible=entries.filter(function(e){return e.isIntersecting;}).sort(function(a,b){return a.boundingClientRect.top-b.boundingClientRect.top;});
        if(!visible.length)return;
        toc.querySelectorAll('a').forEach(function(link){if(link.hash.endsWith('id='+encodeURIComponent(visible[0].target.id)))link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
      },{rootMargin:'-5% 0px -65% 0px'});
      headings.forEach(function(h){tocObserver.observe(h);});
    }
  }
  function mountControls() {
    var section=document.querySelector('.markdown-section');
    if(!section)return;
    var names={switchLightDarkModeDivBeforeArticle:'切换阅读主题',zoomInSpan:'增大字号',zoomOutSpan:'减小字号',zoomDefaultSpan:'恢复字号'};
    var controls=document.querySelector('.reading-controls');
    if(!controls){controls=document.createElement('div');controls.className='reading-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','阅读设置');}
    if(controls.parentElement!==section) section.prepend(controls);
    Object.entries(names).forEach(function(pair){
      var button=document.getElementById(pair[0]);
      if(!button)return;
      if(button.parentElement!==controls) controls.append(button);
      button.setAttribute('role','button');button.tabIndex=0;button.setAttribute('aria-label',pair[1]);button.title=pair[1];
      if(!button.dataset.keyboard){button.dataset.keyboard='true';button.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();button.click();}});}
    });
  }
  window.$docsify.plugins=(window.$docsify.plugins || []).concat(function(hook){
    hook.beforeEach(function(content){
      // Theme/zoom plugins create their controls once; preserve them across article renders.
      var controls=document.querySelector('.reading-controls');
      if(controls)document.body.append(controls);
      return content;
    });
    hook.doneEach(function(){
      document.querySelectorAll('[data-finder]').forEach(mountFinder);
      mountSidebar();mountArticle();
      setTimeout(mountControls,0);
      if (!currentArticle()) document.title=(route()==='/'||route()==='/README'?'PostgreSQL Howto 中文版':document.querySelector('.markdown-section h1')?.textContent || 'PostgreSQL Howto 中文版')+' | postgres-howto';
      document.querySelectorAll('.table-scroll').forEach(function(el){el.tabIndex=0;el.setAttribute('role','region');el.setAttribute('aria-label','表格，可横向滚动');});
    });
  });
})();
