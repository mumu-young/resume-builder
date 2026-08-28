'use strict';
const path = require('path');
const { launchBrowser } = require('../lib/browser');
const { test, runAll } = require('../lib/suite');

(async () => {
  const b = await launchBrowser();
  const indexUrl = b.fileUrl(path.join(__dirname, '..', '..', '简历工坊.html'));
  try {
    await b.cdp.navigate(indexUrl);
    await b.cdp.waitFor('document.getElementById("app") !== null');

    test('加载遮罩与主容器存在', async () => {
      const v = await b.cdp.eval('document.getElementById("loading") !== null && document.getElementById("app") !== null');
      if (!v) throw new Error('loading/app 缺失');
    });

    test('顶栏按钮齐全且带 data-action', async () => {
      const v = await b.cdp.eval(`(() => {
        const ids = ['btn-new','btn-dup','btn-rename','btn-del','btn-toggle-preview','btn-print','btn-settings'];
        return ids.every(id => { const el = document.getElementById(id); return el && el.getAttribute('data-action'); });
      })()`);
      if (!v) throw new Error('顶栏按钮缺失或缺少 data-action');
    });

    test('三栏布局元素存在', async () => {
      const v = await b.cdp.eval('document.getElementById("module-nav") && document.getElementById("editor") && document.getElementById("preview-pane") && document.getElementById("resume-page")');
      if (!v) throw new Error('侧栏/编辑区/预览区缺失');
    });

    test('隐藏文件输入与 toast 存在', async () => {
      const v = await b.cdp.eval('document.getElementById("import-file") && document.getElementById("photo-file") && document.getElementById("toast")');
      if (!v) throw new Error('import-file/photo-file/toast 缺失');
    });

    await runAll();
  } finally {
    await b.close();
  }
})().catch(e => { console.error('E2E 运行失败: ' + e.message); process.exit(1); });