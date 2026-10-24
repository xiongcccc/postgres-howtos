import {parse, parseFragment, serialize} from '../vendor/parse5.mjs';
import view from '../scripts/article-view.js';

export {parse, parseFragment, serialize};
export const attribute = (node, name) => node.attrs?.find(a=>a.name===name)?.value;
export function elements(node, predicate, found=[]) {
  if(predicate(node))found.push(node);
  for(const child of node.childNodes||[])elements(child,predicate,found);
  return found;
}
export function textContent(node) {
  return node.nodeName==='#text'?node.value:(node.childNodes||[]).map(textContent).join('');
}
const blocks=new Set('address article aside blockquote br dd div dl dt figcaption figure h1 h2 h3 h4 h5 h6 hr li ol p pre section table tbody td th thead tr ul'.split(' '));
export function visibleText(html) {
  function text(node) {
    if(node.nodeName==='#text')return node.value;
    if(['script','style','template'].includes(node.tagName))return '';
    const body=(node.childNodes||[]).map(text).join('');
    return blocks.has(node.tagName)?' '+body+' ':body;
  }
  return text(parseFragment(html));
}
export function staticHref(href) {
  if(!href)return href;
  let route=href;
  if(route.startsWith('/#/'))route=route.slice(2);
  else if(route.startsWith('#/'))route=route.slice(1);
  else if(!/^\/(?:README|docs\/[\w-]+)\.md(?:\?|$)/.test(route))return href;
  const [path,query='']=route.split('?');
  const name=path.replace(/\.md$/,'');
  const anchor=new URLSearchParams(query).get('id');
  const suffix=anchor?'#'+encodeURIComponent(anchor):'';
  const numbered=name.match(/^\/docs\/(\d+)$/);
  if(numbered)return view.url(numbered[1])+suffix;
  if(name==='/README'||name==='/')return '/'+suffix;
  const discovery=view.discovery(name);
  if(discovery)return discovery.url+suffix;
  if(name==='/docs/find'&&!query)return '/articles/';
  return '/#'+name+(query?'?'+query:'');
}
export function staticMarkup(html, {home=false}={}) {
  const tree=parseFragment(html);
  for(const node of elements(tree,n=>n.tagName==='a')) {
    const href=node.attrs.find(a=>a.name==='href');
    if(href)href.value=staticHref(href.value);
    node.attrs=node.attrs.filter(a=>a.name!=='data-docs-route');
  }
  if(home)for(const node of elements(tree,n=>attribute(n,'data-finder')!==undefined)) {
    // Search remains a JS enhancement; the initial response has a working reading entry.
    node.childNodes=parseFragment('<a class="button button-secondary" href="/articles/">全部文章</a>').childNodes;
    for(const child of node.childNodes)child.parentNode=node;
  }
  return serialize(tree);
}
