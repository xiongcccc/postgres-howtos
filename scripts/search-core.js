(function (root) {
  'use strict';
  function normalize(value) {
    return String(value || '').normalize('NFKC').toLowerCase().replace(/[\s_\-／/]+/g, '');
  }
  function search(catalog, query, filters, bodies) {
    var terms = String(query || '').trim().split(/\s+/).filter(Boolean).map(normalize).filter(Boolean);
    return catalog.articles.filter(function (a) {
      return (!filters.type || a.type === filters.type) && (!filters.topic || a.topics.includes(filters.topic));
    }).map(function (a) {
      var title = normalize(a.title);
      var aliases = a.aliases.map(normalize);
      var original = normalize(a.originalTitle);
      var tags = normalize(a.topics.map(function (id) { return catalog.topics.find(function (t) { return t.id === id; }).title; }).join(' '));
      var body = normalize(bodies && bodies[a.id]);
      var score = 0;
      for (var term of terms) {
        if (String(a.id) === term) score += 120;
        else if (title === term || aliases.includes(term)) score += 100;
        else if (title.includes(term)) score += 70;
        else if (aliases.some(function (s) { return s.includes(term); })) score += 60;
        else if (original.includes(term)) score += 50;
        else if (tags.includes(term)) score += 15;
        else if (body.includes(term)) score += 5;
        else return null;
      }
      return {article:a,score:score};
    }).filter(Boolean).sort(function (a,b) { return b.score-a.score || a.article.id-b.article.id; });
  }
  var api = {normalize:normalize,search:search};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HowtoSearch = api;
})(typeof window === 'undefined' ? globalThis : window);
