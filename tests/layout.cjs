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
    const sharedFiles=['game-base.css','game-interface.js','game-icons.js','game-landscape.css'].map(name=>path.join(root,name));
    assert.ok((file.startsWith(folder + path.sep)||sharedFiles.includes(file)) && isFile(file), `${folder}: 非项目内或缺失资源 ${resource}`);
  }
}
const nav = parse(read(path.join(root, 'index.html')));
checkResources(root, nav.resources);
for (const resource of ['src/script.js','src/style.css']) assert.ok(nav.resources.includes(resource), resource);
assert.ok(isFile(path.join(root, 'src/logo.svg')));
const shared = {'base.css':'game-base.css', 'interface.js':'game-interface.js', 'icons.js':'game-icons.js','landscape.css':'game-landscape.css'};
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
    assert.ok(!fs.existsSync(path.join(folder,copy)),`${item.name}: 不得保留公共副本${copy}`);
    assert.ok(page.resources.includes('../../'+source), `${item.name}: 未直接引用根公共文件 ${source}`);
  }
  assert.ok(page.resources.indexOf('../../game-base.css')<page.resources.indexOf('style.css')&&page.resources.indexOf('style.css')<page.resources.indexOf('../../game-landscape.css'),`${item.name}: CSS加载顺序`);
  assert.ok(page.resources.indexOf('../../game-icons.js')<page.resources.indexOf('script.js')&&page.resources.indexOf('script.js')<page.resources.indexOf('../../game-interface.js'),`${item.name}: 脚本加载顺序`);
  assert.ok(!page.resources.includes('layout.js'), `${item.name}: 过期入口`);
  assert.ok(html.includes(`data-game="${item.name}"`), `${item.name}: 缺少游戏标识`);
  assert.ok(html.includes(`data-landscape="${item.name}"`),`${item.name}: 缺少横屏登记`);
  count++;
}
assert.ok(nav.resources.includes('game-icons.js'));
assert.ok(!isFile(path.join(root,'src/icons.js')));
console.log(`PASS: ${count}款游戏结构、唯一ID、脚本绑定、项目内资源及根公共文件直接引用，无公共副本。`);
require('node:child_process').execFileSync(process.execPath,[path.join(root,'scripts/build-shared-css.cjs'),'--check'],{stdio:'pipe'});
