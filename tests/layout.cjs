// 静态HTML结构与离线资源检查，不进行浏览器布局计算。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(file, 'utf8');
const isFile = file => fs.existsSync(file) && fs.statSync(file).isFile();
function parse(html) {
  const ids = [], resources = [], classes = [];
  // 只解析静态页面的起始标签；排除注释及内联脚本/样式正文中的伪标签。
  const markup = html.replace(/<!--[\s\S]*?-->/g, '').replace(/(<(script|style)\b[^>]*>)[\s\S]*?<\/\2\s*>/gi, '$1');
  for (const tag of markup.matchAll(/<([a-z][\w:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)) {
    const attrs = {};
    for (const attr of tag[2].matchAll(/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[attr[1].toLowerCase()] = attr[2] ?? attr[3] ?? attr[4] ?? '';
    if ('id' in attrs) ids.push(attrs.id);
    classes.push(...(attrs.class || '').split(/\s+/));
    const type = tag[1].toLowerCase();
    const resource = type === 'link' ? attrs.href : /^(script|img)$/.test(type) ? attrs.src : null;
    if (resource) resources.push(resource);
  }
  return {ids, resources, classes};
}
function checkResources(folder, resources) {
  for (const resource of resources) {
    const file = path.resolve(folder, resource);
    assert.ok(file.startsWith(folder + path.sep) && isFile(file), `${folder}: 非本地或缺失资源 ${resource}`);
  }
}
const nav = parse(read(path.join(root, 'index.html')));
checkResources(root, nav.resources);
for (const resource of ['src/script.js','src/style.css']) assert.ok(nav.resources.includes(resource), resource);
assert.ok(isFile(path.join(root, 'src/logo.svg')));
const shared = {'base.css':'game-base.css', 'interface.js':'game-interface.js', 'icons.js':'game-icons.js'};
let count = 0;
for (const item of fs.readdirSync(path.join(root, 'games'), {withFileTypes:true})) {
  if (!item.isDirectory()) continue;
  const folder = path.join(root, 'games', item.name);
  const html = read(path.join(folder, 'index.html'));
  const page = parse(html);
  assert.ok(/<html\b/i.test(html) && /<\/html>/i.test(html), item.name);
  assert.equal(page.ids.length, new Set(page.ids).size, `${item.name}: 重复ID`);
  for (const cls of ['game-header','game-layout','game-stage','game-panel','scores','game-actions','game-status','game-footer']) assert.ok(page.classes.includes(cls), `${item.name}: ${cls}`);
  checkResources(folder, page.resources);
  for (const match of read(path.join(folder, 'script.js')).matchAll(/getElementById\(\s*(['"])([^'"]+)\1\s*\)/g)) {
    if (item.name === 'breakout' && ['game-cover','cover-action'].includes(match[2])) continue;
    assert.ok(page.ids.includes(match[2]), `${item.name}: 缺失脚本绑定 ${match[2]}`);
  }
  for (const [copy, source] of Object.entries(shared)) {
    assert.ok(fs.readFileSync(path.join(folder, copy)).equals(fs.readFileSync(path.join(root, source))), `${item.name}: ${copy} 未同步`);
    assert.ok(page.resources.includes(copy), `${item.name}: 未加载 ${copy}`);
  }
  assert.ok(!page.resources.includes('layout.js'), `${item.name}: 过期入口`);
  assert.ok(html.includes(`data-game="${item.name}"`), `${item.name}: 缺少游戏标识`);
  assert.ok(html.includes(`data-landscape="${item.name}"`),`${item.name}: 缺少横屏登记`);
  assert.ok(page.resources.includes('landscape.css'),`${item.name}: 缺少本地横屏资源`);
  count++;
}
assert.ok(fs.readFileSync(path.join(root,'src/icons.js')).equals(fs.readFileSync(path.join(root,'game-icons.js'))));
console.log(`PASS: ${count}款游戏静态页面结构、唯一ID、脚本绑定、本地资源与公共副本一致。`);
require('node:child_process').execFileSync(process.execPath,[path.join(root,'scripts/sync-interface.cjs'),'--check'],{stdio:'pipe'});
