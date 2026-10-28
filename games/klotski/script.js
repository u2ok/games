/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:klotski';
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
  var sizes=[[2,2],[1,2],[1,2],[1,2],[1,2],[2,1],[1,1],[1,1],[1,1],[1,1]],names=['曹操','赵云','张飞','马超','黄忠','关羽','兵一','兵二','兵三','兵四'];
  var blocks=[],selected=0,drag=null,solutionPath=[],lastPositions=null;
  function occupied(state){var board=Array(20).fill(-1);state.forEach(function(p,i){for(var y=0;y<sizes[i][1];y++)for(var x=0;x<sizes[i][0];x++)board[(p[1]+y)*4+p[0]+x]=i;});return board;}
  function shifted(state,id,dx,dy){var next=state.map(function(p){return p.slice();}),p=next[id],w=sizes[id][0],h=sizes[id][1];p[0]+=dx;p[1]+=dy;if(p[0]<0||p[1]<0||p[0]+w>4||p[1]+h>5)return null;var board=occupied(state);for(var y=0;y<h;y++)for(var x=0;x<w;x++){var at=board[(p[1]+y)*4+p[0]+x];if(at>=0&&at!==id)return null;}return next;}
  function keyFor(state){var groups={};state.forEach(function(p,i){var key=sizes[i].join('x');(groups[key]||(groups[key]=[])).push(p[1]*4+p[0]);});return Object.keys(groups).sort().map(function(k){return groups[k].sort(function(a,b){return a-b;}).join(',');}).join('|');}
  function valid(state){if(state.length!==10)return false;var used=new Set();return state.every(function(p,i){if(p[0]<0||p[1]<0||p[0]+sizes[i][0]>4||p[1]+sizes[i][1]>5)return false;for(var y=0;y<sizes[i][1];y++)for(var x=0;x<sizes[i][0];x++){var k=(p[1]+y)*4+p[0]+x;if(used.has(k))return false;used.add(k);}return true;});}
  function goal(state){return state[0][0]===1&&state[0][1]===3;}
  function solve(state,budget){var nodes=[{state:clone(state),parent:-1,move:null}],seen=new Set([keyFor(state)]),found=-1;budget=budget||90000;for(var h=0;h<nodes.length&&h<budget;h++){var entry=nodes[h];if(goal(entry.state)){found=h;break;}for(var i=0;i<10;i++)for(var d of [[-1,0],[1,0],[0,-1],[0,1]]){var next=shifted(entry.state,i,d[0],d[1]);if(!next)continue;var key=keyFor(next);if(seen.has(key))continue;seen.add(key);nodes.push({state:next,parent:h,move:{id:i,dx:d[0],dy:d[1]}});}}
    if(found<0)return null;var path=[];while(nodes[found].parent>=0){path.push(nodes[found].move);found=nodes[found].parent;}return path.reverse();}
  // 经典横刀立马的116步最短路径按剩余步数分级，关卡和提示均由真实合法移动验证。
  var classicRoute=[{"id":8,"dx":1,"dy":0},{"id":3,"dx":0,"dy":1},{"id":5,"dx":-1,"dy":0},{"id":7,"dx":0,"dy":-1},{"id":9,"dx":-1,"dy":0},{"id":4,"dx":0,"dy":1},{"id":7,"dx":1,"dy":0},{"id":5,"dx":1,"dy":0},{"id":3,"dx":0,"dy":-1},{"id":8,"dx":-1,"dy":0},{"id":9,"dx":-1,"dy":0},{"id":4,"dx":-1,"dy":0},{"id":7,"dx":0,"dy":1},{"id":5,"dx":1,"dy":0},{"id":6,"dx":0,"dy":-1},{"id":7,"dx":0,"dy":1},{"id":9,"dx":0,"dy":-1},{"id":8,"dx":1,"dy":0},{"id":3,"dx":0,"dy":1},{"id":6,"dx":-1,"dy":0},{"id":5,"dx":-1,"dy":0},{"id":2,"dx":0,"dy":1},{"id":2,"dx":0,"dy":1},{"id":0,"dx":1,"dy":0},{"id":1,"dx":1,"dy":0},{"id":6,"dx":0,"dy":-1},{"id":3,"dx":0,"dy":-1},{"id":6,"dx":0,"dy":-1},{"id":3,"dx":0,"dy":-1},{"id":8,"dx":-1,"dy":0},{"id":9,"dx":-1,"dy":0},{"id":4,"dx":-1,"dy":0},{"id":7,"dx":-1,"dy":0},{"id":2,"dx":0,"dy":1},{"id":5,"dx":1,"dy":0},{"id":4,"dx":0,"dy":-1},{"id":7,"dx":0,"dy":-1},{"id":8,"dx":1,"dy":0},{"id":8,"dx":1,"dy":0},{"id":4,"dx":0,"dy":1},{"id":1,"dx":0,"dy":1},{"id":6,"dx":1,"dy":0},{"id":3,"dx":0,"dy":-1},{"id":9,"dx":0,"dy":-1},{"id":4,"dx":-1,"dy":0},{"id":1,"dx":0,"dy":1},{"id":1,"dx":0,"dy":1},{"id":9,"dx":1,"dy":0},{"id":9,"dx":0,"dy":-1},{"id":5,"dx":-1,"dy":0},{"id":2,"dx":0,"dy":-1},{"id":5,"dx":-1,"dy":0},{"id":8,"dx":1,"dy":0},{"id":7,"dx":0,"dy":1},{"id":2,"dx":-1,"dy":0},{"id":8,"dx":0,"dy":-1},{"id":7,"dx":1,"dy":0},{"id":2,"dx":0,"dy":1},{"id":5,"dx":1,"dy":0},{"id":3,"dx":0,"dy":1},{"id":5,"dx":1,"dy":0},{"id":1,"dx":0,"dy":-1},{"id":6,"dx":-1,"dy":0},{"id":9,"dx":0,"dy":-1},{"id":1,"dx":0,"dy":-1},{"id":2,"dx":-1,"dy":0},{"id":7,"dx":-1,"dy":0},{"id":8,"dx":0,"dy":1},{"id":5,"dx":0,"dy":1},{"id":0,"dx":0,"dy":1},{"id":9,"dx":1,"dy":0},{"id":6,"dx":1,"dy":0},{"id":3,"dx":0,"dy":-1},{"id":4,"dx":0,"dy":-1},{"id":9,"dx":1,"dy":0},{"id":6,"dx":1,"dy":0},{"id":1,"dx":0,"dy":-1},{"id":2,"dx":0,"dy":-1},{"id":7,"dx":-1,"dy":0},{"id":7,"dx":-1,"dy":0},{"id":8,"dx":-1,"dy":0},{"id":8,"dx":-1,"dy":0},{"id":5,"dx":0,"dy":1},{"id":0,"dx":0,"dy":1},{"id":6,"dx":0,"dy":1},{"id":6,"dx":1,"dy":0},{"id":1,"dx":1,"dy":0},{"id":2,"dx":0,"dy":-1},{"id":2,"dx":0,"dy":-1},{"id":0,"dx":-1,"dy":0},{"id":6,"dx":0,"dy":1},{"id":6,"dx":0,"dy":1},{"id":9,"dx":0,"dy":1},{"id":9,"dx":0,"dy":1},{"id":1,"dx":1,"dy":0},{"id":2,"dx":1,"dy":0},{"id":3,"dx":1,"dy":0},{"id":4,"dx":0,"dy":-1},{"id":4,"dx":0,"dy":-1},{"id":0,"dx":-1,"dy":0},{"id":6,"dx":-1,"dy":0},{"id":6,"dx":0,"dy":-1},{"id":5,"dx":0,"dy":-1},{"id":8,"dx":1,"dy":0},{"id":7,"dx":1,"dy":0},{"id":8,"dx":1,"dy":0},{"id":7,"dx":1,"dy":0},{"id":0,"dx":0,"dy":1},{"id":6,"dx":-1,"dy":0},{"id":6,"dx":-1,"dy":0},{"id":9,"dx":-1,"dy":0},{"id":9,"dx":-1,"dy":0},{"id":5,"dx":0,"dy":-1},{"id":7,"dx":0,"dy":-1},{"id":7,"dx":1,"dy":0},{"id":0,"dx":1,"dy":0}];
  function makePuzzle(){var remaining=activeOption==='easy'?6+stageIndex*2:activeOption==='hard'?70+stageIndex*4:32+stageIndex*3;var state=[[1,0],[0,0],[3,0],[0,2],[3,2],[1,2],[1,3],[2,3],[0,4],[3,4]],at=classicRoute.length-remaining;for(var i=0;i<at;i++){var m=classicRoute[i];state=shifted(state,m.id,m.dx,m.dy);}blocks=state;solutionPath=clone(classicRoute.slice(at));}
  function snapshot(){return {blocks:clone(blocks),path:clone(solutionPath),selected:selected};}function restore(v){blocks=v.blocks;solutionPath=v.path;selected=v.selected;drag=null;}
  function move(id,dx,dy){if(blocked())return false;var next=shifted(blocks,id,dx,dy);if(!next){status('这一侧被挡住了，请先移动周围木块腾出空间。');return false;}checkpoint();blocks=next;moves++;selected=id;var m=solutionPath[0];if(m&&m.id===id&&m.dx===dx&&m.dy===dy)solutionPath.shift();else solutionPath.unshift({id:id,dx:-dx,dy:-dy});render();sound(400);if(goal(blocks))solved('曹操已从下方出口脱身。');else status(names[id]+'已移动一格；可继续拖动，或用方向键精细移动。');return true;}
  function render(){var s=96,ox=108,oy=44,out='<rect width="600" height="600" fill="#eee8dc"/>'+ '<rect x="93" y="29" width="414" height="510" rx="18" fill="#c5ad88" stroke="#a08a69" stroke-width="3"/>'+ '<rect x="104" y="40" width="392" height="488" rx="10" fill="#e3d3b5"/>'+ '<path d="M250 540h100" stroke="#eee8dc" stroke-width="22"/>'+text(300,568,'出口',20,'#7f725c');
    blocks.forEach(function(p,i){var x=ox+p[0]*s,y=oy+p[1]*s,w=sizes[i][0]*s-6,h=sizes[i][1]*s-6;out+='<g class="tile" data-block="'+i+'"><rect x="'+(x+3)+'" y="'+(y+6)+'" width="'+w+'" height="'+h+'" rx="10" fill="#b39c78" opacity=".4"/>'+ '<rect class="tile" x="'+(x+3)+'" y="'+(y+1)+'" width="'+w+'" height="'+h+'" rx="10" fill="'+(i===0?'#bd7565':i===5?'#b99863':i<5?'#82947a':'#d4bb8f')+'" stroke="'+(selected===i?'#5366d6':'#ffffff70')+'" stroke-width="'+(selected===i?4:2)+'"/>'+line(x+15,y+12,x+w-9,y+12,'#ffffff35',2)+text(x+3+w/2,y+h/2,names[i],i===0?39:i<6?26:20,i<5?'#fff9ee':'#554c3e','font-weight="600"')+'</g>';if(hintCells.includes(i))out+='<rect x="'+(x+8)+'" y="'+(y+6)+'" width="'+(w-10)+'" height="'+(h-10)+'" rx="7" fill="none" stroke="#f8dfa0" stroke-width="5" class="pulse"/>';});svg(out);if(lastPositions&&!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)){surface.querySelectorAll('[data-block]').forEach(function(el){var i=Number(el.getAttribute('data-block')),dx=(lastPositions[i][0]-blocks[i][0])*96,dy=(lastPositions[i][1]-blocks[i][1])*96;if((dx||dy)&&el.animate)el.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'translate(0,0)'}],{duration:160,easing:'ease-out'});});}lastPositions=clone(blocks);puzzleHud('已选 '+names[selected],'4 × 5 · 腾挪木块 · 曹操移到下方出口');announce('华容道，选中'+names[selected]+'，方向键移动，方括号键在木块间选择。');}
  function hit(p){var x=Math.floor((p.x-108)/96),y=Math.floor((p.y-44)/96);return x>=0&&x<4&&y>=0&&y<5?occupied(blocks)[y*4+x]:-1;}
  surface.addEventListener('pointerdown',function(e){if(blocked()||e.button>0)return;var p=pos(e),id=hit(p);if(id<0)return;selected=id;drag={id:e.pointerId,x:p.x,y:p.y};surface.setPointerCapture(e.pointerId);surface.focus();render();});surface.addEventListener('pointermove',function(e){if(!drag||blocked()||e.pointerId!==drag.id)return;var p=pos(e),dx=p.x-drag.x,dy=p.y-drag.y;if(Math.max(Math.abs(dx),Math.abs(dy))<48)return;var x=Math.abs(dx)>Math.abs(dy)?Math.sign(dx):0,y=x?0:Math.sign(dy);if(move(selected,x,y)){drag.x+=x*96;drag.y+=y*96;}else{drag.x=p.x;drag.y=p.y;}});surface.addEventListener('pointerup',function(){drag=null;});surface.addEventListener('pointercancel',function(){drag=null;});onPause=function(){drag=null;};
  surface.addEventListener('keydown',function(e){if(blocked()||editing(e))return;var d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){e.preventDefault();move(selected,d[0],d[1]);}else if(e.key==='['||e.key===']'){e.preventDefault();selected=(selected+(e.key==='['?9:1))%10;render();}else if(e.key==='Enter'){e.preventDefault();selected=(selected+1)%10;render();}});
  bind('hint',function(){var path=solve(blocks,35000)||solutionPath;if(!path||!path.length){status('暂未找到路线，请尝试腾出出口附近空间。');return;}solutionPath=path;var m=path[0];selected=m.id;hintCells=[m.id];assisted=true;render();status('下一步：将'+names[m.id]+'向'+(m.dx>0?'右':m.dx<0?'左':m.dy>0?'下':'上')+'移动一格。提示保证可走，不承诺最短。');});
  function restart(){resetState();commonReset();selected=0;drag=null;lastPositions=null;makePuzzle();renderStages();render();status('拖动木块，或选中后用方向键移动，让曹操到达下方出口。');}stages(12);restart();

  onStart=function(){status('拖动木块，或选中后用方向键移动。将曹操移到下方出口；Enter切换选中木块。');};
  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();surface.focus();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
