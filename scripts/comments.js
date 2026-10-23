(function () {
  'use strict';
  window.$docsify.plugins=(window.$docsify.plugins||[]).concat(function(hook){
    hook.doneEach(function(){
      var route=(location.hash.slice(1).split('?')[0]||'/').replace(/\.md$/,'');
      if(!/^\/docs\/\d+$/.test(route))return;
      var section=document.querySelector('.markdown-section');
      if(!section||/没有找到这篇文章/.test(section.querySelector('h1')?.textContent||''))return;
      section.querySelector('#gitalk-container')?.remove();
      var container=document.createElement('section');container.id='gitalk-container';container.className='article-discussion';container.setAttribute('aria-label','文章讨论');
      var heading=document.createElement('h2');heading.textContent='讨论与补充';
      var link=document.createElement('a');link.href='https://github.com/xiongcccc/gitalk-comment/issues?q='+encodeURIComponent('is:issue "'+route+'"');link.target='_blank';link.rel='noopener';link.textContent='查看与参与 GitHub 讨论';
      container.append(heading,link);section.append(container);
    });
  });
})();
