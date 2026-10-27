/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:puzzle';
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
  /* 数字华容道：0 表示空格，只有与空格相邻的数字可以移动。 */
  var size = Number(settings.option);
  var board = [];
  var steps = 0;
  var elapsed = 0;
  var started = 0;
  var best = number('best:' + size, 0);
  var grid = document.getElementById('grid');
  var swipe = null;
  var suppressClickUntil = 0;

  function adjacent(index) {
    var row = Math.floor(index / size);
    var col = index % size;
    var result = [];
    if (row > 0) result.push(index - size);
    if (row < size - 1) result.push(index + size);
    if (col > 0) result.push(index - 1);
    if (col < size - 1) result.push(index + 1);
    return result;
  }
  function solved() {
    return board.every(function (value, index) { return value === (index + 1) % (size * size); });
  }
  function swap(a, b) { var value = board[a]; board[a] = board[b]; board[b] = value; }
  // 从完成局面连续执行合法移动，避免随机排列生成无解棋盘；不保证最短解步数。
  function shuffle() {
    board = Array.from({ length: size * size }, function (_, index) { return (index + 1) % (size * size); });
    var blank = board.length - 1;
    var previous = -1;
    for (var i = 0; i < size * size * 40; i += 1) {
      var choices = adjacent(blank).filter(function (index) { return index !== previous; });
      var next = choices[Math.floor(Math.random() * choices.length)];
      swap(blank, next);
      previous = blank;
      blank = next;
    }
    if (solved()) swap(blank, adjacent(blank)[0]);
  }
  function seconds() { return Math.floor((elapsed + (started ? Date.now() - started : 0)) / 1000); }
  function stopClock() { if (started) elapsed += Date.now() - started; started = 0; }
  function updateDetail() {
    document.getElementById('detail').textContent = '用时 ' + seconds() + ' 秒 · 归位 ' + board.filter(function (value, index) { return value && value === index + 1; }).length + '/' + (board.length - 1);
  }
  function draw() {
    grid.innerHTML = '';
    grid.style.setProperty('--puzzle-size', size);
    var blank = board.indexOf(0);
    var allowed = adjacent(blank);
    board.forEach(function (value, index) {
      var tile = document.createElement(value ? 'button' : 'div');
      tile.className = 'puzzle-tile' + (!value ? ' blank' : value === index + 1 ? ' correct' : '') + (allowed.indexOf(index) !== -1 ? ' movable' : '');
      if (value) {
        tile.textContent = value;
        tile.dataset.index = index;
        tile.setAttribute('aria-label', '数字' + value + '，第' + (Math.floor(index / size) + 1) + '行第' + (index % size + 1) + '列' + (allowed.indexOf(index) !== -1 ? '，可移动' : ''));
      } else tile.setAttribute('aria-label', '空格');
      grid.appendChild(tile);
    });
    document.getElementById('rule-label').textContent = size + ' × ' + size + ' · 按顺序归位，空格留在右下角';
    updateScore(steps, best);
    updateDetail();
  }
  function slide(index) {
    if (blocked()) return false;
    var blank = board.indexOf(0);
    if (adjacent(blank).indexOf(index) === -1) return false;
    if (!started) started = Date.now();
    swap(blank, index);
    steps += 1;
    sound(540);
    if (solved()) {
      stopClock();
      if (!best || steps < best) { best = steps; save(key + ':best:' + size, String(best)); }
      finish('全部数字归位！共 ' + steps + ' 步，用时 ' + seconds() + ' 秒。');
      document.getElementById('status').dataset.tone = 'normal';
      showCover('拼图完成！', steps + ' 步 · ' + seconds() + ' 秒', '再玩一局');
    } else status('移动相邻数字，将空格留到右下角。');
    draw();
    return true;
  }
  function restart() {
    stopClock();
    resetState();
    size = Number(settings.option);
    best = number('best:' + size, 0);
    steps = 0; elapsed = 0; swipe = null;
    shuffle(); draw();
    status('点击空格旁的数字开始移动，首次有效移动开始计时。');
  }
  grid.addEventListener('click', function (event) {
    if (Date.now() < suppressClickUntil) return;
    var tile = event.target.closest('[data-index]');
    if (tile) slide(Number(tile.dataset.index));
  });
  // 方向键表示数字移动方向，例如向左会将空格右侧数字移入空格。
  var keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
  document.addEventListener('keydown', function (event) {
    if (dialog.open || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
    var direction = keys[event.key] || keys[event.key.toLowerCase()];
    if (!direction) return;
    event.preventDefault();
    var blank = board.indexOf(0);
    var target = blank + (direction === 'left' ? 1 : direction === 'right' ? -1 : direction === 'up' ? size : -size);
    // 额外检查行边界，防止空格在边缘时跨行移动。
    if ((direction === 'left' && blank % size === size - 1) || (direction === 'right' && blank % size === 0)) return;
    slide(target);
  });
  grid.addEventListener('pointerdown', function (event) {
    var tile = event.target.closest('[data-index]');
    swipe = tile ? { x: event.clientX, y: event.clientY, index: Number(tile.dataset.index) } : null;
  });
  grid.addEventListener('pointerup', function (event) {
    if (!swipe) return;
    var x = event.clientX - swipe.x; var y = event.clientY - swipe.y; var index = swipe.index; swipe = null;
    if (Math.max(Math.abs(x), Math.abs(y)) < 16) return;
    suppressClickUntil = Date.now() + 500;
    var blank = board.indexOf(0);
    var directionMatches = Math.abs(x) > Math.abs(y) ? Math.floor(blank / size) === Math.floor(index / size) && (blank - index) * x > 0 : blank % size === index % size && (blank - index) * y > 0;
    if (directionMatches) slide(index);
  });
  grid.addEventListener('pointercancel', function () { swipe = null; });
  onPause = stopClock;
  onResume = function () { if (steps) started = Date.now(); status('继续移动数字，完成拼图。'); };
  onOption = function () { status('棋盘尺寸已保存，重新开始后生效。'); };
  setInterval(function () { if (!blocked()) updateDetail(); }, 250);
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

