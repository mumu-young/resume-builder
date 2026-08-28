'use strict';
const { test, runAll } = require('../lib/suite');
const { ok } = require('../lib/assert');
const { loadScripts } = require('../lib/load-js');

function sampleResume(){
  return {
    id: 'r1', title: '张三的简历', templateId: 'bizblue',
    sectionOrder: ['education', 'work', 'projects', 'skills', 'honors'],
    sectionTitles: { education: '教育经历', work: '实习 / 工作经历', projects: '项目经验', skills: '专业技能', honors: '荣誉证书', extra: '其他信息' },
    style: { titleColor: '#2F5496', lineColor: '#c3ccd6', lineWidth: 2, showLines: true, pagePadding: { top: 10, right: 12, bottom: 10, left: 12 } },
    data: {
      basic: { name: '张三', target: '前端开发工程师', phone: '13800000000', email: 'a@b.com', location: '北京', age: '25', years: '3 年', summary: '3 年前端经验', contactSeparator: '|', targetLabel: true, showLabels: { age: true, phone: true, email: true, location: true, years: true } },
      education: [{ school: '复旦大学', major: '计算机', start: '2018-09', end: '2022-06', courses: '数据结构', description: '参与竞赛' }],
      work: [{ company: '字节跳动', position: '前端开发', start: '2022-07', end: '至今', description: '负责中台开发' }],
      projects: [{ name: '中台系统', role: '负责人', tech: 'Vue', link: '', start: '2023-01', end: '2023-06', description: '从0搭建' }],
      skills: [{ category: '编程语言', items: 'JavaScript\nTypeScript' }],
      honors: { items: [{ title: '奖学金', year: '2022', description: '' }], extra: '英语 CET-6' }
    }
  };
}

function build(){
  const g = { TextEncoder, TextDecoder, console };
  return loadScripts(g, ['js/utils.js', 'js/templates.js', 'js/docx.js']);
}

test('buildDocxBytes 生成合法 ZIP（PK 头 + 必需部件）', () => {
  const ctx = build();
  const bytes = ctx.buildDocxBytes(sampleResume());
  ok(ArrayBuffer.isView(bytes), '应返回类数组视图');
  ok(bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04, '应为 ZIP（PK 头）');
  const text = new TextDecoder().decode(bytes);
  ok(text.indexOf('[Content_Types].xml') >= 0, '缺少 [Content_Types].xml');
  ok(text.indexOf('_rels/.rels') >= 0, '缺少 _rels/.rels');
  ok(text.indexOf('word/document.xml') >= 0, '缺少 word/document.xml');
});

test('docx 内容包含姓名/分节/学校/公司/A4 与边距', () => {
  const ctx = build();
  const text = new TextDecoder().decode(ctx.buildDocxBytes(sampleResume()));
  ok(text.indexOf('张三') >= 0, '缺少姓名');
  ok(text.indexOf('前端开发工程师') >= 0, '缺少求职意向');
  ok(text.indexOf('教育经历') >= 0, '缺少教育经历标题');
  ok(text.indexOf('复旦大学') >= 0, '缺少学校');
  ok(text.indexOf('字节跳动') >= 0, '缺少公司');
  ok(text.indexOf('中台系统') >= 0, '缺少项目');
  ok(text.indexOf('JavaScript') >= 0, '缺少技能');
  ok(text.indexOf('w:pgSz w:w="11906" w:h="16838"') >= 0, '缺少 A4 页面');
  ok(text.indexOf('w:pgMar w:top="567" w:right="680" w:bottom="567" w:left="680"') >= 0, '边距换算错误');
});

function parseCentralDir(bytes){
  const eocd = bytes.subarray(bytes.length - 22);
  const dv = new DataView(eocd.buffer, eocd.byteOffset, 22);
  const count = dv.getUint16(10, true);
  const cdOffset = dv.getUint32(16, true);
  const entries = [];
  let off = cdOffset;
  for (let i = 0; i < count; i++){
    const cd = bytes.subarray(off, off + 46);
    const c = new DataView(cd.buffer, cd.byteOffset, 46);
    const sig = c.getUint32(0, true);
    const comp = c.getUint32(20, true);
    const uncomp = c.getUint32(24, true);
    const nameLen = c.getUint16(28, true);
    const extra = c.getUint16(30, true);
    const comment = c.getUint16(32, true);
    const name = new TextDecoder().decode(bytes.subarray(off + 46, off + 46 + nameLen));
    entries.push({ sig, comp, uncomp, name });
    off += 46 + nameLen + extra + comment;
  }
  return entries;
}

test('ZIP 中央目录可被正确解析（文件名/大小）', () => {
  const ctx = build();
  const bytes = ctx.buildDocxBytes(sampleResume());
  const entries = parseCentralDir(bytes);
  ok(entries.length === 3, '应有 3 个条目: ' + entries.length);
  const names = entries.map(e => e.name);
  ok(names[0] === '[Content_Types].xml' && names[1] === '_rels/.rels' && names[2] === 'word/document.xml', '文件名错误: ' + JSON.stringify(names));
  for (const e of entries){
    ok(e.sig === 0x02014b50, '中央目录签名错误');
    ok(e.comp === e.uncomp && e.uncomp > 0, 'store 方式压缩大小应等于原始大小且非零');
  }
});

function docxText(templateId){
  const r = sampleResume();
  r.templateId = templateId;
  const ctx = build();
  return new TextDecoder().decode(ctx.buildDocxBytes(r));
}

test('docx 跟随模板：开放两栏生成两栏表格且左侧着色', () => {
  const text = docxText('open');
  ok(text.indexOf('<w:tbl>') >= 0, '开放两栏应生成表格');
  ok(text.indexOf('w:fill="2F5496"') >= 0, '左栏应使用标题色底');
});
test('docx 跟随模板：标题背景色/浅色/单栏标题样式', () => {
  const tbg = docxText('titlebg');
  ok(tbg.indexOf('w:fill="2F5496"') >= 0, '标题背景色应实色底');
  const tbgLight = docxText('titlebglight');
  ok(/w:fill="[0-9A-Fa-f]{6}"/.test(tbgLight), '标题背景浅色应有浅色底');
  ok(tbgLight.indexOf('w:left w:val="single"') >= 0, '标题背景浅色应有左侧竖条');
  const clean = docxText('clean');
  ok(clean.indexOf('w:bottom w:val="single"') >= 0, '单栏标题应有下划线');
});


test('docx 嵌入照片（media 部件 + 关系 + drawing）', () => {
  const r = sampleResume();
  r.data.basic.photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const ctx = build();
  const text = new TextDecoder().decode(ctx.buildDocxBytes(r));
  ok(text.indexOf('word/media/image1.png') >= 0, '缺少 media 部件');
  ok(text.indexOf('word/_rels/document.xml.rels') >= 0, '缺少图片关系');
  ok(text.indexOf('<w:drawing>') >= 0, '缺少 drawing');
  ok(text.indexOf('r:embed="rIdImg1"') >= 0, '缺少图片引用');
  ok(text.indexOf('Extension="png" ContentType="image/png"') >= 0, '缺少 png 默认类型');
});

runAll();
