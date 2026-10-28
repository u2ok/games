/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:gomoku';
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
  /* 自由五子棋：15×15，黑棋先行，五枚及以上连线获胜，不设置禁手。 */
  var SIZE = 15;
  var board = Array(225).fill(0);
  var turn = 1;
  var moves = [];
  var mode = read(key + ':mode') === 'local' ? 'local' : 'ai';
  var difficulty = settings.option;
  var cursor = 112;
  var winning = null;
  var aiTimer = null;
  var revision = 0;
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var axes = [[1, 0], [0, 1], [1, 1], [1, -1]];
  var ORIGIN = 24;
  var STEP = 552 / 14;
  function winsKey(side) { return key + ':wins:' + mode + ':' + side; }
  function inside(x, y) { return x >= 0 && x < SIZE && y >= 0 && y < SIZE; }
  function line(index, side) {
    var x = index % SIZE; var y = Math.floor(index / SIZE);
    for (var axis = 0; axis < axes.length; axis += 1) {
      var dx = axes[axis][0]; var dy = axes[axis][1];
      var start = { x: x, y: y }; var end = { x: x, y: y }; var count = 1;
      for (var sign = -1; sign <= 1; sign += 2) {
        var nx = x + dx * sign; var ny = y + dy * sign;
        while (inside(nx, ny) && board[ny * SIZE + nx] === side) {
          count += 1;
          if (sign === -1) start = { x: nx, y: ny }; else end = { x: nx, y: ny };
          nx += dx * sign; ny += dy * sign;
        }
      }
      if (count >= 5) return { start: start, end: end };
    }
    return null;
  }
  function update() {
    document.getElementById('score-label').textContent = mode === 'ai' ? '我方胜局' : '黑方胜局';
    document.getElementById('best-label').textContent = mode === 'ai' ? '电脑胜局' : '白方胜局';
    document.getElementById('score').textContent = number('wins:' + mode + ':1', 0);
    document.getElementById('best').textContent = number('wins:' + mode + ':2', 0);
    document.getElementById('rule-label').textContent = '15 × 15 · ' + (mode === 'ai' ? '人机对战 · ' + (difficulty === 'easy' ? '轻松' : '标准') : '本地双人') + ' · 无禁手';
    document.getElementById('detail').textContent = '第 ' + (moves.length + 1) + ' 手 · ' + (turn === 1 ? '黑棋' : '白棋') + (mode === 'ai' && turn === 2 ? '（电脑）' : '') + '落子';
    document.getElementById('undo').disabled = !moves.length || ended;
    document.querySelectorAll('[data-mode]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.mode === mode)); });
  }
  function circle(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function draw() {
    ctx.fillStyle = '#e6d7b9'; ctx.fillRect(0, 0, 600, 600);
    ctx.strokeStyle = '#9f8c66'; ctx.lineWidth = 1;
    for (var i = 0; i < SIZE; i += 1) {
      var p = ORIGIN + STEP * i;
      ctx.beginPath(); ctx.moveTo(ORIGIN, p); ctx.lineTo(576, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, ORIGIN); ctx.lineTo(p, 576); ctx.stroke();
    }
    [3, 7, 11].forEach(function (x) { [3, 7, 11].forEach(function (y) { circle(ORIGIN + x * STEP, ORIGIN + y * STEP, 3, '#9f8c66'); }); });
    board.forEach(function (side, index) {
      if (!side) return;
      var x = ORIGIN + index % SIZE * STEP; var y = ORIGIN + Math.floor(index / SIZE) * STEP;
      circle(x + 1, y + 2, 16, '#24352d22'); circle(x, y, 16, side === 1 ? '#24352d' : '#fffefa');
      ctx.strokeStyle = side === 1 ? '#16291e' : '#b5b3a0'; ctx.lineWidth = 1; ctx.stroke();
    });
    if (moves.length) {
      var last = moves[moves.length - 1].index;
      circle(ORIGIN + last % SIZE * STEP, ORIGIN + Math.floor(last / SIZE) * STEP, 4, '#c77c43');
    }
    if (winning) {
      ctx.strokeStyle = '#a75436'; ctx.lineWidth = 4; ctx.beginPath();
      ctx.moveTo(ORIGIN + winning.start.x * STEP, ORIGIN + winning.start.y * STEP);
      ctx.lineTo(ORIGIN + winning.end.x * STEP, ORIGIN + winning.end.y * STEP); ctx.stroke();
    } else if (cursor >= 0 && !board[cursor]) {
      ctx.strokeStyle = '#245c4a'; ctx.lineWidth = 2;
      ctx.strokeRect(ORIGIN + cursor % SIZE * STEP - 17, ORIGIN + Math.floor(cursor / SIZE) * STEP - 17, 34, 34);
    }
    update();
  }
  function cancelAI() { revision += 1; if (aiTimer !== null) clearTimeout(aiTimer); aiTimer = null; }
  // 候选点限制在已有棋子周围两格，评分考虑四方向连子长度和两端开放度。
  function candidates() {
    if (!moves.length) return [112];
    var result = [];
    board.forEach(function (side, index) {
      if (side) return;
      var x = index % SIZE; var y = Math.floor(index / SIZE); var near = false;
      for (var dy = -2; dy <= 2 && !near; dy += 1) for (var dx = -2; dx <= 2; dx += 1) {
        if (inside(x + dx, y + dy) && board[(y + dy) * SIZE + x + dx]) near = true;
      }
      if (near) result.push(index);
    });
    return result;
  }
  function evaluate(index, side) {
    var x = index % SIZE; var y = Math.floor(index / SIZE); var score = 0;
    axes.forEach(function (axis) {
      var count = 1; var open = 0;
      [-1, 1].forEach(function (sign) {
        var nx = x + axis[0] * sign; var ny = y + axis[1] * sign;
        while (inside(nx, ny) && board[ny * SIZE + nx] === side) { count += 1; nx += axis[0] * sign; ny += axis[1] * sign; }
        if (inside(nx, ny) && !board[ny * SIZE + nx]) open += 1;
      });
      score += count >= 5 ? 1000000 : open === 0 ? 0 : [0, 4, 40, 600, 12000][Math.min(count, 4)] * (open === 2 ? 3 : 1);
    });
    return score;
  }
  function chooseAI() {
    var options = candidates();
    for (var i = 0; i < options.length; i += 1) { board[options[i]] = 2; var win = line(options[i], 2); board[options[i]] = 0; if (win) return options[i]; }
    for (var j = 0; j < options.length; j += 1) { board[options[j]] = 1; var threat = line(options[j], 1); board[options[j]] = 0; if (threat) return options[j]; }
    options.sort(function (a, b) {
      function value(index) { return evaluate(index, 2) + evaluate(index, 1) * 1.1 - Math.abs(index % SIZE - 7) - Math.abs(Math.floor(index / SIZE) - 7); }
      return value(b) - value(a);
    });
    return options.length ? options[difficulty === 'easy' ? Math.floor(Math.random() * Math.min(5, options.length)) : 0] : -1;
  }
  function scheduleAI() {
    cancelAI();
    if (mode !== 'ai' || turn !== 2 || blocked()) return;
    var expected = revision;
    status('电脑正在思考……');
    aiTimer = setTimeout(function () {
      aiTimer = null;
      if (expected !== revision || blocked() || mode !== 'ai' || turn !== 2) return;
      place(chooseAI(), true);
    }, 350);
  }
  function place(index, computer) {
    if (blocked() || index < 0 || index >= 225 || board[index] || (mode === 'ai' && turn === 2 && !computer)) return false;
    board[index] = turn; moves.push({ index: index, side: turn }); cursor = index; sound(turn === 1 ? 500 : 650);
    winning = line(index, turn);
    if (winning) {
      save(winsKey(turn), String(number('wins:' + mode + ':' + turn, 0) + 1));
      finish((turn === 1 ? '黑方' : '白方') + '获胜！共 ' + moves.length + ' 手。');
      document.getElementById('status').dataset.tone = 'normal';
      showCover(turn === 1 ? '黑方获胜' : '白方获胜', '五子连珠，棋局完成。', '再玩一局');
    } else if (moves.length === 225) { finish('棋盘已满，本局和棋。'); document.getElementById('status').dataset.tone = 'normal'; showCover('和棋', '棋盘已满，双方未形成五连。', '再玩一局'); }
    else { turn = 3 - turn; status((turn === 1 ? '黑棋' : '白棋') + '落子。'); }
    draw(); if (!ended) scheduleAI(); return true;
  }
  function undo() {
    if (!moves.length || ended || paused || ready || dialog.open) return;
    cancelAI();
    // 人机模式回到玩家上一手之前，电脑尚未落子时只撤回玩家一手。
    var removed = moves.pop(); board[removed.index] = 0; turn = removed.side;
    if (mode === 'ai' && removed.side === 2 && moves.length) { removed = moves.pop(); board[removed.index] = 0; turn = removed.side; }
    winning = null; cursor = moves.length ? moves[moves.length - 1].index : 112;
    draw(); status('已悔棋，请重新落子。');
  }
  function restart() {
    cancelAI(); resetState(); difficulty = settings.option;
    board = Array(225).fill(0); turn = 1; moves = []; winning = null; cursor = 112;
    draw(); status(mode === 'ai' ? '你执黑棋先行，点击交叉点落子。' : '黑棋先行，两位玩家轮流落子。');
  }
  var pointer = null;
  canvas.addEventListener('pointerdown', function (event) { pointer = { x: event.clientX, y: event.clientY }; });
  canvas.addEventListener('pointerup', function (event) {
    if (!pointer || Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 12) { pointer = null; return; }
    pointer = null;
    var rect = canvas.getBoundingClientRect();
    var x = Math.round(((event.clientX - rect.left) / rect.width * 600 - ORIGIN) / STEP);
    var y = Math.round(((event.clientY - rect.top) / rect.height * 600 - ORIGIN) / STEP);
    if (inside(x, y)) place(y * SIZE + x, false);
  });
  canvas.addEventListener('pointercancel', function () { pointer = null; });
  document.addEventListener('keydown', function (event) {
    if (blocked() || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
    var offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -SIZE, ArrowDown: SIZE };
    if (offsets[event.key]) {
      event.preventDefault(); var next = cursor + offsets[event.key];
      if (next >= 0 && next < 225 && (Math.abs(offsets[event.key]) !== 1 || Math.floor(next / SIZE) === Math.floor(cursor / SIZE))) cursor = next;
      draw();
    } else if ((event.key === 'Enter' || event.code === 'Space') && event.target === canvas) { event.preventDefault(); place(cursor, false); }
  });
  document.querySelectorAll('[data-mode]').forEach(function (button) { button.addEventListener('click', function () {
    if (mode === button.dataset.mode) return;
    mode = button.dataset.mode === 'local' ? 'local' : 'ai'; save(key + ':mode', mode);
    restart(); ready = true; showCover(mode === 'ai' ? '人机对战' : '双人对弈', '黑棋先行，切换模式已开启新一局。', '开始游戏'); syncStart();
  }); });
  onPause = function () { cancelAI(); pointer = null; };
  onResume = scheduleAI;
  onOption = function () { status('难度已保存，下一局生效。'); };
  document.getElementById('undo').addEventListener('click', undo);
  document.getElementById('restart').addEventListener('click', restart);
  restart();

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


