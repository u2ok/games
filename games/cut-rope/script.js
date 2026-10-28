/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:cut-rope';
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
  var previous=0;
  function frame(now){var dt=previous?Math.min(.035,(now-previous)/1000):0;previous=now;if(!blocked())tick(dt);else if(ended&&!paused&&!dialog.open){effects(dt);decor(dt);}draw();drawEffects();requestAnimationFrame(frame);}
  requestAnimationFrame(frame);

  var cutPoint=null,cutEnd=null,trail=[],rings=[],intake=0;
  var candy={},anchor={},rope=210,angle=0,omega=0,attached=true,stars=[],cup={},obstacles=[],score=0,cutFlash=0;
  function configure(){anchor={x:180+(stageIndex%3)*90,y:95};rope=180+Math.floor(stageIndex/3)*12;angle=-.65;omega=0;attached=true;candy={x:0,y:0,vx:0,vy:0};cup={x:240+(stageIndex%3)*65,y:510,w:100};stars=[{x:cup.x,y:420,got:false},{x:cup.x-45,y:340,got:false},{x:anchor.x+70,y:260,got:false}];obstacles=stageIndex%2?[{x:90,y:385,w:110,h:16}]:[];score=0;cutFlash=0;cutPoint=cutEnd=null;trail=[];rings=[];intake=0;position();}
  function position(){candy.x=anchor.x+Math.sin(angle)*rope;candy.y=anchor.y+Math.cos(angle)*rope;}
  function cut(){if(blocked()||!attached)return;cutPoint={x:(anchor.x+candy.x)/2,y:(anchor.y+candy.y)/2};cutEnd={x:candy.x,y:candy.y};attached=false;candy.vx=Math.cos(angle)*rope*omega;candy.vy=-Math.sin(angle)*rope*omega;cutFlash=.55;sound(800);status('绳已剪断，糖果正沿惯性下落。');}
  function decor(dt){
    cutFlash=Math.max(0,cutFlash-dt);intake=Math.max(0,intake-dt);
    rings=rings.filter(function(f){f.t-=dt;return f.t>0;});
    if(!reduce&&!attached&&!ended){trail.push({x:candy.x,y:candy.y,t:.23});if(trail.length>12)trail.shift();}
    trail=trail.filter(function(p){p.t-=dt;return p.t>0;});
  }
  function step(dt){decor(dt);if(attached){omega+=-520/rope*Math.sin(angle)*dt;omega*=Math.pow(.998,dt*60);angle+=omega*dt;position();}else{candy.vy+=520*dt;candy.x+=candy.vx*dt;candy.y+=candy.vy*dt;if(candy.x<20||candy.x>580){candy.x=Math.max(20,Math.min(580,candy.x));candy.vx*=-.65;}obstacles.forEach(function(r){if(candy.vy>0&&candy.x>r.x-12&&candy.x<r.x+r.w+12&&candy.y+14>=r.y&&candy.y-candy.vy*dt+14<r.y+5){candy.y=r.y-14;candy.vy*=-.55;if(!reduce)rings.push({x:candy.x,y:r.y,t:.35,life:.35,c:'#9ba77e'});}});if(candy.y>=cup.y-12&&candy.y<=cup.y+30&&Math.abs(candy.x-cup.x)<cup.w/2-12&&candy.vy>0){score+=100;intake=.65;if(!reduce)rings.push({x:cup.x,y:cup.y+10,t:.65,life:.65,c:'#78a18b'});burst(candy.x,candy.y,gold);win('糖果入杯！收集 '+stars.filter(function(s){return s.got;}).length+'/3 颗星。',score,false);render();}else if(candy.y>620){finish('糖果错过收集杯。重试时换一个剪断时机。');}}stars.forEach(function(s){if(!s.got&&Math.hypot(s.x-candy.x,s.y-candy.y)<30){s.got=true;score+=30;if(!reduce)rings.push({x:s.x,y:s.y,t:.65,life:.65,c:'#d7aa46',label:'+30'});burst(s.x,s.y,gold);render();}});}
  function render(){hud(score,'第 '+(stageIndex+1)+' 关 · 星星 '+stars.filter(function(s){return s.got;}).length+'/3','剪绳后保留摆动惯性');}
  function restart(){begin();configure();if(activeOption==='easy')cup.w=130;if(activeOption==='hard')cup.w=76;renderStages();render();status('观察摆动，等糖果向收集杯方向运动时剪绳；星星为额外奖励。');}
  function star(x,y,r,fill){ctx.beginPath();for(var k=0;k<10;k++){var a=k*Math.PI/5-Math.PI/2,rr=k%2?r*.46:r;k?ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr):ctx.moveTo(x,y-r);}ctx.closePath();ctx.fillStyle=fill||'#efbc51';ctx.fill();ctx.strokeStyle='#bd8d35';ctx.lineWidth=1.5;ctx.stroke();}
  function candyArt(x,y,rotation,scale){
    ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(scale,scale);
    // 包装纸与糖体使用相同中心；装饰不参与半径14的物理碰撞。
    ctx.beginPath();ctx.moveTo(-17,-6);ctx.lineTo(-29,-13);ctx.lineTo(-26,0);ctx.lineTo(-29,13);ctx.lineTo(-17,6);ctx.closePath();ctx.fillStyle='#e9a99a';ctx.fill();
    ctx.beginPath();ctx.moveTo(17,-6);ctx.lineTo(29,-13);ctx.lineTo(26,0);ctx.lineTo(29,13);ctx.lineTo(17,6);ctx.closePath();ctx.fillStyle='#e9a99a';ctx.fill();
    circle(1,3,20,'#6f533d22');circle(0,0,20,'#d9786b');
    ctx.save();ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.clip();
    for(var i=-2;i<=2;i++)line(i*15-16,-24,i*15+17,24,'#fff0d6',7);ctx.restore();
    ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.strokeStyle='#b65f54';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.ellipse(-6,-9,8,4,-.4,0,Math.PI*2);ctx.fillStyle='#ffffff99';ctx.fill();ctx.restore();
  }
  function ropeStroke(ax,ay,bx,by,width){line(ax+1,ay+1,bx+1,by+1,'#8f7050',width||5);line(ax-1,ay,bx-1,by,'#e5c99a',2);}
  function draw(){
    ctx.clearRect(0,0,600,600);rect(0,0,600,600,'#f2eddf',0);
    // 柔和纸面背景、固定圆点与底座，让摆动轨迹保持清晰。
    for(var i=0;i<42;i++)circle(25+(i*131)%553,90+(i*79)%465,1.4,'#dbd2bc');
    rect(20,18,560,53,'#fffbef',12);text('第 '+(stageIndex+1)+' 关 · 糖果投递',39,38,18,'#775e48','left');text('把握摆动时机，星星为额外奖励',39,58,12,'#88765e','left');
    stars.forEach(function(s,i){
      if(s.got){ctx.globalAlpha=.3;star(s.x,s.y,12,'#dfd5b8');ctx.globalAlpha=1;return;}
      var pulse=reduce?0:Math.sin(anim*2.5+i)*2;circle(s.x,s.y,23+pulse,'#edcc6922');star(s.x,s.y,17);
      line(s.x-4,s.y-7,s.x,s.y-9,'#fff5c9',2);
    });
    // 收集杯后缘先画，糖果置于杯身前缘之后，产生真正落入的层次。
    rect(cup.x-cup.w/2-10,cup.y+42,cup.w+20,10,'#b6b397',5);
    ctx.beginPath();ctx.ellipse(cup.x,cup.y+4,cup.w/2,11,0,0,Math.PI*2);ctx.fillStyle='#567b6c';ctx.fill();
    ctx.beginPath();ctx.ellipse(cup.x,cup.y+4,cup.w/2-6,7,0,0,Math.PI*2);ctx.fillStyle='#304f47';ctx.fill();
    obstacles.forEach(function(r){rect(r.x+2,r.y+4,r.w,r.h,'#7e725c22',5);rect(r.x,r.y,r.w,r.h,'#a1ad87',5);line(r.x+6,r.y+3,r.x+r.w-6,r.y+3,'#d5dfbc',2);for(var j=15;j<r.w;j+=28)circle(r.x+j,r.y+9,2,'#788564');});
    // 顶部吊钉与纤维绳索。剪断后的两截留在切点附近回弹，不再跟随糖果连成整绳。
    circle(anchor.x+1,anchor.y+3,12,'#775e4622');circle(anchor.x,anchor.y,11,'#a18c67');circle(anchor.x,anchor.y,6,'#e9d5a7');line(anchor.x-3,anchor.y,anchor.x+3,anchor.y,'#8d7855',2);
    if(attached)ropeStroke(anchor.x,anchor.y,candy.x,candy.y,5);
    else if(cutFlash&&cutPoint&&!reduce){
      var t=1-cutFlash/.55;ctx.globalAlpha=1-t;
      ropeStroke(anchor.x,anchor.y,cutPoint.x-10*t,cutPoint.y-28*t,4);
      ropeStroke(cutPoint.x+10*t,cutPoint.y+18*t,cutEnd.x+20*t,cutEnd.y+25*t,4);
      line(cutPoint.x-9,cutPoint.y-8,cutPoint.x+9,cutPoint.y+8,'#faf7e9',3);line(cutPoint.x+9,cutPoint.y-8,cutPoint.x-9,cutPoint.y+8,'#faf7e9',3);ctx.globalAlpha=1;
    }
    if(!reduce)trail.forEach(function(p){ctx.globalAlpha=p.t/.23*.2;circle(p.x,p.y,9,'#d9786b');ctx.globalAlpha=1;});
    if(!won||intake){var scale=won&&!reduce?Math.max(.05,intake/.65):1;var x=won&&!reduce?cup.x+(candy.x-cup.x)*scale:candy.x,y=won&&!reduce?cup.y+22-(22-(candy.y-cup.y))*scale:candy.y;if(!won||!reduce)candyArt(x,y,attached?angle*.45:reduce?0:anim*2,scale);}
    ctx.beginPath();ctx.moveTo(cup.x-cup.w/2,cup.y+6);ctx.lineTo(cup.x-cup.w/2+9,cup.y+39);ctx.quadraticCurveTo(cup.x,cup.y+52,cup.x+cup.w/2-9,cup.y+39);ctx.lineTo(cup.x+cup.w/2,cup.y+6);ctx.quadraticCurveTo(cup.x,cup.y+24,cup.x-cup.w/2,cup.y+6);ctx.fillStyle='#89ad96';ctx.fill();
    line(cup.x-cup.w*.32,cup.y+20,cup.x-cup.w*.27,cup.y+34,'#bdd4b9',3);star(cup.x,cup.y+32,8,'#f6e5a6');
    ctx.beginPath();ctx.ellipse(cup.x,cup.y+5,cup.w/2,11,0,0,Math.PI);ctx.strokeStyle='#c5dbc2';ctx.lineWidth=4;ctx.stroke();
    rings.forEach(function(f){var t=1-f.t/f.life;ctx.globalAlpha=Math.min(1,f.t*4);ctx.beginPath();ctx.arc(f.x,f.y,12+t*30,0,Math.PI*2);ctx.strokeStyle=f.c;ctx.lineWidth=3*(1-t)+1;ctx.stroke();if(f.label)text(f.label,f.x,f.y-24-t*24,18,'#987126');ctx.globalAlpha=1;});
    text(won?'投递成功！':attached?'观察方向，点击或空格剪绳':'绳已剪断，糖果下落中',300,579,16,'#796952');
    for(var j=0;j<3;j++)star(482+j*28,43,9,stars[j].got?'#edbd58':'#e2dcc8');
  }
  listen('cut',cut);listen('retry',restart);canvas.addEventListener('click',cut);keyInput(function(e){if(e.key===' '){e.preventDefault();cut();}});stages(9);restart();

  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
