/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:pinball';
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
  function parkedBall(){return {x:533,y:520,vx:0,vy:0};}
  var ctx=surface.getContext('2d'),ball=parkedBall(),inLauncher=true,launchPulse=0,launched=false,lives=3,score=0,left=false,right=false,leftAngle=.38,rightAngle=.38,sceneTime=0,particles=[],trail=[],combo=0,lastHit=-10;
  var bumpers=[{x:205,y:175,r:31,glow:0},{x:395,y:175,r:31,glow:0},{x:300,y:285,r:36,glow:0},{x:105,y:355,r:19,glow:0},{x:475,y:355,r:19,glow:0}];
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function snapshot(){return null;}function restore(){}
  function undo(){if(blocked()||!launched){status('先发球；卡球时可复位，复位会消耗一球。');return;}drain('复位消耗一球。');}
  function launch(){if(blocked()||launched)return;ball=parkedBall();ball.vy=-740;inLauncher=true;launchPulse=.28;launched=true;trail=[];status('弹珠沿右侧发球槽上行，出槽后用左右挡板接球。');sound(660);render();}
  function drain(note){if(!launched)return;launched=false;lives--;left=right=false;trail=[];combo=0;ball=parkedBall();inLauncher=true;launchPulse=0;render();if(lives<=0){record(score,false);finish('三球结束，获得 '+score+' 分。');}else status((note||'弹珠落出底部。')+'还剩 '+lives+' 球，点击发球继续。');}
  function scoreHit(b){if(b.glow>0)return;b.glow=.18;combo=sceneTime-lastHit<1.6?combo+1:1;lastHit=sceneTime;score+=(b.r>25?100:50)*Math.min(4,combo);if(!reduce)for(var i=0;i<12;i++){var a=i*Math.PI/6;particles.push({x:b.x,y:b.y,vx:Math.cos(a)*100,vy:Math.sin(a)*100,life:.55});}sound(500+combo*70);status('命中弹簧柱！'+(combo>1?'连续 '+combo+' 次 · ':'')+'当前 '+score+' 分。');}
  function segment(ax,ay,bx,by,boost){var dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((ball.x-ax)*dx+(ball.y-ay)*dy)/(dx*dx+dy*dy))),px=ax+t*dx,py=ay+t*dy,nx=ball.x-px,ny=ball.y-py,d=Math.hypot(nx,ny);if(d>=17)return;nx=d?nx/d:0;ny=d?ny/d:-1;ball.x=px+nx*17;ball.y=py+ny*17;var dot=ball.vx*nx+ball.vy*ny;if(dot<0){ball.vx-=1.82*dot*nx;ball.vy-=1.82*dot*ny;if(boost){ball.vy=Math.min(ball.vy,-420-150*t);ball.vx+=(300-ball.x)*1.5;}}}
  function step(dt){if(blocked())return;sceneTime+=dt;launchPulse=Math.max(0,launchPulse-dt);var speed=15*dt;leftAngle+=( (left?-.43:.38)-leftAngle)*Math.min(1,speed);rightAngle+=((right?-.43:.38)-rightAngle)*Math.min(1,speed);bumpers.forEach(function(b){b.glow=Math.max(0,b.glow-dt);});
    if(launched){var sub=dt/6;for(var k=0;k<6;k++){
      ball.vy+=({easy:370,normal:440,hard:510}[activeOption]||440)*sub;ball.x+=ball.vx*sub;ball.y+=ball.vy*sub;
      // 发球槽隔离主场碰撞；到上端开口后才转入主场，避免刚发射就撞上右侧目标。
      if(inLauncher){ball.x=533;if(ball.y<=115){inLauncher=false;ball.vx=-230;ball.vy=-190;status('已进入主场，按住左右挡板把球送回上方。');}else continue;}
      if(ball.x<51){ball.x=51;ball.vx=Math.abs(ball.vx)*.9;}var rightBound=ball.y>125?503:549;if(ball.x>rightBound){ball.x=rightBound;ball.vx=-Math.abs(ball.vx)*.9;}if(ball.y<53){ball.y=53;ball.vy=Math.abs(ball.vy)*.92;}
      bumpers.forEach(function(b){var nx=ball.x-b.x,ny=ball.y-b.y,d=Math.hypot(nx,ny),r=b.r+10;if(d<r){nx=d?nx/d:0;ny=d?ny/d:1;ball.x=b.x+nx*r;ball.y=b.y+ny*r;var dot=ball.vx*nx+ball.vy*ny;if(dot<0){ball.vx-=2*dot*nx;ball.vy-=2*dot*ny;}ball.vx+=nx*160;ball.vy+=ny*160;scoreHit(b);}});
      segment(47,395,167,493,false);segment(503,395,433,493,false);
      segment(173,510,173+116*Math.cos(leftAngle),510+116*Math.sin(leftAngle),left);
      segment(427,510,427-116*Math.cos(rightAngle),510+116*Math.sin(rightAngle),right);
      var velocity=Math.hypot(ball.vx,ball.vy);if(velocity>1050){ball.vx*=1050/velocity;ball.vy*=1050/velocity;}
      if(ball.y>598){drain();break;}
    }if(!reduce){trail.push({x:ball.x,y:ball.y});if(trail.length>12)trail.shift();}}
    particles=particles.filter(function(p){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;return p.life>0;});render();
  }
  function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
  function drawLine(ax,ay,bx,by,color,width){ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();}
  function drawCircle(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  // 逻辑坐标始终600×600；仅提升画布背板像素，命中与物理坐标不随DPR变化。
  function prepareCanvas(){var box=surface.getBoundingClientRect(),dpr=Math.min(3,window.devicePixelRatio||1),w=Math.max(1,Math.round(box.width*dpr)),h=Math.max(1,Math.round(box.height*dpr));if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h;}ctx.setTransform(w/600,0,0,h/600,0,0);}
  function render(){prepareCanvas();ctx.clearRect(0,0,600,600);ctx.fillStyle='#e9ede9';ctx.fillRect(0,0,600,600);rounded(30,25,540,590,36,'#ccd6d0');rounded(40,35,520,580,30,'#edf3ec','#a1b5a6');
    // 独立发球槽与弹簧承托：视觉边界对应主场右边界503和球心533。
    rounded(518,130,30,407,14,'#dce7df');drawLine(513,136,513,570,'#96ae9e',5);drawLine(551,147,551,569,'#b4c5b8',3);
    ctx.beginPath();ctx.moveTo(533,129);ctx.quadraticCurveTo(538,87,503,75);ctx.strokeStyle='#bacdc0';ctx.lineWidth=3;ctx.stroke();
    var springTop=540+launchPulse/.28*10;drawLine(523,springTop-7,543,springTop-7,'#a78d61',5);
    ctx.beginPath();ctx.moveTo(533,springTop);for(var coil=0;coil<8;coil++)ctx.lineTo(coil%2?541:525,springTop+(570-springTop)*(coil+1)/8);ctx.lineTo(533,574);ctx.strokeStyle='#889a90';ctx.lineWidth=2;ctx.stroke();rounded(522,575,22,12,5,'#cfb77f');

    for(var i=0;i<15;i++){drawCircle(82+(i%5)*109,96+Math.floor(i/5)*112,2,'#c7d7c7');}
    ctx.textAlign='center';ctx.font='600 20px system-ui';ctx.fillStyle='#60786a';ctx.fillText('STAR GARDEN',300,86);ctx.font='14px system-ui';ctx.fillText('弹簧柱连击，最高四倍',300,112);
    bumpers.forEach(function(b,i){drawCircle(b.x,b.y+5,b.r+5,'#c7d4c7');drawCircle(b.x,b.y,b.r+4,b.glow?'#eccf75':'#a8beb0');drawCircle(b.x,b.y,b.r,i<3?'#829b7b':'#c19969');drawCircle(b.x-5,b.y-6,b.r*.72,i<3?'#b6c9a2':'#ead5a5');drawCircle(b.x,b.y,b.r*.4,'#f9f5df');if(b.glow&&!reduce){ctx.beginPath();ctx.arc(b.x,b.y,b.r+10+(1-b.glow/.18)*22,0,Math.PI*2);ctx.strokeStyle='#cda354';ctx.lineWidth=3;ctx.stroke();}ctx.fillStyle='#526e5d';ctx.font='600 '+(b.r>25?19:13)+'px system-ui';ctx.fillText(b.r>25?'100':'50',b.x,b.y+6);});
    drawLine(47,395,167,493,'#a0bcb1',18);drawLine(503,395,433,493,'#a0bcb1',18);drawLine(47,390,167,488,'#f9f9e7',5);drawLine(503,390,433,488,'#f9f9e7',5);
    drawLine(173,514,173+116*Math.cos(leftAngle),514+116*Math.sin(leftAngle),'#9f7a5b',20);drawLine(427,514,427-116*Math.cos(rightAngle),514+116*Math.sin(rightAngle),'#9f7a5b',20);drawLine(173,508,173+116*Math.cos(leftAngle),508+116*Math.sin(leftAngle),left?'#e6bd68':'#e5d0a3',15);drawLine(427,508,427-116*Math.cos(rightAngle),508+116*Math.sin(rightAngle),right?'#e6bd68':'#e5d0a3',15);drawCircle(173,509,7,'#f9f2d4');drawCircle(427,509,7,'#f9f2d4');
    trail.forEach(function(p,i){drawCircle(p.x,p.y,8*i/12,'#a8b5c255');});particles.forEach(function(p){ctx.globalAlpha=p.life/.55;drawCircle(p.x,p.y,3,'#bf8f3e');ctx.globalAlpha=1;});
    drawCircle(ball.x+2,ball.y+5,10,'#9ba89c55');var g=ctx.createRadialGradient(ball.x-3,ball.y-4,1,ball.x,ball.y,11);g.addColorStop(0,'#fff');g.addColorStop(.5,'#e7edf3');g.addColorStop(1,'#7e94a5');drawCircle(ball.x,ball.y,10,g);
    ctx.font='15px system-ui';ctx.fillStyle='#6b8171';ctx.fillText(launched?(inLauncher?'发球槽上行中':'按住挡板，把球送回上方'):'右侧弹簧槽待发球',300,578);hud(score,'剩余 '+lives+' 球 · 连击 '+combo,'右侧槽发球 · 三球挑战 · 复位消耗一球');document.getElementById('ball-launch').disabled=launched||ended;announce('弹珠台，得分'+score+'，剩余'+lives+'球。'+(!launched?'球在右侧弹簧槽待发。':inLauncher?'正在沿发球槽上行。':'球在主场内。')+'空格发球，左右方向键或A、D控制挡板。');}
  function keyDown(e){if(blocked()||editing(e)||e.repeat)return;if(e.key===' '||e.code==='Space'){e.preventDefault();launch();}else if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a'){e.preventDefault();left=true;}else if(e.key==='ArrowRight'||e.key.toLowerCase()==='d'){e.preventDefault();right=true;}}
  function keyUp(e){if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a'){e.preventDefault();left=false;}if(e.key==='ArrowRight'||e.key.toLowerCase()==='d'){e.preventDefault();right=false;}}
  document.addEventListener('keydown',keyDown);document.addEventListener('keyup',keyUp);
  ['left','right'].forEach(function(id){var button=document.getElementById(id);button.addEventListener('pointerdown',function(e){if(blocked())return;e.preventDefault();if(id==='left')left=true;else right=true;button.setPointerCapture(e.pointerId);});['pointerup','pointercancel','lostpointercapture'].forEach(function(type){button.addEventListener(type,function(){if(id==='left')left=false;else right=false;});});});onPause=function(){left=right=false;};
  bind('ball-launch',launch);function restart(){resetState();commonReset();launched=false;lives=3;score=0;combo=0;lastHit=-10;sceneTime=0;left=right=false;leftAngle=rightAngle=.38;ball=parkedBall();inLauncher=true;launchPulse=0;trail=[];particles=[];bumpers.forEach(function(b){b.glow=0;});renderStages();render();status('点击发球，按住左右按钮控制挡板；键盘可用空格与左右方向键。');}
  var frameTime=Date.now();function frame(){var now=Date.now(),dt=Math.min(.032,Math.max(0,(now-frameTime)/1000));frameTime=now;if(!blocked())step(dt);requestAnimationFrame(frame);}requestAnimationFrame(frame);stages(1);restart();

  onStart=function(){status('点击发球，按住左右按钮控制挡板；键盘可用空格与左右方向键。复位会消耗一球。');};
  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();surface.focus();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
