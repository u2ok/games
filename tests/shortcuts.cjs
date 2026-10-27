// 公共快捷键的模拟 DOM 回归；不代表浏览器或完整游戏验证。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../shared/interface.js', 'utf8');
const end = source.indexOf('  installGameShortcuts();');
assert.ok(end > 0);
let handler, dialog = false;
const nodes = {};
for (const id of ['start', 'pause', 'restart']) nodes[id] = {
  disabled: false, textContent: id === 'start' ? '开始' : '', clicks: 0,
  setAttribute() {}, click() { this.clicks++; }
};
vm.runInNewContext(source.slice(0, end) + ' installGameShortcuts(); }());', {
  document: {
    getElementById: id => nodes[id],
    querySelector: selector => selector === 'dialog[open]' && dialog,
    addEventListener: (name, callback) => { handler = callback; }
  }
});
function key(key, extra = {}) {
  const event = {key, target: {tagName: 'BODY'}, preventDefault() {this.prevented = true;}, stopImmediatePropagation() {this.stopped = true;}, ...extra};
  handler(event);
  return event;
}
assert.ok(key('Enter').prevented);
assert.equal(nodes.start.clicks, 1);
key('p'); assert.equal(nodes.pause.clicks, 0);
nodes.start.disabled = true;
assert.ok(key('P').stopped); assert.equal(nodes.pause.clicks, 1);
assert.equal(key('Enter').prevented, undefined);
assert.ok(key('Enter', {shiftKey: true}).prevented);
assert.equal(nodes.restart.clicks, 1);
for (const extra of [{repeat:true}, {isComposing:true}, {ctrlKey:true}, {metaKey:true}, {altKey:true}, {defaultPrevented:true}, {target:{tagName:'INPUT'}}, {target:{tagName:'SELECT'}}, {target:{tagName:'TEXTAREA'}}, {target:{isContentEditable:true}}]) {
  assert.equal(key('p', extra).prevented, undefined);
}
dialog = true; assert.equal(key('p').prevented, undefined); dialog = false;
nodes.start.disabled = false;
for (const tagName of ['BUTTON','A']) assert.equal(key('Enter', {target:{tagName}}).prevented, undefined);
assert.ok(key('Enter', {target:null}).prevented);
nodes.restart.disabled = true;
assert.equal(key('Enter', {shiftKey:true}).prevented, undefined);
console.log('PASS: 公共快捷键开始、暂停、重开、玩法透传与输入保护（模拟 DOM）。');
