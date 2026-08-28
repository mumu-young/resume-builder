'use strict';
(function(){
  function $(s){ return document.querySelector(s); }
  function $$(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }

  var DEFAULT_SETTINGS = { theme: 'light', fontSize: 14, defaultTemplate: 'bizblue', lastResumeId: null };

  var MODULES = [
    { id: 'basic', icon: '👤', name: '基础信息' },
    { id: 'education', icon: '🎓', name: '教育经历' },
    { id: 'work', icon: '💼', name: '实习/工作经历' },
    { id: 'projects', icon: '🚀', name: '项目经验' },
    { id: 'skills', icon: '🛠️', name: '专业技能' },
    { id: 'honors', icon: '🏅', name: '荣誉证书 & 附加信息' },
    { id: 'profile', icon: '📝', name: '个人简介 / 自我评价' },
    { id: 'sections', icon: '🗂️', name: '模块排序' },
    { id: 'templates', icon: '🎨', name: '模板中心' },
    { id: 'margins', icon: '📐', name: '页面边距' },
    { id: 'export', icon: '🖨️', name: '导出与打印' },
    { id: 'data', icon: '💾', name: '本地数据管理' },
    { id: 'tools', icon: '🧰', name: '实用小工具' },
    { id: 'settings', icon: '⚙️', name: '全局系统设置' }
  ];

  var state = {
    resumes: [], currentId: null, settings: null, module: 'basic',
    activeEntry: null, previewVisible: true, lastSavedAt: null, dirty: false, ready: false
  };

  function current(){
    for (var i = 0; i < state.resumes.length; i++) if (state.resumes[i].id === state.currentId) return state.resumes[i];
    return null;
  }
  function data(){ var r = current(); return r ? r.data : null; }

  function newResumeData(){
    return {
      basic: { name: '', phone: '', email: '', location: '', target: '', years: '', age: '', summary: '', photo: '', photoShape: 'rect', contactSeparator: '|', targetLabel: true, showLabels: { age: true, phone: true, email: true, location: true, years: true } },
      education: [], work: [], projects: [], skills: [],
      honors: { items: [], extra: '' },
      profile: ''
    };
  }
  function newResume(title){
    return {
      id: uid(), title: title || '未命名简历', updatedAt: Date.now(),
      templateId: (state.settings && state.settings.defaultTemplate) || 'clean',
      sectionOrder: DEFAULT_SECTION_ORDER.slice(),
      sectionTitles: Object.assign({}, DEFAULT_SECTION_TITLES),
      style: { titleColor: DEFAULT_TITLE_COLOR, lineColor: DEFAULT_LINE_COLOR, lineWidth: 2, showLines: true, pagePadding: { top: 10, right: 12, bottom: 10, left: 12 } },
      data: newResumeData()
    };
  }
  function normalizeResume(r){
    if (!r || typeof r !== 'object' || !r.id) return null;
    r.data = r.data || {};
    var b = r.data.basic = r.data.basic || {};
    ['name','phone','email','location','target','years','age','summary','photo','photoShape'].forEach(function(k){ if (b[k] === undefined) b[k] = ''; });
    if (b.photoShape !== 'round') b.photoShape = 'rect';
    if (b.contactSeparator !== '·' && b.contactSeparator !== ' ') b.contactSeparator = '|';
    if (b.targetLabel === undefined) b.targetLabel = true;
    b.showLabels = Object.assign({}, { age: true, phone: true, email: true, location: true, years: true }, b.showLabels || {});
    delete b.gender;
    delete b.birthYear;
    ['education','work','projects','skills'].forEach(function(k){ if (!Array.isArray(r.data[k])) r.data[k] = []; });
    var h = r.data.honors = r.data.honors || {};
    if (!Array.isArray(h.items)) h.items = [];
    if (h.extra === undefined) h.extra = '';
    if (r.data.profile === undefined){ r.data.profile = b.summary || ''; b.summary = ''; }
    if (typeof r.data.profile !== 'string') r.data.profile = String(r.data.profile == null ? '' : r.data.profile);
    if (!r.templateId) r.templateId = 'bizblue';
    if (r.updatedAt === undefined) r.updatedAt = Date.now();
    if (!Array.isArray(r.sectionOrder) || !r.sectionOrder.length) r.sectionOrder = DEFAULT_SECTION_ORDER.slice();
    if (r.sectionOrder.indexOf('profile') < 0){
      var _pi = r.sectionOrder.indexOf('honors');
      r.sectionOrder.splice(_pi >= 0 ? _pi + 1 : r.sectionOrder.length, 0, 'profile');
    }
    r.sectionTitles = Object.assign({}, DEFAULT_SECTION_TITLES, r.sectionTitles || {});
    r.style = Object.assign({}, { titleColor: DEFAULT_TITLE_COLOR, lineColor: DEFAULT_LINE_COLOR }, r.style || {});
    if (!r.style.pagePadding || typeof r.style.pagePadding !== 'object') r.style.pagePadding = {};
    ['top', 'right', 'bottom', 'left'].forEach(function(k){
      if (typeof r.style.pagePadding[k] !== 'number') r.style.pagePadding[k] = (k === 'left' || k === 'right') ? 12 : 10;
    });
    if (typeof r.style.lineWidth !== 'number') r.style.lineWidth = 2;
    if (r.style.showLines === undefined) r.style.showLines = true;
    return r;
  }

  /* ============ 启动 ============ */
  function init(){
    Storage.init().then(function(){ return Storage.loadSettings(); })
      .then(function(s){ state.settings = Object.assign({}, DEFAULT_SETTINGS, s || {}); return Storage.loadResumes(); })
      .then(function(list){
        state.resumes = (list || []).map(normalizeResume).filter(Boolean);
        if (!state.resumes.length){
          var r = newResume('我的第一份简历');
          state.resumes.push(r);
          Storage.saveResume(r);
        }
        var last = state.settings.lastResumeId;
        state.currentId = last && state.resumes.some(function(r){ return r.id === last; }) ? last : state.resumes[0].id;
        bind();
        applyTheme();
        renderAll();
        state.ready = true;
        $('#loading').classList.add('hidden');
        $('#app').classList.remove('hidden');
      });
  }

  /* ============ 渲染总入口 ============ */
  function renderAll(){
    renderNav();
    renderResumeSelect();
    renderTitle();
    renderModule();
    renderPreview();
    updateWordBadge();
    updateSaveStatus();
  }
  function renderNav(){
    $('#module-nav').innerHTML = MODULES.map(function(m){
      return '<button class="nav-item' + (state.module === m.id ? ' active' : '') + '" data-action="set-module" data-id="' + m.id + '">' +
        '<span class="nav-icon">' + m.icon + '</span><span class="nav-name">' + m.name + '</span></button>';
    }).join('');
  }
  function renderResumeSelect(){
    var sel = $('#resume-select');
    sel.innerHTML = state.resumes.map(function(r){
      return '<option value="' + r.id + '"' + (r.id === state.currentId ? ' selected' : '') + '>' + esc(r.title || '未命名') + '</option>';
    }).join('');
  }
  function renderTitle(){
    var r = current();
    var t = r ? r.title : '未命名简历';
    $('#resume-title').textContent = t;
    document.title = t + ' - 简历工坊';
  }
  function updateSaveStatus(msg){
    var el = $('#save-status');
    if (!el) return;
    if (msg) el.textContent = msg;
    else el.textContent = state.lastSavedAt ? '已保存 ' + fileTimestamp(state.lastSavedAt) : '';
  }

  /* ============ 表单构建 ============ */
  function field(label, inner, extra){
    return '<div class="field' + (extra ? ' ' + extra : '') + '"><label>' + label + '</label>' + inner + '</div>';
  }
  function inputEl(path, value, type, placeholder){
    return '<input type="' + (type || 'text') + '" data-path="' + path + '" value="' + esc(value) + '" placeholder="' + esc(placeholder || '') + '">';
  }
  function textareaEl(path, value, rows, placeholder){
    return '<textarea data-path="' + path + '" rows="' + (rows || 3) + '" placeholder="' + esc(placeholder || '') + '">' + esc(value) + '</textarea>';
  }
  function selectEl(attrs, value, options){
    var opts = options.map(function(o){
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(value) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
    return '<select ' + attrs + '>' + opts + '</select>';
  }
  function taWrap(path, value, rows, placeholder){
    return '<div class="ta-wrap">' + textareaEl(path, value, rows, placeholder) + '<span class="char-count"></span></div>';
  }
  function entryActions(type, idx){
    return '<span class="entry-actions">' +
      '<button type="button" class="btn btn-mini" data-action="move-entry" data-type="' + type + '" data-idx="' + idx + '" data-dir="-1" title="上移">↑</button>' +
      '<button type="button" class="btn btn-mini" data-action="move-entry" data-type="' + type + '" data-idx="' + idx + '" data-dir="1" title="下移">↓</button>' +
      '<button type="button" class="btn btn-mini danger" data-action="del-entry" data-type="' + type + '" data-idx="' + idx + '" title="删除">✕</button>' +
      '</span>';
  }
  function entryCard(type, idx, title, fieldsHtml){
    return '<div class="entry-card" data-entry-type="' + type + '" data-entry-idx="' + idx + '">' +
      '<div class="entry-head"><span class="entry-title">' + (idx + 1) + '. ' + esc(title || '') + '</span>' + entryActions(type, idx) + '</div>' +
      fieldsHtml + '</div>';
  }
  function starGuide(type, idx){
    return '<details class="star-guide"><summary>💡 STAR 写法提示（点击展开）</summary><div class="star-guide-body">' +
      '<p><b>S</b> 情境：这件事的背景是什么？<br><b>T</b> 任务：你负责的目标是什么？<br><b>A</b> 行动：你具体做了什么？<br><b>R</b> 结果：取得了什么成果（最好带数据）？</p>' +
      '<button type="button" class="btn btn-mini" data-action="insert-star" data-type="' + type + '" data-idx="' + idx + '">插入 STAR 模板到描述</button>' +
      '</div></details>';
  }  /* ============ 各模块编辑器 ============ */
  function labelChk(path, label, checked){
    return '<label class="chk"><input type="checkbox" data-path="' + path + '"' + (checked ? ' checked' : '') + '> ' + label + '</label>';
  }
  function renderBasicEditor(){
    var b = data().basic;
    var labels = b.showLabels;
    var photoHtml = b.photo
      ? '<div class="photo-box"><img src="' + b.photo + '" alt="照片"><button type="button" class="btn btn-ghost" data-action="photo-remove">移除照片</button></div>'
      : '<div class="photo-box empty"><button type="button" class="btn" data-action="pick-photo">上传照片（可选）</button><p class="muted">照片只保存在本地，不会上传</p></div>';
    return '<div class="module-head"><div><h3>基础信息</h3><p class="module-desc">这部分会固定显示在简历头部；「个人简介 / 自我评价」已独立为单独模块。</p></div></div>' +
      '<div class="form-grid">' +
      field('姓名 *', inputEl('basic.name', b.name, 'text', '你的姓名')) +
      field('电话', inputEl('basic.phone', b.phone, 'text', '手机号') + '<div class="chk-row">' + labelChk('basic.showLabels.phone', '显示标签', labels.phone) + '</div>') +
      field('邮箱', inputEl('basic.email', b.email, 'text', '邮箱') + '<div class="chk-row">' + labelChk('basic.showLabels.email', '显示标签', labels.email) + '</div>') +
      field('所在地', inputEl('basic.location', b.location, 'text', '如：上海') + '<div class="chk-row">' + labelChk('basic.showLabels.location', '显示标签', labels.location) + '</div>') +
      field('求职意向', inputEl('basic.target', b.target, 'text', '如：前端开发工程师') + '<div class="chk-row">' + labelChk('basic.targetLabel', '显示标签（求职意向：）', b.targetLabel) + '</div>') +
      field('工作年限', inputEl('basic.years', b.years, 'text', '如：3 年') + '<div class="chk-row">' + labelChk('basic.showLabels.years', '显示标签', labels.years) + '</div>') +
      field('年龄', inputEl('basic.age', b.age, 'text', '如：25') + '<div class="chk-row">' + labelChk('basic.showLabels.age', '显示标签', labels.age) + '</div>') +
      field('照片', photoHtml, 'span2') +
      field('照片形状', selectEl('data-path="basic.photoShape"', b.photoShape, [['rect', '矩形 7:9（默认）'], ['round', '圆形']])) +
      field('联系信息分隔符', selectEl('data-path="basic.contactSeparator"', b.contactSeparator, [['|', '竖线 |'], ['·', '圆点 ·'], [' ', '空白']])) +
      '</div>';
  }
  function renderProfileEditor(){
    var d = data();
    return '<div class="module-head"><div><h3>个人简介 / 自我评价</h3><p class="module-desc">用 1-3 句话概括你的优势与求职亮点，将作为独立模块展示在简历中。</p></div></div>' +
      '<div class="form-grid">' +
      field('个人简介 / 自我评价', taWrap('profile', d.profile, 6, '用 1-3 句话概括你的优势，例如：X 年经验、擅长 XX、成果 YY'), 'span2') +
      '</div>';
  }
  function fieldsEducation(e, idx){
    var p = function(k){ return 'education.' + idx + '.' + k; };
    return '<div class="form-grid">' +
      field('学校 *', inputEl(p('school'), e.school, 'text', '如：XX大学'), 'span2') +
      field('学历', selectEl('data-path="' + p('degree') + '"', e.degree, DEGREE_OPTIONS)) +
      field('专业', inputEl(p('major'), e.major, 'text', '如：计算机科学与技术')) +
      field('开始时间', inputEl(p('start'), e.start, 'month')) +
      field('结束时间', inputEl(p('end'), e.end, 'month')) +
      field('绩点 / GPA', inputEl(p('gpa'), e.gpa, 'text', '如：3.8/4.0')) +
      field('排名', inputEl(p('rank'), e.rank, 'text', '如：前 10%')) +
      field('相关课程', taWrap(p('courses'), e.courses, 3, '每行写一门课程，如：数据结构、操作系统'), 'span2') +
      field('描述 / 在校经历', taWrap(p('description'), e.description, 3, '可写在校活动、论文、成果等'), 'span2') +
      '</div>';
  }
  function fieldsWork(w, idx){
    var p = function(k){ return 'work.' + idx + '.' + k; };
    return '<div class="form-grid">' +
      field('公司 / 单位 *', inputEl(p('company'), w.company, 'text', '如：XX科技有限公司'), 'span2') +
      field('职位', inputEl(p('position'), w.position, 'text', '如：前端开发实习生')) +
      field('开始时间', inputEl(p('start'), w.start, 'month')) +
      field('结束时间', inputEl(p('end'), w.end, 'month')) +
      field('工作描述', taWrap(p('description'), w.description, 5, '每行写一条工作内容；建议用 STAR 结构：情境→任务→行动→结果'), 'span2') +
      starGuide('work', idx) +
      '</div>';
  }
  function fieldsProject(pj, idx){
    var p = function(k){ return 'projects.' + idx + '.' + k; };
    return '<div class="form-grid">' +
      field('项目名称 *', inputEl(p('name'), pj.name, 'text', '如：校园二手交易平台'), 'span2') +
      field('担任角色', inputEl(p('role'), pj.role, 'text', '如：后端开发 / 项目负责人')) +
      field('开始时间', inputEl(p('start'), pj.start, 'month')) +
      field('结束时间', inputEl(p('end'), pj.end, 'month')) +
      field('技术栈', inputEl(p('tech'), pj.tech, 'text', '如：Vue 3、Node.js、MySQL')) +
      field('项目链接', inputEl(p('link'), pj.link, 'text', '如：github.com/xxx')) +
      field('项目描述', taWrap(p('description'), pj.description, 5, '每行写一条：项目背景、你的职责、技术难点、成果数据'), 'span2') +
      starGuide('projects', idx) +
      '</div>';
  }
  function fieldsSkill(k, idx){
    var p = function(kk){ return 'skills.' + idx + '.' + kk; };
    return '<div class="form-grid">' +
      field('分类', inputEl(p('category'), k.category, 'text', '如：编程语言 / 前端框架 / 工具')) +
      field('内容', taWrap(p('items'), k.items, 3, '每行一项，如：Python、Vue.js'), 'span2') +
      '</div>';
  }
  var LIST_CONFIG = {
    education: { head: '教育经历', addLabel: '＋ 添加教育经历', hint: '填写你的学校、专业、学历与时间。', empty: '还没有教育经历，点右上角「添加教育经历」。', title: function(e){ return e.school || e.major || '教育经历'; }, fields: fieldsEducation },
    work: { head: '实习/工作经历', addLabel: '＋ 添加实习/工作经历', hint: '求职核心：建议按 STAR 结构描述工作内容。', empty: '还没有经历，点右上角添加一条。', title: function(w){ return w.company || '实习/工作经历'; }, fields: fieldsWork },
    projects: { head: '项目经验', addLabel: '＋ 添加项目经验', hint: '技术岗重中之重：写清职责、技术难点与成果。', empty: '还没有项目，点右上角添加一个。', title: function(p){ return p.name || '项目经验'; }, fields: fieldsProject },
    skills: { head: '专业技能', addLabel: '＋ 添加技能分类', hint: '按分类填写，每行一项。', empty: '还没有技能，点右上角添加分类。', title: function(k){ return k.category || '技能分类'; }, fields: fieldsSkill }
  };
  function renderListEditor(type){
    var cfg = LIST_CONFIG[type];
    var d = data();
    var list = d[type] || [];
    var cards = list.map(function(item, idx){ return entryCard(type, idx, cfg.title(item), cfg.fields(item, idx)); }).join('');
    return '<div class="module-head"><div><h3>' + cfg.head + '</h3><p class="module-desc">' + cfg.hint + '</p></div>' +
      '<button class="btn btn-primary" data-action="add-entry" data-type="' + type + '">' + cfg.addLabel + '</button></div>' +
      (cards || '<div class="empty-hint">' + cfg.empty + '</div>');
  }
  function renderHonorsEditor(){
    var h = data().honors;
    var cards = h.items.map(function(item, idx){
      return entryCard('honor', idx, item.title || '荣誉/证书',
        '<div class="form-grid">' +
        field('名称', inputEl('honors.items.' + idx + '.title', item.title, 'text', '如：国家奖学金')) +
        field('年份', inputEl('honors.items.' + idx + '.year', item.year, 'text', '如：2023')) +
        field('说明', taWrap('honors.items.' + idx + '.description', item.description, 2, '可选：颁发机构 / 说明'), 'span2') +
        '</div>');
    }).join('');
    return '<div class="module-head"><div><h3>荣誉证书 & 附加信息</h3><p class="module-desc">奖项、证书，以及语言、兴趣爱好等补充信息。</p></div>' +
      '<button class="btn btn-primary" data-action="add-entry" data-type="honor">＋ 添加荣誉/证书</button></div>' +
      (cards || '<div class="empty-hint">还没有荣誉或证书，点右上角添加。</div>') +
      '<div class="form-grid"><div class="field span2" style="margin-top:10px">' +
      field('其他信息（语言 / 兴趣爱好 / 自我补充）', taWrap('honors.extra', h.extra, 4, '例如：英语：CET-6，可日常交流；兴趣爱好：摄影、羽毛球'), '') +
      '</div></div>';
  }
  function miniThumb(id){
    if (id === 'clean') return '<div class="mini mini-clean"><div class="m-bar"></div><div class="m-line w70"></div><div class="m-line w40"></div><div class="m-line w90"></div><div class="m-line w60"></div></div>';
    if (id === 'classic') return '<div class="mini mini-classic"><div class="m-side"></div><div class="m-main"><div class="m-line w80"></div><div class="m-line w50"></div><div class="m-line w70"></div></div></div>';
    if (id === 'modern') return '<div class="mini mini-modern"><div class="m-band"></div><div class="m-line w70"></div><div class="m-line w40"></div><div class="m-line w90"></div><div class="m-line w60"></div></div>';
    if (id === 'elegant') return '<div class="mini mini-elegant"><div class="m-bar"></div><div class="m-line w50 m-center"></div><div class="m-line w70 m-center"></div><div class="m-line w90"></div><div class="m-line w60"></div></div>';
    if (id === 'compact') return '<div class="mini mini-compact"><div class="m-bar"></div><div class="m-line w80"></div><div class="m-line w60"></div><div class="m-line w90"></div><div class="m-line w50"></div></div>';
    if (id === 'bizblue') return '<div class="mini mini-bizblue"><div class="m-band"></div><div class="m-rows"><div class="m-line"></div><div class="m-line"></div></div><div class="m-line w80"></div><div class="m-line w90"></div></div>';
    if (id === 'open') return '<div class="mini mini-open"><div class="m-side"></div><div class="m-main"><div class="m-line w80"></div><div class="m-line w60"></div><div class="m-line w90"></div></div></div>';
    if (id === 'titlebg') return '<div class="mini mini-titlebg"><div class="m-band"></div><div class="m-rows"><div class="m-line"></div><div class="m-line"></div></div><div class="m-line w80"></div><div class="m-line w90"></div></div>';
    if (id === 'titlebglight') return '<div class="mini mini-titlebglight"><div class="m-band-light"></div><div class="m-rows"><div class="m-line"></div><div class="m-line"></div></div><div class="m-line w80"></div><div class="m-line w90"></div></div>';
    return '<div class="mini"><div class="m-bar"></div><div class="m-line w70"></div><div class="m-line w40"></div><div class="m-line w90"></div></div>';
  }
  function renderTemplatesModule(){
    var r = current();
    return '<div class="module-head"><div><h3>模板中心</h3><p class="module-desc">选择一套模板，简历预览会立即切换样式，可随时更换。</p></div></div>' +
      '<div class="tpl-grid">' + TEMPLATES.map(function(t){
        var selected = r.templateId === t.id;
        return '<div class="tpl-card' + (selected ? ' selected' : '') + '" data-action="apply-template" data-id="' + t.id + '">' +
          '<div class="tpl-thumb tpl-thumb-' + t.id + '">' + miniThumb(t.id) + '</div>' +
          '<div class="tpl-card-name">' + t.name + '</div>' +
          '<div class="tpl-card-desc">' + t.desc + '</div>' +
          (selected ? '<div class="tpl-card-badge">当前使用</div>' : '') +
          '</div>';
      }).join('') + '</div>';
  }

  function renderExportModule(){
    return '<div class="module-head"><div><h3>导出与打印</h3><p class="module-desc">第一版支持导出 PDF（通过浏览器打印功能）。</p></div></div>' +
      '<div class="export-tip"><span class="export-tip-icon">💡</span><div><b>一页放不下？</b>如果导出后发现内容超出一页，可到左侧「页面边距」调小上下左右留白，或适当精简内容，让简历保持在一页内、观感更清爽。</div></div>' +
      '<div class="tool-card"><h4>🖨️ 导出 PDF</h4><p>点击下方按钮打开打印窗口，按以下设置即可生成 PDF：</p>' +
      '<ul class="tips"><li>目标打印机：另存为 PDF</li><li>纸张大小：A4</li><li>边距：无（简历本身已带边距）</li><li>勾选「背景图形 / 背景颜色」以保留模板配色</li></ul>' +
      '<button class="btn btn-primary" data-action="export-pdf">🖨️ 导出 PDF（打印）</button></div>' +
      '<div class="tool-card"><h4>📄 导出 Word（.docx）</h4>' +
      '<p>生成可在 Word 中继续编辑的文档（A4、边距跟随「页面边距」设置、微软雅黑字体）。</p>' +
      '<button class="btn btn-primary" data-action="export-word">📄 导出 Word（.docx）</button></div>';
  }
  function renderDataModule(){
    var modeText = Storage.mode() === 'idb' ? '浏览器本地数据库（IndexedDB）' : '浏览器本地存储（localStorage）';
    var lastText = state.lastSavedAt ? fileTimestamp(state.lastSavedAt) : '—';
    return '<div class="module-head"><div><h3>本地数据管理</h3><p class="module-desc">你的数据只保存在这台电脑上，完全离线。</p></div></div>' +
      '<div class="tool-card"><h4>💾 数据存储</h4>' +
      '<p>所有内容实时自动保存到本机浏览器，刷新、关闭、重启都不会丢失；不会上传到任何服务器。</p>' +
      '<p class="storage-info">存储方式：' + modeText + ' ｜ 简历数量：' + state.resumes.length + ' ｜ 上次保存：' + lastText + '</p>' +
      '<p class="muted">小贴士：浏览器数据可能因清理缓存而丢失，建议定期导出备份文件。</p></div>' +
      '<div class="tool-card actions">' +
      '<button class="btn btn-primary" data-action="export-backup">⬇️ 导出全部数据备份（JSON）</button>' +
      '<button class="btn" data-action="pick-import">⬆️ 导入备份文件（合并）</button>' +
      '<button class="btn btn-danger" data-action="reset-all" id="btn-reset">🗑️ 清空所有数据</button>' +
      '</div>';
  }
  function tipText(total){
    if (total <= 800) return '🟢 一页排版比较轻松，观感舒适。';
    if (total <= 1200) return '🟡 一页稍紧凑，建议适当精简。';
    return '🔴 内容偏多，建议精简到一页以内，突出与岗位最相关的内容。';
  }
  function renderToolsModule(){
    var stats = resumeStats();
    var secNames = { basic: '基础信息', education: '教育经历', work: '实习/工作', projects: '项目经验', skills: '专业技能', honors: '荣誉/其他', profile: '个人简介' };
    var rows = Object.keys(stats.sections).map(function(k){
      return '<div class="wc-row" data-sec="' + k + '"><span>' + secNames[k] + '</span><span class="wc-num" data-sec="' + k + '">' + stats.sections[k] + '</span></div>';
    }).join('');
    var r = current();
    return '<div class="module-head"><div><h3>实用小工具</h3><p class="module-desc">帮你把经历写得更专业、控制简历长度。</p></div></div>' +
      '<div class="tool-card"><h4>📝 STAR 写作助手</h4>' +
      '<p>按「情境 → 任务 → 行动 → 结果」组织经历，先填四个要素，再生成描述，可插入到正在编辑的经历里。</p>' +
      '<div class="form-grid">' +
      field('S 情境（背景 / 问题）', '<textarea id="star-s" rows="2" placeholder="例如：平台日活增长，旧系统接口响应慢、用户投诉多"></textarea>') +
      field('T 任务（你的目标）', '<textarea id="star-t" rows="2" placeholder="例如：负责接口性能优化，目标把响应时间降低 50%"></textarea>') +
      field('A 行动（你做的事）', '<textarea id="star-a" rows="2" placeholder="例如：引入缓存、优化 SQL、重构热点接口，并压测验证"></textarea>') +
      field('R 结果（量化成果）', '<textarea id="star-r" rows="2" placeholder="例如：接口平均响应从 800ms 降到 200ms，线上故障下降 60%"></textarea>') +
      '</div>' +
      '<div class="ta-wrap"><textarea id="star-out" rows="4" readonly placeholder="生成的描述会出现在这里，然后可复制或插入到经历中"></textarea></div>' +
      '<div class="btn-row">' +
      '<button class="btn btn-primary" data-action="star-gen">生成 STAR 描述</button>' +
      '<button class="btn" data-action="star-copy">复制</button>' +
      '<button class="btn" data-action="star-insert">插入到当前经历</button>' +
      '</div>' +
      '<p class="muted">插入前，请先在左侧「实习/工作经历」或「项目经验」里点一下某条内容的描述输入框。</p></div>' +
      '<div class="tool-card" id="word-panel"><h4>🔢 字数统计</h4>' +
      '<p>当前简历「' + esc((r && r.title) || '') + '」共约 <b class="wc-total">' + stats.total + '</b> 字（不含空格标点：<span class="wc-nospace">' + stats.noSpace + '</span> 字）。</p>' +
      '<div class="wc-list">' + rows + '</div>' +
      '<p class="wc-tip">' + tipText(stats.total) + '</p></div>';
  }
  var SECTION_META = [
    { id: 'education', name: '教育经历' },
    { id: 'work', name: '实习/工作经历' },
    { id: 'projects', name: '项目经验' },
    { id: 'skills', name: '专业技能' },
    { id: 'honors', name: '荣誉证书' },
    { id: 'profile', name: '个人简介 / 自我评价' },
    { id: 'extra', name: '其他信息' }
  ];
  var TITLE_COLORS = ['#000000', '#1f2937', '#475569', '#2563eb', '#16a34a', '#ea580c', '#9333ea', '#dc2626', '#0d9488', '#ca8a04'];
  var LINE_COLORS = ['#000000', '#1f2937', '#374151', '#6b7280', '#9ca3af', '#cbd5e1', '#1d4ed8', '#15803d', '#c2410c', '#7e22ce', '#b91c1c', '#0f766e', '#a16207', '#334155'];
  function renderSectionsModule(){
    var r = current();
    var showLines = r.style.showLines !== false;
    var orderRows = r.sectionOrder.map(function(id, idx){
      var meta = null;
      for (var i = 0; i < SECTION_META.length; i++) if (SECTION_META[i].id === id) meta = SECTION_META[i];
      return '<div class="sec-order-row">' +
        '<span class="sec-order-name">' + esc((meta && meta.name) || id) + '</span>' +
        '<button type="button" class="btn btn-mini" data-action="move-section" data-idx="' + idx + '" data-dir="-1" title="上移">↑</button>' +
        '<button type="button" class="btn btn-mini" data-action="move-section" data-idx="' + idx + '" data-dir="1" title="下移">↓</button>' +
        '</div>';
    }).join('');
    var titleSwatches = TITLE_COLORS.map(function(c){
      return '<button type="button" class="swatch' + (r.style.titleColor === c ? ' active' : '') + '" style="background:' + c + '" data-action="set-title-color" data-color="' + c + '" title="' + c + '"></button>';
    }).join('');
    var lineSwatches = LINE_COLORS.map(function(c){
      return '<button type="button" class="swatch-line' + (r.style.lineColor === c ? ' active' : '') + '" style="background:' + c + '" data-action="set-line-color" data-color="' + c + '" title="' + c + '"' + (showLines ? '' : ' disabled') + '></button>';
    }).join('');
    var lineWidthBtns = [1, 2, 3, 4].map(function(w){
      return '<button class="btn btn-mini' + (r.style.lineWidth === w ? ' btn-primary' : '') + '" data-action="set-line-width" data-width="' + w + '"' + (showLines ? '' : ' disabled') + '>' + w + 'px</button>';
    }).join('');
    var titleInputs = SECTION_META.map(function(m){
      return field(m.name + ' 小标题',
        '<input type="text" data-stitle="' + m.id + '" value="' + esc(r.sectionTitles[m.id]) + '" placeholder="' + esc(DEFAULT_SECTION_TITLES[m.id]) + '">');
    }).join('');
    return '<div class="module-head"><div><h3>模块排序</h3><p class="module-desc">调整各模块在简历中的排列顺序，编辑小标题内容，并选择小标题与分割线颜色（低饱和度配色）。</p></div></div>' +
      '<div class="tool-card"><h4>🗂️ 模块排列顺序</h4>' + orderRows +
      '<button class="btn btn-mini" data-action="reset-section-style">↺ 恢复默认顺序与颜色</button></div>' +
      '<div class="tool-card"><h4>✏️ 小标题内容</h4><div class="form-grid">' + titleInputs + '</div>' +
      '<p class="muted">修改后立即同步到简历预览；留空则使用默认标题。</p></div>' +
      '<div class="tool-card"><h4>🎨 小标题颜色</h4><div class="swatches">' + titleSwatches + '</div>' +
      '<p class="muted">当前：' + esc(r.style.titleColor) + '</p></div>' +
      '<div class="tool-card"><h4>➖ 分割线设置</h4>' +
      '<label class="chk"><input type="checkbox" data-sstyle="showLines"' + (showLines ? ' checked' : '') + '> 显示分割线</label>' +
      '<p class="muted">关闭后所有模板中的横线将隐藏。</p>' +
      '<div class="color-group">分割线颜色</div><div class="swatches">' + lineSwatches + '</div>' +
      (showLines ? '<p class="muted">当前：' + esc(r.style.lineColor) + '</p>' : '<p class="muted">当前已隐藏分割线，开启后再设置颜色与粗细。</p>') +
      '<div class="color-group">分割线粗细</div><div class="btn-row">' + lineWidthBtns + '</div>' +
      '<p class="muted">粗细对所有模板中的横线生效（单位 px）。</p></div>';
  }
  function renderMarginsModule(){
    var r = current();
    var isOpen = r.templateId === 'open';
    var pad = r.style.pagePadding;
    function numInput(key, label){
      return field(label, '<input type="number" min="0" max="40" step="1" data-mpath="' + key + '" value="' + esc(isOpen ? 0 : pad[key]) + '"' + (isOpen ? ' disabled' : '') + '> <span class="muted">mm</span>');
    }
    var note = isOpen
      ? '<p class="muted">「开放两栏」模板边距固定为 0（通边），不可调节，与其他模板的边距设置相互独立。</p>'
      : '<p class="muted">修改即时生效，打印时按同样边距输出。</p>';
    return '<div class="module-head"><div><h3>页面边距</h3><p class="module-desc">调整简历上下左右的留白（单位：毫米）。</p></div></div>' +
      '<div class="tool-card"><h4>📐 上下左右边距</h4><div class="form-grid">' +
      numInput('top', '上边距') + numInput('right', '右边距') + numInput('bottom', '下边距') + numInput('left', '左边距') +
      '</div><div class="btn-row">' +
      '<button class="btn" data-action="margin-preset" data-preset="none"' + (isOpen ? ' disabled' : '') + '>无空白（全部 0）</button>' +
      '<button class="btn" data-action="margin-preset" data-preset="default"' + (isOpen ? ' disabled' : '') + '>默认（上10 右12 下10 左12）</button>' +
      '</div>' + note + '</div>';
  }
  function applyMarginPreset(preset){
    var r = current();
    if (!r) return;
    if (r.templateId === 'open'){ showToast('「开放两栏」模板边距固定为 0，不可调节'); return; }
    if (preset === 'none') r.style.pagePadding = { top: 0, right: 0, bottom: 0, left: 0 };
    else r.style.pagePadding = { top: 10, right: 12, bottom: 10, left: 12 };
    afterChange();
    renderModule();
    renderPreview();
  }
  function renderSettingsModule(){
    var s = state.settings;
    return '<div class="module-head"><div><h3>全局系统设置</h3><p class="module-desc">设置会保存到本机，下次打开仍然生效。</p></div></div>' +
      '<div class="tool-card"><h4>外观与排版</h4><div class="form-grid">' +
      field('界面主题', selectEl('data-spath="theme"', s.theme, [['light', '浅色'], ['dark', '深色']])) +
      field('简历正文字号', '<input type="number" min="10" max="20" step="1" data-spath="fontSize" value="' + esc(s.fontSize) + '"> <span class="muted">（10-20px）</span>') +
      field('新简历默认模板', selectEl('data-spath="defaultTemplate"', s.defaultTemplate, TEMPLATES.map(function(t){ return [t.id, t.name]; }))) +
      '</div></div>' +
      '<div class="tool-card"><h4>关于</h4>' +
      '<p>简历工坊 v1.0 ｜ 纯本地运行：无登录、无联网、无云存储。数据仅保存在本机浏览器中。</p></div>';
  }
  function renderModule(){
    var el = $('#editor');
    var r = current();
    if (!r){ el.innerHTML = '<div class="empty-hint">请先新建一份简历。</div>'; return; }
    var html = '';
    switch (state.module){
      case 'basic': html = renderBasicEditor(); break;
      case 'education': html = renderListEditor('education'); break;
      case 'work': html = renderListEditor('work'); break;
      case 'projects': html = renderListEditor('projects'); break;
      case 'skills': html = renderListEditor('skills'); break;
      case 'honors': html = renderHonorsEditor(); break;
      case 'profile': html = renderProfileEditor(); break;
      case 'sections': html = renderSectionsModule(); break;
      case 'templates': html = renderTemplatesModule(); break;
      case 'margins': html = renderMarginsModule(); break;
      case 'export': html = renderExportModule(); break;
      case 'data': html = renderDataModule(); break;
      case 'tools': html = renderToolsModule(); break;
      case 'settings': html = renderSettingsModule(); break;
    }
    el.innerHTML = html;
    updateInlineCounts();
  }  /* ============ 预览与字数 ============ */
  function renderPreview(){
    var page = $('#resume-page');
    if (!page) return;
    page.style.setProperty('--tpl-fs', (parseInt(state.settings.fontSize, 10) || 14) + 'px');
    var r = current();
    if (r){
      var pad;
      if (r.templateId === 'open') pad = { top: 0, right: 0, bottom: 0, left: 0 };
      else pad = r.style.pagePadding || { top: 10, right: 12, bottom: 10, left: 12 };
      page.style.setProperty('--pad-top', (pad.top || 0) + 'mm');
      page.style.setProperty('--pad-right', (pad.right || 0) + 'mm');
      page.style.setProperty('--pad-bottom', (pad.bottom || 0) + 'mm');
      page.style.setProperty('--pad-left', (pad.left || 0) + 'mm');
      page.style.setProperty('--tpl-line-width', (r.style.showLines === false ? 0 : (r.style.lineWidth || 2)) + 'px');
    }
    if (!r){ page.innerHTML = '<div class="empty-tip">请先新建一份简历。</div>'; return; }
    var t = getTemplate(r.templateId);
    page.innerHTML = t.render(r.data, {
      sectionOrder: r.sectionOrder,
      sectionTitles: r.sectionTitles,
      titleColor: r.style.titleColor,
      lineColor: r.style.lineColor
    });
  }
  function resumeStats(){
    var d = data();
    var empty = { sections: { basic: 0, education: 0, work: 0, projects: 0, skills: 0, honors: 0, profile: 0 }, total: 0, noSpace: 0 };
    if (!d) return empty;
    var sec = { basic: 0, education: 0, work: 0, projects: 0, skills: 0, honors: 0, profile: 0 };
    var no = { basic: 0, education: 0, work: 0, projects: 0, skills: 0, honors: 0, profile: 0 };
    function add(name, arr){
      arr.forEach(function(v){
        var st = textStats(v);
        sec[name] += st.total;
        no[name] += st.noSpace;
      });
    }
    var b = d.basic;
    add('basic', [b.name, b.phone, b.email, b.location, b.target, b.years, b.age]);
    add('profile', [d.profile]);
    d.education.forEach(function(e){ add('education', [e.school, e.degree, e.major, e.start, e.end, e.gpa, e.rank, e.courses, e.description]); });
    d.work.forEach(function(w){ add('work', [w.company, w.position, w.start, w.end, w.description]); });
    d.projects.forEach(function(p){ add('projects', [p.name, p.role, p.start, p.end, p.tech, p.link, p.description]); });
    d.skills.forEach(function(k){ add('skills', [k.category, k.items]); });
    d.honors.items.forEach(function(h){ add('honors', [h.title, h.year, h.description]); });
    add('honors', [d.honors.extra]);
    var total = 0, noSpace = 0;
    Object.keys(sec).forEach(function(k){ total += sec[k]; noSpace += no[k]; });
    return { sections: sec, total: total, noSpace: noSpace };
  }
  function updateWordBadge(){
    var el = $('#wc-badge');
    if (el) el.textContent = '约 ' + resumeStats().total + ' 字';
  }
  function updateWordPanel(){
    var panel = $('#word-panel');
    if (!panel) return;
    var st = resumeStats();
    var te = panel.querySelector('.wc-total'); if (te) te.textContent = '' + st.total;
    var ne = panel.querySelector('.wc-nospace'); if (ne) ne.textContent = '' + st.noSpace;
    var nums = panel.querySelectorAll('.wc-num');
    for (var i = 0; i < nums.length; i++){
      var el = nums[i];
      el.textContent = '' + (st.sections[el.getAttribute('data-sec')] || 0);
    }
    var tip = panel.querySelector('.wc-tip'); if (tip) tip.textContent = tipText(st.total);
  }
  function updateInlineCounts(){
    $$('#editor .ta-wrap').forEach(function(w){
      var ta = w.querySelector('textarea');
      var cc = w.querySelector('.char-count');
      if (ta && cc) cc.textContent = '约 ' + textStats(ta.value).total + ' 字';
    });
  }

  /* ============ 变更与保存 ============ */
  function afterChange(){
    var r = current();
    if (r) r.updatedAt = Date.now();
    state.dirty = true;
    scheduleSave();
    schedulePreview();
    updateWordBadge();
    updateWordPanel();
    updateInlineCounts();
  }
  function flushSave(){
    var r = current();
    if (!r) return Promise.resolve();
    return Storage.saveResume(r).then(function(){
      state.dirty = false;
      state.lastSavedAt = new Date();
      updateSaveStatus('✓ 已自动保存 ' + fileTimestamp(state.lastSavedAt));
    });
  }
  var saveDebounced = debounce(flushSave, 500);
  function scheduleSave(){ saveDebounced(); }
  var previewDebounced = debounce(renderPreview, 120);
  function schedulePreview(){ previewDebounced(); }
  var settingsDebounced = debounce(function(){ Storage.saveSettings(state.settings); }, 300);
  function saveSettingsSoon(){ settingsDebounced(); }

  /* ============ 数据操作 ============ */
  function emptyEntry(type){
    switch (type){
      case 'education': return { id: uid(), school: '', degree: '', major: '', start: '', end: '', gpa: '', rank: '', courses: '', description: '' };
      case 'work': return { id: uid(), company: '', position: '', start: '', end: '', description: '' };
      case 'projects': return { id: uid(), name: '', role: '', start: '', end: '', tech: '', link: '', description: '' };
      case 'skills': return { id: uid(), category: '', items: '' };
      default: return { id: uid() };
    }
  }
  function listFor(type){
    var d = data();
    return type === 'honor' ? d.honors.items : d[type];
  }
  function addEntry(type){
    var d = data();
    if (type === 'honor') d.honors.items.push({ id: uid(), title: '', year: '', description: '' });
    else d[type].push(emptyEntry(type));
    afterChange();
    renderModule();
    renderPreview();
  }
  function delEntry(type, idx){
    listFor(type).splice(idx, 1);
    afterChange();
    renderModule();
    renderPreview();
  }
  function moveEntry(type, idx, dir){
    var arr = listFor(type);
    var j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    var tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
    afterChange();
    renderModule();
    renderPreview();
  }
  function setByPath(path, val){
    var segs = path.split('.');
    var obj = data();
    for (var i = 0; i < segs.length - 1; i++){
      var s = segs[i];
      obj = /^\d+$/.test(s) ? obj[+s] : obj[s];
    }
    var last = segs[segs.length - 1];
    if (/^\d+$/.test(last)) obj[+last] = val; else obj[last] = val;
  }
  function setSettingsByPath(path, val){
    var segs = path.split('.');
    var obj = state.settings;
    for (var i = 0; i < segs.length - 1; i++) obj = obj[segs[i]];
    obj[segs[segs.length - 1]] = val;
  }
  function insertStar(type, idx){
    var item = data()[type][idx];
    if (!item) return;
    var lines = '情境：\n任务：\n行动：\n结果：';
    item.description = item.description ? item.description.replace(/\s+$/, '') + '\n' + lines : lines;
    afterChange();
    renderModule();
    renderPreview();
  }

  /* ============ 多简历管理 ============ */
  function newResumeAction(){
    var r = newResume('简历 ' + (state.resumes.length + 1));
    state.resumes.push(r);
    state.currentId = r.id;
    state.settings.lastResumeId = r.id;
    state.dirty = true;
    renderAll();
    scheduleSave();
    saveSettingsSoon();
  }
  function duplicateResume(){
    var r = current();
    if (!r) return;
    var c = JSON.parse(JSON.stringify(r));
    c.id = uid();
    c.title = (r.title || '简历') + ' 副本';
    c.updatedAt = Date.now();
    state.resumes.push(c);
    state.currentId = c.id;
    state.settings.lastResumeId = c.id;
    renderAll();
    saveSettingsSoon();
    Storage.saveResume(c);
  }
  function renameResume(name){
    var r = current();
    if (!r) return;
    if (name === undefined){ name = prompt('给这份简历起个名字：', r.title); }
    if (name === null) return;
    name = String(name).trim();
    if (!name) return;
    r.title = name;
    r.updatedAt = Date.now();
    renderAll();
    scheduleSave();
  }
  function deleteResume(force){
    var r = current();
    if (!r) return;
    if (!force && !confirm('确定删除「' + r.title + '」吗？删除后不可恢复。')) return;
    var idx = state.resumes.findIndex(function(x){ return x.id === r.id; });
    state.resumes.splice(idx, 1);
    if (!state.resumes.length){
      var n = newResume('我的第一份简历');
      state.resumes.push(n);
      Storage.saveResume(n);
    }
    state.currentId = state.resumes[0].id;
    state.settings.lastResumeId = state.currentId;
    Storage.deleteResume(r.id);
    renderAll();
    saveSettingsSoon();
  }
  function applyTemplate(id){
    var r = current();
    if (!r) return;
    r.templateId = id;
    afterChange();
    renderModule();
    renderPreview();
  }
  function moveSection(idx, dir){
    var r = current();
    if (!r) return;
    var j = idx + dir;
    if (j < 0 || j >= r.sectionOrder.length) return;
    var tmp = r.sectionOrder[idx]; r.sectionOrder[idx] = r.sectionOrder[j]; r.sectionOrder[j] = tmp;
    afterChange();
    renderModule();
    renderPreview();
  }
  function setSectionColor(key, color){
    var r = current();
    if (!r) return;
    r.style[key] = color;
    afterChange();
    renderModule();
    renderPreview();
  }
  function setLineWidth(w){
    var r = current();
    if (!r) return;
    r.style.lineWidth = w;
    afterChange();
    renderModule();
    renderPreview();
  }
  function resetSectionStyle(){
    var r = current();
    if (!r) return;
    r.sectionOrder = DEFAULT_SECTION_ORDER.slice();
    r.sectionTitles = Object.assign({}, DEFAULT_SECTION_TITLES);
    r.style = { titleColor: DEFAULT_TITLE_COLOR, lineColor: DEFAULT_LINE_COLOR, lineWidth: 2, showLines: true, pagePadding: { top: 10, right: 12, bottom: 10, left: 12 } };
    afterChange();
    renderModule();
    renderPreview();
  }

  /* ============ 备份 / 导入 / 重置 ============ */
  function buildBackupPayload(){
    return { app: 'resume-workshop', version: 1, exportedAt: new Date().toISOString(), settings: state.settings, resumes: state.resumes };
  }
  function exportBackup(){
    var payload = buildBackupPayload();
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '简历备份_' + fileTimestamp() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    showToast('备份已导出');
  }
  function exportWord(){
    var r = current();
    if (!r) return;
    var bytes = buildDocxBytes(r);
    var blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (r.title || '简历') + '.docx';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    showToast('Word 文档已导出');
  }
  function importPayload(payload){
    return Promise.resolve().then(function(){
      var list = payload && Array.isArray(payload.resumes) ? payload.resumes : null;
      if (!list) throw new Error('备份格式不正确');
      var imported = 0, replaced = 0;
      list.forEach(function(raw){
        var ir = normalizeResume(raw);
        if (!ir) return;
        var old = state.resumes.findIndex(function(x){ return x.id === ir.id; });
        if (old >= 0){ state.resumes[old] = ir; replaced++; }
        else { state.resumes.push(ir); imported++; }
      });
      if (payload.settings && typeof payload.settings === 'object'){
        state.settings = Object.assign({}, DEFAULT_SETTINGS, payload.settings);
        applyTheme();
      }
      if (!state.resumes.length){
        var n = newResume('我的第一份简历');
        state.resumes.push(n);
      }
      state.currentId = state.resumes[0].id;
      state.settings.lastResumeId = state.currentId;
      state.dirty = false;
      return Storage.saveResumes(state.resumes).then(function(){
        return Storage.saveSettings(state.settings);
      }).then(function(){
        renderAll();
        return { imported: imported, replaced: replaced };
      });
    });
  }
  function resetAllData(){
    return Storage.clearAll().then(function(){
      state.resumes = [];
      state.settings = Object.assign({}, DEFAULT_SETTINGS);
      var n = newResume('我的第一份简历');
      state.resumes.push(n);
      state.currentId = n.id;
      state.settings.lastResumeId = n.id;
      state.dirty = false;
      applyTheme();
      return Storage.saveResume(n).then(function(){ renderAll(); });
    });
  }
  function resetAll(btn){
    if (btn.getAttribute('data-confirm') !== '1'){
      btn.setAttribute('data-confirm', '1');
      btn.textContent = '⚠️ 再点一次确认清空所有数据';
      setTimeout(function(){
        if (btn.getAttribute('data-confirm') === '1'){
          btn.setAttribute('data-confirm', '0');
          btn.textContent = '🗑️ 清空所有数据';
        }
      }, 3000);
      return;
    }
    if (!confirm('确定清空所有简历和设置吗？此操作不可恢复。')) return;
    resetAllData().then(function(){ showToast('已清空，并新建了一份空白简历'); });
  }  /* ============ 小工具 ============ */
  function starGen(){
    var s = $('#star-s').value.trim(), t = $('#star-t').value.trim(), a = $('#star-a').value.trim(), r = $('#star-r').value.trim();
    if (!s && !t && !a && !r){ alert('请先填写至少一个要素'); return; }
    var lines = [];
    if (s) lines.push('情境：' + s);
    if (t) lines.push('任务：' + t);
    if (a) lines.push('行动：' + a);
    if (r) lines.push('结果：' + r);
    $('#star-out').value = lines.join('\n');
  }
  function fallbackCopy(text, done){
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    ta.remove();
  }
  function starCopy(){
    var out = $('#star-out').value;
    if (!out.trim()){ alert('请先生成 STAR 描述'); return; }
    var done = function(){ showToast('已复制到剪贴板'); };
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(out).then(done, function(){ fallbackCopy(out, done); });
    } else { fallbackCopy(out, done); }
  }
  function starInsert(){
    if (!state.activeEntry){
      alert('请先在左侧「实习/工作经历」或「项目经验」里点一下某条内容的描述输入框，再回来点「插入」。');
      return;
    }
    var type = state.activeEntry.type, idx = state.activeEntry.idx;
    var d = data();
    if (!d[type] || !d[type][idx]){ state.activeEntry = null; alert('该条目已不存在，请重新选择。'); return; }
    var out = $('#star-out').value;
    if (!out.trim()){ alert('请先生成 STAR 描述'); return; }
    var item = d[type][idx];
    item.description = item.description ? item.description.replace(/\s+$/, '') + '\n' + out : out;
    afterChange();
    renderModule();
    renderPreview();
    showToast('已插入到对应经历');
  }

  /* ============ 照片 ============ */
  function readPhoto(file){
    return new Promise(function(resolve, reject){
      var fr = new FileReader();
      fr.onload = function(){
        var img = new Image();
        img.onload = function(){
          var maxW = 480, maxH = 640;
          var w = img.width, h = img.height;
          var sc = Math.min(1, maxW / w, maxH / h);
          w = Math.round(w * sc); h = Math.round(h * sc);
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = function(){ reject(new Error('decode')); };
        img.src = fr.result;
      };
      fr.onerror = function(){ reject(new Error('read')); };
      fr.readAsDataURL(file);
    });
  }

  /* ============ 主题 / 预览开关 ============ */
  function applyTheme(){
    document.body.classList.toggle('dark', state.settings.theme === 'dark');
  }
  function togglePreview(){
    state.previewVisible = !state.previewVisible;
    $('#preview-pane').style.display = state.previewVisible ? '' : 'none';
    var sw = $('#preview-switch');
    if (sw) sw.checked = state.previewVisible;
    var b = $('#btn-toggle-preview');
    if (b) b.textContent = state.previewVisible ? '隐藏预览' : '显示预览';
  }

  /* ============ 事件 ============ */
  function onEditorInput(e){
    var el = e.target;
    if (!el || !el.dataset) return;
    if (el.dataset.spath){
      var val = el.value;
      if (el.dataset.spath === 'fontSize') val = parseInt(val, 10) || 14;
      setSettingsByPath(el.dataset.spath, val);
      applyTheme();
      saveSettingsSoon();
      if (el.dataset.spath === 'fontSize') schedulePreview();
      return;
    }
    if (el.dataset.stitle){
      var r = current();
      if (r){ r.sectionTitles[el.dataset.stitle] = el.value; afterChange(); }
      return;
    }
    if (el.dataset.mpath){
      var r = current();
      if (r && r.templateId === 'open') return;
      if (r){
        var v = parseInt(el.value, 10);
        if (isNaN(v) || v < 0) v = 0;
        if (v > 40) v = 40;
        el.value = v;
        r.style.pagePadding[el.dataset.mpath] = v;
        afterChange();
      }
      return;
    }
    if (el.dataset.sstyle){
      var r = current();
      if (r){
        r.style[el.dataset.sstyle] = el.type === 'checkbox' ? el.checked : el.value;
        afterChange();
        renderModule();
        renderPreview();
      }
      return;
    }
    if (!el.dataset.path) return;
    if (el.type === 'checkbox') setByPath(el.dataset.path, el.checked);
    else setByPath(el.dataset.path, el.value);
    var card = el.closest ? el.closest('.entry-card') : null;
    if (card && (card.dataset.entryType === 'work' || card.dataset.entryType === 'projects')){
      state.activeEntry = { type: card.dataset.entryType, idx: parseInt(card.dataset.entryIdx, 10) };
    }
    afterChange();
  }
  function onClick(e){
    var btn = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!btn) return;
    var act = btn.getAttribute('data-action');
    var type = btn.getAttribute('data-type');
    var idx = btn.getAttribute('data-idx');
    var dir = btn.getAttribute('data-dir');
    var id = btn.getAttribute('data-id');
    switch (act){
      case 'set-module': if (id){ state.module = id; renderNav(); renderModule(); } break;
      case 'new-resume': newResumeAction(); break;
      case 'dup-resume': duplicateResume(); break;
      case 'rename-resume': renameResume(); break;
      case 'del-resume': deleteResume(); break;
      case 'add-entry': if (type) addEntry(type); break;
      case 'del-entry': if (type) delEntry(type, parseInt(idx, 10)); break;
      case 'move-entry': if (type) moveEntry(type, parseInt(idx, 10), parseInt(dir, 10)); break;
      case 'insert-star': if (type) insertStar(type, parseInt(idx, 10)); break;
      case 'apply-template': if (id) applyTemplate(id); break;
      case 'margin-preset': applyMarginPreset(btn.getAttribute('data-preset')); break;
      case 'move-section': if (idx !== null) moveSection(parseInt(idx, 10), parseInt(dir, 10)); break;
      case 'set-title-color': setSectionColor('titleColor', btn.getAttribute('data-color')); break;
      case 'set-line-color': setSectionColor('lineColor', btn.getAttribute('data-color')); break;
      case 'set-line-width': setLineWidth(parseInt(btn.getAttribute('data-width'), 10) || 2); break;
      case 'reset-section-style': resetSectionStyle(); break;
      case 'export-pdf': window.print(); break;
      case 'export-word': exportWord(); break;
      case 'export-backup': exportBackup(); break;
      case 'pick-import': $('#import-file').click(); break;
      case 'reset-all': resetAll(btn); break;
      case 'toggle-preview': togglePreview(); break;
      case 'pick-photo': $('#photo-file').click(); break;
      case 'photo-remove': setByPath('basic.photo', ''); afterChange(); renderModule(); renderPreview(); break;
      case 'star-gen': starGen(); break;
      case 'star-copy': starCopy(); break;
      case 'star-insert': starInsert(); break;
    }
  }
  function onImportFile(e){
    var f = e.target.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function(){
      try {
        var payload = JSON.parse(fr.result);
        importPayload(payload).then(function(res){
          showToast('导入完成：新增 ' + res.imported + ' 份，更新 ' + res.replaced + ' 份');
        }).catch(function(err){ alert('导入失败：' + err.message); });
      } catch (err) { alert('导入失败：备份文件格式不正确。'); }
    };
    fr.readAsText(f);
    e.target.value = '';
  }
  function onPhotoFile(e){
    var f = e.target.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)){ alert('请选择图片文件'); e.target.value = ''; return; }
    readPhoto(f).then(function(dataUrl){
      setByPath('basic.photo', dataUrl);
      afterChange();
      renderModule();
      renderPreview();
      showToast('照片已添加（仅保存在本地）');
    }).catch(function(){ alert('图片读取失败'); });
    e.target.value = '';
  }
  function showToast(msg){
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function(){ el.classList.remove('show'); }, 2200);
  }
  function bind(){
    $('#resume-select').addEventListener('change', function(e){
      state.currentId = e.target.value;
      state.settings.lastResumeId = state.currentId;
      renderAll();
      saveSettingsSoon();
    });
    var ed = $('#editor');
    ed.addEventListener('input', onEditorInput);
    ed.addEventListener('change', onEditorInput);
    ed.addEventListener('focusin', function(e){
      var card = e.target.closest ? e.target.closest('.entry-card') : null;
      if (card && (card.dataset.entryType === 'work' || card.dataset.entryType === 'projects')){
        state.activeEntry = { type: card.dataset.entryType, idx: parseInt(card.dataset.entryIdx, 10) };
      }
    });
    var sw = $('#preview-switch');
    if (sw) sw.addEventListener('change', function(){ togglePreview(); });
    $('#import-file').addEventListener('change', onImportFile);
    $('#photo-file').addEventListener('change', onPhotoFile);
    document.addEventListener('click', onClick);
    window.addEventListener('beforeunload', function(){ if (state.dirty) flushSave(); });
    document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'hidden' && state.dirty) flushSave(); });
  }

  /* ============ 测试接口 ============ */
  window.__APP__ = {
    state: state,
    Storage: Storage,
    TEMPLATES: TEMPLATES,
    MODULES: MODULES,
    getCurrent: current,
    data: data,
    normalizeResume: normalizeResume,
    setByPath: setByPath,
    afterChange: afterChange,
    renderAll: renderAll,
    renderModule: renderModule,
    renderPreview: renderPreview,
    applyTheme: applyTheme,
    togglePreview: togglePreview,
    newResume: newResumeAction,
    duplicateResume: duplicateResume,
    renameResume: renameResume,
    deleteResume: deleteResume,
    selectResume: function(id){
      state.currentId = id;
      state.settings.lastResumeId = id;
      renderAll();
      saveSettingsSoon();
    },
    addEntry: addEntry,
    delEntry: delEntry,
    moveEntry: moveEntry,
    applyTemplate: applyTemplate,
    insertStar: insertStar,
    resumeStats: resumeStats,
    buildBackupPayload: buildBackupPayload,
    buildDocxBytes: buildDocxBytes,
    exportBackup: exportBackup,
    importPayload: importPayload,
    resetAllData: resetAllData,
    flushSave: flushSave,
    setSettings: function(path, val){
      setSettingsByPath(path, val);
      applyTheme();
      saveSettingsSoon();
      if (path === 'fontSize') schedulePreview();
    }
  };

  init();
})();