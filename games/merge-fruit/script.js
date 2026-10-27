/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:merge-fruit';
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

  var balls=[],aim=300,next=1,score=0,cooldown=0,danger=0,serial=0;
  var colors=['','#d7988f','#deba71','#9cb58b','#7fa6b5','#aa96bc','#e0a275','#799c8e','#c7868c','#8b9abf','#b6c579'];
  function radius(l){return 12+l*6;}
  function spawn(){if(blocked()||cooldown>0)return;balls.push({id:serial++,x:aim,y:105,vx:0,vy:0,l:next,age:0});next=1+Math.floor(Math.random()*3);cooldown={easy:.5,normal:.65,hard:.8}[activeOption]||.65;status('同级球相碰合成；留意顶部虚线。');render();}
  function physics(dt){var sub=dt/4;for(var k=0;k<4;k++){balls.forEach(function(b){b.age+=sub;b.vy+=650*sub;b.x+=b.vx*sub;b.y+=b.vy*sub;var r=radius(b.l);if(b.x<36+r){b.x=36+r;b.vx=Math.abs(b.vx)*.4;}if(b.x>564-r){b.x=564-r;b.vx=-Math.abs(b.vx)*.4;}if(b.y>552-r){b.y=552-r;b.vy=-Math.abs(b.vy)*.18;b.vx*=.96;}});var merged=false;for(var i=0;i<balls.length;i++)for(var j=i+1;j<balls.length;j++){var a=balls[i],b=balls[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),r=radius(a.l)+radius(b.l);if(d>=r)continue;if(a.l===b.l&&a.l<10){var c={id:serial++,x:(a.x+b.x)/2,y:(a.y+b.y)/2,vx:(a.vx+b.vx)/2,vy:-45,l:a.l+1,age:Math.min(a.age,b.age)};balls.splice(j,1);balls.splice(i,1,c);score+=c.l*10;burst(c.x,c.y,colors[c.l]);merged=true;break;}var nx=d?dx/d:1,ny=d?dy/d:0,p=(r-d)/2;a.x-=nx*p;a.y-=ny*p;b.x+=nx*p;b.y+=ny*p;var speed=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(speed<0){a.vx+=speed*.55*nx;a.vy+=speed*.55*ny;b.vx-=speed*.55*nx;b.vy-=speed*.55*ny;}}if(merged){render();break;}}}
  function step(dt){cooldown=Math.max(0,cooldown-dt);physics(dt);var risk=balls.some(function(b){return b.age>1.5&&b.y-radius(b.l)<135;});danger=risk?danger+dt:0;if(danger>=2){record(score,false);finish('球堆越过警戒线，本局 '+score+' 分。');render();}}
  function render(){hud(score,'球数 '+balls.length+' · 最高 '+Math.max(1,...balls.map(function(b){return b.l;}))+' 级','同级相碰 · 十级封顶');}
  function restart(){begin();balls=[];aim=300;next=1;score=0;cooldown=0;danger=0;serial=0;render();status('拖动调整位置，松手投放；同级球会自动合并。');}
  function drawBall(x,y,l,r){ctx.shadowColor='#25304724';ctx.shadowBlur=reduce?0:7;circle(x,y,r,colors[l]);ctx.shadowBlur=0;circle(x-r*.25,y-r*.28,r*.18,'#ffffff88');text(l,x,y,Math.max(13,r*.65),'#fff');}
  function draw(){base('同级合并，越长越大','拖动瞄准 · 松手投放');rect(32,130,536,428,'#e9edf3',20);rect(40,134,520,418,'#fff',15);ctx.setLineDash([8,7]);line(44,135,556,135,danger?coral:'#c6cdd9',2);ctx.setLineDash([]);balls.forEach(function(b){drawBall(b.x,b.y,b.l,radius(b.l));});drawBall(aim,100,next,radius(next));line(aim,120,aim,145,'#b8c1d1',2);text(danger?'警戒 '+Math.max(0,2-danger).toFixed(1)+' 秒':'下一球 '+next+' 级 · 得分 '+score,300,580,17,danger?coral:muted);}
  canvas.addEventListener('pointermove',function(e){aim=Math.max(40+radius(next),Math.min(560-radius(next),point(e).x));});canvas.addEventListener('pointerdown',function(e){if(blocked())return;canvas.setPointerCapture(e.pointerId);aim=Math.max(40+radius(next),Math.min(560-radius(next),point(e).x));});canvas.addEventListener('pointerup',function(){spawn();});listen('drop',spawn);keyInput(function(e){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();aim=Math.max(70,Math.min(530,aim+(e.key==='ArrowLeft'?-20:20)));}if(e.key===' '){e.preventDefault();spawn();}});restart();

  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
