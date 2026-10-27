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
const checkOnly=process.argv.includes('--check');
// 从现有移动规则生成大手机横屏补充样式，避免维护第二份组件主题。
// 选择器前缀把新增断点限制在横屏适配页面，原始端别规则保持原样。
function mobileRules(css) {
  let result = '';
  const re = /@media\s*([^{}]+)\{/g;
  let m;
  while ((m = re.exec(css))) {
    let end = re.lastIndex, depth = 1;
    while (depth && end < css.length) {const c=css[end++];if(c==='{')depth++;if(c==='}')depth--;}
    if (/max-width\s*:\s*850px/.test(m[1])) {
      const condition=m[1].replace(/\(max-width\s*:\s*850px\)/g,'(max-width:1200px)');
      result+='@media '+condition+'{'+css.slice(re.lastIndex,end-1)+'}\n';
    }
    re.lastIndex=end;
  }
  return result;
}
function sync(file, content) {
  if (!fs.existsSync(file) || !fs.readFileSync(file).equals(content)) {
    if(checkOnly)throw new Error(`公共或横屏资源未同步：${path.relative(root,file)}`);
    fs.writeFileSync(file, content);
    updated++;
  }
}
sync(path.join(root, 'src/icons.js'), sources.find(([name]) => name === 'icons.js')[1]);
for (const item of fs.readdirSync(path.join(root, 'games'), {withFileTypes:true}).sort((a,b) => a.name.localeCompare(b.name))) {
  const folder = path.join(root, 'games', item.name);
  if (!item.isDirectory() || !fs.existsSync(path.join(folder, 'index.html'))) continue;
  for (const [name, content] of sources) sync(path.join(folder, name), content);
  if (/data-landscape=/.test(fs.readFileSync(path.join(folder,'index.html'),'utf8'))) {
    const source=fs.readFileSync(path.join(root,'game-base.css'),'utf8');
    const layoutStart=source.indexOf('/* 全站触屏横屏布局');
    const layoutEnd=source.indexOf('/* 可复用的关卡网格');
    if(layoutStart<0||layoutEnd<=layoutStart)throw new Error('缺少公共横屏布局源区段');
    // 移动组件与横屏区域排列分别提取，生成文件不再重复包含横屏布局。
    const base=mobileRules(source.slice(0,layoutStart)+source.slice(layoutEnd));
    const privateRules=mobileRules(fs.readFileSync(path.join(folder,'style.css'),'utf8'));
    // 原公共横屏规则优先于私有历史行号规则，避免专用输入覆盖摘要。
    const landscape=mobileRules(source.slice(layoutStart,layoutEnd));
    const scoped=(base+privateRules+'\n'+landscape).replace(/\/\*[\s\S]*?\*\//g,'').replace(/([^{}]+)\{/g,(all,selector)=>{
      selector=selector.trim();
      if(selector.startsWith('@'))return selector+'{';
      const prefix='html:has(body[data-landscape])';
      return (selector==='html'?prefix:prefix+' :is('+selector+')')+'{';
    });
    const css='/* 自动生成：修改根公共源或私有玩法样式后运行同步脚本。 */\n@media(min-width:851px) and (max-width:1200px) and (max-height:480px) and (orientation:landscape) and (pointer:coarse){\n'+scoped+'\n}\n';
    sync(path.join(folder,'landscape.css'),Buffer.from(css));
  }
}
console.log(`公共资源同步完成，更新 ${updated} 个文件。`);
