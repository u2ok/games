/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:hashi';
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
  var islands=[],edges=[],bridges=[],answer=[],selected=-1,animatedEdge=-1;
  function crossing(a,b){var p=islands[a.a],q=islands[a.b],r=islands[b.a],s=islands[b.b];if(p.x===q.x&&r.y===s.y)return p.x>Math.min(r.x,s.x)&&p.x<Math.max(r.x,s.x)&&r.y>Math.min(p.y,q.y)&&r.y<Math.max(p.y,q.y);if(p.y===q.y&&r.x===s.x)return crossing(b,a);return false;}
  function degrees(values){return islands.map(function(_,i){return edges.reduce(function(n,e,k){return n+((e.a===i||e.b===i)?values[k]:0);},0);});}
  function connected(values){var seen=new Set([0]),q=[0];for(var h=0;h<q.length;h++)edges.forEach(function(e,k){if(values[k]&&(e.a===q[h]||e.b===q[h])){var j=e.a===q[h]?e.b:e.a;if(!seen.has(j)){seen.add(j);q.push(j);}}});return seen.size===islands.length;}
  function valid(values){return values.length===edges.length&&values.every(function(v){return Number.isInteger(v)&&v>=0&&v<=2;})&&degrees(values).every(function(v,i){return v===islands[i].n;})&&edges.every(function(e,k){return !values[k]||edges.every(function(f,j){return !values[j]||!crossing(e,f);});})&&connected(values);}
  function solve(partial){
    var values=Array(edges.length).fill(0),sums=Array(islands.length).fill(0),found=null,budget=80000;
    function search(k){if(found||--budget<0)return;if(k===edges.length){if(sums.every(function(v,i){return v===islands[i].n;})&&connected(values))found=values.slice();return;}
      var e=edges[k],minimum=partial&&partial[k]>0?partial[k]:0;
      for(var v=minimum;v<=2;v++){
        if(sums[e.a]+v>islands[e.a].n||sums[e.b]+v>islands[e.b].n)continue;
        if(v&&edges.slice(0,k).some(function(f,j){return values[j]&&crossing(e,f);}))continue;
        values[k]=v;sums[e.a]+=v;sums[e.b]+=v;
        var possible=islands.every(function(p,i){var left=edges.slice(k+1).reduce(function(n,f,j){return n+((f.a===i||f.b===i)?2:0);},0);return sums[i]<=p.n&&sums[i]+left>=p.n;});
        if(possible)search(k+1);sums[e.a]-=v;sums[e.b]-=v;
      }values[k]=0;
    }search(0);return {solution:found,exhausted:budget<0};
  }
  function makePuzzle(){var rand=levelRandom(),side=activeOption==='hard'?4:3;islands=[];for(var y=0;y<side;y++)for(var x=0;x<side;x++)islands.push({x:80+x*440/(side-1),y:80+y*440/(side-1),n:0});
    if(stageIndex>1){var remove=1+Math.floor(rand()*(side*side-2));islands.splice(remove,1);}
    edges=[];islands.forEach(function(p,i){['x','y'].forEach(function(axis){var other=axis==='x'?'y':'x',j=-1,d=Infinity;islands.forEach(function(q,k){var delta=q[axis]-p[axis];if(q[other]===p[other]&&delta>0&&delta<d){d=delta;j=k;}});if(j>=0)edges.push({a:i,b:j});});});
    var order=edges.map(function(_,i){return i;}).sort(function(){return rand()-.5;}),parent=islands.map(function(_,i){return i;});function root(i){while(parent[i]!==i)i=parent[i];return i;}
    answer=Array(edges.length).fill(0);order.forEach(function(k){var e=edges[k];if(root(e.a)!==root(e.b)&&!edges.some(function(f,j){return answer[j]&&crossing(e,f);})){parent[root(e.a)]=root(e.b);answer[k]=rand()<.28?2:1;}});
    order.forEach(function(k){if(rand()<.22&&!edges.some(function(f,j){return answer[j]&&crossing(edges[k],f);}))answer[k]=Math.min(2,answer[k]+1);});
    var sums=degrees(answer);islands.forEach(function(p,i){p.n=sums[i];});bridges=answer.map(function(){return 0;});
  }
  function snapshot(){return bridges.slice();}function restore(v){bridges=v;selected=-1;}
  function add(k){var next=(bridges[k]+1)%3;if(next&&edges.some(function(e,j){return bridges[j]&&crossing(edges[k],e);})){status('这条桥会与已有桥交叉，请先拆除交叉的桥。');return;}checkpoint();bridges[k]=next;animatedEdge=k;moves++;selected=-1;sound(480+next*100);render();if(valid(bridges))solved('所有岛屿的桥数正确，并且连成一体。');else status(next?'已建'+(next===2?'双桥':'一座桥')+'；再次连接这两个岛可循环调整。':'已拆除这条桥。');}
  function activate(i){if(blocked())return;if(selected<0){selected=i;status('已选中数字 '+islands[i].n+'，再选同一行或列最近的岛。');render();return;}if(selected===i){selected=-1;render();return;}var k=edges.findIndex(function(e){return e.a===selected&&e.b===i||e.b===selected&&e.a===i;});if(k<0){selected=i;status('只能连接横向或纵向最近的岛屿，已改选当前岛。');render();return;}add(k);}
  function render(){var out='<rect width="600" height="600" fill="#edf4f5"/>';for(var y=35;y<600;y+=50)out+='<path d="M20 '+y+'q20 -7 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0" fill="none" stroke="#dce8ec" stroke-width="2"/>';
    var sums=degrees(bridges);edges.forEach(function(e,k){var p=islands[e.a],q=islands[e.b],dx=p.y===q.y?0:5,dy=p.x===q.x?0:5;if(hintCells.includes(k))out+=line(p.x,p.y,q.x,q.y,'#e1a33e',15,'class="pulse"');if(bridges[k])for(var j=0;j<bridges[k];j++){var t=bridges[k]===2?(j?1:-1):0;out+=line(p.x+dx*t,p.y+dy*t,q.x+dx*t,q.y+dy*t,'#526f87',5,k===animatedEdge?'class="draw-in"':'');}});
    islands.forEach(function(p,i){var done=sums[i]===p.n;out+=circle(p.x,p.y,32,'#dce6e7')+circle(p.x,p.y-3,29,done?'#e2eee2':'#fffdf4','stroke="'+(selected===i?'#5366d6':sums[i]>p.n?'#a33e32':done?'#6e967b':'#b6c6c9')+'" stroke-width="'+(selected===i?5:2)+'"')+text(p.x,p.y-3,p.n,29,done?'#396650':'#253047','font-weight="700"');if(cursor===i)out+=circle(p.x,p.y-3,37,'none','stroke="#8798dc" stroke-width="2" stroke-dasharray="3 5"');});svg(out);animatedEdge=-1;puzzleHud(sums.filter(function(n,i){return n===islands[i].n;}).length+'/'+islands.length+' 岛完成','数字=桥数 · 单/双桥 · 全部连通');announce('数桥，选中岛屿后用方向键选择另一岛，回车连接。');}
  surface.addEventListener('pointerdown',function(e){if(blocked())return;var p=pos(e),i=islands.findIndex(function(q){return Math.hypot(p.x-q.x,p.y-q.y)<40;});if(i>=0){cursor=i;activate(i);}else{var k=edges.findIndex(function(edge){var a=islands[edge.a],b=islands[edge.b];return a.x===b.x?Math.abs(p.x-a.x)<18&&p.y>Math.min(a.y,b.y)+35&&p.y<Math.max(a.y,b.y)-35:Math.abs(p.y-a.y)<18&&p.x>Math.min(a.x,b.x)+35&&p.x<Math.max(a.x,b.x)-35;});if(k>=0)add(k);}});
  surface.addEventListener('keydown',function(e){if(blocked()||editing(e))return;if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)activate(cursor);}else if(/^Arrow/.test(e.key)){e.preventDefault();var p=islands[cursor],axis=/Left|Right/.test(e.key)?'x':'y',sign=/Left|Up/.test(e.key)?-1:1,best=-1,d=Infinity;islands.forEach(function(q,i){var delta=(q[axis]-p[axis])*sign,cost=Math.hypot(q.x-p.x,q.y-p.y)+Math.abs(q[axis==='x'?'y':'x']-p[axis==='x'?'y':'x'])*3;if(delta>0&&cost<d){best=i;d=cost;}});if(best>=0)cursor=best;render();}});
  bind('check',function(){var d=degrees(bridges);if(valid(bridges)){solved();return;}var r=solve(bridges);status(d.some(function(n,i){return n>islands[i].n;})?'有岛屿桥数超出数字，请减少相连的桥。':r.solution?'当前桥梁可延伸成合法解，继续连接。':r.exhausted?'搜索预算用尽，请继续检查桥数和连通性。':'当前桥梁存在冲突，请撤销或拆桥调整。');});
  bind('hint',function(){var r=solve(bridges);if(!r.solution){status(r.exhausted?'提示搜索未完成，请先减少不确定的桥。':'当前桥梁无法延伸为合法解，请先撤销或拆桥。');return;}var k=r.solution.findIndex(function(n,i){return n>bridges[i];});if(k<0)return;assisted=true;hintCells=[k];selected=edges[k].a;status('金色高亮是一种可行解的连接位置：连接这两个岛，目标桥数 '+r.solution[k]+'。');render();});
  function restart(){resetState();commonReset();selected=-1;makePuzzle();renderStages();render();status('先选一个岛，再选同行或同列最近的岛：一桥、双桥、拆桥循环。');}
  stages(12);restart();

  onStart=function(){status('先选一个岛，再选同行或同列最近的岛：一桥、双桥、拆桥循环。');};
  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();surface.focus();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
