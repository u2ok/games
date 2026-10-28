/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:fishing';
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
  function hud(value,detail,rule){write('score',value);write('best',number('best:v2:'+activeOption+':'+stageIndex,0)||'—');write('detail',detail);write('rule-label',rule);}
  function record(value,minimum){var k=key+':best:v2:'+activeOption+':'+stageIndex,old=Number(read(k));if(!old||(minimum?value<old:value>old))save(k,String(value));}
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


  var phase='idle',timer=0,left=125,score=0,bait=10,tension=0,distance=100,reeling=false,fish=0,gear=0,coins=0,caught=0,target=40;
  var sceneTime=0,phaseTime=0,roundStarted=false,resultSuccess=false,resultNote='',biteWindow=2.4;
  var pointerHeld=false,spaceHeld=false,latched=false,heldPointer=null,heldElement=null,lastFrame=0;
  var motionQuery=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
  var lakes=['溪畔浅湾','林间碧湖','晚霞深潭'];
  var names=['鲫鱼','鲈鱼','鳟鱼','锦鲤'],values=[10,20,35,50];
  function setPhase(value){phase=value;phaseTime=0;}
  function syncHeld(){reeling=pointerHeld||spaceHeld||latched;update();}
  function clearHeld(){pointerHeld=false;spaceHeld=false;latched=false;reeling=false;var element=heldElement,id=heldPointer;heldElement=null;heldPointer=null;if(element&&element.releasePointerCapture)try{element.releasePointerCapture(id);}catch(error){/* 已结束的触摸无需再次释放。 */}}
  function update(){
    var progress=Math.round(Math.max(0,Math.min(100,100-distance))),strain=Math.round(Math.max(0,Math.min(100,tension))),cue,note;
    if(phase==='idle'){cue='点击抛竿，开始钓鱼';note='看到浮漂明显下沉，再点击“提竿”。';}
    else if(phase==='casting'){cue='鱼线飞出，浮漂即将入水';note='正在抛竿，等它落稳即可。';}
    else if(phase==='wait'){cue='浮漂轻晃，等待咬钩';note='无需连续点击，鱼儿很快就来。';}
    else if(phase==='bite'){cue='鱼咬钩了！现在提竿';note='点击“提竿”或按空格，还有 '+Math.max(0,timer).toFixed(1)+' 秒。';}
    else if(phase==='fight'){cue=tension>=78?'张力偏高，松开收线！':reeling?'正在收线，留意鱼线张力':'按住收线，松开可放线';note='钩住'+names[fish]+' · 进度满格收鱼，张力满格会脱钩。';}
    else if(phase==='result'){cue=resultSuccess?'钓到'+names[fish]+'！ +'+values[fish]+'分':'鱼儿游走了，再来一竿';note=resultNote;}
    else{cue=won?'目标达成，湖泊挑战完成':'本轮结束';note='本轮钓获 '+caught+' 条，共 '+score+' 分。';}
    write('fishing-cue',cue);write('fishing-note',note);
    hud(score,'剩余 '+Math.ceil(left)+' 秒 · 鱼饵 '+bait+' · 捕获 '+caught+' 条',lakes[stageIndex]+' · 目标 '+target+'分 · 鱼竿 '+gear+'级 · 金币 '+coins);
    var castButton=document.getElementById('cast'),reelButton=document.getElementById('reel');
    write('cast',phase==='bite'?'提竿！':phase==='casting'?'正在抛竿':phase==='wait'?'等待咬钩':phase==='fight'?'正在搏鱼':phase==='result'?'再抛一竿':'抛竿');
    castButton.disabled=blocked()||phase==='casting'||phase==='wait'||phase==='fight';
    reelButton.disabled=blocked()||phase!=='fight';write('reel',reeling?(latched?'再次点击放线':'松开放线'):'按住收线');reelButton.setAttribute('aria-pressed',String(reeling));
    write('upgrade',gear>=3?'鱼竿已满级':'升级 · '+((gear+1)*5)+'币');document.getElementById('upgrade').disabled=blocked()||gear>=3||coins<(gear+1)*5||phase!=='idle'&&phase!=='result';
    var meters=document.getElementById('fight-meters');if(meters.hidden!==(phase!=='fight'))meters.hidden=phase!=='fight';
    var progressNode=document.getElementById('line-progress'),tensionNode=document.getElementById('line-tension');if(Number(progressNode.value)!==progress)progressNode.value=progress;if(Number(tensionNode.value)!==strain)tensionNode.value=strain;
    write('progress-text',progress+'%');write('tension-text',strain+'%');
    if(document.querySelector){var panel=document.querySelector('.fishing-hud');if(panel&&panel.classList)panel.classList.toggle('danger',phase==='fight'&&tension>=78);}
    if(canvas.dataset.phase!==phase){canvas.dataset.phase=phase;canvas.setAttribute('aria-label','钓鱼湖面：'+cue);}canvas.dataset.caught=String(caught);
  }
  function endRound(){if(ended)return;clearHeld();setPhase('ended');record(score,false);if(score>=target)complete('钓获 '+caught+' 条，得分 '+score+'。');else finish('得分 '+score+'，目标 '+target+'。再试一次。');update();}
  function settle(){clearHeld();if(!bait||left<=0||score>=target){endRound();return;}setPhase('idle');update();}
  function cast(){
    if(blocked())return false;
    if(phase==='result'){if(!bait||left<=0||score>=target){endRound();return false;}setPhase('idle');}
    if(phase==='idle'){
      if(!bait)return false;clearHeld();roundStarted=true;bait--;setPhase('casting');timer=(motionQuery&&motionQuery.matches) ? .25 : .7;status('抛竿出手，等浮漂入水后再观察。');sound(440);
    }else if(phase==='bite'){
      clearHeld();setPhase('fight');tension=20;distance=100;status('钩住'+names[fish]+'！按住“收线”或空格，张力高时松开。');sound(760);
    }else return false; // 等待中重复点击不再取消鱼饵，也不切换收线状态。
    update();render();return true;
  }
  function beginBite(){setPhase('bite');biteWindow=(activeOption==='easy'?3:activeOption==='hard'?1.8:2.4)+(caught===0?.5:0);timer=biteWindow;fish=Math.min(3,Math.floor(Math.random()*(stageIndex+2)));sound(960);status('浮漂下沉！点击“提竿”或按空格。');}
  function catchFish(){if(phase!=='fight')return;score+=values[fish];caught++;coins+=2+fish;save(key+':coins',String(coins));resultSuccess=true;resultNote='获得 '+(2+fish)+' 金币 · 可继续抛竿或升级鱼竿。';clearHeld();setPhase('result');timer=1.6;status('钓到'+names[fish]+'，获得 '+values[fish]+' 分！');sound(820);}
  function escapeFish(reason){if(phase!=='fight'&&phase!=='bite')return;clearHeld();resultSuccess=false;resultNote=reason;setPhase('result');timer=1.4;status(reason);}
  function step(dt){
    if(blocked())return;dt=Math.max(0,Math.min(.1,dt));sceneTime+=dt;phaseTime+=dt;if(roundStarted)left=Math.max(0,left-dt);
    if(phase==='casting'){timer-=dt;if(timer<=0){setPhase('wait');timer=1.2+Math.random()*1.2;status('浮漂入水，等待它明显下沉再提竿。');}}
    else if(phase==='wait'){timer-=dt;if(timer<=0)beginBite();}
    else if(phase==='bite'){timer-=dt;if(timer<=0)escapeFish('错过提竿时机；下次看到浮漂下沉就提竿。');}
    else if(phase==='fight'){
      var pull=1+fish*.16+stageIndex*.08,surge=.9+.18*Math.sin(phaseTime*2.5),difficulty=activeOption==='easy'?.85:activeOption==='hard'?1.15:1;
      tension=Math.max(0,tension+dt*(reeling?(14+fish*3.3)*surge*difficulty-gear*1.5:-32));
      distance+=dt*(reeling?-(27+gear*5)/pull:4*pull);
      if(tension>=100)escapeFish('收线过紧，鱼儿脱钩；张力偏高时松开按钮。');else if(distance>150)escapeFish('放线太久，鱼儿逃远了；适时按住收线。');else if(distance<=0){distance=0;catchFish();}
    }else if(phase==='result'){timer-=dt;if(timer<=0)settle();}
    if(!ended&&left<=0&&phase!=='result')endRound();update();
  }
  function upgradeRod(){if(blocked()||gear>=3||coins<(gear+1)*5||phase!=='idle'&&phase!=='result')return false;coins-=(gear+1)*5;gear++;save(key+':coins',String(coins));save(key+':gear',String(gear));status('鱼竿升至 '+gear+' 级，收线更快、张力更容易控制。');update();sound(650);return true;}
  function gradient(y1,y2,stops){var g=ctx.createLinearGradient(0,y1,0,y2);if(!g||!g.addColorStop)return stops[0][1];stops.forEach(function(s){g.addColorStop(s[0],s[1]);});return g;}
  function panel(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.fill();}
  function line(points,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach(function(p,i){if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.stroke();}
  function label(value,x,y,size,color,align){ctx.fillStyle=color||'#315b55';ctx.font='600 '+size+'px "Microsoft YaHei",sans-serif';ctx.textAlign=align||'left';ctx.fillText(String(value),x,y);}
  function fishShape(x,y,size,color,angle,wiggle){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle||0);
    ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-size*.65,0);ctx.lineTo(-size*1.12,-size*.38+(wiggle||0));ctx.quadraticCurveTo(-size*.95,0,-size*1.12,size*.38+(wiggle||0));ctx.closePath();ctx.fill();
    oval(0,0,size*.8,size*.38,color);ctx.fillStyle='#ffffff30';ctx.beginPath();ctx.moveTo(-size*.2,-size*.2);ctx.quadraticCurveTo(size*.1,-size*.65,size*.4,-size*.2);ctx.fill();
    ctx.strokeStyle='#ffffff65';ctx.lineWidth=Math.max(1,size*.035);ctx.beginPath();ctx.arc(size*.32,0,size*.27,-1.1,1.1);ctx.stroke();
    disk(size*.5,-size*.09,Math.max(1.8,size*.055),'#253e39');ctx.restore();
  }
  function fishPosition(t){return {x:180+Math.max(0,distance)*2.35+Math.sin(t*3)*7,y:255+Math.max(0,distance)*.42+Math.sin(t*2)*8};}
  function render(){
    var reduced=motionQuery&&motionQuery.matches,t=reduced?0:sceneTime,sky=stageIndex===2?'#f5ddc4':'#edf3dc',water=stageIndex===2?'#7fa7a4':'#78aaad';
    rect(0,0,600,600,gradient(0,200,[[0,sky],[1,'#d9e8d8']]));
    disk(470,77,42,'#f7e8b354');disk(470,77,27,'#fff0bd');
    oval(335+Math.sin(t*.08)*9,76,38,11,'#ffffff80');oval(369+Math.sin(t*.08)*9,70,27,14,'#ffffff80');
    ctx.fillStyle='#b2cbb9';ctx.beginPath();ctx.moveTo(0,173);ctx.quadraticCurveTo(90,76,210,162);ctx.quadraticCurveTo(330,106,455,167);ctx.quadraticCurveTo(535,116,600,154);ctx.lineTo(600,225);ctx.lineTo(0,225);ctx.fill();
    ctx.fillStyle='#8eafa2';ctx.beginPath();ctx.moveTo(0,186);ctx.quadraticCurveTo(105,139,240,185);ctx.quadraticCurveTo(410,150,600,181);ctx.lineTo(600,224);ctx.lineTo(0,224);ctx.fill();
    for(var tree=0;tree<8;tree++){var tx=25+tree*83,ty=173+(tree%3)*6;line([[tx,ty],[tx,ty-24]],'#78998a',3);oval(tx,ty-29,14,25,tree%2?'#90b09d':'#83a994');}
    rect(0,200,600,400,gradient(200,600,[[0,'#c9dfd5'],[.45,'#a6cdca'],[1,water]]));
    // 湖面波纹、反光与鱼影随同一时钟推进；暂停时场景也真正冻结。
    for(var wave=0;wave<16;wave++){
      var wy=216+wave*23,wx=(wave*97)%600+Math.sin(t*.7+wave)*12;
      ctx.strokeStyle=wave%3?'#e7f0dd85':'#f8f4d38c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(wx-18,wy);ctx.quadraticCurveTo(wx,wy+Math.sin(t*1.3+wave)*3,wx+32+(wave%4)*6,wy);ctx.stroke();
    }
    for(var shimmer=0;shimmer<5;shimmer++)oval(465+Math.sin(t*.6+shimmer)*6,216+shimmer*14,24-shimmer*2,1.5,'#f8edbd70');
    for(var shadow=0;shadow<5;shadow++){
      var sx=((shadow*139+t*(8+shadow*2))%760)-80,sy=325+(shadow%3)*45+Math.sin(t+shadow)*7;
      ctx.globalAlpha=.14;fishShape(sx,sy,15+shadow*2,'#426c6a',Math.sin(t+shadow)*.08,Math.sin(t*5+shadow)*3);ctx.globalAlpha=1;
    }
    // 木栈桥与钓者采用本地Canvas物件图形，不依赖字体图标或外部图片。
    oval(73,322,108,20,'#406b6630');rect(18,252,12,81,'#8c795b');rect(139,255,12,79,'#8c795b');
    ctx.fillStyle='#b89b72';ctx.beginPath();ctx.moveTo(0,228);ctx.lineTo(147,241);ctx.lineTo(177,290);ctx.lineTo(0,277);ctx.fill();
    line([[0,278],[177,291]],'#947b59',7);for(var plank=0;plank<6;plank++){var px=plank*30;line([[px,231+px*.08],[px+25,279+px*.07]],'#8f785660',2);}
    line([[77,253],[89,275],[118,279]],'#4f6662',10);line([[88,252],[103,274],[135,278]],'#475c59',9);
    oval(80,229,23,28,'#728f9d');disk(83,196,17,'#d6b58e');disk(93,196,1.8,'#465b50');oval(80,182,31,7,'#b9a16f');panel(62,164,36,20,8,'#cbb783');
    line([[91,220],[117,235],[146,223]],'#d6b58e',8);
    var castLength=reduced ? .25 : .7,castQ=phase==='casting'?Math.min(1,phaseTime/castLength):1;
    var fx=418+Math.sin(t*1.6)*3,fy=292+Math.sin(t*2.4)*3,rodTip={x:284,y:153};
    if(phase==='idle'){fx=269;fy=225;rodTip={x:247,y:171};}
    if(phase==='casting'){fx=170+(418-170)*castQ;fy=220+(292-220)*castQ-Math.sin(castQ*Math.PI)*(reduced?20:125);rodTip={x:247+37*castQ,y:171-18*castQ};}
    if(phase==='bite')fy+=12+Math.sin(t*12)*5;
    if(phase==='fight'){var fighting=fishPosition(t);fx=fighting.x;fy=fighting.y;rodTip={x:263,y:150+Math.min(1,tension/100)*28};}
    ctx.strokeStyle='#7a6950';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(133,232);ctx.quadraticCurveTo(210,186,rodTip.x,rodTip.y);ctx.stroke();
    line([[137,228],[151,216]],'#3b5550',7);disk(145,232,8,'#4c6f66');line([[145,232],[145+Math.cos(t*(reeling?12:1))*8,232+Math.sin(t*(reeling?12:1))*8]],'#c7d4bb',2);
    if(phase!=='result'&&phase!=='ended'){
      ctx.strokeStyle=phase==='fight'&&tension>=78?'#b86954':'#f5f3db';ctx.lineWidth=phase==='fight'?2:1.5;ctx.beginPath();ctx.moveTo(rodTip.x,rodTip.y);ctx.quadraticCurveTo((rodTip.x+fx)/2,Math.max(rodTip.y,fy)+(phase==='fight'&&reeling?-35:20),fx,fy);ctx.stroke();
      if(phase==='fight'){
        var color=['#91ad9c','#709ba2','#a5b7a2','#d89f74'][fish];fishShape(fx,fy,29+fish*4,color,Math.PI+Math.sin(t*5)*.14,Math.sin(t*10)*3);
        ctx.strokeStyle='#e9f2dc99';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(fx,fy+6,37+Math.sin(t*4)*4,8,0,0,Math.PI*2);ctx.stroke();
      }else{
        if(phase!=='idle'&&phase!=='casting'){
          for(var ring=0;ring<3;ring++){var age=(t*.65+ring/3)%1;ctx.strokeStyle='rgba(248,249,229,'+(1-age)*.65+')';ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(fx,fy+4,9+age*(phase==='bite'?51:33),3+age*8,0,0,Math.PI*2);ctx.stroke();}
        }
        line([[fx,fy-20],[fx,fy+7]],'#f6f3da',3);oval(fx,fy,5,9,phase==='bite'?'#b85e4d':'#d58a65');oval(fx,fy+6,4,4,'#f9e9ba');
        if(phase==='bite'){
          panel(fx-74,fy-84,148,38,12,'#fffdf1');label('咬钩了！提竿',fx,fy-59,20,'#ad5946','center');
          ctx.strokeStyle='#b7795b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(fx,fy,30,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,timer)/biteWindow);ctx.stroke();
        }
      }
    }
    if(phase==='result'){
      var pop=reduced?1:Math.min(1,phaseTime*4),jump=reduced?0:Math.sin(Math.min(1,phaseTime/.8)*Math.PI)*34;
      panel(215,210,300,145,18,'#fffdf0e8');
      if(resultSuccess){fishShape(363,262-jump,40*pop,['#91ad9c','#709ba2','#a5b7a2','#d89f74'][fish],-.1,0);label(names[fish]+'  +'+values[fish]+'分',365,326,24,'#3c6d5c','center');}
      else{label('这条先放它回家',365,269,23,'#657b6d','center');label('下一竿还有机会',365,310,18,'#7b8f7c','center');}
    }
    // 前景芦苇为湖面提供层次，关键提示固定在下方DOM仪表区，手机也保持可读。
    for(var reed=0;reed<6;reed++){var rx=564+reed*8;line([[rx,510],[rx-8,393-reed%3*17]],'#638d79',3);oval(rx-8,390-reed%3*17,3,12,'#9b8b60');}
    label(lakes[stageIndex],24,37,23,'#365c54');label('第 '+(stageIndex+1)+' 湖 · 目标 '+target+' 分',25,63,16,'#648477');
  }
  function restart(){clearHeld();resetState();setPhase('idle');sceneTime=0;roundStarted=false;left=activeOption==='easy'?150:activeOption==='hard'?105:125;score=0;bait=10;caught=0;tension=0;distance=100;resultSuccess=false;resultNote='';gear=Math.min(3,Math.floor(number('gear',0)));coins=Math.floor(number('coins',0));target=[40,75,110][stageIndex];lastFrame=0;renderStages();update();render();status('点击“抛竿”开始。咬钩时提竿，中鱼后按住收线。');}
  function beginHold(e){if(blocked()||phase!=='fight'||heldPointer!==null&&heldPointer!==e.pointerId)return;if(e.preventDefault)e.preventDefault();pointerHeld=true;heldPointer=e.pointerId;heldElement=e.currentTarget;latched=false;if(heldElement&&heldElement.setPointerCapture)try{heldElement.setPointerCapture(e.pointerId);}catch(error){/* 无捕获能力时由document的pointerup兜底。 */}syncHeld();}
  function endHold(e){if(e&&heldPointer!==null&&e.pointerId!==undefined&&e.pointerId!==heldPointer)return;pointerHeld=false;heldPointer=null;heldElement=null;syncHeld();}
  function keyDown(e){if(e.key!==' '&&e.code!=='Space'||editing(e)||blocked())return;e.preventDefault();if(e.repeat)return;if(phase==='fight'){spaceHeld=true;latched=false;syncHeld();}else cast();}
  function keyUp(e){if(e.key===' '||e.code==='Space'){spaceHeld=false;if(e.preventDefault&&!editing(e))e.preventDefault();syncHeld();}}
  document.getElementById('cast').addEventListener('click',cast);document.getElementById('upgrade').addEventListener('click',upgradeRod);
  var reel=document.getElementById('reel');reel.addEventListener('pointerdown',beginHold);reel.addEventListener('pointerup',endHold);reel.addEventListener('pointercancel',endHold);reel.addEventListener('lostpointercapture',endHold);
  reel.addEventListener('click',function(e){if(e.detail===0&&!blocked()&&phase==='fight'){latched=!latched;syncHeld();}});
  canvas.addEventListener('pointerdown',function(e){if(blocked())return;if(phase==='fight')beginHold(e);else{if(e.preventDefault)e.preventDefault();cast();}});
  canvas.addEventListener('pointerup',endHold);canvas.addEventListener('pointercancel',endHold);canvas.addEventListener('lostpointercapture',endHold);document.addEventListener('pointerup',endHold);
  document.addEventListener('keydown',keyDown);document.addEventListener('keyup',keyUp);
  onPause=function(){clearHeld();lastFrame=0;update();};onResume=function(){lastFrame=0;update();};onStart=function(){lastFrame=0;update();status(document.getElementById('fishing-cue').textContent+'。'+document.getElementById('fishing-note').textContent);};
  function frame(now){if(!blocked()){var dt=lastFrame?Math.min(.05,Math.max(0,(now-lastFrame)/1000)):0;lastFrame=now;step(dt);render();}else lastFrame=0;requestAnimationFrame(frame);}
  stages(3);restart();requestAnimationFrame(frame);


  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;update();}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
