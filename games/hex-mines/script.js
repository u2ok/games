/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:hex-mines';
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



  var canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d'),W=600,H=600,anim=0,elapsed=0,assisted=false;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ink='#253047',muted='#64718a',accent='#5366d6',green='#789680',coral='#c87969',gold='#d6ad65';
  var particles=[],pointer={x:300,y:300};
  function point(e){var r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*600/r.width,y:(e.clientY-r.top)*600/r.height};}
  function rect(x,y,w,h,color,r){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r||8);ctx.fill();}
  function text(s,x,y,size,color,align){ctx.fillStyle=color||ink;ctx.font='600 '+(size||20)+'px system-ui';ctx.textAlign=align||'center';ctx.textBaseline='middle';ctx.fillText(String(s),x,y);}
  function line(x,y,a,b,color,width){ctx.strokeStyle=color||ink;ctx.lineWidth=width||3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.stroke();}
  function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function base(title,note){ctx.clearRect(0,0,600,600);rect(0,0,600,600,'#f8fafc');text(title,300,32,22);if(note)text(note,300,63,15,muted);}
  function burst(x,y,color){if(reduce)return;for(var i=0;i<16;i++){var a=i*Math.PI/8;particles.push({x:x,y:y,vx:Math.cos(a)*80,vy:Math.sin(a)*80,t:.55,c:color||gold});}sound(720);}
  function effects(dt){particles=particles.filter(function(p){p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=100*dt;return p.t>0;});}
  function drawEffects(){particles.forEach(function(p){ctx.globalAlpha=Math.max(0,p.t/.55);circle(p.x,p.y,3,p.c);});ctx.globalAlpha=1;}
  function listen(id,fn){document.getElementById(id).addEventListener('click',function(){if(!blocked())fn();});}
  function keyInput(fn){document.addEventListener('keydown',function(e){if(blocked()||editing(e)||e.repeat)return;fn(e);});}
  function useHint(note){assisted=true;status(note);}
  function win(note,value,minimum){if(!assisted)record(value,minimum);complete(note);}
  function begin(){elapsed=0;anim=0;particles=[];assisted=false;resetState();}
  function tick(dt){if(blocked())return;elapsed+=dt;anim+=dt;step(dt);effects(dt);}
  stages(1);
  var previous=0;
  function frame(now){var dt=previous?Math.min(.035,(now-previous)/1000):0;previous=now;if(!blocked())tick(dt);else if(ended&&!paused&&!dialog.open)effects(dt);draw();drawEffects();requestAnimationFrame(frame);}
  requestAnimationFrame(frame);

  var radius=3,spots=[],mines=new Set(),opened=new Set(),flags=new Set(),placed=false,flagMode=false,cursor=0,bombCount=0;
  var six=[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
  function near(i){var p=spots[i];return six.map(function(d){return spots.findIndex(function(q){return q.q===p.q+d[0]&&q.r===p.r+d[1];});}).filter(function(j){return j>=0;});}
  function place(first){var safe=new Set([first].concat(near(first))),ids=shuffled(spots.map(function(_,i){return i;}).filter(function(i){return !safe.has(i);}));mines=new Set(ids.slice(0,bombCount));placed=true;}
  function count(i){return near(i).filter(function(j){return mines.has(j);}).length;}
  function reveal(i){if(opened.has(i)||flags.has(i))return;if(mines.has(i)){opened.add(i);finish('触到地雷。数字只统计六个共边邻格，下次再试。');return;}var q=[i];while(q.length){var j=q.pop();if(opened.has(j)||flags.has(j))continue;opened.add(j);if(!count(j))near(j).forEach(function(k){if(!opened.has(k)&&!mines.has(k))q.push(k);});}if(opened.size===spots.length-bombCount)win('安全格全部揭开，用时 '+Math.ceil(elapsed)+' 秒。',Math.max(1,Math.ceil(elapsed)),true);}
  function activate(i){if(blocked()||i<0)return;cursor=i;if(flagMode){if(opened.has(i))return;if(flags.has(i))flags.delete(i);else flags.add(i);sound(450);}else{if(!placed)place(i);reveal(i);}render();}
  function render(){hud(opened.size,'标记 '+flags.size+'/'+bombCount+' · '+(flagMode?'插旗模式':'揭开模式'),'蜂巢六邻格 · 首击及邻格安全');write('flag-mode',flagMode?'切换揭开':'切换插旗');}
  function restart(){begin();radius={easy:2,normal:3,hard:4}[activeOption]||3;spots=[];for(var q=-radius;q<=radius;q++)for(var r=-radius;r<=radius;r++)if(Math.abs(q+r)<=radius)spots.push({q:q,r:r});bombCount=Math.floor(spots.length*({easy:.14,normal:.19,hard:.23}[activeOption]||.19));mines=new Set();opened=new Set();flags=new Set();placed=false;flagMode=false;cursor=0;render();status('先揭开任意格；数字表示六邻格地雷数。');}
  function geo(i){var p=spots[i],s=220/(radius*1.75+1);return {x:300+Math.sqrt(3)*s*(p.q+p.r/2),y:320+1.5*s*p.r,s:s};}
  function step(){}
  function draw(){base('六向推理，步步为营',flagMode?'当前为插旗模式':'当前为揭开模式');spots.forEach(function(_,i){var p=geo(i);ctx.beginPath();for(var j=0;j<6;j++){var a=(j*60-30)*Math.PI/180;var x=p.x+(p.s-2)*Math.cos(a),y=p.y+(p.s-2)*Math.sin(a);j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fillStyle=opened.has(i)?mines.has(i)?'#e7b6ae':'#fff':'#cbd9cf';ctx.fill();ctx.strokeStyle=cursor===i?accent:'#a8b9ae';ctx.lineWidth=cursor===i?3:1;ctx.stroke();if(flags.has(i)){line(p.x-4,p.y-11,p.x-4,p.y+11,ink,2);ctx.fillStyle=coral;ctx.beginPath();ctx.moveTo(p.x-3,p.y-11);ctx.lineTo(p.x+11,p.y-5);ctx.lineTo(p.x-3,p.y);ctx.fill();}else if(opened.has(i)&&mines.has(i)||ended&&mines.has(i)){circle(p.x,p.y,p.s*.23,coral);}else if(opened.has(i)&&count(i))text(count(i),p.x,p.y,Math.min(22,p.s),[ink,accent,green,coral][count(i)%4]);});text('剩余安全格 '+(spots.length-bombCount-opened.size),300,577,17,muted);}
  function at(p){return spots.findIndex(function(_,i){var g=geo(i);return Math.hypot(g.x-p.x,g.y-p.y)<g.s*.85;});}
  canvas.addEventListener('click',function(e){activate(at(point(e)));});canvas.addEventListener('contextmenu',function(e){e.preventDefault();var old=flagMode;flagMode=true;activate(at(point(e)));flagMode=old;render();});listen('flag-mode',function(){flagMode=!flagMode;render();status(flagMode?'插旗模式：点击标记或取消地雷旗。':'揭开模式：点击安全格。');});listen('chord',function(){if(!placed||!opened.has(cursor))return;var ns=near(cursor);if(ns.filter(function(i){return flags.has(i);}).length!==count(cursor)){status('邻格旗数必须等于当前数字才可展开。');return;}ns.filter(function(i){return !flags.has(i);}).forEach(function(i){if(!ended)reveal(i);});render();});keyInput(function(e){if(e.key==='f'||e.key==='F'){flagMode=!flagMode;render();}if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();cursor=(cursor+1)%spots.length;}if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();cursor=(cursor+spots.length-1)%spots.length;}if(e.key===' '){e.preventDefault();activate(cursor);}});restart();

  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
