(function () {
  'use strict';
  var catalog = window.HowtoCatalog;
  var byId = new Map(catalog.articles.map(function(a){return [a.id,a];}));
  var tocHeadings = [];
  var toc = null;
  var scheduled = false;
  var sidebarObserver;
  function escape(value) { return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function route() { return (location.hash.slice(1).split('?')[0] || '/').replace(/\/$/,'') || '/'; }
  function currentArticle() { var match=route().match(/^\/docs\/(\d+)(?:\.md)?$/);return match?byId.get(Number(match[1])):null; }
  function topicById(id) { return catalog.topics.find(function(t){return t.id===id;}); }
  function syncPage() {
    var home=/^\/(?:README(?:\.md)?)?$/i.test(route());
    document.body.classList.toggle('reading-home',home);
    document.body.classList.toggle('reading-article',Boolean(currentArticle()));
  }
  function mountSidebar() {
    var sidebar=document.querySelector('.sidebar'),nav=document.querySelector('.sidebar-nav');
    if(!nav||!sidebar)return;
    sidebar.id='site-sidebar';sidebar.setAttribute('aria-label','文章导航');sidebar.setAttribute('role','navigation');
    var active=currentArticle(),state={};
    try { state=JSON.parse(localStorage.getItem('howto-sidebar-v3')||'{}'); } catch (_) {}
    var pages=[['首页','/README'],['专题索引','/docs/topics'],['推荐路径','/docs/paths'],['全部文章','/docs/find']];
    nav.innerHTML='<div class="sidebar-heading"><span>知识导航</span><button class="icon-button" type="button" data-close-nav aria-label="关闭导航" title="关闭导航">'+HowtoUI.icon('x')+'</button></div><nav class="catalog-navigation" aria-label="文章分类"><ul class="catalog-pages">'+pages.map(function(p){return '<li><a href="#'+p[1]+'"'+(route()===p[1]?' aria-current="page"':'')+'>'+p[0]+'</a></li>';}).join('')+'</ul><p class="sidebar-label">技术专题</p>'+catalog.topics.map(function(t){
      var items=catalog.articles.filter(function(a){return a.topics[0]===t.id;});
      var selected=active&&active.topics[0]===t.id;
      var open=active?selected:Boolean(state[t.id]);
      return '<details data-topic="'+t.id+'"'+(open?' open':'')+(selected?' data-current-topic="true"':'')+'><summary><span>'+escape(t.title)+'</span><small>'+items.length+'</small></summary><ul>'+items.map(function(a){return '<li><a href="#/docs/'+a.id+'"'+(active&&active.id===a.id?' aria-current="page"':'')+'><span class="article-number">'+a.id+'</span><span>'+escape(a.title)+'</span></a></li>';}).join('')+'</ul></details>';
    }).join('')+'<div class="sidebar-resources"><a href="#/docs/series">系列阅读</a><a href="#/docs/conferences">会议精选</a><a href="#/docs/about">关于项目</a></div></nav>';
    nav.querySelectorAll('details').forEach(function(details){
      var manual=false;
      details.querySelector('summary').addEventListener('click',function(){manual=true;});
      details.addEventListener('toggle',function(){if(manual){state[details.dataset.topic]=details.open;try{localStorage.setItem('howto-sidebar-v3',JSON.stringify(state));}catch(_){}manual=false;}});
    });
    var selected=nav.querySelector('a[aria-current="page"]');
    if(active&&selected)sidebar.scrollTop+=selected.getBoundingClientRect().top-sidebar.getBoundingClientRect().top-180;
    if(!sidebarObserver){sidebarObserver=new MutationObserver(function(){if(!nav.querySelector('.catalog-navigation'))mountSidebar();});sidebarObserver.observe(nav,{childList:true});}
  }
  function mountCodes(section) {
    section.querySelectorAll('pre').forEach(function(pre){
      if(pre.dataset.lang==='mermaid'||pre.closest('.diagram-source')||pre.closest('.code-block'))return;
      var code=pre.querySelector('code');if(!code)return;
      var wrapper=document.createElement('div');wrapper.className='code-block';
      var toolbar=document.createElement('div');toolbar.className='code-toolbar';
      var language=document.createElement('span');language.textContent=({sql:'SQL',bash:'Shell',sh:'Shell',python:'Python',text:'TEXT',json:'JSON',ini:'CONFIG',java:'Java',yaml:'YAML',c:'C'})[pre.dataset.lang]||pre.dataset.lang||'CODE';
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
  window.addEventListener('scroll',function(){if(!scheduled&&toc){scheduled=true;requestAnimationFrame(highlightSection);}},{passive:true});
  window.addEventListener('hashchange',function(){
    var section=document.querySelector('.markdown-section');
    function file(hash){var name=hash.replace(/^#/,'').split('?')[0].replace(/\.md$/,'');return name===''||name==='/'?'/README':name;}
    if(section?.dataset.renderedRoute&&file(section.dataset.renderedRoute)===file(location.hash)){
      section.dataset.renderedRoute=location.hash;HowtoUI.finishNavigation();requestAnimationFrame(highlightSection);
    }
  });
  function mountArticle(section) {
    toc=null;tocHeadings=[];
    var a=currentArticle();if(!a)return;
    var h1=section.querySelector('h1');if(h1&&/404|没有找到这篇/.test(h1.textContent))return;
    if(!h1){h1=document.createElement('h1');section.prepend(h1);}
    // A few historical notes use another H1 mid-article. Preserve its old anchor.
    section.querySelectorAll('h1').forEach(function(heading){if(heading!==h1){var replacement=document.createElement('h2');replacement.id=heading.id;replacement.append(...heading.childNodes);heading.replaceWith(replacement);}});
    var prior=section.querySelector('.article-meta');
    if(prior?.querySelector('blockquote'))prior.after(prior.querySelector('blockquote'));
    section.querySelectorAll('.article-topline,.article-meta,.article-toc,.article-footer,.article-discussion').forEach(function(node){node.remove();});
    var text=h1.querySelector('a span')||h1.querySelector('a')||h1;text.textContent=a.title;
    var primary=topicById(a.topics[0]);
    var top=document.createElement('div');top.className='article-topline';
    top.innerHTML='<nav class="breadcrumbs" aria-label="面包屑"><a href="#/README">首页</a><span aria-hidden="true">/</span><a href="#/docs/topics?id=topic-'+primary.id+'">'+escape(primary.title)+'</a><span class="sr-only"> / '+escape(a.title)+'</span></nav><details class="reading-settings"><summary title="阅读字号" aria-label="阅读字号">'+HowtoUI.icon('sliders-horizontal')+'</summary><div><button class="icon-button" type="button" data-font="-1" aria-label="减小字号" title="减小字号">'+HowtoUI.icon('minus')+'</button><button class="icon-button" type="button" data-font="reset" aria-label="恢复字号" title="恢复字号">'+HowtoUI.icon('rotate-ccw')+'</button><button class="icon-button" type="button" data-font="1" aria-label="增大字号" title="增大字号">'+HowtoUI.icon('plus')+'</button></div></details>';
    h1.before(top);
    var meta=document.createElement('div');meta.className='article-meta';
    meta.innerHTML='<p class="article-kicker">'+(a.series?'<a href="#/docs/find?series='+a.series+'">'+escape(catalog.series[a.series].title)+'</a> · ':'')+escape(catalog.types[a.type])+' <span class="article-id">#'+a.id+'</span>'+(a.addedOn?' <time datetime="'+a.addedOn+'">收录于 '+a.addedOn+'</time>':'')+'</p><p class="article-version">'+escape(a.versionNote)+'</p><details><summary>来源与验证说明</summary><dl><dt>原题</dt><dd>'+escape(a.originalTitle)+'</dd><dt>来源</dt><dd><a href="'+escape(a.source.url)+'" target="_blank" rel="noopener">'+escape(a.source.label)+'</a></dd><dt>中文翻译与校订</dt><dd>xiongcc</dd><dt>验证状态</dt><dd>'+escape(a.validation.note)+(a.validation.date?'（'+escape(a.validation.date)+'）':'')+(a.validation.record?' <a href="#'+a.validation.record.replace(/\.md$/,'')+'">'+(a.validation.status==='tested'?'验证记录':'校订记录')+'</a>':'')+'</dd></dl></details>';
    h1.after(meta);
    var attribution=meta.nextElementSibling;
    if(attribution?.tagName==='BLOCKQUOTE'&&/^(原作者：|会议精选\s*·|专题解读\s*·)/.test(attribution.textContent.trim()))meta.querySelector('details').append(attribution);
    tocHeadings=Array.from(section.querySelectorAll('h2[id],h3[id],h4[id]'));
    if(tocHeadings.length){
      toc=document.createElement('details');toc.className='article-toc';toc.open=matchMedia('(min-width:1280px)').matches;
      toc.innerHTML='<summary>本页目录'+HowtoUI.icon('chevron-down')+'</summary><nav aria-label="本页目录"><ol>'+tocHeadings.map(function(h){return '<li class="toc-level-'+h.tagName.slice(1)+'"><a data-heading="'+escape(h.id)+'" href="#'+route()+'?id='+encodeURIComponent(h.id)+'">'+escape(h.textContent)+'</a></li>';}).join('')+'</ol></nav>';
      meta.after(toc);highlightSection();
    }
    var related=catalog.articles.filter(function(item){return item.id!==a.id;}).map(function(item){return {article:item,score:item.topics.filter(function(id){return a.topics.includes(id);}).length*10+Number(item.series===a.series)};}).filter(function(item){return item.score>=10;}).sort(function(x,y){return y.score-x.score||y.article.id-x.article.id;}).slice(0,3);
    var peers=catalog.articles.filter(function(item){return item.topics[0]===a.topics[0];}).sort(function(x,y){return x.id-y.id;});
    var at=peers.findIndex(function(item){return item.id===a.id;}),previous=peers[at-1],next=peers[at+1];
    var footer=document.createElement('footer');footer.className='article-footer';
    footer.innerHTML='<div class="article-neighbors">'+[previous,next].map(function(item,i){return item?'<a rel="'+(i?'next':'prev')+'" href="#/docs/'+item.id+'"><small>'+(i?'同专题下一篇':'同专题上一篇')+'</small><strong>'+escape(item.title)+'</strong></a>':'<span></span>';}).join('')+'</div>'+(related.length?'<h2>继续阅读</h2><ul>'+related.map(function(item){return '<li><a href="#/docs/'+item.article.id+'">'+escape(item.article.title)+'</a></li>';}).join('')+'</ul>':'')+'<div class="article-source-links"><a href="#/docs/topics?id=topic-'+primary.id+'">返回专题</a><a href="https://github.com/xiongcccc/postgres-howto/blob/master/docs/'+a.id+'.md" target="_blank" rel="noopener">查看源文件 '+HowtoUI.icon('external-link')+'</a><a href="https://github.com/xiongcccc/postgres-howto/issues/new?title='+encodeURIComponent('文章 #'+a.id+'：'+a.title)+'" target="_blank" rel="noopener">反馈与纠错</a></div>';
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
    document.querySelector('meta[property="og:url"]').content='https://postgres-howto.cn/'+(a?'#/docs/'+a.id:'');
    document.getElementById('article-schema')?.remove();
    if(a){var script=document.createElement('script');script.id='article-schema';script.type='application/ld+json';script.textContent=JSON.stringify({'@context':'https://schema.org','@type':'TechArticle',headline:a.title,inLanguage:'zh-CN',url:'https://postgres-howto.cn/#/docs/'+a.id,citation:a.source.url,keywords:a.aliases,datePublished:a.addedOn||undefined});document.head.append(script);}
  }
  window.$docsify.plugins=(window.$docsify.plugins||[]).concat(function(hook){
    hook.beforeEach(function(content){syncPage();toc=null;tocHeadings=[];return content;});
    hook.doneEach(function(){
      syncPage();
      var section=document.querySelector('.markdown-section');if(!section)return;
      section.tabIndex=-1;
      document.querySelectorAll('[data-finder]').forEach(HowtoFinder.mount);
      mountSidebar();mountArticle(section);HowtoDiagrams.mount(section);mountCodes(section);mountImages(section);
      section.querySelectorAll('table').forEach(function(table){
        if(table.parentElement.classList.contains('table-scroll'))return;
        var wrapper=document.createElement('div');wrapper.className='table-scroll';wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label','表格，可横向滚动');table.before(wrapper);wrapper.append(table);
      });
      updateMetadata(section);HowtoUI.finishNavigation();section.dataset.renderedRoute=location.hash;
    });
  });
})();
