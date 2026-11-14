'use strict';
const path = require('path');
const { launchBrowser } = require('../lib/browser');
const { test, runAll } = require('../lib/suite');

const SAMPLE = [
  '张伟',
  '男 | 25岁 | 13800001234 | zhangwei@example.com | 深圳',
  '求职意向：前端开发工程师',
  '',
  '教育经历',
  '复旦大学  计算机科学与技术  本科  2018.09 - 2022.06',
  'GPA 3.8/4.0',
  '',
  '工作经历',
  '字节跳动  高级前端工程师  2021.07 - 2024.12',
  '· 负责中台系统前端架构设计与开发',
  '',
  '专业技能',
  '编程语言：JavaScript、TypeScript'
].join('\n');

(async () => {
  const b = await launchBrowser();
  const INDEX = b.fileUrl(path.join(__dirname, '..', '..', '简历工坊.html'));
  const ev = (expr, ap) => b.cdp.eval(expr, ap);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const q = s => JSON.stringify(s);
  async function click(sel){
    const ok = await ev(`(()=>{ const el=document.querySelector(${q(sel)}); if(!el) throw new Error('元素不存在: '+${q(sel)}); el.click(); return true; })()`);
    if (!ok) throw new Error('click 失败: ' + sel);
  }
  async function goModule(id){
    await click('[data-action="set-module"][data-id="' + id + '"]');
    await sleep(40);
  }
  async function paste(text){
    const ok = await ev(`(()=>{ const el=document.querySelector('#smart-input'); if(!el) throw new Error('缺少粘贴框'); el.value=${q(text)}; el.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    if (!ok) throw new Error('粘贴失败');
  }

  try {
    await b.cdp.navigate(INDEX);
    await b.cdp.waitFor('window.__APP__ && window.__APP__.state.ready === true');
    await ev('__APP__.resetAllData()', true);
    await sleep(150);

    test('S1 智能导入模块存在且可粘贴文字', async () => {
      await goModule('smart');
      const v = await ev(`(()=>({
        hasInput: !!document.querySelector('#smart-input'),
        hasParseBtn: !!document.querySelector('[data-action="smart-parse"]'),
        count: document.querySelector('#smart-count').textContent
      }))()`);
      if (!v.hasInput) throw new Error('缺少粘贴输入框');
      if (!v.hasParseBtn) throw new Error('缺少解析按钮');
      if (v.count.indexOf('0 字') < 0) throw new Error('字数显示异常: ' + v.count);
      await paste(SAMPLE);
      const cnt = await ev('document.getElementById("smart-count").textContent');
      if (!/[1-9]\d* 字/.test(cnt)) throw new Error('粘贴后字数未更新: ' + cnt);
      const txt = await ev('__APP__.state.smart.text.length');
      if (!txt) throw new Error('粘贴内容未写入状态');
    });

    test('S2 解析后展示核对面板与识别统计', async () => {
      await click('[data-action="smart-parse"]');
      await sleep(120);
      const v = await ev(`(()=>({
        secs: document.querySelectorAll('.smart-sec').length,
        total: document.querySelector('.smart-total') ? document.querySelector('.smart-total').textContent : '',
        name: __APP__.state.smart.result.data.basic.name,
        edu: __APP__.state.smart.result.data.education.length,
        work: __APP__.state.smart.result.data.work.length
      }))()`);
      if (v.secs < 3) throw new Error('核对面板分节过少: ' + v.secs);
      if (v.total.indexOf('共') < 0) throw new Error('缺少识别总数: ' + v.total);
      if (v.name !== '张伟') throw new Error('解析姓名错误: ' + v.name);
      if (v.edu !== 1 || v.work !== 1) throw new Error('解析条目数量错误');
    });

    test('S3 一键填入新建简历：数据与预览同步', async () => {
      await click('[data-action="smart-apply"][data-kind="fill"]');
      await sleep(400);
      const v = await ev(`(()=>({
        resumes: __APP__.state.resumes.length,
        title: __APP__.getCurrent().title,
        name: __APP__.data().basic.name,
        phone: __APP__.data().basic.phone,
        target: __APP__.data().basic.target,
        edu: __APP__.data().education.length,
        work: __APP__.data().work.length,
        skill: __APP__.data().skills.length,
        ids: __APP__.data().work.every(function(w){ return !!w.id; }),
        html: document.getElementById('resume-page').innerHTML
      }))()`);
      if (v.resumes !== 2) throw new Error('应新建第 2 份简历，实际 ' + v.resumes);
      if (v.title.indexOf('张伟') < 0) throw new Error('新简历标题未包含姓名: ' + v.title);
      if (v.name !== '张伟' || v.phone !== '13800001234') throw new Error('基础信息未填入');
      if (v.target !== '前端开发工程师') throw new Error('求职意向未填入');
      if (v.edu !== 1 || v.work !== 1 || v.skill !== 1) throw new Error('分节数据未填入');
      if (!v.ids) throw new Error('条目缺少 id');
      if (v.html.indexOf('张伟') < 0 || v.html.indexOf('字节跳动') < 0) throw new Error('预览未同步');
    });

    test('S4 撤销导入：回到原简历并删除新简历', async () => {
      await goModule('smart');
      await click('[data-action="smart-undo"]');
      await sleep(300);
      const v = await ev(`(()=>({
        resumes: __APP__.state.resumes.length,
        title: __APP__.getCurrent().title,
        name: __APP__.data().basic.name,
        undo: !!__APP__.state.smart.undo
      }))()`);
      if (v.resumes !== 1) throw new Error('撤销后应剩 1 份简历，实际 ' + v.resumes);
      if (v.name) throw new Error('撤销后不应残留导入数据: ' + v.name);
      if (v.undo) throw new Error('撤销状态未清空');
    });

    test('S5 覆盖当前简历：只覆盖识别到的模块', async () => {
      await goModule('basic');
      await ev(`__APP__.setByPath('basic.years', '5 年'); __APP__.afterChange(); __APP__.renderPreview(); true`);
      await ev(`__APP__.setByPath('honors.extra', '保留我的其他信息'); __APP__.afterChange(); true`);
      await goModule('smart');
      await ev(`(()=>{ const cb=document.querySelector('[data-smart="asnew"]'); cb.checked=false; cb.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
      await click('[data-action="smart-apply"][data-kind="fill"]');
      await sleep(400);
      const v = await ev(`(()=>({
        resumes: __APP__.state.resumes.length,
        name: __APP__.data().basic.name,
        location: __APP__.data().basic.location,
        years: __APP__.data().basic.years,
        extra: __APP__.data().honors.extra,
        work: __APP__.data().work.length
      }))()`);
      if (v.resumes !== 1) throw new Error('覆盖模式不应新建简历，实际 ' + v.resumes);
      if (v.name !== '张伟') throw new Error('覆盖模式未填入姓名');
      if (v.location !== '深圳') throw new Error('识别到的城市未覆盖: ' + v.location);
      if (v.years !== '5 年') throw new Error('未识别到的字段被误覆盖: ' + v.years);
      if (v.extra !== '保留我的其他信息') throw new Error('未识别到的模块被误覆盖');
      if (v.work !== 1) throw new Error('工作经历未填入');
    });

    test('S6 覆盖模式撤销：数据完整还原', async () => {
      await goModule('smart');
      await click('[data-action="smart-undo"]');
      await sleep(300);
      const v = await ev(`(()=>({
        name: __APP__.data().basic.name,
        years: __APP__.data().basic.years,
        extra: __APP__.data().honors.extra,
        work: __APP__.data().work.length
      }))()`);
      if (v.name !== '') throw new Error('撤销后姓名应还原为空，实际 ' + v.name);
      if (v.years !== '5 年') throw new Error('撤销后工作年限应保留');
      if (v.extra !== '保留我的其他信息') throw new Error('撤销后附加信息应保留');
      if (v.work !== 0) throw new Error('撤销后工作经历应清空');
    });

    test('S7 清空与示例按钮', async () => {
      await goModule('smart');
      await click('[data-action="smart-clear"]');
      await sleep(80);
      let st = await ev(`(()=>({text: __APP__.state.smart.text, result: !!__APP__.state.smart.result}))()`);
      if (st.text !== '' || st.result) throw new Error('清空未生效');
      await click('[data-action="smart-sample"]');
      await sleep(80);
      st = await ev(`(()=>({len: __APP__.state.smart.text.length, value: document.getElementById('smart-input').value.length}))()`);
      if (st.len < 100 || !st.value) throw new Error('示例文字未填入');
    });

    test('S8 导入结果可直接生成 Word 字节流', async () => {
      await click('[data-action="smart-parse"]');
      await sleep(150);
      await ev(`(()=>{ const cb=document.querySelector('[data-smart="asnew"]'); if(cb && !cb.checked){ cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true})); } return true; })()`);
      await click('[data-action="smart-apply"][data-kind="fill"]');
      await sleep(400);
      const info = await ev(`(()=>{ const r=__APP__.getCurrent(); const bytes=__APP__.buildDocxBytes(r); return {len: bytes.length, work: r.data.work.length, hasWordBtn: !!document.querySelector('[data-action="smart-apply"][data-kind="word"]'), hasPdfBtn: !!document.querySelector('[data-action="smart-apply"][data-kind="pdf"]')}; })()`);
      if (!(info.len > 2000)) throw new Error('docx 字节数异常: ' + info.len);
      if (info.work !== 1) throw new Error('导入数据缺失');
      if (!info.hasWordBtn || !info.hasPdfBtn) throw new Error('缺少导出按钮');
      await ev('__APP__.smartUndo(); true');
    });

    await runAll();
  } finally {
    await b.close();
  }
})().catch(e => { console.error('E2E 运行失败: ' + e.message); process.exit(1); });
