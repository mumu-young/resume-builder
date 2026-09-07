'use strict';
const { test, runAll } = require('../lib/suite');
const { ok, eq } = require('../lib/assert');
const { loadScripts } = require('../lib/load-js');
const fs3 = require('fs');
const path3 = require('path');
const tplCss = fs3.readFileSync(path3.join(__dirname, '..', '..', 'css', 'templates.css'), 'utf8');

function sampleData(){
  return {
    basic: { name: '张三', phone: '13800000000', email: 'a@b.com', location: '上海', target: '前端开发工程师', years: '3 年', age: '25', photo: '' },
    education: [{ school: '复旦大学', degree: '本科', major: '计算机', start: '2018-09', end: '2022-06', gpa: '3.8/4.0', rank: '前10%', courses: '数据结构、操作系统', description: '参与ACM竞赛' }],
    work: [{ company: '某科技公司', position: '前端实习生', start: '2023-07', end: '2024-06', description: '负责后台管理页面开发\n优化首屏加载' }],
    projects: [{ name: '校园二手平台', role: '后端开发', start: '2023-03', end: '2023-06', tech: 'Node.js、MySQL', link: 'github.com/x', description: '实现订单模块' }],
    skills: [{ category: '编程语言', items: 'JavaScript\nTypeScript' }, { category: '框架', items: 'Vue、React' }],
    honors: { items: [{ title: '国家奖学金', year: '2022', description: '校级' }], extra: '英语：CET-6\n兴趣：摄影' },
    profile: '2年经验，擅长Vue。'
  };
}
function emptyData(){
  return {
    basic: { name: '', gender: '', birthYear: '', phone: '', email: '', location: '', target: '', years: '', summary: '', photo: '' },
    education: [], work: [], projects: [], skills: [], honors: { items: [], extra: '' }, profile: ''
  };
}
function load(){
  return loadScripts({}, ['js/utils.js', 'js/templates.js']);
}

const ctx = load();
const d = sampleData();

test('三套模板都渲染姓名/求职意向/简介', () => {
  for (const id of ['clean', 'classic', 'modern']){
    const html = ctx.getTemplate(id).render(d);
    ok(html.indexOf('张三') >= 0, id + ' 缺少姓名');
    ok(html.indexOf('前端开发工程师') >= 0, id + ' 缺少求职意向');
    ok(html.indexOf('2年经验') >= 0, id + ' 缺少简介');
  }
});
test('空数据时隐藏空分节', () => {
  const html = ctx.renderClean(emptyData());
  ok(html.indexOf('你的姓名') >= 0, '空简历应显示占位姓名');
  eq(html.indexOf('教育经历'), -1, '空教育经历不应显示');
  eq(html.indexOf('实习 / 工作经历'), -1, '空工作经历不应显示');
  eq(html.indexOf('项目经验'), -1, '空项目经验不应显示');
  eq(html.indexOf('专业技能'), -1, '空技能不应显示');
  eq(html.indexOf('荣誉证书'), -1, '空荣誉不应显示');
  eq(html.indexOf('个人简介 / 自我评价'), -1, '空个人简介不应显示');
});
test('工作描述多行转 <li>', () => {
  const html = ctx.renderClean(d);
  ok(html.indexOf('<li>负责后台管理页面开发</li>') >= 0, '缺少第一行条目');
  ok(html.indexOf('<li>优化首屏加载</li>') >= 0, '缺少第二行条目');
});
test('HTML 特殊字符被转义', () => {
  const dd = JSON.parse(JSON.stringify(d));
  dd.profile = '<script>alert(1)</script> & "x"';
  const html = ctx.renderClean(dd);
  ok(html.indexOf('&lt;script&gt;') >= 0, 'script 未转义');
  ok(html.indexOf('<script>') === -1, '存在未转义的 script');
});
test('技能按顿号连接展示', () => {
  const html = ctx.renderClean(d);
  ok(html.indexOf('JavaScript、TypeScript') >= 0, '技能顿号连接失败');
  ok(html.indexOf('Vue、React') >= 0, '框架技能顿号连接失败');
});
test('荣誉证书与附加信息展示', () => {
  const html = ctx.renderClean(d);
  ok(html.indexOf('国家奖学金') >= 0, '缺少荣誉');
  ok(html.indexOf('其他信息') >= 0, '缺少其他信息小节');
  ok(html.indexOf('CET-6') >= 0, '缺少附加信息内容');
});
test('教育经历时间范围格式化', () => {
  const html = ctx.renderClean(d);
  ok(html.indexOf('2018.09 - 2022.06') >= 0, '时间范围格式错误');
});
test('getTemplate 未知 id 回退到 clean', () => {
  eq(ctx.getTemplate('not-exist').id, 'clean');
  eq(ctx.getTemplate('modern').id, 'modern');
});
test('classic 模板含两栏结构，modern 模板含色块头部', () => {
  const classic = ctx.renderClassic(d);
  ok(classic.indexOf('tpl-classic-side') >= 0 && classic.indexOf('tpl-classic-main') >= 0, 'classic 两栏结构缺失');
  ok(classic.indexOf('side-h') >= 0, 'classic 侧栏标题缺失');
  const modern = ctx.renderModern(d);
  ok(modern.indexOf('tpl-modern') >= 0, 'modern 缺少模板类');
  ok(modern.indexOf('tpl-header') >= 0, 'modern 缺少头部');
});
test('照片存在时渲染 <img>', () => {
  const dd = JSON.parse(JSON.stringify(d));
  dd.basic.photo = 'data:image/png;base64,AAAA';
  const html = ctx.renderClean(dd);
  ok(html.indexOf('<img src="data:image/png;base64,AAAA"') >= 0, '照片未渲染');
});
test('TEMPLATES 共 9 套且字段齐全', () => {
  eq(ctx.TEMPLATES.length, 9);
  for (const t of ctx.TEMPLATES){
    ok(t.id && t.name && t.desc && typeof t.render === 'function', '模板字段缺失: ' + t.id);
  }
});
test('新增模板都能渲染姓名与分节', () => {
  for (const id of ['elegant', 'compact', 'bizblue', 'open', 'titlebg', 'titlebglight']){
    const html = ctx.getTemplate(id).render(d);
    ok(html.indexOf('张三') >= 0, id + ' 缺少姓名');
    ok(html.indexOf('教育经历') >= 0, id + ' 缺少教育经历分节');
  }
});

test('照片默认使用 7:9 矩形蒙版', () => {
  const dd = JSON.parse(JSON.stringify(d));
  dd.basic.photo = 'data:image/png;base64,AAAA';
  const html = ctx.renderClean(dd);
  ok(html.indexOf('tpl-photo-rect') >= 0, '默认应为矩形照片');
  ok(html.indexOf('tpl-photo-round') === -1, '默认不应为圆形');
});
test('photoShape=round 时使用圆形蒙版', () => {
  const dd = JSON.parse(JSON.stringify(d));
  dd.basic.photo = 'data:image/png;base64,AAAA';
  dd.basic.photoShape = 'round';
  const html = ctx.renderClean(dd);
  ok(html.indexOf('tpl-photo-round') >= 0, '应使用圆形照片');
  ok(html.indexOf('tpl-photo-rect') === -1, '圆形时不应为矩形');
});
test('可自定义模块排列顺序', () => {
  const html = ctx.renderClean(d, { sectionOrder: ['honors', 'skills', 'projects', 'work', 'education'] });
  ok(html.indexOf('荣誉证书') >= 0 && html.indexOf('教育经历') >= 0, '应包含两个分节');
  ok(html.indexOf('荣誉证书') < html.indexOf('教育经历'), '顺序应生效');
});
test('小标题与分割线颜色注入 CSS 变量', () => {
  const html = ctx.renderClean(d, { titleColor: '#6f7d8c', lineColor: '#d0d5da' });
  ok(html.indexOf('--tpl-title-color:#6f7d8c') >= 0, '标题颜色未注入');
  ok(html.indexOf('--tpl-line-color:#d0d5da') >= 0, '分割线颜色未注入');
});
test('classic 模板：教育经历固定在左栏，其余分节在正文区按顺序渲染', () => {
  const html = ctx.renderClassic(d, { sectionOrder: ['projects', 'education', 'work', 'skills', 'honors'] });
  const sideStart = html.indexOf('<aside class="tpl-classic-side">');
  const mainStart = html.indexOf('<main class="tpl-classic-main">');
  ok(sideStart >= 0 && mainStart > sideStart, '两栏结构缺失');
  const eduH = html.indexOf('教育经历');
  ok(eduH > sideStart && eduH < mainStart, '教育经历应固定在左栏');
  const projIdx = html.indexOf('项目经验');
  const workIdx = html.indexOf('实习 / 工作经历');
  ok(projIdx > mainStart, '项目经验应在正文区');
  ok(projIdx < workIdx, '正文区其余分节顺序错误');
});

test('可自定义小标题内容', () => {
  const html = ctx.renderClean(d, { sectionTitles: { work: '工作经历（实习）' } });
  ok(html.indexOf('工作经历（实习）') >= 0, '自定义小标题未生效');
  ok(html.indexOf('实习 / 工作经历') === -1, '默认小标题应被替换');
});
test('简历头联系信息为文字标签：年龄在前、无小图标', () => {
  const html = ctx.renderClean(d);
  ok(html.indexOf('年龄：25岁') >= 0, '缺少年龄');
  ok(html.indexOf('电话：13800000000') >= 0, '缺少电话标签');
  ok(html.indexOf('邮箱：a@b.com') >= 0, '缺少邮箱标签');
  ok(html.indexOf('工作年限：3 年') >= 0, '缺少工作年限');
  ok(html.indexOf('年龄：25岁') < html.indexOf('电话：13800000000'), '年龄应排在电话前面');
  ['📞', '✉️', '🎂', '💼', '📍'].forEach(function(icon){
    ok(html.indexOf(icon) === -1, '不应出现小图标 ' + icon);
  });
  ok(html.indexOf('性别') === -1 && html.indexOf('出生年份') === -1, '不应出现性别/出生年份');
});
test('templates.css：照片矩形无圆角', () => {
  const m = tplCss.match(/\.tpl-photo-rect\{([^}]*)\}/);
  ok(m, '未找到 .tpl-photo-rect 规则');
  ok(/border-radius\s*:\s*0/.test(m[1]), '矩形照片应为 0 圆角');
  ok(!/border-radius\s*:\s*[1-9]/.test(m[1]), '矩形照片不应有正圆角');
});
test('templates.css：简历列表不使用项目符号', () => {
  const m = tplCss.match(/\.resume-page ul\{([^}]*)\}/);
  ok(m, '未找到 .resume-page ul 规则');
  ok(/list-style\s*:\s*none/.test(m[1]), '简历列表应去除项目符号');
});
test('简历内分隔符使用 |，不再使用 ·', () => {
  const html = ctx.renderClean(d);
  ok(html.indexOf('年龄：25岁 | 电话：13800000000') >= 0, '联系信息未用 | 分隔');
  ok(html.indexOf('复旦大学 | 计算机') >= 0, '教育经历学校/专业未用 | 分隔');
  ok(html.indexOf(' | ') >= 0, '缺少 | 分隔符');
  ok(html.indexOf(' · ') === -1, '仍存在 · 分隔符');
});
test('其他信息小标题可自定义', () => {
  const dd = JSON.parse(JSON.stringify(d));
  const html = ctx.renderClean(dd, { sectionTitles: { extra: '补充信息' } });
  ok(html.indexOf('补充信息') >= 0, '自定义其他信息标题未生效');
  ok(html.indexOf('其他信息') === -1, '默认其他信息标题应被替换');
});
test('经典模板渲染头部联系方式网格与蓝色小标题', () => {
  const tpl = ctx.getTemplate('bizblue');
  ok(tpl.name === '经典模板', '模板名应为 经典模板，实际 ' + tpl.name);
  const html = tpl.render(d);
  ok(html.indexOf('tpl-bizblue') >= 0, '缺少 bizblue 模板类');
  ok(html.indexOf('bb-title') >= 0, '缺少蓝色小标题');
  ok(html.indexOf('bb-contact') >= 0, '缺少联系方式网格');
  ok(html.indexOf('bb-head-text') >= 0, '缺少头部文字栏');
  ok(html.indexOf('张三') >= 0, '缺少姓名');
  ok(html.indexOf('前端开发工程师') > html.indexOf('张三'), '求职意向应在姓名下方');
  ['🎂', '📞', '✉️', '📍', '💼'].forEach(function(ic){ ok(html.indexOf(ic) === -1, '不应出现联系小图标 ' + ic); });
  ok(html.indexOf('教育经历') >= 0, '缺少教育经历分节');
  const custom = tpl.render(d, { sectionTitles: { work: '工作经历' } });
  ok(custom.indexOf('工作经历') >= 0, '自定义小标题未生效');
});
test('开放两栏模板渲染左右双栏与蓝色小标题', () => {
  const html = ctx.getTemplate('open').render(d);
  ok(html.indexOf('tpl-open') >= 0, '缺少 open 模板类');
  ok(html.indexOf('tpl-open-side') >= 0 && html.indexOf('tpl-open-main') >= 0, '缺少双栏结构');
  ok(html.indexOf('op-title') >= 0 && html.indexOf('op-line') >= 0, '缺少蓝色小标题与横线');
  ok(html.indexOf('张三') >= 0, '缺少姓名');
  ok(html.indexOf('前端开发工程师') >= 0, '缺少求职意向');
  ok(html.indexOf('邮箱：a@b.com') >= 0, '缺少联系信息');
  ok(html.indexOf('op-side-h') >= 0, '教育经历应固定在左栏');
  ok(html.indexOf('教育经历') < html.indexOf('tpl-open-main'), '教育经历应在左栏（主栏之前）');
  ['🎂','📞','✉️','📍','💼'].forEach(function(ic){ ok(html.indexOf(ic) === -1, '不应出现联系小图标 ' + ic); });
  const custom = ctx.getTemplate('open').render(d, { sectionTitles: { education: '教育背景' } });
  ok(custom.indexOf('教育经历') >= 0, '教育经历标题应固定为教育经历');
  ok(custom.indexOf('教育背景') === -1, '教育经历标题不跟随小标题内容设置');
});
test('templates.css：开放两栏左侧色块占满整页高度', () => {
  const m = tplCss.match(/\.tpl-open-grid\{([^}]*)\}/);
  ok(m, '未找到 .tpl-open-grid 规则');
  ok(/min-height\s*:\s*297mm/.test(m[1]), '开放两栏 grid 应占满 297mm 整页高度');
});
test('联系信息分隔符可选 · 与空白', () => {
  const dd = JSON.parse(JSON.stringify(d));
  dd.basic.contactSeparator = '·';
  const m = ctx.renderClean(dd);
  ok(m.indexOf('年龄：25岁 · 电话') >= 0, '· 分隔符未生效');
  dd.basic.contactSeparator = ' ';
  const s = ctx.renderClean(dd);
  ok(s.indexOf('年龄：25岁&nbsp;&nbsp;&nbsp;&nbsp;电话') >= 0, '空白分隔符未生效（应使用宽空白）');
});
test('显示标签开关：关闭后隐藏字段标签', () => {
  const dd = JSON.parse(JSON.stringify(d));
  dd.basic.showLabels = { age: false, phone: false, email: false, location: false, years: false };
  const html = ctx.renderClean(dd);
  ok(html.indexOf('25岁') >= 0, '年龄值应仍显示');
  ok(html.indexOf('年龄：') === -1, '年龄标签应隐藏');
  ok(html.indexOf('电话：') === -1, '电话标签应隐藏');
  ok(html.indexOf('邮箱：') === -1, '邮箱标签应隐藏');
  ok(html.indexOf('所在地：') === -1, '所在地标签应隐藏');
  ok(html.indexOf('工作年限：') === -1, '工作年限标签应隐藏');
});
test('求职意向标签可单独关闭', () => {
  const dd = JSON.parse(JSON.stringify(d));
  ok(ctx.renderClean(dd).indexOf('求职意向：前端开发工程师') >= 0, '默认应显示求职意向标签');
  dd.basic.targetLabel = false;
  const html = ctx.renderClean(dd);
  ok(html.indexOf('前端开发工程师') >= 0, '求职意向值应仍显示');
  ok(html.indexOf('求职意向：前端开发工程师') === -1, '关闭后不应显示求职意向前缀');
});
test('templates.css：横线粗细用变量、现代简约无圆点', () => {
  const compH = tplCss.match(/\.tpl-compact \.tpl-header\{([^}]*)\}/);
  ok(compH && /var\(--tpl-line-width/.test(compH[1]), '横线粗细未使用变量');
  ok(tplCss.indexOf('.tpl-modern .tpl-item::before') === -1, '现代简约不应有 ::before 圆点');
});
test('templates.css：专业技能分类不跟随标题颜色', () => {
  ['tpl-modern', 'tpl-bizblue', 'tpl-open'].forEach(function(prefix){
    const m = tplCss.match(new RegExp('\\.' + prefix + ' \\.tpl-skill-cat\\{([^}]*)\\}'));
    ok(!m || m[1].indexOf('var(--tpl-title-color') === -1, prefix + ' 专业技能分类不应使用标题颜色');
  });
});
test('templates.css：简洁单栏无分割线', () => {
  const h = tplCss.match(/\.tpl-clean \.tpl-header\{([^}]*)\}/);
  ok(h && h[1].indexOf('border-bottom') === -1, '简洁单栏头部不应有横线');
  const h2 = tplCss.match(/\.tpl-clean \.tpl-h2\{([^}]*)\}/);
  ok(!h2 || h2[1].indexOf('border-bottom') === -1, '简洁单栏小标题不应有分割线');
});
test('templates.css：经典模板与开放两栏分割线为边框线', () => {
  const bb = tplCss.match(/\.tpl-bizblue \.bb-line\{([^}]*)\}/);
  ok(bb && /border-bottom:var\(--tpl-line-width/.test(bb[1]) && /height:0/.test(bb[1]), '经典模板分割线应为边框线');
  const op = tplCss.match(/\.op-line\{([^}]*)\}/);
  ok(op && /border-bottom:var\(--tpl-line-width/.test(op[1]) && /height:0/.test(op[1]), '开放两栏分割线应为边框线');
});

test('templates.css：优雅知性头部无横线', () => {
  const eh = tplCss.match(/\.tpl-elegant \.tpl-header\{([^}]*)\}/);
  ok(eh && eh[1].indexOf('border-bottom') === -1, '优雅知性头部不应有横线');
});

test('标题背景色模板渲染背景色块小标题与头部', () => {
  const tpl = ctx.getTemplate('titlebg');
  const html = tpl.render(d);
  ok(html.indexOf('tpl-titlebg') >= 0, '缺少 titlebg 模板类');
  ok(html.indexOf('tb-sec-head') >= 0 && html.indexOf('tb-title') >= 0, '缺少背景色块小标题');
  ok(html.indexOf('张三') >= 0, '缺少姓名');
  ok(html.indexOf('教育经历') >= 0, '缺少教育经历分节');
  ok(html.indexOf('邮箱：a@b.com') >= 0, '缺少联系信息');
  const custom = tpl.render(d, { sectionTitles: { work: '工作经历' } });
  ok(custom.indexOf('工作经历') >= 0, '自定义小标题未生效');
});
test('标题背景浅色模板渲染4px竖条与浅色底块', () => {
  const tpl = ctx.getTemplate('titlebglight');
  ok(tpl.name === '标题背景浅色', '模板名错误: ' + tpl.name);
  const html = tpl.render(d);
  ok(html.indexOf('tpl-titlebglight') >= 0, '缺少 titlebglight 模板类');
  ok(html.indexOf('tb-light-sec-head') >= 0 && html.indexOf('tb-light-title') >= 0, '缺少浅色底块小标题');
  ok(html.indexOf('张三') >= 0, '缺少姓名');
  ok(html.indexOf('教育经历') >= 0, '缺少教育经历分节');
});
test('templates.css：标题背景浅色头部样式与标题背景色一致', () => {
  ok(tplCss.indexOf('.tpl-titlebg .tpl-header, .tpl-titlebglight .tpl-header{') >= 0, '标题背景浅色应复用头部样式规则');
  ok(tplCss.indexOf('.tpl-titlebg .tb-head-right, .tpl-titlebglight .tb-head-right{') >= 0, '标题背景浅色应复用联系方式网格规则');
});
test('开放两栏教育经历按参考排版（学校加粗、时间与专业分两行、描述列表）', () => {
  const html = ctx.getTemplate('open').render(d);
  ok(html.indexOf('op-edu-item') >= 0, '缺少教育经历条目容器');
  ok(html.indexOf('<div class="op-edu-school">复旦大学</div>') >= 0, '学校应单独放大加粗');
  ok(html.indexOf('<div class="op-edu-date">2018.09 - 2022.06</div>') >= 0, '时间应单独一行');
  ok(html.indexOf('<div class="op-edu-major">计算机</div>') >= 0, '专业应单独一行');
  ok(html.indexOf('op-edu-school">复旦大学</div>') < html.indexOf('op-edu-date'), '学校应在时间上方');
  ok(html.indexOf('op-edu-date">2018.09 - 2022.06</div>') < html.indexOf('op-edu-major">计算机</div>'), '时间应在专业上方（两行排列）');
  ok(html.indexOf('op-edu-line') === -1, '不应再使用同一行容器 op-edu-line');
  ok(html.indexOf('复旦大学 | 计算机') === -1, '学校与专业间不应有分隔符');
  ok(html.indexOf('op-edu-list') >= 0, '缺少描述列表');
  ok(html.indexOf('相关课程：数据结构、操作系统') >= 0, '缺少相关课程行');
  ok(html.indexOf('<li>参与ACM竞赛</li>') >= 0, '缺少经历描述行');
  const schoolCss = tplCss.match(/\.tpl-open-side \.op-edu-school\{([^}]*)\}/);
  ok(schoolCss && /font-weight:700/.test(schoolCss[1]) && /font-size:calc\(var\(--tpl-fs, 14px\) \+ 2px\)/.test(schoolCss[1]), '学校应加粗且字号较大');
});
test('开放两栏：教育经历时间与专业分两行排列（独立行 + 样式）', () => {
  const html = ctx.getTemplate('open').render(d);
  const dateHtml = '<div class="op-edu-date">2018.09 - 2022.06</div>';
  const majorHtml = '<div class="op-edu-major">计算机</div>';
  ok(html.indexOf(dateHtml) >= 0, '时间应是独立 div 行');
  ok(html.indexOf(majorHtml) >= 0, '专业应是独立 div 行');
  ok(html.indexOf(dateHtml) < html.indexOf(majorHtml), '时间行应在专业行之前');
  ok(html.indexOf('op-edu-line') === -1, '不应存在 op-edu-line 同一行容器');
  const dateCss = tplCss.match(/\.tpl-open-side \.op-edu-date\{([^}]*)\}/);
  ok(dateCss && dateCss[1].indexOf('display:flex') === -1, '时间不应再使用 flex 同行布局');
  const majorCss = tplCss.match(/\.tpl-open-side \.op-edu-major\{([^}]*)\}/);
  ok(majorCss && majorCss[1].indexOf('display:flex') === -1, '专业不应再使用 flex 同行布局');
});
test('TEMPLATES 顺序：经典模板/开放两栏/标题背景色/标题背景浅色在前', () => {
  const ids = ctx.TEMPLATES.map(function(t){ return t.id; });
  ok(ids[0] === 'bizblue' && ids[1] === 'open' && ids[2] === 'titlebg' && ids[3] === 'titlebglight', '前四个应为指定模板: ' + ids.join(','));
});
test('个人简介/自我评价渲染为独立分节且默认在荣誉证书之后', () => {
  const html = ctx.renderClean(d);
  ok(html.indexOf('个人简介 / 自我评价') >= 0, '缺少个人简介分节标题');
  ok(html.indexOf('2年经验，擅长Vue。') >= 0, '缺少个人简介内容');
  ok(html.indexOf('荣誉证书') < html.indexOf('个人简介 / 自我评价'), '个人简介应默认在荣誉证书之后');
  ok(html.indexOf('tpl-profile') >= 0, '缺少 tpl-profile 样式类');
});
test('个人简介分节小标题可自定义', () => {
  const html = ctx.renderClean(d, { sectionTitles: { profile: '自我评价' } });
  ok(html.indexOf('自我评价') >= 0, '自定义小标题未生效');
  ok(html.indexOf('个人简介 / 自我评价') === -1, '默认标题应被替换');
});
test('个人简介分节可自定义排列顺序', () => {
  const html = ctx.renderClean(d, { sectionOrder: ['profile', 'education', 'work', 'projects', 'skills', 'honors'] });
  ok(html.indexOf('个人简介 / 自我评价') < html.indexOf('教育经历'), '个人简介应可排到最前');
});
test('DEFAULT_SECTION_ORDER 默认含 profile 且在 honors 之后', () => {
  const idx = ctx.DEFAULT_SECTION_ORDER.indexOf('profile');
  ok(idx > 0, 'DEFAULT_SECTION_ORDER 应包含 profile');
  ok(ctx.DEFAULT_SECTION_ORDER[idx - 1] === 'honors', 'profile 应默认排在 honors 之后');
});
test('基础信息 summary 不再渲染，个人简介以分节展示', () => {
  const dd = JSON.parse(JSON.stringify(d));
  dd.basic.summary = '头部不应出现的简介';
  const html = ctx.renderClean(dd);
  ok(html.indexOf('头部不应出现的简介') === -1, 'basic.summary 不应再渲染到头部');
  ok(html.indexOf('tpl-summary') === -1, '不应再出现 tpl-summary 元素');
  ok(html.indexOf('2年经验，擅长Vue。') >= 0, 'profile 内容应以分节渲染');
});
test('tplCoursesLi 将多行课程合并为顿号单行', () => {
  eq(ctx.tplCoursesLi('A\nB\nC'), '<li>相关课程：A、B、C</li>');
  eq(ctx.tplCoursesLi(''), '');
  eq(ctx.tplCoursesLi('   '), '');
});
test('教育经历相关课程多行输入以顿号合并展示', () => {
  const dd = JSON.parse(JSON.stringify(d));
  dd.education[0].courses = '数据结构\n操作系统\n计算机网络';
  const html = ctx.renderClean(dd);
  ok(html.indexOf('相关课程：数据结构、操作系统、计算机网络') >= 0, '多行课程应合并为顿号一行展示');
});
test('开放两栏矩形照片为 7:9 比例', () => {
  const m = tplCss.match(/\.tpl-open-side \.tpl-photo-rect\{([^}]*)\}/);
  ok(m, '缺少开放两栏照片规则');
  const wm = m[1].match(/width:(\d+)px/), hm = m[1].match(/height:(\d+)px/);
  ok(wm && hm, '开放两栏照片缺少宽高: ' + m[1]);
  eq(parseInt(wm[1], 10) * 9, parseInt(hm[1], 10) * 7, '开放两栏矩形照片应保持 7:9 比例');
  const rr = tplCss.match(/\.tpl-open-side \.tpl-photo-round\{([^}]*)\}/);
  ok(rr && /width:96px/.test(rr[1]) && /height:96px/.test(rr[1]), '圆形照片应为正方形');
});
test('classic 模板左栏教育经历展示学校/专业/时间，右栏不含教育经历', () => {
  const html = ctx.renderClassic(d);
  const sideStart = html.indexOf('<aside class="tpl-classic-side">');
  const mainStart = html.indexOf('<main class="tpl-classic-main">');
  const side = html.slice(sideStart, mainStart);
  const main = html.slice(mainStart);
  ok(side.indexOf('复旦大学') >= 0, '左栏缺少学校');
  ok(side.indexOf('本科 · 计算机') >= 0, '左栏缺少学历/专业');
  ok(side.indexOf('2018.09 - 2022.06') >= 0, '左栏缺少时间');
  ok(side.indexOf('相关课程：数据结构、操作系统') >= 0, '左栏缺少课程');
  ok(side.indexOf('side-edu-item') >= 0, '左栏缺少教育条目结构');
  ok(main.indexOf('教育经历') === -1, '右栏不应再渲染教育经历');
});
test('classic 模板教育经历标题固定为教育经历，不跟随小标题设置', () => {
  const html = ctx.renderClassic(d, { sectionTitles: { education: '教育背景' } });
  ok(html.indexOf('教育经历') >= 0, '左栏应显示默认标题');
  ok(html.indexOf('教育背景') === -1, '教育经历标题不应跟随小标题内容设置');
});
runAll();