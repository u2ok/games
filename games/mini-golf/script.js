/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:mini-golf';
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
  var ctx=surface.getContext('2d'),ball={x:85,y:505,vx:0,vy:0},hole={x:510,y:90},walls=[],sand=[],water=[],aim=null,angle=-Math.PI/4,power=.5,moving=false,score=0,trail=[],particles=[],sceneTime=0,lastStroke=null,settling=0,sinking=0;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var courses=[
    {walls:[],sand:[{x:220,y:240,w:150,h:100}],water:[],hole:[500,100],start:[95,500],par:2},
    {walls:[{x:275,y:200,w:24,h:280}],sand:[],water:[],hole:[490,110],start:[105,490],par:3},
    {walls:[{x:60,y:275,w:365,h:24}],sand:[{x:440,y:235,w:90,h:120}],water:[],hole:[115,110],start:[115,490],par:4},
    {walls:[{x:210,y:45,w:24,h:335},{x:370,y:230,w:24,h:325}],sand:[],water:[],hole:[480,100],start:[100,490],par:5},
    {walls:[{x:190,y:180,w:220,h:24}],sand:[{x:340,y:365,w:150,h:90}],water:[{x:230,y:265,w:140,h:105}],hole:[490,105],start:[100,495],par:4},
    {walls:[{x:150,y:160,w:24,h:270},{x:425,y:160,w:24,h:270},{x:250,y:285,w:100,h:24}],sand:[{x:205,y:400,w:190,h:80}],water:[{x:245,y:105,w:110,h:80}],hole:[300,240],start:[300,520],par:4}
  ],par=3;
  function inside(p,r){return p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;}
  function snapshot(){return {ball:clone(ball),score:score,angle:angle,power:power};}function restore(v){ball=v.ball;ball.vx=ball.vy=0;score=v.score;angle=v.angle;power=v.power;moving=false;sinking=0;aim=null;trail=[];}
  function undo(){if(blocked()||moving||!history.length){status(moving?'小球还在滚动，停稳后可撤销。':'还没有可撤销的击球。');return;}assisted=true;restore(history.pop());moves=Math.max(0,moves-1);status('已回到上一杆出球点；本局记为练习局。');render();}
  function shoot(a,p){if(blocked()||moving)return false;if(p<.04){aim=null;render();status('已取消击球。');return false;}checkpoint();lastStroke={x:ball.x,y:ball.y};angle=a;power=Math.max(.05,Math.min(1,p));ball.vx=Math.cos(angle)*(120+power*620);ball.vy=Math.sin(angle)*(120+power*620);moving=true;settling=0;score++;moves=score;aim=null;trail=[];sound(450);status('第 '+score+' 杆，小球滚动中；停稳后再击球。');render();return true;}
  function collide(rect){var px=Math.max(rect.x,Math.min(rect.x+rect.w,ball.x)),py=Math.max(rect.y,Math.min(rect.y+rect.h,ball.y)),dx=ball.x-px,dy=ball.y-py,d=Math.hypot(dx,dy);if(d>=9)return;if(d===0){var options=[{d:Math.abs(ball.x-rect.x),x:-1,y:0},{d:Math.abs(ball.x-rect.x-rect.w),x:1,y:0},{d:Math.abs(ball.y-rect.y),x:0,y:-1},{d:Math.abs(ball.y-rect.y-rect.h),x:0,y:1}].sort(function(a,b){return a.d-b.d;});dx=options[0].x;dy=options[0].y;d=1;px=dx<0?rect.x:dx>0?rect.x+rect.w:ball.x;py=dy<0?rect.y:dy>0?rect.y+rect.h:ball.y;}var nx=dx/d,ny=dy/d;ball.x=px+nx*9;ball.y=py+ny*9;var dot=ball.vx*nx+ball.vy*ny;if(dot<0){ball.vx-=1.75*dot*nx;ball.vy-=1.75*dot*ny;}}
  function step(dt){if(blocked())return;sceneTime+=dt;if(sinking>0){sinking=Math.max(0,sinking-dt);if(!sinking){moving=false;if(!assisted)record(score,true);complete('第 '+(stageIndex+1)+' 洞 · '+score+' 杆完成，标准杆 '+par+'。');}render();return;}if(moving){for(var k=0;k<5;k++){var sub=dt/5;ball.x+=ball.vx*sub;ball.y+=ball.vy*sub;var rough=sand.some(function(r){return inside(ball,r);}),drag=Math.exp(-(rough?({easy:3,normal:3.7,hard:4.4}[activeOption]||3.7):1.1)*sub);ball.vx*=drag;ball.vy*=drag;
        if(ball.x<45){ball.x=45;ball.vx=Math.abs(ball.vx)*.8;}if(ball.x>555){ball.x=555;ball.vx=-Math.abs(ball.vx)*.8;}if(ball.y<45){ball.y=45;ball.vy=Math.abs(ball.vy)*.8;}if(ball.y>555){ball.y=555;ball.vy=-Math.abs(ball.vy)*.8;}walls.forEach(collide);
        if(water.some(function(r){return inside(ball,r);})){ball.x=lastStroke.x;ball.y=lastStroke.y;ball.vx=ball.vy=0;moving=false;score++;moves=score;trail=[];status('小球落水，罚一杆，回到上次出杆点。');break;}
        var distance=Math.hypot(ball.x-hole.x,ball.y-hole.y),speed=Math.hypot(ball.vx,ball.vy);if(distance<({easy:19,normal:15,hard:12}[activeOption]||15)&&speed<({easy:210,normal:180,hard:145}[activeOption]||180)){ball.x=hole.x;ball.y=hole.y;ball.vx=ball.vy=0;sinking=reduce?.01:.55;status('进洞！小球已稳稳落入洞口。');break;}
      }if(moving&&!sinking&&Math.hypot(ball.vx,ball.vy)<12){ball.vx=ball.vy=0;moving=false;status('小球已停稳。向后拖动小球瞄准，松开出杆。');}if(!reduce){trail.push({x:ball.x,y:ball.y});if(trail.length>22)trail.shift();}}
    render();
  }
  function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
  function drawLine(ax,ay,bx,by,color,width){ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();}
  function drawCircle(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  // 逻辑坐标始终600×600；仅提升画布背板像素，命中与物理坐标不随DPR变化。
  function prepareCanvas(){var box=surface.getBoundingClientRect(),dpr=Math.min(3,window.devicePixelRatio||1),w=Math.max(1,Math.round(box.width*dpr)),h=Math.max(1,Math.round(box.height*dpr));if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h;}ctx.setTransform(w/600,0,0,h/600,0,0);}
  function render(){prepareCanvas();ctx.clearRect(0,0,600,600);ctx.fillStyle='#e7ecd9';ctx.fillRect(0,0,600,600);rounded(25,25,550,550,25,'#a3b58a','#839d74');rounded(36,36,528,528,18,'#ceddaf');ctx.save();ctx.beginPath();ctx.roundRect(36,36,528,528,18);ctx.clip();for(var i=0;i<7;i++){ctx.fillStyle=i%2?'#c8d8a5':'#d1dfb3';ctx.fillRect(36+i*78,36,78,528);}sand.forEach(function(r){rounded(r.x,r.y,r.w,r.h,20,'#e5d3a2');for(var i=0;i<35;i++){var x=r.x+8+(i*29)%(r.w-16),y=r.y+8+(i*17)%(r.h-16);drawCircle(x,y,1,'#bca473');}});water.forEach(function(r){rounded(r.x,r.y,r.w,r.h,18,'#8ab8c0','#709da6');for(var i=0;i<4;i++){var y=r.y+18+i*20;drawLine(r.x+14,y,r.x+r.w-14,y,'#b2d5d8',2);}});ctx.restore();walls.forEach(function(r){rounded(r.x+2,r.y+5,r.w,r.h,6,'#8f9e77');rounded(r.x,r.y,r.w,r.h,6,'#f3ecd4','#b7b48d');});
    drawCircle(hole.x+2,hole.y+3,17,'#80966a');drawCircle(hole.x,hole.y,13,'#3b5446');drawCircle(hole.x-2,hole.y-2,8,'#253c34');drawLine(hole.x,hole.y-2,hole.x,hole.y-65,'#f5f3de',3);ctx.beginPath();ctx.moveTo(hole.x,hole.y-65);ctx.lineTo(hole.x+34,hole.y-54);ctx.lineTo(hole.x,hole.y-43);ctx.closePath();ctx.fillStyle='#bc6e58';ctx.fill();
    if(!moving&&!ended){var length=40+power*115;ctx.setLineDash([5,7]);drawLine(ball.x,ball.y,ball.x+Math.cos(angle)*length,ball.y+Math.sin(angle)*length,'#627c5b',3);ctx.setLineDash([]);drawCircle(ball.x+Math.cos(angle)*length,ball.y+Math.sin(angle)*length,4,'#627c5b');if(aim){drawLine(ball.x,ball.y,aim.x,aim.y,'#b49358',5);drawCircle(aim.x,aim.y,6,'#f3d798');}}
    if(!reduce)trail.forEach(function(p,i){drawCircle(p.x,p.y,4*i/22,'#f8fbec55');});drawCircle(ball.x+2,ball.y+4,9,'#82937055');var g=ctx.createRadialGradient(ball.x-3,ball.y-3,1,ball.x,ball.y,9);g.addColorStop(0,'#fff');g.addColorStop(1,'#c6d0c3');drawCircle(ball.x,ball.y,sinking?8*Math.min(1,sinking/.55):8,g);if(sinking&&!reduce){ctx.beginPath();ctx.arc(hole.x,hole.y,18+(1-sinking/.55)*25,0,Math.PI*2);ctx.strokeStyle='#f8efb0';ctx.lineWidth=3;ctx.stroke();}ctx.textAlign='left';ctx.font='600 16px system-ui';ctx.fillStyle='#627653';ctx.fillText('HOLE '+String(stageIndex+1).padStart(2,'0'),47,588);ctx.textAlign='right';ctx.fillText('PAR '+par,553,588);hud(score,'第 '+(stageIndex+1)+' 洞 · 标准杆 '+par+' · '+(moving?'滚动中':'力度 '+Math.round(power*100)+'%')+(assisted?' · 练习局':''),'向后拖动瞄准 · 松开击球 · 水域罚杆');document.getElementById('shoot').disabled=moving||ended;document.getElementById('undo').disabled=moving||!history.length;announce('高尔夫第'+(stageIndex+1)+'洞，'+score+'杆，'+(moving?'滚动中':'可以击球')+'。方向键瞄准、上下调力、空格击球。');}
  surface.addEventListener('pointerdown',function(e){if(blocked()||moving||e.button>0)return;var p=pos(e);if(Math.hypot(p.x-ball.x,p.y-ball.y)>40){status('请从小球附近开始向后拖动；也可用方向键调整后点击球。');return;}aim={id:e.pointerId,x:p.x,y:p.y};surface.setPointerCapture(e.pointerId);e.preventDefault();});surface.addEventListener('pointermove',function(e){if(!aim||blocked()||aim.id!==e.pointerId)return;var p=pos(e),dx=ball.x-p.x,dy=ball.y-p.y;aim.x=p.x;aim.y=p.y;angle=Math.atan2(dy,dx);power=Math.min(1,Math.hypot(dx,dy)/160);render();});surface.addEventListener('pointerup',function(e){if(!aim||aim.id!==e.pointerId)return;var p=pos(e),dx=ball.x-p.x,dy=ball.y-p.y;aim=null;shoot(Math.atan2(dy,dx),Math.min(1,Math.hypot(dx,dy)/160));});surface.addEventListener('pointercancel',function(){aim=null;render();status('手势已取消，没有击球。');});onPause=function(){aim=null;};
  function keyDown(e){if(blocked()||moving||editing(e))return;var handled=true;if(e.key==='ArrowLeft')angle-=.07;else if(e.key==='ArrowRight')angle+=.07;else if(e.key==='ArrowUp')power=Math.min(1,power+.04);else if(e.key==='ArrowDown')power=Math.max(.05,power-.04);else if(e.key===' '||e.code==='Space'){if(!e.repeat)shoot(angle,power);}else handled=false;if(handled){e.preventDefault();render();}}document.addEventListener('keydown',keyDown);bind('shoot',function(){shoot(angle,power);});
  bind('hint',function(){assisted=true;var direct=Math.atan2(hole.y-ball.y,hole.x-ball.x);angle=direct;power=Math.min(.9,Math.max(.15,Math.hypot(hole.x-ball.x,hole.y-ball.y)/620));render();status('已朝向洞口并给出参考力度；虚线不计算墙壁反弹，注意避开障碍、沙地和水域。');});
  function restart(){resetState();commonReset();var c=courses[stageIndex%courses.length],mirror=stageIndex>=courses.length;function rect(r){return {x:mirror?600-r.x-r.w:r.x,y:r.y,w:r.w,h:r.h};}walls=c.walls.map(rect);sand=c.sand.map(rect);water=c.water.map(rect);if(activeOption==='hard'&&stageIndex===0)water=[{x:250,y:275,w:110,h:80}];ball={x:mirror?600-c.start[0]:c.start[0],y:c.start[1],vx:0,vy:0};hole={x:mirror?600-c.hole[0]:c.hole[0],y:c.hole[1]};par=c.par+(activeOption==='hard'?1:0);score=0;moving=false;sinking=0;aim=null;trail=[];lastStroke=null;angle=Math.atan2(hole.y-ball.y,hole.x-ball.x);power=.5;sceneTime=0;renderStages();render();status('从小球向后拖动瞄准，松开击球；拖回球附近可取消。先留意沙地和水域。');}
  var frameTime=Date.now();function frame(){var now=Date.now(),dt=Math.min(.032,Math.max(0,(now-frameTime)/1000));frameTime=now;if(!blocked())step(dt);requestAnimationFrame(frame);}requestAnimationFrame(frame);stages(12);restart();

  onStart=function(){status('从小球向后拖动瞄准，松开击球；拖回球附近可取消。小球停稳后再出杆。');};
  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();surface.focus();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
