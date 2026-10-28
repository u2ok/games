/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:bird';
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
  function read(name) { try { return localStorage.getItem(name); } catch (error) { document.getElementById('storage').textContent = '存储不可用，数据仅在当前页面保留。'; return memoryStore[name] || null; } }
  function save(name, value) { memoryStore[name] = value; try { localStorage.setItem(name, value); } catch (error) { document.getElementById('storage').textContent = '存储不可用，数据仅在当前页面保留。'; } }
  function status(text) { document.getElementById('status').textContent = text; }
  function number(name, fallback) { var value = Number(read(key + ':' + name)); return Number.isFinite(value) && value > 0 ? value : fallback; }
  function sound(frequency) {
    if (!settings.sound) return;
    try { var Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return; if (!audio) audio = new Audio(); if (audio.state === 'suspended') audio.resume().catch(function () {}); var oscillator = audio.createOscillator(); var gain = audio.createGain(); oscillator.connect(gain); gain.connect(audio.destination); oscillator.frequency.value = frequency || 600; gain.gain.setValueAtTime(.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .12); oscillator.start(); oscillator.stop(audio.currentTime + .12); } catch (error) { /* 声音失败时游戏继续运行。 */ }
  }
  function pause(reason) { if (paused || ended) return; paused = true; document.getElementById('pause').textContent = '继续游戏'; onPause(); showCover('已暂停', '准备好后继续刚才的一局。', '继续游戏'); syncStart(); status(reason || '已暂停，点击继续恢复游戏。'); }
  function resume() { if (!paused || ended || dialog.open) return; paused = false; document.getElementById('pause').textContent = '暂停'; onResume(); hideCover(); syncStart(); }
  function resetState() { document.getElementById('status').dataset.tone = 'normal'; ready = false; hideCover(); paused = false; ended = false; document.getElementById('pause').disabled = false; document.getElementById('pause').textContent = '暂停'; }
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
  /* 固定逻辑尺寸与按秒物理：小鸟拍翅克服重力，穿过成对管道得分。 */
  var GROUND = 560;
  var bird;
  var pipes = [];
  var score = 0;
  var best = 0;
  var difficulty = settings.option;
  var config;
  var distanceSinceSpawn = 0;
  var previousFrame = 0;
  var canvas = document.getElementById('canvas');
  var context = canvas.getContext('2d');

  function gapCenter() {
    var previous = pipes.length ? pipes[pipes.length-1].center : 280;
    // 相邻缺口高度变化有上限，避免突然从顶端跳至地面。
    var next = previous + (Math.random()*2-1)*90;
    return Math.max(config.gap/2+64, Math.min(GROUND-config.gap/2-64,next));
  }
  function addPipe(x) { pipes.push({ x:x, center:gapCenter(), passed:false }); }
  function flap() {
    if(blocked())return false;
    bird.vy=-320;sound(600);draw();return true;
  }
  function circleRect(x,y,radius,rx,ry,rw,rh) {
    var closestX=Math.max(rx,Math.min(rx+rw,x));
    var closestY=Math.max(ry,Math.min(ry+rh,y));
    return Math.pow(x-closestX,2)+Math.pow(y-closestY,2)<=radius*radius;
  }
  function hitsPipe(pipe) {
    var top=pipe.center-config.gap/2;
    var bottom=pipe.center+config.gap/2;
    return circleRect(bird.x,bird.y,bird.radius,pipe.x,0,76,top) ||
      circleRect(bird.x,bird.y,bird.radius,pipe.x,bottom,76,GROUND-bottom) ||
      circleRect(bird.x,bird.y,bird.radius,pipe.x-5,top-18,86,18) ||
      circleRect(bird.x,bird.y,bird.radius,pipe.x-5,bottom,86,18);
  }
  function update() {
    if(score>best){best=score;save(key+':best:'+difficulty,String(best));}
    updateScore(score,best);
    document.getElementById('detail').textContent='已通过 '+score+' 道管道 · 点击 / 空格拍翅';
    document.getElementById('rule-label').textContent=({easy:'轻松',normal:'标准',hard:'挑战'}[difficulty])+' · 每通过一道管道 +1 分';
    canvas.setAttribute('aria-label','小鸟飞行，点击或空格拍翅，当前通过'+score+'道管道');
  }
  function crash(note) {
    finish(note+'，本局 '+score+' 分。');
    showCover('本局结束',note+' · 通过 '+score+' 道管道','再飞一次');
    sound(180);update();
  }
  function physics(dt) {
    if(blocked())return;
    bird.vy=Math.min(520,bird.vy+1000*dt);
    bird.y+=bird.vy*dt;
    pipes.forEach(function(pipe){pipe.x-=config.speed*dt;});
    if(bird.y-bird.radius<=0){crash('碰到天空边界了');return;}
    if(bird.y+bird.radius>=GROUND){crash('碰到地面了');return;}
    if(pipes.some(hitsPipe)){crash('碰到管道了');return;}
    pipes.forEach(function(pipe){
      // 整只小鸟完全通过后计分，一道管道只能触发一次。
      if(!pipe.passed&&pipe.x+81<bird.x-bird.radius){pipe.passed=true;score+=1;update();sound(780);status('顺利通过！继续保持节奏。');}
    });
    pipes=pipes.filter(function(pipe){return pipe.x+81>=0;});
    distanceSinceSpawn+=config.speed*dt;
    if(distanceSinceSpawn>=270){distanceSinceSpawn-=270;addPipe(650);}
  }
  function cloud(x,y) {
    context.fillStyle='#fffefa';context.beginPath();context.ellipse(x,y,42,14,0,0,Math.PI*2);context.fill();
    context.beginPath();context.arc(x-12,y-10,16,0,Math.PI*2);context.arc(x+10,y-15,21,0,Math.PI*2);context.fill();
  }
  function draw() {
    context.fillStyle='#edf2e7';context.fillRect(0,0,600,600);
    cloud(90,90);cloud(350,140);cloud(530,65);
    context.fillStyle='#dce5d1';context.beginPath();context.moveTo(0,GROUND);context.quadraticCurveTo(140,390,300,GROUND);context.quadraticCurveTo(450,420,600,GROUND);context.closePath();context.fill();
    pipes.forEach(function(pipe){
      var top=pipe.center-config.gap/2;var bottom=pipe.center+config.gap/2;
      context.fillStyle='#477658';context.fillRect(pipe.x,0,76,top);context.fillRect(pipe.x,bottom,76,GROUND-bottom);
      context.fillStyle='#659371';context.fillRect(pipe.x+8,0,12,top);context.fillRect(pipe.x+8,bottom,12,GROUND-bottom);
      context.fillStyle='#245c4a';context.fillRect(pipe.x-5,top-18,86,18);context.fillRect(pipe.x-5,bottom,86,18);
    });
    context.fillStyle='#c7d4b8';context.fillRect(0,GROUND,600,40);
    context.fillStyle='#789569';context.fillRect(0,GROUND,600,6);
    context.save();context.translate(bird.x,bird.y);context.rotate(Math.max(-.45,Math.min(1,bird.vy/500)));
    context.fillStyle='#e8ab73';context.beginPath();context.ellipse(0,0,22,18,0,0,Math.PI*2);context.fill();
    context.fillStyle='#bd804d';context.beginPath();context.ellipse(-7,5,12,7,-.35,0,Math.PI*2);context.fill();
    context.fillStyle='#fffefa';context.beginPath();context.arc(9,-6,7,0,Math.PI*2);context.fill();
    context.fillStyle='#24352d';context.beginPath();context.arc(11,-6,3,0,Math.PI*2);context.fill();
    context.fillStyle='#c77c42';context.beginPath();context.moveTo(18,-1);context.lineTo(31,4);context.lineTo(18,8);context.closePath();context.fill();context.restore();
  }
  function frame(now) {
    var delta=previousFrame?Math.min((now-previousFrame)/1000,.05):0;previousFrame=now;
    if(!blocked()){
      // 小步长检测管道边缘，避免低帧率时跨过碰撞区域。
      var count=Math.max(1,Math.ceil(delta/(1/120)));
      for(var i=0;i<count&&!blocked();i++)physics(delta/count);
      draw();
    }
    requestAnimationFrame(frame);
  }
  function restart() {
    resetState();difficulty=settings.option;
    config=({easy:{gap:200,speed:145},normal:{gap:170,speed:180},hard:{gap:145,speed:210}}[difficulty]);
    best=number('best:'+difficulty,0);score=0;pipes=[];distanceSinceSpawn=0;previousFrame=0;
    bird={x:160,y:280,vy:-240,radius:15};addPipe(650);update();draw();
    status('点击屏幕、拍翅按钮或按空格，让小鸟穿过管道。');
  }
  canvas.addEventListener('pointerdown',function(event){event.preventDefault();flap();});
  document.getElementById('flap').addEventListener('click',flap);
  document.addEventListener('keydown',function(event){
    if(dialog.open||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
    var keyName=event.key.toLowerCase();
    if(keyName==='arrowup'||keyName==='w'||(event.code==='Space'&&!/BUTTON|A/.test(event.target.tagName))){event.preventDefault();if(!event.repeat)flap();}
  });
  onResume=function(){bird.vy=Math.min(bird.vy,-180);status('继续飞行，点击拍翅保持高度。');};
  onOption=function(){status('难度设置已保存，新的一局生效。');};
  document.getElementById('restart').addEventListener('click',restart);
  restart();requestAnimationFrame(frame);

  // 统一的准备、暂停与结束遮罩；控件位置和命名在所有游戏中保持一致。
  function showCover(title, note, action) {
    var cover = document.getElementById('game-cover');
    if (!cover) return;
    cover.hidden = false;
    document.getElementById('cover-title').textContent = title;
    document.getElementById('cover-note').textContent = note;
    document.getElementById('cover-action').textContent = action;
  }
  function hideCover() { var cover = document.getElementById('game-cover'); if (cover) cover.hidden = true; }
  function syncStart() {
    document.getElementById('start').textContent = paused ? '继续游戏' : ended ? '再玩一局' : '开始游戏';
    document.getElementById('start').disabled = !ready && !paused && !ended;
  }
  function startGame() {
    if (dialog.open) return;
    if (id === '打砖块') { launch(); syncStart(); return; }
    if (ended) restart();
    if (paused) resume();
    ready = false;
    hideCover(); syncStart(); status('游戏进行中。');
  }
  document.getElementById('start').addEventListener('click', startGame);
  var coverAction = document.getElementById('cover-action');
  if (coverAction) coverAction.addEventListener('click', startGame);
  document.getElementById('restart').addEventListener('click', function () { syncStart(); });
  if (id !== '打砖块') { ready = true; showCover('准备好了吗？', '点击开始游戏，享受轻松一局。', '开始游戏'); }
  syncStart();

}());


