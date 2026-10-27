// 无外部依赖：语法、导航登记与现存规则回归。完整通关范围见 TEST-REPORT.md。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
let scripts = 0;
function scan(dir) {
  for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
    if (item.name.startsWith('.')) continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) scan(file);
    else if (file.endsWith('.js')) {new vm.Script(fs.readFileSync(file,'utf8'), {filename:file}); scripts++;}
  }
}
scan(root);
const nav = fs.readFileSync(path.join(root,'src/script.js'),'utf8');
const begin = nav.indexOf('var games = ') + 'var games = '.length;
const end = nav.indexOf('\n  ];', begin) + '\n  ]'.length;
assert.ok(begin > 11 && end > begin);
const games = vm.runInNewContext('(' + nav.slice(begin,end) + ')');
const ids = games.map(game => game.id);
assert.equal(new Set(ids).size, ids.length, '重复导航 ID');
const folders = fs.readdirSync(path.join(root,'games')).filter(name => fs.existsSync(path.join(root,'games',name,'index.html')));
assert.deepEqual([...ids].sort(), folders.sort(), '导航与实际游戏目录不一致');
for (const game of games) {
  assert.ok(game.name && game.description && game.controls && game.tags.length);
  for (const file of ['README.md','logo.svg']) assert.ok(fs.existsSync(path.join(root,'games',game.id,file)));
}
execFileSync(process.execPath, [path.join(__dirname,'snake.cjs')], {stdio:'inherit'});
console.log(`PASS: ${scripts} 份 JavaScript 语法、${games.length} 款游戏登记与资源；规则回归目前仅覆盖贪吃蛇。`);
