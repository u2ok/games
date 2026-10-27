/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:linkmatch';
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
  /* 连连看：图案数据与一圈空白边界分离，路径搜索记录方向和转弯数。 */
  var configs = { easy: { size: 6, label: '轻松' }, normal: { size: 8, label: '标准' }, hard: { size: 10, label: '挑战' } };
  var symbols = ['✿', '◆', '★', '●', '▲', '♥', '☀', '☂', '♫', '☘', '✦', '☾'];
  // 使用同一32单位画布绘制，避免Unicode字形大小和系统字体影响辨识度。
  // 每种图案同时拥有独立轮廓和固定颜色，配对不依赖颜色单一线索。
  var symbolNames = ['花朵','菱形','星星','圆环','三角','爱心','太阳','雨伞','音符','四叶草','闪光','月亮'];
  var symbolPaths = [
    '<path d="M16 13C3-3 0 15 12 16-3 27 15 33 16 20c9 15 20-1 4-4C35 7 17-3 16 13Z"/><circle cx="16" cy="16" r="3" fill="white"/>',
    '<path d="m16 3 12 13-12 13L4 16Z"/><path d="m10 15 6-7" fill="none" stroke="white" stroke-width="2" opacity=".6"/>',
    '<path d="m16 2 4.2 9 9.8 1.3-7.2 7 1.8 10L16 24l-8.6 5.3 1.8-10-7.2-7 9.8-1.3Z"/>',
    '<circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="6"/>',
    '<path d="M14 5q2-4 4 0l12 21q1 3-2 3H4q-3 0-2-3Z"/>',
    '<path d="M16 28 4 17C-5 7 9-2 16 9 23-2 37 7 28 17Z"/>',
    '<circle cx="16" cy="16" r="7"/><path d="M16 2v3m0 22v3M2 16h3m22 0h3M6 6l2 2m16 16 2 2M6 26l2-2M24 8l2-2" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
    '<path d="M2 17a14 14 0 0 1 28 0q-4-4-7 0-4-4-7 0-4-4-7 0-4-4-7 0Z"/><path d="M16 4v21q0 7-5 3" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
    '<path d="M12 23V8l15-4v16M12 12l15-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><ellipse cx="8" cy="25" rx="5" ry="4"/><ellipse cx="23" cy="22" rx="5" ry="4"/>',
    '<path d="M16 15C-2-2 0 18 13 16-2 31 18 34 16 19c17 16 18-4 3-3C35 0 15-3 16 15Z"/>',
    '<path d="M16 1q2 13 15 15-13 2-15 15Q14 18 1 16 14 14 16 1Z"/>',
    '<path d="M23 3C3 0-3 25 17 29q8 0 12-7C12 29 6 10 23 3Z"/>'
  ];
  var size = 8;
  var board = [];
  var selected = -1;
  var difficulty = settings.option;
  var pairs = 0;
  var best = 0;
  var elapsed = 0;
  var started = 0;
  var hints = 0;
  var shuffles = 0;
  var highlight = [];
  var path = [];
  var effectTime = 0;
  var last = Date.now();
  var grid = document.getElementById('grid');
  var pathCanvas = document.getElementById('connection-path');
  var context = pathCanvas.getContext('2d');

  function position(index) { return { x: index % size + 1, y: Math.floor(index / size) + 1 }; }
  function valueAt(x, y) { return x < 1 || y < 1 || x > size || y > size ? 0 : board[(y - 1) * size + x - 1]; }
  function findPath(a, b) {
    if (a === b || !board[a] || !board[b]) return null;
    var source = position(a); var target = position(b);
    var directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
    var seen = {};
    var queue = [{ x: source.x, y: source.y, direction: -1, turns: 0, parent: null }];
    for (var head = 0; head < queue.length; head += 1) {
      var current = queue[head];
      if (current.x === target.x && current.y === target.y) {
        var route = []; var node = current;
        while (node) { route.unshift({ x: node.x, y: node.y }); node = node.parent; }
        return route;
      }
      directions.forEach(function (direction, index) {
        var x = current.x + direction.x; var y = current.y + direction.y;
        var turns = current.turns + (current.direction === -1 || current.direction === index ? 0 : 1);
        if (turns > 2 || x < 0 || y < 0 || x > size + 1 || y > size + 1) return;
        if (valueAt(x, y) && !(x === target.x && y === target.y)) return;
        var key = x + ',' + y + ',' + index;
        if (seen[key] !== undefined && seen[key] <= turns) return;
        seen[key] = turns;
        queue.push({ x: x, y: y, direction: index, turns: turns, parent: current });
      });
    }
    return null;
  }
  function findPair(ignoreValue) {
    for (var a = 0; a < board.length; a += 1) {
      if (!board[a]) continue;
      for (var b = a + 1; b < board.length; b += 1) {
        if (!board[b] || (!ignoreValue && board[a] !== board[b])) continue;
        var route = findPath(a, b);
        if (route) return { a: a, b: b, route: route };
      }
    }
    return null;
  }
  function shuffled(values) {
    var copy = values.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) { var j = Math.floor(Math.random() * (i + 1)); var temp = copy[i]; copy[i] = copy[j]; copy[j] = temp; }
    return copy;
  }
  function rearrange() {
    var occupied = []; var values = [];
    board.forEach(function (value, index) { if (value) { occupied.push(index); values.push(value); } });
    if (!values.length) return;
    // 有界重试；保留空格位置与图案数量，避免重排改变已消除进度。
    for (var tries = 0; tries < 24; tries += 1) {
      var mixed = shuffled(values);
      occupied.forEach(function (index, offset) { board[index] = mixed[offset]; });
      if (findPair(false)) return;
    }
    // 若随机重排仍无配对，把一对图案换到可连通位置，不增加或删除图案。
    var slots = findPair(true);
    if (slots) {
      var partner = board.findIndex(function (value, index) { return index !== slots.a && value === board[slots.a]; });
      var old = board[slots.b]; board[slots.b] = board[partner]; board[partner] = old;
    }
  }
  function seconds() { return Math.floor((elapsed + (started ? Date.now() - started : 0)) / 1000); }
  function stopClock() { if (started) elapsed += Date.now() - started; started = 0; }
  function updateDetail() {
    // 计时循环也会调用此函数；只有计数变化才写入，避免无意义DOM更新。
    var detailNode = document.getElementById('detail');
    var detailText = '已消 ' + pairs + '/' + size * size / 2 + ' 对 · 提示 ' + hints + ' · 洗牌 ' + shuffles;
    if (detailNode.textContent !== detailText) detailNode.textContent = detailText;
    updateScore(seconds(), best);
  }
  function drawPath() {
    context.clearRect(0, 0, 600, 600);
    if (path.length < 2 || effectTime <= 0) return;
    var unit = 600 / (size + 2);
    context.strokeStyle = '#d08a41'; context.lineWidth = 4; context.lineJoin = 'round'; context.lineCap = 'round'; context.beginPath();
    path.forEach(function (point, index) { if (index) context.lineTo((point.x + .5) * unit, (point.y + .5) * unit); else context.moveTo((point.x + .5) * unit, (point.y + .5) * unit); });
    context.stroke();
  }
  function draw() {
    grid.style.setProperty('--link-size', size);
    grid.innerHTML = '';
    // 外圈真实占位，连接线和棋盘采用相同坐标，绕行不会被边框裁掉。
    for (var y = 0; y < size + 2; y += 1) for (var x = 0; x < size + 2; x += 1) {
      var index = (y - 1) * size + x - 1;
      var inside = x > 0 && y > 0 && x <= size && y <= size;
      var value = inside ? board[index] : 0;
      var tile = document.createElement(value ? 'button' : 'span');
      tile.className = 'link-tile' + (!value ? ' empty' : '') + (inside && selected === index ? ' selected' : '') + (inside && highlight.indexOf(index) !== -1 ? ' hinted' : '');
      if (value) {
        tile.innerHTML = '<svg viewBox="0 0 32 32" class="tile-symbol" aria-hidden="true" focusable="false">' + symbolPaths[value - 1] + '</svg>'; tile.dataset.index = index; tile.dataset.color = value - 1;
        tile.setAttribute('aria-label', '第' + y + '行第' + x + '列，' + symbolNames[value - 1]);
        tile.setAttribute('aria-pressed', String(selected === index));
      } else tile.setAttribute('aria-hidden', 'true');
      grid.appendChild(tile);
    }
    drawPath(); updateDetail();
  }
  function ensureMove() {
    if (board.some(Boolean) && !findPair(false)) { rearrange(); status('当前没有可连接的配对，已自动重排剩余图案。'); }
  }
  function choose(index) {
    if (blocked() || !board[index]) return;
    if (!started) started = Date.now();
    if (selected === index) { selected = -1; draw(); return; }
    if (selected < 0) { selected = index; highlight = []; draw(); return; }
    var route = board[selected] === board[index] ? findPath(selected, index) : null;
    if (!route) { selected = index; highlight = []; status('不能连接：需要相同图案，路径不超过两次转弯。'); draw(); return; }
    board[selected] = 0; board[index] = 0; selected = -1; highlight = []; pairs += 1;
    path = route; effectTime = .4; last = Date.now(); sound(650);
    if (!board.some(Boolean)) {
      stopClock(); var time = Math.max(1, seconds());
      if (!best || time < best) { best = time; save(key + ':best:' + difficulty, String(best)); }
      finish('全部配对成功！用时 ' + time + ' 秒。');
      showCover('全部消除！', '用时 ' + time + ' 秒 · 提示 ' + hints + ' 次 · 洗牌 ' + shuffles + ' 次', '再玩一局');
    } else { status('配对成功！继续寻找相同图案。'); ensureMove(); }
    draw();
  }
  function hint() {
    if (blocked()) return;
    if (!started) started = Date.now();
    ensureMove(); var pair = findPair(false);
    if (pair) { selected = -1; hints += 1; highlight = [pair.a, pair.b]; path = pair.route; effectTime = 1.2; last = Date.now(); status('已标出一对可连接图案。'); draw(); }
  }
  function shuffle() {
    if (blocked()) return;
    if (!started) started = Date.now();
    shuffles += 1; selected = -1; highlight = []; path = []; effectTime = 0;
    rearrange(); status('剩余图案已洗牌，消除进度保持不变。'); draw();
  }
  function restart() {
    stopClock(); resetState(); difficulty = settings.option; size = configs[difficulty].size;
    board = [];
    for (var i = 0; i < size * size / 2; i += 1) { board.push(i % symbols.length + 1); board.push(i % symbols.length + 1); }
    board = shuffled(board); rearrange(); selected = -1; pairs = 0; hints = 0; shuffles = 0; elapsed = 0; started = 0; highlight = []; path = []; effectTime = 0; last = Date.now();
    best = number('best:' + difficulty, 0);
    document.getElementById('rule-label').textContent = configs[difficulty].label + ' · ' + size + ' × ' + size + ' · 最多两次转弯';
    draw(); status('点击两个相同图案，连接路径最多转弯两次。首次选择开始计时。');
  }
  grid.addEventListener('click', function (event) { var tile = event.target.closest('[data-index]'); if (tile) choose(Number(tile.dataset.index)); });
  document.getElementById('hint').addEventListener('click', hint);
  document.getElementById('shuffle').addEventListener('click', shuffle);
  document.getElementById('restart').addEventListener('click', restart);
  onPause = function () { stopClock(); drawPath(); };
  onResume = function () { if (pairs || hints || shuffles || selected >= 0 || elapsed) started = Date.now(); last = Date.now(); status('继续寻找可连接的配对。'); };
  onOption = function () { status('难度已保存，重新开始后生效。'); };
  setInterval(function () {
    var now = Date.now(); var delta = (now - last) / 1000; last = now;
    if (blocked()) return;
    if (effectTime > 0) { effectTime = Math.max(0, effectTime - delta); if (!effectTime) { path = []; highlight = []; draw(); } else drawPath(); }
    updateDetail();
  }, 50);
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


