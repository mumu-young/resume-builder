'use strict';
/* =========================================================================
 * ResumeParser —— 纯本地「整段文字 → 简历结构化数据」解析引擎
 * 无网络请求、无第三方依赖，可在 Node 里独立单测。
 * 入口：ResumeParser.parse(text) → { data, stats, warnings, sections }
 * ========================================================================= */
var ResumeParser = (function(){

  /* ---------------- 基础正则 ---------------- */
  var EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;
  var PHONE_RE = /1[3-9]\d[\s\-]?\d{4}[\s\-]?\d{4}/;
  var URL_RE = /(?:https?:\/\/|www\.)[^\s，,、；;）)】》]+|(?:github|gitee)\.com\/[^\s，,、；;）)】》]+/i;
  var DEGREE_RE = /(博士研究生|博士|硕士研究生|硕士|研究生|本科|学士|大专|专科|中专|高中|初中|MBA|EMBA|Bachelor|Master|PhD|Ph\.?D|Doctor|Associate)/i;
  var DEGREE_EN = { bachelor: '本科', master: '硕士', phd: '博士', doctor: '博士', associate: '大专', mba: '硕士', emba: '硕士' };
  var BULLET_RE = /^\s*(?:(?:\d{1,2}[.．、)）])(?!\d)|[•·●○◦▪‣※◆◇■□▶►→>\-–—－*+])[\s]*/;

  /* ---------------- 分节标题别名 ---------------- */
  var ALIASES = {
    basicinfo: ['基本信息', '个人信息', '联系方式', '个人资料', '基本资料', '个人档案', 'basicinfo', 'contact'],
    education: ['教育经历', '教育背景', '学习经历', '学历背景', '求学经历', '教育情况', '教育', 'education', 'educationbackground'],
    work: ['工作经历', '工作经验', '实习经历', '实习经验', '工作实习经历', '实习工作经历', '职业经历',
      '工作履历', '从业经历', '实践经历', '社会实践', 'experience', 'workexperience', 'employment', 'internship'],
    projects: ['项目经历', '项目经验', '项目实践', '主要项目', '项目介绍', '项目', 'projects', 'projectexperience'],
    skills: ['专业技能', '技能特长', '个人技能', '技能清单', '专业能力', '个人能力', 'it技能', '技能',
      'skills', 'technicalskills'],
    honors: ['荣誉证书', '获奖情况', '获奖经历', '荣誉奖项', '奖项荣誉', '所获荣誉', '荣誉奖励', '荣誉', '获奖',
      '证书', '资格证书', '证书荣誉', 'honors', 'awards', 'certificates'],
    profile: ['自我评价', '个人简介', '自我介绍', '个人总结', '个人优势', '关于我', '个人评价', '自我描述',
      '优势亮点', '个人陈述', 'summary', 'profile', 'aboutme', 'selfevaluation'],
    extra: ['其他信息', '附加信息', '其他补充', '补充信息', '兴趣爱好', '个人爱好', '语言能力', 'otherinfo']
  };

  /* ---------------- 关键词集合 ---------------- */
  var VERB_START_RE = /^(负责|参与|主导|完成|使用|实现|优化|搭建|设计|开发|协助|组织|推动|独立|配合|通过|基于|引入|撰写|维护|管理|提升|降低|获得|担任|带领|支持|跟进|落地|重构|编写|测试|上线|交付|分析|研究|制作|策划|执行|协调|沟通|学习|熟悉|掌握|精通|了解|熟练|具备|拥有|善于|能够|–|—)/;
  var ROLE_RE = /(负责人|工程师|教师|医师|律师|会计|设计师|开发|主导|组长|队长|成员|参与|设计|测试|产品|运营|全栈|前端|后端|架构|算法|数据分析|实习生|助理|专员|主管|经理|总监)/;
  var COMPANY_RE = /(公司|集团|科技|有限|工作室|银行|医院|研究所|研究院|事务所|传媒|互联|网络|软件|信息|数据|智能|教育|文化|电子|实业|中心|学校|大学|事业部|集团股份|Inc|ltd|Ltd|Corp|LLC)/;
  var SCHOOL_RE = /(大学|学院|学校|中学|高中|职业技术|技校|研究院|University|College)/i;
  var TECH_RE = /(Vue|React|Angular|Node|Java|Python|Golang|Go语言|C\+\+|C#|PHP|Ruby|Swift|Kotlin|Spring|Django|Flask|MySQL|Redis|MongoDB|PostgreSQL|Oracle|Docker|K8s|Kubernetes|Linux|Git|Nginx|HTML|CSS|JavaScript|TypeScript|Webpack|Vite|jQuery|Bootstrap|Element|ECharts|Unity|OpenCV|TensorFlow|PyTorch|Hadoop|Spark|Flink|Kafka|Elasticsearch|REST|GraphQL|小程序|微服务|分布式|SQL|Matlab|MATLAB|STM32|FPGA|Qt)/i;
  var CITY_RE = /^(北京|上海|天津|重庆|广州|深圳|杭州|成都|武汉|南京|西安|苏州|长沙|郑州|青岛|大连|厦门|福州|合肥|济南|昆明|宁波|无锡|佛山|东莞|珠海|中山|惠州|汕头|湛江|茂名|南宁|贵阳|南昌|太原|石家庄|沈阳|哈尔滨|长春|兰州|海口|三亚|温州|嘉兴|泉州|烟台|常州|徐州|唐山|保定|洛阳|襄阳|宜昌|株洲|湘潭|岳阳|赣州|柳州|桂林|遵义|大理)(?:市|区|县|新区)?$/;
  var TARGET_RE = /(工程师|经理|专员|助理|主管|总监|设计师|运营|开发|教师|会计|顾问|研究员|分析师|架构师|产品|测试|运维|前端|后端|算法|实习生|律师|医师|护士|编辑|策划|销售|客服|行政|人事|财务|出纳|讲师|翻译|公务员)$/;

  var JUNK_RE = /^(个人简历|简历|求职简历|我的简历|个人信息|基本信息|附：|附件|点击查看|查看更多|下载简历|【.+】)$/;

  /* ---------------- 文本规范化 ---------------- */
  function normalizeText(text){
    text = String(text == null ? '' : text);
    text = text.replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/\u3000/g, ' ');
    var raw = text.split('\n');
    var out = [];
    for (var i = 0; i < raw.length; i++){
      var line = raw[i].replace(/\t/g, '  ').replace(/[ ]+$/g, '');
      var bullet = BULLET_RE.test(line);
      if (bullet) line = line.replace(BULLET_RE, '');
      line = line.replace(/^[ ]+/, '');
      out.push({ text: line, bullet: bullet });
    }
    return out;
  }

  function cleanSpaces(s){
    return String(s == null ? '' : s)
      .replace(/[ \t\u00a0]+/g, ' ')
      .replace(/^[\s:：、,，.。;；|\-–—]+/, '')
      .replace(/[\s、,，;；|]+$/, '')
      .trim();
  }
  /* 保留行内多空格（用于「学校  专业  学历」这类靠空格分列的写法） */
  function softClean(s){
    return String(s == null ? '' : s)
      .replace(/^[\s:：、,，.。;；|\-–—]+/, '')
      .replace(/[\s、,，;；|]+$/, '')
      .trim();
  }
  function pad2(n){ return n < 10 ? '0' + n : '' + n; }
  /* 兼容 {text} 对象与纯字符串两种行数据 */
  function lineText(l){
    if (l && typeof l === 'object') return String(l.text == null ? '' : l.text);
    return String(l == null ? '' : l);
  }
  function uniq(arr){
    var out = [], seen = {};
    for (var i = 0; i < arr.length; i++){
      var v = arr[i];
      if (!v) continue;
      var k = v.toLowerCase();
      if (seen[k]) continue;
      seen[k] = 1; out.push(v);
    }
    return out;
  }

  /* ---------------- 标题识别 ---------------- */
  function normalizeKey(s){
    return String(s == null ? '' : s)
      .replace(/[\s\u3000]+/g, '')
      .replace(/^[【\[（(《<「『]+/, '')
      .replace(/[】\]）)》>」』]+$/, '')
      .replace(/^[0-9一二三四五六七八九十]{1,3}[、.．)）]\s*/, '')
      .replace(/[：:]\s*$/, '')
      .replace(/[：:·•、，,。．.；;！!？?|｜/／\\\-—－_"'“”‘’()（）【】\[\]《》<>「」『』]/g, '')
      .toLowerCase();
  }
  var KEY_MAP = (function(){
    var map = {};
    Object.keys(ALIASES).forEach(function(key){
      ALIASES[key].forEach(function(a){ map[normalizeKey(a)] = key; });
    });
    // 常见组合写法（斜杠被 normalizeKey 去掉后产生的变体）
    map['工作实习经历'] = 'work';
    map['实习工作经历'] = 'work';
    map['工作或实习经历'] = 'work';
    map['实习或工作经历'] = 'work';
    return map;
  })();
  function lookupKey(s){
    var k = normalizeKey(s);
    if (!k) return null;
    if (KEY_MAP[k]) return KEY_MAP[k];
    // 去掉英文后重试（如「教育经历 EDUCATION」）
    var k2 = k.replace(/[a-z]+/g, '');
    if (k2 && KEY_MAP[k2]) return KEY_MAP[k2];
    return null;
  }
  function matchHeader(line){
    var t = String(line || '').trim();
    if (!t) return null;
    if (t.length <= 34){
      var key = lookupKey(t);
      if (key) return { key: key, rest: '' };
    }
    // 「教育经历：复旦大学 …」这类行内写法：只看冒号左侧
    var ci = t.indexOf('：');
    if (ci < 0) ci = t.indexOf(':');
    if (ci > 0){
      var left = t.slice(0, ci).trim();
      var right = t.slice(ci + 1).trim();
      if (left.length >= 2 && left.length <= 16){
        var k = lookupKey(left);
        // 「工作经验：4年」这类其实是基础信息字段，不当分节
        if (k && !(matchLabel(left) && right.length <= 12)) return { key: k, rest: softClean(right) };
      }
      return null;
    }
    var m2 = t.match(/^(\S{2,12})(?:\s{2,}|\t)(.+)$/);
    if (m2 && lookupKey(m2[1])){
      if (matchLabel(m2[1]) && cleanSpaces(m2[2]).length <= 12) return null;
      return { key: lookupKey(m2[1]), rest: softClean(m2[2]) };
    }
    return null;
  }

  /* ---------------- 分节 ---------------- */
  function splitSections(lines){
    var blocks = { head: [] };
    var order = [], cur = 'head';
    for (var i = 0; i < lines.length; i++){
      var it = lines[i], t = String(it.text || '').trim();
      if (!t) { if (blocks[cur]) blocks[cur].push({ text: '', bullet: false }); continue; }
      var h = matchHeader(t);
      if (h){
        cur = h.key;
        if (!blocks[cur]){ blocks[cur] = []; order.push(cur); }
        if (h.rest && h.rest.length > 1) blocks[cur].push({ text: h.rest, bullet: false });
        continue;
      }
      if (!blocks[cur]) blocks[cur] = [];
      blocks[cur].push(it);
    }
    return { head: blocks.head, blocks: blocks, order: order };
  }

  /* ---------------- 时间解析 ---------------- */
  var DATE_POINT = '(?:19|20)\\d{2}(?:\\s*[.．\\-/年]\\s*(?:1[0-2]|0?[1-9])(?!\\d)\\s*月?)?';
  var RANGE_RE = new RegExp('(' + DATE_POINT + ')\\s*(?:-|–|—|－|~|～|至|到|\\s{1,3})\\s*(' + DATE_POINT +
    '|至今|现在|目前|如今|迄今|今|present|now|current)', 'i');

  function parseDatePoint(raw){
    var s = String(raw || '').trim();
    if (!s) return '';
    if (/^(至今|现在|目前|如今|迄今|今|present|now|current)$/i.test(s)) return '';
    var y = s.match(/((?:19|20)\d{2})/);
    if (!y) return '';
    var rest = String(s.slice(s.indexOf(y[1]) + 4)).trim();
    var m = rest.match(/^[.．\-/年]\s*(1[0-2]|0?[1-9])(?!\d)/);
    var month = m ? parseInt(m[1], 10) : 0;
    if (!(month >= 1 && month <= 12)) month = 1;
    return y[1] + '-' + pad2(month);
  }
  function extractRange(text){
    var m = String(text || '').match(RANGE_RE);
    if (!m) return null;
    var start = parseDatePoint(m[1]);
    var end = parseDatePoint(m[2]);
    if (!start && !end) return null;
    return { start: start, end: end, raw: m[0], index: m.index, open: !end };
  }
  function stripRange(text, rng){
    if (!rng) return text;
    return (String(text).slice(0, rng.index) + ' ' + String(text).slice(rng.index + rng.raw.length));
  }
  function yearOnly(raw){
    return !/[.．\-/年]\s*\d/.test(String(raw || ''));
  }

  /* ---------------- 条目切分 ---------------- */
  function isEntryStart(text, kind, hasBody){
    if (!hasBody) return true;
    if (text.length > 28) return false;
    if (/[。；;，,、：:]$/.test(text) || /[：:]/.test(text)) {
      // 「公司：X」这类带标签的行，视为新条目开头
      return /^(公司|单位|企业|职位|岗位|职务|项目名称|项目名|学校|院校|专业|时间|角色|技术栈|担任)/.test(text);
    }
    if (/[。；;]$/.test(text)) return false;
    if (VERB_START_RE.test(text)) return false;
    if (kind === 'education') return SCHOOL_RE.test(text) || text.length <= 14;
    if (kind === 'work') return COMPANY_RE.test(text) || text.length <= 14;
    return text.length <= 16;
  }

  function splitEntries(lines, kind){
    var items = [], cur = null;
    function open(){ cur = { header: [], body: [], date: null }; items.push(cur); }
    for (var i = 0; i < lines.length; i++){
      var it = lines[i];
      var text = String(it.text || '').trim();
      if (!text) continue;
      var rng = extractRange(text);
      if (rng){
        if (!cur) open();
        else if (cur.date || cur.body.length) open();
        cur.date = rng;
        var rest = softClean(stripRange(text, rng));
        if (rest) cur.header.push(rest);
        continue;
      }
      if (!cur) open();
      // 正文开始前的短行视为条目标题（机构 / 岗位 / 专业等），最多 3 行
      var lookTitle = cur.header.length < 3 && text.length <= 24 &&
        !/[。；;！!]$/.test(text) && !VERB_START_RE.test(text);
      if (!cur.body.length && lookTitle){ cur.header.push(text); continue; }
      if (!it.bullet && isEntryStart(text, kind, true)){ open(); cur.header.push(text); continue; }
      cur.body.push(text);
    }
    return items.filter(function(e){ return e.header.length || e.body.length || e.date; });
  }
  /* 处理 PDF / Word 复制产生的硬换行：连续两行都很长且上一行没有句读，视为同一段被折断 */
  function dewrap(lines){
    var out = [];
    for (var i = 0; i < lines.length; i++){
      var it = lines[i], t = String(it.text || '').trim();
      if (!t){ out.push({ text: '', bullet: false }); continue; }
      var prev = out.length ? out[out.length - 1] : null;
      var wrapped = prev && prev.text && !prev.bullet && !it.bullet &&
        !extractRange(prev.text) &&
        prev.text.length >= 30 && t.length >= 30 &&
        !/[。；;：:！!？?、,，]$/.test(prev.text) &&
        !/[：:]/.test(t) && !extractRange(t) && !/^[（(【\[]/.test(t);
      if (wrapped){
        prev.text = prev.text + t;
        continue;
      }
      out.push({ text: t, bullet: it.bullet });
    }
    return out;
  }
  function headerText(entry){
    return softClean(entry.header.join('  '));
  }
  function segments(text){
    return String(text || '').split(/\s*[|｜·•,，;；\t]\s*|\s{2,}|\s*[—–]\s*/)
      .map(cleanSpaces).filter(Boolean);
  }

  /* ---------------- 基础信息 ---------------- */
  var LABEL_MAP = [
    ['name', /^(姓名|名字)$/],
    ['age', /^年龄$/],
    ['phone', /^(电话|手机|手机号|手机号码|联系方式|联系电话|tel|phone)$/i],
    ['email', /^(邮箱|电子邮箱|邮件|email|e-mail)$/i],
    ['location', /^(现居|现居地|所在地|居住地|所在城市|城市|地址|现住址|通讯地址)$/],
    ['target', /^(求职意向|意向岗位|期望职位|期望岗位|应聘职位|目标岗位|求职目标|应聘岗位|意向职位)$/],
    ['years', /^(工作年限|工作经验|年限|从业年限)$/],
    ['degree', /^(学历|最高学历)$/],
    ['school', /^(毕业院校|毕业学校|院校)$/],
    ['major', /^(专业)$/]
  ];
  function matchLabel(label){
    label = cleanSpaces(label);
    for (var i = 0; i < LABEL_MAP.length; i++){
      if (LABEL_MAP[i][1].test(label)) return LABEL_MAP[i][0];
    }
    return null;
  }
  /* 取「值」的第一段：遇到 | · 或下一个「标签：」就截断 */
  function firstSegment(v){
    var s = String(v == null ? '' : v).trim();
    if (!s) return '';
    var m = s.match(/^(.+?)(?=\s*[|｜·•]|\s{2,}|\s+[\u4e00-\u9fa5A-Za-z]{2,8}\s*[：:]|$)/);
    return cleanSpaces(m ? m[1] : s);
  }

  function parseBasicInfo(headLines, extraLines, fullText){
    var basic = { name: '', phone: '', email: '', location: '', target: '', years: '', age: '' };
    var extras = { degree: '', school: '', major: '' };
    var profileLines = [];
    var lines = headLines.concat(extraLines || []);

    // 1) 键值对
    for (var i = 0; i < lines.length; i++){
      var t = String(lines[i].text || '').trim();
      if (!t) continue;
      var m = t.match(/^([\u4e00-\u9fa5A-Za-z\-]{2,8})\s*(?:[：:]|\s{2,}|\t)\s*(.+)$/);
      if (!m) continue;
      var field = matchLabel(m[1]);
      if (!field) continue;
      var val = firstSegment(m[2]);
      if (!val) continue;
      if (basic[field] === '' && field in basic) basic[field] = val;
      else if (extras[field] === '' && field in extras) extras[field] = val;
    }

    // 2) 全文兜底：邮箱 / 电话
    if (!basic.email){
      var em = String(fullText).match(EMAIL_RE);
      if (em) basic.email = em[0];
    }
    if (!basic.phone){
      var ph = String(fullText).match(PHONE_RE);
      if (ph) basic.phone = ph[0].replace(/[\s\-]/g, '');
    }

    // 3) 分段识别（姓名 / 城市 / 年龄 / 求职意向 / 工作年限）
    for (var j = 0; j < lines.length; j++){
      var raw = String(lines[j].text || '').trim();
      if (!raw) continue;
      var segs = raw.split(/\s*[|｜·•,，;；\t]\s*|\s{2,}/).map(cleanSpaces).filter(Boolean);
      if (!segs.length) segs = [raw];
      for (var k = 0; k < segs.length; k++){
        var s = segs[k];
        if (/[：:]/.test(s)) continue;              // 「姓名：张三」这类已在键值对阶段处理
        if (!basic.phone && PHONE_RE.test(s)) { basic.phone = s.match(PHONE_RE)[0].replace(/[\s\-]/g, ''); continue; }
        if (!basic.email && EMAIL_RE.test(s)) { basic.email = s.match(EMAIL_RE)[0]; continue; }
        if (!basic.age){
          var ag = s.match(/(\d{2})\s*岁/);
          if (ag) { basic.age = ag[1]; continue; }
        }
        if (!basic.years){
          var yv = s.match(/(?:工作|从业|开发|相关)?\s*(\d+(?:\.\d+)?)\s*年(?:以上)?(?:工作)?(?:经验|经历)/);
          if (yv) { basic.years = yv[1] + ' 年'; continue; }
        }
        if (!basic.location && (CITY_RE.test(s) || (/^[\u4e00-\u9fa5]{2,6}(?:省|市|区|县)$/.test(s) && !SCHOOL_RE.test(s) && !COMPANY_RE.test(s)))){
          basic.location = s.replace(/(?:市|省)$/, ''); continue;
        }
        if (!basic.target && s.length >= 2 && s.length <= 16 && TARGET_RE.test(s) && !/\d/.test(s) &&
            !VERB_START_RE.test(s) && !/[。；;，,]/.test(s)){
          basic.target = s; continue;
        }
        if (!basic.name && /^[\u4e00-\u9fa5·]{2,4}$/.test(s) && !JUNK_RE.test(s) && k === 0){
          basic.name = s; continue;
        }
      }
    }

    // 4) 姓名：第一行单独的 2-4 个汉字 / 英文姓名
    if (!basic.name){
      for (var n = 0; n < Math.min(lines.length, 6); n++){
        var cand = cleanSpaces(String(lines[n].text || '').replace(/\s+/g, ''));
        if (/^[\u4e00-\u9fa5·]{2,4}$/.test(cand) && !JUNK_RE.test(cand) && !CITY_RE.test(cand)){
          basic.name = cand; break;
        }
      }
    }
    if (!basic.name){
      for (var n2 = 0; n2 < Math.min(lines.length, 6); n2++){
        var en = String(lines[n2].text || '').trim();
        if (/^[A-Z][A-Za-z.\-']{1,15}(?:\s+[A-Z][A-Za-z.\-']{1,15}){0,2}$/.test(en) &&
            !/^(Resume|Curriculum|Vitae|Profile|Summary|Education|Experience)$/i.test(en)){
          basic.name = en; break;
        }
      }
    }

    // 5) 年龄兜底：出生年份
    if (!basic.age){
      var by = String(fullText).match(/((?:19|20)\d{2})\s*年?(?:出生|生人|生)/);
      if (by){
        var calc = new Date().getFullYear() - parseInt(by[1], 10);
        if (calc > 14 && calc < 80) basic.age = String(calc);
      }
    }

    // 6) 较长且以中文陈述为主的段落行 → 个人简介候选
    for (var p = 0; p < lines.length; p++){
      var lt = String(lines[p].text || '').trim();
      var cjk = (lt.match(/[\u4e00-\u9fa5]/g) || []).length;
      if (lt.length >= 30 && cjk >= 15 && !/[@]/.test(lt) &&
          !/^[\u4e00-\u9fa5A-Za-z\-]{2,8}[：:]/.test(lt)) profileLines.push(lt);
    }

    // 7) 规范化
    var yn = String(basic.years || '').match(/(\d+(?:\.\d+)?)\s*年/);
    if (yn) basic.years = yn[1] + ' 年';
    if (basic.phone) basic.phone = basic.phone.replace(/[\s\-]/g, '');
    if (basic.age) basic.age = String(basic.age).replace(/岁$/, '');
    return { basic: basic, extras: extras, profileLines: profileLines };
  }

  /* ---------------- 教育经历 ---------------- */
  function parseEducationEntry(entry){
    var head = headerText(entry);
    var body = entry.body.map(function(l){ return softClean(lineText(l)); }).filter(Boolean);
    var work = head, school = '', major = '', degree = '', gpa = '', rank = '', courses = '', descLines = [];

    var mSchool = work.match(/(?:学校|院校|毕业院校)\s*[：:]\s*([^\n|｜·]{2,30})/);
    if (mSchool){ school = cleanSpaces(mSchool[1]); work = work.replace(mSchool[0], ' '); }
    var mDegree = work.match(DEGREE_RE);
    if (mDegree){
      degree = mDegree[1];
      if (/^[A-Za-z.]+$/.test(degree)) degree = DEGREE_EN[degree.replace(/\./g, '').toLowerCase()] || '其他';
      work = work.replace(mDegree[0], ' ');
    }
    if (!school){
      var mS = work.match(/([\u4e00-\u9fa5A-Za-z·（）()]{2,24}?(?:大学|学院|学校|中学|高中|职业技术(?:学院)?|研究院))|([A-Za-z][A-Za-z .,&'\-]{2,40}?(?:University|College|Institute|School))/);
      if (mS){
        school = cleanSpaces(mS[1] || mS[2]);
        work = work.replace(mS[0], ' ');
      }
    }
    var mMajor = work.match(/专业\s*[：:]\s*([^\n|｜·，,]{2,30})/);
    if (mMajor){ major = cleanSpaces(mMajor[1]); work = work.replace(mMajor[0], ' '); }

    // GPA / 排名 / 课程（可能出现在正文行）
    var all = [work].concat(body);
    var kept = [];
    for (var i = 0; i < all.length; i++){
      var line = softClean(all[i]);
      if (!line) continue;
      var mg = line.match(/(?:GPA|绩点|平均分|平均成绩)\s*[：:]?\s*([0-9.]+\s*(?:\/\s*[0-9.]+)?)/i);
      if (mg && !gpa){ gpa = cleanSpaces(mg[1]); line = cleanSpaces(line.replace(mg[0], ' ')); }
      var mr = line.match(/(?:年级排名|专业排名|班级排名|排名|Rank)\s*[：:]?\s*(前\s*\d+(?:\.\d+)?\s*%|前\s*\d+\s*名|\d+(?:\.\d+)?\s*%|\d+\s*\/\s*\d+)/i);
      if (!mr) mr = line.match(/(?:年级排名|专业排名|班级排名|排名)\s*[：:]?\s*([^\s，,；;。]{1,14})/);
      if (mr && !rank){ rank = cleanSpaces(mr[1]); line = cleanSpaces(line.replace(mr[0], ' ')); }
      var mc = line.match(/(?:主修课程|相关课程|核心课程|主要课程|修读课程)\s*[：:]\s*(.+)$/);
      if (mc && !courses){
        courses = mc[1].split(/[、,，;；\/]/).map(cleanSpaces).filter(Boolean).join('\n');
        line = cleanSpaces(line.replace(mc[0], ' '));
      }
      if (line) kept.push(line);
    }

    // 专业兜底：剩余文本里第一个非噪声片段
    if (!major){
      var found = false;
      for (var li = 0; li < kept.length && !found; li++){
        var parts = kept[li].split(/\s*[|｜·•,，;；\/]\s*|\s{2,}/).map(cleanSpaces).filter(Boolean);
        for (var pi = 0; pi < parts.length; pi++){
          var tok = parts[pi];
          if (!tok || tok === school || DEGREE_RE.test(tok)) continue;
          if (/^(时间|GPA|排名|备注)$/i.test(tok)) continue;
          if (tok.length <= 24){
            major = tok;
            parts.splice(pi, 1);
            kept[li] = parts.join('  ');
            found = true;
            break;
          }
        }
      }
    } else {
      // 从正文中移除专业字符串
      kept = kept.map(function(l){ return softClean(l.replace(major, ' ')); }).filter(Boolean);
    }
    descLines = kept.map(cleanSpaces).filter(function(l){ return l && l !== school; });

    return {
      id: '', school: school, degree: degree, major: major,
      start: entry.date ? entry.date.start : '', end: entry.date ? entry.date.end : '',
      gpa: gpa, rank: rank, courses: courses, description: uniq(descLines).join('\n')
    };
  }

  /* ---------------- 工作经历 ---------------- */
  function parseWorkEntry(entry){
    var head = headerText(entry);
    var body = entry.body.map(function(l){ return cleanSpaces(lineText(l)); }).filter(Boolean);
    var company = '', position = '';
    var mCo = head.match(/(?:公司|单位|企业|公司名称)\s*[：:]\s*([^\n|｜·]{2,32})/);
    if (mCo){ company = cleanSpaces(mCo[1]); head = softClean(head.replace(mCo[0], '  ')); }
    var mPos = head.match(/(?:职位|岗位|职务|担任)\s*[：:]\s*([^\n|｜·]{2,32})/);
    if (mPos){ position = cleanSpaces(mPos[1]); head = softClean(head.replace(mPos[0], '  ')); }

    var segs = segments(head).filter(Boolean);
    if (!company){
      for (var i = 0; i < segs.length; i++){
        if (COMPANY_RE.test(segs[i]) && !VERB_START_RE.test(segs[i])){ company = segs[i]; segs.splice(i, 1); break; }
      }
    }
    if (!position){
      for (var j = 0; j < segs.length; j++){
        if (ROLE_RE.test(segs[j]) && !VERB_START_RE.test(segs[j]) && segs[j] !== company){ position = segs[j]; segs.splice(j, 1); break; }
      }
    }
    if (!company && segs.length){ company = segs.shift(); }
    if (!position && segs.length){ position = segs.shift(); }
    // 未归属的剩余片段（同一行的简介句）并入描述
    var inlineDesc = segs.filter(function(s){ return s && s !== company && s !== position; });

    var desc = uniq(body.map(function(l){
      // 描述里若含「公司/职位：」标签，转成对应字段
      var m1 = l.match(/^(?:公司|单位)\s*[：:]\s*(.+)$/);
      if (m1){ if (!company) company = cleanSpaces(m1[1]); return ''; }
      var m2 = l.match(/^(?:职位|岗位|职务)\s*[：:]\s*(.+)$/);
      if (m2){ if (!position) position = cleanSpaces(m2[1]); return ''; }
      return l;
    }).filter(Boolean));

    return {
      id: '', company: company, position: position,
      start: entry.date ? entry.date.start : '', end: entry.date ? entry.date.end : '',
      description: uniq(inlineDesc.concat(desc)).join('\n')
    };
  }

  /* ---------------- 项目经验 ---------------- */
  function parseProjectEntry(entry){
    var head = headerText(entry);
    var body = entry.body.map(function(l){ return cleanSpaces(lineText(l)); }).filter(Boolean);
    var name = '', role = '', tech = '', link = '';
    var mLink = head.match(URL_RE);
    if (!mLink){ for (var b = 0; b < body.length; b++){ var bl = body[b].match(URL_RE); if (bl){ mLink = bl; body.splice(b, 1); break; } } }
    if (mLink){ link = mLink[0]; head = softClean(head.replace(mLink[0], '  ')); }

    var mName = head.match(/(?:项目名称|项目名|项目)\s*[：:]\s*([^\n|｜]{2,40})/);
    if (mName){ name = cleanSpaces(mName[1]); head = softClean(head.replace(mName[0], '  ')); }
    var mRole = head.match(/(?:角色|担任|职责|身份)\s*[：:]\s*([^\n|｜]{2,24})/);
    if (mRole){ role = cleanSpaces(mRole[1]); head = softClean(head.replace(mRole[0], '  ')); }
    var mTech = head.match(/(?:技术栈|技术选型|使用技术|主要技术|开发环境|技术)\s*[：:]\s*([^\n]{2,60})/);
    if (mTech){ tech = cleanSpaces(mTech[1]); head = softClean(head.replace(mTech[0], '  ')); }

    var segs = segments(head).filter(Boolean);
    if (!name && segs.length) name = segs.shift();
    for (var i = 0; i < segs.length; i++){
      var s = segs[i];
      if (!role && ROLE_RE.test(s) && !TECH_RE.test(s)){ role = s; continue; }
      if (!tech && TECH_RE.test(s)){ tech = s; continue; }
    }
    // 正文里的「技术栈：」「角色：」标签
    body = body.map(function(l){
      var mt = l.match(/^(?:技术栈|技术选型|使用技术|主要技术)\s*[：:]\s*(.+)$/);
      if (mt){ if (!tech) tech = cleanSpaces(mt[1]); return ''; }
      var mr = l.match(/^(?:角色|担任|职责)\s*[：:]\s*(.+)$/);
      if (mr){ if (!role) role = cleanSpaces(mr[1]); return ''; }
      return l;
    }).filter(Boolean);

    return {
      id: '', name: name, role: role,
      start: entry.date ? entry.date.start : '', end: entry.date ? entry.date.end : '',
      tech: tech, link: link, description: uniq(body).join('\n')
    };
  }

  /* ---------------- 专业技能 ---------------- */
  function cleanSkillItems(v){
    var parts = String(v || '').split(/[、,，\/／|｜;；]+/)
      .map(function(s){
        var t = cleanSpaces(s);
        // 「熟练使用 / 精通」等修饰语可能叠加，循环剥离
        for (var i = 0; i < 3; i++){
          var n = t.replace(/^(熟练使用|熟练|精通|熟悉|掌握|了解|会使用|使用|能够|具备|较好的|良好的)\s*/, '');
          if (n === t) break;
          t = n;
        }
        return cleanSpaces(t);
      })
      .filter(Boolean);
    return uniq(parts).join('\n');
  }
  function parseSkills(lines){
    var out = [], loose = [];
    for (var i = 0; i < lines.length; i++){
      var t = cleanSpaces(String(lines[i].text || ''));
      if (!t) continue;
      // 一行里可能有多组「分类：内容」用 ；分隔
      var pairs = t.split(/[；;]/).map(cleanSpaces).filter(Boolean);
      var matchedAny = false;
      for (var p = 0; p < pairs.length; p++){
        var m = pairs[p].match(/^([\u4e00-\u9fa5A-Za-z\+\#\.\s]{1,14})\s*[：:]\s*(.+)$/);
        if (m){
          out.push({ id: '', category: cleanSpaces(m[1]), items: cleanSkillItems(m[2]) });
          matchedAny = true;
        } else {
          loose.push(pairs[p]);
        }
      }
      if (!matchedAny && pairs.length && /[：:]/.test(t)) continue;
    }
    if (loose.length){
      var items = cleanSkillItems(loose.join('、'));
      if (items){
        // 若只有一组分类，合并进去
        if (out.length === 1 && !loose.some(function(x){ return /[：:]/.test(x); })){
          out[0].items = uniq((out[0].items ? out[0].items.split('\n') : []).concat(items.split('\n'))).join('\n');
        } else {
          out.push({ id: '', category: '专业技能', items: items });
        }
      }
    }
    return out.filter(function(k){ return k.category || k.items; });
  }

  /* ---------------- 荣誉证书 ---------------- */
  function parseHonors(lines){
    var items = [], extraLines = [];
    for (var i = 0; i < lines.length; i++){
      var t = cleanSpaces(String(lines[i].text || ''));
      if (!t) continue;
      if (/^(语言|外语|英语|日语|韩语|法语|德语|兴趣爱好|爱好|特长|其他)\s*[：:]/.test(t)){ extraLines.push(t); continue; }
      var year = '', title = t, desc = '';
      var mv = t.match(/[（(]\s*((?:19|20)\d{2}(?:\s*[.\-\/]\s*\d{1,2})?)\s*[)）]/);
      if (mv){ year = mv[1].replace(/[.]/g, '-'); title = cleanSpaces(t.replace(mv[0], ' ')); }
      if (!year){
        var my = t.match(/(?:^|\s)((?:19|20)\d{2})\s*年?\s*$/);
        if (my){ year = my[1]; title = cleanSpaces(t.replace(my[0], ' ')); }
      }
      if (!year){
        var my2 = t.match(/^((?:19|20)\d{2})\s*(?:[.．\-\/]|年(?!度))?\s*(.+)$/);
        if (my2){ year = my2[1]; title = cleanSpaces(my2[2]); }
      }
      title = cleanSpaces(softClean(title.replace(/^年(?!度)\s*/, '')).replace(/^(获得|荣获|取得)\s*/, ''));
      var mDesc = title.match(/^(.{2,40}?)\s*[：:]\s*(.+)$/);
      if (mDesc){ title = cleanSpaces(mDesc[1]); desc = cleanSpaces(mDesc[2]); }
      if (!title) continue;
      items.push({ id: '', title: title, year: year, description: desc });
    }
    return { items: items, extraLines: extraLines };
  }

  /* ---------------- 汇总 ---------------- */
  function parse(text){
    var raw = String(text == null ? '' : text);
    var lines = dewrap(normalizeText(raw));
    var sec = splitSections(lines);
    var warnings = [];

    var extraHead = (sec.blocks.basicinfo || []).slice();
    var bInfo = parseBasicInfo(sec.head, extraHead, raw);
    var data = {
      basic: bInfo.basic,
      education: [], work: [], projects: [], skills: [],
      honors: { items: [], extra: '' },
      profile: ''
    };

    // 教育
    if (sec.blocks.education && sec.blocks.education.length){
      var eduEntries = splitEntries(sec.blocks.education, 'education');
      data.education = eduEntries.map(parseEducationEntry).filter(function(e){ return e.school || e.major || e.description; });
    }
    // 教育兜底：只有「毕业院校/专业/学历」标签
    if (!data.education.length && (bInfo.extras.school || bInfo.extras.major || bInfo.extras.degree)){
      data.education.push({
        id: '', school: bInfo.extras.school, degree: bInfo.extras.degree, major: bInfo.extras.major,
        start: '', end: '', gpa: '', rank: '', courses: '', description: ''
      });
    }

    // 工作
    if (sec.blocks.work && sec.blocks.work.length){
      var workEntries = splitEntries(sec.blocks.work, 'work');
      data.work = workEntries.map(parseWorkEntry).filter(function(w){ return w.company || w.position || w.description; });
    }
    // 项目
    if (sec.blocks.projects && sec.blocks.projects.length){
      var prjEntries = splitEntries(sec.blocks.projects, 'projects');
      data.projects = prjEntries.map(parseProjectEntry).filter(function(p){ return p.name || p.description; });
    }
    // 技能
    if (sec.blocks.skills && sec.blocks.skills.length) data.skills = parseSkills(sec.blocks.skills);
    // 荣誉
    if (sec.blocks.honors && sec.blocks.honors.length){
      var h = parseHonors(sec.blocks.honors);
      data.honors.items = h.items;
      if (h.extraLines.length) data.honors.extra = h.extraLines.join('\n');
    }
    // 其他信息
    if (sec.blocks.extra && sec.blocks.extra.length){
      var exLines = sec.blocks.extra.map(function(l){ return cleanSpaces(String(l.text || '')); }).filter(Boolean);
      if (exLines.length) data.honors.extra = uniq((data.honors.extra ? [data.honors.extra] : []).concat(exLines.join('\n'))).join('\n');
    }
    // 自我评价
    if (sec.blocks.profile && sec.blocks.profile.length){
      data.profile = sec.blocks.profile.map(function(l){ return cleanSpaces(String(l.text || '')); }).filter(Boolean).join('\n');
    } else if (bInfo.profileLines.length){
      data.profile = uniq(bInfo.profileLines).join('\n');
    }

    // 姓名兜底：如果姓名被误判为求职意向等，取 head 首行
    if (!data.basic.name && sec.head.length){
      var first = cleanSpaces(String(sec.head[0].text || '').replace(/\s+/g, ''));
      if (/^[\u4e00-\u9fa5·]{2,4}$/.test(first) && !JUNK_RE.test(first)) data.basic.name = first;
    }

    // 提示
    var hasSection = sec.order.length > 0;
    if (!hasSection){
      warnings.push('未识别到「教育经历 / 工作经历」等分节标题，已把全部文字当作个人简介处理；可在下方手动调整。');
      if (!data.profile){
        data.profile = normalizeText(raw).map(function(l){ return cleanSpaces(l.text); }).filter(Boolean).join('\n');
      }
    }
    if (!data.basic.name) warnings.push('未识别到姓名，请手动填写。');
    if (!data.basic.phone && !data.basic.email) warnings.push('未识别到电话和邮箱，请手动补充联系方式。');
    if (!data.education.length) warnings.push('未识别到教育经历。');
    if (!data.work.length && !data.projects.length) warnings.push('未识别到工作经历或项目经验。');
    var yearOnlyCount = 0;
    ['education', 'work', 'projects'].forEach(function(k){
      data[k].forEach(function(e){
        if ((e.start && !/^\d{4}-\d{2}$/.test(e.start)) || (e.end && !/^\d{4}-\d{2}$/.test(e.end))) yearOnlyCount++;
      });
    });

    var stats = {
      basic: ['name', 'phone', 'email', 'location', 'target', 'years', 'age'].filter(function(k){ return data.basic[k]; }).length,
      education: data.education.length,
      work: data.work.length,
      projects: data.projects.length,
      skills: data.skills.length,
      honors: data.honors.items.length + (data.honors.extra ? 1 : 0),
      profile: data.profile ? 1 : 0
    };
    stats.total = stats.education + stats.work + stats.projects + stats.skills + stats.honors + stats.profile + (stats.basic ? 1 : 0);

    return { data: data, stats: stats, warnings: warnings, sections: sec.order };
  }

  /* ---------------- 导出 ---------------- */
  return {
    parse: parse,
    // 以下供单测 / 调试使用
    _internal: {
      normalizeText: normalizeText,
      splitSections: splitSections,
      matchHeader: matchHeader,
      normalizeKey: normalizeKey,
      extractRange: extractRange,
      parseDatePoint: parseDatePoint,
      splitEntries: splitEntries,
      parseBasicInfo: parseBasicInfo,
      parseSkills: parseSkills,
      parseHonors: parseHonors,
      parseEducationEntry: parseEducationEntry,
      parseWorkEntry: parseWorkEntry,
      parseProjectEntry: parseProjectEntry,
      segments: segments,
      uniq: uniq
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ResumeParser;
