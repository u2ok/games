/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:tents';
  var settings = { sound: false, option: null };
  var memoryStore = {};
  var audio = null;
  var paused = false;
  var ready = false;
  var ended = false;
  var onPause = function () {};
  var onResume = function () {};
  var onOption = function () {};
  var dialog = document.getElementById('settings');
  var option = document.getElementById('option');
  function read(name) { if(Object.prototype.hasOwnProperty.call(memoryStore,name))return memoryStore[name]; try { return localStorage.getItem(name); } catch (error) { document.getElementById('storage').textContent = '存储不可用，数据仅在当前页面保留。'; return memoryStore[name] || null; } }
  function save(name, value) { memoryStore[name] = value; try { localStorage.setItem(name, value); } catch (error) { document.getElementById('storage').textContent = '存储不可用，数据仅在当前页面保留。'; } }
  function status(text) { var node=document.getElementById('status');node.dataset.tone=ended&&!won||/^(这条桥会|有岛屿桥数超出|当前.*(?:存在冲突|无法|不能)|有灯泡互相照见|帐篷不能|路线不能|这里放不下|这一侧被挡|出现分叉|小球落水|没有可放位置)/.test(text)?'error':'normal';if(node.textContent!==text)node.textContent=text; }
  function number(name, fallback) { var value = Number(read(key + ':' + name)); return Number.isFinite(value) && value > 0 ? value : fallback; }
  function sound(frequency) {
    if (!settings.sound) return;
    try { var Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return; if (!audio) audio = new Audio(); if (audio.state === 'suspended') audio.resume().catch(function () {}); var oscillator = audio.createOscillator(); var gain = audio.createGain(); oscillator.connect(gain); gain.connect(audio.destination); oscillator.frequency.value = frequency || 600; gain.gain.setValueAtTime(.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .12); oscillator.start(); oscillator.stop(audio.currentTime + .12); } catch (error) { /* 声音失败时游戏继续运行。 */ }
  }
  function pause(reason) { if (paused || ended) return; paused = true; document.getElementById('pause').textContent = '继续游戏'; onPause(); showCover('已暂停', '准备好后继续刚才的一局。', '继续游戏'); syncStart(); status(reason || '已暂停，点击继续恢复游戏。'); }
  function resume() { if (!paused || ended || dialog.open) return; paused = false; document.getElementById('pause').textContent = '暂停'; onResume(); hideCover(); status('游戏已继续，请接着完成当前一局。'); syncStart(); }
  function resetState() { activeOption=settings.option; document.getElementById('status').dataset.tone = 'normal'; ready = false; won=false; hideCover(); paused = false; ended = false; document.getElementById('pause').disabled = false; document.getElementById('pause').textContent = '暂停'; }
  function finish(text) { ended = true; paused = false; document.getElementById('pause').disabled = true; document.getElementById('status').dataset.tone = /成功|赢了|已找到/.test(text) ? 'normal' : 'error'; status(text); showCover('本局已结束', text, '再玩一局'); syncStart(); sound(880); }
  try { var saved = JSON.parse(read(key + ':settings')); if (saved && typeof saved === 'object') { settings.sound = saved.sound === true; settings.option = saved.option; } } catch (error) { /* 历史设置损坏时使用默认值。 */ }
  document.getElementById('sound').checked = settings.sound;
  if (option.type === 'checkbox') { if (typeof settings.option === 'boolean') option.checked = settings.option; } else if (Array.from(option.options).some(function (item) { return item.value === settings.option; })) option.value = settings.option;
  settings.option = option.type === 'checkbox' ? option.checked : option.value;
  dialog.addEventListener('change', function () { settings.sound = document.getElementById('sound').checked; settings.option = option.type === 'checkbox' ? option.checked : option.value; save(key + ':settings', JSON.stringify(settings)); onOption(); });
  document.getElementById('settings-open').addEventListener('click', function () { pause(); dialog.showModal(); });
  document.getElementById('settings-close').addEventListener('click', function () { dialog.close(); });
  document.getElementById('pause').addEventListener('click', function () { if (paused) resume(); else pause(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause('页面已隐藏，游戏自动暂停。'); });
  window.addEventListener('blur', function () { pause('窗口失去焦点，游戏自动暂停。'); });
  function blocked() { return ready || paused || ended || dialog.open; }
  function updateScore(value, bestValue) { document.getElementById('score').textContent = value; document.getElementById('best').textContent = bestValue || '—'; }
  // 直接访问游戏时也更新历史；只接受数组中的字符串，避免损坏数据中断游戏。
  try { var recent = JSON.parse(read('mini-games:recent')); if (!Array.isArray(recent)) recent = []; var gameId = key.split(':')[1]; save('mini-games:recent', JSON.stringify([gameId].concat(recent.filter(function (item) { return typeof item === 'string' && item !== gameId; })).slice(0, 20))); } catch (error) { /* 历史记录不影响核心玩法。 */ }



  var activeOption=settings.option;
  var stageIndex=0,unlocked=0,stageCount=1,won=false,onStart=function(){};
  function write(name,value){var n=document.getElementById(name);if(String(n.textContent)!==String(value))n.textContent=value;}
  function hud(value,detail,rule){write('score',value);write('best',number('best:'+activeOption+':'+stageIndex,0)||'—');write('detail',detail);write('rule-label',rule);}
  function record(value,minimum){var k=key+':best:'+activeOption+':'+stageIndex,old=Number(read(k));if(!old||(minimum?value<old:value>old))save(k,String(value));}
  function stages(count){stageCount=count;unlocked=Math.min(count-1,Math.max(0,Math.floor(number('unlocked',0))));stageIndex=Math.min(unlocked,Math.max(0,Math.floor(number('current',0))));renderStages();}
  function renderStages(){document.getElementById('level-section').hidden=stageCount===1;document.getElementById('level-list').innerHTML=Array.from({length:stageCount},function(_,i){return '<button data-stage="'+i+'" aria-pressed="'+(i===stageIndex)+'"'+(i>unlocked?' disabled':'')+'>'+ (i+1) +'</button>';}).join('');write('level-hint','已解锁 '+(unlocked+1)+'/'+stageCount+' 关；切换会重开。');save(key+':current',String(stageIndex));}
  function complete(note){won=true;unlocked=Math.min(stageCount-1,Math.max(unlocked,stageIndex+1));save(key+':unlocked',String(unlocked));renderStages();finish('成功！'+note);showCover('挑战完成',note,stageIndex<stageCount-1?'下一关':'再玩一局');syncStart();}
  document.getElementById('level-list').addEventListener('click',function(e){var b=e.target.closest('[data-stage]');if(!b)return;var n=Number(b.dataset.stage);if(!Number.isInteger(n)||n<0||n>unlocked)return;stageIndex=n;restart();ready=true;showCover('第 '+(n+1)+' 关','准备好后开始。','开始游戏');syncStart();});
  onOption=function(){status('设置已保存，下一局生效。');};
  function editing(e){return e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.target&& (e.target.isContentEditable||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))||document.querySelectorAll('dialog[open]').length;}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function shuffled(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
  function clock(fn){var last=Date.now();onResume=function(){last=Date.now();};setInterval(function(){var now=Date.now(),dt=Math.max(0,Math.min(.1,(now-last)/1000));last=now;if(!blocked())fn(dt);},40);}
  function gridKey(e,cols,count,activate){if(blocked()||editing(e))return;var d={ArrowLeft:-1,ArrowRight:1,ArrowUp:-cols,ArrowDown:cols}[e.key];if(d){e.preventDefault();var n=cursor+d;if(n>=0&&n<count&&(Math.abs(d)!==1||cols===1||Math.floor(n/cols)===Math.floor(cursor/cols)))cursor=n;render();}else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)activate(cursor);}}


  var ariaCache='';function announce(value){if(value!==ariaCache){ariaCache=value;surface.setAttribute('aria-label',value);}}
  var surface=document.getElementById('grid'),cursor=0,history=[],moves=0,assisted=false,hintCells=[],elapsed=0;
  var colors=['#5366d6','#b55748','#367d71','#a27625','#87599e','#267b9b'];
  function seedRandom(seed){return function(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  function levelRandom(){return seedRandom(72491+stageIndex*7919+({easy:3,normal:11,hard:23}[activeOption]||11)*127);}
  function line(x1,y1,x2,y2,color,width,extra){return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+color+'" stroke-width="'+(width||4)+'" stroke-linecap="round" '+(extra||'')+'/>';}
  function circle(x,y,r,fill,extra){return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+fill+'" '+(extra||'')+'/>';}
  function text(x,y,value,size,fill,extra){return '<text x="'+x+'" y="'+y+'" text-anchor="middle" dominant-baseline="central" font-size="'+(size||26)+'" fill="'+(fill||'#253047')+'" '+(extra||'')+'>'+value+'</text>';}
  function svg(content){surface.innerHTML='<svg viewBox="0 0 600 600" aria-hidden="true">'+content+'</svg>';}
  function pos(e){var r=surface.getBoundingClientRect();return {x:(e.clientX-r.left)*600/r.width,y:(e.clientY-r.top)*600/r.height};}
  function bind(id,fn){document.getElementById(id).addEventListener('click',function(){if(!blocked()){fn();if(!ended&&/^(undo|hint|mode|clear|check)$/.test(id))surface.focus();}});}
  function checkpoint(){history.push(snapshot());if(history.length>300)history.shift();hintCells=[];}
  function undo(){if(blocked()||!history.length)return;restore(history.pop());moves=Math.max(0,moves-1);hintCells=[];render();status('已撤销上一步。');}
  function solved(note){if(!assisted)record(Math.max(1,moves),true);complete(note||'所有条件都已满足。');}
  function commonReset(){history=[];moves=0;assisted=false;hintCells=[];elapsed=0;cursor=0;}
  function puzzleHud(detail,rule){hud(moves,'第 '+(stageIndex+1)+' 关 · '+detail+(assisted?' · 辅助局':''),rule);document.getElementById('undo').disabled=!history.length;}
  function keyboardGrid(cols,count,action){surface.addEventListener('keydown',function(e){gridKey(e,cols,count,action);});}
  bind('undo',undo);
  var n=6,trees=[],cells=[],answer=[],rows=[],cols=[];
  function adjacent(a,b,diagonal){var dx=Math.abs(a%n-b%n),dy=Math.abs(Math.floor(a/n)-Math.floor(b/n));return diagonal?Math.max(dx,dy)===1:dx+dy===1;}
  function around(i){var a=[];for(var j=0;j<n*n;j++)if(adjacent(i,j,false))a.push(j);return a;}
  function totals(state){var r=Array(n).fill(0),c=Array(n).fill(0);state.forEach(function(v,i){if(v===1){r[Math.floor(i/n)]++;c[i%n]++;}});return {rows:r,cols:c};}
  // 一一配对通过增广路匹配验证，不能只检查“附近有树”。
  function matching(state){var tents=[];state.forEach(function(v,i){if(v===1)tents.push(i);});if(tents.length!==trees.length)return false;var assigned={};function match(t,seen){for(var k=0;k<trees.length;k++){var tree=trees[k];if(!adjacent(t,tree,false)||seen[tree])continue;seen[tree]=true;if(assigned[tree]===undefined||match(assigned[tree],seen)){assigned[tree]=t;return true;}}return false;}return tents.every(function(t){return match(t,{});});}
  function valid(state){var t=totals(state);return t.rows.every(function(v,i){return v===rows[i];})&&t.cols.every(function(v,i){return v===cols[i];})&&state.every(function(v,i){return v!==1||!trees.includes(i)&&!state.some(function(w,j){return w===1&&adjacent(i,j,true);});})&&matching(state);}
  function solve(partial){var picked=[],found=null,budget=60000,rs=Array(n).fill(0),cs=Array(n).fill(0),order=trees.map(function(t){return around(t).filter(function(i){return !trees.includes(i)&&partial[i]!==2;});}).sort(function(a,b){return a.length-b.length;});
    function search(k){if(found||--budget<0)return;if(k===order.length){var state=Array(n*n).fill(0);picked.forEach(function(i){state[i]=1;});if(partial.every(function(v,i){return v!==1||state[i]===1;})&&valid(state))found=state;return;}
      for(var h=0;h<order[k].length&&!found&&budget>=0;h++){var i=order[k][h],r=Math.floor(i/n),c=i%n;if(picked.includes(i)||picked.some(function(j){return adjacent(i,j,true);})||rs[r]>=rows[r]||cs[c]>=cols[c])continue;picked.push(i);rs[r]++;cs[c]++;search(k+1);picked.pop();rs[r]--;cs[c]--;}
    }search(0);return {solution:found,exhausted:budget<0};
  }
  function makePuzzle(){n=activeOption==='hard'?7:6;var rand=levelRandom(),target=activeOption==='easy'?6:activeOption==='hard'?10:8;trees=[];answer=Array(n*n).fill(0);var candidates=Array.from({length:n*n},function(_,i){return i;}).sort(function(){return rand()-.5;});candidates.forEach(function(i){if(trees.length>=target||trees.includes(i)||answer.some(function(v,j){return v===1&&(i===j||adjacent(i,j,true));}))return;var free=around(i).filter(function(j){return !trees.includes(j)&&!answer[j];});if(!free.length)return;var tree=free[Math.floor(rand()*free.length)];answer[i]=1;trees.push(tree);});var t=totals(answer);rows=t.rows;cols=t.cols;cells=Array(n*n).fill(0);}
  function snapshot(){return cells.slice();}function restore(v){cells=v;}
  function activate(i,force){if(blocked()||trees.includes(i)){if(trees.includes(i))status('树的位置固定；请在上下左右安排帐篷。');return;}checkpoint();cells[i]=force===2?(cells[i]===2?0:2):(cells[i]+1)%3;moves++;cursor=i;render();if(valid(cells))solved('每棵树都配好帐篷，行列数量与间距全部正确。');else{var touching=cells[i]===1&&cells.some(function(v,j){return v===1&&adjacent(i,j,true);});status(touching?'帐篷不能相邻，包括斜对角，请移走其中一顶。':cells[i]===1?'已放帐篷；再次点击标草地，再点清空。':'标记已更新；草地笔记不要求全部填写。');}}
  function render(){var t=totals(cells),s=480/n,out='<rect width="600" height="600" fill="#eef2e6"/>';for(var k=0;k<n;k++){var x=80+(k+.5)*s;out+=text(x,42,cols[k],25,t.cols[k]>cols[k]?'#a33e32':t.cols[k]===cols[k]?'#39765a':'#687b6b','font-weight="700"')+text(41,80+(k+.5)*s,rows[k],25,t.rows[k]>rows[k]?'#a33e32':t.rows[k]===rows[k]?'#39765a':'#687b6b','font-weight="700"');}
    for(var i=0;i<n*n;i++){var x=80+(i%n)*s,y=80+Math.floor(i/n)*s,cx=x+s/2,cy=y+s/2;out+='<rect x="'+(x+1)+'" y="'+(y+1)+'" width="'+(s-2)+'" height="'+(s-2)+'" rx="5" fill="'+((i%n+Math.floor(i/n))%2?'#e4ecd9':'#edf2e4')+'"/>';if(trees.includes(i)){out+=line(cx,cy,cx,cy+s*.3,'#8b7050',s*.075)+'<path d="M'+cx+' '+(cy-s*.34)+'l'+(-s*.28)+' '+(s*.48)+'h'+(s*.56)+'z" fill="#527b5b"/>'+ '<path d="M'+cx+' '+(cy-s*.19)+'l'+(-s*.33)+' '+(s*.42)+'h'+(s*.66)+'z" fill="#71935d"/>';}else if(cells[i]===1){var conflict=cells.some(function(v,j){return v===1&&adjacent(i,j,true);});out+='<path  d="M'+(cx-s*.35)+' '+(cy+s*.28)+'L'+cx+' '+(cy-s*.29)+'l'+(s*.35)+' '+(s*.57)+'z" fill="'+(conflict?'#c67a63':'#deab63')+'" stroke="#967446" stroke-width="2"/>'+ '<path d="M'+cx+' '+(cy-s*.21)+'v'+(s*.49)+'h'+(s*.23)+'z" fill="#f7dfad"/>'+line(cx,cy-s*.2,cx-s*.16,cy+s*.27,'#9f7a48',2);}else if(cells[i]===2){out+='<path d="M'+(cx-s*.15)+' '+(cy+s*.07)+'l'+(-s*.06)+' '+(-s*.14)+'m'+(s*.17)+' '+(s*.14)+'v'+(-s*.19)+'m'+(s*.1)+' '+(s*.19)+'l'+(s*.05)+' '+(-s*.13)+'" stroke="#88a57c" stroke-width="2"/>';}if(cursor===i||hintCells.includes(i))out+='<rect x="'+(x+4)+'" y="'+(y+4)+'" width="'+(s-8)+'" height="'+(s-8)+'" rx="5" fill="none" stroke="'+(hintCells.includes(i)?'#ac7b23':'#8b9bdb')+'" stroke-width="3" '+(hintCells.includes(i)?'class="pulse"':'')+'/>';}
    svg(out);puzzleHud(cells.filter(function(v){return v===1;}).length+'/'+trees.length+' 顶帐篷',n+' × '+n+' · 一树一帐 · 帐篷互不相邻');announce('帐篷棋盘，方向键选择，回车循环帐篷、草地、未知；第'+(cursor+1)+'格。');}
  surface.addEventListener('pointerdown',function(e){var p=pos(e),x=Math.floor((p.x-80)*n/480),y=Math.floor((p.y-80)*n/480);if(x>=0&&y>=0&&x<n&&y<n)activate(y*n+x,e.button===2?2:undefined);});surface.addEventListener('contextmenu',function(e){e.preventDefault();});surface.addEventListener('keydown',function(e){gridKey(e,n,n*n,activate);});
  bind('check',function(){if(valid(cells)){solved();return;}var r=solve(cells);status(r.solution?'当前布局仍有合法完成方案，继续根据行列数量推理。':r.exhausted?'搜索未完成，请先检查帐篷间距与数量。':'当前帐篷或草地标记存在冲突，请调整或撤销。');});
  bind('hint',function(){var r=solve(cells);if(!r.solution){status(r.exhausted?'提示搜索未完成。':'当前标记不能延伸成合法解，请先调整。');return;}var i=r.solution.findIndex(function(v,i){return v===1&&cells[i]!==1;});if(i<0)return;hintCells=[i];cursor=i;assisted=true;render();status('金色框处可放帐篷，这是与当前标记兼容的一种可行安排。');});
  function restart(){resetState();commonReset();makePuzzle();renderStages();render();status('点击放帐篷，再点标草地。先从行列数量为零的区域开始。');}stages(12);restart();

  onStart=function(){status('点击循环帐篷、草地、未知。先看为零的行列，帐篷不能斜着相邻。');};
  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();surface.focus();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
