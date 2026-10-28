/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:zuma';
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

  var chain=[],shots=[],score=0,loaded=0,reserve=1,aimAngle=-Math.PI/2,feed=0,spawned=0,speed=12,cooldown=0;
  var palette=['#d86859','#438b78','#538cbf','#d6a235'];
  var zfx=[],recoil=0,swapFlash=0,trackPoints=[],trackLength=0;
  // 按曲线实际弧长采样，避免波峰处彩球挤作一团。
  for(var ti=0;ti<=420;ti++){var ta=ti/420,tp={x:70+ta*460,y:260+130*Math.sin(ta*Math.PI*3)};if(ti)trackLength+=Math.hypot(tp.x-trackPoints[ti-1].x,tp.y-trackPoints[ti-1].y);tp.d=trackLength;trackPoints.push(tp);}
  function track(s){var d=Math.max(0,Math.min(1050,s))/1050*trackLength,lo=0,hi=trackPoints.length-1;while(hi-lo>1){var mid=(lo+hi)>>1;if(trackPoints[mid].d<d)lo=mid;else hi=mid;}var a=trackPoints[lo],b=trackPoints[hi],t=(d-a.d)/(b.d-a.d||1);return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
  function collapse(index,combo){combo=combo||1;if(!chain.length)return;index=Math.min(chain.length-1,Math.max(0,index));var a=index,b=index,c=chain[index].c;while(a>0&&chain[a-1].c===c)a--;while(b<chain.length-1&&chain[b+1].c===c)b++;if(b-a+1>=3){var at=chain[a].s,center=track(chain[Math.floor((a+b)/2)].s);if(!reduce)zfx.push({x:center.x,y:center.y,t:.85,life:.85,label:combo>1?combo+' 连锁 · +'+((b-a+1)*10):'+'+((b-a+1)*10),c:palette[c]});status((combo>1?combo+' 连锁！':'消除！')+'获得 '+((b-a+1)*10)+' 分。');for(var i=a;i<=b;i++){var p=track(chain[i].s);burst(p.x,p.y,palette[c]);}score+=(b-a+1)*10;chain.splice(a,b-a+1);for(i=a;i<chain.length;i++)chain[i].s=at+(i-a)*35;render();if(a>0&&a<chain.length&&chain[a-1].c===chain[a].c)collapse(a,combo+1);}}
  function shoot(){if(blocked()||cooldown)return;shots.push({x:300,y:508,vx:Math.cos(aimAngle)*620,vy:Math.sin(aimAngle)*620,c:loaded});loaded=reserve;reserve=Math.floor(Math.random()*palette.length);cooldown=.27;recoil=.2;sound(540);}
  function step(dt){recoil=Math.max(0,recoil-dt);swapFlash=Math.max(0,swapFlash-dt);zfx=zfx.filter(function(f){f.t-=dt;return f.t>0;});cooldown=Math.max(0,cooldown-dt);feed-=dt;if(spawned<30&&feed<=0&&(!chain.length||chain[0].s>38)){chain.unshift({s:0,c:Math.floor(Math.random()*4)});spawned++;feed=1;render();}chain.forEach(function(b){b.s+=speed*dt;});shots.forEach(function(b){b.x+=b.vx*dt;b.y+=b.vy*dt;var i=chain.findIndex(function(c){var p=track(c.s);return Math.hypot(b.x-p.x,b.y-p.y)<31;});if(i>=0){var p=track(chain[i].s),prev=track(chain[i].s-10),dot=(b.x-p.x)*(p.x-prev.x)+(b.y-p.y)*(p.y-prev.y),at=dot>0?i+1:i,s=at<chain.length?chain[at].s:chain[i].s+35;chain.splice(at,0,{s:s,c:b.c});for(var j=at+1;j<chain.length;j++)chain[j].s=Math.max(chain[j].s,chain[j-1].s+35);b.dead=true;collapse(at);}});shots=shots.filter(function(b){return !b.dead&&b.x>-30&&b.x<630&&b.y>-30&&b.y<630;});chain.forEach(function(b){b.visualS=reduce?b.s:b.visualS===undefined?b.s:b.visualS+(b.s-b.visualS)*Math.min(1,dt*18);});if(chain.some(function(b){return b.s>=1050;})){record(score,false);finish('球链抵达终点。试试提前消除前端同色组。');render();}else if(spawned===30&&!chain.length){win('30颗轨道球全部消除，得分 '+score+'。',score,false);render();}}
  function render(){hud(score,'已入轨 '+spawned+'/30 · 轨道剩余 '+chain.length,'三连消除 · 缺口自动闭合');}
  function restart(){begin();zfx=[];recoil=swapFlash=0;chain=[];shots=[];score=0;loaded=0;reserve=1;spawned=0;feed=0;cooldown=0;speed={easy:9,normal:12,hard:17}[activeOption]||12;render();status('瞄准同色球组发射，X交换备用球；守住右侧终点。');}
  function ball(p,c,r){
    r=r||14.5;circle(p.x+1,p.y+3,r+1,'#314d4233');circle(p.x,p.y,r,palette[c]);
    ctx.beginPath();ctx.arc(p.x,p.y,r-1,0,Math.PI*2);ctx.strokeStyle=['#a34339','#2b6557','#36688f','#9a7123'][c];ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.arc(p.x-1,p.y-1,r*.72,Math.PI*1.03,Math.PI*1.8);ctx.strokeStyle='#ffffff70';ctx.lineWidth=2;ctx.stroke();
    circle(p.x-r*.35,p.y-r*.4,r*.18,'#ffffffb0');circle(p.x,p.y+1,r*.49,'#203b3638');text(c+1,p.x,p.y+1,Math.max(11,r*.78),'#fff');
  }
  function trackStroke(width,color,offset){ctx.beginPath();for(var s=0;s<=1050;s+=3){var p=track(s);if(!s)ctx.moveTo(p.x,p.y+(offset||0));else ctx.lineTo(p.x,p.y+(offset||0));}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();}
  function leaf(x,y,size,angle){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.ellipse(0,0,size*.4,size,0,0,Math.PI*2);ctx.fillStyle='#79976a';ctx.fill();line(0,-size*.7,0,size*.7,'#a8bd87',1);ctx.restore();}
  function draw(){
    ctx.clearRect(0,0,600,600);rect(0,0,600,600,'#e7ecdb',0);
    // 固定位置的石片与叶簇不使用逐帧随机数，保持暂停画面稳定。
    for(var i=0;i<24;i++){var x=20+(i*137)%557,y=95+(i*73)%330;circle(x,y,2+i%3,'#d1dac2');}
    [[27,107],[563,112],[32,415],[568,425]].forEach(function(p,k){leaf(p[0],p[1],20,-.8);leaf(p[0]+13,p[1]+7,16,.65);});
    rect(22,18,556,53,'#f8f8eb',12);text('彩珠秘径',43,38,19,'#435f4f','left');text('三颗同色相连消除 · X 交换',43,58,12,'#64765f','left');
    text('入轨 '+spawned+' / 30',488,39,15,'#435f4f');rect(422,54,132,5,'#d5dec8',2);if(spawned)rect(422,54,132*spawned/30,5,'#7e9b6b',2);
    trackStroke(49,'#9da98b',3);trackStroke(46,'#c0c9ac');trackStroke(35,'#87947c');trackStroke(29,'#74836f');trackStroke(23,'#899780');
    for(var s=18;s<1050;s+=58){var p=track(s),q=track(s+1),a=Math.atan2(q.y-p.y,q.x-p.x)+Math.PI/2;line(p.x+Math.cos(a)*18,p.y+Math.sin(a)*18,p.x+Math.cos(a)*23,p.y+Math.sin(a)*23,'#dce2cb',2);}
    var entry=track(0),end=track(1050),danger=chain.some(function(b){return b.s>870;});
    circle(entry.x,entry.y,25,'#b2bda0');circle(entry.x,entry.y,19,'#435b4c');circle(entry.x,entry.y,13,'#293e35');
    circle(end.x,end.y,30,'#9ca88c');circle(end.x,end.y,24,danger?'#9e6350':'#5a705b');circle(end.x,end.y,17,'#283d34');text('终',end.x,end.y,14,'#f4e7c5');
    if(danger){ctx.globalAlpha=reduce?.9:.55+.3*Math.sin(anim*6);ctx.beginPath();ctx.arc(end.x,end.y,34,0,Math.PI*2);ctx.strokeStyle='#b6644e';ctx.lineWidth=3;ctx.stroke();ctx.globalAlpha=1;}
    chain.forEach(function(b){ball(track(b.visualS===undefined?b.s:b.visualS),b.c);});
    shots.forEach(function(b){if(!reduce){for(var k=3;k>0;k--){ctx.globalAlpha=.12*(4-k);circle(b.x-b.vx/620*k*10,b.y-b.vy/620*k*10,Math.max(2,10-k*2),palette[b.c]);}ctx.globalAlpha=1;}ball(b,b.c,12);});
    // 石雕发射台与瞄准线使用实际发射原点，后坐力仅影响装饰炮筒。
    var dx=Math.cos(aimAngle),dy=Math.sin(aimAngle);
    ctx.save();ctx.setLineDash([3,9]);line(300+dx*55,508+dy*55,300+dx*155,508+dy*155,'#8b9b78',2);ctx.setLineDash([]);ctx.restore();
    circle(300,515,42,'#bcc5a6');circle(300,510,37,'#6a8567');circle(300,508,30,'#93ad7d');
    for(var j=0;j<8;j++){var a=j*Math.PI/4;circle(300+Math.cos(a)*31,508+Math.sin(a)*31,3,'#c8d5b2');}
    var back=reduce?0:recoil/.2*7;line(300-dx*back,508-dy*back,300+dx*(45-back),508+dy*(45-back),'#486951',25);line(300-dy*5,508+dx*5,300+dx*(38-back)-dy*5,508+dy*(38-back)+dx*5,'#a6bd8d',4);
    ball({x:300,y:508},loaded,20);
    if(recoil&&!reduce){ctx.globalAlpha=recoil/.2*.7;circle(300+dx*53,508+dy*53,8+recoil*25,'#f8e1a0');ctx.globalAlpha=1;}
    circle(391,523,23,swapFlash?'#e0c17b':'#c2ccb0');circle(391,523,19,'#7b8f71');ball({x:391,y:523},reserve,14);text('备用 / X',391,557,13,'#52674f');
    text('瞄准球链，点击发射',220,575,14,'#52674f');
    zfx.forEach(function(f){var t=1-f.t/f.life;ctx.globalAlpha=Math.min(1,f.t*3);ctx.beginPath();ctx.arc(f.x,f.y,18+t*35,0,Math.PI*2);ctx.strokeStyle=f.c;ctx.lineWidth=3*(1-t)+1;ctx.stroke();text(f.label,f.x,f.y-26-t*28,19,'#365c48');ctx.globalAlpha=1;});
  }
  canvas.addEventListener('pointermove',function(e){var p=point(e);if(!blocked())aimAngle=Math.atan2(p.y-508,p.x-300);});canvas.addEventListener('click',function(e){if(blocked())return;var p=point(e);aimAngle=Math.atan2(p.y-508,p.x-300);shoot();});listen('fire',shoot);function swap(){swapFlash=.25;var c=loaded;loaded=reserve;reserve=c;status('已交换当前球与备用球。');}listen('swap',swap);keyInput(function(e){if(e.key===' '){e.preventDefault();shoot();}if(e.key.toLowerCase()==='x')swap();if(e.key==='ArrowLeft')aimAngle-=.12;if(e.key==='ArrowRight')aimAngle+=.12;});restart();

  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
