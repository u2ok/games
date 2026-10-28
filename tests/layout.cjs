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
    const sharedFiles=['shared/base.css','shared/interface.js','shared/icons.js'].map(name=>path.join(root,name));
    assert.ok((file.startsWith(folder + path.sep)||sharedFiles.includes(file)) && isFile(file), `${folder}: 非项目内或缺失资源 ${resource}`);
  }
}
const nav = parse(read(path.join(root, 'index.html')));
checkResources(root, nav.resources);
for (const resource of ['src/script.js','src/style.css']) assert.ok(nav.resources.includes(resource), resource);
assert.ok(isFile(path.join(root, 'src/logo.svg')));
const shared = {'base.css':'shared/base.css', 'interface.js':'shared/interface.js', 'icons.js':'shared/icons.js'};
const publicCSS=read(path.join(root,'shared/base.css'));
assert.ok(!/html:has\(body|html\s+body|wide-table/.test(publicCSS),'公共CSS不得重新引入重复根节点链或失效wide-table分支');
assert.ok(!publicCSS.includes('[data-game]'),'普通公共组件无需重复使用data-game存在性前缀');
assert.ok(!/\.summary-card\s+\.summary-head|\.game-header\s+h1/.test(publicCSS),'标题与摘要子组件应使用明确class，不依赖多层祖先');
let count = 0;
for (const item of fs.readdirSync(path.join(root, 'games'), {withFileTypes:true})) {
  if (!item.isDirectory()) continue;
  const folder = path.join(root, 'games', item.name);
  const html = read(path.join(folder, 'index.html'));
  const page = parse(html);
  for(const cls of ['game-title','game-logo','hall-link','score-label','score-value'])assert.ok(page.classes.includes(cls),`${item.name}: 缺少公共组件角色${cls}`);
  assert.ok(!/\[data-game(?:=|\])/.test(read(path.join(folder,'style.css'))),`${item.name}: 私有CSS无需重复限定data-game，应使用玩法组件选择器`);
  assert.ok(/<html\b/i.test(html) && /<\/html>/i.test(html), item.name);
  assert.equal(page.ids.length, new Set(page.ids).size, `${item.name}: 重复ID`);
  for (const cls of ['game-header','game-layout','game-stage','game-panel','scores','game-actions','game-status','game-footer']) assert.ok(page.classes.includes(cls), `${item.name}: ${cls}`);
  checkResources(folder, page.resources);
  for (const match of read(path.join(folder, 'script.js')).matchAll(/getElementById\(\s*(['"])([^'"]+)\1\s*\)/g)) {
    assert.ok(page.ids.includes(match[2]), `${item.name}: 缺失脚本绑定 ${match[2]}`);
  }
  for (const [copy, source] of Object.entries(shared)) {
    assert.ok(!fs.existsSync(path.join(folder,copy)),`${item.name}: 不得保留公共副本${copy}`);
    assert.ok(page.resources.includes('../../'+source), `${item.name}: 未直接引用根公共文件 ${source}`);
  }
  assert.ok(page.resources.indexOf('../../shared/base.css')<page.resources.indexOf('style.css'),`${item.name}: CSS加载顺序`);
  assert.ok(page.resources.indexOf('../../shared/icons.js')<page.resources.indexOf('script.js')&&page.resources.indexOf('script.js')<page.resources.indexOf('../../shared/interface.js'),`${item.name}: 脚本加载顺序`);
  assert.ok(!page.resources.includes('layout.js'), `${item.name}: 过期入口`);
  assert.ok(html.includes(`data-game="${item.name}"`), `${item.name}: 缺少游戏标识`);
  assert.ok(html.includes(`data-landscape="${item.name}"`),`${item.name}: 缺少横屏登记`);
  count++;
}
assert.ok(nav.resources.includes('shared/icons.js'));
assert.ok(!isFile(path.join(root,'src/icons.js')));
for(const oldName of Object.keys(shared))assert.ok(!isFile(path.join(root,'game-'+oldName)),`根目录不得保留旧公共入口game-${oldName}`);
console.log(`PASS: ${count}款游戏结构、唯一ID、脚本绑定、项目内资源及shared公共文件直接引用，无公共副本。`);
assert.ok(!isFile(path.join(root,'shared/landscape.css')));
assert.ok(!isFile(path.join(root,'scripts/build-shared-css.cjs')));
