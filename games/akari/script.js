/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:akari';
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
  var n=5,walls=[],cells=[],answer=[],marking=false;
  function near(i){var a=[],x=i%n,y=Math.floor(i/n);if(x)a.push(i-1);if(x<n-1)a.push(i+1);if(y)a.push(i-n);if(y<n-1)a.push(i+n);return a;}
  function rays(i){var out=[i],x=i%n,y=Math.floor(i/n);[[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){for(var a=x+d[0],b=y+d[1];a>=0&&b>=0&&a<n&&b<n;a+=d[0],b+=d[1]){var j=b*n+a;if(walls[j]!==null)break;out.push(j);}});return out;}
  function light(state){var lit=Array(n*n).fill(0),conflicts=[];state.forEach(function(v,i){if(v===1&&walls[i]===null){var r=rays(i);r.forEach(function(j){lit[j]++;if(i!==j&&state[j]===1)conflicts.push(j);});}});return {lit:lit,conflicts:conflicts};}
  function valid(state){var l=light(state);return !l.conflicts.length&&state.every(function(v,i){return walls[i]===null?l.lit[i]>0:v!==1;})&&walls.every(function(v,i){return v===null||v<0||near(i).filter(function(j){return state[j]===1;}).length===v;});}
  function solve(partial){var state=partial.slice(),found=null,budget=30000;
    function search(){if(found||--budget<0)return;var l=light(state);if(l.conflicts.length)return;
      for(var i=0;i<n*n;i++)if(walls[i]!==null&&walls[i]>=0){var a=near(i).filter(function(j){return walls[j]===null;}),have=a.filter(function(j){return state[j]===1;}).length,free=a.filter(function(j){return state[j]===0&&!l.lit[j];}).length;if(have>walls[i]||have+free<walls[i])return;}
      var options=null;for(var j=0;j<n*n;j++)if(walls[j]===null&&!l.lit[j]){var candidates=rays(j).filter(function(k){return state[k]===0&&!l.lit[k];});if(!candidates.length)return;if(!options||candidates.length<options.length)options=candidates;}
      if(!options){if(valid(state))found=state.slice();return;}for(var k=0;k<options.length&&!found&&budget>=0;k++){state[options[k]]=1;search();state[options[k]]=0;}
    }search();return {solution:found,exhausted:budget<0};
  }
  function makePuzzle(){n=activeOption==='hard'?6:5;var rand=levelRandom();walls=Array.from({length:n*n},function(){return rand()<.22?-1:null;});if(walls.every(function(v){return v!==null;}))walls[0]=null;answer=Array(n*n).fill(0);var order=Array.from({length:n*n},function(_,i){return i;}).sort(function(){return rand()-.5;});order.forEach(function(i){if(walls[i]===null&&!light(answer).lit[i])answer[i]=1;});walls=walls.map(function(v,i){return v===null?null:rand()<(activeOption==='easy'?1:activeOption==='hard'?.5:.8)?near(i).filter(function(j){return answer[j]===1;}).length:-1;});cells=Array(n*n).fill(0);}
  function snapshot(){return cells.slice();}function restore(v){cells=v;}
  function activate(i,force){if(blocked()||walls[i]!==null){if(walls[i]!==null)status('黑墙不能放灯；数字表示四邻灯泡数。');return;}checkpoint();cells[i]=force===2?(cells[i]===2?0:2):marking?(cells[i]===2?0:2):(cells[i]===1?0:1);cursor=i;moves++;sound(cells[i]===1?720:440);render();if(valid(cells))solved('每个角落都已照亮，灯泡与数字墙全部满足规则。');else{var l=light(cells);status(l.conflicts.length?'有灯泡互相照见，红色光圈处需移走一盏。':cells[i]===1?'灯光会沿横竖传播，遇到黑墙停止。':'已更新标记；标记只是笔记，不是通关额外条件。');}}
  function render(){var l=light(cells),s=500/n,out='<rect width="600" height="600" fill="#f0f0e7"/>';for(var i=0;i<n*n;i++){var x=50+(i%n)*s,y=50+Math.floor(i/n)*s;out+='<rect x="'+(x+1)+'" y="'+(y+1)+'" width="'+(s-2)+'" height="'+(s-2)+'" rx="7" fill="'+(walls[i]!==null?'#435260':l.lit[i]?'#fff0be':'#fdfcf6')+'"/>';if(walls[i]!==null){if(walls[i]>=0){var count=near(i).filter(function(j){return cells[j]===1;}).length;out+=text(x+s/2,y+s/2,walls[i],s*.39,count>walls[i]?'#ffbda9':'#fffdf0','font-weight="700"');}}else if(cells[i]===1){var cx=x+s/2,cy=y+s/2;out+=circle(cx,cy,s*.31,'#f7d969','opacity=".42"')+circle(cx,cy-4,s*.18,'#ffe080','stroke="'+(l.conflicts.includes(i)?'#a33e32':'#ba8b2f')+'" stroke-width="3"')+line(cx-s*.09,cy+s*.18,cx+s*.09,cy+s*.18,'#6c7275',5)+line(cx-s*.07,cy+s*.25,cx+s*.07,cy+s*.25,'#6c7275',4);}else if(cells[i]===2){out+=line(x+s*.4,y+s*.4,x+s*.6,y+s*.6,'#8995a1',2)+line(x+s*.6,y+s*.4,x+s*.4,y+s*.6,'#8995a1',2);}if(cursor===i)out+='<rect x="'+(x+4)+'" y="'+(y+4)+'" width="'+(s-8)+'" height="'+(s-8)+'" rx="5" fill="none" stroke="#8a9adc" stroke-width="3"/>';if(hintCells.includes(i))out+=circle(x+s/2,y+s/2,s*.39,'none','stroke="#a6741d" stroke-width="4" class="pulse"');}svg(out);write('mode',marking?'标记模式':'放灯模式');puzzleHud(l.lit.filter(function(v,i){return walls[i]===null&&v;}).length+'/'+walls.filter(function(v){return v===null;}).length+' 格照亮',n+' × '+n+' · 照亮全部空格 · 灯不相照');announce('点灯棋盘，方向键选择，回车放灯；当前第'+(cursor+1)+'格。');}
  surface.addEventListener('pointerdown',function(e){var p=pos(e),x=Math.floor((p.x-50)*n/500),y=Math.floor((p.y-50)*n/500);if(x>=0&&y>=0&&x<n&&y<n)activate(y*n+x,e.button===2?2:undefined);});surface.addEventListener('contextmenu',function(e){e.preventDefault();});surface.addEventListener('keydown',function(e){gridKey(e,n,n*n,activate);});
  bind('mode',function(){marking=!marking;render();status(marking?'标记模式：点击记下不放灯的位置。':'放灯模式：点击放置或移除灯泡。');});
  bind('check',function(){if(valid(cells)){solved();return;}var r=solve(cells);status(r.solution?'当前标记可以延伸成合法解。':r.exhausted?'搜索预算用尽，请检查未照亮区域与数字墙。':'当前灯泡或排除标记存在冲突，请撤销或调整。');});
  bind('hint',function(){var r=solve(cells);if(!r.solution){status(r.exhausted?'提示搜索未完成。':'当前标记存在冲突，请先移除错误灯泡或排除标记。');return;}var i=r.solution.findIndex(function(v,i){return v===1&&cells[i]!==1;});if(i<0)return;assisted=true;hintCells=[i];cursor=i;render();status('金色圈处可放一盏灯，这是与当前标记兼容的一种可行方案。');});
  function restart(){resetState();commonReset();marking=false;makePuzzle();renderStages();render();status('点击空格放灯。先找只有一个入口的暗角，再看数字墙。');}stages(12);restart();

  onStart=function(){status('点击空格放灯。金色表示已照亮，红圈表示灯泡互相照见；黑墙会挡光。');};
  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();surface.focus();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
