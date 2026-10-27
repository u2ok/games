/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:' + ({ '2048': '2048', '扫雷': 'mines', '记忆翻牌': 'memory', '打砖块': 'breakout' }[id]);
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
  /* Canvas 单关打砖块：固定小步长物理更新，避免低帧率时小球穿过砖块。 */
  var canvas = document.getElementById('canvas'); var ctx = canvas.getContext('2d'); var bricks = []; var paddle = 250; var ball = {}; var lives = 3; var score = 0; var speed; var flying = false; var best; var lastFrame = 0; var accumulator = 0; var held = { left: false, right: false }; var cover = document.getElementById('cover');
  function bestKey() { return key + ':best:' + speed; }
  function overlay(title, note, action) { cover.hidden = false; document.getElementById('cover-title').textContent = title; document.getElementById('cover-note').textContent = note; document.getElementById('launch').textContent = action || '开始游戏'; }
  function update() { updateScore(score, best); document.getElementById('detail').textContent = '生命 ' + '♥'.repeat(lives) + ' · 剩余砖块 ' + bricks.filter(function (brick) { return brick.alive; }).length + ' · ' + (speed === 'slow' ? '慢速' : '标准'); }
  function resetBall() { flying = false; ball = { x: paddle + 50, y: 537, vx: speed === 'slow' ? 150 : 190, vy: speed === 'slow' ? -225 : -285 }; }
  function draw() {
    ctx.fillStyle = '#e3eadc'; ctx.fillRect(0, 0, 600, 600);
    ctx.strokeStyle = '#cdd8c3'; ctx.lineWidth = 1; for (var i = 30; i < 600; i += 30) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 600); ctx.stroke(); }
    bricks.forEach(function (brick) { if (!brick.alive) return; ctx.fillStyle = ['#e8ab73', '#a9c6b8', '#557e64', '#d7bc84', '#83aaa3'][brick.row]; ctx.fillRect(brick.x, brick.y, brick.w, brick.h); });
    ctx.fillStyle = '#245c4a'; ctx.fillRect(paddle, 550, 100, 12); ctx.fillStyle = '#fffefa'; ctx.beginPath(); ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2); ctx.fill();
  }
  function launch() { if (ended) { restart(); } if (dialog.open) return; if (paused) { resume(); return; } flying = true; cover.hidden = true; ready = false; syncStart(); status('接住小球，清空所有砖块！'); sound(550); canvas.focus({ preventScroll: true }); }
  function physics(dt) {
    if (held.left) paddle -= 420 * dt; if (held.right) paddle += 420 * dt; paddle = Math.max(0, Math.min(500, paddle));
    if (!flying) { ball.x = paddle + 50; return; }
    var previousX = ball.x; var previousY = ball.y; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.x < 8) { ball.x = 8; ball.vx = Math.abs(ball.vx); } if (ball.x > 592) { ball.x = 592; ball.vx = -Math.abs(ball.vx); } if (ball.y < 8) { ball.y = 8; ball.vy = Math.abs(ball.vy); }
    // 依据击中挡板的位置改变反弹角度，并保证始终向上离开挡板。
    if (ball.vy > 0 && previousY + 8 <= 550 && ball.y + 8 >= 550 && ball.x + 8 >= paddle && ball.x - 8 <= paddle + 100) { var angle = Math.max(-1, Math.min(1, (ball.x - paddle - 50) / 50)) * 1.05; var magnitude = speed === 'slow' ? 270 : 345; ball.vx = Math.sin(angle) * magnitude; ball.vy = -Math.cos(angle) * magnitude; ball.y = 542; sound(420); }
    for (var i = 0; i < bricks.length; i += 1) { var brick = bricks[i]; if (!brick.alive || ball.x + 8 < brick.x || ball.x - 8 > brick.x + brick.w || ball.y + 8 < brick.y || ball.y - 8 > brick.y + brick.h) continue; brick.alive = false; score += 10;
      // 根据上一物理步所在侧判断碰撞法线，每一步最多反弹一次。
      if (previousY + 8 <= brick.y || previousY - 8 >= brick.y + brick.h) ball.vy *= -1; else if (previousX + 8 <= brick.x || previousX - 8 >= brick.x + brick.w) ball.vx *= -1; else ball.vy *= -1;
      if (score > best) { best = score; save(bestKey(), String(best)); } update(); sound(700); break;
    }
    if (score === 400) { flying = false; finish('全部 40 块砖已清空，你赢了！'); overlay('漂亮，全部击碎！', '最终得分 400，完成这一局。', '再玩一局'); }
    else if (ball.y > 610) { lives -= 1; update(); resetBall(); if (!lives) { finish('生命用完了！本局 ' + score + ' 分。'); overlay('本局 ' + score + ' 分', '再来一局，挑战清空全部砖块。', '再玩一局'); } else { status('还有 ' + lives + ' 条生命，点击继续发球。'); overlay('再接再厉', '剩余 ' + lives + ' 条生命。', '继续发球'); } }
  }
  function frame(now) { var delta = lastFrame ? Math.min((now - lastFrame) / 1000, .05) : 0; lastFrame = now; if (!blocked()) { accumulator += delta; while (accumulator >= 1 / 240 && !blocked()) { physics(1 / 240); accumulator -= 1 / 240; } } else accumulator = 0; draw(); requestAnimationFrame(frame); }
  function restart() { resetState(); speed = settings.option; best = number('best:' + speed, 0); paddle = 250; score = 0; lives = 3; bricks = []; accumulator = 0; held.left = held.right = false; for (var row = 0; row < 5; row += 1) for (var col = 0; col < 8; col += 1) bricks.push({ x: 24 + col * 70, y: 50 + row * 29, w: 64, h: 22, row: row, alive: true }); resetBall(); update(); draw(); overlay('准备好接球了吗？', '左右移动挡板，击碎 40 块砖。'); status('点击开始发球。支持方向键、鼠标与触屏。'); }
  function inputKey(event, value) { var name = event.key.toLowerCase(); var direction = name === 'arrowleft' || name === 'a' ? 'left' : name === 'arrowright' || name === 'd' ? 'right' : null; if (!direction || dialog.open || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return; event.preventDefault(); held[direction] = value; }
  document.addEventListener('keydown', function (event) { inputKey(event, true); }); document.addEventListener('keyup', function (event) { inputKey(event, false); });
  canvas.addEventListener('pointermove', function (event) { if (blocked()) return; var rect = canvas.getBoundingClientRect(); paddle = Math.max(0, Math.min(500, (event.clientX - rect.left) / rect.width * 600 - 50)); });
  canvas.addEventListener('pointerdown', function (event) { if (blocked()) return; canvas.setPointerCapture(event.pointerId); var rect = canvas.getBoundingClientRect(); paddle = Math.max(0, Math.min(500, (event.clientX - rect.left) / rect.width * 600 - 50)); });
  ['left', 'right'].forEach(function (name) { var button = document.getElementById(name); button.addEventListener('pointerdown', function (event) { if (blocked()) return; event.preventDefault(); button.setPointerCapture(event.pointerId); held[name] = true; }); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) { button.addEventListener(type, function () { held[name] = false; }); }); });
  onPause = function () { held.left = held.right = false; overlay('已暂停', '准备好后继续刚才的一局。', '继续游戏'); }; onResume = function () { cover.hidden = flying; if (!flying) overlay('准备发球', '移动挡板，点击按钮继续。', '继续发球'); status('继续游戏。'); };
  document.getElementById('launch').addEventListener('click', launch); document.getElementById('restart').addEventListener('click', restart); restart(); requestAnimationFrame(frame);

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
    document.getElementById('start').disabled = flying && !paused && !ended;
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
  if (id === '打砖块') ready = true;
  if (id !== '打砖块') { ready = true; showCover('准备好了吗？', '点击开始游戏，享受轻松一局。', '开始游戏'); }
  syncStart();

}());

