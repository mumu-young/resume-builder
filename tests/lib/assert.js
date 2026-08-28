'use strict';
function ok(cond, msg){ if (!cond) throw new Error(msg || 'expected truthy'); }
function eq(actual, expected, msg){
  if (actual !== expected) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
}
function deepEq(actual, expected, msg){
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + b + ' but got ' + a);
}
function matches(actual, re, msg){
  if (!re.test(String(actual))) throw new Error((msg ? msg + ': ' : '') + JSON.stringify(actual) + ' does not match ' + re);
}
module.exports = { ok, eq, deepEq, matches };