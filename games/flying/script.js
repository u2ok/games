/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:flying';
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

  var canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');
  function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
  function disk(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function oval(x,y,rx,ry,c){ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
  function text(t,x,y,size,c){ctx.fillStyle=c||'#253047';ctx.font='bold '+size+'px sans-serif';ctx.textAlign='center';ctx.fillText(String(t),x,y);}
  function point(e){var r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*600/r.width,y:(e.clientY-r.top)*600/r.height};}


  var pieces=[[-1,-1,-1,-1],[-1,-1,-1,-1]],turn=0,dice=0,sixes=0,mode=read(key+':mode')==='local'?'local':'ai';
  var phase='ready',phaseTime=0,rollValue=0,lastRoll=null,resultNote='',flight=null,aiWait=.65,uiState='';
  var colors=['#b85b4f','#3f7d9f'];
  var visualClock=0,landingFX=[],returnFX=[],diceMotion=null,dicePoseKey='';
  var diceFaces={1:[0,0],2:[-90,0],3:[0,-90],4:[0,90],5:[90,0],6:[0,180]};
  function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function reducedMotion(){return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
  function landing(progress,side,value){if(progress<0)return value===6?0:-1;var next=progress+value;if(next>57)next=114-next;if(next<52){if(next===12)next=24;else if(next<48&&((next+side*26)%52)%4===(side*26)%4){next+=4;if(next===12)next=24;}}return next;}
  function choices(){var out=[];if(!dice)return out;pieces[turn].forEach(function(p,i){if(p!==57&&landing(p,turn,dice)>=0)out.push(i);});return out;}
  // 15×15实体棋盘式十字航路；52个外圈格，每格38逻辑像素。
  var trackCells=[[6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14]];
  function cellPoint(x,y){return {x:34+x*38,y:34+y*38};}
  function trackPoint(i){var c=trackCells[(i+52)%52];return cellPoint(c[0],c[1]);}
  function progressPoint(side,p,index){if(p<0)return {x:(side?414:72)+(index%2)*114,y:(side?72:414)+Math.floor(index/2)*114};if(p>=52)return cellPoint(7,side?p-51:65-p);return trackPoint((p+side*26)%52);}
  function tokenPoint(side,index){var p=pieces[side][index],point=progressPoint(side,p,index),stack=[];if(p>=0){pieces[side].forEach(function(v,i){if(v===p)stack.push(i);});if(stack.length>1){var a=stack.indexOf(index)*Math.PI*2/stack.length;point.x+=Math.cos(a)*7;point.y+=Math.sin(a)*7;}}return point;}
  function diceSVG(){var dots={1:[[32,32]],2:[[18,18],[46,46]],3:[[18,18],[32,32],[46,46]],4:[[18,18],[46,18],[18,46],[46,46]],5:[[18,18],[46,18],[32,32],[18,46],[46,46]],6:[[18,16],[46,16],[18,32],[46,32],[18,48],[46,48]]};return '<span class="dice-cube" aria-hidden="true">'+[1,6,3,4,2,5].map(function(v){return '<span class="dice-face face-'+v+'"><svg viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="10" fill="#fffdf5" stroke="#b8b3a7" stroke-width="1.5"/><path d="M12 5H52" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/><path d="M5 51Q5 59 13 59H51" fill="none" stroke="#d9d4c6" stroke-width="2"/>'+dots[v].map(function(p){return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="4.8" fill="'+(v===1?'#bd6653':'#344b60')+'"/>';}).join('')+'</svg></span>';}).join('')+'</span>';}
  // 骰子姿态直接取自回合时钟，不再与独立CSS动画抢占transform。
  function dicePose(){
    var face=diceFaces[lastRoll?lastRoll.value:1],x=face[0],y=face[1],lift=0,shift=0,tilt=0;
    if(diceMotion){var t=Math.max(0,Math.min(1,1-phaseTime/diceMotion.duration)),ease=1-Math.pow(1-t,3);x=diceMotion.from[0]+(diceMotion.to[0]+720-diceMotion.from[0])*ease;y=diceMotion.from[1]+(diceMotion.to[1]+720-diceMotion.from[1])*ease;
      if(!reducedMotion()){lift=t<.72?-17*Math.sin(Math.PI*t/.72):-2.5*Math.sin(Math.PI*(t-.72)/.28);shift=4*Math.sin(Math.PI*t)*Math.sin(Math.PI*t*2);tilt=12*Math.sin(Math.PI*t)*Math.sin(Math.PI*t*2);}
      else{x=diceMotion.to[0];y=diceMotion.to[1];}
    }
    return {x:x,y:y,lift:lift,shift:shift,tilt:tilt,shadow:1+lift/65,opacity:.28+lift/110};
  }
  function paintDice(){var p=dicePose(),key=[p.x,p.y,p.lift,p.shift,p.tilt,p.shadow,p.opacity].map(function(v){return v.toFixed(3);}).join(':');if(key===dicePoseKey)return;dicePoseKey=key;var style=document.getElementById('dice-button').style;style.setProperty('--dice-x',p.x.toFixed(3)+'deg');style.setProperty('--dice-y',p.y.toFixed(3)+'deg');style.setProperty('--dice-lift',(p.lift/72).toFixed(5));style.setProperty('--dice-shift',(p.shift/72).toFixed(5));style.setProperty('--dice-tilt',p.tilt.toFixed(3)+'deg');style.setProperty('--dice-shadow',p.shadow.toFixed(3));style.setProperty('--dice-shadow-opacity',p.opacity.toFixed(3));}
  function humanTurn(){return mode==='local'||turn===0;}
  function updateUI(){var button=document.getElementById('dice-button'),shown=lastRoll?lastRoll.value:1;if(!button.dataset.cube){button.innerHTML=diceSVG();button.dataset.cube='ready';}if(button.dataset.face!==String(shown))button.dataset.face=String(shown);paintDice();var signature=[turn,dice,phase,blocked(),mode,pieces.join('|'),lastRoll&&lastRoll.side,lastRoll&&lastRoll.value].join(':');if(signature===uiState)return;uiState=signature;var choose=phase==='choose'&&humanTurn()&&!blocked(),opts=choices(),owner=(phase==='moving'&&flight?flight.side:turn)?'蓝方':'红方';write('score',pieces[0].filter(function(p){return p===57;}).length+'/4');write('best',pieces[1].filter(function(p){return p===57;}).length+'/4');write('detail',owner+'回合 · '+(phase==='rolling'?'正在掷骰':phase==='result'?'查看点数':phase==='choose'?'点亮的飞机可以移动':phase==='moving'?'飞机前进中':'先掷骰子'));write('rule-label','① 掷骰 → ② 选飞机 · 6点起飞 · 四架归航获胜');
    button.classList.toggle('rolling',phase==='rolling');button.classList.toggle('dice-paused',blocked());button.setAttribute('aria-label',phase==='rolling'?'正在掷骰':(lastRoll?lastRoll.value+'点，':'')+'点击掷骰子');button.disabled=blocked()||phase!=='ready'||!humanTurn();document.getElementById('roll').disabled=button.disabled;write('roll',phase==='rolling'?'掷骰中…':'掷骰子');
    write('dice-owner',phase==='rolling'?owner+'掷骰中':lastRoll?(lastRoll.side?'蓝方':'红方')+'掷出':owner+'先掷骰');write('dice-result',phase==='rolling'?'等待点数…':lastRoll?lastRoll.value+' 点':'点骰子开始');
    document.querySelectorAll('[data-plane]').forEach(function(b){var i=Number(b.dataset.plane),p=pieces[turn][i];b.disabled=!choose||opts.indexOf(i)<0;b.classList.toggle('available',choose&&opts.indexOf(i)>=0);var label=b.querySelector('.plane-action');if(label)label.textContent=p===57?'已归航':choose&&opts.indexOf(i)>=0?(p<0?'点击起飞':'点击前进'):p<0?'等6点起飞':'航行中';b.setAttribute('aria-label',owner+(i+1)+'号飞机，'+(p===57?'已归航':choose&&opts.indexOf(i)>=0?'可移动':p<0?'待起飞':'航行中'));b.style.setProperty('--plane-color',colors[turn]);});document.querySelectorAll('[data-mode]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
  }
  function boardCell(p,fill,stroke){rounded(p.x-18,p.y-17,36,36,5,'#40585318');rounded(p.x-18,p.y-18,36,35,5,fill);ctx.strokeStyle=stroke||'#aebdb5';ctx.lineWidth=.8;ctx.beginPath();ctx.roundRect(p.x-18,p.y-18,36,35,5);ctx.stroke();ctx.strokeStyle='#ffffff80';ctx.beginPath();ctx.moveTo(p.x-12,p.y-15);ctx.lineTo(p.x+12,p.y-15);ctx.stroke();}
  function triangle(points,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(var i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fill();}
  function drawPlane(point,side,index,available,heading,size){
    var p=pieces[side][index],stack=p<0?1:pieces[side].filter(function(v){return v===p;}).length,scale=p<0?1.25:stack>2?.48:stack>1?.56:.78;
    if(size!==undefined)scale=size;ctx.save();ctx.translate(point.x,point.y);ctx.scale(scale,scale);
    if(available){var pulse=reducedMotion()?0:Math.sin(visualClock*3)*1.5;disk(0,0,23+pulse,'#ffffffa0');ctx.strokeStyle=colors[side];ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,23+pulse,0,Math.PI*2);ctx.stroke();}
    oval(1,4,18,15,'#354c4d25');disk(0,0,18,'#fffdf6');ctx.strokeStyle=side?'#a8c4d3':'#dab2a7';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.stroke();
    ctx.save();ctx.rotate(heading||0);
    ctx.fillStyle=colors[side];ctx.beginPath();ctx.moveTo(0,-16);ctx.quadraticCurveTo(3,-16,3,-7);ctx.lineTo(14,2);ctx.lineTo(14,6);ctx.lineTo(3,2);ctx.lineTo(3,10);ctx.lineTo(7,14);ctx.lineTo(7,16);ctx.lineTo(0,13);ctx.lineTo(-7,16);ctx.lineTo(-7,14);ctx.lineTo(-3,10);ctx.lineTo(-3,2);ctx.lineTo(-14,6);ctx.lineTo(-14,2);ctx.lineTo(-3,-7);ctx.quadraticCurveTo(-3,-16,0,-16);ctx.fill();
    rounded(-1.5,-12,3,8,1,'#dcecf1');ctx.strokeStyle='#ffffff80';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-10,3);ctx.lineTo(-3,0);ctx.moveTo(3,0);ctx.lineTo(10,3);ctx.stroke();ctx.restore();
    disk(13,13,8.5,colors[side]);ctx.strokeStyle='#fffdf6';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(13,13,8.5,0,Math.PI*2);ctx.stroke();text(index+1,13,17,12,'#fff');ctx.restore();
  }
  function flightPose(flight){
    var t=Math.min(1,flight.time/flight.duration),ease=t*t*(3-2*t),distance=ease*flight.distance,at=0;
    while(at<flight.points.length-2&&flight.distances[at+1]<distance)at++;
    var a=flight.points[at],b=flight.points[at+1],span=flight.distances[at+1]-flight.distances[at],f=span?(distance-flight.distances[at])/span:1;
    // 连续匀向前进，仅在整体起落时缓入缓出，不再每格弹跳。
    var heading=Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2;if(at+2<flight.points.length&&f>.75){var c=flight.points[at+2],nextAngle=Math.atan2(c.y-b.y,c.x-b.x)+Math.PI/2,diff=Math.atan2(Math.sin(nextAngle-heading),Math.cos(nextAngle-heading)),blend=(f-.75)*4;heading+=diff*blend*blend*(3-2*blend);}return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f-(reducedMotion()?0:Math.sin(Math.PI*t)*7),heading:heading};
  }
  function render(){rect(0,0,600,600,'#f3f5ed');rounded(10,12,580,580,18,'#9ba99435');rounded(12,10,576,576,18,'#bac8b4');rounded(16,14,568,568,15,'#fffdf5');
    // 两个活动机场，另外两角分别放骰子和上手提示，不占用跑道。
    rounded(19,359,222,222,15,'#f4ded5');rounded(359,19,222,222,15,'#dcebf2');rounded(19,19,222,222,15,'#edf1e5');rounded(359,359,222,222,15,'#f5eedc');rounded(38,56,184,154,18,'#ffffff80');
    text('红方机场',129,381,19,colors[0]);text('蓝方机场',471,39,19,colors[1]);
    for(var side=0;side<2;side++)for(var i=0;i<4;i++){var ap=progressPoint(side,-1,i);disk(ap.x,ap.y+3,37,'#58716c16');disk(ap.x,ap.y,37,'#fffdf5');ctx.strokeStyle=side?'#9cbbcf':'#d5a697';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ap.x,ap.y,37,0,Math.PI*2);ctx.stroke();}
    ctx.strokeStyle='#cad5ca';ctx.lineWidth=22;ctx.beginPath();trackCells.forEach(function(c,i){var p=cellPoint(c[0],c[1]);if(!i)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.closePath();ctx.stroke();
    trackCells.forEach(function(c,i){var p=cellPoint(c[0],c[1]);boardCell(p,['#e9b1a1','#cfdfbc','#b6d3e5','#f0dda8'][i%4]);if(i%13===0)disk(p.x,p.y,4,'#fffef9');});
    // 十字归航区，红蓝各六格直达中央；另外两条浅色中线仅作棋盘结构。
    for(var j=1;j<=6;j++){boardCell(cellPoint(j,7),'#e4ecdb');boardCell(cellPoint(14-j,7),'#f1e8ce');}
    triangle([[243,243],[357,243],[300,300]],'#a2c5dd');triangle([[243,357],[357,357],[300,300]],'#daa08f');triangle([[243,243],[243,357],[300,300]],'#c4d5b2');triangle([[357,243],[357,357],[300,300]],'#e2c990');
    for(var side=0;side<2;side++){for(var h=0;h<6;h++){var p=progressPoint(side,52+h,0);boardCell(p,side?'#bbd7e9':'#e6b5a5',side?'#83a9c1':'#c28b7a');if(h===5){disk(p.x,p.y,5,'#fff8e7');}else text(h+1,p.x,p.y+4,11,colors[side]);}var start=trackPoint(side*26);ctx.strokeStyle=colors[side];ctx.lineWidth=3;ctx.strokeRect(start.x-16,start.y-16,32,32);text('起',start.x,start.y+5,14,colors[side]);}
    text('终点',300,305,15,'#fffdf5');
    [3,10,16,23,29,36,42,49].forEach(function(i){var p=trackPoint(i),next=trackPoint(i+1),a=Math.atan2(next.y-p.y,next.x-p.x);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);triangle([[6,0],[-3,-4],[-3,4]],'#627665');ctx.restore();});
    var opts=phase==='choose'?choices():[];opts.forEach(function(i){var p=progressPoint(turn,landing(pieces[turn][i],turn,dice),i);ctx.strokeStyle=colors[turn];ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.strokeRect(p.x-16,p.y-16,32,32);ctx.setLineDash([]);});
    for(var side=0;side<2;side++)pieces[side].forEach(function(_,i){
      if(flight&&flight.side===side&&flight.index===i)return;
      if(flight&&flight.captured.some(function(c){return c.side===side&&c.index===i;}))return;
      if(returnFX.some(function(c){return c.side===side&&c.index===i;}))return;
      var pt=tokenPoint(side,i),next=progressPoint(side,Math.min(57,Math.max(0,pieces[side][i])+1),i),heading=pieces[side][i]<0?0:Math.atan2(next.y-pt.y,next.x-pt.x)+Math.PI/2;
      drawPlane(pt,side,i,side===turn&&opts.indexOf(i)>=0,heading);
    });
    if(flight){
      flight.captured.forEach(function(c){drawPlane(c.from,c.side,c.index,false,0,.78);});
      var pose=flightPose(flight);
      if(!reducedMotion()){var previous=flightPose(Object.assign({},flight,{time:Math.max(0,flight.time-.06)}));ctx.strokeStyle=colors[flight.side]+'50';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(previous.x,previous.y);ctx.lineTo(pose.x,pose.y);ctx.stroke();}
      drawPlane(pose,flight.side,flight.index,false,pose.heading,flight.launch?1.25-.47*Math.min(1,flight.time/flight.duration):.78);
    }
    returnFX.forEach(function(c){var t=1-c.time/c.duration,e=t*t*(3-2*t);drawPlane({x:c.from.x+(c.to.x-c.from.x)*e,y:c.from.y+(c.to.y-c.from.y)*e-Math.sin(t*Math.PI)*28},c.side,c.index,false,0,.78+.47*e);});
    landingFX.forEach(function(f){var t=1-f.time/f.duration;ctx.globalAlpha=1-t;ctx.strokeStyle=colors[f.side];ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y,12+20*t,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;});
    text('轮到谁？看这里',471,392,16,'#796b4e');rounded(383,407,176,31,9,'#fffdf5');text((phase==='moving'&&flight?flight.side:turn)?'蓝方回合':'红方回合',471,429,17,colors[phase==='moving'&&flight?flight.side:turn]);text('① 掷骰 · ② 选飞机',471,464,15,'#796b4e');text('6点起飞，再掷一次',471,488,15,'#796b4e');text('白点格安全 · 四架归航获胜',471,555,12,'#796b4e');
    var instruction=phase==='choose'?(humanTurn()?'点发光飞机':'电脑选机中'):phase==='rolling'?'骰子翻滚中':phase==='result'?'看清点数':phase==='moving'?'飞机前进中':humanTurn()?'轮到你掷骰':'电脑掷骰中';text(instruction,471,507,15,colors[turn]);updateUI();
  }
  function cancelAI(){aiWait=.65;}
  function scheduleAI(){aiWait=.65;}
  function roll(value,computer){if(blocked()||dice||phase!=='ready'||mode==='ai'&&(turn===1)!==!!computer)return false;rollValue=value===undefined?1+Math.floor(Math.random()*6):value;if(!Number.isInteger(rollValue)||rollValue<1||rollValue>6)return false;phase='rolling';phaseTime=reducedMotion()?.25:.95;diceMotion={from:diceFaces[lastRoll?lastRoll.value:1].slice(),to:diceFaces[rollValue].slice(),duration:phaseTime};status((turn?'蓝':'红')+'方正在掷骰，请稍候。');render();return true;}
  function revealRoll(){diceMotion=null;dice=rollValue;lastRoll={side:turn,value:dice};if(dice===6)sixes++;else sixes=0;phase='result';phaseTime=.9;resultNote=sixes===3?'连续三个6，本回合结束。':!choices().length?'需要6点才能起飞，本次没有飞机可移动。':dice===6?'掷到6！点发光飞机起飞或前进，还能再掷一次。':'点发光飞机前进 '+dice+' 格。';status((turn?'蓝':'红')+'方掷出 '+dice+' 点。'+resultNote);sound(700);render();}
  function finishResult(){if(sixes===3||!choices().length){dice=0;sixes=0;turn=1-turn;phase='ready';status(resultNote+' 现在轮到'+(turn?'蓝':'红')+'方。');}else{phase='choose';status(resultNote);}scheduleAI();render();}
  function fly(index,computer){if(blocked()||phase!=='choose'||mode==='ai'&&(turn===1)!==!!computer||choices().indexOf(index)<0)return false;var side=turn,old=pieces[side][index],rolled=dice,next=landing(old,side,dice),points=[tokenPoint(side,index)];if(old<0)points.push(progressPoint(side,0,index));else{for(var n=1;n<=dice;n++){var step=old+n;points.push(progressPoint(side,step>57?114-step:step,index));}var last=points[points.length-1],dest=progressPoint(side,next,index);if(last.x!==dest.x||last.y!==dest.y)points.push(dest);}pieces[side][index]=next;var captures=0,captured=[];if(next<52){var global=(next+side*26)%52;if(global%13!==0)pieces[1-side].forEach(function(p,i){if(p>=0&&p<52&&(p+(1-side)*26)%52===global){captured.push({side:1-side,index:i,from:tokenPoint(1-side,i),to:progressPoint(1-side,-1,i),duration:.55,time:.55});pieces[1-side][i]=-1;captures++;}});}var winner=pieces[side].every(function(p){return p===57;});var extra=dice===6;dice=0;phase='moving';flight={side:side,index:index,points:points,time:0,duration:reducedMotion()?.1:Math.min(1.4,Math.max(.35,(points.length-1)*.14)),winner:winner,launch:old<0,captured:captured};flight.distances=[0];for(var d=1;d<points.length;d++)flight.distances.push(flight.distances[d-1]+Math.hypot(points[d].x-points[d-1].x,points[d].y-points[d-1].y));flight.distance=flight.distances[flight.distances.length-1];flight.duration=reducedMotion()?.1:Math.min(1.65,Math.max(.42,flight.distance/245));if(!winner&&!extra){turn=1-turn;sixes=0;}resultNote=(side?'蓝':'红')+'方'+(index+1)+'号'+(old<0?'起飞':next===57?'归航':'前进')+(captures?'，碰回 '+captures+' 架敌机':'')+(extra?'；6点可再掷一次':'')+'。';status(resultNote);render();return true;}
  // 单一动画时钟管理摇骰、结果停留、飞行动画与AI，暂停不会丢点数或积累回调。
  function step(dt){if(blocked())return;visualClock+=dt;landingFX=landingFX.filter(function(f){f.time-=dt;return f.time>0;});returnFX=returnFX.filter(function(f){f.time-=dt;return f.time>0;});if(phase==='rolling'){phaseTime-=dt;if(phaseTime<=0)revealRoll();else updateUI();return;}if(phase==='result'){phaseTime-=dt;if(phaseTime<=0)finishResult();return;}if(phase==='moving'){flight.time+=dt;if(flight.time>=flight.duration){var winner=flight.winner,side=flight.side,destination=flight.points[flight.points.length-1];if(!reducedMotion()){landingFX.push({x:destination.x,y:destination.y,side:side,time:.5,duration:.5});returnFX=returnFX.concat(flight.captured);}flight=null;phase='ready';if(winner)complete((side?'蓝':'红')+'方四架飞机全部归航！');else{status(resultNote+' '+(turn?'蓝':'红')+'方请掷骰。');scheduleAI();}}render();return;}if(mode==='ai'&&turn===1){aiWait-=dt;if(aiWait<=0){aiWait=.65;if(phase==='ready')roll(undefined,true);else if(phase==='choose'){var opts=choices(),pick=opts[Math.floor(Math.random()*opts.length)];if(activeOption!=='easy')opts.forEach(function(i){var next=landing(pieces[turn][i],turn,dice),current=landing(pieces[turn][pick],turn,dice);if(next===57||next>current)pick=i;});if(pick!==undefined)fly(pick,true);}}}}
  function restart(){resetState();visualClock=0;landingFX=[];returnFX=[];diceMotion=null;dicePoseKey='';uiState='';pieces=[[-1,-1,-1,-1],[-1,-1,-1,-1]];turn=0;dice=0;sixes=0;phase='ready';phaseTime=0;flight=null;lastRoll=null;cancelAI();renderStages();render();status('先点骰子；掷到6点后，点发光飞机起飞。先归航四架获胜。');}
  document.getElementById('roll').addEventListener('click',function(){roll();});document.getElementById('dice-button').addEventListener('click',function(){roll();});document.querySelectorAll('[data-plane]').forEach(function(b){b.addEventListener('click',function(){fly(Number(b.dataset.plane),false);});});canvas.addEventListener('click',function(e){if(blocked()||phase!=='choose')return;var p=point(e),i=pieces[turn].findIndex(function(_,i){var t=tokenPoint(turn,i);return Math.hypot(t.x-p.x,t.y-p.y)<(pieces[turn][i]<0?35:18);});if(i>=0)fly(i,false);});document.addEventListener('keydown',function(e){if(blocked()||editing(e)||e.repeat)return;if(/^[1-4]$/.test(e.key)){e.preventDefault();fly(Number(e.key)-1,false);}else if(e.key===' '){e.preventDefault();roll();}});document.querySelectorAll('[data-mode]').forEach(function(b){b.addEventListener('click',function(){if(mode===b.dataset.mode)return;mode=b.dataset.mode==='local'?'local':'ai';save(key+':mode',mode);restart();ready=true;showCover('模式已切换','红方先行：掷骰、选飞机。','开始游戏');syncStart();updateUI();});});var frameAt=0;function animate(now){var dt=frameAt?Math.min(.05,(now-frameAt)/1000):0;frameAt=now;if(!blocked()){step(dt);render();}requestAnimationFrame(animate);}requestAnimationFrame(animate);var resumeClock=function(){frameAt=0;};onPause=function(){cancelAI();updateUI();};onResume=function(){resumeClock();updateUI();};onStart=function(){scheduleAI();updateUI();};stages(1);restart();

  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备起飞','先掷骰，6点起飞；点发光飞机前进。','开始游戏');syncStart();updateUI();
}());
