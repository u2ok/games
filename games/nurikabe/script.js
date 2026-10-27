/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:nurikabe';
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

  var pool={"easy":[{"clues":[0,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,2,1,0,0,0,0],"solution":[2,2,2,1,2,2,1,2,2,2,1,2,2,1,2,2,2,1,2,1,1,2,2,2,1]},{"clues":[1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0,0,2,0,0,2,0,0,0,1],"solution":[1,2,2,2,2,2,1,2,1,2,2,2,2,2,1,1,2,1,2,2,1,2,1,2,1]},{"clues":[0,3,0,0,1,0,0,0,0,0,0,1,0,1,0,1,0,0,0,1,0,0,1,0,0],"solution":[1,1,1,2,1,2,2,2,2,2,2,1,2,1,2,1,2,2,2,1,2,2,1,2,2]},{"clues":[1,0,1,0,1,0,0,0,0,0,1,0,0,2,0,0,0,0,0,0,2,0,0,1,0],"solution":[1,2,1,2,1,2,2,2,2,2,1,2,1,1,2,2,2,2,2,2,1,1,2,1,2]},{"clues":[2,0,0,0,1,0,0,1,0,0,0,0,0,1,0,1,0,1,0,0,0,0,0,1,0],"solution":[1,2,2,2,1,1,2,1,2,2,2,2,2,1,2,1,2,1,2,2,2,2,2,1,2]},{"clues":[1,0,0,1,0,0,1,0,0,0,0,0,1,0,0,2,0,0,0,2,0,0,1,0,0],"solution":[1,2,2,1,2,2,1,2,2,2,2,2,1,2,1,1,2,2,2,1,1,2,1,2,2]}],"normal":[{"clues":[0,0,1,0,0,1,0,0,0,2,0,0,1,0,0,0,0,0,0,1,0,0,3,0,0],"solution":[2,2,1,2,1,1,2,2,2,1,2,2,1,2,2,2,1,2,2,1,2,1,1,2,2]},{"clues":[1,0,0,1,0,0,2,0,0,0,0,0,0,1,0,0,0,0,0,0,0,2,0,0,1],"solution":[1,2,2,1,2,2,1,2,2,2,2,1,2,1,2,2,2,2,2,2,2,1,1,2,1]},{"clues":[1,0,1,0,0,0,0,0,0,1,0,2,0,0,0,4,0,0,0,0,0,0,0,0,2],"solution":[1,2,1,2,2,2,2,2,2,1,2,1,1,2,2,1,2,2,2,1,1,1,1,2,1]},{"clues":[2,0,0,0,5,0,0,0,0,0,0,1,0,0,0,0,0,0,0,2,0,1,0,0,0],"solution":[1,2,1,1,1,1,2,2,1,1,2,1,2,2,2,2,2,2,1,1,2,1,2,2,2]},{"clues":[0,2,0,1,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,1],"solution":[2,1,2,1,2,2,1,2,2,2,2,2,2,1,2,2,1,2,2,2,2,2,1,2,1]},{"clues":[0,1,0,2,0,0,0,0,0,0,1,0,0,0,3,0,0,0,0,0,0,3,0,0,1],"solution":[2,1,2,1,1,2,2,2,2,2,1,2,1,1,1,2,2,2,2,2,1,1,1,2,1]}],"hard":[{"clues":[0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,1,0],"solution":[2,2,2,1,2,2,1,1,1,2,2,2,2,1,2,2,1,2,2,2,1,2,2,1,2]},{"clues":[2,0,5,0,0,0,0,0,0,0,0,0,0,0,2,1,0,0,0,0,0,0,0,0,0],"solution":[1,2,1,1,2,1,2,1,2,2,2,2,1,2,1,1,2,1,2,1,2,2,2,2,2]},{"clues":[0,0,0,0,0,1,0,4,0,0,0,0,0,0,1,0,4,0,0,0,0,0,0,0,0],"solution":[2,2,1,1,1,1,2,1,2,2,2,2,2,2,1,2,1,1,2,2,2,2,1,1,2]},{"clues":[0,0,2,0,0,0,0,0,0,1,0,0,0,0,0,2,0,3,0,0,0,0,0,0,0],"solution":[2,1,1,2,2,2,2,2,2,1,1,2,1,2,2,1,2,1,1,2,2,2,2,2,2]},{"clues":[0,0,0,0,0,3,0,4,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,1,0],"solution":[1,2,2,2,2,1,2,1,1,2,1,2,1,1,2,2,2,2,2,2,1,1,2,1,2]},{"clues":[0,0,2,0,0,0,0,0,0,6,3,0,0,0,0,0,0,0,0,0,0,0,0,0,1],"solution":[2,1,1,2,1,2,2,2,2,1,1,2,1,1,1,1,2,1,2,2,1,2,2,2,1]}]};

  var clues=[],cells=[],history=[],moves=0,cursor=0,ink=2,assisted=false,errors=[],grid=document.getElementById('grid');
  function neighbors(i){return [i-5,i+5,i%5?i-1:-1,i%5<4?i+1:-1].filter(function(j){return j>=0&&j<25;});}
  function seaValid(white){var black=((1<<25)-1)^white;if(!black)return false;var first=0;while(!(black&(1<<first)))first++;var seen=1<<first,q=[first];for(var h=0;h<q.length;h++)neighbors(q[h]).forEach(function(j){var bit=1<<j;if(black&bit&&!(seen&bit)){seen|=bit;q.push(j);}});if(seen!==black)return false;for(var y=0;y<4;y++)for(var x=0;x<4;x++){var m=(1<<(y*5+x))|(1<<(y*5+x+1))|(1<<((y+1)*5+x))|(1<<((y+1)*5+x+1));if((black&m)===m)return false;}return true;}
  // 按每个线索枚举连通岛形，再组合不接触的岛，末尾验证黑水域约束。
  function solve(numbers,limit,partial){var roots=[],opts=[],solution=null,required=0,excluded=0;(partial||[]).forEach(function(v,i){if(v===1)required|=1<<i;if(v===2)excluded|=1<<i;});numbers.forEach(function(n,i){if(n)roots.push(i);});roots.forEach(function(root){var forbidden=excluded;roots.forEach(function(r){if(r!==root){forbidden|=1<<r;neighbors(r).forEach(function(n){forbidden|=1<<n;});}});var states=new Set(forbidden&(1<<root)?[]:[1<<root]);for(var k=1;k<numbers[root];k++){var next=new Set();states.forEach(function(mask){for(var i=0;i<25;i++)if(mask&(1<<i))neighbors(i).forEach(function(j){if(!(mask&(1<<j))&&!(forbidden&(1<<j)))next.add(mask|(1<<j));});});states=next;}var list=[];states.forEach(function(mask){var edge=mask;for(var i=0;i<25;i++)if(mask&(1<<i))neighbors(i).forEach(function(j){edge|=1<<j;});list.push({mask:mask,edge:edge});});opts.push(list);});opts.sort(function(a,b){return a.length-b.length;});var found=0,budget=100000;function dfs(d,used,banned){if(found>=limit||--budget<0)return;if(d===opts.length){if((used&required)===required&&seaValid(used)){found++;solution=Array.from({length:25},function(_,i){return used&(1<<i)?1:2;});}return;}opts[d].forEach(function(o){if(!(o.mask&banned))dfs(d+1,used|o.mask,banned|o.edge);});}dfs(0,0,0);return {count:found,exhausted:budget<0,solution:solution};}
  function countSolutions(numbers,limit){var result=solve(numbers,limit,[]);return result.exhausted?-1:result.count;}
  function valid(state,numbers){if(state.length!==25||state.some(function(v){return v!==1&&v!==2;}))return false;var visited=new Set(),white=0;for(var i=0;i<25;i++){if(numbers[i]&&state[i]!==1)return false;if(state[i]===1)white|=1<<i;if(state[i]!==1||visited.has(i))continue;var q=[i],marks=[];visited.add(i);for(var h=0;h<q.length;h++){var p=q[h];if(numbers[p])marks.push(numbers[p]);neighbors(p).forEach(function(j){if(state[j]===1&&!visited.has(j)){visited.add(j);q.push(j);}});}if(marks.length!==1||marks[0]!==q.length)return false;}return seaValid(white);}
  function transformed(a,turn,flip){var out=Array(25);a.forEach(function(v,i){var x=i%5,y=Math.floor(i/5);if(flip)x=4-x;for(var k=0;k<turn;k++){var t=x;x=4-y;y=t;}out[y*5+x]=v;});return out;}
  function render(){grid.innerHTML='';cells.forEach(function(v,i){var b=document.createElement('button');b.dataset.cell=i;b.className='nuri-cell'+(v===2?' sea':v===1?' island':'')+(i===cursor?' cursor':'')+(errors.indexOf(i)>=0?' error':'');b.textContent=clues[i]||'';b.setAttribute('aria-label','第'+(i+1)+'格，'+(clues[i]?'固定线索'+clues[i]:v===2?'黑水域':v===1?'白岛':'未确定'));grid.appendChild(b);});write('mode',ink===2?'涂黑模式':'标白模式');hud(moves,'第 '+(stageIndex+1)+' 关 · 已确定 '+cells.filter(Boolean).length+'/25 · '+(assisted?'辅助局':'独立解题'),'5 × 5 · 数字等于岛屿面积');}
  function activate(i,value){if(blocked()||clues[i])return;history.push(cells.slice());var v=value===undefined?ink:value;cells[i]=cells[i]===v?0:v;moves++;cursor=i;errors=[];if(valid(cells,clues)){if(!assisted)record(moves,true);complete('岛屿与水域全部满足规则。');}render();}
  function restart(){resetState();var list=pool[activeOption]||pool.normal,p=list[stageIndex%list.length];clues=transformed(p.clues,Math.floor(stageIndex/2)%4,stageIndex%2);cells=clues.map(function(v){return v?1:0;});history=[];moves=0;cursor=0;ink=2;assisted=false;errors=[];renderStages();render();status('每个白岛恰有一个数字，岛不相邻；所有黑格连通且没有2×2黑块。');}
  grid.addEventListener('click',function(e){var b=e.target.closest('[data-cell]');if(b)activate(Number(b.dataset.cell));});grid.addEventListener('contextmenu',function(e){e.preventDefault();var b=e.target.closest('[data-cell]');if(b)activate(Number(b.dataset.cell),2);});grid.addEventListener('keydown',function(e){gridKey(e,5,25,activate);});document.getElementById('mode').addEventListener('click',function(){if(blocked())return;ink=3-ink;render();});document.getElementById('undo').addEventListener('click',function(){if(blocked()||!history.length)return;cells=history.pop();moves--;errors=[];render();});document.getElementById('check').addEventListener('click',checkBoard);document.getElementById('hint').addEventListener('click',giveHint);
  function checkBoard(){
    if(blocked())return;
    assisted=true;errors=[];
    if(valid(cells,clues)){complete('岛屿与水域全部满足规则。');render();return;}
    var result=solve(clues,1,cells);
    status(result.count?'当前标记可以完成合法棋盘，继续确定空格。':result.exhausted?'检查搜索未完成，请按岛屿与水域规则继续推理。':'当前标记存在规则冲突，无法完成合法棋盘；请调整或撤销。');render();
  }
  function giveHint(){
    if(blocked())return;
    assisted=true;errors=[];
    var result=solve(clues,1,cells);
    if(!result.count){status(result.exhausted?'提示搜索未完成，请稍后重试。':'当前标记存在规则冲突，请先调整或撤销。');render();return;}
    // 只填写所有可行解一致的格子，不按预设答案改写已有标记。
    for(var i=0;i<25;i++)if(!cells[i]){
      var trial=cells.slice();trial[i]=3-result.solution[i];var alternate=solve(clues,1,trial);
      if(!alternate.exhausted&&!alternate.count){
        history.push(cells.slice());cells[i]=result.solution[i];moves++;cursor=i;
        if(valid(cells,clues))complete('辅助完成本关。');else status('已填入一个由当前标记和规则确定的格子。');render();return;
      }
    }
    status('当前没有找到必然确定的空格，请继续按规则推理。');render();
  }
  stages(12);restart();


  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
