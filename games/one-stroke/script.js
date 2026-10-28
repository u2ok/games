/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:one-stroke:v2';
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
  try { var saved = JSON.parse(read(key + ':settings') || read('mini-games:one-stroke:settings')); if (saved && typeof saved === 'object') { settings.sound = saved.sound === true; settings.option = saved.option; } } catch (error) { /* 历史设置损坏时使用默认值。 */ }
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
  function stages(count){stageCount=count;loadProgress();renderStages();}
  function renderStages(){document.getElementById('level-section').hidden=stageCount===1;document.getElementById('level-list').innerHTML=Array.from({length:stageCount},function(_,i){return '<button data-stage="'+i+'" aria-pressed="'+(i===stageIndex)+'"'+(i>unlocked?' disabled':'')+'>'+ (i+1) +'</button>';}).join('');write('level-hint','已解锁 '+(unlocked+1)+'/'+stageCount+' 关；切换会重开。');save(key+':current:'+activeOption,String(stageIndex));}
  function complete(note){won=true;unlocked=Math.min(stageCount-1,Math.max(unlocked,stageIndex+1));save(key+':unlocked:'+activeOption,String(unlocked));renderStages();finish('成功！'+note);showCover('挑战完成',note,stageIndex<stageCount-1?'下一关':'再玩一局');syncStart();}
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

  // 固化关卡由离线结构筛选生成；运行时不随机换图，便于复盘与独立纪录。
  var levelBook = {"easy":[{"nodes":[[170,117],[300,117],[170,247],[300,247],[430,247],[170,377],[300,377],[170,507],[300,507]],"edges":[[0,1],[0,2],[1,3],[2,5],[3,4],[3,6],[5,6],[5,7],[5,8],[7,8]],"meta":{"branches":2,"cycles":2,"risk":0.391,"score":20.525},"name":"折线初探 01"},{"nodes":[[170,117],[170,247],[300,247],[170,377],[300,377],[430,377],[170,507],[300,507]],"edges":[[0,1],[0,2],[1,2],[2,3],[2,5],[3,4],[3,6],[3,7],[4,5],[6,7]],"meta":{"branches":2,"cycles":3,"risk":0.484,"score":22.975},"name":"折线初探 02"},{"nodes":[[105,117],[235,117],[365,117],[495,117],[105,247],[235,247],[365,247],[495,247],[105,377],[235,377],[495,377],[365,507]],"edges":[[0,1],[0,4],[1,4],[1,5],[1,6],[2,3],[2,6],[3,7],[4,5],[4,8],[7,10],[9,11],[10,11]],"meta":{"branches":2,"cycles":2,"risk":0.469,"score":24.15},"name":"折线初探 03"},{"nodes":[[235,117],[365,117],[105,247],[235,247],[365,247],[235,377],[365,377],[495,377],[105,507],[235,507]],"edges":[[0,1],[0,4],[1,4],[2,3],[2,5],[4,5],[4,6],[4,7],[5,8],[5,9],[6,7],[8,9]],"meta":{"branches":2,"cycles":3,"risk":0.469,"score":24.85},"name":"折线初探 04"},{"nodes":[[235,117],[365,117],[495,117],[105,247],[235,247],[365,247],[105,377],[235,377],[365,377],[105,507],[235,507],[365,507]],"edges":[[0,1],[0,4],[1,2],[2,5],[3,4],[3,7],[4,5],[4,7],[6,7],[6,9],[7,10],[7,11],[8,11],[9,10]],"meta":{"branches":2,"cycles":3,"risk":0.375,"score":26.1},"name":"折线初探 05"},{"nodes":[[105,117],[235,117],[365,117],[495,117],[105,247],[235,247],[365,247],[105,377],[235,377],[365,377],[105,507],[365,507]],"edges":[[0,1],[0,4],[1,2],[2,3],[3,6],[4,5],[5,6],[6,8],[6,9],[7,8],[7,10],[8,10],[8,11],[9,11]],"meta":{"branches":2,"cycles":3,"risk":0.484,"score":26.975},"name":"折线初探 06"},{"nodes":[[235,117],[105,247],[235,247],[365,247],[495,247],[105,377],[235,377],[365,377],[495,377],[105,507],[235,507],[365,507],[495,507]],"edges":[[0,1],[0,2],[1,2],[2,3],[2,6],[3,4],[4,8],[5,6],[5,9],[6,7],[6,10],[7,11],[8,12],[9,10],[11,12]],"meta":{"branches":2,"cycles":3,"risk":0.531,"score":28.35},"name":"折线初探 07"},{"nodes":[[105,117],[235,117],[495,117],[105,247],[235,247],[365,247],[495,247],[235,377],[365,377],[495,377],[105,507],[235,507],[365,507],[495,507]],"edges":[[0,1],[0,3],[1,4],[2,5],[2,6],[3,7],[4,7],[5,6],[5,7],[5,8],[7,10],[8,9],[9,13],[10,11],[11,12],[12,13]],"meta":{"branches":2,"cycles":3,"risk":0.562,"score":29.6},"name":"折线初探 08"},{"nodes":[[105,117],[235,117],[365,117],[495,117],[105,247],[235,247],[365,247],[495,247],[105,377],[235,377],[365,377],[495,377],[105,507],[235,507]],"edges":[[0,1],[0,4],[1,5],[2,3],[2,6],[3,6],[4,8],[5,6],[6,7],[7,11],[8,9],[8,12],[9,10],[9,13],[10,11],[12,13]],"meta":{"branches":3,"cycles":3,"risk":0.391,"score":30.225},"name":"折线初探 09"},{"nodes":[[105,117],[235,117],[365,117],[495,117],[105,247],[235,247],[365,247],[235,377],[105,507],[235,507]],"edges":[[0,1],[0,4],[1,5],[2,3],[2,6],[3,6],[4,5],[5,6],[5,7],[6,7],[7,8],[7,9],[8,9]],"meta":{"branches":3,"cycles":4,"risk":0.641,"score":30.925},"name":"折线初探 10"},{"nodes":[[235,117],[365,117],[105,247],[235,247],[365,247],[495,247],[105,377],[235,377],[365,377],[495,377],[105,507],[365,507],[495,507]],"edges":[[0,1],[0,3],[1,4],[2,3],[2,6],[3,4],[3,7],[4,8],[5,9],[6,10],[7,10],[8,9],[9,11],[9,12],[11,12]],"meta":{"branches":3,"cycles":3,"risk":0.703,"score":31.725},"name":"折线初探 11"},{"nodes":[[235,117],[365,117],[105,247],[235,247],[365,247],[495,247],[105,377],[235,377],[365,377],[495,377],[105,507],[235,507],[365,507],[495,507]],"edges":[[0,1],[0,2],[1,4],[2,3],[3,4],[4,5],[4,7],[5,9],[6,7],[6,10],[7,8],[7,12],[8,12],[9,13],[11,12],[12,13]],"meta":{"branches":3,"cycles":3,"risk":0.672,"score":32.475},"name":"折线初探 12"},{"nodes":[[105,117],[235,117],[365,117],[105,247],[235,247],[365,247],[105,377],[235,377],[365,377],[495,377],[105,507],[365,507],[495,507]],"edges":[[0,1],[0,3],[1,2],[2,5],[3,4],[3,6],[3,7],[4,7],[5,9],[6,10],[7,8],[7,10],[8,9],[9,11],[9,12],[11,12]],"meta":{"branches":3,"cycles":4,"risk":0.594,"score":33.55},"name":"折线初探 13"},{"nodes":[[235,117],[365,117],[105,247],[235,247],[365,247],[105,377],[235,377],[365,377],[495,377],[105,507],[365,507],[495,507]],"edges":[[0,1],[0,3],[1,4],[2,5],[2,6],[3,4],[3,6],[4,7],[5,9],[6,7],[6,9],[7,8],[7,10],[8,11],[10,11]],"meta":{"branches":4,"cycles":4,"risk":0.625,"score":34.8},"name":"折线初探 14"},{"nodes":[[235,117],[105,247],[235,247],[365,247],[495,247],[235,377],[365,377],[495,377],[235,507],[365,507],[495,507]],"edges":[[0,2],[0,3],[1,2],[1,5],[3,5],[3,6],[4,7],[5,6],[5,8],[6,7],[6,9],[7,9],[7,10],[8,9],[9,10]],"meta":{"branches":5,"cycles":5,"risk":0.328,"score":36.125},"name":"折线初探 15"},{"nodes":[[235,117],[365,117],[495,117],[105,247],[235,247],[365,247],[495,247],[235,377],[365,377],[495,377],[235,507],[365,507],[495,507]],"edges":[[0,1],[0,3],[0,4],[0,5],[1,2],[2,6],[3,7],[4,7],[5,8],[6,9],[7,10],[7,11],[8,9],[9,11],[9,12],[10,11],[11,12]],"meta":{"branches":4,"cycles":5,"risk":0.469,"score":37.25},"name":"折线初探 16"},{"nodes":[[105,117],[235,117],[365,117],[105,247],[235,247],[365,247],[105,377],[235,377],[365,377],[495,377],[105,507],[235,507],[365,507],[495,507]],"edges":[[0,1],[0,3],[1,2],[1,4],[1,5],[2,5],[3,4],[3,6],[3,7],[5,7],[5,8],[6,10],[8,12],[9,12],[9,13],[10,11],[11,12],[12,13]],"meta":{"branches":4,"cycles":5,"risk":0.5,"score":38.5},"name":"折线初探 17"},{"nodes":[[105,117],[235,117],[365,117],[495,117],[105,247],[235,247],[365,247],[495,247],[235,377],[495,377],[105,507],[235,507],[365,507],[495,507]],"edges":[[0,1],[0,4],[1,2],[1,5],[1,6],[2,3],[3,7],[4,8],[5,6],[6,8],[6,9],[7,9],[8,10],[8,11],[9,12],[9,13],[10,11],[12,13]],"meta":{"branches":4,"cycles":5,"risk":0.766,"score":40.625},"name":"折线初探 18"},{"nodes":[[235,117],[105,247],[235,247],[365,247],[105,377],[235,377],[365,377],[495,377],[235,507],[365,507],[495,507]],"edges":[[0,2],[0,3],[1,2],[1,4],[1,5],[2,3],[3,6],[3,7],[4,5],[5,8],[5,9],[6,7],[7,9],[7,10],[8,9],[9,10]],"meta":{"branches":6,"cycles":6,"risk":0.594,"score":42.95},"name":"折线初探 19"},{"nodes":[[105,117],[235,117],[365,117],[495,117],[105,247],[235,247],[365,247],[495,247],[105,377],[235,377],[365,377],[495,377],[105,507],[235,507]],"edges":[[0,1],[0,4],[1,2],[1,4],[1,5],[2,3],[2,6],[4,5],[4,8],[5,6],[5,9],[6,7],[6,10],[7,11],[8,9],[9,12],[9,13],[10,11],[12,13]],"meta":{"branches":6,"cycles":6,"risk":0.797,"score":47.575},"name":"折线初探 20"}],"normal":[{"nodes":[[190,147],[410,147],[80,257],[300,257],[410,257],[520,257],[80,367],[190,367],[300,367],[410,367],[520,367],[80,477],[190,477],[300,477],[520,477]],"edges":[[0,2],[0,3],[1,3],[1,5],[2,6],[3,4],[3,7],[4,9],[5,10],[6,11],[7,8],[7,11],[7,12],[8,9],[9,13],[9,14],[10,14],[11,12],[12,13]],"meta":{"branches":5,"cycles":5,"risk":0.281,"score":39.75},"name":"回廊推演 01"},{"nodes":[[80,147],[190,147],[300,147],[410,147],[520,147],[80,257],[190,257],[300,257],[410,257],[520,257],[190,367],[300,367],[410,367],[410,477],[520,477]],"edges":[[0,1],[0,5],[1,2],[1,6],[1,7],[3,4],[3,8],[3,9],[4,9],[5,6],[6,7],[6,10],[7,11],[7,12],[8,12],[10,11],[12,13],[12,14],[13,14]],"meta":{"branches":5,"cycles":5,"risk":0.609,"score":42.375},"name":"回廊推演 02"},{"nodes":[[80,147],[190,147],[80,257],[190,257],[300,257],[80,367],[190,367],[300,367],[410,367],[520,367],[80,477],[190,477],[300,477],[410,477],[520,477]],"edges":[[0,1],[0,2],[1,2],[1,3],[1,4],[2,3],[2,5],[3,4],[3,6],[5,10],[6,12],[7,8],[7,12],[8,9],[8,13],[8,14],[9,14],[10,11],[12,13]],"meta":{"branches":5,"cycles":5,"risk":0.781,"score":43.75},"name":"回廊推演 03"},{"nodes":[[80,147],[190,147],[300,147],[410,147],[80,257],[190,257],[300,257],[410,257],[520,257],[190,367],[300,367],[410,367],[520,367],[80,477],[190,477],[300,477],[410,477],[520,477]],"edges":[[0,1],[0,4],[1,2],[2,3],[3,8],[4,5],[5,6],[6,7],[6,10],[6,11],[7,8],[8,11],[8,12],[9,13],[9,15],[10,11],[10,15],[12,17],[13,14],[14,15],[15,16],[16,17]],"meta":{"branches":5,"cycles":5,"risk":0.469,"score":44.25},"name":"回廊推演 04"},{"nodes":[[80,147],[190,147],[300,147],[410,147],[520,147],[80,257],[190,257],[300,257],[410,257],[520,257],[190,367],[300,367],[410,367],[520,367],[80,477],[190,477],[300,477],[520,477]],"edges":[[0,5],[1,2],[1,5],[1,7],[2,3],[3,4],[3,8],[3,9],[4,9],[5,6],[5,10],[6,7],[8,9],[9,13],[10,11],[10,14],[10,15],[11,16],[12,16],[12,17],[13,17],[14,15]],"meta":{"branches":5,"cycles":5,"risk":0.547,"score":44.875},"name":"回廊推演 05"},{"nodes":[[300,147],[410,147],[520,147],[300,257],[410,257],[520,257],[80,367],[190,367],[300,367],[410,367],[80,477],[190,477],[300,477],[410,477],[520,477]],"edges":[[0,1],[0,3],[1,2],[1,4],[1,5],[2,5],[3,7],[4,5],[5,9],[6,7],[6,10],[7,11],[7,12],[8,9],[8,12],[9,12],[9,14],[10,11],[12,13],[13,14]],"meta":{"branches":5,"cycles":6,"risk":0.656,"score":45.45},"name":"回廊推演 06"},{"nodes":[[190,147],[300,147],[410,147],[80,257],[190,257],[300,257],[410,257],[520,257],[80,367],[190,367],[300,367],[410,367],[520,367],[300,477],[410,477],[520,477]],"edges":[[0,3],[0,4],[1,2],[1,5],[2,5],[2,6],[2,7],[3,8],[4,9],[5,6],[5,9],[6,7],[6,11],[8,9],[9,10],[10,13],[11,12],[11,13],[11,14],[12,15],[14,15]],"meta":{"branches":5,"cycles":6,"risk":0.656,"score":46.45},"name":"回廊推演 07"},{"nodes":[[80,147],[190,147],[300,147],[410,147],[520,147],[80,257],[300,257],[410,257],[520,257],[80,367],[190,367],[300,367],[410,367],[80,477],[300,477]],"edges":[[0,1],[0,5],[1,2],[3,4],[3,7],[3,8],[4,8],[5,10],[6,7],[6,11],[7,8],[7,12],[8,12],[9,10],[9,13],[10,11],[10,13],[11,12],[11,14],[12,14]],"meta":{"branches":6,"cycles":6,"risk":0.625,"score":47.2},"name":"回廊推演 08"},{"nodes":[[410,147],[520,147],[80,257],[190,257],[300,257],[410,257],[520,257],[80,367],[190,367],[300,367],[410,367],[80,477],[190,477],[300,477],[410,477],[520,477]],"edges":[[0,1],[0,5],[1,6],[2,3],[2,7],[3,8],[4,5],[4,8],[4,9],[4,10],[5,6],[5,10],[7,11],[8,9],[8,12],[10,13],[10,15],[11,12],[12,13],[13,14],[14,15]],"meta":{"branches":6,"cycles":6,"risk":0.594,"score":47.95},"name":"回廊推演 09"},{"nodes":[[190,147],[300,147],[410,147],[80,257],[190,257],[300,257],[410,257],[520,257],[80,367],[190,367],[300,367],[410,367],[520,367],[190,477],[300,477],[410,477]],"edges":[[0,1],[0,5],[1,2],[1,5],[2,6],[2,7],[3,8],[3,9],[4,5],[4,9],[5,10],[6,7],[7,11],[7,12],[8,9],[9,13],[10,11],[11,12],[11,15],[13,14],[14,15]],"meta":{"branches":6,"cycles":6,"risk":0.656,"score":48.45},"name":"回廊推演 10"},{"nodes":[[80,147],[190,147],[410,147],[520,147],[80,257],[190,257],[300,257],[410,257],[520,257],[80,367],[190,367],[300,367],[410,367],[300,477]],"edges":[[0,1],[0,4],[1,4],[1,5],[1,6],[2,3],[2,6],[3,8],[4,5],[4,9],[5,6],[5,10],[6,11],[7,8],[7,12],[9,10],[10,11],[10,13],[11,12],[11,13]],"meta":{"branches":6,"cycles":7,"risk":0.609,"score":48.775},"name":"回廊推演 11"},{"nodes":[[80,147],[190,147],[300,147],[410,147],[520,147],[80,257],[300,257],[410,257],[520,257],[80,367],[190,367],[300,367],[410,367],[520,367],[190,477],[300,477],[410,477],[520,477]],"edges":[[0,1],[0,5],[1,5],[2,3],[2,6],[3,4],[3,6],[3,7],[4,8],[5,9],[5,10],[6,10],[6,11],[7,12],[8,13],[9,10],[10,14],[11,12],[12,16],[12,17],[13,17],[14,15],[15,16]],"meta":{"branches":5,"cycles":6,"risk":0.797,"score":49.575},"name":"回廊推演 12"},{"nodes":[[80,147],[190,147],[80,257],[190,257],[300,257],[410,257],[520,257],[80,367],[190,367],[300,367],[410,367],[520,367],[80,477],[190,477],[300,477],[520,477]],"edges":[[0,1],[0,2],[1,2],[2,3],[2,7],[3,4],[4,5],[4,8],[4,9],[5,10],[6,10],[6,11],[7,12],[8,9],[8,13],[8,14],[9,10],[9,14],[10,11],[10,15],[11,15],[12,13]],"meta":{"branches":6,"cycles":7,"risk":0.609,"score":50.775},"name":"回廊推演 13"},{"nodes":[[80,147],[190,147],[300,147],[410,147],[520,147],[80,257],[190,257],[300,257],[410,257],[520,257],[80,367],[190,367],[300,367],[410,367],[520,367],[80,477],[190,477],[300,477],[410,477],[520,477]],"edges":[[0,1],[0,5],[1,2],[2,7],[3,4],[3,8],[4,9],[5,6],[6,7],[7,8],[7,11],[8,9],[8,13],[9,13],[9,14],[10,11],[10,15],[12,13],[12,17],[13,18],[14,19],[15,16],[16,17],[17,18],[18,19]],"meta":{"branches":6,"cycles":6,"risk":0.547,"score":51.575},"name":"回廊推演 14"},{"nodes":[[80,147],[190,147],[300,147],[410,147],[80,257],[190,257],[300,257],[410,257],[520,257],[80,367],[190,367],[300,367],[410,367],[520,367],[80,477],[190,477],[300,477],[410,477],[520,477]],"edges":[[0,1],[1,2],[1,4],[2,6],[3,7],[3,8],[4,9],[5,6],[5,10],[6,7],[6,11],[7,8],[7,12],[8,12],[8,13],[9,10],[10,14],[10,16],[11,12],[12,17],[13,18],[14,15],[15,16],[17,18]],"meta":{"branches":6,"cycles":6,"risk":0.781,"score":52.45},"name":"回廊推演 15"},{"nodes":[[80,147],[190,147],[300,147],[410,147],[80,257],[190,257],[300,257],[410,257],[520,257],[80,367],[190,367],[300,367],[410,367],[520,367],[300,477]],"edges":[[0,1],[0,4],[1,2],[1,5],[1,6],[2,3],[3,7],[4,5],[4,9],[4,10],[6,7],[6,11],[6,12],[7,8],[7,12],[8,13],[9,10],[10,11],[10,14],[11,12],[11,14],[12,13]],"meta":{"branches":7,"cycles":8,"risk":0.484,"score":53.475},"name":"回廊推演 16"},{"nodes":[[80,147],[190,147],[300,147],[410,147],[520,147],[80,257],[190,257],[300,257],[520,257],[80,367],[190,367],[300,367],[410,367],[520,367],[80,477],[190,477],[300,477],[410,477],[520,477]],"edges":[[0,1],[0,5],[1,2],[1,5],[1,6],[2,3],[3,4],[3,7],[3,8],[4,8],[5,9],[5,10],[6,7],[7,11],[7,12],[9,14],[10,11],[10,14],[10,15],[12,13],[12,16],[12,17],[13,18],[15,16],[17,18]],"meta":{"branches":6,"cycles":7,"risk":0.719,"score":54.65},"name":"回廊推演 17"},{"nodes":[[190,147],[300,147],[410,147],[520,147],[80,257],[190,257],[300,257],[410,257],[520,257],[80,367],[190,367],[300,367],[410,367],[520,367],[190,477],[300,477],[410,477],[520,477]],"edges":[[0,1],[0,6],[1,6],[2,3],[2,8],[3,8],[4,5],[4,9],[5,10],[6,7],[6,11],[7,8],[7,12],[9,10],[10,11],[10,14],[11,12],[11,15],[12,13],[12,15],[13,17],[14,15],[15,16],[16,17]],"meta":{"branches":7,"cycles":7,"risk":0.812,"score":56.4},"name":"回廊推演 18"},{"nodes":[[190,147],[300,147],[410,147],[520,147],[80,257],[190,257],[300,257],[410,257],[520,257],[80,367],[190,367],[300,367],[410,367],[520,367],[190,477],[300,477],[410,477],[520,477]],"edges":[[0,1],[0,5],[1,2],[2,3],[2,7],[2,8],[3,8],[4,5],[4,9],[5,6],[5,10],[6,7],[7,8],[7,12],[8,13],[9,10],[10,14],[10,15],[11,12],[12,15],[12,16],[12,17],[13,17],[14,15],[15,16]],"meta":{"branches":7,"cycles":8,"risk":0.688,"score":58.1},"name":"回廊推演 19"},{"nodes":[[190,147],[300,147],[410,147],[520,147],[80,257],[190,257],[300,257],[520,257],[80,367],[190,367],[300,367],[410,367],[520,367],[80,477],[190,477],[300,477],[410,477],[520,477]],"edges":[[0,1],[0,4],[0,5],[0,6],[1,2],[1,6],[2,3],[2,7],[3,7],[4,5],[5,6],[5,9],[6,10],[7,11],[7,12],[8,9],[8,13],[9,13],[9,14],[10,15],[11,12],[11,15],[11,17],[14,15],[15,16],[16,17]],"meta":{"branches":9,"cycles":9,"risk":0.75,"score":65.3},"name":"回廊推演 20"}],"hard":[{"nodes":[[202,117],[300,117],[398,117],[495,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[398,312],[495,312],[105,410],[202,410],[300,410],[398,410],[495,410],[105,507],[202,507],[300,507],[398,507]],"edges":[[0,1],[0,4],[1,2],[1,6],[2,3],[2,7],[3,8],[4,5],[5,10],[6,7],[6,10],[6,11],[7,8],[7,11],[8,11],[8,12],[9,10],[9,13],[10,14],[11,17],[12,17],[13,18],[14,15],[15,16],[16,17],[17,21],[18,19],[19,20],[20,21]],"meta":{"branches":8,"cycles":8,"risk":0.328,"score":61.225},"name":"交织挑战 01"},{"nodes":[[300,117],[398,117],[105,214],[202,214],[300,214],[398,214],[495,214],[202,312],[300,312],[398,312],[495,312],[105,410],[202,410],[300,410],[398,410],[495,410],[105,507],[202,507],[398,507],[495,507]],"edges":[[0,1],[1,5],[1,6],[2,3],[2,7],[3,4],[4,5],[4,7],[4,8],[6,10],[7,8],[7,12],[8,9],[8,13],[9,10],[9,13],[9,14],[11,16],[11,17],[12,17],[13,17],[13,18],[14,18],[15,18],[15,19],[16,17],[18,19]],"meta":{"branches":8,"cycles":8,"risk":0.844,"score":63.35},"name":"交织挑战 02"},{"nodes":[[105,117],[202,117],[300,117],[398,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[495,312],[105,410],[202,410],[300,410],[398,410],[495,410],[105,507],[202,507],[300,507]],"edges":[[0,1],[0,4],[1,2],[1,5],[1,6],[2,3],[3,8],[4,5],[4,9],[4,10],[6,11],[7,8],[7,12],[8,12],[8,13],[9,14],[10,11],[10,14],[10,16],[12,13],[13,18],[14,15],[14,19],[15,16],[16,17],[16,21],[17,18],[19,20],[20,21]],"meta":{"branches":8,"cycles":8,"risk":0.672,"score":63.975},"name":"交织挑战 03"},{"nodes":[[105,117],[202,117],[300,117],[398,117],[495,117],[105,214],[202,214],[300,214],[398,214],[495,214],[202,312],[398,312],[105,410],[202,410],[300,410],[398,410],[495,410],[105,507],[202,507],[300,507],[398,507]],"edges":[[0,1],[0,5],[1,2],[1,6],[1,7],[2,3],[3,4],[3,7],[3,8],[4,9],[5,6],[6,7],[6,10],[7,10],[8,11],[9,11],[10,12],[10,13],[11,15],[11,16],[12,13],[12,17],[13,18],[14,15],[14,19],[16,20],[17,18],[19,20]],"meta":{"branches":8,"cycles":8,"risk":0.859,"score":64.475},"name":"交织挑战 04"},{"nodes":[[202,117],[300,117],[398,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[495,312],[105,410],[202,410],[300,410],[398,410],[495,410],[105,507],[202,507],[300,507],[398,507],[495,507]],"edges":[[0,1],[0,3],[1,2],[2,6],[3,4],[3,8],[3,9],[4,5],[5,6],[5,9],[5,11],[6,7],[6,11],[7,12],[8,9],[9,13],[10,11],[10,15],[11,12],[13,14],[13,18],[13,19],[14,15],[15,16],[15,19],[16,17],[17,22],[18,19],[19,20],[21,22]],"meta":{"branches":8,"cycles":8,"risk":0.688,"score":65.1},"name":"交织挑战 05"},{"nodes":[[202,117],[398,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[398,312],[495,312],[105,410],[202,410],[300,410],[398,410],[495,410],[105,507],[202,507],[300,507],[398,507]],"edges":[[0,3],[0,4],[1,4],[1,6],[2,3],[2,7],[3,4],[3,8],[4,9],[5,6],[5,9],[6,9],[6,10],[7,8],[8,11],[8,12],[9,14],[10,15],[11,12],[11,16],[11,17],[13,14],[13,17],[13,18],[13,19],[15,19],[16,17],[17,18]],"meta":{"branches":8,"cycles":9,"risk":0.828,"score":65.925},"name":"交织挑战 06"},{"nodes":[[105,117],[202,117],[398,117],[495,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[105,410],[202,410],[300,410],[398,410],[105,507],[202,507],[300,507],[398,507]],"edges":[[0,1],[0,4],[1,4],[1,5],[1,6],[2,3],[2,6],[2,7],[2,8],[3,8],[4,5],[4,10],[6,11],[6,12],[7,8],[8,12],[9,10],[9,13],[10,11],[10,13],[12,15],[12,16],[13,14],[13,17],[14,15],[16,20],[17,18],[18,19],[19,20]],"meta":{"branches":8,"cycles":9,"risk":0.75,"score":66.3},"name":"交织挑战 07"},{"nodes":[[105,117],[202,117],[300,117],[398,117],[495,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[105,410],[202,410],[300,410],[398,410],[495,410],[105,507],[202,507],[398,507],[495,507]],"edges":[[0,1],[0,5],[1,2],[1,5],[1,6],[2,7],[3,4],[3,8],[4,9],[5,6],[5,10],[6,7],[6,11],[7,8],[7,12],[9,13],[10,11],[11,12],[11,15],[13,16],[13,17],[13,18],[14,15],[14,19],[15,16],[15,20],[17,18],[18,21],[18,22],[21,22]],"meta":{"branches":8,"cycles":8,"risk":0.891,"score":66.725},"name":"交织挑战 08"},{"nodes":[[202,117],[300,117],[398,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[105,410],[202,410],[300,410],[398,410],[495,410],[202,507],[300,507],[398,507],[495,507]],"edges":[[0,4],[0,5],[1,2],[1,5],[2,5],[3,4],[3,8],[4,5],[4,9],[6,7],[6,11],[7,11],[8,12],[9,10],[9,12],[9,13],[10,11],[11,15],[12,13],[12,17],[13,14],[13,17],[14,15],[14,18],[14,19],[16,19],[16,20],[18,19],[19,20]],"meta":{"branches":8,"cycles":9,"risk":0.875,"score":67.3},"name":"交织挑战 09"},{"nodes":[[105,117],[202,117],[300,117],[398,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[495,312],[105,410],[202,410],[300,410],[398,410],[495,410],[105,507],[202,507],[300,507],[398,507],[495,507]],"edges":[[0,1],[0,4],[1,4],[2,3],[2,6],[3,8],[4,5],[4,9],[5,10],[6,7],[7,12],[8,13],[9,14],[10,11],[10,14],[11,12],[11,16],[12,13],[12,17],[14,15],[14,19],[15,20],[16,17],[16,21],[16,22],[17,18],[17,22],[18,23],[19,20],[21,22],[22,23]],"meta":{"branches":8,"cycles":8,"risk":0.906,"score":67.85},"name":"交织挑战 10"},{"nodes":[[202,117],[300,117],[398,117],[495,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[398,312],[495,312],[105,410],[202,410],[300,410],[398,410],[495,410],[105,507],[202,507],[398,507],[495,507]],"edges":[[0,1],[0,4],[1,2],[2,3],[2,6],[2,7],[3,8],[4,5],[4,9],[4,10],[5,10],[6,10],[7,11],[8,11],[9,13],[10,14],[11,15],[12,17],[13,14],[13,18],[13,19],[14,15],[14,19],[15,16],[15,19],[16,17],[17,20],[17,21],[18,19],[20,21]],"meta":{"branches":9,"cycles":9,"risk":0.672,"score":68.675},"name":"交织挑战 11"},{"nodes":[[202,117],[300,117],[398,117],[495,117],[105,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[495,312],[105,410],[202,410],[300,410],[398,410],[495,410],[202,507],[300,507],[398,507],[495,507]],"edges":[[0,1],[1,2],[1,5],[2,3],[2,5],[2,7],[3,7],[4,8],[4,9],[5,6],[5,10],[6,7],[7,12],[8,13],[9,13],[10,15],[11,15],[11,16],[12,17],[13,14],[13,18],[14,15],[15,16],[16,17],[16,20],[17,20],[17,21],[18,19],[19,20],[20,21]],"meta":{"branches":9,"cycles":9,"risk":0.828,"score":69.925},"name":"交织挑战 12"},{"nodes":[[105,117],[202,117],[398,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[495,312],[105,410],[202,410],[300,410],[398,410],[495,410],[202,507],[300,507],[398,507],[495,507]],"edges":[[0,1],[0,3],[1,3],[1,4],[1,5],[2,5],[2,6],[3,4],[3,8],[4,5],[4,9],[5,9],[6,7],[7,12],[8,9],[8,13],[9,10],[9,15],[10,11],[11,16],[12,17],[13,18],[14,15],[14,18],[15,18],[15,20],[16,20],[17,21],[18,19],[19,20],[20,21]],"meta":{"branches":9,"cycles":10,"risk":0.594,"score":70.75},"name":"交织挑战 13"},{"nodes":[[105,117],[202,117],[300,117],[398,117],[495,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[495,312],[105,410],[202,410],[300,410],[398,410],[495,410],[202,507],[300,507],[398,507],[495,507]],"edges":[[0,1],[0,5],[1,2],[1,5],[1,6],[2,3],[3,4],[3,8],[3,9],[4,9],[5,6],[5,10],[6,7],[6,11],[7,8],[7,12],[7,13],[10,15],[11,17],[12,13],[13,14],[13,19],[14,19],[15,16],[17,20],[17,22],[18,19],[18,22],[19,23],[20,21],[21,22],[22,23]],"meta":{"branches":9,"cycles":9,"risk":0.797,"score":71.675},"name":"交织挑战 14"},{"nodes":[[105,117],[202,117],[398,117],[495,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[105,410],[202,410],[300,410],[398,410],[495,410],[105,507],[202,507],[398,507],[495,507]],"edges":[[0,1],[0,4],[1,5],[2,3],[2,7],[3,8],[4,5],[5,6],[5,10],[6,7],[6,11],[6,12],[7,8],[7,12],[9,10],[9,13],[10,11],[10,13],[11,12],[11,15],[12,17],[13,18],[13,19],[14,15],[14,19],[15,16],[15,19],[16,20],[17,21],[18,19],[20,21]],"meta":{"branches":9,"cycles":10,"risk":0.875,"score":73.0},"name":"交织挑战 15"},{"nodes":[[105,117],[202,117],[300,117],[398,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[105,410],[202,410],[300,410],[398,410],[495,410],[105,507],[202,507],[300,507],[398,507],[495,507]],"edges":[[0,1],[0,4],[1,2],[1,4],[1,5],[2,3],[3,6],[4,5],[4,9],[5,6],[5,10],[6,10],[6,11],[7,8],[7,12],[8,12],[9,13],[10,11],[10,13],[11,12],[11,15],[12,15],[13,14],[13,18],[14,19],[15,16],[15,20],[16,17],[17,22],[18,19],[20,21],[21,22]],"meta":{"branches":9,"cycles":10,"risk":0.891,"score":74.125},"name":"交织挑战 16"},{"nodes":[[202,117],[300,117],[398,117],[495,117],[105,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[495,312],[105,410],[202,410],[300,410],[495,410],[202,507],[300,507],[398,507],[495,507]],"edges":[[0,4],[0,5],[1,2],[1,5],[2,3],[2,6],[2,7],[3,7],[4,8],[5,6],[5,10],[6,7],[6,11],[7,12],[8,9],[9,10],[9,13],[9,14],[10,11],[10,15],[11,15],[11,16],[12,16],[13,14],[14,15],[14,17],[15,18],[16,19],[16,20],[17,18],[19,20]],"meta":{"branches":10,"cycles":11,"risk":0.75,"score":75.7},"name":"交织挑战 17"},{"nodes":[[105,117],[202,117],[300,117],[398,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[495,312],[105,410],[202,410],[300,410],[398,410],[495,410],[105,507],[202,507],[300,507],[398,507]],"edges":[[0,1],[0,4],[1,2],[1,5],[1,6],[2,3],[3,8],[4,5],[4,9],[4,10],[5,6],[5,10],[6,7],[6,10],[7,8],[8,12],[8,13],[9,14],[10,11],[11,12],[12,13],[12,16],[14,15],[14,19],[14,20],[15,20],[16,17],[16,21],[16,22],[17,18],[18,22],[19,20],[20,21]],"meta":{"branches":10,"cycles":11,"risk":0.719,"score":77.45},"name":"交织挑战 18"},{"nodes":[[105,117],[202,117],[300,117],[398,117],[495,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[495,312],[105,410],[202,410],[300,410],[105,507],[202,507],[300,507],[398,507]],"edges":[[0,1],[0,5],[1,2],[1,6],[1,7],[2,3],[3,4],[3,8],[3,9],[4,9],[5,6],[5,10],[5,11],[6,7],[6,11],[7,12],[7,13],[8,13],[9,13],[9,14],[10,15],[11,15],[11,17],[12,17],[13,14],[15,16],[15,18],[15,19],[17,19],[17,21],[18,19],[19,20],[20,21]],"meta":{"branches":11,"cycles":12,"risk":0.828,"score":82.025},"name":"交织挑战 19"},{"nodes":[[105,117],[202,117],[300,117],[398,117],[495,117],[105,214],[202,214],[300,214],[398,214],[495,214],[105,312],[202,312],[300,312],[398,312],[495,312],[105,410],[202,410],[300,410],[398,410],[495,410],[105,507],[202,507],[300,507],[398,507],[495,507]],"edges":[[0,1],[0,5],[1,6],[2,3],[2,7],[3,4],[3,7],[3,8],[4,9],[5,6],[5,10],[5,11],[6,7],[6,11],[7,8],[8,9],[8,13],[9,13],[9,14],[10,15],[11,12],[11,17],[12,13],[13,18],[14,19],[15,16],[15,20],[15,21],[16,21],[17,18],[17,21],[17,22],[18,19],[18,23],[19,23],[19,24],[20,21],[22,23],[23,24]],"meta":{"branches":14,"cycles":15,"risk":0.781,"score":98.75},"name":"交织挑战 20"}]};
  var nodes=[],edges=[],route=[],used=[],moves=0,hintNode=-1,cursor=0;
  var level=null,routeProblem=null,travel=null,dragging=false,previousPointer=null,progressOption=null;

  function modeName(){return activeOption==='easy'?'轻松':activeOption==='hard'?'挑战':'标准';}
  function loadProgress(){
    progressOption=activeOption;
    unlocked=Math.min(stageCount-1,Math.max(0,Math.floor(number('unlocked:'+activeOption,0))));
    stageIndex=Math.min(unlocked,Math.max(0,Math.floor(number('current:'+activeOption,0))));
  }
  function make(){
    level=levelBook[activeOption][stageIndex];
    nodes=level.nodes.map(function(p){return {x:p[0],y:p[1]};});
    edges=level.edges.map(function(e){return e.slice();});
    used=edges.map(function(){return false;});
  }
  function degree(mask){
    var d=nodes.map(function(){return 0;});
    edges.forEach(function(e,i){if(!mask[i]){d[e[0]]++;d[e[1]]++;}});
    return d;
  }
  function startingNode(mask){
    var d=degree(mask),odd=d.map(function(v,i){return v%2?i:-1;}).filter(function(i){return i>=0;});
    return odd.length?odd[0]:d.findIndex(function(v){return v>0;});
  }
  // 欧拉续走须同时满足奇点条件和剩余边连通；只看输出长度会给出无效提示。
  function analyse(start,mask){
    mask=mask||used;
    var d=degree(mask),left=d.reduce(function(a,v){return a+v;},0)/2;
    if(!left)return {ok:true,left:0,reason:''};
    var odd=d.map(function(v,i){return v%2?i:-1;}).filter(function(i){return i>=0;});
    if(!d[start])return {ok:false,left:left,reason:'isolated'};
    if(odd.length!==0&&odd.length!==2||odd.length===2&&!odd.includes(start))return {ok:false,left:left,reason:'odd'};
    var seen=new Set([start]),queue=[start];
    for(var h=0;h<queue.length;h++)edges.forEach(function(e,i){
      if(mask[i]||!e.includes(queue[h]))return;
      var j=e[0]===queue[h]?e[1]:e[0];
      if(!seen.has(j)){seen.add(j);queue.push(j);}
    });
    if(d.some(function(v,i){return v&&!seen.has(i);}))return {ok:false,left:left,reason:'split'};
    return {ok:true,left:left,reason:''};
  }
  function trail(start,mask){
    mask=mask||used;
    if(!analyse(start,mask).ok)return [];
    var seen=mask.slice(),stack=[start],out=[];
    while(stack.length){
      var v=stack[stack.length-1],k=edges.findIndex(function(e,i){return !seen[i]&&e.includes(v);});
      if(k<0)out.push(stack.pop());
      else{seen[k]=true;stack.push(edges[k][0]===v?edges[k][1]:edges[k][0]);}
    }
    return out.reverse();
  }
  function edgeBetween(a,b,mask){return edges.findIndex(function(e,i){return !mask[i]&&e.includes(a)&&e.includes(b);});}
  function report(text,error){document.getElementById('status').dataset.tone=error?'error':'normal';status(text);}
  function render(){
    routeProblem=route.length?analyse(route[route.length-1]):null;
    hud(moves,modeName()+' '+(stageIndex+1)+'/20 · 已走 '+moves+'/'+edges.length+' 条边'+(assisted?' · 辅助局':''),nodes.length+' 个点 · '+edges.length+' 条线 · '+level.meta.branches+' 个岔点');
    document.getElementById('undo').disabled=route.length===0||ended;
    canvas.setAttribute('aria-label','一笔画，第'+(stageIndex+1)+'关。'+nodes.length+'个节点，'+edges.length+'条边。当前选择节点'+(cursor+1)+'，已走'+moves+'条。方向键选择节点，空格或回车连接。');
  }
  function activate(i){
    if(blocked()||i<0||i>=nodes.length)return false;
    cursor=i;
    if(!route.length){
      route=[i];hintNode=-1;render();
      if(routeProblem&&!routeProblem.ok)report('这个起点无法走完全部线路。可撤销清空后重选，或查看路线提示。',true);else report('已从节点 '+(i+1)+' 起笔。保留连接不同区域的线路，避免过早封闭。',false);
      return true;
    }
    var a=route[route.length-1],k=edgeBetween(a,i,used);
    if(k<0){report('只能沿尚未走过的线连接相邻节点；可撤销回退。',true);return false;}
    used[k]=true;route.push(i);moves++;hintNode=-1;
    travel={a:a,b:i,t:0};burst(nodes[i].x,nodes[i].y,accent);render();
    if(used.every(Boolean)){
      travel=null;
      win('全部 '+edges.length+' 条线已完成，用时 '+Math.max(1,Math.ceil(elapsed))+' 秒。',Math.max(1,Math.ceil(elapsed)),true);
      render();
    }else if(!routeProblem.ok){
      report(routeProblem.reason==='odd'?'当前起点或走法不满足剩余路线的奇点条件。可用提示定位应回退的位置。':'剩余线路已无法从当前位置全部走完。撤销回岔点，调整先后顺序。',true);
    }else report('已连接节点 '+(i+1)+'，还剩 '+(edges.length-moves)+' 条线。',false);
    return true;
  }
  function undo(){
    if(blocked()||!route.length)return;
    if(route.length===1)route=[];
    else{
      var b=route.pop(),a=route[route.length-1];
      var k=edges.findIndex(function(e,i){return used[i]&&e.includes(a)&&e.includes(b);});
      used[k]=false;moves--;cursor=a;
    }
    travel=null;hintNode=-1;assisted=true;render();
    report(route.length?(routeProblem.ok?'已回退一步，可从当前节点尝试另一条路线。':'还需继续回退，才能恢复可完成的路线。'):'已清空起点，可以重新选择。',!!route.length&&!routeProblem.ok);
  }
  function hint(){
    assisted=true;
    var start=route.length?route[route.length-1]:startingNode(used),t=trail(start);
    if(t.length){
      hintNode=route.length?t[1]:t[0];
      report(route.length?'金色节点 '+(hintNode+1)+' 是可完成当前剩余线路的下一步。':'可从金色节点 '+(hintNode+1)+' 起笔；提示会按当前局面计算路线。',false);
    }else{
      // 不替玩家擦掉路线：寻找仍可完成的最近前缀，只告知要回退几步。
      var found=false;
      for(var keep=route.length-1;keep>=1;keep--){
        var mask=edges.map(function(){return false;});
        for(var j=1;j<keep;j++)mask[edgeBetween(route[j-1],route[j],mask)]=true;
        if(analyse(route[keep-1],mask).ok){
          hintNode=route[keep-1];
          report('请先撤销 '+(route.length-keep)+' 步，回到金色节点 '+(hintNode+1)+'；当前路线不能直接接续完成。',true);
          found=true;break;
        }
      }
      if(!found){
        hintNode=startingNode(edges.map(function(){return false;}));
        report('当前起点不合适。撤销至清空起点，再从金色节点 '+(hintNode+1)+' 起笔。',true);
      }
    }
    render();
  }
  function restart(){
    begin();
    if(progressOption!==activeOption)loadProgress();
    route=[];moves=0;hintNode=-1;cursor=0;travel=null;dragging=false;previousPointer=null;
    make();renderStages();render();
    report('选择起点，沿线点击或拖动。节点可重复经过，但每条线只能走一次；交汇处均有明确节点。',false);
  }
  function step(dt){if(travel){travel.t+=dt;if(travel.t>=.24)travel=null;}}
  function draw(){
    base(level.name,'节点可重复 · 每条线只走一次 · 交汇处均有圆点');
    edges.forEach(function(e,i){
      var a=nodes[e[0]],b=nodes[e[1]];
      line(a.x,a.y,b.x,b.y,'#fff',10);
      line(a.x,a.y,b.x,b.y,used[i]?accent:routeProblem&&!routeProblem.ok?'#d8b6ad':'#c6d3ce',used[i]?6:4);
    });
    if(travel&&!reduce){
      var a=nodes[travel.a],b=nodes[travel.b],u=Math.min(1,travel.t/.24);
      circle(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u,7,gold);
    }
    var d=degree(edges.map(function(){return false;}));
    nodes.forEach(function(p,i){
      var current=route[route.length-1]===i;
      if(i===hintNode){circle(p.x,p.y,25,'#f3e5bf');circle(p.x,p.y,21,gold);}
      else if(current){circle(p.x,p.y,24,'#e1e6fc');}
      circle(p.x,p.y,current?19:d[i]>=3?17:15,current?accent:d[i]>=3?green:'#92aa9b');
      text(i+1,p.x,p.y,nodes.length>17?13:15,'#fff');
      if(document.activeElement===canvas&&i===cursor){
        ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,28,0,Math.PI*2);ctx.stroke();
      }
    });
    text(route.length?(routeProblem&&!routeProblem.ok?'路线已堵住，撤销回岔点':'剩余 '+(edges.length-moves)+' 条线 · 继续连接'):'先观察岔点，再选择起点',300,568,18,routeProblem&&!routeProblem.ok?coral:muted);
  }
  function visit(p){
    var best=-1,distance=29;
    nodes.forEach(function(n,i){var d=Math.hypot(p.x-n.x,p.y-n.y);if(d<distance){best=i;distance=d;}});
    if(best>=0&&route[route.length-1]!==best)activate(best);
  }
  function dragTo(p){
    if(!previousPointer){visit(p);previousPointer=p;return;}
    // 对快速鼠标/触摸移动插值，避免一次事件越过中间节点。
    var from=previousPointer,count=Math.ceil(Math.hypot(p.x-from.x,p.y-from.y)/10);
    for(var k=1;k<=Math.max(1,count);k++)visit({x:from.x+(p.x-from.x)*k/Math.max(1,count),y:from.y+(p.y-from.y)*k/Math.max(1,count)});
    previousPointer=p;
  }
  function cancelDrag(){dragging=false;previousPointer=null;}
  canvas.addEventListener('pointerdown',function(e){
    if(blocked())return;e.preventDefault();dragging=true;previousPointer=null;
    canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);dragTo(point(e));
  });
  canvas.addEventListener('pointermove',function(e){if(dragging&&!blocked())dragTo(point(e));});
  canvas.addEventListener('pointerup',function(e){if(dragging&&!blocked())dragTo(point(e));cancelDrag();});
  canvas.addEventListener('pointercancel',cancelDrag);
  canvas.addEventListener('lostpointercapture',cancelDrag);
  onPause=cancelDrag;
  function describeCurrent(){if(route.length&&routeProblem&&!routeProblem.ok)report('当前路线仍被堵住，请先撤销回岔点。',true);else report(route.length?'继续从当前节点沿未走过的线连接。':'先观察整个图形，选好起点；不要过早封住还没走完的区域。',false);}
  onStart=describeCurrent;onResume=describeCurrent;
  listen('undo',undo);listen('hint',hint);
  keyInput(function(e){
    if(/^[1-9]$/.test(e.key)){e.preventDefault();activate(Number(e.key)-1);return;}
    var dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},dir=dirs[e.key];
    if(dir){
      e.preventDefault();var p=nodes[cursor],best=-1,score=Infinity;
      nodes.forEach(function(q,i){var dx=q.x-p.x,dy=q.y-p.y,along=dx*dir[0]+dy*dir[1];if(along<8)return;var across=Math.abs(dx*dir[1]-dy*dir[0]),s=Math.hypot(dx,dy)+across*2;if(s<score){best=i;score=s;}});
      if(best>=0){cursor=best;canvas.focus({preventScroll:true});render();}return;
    }
    if((e.key==='Enter'||e.key===' ')&&!/^(BUTTON|A)$/.test(e.target.tagName)){e.preventDefault();activate(cursor);}
  });
  stages(20);restart();

  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
