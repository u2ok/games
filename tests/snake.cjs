// 开发检查：通过内存 DOM 替身验证状态与规则，不改变浏览器存档或生产脚本。
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = {};
const context = new Proxy({}, { get: () => function () {} });
function element(id) { return elements[id] || (elements[id] = { textContent: '', hidden: false, dataset: {}, addEventListener() {}, setAttribute() {}, querySelectorAll() { return []; }, getContext() { return context; }, focus() {} }); }
const storage = {};
const sandbox = { document: { getElementById: element, querySelector: element, querySelectorAll() { return []; }, addEventListener() {} }, window: { addEventListener() {} }, localStorage: { getItem(key) { return storage[key] || null; }, setItem(key, value) { storage[key] = value; } }, setInterval() { return 1; }, clearInterval() {}, console };
let source = fs.readFileSync(__dirname + '/../games/snake/script.js', 'utf8');
// 仅在测试内存中追加断言，闭包内的私有状态不暴露给生产页面。
source = source.replace('  resetBoard(); syncControls(); updateStorageNote();', `
  mode = 'challenge';
  for (levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
    resetBoard();
    if (snake.some(function(p) { return isObstacle(p.x,p.y); })) throw Error('出生点与障碍重叠');
    if (isObstacle(food.x,food.y)) throw Error('食物与障碍重叠');
    state = 'running'; score = (levels[levelIndex].target - 1) * 10;
    food = {x:5,y:3}; tick();
    if (state !== 'won' || completed !== levelIndex + 1) throw Error('过关或解锁失败');
    state = 'ready'; resetBoard();
    if (levelIndex >= 2) { snake = [{x:obstacles[0].x-1,y:obstacles[0].y},{x:0,y:0}]; direction = DIRECTIONS.right; state='running'; tick(); if(state !== 'over') throw Error('障碍碰撞失败'); }
  }
  levelIndex=0; mode='classic'; state='ready'; resetBoard();
  if(obstacles.length) throw Error('经典模式残留障碍');
  if(activeRules.speed !== settings.speed) throw Error('经典规则未恢复');
  `);
vm.runInNewContext(source, sandbox);
assert.equal(storage['mini-games:snake:completed'], '5');
console.log('PASS: 五关目标、连续解锁与保存、障碍碰撞、出生/食物安全、经典规则恢复。');
