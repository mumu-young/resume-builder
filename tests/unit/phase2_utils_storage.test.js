'use strict';
const { test, runAll } = require('../lib/suite');
const { eq, matches } = require('../lib/assert');
const { loadScripts } = require('../lib/load-js');
const { createIndexedDBMock } = require('../lib/idb-mock');

/* ---------- utils ---------- */
test('esc 转义 HTML 特殊字符', () => {
  const ctx = loadScripts({}, ['js/utils.js']);
  eq(ctx.esc('<b>"x" & \'y\'</b>'), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
});
test('textStats 统计中英文与空格', () => {
  const ctx = loadScripts({}, ['js/utils.js']);
  const st = ctx.textStats('你好 world 123\n 中文abc');
  eq(st.chinese, 4);
  eq(st.words, 3);
  eq(st.total, 7);
  eq(st.noSpace, 15);
});
test('debounce 合并多次调用为一次', async () => {
  const ctx = loadScripts({ setTimeout, clearTimeout }, ['js/utils.js']);
  let count = 0;
  const fn = ctx.debounce(function(){ count++; }, 30);
  fn(); fn(); fn();
  await new Promise(r => setTimeout(r, 90));
  eq(count, 1, 'debounce 应只执行一次');
});
test('uid 唯一且格式正确', () => {
  const ctx = loadScripts({}, ['js/utils.js']);
  const set = new Set();
  for (let i = 0; i < 200; i++) set.add(ctx.uid());
  eq(set.size, 200, 'uid 应唯一');
  matches(ctx.uid(), /^id_/);
});
test('dateLabel 与 fileTimestamp 格式', () => {
  const ctx = loadScripts({}, ['js/utils.js']);
  eq(ctx.dateLabel('2024-06'), '2024.06');
  eq(ctx.dateLabel(''), '');
  matches(ctx.fileTimestamp(new Date(2024, 0, 2, 3, 4)), /^20240102_0304$/);
});

/* ---------- storage: localStorage 兜底模式 ---------- */
function makeLocalStorage(){
  const store = new Map();
  return {
    getItem(k){ return store.has(k) ? store.get(k) : null; },
    setItem(k, v){ store.set(k, String(v)); },
    removeItem(k){ store.delete(k); },
    clear(){ store.clear(); }
  };
}
async function storageWithLocal(){
  const g = { localStorage: makeLocalStorage(), console, setTimeout, clearTimeout };
  g.window = g;
  const ctx = loadScripts(g, ['js/utils.js', 'js/storage.js']);
  await ctx.Storage.init();
  return ctx;
}
test('storage localStorage 模式：增删查与设置', async () => {
  const ctx = await storageWithLocal();
  eq(ctx.Storage.mode(), 'local');
  const r = { id: 'r1', title: '测试', templateId: 'clean', data: { basic: { name: '张三' } } };
  await ctx.Storage.saveResume(r);
  let list = await ctx.Storage.loadResumes();
  eq(list.length, 1);
  eq(list[0].title, '测试');
  await ctx.Storage.saveSettings({ theme: 'dark' });
  eq((await ctx.Storage.loadSettings()).theme, 'dark');
  await ctx.Storage.deleteResume('r1');
  eq((await ctx.Storage.loadResumes()).length, 0);
});
test('storage localStorage 模式：同 id 覆盖、批量保存、清空', async () => {
  const ctx = await storageWithLocal();
  await ctx.Storage.saveResume({ id: 'a', v: 1 });
  await ctx.Storage.saveResume({ id: 'a', v: 2 });
  let list = await ctx.Storage.loadResumes();
  eq(list.length, 1, '同 id 应覆盖');
  eq(list[0].v, 2);
  await ctx.Storage.saveResumes([{ id: 'x' }, { id: 'y' }]);
  eq((await ctx.Storage.loadResumes()).length, 2, '批量保存应替换整份列表');
  await ctx.Storage.clearAll();
  eq((await ctx.Storage.loadResumes()).length, 0);
  eq(await ctx.Storage.loadSettings(), null);
});

/* ---------- storage: IndexedDB 模式 ---------- */
async function storageWithIdb(){
  const g = { localStorage: makeLocalStorage(), indexedDB: createIndexedDBMock(), console, setTimeout, clearTimeout };
  g.window = g;
  const ctx = loadScripts(g, ['js/utils.js', 'js/storage.js']);
  await ctx.Storage.init();
  return ctx;
}
test('storage IndexedDB 模式：增删查与设置', async () => {
  const ctx = await storageWithIdb();
  eq(ctx.Storage.mode(), 'idb');
  const r = { id: 'r2', title: 'IDB测试', templateId: 'classic', data: { basic: { name: '李四' } } };
  await ctx.Storage.saveResume(r);
  let list = await ctx.Storage.loadResumes();
  eq(list.length, 1);
  eq(list[0].templateId, 'classic');
  await ctx.Storage.saveSettings({ fontSize: 16 });
  eq((await ctx.Storage.loadSettings()).fontSize, 16);
  await ctx.Storage.deleteResume('r2');
  eq((await ctx.Storage.loadResumes()).length, 0);
});
test('storage IndexedDB 模式：同 id 覆盖、批量保存、清空', async () => {
  const ctx = await storageWithIdb();
  await ctx.Storage.saveResume({ id: 'a', v: 1 });
  await ctx.Storage.saveResume({ id: 'a', v: 2 });
  let list = await ctx.Storage.loadResumes();
  eq(list.length, 1);
  eq(list[0].v, 2);
  await ctx.Storage.saveResumes([{ id: 'x' }, { id: 'y' }]);
  eq((await ctx.Storage.loadResumes()).length, 2, '批量保存应替换整份列表');
  await ctx.Storage.clearAll();
  eq((await ctx.Storage.loadResumes()).length, 0);
});

runAll();