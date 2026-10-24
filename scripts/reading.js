(function () {
  'use strict';
  var catalog = window.HowtoCatalog;
  var byId = new Map(catalog.articles.map(function(a){return [a.id,a];}));
  var tocHeadings = [];
  var toc = null;
  var scheduled = false;
  var sidebarObserver;
  var view = window.HowtoArticle;
  var staticArticle = document.body.dataset.staticArticle;
  var wide = matchMedia('(min-width:1280px)');
  var tocPreferences = {wide:null,compact:null};
  function escape(value) { return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function route() { return staticArticle ? '/docs/'+staticArticle : (location.hash.slice(1).split('?')[0] || '/').replace(/\/$/,'') || '/'; }
  function href(path) { var match=path.match(/^\/docs\/(\d+)$/);return staticArticle?(match?view.url(match[1]):'/#'+path):'#'+path; }
  function currentArticle() { var match=route().match(/^\/docs\/(\d+)(?:\.md)?$/);return match?byId.get(Number(match[1])):null; }
  function topicById(id) { return catalog.topics.find(function(t){return t.id===id;}); }
  function syncPage() {
    var home=/^\/(?:README(?:\.md)?)?$/i.test(route());
    document.body.classList.toggle('reading-home',home);
    document.body.classList.toggle('reading-article',Boolean(currentArticle()));
    document.documentElement.dataset.view=home?'home':currentArticle()?'article':'page';
  }
  function mountSidebar() {
    var sidebar=document.querySelector('.sidebar'),nav=document.querySelector('.sidebar-nav');
    if(!nav||!sidebar)return;
    sidebar.id='site-sidebar';sidebar.setAttribute('aria-label','文章导航');sidebar.setAttribute('role','navigation');
    var active=currentArticle(),state={};
    try { state=JSON.parse(localStorage.getItem('howto-sidebar-v3')||'{}'); } catch (_) {}
    var previousScroll=sidebar.scrollTop;
    var pages=[['首页','/README'],['专题','/docs/topics'],['学习路径','/docs/paths'],['全部文章','/docs/find']];
    nav.innerHTML='<div class="sidebar-heading"><span>知识导航</span><button class="icon-button" type="button" data-close-nav aria-label="关闭导航" title="关闭导航">'+HowtoUI.icon('x')+'</button></div><nav class="catalog-navigation" aria-label="文章分类"><ul class="catalog-pages">'+pages.map(function(p){return '<li><a href="'+href(p[1])+'"'+(route()===p[1]?' aria-current="page"':'')+'>'+p[0]+'</a></li>';}).join('')+'</ul><p class="sidebar-label">技术专题 <span>主归属文章</span></p>'+catalog.topics.map(function(t){
      var items=catalog.articles.filter(function(a){return a.topics[0]===t.id;});
      var selected=active&&active.topics[0]===t.id;
      var open=selected||Boolean(state[t.id]);
      return '<details data-topic="'+t.id+'"'+(open?' open':'')+(selected?' data-current-topic="true"':'')+'><summary><span>'+escape(t.title)+'</span><small>'+items.length+'<span class="sr-only"> 篇主归属文章</span></small></summary><ul>'+items.map(function(a){return '<li><a href="'+href('/docs/'+a.id)+'"'+(active&&active.id===a.id?' aria-current="page"':'')+'><span class="article-number">'+a.id+'</span><span>'+escape(a.title)+'</span></a></li>';}).join('')+'</ul></details>';
    }).join('')+'<div class="sidebar-resources"><a href="'+href('/docs/series')+'">系列阅读</a><a href="'+href('/docs/conferences')+'">会议精选</a><a href="'+href('/docs/about')+'">关于项目</a></div></nav>';
    nav.querySelectorAll('details').forEach(function(details){
      var manual=false;
      details.querySelector('summary').addEventListener('click',function(){manual=true;});
      details.addEventListener('toggle',function(){if(manual){state[details.dataset.topic]=details.open;try{localStorage.setItem('howto-sidebar-v3',JSON.stringify(state));}catch(_){}manual=false;}});
    });
    var selected=nav.querySelector('a[aria-current="page"]');
    sidebar.scrollTop=previousScroll;
    if(active&&selected){var item=selected.getBoundingClientRect(),bounds=sidebar.getBoundingClientRect();if(item.top<bounds.top+64||item.bottom>bounds.bottom)sidebar.scrollTop+=item.top-bounds.top-180;}
    if(!sidebarObserver){sidebarObserver=new MutationObserver(function(){if(!nav.querySelector('.catalog-navigation'))mountSidebar();});sidebarObserver.observe(nav,{childList:true});}
  }
  function mountCodes(section) {
    section.querySelectorAll('pre').forEach(function(pre){
      if(pre.dataset.lang==='mermaid'||pre.closest('.diagram-source')||pre.closest('.code-block'))return;
      var code=pre.querySelector('code');if(!code)return;
      var wrapper=document.createElement('div');wrapper.className='code-block';
      var toolbar=document.createElement('div');toolbar.className='code-toolbar';
      var info=view.codeInfo(pre.dataset.lang,code.textContent);
      pre.dataset.codeKind=info.kind;
      if(info.kind!=='code')code.textContent=code.textContent;
      if(info.kind==='code'&&window.Prism?.languages[info.language])code.innerHTML=Prism.highlight(code.textContent,Prism.languages[info.language],info.language);
      var language=document.createElement('span');language.textContent=info.label;
      var button=document.createElement('button');button.type='button';button.className='icon-button code-copy';button.title='复制代码';button.setAttribute('aria-label','复制代码');button.innerHTML=HowtoUI.icon('copy');
      toolbar.append(language,button);pre.before(wrapper);wrapper.append(toolbar,pre);pre.tabIndex=0;pre.setAttribute('aria-label',language.textContent+' 代码');
    });
  }
  function highlightSection() {
    scheduled=false;if(!toc?.isConnected||!tocHeadings.length)return;
    var active=tocHeadings[0];
    for(var heading of tocHeadings){if(heading.getBoundingClientRect().top<=140)active=heading;else break;}
    toc.querySelectorAll('a').forEach(function(link){if(link.dataset.heading===active.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
  }
  function restoreAnchor() {
    var id=staticArticle?location.hash.slice(1):new URLSearchParams(location.hash.split('?')[1]||'').get('id');
    if(!id)return;
    try{if(staticArticle)id=decodeURIComponent(id);}catch(_){return;}
    var target=document.getElementById(id);
    if(target)requestAnimationFrame(function(){requestAnimationFrame(function(){if(target.isConnected)target.scrollIntoView({block:'start',behavior:'instant'});});});
  }
  window.addEventListener('scroll',function(){if(!scheduled&&toc){scheduled=true;requestAnimationFrame(highlightSection);}},{passive:true});
  window.addEventListener('hashchange',function(){
    if(staticArticle){restoreAnchor();requestAnimationFrame(highlightSection);return;}
    var section=document.querySelector('.markdown-section');
    function file(hash){var name=hash.replace(/^#/,'').split('?')[0].replace(/\.md$/,'');return name===''||name==='/'?'/README':name;}
    if(section?.dataset.renderedRoute&&file(section.dataset.renderedRoute)===file(location.hash)){
      section.dataset.renderedRoute=location.hash;HowtoUI.finishNavigation();requestAnimationFrame(highlightSection);
    }
  });
  wide.addEventListener('change',function(){if(toc)toc.open=tocPreferences[wide.matches?'wide':'compact']??wide.matches;});
  function mountArticle(section) {
    toc=null;tocHeadings=[];
    var a=currentArticle();if(!a)return;
    var h1=section.querySelector('h1');if(h1&&/404|没有找到这篇/.test(h1.textContent))return;
    if(!h1){h1=document.createElement('h1');section.prepend(h1);}
    // A few historical notes use another H1 mid-article. Preserve its old anchor.
    section.querySelectorAll('h1').forEach(function(heading){if(heading!==h1){var replacement=document.createElement('h2');replacement.id=heading.id;replacement.append(...heading.childNodes);heading.replaceWith(replacement);}});
    var prior=section.querySelector('.article-meta');
    if(prior?.querySelector('blockquote'))prior.after(prior.querySelector('blockquote'));
    section.querySelectorAll('.article-topline,.article-meta,.article-toc,.article-footer').forEach(function(node){node.remove();});
    var text=h1.querySelector('a span')||h1.querySelector('a')||h1;text.innerHTML=view.title(a);
    var primary=topicById(a.topics[0]);
    var top=document.createElement('div');top.className='article-topline';
    top.innerHTML='<nav class="breadcrumbs" aria-label="面包屑"><a href="#/README">首页</a><span aria-hidden="true">/</span><a href="#/docs/topics?id=topic-'+primary.id+'">'+escape(primary.title)+'</a><span class="sr-only"> / '+escape(a.title)+'</span></nav><details class="reading-settings"><summary title="阅读字号" aria-label="阅读字号">'+HowtoUI.icon('sliders-horizontal')+'</summary><div><button class="icon-button" type="button" data-font="-1" aria-label="减小字号" title="减小字号">'+HowtoUI.icon('minus')+'</button><button class="icon-button" type="button" data-font="reset" aria-label="恢复字号" title="恢复字号">'+HowtoUI.icon('rotate-ccw')+'</button><button class="icon-button" type="button" data-font="1" aria-label="增大字号" title="增大字号">'+HowtoUI.icon('plus')+'</button></div></details>';
    if(staticArticle)top.querySelectorAll('a').forEach(function(link){link.setAttribute('href','/'+link.getAttribute('href'));});
    h1.before(top);
    var meta=document.createElement('div');meta.className='article-meta';
    meta.innerHTML=view.meta(catalog,a).replace(/^<div class="article-meta">|<\/div>$/g,'');
    h1.after(meta);
    var attribution=meta.nextElementSibling;
    if(attribution?.tagName==='BLOCKQUOTE'&&/^(原作者：|会议精选\s*·|专题解读\s*·)/.test(attribution.textContent.trim()))meta.querySelector('details').append(attribution);
    tocHeadings=Array.from(section.querySelectorAll('h2[id],h3[id],h4[id]'));
    if(tocHeadings.length){
      toc=document.createElement('details');toc.className='article-toc';toc.open=tocPreferences[wide.matches?'wide':'compact']??wide.matches;
      toc.innerHTML='<summary>本页目录'+HowtoUI.icon('chevron-down')+'</summary><nav aria-label="本页目录"><ol>'+tocHeadings.map(function(h){return '<li class="toc-level-'+h.tagName.slice(1)+'"><a data-heading="'+escape(h.id)+'" href="'+(staticArticle?'#'+encodeURIComponent(h.id):'#'+route()+'?id='+encodeURIComponent(h.id))+'">'+escape(h.textContent)+'</a></li>';}).join('')+'</ol></nav>';
      toc.querySelector('summary').addEventListener('click',function(){tocPreferences[wide.matches?'wide':'compact']=!toc.open;});
      meta.after(toc);highlightSection();
    }
    var footer=document.createElement('footer');footer.className='article-footer';
    footer.innerHTML=view.footer(catalog,a,function(id){return href('/docs/'+id);}).replace(/^<footer class="article-footer">|<\/footer>$/g,'');
    section.append(footer);
  }
  function mountImages(section) {
    section.querySelectorAll('img').forEach(function(img){
      img.loading='lazy';img.decoding='async';
      if(!currentArticle()||img.closest('a'))return;
      img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','放大图片：'+(img.alt||'文章图片'));img.dataset.zoomable='true';img.title='放大图片';
    });
  }
  function updateMetadata(section) {
    var a=currentArticle(),title=a?a.title:(document.body.classList.contains('reading-home')?'PostgreSQL Howto':section.querySelector('h1')?.textContent||'PostgreSQL Howto');
    var description=a?a.title+'。'+a.versionNote:'面向真实工程问题的 PostgreSQL 中文实践知识库。查询性能、索引、锁、WAL、Vacuum、复制与日常运维。';
    document.title=title+' | PostgreSQL Howto 中文版';
    document.querySelector('meta[name="description"]').content=description;
    document.querySelector('meta[property="og:title"]').content=title;
    document.querySelector('meta[property="og:description"]').content=description;
    document.querySelector('meta[property="og:type"]').content=a?'article':'website';
    var canonical=document.querySelector('link[rel="canonical"]')||document.head.appendChild(document.createElement('link'));
    canonical.rel='canonical';canonical.href=a?view.canonical(a.id):'https://postgres-howto.cn/';
    document.querySelector('meta[property="og:url"]').content=canonical.href;
    var robots=document.querySelector('meta[name="robots"]');
    if(!a&&!document.body.classList.contains('reading-home')){if(!robots){robots=document.createElement('meta');robots.name='robots';document.head.append(robots);}robots.content='noindex,follow';}else robots?.remove();
    document.getElementById('article-schema')?.remove();
    if(a){var script=document.createElement('script');script.id='article-schema';script.type='application/ld+json';script.textContent=JSON.stringify(view.schema(a));document.head.append(script);}
  }
  function enhance(){
      syncPage();
      var section=document.querySelector('.markdown-section');if(!section)return;
      section.tabIndex=-1;
      document.querySelectorAll('[data-finder]').forEach(function(el){window.HowtoFinder?.mount(el);});
      mountSidebar();mountArticle(section);HowtoDiagrams.mount(section);mountCodes(section);mountImages(section);
      section.querySelectorAll('table').forEach(function(table){
        if(table.parentElement.classList.contains('table-scroll'))return;
        var wrapper=document.createElement('div');wrapper.className='table-scroll';wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label','表格，可横向滚动');table.before(wrapper);wrapper.append(table);
      });
      updateMetadata(section);HowtoUI.finishNavigation();section.dataset.renderedRoute=location.hash;if(staticArticle)restoreAnchor();document.body.removeAttribute('data-loading');
  }
  if(staticArticle){enhance();return;}
  window.$docsify.plugins=(window.$docsify.plugins||[]).concat(function(hook,vm){
    var resetEvents=vm.$resetEvents;
    vm.$resetEvents=function(type){
      var query=this.route.query,id=query.id;
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches||!id||type==='history')return resetEvents.apply(this,arguments);
      // Docsify 4.13.1 otherwise always starts a 500ms JavaScript anchor tween.
      query.id=null;
      try{resetEvents.apply(this,arguments);}finally{query.id=id;}
      restoreAnchor();
    };
    hook.beforeEach(function(content){syncPage();toc=null;tocHeadings=[];return content;});
    hook.doneEach(function(){
      enhance();
      // Docsify calculates anchor positions before doneEach adds metadata/TOC.
      if(vm.route.query.id)vm.$resetEvents();
    });
  });
})();
