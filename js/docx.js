'use strict';
/* 极简 .docx 导出：把简历数据转成 Word 文档（无压缩 ZIP + WordprocessingML） */
function xmlEsc(s){
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function docxPara(runs, opts){
  opts = opts || {};
  var ppr = '<w:pPr>';
  if (opts.before !== undefined || opts.after !== undefined){
    ppr += '<w:spacing w:before="' + (opts.before || 0) + '" w:after="' + (opts.after || 0) + '"/>';
  }
  if (opts.shade) ppr += '<w:shd w:val="clear" w:color="auto" w:fill="' + opts.shade + '"/>';
  if (opts.bottomLine || opts.leftBar){
    ppr += '<w:pBdr>';
    if (opts.bottomLine) ppr += '<w:bottom w:val="single" w:sz="16" w:space="4" w:color="' + opts.bottomLine + '"/>';
    if (opts.leftBar) ppr += '<w:left w:val="single" w:sz="24" w:space="4" w:color="' + opts.leftBar + '"/>';
    ppr += '</w:pBdr>';
  }
  if (opts.jc) ppr += '<w:jc w:val="' + opts.jc + '"/>';
  ppr += '</w:pPr>';
  var rs = '';
  for (var i = 0; i < runs.length; i++){
    var run = runs[i];
    if (!run || run.text === undefined || run.text === null) continue;
    var rpr = '<w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei" w:hAnsi="Microsoft YaHei"/>';
    if (run.bold) rpr += '<w:b/>';
    if (run.size) rpr += '<w:sz w:val="' + run.size + '"/><w:szCs w:val="' + run.size + '"/>';
    if (run.color) rpr += '<w:color w:val="' + String(run.color).replace('#', '') + '"/>';
    rpr += '</w:rPr>';
    rs += '<w:r>' + rpr + '<w:t xml:space="preserve">' + xmlEsc(run.text) + '</w:t></w:r>';
  }
  return '<w:p>' + ppr + rs + '</w:p>';
}
function docxLines(text){
  return String(text || '').split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
}
function docxContactLine(b){
  var sep;
  if (b.contactSeparator === '·') sep = ' · ';
  else if (b.contactSeparator === ' ') sep = '     ';
  else sep = ' | ';
  return tplContactItems(b).map(function(it){ return tplContactItemText(it, b); }).join(sep);
}
function stripHex(c){ return String(c || '').replace('#', ''); }
function lightenHex(hex, ratio){
  hex = String(hex || '').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(function(c){ return c + c; }).join('');
  if (hex.length !== 6) return 'EAF1FB';
  var r = parseInt(hex.substr(0, 2), 16), g = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16);
  r = Math.round(r + (255 - r) * ratio); g = Math.round(g + (255 - g) * ratio); b = Math.round(b + (255 - b) * ratio);
  return ('0' + r.toString(16)).slice(-2) + ('0' + g.toString(16)).slice(-2) + ('0' + b.toString(16)).slice(-2);
}
function docxSectPr(r){
  var pad = (r.style && r.style.pagePadding) || { top: 10, right: 12, bottom: 10, left: 12 };
  var top = Math.round((pad.top || 0) * 56.6929);
  var right = Math.round((pad.right || 0) * 56.6929);
  var bottom = Math.round((pad.bottom || 0) * 56.6929);
  var left = Math.round((pad.left || 0) * 56.6929);
  return '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="' + top + '" w:right="' + right + '" w:bottom="' + bottom + '" w:left="' + left + '" w:header="720" w:footer="720" w:gutter="0"/>' +
    '</w:sectPr>';
}
function docxSectionHead(r, id, opts){
  var titles = Object.assign({}, DEFAULT_SECTION_TITLES, r.sectionTitles || {});
  var titleColor = stripHex((r.style && r.style.titleColor) || '#2F5496');
  var title = titles[id] || DEFAULT_SECTION_TITLES[id];
  var tplId = getTemplate(r.templateId).id;
  opts = opts || {};
  if (tplId === 'titlebg'){
    return docxPara([{ text: title, bold: true, size: 24, color: 'FFFFFF' }], { before: opts.before || 160, after: opts.after || 80, shade: titleColor });
  }
  if (tplId === 'titlebglight'){
    return docxPara([{ text: title, bold: true, size: 24, color: '222222' }], { before: opts.before || 160, after: opts.after || 80, shade: lightenHex(titleColor, 0.88), leftBar: titleColor });
  }
  return docxPara([{ text: title, bold: true, size: 24, color: titleColor }], { before: opts.before || 160, after: opts.after || 80, bottomLine: titleColor });
}
function docxSectionItems(r, id, opts){
  var d = r.data || {};
  var xml = '';
  opts = opts || {};
  if (id === 'education'){
    xml += docxSectionHead(r, id, opts);
    d.education.forEach(function(e){
      var runs = [];
      if (e.school) runs.push({ text: e.school, bold: true });
      if (e.major) runs.push({ text: '  ' + e.major });
      var date = tplDateRange(e.start, e.end);
      if (date) runs.push({ text: '    ' + date, color: '#666666' });
      if (runs.length) xml += docxPara(runs, { after: 60 });
      if (e.courses) {
        var courseLines = String(e.courses).split(/\r?\n/).map(function(s){ return s.trim(); }).filter(Boolean);
        if (courseLines.length) xml += docxPara([{ text: '相关课程：' + courseLines.join('、'), size: 20 }], { after: 40 });
      }
      docxLines(e.description).forEach(function(l){ xml += docxPara([{ text: l, size: 20 }], { after: 40 }); });
    });
  } else if (id === 'work'){
    xml += docxSectionHead(r, id, opts);
    d.work.forEach(function(w){
      var runs = [];
      if (w.company) runs.push({ text: w.company, bold: true });
      if (w.position) runs.push({ text: '  ' + w.position });
      var date = tplDateRange(w.start, w.end);
      if (date) runs.push({ text: '    ' + date, color: '#666666' });
      if (runs.length) xml += docxPara(runs, { after: 60 });
      docxLines(w.description).forEach(function(l){ xml += docxPara([{ text: l, size: 20 }], { after: 40 }); });
    });
  } else if (id === 'projects'){
    xml += docxSectionHead(r, id, opts);
    d.projects.forEach(function(p){
      var runs = [];
      if (p.name) runs.push({ text: p.name, bold: true });
      if (p.role) runs.push({ text: '  ' + p.role });
      if (p.tech) runs.push({ text: '  技术栈：' + p.tech, color: '#555555' });
      if (p.link) runs.push({ text: '  ' + p.link, color: '#555555' });
      var date = tplDateRange(p.start, p.end);
      if (date) runs.push({ text: '    ' + date, color: '#666666' });
      if (runs.length) xml += docxPara(runs, { after: 60 });
      docxLines(p.description).forEach(function(l){ xml += docxPara([{ text: l, size: 20 }], { after: 40 }); });
    });
  } else if (id === 'skills'){
    xml += docxSectionHead(r, id, opts);
    d.skills.forEach(function(k){
      var vals = String(k.items || '').split(/[\r\n,，、;；]+/).map(function(s){ return s.trim(); }).filter(Boolean);
      if (!vals.length) return;
      var runs = [{ text: (k.category || '技能') + '：', bold: true }];
      vals.forEach(function(v){ runs.push({ text: '  ' + v }); });
      xml += docxPara(runs, { after: 60 });
    });
  } else if (id === 'honors'){
    xml += docxSectionHead(r, id, opts);
    d.honors.items.forEach(function(h){
      var runs = [];
      if (h.title) runs.push({ text: h.title, bold: true });
      if (h.year) runs.push({ text: '  （' + h.year + '）', color: '#666666' });
      if (h.description) runs.push({ text: '  ' + h.description });
      if (runs.length) xml += docxPara(runs, { after: 60 });
    });
    if (d.honors.extra && d.honors.extra.trim()) xml += docxPara([{ text: d.honors.extra, size: 20 }], { after: 60 });
  } else if (id === 'profile'){
    xml += docxSectionHead(r, id, opts);
    if (d.profile && String(d.profile).trim()) xml += docxPara([{ text: d.profile, size: 21 }], { after: 60 });
  }
  return xml;
}
function buildDocxOneCol(r, photo){
  var d = r.data || {};
  var b = d.basic || {};
  var tplId = getTemplate(r.templateId).id;
  var xml = '';
  if (photo) xml += docxPhotoPara(photo.rId, 'center');
  var jc = (tplId === 'clean') ? 'center' : null;
  var headerOpts = { after: 60 };
  if (jc) headerOpts.jc = 'center';
  if (b.name) xml += docxPara([{ text: b.name, bold: true, size: 40 }], headerOpts);
  if (b.target) xml += docxPara([{ text: tplTargetLine(b), size: 22, color: '#444444' }], headerOpts);
  var contact = docxContactLine(b);
  if (contact) xml += docxPara([{ text: contact, size: 19, color: '#444444' }], headerOpts);
  (r.sectionOrder || DEFAULT_SECTION_ORDER).forEach(function(id){
    xml += docxSectionItems(r, id, { before: 160, after: 80 });
  });
  xml += docxSectPr(r);
  return xml;
}
function buildDocxTwoCol(r, photo){
  var d = r.data || {};
  var b = d.basic || {};
  var titleColor = stripHex((r.style && r.style.titleColor) || '#1890FF');
  var pad = (r.style && r.style.pagePadding) || { top: 10, right: 12, bottom: 10, left: 12 };
  var contentW = 11906 - Math.round((pad.left || 0) * 56.6929) - Math.round((pad.right || 0) * 56.6929);
  var leftW = Math.round(contentW * 0.34);
  var rightW = contentW - leftW;
  var titles = Object.assign({}, DEFAULT_SECTION_TITLES, r.sectionTitles || {});
  var left = '';
  if (photo) left += docxPhotoPara(photo.rId, 'center');
  left += docxPara([{ text: b.name || '', bold: true, size: 30, color: 'FFFFFF' }], { after: 40, jc: 'center' });
  if (b.target) left += docxPara([{ text: tplTargetLine(b), size: 19, color: 'FFFFFF' }], { after: 80, jc: 'center' });
  tplContactItems(b).forEach(function(it){
    left += docxPara([{ text: tplContactItemText(it, b), size: 17, color: 'FFFFFF' }], { after: 30 });
  });
  if (d.education.length){
    left += docxPara([{ text: titles.education, bold: true, size: 21, color: 'FFFFFF' }], { before: 120, after: 60 });
    d.education.forEach(function(e){
      var runs = [];
      if (e.school) runs.push({ text: e.school || '', bold: true, color: 'FFFFFF' });
      var date = tplDateRange(e.start, e.end);
      if (date) runs.push({ text: '  ' + date, size: 15, color: 'FFFFFF' });
      if (e.major) runs.push({ text: '  ' + e.major, color: 'FFFFFF' });
      left += docxPara(runs, { after: 30 });
      docxLines(e.description).forEach(function(l){ left += docxPara([{ text: l, size: 15, color: 'FFFFFF' }], { after: 30 }); });
    });
  }
  var right = '';
  (r.sectionOrder || DEFAULT_SECTION_ORDER).forEach(function(id){
    if (id === 'education') return;
    right += docxSectionItems(r, id, { before: 120, after: 60 });
  });
  var xml = '<w:tbl><w:tblPr><w:tblW w:w="' + contentW + '" w:type="dxa"/><w:tblLayout w:type="fixed"/>' +
    '<w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="' + leftW + '"/><w:gridCol w:w="' + rightW + '"/></w:tblGrid><w:tr>' +
    '<w:tc><w:tcPr><w:tcW w:w="' + leftW + '" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="' + titleColor + '"/><w:vAlign w:val="top"/><w:tcMar><w:top w:w="120" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>' + left + '</w:tc>' +
    '<w:tc><w:tcPr><w:tcW w:w="' + rightW + '" w:type="dxa"/><w:vAlign w:val="top"/><w:tcMar><w:top w:w="120" w:type="dxa"/><w:left w:w="200" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>' + right + '</w:tc>' +
    '</w:tr></w:tbl>' + docxSectPr(r);
  return xml;
}
var B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(b64){
  b64 = String(b64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
  var out = [];
  var buffer = 0, bits = 0;
  for (var i = 0; i < b64.length; i++){
    var ch = b64.charAt(i);
    if (ch === '=') break;
    buffer = (buffer << 6) | B64_CHARS.indexOf(ch);
    bits += 6;
    if (bits >= 8){ bits -= 8; out.push((buffer >> bits) & 0xFF); }
  }
  return new Uint8Array(out);
}
function photoParts(r){
  var photo = (r && r.data && r.data.basic && r.data.basic.photo) || '';
  var m = String(photo).match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!m) return null;
  var ext = (m[1] === 'png') ? 'png' : 'jpeg';
  return { ext: ext, data: base64ToBytes(m[2]) };
}
function docxPhotoPara(rId, jc){
  var cx = 792000, cy = 1008000;
  var ppr = '<w:pPr><w:spacing w:before="0" w:after="80"/>';
  if (jc) ppr += '<w:jc w:val="' + jc + '"/>';
  ppr += '</w:pPr>';
  return '<w:p>' + ppr +
    '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
    '<wp:extent cx="' + cx + '" cy="' + cy + '"/>' +
    '<wp:docPr id="1" name="photo"/>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="photo"/><pic:cNvPicPr/></pic:nvPicPr>' +
    '<pic:blipFill><a:blip r:embed="' + rId + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}
function buildDocxBody(r, photo){
  var tplId = getTemplate(r.templateId).id;
  if (tplId === 'open') return buildDocxTwoCol(r, photo);
  return buildDocxOneCol(r, photo);
}
function docRels(rId, ext){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="' + rId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.' + ext + '"/>' +
    '</Relationships>';
}
function buildDocxBytes(r){
  var photo = photoParts(r);
  if (photo) photo.rId = 'rIdImg1';
  var body = buildDocxBody(r, photo);
  var docNs = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  var documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document ' + docNs + '><w:body>' + body + '</w:body></w:document>';
  var imgDefault = photo ? '<Default Extension="' + photo.ext + '" ContentType="image/' + (photo.ext === 'png' ? 'png' : 'jpeg') + '"/>' : '';
  var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    imgDefault +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';
  var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';
  var enc = new TextEncoder();
  var parts = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rels) },
    { name: 'word/document.xml', data: enc.encode(documentXml) }
  ];
  if (photo){
    parts.push({ name: 'word/_rels/document.xml.rels', data: enc.encode(docRels(photo.rId, photo.ext)) });
    parts.push({ name: 'word/media/image1.' + photo.ext, data: photo.data });
  }
  return zipStore(parts);
}
/* 极简 ZIP（Store 无压缩） */
var crcTable = null;
function crc32(data){
  if (!crcTable){
    crcTable = [];
    for (var n = 0; n < 256; n++){
      var c = n;
      for (var k = 0; k < 8; k++){ c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
      crcTable[n] = c >>> 0;
    }
  }
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < data.length; i++){ crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xFF]; }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function zipStore(files){
  var enc = new TextEncoder();
  var chunks = [];
  var central = [];
  var offset = 0;
  files.forEach(function(f){
    var nameBytes = enc.encode(f.name);
    var data = f.data;
    var crc = crc32(data);
    var local = new Uint8Array(30);
    var dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0x0800, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    chunks.push(local, nameBytes, data);
    var cen = new Uint8Array(46);
    var cdv = new DataView(cen.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0x0800, true);
    cdv.setUint16(10, 0, true);
    cdv.setUint16(12, 0, true);
    cdv.setUint16(14, 0, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, data.length, true);
    cdv.setUint32(24, data.length, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, offset, true);
    central.push(cen, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  });
  var cdSize = 0;
  central.forEach(function(c){ cdSize += c.length; });
  var eocd = new Uint8Array(22);
  var edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(4, 0, true);
  edv.setUint16(6, 0, true);
  edv.setUint16(8, files.length, true);
  edv.setUint16(10, files.length, true);
  edv.setUint32(12, cdSize, true);
  edv.setUint32(16, offset, true);
  edv.setUint16(20, 0, true);
  var total = cdSize + 22;
  chunks.forEach(function(c){ total += c.length; });
  var out = new Uint8Array(total);
  var pos = 0;
  chunks.forEach(function(c){ out.set(c, pos); pos += c.length; });
  central.forEach(function(c){ out.set(c, pos); pos += c.length; });
  out.set(eocd, pos);
  return out;
}