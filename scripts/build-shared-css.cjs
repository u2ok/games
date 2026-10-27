// 汇总根目录共享横屏样式；不向任何游戏目录复制公共文件。
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function mobileRules(css){
  let result='';const re=/@media\s*([^{}]+)\{/g;let m;
  while((m=re.exec(css))){
    let end=re.lastIndex,depth=1;
    while(depth&&end<css.length){const c=css[end++];if(c==='{')depth++;if(c==='}')depth--;}
    if(/max-width\s*:\s*850px/.test(m[1]))result+='@media '+m[1].replace(/\(max-width\s*:\s*850px\)/g,'(max-width:1200px)')+'{'+css.slice(re.lastIndex,end-1)+'}\n';
    re.lastIndex=end;
  }
  return result;
}
function scope(css,prefix){
  return css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/([^{}]+)\{/g,(all,selector)=>{
    selector=selector.trim();if(selector.startsWith('@'))return selector+'{';
    return (selector==='html'?prefix:prefix+' :is('+selector+')')+'{';
  });
}
const source=fs.readFileSync(path.join(root,'game-base.css'),'utf8');
const start=source.indexOf('/* 全站触屏横屏布局'),end=source.indexOf('/* 可复用的关卡网格');
if(start<0||end<=start)throw new Error('缺少公共横屏布局源区段');
const prefix='html:has(body[data-landscape])';
let css=scope(mobileRules(source.slice(0,start)+source.slice(end)),prefix);
for(const game of fs.readdirSync(path.join(root,'games')).sort()){
  const folder=path.join(root,'games',game);
  if(!fs.existsSync(path.join(folder,'index.html')))continue;
  // 私有移动规则按游戏精确限定，避免汇总后互相污染。
  const privateRules=mobileRules(fs.readFileSync(path.join(folder,'style.css'),'utf8')).replace(/url\((['"]?)([^)'"\s]+)\1\)/g,(all,quote,value)=>{
    if(/^(?:[a-z]+:|\/|#)/i.test(value))return all;
    return `url(${quote}${path.posix.join('games',game,value)}${quote})`;
  });
  css+=scope(privateRules,`html:has(body[data-game="${game}"])`);
}
css+=scope(mobileRules(source.slice(start,end)),prefix);
css='/* 自动生成：node scripts/build-shared-css.cjs。共享入口，不复制到游戏目录。 */\n@media(min-width:851px) and (max-width:1200px) and (max-height:480px) and (orientation:landscape) and (pointer:coarse){\n'+css+'\n}\n';
const output=path.join(root,'game-landscape.css');
const unchanged=fs.existsSync(output)&&fs.readFileSync(output,'utf8')===css;
if(process.argv.includes('--check')){if(!unchanged)throw new Error('game-landscape.css未更新，请运行node scripts/build-shared-css.cjs');}
else if(!unchanged)fs.writeFileSync(output,css);
console.log(`共享横屏CSS${unchanged?'已是最新':'已生成'}：game-landscape.css`);
