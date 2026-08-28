'use strict';
const tests = [];
function test(name, fn){ tests.push({ name, fn }); }
async function runAll(){
  let pass = 0, fail = 0;
  for (const t of tests){
    try { await t.fn(); console.log('PASS ' + t.name); pass++; }
    catch (e){ console.log('FAIL ' + t.name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0,3).join(' | ') : e)); fail++; }
  }
  console.log('[suite] ' + pass + ' passed, ' + fail + ' failed');
  if (fail > 0) process.exitCode = 1;
}
module.exports = { test, runAll };