/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:gold-miner';
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
  function frame(now){var dt=previous?Math.min(.035,(now-previous)/1000):0;previous=now;if(!blocked())tick(dt);else if(ended&&!paused&&!dialog.open)effects(dt);draw();drawEffects();requestAnimationFrame(frame);}
  requestAnimationFrame(frame);

  var rewardPop=0,rewardValue=0,grabFlash=0;
  var items=[],angle=0,swing=0,length=0,phase='swing',caught=null,score=0,left=60,target=0,bombs=2,ropeAngle=0;
  function tip(){return {x:300+Math.sin(ropeAngle)*length,y:92+Math.cos(ropeAngle)*length};}
  function launch(){if(blocked()||phase!=='swing')return;ropeAngle=angle;phase='out';length=18;status('钩爪下探中；大矿块回收较慢。');}
  function step(dt){rewardPop=Math.max(0,rewardPop-dt);grabFlash=Math.max(0,grabFlash-dt);left=Math.max(0,left-dt);if(phase==='swing'){swing+=dt;angle=Math.sin(swing*1.4)*1.13;ropeAngle=angle;length=24;}else if(phase==='out'){length+=310*dt;var p=tip(),i=items.findIndex(function(o){return Math.hypot(o.x-p.x,o.y-p.y)<o.r+8;});if(i>=0){caught=items.splice(i,1)[0];phase='back';grabFlash=.35;status('抓到'+(caught.kind===2?'宝石':caught.kind===1?'石块':'金矿')+'，价值 '+caught.value+' 分，正在回收。');sound(480);}else if(p.x<30||p.x>570||p.y>550)phase='back';}else{length-=dt*(caught?caught.kind===0?100:caught.kind===1?65:210:350);if(length<=24){if(caught){score+=caught.value;rewardValue=caught.value;rewardPop=1.2;burst(300,100,caught.kind===1?'#8f9aa5':gold);caught=null;}phase='swing';if(score>=target)win('矿藏达标，获得 '+score+' 分。',score,false);}}if(!left&&!ended)finish('时间到，距目标还差 '+Math.max(0,target-score)+' 分。');render();}
  function blast(){if(phase==='back'&&caught&&bombs){burst(tip().x,tip().y,coral);caught=null;bombs--;write('blast','炸药 × '+bombs);status('已清除重物，钩爪加速返回。');}else status('抓住物件返回时才能使用炸药，每关两次。');}
  function render(){hud(score,'第 '+(stageIndex+1)+' 关 · 剩余 '+Math.ceil(left)+' 秒 · 炸药 '+bombs,'目标 '+target+' 分 · 达标过关');}
  function buildMine(){
    // 原八关保留；新增矿井使用稳定种子改变矿脉分布，目标缓慢递增。
    target={easy:450,normal:650,hard:850}[activeOption]+Math.min(stageIndex,7)*80+Math.max(0,Math.floor((stageIndex-7)/4))*40;
    var seed=Math.imul(stageIndex+1,2654435761)>>>0;
    function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    items=[];
    for(var row=0;row<3;row++)for(var col=0;col<5;col++){
      var kind=(row*5+col+stageIndex)%5===0?2:(row+col)%3===0?1:0;
      var x=70+col*112+(row%2)*9,y=205+row*128+Math.sin(col+stageIndex)*15;
      if(stageIndex>=8){
        // 三条宝石矿脉配合金矿/岩层；每行至少一颗轻质高价值宝石。
        kind=col===(stageIndex+row*2)%5?2:(col+row+stageIndex)%4===0?1:0;
        x=70+col*112+Math.round(random()*18-9);y=205+row*128+Math.round(random()*32-16);
      }
      items.push({x:x,y:y,r:kind===2?14:kind===1?26:22+(col%2)*8,kind:kind,value:kind===2?300:kind===1?20:150+(col%2)*100});
    }
  }
  function restart(){begin();rewardPop=grabFlash=0;score=0;left=60;phase='swing';length=24;angle=swing=ropeAngle=0;caught=null;bombs=2;buildMine();write('blast','炸药 × 2');renderStages();render();status('等钩爪对准金块后放钩；灰色石块很重，可用炸药丢弃。');}
  // 物件轮廓按碰撞半径绘制，装饰不改变抓取位置或重量。
  function shape(points,fill,stroke,width){ctx.beginPath();points.forEach(function(p,i){if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width||2;ctx.stroke();}}
  function ore(o,x,y,carried){
    var r=o.r;
    ctx.save();ctx.translate(x,y);
    ctx.globalAlpha=.14;ctx.beginPath();ctx.ellipse(2,r*.8,r*.9,r*.23,0,0,Math.PI*2);ctx.fillStyle='#533821';ctx.fill();ctx.globalAlpha=1;
    if(o.kind===2){
      shape([[-r,-r*.25],[-r*.48,-r*.85],[r*.48,-r*.85],[r,-r*.25],[0,r]],'#71c8db','#397d98',1.5);
      shape([[-r,-r*.25],[r,-r*.25],[0,r]],'#48a5c3');
      shape([[-r*.48,-r*.85],[r*.48,-r*.85],[r*.35,-r*.25],[-r*.35,-r*.25]],'#d8f9f5');
      shape([[-r*.35,-r*.25],[r*.35,-r*.25],[0,r]],'#9ee7ed');
      if(!reduce){var glow=.45+.35*Math.sin(anim*3+o.x);ctx.globalAlpha=glow;line(-r*.8,-r*.9,-r*.8,-r*.55,'#fff',2);line(-r*.97,-r*.73,-r*.63,-r*.73,'#fff',2);ctx.globalAlpha=1;}
    }else if(o.kind===1){
      shape([[-r,-r*.22],[-r*.65,-r*.75],[r*.15,-r*.84],[r*.88,-r*.4],[r,r*.34],[r*.42,r*.74],[-r*.6,r*.65]],'#87939d','#596775',2);
      shape([[-r,-r*.22],[-r*.65,-r*.75],[r*.15,-r*.84],[r*.43,-r*.24],[-r*.35,r*.03]],'#b1bac0');
      shape([[r*.43,-r*.24],[r*.88,-r*.4],[r,r*.34],[r*.42,r*.74],[r*.12,r*.17]],'#697785');
      line(-r*.37,-r*.28,-r*.06,-r*.05,'#657480',1.5);line(-r*.06,-r*.05,-r*.15,r*.3,'#657480',1.5);
    }else{
      shape([[-r,-r*.15],[-r*.65,-r*.68],[r*.02,-r*.88],[r*.72,-r*.53],[r,r*.13],[r*.55,r*.72],[-r*.36,r*.81]],'#e5b43e','#a67528',2);
      shape([[-r,-r*.15],[-r*.65,-r*.68],[r*.02,-r*.88],[r*.3,-r*.28],[-r*.28,r*.08]],'#ffe49a');
      shape([[r*.3,-r*.28],[r*.72,-r*.53],[r,r*.13],[r*.55,r*.72],[r*.15,r*.21]],'#c68b27');
      shape([[-r*.28,r*.08],[r*.3,-r*.28],[r*.15,r*.21],[-r*.36,r*.81]],'#f7cc59');
      line(-r*.57,-r*.42,-r*.17,-r*.55,'#fff1bb',2.5);
    }
    ctx.restore();
    if(!carried){rect(x-22,y+r+4,44,20,'#fff4dd',6);text(o.value,x,y+r+14,12,o.kind===1?'#596775':'#805c2a');}
  }
  function miner(){
    var pull=phase==='back',bob=reduce?0:Math.sin(anim*(pull?13:3))*(pull?1.3:.4);
    // 坐在绞盘旁的矿工：头灯、胡须、背带裤与摇柄。
    ctx.save();ctx.translate(0,bob);
    line(244,106,238,118,'#493d38',9);line(263,106,270,118,'#493d38',9);
    rect(234,70,38,39,'#527e89',8);rect(241,80,7,27,'#a3bcc0',2);rect(259,80,7,27,'#a3bcc0',2);
    circle(253,57,20,'#e5ac7a');circle(235,59,4,'#d99a6a');circle(272,59,4,'#d99a6a');
    shape([[236,62],[241,76],[253,82],[266,74],[270,61],[257,67],[250,63]],'#f4e7ce');
    circle(246,55,2,'#413b36');circle(261,55,2,'#413b36');circle(254,61,3,'#d18b59');
    ctx.beginPath();ctx.arc(253,46,21,Math.PI,Math.PI*2);ctx.fillStyle='#dfac38';ctx.fill();rect(228,43,51,7,'#b88128',3);
    rect(247,29,13,17,'#53636c',4);circle(253.5,37,5,'#fff3b5');
    line(238,80,227,94,'#e5ac7a',8);line(270,80,282,89,'#e5ac7a',8);
    ctx.restore();
    // 滚筒和承重支架始终与绳索原点(300,92)对齐。
    shape([[282,119],[288,82],[312,82],[321,119]],'#7d6046','#604b38',2);
    rect(279,81,42,21,'#a77c48',5);line(284,81,284,103,'#634e3c',5);line(316,81,316,103,'#634e3c',5);
    for(var i=0;i<6;i++)line(288+i*5,84,288+i*5,99,'#dfc297',2);
    var spin=reduce?0:phase==='swing'?0:anim*(phase==='back'?-9:7);
    circle(300,92,10,'#596770');line(300,92,300+Math.cos(spin)*13,92+Math.sin(spin)*13,'#d8e2de',3);circle(300+Math.cos(spin)*13,92+Math.sin(spin)*13,3,'#44535c');
  }
  function draw(){
    ctx.clearRect(0,0,600,600);rect(0,0,600,600,'#e9f2ed',0);
    // 地表与分层矿床采用固定几何纹理，暂停后不会随机闪动。
    circle(510,39,22,'#f9e8b5');shape([[0,105],[70,54],[145,108],[220,64],[299,114]],'#cfdfd4');shape([[352,118],[422,70],[485,101],[557,64],[600,94],[600,140]],'#c2d4c8');
    rect(0,121,600,479,'#d7b58a',0);
    shape([[0,195],[95,207],[204,194],[330,216],[450,198],[600,214],[600,323],[0,323]],'#cda578');
    shape([[0,322],[110,305],[265,329],[400,314],[600,335],[600,459],[0,459]],'#bd946b');
    shape([[0,454],[145,470],[290,446],[420,468],[600,451],[600,600],[0,600]],'#ae835f');
    for(var i=0;i<55;i++){var x=18+(i*83)%563,y=155+(i*71)%397;line(x,y,x+4+i%5,y+1,'#9c7554',1);}
    rect(0,120,600,10,'#6e8e60',0);rect(0,130,600,6,'#a6b280',0);
    // 木撑框出矿井边界，矿物与绳索仍完整显示于原逻辑区域。
    rect(13,143,13,409,'#8e6849',3);rect(574,143,13,409,'#8e6849',3);rect(9,139,582,14,'#9f7952',3);
    for(var j=0;j<5;j++){circle(20,166+j*87,2,'#d5ba8e');circle(581,166+j*87,2,'#d5ba8e');}
    items.forEach(function(o){ore(o,o.x,o.y,false);});
    var p=tip();line(301,94,p.x+1,p.y+1,'#725637',4);line(299,92,p.x-1,p.y-1,'#e6cca0',1.5);
    if(caught)ore(caught,p.x,p.y+caught.r,true);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-ropeAngle);
    circle(0,0,5,'#596770');var close=caught?5:12;
    line(-3,0,-close,8,'#52616c',4);line(-close,8,-close+3,19,'#52616c',4);line(-close+3,19,-2,15,'#52616c',3);
    line(3,0,close,8,'#52616c',4);line(close,8,close-3,19,'#52616c',4);line(close-3,19,2,15,'#52616c',3);ctx.restore();
    if(grabFlash&&!reduce){ctx.globalAlpha=grabFlash/.35;ctx.beginPath();ctx.arc(p.x,p.y,18+(1-grabFlash/.35)*18,0,Math.PI*2);ctx.strokeStyle='#fff1b3';ctx.lineWidth=3;ctx.stroke();ctx.globalAlpha=1;}
    miner();
    rect(16,16,169,43,'#fff8e9',10);text('第 '+(stageIndex+1)+' 关 · 目标 '+target,101,37,16,'#72502f');
    rect(399,74,183,35,'#fff8e9',9);text(phase==='swing'?'对准矿石，点击放钩':phase==='out'?'抓钩下探中…':caught?'抓到了！正在回收':'空钩返回中',490,92,13,'#72502f');
    rect(28,557,544,30,'#fff8e9',9);rect(39,567,330,9,'#e5d3b6',4);if(score)rect(39,567,330*Math.min(1,score/target),9,'#d4a13a',4);text(score+' / '+target,422,572,14,'#72502f');text(Math.ceil(left)+' 秒',531,572,15,left<10?'#a33e32':'#72502f');
    if(rewardPop){ctx.globalAlpha=Math.min(1,rewardPop*2);text('+'+rewardValue,339,76-(reduce?0:(1.2-rewardPop)*25),22,'#986516');ctx.globalAlpha=1;}
  }
  listen('launch-claw',launch);listen('blast',blast);canvas.addEventListener('click',launch);keyInput(function(e){if(e.key===' '){e.preventDefault();launch();}if(e.key.toLowerCase()==='b')blast();});stages(24);restart();

  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
