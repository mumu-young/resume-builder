'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
function loadScripts(globalObj, files){
  const ctx = vm.createContext(globalObj);
  for (const rel of files){
    const full = path.join(ROOT, rel);
    const code = fs.readFileSync(full, 'utf8');
    vm.runInContext(code, ctx, { filename: rel });
  }
  return ctx;
}
module.exports = { loadScripts, ROOT };