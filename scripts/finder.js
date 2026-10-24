(function () {
  'use strict';
  var catalog = window.HowtoCatalog;
  var search = window.HowtoSearch;
  var bodies = null;
  var request = null;
  function escape(text) { return String(text).replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function loadIndex() {
    if (bodies) return Promise.resolve(bodies);
    if (!request) {
      var controller = new AbortController();
      var timer = setTimeout(function(){controller.abort();},12000);
      request = fetch('data/search-index.json?v='+catalog.revision,{signal:controller.signal}).then(function(response){
        if(!response.ok) throw new Error('index unavailable'); return response.json();
      }).then(function(data){
        if(data.revision!==catalog.revision || !Array.isArray(data.articles) || data.articles.length!==catalog.articles.length) throw new Error('index version');
        bodies=Object.fromEntries(data.articles.map(function(a){return [a.id,a.text];})); return bodies;
      }).catch(function(error){request=null;throw error;}).finally(function(){clearTimeout(timer);});
    }
    return request;
  }
  function highlighted(element, text, query) {
    var end=0;
    search.ranges(text,query).forEach(function(range){
      element.append(document.createTextNode(text.slice(end,range[0])));
      var mark=document.createElement('mark'); mark.textContent=text.slice(range[0],range[1]);element.append(mark);end=range[1];
    });
    element.append(document.createTextNode(text.slice(end)));
  }
  function options(items) { return items.map(function(item){return '<option value="'+escape(item[0])+'">'+escape(item[1])+'</option>';}).join(''); }
  function mount(el) {
    if(el.dataset.ready)return;el.dataset.ready='true';
    var home=el.hasAttribute('data-home');
    var params=new URLSearchParams(location.hash.split('?')[1]||'');
    var limit=home?5:20;
    var failed=false;
    el.innerHTML='<form role="search" class="finder-form"><label for="article-query" class="'+(home?'sr-only':'finder-label')+'">查找文章</label><div class="finder-input">'+HowtoUI.icon('search')+'<input id="article-query" type="search" placeholder="搜索 PostgreSQL 问题、SQL、参数或错误信息…" autocomplete="off" enterkeyhint="search" aria-controls="finder-results"><button type="submit" class="button button-primary" aria-label="搜索文章">搜索</button></div><div class="finder-filters"><label class="finder-topic">专题 <select name="topic"><option value="">全部专题</option>'+options(catalog.topics.map(function(t){return [t.id,t.title];}))+'</select></label><details class="finder-advanced"><summary>'+HowtoUI.icon('sliders-horizontal')+'更多筛选<span class="filter-count"></span></summary><div><label>系列 <select name="series"><option value="">全部系列</option>'+options(Object.entries(catalog.series).map(function(pair){return [pair[0],pair[1].title];}))+'</select></label><label>来源 <select name="type"><option value="">全部来源</option>'+options(Object.entries(catalog.types).filter(function(pair){return pair[0]!=='editorial';}))+'</select></label></div></details><button class="finder-clear text-button" type="button" hidden>清除筛选</button></div></form><p class="finder-status" role="status" aria-live="polite"></p><ol id="finder-results" class="finder-results"></ol><div class="finder-actions"><button type="button" class="finder-more button button-secondary" hidden>显示更多</button><button type="button" class="finder-retry button button-secondary" hidden>重试全文搜索</button></div>';
    var form=el.querySelector('form'),input=el.querySelector('input'),topic=el.querySelector('[name=topic]');
    var type=el.querySelector('[name=type]'),series=el.querySelector('[name=series]');
    var status=el.querySelector('.finder-status'),results=el.querySelector('.finder-results');
    var more=el.querySelector('.finder-more'),retry=el.querySelector('.finder-retry'),clear=el.querySelector('.finder-clear');
    var advanced=el.querySelector('.finder-advanced');
    input.value=params.get('q')||'';topic.value=params.get('topic')||'';series.value=params.get('series')||'';
    if(params.get('type')==='editorial'){var legacy=document.createElement('option');legacy.value='editorial';legacy.textContent=catalog.types.editorial;legacy.hidden=true;type.append(legacy);}
    type.value=params.get('type')||'';advanced.open=Boolean(series.value||type.value);
    function url(homeState) {
      var p=new URLSearchParams();
      if(input.value.trim())p.set('q',input.value.trim());
      if(topic.value)p.set('topic',topic.value);if(series.value)p.set('series',series.value);if(type.value)p.set('type',type.value);
      if(homeState){var anchor=new URLSearchParams(location.hash.split('?')[1]||'').get('id');if(anchor)p.set('id',anchor);}
      return (homeState?'#/README':'#/docs/find')+(p.size?'?'+p.toString():'');
    }
    function render() {
      if(!el.isConnected)return;
      var query=input.value.trim(),empty=!query&&!topic.value&&!type.value&&!series.value;
      clear.hidden=empty;
      el.querySelector('.filter-count').textContent=series.value||type.value?' · '+(Number(Boolean(series.value))+Number(Boolean(type.value))):'';
      if(empty&&home){status.textContent='';results.replaceChildren();more.hidden=true;retry.hidden=true;return;}
      var matches=search.search(catalog,query,{topic:topic.value,type:type.value,series:series.value},bodies);
      var message=matches.length?matches.length+' 篇匹配文章':'没有找到匹配文章，试试更短的关键词或清除筛选。';
      if(query&&!bodies)message+=failed?' · 全文索引暂不可用，当前仅匹配标题与别名。':' · 正在加载全文索引…';
      status.textContent=message;results.setAttribute('aria-busy',String(Boolean(query&&!bodies&&!failed)));results.replaceChildren();
      matches.slice(0,limit).forEach(function(result){
        var a=result.article,li=document.createElement('li'),link=document.createElement('a');
        link.href='#/docs/'+a.id;highlighted(link,a.title,query);
        var info=document.createElement('small');info.textContent=catalog.topics.find(function(t){return t.id===a.topics[0];}).title+' · '+(a.series?catalog.series[a.series].title+' · ':'')+catalog.types[a.type]+(a.addedOn?' · '+a.addedOn:'');
        li.append(link,info);
        if(bodies&&query){var snippet=document.createElement('p');highlighted(snippet,search.snippet(bodies[a.id],query),query);li.append(snippet);}
        results.append(li);
      });
      more.hidden=matches.length<=limit;retry.hidden=!query||!failed;
    }
    function update() {
      if(!input.value.trim())failed=false;
      limit=home?5:20;history.replaceState(null,'',url(home));render();
      el.closest('.markdown-section').dataset.renderedRoute=location.hash;
      if(input.value.trim()&&!bodies)loadIndex().then(function(){failed=false;render();}).catch(function(){failed=true;render();});
    }
    var timer;
    input.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(update,120);});
    [topic,type,series].forEach(function(select){select.addEventListener('change',update);});
    form.addEventListener('submit',function(event){event.preventDefault();clearTimeout(timer);if(home)location.hash=url(false);else update();});
    clear.addEventListener('click',function(){input.value='';topic.value='';series.value='';type.value='';advanced.open=false;failed=false;update();input.focus();});
    more.addEventListener('click',function(){var previous=limit;limit+=20;render();results.children[previous]?.querySelector('a').focus();});
    retry.addEventListener('click',function(){failed=false;update();});
    input.addEventListener('keydown',function(event){if(event.key==='ArrowDown'){var link=results.querySelector('a');if(link){event.preventDefault();link.focus();}}});
    input.addEventListener('keydown',function(event){if(event.key==='Escape'&&advanced.open){advanced.open=false;event.preventDefault();}});
    results.addEventListener('keydown',function(event){
      var links=Array.from(results.querySelectorAll('a')),index=links.indexOf(document.activeElement);
      if(index<0)return;
      if(event.key==='ArrowDown'){event.preventDefault();links[Math.min(index+1,links.length-1)].focus();}
      if(event.key==='ArrowUp'){event.preventDefault();index?links[index-1].focus():input.focus();}
      if(event.key==='Escape'){event.preventDefault();input.focus();}
    });
    el.restoreFromUrl=function(){
      var path=location.hash.slice(1).split('?')[0].replace(/\.md$/,'');
      if(home?!['','/','/README'].includes(path):path!=='/docs/find')return;
      var state=new URLSearchParams(location.hash.split('?')[1]||'');
      input.value=state.get('q')||'';topic.value=state.get('topic')||'';series.value=state.get('series')||'';
      if(state.get('type')==='editorial'&&!type.querySelector('[value=editorial]')){var option=document.createElement('option');option.value='editorial';option.textContent=catalog.types.editorial;option.hidden=true;type.append(option);}
      type.value=state.get('type')||'';advanced.open=Boolean(series.value||type.value);update();
    };
    update();
    if(params.get('focus')==='search')input.focus();
  }
  window.addEventListener('hashchange',function(){document.querySelectorAll('[data-finder]').forEach(function(el){el.restoreFromUrl?.();});});
  window.HowtoFinder={mount:mount};
})();
