'use strict';
const path = require('path');
const { launchBrowser } = require('../lib/browser');
const { test, runAll } = require('../lib/suite');

(async () => {
  const b = await launchBrowser();
  const INDEX = b.fileUrl(path.join(__dirname, '..', '..', '简历工坊.html'));
  const ev = (expr, ap) => b.cdp.eval(expr, ap);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const q = s => JSON.stringify(s);
  async function setInput(sel, val){
    const ok = await ev(`(()=>{ const el=document.querySelector(${q(sel)}); if(!el) throw new Error('元素不存在: '+${q(sel)}); el.value=${q(val)}; el.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    if (!ok) throw new Error('setInput 失败: ' + sel);
  }
  async function click(sel){
    const ok = await ev(`(()=>{ const el=document.querySelector(${q(sel)}); if(!el) throw new Error('元素不存在: '+${q(sel)}); el.click(); return true; })()`);
    if (!ok) throw new Error('click 失败: ' + sel);
  }
  async function goModule(id){
    await click('[data-action="set-module"][data-id="' + id + '"]');
    await sleep(30);
  }
  async function focusin(sel){
    await ev(`(()=>{ const el=document.querySelector(${q(sel)}); if(!el) throw new Error('元素不存在: '+${q(sel)}); el.dispatchEvent(new Event('focusin',{bubbles:true})); return true; })()`);
  }

  try {
    await b.cdp.navigate(INDEX);
    await b.cdp.waitFor('window.__APP__ && window.__APP__.state.ready === true');
    // 干净的初始状态
    await ev('__APP__.resetAllData()', true);
    await sleep(150);

    test('T1 启动：1 份默认简历、13 个导航、基础信息模块激活', async () => {
      const v = await ev(`(() => ({
        ready: __APP__.state.ready,
        count: __APP__.state.resumes.length,
        title: __APP__.state.resumes[0].title,
        module: __APP__.state.module,
        nav: document.querySelectorAll('#module-nav .nav-item').length,
        loadingHidden: document.getElementById('loading').classList.contains('hidden'),
        appVisible: !document.getElementById('app').classList.contains('hidden'),
        hasNameInput: !!document.querySelector('input[data-path="basic.name"]')
      }))()`);
      if (!v.ready) throw new Error('未就绪');
      if (v.count !== 1) throw new Error('默认简历数量应为 1，实际 ' + v.count);
      if (v.title !== '我的第一份简历') throw new Error('默认标题错误: ' + v.title);
      if (v.module !== 'basic') throw new Error('默认模块应为 basic');
      if (v.nav !== 13) throw new Error('导航应为 13 项，实际 ' + v.nav);
      if (!v.loadingHidden || !v.appVisible) throw new Error('加载遮罩/主容器可见性错误');
      if (!v.hasNameInput) throw new Error('基础信息输入框缺失');
    });

    test('T2 基础信息输入实时反映到预览', async () => {
      await goModule('basic');
      await setInput('input[data-path="basic.name"]', '张三');
      await setInput('input[data-path="basic.target"]', '前端开发工程师');
      await setInput('textarea[data-path="basic.summary"]', '2 年经验，擅长 Vue');
      await sleep(300);
      const html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('张三') < 0) throw new Error('预览缺少姓名');
      if (html.indexOf('前端开发工程师') < 0) throw new Error('预览缺少求职意向');
      if (html.indexOf('2 年经验') < 0) throw new Error('预览缺少简介');
    });

    test('T3 教育经历：添加、填写、排序、删除', async () => {
      await goModule('education');
      await click('[data-action="add-entry"][data-type="education"]');
      await setInput('input[data-path="education.0.school"]', '复旦大学');
      await click('[data-action="add-entry"][data-type="education"]');
      await setInput('input[data-path="education.1.school"]', '另一所大学');
      await sleep(300);
      let cnt = await ev('document.querySelectorAll(".entry-card").length');
      if (cnt !== 2) throw new Error('教育经历卡片数应为 2，实际 ' + cnt);
      let html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('复旦大学') < 0) throw new Error('预览缺少第一条学校');
      if (html.indexOf('另一所大学') < 0) throw new Error('预览缺少第二条学校');
      await click('[data-action="move-entry"][data-type="education"][data-idx="1"][data-dir="-1"]');
      const order = await ev(`__APP__.data().education.map(function(e){ return e.school; })`);
      if (order[0] !== '另一所大学' || order[1] !== '复旦大学') throw new Error('上移后顺序错误: ' + JSON.stringify(order));
      await click('[data-action="del-entry"][data-type="education"][data-idx="0"]');
      const left = await ev('__APP__.data().education.length');
      if (left !== 1) throw new Error('删除后应剩 1 条，实际 ' + left);
      const school = await ev('__APP__.data().education[0].school');
      if (school !== '复旦大学') throw new Error('删除后保留的应是复旦大学，实际 ' + school);
    });

    test('T4 工作经历：填写 + 插入 STAR 模板 + focusin 记录活动条目', async () => {
      await goModule('work');
      await click('[data-action="add-entry"][data-type="work"]');
      await setInput('input[data-path="work.0.company"]', '某科技公司');
      await setInput('input[data-path="work.0.position"]', '前端实习生');
      await click('[data-action="insert-star"][data-type="work"][data-idx="0"]');
      let desc = await ev('__APP__.data().work[0].description');
      if (desc.indexOf('情境：') < 0 || desc.indexOf('结果：') < 0) throw new Error('STAR 模板未插入');
      await focusin('textarea[data-path="work.0.description"]');
      const active = await ev('JSON.stringify(__APP__.state.activeEntry)');
      if (active.indexOf('"type":"work"') < 0 || active.indexOf('"idx":0') < 0) throw new Error('focusin 未记录活动条目: ' + active);
    });

    test('T5 STAR 写作助手：生成 → 插入到当前经历', async () => {
      await goModule('tools');
      await setInput('#star-s', '平台日活增长，旧接口响应慢');
      await setInput('#star-t', '将接口响应时间降低 50%');
      await setInput('#star-a', '引入缓存并优化 SQL');
      await setInput('#star-r', '响应从 800ms 降到 200ms');
      await click('[data-action="star-gen"]');
      const out = await ev('document.getElementById("star-out").value');
      if (out.indexOf('情境：平台日活增长') < 0 || out.indexOf('结果：响应从 800ms 降到 200ms') < 0) throw new Error('STAR 生成内容错误: ' + out);
      await click('[data-action="star-insert"]');
      const desc = await ev('__APP__.data().work[0].description');
      if (desc.indexOf('响应从 800ms 降到 200ms') < 0) throw new Error('STAR 内容未插入到工作经历');
    });

    test('T6 专业技能与荣誉证书：填写并预览', async () => {
      await goModule('skills');
      await click('[data-action="add-entry"][data-type="skills"]');
      await setInput('input[data-path="skills.0.category"]', '编程语言');
      await setInput('textarea[data-path="skills.0.items"]', 'JavaScript\nTypeScript');
      await goModule('honors');
      await click('[data-action="add-entry"][data-type="honor"]');
      await setInput('input[data-path="honors.items.0.title"]', '国家奖学金');
      await setInput('input[data-path="honors.items.0.year"]', '2022');
      await setInput('textarea[data-path="honors.extra"]', '英语：CET-6');
      await sleep(300);
      const html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('JavaScript、TypeScript') < 0) throw new Error('预览缺少技能');
      if (html.indexOf('国家奖学金') < 0) throw new Error('预览缺少荣誉');
      if (html.indexOf('CET-6') < 0) throw new Error('预览缺少附加信息');
    });

    test('T7 模板中心：切换到经典两栏并实时生效', async () => {
      await goModule('templates');
      const cards = await ev('document.querySelectorAll(".tpl-card").length');
      if (cards !== 9) throw new Error('模板卡片应为 9 个，实际 ' + cards);
      await click('[data-action="apply-template"][data-id="classic"]');
      const tpl = await ev('__APP__.getCurrent().templateId');
      if (tpl !== 'classic') throw new Error('模板未切换: ' + tpl);
      const html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('tpl-classic') < 0) throw new Error('预览未应用 classic 模板');
      const sel = await ev('document.querySelector("[data-action=\\"apply-template\\"][data-id=\\"classic\\"]").classList.contains("selected")');
      if (!sel) throw new Error('模板卡片未标记 selected');
    });

    test('T8 多简历管理：新建/复制/重命名/切换/删除', async () => {
      await click('#btn-new');
      let count = await ev('__APP__.state.resumes.length');
      if (count !== 2) throw new Error('新建后应为 2 份，实际 ' + count);
      await click('#btn-dup');
      count = await ev('__APP__.state.resumes.length');
      if (count !== 3) throw new Error('复制后应为 3 份，实际 ' + count);
      await ev('__APP__.renameResume("秋招简历")');
      const title = await ev('__APP__.getCurrent().title');
      if (title !== '秋招简历') throw new Error('重命名失败: ' + title);
      const ids = await ev('__APP__.state.resumes.map(function(r){ return r.id; })');
      await ev('__APP__.selectResume("' + ids[0] + '")');
      const curId = await ev('__APP__.state.currentId');
      if (curId !== ids[0]) throw new Error('切换失败');
      await ev('__APP__.selectResume("' + ids[2] + '")');
      await ev('__APP__.deleteResume(true)');
      count = await ev('__APP__.state.resumes.length');
      if (count !== 2) throw new Error('删除后应为 2 份，实际 ' + count);
      await ev('__APP__.selectResume("' + ids[1] + '")');
      await ev('__APP__.deleteResume(true)');
      count = await ev('__APP__.state.resumes.length');
      if (count !== 1) throw new Error('删除多余后应为 1 份，实际 ' + count);
      await ev('__APP__.selectResume("' + ids[0] + '")');
      const backTitle = await ev('__APP__.getCurrent().title');
      if (backTitle !== '我的第一份简历') throw new Error('应回到原简历，实际 ' + backTitle);
    });

    test('T9 持久化：保存后刷新页面数据不丢失', async () => {
      await ev('__APP__.flushSave()', true);
      await ev('__APP__.Storage.saveSettings(__APP__.state.settings)', true);
      await sleep(200);
      await b.cdp.navigate(INDEX);
      await b.cdp.waitFor('window.__APP__ && window.__APP__.state.ready === true');
      const v = await ev(`(() => ({
        count: __APP__.state.resumes.length,
        name: __APP__.data().basic.name,
        target: __APP__.data().basic.target,
        tpl: __APP__.getCurrent().templateId,
        edu: __APP__.data().education.length,
        work: __APP__.data().work.length,
        skills: __APP__.data().skills.length,
        honor: __APP__.data().honors.items.length
      }))()`);
      if (v.count !== 1) throw new Error('刷新后简历数量错误: ' + v.count);
      if (v.name !== '张三') throw new Error('刷新后姓名丢失: ' + v.name);
      if (v.target !== '前端开发工程师') throw new Error('刷新后求职意向丢失');
      if (v.tpl !== 'classic') throw new Error('刷新后模板丢失: ' + v.tpl);
      if (v.edu !== 1 || v.work !== 1 || v.skills !== 1 || v.honor !== 1) throw new Error('刷新后各模块数据丢失');
    });    test('T10 自动保存防抖：输入后无需手动保存也会落盘', async () => {
      await goModule('basic');
      await setInput('input[data-path="basic.name"]', '自动保存测试');
      await sleep(950);
      const name = await ev(`__APP__.Storage.loadResumes().then(function(list){
        var r = list.find(function(x){ return x.id === __APP__.state.currentId; });
        return r ? r.data.basic.name : null;
      })`, true);
      if (name !== '自动保存测试') throw new Error('防抖自动保存未生效: ' + name);
      await setInput('input[data-path="basic.name"]', '张三');
      await sleep(700);
    });

    test('T11 字数统计：顶部徽标与工具面板一致', async () => {
      const stats = await ev('__APP__.resumeStats()');
      if (!(stats.total > 0)) throw new Error('总字数应为正数');
      const badge = await ev('document.getElementById("wc-badge").textContent');
      if (badge !== '约 ' + stats.total + ' 字') throw new Error('顶部徽标不一致: ' + badge + ' vs ' + stats.total);
      await goModule('tools');
      const panelTotal = await ev('parseInt(document.querySelector("#word-panel .wc-total").textContent, 10)');
      if (panelTotal !== stats.total) throw new Error('工具面板总字数不一致: ' + panelTotal + ' vs ' + stats.total);
    });

    test('T12 备份内容与导入合并（新增 + 覆盖）', async () => {
      const payload = await ev('__APP__.buildBackupPayload()');
      if (!Array.isArray(payload.resumes) || payload.resumes.length < 1) throw new Error('备份缺少简历');
      if (payload.app !== 'resume-workshop') throw new Error('备份标识错误');
      if (!payload.settings || typeof payload.settings !== 'object') throw new Error('备份缺少设置');
      const res = await ev(`__APP__.importPayload({
        app: 'resume-workshop', version: 1,
        settings: { theme: 'dark' },
        resumes: [
          { id: 'import-new-1', title: '导入的简历', templateId: 'clean', data: { basic: { name: '王五' } } },
          { id: ${JSON.stringify(payload.resumes[0].id)}, title: '覆盖标题', templateId: 'modern', data: { basic: { name: '张三' } } }
        ]
      })`, true);
      if (res.imported !== 1 || res.replaced !== 1) throw new Error('导入合并计数错误: ' + JSON.stringify(res));
      const cnt = await ev('__APP__.state.resumes.length');
      if (cnt !== 2) throw new Error('导入后应为 2 份，实际 ' + cnt);
      const imported = await ev('__APP__.state.resumes.find(function(r){ return r.id === "import-new-1"; })');
      if (!imported || imported.data.basic.name !== '王五') throw new Error('导入的新简历数据错误');
      const covered = await ev('__APP__.state.resumes.find(function(r){ return r.id === ' + JSON.stringify(payload.resumes[0].id) + '; })');
      if (covered.title !== '覆盖标题' || covered.templateId !== 'modern') throw new Error('导入未覆盖同 id 简历');
      await ev('__APP__.deleteResume(true)');
      await ev('__APP__.deleteResume(true)');
    });

    test('T13 清空所有数据：回到 1 份空白简历并重置设置', async () => {
      await ev('__APP__.resetAllData()', true);
      const v = await ev(`(() => ({
        count: __APP__.state.resumes.length,
        title: __APP__.getCurrent().title,
        theme: __APP__.state.settings.theme,
        edu: __APP__.data().education.length
      }))()`);
      if (v.count !== 1 || v.title !== '我的第一份简历') throw new Error('重置后简历状态错误');
      if (v.theme !== 'light') throw new Error('重置后主题应为 light');
      if (v.edu !== 0) throw new Error('重置后教育经历应清空');
    });

    test('T14 全局设置：主题、字号、默认模板即时生效', async () => {
      await ev('__APP__.setSettings("theme", "dark")');
      let dark = await ev('document.body.classList.contains("dark")');
      if (!dark) throw new Error('深色主题未生效');
      await ev('__APP__.setSettings("fontSize", 16)');
      await sleep(200);
      let fs = await ev('document.getElementById("resume-page").style.getPropertyValue("--tpl-fs")');
      if (fs !== '16px') throw new Error('字号未生效: ' + fs);
      await ev('__APP__.setSettings("defaultTemplate", "modern")');
      await ev('__APP__.newResume()');
      const tpl = await ev('__APP__.getCurrent().templateId');
      if (tpl !== 'modern') throw new Error('新简历未使用默认模板: ' + tpl);
      await ev('__APP__.deleteResume(true)');
      await ev('__APP__.setSettings("theme", "light")');
      await ev('__APP__.setSettings("fontSize", 14)');
      await sleep(200);
    });

    test('T15 照片：预览渲染 img，移除后清空', async () => {
      await goModule('basic');
      const dataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      await ev(`__APP__.setByPath('basic.photo', ${JSON.stringify(dataUrl)}); __APP__.afterChange(); __APP__.renderModule(); __APP__.renderPreview(); true`);
      let html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('<img src="data:image/gif;base64,') < 0) throw new Error('预览未渲染照片');
      await click('[data-action="photo-remove"]');
      const photo = await ev('__APP__.data().basic.photo');
      if (photo !== '') throw new Error('移除照片后未清空');
    });

    test('T16 预览开关：隐藏与恢复', async () => {
      await click('#btn-toggle-preview');
      let disp = await ev('document.getElementById("preview-pane").style.display');
      if (disp !== 'none') throw new Error('隐藏预览失败: ' + disp);
      await click('#btn-toggle-preview');
      disp = await ev('document.getElementById("preview-pane").style.display');
      if (disp !== '') throw new Error('恢复预览失败: ' + disp);
    });

    test('T17 13 个模块均可切换且编辑器有内容', async () => {
      const ids = ['basic','education','work','projects','skills','honors','sections','templates','margins','export','data','tools','settings'];
      for (const id of ids){
        await goModule(id);
        const v = await ev('__APP__.state.module === "' + id + '" && document.getElementById("editor").innerHTML.length > 50');
        if (!v) throw new Error('模块切换异常: ' + id);
      }
    });

    await runAll();
  } finally {
    await b.close();
  }
})().catch(e => { console.error('E2E 运行失败: ' + e.message); process.exit(1); });