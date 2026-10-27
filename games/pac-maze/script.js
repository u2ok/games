/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:pac-maze';
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

  var map=[],dots=[],player=0,enemies=[],direction=0,wanted=0,lives=3,score=0,power=0,invincible=0,moveClock=0,enemyClock=0;
  var maze=['###############','#.....#.......#','#.###.#.###.#.#','#o#...#...#.#o#','#.#.#####.#.#.#','#.............#','###.#.###.#.###','#...#..#..#...#','#.###.....###.#','#.....###.....#','#.###.....###.#','#o..#.###.#..o#','#.#.........#.#','#.....#.......#','###############'];
  function adjacent(i,d){var j=i+[-1,-15,15,1][d];return j>=0&&j<225&&Math.abs(j%15-i%15)<=1&&map[j]!=='#'?j:i;}
  function distance(from,to){var q=[from],dist={};dist[from]=0;for(var h=0;h<q.length;h++){var i=q[h];if(i===to)return dist[i];for(var d=0;d<4;d++){var j=adjacent(i,d);if(dist[j]===undefined){dist[j]=dist[i]+1;q.push(j);}}}return 999;}
  function contact(){enemies.forEach(function(e){if(e.i!==player)return;if(power>0){e.i=e.home;score+=200;burst(45+player%15*36,95+Math.floor(player/15)*31,accent);}else if(invincible<=0){lives--;player=16;direction=3;wanted=3;power=0;invincible=2;enemies.forEach(function(a){a.i=a.home;});status('碰到追兵，剩余 '+lives+' 条生命；短暂保护中。');if(!lives){record(score,false);finish('生命耗尽。利用能量豆反击，或在岔路甩开追兵。');}}});}
  function step(dt){power=Math.max(0,power-dt);invincible=Math.max(0,invincible-dt);moveClock+=dt;enemyClock+=dt;var interval={easy:.18,normal:.15,hard:.12}[activeOption]||.15;if(moveClock>=interval){moveClock-=interval;if(adjacent(player,wanted)!==player)direction=wanted;player=adjacent(player,direction);if(dots[player]){score+=dots[player]===2?50:10;if(dots[player]===2){power=6;status('能量生效六秒，追兵变为蓝色，可以反击。');}dots[player]=0;sound(360);if(dots.every(function(v){return !v;}))win('豆子全部收集，得分 '+score+'。',score,false);}contact();render();}if(enemyClock>=interval*1.65){enemyClock=0;enemies.forEach(function(e){var opts=[0,1,2,3].map(function(d){return adjacent(e.i,d);}).filter(function(i){return i!==e.i;});opts.sort(function(a,b){return power?distance(b,player)-distance(a,player):distance(a,player)-distance(b,player);});e.i=opts[0]===undefined?e.i:opts[0];});contact();render();}}
  function render(){hud(score,'生命 '+lives+' · 剩余豆 '+dots.filter(Boolean).length+(power?' · 反击 '+Math.ceil(power)+' 秒':''),'方向移动 · 三条生命');}
  function restart(){begin();map=maze.join('').split('');dots=map.map(function(c){return c==='.'?1:c==='o'?2:0;});player=16;dots[player]=0;enemies=[{i:28,home:28},{i:208,home:208}];if(activeOption==='hard')enemies.push({i:196,home:196});direction=wanted=3;lives=3;score=0;power=0;invincible=2;moveClock=enemyClock=0;render();status('吃完所有豆子；大豆提供六秒反击，方向键或下方按钮移动。');}
  function draw(){base('吃完豆子，留意岔路','大能量豆可反击六秒');map.forEach(function(c,i){var x=30+i%15*36,y=80+Math.floor(i/15)*31;if(c==='#')rect(x+1,y+1,34,29,'#d7e1ed',5);else if(dots[i])circle(x+18,y+15,dots[i]===2?6:2.8,dots[i]===2?coral:gold);});var x=48+player%15*36,y=95+Math.floor(player/15)*31;if(!invincible||Math.floor(anim*8)%2){ctx.fillStyle=gold;ctx.beginPath();var a=[Math.PI,Math.PI*1.5,Math.PI/2,0][direction],mouth=reduce?.2:.18+.18*Math.abs(Math.sin(anim*12));ctx.moveTo(x,y);ctx.arc(x,y,13,a+mouth,a+Math.PI*2-mouth);ctx.closePath();ctx.fill();}enemies.forEach(function(e,k){var x=48+e.i%15*36,y=95+Math.floor(e.i/15)*31;circle(x,y-2,12,power?accent:k?coral:green);rect(x-12,y-2,24,13,power?accent:k?coral:green,3);circle(x-4,y-3,3,'#fff');circle(x+4,y-3,3,'#fff');});text('生命 '+lives+' · 得分 '+score,300,575,17,muted);}
  function setDir(d){wanted=d;status('已转向，前方可通行时移动。');}['left','up','down','right'].forEach(function(id,d){listen(id,function(){setDir(d);});});keyInput(function(e){var d={ArrowLeft:0,a:0,ArrowUp:1,w:1,ArrowDown:2,s:2,ArrowRight:3,d:3}[e.key];if(d!==undefined){e.preventDefault();wanted=d;}});restart();

  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
