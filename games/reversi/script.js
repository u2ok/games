/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:reversi';
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


  // 8×8奥赛罗：沿八方向搜寻被己方棋子封闭的连续对方棋子，禁止跨行绕边。
  var directions = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  var board = [], turn = 1, history = [], last = -1, cursor = 19;
  var mode = read(key + ':mode') === 'local' ? 'local' : 'ai';
  var difficulty = settings.option, aiTimer = null, revision = 0;
  var grid = document.getElementById('grid');
  function flips(position, index, side) {
    if (index < 0 || index >= 64 || position[index]) return [];
    var result = [], x = index % 8, y = Math.floor(index / 8);
    directions.forEach(function (direction) {
      var nx = x + direction[0], ny = y + direction[1], line = [];
      while (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && position[ny * 8 + nx] === 3 - side) {
        line.push(ny * 8 + nx); nx += direction[0]; ny += direction[1];
      }
      if (line.length && nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && position[ny * 8 + nx] === side) result = result.concat(line);
    });
    return result;
  }
  function legalMoves(position, side) {
    var moves = [];
    position.forEach(function (value, index) { if (!value && flips(position, index, side).length) moves.push(index); });
    return moves;
  }
  function apply(position, index, side) {
    var captured = flips(position, index, side);
    if (!captured.length) return null;
    var next = position.slice(); next[index] = side;
    captured.forEach(function (i) { next[i] = side; }); return next;
  }
  function counts(position) { return [position.filter(function (v) { return v === 1; }).length, position.filter(function (v) { return v === 2; }).length]; }
  function sideName(side) { return side === 1 ? '黑棋' : '白棋'; }
  var weights = [100,-25,10,5,5,10,-25,100,-25,-45,-3,-3,-3,-3,-45,-25,10,-3,4,2,2,4,-3,10,5,-3,2,1,1,2,-3,5,5,-3,2,1,1,2,-3,5,10,-3,4,2,2,4,-3,10,-25,-45,-3,-3,-3,-3,-45,-25,100,-25,10,5,5,10,-25,100];
  function evaluate(position, side) {
    var value = 0, total = counts(position), occupied = total[0] + total[1];
    position.forEach(function (v, i) { if (v) value += (v === side ? 1 : -1) * weights[i]; });
    return value + 8 * (legalMoves(position, side).length - legalMoves(position, 3 - side).length) + (occupied > 48 ? 4 : 0) * (total[side - 1] - total[2 - side]);
  }
  function chooseAI(position, side, level) {
    var moves = legalMoves(position, side);
    if (!moves.length) return -1;
    if (level === 'easy') return moves[Math.floor(Math.random() * moves.length)];
    var nodes = 0, budget = level === 'hard' ? 12000 : 4000;
    // 限深负极大搜索，停着会交换视角；节点预算限制单次思考开销，不宣称最优。
    function search(state, player, depth, alpha, beta) {
      nodes += 1;
      var options = legalMoves(state, player);
      if (!options.length && !legalMoves(state, 3 - player).length) {
        var total = counts(state); return (total[player - 1] - total[2 - player]) * 10000;
      }
      if (!depth || nodes > budget) return evaluate(state, player);
      if (!options.length) return -search(state, 3 - player, depth - 1, -beta, -alpha);
      options.sort(function (a, b) { return weights[b] - weights[a]; });
      var value = -Infinity;
      for (var i = 0; i < options.length; i++) {
        value = Math.max(value, -search(apply(state, options[i], player), 3 - player, depth - 1, -beta, -alpha));
        alpha = Math.max(alpha, value); if (alpha >= beta) break;
      }
      return value;
    }
    var best = -Infinity, candidates = [];
    moves.sort(function (a, b) { return weights[b] - weights[a]; });
    moves.forEach(function (index) {
      var score = -search(apply(position, index, side), 3 - side, level === 'hard' ? 3 : 2, -Infinity, Infinity);
      if (score > best) { best = score; candidates = [index]; } else if (score === best) candidates.push(index);
    });
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  function draw() {
    var total = counts(board), legal = legalMoves(board, turn);
    grid.innerHTML = '';
    board.forEach(function (side, index) {
      var button = document.createElement('button'), allowed = !side && legal.indexOf(index) !== -1;
      button.type = 'button'; button.tabIndex = -1; button.dataset.index = index;
      button.className = (allowed ? 'reversi-legal' : '') + (index === cursor ? ' reversi-cursor' : '');
      button.setAttribute('aria-label', String.fromCharCode(65 + index % 8) + (Math.floor(index / 8) + 1) + '，' + (side ? sideName(side) : allowed ? '可落子' : '空格') + (index === last ? '，最后落子' : ''));
      button.setAttribute('aria-disabled', String(!!side || !allowed));
      if (side) button.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="27" rx="19" ry="18" fill="#253047" opacity=".18"/><circle cx="24" cy="23" r="19" fill="' + (side === 1 ? '#293d34' : '#fffdf3') + '" stroke="' + (side === 1 ? '#1e3028' : '#a9b5a0') + '"/>' + (index === last ? '<circle cx="24" cy="23" r="3" fill="#cf8b4e"/>' : '') + '</svg>';
      else if (allowed) button.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="4" fill="currentColor" opacity=".7"/></svg>';
      grid.appendChild(button);
    });
    document.getElementById('score-label').textContent = '黑棋' + (mode === 'ai' ? '（我方）' : '');
    document.getElementById('best-label').textContent = '白棋' + (mode === 'ai' ? '（电脑）' : '');
    document.getElementById('score').textContent = total[0]; document.getElementById('best').textContent = total[1];
    document.getElementById('rule-label').textContent = '8 × 8 · ' + (mode === 'ai' ? '人机 · ' + ({easy:'轻松',normal:'标准',hard:'挑战'}[difficulty] || '标准') : '双人对弈') + ' · 黑棋先行';
    document.getElementById('detail').textContent = ended ? '终局 · 黑 ' + total[0] + ' : ' + total[1] + ' 白' : sideName(turn) + '行棋 · 可落 ' + legal.length + ' 处 · 胜局 ' + number('wins:' + mode + ':1', 0) + ':' + number('wins:' + mode + ':2', 0);
    document.getElementById('undo').disabled = !history.length || ended;
    grid.setAttribute('aria-label', '黑白棋棋盘，' + sideName(turn) + '行棋，黑' + total[0] + '枚，白' + total[1] + '枚。方向键选择，回车落子。');
    document.querySelectorAll('[data-mode]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.mode === mode)); });
  }
  function cancelAI() { if (aiTimer !== null) clearTimeout(aiTimer); aiTimer = null; revision += 1; }
  function scheduleAI() {
    if (blocked() || mode !== 'ai' || turn !== 2 || aiTimer !== null) return;
    var token = revision;
    aiTimer = setTimeout(function () {
      aiTimer = null;
      if (token !== revision || blocked() || mode !== 'ai' || turn !== 2) return;
      var index = chooseAI(board, 2, difficulty); if (index >= 0) place(index, true);
    }, 320);
  }
  function finishGame() {
    var total = counts(board), winner = total[0] === total[1] ? 0 : total[0] > total[1] ? 1 : 2;
    if (winner) save(key + ':wins:' + mode + ':' + winner, String(number('wins:' + mode + ':' + winner, 0) + 1));
    var title = winner ? sideName(winner) + '获胜' : '和棋';
    finish(title + '！黑 ' + total[0] + ' : ' + total[1] + ' 白。');
    document.getElementById('status').dataset.tone = 'normal';
    showCover(title, '双方均无合法落点，黑 ' + total[0] + ' : ' + total[1] + ' 白。', '再玩一局');
  }
  function place(index, computer) {
    if (blocked() || (mode === 'ai' && (turn === 2) !== !!computer)) return false;
    var next = apply(board, index, turn); if (!next) { status('这里不能夹住对方棋子，请选择圆点位置。'); return false; }
    cancelAI(); history.push({ board: board.slice(), turn: turn, last: last });
    board = next; last = index; cursor = index; turn = 3 - turn; sound(600);
    if (!legalMoves(board, turn).length) {
      if (!legalMoves(board, 3 - turn).length) finishGame();
      else { var skipped = turn; turn = 3 - turn; status(sideName(skipped) + '无合法落点，自动停着；' + sideName(turn) + '继续。'); }
    } else status(sideName(turn) + (mode === 'ai' && turn === 2 ? '（电脑）思考中。' : '行棋，请选择圆点位置。'));
    draw(); scheduleAI(); return true;
  }
  function undo() {
    if (blocked() || !history.length) return;
    cancelAI(); var previous;
    do { previous = history.pop(); } while (mode === 'ai' && previous.turn !== 1 && history.length);
    board = previous.board; turn = previous.turn; last = previous.last; cursor = legalMoves(board, turn)[0] || 0;
    draw(); status('已悔棋，请重新落子。'); scheduleAI();
  }
  function restart() {
    cancelAI(); resetState(); difficulty = settings.option;
    board = Array(64).fill(0); board[27] = board[36] = 2; board[28] = board[35] = 1;
    turn = 1; history = []; last = -1; cursor = 19; draw(); status('黑棋先行，圆点标出可落子的位置。');
  }
  grid.addEventListener('click', function (event) { var button = event.target.closest('[data-index]'); if (button) { place(Number(button.dataset.index), false); grid.focus(); } });
  grid.addEventListener('keydown', function (event) {
    if (blocked() || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    var offsets = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-8, ArrowDown:8 };
    if (offsets[event.key]) {
      event.preventDefault(); var next = cursor + offsets[event.key];
      if (next >= 0 && next < 64 && (Math.abs(offsets[event.key]) !== 1 || Math.floor(next / 8) === Math.floor(cursor / 8))) cursor = next;
      draw(); grid.focus();
    } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) place(cursor, false); }
  });
  document.querySelectorAll('[data-mode]').forEach(function (button) { button.addEventListener('click', function () {
    if (mode === button.dataset.mode) return;
    mode = button.dataset.mode === 'local' ? 'local' : 'ai'; save(key + ':mode', mode);
    restart(); ready = true; showCover(mode === 'ai' ? '人机对战' : '双人对弈', '黑棋先行，切换模式已开启新一局。', '开始游戏'); syncStart();
  }); });
  onPause = cancelAI; onResume = scheduleAI;
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


