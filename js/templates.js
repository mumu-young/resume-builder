'use strict';
var DEGREE_OPTIONS = [['', '请选择'], ['大专', '大专'], ['本科', '本科'], ['硕士', '硕士'], ['博士', '博士'], ['其他', '其他']];
var GENDER_OPTIONS = [['', '不填'], ['男', '男'], ['女', '女']];

var DEFAULT_SECTION_ORDER = ['education', 'work', 'projects', 'skills', 'honors', 'profile'];
var DEFAULT_SECTION_TITLES = { education: '教育经历', work: '实习 / 工作经历', projects: '项目经验', skills: '专业技能', honors: '荣誉证书', profile: '个人简介 / 自我评价', extra: '其他信息' };
var DEFAULT_TITLE_COLOR = '#4b6e91';
var DEFAULT_LINE_COLOR = '#c3ccd6';

function tplContactItems(b){
  var arr = [];
  if (b.age) arr.push({ key: 'age', label: '年龄', text: /岁$/.test(b.age) ? b.age : b.age + '岁' });
  if (b.phone) arr.push({ key: 'phone', label: '电话', text: b.phone });
  if (b.email) arr.push({ key: 'email', label: '邮箱', text: b.email });
  if (b.location) arr.push({ key: 'location', label: '所在地', text: b.location });
  if (b.years) arr.push({ key: 'years', label: '工作年限', text: b.years });
  return arr;
}
function tplContactItemText(it, b){
  var labels = b.showLabels || {};
  return labels[it.key] === false ? it.text : (it.label + '：' + it.text);
}
function tplContactLine(b){
  var sep;
  if (b.contactSeparator === '·') sep = ' · ';
  else if (b.contactSeparator === ' ') sep = '&nbsp;&nbsp;&nbsp;&nbsp;';
  else sep = ' | ';
  return tplContactItems(b).map(function(it){ return esc(tplContactItemText(it, b)); }).join(sep);
}
function tplTargetLine(b){
  if (!b.target) return '';
  return (b.targetLabel === false ? '' : '求职意向：') + b.target;
}
function tplDateRange(a, b){
  a = dateLabel(a); b = dateLabel(b);
  if (a && b) return a + ' - ' + b;
  return a || b || '';
}
function tplPhoto(b){
  if (!b.photo) return '';
  var shape = b.photoShape === 'round' ? 'round' : 'rect';
  return '<div class="tpl-photo tpl-photo-' + shape + '"><img src="' + b.photo + '" alt="照片"></div>';
}
function templateStyle(opts){
  opts = opts || {};
  return ' style="--tpl-title-color:' + (opts.titleColor || DEFAULT_TITLE_COLOR) + ';--tpl-line-color:' + (opts.lineColor || DEFAULT_LINE_COLOR) + '"';
}

function tplCoursesLi(courses){
  var lines = String(courses || '').split(/\r?\n/).map(function(s){ return s.trim(); }).filter(Boolean);
  if (!lines.length) return '';
  return '<li>相关课程：' + esc(lines.join('、')) + '</li>';
}
function secEducationHTML(d, title, headFn){
  if (!d.education.length) return '';
  var items = d.education.map(function(e){
    var line1 = [e.school, e.major].filter(Boolean).join(' | ');
    var line2 = [e.degree, e.gpa ? ('GPA ' + e.gpa) : '', e.rank ? ('排名 ' + e.rank) : ''].filter(Boolean).join(' | ');
    var li = '';
    if (e.courses) li += tplCoursesLi(e.courses);
    if (e.description) li += nl2li(e.description);
    return '<div class="tpl-item"><div class="tpl-item-head">' +
      '<span class="tpl-item-title">' + esc(line1 || '教育经历') + '</span>' +
      '<span class="tpl-item-date">' + esc(tplDateRange(e.start, e.end)) + '</span></div>' +
      (line2 ? '<div class="tpl-item-sub">' + esc(line2) + '</div>' : '') +
      (li ? '<ul>' + li + '</ul>' : '') + '</div>';
  }).join('');
  return '<section class="tpl-section">' + (headFn || defaultSectionHead)(title || DEFAULT_SECTION_TITLES.education) + items + '</section>';
}
function secWorkHTML(d, title, headFn){
  if (!d.work.length) return '';
  var items = d.work.map(function(w){
    var sub = [w.position].filter(Boolean).join(' | ');
    return '<div class="tpl-item"><div class="tpl-item-head">' +
      '<span class="tpl-item-title">' + esc(w.company || '实习/工作经历') + '</span>' +
      '<span class="tpl-item-date">' + esc(tplDateRange(w.start, w.end)) + '</span></div>' +
      (sub ? '<div class="tpl-item-sub">' + esc(sub) + '</div>' : '') +
      (w.description ? '<ul>' + nl2li(w.description) + '</ul>' : '') + '</div>';
  }).join('');
  return '<section class="tpl-section">' + (headFn || defaultSectionHead)(title || DEFAULT_SECTION_TITLES.work) + items + '</section>';
}
function secProjectsHTML(d, title, headFn){
  if (!d.projects.length) return '';
  var items = d.projects.map(function(p){
    var sub = [p.role, p.tech ? ('技术栈：' + p.tech) : '', p.link].filter(Boolean).join(' | ');
    return '<div class="tpl-item"><div class="tpl-item-head">' +
      '<span class="tpl-item-title">' + esc(p.name || '项目经验') + '</span>' +
      '<span class="tpl-item-date">' + esc(tplDateRange(p.start, p.end)) + '</span></div>' +
      (sub ? '<div class="tpl-item-sub">' + esc(sub) + '</div>' : '') +
      (p.description ? '<ul>' + nl2li(p.description) + '</ul>' : '') + '</div>';
  }).join('');
  return '<section class="tpl-section">' + (headFn || defaultSectionHead)(title || DEFAULT_SECTION_TITLES.projects) + items + '</section>';
}
function secSkillsHTML(d, title, headFn){
  if (!d.skills.length) return '';
  var items = d.skills.map(function(k){
    var vals = String(k.items || '').split(/[\r\n,，、;；]+/).map(function(s){ return s.trim(); }).filter(Boolean);
    return '<div class="tpl-skill"><span class="tpl-skill-cat">' + esc(k.category || '技能') + '</span>' +
      '<span class="tpl-skill-items">' + esc(vals.join('、')) + '</span></div>';
  }).join('');
  return '<section class="tpl-section">' + (headFn || defaultSectionHead)(title || DEFAULT_SECTION_TITLES.skills) + items + '</section>';
}
function secHonorsHTML(d, t, headFn){
  t = t || {};
  var title = t.honors;
  var extraTitle = t.extra;
  var html = '';
  var items = d.honors.items.map(function(h){
    var yr = h.year ? '（' + esc(h.year) + '）' : '';
    return '<div class="tpl-item"><div class="tpl-item-head">' +
      '<span class="tpl-item-title">' + esc(h.title || '荣誉/证书') + yr + '</span></div>' +
      (h.description ? '<div class="tpl-item-sub">' + esc(h.description) + '</div>' : '') + '</div>';
  }).join('');
  if (items) html += '<section class="tpl-section">' + (headFn || defaultSectionHead)(title || DEFAULT_SECTION_TITLES.honors) + items + '</section>';
  if (d.honors.extra && d.honors.extra.trim()) {
    html += '<section class="tpl-section">' + (headFn || defaultSectionHead)(extraTitle || DEFAULT_SECTION_TITLES.extra) +
      '<p class="tpl-extra">' + esc(d.honors.extra) + '</p></section>';
  }
  return html;
}
function secProfileHTML(d, title, headFn){
  var text = d.profile;
  if (!text || !String(text).trim()) return '';
  return '<section class="tpl-section">' + (headFn || defaultSectionHead)(title || DEFAULT_SECTION_TITLES.profile) +
    '<p class="tpl-profile">' + esc(text) + '</p></section>';
}
function defaultSectionHead(title){
  return '<h2 class="tpl-h2">' + esc(title) + '</h2>';
}
function orderedSectionsHTML(d, order, titles, headFn){
  headFn = headFn || defaultSectionHead;
  var map = {
    education: secEducationHTML(d, titles.education, headFn),
    work: secWorkHTML(d, titles.work, headFn),
    projects: secProjectsHTML(d, titles.projects, headFn),
    skills: secSkillsHTML(d, titles.skills, headFn),
    honors: secHonorsHTML(d, { honors: titles.honors, extra: titles.extra }, headFn),
    profile: secProfileHTML(d, titles.profile, headFn)
  };
  var html = '';
  (order || DEFAULT_SECTION_ORDER).forEach(function(id){ if (map[id]) html += map[id]; });
  return html;
}function renderClean(d, opts){
  opts = opts || {};
  var b = d.basic || {};
  var titles = Object.assign({}, DEFAULT_SECTION_TITLES, opts.sectionTitles || {});
  var html = '<div class="tpl tpl-clean"' + templateStyle(opts) + '>';
  html += '<header class="tpl-header">';
  html += tplPhoto(b);
  html += '<h1 class="tpl-name">' + esc(b.name || '你的姓名') + '</h1>';
  if (b.target) html += '<div class="tpl-target">' + esc(tplTargetLine(b)) + '</div>';
  var contact = tplContactLine(b);
  if (contact) html += '<div class="tpl-contact">' + contact + '</div>';
  html += '</header>';
  html += orderedSectionsHTML(d, opts.sectionOrder || DEFAULT_SECTION_ORDER, titles);
  html += '</div>';
  return html;
}
function renderClassic(d, opts){
  opts = opts || {};
  var b = d.basic || {};
  var titles = Object.assign({}, DEFAULT_SECTION_TITLES, opts.sectionTitles || {});
  var side = '';
  side += '<div class="side-section">' + tplPhoto(b) + '<div class="side-h">联系方式</div><div class="side-contact">';
  tplContactItems(b).forEach(function(it){ side += '<div>' + esc(tplContactItemText(it, b)) + '</div>'; });
  side += '</div></div>';
  if (d.education.length){
    side += '<div class="side-section"><div class="side-h">' + esc(DEFAULT_SECTION_TITLES.education) + '</div>';
    d.education.forEach(function(e){
      var li = '';
      if (e.courses) li += tplCoursesLi(e.courses);
      if (e.description) li += nl2li(e.description);
      side += '<div class="side-edu-item">' +
        '<div class="side-edu-school">' + esc(e.school || '教育经历') + '</div>' +
        (e.degree || e.major ? '<div class="side-edu-major">' + esc([e.degree, e.major].filter(Boolean).join(' · ')) + '</div>' : '') +
        (tplDateRange(e.start, e.end) ? '<div class="side-edu-date">' + esc(tplDateRange(e.start, e.end)) + '</div>' : '') +
        (li ? '<ul class="side-edu-list">' + li + '</ul>' : '') +
        '</div>';
    });
    side += '</div>';
  }
  var main = '<div class="tpl-main-head"><h1 class="tpl-name">' + esc(b.name || '你的姓名') + '</h1>' +
    (b.target ? '<div class="tpl-target">' + esc(tplTargetLine(b)) + '</div>' : '') +
    '</div>';
  var order = (opts.sectionOrder || DEFAULT_SECTION_ORDER).filter(function(id){ return id !== 'education'; });
  main += orderedSectionsHTML(d, order, titles);
  return '<div class="tpl tpl-classic"' + templateStyle(opts) + '><div class="tpl-classic-grid">' +
    '<aside class="tpl-classic-side">' + side + '</aside>' +
    '<main class="tpl-classic-main">' + main + '</main></div></div>';
}
function renderModern(d, opts){
  opts = opts || {};
  var b = d.basic || {};
  var titles = Object.assign({}, DEFAULT_SECTION_TITLES, opts.sectionTitles || {});
  var contact = tplContactLine(b);
  var html = '<div class="tpl tpl-modern"' + templateStyle(opts) + '>';
  html += '<header class="tpl-header"><div>' +
    '<h1 class="tpl-name">' + esc(b.name || '你的姓名') + '</h1>' +
    (b.target ? '<div class="tpl-target">' + esc(tplTargetLine(b)) + '</div>' : '') +
    (contact ? '<div class="tpl-contact">' + contact + '</div>' : '') +
    '</div>' + tplPhoto(b) + '</header>';
  html += '<div class="tpl-body">';
  html += orderedSectionsHTML(d, opts.sectionOrder || DEFAULT_SECTION_ORDER, titles);
  html += '</div></div>';
  return html;
}

function renderElegant(d, opts){
  opts = opts || {};
  var b = d.basic || {};
  var titles = Object.assign({}, DEFAULT_SECTION_TITLES, opts.sectionTitles || {});
  var contact = tplContactLine(b);
  var html = '<div class="tpl tpl-elegant"' + templateStyle(opts) + '>';
  html += '<header class="tpl-header">' + tplPhoto(b) +
    '<h1 class="tpl-name">' + esc(b.name || '你的姓名') + '</h1>' +
    (b.target ? '<div class="tpl-target">' + esc(tplTargetLine(b)) + '</div>' : '') +
    (contact ? '<div class="tpl-contact">' + contact + '</div>' : '') +
    '</header>';
  html += orderedSectionsHTML(d, opts.sectionOrder || DEFAULT_SECTION_ORDER, titles);
  html += '</div>';
  return html;
}
function renderCompact(d, opts){
  opts = opts || {};
  var b = d.basic || {};
  var titles = Object.assign({}, DEFAULT_SECTION_TITLES, opts.sectionTitles || {});
  var contact = tplContactLine(b);
  var html = '<div class="tpl tpl-compact"' + templateStyle(opts) + '>';
  html += '<header class="tpl-header"><h1 class="tpl-name">' + esc(b.name || '你的姓名') + '</h1>' +
    (b.target ? '<div class="tpl-target">' + esc(tplTargetLine(b)) + '</div>' : '') +
    (contact ? '<div class="tpl-contact">' + contact + '</div>' : '') + '</header>';
  html += orderedSectionsHTML(d, opts.sectionOrder || DEFAULT_SECTION_ORDER, titles);
  html += '</div>';
  return html;
}


function bizBlueSectionHead(title){
  return '<div class="bb-sec-head"><span class="bb-title">' + esc(title) + '</span><span class="bb-line"></span></div>';
}
function renderBizBlue(d, opts){
  opts = opts || {};
  var b = d.basic || {};
  var titles = Object.assign({}, DEFAULT_SECTION_TITLES, opts.sectionTitles || {});
  var items = tplContactItems(b);
  var html = '<div class="tpl tpl-bizblue"' + templateStyle(opts) + '>';
  html += '<header class="tpl-header">' +
    '<div class="bb-head-left">' + tplPhoto(b) +
      '<div class="bb-head-text">' +
        '<h1 class="tpl-name">' + esc(b.name || '你的姓名') + '</h1>' +
        (b.target ? '<div class="tpl-target">' + esc(tplTargetLine(b)) + '</div>' : '') +
      '</div>' +
    '</div>' +
    '<div class="bb-head-right">';
  items.forEach(function(it){
    html += '<div class="bb-contact"><span class="bb-c-text">' + esc(tplContactItemText(it, b)) + '</span></div>';
  });
  html += '</div></header>';
  html += orderedSectionsHTML(d, opts.sectionOrder || DEFAULT_SECTION_ORDER, titles, bizBlueSectionHead);
  html += '</div>';
  return html;
}


function openSectionHead(title){
  return '<div class="op-sec-head"><span class="op-title">' + esc(title) + '</span><span class="op-line"></span></div>';
}
function openSideHead(title){
  return '<div class="op-side-h">' + esc(title) + '</div>';
}
function renderOpen(d, opts){
  opts = opts || {};
  var b = d.basic || {};
  var titles = Object.assign({}, DEFAULT_SECTION_TITLES, opts.sectionTitles || {});
  var items = tplContactItems(b);
  var side = '';
  side += tplPhoto(b);
  side += '<h1 class="tpl-name">' + esc(b.name || '你的姓名') + '</h1>';
  if (b.target) side += '<div class="tpl-target">' + esc(tplTargetLine(b)) + '</div>';
  items.forEach(function(it){ side += '<div class="op-contact">' + esc(tplContactItemText(it, b)) + '</div>'; });
  if (d.education.length){
    side += openSideHead(DEFAULT_SECTION_TITLES.education);
    d.education.forEach(function(e){
      var li = '';
      if (e.courses) li += tplCoursesLi(e.courses);
      if (e.description) li += nl2li(e.description);
      side += '<div class="op-edu-item">' +
        '<div class="op-edu-school">' + esc(e.school || '') + '</div>' +
        '<div class="op-edu-date">' + esc(tplDateRange(e.start, e.end)) + '</div>' +
        '<div class="op-edu-major">' + esc(e.major || '') + '</div>' +
        (li ? '<ul class="op-edu-list">' + li + '</ul>' : '') +
        '</div>';
    });
  }
  var main = '';
  var order = (opts.sectionOrder || DEFAULT_SECTION_ORDER).filter(function(id){ return id !== 'education'; });
  main += orderedSectionsHTML(d, order, titles, openSectionHead);
  return '<div class="tpl tpl-open"' + templateStyle(opts) + '><div class="tpl-open-grid">' +
    '<aside class="tpl-open-side">' + side + '</aside>' +
    '<main class="tpl-open-main">' + main + '</main></div></div>';
}


function titleBgSectionHead(title){
  return '<div class="tb-sec-head"><span class="tb-title">' + esc(title) + '</span></div>';
}
function titleBgLightSectionHead(title){
  return '<div class="tb-light-sec-head"><span class="tb-light-title">' + esc(title) + '</span></div>';
}
function renderTitleBgBase(d, opts, headFn){
  opts = opts || {};
  var b = d.basic || {};
  var titles = Object.assign({}, DEFAULT_SECTION_TITLES, opts.sectionTitles || {});
  var items = tplContactItems(b);
  var html = '<div class="tpl ' + opts.cls + '"' + templateStyle(opts) + '>';
  html += '<header class="tpl-header">' +
    '<div class="tb-head-left">' + tplPhoto(b) + '<div class="tb-head-text">' +
      '<h1 class="tpl-name">' + esc(b.name || '你的姓名') + '</h1>' +
      (b.target ? '<div class="tpl-target">' + esc(tplTargetLine(b)) + '</div>' : '') +
    '</div></div>' +
    '<div class="tb-head-right">';
  items.forEach(function(it){
    html += '<div class="tb-contact">' + esc(tplContactItemText(it, b)) + '</div>';
  });
  html += '</div></header>';
  html += orderedSectionsHTML(d, opts.sectionOrder || DEFAULT_SECTION_ORDER, titles, headFn);
  html += '</div>';
  return html;
}
function renderTitleBg(d, opts){
  opts = opts || {};
  opts.cls = 'tpl-titlebg';
  return renderTitleBgBase(d, opts, titleBgSectionHead);
}
function renderTitleBgLight(d, opts){
  opts = opts || {};
  opts.cls = 'tpl-titlebglight';
  return renderTitleBgBase(d, opts, titleBgLightSectionHead);
}

var TEMPLATES = [
{ id: 'bizblue', name: '经典模板', desc: '经典商务单栏：蓝色小标题 + 细线分隔', render: renderBizBlue },
{ id: 'open', name: '开放两栏', desc: '左蓝右白双栏：姓名/联系方式在左侧，正文在右侧', render: renderOpen },
{ id: 'titlebg', name: '标题背景色', desc: '小标题带背景色块，头部照片+联系方式', render: renderTitleBg },
{ id: 'titlebglight', name: '标题背景浅色', desc: '标题左侧4px竖条 + 浅色底块 + 深色字', render: renderTitleBgLight },
{ id: 'clean', name: '简洁单栏', desc: '通栏排版，信息清晰，适合大多数岗位', render: renderClean },
{ id: 'classic', name: '经典两栏', desc: '左侧信息栏 + 右侧正文，稳重经典', render: renderClassic },
{ id: 'modern', name: '现代简约', desc: '色块头部 + 时间线，适合技术/设计岗', render: renderModern },
{ id: 'elegant', name: '优雅知性', desc: '居中排版、细线分隔，气质沉稳', render: renderElegant },
{ id: 'compact', name: '紧凑实用', desc: '字号紧凑、留白少，适合一页内容较多', render: renderCompact }
];
function getTemplate(id){
  for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === id) return TEMPLATES[i];
  for (var j = 0; j < TEMPLATES.length; j++) if (TEMPLATES[j].id === 'clean') return TEMPLATES[j];
  return TEMPLATES[0];
}