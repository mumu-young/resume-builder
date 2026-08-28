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

  try {
    await b.cdp.navigate(INDEX);
    await b.cdp.waitFor('window.__APP__ && window.__APP__.state.ready === true');
    await ev('__APP__.resetAllData()', true);
    await sleep(150);

    test('问题1 照片默认 7:9 矩形，可切换圆形蒙版', async () => {
      await goModule('basic');
      const dataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      await ev(`__APP__.setByPath('basic.photo', ${JSON.stringify(dataUrl)}); __APP__.afterChange(); __APP__.renderModule(); __APP__.renderPreview(); true`);
      let html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('tpl-photo-rect') < 0) throw new Error('默认应为矩形照片');
      if (html.indexOf('tpl-photo-round') >= 0) throw new Error('默认不应为圆形');
      const hasSelect = await ev(`(() => { const s=document.querySelector('select[data-path="basic.photoShape"]'); return !!s && s.value==='rect'; })()`);
      if (!hasSelect) throw new Error('照片形状下拉缺失或默认值错误');
      await ev(`(() => { const s=document.querySelector('select[data-path="basic.photoShape"]'); s.value='round'; s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
      await sleep(300);
      html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('tpl-photo-round') < 0) throw new Error('切换圆形后未生效');
      if (html.indexOf('tpl-photo-rect') >= 0) throw new Error('切换圆形后仍为矩形');
      const shape = await ev('__APP__.data().basic.photoShape');
      if (shape !== 'round') throw new Error('photoShape 数据未更新: ' + shape);
    });

    test('问题7 基础信息恢复无图标：删性别/出生年份、加年龄、简历显示工作年限', async () => {
      await goModule('basic');
      const v = await ev(`(() => ({
        hasGender: !!document.querySelector('select[data-path="basic.gender"]'),
        hasBirth: !!document.querySelector('input[data-path="basic.birthYear"]'),
        hasAge: !!document.querySelector('input[data-path="basic.age"]'),
        nameLabel: (function(){ const el=document.querySelector('input[data-path="basic.name"]'); return el ? el.closest('.field').querySelector('label').textContent : ''; })()
      }))()`);
      if (v.hasGender) throw new Error('性别字段应删除');
      if (v.hasBirth) throw new Error('出生年份字段应删除');
      if (!v.hasAge) throw new Error('年龄字段缺失');
      if (v.nameLabel.indexOf('👤') >= 0) throw new Error('基础信息不应再有小图标');
      await setInput('input[data-path="basic.phone"]', '13800000000');
      await setInput('input[data-path="basic.email"]', 'a@b.com');
      await setInput('input[data-path="basic.years"]', '3 年');
      await setInput('input[data-path="basic.age"]', '25');
      await sleep(300);
      const html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('电话：13800000000') < 0) throw new Error('简历缺少电话标签');
      if (html.indexOf('邮箱：a@b.com') < 0) throw new Error('简历缺少邮箱标签');
      if (html.indexOf('年龄：25岁') < 0) throw new Error('简历缺少年龄');
      if (html.indexOf('工作年限：3 年') < 0) throw new Error('简历缺少工作年限');
      if (html.indexOf('年龄：25岁') >= html.indexOf('电话：13800000000')) throw new Error('年龄应排在电话之前');
      if (html.indexOf('📞') >= 0 || html.indexOf('✉️') >= 0 || html.indexOf('🎂') >= 0 || html.indexOf('💼') >= 0 || html.indexOf('📍') >= 0) throw new Error('简历联系信息不应有小图标');
      if (html.indexOf('性别') >= 0 || html.indexOf('出生年份') >= 0) throw new Error('简历不应出现性别/出生年份');
    });

        test('问题3 模块排序：调整顺序 + 小标题/分割线颜色', async () => {
      await goModule('education');
      await click('[data-action="add-entry"][data-type="education"]');
      await setInput('input[data-path="education.0.school"]', '某大学');
      await goModule('work');
      await click('[data-action="add-entry"][data-type="work"]');
      await setInput('input[data-path="work.0.company"]', '某公司');
      await goModule('honors');
      await click('[data-action="add-entry"][data-type="honor"]');
      await setInput('input[data-path="honors.items.0.title"]', '奖学金');
      await goModule('sections');
      const navHas = await ev('!!document.querySelector("[data-action=\\"set-module\\"][data-id=\\"sections\\"]")');
      if (!navHas) throw new Error('模块排序导航项缺失');
      await click('[data-action="move-section"][data-idx="4"][data-dir="-1"]');
      await click('[data-action="move-section"][data-idx="3"][data-dir="-1"]');
      await click('[data-action="move-section"][data-idx="2"][data-dir="-1"]');
      const order = await ev('__APP__.getCurrent().sectionOrder');
      if (order[1] !== 'honors') throw new Error('honors 未移动到第 2 位: ' + order.join(','));
      await sleep(350);
      const html = await ev('document.getElementById("resume-page").innerHTML');
      const ie = html.indexOf('教育经历'), ih = html.indexOf('荣誉证书'), iw = html.indexOf('实习 / 工作经历');
      if (!(ie >= 0 && ih >= 0 && iw >= 0 && ie < ih && ih < iw)) throw new Error('预览顺序错误: ' + ie + ',' + ih + ',' + iw);
      await click('[data-action="set-title-color"][data-color="#2563eb"]');
      await sleep(200);
      let html2 = await ev('document.getElementById("resume-page").innerHTML');
      if (html2.indexOf('--tpl-title-color:#2563eb') < 0) throw new Error('标题颜色未生效');
      await click('[data-action="set-line-color"][data-color="#cbd5e1"]');
      await sleep(200);
      html2 = await ev('document.getElementById("resume-page").innerHTML');
      if (html2.indexOf('--tpl-line-color:#cbd5e1') < 0) throw new Error('分割线颜色未生效');
      const st = await ev('JSON.stringify(__APP__.getCurrent().style)');
      if (st.indexOf('#2563eb') < 0 || st.indexOf('#cbd5e1') < 0) throw new Error('颜色数据未保存');
    });

    test('问题4 小标题内容可编辑', async () => {
      await goModule('sections');
      await setInput('input[data-stitle="work"]', '工作经历（实习）');
      await sleep(300);
      const t = await ev('__APP__.getCurrent().sectionTitles.work');
      if (t !== '工作经历（实习）') throw new Error('小标题数据未保存: ' + t);
      const html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('工作经历（实习）') < 0) throw new Error('预览未使用自定义小标题');
      if (html.indexOf('实习 / 工作经历') >= 0) throw new Error('预览仍显示默认小标题');
    });
    test('问题5 模板中心新增到 9 套并可切换', async () => {
      await goModule('templates');
      const cards = await ev('document.querySelectorAll(".tpl-card").length');
      if (cards !== 9) throw new Error('模板卡片应为 9 个，实际 ' + cards);
      await click('[data-action="apply-template"][data-id="modern"]');
      const tpl = await ev('__APP__.getCurrent().templateId');
      if (tpl !== 'modern') throw new Error('未切换到现代简约模板');
      const html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('tpl-modern') < 0) throw new Error('预览未应用 modern 模板');
    });
    test('问题6 实时预览简化为侧栏底部开关', async () => {
      const navHasPreview = await ev('!!document.querySelector("[data-action=\\"set-module\\"][data-id=\\"preview\\"]")');
      if (navHasPreview) throw new Error('导航不应再包含实时预览模块');
      const sw = await ev('document.querySelector(".sidebar-footer #preview-switch") !== null');
      if (!sw) throw new Error('侧栏底部预览开关缺失');
      await ev('document.getElementById("preview-switch").click()');
      let disp = await ev('document.getElementById("preview-pane").style.display');
      if (disp !== 'none') throw new Error('关闭开关后预览未隐藏: ' + disp);
      const checked = await ev('document.getElementById("preview-switch").checked');
      if (checked) throw new Error('开关状态未同步为未选中');
      await ev('document.getElementById("preview-switch").click()');
      disp = await ev('document.getElementById("preview-pane").style.display');
      if (disp !== '') throw new Error('打开开关后预览未恢复: ' + disp);
    });
    test('问题8 模块排序配色：常用色含黑色、大色块统一、分割线含深色', async () => {
      await goModule('sections');
      const hasBlack = await ev('!!document.querySelector("[data-action=\\"set-title-color\\"][data-color=\\"#000000\\"]")');
      if (!hasBlack) throw new Error('小标题色板缺少黑色');
      const hasDarkLine = await ev('!!document.querySelector("[data-action=\\"set-line-color\\"][data-color=\\"#1d4ed8\\"]") && !!document.querySelector("[data-action=\\"set-line-color\\"][data-color=\\"#374151\\"]")');
      if (!hasDarkLine) throw new Error('分割线色板缺少深色');
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="modern"]');
      await goModule('sections');
      await click('[data-action="set-title-color"][data-color="#000000"]');
      await sleep(300);
      const computed = await ev(`(() => {
        const h = document.querySelector('.tpl-modern .tpl-header');
        if (!h) return null;
        const s = getComputedStyle(h);
        return { bg: s.backgroundColor, color: s.color };
      })()`);
      if (!computed || computed.bg !== 'rgb(0, 0, 0)') throw new Error('大色块未使用黑色小标题色: ' + JSON.stringify(computed));
      if (computed.color !== 'rgb(255, 255, 255)') throw new Error('黑色背景下文字应为白色: ' + computed.color);
      await click('[data-action="set-line-color"][data-color="#374151"]');
      await sleep(200);
      const html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('--tpl-line-color:#374151') < 0) throw new Error('深色分割线未生效');
    });
    test('问题9 照片矩形为纯矩形（无圆角）', async () => {
      await goModule('basic');
      await ev(`__APP__.setByPath('basic.photoShape', 'rect'); __APP__.afterChange(); __APP__.renderModule(); __APP__.renderPreview(); true`);
      await sleep(200);
      const r = await ev(`(() => {
        const el = document.querySelector('.tpl-photo-rect');
        if (!el) return null;
        return getComputedStyle(el).borderRadius;
      })()`);
      if (r === null) throw new Error('未找到矩形照片元素');
      if (r !== '0px') throw new Error('矩形照片圆角应为 0px，实际 ' + r);
    });
    test('问题10 简历内容不使用项目符号', async () => {
      await goModule('work');
      await setInput('textarea[data-path="work.0.description"]', '负责后台管理页面开发\n优化首屏加载速度');
      await sleep(300);
      const v = await ev(`(() => {
        const lis = document.querySelectorAll('.resume-page li');
        if (!lis.length) return null;
        let allNone = true;
        for (let i = 0; i < lis.length; i++){ if (getComputedStyle(lis[i]).listStyleType !== 'none') allNone = false; }
        return { count: lis.length, allNone: allNone };
      })()`);
      if (!v || v.count < 1) throw new Error('简历中未找到列表项');
      if (!v.allNone) throw new Error('简历列表仍显示项目符号');
    });
    test('问题11 分隔符改用 |', async () => {
      await goModule('education');
      await setInput('input[data-path="education.0.major"]', '计算机应用技术');
      await sleep(300);
      const html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf(' | ') < 0) throw new Error('简历中未使用 | 分隔符');
      if (html.indexOf(' · ') >= 0) throw new Error('简历中仍存在 · 分隔符');
      if (html.indexOf('年龄：25岁 | 电话：13800000000') < 0) throw new Error('联系信息未用 | 分隔');
      if (html.indexOf('某大学 | 计算机应用技术') < 0) throw new Error('教育经历学校/专业未用 | 分隔');
    });
    test('问题12 模块排序中小标题输入前不再显示小图标', async () => {
      await goModule('sections');
      const v = await ev(`(() => {
        const el = document.querySelector('input[data-stitle="education"]');
        if (!el) return null;
        const label = el.closest('.field').querySelector('label').textContent;
        return { label: label, hasIcon: label.indexOf('✏️') >= 0 };
      })()`);
      if (!v) throw new Error('未找到小标题输入');
      if (v.hasIcon) throw new Error('小标题输入前仍显示小图标: ' + v.label);
      if (v.label.indexOf('教育经历 小标题') < 0) throw new Error('标签内容异常: ' + v.label);
    });
    test('问题13 其他信息小标题可编辑', async () => {
      await goModule('honors');
      await setInput('textarea[data-path="honors.extra"]', '英语：CET-6');
      await goModule('sections');
      const hasInput = await ev('!!document.querySelector("input[data-stitle=\\"extra\\"]")');
      if (!hasInput) throw new Error('缺少其他信息小标题输入');
      await setInput('input[data-stitle="extra"]', '补充信息');
      await sleep(300);
      const saved = await ev('__APP__.getCurrent().sectionTitles.extra');
      if (saved !== '补充信息') throw new Error('其他信息标题未保存: ' + saved);
      const html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('补充信息') < 0) throw new Error('预览未使用自定义其他信息标题');
      if (html.indexOf('其他信息') >= 0) throw new Error('预览仍显示默认其他信息标题');
    });
        test('问题15 经典模板可切换且联系信息无小图标', async () => {
      await goModule('templates');
      const cards = await ev('document.querySelectorAll(".tpl-card").length');
      if (cards !== 9) throw new Error('模板卡片应为 9 个，实际 ' + cards);
      const nameOk = await ev('document.querySelector("[data-action=\\"apply-template\\"][data-id=\\"bizblue\\"] .tpl-card-name").textContent === "经典模板"');
      if (!nameOk) throw new Error('模板名应为 经典模板');
      await click('[data-action="apply-template"][data-id="bizblue"]');
      const tpl = await ev('__APP__.getCurrent().templateId');
      if (tpl !== 'bizblue') throw new Error('未切换到经典模板');
      const html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('tpl-bizblue') < 0 || html.indexOf('bb-title') < 0) throw new Error('预览未应用 bizblue 样式');
      if (html.indexOf('bb-head-text') < 0) throw new Error('缺少头部文字栏');
      if (html.indexOf('✉️') >= 0 || html.indexOf('📞') >= 0 || html.indexOf('🎂') >= 0) throw new Error('联系信息不应有小图标');
    });
    test('问题16 新增开放两栏模板并可切换', async () => {
      await goModule('templates');
      const cards = await ev('document.querySelectorAll(".tpl-card").length');
      if (cards !== 9) throw new Error('模板卡片应为 9 个，实际 ' + cards);
      const hasOpen = await ev('!!document.querySelector("[data-action=\\"apply-template\\"][data-id=\\"open\\"]")');
      if (!hasOpen) throw new Error('缺少开放两栏模板');
      await click('[data-action="apply-template"][data-id="open"]');
      const tpl = await ev('__APP__.getCurrent().templateId');
      if (tpl !== 'open') throw new Error('未切换到开放两栏模板');
      const html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('tpl-open') < 0 || html.indexOf('op-title') < 0 || html.indexOf('tpl-open-side') < 0) throw new Error('预览未应用 open 样式');
    });
    test('问题17 页面边距模块可调整四周留白', async () => {
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="clean"]');
      await goModule('margins');
      const hasInputs = await ev(`(() => {
        return ['top','right','bottom','left'].every(k => !!document.querySelector('input[data-mpath="' + k + '"]'));
      })()`);
      if (!hasInputs) throw new Error('缺少四周边距输入框');
      await click('[data-action="margin-preset"][data-preset="none"]');
      await sleep(200);
      const vars = await ev(`(() => {
        const p = document.getElementById('resume-page');
        return { t: p.style.getPropertyValue('--pad-top'), r: p.style.getPropertyValue('--pad-right'), b: p.style.getPropertyValue('--pad-bottom'), l: p.style.getPropertyValue('--pad-left') };
      })()`);
      if (vars.t !== '0mm' || vars.r !== '0mm' || vars.b !== '0mm' || vars.l !== '0mm') throw new Error('无空白未生效: ' + JSON.stringify(vars));
      const pad = await ev('__APP__.getCurrent().style.pagePadding');
      if (pad.top !== 0 || pad.right !== 0 || pad.bottom !== 0 || pad.left !== 0) throw new Error('边距数据未保存: ' + JSON.stringify(pad));
      await setInput('input[data-mpath="top"]', '20');
      await sleep(200);
      const topVar = await ev('document.getElementById("resume-page").style.getPropertyValue("--pad-top")');
      if (topVar !== '20mm') throw new Error('上边距未生效: ' + topVar);
      const savedTop = await ev('__APP__.getCurrent().style.pagePadding.top');
      if (savedTop !== 20) throw new Error('上边距数据未保存: ' + savedTop);
      await click('[data-action="margin-preset"][data-preset="default"]');
      await sleep(200);
      const defVar = await ev('document.getElementById("resume-page").style.getPropertyValue("--pad-top")');
      if (defVar !== '10mm') throw new Error('恢复默认未生效: ' + defVar);
    });
    test('问题18 开放两栏固定渲染无空白且左侧色块占满全高', async () => {
      await ev('__APP__.resetAllData()', true);
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="open"]');
      await sleep(300);
      const vars = await ev(`(() => {
        const p = document.getElementById('resume-page');
        return { t: p.style.getPropertyValue('--pad-top'), r: p.style.getPropertyValue('--pad-right'), b: p.style.getPropertyValue('--pad-bottom'), l: p.style.getPropertyValue('--pad-left') };
      })()`);
      if (vars.t !== '0mm' || vars.r !== '0mm' || vars.b !== '0mm' || vars.l !== '0mm') throw new Error('开放两栏应渲染为 0 边距: ' + JSON.stringify(vars));
      const pad = await ev('__APP__.getCurrent().style.pagePadding');
      if (pad.top !== 10 || pad.left !== 12) throw new Error('开放两栏不应改写共享页边距数据: ' + JSON.stringify(pad));
      const v = await ev(`(() => {
        const side = document.querySelector('.tpl-open-side');
        const grid = document.querySelector('.tpl-open-grid');
        if (!side || !grid) return null;
        return { sh: parseFloat(getComputedStyle(side).height), gh: parseFloat(getComputedStyle(grid).height) };
      })()`);
      if (!v || v.sh < 1100 || v.gh < 1100) throw new Error('左侧色块未占满整页高度: ' + JSON.stringify(v));
    });
    test('问题19 开放两栏边距固定为0且与其他模板隔离', async () => {
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="clean"]');
      await goModule('margins');
      await setInput('input[data-mpath="top"]', '20');
      await sleep(200);
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="open"]');
      await sleep(250);
      const openVar = await ev('document.getElementById("resume-page").style.getPropertyValue("--pad-top")');
      if (openVar !== '0mm') throw new Error('开放两栏应固定渲染 0 边距: ' + openVar);
      const savedTop = await ev('__APP__.getCurrent().style.pagePadding.top');
      if (savedTop !== 20) throw new Error('开放两栏不应改写页边距数据: ' + savedTop);
      await goModule('margins');
      const disabled = await ev('document.querySelector("input[data-mpath=\\"top\\"]").disabled');
      if (!disabled) throw new Error('开放两栏下边距输入应禁用');
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="clean"]');
      await sleep(250);
      const backVar = await ev('document.getElementById("resume-page").style.getPropertyValue("--pad-top")');
      if (backVar !== '20mm') throw new Error('切回其他模板应恢复原边距: ' + backVar);
    });
    test('问题20 联系信息分隔符与显示标签可自定义', async () => {
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="clean"]');
      await goModule('basic');
      await setInput('input[data-path="basic.age"]', '25');
      await setInput('input[data-path="basic.phone"]', '13800000000');
      await setInput('input[data-path="basic.email"]', 'a@b.com');
      await setInput('input[data-path="basic.location"]', '北京');
      await setInput('input[data-path="basic.years"]', '3 年');
      await setInput('input[data-path="basic.target"]', '前端开发工程师');
      await ev(`(() => { const s=document.querySelector('select[data-path="basic.contactSeparator"]'); s.value='·'; s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
      await sleep(250);
      let html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf(' · ') < 0) throw new Error('· 分隔符未生效');
      const sepData = await ev('__APP__.data().basic.contactSeparator');
      if (sepData !== '·') throw new Error('分隔符数据未保存: ' + sepData);
      await ev(`(() => { const s=document.querySelector('select[data-path="basic.contactSeparator"]'); s.value=' '; s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
      await sleep(250);
      html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('&nbsp;&nbsp;&nbsp;&nbsp;') < 0) throw new Error('空白分隔符未使用宽空白');
      const ageChk = await ev('!!document.querySelector("input[data-path=\\"basic.showLabels.age\\"]")');
      if (!ageChk) throw new Error('缺少年龄显示标签选项');
      await ev(`(() => { const c=document.querySelector('input[data-path="basic.showLabels.age"]'); c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
      await sleep(250);
      html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('年龄：25岁') >= 0) throw new Error('关闭年龄标签后仍显示“年龄：”');
      if (html.indexOf('25岁') < 0) throw new Error('年龄值应仍显示');
      const targetChk = await ev('!!document.querySelector("input[data-path=\\"basic.targetLabel\\"]")');
      if (!targetChk) throw new Error('缺少求职意向标签选项');
      await ev(`(() => { const c=document.querySelector('input[data-path="basic.targetLabel"]'); c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
      await sleep(250);
      html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('求职意向：前端开发工程师') >= 0) throw new Error('关闭后仍显示求职意向前缀');
      if (html.indexOf('前端开发工程师') < 0) throw new Error('求职意向值应仍显示');
    });
    test('问题21 分割线粗细可调且作用于模板横线', async () => {
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="compact"]');
      await goModule('sections');
      const hasBtns = await ev('!!document.querySelector("[data-action=\\"set-line-width\\"][data-width=\\"3\\"]") && !!document.querySelector("[data-action=\\"set-line-width\\"][data-width=\\"1\\"]")');
      if (!hasBtns) throw new Error('缺少分割线粗细选项');
      await click('[data-action="set-line-width"][data-width="3"]');
      await sleep(250);
      const v = await ev(`(() => {
        const p = document.getElementById('resume-page');
        const h = document.querySelector('.tpl-compact .tpl-header');
        return { varVal: p.style.getPropertyValue('--tpl-line-width'), bw: h ? getComputedStyle(h).borderBottomWidth : null, data: __APP__.getCurrent().style.lineWidth };
      })()`);
      if (v.varVal !== '3px') throw new Error('--tpl-line-width 未生效: ' + v.varVal);
      if (v.data !== 3) throw new Error('lineWidth 数据未保存: ' + v.data);
      if (v.bw !== '3px') throw new Error('模板横线未随粗细变化: ' + v.bw);
    });

    test('问题22 现代简约模板无项目符号圆点', async () => {
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="modern"]');
      await goModule('work');
      await click('[data-action="add-entry"][data-type="work"]');
      await setInput('textarea[data-path="work.0.description"]', '第一行\n第二行');
      await sleep(300);
      const before = await ev(`(() => {
        const item = document.querySelector('.tpl-modern .tpl-item');
        if (!item) return null;
        return getComputedStyle(item, '::before').content;
      })()`);
      if (before === null) throw new Error('未找到 modern 条目');
      if (before !== 'none') throw new Error('modern 条目仍有 ::before 圆点: ' + before);
      const li = await ev(`(() => { const el=document.querySelector('.tpl-modern li'); return el ? getComputedStyle(el).listStyleType : null; })()`);
      if (li !== 'none') throw new Error('列表仍有项目符号: ' + li);
    });

            test('问题24 专业技能分类文字不跟随标题颜色', async () => {
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="modern"]');
      await goModule('skills');
      await click('[data-action="add-entry"][data-type="skills"]');
      await setInput('input[data-path="skills.0.category"]', '编程语言');
      await setInput('textarea[data-path="skills.0.items"]', 'Python');
      await goModule('sections');
      await click('[data-action="set-title-color"][data-color="#000000"]');
      await sleep(300);
      const v = await ev(`(() => {
        const el = document.querySelector('.tpl-modern .tpl-skill-cat');
        if (!el) return null;
        return getComputedStyle(el).color;
      })()`);
      if (v === null) throw new Error('未找到专业技能分类');
      if (v === 'rgb(0, 0, 0)') throw new Error('专业技能分类不应跟随标题颜色: ' + v);
      if (v !== 'rgb(34, 34, 34)') throw new Error('专业技能分类应为正文颜色 rgb(34,34,34): ' + v);
    });
    test('问题25 分割线显示开关与分割线设置整合', async () => {
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="compact"]');
      await goModule('sections');
      await click('[data-action="set-line-width"][data-width="2"]');
      await sleep(150);
      const heads = await ev(`Array.prototype.map.call(document.querySelectorAll('.tool-card h4'), function(h){ return h.textContent; })`);
      const lineHeads = heads.filter(function(t){ return t.indexOf('分割线') >= 0; });
      if (lineHeads.length !== 1 || lineHeads[0].indexOf('分割线设置') < 0) throw new Error('分割线修改未整合为一个框: ' + JSON.stringify(lineHeads));
      const hasChk = await ev('!!document.querySelector("input[data-sstyle=\\"showLines\\"]")');
      if (!hasChk) throw new Error('缺少显示分割线开关');
      await ev(`(() => { const c=document.querySelector('input[data-sstyle="showLines"]'); c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
      await sleep(250);
      const v1 = await ev(`(() => {
        const p = document.getElementById('resume-page');
        const h = document.querySelector('.tpl-compact .tpl-header');
        return { lw: p.style.getPropertyValue('--tpl-line-width'), bw: h ? getComputedStyle(h).borderBottomWidth : null, show: __APP__.getCurrent().style.showLines, disabled: document.querySelector('[data-action="set-line-width"][data-width="2"]').disabled };
      })()`);
      if (v1.lw !== '0px') throw new Error('关闭后 --tpl-line-width 应为 0px: ' + v1.lw);
      if (v1.bw !== '0px') throw new Error('模板横线未隐藏: ' + v1.bw);
      if (v1.show !== false) throw new Error('showLines 数据未保存');
      if (!v1.disabled) throw new Error('关闭后粗细按钮应禁用');
      await ev(`(() => { const c=document.querySelector('input[data-sstyle="showLines"]'); c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
      await sleep(250);
      const v2 = await ev(`(() => {
        const p = document.getElementById('resume-page');
        const h = document.querySelector('.tpl-compact .tpl-header');
        return { lw: p.style.getPropertyValue('--tpl-line-width'), bw: h ? getComputedStyle(h).borderBottomWidth : null };
      })()`);
      if (v2.lw !== '2px' || v2.bw !== '2px') throw new Error('重新开启后分割线应恢复: ' + JSON.stringify(v2));
    });
        test('问题26 简洁单栏无分割线', async () => {
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="clean"]');
      await goModule('sections');
      await click('[data-action="set-line-width"][data-width="3"]');
      await sleep(250);
      const v = await ev(`(() => {
        const header = document.querySelector('.tpl-clean .tpl-header');
        const h2 = document.querySelector('.tpl-clean .tpl-h2');
        return { hb: header ? getComputedStyle(header).borderBottomWidth : null, h2b: h2 ? getComputedStyle(h2).borderBottomWidth : null };
      })()`);
      if (!v || v.hb === null || v.h2b === null) throw new Error('未找到简洁单栏结构');
      if (v.hb !== '0px' || v.h2b !== '0px') throw new Error('简洁单栏不应有分割线: ' + JSON.stringify(v));
    });
    test('问题28 经典模板/开放两栏分割线预览与打印一致（边框线）', async () => {
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="bizblue"]');
      await goModule('sections');
      await click('[data-action="set-line-width"][data-width="1"]');
      await sleep(250);
      const v1 = await ev(`(() => {
        const bb = document.querySelector('.tpl-bizblue .bb-line');
        return { bb: bb ? getComputedStyle(bb).borderBottomWidth : null };
      })()`);
      if (!v1 || v1.bb !== '1px') throw new Error('经典模板分割线应为边框线且为 1px: ' + JSON.stringify(v1));
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="open"]');
      await goModule('sections');
      await click('[data-action="set-line-width"][data-width="1"]');
      await sleep(250);
      const v2 = await ev(`(() => {
        const op = document.querySelector('.tpl-open .op-line');
        return { op: op ? getComputedStyle(op).borderBottomWidth : null };
      })()`);
      if (!v2 || v2.op !== '1px') throw new Error('开放两栏分割线应为边框线且为 1px: ' + JSON.stringify(v2));
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="compact"]');
      await goModule('sections');
      await click('[data-action="set-line-width"][data-width="1"]');
      await sleep(250);
      const v3 = await ev('getComputedStyle(document.querySelector(".tpl-compact .tpl-header")).borderBottomWidth');
      if (v3 !== '1px') throw new Error('简洁单栏小标题线预览应为 1px: ' + v3);
    });

    test('问题29 优雅知性删除最上方横线', async () => {
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="elegant"]');
      await sleep(200);
      const eH = await ev('getComputedStyle(document.querySelector(".tpl-elegant .tpl-header")).borderBottomWidth');
      if (eH !== '0px') throw new Error('优雅知性头部横线应删除: ' + eH);
    });

    test('问题30 新增标题背景色模板并可切换', async () => {
      await goModule('templates');
      const cards = await ev('document.querySelectorAll(".tpl-card").length');
      if (cards !== 9) throw new Error('模板卡片应为 9 个，实际 ' + cards);
      const hasTb = await ev('!!document.querySelector("[data-action=\\"apply-template\\"][data-id=\\"titlebg\\"]")');
      if (!hasTb) throw new Error('缺少标题背景色模板');
      await click('[data-action="apply-template"][data-id="titlebg"]');
      const tpl = await ev('__APP__.getCurrent().templateId');
      if (tpl !== 'titlebg') throw new Error('未切换到标题背景色模板');
      const html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('tpl-titlebg') < 0 || html.indexOf('tb-sec-head') < 0) throw new Error('预览未应用 titlebg 样式');
      await goModule('sections');
      await click('[data-action="set-title-color"][data-color="#000000"]');
      await sleep(300);
      const v = await ev(`(() => {
        const head = document.querySelector('.tpl-titlebg .tb-sec-head');
        if (!head) return null;
        return { bg: getComputedStyle(head).backgroundColor, color: getComputedStyle(head.querySelector('.tb-title')).color };
      })()`);
      if (!v || v.bg !== 'rgb(0, 0, 0)') throw new Error('小标题背景未跟随标题颜色: ' + JSON.stringify(v));
      if (v.color !== 'rgb(255, 255, 255)') throw new Error('黑底时标题文字应为白色: ' + v.color);
    });
    test('问题31 新增标题背景浅色模板并可切换', async () => {
      await goModule('templates');
      const cards = await ev('document.querySelectorAll(".tpl-card").length');
      if (cards !== 9) throw new Error('模板卡片应为 9 个，实际 ' + cards);
      const has = await ev('!!document.querySelector("[data-action=\\"apply-template\\"][data-id=\\"titlebglight\\"]")');
      if (!has) throw new Error('缺少标题背景浅色模板');
      await click('[data-action="apply-template"][data-id="titlebglight"]');
      const tpl = await ev('__APP__.getCurrent().templateId');
      if (tpl !== 'titlebglight') throw new Error('未切换到标题背景浅色模板');
      const html = await ev('document.getElementById("resume-page").innerHTML');
      if (html.indexOf('tpl-titlebglight') < 0 || html.indexOf('tb-light-sec-head') < 0) throw new Error('预览未应用 titlebglight 样式');
      const layout = await ev(`(() => {
        const h = document.querySelector('.tpl-titlebglight .tpl-header');
        const right = document.querySelector('.tpl-titlebglight .tb-head-right');
        if (!h || !right) return null;
        const hs = getComputedStyle(h);
        const rs = getComputedStyle(right);
        return { display: hs.display, rightDisplay: rs.display, cols: rs.gridTemplateColumns.split(' ').length };
      })()`);
      if (!layout || layout.display !== 'flex' || layout.rightDisplay !== 'grid' || layout.cols < 2) throw new Error('标题背景浅色头部排版与标题背景色不一致: ' + JSON.stringify(layout));
      await goModule('sections');
      await click('[data-action="set-title-color"][data-color="#2563eb"]');
      await sleep(300);
      const v = await ev(`(() => {
        const head = document.querySelector('.tpl-titlebglight .tb-light-sec-head');
        if (!head) return null;
        const s = getComputedStyle(head);
        const cs = getComputedStyle(head.querySelector('.tb-light-title'));
        let m = s.backgroundColor.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
        let rgb = null;
        if (m){ rgb = [parseInt(m[1],10), parseInt(m[2],10), parseInt(m[3],10)]; }
        else {
          m = s.backgroundColor.match(/color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)/);
          if (m){ rgb = [Math.round(parseFloat(m[1])*255), Math.round(parseFloat(m[2])*255), Math.round(parseFloat(m[3])*255)]; }
        }
        return { bl: s.borderLeftWidth, bc: s.borderLeftColor, rgb: rgb, color: cs.color };
      })()`);
      if (!v) throw new Error('未找到浅色底块小标题');
      if (v.bl !== '4px') throw new Error('左侧竖条应固定 4px: ' + v.bl);
      if (v.bc !== 'rgb(37, 99, 235)') throw new Error('竖条应使用标题颜色: ' + v.bc);
      if (!v.rgb || v.rgb[0] < 220 || v.rgb[1] < 220 || v.rgb[2] < 220) throw new Error('底色应为浅色（标题色变浅）: ' + JSON.stringify(v.rgb));
      if (v.color !== 'rgb(34, 34, 34)') throw new Error('标题文字应为深色: ' + v.color);
    });
    test('问题32 标题背景色/浅色模板典型内容一页放得下', async () => {
      await ev('__APP__.resetAllData()', true);
      await ev(`(() => {
        const A = __APP__;
        const b = A.data().basic;
        b.name='张三'; b.target='前端开发工程师'; b.age='25'; b.phone='13800000000'; b.email='a@b.com'; b.location='北京'; b.years='3 年';
        b.summary='3 年前端开发经验，擅长 Vue/React，负责过多个中大型项目，具备良好的沟通与团队协作能力。';
        b.photo='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        for (let i=0;i<2;i++){ A.addEntry('education'); A.addEntry('work'); A.addEntry('projects'); }
        A.setByPath('education.0.school','复旦大学'); A.setByPath('education.0.major','计算机'); A.setByPath('education.0.start','2018-09'); A.setByPath('education.0.end','2022-06');
        A.setByPath('education.1.school','某中学'); A.setByPath('education.1.start','2015-09'); A.setByPath('education.1.end','2018-06');
        A.setByPath('work.0.company','字节跳动'); A.setByPath('work.0.position','高级前端工程师'); A.setByPath('work.0.description','负责中台系统开发\\n优化性能提升 50%\\n带 5 人小组');
        A.setByPath('work.1.company','某科技公司'); A.setByPath('work.1.position','前端开发'); A.setByPath('work.1.description','负责官网与后台开发');
        A.setByPath('projects.0.name','创作者中台'); A.setByPath('projects.0.role','前端负责人'); A.setByPath('projects.0.description','从 0 搭建中台系统，覆盖 10+ 业务线');
        A.setByPath('projects.1.name','数据可视化平台'); A.setByPath('projects.1.role','核心开发'); A.setByPath('projects.1.description','ECharts 可视化大屏，日活 10w');
        A.addEntry('skills'); A.setByPath('skills.0.category','编程语言'); A.setByPath('skills.0.items','JavaScript\\nTypeScript\\nPython');
        A.addEntry('skills'); A.setByPath('skills.1.category','框架'); A.setByPath('skills.1.items','Vue\\nReact');
        A.addEntry('honor'); A.setByPath('honors.items.0.title','国家奖学金'); A.setByPath('honors.extra','英语：CET-6\\n兴趣爱好：摄影、羽毛球');
        A.afterChange();
        return true;
      })()`);
      const A4 = 297 * (96/25.4);
      for (const id of ['titlebg','titlebglight']){
        await goModule('templates');
        await click('[data-action="apply-template"][data-id="' + id + '"]');
        await sleep(250);
        const h = await ev('document.getElementById("resume-page").getBoundingClientRect().height');
        if (h > A4 + 2) throw new Error(id + ' 内容超出单页: ' + h.toFixed(1) + 'px vs A4 ' + A4.toFixed(1) + 'px');
      }
    });
    test('问题33 开放两栏教育经历固定左栏且标题不跟随设置', async () => {
      await ev('__APP__.resetAllData()', true);
      await goModule('education');
      await click('[data-action="add-entry"][data-type="education"]');
      await setInput('input[data-path="education.0.school"]', '复旦大学');
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="open"]');
      await sleep(250);
      const v = await ev(`(() => {
        const side = document.querySelector('.tpl-open-side');
        const main = document.querySelector('.tpl-open-main');
        const h = side.querySelector('.op-side-h');
        return {
          sideHasEdu: !!h,
          sideText: h ? h.textContent : null,
          mainHasEdu: !!main.querySelector('.op-side-h'),
          sidePaddingTop: getComputedStyle(side).paddingTop
        };
      })()`);
      if (!v) throw new Error('未找到开放两栏结构');
      if (!v.sideHasEdu || v.sideText !== '教育经历') throw new Error('教育经历应固定在左栏且标题为教育经历: ' + JSON.stringify(v));
      if (v.mainHasEdu) throw new Error('右栏不应再显示教育经历标题');
      const pt = parseFloat(v.sidePaddingTop);
      if (!(pt >= 30)) throw new Error('左栏内容应微微下移（上边距偏小）: ' + v.sidePaddingTop);
      await goModule('sections');
      await setInput('input[data-stitle="education"]', '教育背景');
      await sleep(250);
      const sideText2 = await ev('document.querySelector(".tpl-open-side .op-side-h").textContent');
      if (sideText2 !== '教育经历') throw new Error('教育经历标题不应跟随小标题内容设置: ' + sideText2);
    });
    test('问题35 开放两栏教育经历按参考排版', async () => {
      await ev('__APP__.resetAllData()', true);
      await goModule('education');
      await click('[data-action="add-entry"][data-type="education"]');
      await setInput('input[data-path="education.0.school"]', '北京大学');
      await setInput('input[data-path="education.0.major"]', '计算机科学与技术');
      await setInput('input[data-path="education.0.start"]', '2013-09');
      await setInput('input[data-path="education.0.end"]', '2017-06');
      await setInput('textarea[data-path="education.0.description"]', '主修课程：数据结构、操作系统\n专业排名前 5%');
      await goModule('templates');
      await click('[data-action="apply-template"][data-id="open"]');
      await sleep(250);
      const v = await ev(`(() => {
        const item = document.querySelector('.tpl-open-side .op-edu-item');
        if (!item) return null;
        const school = item.querySelector('.op-edu-school');
        const line = item.querySelector('.op-edu-line');
        const date = item.querySelector('.op-edu-date');
        const major = item.querySelector('.op-edu-major');
        const list = item.querySelector('.op-edu-list');
        let separate = false;
        if (date && major){
          separate = date !== major && !(date.contains(major) || major.contains(date)) &&
            date.compareDocumentPosition(major) === Node.DOCUMENT_POSITION_FOLLOWING;
        }
        return {
          schoolText: school ? school.textContent : null,
          schoolWeight: school ? getComputedStyle(school).fontWeight : null,
          dateText: date ? date.textContent : null,
          majorText: major ? major.textContent : null,
          hasLine: !!line,
          separate: separate,
          listText: list ? list.textContent : null
        };
      })()`);
      if (!v) throw new Error('未找到教育经历条目');
      if (v.schoolText !== '北京大学') throw new Error('学校错误: ' + v.schoolText);
      if (v.schoolWeight !== '700' && v.schoolWeight !== 'bold') throw new Error('学校应加粗: ' + v.schoolWeight);
      if (v.dateText !== '2013.09 - 2017.06' || v.majorText !== '计算机科学与技术') throw new Error('时间/专业错误: ' + JSON.stringify(v));
      if (v.hasLine) throw new Error('不应再存在 op-edu-line 同一行容器');
      if (!v.separate) throw new Error('时间与专业应分两行排列');
      if (!v.listText || v.listText.indexOf('主修课程') < 0) throw new Error('缺少描述列表: ' + v.listText);
    });
    test('问题36 导出页增加一页提醒', async () => {
      await goModule('export');
      const v = await ev(`(() => {
        const tip = document.querySelector('.export-tip');
        if (!tip) return null;
        return tip.textContent;
      })()`);
      if (!v) throw new Error('导出页缺少一页提醒');
      if (v.indexOf('一页') < 0 || v.indexOf('页面边距') < 0) throw new Error('提醒文案不完整: ' + v);
    });
    test('问题38 默认模板为经典模板且默认边距为上10右12下10左12', async () => {
      await ev('__APP__.resetAllData()', true);
      await sleep(200);
      const v = await ev(`(() => {
        const r = __APP__.getCurrent();
        const p = document.getElementById('resume-page');
        return { tpl: r.templateId, pad: r.style.pagePadding, t: p.style.getPropertyValue('--pad-top'), r2: p.style.getPropertyValue('--pad-right'), b: p.style.getPropertyValue('--pad-bottom'), l: p.style.getPropertyValue('--pad-left') };
      })()`);
      if (v.tpl !== 'bizblue') throw new Error('默认模板应为经典模板: ' + v.tpl);
      if (v.pad.top !== 10 || v.pad.right !== 12 || v.pad.bottom !== 10 || v.pad.left !== 12) throw new Error('默认边距错误: ' + JSON.stringify(v.pad));
      if (v.t !== '10mm' || v.r2 !== '12mm' || v.b !== '10mm' || v.l !== '12mm') throw new Error('预览边距变量错误: ' + JSON.stringify(v));
    });
    test('问题39 导出 Word（.docx）', async () => {
      await ev('__APP__.resetAllData()', true);
      await ev(`__APP__.setByPath('basic.name','张三'); __APP__.addEntry('work'); __APP__.setByPath('work.0.company','字节跳动'); __APP__.afterChange(); true`);
      await goModule('export');
      const btn = await ev('!!document.querySelector("[data-action=\\"export-word\\"]")');
      if (!btn) throw new Error('缺少导出 Word 按钮');
      const v = await ev(`(() => {
        const bytes = __APP__.buildDocxBytes(__APP__.getCurrent());
        const magic = String.fromCharCode.apply(null, bytes.subarray(0, 4));
        const text = new TextDecoder().decode(bytes);
        return { magic: magic, hasName: text.indexOf('张三') >= 0, hasCompany: text.indexOf('字节跳动') >= 0, hasDoc: text.indexOf('word/document.xml') >= 0 };
      })()`);
      if (v.magic !== 'PK\u0003\u0004') throw new Error('导出不是合法 ZIP: ' + JSON.stringify(v.magic));
      if (!v.hasName || !v.hasCompany || !v.hasDoc) throw new Error('Word 内容缺失: ' + JSON.stringify(v));
      await ev(`__APP__.setByPath('basic.photo', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='); __APP__.afterChange(); true`);
      const v2 = await ev(`(() => {
        const bytes = __APP__.buildDocxBytes(__APP__.getCurrent());
        const text = new TextDecoder().decode(bytes);
        return { hasMedia: text.indexOf('word/media/image1.png') >= 0, hasEmbed: text.indexOf('r:embed="rIdImg1"') >= 0 };
      })()`);
      if (!v2.hasMedia || !v2.hasEmbed) throw new Error('Word 未嵌入照片: ' + JSON.stringify(v2));
      await ev(`(() => { document.querySelector('[data-action="export-word"]').click(); return true; })()`);
      await sleep(400);
      const toast = await ev('document.getElementById("toast").textContent');
      if (toast.indexOf('Word 文档已导出') < 0) throw new Error('点击导出 Word 后未出现提示: ' + toast);
    });
    await runAll();
  } finally {
    await b.close();
  }
})().catch(e => { console.error('E2E 运行失败: ' + e.message); process.exit(1); });