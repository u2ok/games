// 公共副本按字节同步；不修改HTML，可从任意工作目录执行。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sources = Object.entries({
  'interface.js': 'game-interface.js',
  'icons.js': 'game-icons.js',
  'base.css': 'game-base.css'
}).map(([name, source]) => [name, fs.readFileSync(path.join(root, source))]);
let updated = 0;
function sync(file, content) {
  if (!fs.existsSync(file) || !fs.readFileSync(file).equals(content)) {
    fs.writeFileSync(file, content);
    updated++;
  }
}
sync(path.join(root, 'src/icons.js'), sources.find(([name]) => name === 'icons.js')[1]);
for (const item of fs.readdirSync(path.join(root, 'games'), {withFileTypes:true}).sort((a,b) => a.name.localeCompare(b.name))) {
  const folder = path.join(root, 'games', item.name);
  if (!item.isDirectory() || !fs.existsSync(path.join(folder, 'index.html'))) continue;
  for (const [name, content] of sources) sync(path.join(folder, name), content);
}
console.log(`公共资源同步完成，更新 ${updated} 个文件。`);
