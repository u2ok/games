/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:hex-blocks';
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
  var radius=4,spots=[],filled={},pieces=[],bag=[],bagAt=0,selected=-1,preview=null,drag=null,score=0,flash=[],flashTime=0;
  var shapes=[[[0,0]],[[0,0],[1,0]],[[0,0],[0,1]],[[0,0],[1,-1]],[[0,0],[1,0],[-1,0]],[[0,0],[0,1],[1,0]],[[0,0],[1,0],[1,-1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0]],[[0,0],[0,1],[0,2]],[[0,0],[1,-1],[2,-2]],[[0,0],[1,0],[2,0],[3,0]],[[0,0],[1,0],[1,1],[0,1],[-1,1]],[[0,0],[1,0],[2,0],[0,1],[0,2]],[[0,0],[1,0],[0,1],[-1,1],[-1,0]]];
  function spotKey(q,r){return q+','+r;}function center(q,r){return {x:300+Math.sqrt(3)*(radius===3?39:31)*(q+r/2),y:238+1.5*(radius===3?39:31)*r};}
  function hex(p,size,fill,stroke,extra){var pts=[];for(var a=0;a<6;a++){var t=(a*60-30)*Math.PI/180;pts.push((p.x+Math.cos(t)*size)+','+(p.y+Math.sin(t)*size));}return '<polygon points="'+pts.join(' ')+'" fill="'+fill+'" stroke="'+(stroke||'#fff')+'" stroke-width="2" '+(extra||'')+'/>';}
  function canPlace(shape,q,r){return shape.every(function(v){var key=spotKey(q+v[0],r+v[1]);return spots.some(function(s){return s.key===key;})&&filled[key]===undefined;});}
  function completedLines(){var all=[];['q','r','s'].forEach(function(axis){for(var i=-radius;i<=radius;i++){var line=spots.filter(function(p){return (axis==='q'?p.q:axis==='r'?p.r:p.q+p.r)===i;});if(line.length&&line.every(function(p){return filled[p.key]!==undefined;}))all.push(line.map(function(p){return p.key;}));}});return all;}
  function legalMoves(){return pieces.some(function(piece){return piece&&spots.some(function(p){return canPlace(piece.shape,p.q,p.r);});});}
  function refill(){pieces=[0,1,2].map(function(){return clone(bag[bagAt++%bag.length]);});}
  function snapshot(){return {filled:clone(filled),pieces:clone(pieces),bagAt:bagAt,score:score};}function restore(v){filled=v.filled;pieces=v.pieces;bagAt=v.bagAt;score=v.score;selected=-1;preview=null;flash=[];}
  function place(q,r){if(blocked()||selected<0||!pieces[selected])return false;var piece=pieces[selected];if(!canPlace(piece.shape,q,r)){status('这里放不下：拼块不能超出蜂巢或与已有格子重叠。');return false;}checkpoint();piece.shape.forEach(function(v){filled[spotKey(q+v[0],r+v[1])]=piece.color;});moves++;score+=piece.shape.length*10;pieces[selected]=null;var lines=completedLines(),unique=new Set(lines.flat());flash=Array.from(unique);flashTime=.45;unique.forEach(function(k){delete filled[k];});score+=unique.size*15+lines.length*50;selected=-1;preview=null;if(pieces.every(function(p){return !p;}))refill();render();sound(lines.length?880:480);status(lines.length?'消除 '+lines.length+' 条直线，共 '+unique.size+' 格，获得额外连线分！':'拼块已放好。选择下一块，三条轴的完整直线都能消除。');if(!legalMoves()){if(!assisted)record(score,false);finish('没有可放位置，本局获得 '+score+' 分。');}return true;}
  function render(){var out='<rect width="600" height="600" fill="#f1f2ec"/>';spots.forEach(function(p){var c=center(p.q,p.r),v=filled[p.key];out+=hex(c,radius===3?37:29,v===undefined?'#e2e7da':colors[v],v===undefined?'#cdd7c5':'#ffffff80',v===undefined?'':'');});if(preview&&selected>=0&&pieces[selected]){var valid=canPlace(pieces[selected].shape,preview.q,preview.r);pieces[selected].shape.forEach(function(v){out+=hex(center(preview.q+v[0],preview.r+v[1]),radius===3?36:28,valid?'#5366d650':'#b45e4f55',valid?'#5366d6':'#a33e32');});}flash.forEach(function(k){var p=k.split(',').map(Number);out+=hex(center(p[0],p[1]),radius===3?37:29,'#f2cf72','#fff','opacity="'+Math.max(0,flashTime/.45)+'"');});
    out+=line(45,459,555,459,'#dbe1d5',2);pieces.forEach(function(piece,i){var cx=120+i*180;out+='<rect x="'+(cx-78)+'" y="478" width="156" height="106" rx="15" fill="'+(selected===i?'#e3e8fa':'#fbfcf7')+'" stroke="'+(selected===i?'#8998db':'#dce3d4')+'" stroke-width="2"/>';if(piece){var xs=piece.shape.map(function(v){return (v[0]+v[1]/2)*30;}),ys=piece.shape.map(function(v){return v[1]*26;}),ox=(Math.min.apply(null,xs)+Math.max.apply(null,xs))/2,oy=(Math.min.apply(null,ys)+Math.max.apply(null,ys))/2;piece.shape.forEach(function(v,j){var p={x:cx+(v[0]+v[1]/2)*30-ox,y:525+v[1]*26-oy};out+=hex(p,17,colors[piece.color],j===0?'#253047':'#fff');if(j===0)out+=circle(p.x,p.y,3,'#fff');});out+=text(cx,575,i+1,15,'#63718a');}else out+=text(cx,533,'已放置',18,'#93a089');});svg(out);hud(score,'已放 '+moves+' 块 · 空格 '+(spots.length-Object.keys(filled).length),'蜂巢消除 · 三个方向 · 无处可放结束');document.getElementById('undo').disabled=!history.length;announce('六边形消除，数字1到3选拼块，方向键选择落点，回车放置。');}
  function hit(p){var best=null,d=Infinity;spots.forEach(function(s){var c=center(s.q,s.r),dist=Math.hypot(c.x-p.x,c.y-p.y);if(dist<d){d=dist;best=s;}});return d<(radius===3?39:31)?best:null;}
  function choose(i){if(!pieces[i]){status('这一块已经放好，三块用完会补充新拼块。');return false;}selected=i;preview=null;render();status('已选第 '+(i+1)+' 块，以白点所在的格子对准落点。');return true;}
  surface.addEventListener('pointerdown',function(e){if(blocked()||e.button>0)return;var p=pos(e);if(p.y>=478&&p.y<=584){var i=Math.round((p.x-120)/180);if(i>=0&&i<3&&choose(i)){drag={id:e.pointerId};surface.setPointerCapture(e.pointerId);}return;}var spot=hit(p);if(spot&&selected>=0)place(spot.q,spot.r);});surface.addEventListener('pointermove',function(e){if(blocked()||selected<0)return;var p=hit(pos(e));if((p&&p.key)!==(preview&&preview.key)){preview=p;render();}});surface.addEventListener('pointerup',function(e){if(!drag)return;var p=hit(pos(e));drag=null;if(p&&!blocked())place(p.q,p.r);});surface.addEventListener('pointercancel',function(){drag=null;preview=null;render();});onPause=function(){drag=null;preview=null;};
  surface.addEventListener('keydown',function(e){if(blocked()||editing(e))return;if(/^[123]$/.test(e.key)){choose(Number(e.key)-1);return;}if(/^Arrow/.test(e.key)){e.preventDefault();var i=preview?spots.indexOf(preview):Math.floor(spots.length/2),d={ArrowLeft:-1,ArrowRight:1,ArrowUp:-radius*2,ArrowDown:radius*2}[e.key];preview=spots[Math.max(0,Math.min(spots.length-1,i+d))];render();}else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat&&preview)place(preview.q,preview.r);}});
  bind('hint',function(){for(var i=0;i<3;i++)if(pieces[i])for(var p of spots)if(canPlace(pieces[i].shape,p.q,p.r)){selected=i;preview=p;assisted=true;render();status('已预览一个合法落点；点击该位置或按回车放置，不保证后续最优。');return;}status('所有剩余拼块都无处可放。');});
  function restart(){resetState();commonReset();score=0;radius=activeOption==='easy'?3:4;spots=[];for(var q=-radius;q<=radius;q++)for(var r=-radius;r<=radius;r++)if(Math.abs(q+r)<=radius)spots.push({q:q,r:r,key:spotKey(q,r)});filled={};var rand=seedRandom(Math.floor(Math.random()*4294967296));bag=Array.from({length:500},function(){var min=activeOption==='hard'?4:0,max=activeOption==='easy'?7:activeOption==='hard'?shapes.length:11;return {shape:clone(shapes[min+Math.floor(rand()*(max-min))]),color:Math.floor(rand()*colors.length)};});bagAt=0;refill();selected=-1;preview=null;flash=[];renderStages();render();status('选下方拼块，再点蜂巢落点；也可以拖放。白点表示落点的对准格。');}
  clock(function(dt){if(flashTime>0){flashTime-=dt;if(flashTime<=0)flash=[];render();}});stages(1);restart();

  onStart=function(){status('选下方拼块，再点蜂巢落点；也可拖放。白点是对准格，完整直线会同时消除。');};
  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();surface.focus();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
