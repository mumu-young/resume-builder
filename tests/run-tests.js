'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = __dirname;
function findTests(dir, out){
  out = out || [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) findTests(p, out);
    else if (/\.(test|e2e)\.js$/.test(ent.name)) out.push(p);
  }
  return out;
}
const files = findTests(root).sort();
let pass = 0, fail = 0;
const failedFiles = [];
for (const f of files){
  console.log('\n===== ' + path.relative(root, f) + ' =====');
  const r = spawnSync(process.execPath, [f], { cwd: root, encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  const okCount = (r.stdout.match(/^PASS /gm) || []).length;
  const failCount = (r.stdout.match(/^FAIL /gm) || []).length;
  pass += okCount; fail += failCount;
  if (r.status !== 0 || failCount > 0) failedFiles.push(path.relative(root, f));
}
console.log('\n========== 测试汇总 ==========');
console.log('通过: ' + pass + '  失败: ' + fail);
if (failedFiles.length){
  console.log('失败文件: ' + failedFiles.join(', '));
  process.exit(1);
} else {
  console.log('全部测试通过 ✅');
}