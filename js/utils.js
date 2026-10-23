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
function normalizeRanges(arr){
  var list = (Array.isArray(arr) ? arr : []).filter(function(x){
    return Array.isArray(x) && x.length >= 2 && isFinite(x[0]) && isFinite(x[1]) && Number(x[1]) > Number(x[0]);
  }).map(function(x){ return [Math.max(0, Math.floor(Number(x[0]))), Math.ceil(Number(x[1]))]; })
    .sort(function(a, b){ return a[0] - b[0]; });
  var out = [];
  list.forEach(function(x){
    var last = out[out.length - 1];
    if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]);
    else out.push([x[0], x[1]]);
  });
  return out;
}
function subtractRange(arr, s, e){
  s = Math.max(0, Math.floor(Number(s) || 0));
  e = Math.ceil(Number(e) || 0);
  var out = [];
  (Array.isArray(arr) ? arr : []).forEach(function(x){
    if (!Array.isArray(x) || x.length < 2) return;
    var a = Number(x[0]), b = Number(x[1]);
    if (!isFinite(a) || !isFinite(b) || b <= a) return;
    if (b <= s || a >= e) { out.push([a, b]); return; }
    if (a < s) out.push([a, Math.min(b, s)]);
    if (b > e) out.push([Math.max(a, e), b]);
  });
  return normalizeRanges(out);
}
