/* 贪吃蛇独立入口。普通脚本 + 闭包隔离状态，不依赖模块、网络或导航站资源。 */
(function () {
  'use strict';
  var SIZE = 20;
  var CELL = 30;
  var SPEEDS = { slow: 220, normal: 145, fast: 90 };
  var SPEED_NAMES = { slow: '慢速', normal: '标准速度', fast: '快速' };
  var DIRECTIONS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  var canvas = document.getElementById('board');
  var context = canvas.getContext('2d');
  var dialog = document.getElementById('settings');
  var settings = { sound: false, speed: 'normal', boundary: 'solid', grid: true };
  var activeRules;
  var snake = [];
  var food;
  var direction = DIRECTIONS.right;
  var queue = [];
  var score = 0;
  var best = 0;
  var state = 'ready'; // ready → running ↔ paused → over / won；只有 running 有定时器。
  var timer = null;
  var audioContext = null;
  var memory = {};
  var storageAvailable = true;
  var mode = 'classic';
  var levelIndex = 0;
  var obstacles = [];
  // 障碍均不封闭空间，出生点位于左上方，避免直接生成在墙内。
  var levels = [
    { name: '轻松入门', target: 3, speed: 'slow', hint: '熟悉转向，吃到 3 个食物。' },
    { name: '节奏加速', target: 5, speed: 'normal', hint: '提前转弯，找到自己的节奏。' },
    { name: '中央障碍', target: 6, speed: 'normal', hint: '绕开中央石块，留意蛇尾。' },
    { name: '双通道', target: 7, speed: 'normal', hint: '从两道墙的缺口穿过，规划路线。' },
    { name: '综合挑战', target: 8, speed: 'fast', hint: '加快节奏，沿开阔区域前进。' }
  ];
  var completed = 0;

  // 所有存储读写统一降级：浏览器禁止存储时，设置与成绩仍可在本次页面使用。
  function read(key) { try { return localStorage.getItem(key); } catch (error) { storageAvailable = false; return memory[key] || null; } }
  function write(key, value) { memory[key] = value; try { localStorage.setItem(key, value); } catch (error) { storageAvailable = false; } updateStorageNote(); }
  function updateStorageNote() { document.getElementById('storage-note').textContent = storageAvailable ? '' : '浏览器未允许本地存储，数据仅在当前页面保留。'; }
  try {
    var saved = JSON.parse(read('mini-games:snake:settings'));
    if (saved && typeof saved === 'object') {
      if (typeof saved.sound === 'boolean') settings.sound = saved.sound;
      if (Object.prototype.hasOwnProperty.call(SPEEDS, saved.speed)) settings.speed = saved.speed;
      if (saved.boundary === 'solid' || saved.boundary === 'wrap') settings.boundary = saved.boundary;
      if (typeof saved.grid === 'boolean') settings.grid = saved.grid;
    }
  } catch (error) { /* 损坏的历史设置直接使用默认值。 */ }
  var savedCompleted = Number(read('mini-games:snake:completed'));
  if (Number.isInteger(savedCompleted) && savedCompleted >= 0 && savedCompleted <= levels.length) completed = savedCompleted;
  function bestKey() { return mode === 'challenge' ? 'mini-games:snake:level-best:' + levelIndex : 'mini-games:snake:best:' + activeRules.speed + ':' + activeRules.boundary; }
  function loadBest() { var value = Number(read(bestKey())); best = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0; }
  function stopTimer() { if (timer !== null) { clearInterval(timer); timer = null; } }
  function startTimer() { stopTimer(); timer = setInterval(tick, SPEEDS[activeRules.speed]); }

  // 使用 Web Audio 合成短音效，不加载任何音频文件。必须由用户操作后才创建音频上下文。
  function unlockAudio() {
    if (!settings.sound) return;
    try { var Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return; if (!audioContext) audioContext = new Audio(); if (audioContext.state === 'suspended') audioContext.resume().catch(function () {}); } catch (error) { /* 不支持音频时静默运行。 */ }
  }
  function beep(frequency, length) {
    if (!settings.sound || !audioContext || audioContext.state !== 'running') return;
    try { var oscillator = audioContext.createOscillator(); var gain = audioContext.createGain(); oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0.06, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + length); oscillator.start(); oscillator.stop(audioContext.currentTime + length); } catch (error) { /* 音效失败不应影响游戏循环。 */ }
  }
  function updateScores() {
    document.getElementById('score').textContent = score;
    document.getElementById('best').textContent = mode === 'challenge' ? score / 10 + ' / ' + levels[levelIndex].target : best;
    document.getElementById('best-label').textContent = mode === 'challenge' ? '目标进度' : '最佳';
    document.getElementById('level-progress').max = levels[levelIndex].target;
    document.getElementById('level-progress').value = score / 10;
  }
  function renderLevels() {
    document.getElementById('panel-title').textContent = mode === 'challenge' ? '第 ' + (levelIndex + 1) + ' 关 · ' + levels[levelIndex].name : '本局游戏';
    document.getElementById('level-section').hidden = mode !== 'challenge';
    document.getElementById('level-progress').hidden = mode !== 'challenge';
    document.getElementById('restart').textContent = mode === 'challenge' ? '重新开始' : '重新开始';
    document.getElementById('level-hint').textContent = levels[levelIndex].hint;
    document.getElementById('level-list').innerHTML = levels.map(function (level, index) { return '<button data-level="' + index + '" aria-label="第' + (index + 1) + '关 ' + level.name + (index > completed ? '，未解锁' : '') + '" aria-pressed="' + (index === levelIndex) + '"' + (index > completed ? ' disabled' : '') + '>' + (index + 1) + '<small>' + (index < completed ? '✓' : index > completed ? '锁' : '·') + '</small></button>'; }).join('');
    document.querySelectorAll('[data-mode]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.mode === mode)); });
    // 规则由关卡固定；表现设置仍可随时调整，经典设置原值保留。
    document.querySelectorAll('#settings fieldset, .header-settings fieldset, .menu-settings fieldset').forEach(function (fieldset) { fieldset.disabled = mode === 'challenge'; });
  }
  function updateRuleLabel() { document.getElementById('rule-label').textContent = SPEED_NAMES[activeRules.speed] + ' · ' + (activeRules.boundary === 'wrap' ? '穿墙模式' : '撞墙结束'); }
  function announce(message) { document.getElementById('status').dataset.tone = state === 'over' ? 'error' : 'normal'; document.getElementById('status').textContent = message; }
  function syncControls() {
    document.getElementById('pause').disabled = state !== 'running' && state !== 'paused';
    document.getElementById('pause').textContent = state === 'paused' ? '继续游戏' : '暂停';
    document.getElementById('start').disabled = state === 'running';
    document.getElementById('start').textContent = state === 'paused' ? '继续游戏' : state === 'over' || state === 'won' ? '再玩一局' : '开始游戏';
    document.getElementById('overlay').hidden = state === 'running';
    var title = state === 'paused' ? '休息一下' : state === 'over' ? '这一局，收获 ' + score + ' 分' : state === 'won' ? '棋盘已满，你赢了！' : '来一局贪吃蛇';
    document.getElementById('overlay-title').textContent = title;
    document.getElementById('overlay-symbol').textContent = state === 'paused' ? 'Ⅱ' : state === 'over' ? '↻' : state === 'won' ? '★' : '↗';
    document.getElementById('overlay-description').textContent = state === 'paused' ? '准备好后，继续刚才的旅程。' : state === 'over' ? '每一局都是新的开始，再试一次吧。' : state === 'won' ? '每一个格子，都是你的足迹。' : '吃掉小果实，让快乐长一点。';
    document.getElementById('overlay-action').textContent = state === 'paused' ? '继续游戏' : state === 'over' || state === 'won' ? '再玩一局' : '开始游戏';
    document.getElementById('replay-level').hidden = !(mode === 'challenge' && state === 'won');
    if (mode === 'challenge') {
      if (state === 'ready') { document.getElementById('overlay-title').textContent = '第 ' + (levelIndex + 1) + ' 关 · ' + levels[levelIndex].name; document.getElementById('overlay-description').textContent = '吃到 ' + levels[levelIndex].target + ' 个食物即可过关。'; }
      if (state === 'won') { document.getElementById('overlay-title').textContent = levelIndex === levels.length - 1 ? '全部通关！' : '关卡完成！'; document.getElementById('overlay-description').textContent = '已完成 ' + levels[levelIndex].name + '，进度已保存。'; document.getElementById('overlay-action').textContent = levelIndex === levels.length - 1 ? '返回第一关' : '下一关 →'; }
    }
  }
  // 从所有空格中均匀选择食物，避免棋盘接近填满时随机重试陷入长循环。
  function placeFood() {
    var empty = [];
    for (var y = 0; y < SIZE; y += 1) for (var x = 0; x < SIZE; x += 1) {
      if (!snake.some(function (part) { return part.x === x && part.y === y; }) && !isObstacle(x, y)) empty.push({ x: x, y: y });
    }
    food = empty.length ? empty[Math.floor(Math.random() * empty.length)] : null;
  }
  function resetBoard() {
    stopTimer();
    activeRules = { speed: settings.speed, boundary: settings.boundary };
    snake = [{ x: 7, y: 10 }, { x: 6, y: 10 }, { x: 5, y: 10 }];
    obstacles = [];
    if (mode === 'challenge') {
      activeRules = { speed: levels[levelIndex].speed, boundary: 'solid' };
      snake = [{ x: 4, y: 3 }, { x: 3, y: 3 }, { x: 2, y: 3 }];
      if (levelIndex === 2) { for (var c = 7; c <= 12; c += 1) { if (c !== 9 && c !== 10) { obstacles.push({ x: c, y: 10 }); obstacles.push({ x: 10, y: c }); } } }
      if (levelIndex >= 3) { for (var row = 4; row <= 15; row += 1) { if (row !== 7 && row !== 8) obstacles.push({ x: 7, y: row }); if (row !== 11 && row !== 12) obstacles.push({ x: 13, y: row }); } }
      if (levelIndex === 4) { for (var col = 8; col <= 12; col += 1) obstacles.push({ x: col, y: 15 }); }
    }
    direction = DIRECTIONS.right; queue = []; score = 0;
    loadBest(); placeFood(); renderLevels(); updateScores(); updateRuleLabel(); draw();
  }
  function isObstacle(x, y) { return obstacles.some(function (cell) { return cell.x === x && cell.y === y; }); }
  function begin() {
    if (dialog.open || state === 'running') return;
    unlockAudio();
    if (state !== 'paused') resetBoard();
    state = 'running'; syncControls(); announce(mode === 'challenge' ? '吃到 ' + levels[levelIndex].target + ' 个食物即可过关，注意障碍。' : '游戏进行中：吃到食物 +10 分。'); startTimer(); canvas.focus({ preventScroll: true });
  }
  function pause(message) { if (state !== 'running') return; stopTimer(); state = 'paused'; syncControls(); announce(message || '已暂停，点击继续或按空格恢复。'); }
  function finish(won) { stopTimer(); state = won ? 'won' : 'over'; if (won && mode === 'challenge') { completed = Math.max(completed, levelIndex + 1); write('mini-games:snake:completed', String(completed)); renderLevels(); } beep(won ? 880 : 160, 0.25); syncControls(); announce(won ? mode === 'challenge' ? '关卡完成！已保存解锁进度。' : '恭喜填满棋盘！最终得分 ' + score : '游戏结束，本局 ' + score + ' 分。'); }

  // 每帧只应用一次转向。缓冲最多两次有效输入，防止快速连按造成同帧反向。
  function turn(name) {
    if (state !== 'running') return;
    var next = DIRECTIONS[name];
    var previous = queue.length ? queue[queue.length - 1] : direction;
    if (!next || queue.length >= 2 || (next.x === previous.x && next.y === previous.y) || (next.x === -previous.x && next.y === -previous.y)) return;
    queue.push(next);
  }
  function tick() {
    if (state !== 'running') return;
    if (queue.length) direction = queue.shift();
    var head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    if (activeRules.boundary === 'wrap') { head.x = (head.x + SIZE) % SIZE; head.y = (head.y + SIZE) % SIZE; }
    else if (head.x < 0 || head.x >= SIZE || head.y < 0 || head.y >= SIZE) { finish(false); return; }
    var eating = food && head.x === food.x && head.y === food.y;
    if (isObstacle(head.x, head.y)) { finish(false); return; }
    // 不吃食物时尾巴将移走，因此允许走进当前尾格；增长时则必须检测完整身体。
    var body = eating ? snake : snake.slice(0, -1);
    if (body.some(function (part) { return part.x === head.x && part.y === head.y; })) { finish(false); return; }
    snake.unshift(head);
    if (eating) {
      score += 10;
      if (score > best) { best = score; write(bestKey(), String(best)); }
      updateScores(); beep(660, 0.09); placeFood();
    } else snake.pop();
    draw();
    if (!food || (mode === 'challenge' && score / 10 >= levels[levelIndex].target)) finish(true);
  }
  function roundedRect(x, y, width, height, radius) {
    context.beginPath(); context.moveTo(x + radius, y); context.arcTo(x + width, y, x + width, y + height, radius); context.arcTo(x + width, y + height, x, y + height, radius); context.arcTo(x, y + height, x, y, radius); context.arcTo(x, y, x + width, y, radius); context.closePath(); context.fill();
  }
  function draw() {
    context.fillStyle = '#e3eadc'; context.fillRect(0, 0, 600, 600);
    if (settings.grid) { context.strokeStyle = '#cbd6c2'; context.lineWidth = 1; context.beginPath(); for (var i = 1; i < SIZE; i += 1) { context.moveTo(i * CELL, 0); context.lineTo(i * CELL, 600); context.moveTo(0, i * CELL); context.lineTo(600, i * CELL); } context.stroke(); }
    obstacles.forEach(function (cell) { context.fillStyle = '#8b9388'; roundedRect(cell.x * CELL + 2, cell.y * CELL + 2, 26, 26, 4); });
    if (food) { context.fillStyle = '#df9a5c'; context.beginPath(); context.arc(food.x * CELL + 15, food.y * CELL + 16, 10, 0, Math.PI * 2); context.fill(); context.fillStyle = '#527450'; context.beginPath(); context.ellipse(food.x * CELL + 20, food.y * CELL + 5, 6, 3, -0.6, 0, Math.PI * 2); context.fill(); }
    snake.forEach(function (part, index) { context.fillStyle = index === 0 ? '#245c4a' : '#41755b'; roundedRect(part.x * CELL + 1.5, part.y * CELL + 1.5, 27, 27, 7); });
    if (snake.length) {
      var head = snake[0];
      // 眼睛随方向旋转，帮助玩家迅速识别蛇头朝向。
      var eyeX = head.x * CELL + 15 + direction.x * 6;
      var eyeY = head.y * CELL + 15 + direction.y * 6;
      [-1, 1].forEach(function (side) { var x = eyeX + (direction.y ? side * 6 : 0); var y = eyeY + (direction.x ? side * 6 : 0); context.fillStyle = '#fffefa'; context.beginPath(); context.arc(x, y, 4, 0, Math.PI * 2); context.fill(); context.fillStyle = '#24352d'; context.beginPath(); context.arc(x + direction.x, y + direction.y, 1.7, 0, Math.PI * 2); context.fill(); });
    }
  }
  document.getElementById('start').addEventListener('click', begin);
  document.getElementById('overlay-action').addEventListener('click', function () { if (mode === 'challenge' && state === 'won') { levelIndex = levelIndex < levels.length - 1 ? levelIndex + 1 : 0; state = 'ready'; } begin(); });
  document.getElementById('replay-level').addEventListener('click', function () { state = 'ready'; begin(); });
  document.querySelectorAll('[data-mode]').forEach(function (button) { button.addEventListener('click', function () { if (mode === button.dataset.mode) return; mode = button.dataset.mode; state = 'ready'; resetBoard(); syncControls(); announce(mode === 'challenge' ? levels[levelIndex].hint : '经典模式：自由挑战最高分。'); }); });
  document.getElementById('level-list').addEventListener('click', function (event) { var button = event.target.closest('[data-level]'); if (!button || button.disabled) return; levelIndex = Number(button.dataset.level); state = 'ready'; resetBoard(); syncControls(); announce(levels[levelIndex].hint); });
  document.getElementById('pause').addEventListener('click', function () { if (state === 'paused') begin(); else pause(); });
  document.getElementById('restart').addEventListener('click', function () { state = 'ready'; begin(); });
  var keyMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  document.addEventListener('keydown', function (event) {
    if (dialog.open || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
    var name = keyMap[event.key] || keyMap[event.key.toLowerCase()];
    if (name && state === 'running') { event.preventDefault(); if (!event.repeat) turn(name); }
    if (event.code === 'Space' && event.target.tagName !== 'BUTTON' && event.target.tagName !== 'A') { event.preventDefault(); if (event.repeat) return; if (state === 'running') pause(); else begin(); }
  });
  document.querySelectorAll('[data-direction]').forEach(function (button) { button.addEventListener('click', function () { turn(button.dataset.direction); }); });
  // 手指滑动与方向按钮并存；仅拦截棋盘触摸，页面其余区域仍可正常滚动。
  var touchStart = null;
  canvas.addEventListener('pointerdown', function (event) { touchStart = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointerup', function (event) { if (!touchStart) return; var dx = event.clientX - touchStart.x; var dy = event.clientY - touchStart.y; touchStart = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 15) return; turn(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up'); });
  canvas.addEventListener('pointercancel', function () { touchStart = null; });
  document.getElementById('open-settings').addEventListener('click', function () { pause('打开设置，游戏已暂停。'); dialog.showModal(); });
  document.getElementById('close-settings').addEventListener('click', function () { dialog.close(); });
  document.getElementById('sound').checked = settings.sound;
  document.getElementById('grid').checked = settings.grid;
  document.querySelector('[name="speed"][value="' + settings.speed + '"]').checked = true;
  document.querySelector('[name="boundary"][value="' + settings.boundary + '"]').checked = true;
  dialog.addEventListener('change', function () {
    settings.sound = document.getElementById('sound').checked;
    settings.grid = document.getElementById('grid').checked;
    settings.speed = document.querySelector('[name="speed"]:checked').value;
    settings.boundary = document.querySelector('[name="boundary"]:checked').value;
    write('mini-games:snake:settings', JSON.stringify(settings)); unlockAudio(); draw();
    if (mode === 'classic' && (state === 'ready' || state === 'over' || state === 'won')) { activeRules = { speed: settings.speed, boundary: settings.boundary }; loadBest(); updateScores(); updateRuleLabel(); }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause('页面已离开，游戏自动暂停。'); });
  window.addEventListener('blur', function () { pause('窗口失去焦点，游戏自动暂停。'); });
  window.addEventListener('pagehide', stopTimer);
  window.addEventListener('pageshow', function () { if (state === 'running') pause('已返回页面，请继续游戏。'); });
  // 直接打开游戏也计入最近玩过；该记录不参与游戏运行。
  try { var recent = JSON.parse(read('mini-games:recent')); if (!Array.isArray(recent)) recent = []; write('mini-games:recent', JSON.stringify(['snake'].concat(recent.filter(function (id) { return typeof id === 'string' && id !== 'snake'; })).slice(0, 20))); } catch (error) { /* 历史记录异常不影响游戏。 */ }
  resetBoard(); syncControls(); updateStorageNote();
}());

