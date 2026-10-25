'use strict';
const fs = require('fs');
const path = require('path');
const { test, runAll } = require('../lib/suite');
const { ok, eq, matches } = require('../lib/assert');
const { ROOT } = require('../lib/load-js');

const indexHtml = fs.readFileSync(path.join(ROOT, '简历工坊.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');

test('简历工坊.html 包含全部必需元素 id', () => {
  const ids = ['loading','app','resume-title','resume-select','wc-badge','save-status','btn-new','btn-dup','btn-rename','btn-del','btn-toggle-preview','btn-print','btn-settings','module-nav','editor','preview-pane','preview-scroll','resume-page','import-file','photo-file','toast'];
  for (const id of ids) ok(indexHtml.includes('id="' + id + '"'), '缺少 id: ' + id);
});

test('简历工坊.html 脚本按 utils→storage→templates→docx→app 顺序加载', () => {
  const i1 = indexHtml.indexOf('js/utils.js');
  const i2 = indexHtml.indexOf('js/storage.js');
  const i3 = indexHtml.indexOf('js/templates.js');
  const i5 = indexHtml.indexOf('js/docx.js');
  const i4 = indexHtml.indexOf('js/app.js');
  ok(i1 >= 0 && i2 > i1 && i3 > i2 && i5 > i3 && i4 > i5, '脚本顺序或存在性错误');
});

test('简历工坊.html 引用两个样式表', () => {
  ok(indexHtml.includes('css/style.css') && indexHtml.includes('css/templates.css'));
});

test('style.css 包含打印媒体查询与 A4 规则', () => {
  ok(styleCss.includes('@media print'), '缺少 @media print');
  matches(styleCss, /@page\s*\{\s*size:\s*A4/i, '缺少 @page A4');
  ok(styleCss.includes('.resume-page'), '缺少 .resume-page');
  ok(styleCss.includes('.preview-pane'), '缺少 .preview-pane');
  ok(styleCss.includes('display:block !important'), '打印时预览区未强制显示');
});

test('style.css 包含浅色/深色主题变量', () => {
  ok(styleCss.includes(':root'), '缺少 :root 变量');
  ok(styleCss.includes('body.dark'), '缺少 body.dark');
  matches(styleCss, /--bg:\s*#eef1f6/i, '浅色主题变量缺失');
  matches(styleCss, /--bg:\s*#0f172a/i, '深色主题变量缺失');
});

test('简历工坊.html 含加粗工具栏，打印时隐藏', () => {
  ok(indexHtml.includes('id="rich-toolbar"'), '缺少加粗工具栏');
  ok(indexHtml.includes('data-action="rich-bold"') && indexHtml.includes('data-action="rich-unbold"'), '缺少加粗/取消加粗按钮');
  ok(styleCss.includes('.rich-toolbar'), '缺少工具栏样式');
  matches(styleCss, /@media print[\s\S]*?\.rich-toolbar\s*\{\s*display\s*:\s*none/i, '打印时未隐藏工具栏');
});
test('应用内弹窗结构存在，且不再使用原生 prompt/confirm', () => {
  ok(indexHtml.includes('id="modal-mask"'), '缺少应用内弹窗');
  ok(indexHtml.includes('id="modal-input"'), '缺少弹窗输入框');
  ok(indexHtml.includes('data-action="modal-ok"') && indexHtml.includes('data-action="modal-cancel"'), '缺少弹窗按钮');
  ok(!/\bprompt\s*\(/.test(appJs), 'app.js 仍在使用 prompt()（Electron 不支持）');
  ok(!/\bconfirm\s*\(/.test(appJs), 'app.js 仍在使用 confirm()（与桌面版交互冲突）');
  ok(appJs.includes('exportPdf') && appJs.includes('desktopAPI'), '缺少桌面版 PDF 导出通道');
});
runAll();