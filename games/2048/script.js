/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
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
  /* 用一维数组表达棋盘；每行压缩、合并、补零，同一次移动新生成的值不会再次合并。 */
  var board = [];
  // 宫廷版只改变展示，仍以 2 的幂进行合并，确保两种模式的规则一致。
  var ranks = ['宫女', '答应', '常在', '贵人', '嫔', '妃', '贵妃', '皇贵妃', '皇后', '皇太后', '太皇太后'];
  var mode = read(key + ':mode') === 'palace' ? 'palace' : 'classic';
  var score = 0;
  var best = number(mode === 'palace' ? 'best:palace' : 'best', 0);
  var won = false;
  var grid = document.getElementById('grid');
  function spawn() { var empty = []; board.forEach(function (value, index) { if (!value) empty.push(index); }); if (empty.length) board[empty[Math.floor(Math.random() * empty.length)]] = Math.random() < .9 ? 2 : 4; }
  function rankName(value) {
    if (!value) return '';
    var index = Math.log2(value) - 1;
    // 达成目标后继续合并，使用追加星级表达，避免超出位阶表出现空白。
    return index < ranks.length ? ranks[index] : '太皇太后 ' + (index - ranks.length + 2) + '星';
  }
  function bestKey() { return key + (mode === 'palace' ? ':best:palace' : ':best'); }
  function draw() {
    grid.innerHTML = '';
    grid.classList.toggle('animated', settings.option);
    grid.classList.toggle('palace-grid', mode === 'palace');
    document.querySelectorAll('[data-mode]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    });
    board.forEach(function (value) {
      var tile = document.createElement('div');
      tile.className = 'tile' + (value ? ' filled' : '');
      tile.dataset.level = Math.min(5, Math.max(1, Math.floor(Math.log2(value || 2) / 2)));
      if (value && mode === 'palace') {
        var name = document.createElement('span');
        name.className = 'rank-name';
        name.textContent = rankName(value);
        var numeric = document.createElement('small');
        numeric.className = 'rank-value';
        numeric.textContent = value;
        tile.appendChild(name);
        tile.appendChild(numeric);
      } else tile.textContent = value || '';
      tile.setAttribute('aria-label', value ? mode === 'palace' ? rankName(value) + '，' + value : String(value) : '空格');
      grid.appendChild(tile);
    });
    updateScore(score, best);
    var maximum = Math.max.apply(null, board);
    document.getElementById('rule-label').textContent = mode === 'palace' ? '宫廷晋升 · 目标太皇太后' : '4 × 4 · 目标 2048';
    document.getElementById('detail').textContent = mode === 'palace' ? '当前最高：' + rankName(maximum) : '目标 2048 · 最大方块 ' + maximum;
  }
  function movable() { for (var i = 0; i < 16; i += 1) if (!board[i] || (i % 4 < 3 && board[i] === board[i + 1]) || (i < 12 && board[i] === board[i + 4])) return true; return false; }
  function move(direction) {
    if (blocked()) return;
    var before = board.join(',');
    for (var line = 0; line < 4; line += 1) {
      var indices = [];
      for (var j = 0; j < 4; j += 1) indices.push(direction === 'left' ? line * 4 + j : direction === 'right' ? line * 4 + 3 - j : direction === 'up' ? j * 4 + line : (3 - j) * 4 + line);
      var values = indices.map(function (index) { return board[index]; }).filter(Boolean);
      var merged = [];
      for (var n = 0; n < values.length; n += 1) { if (values[n] === values[n + 1]) { merged.push(values[n] * 2); score += values[n] * 2; n += 1; } else merged.push(values[n]); }
      indices.forEach(function (index, offset) { board[index] = merged[offset] || 0; });
    }
    if (before === board.join(',')) return;
    spawn(); if (score > best) { best = score; save(bestKey(), String(best)); } sound(); draw();
    if (!won && board.some(function (value) { return value >= 2048; })) {
      won = true;
      status(mode === 'palace' ? '恭喜晋升太皇太后！可继续合并，挑战更高星级。' : '已合出 2048！你可以继续挑战更大的数字。');
    } else status(mode === 'palace' ? won ? '继续合并，挑战更高星级。' : '合并相同位阶，逐级晋升。' : won ? '继续挑战，看看还能合出多大的数字。' : '方向键或滑动，合并相同数字。');
    if (!movable()) finish('没有可移动的位置了！本局 ' + score + ' 分，点击新的一局再试。');
  }
  function restart() { resetState(); board = Array(16).fill(0); score = 0; won = false; spawn(); spawn(); draw(); status(mode === 'palace' ? '合并相同位阶，从宫女一步步晋升。' : '方向键 / WASD 或滑动，合并相同数字。'); }
  // 原始模式控件会由 interface.js 在手机端移动到菜单，事件绑定保持不变。
  document.querySelectorAll('[data-mode]').forEach(function (button) {
    button.addEventListener('click', function () {
      var next = button.dataset.mode;
      if (next === mode) return;
      mode = next === 'palace' ? 'palace' : 'classic';
      save(key + ':mode', mode);
      best = number(mode === 'palace' ? 'best:palace' : 'best', 0);
      restart();
      ready = true;
      showCover(mode === 'palace' ? '宫廷晋升' : '经典数字', '切换模式已开启新一局。', '开始游戏');
      syncStart();
    });
  });
  var keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
  document.addEventListener('keydown', function (event) { if (dialog.open || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return; var direction = keys[event.key] || keys[event.key.toLowerCase()]; if (direction) { event.preventDefault(); move(direction); } });
  var origin;
  grid.addEventListener('pointerdown', function (event) { origin = { x: event.clientX, y: event.clientY }; grid.setPointerCapture(event.pointerId); });
  grid.addEventListener('pointerup', function (event) { if (!origin) return; var x = event.clientX - origin.x; var y = event.clientY - origin.y; origin = null; if (Math.max(Math.abs(x), Math.abs(y)) < 18) return; move(Math.abs(x) > Math.abs(y) ? x > 0 ? 'right' : 'left' : y > 0 ? 'down' : 'up'); });
  grid.addEventListener('pointercancel', function () { origin = null; });
  onPause = function () {  }; onResume = function () { grid.style.visibility = ''; status(mode === 'palace' ? '继续游戏，合并相同位阶。' : '继续游戏，合并相同数字。'); }; onOption = draw;
  document.getElementById('restart').addEventListener('click', function () { grid.style.visibility = ''; restart(); });
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

