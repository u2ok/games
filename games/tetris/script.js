/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:tetris';
  var settings = { sound: false, option: null, ghost: false };
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
  // 新用户与旧设置缺少该字段时默认关闭，仅恢复明确保存的开启状态。
  settings.ghost = !!(saved && saved.ghost === true);
  document.getElementById('ghost').checked = settings.ghost;
  document.getElementById('ghost').addEventListener('change', function () {
    settings.ghost = this.checked;
    save(key + ':settings', JSON.stringify(settings));
    draw();
  });
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
  /* 10×20 逻辑棋盘与七袋随机系统。0 为背景，1–7 对应七种方块颜色。 */
  var WIDTH = 10;
  var HEIGHT = 20;
  var shapes = [
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    [[1,0,0],[1,1,1],[0,0,0]],
    [[0,0,1],[1,1,1],[0,0,0]],
    [[1,1],[1,1]],
    [[0,1,1],[1,1,0],[0,0,0]],
    [[0,1,0],[1,1,1],[0,0,0]],
    [[1,1,0],[0,1,1],[0,0,0]]
  ];
  var colors = ['#e3eadc', '#4e8c91', '#536c9e', '#c58b4c', '#cfb45c', '#63936a', '#8b6797', '#ad6861'];
  var board = [];
  var bag = [];
  var nextType;
  var piece;
  var score = 0;
  var lines = 0;
  var level = 1;
  var speed = settings.option;
  var best = number('best:' + speed, 0);
  var elapsed = 0;
  var previousFrame = 0;
  var canvas = document.getElementById('canvas');
  var context = canvas.getContext('2d');

  function takeType() {
    if (!bag.length) {
      bag = [0,1,2,3,4,5,6];
      for (var i = bag.length - 1; i > 0; i -= 1) {
        var j = Math.floor(Math.random() * (i + 1));
        var temporary = bag[i]; bag[i] = bag[j]; bag[j] = temporary;
      }
    }
    return bag.pop();
  }
  function collides(matrix, x, y) {
    for (var row = 0; row < matrix.length; row += 1) for (var col = 0; col < matrix[row].length; col += 1) {
      if (!matrix[row][col]) continue;
      var px = x + col; var py = y + row;
      if (px < 0 || px >= WIDTH || py >= HEIGHT || (py >= 0 && board[py][px])) return true;
    }
    return false;
  }
  function saveBest() {
    if (score > best) { best = score; save(key + ':best:' + speed, String(best)); }
  }
  function update() {
    saveBest(); updateScore(score, best);
    document.getElementById('detail').textContent = '等级 ' + level + ' · 消行 ' + lines;
    document.getElementById('rule-label').textContent = '10 × 20 · ' + ({ slow: '慢速', normal: '标准', fast: '快速' }[speed]) + ' · 每消 10 行升级';
    canvas.setAttribute('aria-label', '俄罗斯方块棋盘，当前得分' + score + '，消除' + lines + '行，等级' + level);
  }
  function spawn() {
    var type = nextType;
    nextType = takeType();
    piece = { type: type, matrix: shapes[type].map(function (row) { return row.slice(); }), x: Math.floor((WIDTH - shapes[type].length) / 2), y: -1 };
    elapsed = 0;
    if (collides(piece.matrix, piece.x, piece.y)) gameOver();
  }
  function gameOver() {
    finish('方块堆到顶部了！本局 ' + score + ' 分，共消除 ' + lines + ' 行。');
    showCover('本局结束', score + ' 分 · 消行 ' + lines, '再玩一局');
  }
  function clearLines() {
    var remaining = board.filter(function (row) { return row.some(function (cell) { return cell === 0; }); });
    var cleared = HEIGHT - remaining.length;
    while (remaining.length < HEIGHT) remaining.unshift(Array(WIDTH).fill(0));
    board = remaining;
    // 本次消行使用消除前的等级计分，再更新后续速度。
    score += [0,100,300,500,800][cleared] * level;
    lines += cleared; level = Math.floor(lines / 10) + 1;
    if (cleared) { sound(780); status('消除 ' + cleared + ' 行！继续调整落点。'); }
    update();
    return cleared;
  }
  function lock() {
    // 若锁定时仍有实体方格位于顶边外，直接判定结束，避免覆盖棋盘外数据。
    for (var r = 0; r < piece.matrix.length; r += 1) for (var c = 0; c < piece.matrix[r].length; c += 1) {
      if (piece.matrix[r][c] && piece.y + r < 0) { gameOver(); return; }
    }
    piece.matrix.forEach(function (row, y) {
      row.forEach(function (cell, x) { if (cell) board[piece.y + y][piece.x + x] = piece.type + 1; });
    });
    clearLines(); spawn();
  }
  function shift(dx) {
    if (blocked() || collides(piece.matrix, piece.x + dx, piece.y)) return false;
    piece.x += dx; draw(); return true;
  }
  function down(manual) {
    if (blocked()) return false;
    if (collides(piece.matrix, piece.x, piece.y + 1)) { lock(); draw(); return false; }
    piece.y += 1;
    if (manual) { score += 1; update(); }
    elapsed = 0; draw(); return true;
  }
  function hardDrop() {
    if (blocked()) return;
    var distance = 0;
    while (!collides(piece.matrix, piece.x, piece.y + 1)) { piece.y += 1; distance += 1; }
    score += distance * 2; lock(); update(); sound(450); draw();
  }
  function rotate(clockwise) {
    if (blocked()) return false;
    var matrix = piece.matrix;
    var n = matrix.length;
    var rotated = matrix.map(function (_, row) {
      return matrix.map(function (_, col) { return clockwise ? matrix[n - 1 - col][row] : matrix[col][n - 1 - row]; });
    });
    // 简化踢墙：按原位置、左右一格、左右两格、上移一/两格依次尝试。
    // 这是本游戏的简化旋转规则，并非完整 SRS 实现。
    var offsets = [[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1],[0,-2]];
    for (var i = 0; i < offsets.length; i += 1) {
      var x = piece.x + offsets[i][0]; var y = piece.y + offsets[i][1];
      if (!collides(rotated, x, y)) { piece.matrix = rotated; piece.x = x; piece.y = y; draw(); return true; }
    }
    return false;
  }
  function block(x, y, color, ghost) {
    if (y < 0) return;
    context.fillStyle = color;
    if (ghost) {
      context.strokeStyle = '#6f8665'; context.lineWidth = 2;
      context.strokeRect(150 + x * 30 + 3, y * 30 + 3, 24, 24);
    } else {
      context.fillRect(150 + x * 30 + 1, y * 30 + 1, 28, 28);
      context.fillStyle = '#ffffff35'; context.fillRect(150 + x * 30 + 3, y * 30 + 3, 24, 3);
    }
  }
  function draw() {
    context.fillStyle = '#f6f3ec'; context.fillRect(0, 0, 600, 600);
    context.fillStyle = '#e3eadc'; context.fillRect(150, 0, 300, 600);
    context.strokeStyle = '#cdd7c4'; context.lineWidth = 1;
    for (var x = 0; x <= WIDTH; x += 1) { context.beginPath(); context.moveTo(150 + x * 30, 0); context.lineTo(150 + x * 30, 600); context.stroke(); }
    for (var y = 0; y <= HEIGHT; y += 1) { context.beginPath(); context.moveTo(150, y * 30); context.lineTo(450, y * 30); context.stroke(); }
    board.forEach(function (row, y) { row.forEach(function (cell, x) { if (cell) block(x, y, colors[cell], false); }); });
    if (piece) {
      var ghostY = piece.y;
      if (settings.ghost) while (!collides(piece.matrix, piece.x, ghostY + 1)) ghostY += 1;
      piece.matrix.forEach(function (row, y) {
        row.forEach(function (cell, x) { if (cell) { if (settings.ghost) block(piece.x + x, ghostY + y, colors[piece.type + 1], true); block(piece.x + x, piece.y + y, colors[piece.type + 1], false); } });
      });
    }
    context.fillStyle = '#245c4a'; context.font = '20px "Microsoft YaHei",sans-serif'; context.textAlign = 'center';
    context.fillText('下一块', 522, 48);
    var next = shapes[nextType];
    if (next) next.forEach(function (row, y) { row.forEach(function (cell, x) { if (cell) { context.fillStyle = colors[nextType + 1]; context.fillRect(474 + x * 23, 76 + y * 23, 21, 21); } }); });
    context.fillStyle = '#667060'; context.font = '18px "Microsoft YaHei",sans-serif';
    context.fillText('等级', 75, 50); context.fillText(String(level), 75, 80);
    context.fillText('消行', 75, 130); context.fillText(String(lines), 75, 160);
  }
  function frame(now) {
    var delta = previousFrame ? Math.min(now - previousFrame, 100) : 0; previousFrame = now;
    if (!blocked()) {
      elapsed += delta;
      var interval = Math.max(80, ({ slow: 900, normal: 700, fast: 450 }[speed]) * Math.pow(.82, level - 1));
      if (elapsed >= interval) down(false);
    }
    requestAnimationFrame(frame);
  }
  function restart() {
    resetState(); speed = settings.option; best = number('best:' + speed, 0);
    board = Array.from({ length: HEIGHT }, function () { return Array(WIDTH).fill(0); });
    bag = []; score = 0; lines = 0; level = 1; elapsed = 0; previousFrame = 0;
    nextType = takeType(); spawn(); update(); draw();
    status('调整方向和旋转，填满一行即可消除。空格直接落下。');
  }
  function action(name) {
    if (name === 'left') shift(-1);
    else if (name === 'right') shift(1);
    else if (name === 'down') down(true);
    else if (name === 'rotate') rotate(true);
    else if (name === 'reverse') rotate(false);
    else if (name === 'drop') hardDrop();
  }
  var keys = { ArrowLeft:'left', ArrowRight:'right', ArrowDown:'down', ArrowUp:'rotate', a:'left', d:'right', s:'down', w:'rotate', x:'rotate', z:'reverse' };
  function handleKeydown(event) {
    var target = event.target || {};
    if (dialog.open || document.querySelectorAll('dialog[open]').length || target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName) || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    var name = keys[event.key] || keys[String(event.key).toLowerCase()];
    // 开始、重开及触控按钮会保留焦点；局内空格必须硬降，并阻止按钮再次点击。
    // 准备/暂停/终局保留按钮原生空格行为；按住空格只锁定一块。
    if (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar') {
      if (blocked()) return;
      name = 'drop';
    }
    if (!name) return;
    event.preventDefault();
    if (event.repeat && (name === 'drop' || name === 'rotate' || name === 'reverse')) return;
    action(name);
  }
  document.addEventListener('keydown', handleKeydown);
  document.querySelectorAll('[data-tetris]').forEach(function (button) {
    button.addEventListener('click', function () { action(button.dataset.tetris); });
  });
  onPause = function () { elapsed = 0; };
  onResume = function () { elapsed = 0; status('继续游戏，留意下一块与落点。'); };
  onOption = function () { status('速度设置已保存，新的一局生效。'); };
  document.getElementById('restart').addEventListener('click', restart);
  restart(); requestAnimationFrame(frame);

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


