'use strict';
const { test, runAll } = require('../lib/suite');
const { eq, ok } = require('../lib/assert');
const { loadScripts } = require('../lib/load-js');

const P = () => loadScripts({}, ['js/parser.js']).ResumeParser;

const STANDARD = [
  '张伟',
  '男 | 25岁 | 13800001234 | zhangwei@example.com | 深圳',
  '求职意向：前端开发工程师',
  '工作年限：3年',
  '',
  '教育经历',
  '复旦大学  计算机科学与技术  本科  2018.09 - 2022.06',
  'GPA 3.8/4.0，专业排名前10%',
  '主修课程：数据结构、操作系统、计算机网络',
  '',
  '工作经历',
  '字节跳动  高级前端工程师  2021.07 - 2024.12',
  '· 负责中台系统前端架构设计与开发',
  '· 主导性能优化，首屏加载从 3s 降到 1.2s',
  '',
  '项目经验',
  '校园二手交易平台 | 后端开发 | Vue3 / Node.js / MySQL | 2022.03 - 2022.09',
  '- 使用 Redis 缓存热点数据',
  '- https://github.com/zhangwei/second-hand',
  '',
  '专业技能',
  '编程语言：JavaScript、TypeScript、Java',
  '框架：Vue、React',
  '',
  '荣誉证书',
  '国家奖学金（2022）',
  'CET-6',
  '',
  '自我评价',
  '3 年前端经验，熟悉工程化与性能优化。'
].join('\n');

test('parse 基础信息：姓名/电话/邮箱/城市/求职意向/年限/年龄', () => {
  const b = P().parse(STANDARD).data.basic;
  eq(b.name, '张伟');
  eq(b.phone, '13800001234');
  eq(b.email, 'zhangwei@example.com');
  eq(b.location, '深圳');
  eq(b.target, '前端开发工程师');
  eq(b.years, '3 年');
  eq(b.age, '25');
});

test('parse 教育经历：学校/专业/学历/起止时间', () => {
  const list = P().parse(STANDARD).data.education;
  eq(list.length, 1);
  eq(list[0].school, '复旦大学');
  eq(list[0].major, '计算机科学与技术');
  eq(list[0].degree, '本科');
  eq(list[0].start, '2018-09');
  eq(list[0].end, '2022-06');
});

test('parse 教育经历：GPA / 排名 / 相关课程', () => {
  const e = P().parse(STANDARD).data.education[0];
  eq(e.gpa, '3.8/4.0');
  eq(e.rank, '前10%');
  eq(e.courses, '数据结构\n操作系统\n计算机网络');
});

test('parse 工作经历：公司/职位/时间/描述逐行', () => {
  const w = P().parse(STANDARD).data.work;
  eq(w.length, 1);
  eq(w[0].company, '字节跳动');
  eq(w[0].position, '高级前端工程师');
  eq(w[0].start, '2021-07');
  eq(w[0].end, '2024-12');
  eq(w[0].description, '负责中台系统前端架构设计与开发\n主导性能优化，首屏加载从 3s 降到 1.2s');
});

test('parse 项目经验：名称/角色/技术栈/链接', () => {
  const p = P().parse(STANDARD).data.projects;
  eq(p.length, 1);
  eq(p[0].name, '校园二手交易平台');
  eq(p[0].role, '后端开发');
  eq(p[0].tech, 'Vue3 / Node.js / MySQL');
  eq(p[0].link, 'https://github.com/zhangwei/second-hand');
  eq(p[0].description, '使用 Redis 缓存热点数据');
});

test('parse 专业技能：分类与逐项拆分', () => {
  const s = P().parse(STANDARD).data.skills;
  eq(s.length, 2);
  eq(s[0].category, '编程语言');
  eq(s[0].items, 'JavaScript\nTypeScript\nJava');
  eq(s[1].category, '框架');
});

test('parse 荣誉证书与自我评价', () => {
  const d = P().parse(STANDARD).data;
  eq(d.honors.items.length, 2);
  eq(d.honors.items[0].title, '国家奖学金');
  eq(d.honors.items[0].year, '2022');
  eq(d.honors.items[1].title, 'CET-6');
  eq(d.profile, '3 年前端经验，熟悉工程化与性能优化。');
});

test('parse 统计与提示：识别数量正确且无警告', () => {
  const r = P().parse(STANDARD);
  eq(r.stats.education, 1);
  eq(r.stats.work, 1);
  eq(r.stats.projects, 1);
  eq(r.stats.skills, 2);
  eq(r.stats.honors, 2);
  eq(r.warnings.length, 0);
});

test('parse 时间格式：年月、年月日式横线、至今', () => {
  const I = P()._internal;
  eq(I.extractRange('2019年7月 - 2024年12月').start, '2019-07');
  eq(I.extractRange('2019年7月 - 2024年12月').end, '2024-12');
  eq(I.extractRange('2019/07-2024/12').end, '2024-12');
  eq(I.extractRange('2021.09 — 至今').end, '');
  eq(I.extractRange('2021.09 — 至今').open, true);
  eq(I.extractRange('2018 - 2022').end, '2022-01');
});

test('parse 英文分节标题与英文学校/学历', () => {
  const text = [
    'JOHN ZHANG',
    '13800001111 | john@test.com',
    'EDUCATION',
    'Fudan University  Computer Science  Bachelor  2018.09 - 2022.06',
    'EXPERIENCE',
    'ByteDance  Frontend Engineer  2021.07 - 2024.12',
    '- Built design system',
    'SKILLS',
    'Languages: JavaScript, TypeScript'
  ].join('\n');
  const d = P().parse(text).data;
  eq(d.basic.name, 'JOHN ZHANG');
  eq(d.education[0].school, 'Fudan University');
  eq(d.education[0].degree, '本科');
  eq(d.work[0].company, 'ByteDance');
  eq(d.work[0].position, 'Frontend Engineer');
  eq(d.work[0].description, 'Built design system');
  eq(d.skills[0].items, 'JavaScript\nTypeScript');
});

test('parse 行内分节「教育经历：…」可正确拆成字段', () => {
  const text = '姓名：赵六  电话：13712345678\n教育经历：中山大学  软件工程  本科  2017.09-2021.06';
  const d = P().parse(text).data;
  eq(d.basic.name, '赵六');
  eq(d.basic.phone, '13712345678');
  eq(d.education[0].school, '中山大学');
  eq(d.education[0].major, '软件工程');
});

test('parse 无时间段的经历按标题行切分', () => {
  const text = [
    '王小明',
    '工作经历',
    '网易游戏',
    '游戏客户端开发',
    '负责 Unity 客户端逻辑开发',
    '优化渲染性能 30%',
    '腾讯',
    '后端开发',
    '负责支付系统'
  ].join('\n');
  const w = P().parse(text).data.work;
  eq(w.length, 2);
  eq(w[0].company, '网易游戏');
  eq(w[0].position, '游戏客户端开发');
  eq(w[1].company, '腾讯');
  ok(w[1].description.indexOf('负责支付系统') === 0);
});

test('parse 制表符分隔的键值信息', () => {
  const text = [
    '孙悦\t女\t26岁',
    '电话\t13600005555',
    '邮箱\tsun@test.com',
    '现居\t成都',
    '工作经验\t4年',
    '求职意向\t新媒体运营'
  ].join('\n');
  const b = P().parse(text).data.basic;
  eq(b.name, '孙悦');
  eq(b.phone, '13600005555');
  eq(b.email, 'sun@test.com');
  eq(b.location, '成都');
  eq(b.years, '4 年');
  eq(b.target, '新媒体运营');
});

test('parse 无分节标题时降级为个人简介并给出提示', () => {
  const r = P().parse('本人有三年前端开发经验，熟悉 Vue 与 React，参与过多个中台项目。');
  ok(r.data.profile.length > 0);
  ok(r.warnings.length >= 1);
});

test('parse 空输入不报错', () => {
  const r = P().parse('');
  eq(r.stats.total, 0);
  eq(r.data.work.length, 0);
  eq(r.data.honors.items.length, 0);
});

test('parse 技能修饰语剥离（熟练使用 / 精通）', () => {
  const d = P().parse('技能\n熟练使用 Axure、SQL\n精通 Python').data;
  eq(d.skills[0].items, 'Axure\nSQL\nPython');
});

test('parse 荣誉年份：括号、年份前缀与「年度」', () => {
  const d = P().parse('荣誉证书\n国家奖学金（2022）\n2019 年度优秀员工\n优秀共产党员（2020）').data;
  eq(d.honors.items.length, 3);
  eq(d.honors.items[0].year, '2022');
  eq(d.honors.items[1].title, '年度优秀员工');
  eq(d.honors.items[1].year, '2019');
  eq(d.honors.items[2].year, '2020');
});

test('parse 语言/兴趣行进入附加信息', () => {
  const d = P().parse('荣誉证书\n国家奖学金\n英语：CET-6，可日常交流\n兴趣爱好：摄影、徒步').data;
  eq(d.honors.items.length, 1);
  ok(d.honors.extra.indexOf('CET-6') >= 0);
  ok(d.honors.extra.indexOf('摄影') >= 0);
});

test('parse 硬换行段落自动接合（PDF 复制场景）', () => {
  const long1 = '负责到店业务订单系统的服务端开发与维护工作，主导订单查询接口的性能优化项目，通过引入';
  const long2 = '缓存与索引优化将平均响应时间从 800ms 降低到 200ms，同时支撑了日均千万级订单的稳定运行。';
  const text = ['陈晨', '工作经历', '美团点评  后端开发工程师  2020.07 - 2023.10', long1, long2].join('\n');
  const w = P().parse(text).data.work[0];
  eq(w.description, long1 + long2);
});

runAll();
