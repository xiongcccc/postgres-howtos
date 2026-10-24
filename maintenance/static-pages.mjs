import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {Marked, Renderer} from '../vendor/marked.cjs';
import view from '../scripts/article-view.js';

const require=createRequire(import.meta.url);
const Prism=require('../vendor/prism-core.min.js');
globalThis.Prism=Prism;
for(const language of ['clike','sql','bash','python','json','java','c','ini','yaml'])require(`../vendor/prism-${language}.min.js`);
const e=view.escape;
const origin='https://postgres-howto.cn';
const icon=name=>`<span class="icon icon-${name}" aria-hidden="true"></span>`;
// Preserve literal code whitespace without adding Git whitespace errors.
const codeWhitespace=html=>html.replace(/[ \t]+(?=\n)/g,spaces=>Array.from(spaces,c=>c==='\t'?'&#9;':'&#32;').join(''));
// Match Docsify's historical heading IDs, including repeated headings.
function slugger() {
  const used=new Map();
  return text=>{
    const base=text.toLowerCase().trim().replace(/<[^>]*>/g,'').replace(/[!"#$%&'()*+,./:;<=>?@[\]\\^`{|}~]/g,'').replace(/\s/g,'-');
    const count=used.get(base)||0;used.set(base,count+1);return base+(count?'-'+count:'');
  };
}
export function staticPages(catalog, read, outputs) {
  const template=read('maintenance/static-template.html');
  const asset=file=>'/'+file+'?v='+createHash('sha256').update(outputs.get(file)||read(file)).digest('hex').slice(0,16);
  const scripts=['scripts/catalog-data.js','scripts/article-view.js','scripts/site.js','scripts/diagrams.js','scripts/reading.js'];
  function sidebar(active) {
    return '<aside class="sidebar" id="site-sidebar" aria-label="文章导航"><div class="sidebar-nav"><div class="sidebar-heading"><span>知识导航</span><button class="icon-button" data-close-nav aria-label="关闭导航" title="关闭导航">'+icon('x')+'</button></div><nav class="catalog-navigation" aria-label="文章分类"><ul class="catalog-pages"><li><a href="/#/README">首页</a></li><li><a href="/#/docs/topics">专题</a></li><li><a href="/#/docs/paths">学习路径</a></li><li><a href="/articles/">全部文章</a></li></ul><p class="sidebar-label">技术专题 <span>主归属文章</span></p>'+catalog.topics.map(t=>{
      const items=catalog.articles.filter(a=>a.topics[0]===t.id),current=active?.topics[0]===t.id;
      return `<details data-topic="${t.id}"${current?' open data-current-topic="true"':''}><summary><span>${e(t.title)}</span><small>${items.length}</small></summary><ul>`+items.map(a=>`<li><a href="${view.url(a.id)}"${active?.id===a.id?' aria-current="page"':''}><span class="article-number">${a.id}</span><span>${e(a.title)}</span></a></li>`).join('')+'</ul></details>';
    }).join('')+'<div class="sidebar-resources"><a href="/#/docs/series">系列阅读</a><a href="/#/docs/conferences">会议精选</a><a href="/#/docs/about">关于项目</a></div></nav></div></aside>';
  }
  function page({a,title,description,body}) {
    const replacements={TITLE:e(title+' | PostgreSQL Howto 中文版'),DESCRIPTION:e(description),CANONICAL:a?view.canonical(a.id):origin+'/articles/',
      BODY_CLASS:a?'reading-article':'reading-home',ARTICLE_ATTRIBUTE:a?`data-static-article="${a.id}"`:'',BODY:body,SIDEBAR:sidebar(a),
      OG_TYPE:a?'article':'website',
      BASE_CSS:asset('styles/custom.css'),READING_CSS:asset('styles/reading.css'),
      SCHEMA:a?'<script id="article-schema" type="application/ld+json">'+JSON.stringify(view.schema(a)).replaceAll('<','\\u003c')+'</script>':'',
      SCRIPTS:(a?scripts:['scripts/site.js']).map(file=>`<script src="${asset(file)}" defer></script>`).join('\n')};
    return template.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>{if(!(key in replacements))throw new Error('Unknown static template field '+key);return replacements[key];});
  }
  function render(a) {
    const headings=[],slug=slugger();let first=true;
    const defaults=new Renderer();
    const marked=new Marked({gfm:true,renderer:{
      heading(text,level,raw){
        const id=slug(raw);if(level===1&&first){text=view.title(a);first=false;}else if(level===1)level=2;
        if(level>=2&&level<=4)headings.push({id,level,text});
        return `<h${level} id="${e(id)}">${text}</h${level}>\n`;
      },
      code(code,language){
        const lang=(language||'text').split(/\s/)[0];
        if(lang==='mermaid')return `<pre data-lang="mermaid"><code>${codeWhitespace(e(code))}</code></pre>\n`;
        const info=view.codeInfo(lang,code);
        const rendered=info.kind==='code'&&Prism.languages[info.language]?Prism.highlight(code,Prism.languages[info.language],info.language):e(code);
        return `<div class="code-block"><div class="code-toolbar"><span>${info.label}</span><button class="icon-button code-copy js-only" type="button" title="复制代码" aria-label="复制代码">${icon('copy')}</button></div><pre data-lang="${e(lang)}" data-code-kind="${info.kind}" tabindex="0" aria-label="${info.label} 代码"><code>${codeWhitespace(rendered)}\n</code></pre></div>\n`;
      },
      link(href,title,text){
        const numbered=href?.match(/^\/docs\/(\d+)\.md(?:\?id=(.*))?$/);
        if(numbered)href=view.url(numbered[1])+(numbered[2]?'#'+numbered[2]:'');
        else if(/^\/(?:docs|maintenance)\/.+\.md/.test(href||''))href='/#'+href.replace(/\.md(?=\?|$)/,'');
        return defaults.link(href,title,text);
      },
      image(href,title,text){return `<img src="${e(href)}" alt="${e(text)}"${title?' title="'+e(title)+'"':''} loading="lazy" decoding="async">`;},
      table(header,body){return '<div class="table-scroll" role="region" aria-label="表格，可横向滚动" tabindex="0">'+defaults.table(header,body)+'</div>\n';}
    }});
    const tokens=marked.lexer(read(`docs/${a.id}.md`));
    const attribution=tokens.findIndex(t=>t.type==='blockquote'&&/^(原作者：|会议精选\s*·|专题解读\s*·)/.test(t.text.trim()));
    const quote=attribution>=0?marked.parser(tokens.splice(attribution,1)):'';
    let body=marked.parser(tokens);
    if(first)body='<h1>'+view.title(a)+'</h1>\n'+body;
    const primary=catalog.topics.find(t=>t.id===a.topics[0]);
    const meta=view.meta(catalog,a).replace('</dl>','</dl>'+quote);
    const toc=headings.length?'<details class="article-toc"><summary>本页目录'+icon('chevron-down')+'</summary><nav aria-label="本页目录"><ol>'+headings.map(h=>`<li class="toc-level-${h.level}"><a data-heading="${e(h.id)}" href="#${encodeURIComponent(h.id)}">${h.text}</a></li>`).join('')+'</ol></nav></details>':'';
    // Insert metadata after the first heading without reparsing or editing article text.
    const firstHeadingEnd=body.indexOf('</h1>')+5;
    body=body.slice(0,firstHeadingEnd)+meta+toc+body.slice(firstHeadingEnd);
    const top=`<div class="article-topline"><nav class="breadcrumbs" aria-label="面包屑"><a href="/">首页</a><span aria-hidden="true">/</span><a href="/#/docs/topics?id=topic-${primary.id}">${e(primary.title)}</a></nav></div>`;
    const discussion='<section id="gitalk-container" class="article-discussion"><h2>讨论与补充</h2><a target="_blank" rel="noopener" href="https://github.com/xiongcccc/gitalk-comment/issues?q='+encodeURIComponent('is:issue "/docs/'+a.id+'"')+'">查看与参与 GitHub 讨论</a></section>';
    return page({a,title:a.title,description:a.title+'。'+a.versionNote,body:top+body+view.footer(catalog,a,view.url)+discussion});
  }
  for(const a of catalog.articles)outputs.set(`articles/${a.id}/index.html`,render(a));
  const directory='<h1>全部文章</h1><p>PostgreSQL Howto 中文版 · '+catalog.articles.length+' 篇文章。按主归属专题排列，保留原始来源与验证说明。</p><p><a href="/#/docs/find">搜索与多维筛选</a> · <a href="/#/docs/paths">学习路径</a></p>'+catalog.topics.map(t=>'<section><h2>'+e(t.title)+'</h2><ul>'+catalog.articles.filter(a=>a.topics[0]===t.id).map(a=>`<li><a href="${view.url(a.id)}">${e(a.title)}</a></li>`).join('')+'</ul></section>').join('');
  outputs.set('articles/index.html',page({title:'全部文章',description:'按技术专题浏览 PostgreSQL Howto 中文版的全部文章。',body:directory}));
  outputs.set('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+['/', '/articles/', ...catalog.articles.map(a=>view.url(a.id))].map(p=>`  <url><loc>${origin+p}</loc></url>`).join('\n')+'\n</urlset>\n');
}
