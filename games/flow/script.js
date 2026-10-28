/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:flow';
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
  var n=6,endpoints=[],routes=[],reference=[],active=-1,drag=null;
  function adjacent(a,b){return Math.abs(a%n-b%n)+Math.abs(Math.floor(a/n)-Math.floor(b/n))===1;}
  function makePuzzle(){n=activeOption==='easy'?5:activeOption==='hard'?7:6;var rand=levelRandom(),path=[];for(var y=0;y<n;y++)for(var x=0;x<n;x++)path.push(y*n+(y%2?n-1-x:x));for(var k=0;k<300;k++){if(rand()<.5)path.reverse();var options=[];for(var i=2;i<path.length;i++)if(adjacent(path[0],path[i]))options.push(i);if(options.length){var j=options[Math.floor(rand()*options.length)];path=path.slice(0,j).reverse().concat(path.slice(j));}}
    var count=activeOption==='easy'?4:activeOption==='hard'?6:5,lengths=Array(count).fill(3),remaining=n*n-count*3;while(remaining-->0)lengths[Math.floor(rand()*count)]++;reference=[];endpoints=[];var at=0;lengths.forEach(function(len){var p=path.slice(at,at+len);reference.push(p);endpoints.push([p[0],p[p.length-1]]);at+=len;});routes=endpoints.map(function(){return [];});
  }
  function owner(i){return routes.findIndex(function(p){return p.includes(i);});}
  function endpoint(i){return endpoints.findIndex(function(p){return p.includes(i);});}
  function valid(state){var used=new Set();return state.length===endpoints.length&&state.every(function(p,k){return p.length>=2&&endpoints[k].includes(p[0])&&endpoints[k].includes(p[p.length-1])&&p[0]!==p[p.length-1]&&p.every(function(i,j){if(i<0||i>=n*n||used.has(i)||j&&!adjacent(i,p[j-1]))return false;used.add(i);return endpoint(i)<0||endpoint(i)===k&&(j===0||j===p.length-1);});})&&used.size===n*n;}
  function snapshot(){return clone(routes);}function restore(v){routes=v;active=-1;drag=null;}
  function select(i){var k=endpoint(i),o=owner(i);if(k>=0){checkpoint();moves++;active=k;routes[k]=[i];hintCells=[];status('正在连接 '+(k+1)+' 号，拖向另一个同号端点；沿原线回拖可退回。');render();return true;}if(o>=0){checkpoint();moves++;active=o;routes[o]=routes[o].slice(0,routes[o].indexOf(i)+1);render();return true;}return false;}
  function extend(i){if(active<0)return false;var path=routes[active],last=path[path.length-1];if(i===last)return false;var old=path.indexOf(i);if(old>=0){routes[active]=path.slice(0,old+1);render();return true;}if(!adjacent(last,i)){status('每次只能横向或纵向走一格。');return false;}var end=endpoint(i),o=owner(i);if(end>=0&&end!==active||o>=0&&o!==active){status('路线不能穿过其它颜色或端点，请退回后绕行。');return false;}if(path.length>1&&endpoints[active].includes(last)){status('此路线已接通；从端点重新画线可改道。');return false;}path.push(i);cursor=i;sound(end===active?760:440);render();if(valid(routes))solved('所有同号端点已连接，棋盘全部铺满。');else if(end===active)status('这条线已接通。继续连接其它颜色，并填满所有空格。');return true;}
  function activate(i){if(blocked())return;if(active>=0&&endpoint(i)!==active&&extend(i))return;if(active>=0&&endpoint(i)===active&&routes[active].length&&i!==routes[active][0]&&extend(i))return;select(i);}
  function hit(p){var x=Math.floor((p.x-36)*n/528),y=Math.floor((p.y-36)*n/528);return x>=0&&y>=0&&x<n&&y<n?y*n+x:-1;}
  function center(i){return {x:36+(i%n+.5)*528/n,y:36+(Math.floor(i/n)+.5)*528/n};}
  function render(){var s=528/n,out='<rect width="600" height="600" fill="#f1f3f8"/>';for(var i=0;i<n*n;i++){var p=center(i);out+='<rect x="'+(p.x-s/2+2)+'" y="'+(p.y-s/2+2)+'" width="'+(s-4)+'" height="'+(s-4)+'" rx="8" fill="#fff"/>';}
    if(hintCells.length){var pts=hintCells.map(function(i){var p=center(i);return p.x+','+p.y;}).join(' ');out+='<polyline points="'+pts+'" fill="none" stroke="#b38b3b" stroke-width="'+(s*.3)+'" opacity=".4" stroke-linejoin="round" stroke-linecap="round" class="pulse"/>';}
    routes.forEach(function(path,k){if(path.length>1){var pts=path.map(function(i){var p=center(i);return p.x+','+p.y;}).join(' ');out+='<polyline points="'+pts+'" fill="none" stroke="'+colors[k]+'" stroke-width="'+(s*.32)+'" stroke-linecap="round" stroke-linejoin="round"/>';}});endpoints.forEach(function(pair,k){pair.forEach(function(i){var p=center(i);out+=circle(p.x,p.y,s*.29,colors[k],'stroke="#fff" stroke-width="4"')+text(p.x,p.y,k+1,s*.28,'#fff','font-weight="700"');});});var p=center(cursor);out+='<rect x="'+(p.x-s/2+5)+'" y="'+(p.y-s/2+5)+'" width="'+(s-10)+'" height="'+(s-10)+'" rx="7" fill="none" stroke="#9cabd5" stroke-width="2"/>';svg(out);var filled=new Set(routes.flat()).size,done=routes.filter(function(p,k){return p.length>1&&endpoints[k].includes(p[p.length-1]);}).length;puzzleHud(done+'/'+routes.length+' 对 · 覆盖 '+filled+'/'+(n*n),n+' × '+n+' · 同号连接 · 铺满棋盘');announce('彩线棋盘，方向键选格、回车画线，已连接'+done+'对，已填'+filled+'格。');}
  surface.addEventListener('pointerdown',function(e){if(blocked()||e.button>0)return;var i=hit(pos(e));if(i<0)return;e.preventDefault();if(select(i)){drag={id:e.pointerId,last:pos(e)};surface.setPointerCapture(e.pointerId);}else if(active>=0)extend(i);});surface.addEventListener('pointermove',function(e){if(!drag||blocked()||drag.id!==e.pointerId)return;var p=pos(e),last=drag.last||p,steps=Math.ceil(Math.hypot(p.x-last.x,p.y-last.y)/(528/n*.3));for(var k=1;k<=steps&&!blocked();k++){var i=hit({x:last.x+(p.x-last.x)*k/steps,y:last.y+(p.y-last.y)*k/steps});if(i>=0)extend(i);}if(drag)drag.last=p;});
  surface.addEventListener('pointerup',function(){drag=null;});surface.addEventListener('pointercancel',function(){if(drag&&history.length){routes=history.pop();moves--;active=-1;render();status('手势已取消，已恢复拖动前路线。');}drag=null;});onPause=function(){drag=null;};surface.addEventListener('keydown',function(e){gridKey(e,n,n*n,activate);});
  bind('clear',function(){if(active<0){status('先选择一条路线，再点清除本色。');return;}checkpoint();routes[active]=[];active=-1;moves++;render();status('已清除选中颜色，其它路线保留。');});
  bind('hint',function(){var k=routes.findIndex(function(p,i){return !p.length||p.length<reference[i].length;});if(k<0)k=0;hintCells=reference[k].slice();assisted=true;render();status('金色虚影展示 '+(k+1)+' 号的一种参考路线，不会覆盖现有路线；其它合法铺满方案同样通过。');});
  function restart(){resetState();commonReset();active=-1;drag=null;makePuzzle();renderStages();render();status('从数字端点拖向同号端点。连接全部颜色，并把棋盘填满。');}stages(15);restart();

  onStart=function(){status('从数字端点拖向同号端点；沿线回拖可退回。连接全部颜色，并填满棋盘。');};
  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();surface.focus();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
