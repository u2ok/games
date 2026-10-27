/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:bomber';
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


  var tiles=[],hero={x:1,y:1},enemies=[],bombs=[],flames=[],drops=[],lives=3,kills=0,power=2,capacity=1,pace=.16,walkClock=0,invincible=0,left=180,enemyClock=0,exit={x:9,y:9};
  var arrows={ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0],ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1]};
  function index(x,y){return y*11+x;}
  function walkable(x,y){return x>=1&&x<=9&&y>=1&&y<=9&&!tiles[index(x,y)]&&!bombs.some(function(b){return b.x===x&&b.y===y;});}
  function putBomb(){if(blocked()||bombs.length>=capacity||bombs.some(function(b){return b.x===hero.x&&b.y===hero.y;}))return false;bombs.push({x:hero.x,y:hero.y,t:2.2,power:power});sound(400);return true;}
  function explode(b){if(b.gone)return;b.gone=true;flames.push({x:b.x,y:b.y,t:.6});[[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){for(var n=1;n<=b.power;n++){var x=b.x+d[0]*n,y=b.y+d[1]*n,tile=tiles[index(x,y)];if(tile===1)break;flames.push({x:x,y:y,t:.6});bombs.forEach(function(other){if(!other.gone&&other.x===x&&other.y===y)explode(other);});if(tile===2){tiles[index(x,y)]=0;if(Math.random()<.28)drops.push({x:x,y:y,type:['power','capacity','speed'][Math.floor(Math.random()*3)]});break;}}});}
  function move(dx,dy){if(blocked()||walkClock>0||!walkable(hero.x+dx,hero.y+dy))return false;hero.x+=dx;hero.y+=dy;walkClock=pace;drops=drops.filter(function(p){if(p.x!==hero.x||p.y!==hero.y)return true;if(p.type==='power')power=Math.min(5,power+1);else if(p.type==='capacity')capacity=Math.min(4,capacity+1);else pace=Math.max(.09,pace-.025);status('获得'+({power:'火力',capacity:'炸弹容量',speed:'速度'}[p.type])+'提升。');return false;});render();return true;}
  function step(dt){if(blocked())return;left=Math.max(0,left-dt);walkClock=Math.max(0,walkClock-dt);invincible=Math.max(0,invincible-dt);bombs.forEach(function(b){b.t-=dt;if(b.t<=0)explode(b);});bombs=bombs.filter(function(b){return !b.gone;});flames.forEach(function(f){f.t-=dt;});flames=flames.filter(function(f){return f.t>0;});enemies=enemies.filter(function(e){if(flames.some(function(f){return f.x===e.x&&f.y===e.y;})){kills++;return false;}return true;});enemyClock-=dt;if(enemyClock<=0){enemyClock=({easy:.9,normal:.65,hard:.45}[activeOption]||.65)*Math.max(.65,1-stageIndex*.025);enemies.forEach(function(e){var opts=shuffled([[1,0],[-1,0],[0,1],[0,-1]]).filter(function(d){return walkable(e.x+d[0],e.y+d[1])&&!flames.some(function(f){return f.x===e.x+d[0]&&f.y===e.y+d[1];});});if(opts.length){opts.sort(function(a,b){return Math.abs(e.x+a[0]-hero.x)+Math.abs(e.y+a[1]-hero.y)-Math.abs(e.x+b[0]-hero.x)-Math.abs(e.y+b[1]-hero.y);});var d=Math.random()<.65?opts[0]:opts[Math.floor(Math.random()*opts.length)];e.x+=d[0];e.y+=d[1];}});}if(invincible<=0&&(flames.some(function(f){return f.x===hero.x&&f.y===hero.y;})||enemies.some(function(e){return e.x===hero.x&&e.y===hero.y;}))){lives--;hero={x:1,y:1};invincible=2;status('受到伤害，剩余 '+lives+' 条生命。');if(lives<=0)finish('生命耗尽，请重新挑战。');}if(!left&&!ended)finish('时间用完。');if(!ended&&!enemies.length&&!tiles[index(exit.x,exit.y)]&&hero.x===exit.x&&hero.y===exit.y){record(kills*100+Math.ceil(left)*2+lives*100,false);complete('抵达出口，进入下一关。');}render();}
  function render(){rect(0,0,600,600,'#e3e9d8');for(var y=0;y<11;y++)for(var x=0;x<11;x++){var t=tiles[index(x,y)],px=25+x*50,py=25+y*50;rect(px,py,49,49,t===1?'#7d9180':t===2?'#bc9970':'#eaf0df');if(t===2){rect(px+5,py+5,39,3,'#d7ba91');rect(px+23,py+5,3,39,'#a78661');}}if(!tiles[index(exit.x,exit.y)]){rect(25+exit.x*50+8,25+exit.y*50+5,32,40,'#7b9da5');text('出口',50+exit.x*50,56+exit.y*50,11,'#fff8e1');}drops.forEach(function(p){disk(50+p.x*50,50+p.y*50,15,'#d9b96f');text(p.type==='power'?'火':p.type==='capacity'?'量':'速',50+p.x*50,55+p.y*50,12);});flames.forEach(function(f){rect(29+f.x*50,29+f.y*50,41,41,'#e1ad63');});bombs.forEach(function(b){disk(50+b.x*50,50+b.y*50,17,'#40564b');rect(48+b.x*50,27+b.y*50,4,9,'#c19563');});enemies.forEach(function(e){disk(50+e.x*50,50+e.y*50,18,'#aa7162');disk(44+e.x*50,47+e.y*50,3,'#fff5df');disk(56+e.x*50,47+e.y*50,3,'#fff5df');});disk(50+hero.x*50,50+hero.y*50,18,invincible>0?'#a6bed7':'#6a839f');disk(44+hero.x*50,47+hero.y*50,3,'#fff8e1');disk(56+hero.x*50,47+hero.y*50,3,'#fff8e1');hud(kills,'第 '+(stageIndex+1)+' 关 · 生命 '+lives+' · 剩余 '+Math.ceil(left)+'秒 · 敌人 '+enemies.length,'火力 '+power+' · 炸弹 '+bombs.length+'/'+capacity);}
  function restart(){resetState();tiles=Array(121).fill(0);for(var y=0;y<11;y++)for(var x=0;x<11;x++)if(!x||!y||x===10||y===10||x%2===0&&y%2===0)tiles[index(x,y)]=1;else if(Math.random()<.42)tiles[index(x,y)]=2;[[1,1],[2,1],[1,2],[9,1],[8,1],[9,2],[1,9],[2,9],[1,8],[9,9],[8,9],[9,8]].forEach(function(p){tiles[index(p[0],p[1])]=0;});tiles[index(9,9)]=2;hero={x:1,y:1};enemies=[{x:9,y:1},{x:1,y:9}];if(stageIndex>=2)enemies.push({x:9,y:8});if(stageIndex>=5)enemies.push({x:8,y:9});bombs=[];flames=[];drops=[];lives=3;kills=0;power=2;capacity=1;pace=.16;walkClock=0;invincible=1;left=180+stageIndex*10;enemyClock=1;renderStages();render();status('炸毁木箱、击退所有敌人，再炸开右下出口并走入。');}
  document.addEventListener('keydown',function(e){if(editing(e)||blocked())return;var d=arrows[e.key];if(d){e.preventDefault();move(d[0],d[1]);}else if(e.key===' '){e.preventDefault();if(!e.repeat)putBomb();}});document.querySelectorAll('[data-dir]').forEach(function(b){b.addEventListener('click',function(){var d=arrows[b.dataset.dir];move(d[0],d[1]);});});document.getElementById('bomb').addEventListener('click',putBomb);clock(step);stages(8);restart();


  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
