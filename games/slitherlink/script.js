/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:slitherlink';
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
  var n=5,edges=[],clues=[],cells=[],answer=[],drag=null,animatedEdge=-1;
  function buildEdges(){edges=[];for(var y=0;y<=n;y++)for(var x=0;x<n;x++)edges.push({a:y*(n+1)+x,b:y*(n+1)+x+1,x:60+(x+.5)*480/n,y:60+y*480/n,around:[y>0?(y-1)*n+x:-1,y<n?y*n+x:-1].filter(function(i){return i>=0;})});for(var y=0;y<n;y++)for(var x=0;x<=n;x++)edges.push({a:y*(n+1)+x,b:(y+1)*(n+1)+x,x:60+x*480/n,y:60+(y+.5)*480/n,around:[x>0?y*n+x-1:-1,x<n?y*n+x:-1].filter(function(i){return i>=0;})});}
  function degrees(state){var d=Array((n+1)*(n+1)).fill(0);edges.forEach(function(e,k){if(state[k]===1){d[e.a]++;d[e.b]++;}});return d;}
  function valid(state){var d=degrees(state),used=edges.map(function(_,k){return k;}).filter(function(k){return state[k]===1;});if(!used.length||d.some(function(v){return v!==0&&v!==2;}))return false;if(!clues.every(function(v,i){return v===null||edges.filter(function(e,k){return state[k]===1&&e.around.includes(i);}).length===v;}))return false;var seen=new Set([edges[used[0]].a]),q=Array.from(seen);for(var h=0;h<q.length;h++)used.forEach(function(k){var e=edges[k];if(e.a===q[h]||e.b===q[h]){var j=e.a===q[h]?e.b:e.a;if(!seen.has(j)){seen.add(j);q.push(j);}}});return d.every(function(v,i){return !v||seen.has(i);});}
  function solve(partial){var budget=50000,found=null,cellEdges=clues.map(function(_,i){return edges.map(function(e,k){return e.around.includes(i)?k:-1;}).filter(function(k){return k>=0;});}),vertexEdges=Array.from({length:(n+1)*(n+1)},function(_,i){return edges.map(function(e,k){return e.a===i||e.b===i?k:-1;}).filter(function(k){return k>=0;});});
    function search(state){if(found||--budget<0)return;var changed=true;
      while(changed){changed=false;var bad=false;function force(list,value){list.forEach(function(k){if(!state[k]){state[k]=value;changed=true;}else if(state[k]!==value)bad=true;});}
        cellEdges.forEach(function(list,i){if(clues[i]===null)return;var yes=list.filter(function(k){return state[k]===1;}).length,free=list.filter(function(k){return !state[k];});if(yes>clues[i]||yes+free.length<clues[i])bad=true;else if(yes===clues[i])force(free,2);else if(yes+free.length===clues[i])force(free,1);});
        vertexEdges.forEach(function(list){var yes=list.filter(function(k){return state[k]===1;}).length,free=list.filter(function(k){return !state[k];});if(yes>2||yes===1&&!free.length)bad=true;else if(yes===2||yes===0&&free.length===1)force(free,2);else if(yes===1&&free.length===1)force(free,1);});if(bad)return;
      }
      var best=-1,weight=-1;state.forEach(function(v,k){if(!v){var w=edges[k].around.reduce(function(s,i){return s+(clues[i]===null?0:3);},0)+vertexEdges[edges[k].a].filter(function(j){return state[j]===1;}).length*4;if(w>weight){weight=w;best=k;}}});if(best<0){if(valid(state))found=state.slice();return;}
      var next=state.slice();next[best]=1;search(next);if(!found&&budget>=0){next=state.slice();next[best]=2;search(next);}
    }search(partial.slice());return {solution:found,exhausted:budget<0};
  }
  function makePuzzle(){n=activeOption==='easy'?4:activeOption==='hard'?6:5;buildEdges();var rand=levelRandom(),region=Array(n*n).fill(false);for(var y=1;y<n-1;y++)for(var x=1;x<n-1;x++)region[y*n+x]=true;function boundary(){return edges.map(function(e){return (e.around.length===1?region[e.around[0]]:region[e.around[0]]!==region[e.around[1]])?1:0;});}clues=Array(n*n).fill(null);for(var t=0;t<n*2;t++){var i=Math.floor(rand()*n*n),old=region[i];region[i]=!old;var attempt=boundary();if(!valid(attempt))region[i]=old;}answer=boundary();clues=Array.from({length:n*n},function(_,i){var count=edges.filter(function(e,k){return answer[k]&&e.around.includes(i);}).length;return rand()<(activeOption==='easy'?1:activeOption==='hard'?.68:.85)?count:null;});cells=answer.map(function(){return 0;});}
  function snapshot(){return cells.slice();}function restore(v){cells=v;drag=null;}
  function hit(p){var best=-1,d=Infinity;edges.forEach(function(e,k){var dx=p.x-e.x,dy=p.y-e.y,dist=Math.hypot(dx,dy);if(dist<d){best=k;d=dist;}});return d<480/n*.48?best:-1;}
  function apply(k,value){if(blocked()||k<0)return;cells[k]=value;animatedEdge=value===1?k:-1;cursor=k;hintCells=[];render();}
  function activate(k){if(blocked())return;checkpoint();moves++;apply(k,(cells[k]+1)%3);checkWin();}
  function checkWin(){if(valid(cells))solved('这是一条完整闭合回路，所有数字都正确。');else if(degrees(cells).some(function(v){return v>2;}))status('出现分叉：一个网格点最多连接两条线。');else status('画线后再次点击可排除，再次点击清空。所有线最终须连成一个圈。');}
  function render(){var s=480/n,out='<rect width="600" height="600" fill="#f8f7f0"/>';clues.forEach(function(v,i){var yes=edges.filter(function(e,k){return cells[k]===1&&e.around.includes(i);}).length;if(v!==null)out+=text(60+(i%n+.5)*s,60+(Math.floor(i/n)+.5)*s,v,s*.36,yes>v?'#a33e32':yes===v?'#65846b':'#546377','font-weight="600"');});edges.forEach(function(e,k){var a={x:60+(e.a%(n+1))*s,y:60+Math.floor(e.a/(n+1))*s},b={x:60+(e.b%(n+1))*s,y:60+Math.floor(e.b/(n+1))*s};out+=line(a.x,a.y,b.x,b.y,'#e0e5df',1);if(cells[k]===1)out+=line(a.x,a.y,b.x,b.y,'#5366a7',7,k===animatedEdge?'class="draw-in"':'');else if(cells[k]===2)out+=line(e.x-5,e.y-5,e.x+5,e.y+5,'#adb6ba',2)+line(e.x-5,e.y+5,e.x+5,e.y-5,'#adb6ba',2);if(hintCells.includes(k))out+=line(a.x,a.y,b.x,b.y,'#c28a28',12,'opacity=".6" class="pulse"');});var d=degrees(cells);d.forEach(function(v,i){out+=circle(60+(i%(n+1))*s,60+Math.floor(i/(n+1))*s,v>2?5:3,v>2?'#a33e32':'#7d8b94');});if(edges[cursor])out+=circle(edges[cursor].x,edges[cursor].y,12,'none','stroke="#a0ace4" stroke-width="2"');svg(out);animatedEdge=-1;puzzleHud(cells.filter(function(v){return v===1;}).length+' 条线段',n+' × '+n+' · 数字=四边线数 · 单一回路');announce('数回棋盘，方向键选择边，回车循环画线、排除、清空。');}
  surface.addEventListener('pointerdown',function(e){if(blocked()||e.button>0)return;var k=hit(pos(e));if(k<0)return;e.preventDefault();checkpoint();moves++;drag={id:e.pointerId,value:(cells[k]+1)%3,seen:[k]};surface.setPointerCapture(e.pointerId);apply(k,drag.value);});
  surface.addEventListener('pointermove',function(e){if(!drag||blocked()||drag.id!==e.pointerId)return;var k=hit(pos(e));if(k>=0&&!drag.seen.includes(k)){drag.seen.push(k);apply(k,drag.value);}});
  function endDrag(e){if(!drag||e&&e.pointerId!==drag.id)return;if(e&&e.type==='pointercancel'){cells=history.pop();moves--;render();status('手势已取消。');}drag=null;if(!blocked())checkWin();}
  surface.addEventListener('pointerup',endDrag);surface.addEventListener('pointercancel',endDrag);onPause=function(){drag=null;};
  surface.addEventListener('keydown',function(e){if(blocked()||editing(e))return;if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)activate(cursor);}else if(/^Arrow/.test(e.key)){e.preventDefault();var p=edges[cursor],axis=/Left|Right/.test(e.key)?'x':'y',sign=/Left|Up/.test(e.key)?-1:1,best=-1,dist=Infinity;edges.forEach(function(q,i){var delta=(q[axis]-p[axis])*sign,d=Math.hypot(q.x-p.x,q.y-p.y)+Math.abs(q[axis==='x'?'y':'x']-p[axis==='x'?'y':'x'])*2;if(delta>1&&d<dist){best=i;dist=d;}});if(best>=0)cursor=best;render();}});
  bind('check',function(){if(valid(cells)){solved();return;}var r=solve(cells);status(r.solution?'当前线段和排除标记可以组成合法回路。':r.exhausted?'搜索预算用尽，请先检查数字、分叉和小圈。':'当前标记存在冲突：检查数字、分叉或多个闭环。');});
  bind('hint',function(){var r=solve(cells);if(!r.solution){status(r.exhausted?'提示搜索未完成，请先处理明显的0或3。':'当前标记存在冲突，请先撤销或调整。');return;}var i=r.solution.findIndex(function(v,i){return v===1&&!cells[i];});if(i<0){status('参考方案不需增加线段，请检查已有闭环。');return;}assisted=true;hintCells=[i];cursor=i;render();status('金色高亮边属于一种与当前标记兼容的合法回路，可在此画线。');});
  function restart(){resetState();commonReset();drag=null;makePuzzle();renderStages();render();status('点击网格边画线；再次点击排除。可按住拖画，先从数字0或3开始。');}stages(12);restart();

  onStart=function(){status('点击边循环画线、排除、清空；也可按住拖画。所有线最终必须围成一个圈。');};
  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();surface.focus();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
