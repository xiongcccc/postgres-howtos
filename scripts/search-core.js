(function (root) {
  'use strict';
  function normalize(value) {
    return String(value || '').normalize('NFKC').toLowerCase().replace(/[\s_\-／/]+/g, '');
  }
  function search(catalog, query, filters, bodies) {
    filters = filters || {};
    var terms = String(query || '').trim().split(/\s+/).filter(Boolean).map(normalize).filter(Boolean);
    return catalog.articles.filter(function (a) {
      return (!filters.type || a.type === filters.type) && (!filters.series || a.series === filters.series) && (!filters.topic || a.topics.includes(filters.topic));
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
  function ranges(text, query) {
    var normalized = '', positions = [];
    var offset = 0;
    for (var character of String(text)) {
      var value = normalize(character);
      for (var i = 0; i < value.length; i++) positions.push([offset, offset + character.length]);
      normalized += value; offset += character.length;
    }
    var found = [];
    String(query || '').trim().split(/\s+/).map(normalize).filter(Boolean).forEach(function (term) {
      var at = normalized.indexOf(term);
      while (at !== -1) {
        found.push([positions[at][0], positions[at + term.length - 1][1]]);
        at = normalized.indexOf(term, at + term.length);
      }
    });
    return found.sort(function(a,b){return a[0]-b[0];}).reduce(function(merged,r){
      var last=merged[merged.length-1];
      if(last && r[0]<=last[1]) last[1]=Math.max(last[1],r[1]);else merged.push(r);
      return merged;
    },[]);
  }
  function snippet(text, query, length) {
    text = String(text || ''); length = length || 160;
    var matches = ranges(text, query);
    var start = matches.length ? Math.max(0, matches[0][0] - 35) : 0;
    return (start ? '…' : '') + text.slice(start, start + length) + (start + length < text.length ? '…' : '');
  }
  var api = {normalize:normalize,search:search,ranges:ranges,snippet:snippet};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HowtoSearch = api;
})(typeof window === 'undefined' ? globalThis : window);
