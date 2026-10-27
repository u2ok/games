/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:pipes';
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
  function status(text) { document.getElementById('status').textContent = text; }
  function number(name, fallback) { var value = Number(read(key + ':' + name)); return Number.isFinite(value) && value > 0 ? value : fallback; }
  function sound(frequency) {
    if (!settings.sound) return;
    try { var Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return; if (!audio) audio = new Audio(); if (audio.state === 'suspended') audio.resume().catch(function () {}); var oscillator = audio.createOscillator(); var gain = audio.createGain(); oscillator.connect(gain); gain.connect(audio.destination); oscillator.frequency.value = frequency || 600; gain.gain.setValueAtTime(.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .12); oscillator.start(); oscillator.stop(audio.currentTime + .12); } catch (error) { /* 声音失败时游戏继续运行。 */ }
  }
  function pause(reason) { if (paused || ended) return; paused = true; document.getElementById('pause').textContent = '继续游戏'; onPause(); showCover('已暂停', '准备好后继续刚才的一局。', '继续游戏'); syncStart(); status(reason || '已暂停，点击继续恢复游戏。'); }
  function resume() { if (!paused || ended || dialog.open) return; paused = false; document.getElementById('pause').textContent = '暂停'; onResume(); hideCover(); syncStart(); }
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


  var size=5,pipes=[],solution=[],path=[],history=[],moves=0,cursor=0,left=180,assisted=false,grid=document.getElementById('grid'),dirs=[[-1,0,8,2],[1,0,2,8],[0,-1,1,4],[0,1,4,1]];
  function rotateMask(m){return ((m<<1)&15)|((m>>3)&1);}
  function connected(state,n){var seen=new Set(),queue=[];if(!(state[0]&8))return {won:false,wet:seen};seen.add(0);queue.push(0);var leak=false;for(var h=0;h<queue.length;h++){var i=queue[h],x=i%n,y=Math.floor(i/n);dirs.forEach(function(d){if(!(state[i]&d[2]))return;var nx=x+d[0],ny=y+d[1];if(nx<0||nx>=n||ny<0||ny>=n){if(!(i===0&&d[2]===8)&&!(i===n*n-1&&d[2]===2))leak=true;return;}var j=ny*n+nx;if(!(state[j]&d[3])){leak=true;return;}if(!seen.has(j)){seen.add(j);queue.push(j);}});}return {won:seen.has(n*n-1)&&!!(state[n*n-1]&2)&&!leak,wet:seen};}
  function generate(){var seen=new Set([0]),stack=[0];while(stack.length&&stack[stack.length-1]!==size*size-1){var i=stack[stack.length-1],opts=[];dirs.forEach(function(d){var x=i%size+d[0],y=Math.floor(i/size)+d[1],j=y*size+x;if(x>=0&&x<size&&y>=0&&y<size&&!seen.has(j))opts.push(j);});if(!opts.length)stack.pop();else{var j=opts[Math.floor(Math.random()*opts.length)];seen.add(j);stack.push(j);}}path=stack;solution=Array.from({length:size*size},function(){return [3,5,7][Math.floor(Math.random()*3)];});path.forEach(function(i,k){var mask=k===0?8:0;if(k===path.length-1)mask|=2;[path[k-1],path[k+1]].forEach(function(j){if(j===undefined)return;mask|=j===i-1?8:j===i+1?2:j<i?1:4;});solution[i]=mask;});pipes=solution.map(function(m){for(var r=Math.floor(Math.random()*4);r>0;r--)m=rotateMask(m);return m;});if(connected(pipes,size).won)pipes[0]=rotateMask(pipes[0]);}
  function render(){grid.innerHTML='';grid.style.setProperty('--n',size);var water=connected(pipes,size).wet;pipes.forEach(function(m,i){var b=document.createElement('button');b.dataset.cell=i;b.className='pipe-cell'+(cursor===i?' cursor':'');var d='';if(m&1)d+='M24 24V0 ';if(m&2)d+='M24 24H48 ';if(m&4)d+='M24 24V48 ';if(m&8)d+='M24 24H0 ';b.innerHTML='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="'+d+'" stroke="'+(water.has(i)?'#679caa':'#8eaa8e')+'" stroke-width="12" fill="none"/><circle cx="24" cy="24" r="7" fill="'+(water.has(i)?'#679caa':'#8eaa8e')+'"/></svg>';b.setAttribute('aria-label','第'+(i+1)+'格，接口'+m+(i===0?'，水源':i===size*size-1?'，出口':''));grid.appendChild(b);});hud(moves,'第 '+(stageIndex+1)+' 关 · 剩余 '+Math.ceil(left)+' 秒 · '+(assisted?'提示局':'独立解题'),size+' × '+size+' · 连通且无漏口');}
  function activate(i){if(blocked())return;history.push(pipes.slice());pipes[i]=rotateMask(pipes[i]);moves++;cursor=i;if(connected(pipes,size).won){if(!assisted)record(moves,true);complete('水流已安全抵达出口，使用 '+moves+' 步。');}render();}
  function restart(){resetState();size={easy:5,normal:6,hard:7}[activeOption]||6;moves=0;cursor=0;history=[];left={easy:240,normal:210,hard:180}[activeOption]||210;assisted=false;generate();renderStages();render();status('左上接入水源，右下通向出口；水流经过的所有接口都必须接好。');}
  grid.addEventListener('click',function(e){var b=e.target.closest('[data-cell]');if(b)activate(Number(b.dataset.cell));});grid.addEventListener('keydown',function(e){gridKey(e,size,size*size,activate);});document.getElementById('undo').addEventListener('click',function(){if(blocked()||!history.length)return;pipes=history.pop();moves--;render();});document.getElementById('hint').addEventListener('click',function(){if(blocked())return;var i=path.find(function(i){return pipes[i]!==solution[i];});if(i===undefined)return;assisted=true;cursor=i;status('高亮格需要旋转，使接口朝向目标路线。');render();});clock(function(dt){var old=Math.ceil(left);left=Math.max(0,left-dt);if(!left)finish('时间用完，请重新布置管道。');if(old!==Math.ceil(left))hud(moves,'第 '+(stageIndex+1)+' 关 · 剩余 '+Math.ceil(left)+' 秒',size+' × '+size+' · 连通且无漏口');});stages(20);restart();


  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
