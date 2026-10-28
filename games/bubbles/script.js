/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:bubbles';
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
  /* 交错六邻接棋盘：偶数行 11 格，奇数行 10 格。 */
  var ROWS = 11;
  var RADIUS = 24;
  var ROW_HEIGHT = Math.sqrt(3) * RADIUS;
  var palette = ['#b76860', '#5a8c68', '#648ca7', '#b99244', '#8f73a3'];
  var symbols = ['●', '◆', '▲', '★', '✚'];
  var board = [];
  var score = 0;
  var shots = 0;
  var misses = 0;
  var difficulty = settings.option;
  var colorCount = 4;
  var best = 0;
  var currentColor;
  var nextColor;
  var angle = -Math.PI / 2;
  var projectile = null;
  var previousFrame = 0;
  var canvas = document.getElementById('canvas');
  var context = canvas.getContext('2d');
  var origin = { x: 300, y: 548 };

  function columns(row) { return row % 2 ? 10 : 11; }
  function valid(row, col) { return row >= 0 && row < ROWS && col >= 0 && col < columns(row); }
  function center(row, col) { return { x: 60 + (row % 2 ? 24 : 0) + col * 48, y: 40 + row * ROW_HEIGHT }; }
  function neighbors(row, col) {
    var result = [[row, col-1], [row, col+1]];
    var offset = row % 2 ? 0 : -1;
    result.push([row-1,col+offset],[row-1,col+offset+1],[row+1,col+offset],[row+1,col+offset+1]);
    return result.filter(function (p) { return valid(p[0],p[1]); });
  }
  function liveColors() {
    var colors = [];
    board.forEach(function (row) { row.forEach(function (color) { if (color >= 0 && colors.indexOf(color) === -1) colors.push(color); }); });
    return colors;
  }
  function randomColor() {
    var colors = liveColors();
    return colors.length ? colors[Math.floor(Math.random() * colors.length)] : 0;
  }
  function cluster(row, col) {
    var color = board[row][col];
    var queue = [[row,col]];
    var seen = {};
    var result = [];
    while (queue.length) {
      var p = queue.pop(); var key = p.join(',');
      if (seen[key] || board[p[0]][p[1]] !== color) continue;
      seen[key] = true; result.push(p);
      neighbors(p[0],p[1]).forEach(function (next) { if (!seen[next.join(',')]) queue.push(next); });
    }
    return result;
  }
  // 从顶行遍历所有连接泡泡，未连到顶端的泡泡全部掉落。
  function detach() {
    var queue = []; var linked = {};
    board[0].forEach(function (color,col) { if (color >= 0) queue.push([0,col]); });
    while (queue.length) {
      var p = queue.pop(); var key = p.join(',');
      if (linked[key] || board[p[0]][p[1]] < 0) continue;
      linked[key] = true;
      neighbors(p[0],p[1]).forEach(function (next) { if (!linked[next.join(',')]) queue.push(next); });
    }
    var dropped = 0;
    board.forEach(function (row,r) { row.forEach(function (color,c) { if (color >= 0 && !linked[r+','+c]) { board[r][c] = -1; dropped += 1; } }); });
    return dropped;
  }
  function update() {
    if (score > best) { best = score; save(key + ':best:' + difficulty, String(best)); }
    updateScore(score,best);
    document.getElementById('detail').textContent = '发射 ' + shots + ' 次 · 再 ' + (5-misses) + ' 次未消除后压顶';
    document.getElementById('rule-label').textContent = ({easy:'轻松 · 3色',normal:'标准 · 4色',hard:'挑战 · 5色'}[difficulty]) + ' · 同色三连消除';
  }
  function lose(note) {
    projectile = null;
    finish(note || '泡泡触及危险线，本局结束。');
    showCover('本局结束', score + ' 分 · 发射 ' + shots + ' 次', '再玩一局');
  }
  function danger() {
    return board.some(function (row,r) { return row.some(function (color) { return color >= 0 && center(r,0).y + RADIUS >= 460; }); });
  }
  function pressure() {
    // 一次下降两行，保持原有奇偶行的水平位置不变。
    if (board.slice(-2).some(function (row) { return row.some(function (c) { return c >= 0; }); })) { lose(); return; }
    for (var row = ROWS-1; row >= 2; row -= 1) board[row] = board[row-2].slice();
    board[0] = Array.from({length:columns(0)},function(){return Math.floor(Math.random()*colorCount);});
    board[1] = Array.from({length:columns(1)},function(){return Math.floor(Math.random()*colorCount);});
    misses = 0;
  }
  function settle(hit) {
    var candidates = hit ? neighbors(hit[0],hit[1]) : board[0].map(function(_,c){return [0,c];});
    candidates = candidates.filter(function(p){return board[p[0]][p[1]] < 0;});
    if (!candidates.length) { lose('没有可吸附的位置，本局结束。'); return; }
    var shot = projectile;
    candidates.sort(function(a,b){var pa=center(a[0],a[1]);var pb=center(b[0],b[1]);return Math.pow(pa.x-shot.x,2)+Math.pow(pa.y-shot.y,2)-Math.pow(pb.x-shot.x,2)-Math.pow(pb.y-shot.y,2);});
    var slot = candidates[0]; board[slot[0]][slot[1]] = shot.color; projectile = null;
    var matched = cluster(slot[0],slot[1]); var dropped = 0;
    if (matched.length >= 3) {
      matched.forEach(function(p){board[p[0]][p[1]]=-1;});
      dropped = detach(); score += matched.length*10 + dropped*20; misses = 0;
      sound(760); status('消除 '+matched.length+' 个，悬空掉落 '+dropped+' 个。');
    } else { misses += 1; status('未达到同色三连，试试利用侧墙反弹。'); }
    if (!liveColors().length) {
      update(); finish('全部泡泡消除成功！共 '+score+' 分。');
      showCover('全部清空！',score+' 分 · 发射 '+shots+' 次','再玩一局'); draw(); return;
    }
    if (misses >= 5) pressure();
    if (!ended && danger()) lose();
    currentColor = liveColors().indexOf(nextColor) >= 0 ? nextColor : randomColor();
    nextColor = randomColor(); update(); draw();
  }
  function fire() {
    if (blocked() || projectile) return false;
    projectile = { x:origin.x,y:origin.y,vx:Math.cos(angle)*700,vy:Math.sin(angle)*700,color:currentColor };
    shots += 1; sound(450); update(); return true;
  }
  function physics(dt) {
    if (blocked() || !projectile) return;
    projectile.x += projectile.vx*dt; projectile.y += projectile.vy*dt;
    if (projectile.x < 60) { projectile.x = 120-projectile.x; projectile.vx = Math.abs(projectile.vx); }
    if (projectile.x > 540) { projectile.x = 1080-projectile.x; projectile.vx = -Math.abs(projectile.vx); }
    if (projectile.y <= 40) { settle(null); return; }
    var hit = null; var distance = Infinity;
    board.forEach(function(row,r){row.forEach(function(color,c){if(color<0)return;var p=center(r,c);var d=Math.pow(p.x-projectile.x,2)+Math.pow(p.y-projectile.y,2);if(d<Math.pow(47.5,2)&&d<distance){hit=[r,c];distance=d;}});});
    if (hit) settle(hit);
  }
  function bubble(x,y,color,radius) {
    context.fillStyle = palette[color]; context.beginPath(); context.arc(x,y,radius,0,Math.PI*2); context.fill();
    context.strokeStyle = '#fffefa88'; context.lineWidth = 2; context.stroke();
    context.fillStyle = '#fffefa'; context.font = Math.round(radius*.7)+'px sans-serif'; context.textAlign='center';context.textBaseline='middle';context.fillText(symbols[color],x,y+1);
  }
  function draw() {
    context.fillStyle='#f6f3ec';context.fillRect(0,0,600,600);
    context.fillStyle='#e3eadc';context.fillRect(36,12,528,474);
    context.strokeStyle='#a33e32';context.lineWidth=2;context.setLineDash([8,6]);context.beginPath();context.moveTo(36,460);context.lineTo(564,460);context.stroke();context.setLineDash([]);
    board.forEach(function(row,r){row.forEach(function(color,c){if(color>=0){var p=center(r,c);bubble(p.x,p.y,color,23);}});});
    // 只显示短瞄准线，保留靠反弹规划路线的玩法。
    context.strokeStyle='#245c4a';context.lineWidth=4;context.beginPath();context.moveTo(origin.x,origin.y);context.lineTo(origin.x+Math.cos(angle)*80,origin.y+Math.sin(angle)*80);context.stroke();
    bubble(origin.x,origin.y,currentColor,24);
    bubble(100,548,nextColor,18);
    context.fillStyle='#667060';context.font='16px "Microsoft YaHei",sans-serif';context.textAlign='center';context.fillText('下一颗',100,585);
    context.fillText('红线为危险线',460,550);
    if(projectile)bubble(projectile.x,projectile.y,projectile.color,23);
  }
  function aim(x,y) { if(blocked()||projectile)return;angle=Math.max(-Math.PI+.18,Math.min(-.18,Math.atan2(y-origin.y,x-origin.x)));draw(); }
  function aimEvent(event) { var rect=canvas.getBoundingClientRect();aim((event.clientX-rect.left)/rect.width*600,(event.clientY-rect.top)/rect.height*600); }
  canvas.addEventListener('pointermove',aimEvent);
  canvas.addEventListener('pointerdown',function(event){if(blocked())return;canvas.setPointerCapture(event.pointerId);aimEvent(event);});
  canvas.addEventListener('pointerup',function(event){if(blocked())return;aimEvent(event);fire();});
  document.querySelectorAll('[data-bubble]').forEach(function(button){button.addEventListener('click',function(){if(blocked()||projectile)return;var action=button.dataset.bubble;if(action==='fire')fire();else{angle=Math.max(-Math.PI+.18,Math.min(-.18,angle+(action==='left'?-.08:.08)));draw();}});});
  document.addEventListener('keydown',function(event){
    if(dialog.open||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
    var k=event.key.toLowerCase();
    if(k==='arrowleft'||k==='a'||k==='arrowright'||k==='d'){event.preventDefault();if(blocked()||projectile)return;angle=Math.max(-Math.PI+.18,Math.min(-.18,angle+(k==='arrowleft'||k==='a'?-.06:.06)));draw();}
    else if((event.code==='Space'||event.key==='Enter')&&!/BUTTON|A/.test(event.target.tagName)){event.preventDefault();if(!event.repeat)fire();}
  });
  function frame(now) {
    var delta=previousFrame?Math.min((now-previousFrame)/1000,.05):0;previousFrame=now;
    if(!blocked()&&projectile){var steps=Math.max(1,Math.ceil(delta/(1/240)));for(var i=0;i<steps&&projectile&&!blocked();i++)physics(delta/steps);draw();}
    requestAnimationFrame(frame);
  }
  function restart() {
    resetState();difficulty=settings.option;colorCount=({easy:3,normal:4,hard:5}[difficulty]);best=number('best:'+difficulty,0);
    board=Array.from({length:ROWS},function(_,r){return Array.from({length:columns(r)},function(){return r<4?Math.floor(Math.random()*colorCount):-1;});});
    score=0;shots=0;misses=0;projectile=null;angle=-Math.PI/2;previousFrame=0;currentColor=randomColor();nextColor=randomColor();
    update();draw();status('拖动瞄准，松手发射。同色相连三颗及以上消除。');
  }
  onResume=function(){status('继续瞄准，同色三连并清空所有泡泡。');};
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


