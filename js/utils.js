'use strict';
function uid(){
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function nl2li(text){
  return String(text || '').split(/\r?\n/).map(function(l){ return l.trim(); })
    .filter(Boolean).map(function(l){ return '<li>' + esc(l) + '</li>'; }).join('');
}
function debounce(fn, ms){
  var t = null;
  return function(){
    var args = arguments, self = this;
    clearTimeout(t);
    t = setTimeout(function(){ fn.apply(self, args); }, ms);
  };
}
function dateLabel(v){ return v ? String(v).replace('-', '.') : ''; }
function textStats(text){
  text = String(text == null ? '' : text);
  var chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  var latin = text.replace(/[\u4e00-\u9fa5]/g, ' ');
  var words = (latin.match(/[A-Za-z0-9]+/g) || []).length;
  return { chinese: chinese, words: words, total: chinese + words, noSpace: text.replace(/\s+/g, '').length };
}
function pad2(n){ return n < 10 ? '0' + n : '' + n; }
function fileTimestamp(d){
  d = d || new Date();
  return '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '_' + pad2(d.getHours()) + pad2(d.getMinutes());
}