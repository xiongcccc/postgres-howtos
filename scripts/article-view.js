(function (root) {
  'use strict';
  function escape(value) { return String(value || '').replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function url(id) { return '/articles/' + id + '/'; }
  function canonical(id) { return 'https://postgres-howto.cn' + url(id); }
  function title(a) {
    var at=a.title.indexOf('：');
    return at>0&&a.title.length>30?escape(a.title.slice(0,at+1))+'<span class="article-title-detail">'+escape(a.title.slice(at+1))+'</span>':escape(a.title);
  }
  function codeInfo(language, source) {
    language = String(language || 'text').toLowerCase();
    language = {sh:'bash',shell:'bash',conf:'ini'}[language] || language;
    var kind = /QUERY PLAN|\(cost=[\d.]|actual time=[\d.]/.test(source) ? 'plan' : 'code';
    if (kind === 'code' && /(^|\n)[\w-]+(?:=[#>]|-#|[=#>])\s/.test(source)) kind = 'terminal';
    return {language:language,kind:kind,label:kind === 'plan' ? 'EXPLAIN' : kind === 'terminal' ? 'PSQL' : ({sql:'SQL',bash:'Shell',python:'Python',text:'TEXT',json:'JSON',ini:'CONFIG',java:'Java',yaml:'YAML',c:'C'})[language] || language};
  }
  function meta(catalog, a) {
    return '<div class="article-meta"><p class="article-kicker">' + (a.series ? '<a href="/#/docs/find?series='+a.series+'">'+escape(catalog.series[a.series].title)+'</a> · ' : '') + escape(catalog.types[a.type])+' <span class="article-id">#'+a.id+'</span>'+(a.addedOn?' <time datetime="'+a.addedOn+'">收录于 '+a.addedOn+'</time>':'')+'</p><p class="article-version">'+escape(a.versionNote)+'</p><details><summary>来源与验证说明</summary><dl><dt>原题</dt><dd>'+escape(a.originalTitle)+'</dd><dt>来源</dt><dd><a href="'+escape(a.source.url)+'" target="_blank" rel="noopener">'+escape(a.source.label)+'</a></dd><dt>中文翻译与校订</dt><dd>xiongcc</dd><dt>验证状态</dt><dd>'+escape(a.validation.note)+(a.validation.date?'（'+escape(a.validation.date)+'）':'')+(a.validation.record?' <a href="/#'+a.validation.record.replace(/\.md$/,'')+'">'+(a.validation.status==='tested'?'验证记录':'校订记录')+'</a>':'')+'</dd></dl></details></div>';
  }
  function footer(catalog, a, href) {
    var peers=catalog.articles.filter(function(item){return item.topics[0]===a.topics[0];}).sort(function(x,y){return x.id-y.id;});
    var at=peers.findIndex(function(item){return item.id===a.id;}),primary=catalog.topics.find(function(t){return t.id===a.topics[0];});
    var related=catalog.articles.filter(function(item){return item.id!==a.id;}).map(function(item){return {article:item,score:item.topics.filter(function(id){return a.topics.includes(id);}).length*10+Number(item.series===a.series)};}).filter(function(item){return item.score>=10;}).sort(function(x,y){return y.score-x.score||y.article.id-x.article.id;}).slice(0,3);
    return '<footer class="article-footer"><p class="article-topic-label">所属专题：<a href="/#/docs/topics?id=topic-'+primary.id+'">'+escape(primary.title)+'</a></p><div class="article-neighbors">'+[peers[at-1],peers[at+1]].map(function(item,i){return item?'<a rel="'+(i?'next':'prev')+'" href="'+href(item.id)+'"><small>'+(i?'同专题下一篇':'同专题上一篇')+'</small><strong>'+escape(item.title)+'</strong></a>':'<span></span>';}).join('')+'</div>'+(related.length?'<h2>继续阅读</h2><ul>'+related.map(function(item){return '<li><a href="'+href(item.article.id)+'">'+escape(item.article.title)+'</a></li>';}).join('')+'</ul>':'')+'<div class="article-source-links"><a href="https://github.com/xiongcccc/postgres-howto/blob/master/docs/'+a.id+'.md" target="_blank" rel="noopener">查看源文件</a><a href="https://github.com/xiongcccc/postgres-howto/issues/new?title='+encodeURIComponent('文章 #'+a.id+'：'+a.title)+'" target="_blank" rel="noopener">反馈与纠错</a></div></footer>';
  }
  function schema(a) {
    return {'@context':'https://schema.org','@type':a.type==='editorial'?'Article':'TechArticle',headline:a.title,inLanguage:'zh-CN',url:canonical(a.id),mainEntityOfPage:canonical(a.id),citation:a.source.url,keywords:a.aliases,datePublished:a.addedOn||undefined};
  }
  var api={escape:escape,url:url,canonical:canonical,title:title,codeInfo:codeInfo,meta:meta,footer:footer,schema:schema};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HowtoArticle=api;
})(typeof window==='undefined'?globalThis:window);
