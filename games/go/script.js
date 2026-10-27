/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:go';
  var settings = { sound: false, option: null, level: 'normal' };
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
  try { var saved = JSON.parse(read(key + ':settings')); if (saved && typeof saved === 'object') { settings.sound = saved.sound === true; settings.option = saved.option; if (['easy','normal','hard'].indexOf(saved.level) >= 0) settings.level = saved.level; } } catch (error) { /* 历史设置损坏时使用默认值。 */ }
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




  // 采用禁自杀、位置超级劫和中国式面积计分；停着不加入重复盘面检查。
  var size = 9, board = [], turn = 1, history = [], positions = [], captures = [0,0];
  var passes = 0, phase = 'play', dead = [], cursor = 40, last = -1, resignArmed = false, scored = false;
  var mode = read(key + ':mode') === 'local' ? 'local' : 'ai';
  var level = settings.level, aiTimer = null, revision = 0;
  var grid = document.getElementById('grid'), levelSelect = document.getElementById('ai-level');
  levelSelect.value = settings.level;
  function sideName(side) { return side === 1 ? '黑棋' : '白棋'; }
  function point(index) { return 'ABCDEFGHJKLMNOPQRST'[index % size] + (size - Math.floor(index / size)); }
  function neighbors(index, width) {
    var x = index % width, y = Math.floor(index / width), result = [];
    if (x) result.push(index - 1); if (x < width - 1) result.push(index + 1);
    if (y) result.push(index - width); if (y < width - 1) result.push(index + width);
    return result;
  }
  function group(position, start, width) {
    var side = position[start], stones = [], liberties = [], stack = [start], seen = {};
    if (!side) return { stones: [], liberties: [] };
    seen[start] = true;
    while (stack.length) {
      var index = stack.pop(); stones.push(index);
      neighbors(index, width).forEach(function (next) {
        if (!position[next]) { if (liberties.indexOf(next) < 0) liberties.push(next); }
        else if (position[next] === side && !seen[next]) { seen[next] = true; stack.push(next); }
      });
    }
    return { stones: stones, liberties: liberties };
  }
  function hash(position) { return position.join(''); }
  function attempt(position, index, side, width, previous) {
    if (!Number.isInteger(index) || index < 0 || index >= position.length || position[index]) return { error: '这里已有棋子，请选择空交叉点。' };
    var next = position.slice(), taken = [], checked = {};
    next[index] = side;
    neighbors(index, width).forEach(function (near) {
      if (next[near] !== 3 - side || checked[near]) return;
      var chain = group(next, near, width);
      chain.stones.forEach(function (stone) { checked[stone] = true; });
      if (!chain.liberties.length) taken = taken.concat(chain.stones);
    });
    taken.forEach(function (stone) { next[stone] = 0; });
    if (!group(next, index, width).liberties.length) return { error: '禁自杀：这手落子后没有气。' };
    var signature = hash(next);
    if (previous && previous.indexOf(signature) >= 0) return { error: '劫或局面重复：不能恢复此前已有的盘面。' };
    return { board: next, taken: taken, signature: signature };
  }
  // 移除手动确认的死子后，存活棋子及仅接触单一颜色的连通空区计入面积。
  function areaScore(position, width, marked, komi) {
    var next = position.slice(), total = [0,0], owner = Array(next.length).fill(0), visited = {};
    marked.forEach(function (i) { next[i] = 0; });
    next.forEach(function (value, index) {
      if (value) { total[value - 1] += 1; return; }
      if (visited[index]) return;
      var queue = [index], empty = [], borders = {};
      visited[index] = true;
      while (queue.length) {
        var current = queue.pop(); empty.push(current);
        neighbors(current, width).forEach(function (near) {
          if (next[near]) borders[next[near]] = true;
          else if (!visited[near]) { visited[near] = true; queue.push(near); }
        });
      }
      var colors = Object.keys(borders);
      if (colors.length === 1) { var side = Number(colors[0]); total[side - 1] += empty.length; empty.forEach(function (i) { owner[i] = side; }); }
    });
    return { black: total[0], white: total[1] + komi, whiteArea: total[1], owner: owner };
  }
  function snapshot() { return { board: board.slice(), turn: turn, captures: captures.slice(), passes: passes, last: last, length: positions.length }; }
  function ownEye(position, index, side) {
    return neighbors(index, size).every(function (i) { return position[i] === side; });
  }
  function chooseAI() {
    var options = [], occupied = board.filter(Boolean).length;
    board.forEach(function (value, index) {
      if (value) return;
      var trial = attempt(board, index, 2, size, positions);
      if (trial.error || (!trial.taken.length && ownEye(board, index, 2))) return;
      var chain = group(trial.board, index, size), adjacent = neighbors(index, size), helped = 0, attack = 0, seen = {};
      adjacent.forEach(function (near) {
        if (!board[near] || seen[near]) return;
        var before = group(board, near, size); before.stones.forEach(function (i) { seen[i] = true; });
        if (board[near] === 2 && before.liberties.length === 1 && chain.liberties.length > 1) helped += before.stones.length;
        if (trial.board[near] === 1 && group(trial.board, near, size).liberties.length === 1) attack += before.stones.length;
      });
      var x = index % size, y = Math.floor(index / size), edge = Math.min(x,y,size-1-x,size-1-y);
      var nearby = board.some(function (stone, i) { return stone && Math.abs(i % size - x) + Math.abs(Math.floor(i / size) - y) <= 3; });
      var score = trial.taken.length * 24 + helped * 18 + attack * 5 + Math.min(chain.liberties.length, 5) * 2;
      if (chain.liberties.length === 1) score -= 36;
      score += occupied < size * size / 3 ? (edge === 2 || edge === 3 ? 6 : edge === 0 ? -5 : 0) : 0;
      if (!nearby && occupied < size * size / 2) score += 3;
      options.push({ index: index, score: score, trial: trial });
    });
    if (!options.length) return -1;
    options.sort(function (a,b) { return b.score - a.score; });
    if (level === 'easy') return options[Math.floor(Math.random() * Math.min(12, options.length))].index;
    if (level === 'hard') {
      // 对前八个候选检查对方最危险的即时提子反击，避免全盘深搜阻塞手机。
      options.slice(0,8).forEach(function (candidate) {
        var danger = 0, next = candidate.trial.board;
        next.forEach(function (value, index) {
          if (value || !neighbors(index, size).some(function (near) { return next[near] === 2; })) return;
          var reply = attempt(next, index, 1, size, positions.concat([candidate.trial.signature]));
          if (!reply.error) danger = Math.max(danger, reply.taken.length * 20);
        });
        candidate.score -= danger;
      });
      options = options.slice(0,8).sort(function (a,b) { return b.score - a.score; });
    }
    if (passes && options[0].score < 0 && occupied > size * size / 2) return -1;
    var best = options.filter(function (item) { return item.score >= options[0].score - 1; });
    return best[Math.floor(Math.random() * best.length)].index;
  }
  function draw() {
    grid.innerHTML = ''; grid.style.gridTemplateColumns = 'repeat(' + size + ',minmax(0,1fr))';
    grid.style.gridTemplateRows = 'repeat(' + size + ',minmax(0,1fr))'; grid.dataset.turn = turn;
    var lines = '<svg class="go-lines" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">';
    for (var i = 0; i < size; i++) lines += '<path d="M.5 ' + (i+.5) + 'H' + (size-.5) + 'M' + (i+.5) + ' .5V' + (size-.5) + '" stroke="#a48b60" stroke-width=".025"/>';
    var stars = size === 9 ? [2,4,6] : size === 13 ? [3,6,9] : [3,9,15];
    stars.forEach(function (x) { stars.forEach(function (y) { if (size !== 9 || x === y || x + y === 8) lines += '<circle cx="' + (x+.5) + '" cy="' + (y+.5) + '" r=".075" fill="#8f774f"/>'; }); });
    grid.innerHTML = lines + '</svg>';
    var score = phase === 'counting' || scored ? areaScore(board, size, dead, 7.5) : null;
    board.forEach(function (side, index) {
      var button = document.createElement('button'); button.type = 'button'; button.tabIndex = -1; button.dataset.index = index;
      var marked = dead.indexOf(index) >= 0;
      button.className = 'go-cell' + (side ? ' go-occupied' : '') + (index === cursor ? ' go-cursor' : '');
      button.setAttribute('aria-label', point(index) + '，' + (side ? sideName(side) : '空点') + (marked ? '，标记死子' : '') + (index === last ? '，最后落子' : ''));
      if (side) button.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="' + (side === 1 ? '#293d34' : '#fffdf3') + '" stroke="' + (side === 1 ? '#1e3028' : '#b8ad94') + '" opacity="' + (marked ? '.35' : '1') + '"/>' + (marked ? '<path d="m15 15 18 18m0-18L15 33" stroke="#a33e32" stroke-width="3"/>' : index === last ? '<circle cx="24" cy="24" r="3" fill="#d8954e"/>' : '') + '</svg>';
      else if (score && score.owner[index]) button.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="18" y="18" width="12" height="12" fill="' + (score.owner[index] === 1 ? '#293d34' : '#fffdf3') + '" stroke="#9a8b6c" stroke-width="1"/></svg>';
      grid.appendChild(button);
    });
    document.getElementById('score-label').textContent = score ? '黑方面积' : '黑方提子';
    document.getElementById('best-label').textContent = score ? '白方含贴目' : '白方提子';
    document.getElementById('score').textContent = score ? score.black : captures[0]; document.getElementById('best').textContent = score ? score.white : captures[1];
    document.getElementById('rule-label').textContent = size + ' 路 · ' + (mode === 'ai' ? '人机 · ' + ({easy:'轻松',normal:'标准',hard:'挑战'}[level] || '标准') : '双人') + ' · 白贴7.5目';
    document.getElementById('detail').textContent = phase === 'counting' ? '数子中 · 点击棋块标记死子，再确认结果' : phase === 'finished' ? '本局已结束' : '第 ' + (history.length + 1) + ' 手 · ' + sideName(turn) + '行棋 · 连续停着 ' + passes + '/2';
    document.getElementById('undo').disabled = !history.length || ended;
    document.getElementById('pass').disabled = ended || phase !== 'play' || (mode === 'ai' && turn === 2);
    document.getElementById('pass').hidden = phase !== 'play';
    document.getElementById('resign').hidden = phase !== 'play'; document.getElementById('resign').disabled = ended;
    document.getElementById('resign').textContent = resignArmed ? '确认认输' : '认输';
    document.getElementById('confirm-score').hidden = phase !== 'counting'; document.getElementById('resume-play').hidden = phase !== 'counting';
    grid.setAttribute('aria-label', '围棋' + size + '路棋盘，' + (phase === 'counting' ? '点击棋块标记死子' : sideName(turn) + '行棋') + '。方向键选择，回车落子。');
    document.querySelectorAll('[data-mode]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.mode === mode)); });
  }
  function cancelAI() { if (aiTimer !== null) clearTimeout(aiTimer); aiTimer = null; revision += 1; }
  function scheduleAI() {
    if (blocked() || phase !== 'play' || mode !== 'ai' || turn !== 2 || aiTimer !== null) return;
    var token = revision;
    aiTimer = setTimeout(function () {
      aiTimer = null; if (token !== revision || blocked() || phase !== 'play' || mode !== 'ai' || turn !== 2) return;
      var index = chooseAI(); if (index < 0) passTurn(true); else place(index, true);
    }, 350);
  }
  function canAct(computer) { return !blocked() && phase === 'play' && (mode !== 'ai' || (turn === 2) === !!computer); }
  function place(index, computer) {
    if (!canAct(computer)) return false;
    var trial = attempt(board, index, turn, size, positions);
    if (trial.error) { status(trial.error); return false; }
    cancelAI(); history.push(snapshot()); board = trial.board; positions.push(trial.signature);
    captures[turn - 1] += trial.taken.length; last = index; cursor = index; passes = 0; resignArmed = false;
    turn = 3 - turn; sound(600); draw();
    status((trial.taken.length ? '提走 ' + trial.taken.length + ' 枚棋子。' : '') + sideName(turn) + (mode === 'ai' && turn === 2 ? '（电脑）思考中。' : '行棋。'));
    scheduleAI(); return true;
  }
  function passTurn(computer) {
    if (!canAct(computer)) return false;
    cancelAI(); history.push(snapshot()); passes += 1; turn = 3 - turn; resignArmed = false;
    if (passes >= 2) { phase = 'counting'; dead = []; status('双方连续停着。请确认死活：点击棋块标记死子，若有争议可继续对局。'); }
    else status(sideName(3-turn) + '停一手，轮到' + sideName(turn) + '。');
    draw(); scheduleAI(); return true;
  }
  function toggleDead(index) {
    if (blocked() || phase !== 'counting' || !board[index]) return;
    var chain = group(board, index, size).stones, remove = dead.indexOf(index) >= 0;
    if (remove) dead = dead.filter(function (i) { return chain.indexOf(i) < 0; });
    else dead = dead.concat(chain);
    draw(); status('已更新死子标记。请双方确认后结算，有争议可继续对局。');
  }
  function endGame(winner, message) {
    cancelAI(); phase = 'finished'; resignArmed = false;
    if (winner) save(key + ':wins:' + mode + ':' + size + ':' + winner, String(number('wins:' + mode + ':' + size + ':' + winner, 0) + 1));
    finish(message); document.getElementById('status').dataset.tone = 'normal';
    showCover(winner ? sideName(winner) + '获胜' : '和棋', message, '再玩一局'); draw();
  }
  function confirmScore() {
    if (blocked() || phase !== 'counting') return;
    var result = areaScore(board, size, dead, 7.5), diff = result.black - result.white;
    scored = true;
    endGame(diff === 0 ? 0 : diff > 0 ? 1 : 2, '黑 ' + result.black + '，白 ' + result.white + '（含贴7.5目）。' + (diff ? sideName(diff > 0 ? 1 : 2) + '胜' + Math.abs(diff) + '目。' : '双方和棋。'));
  }
  function continuePlay() {
    if (blocked() || phase !== 'counting') return;
    phase = 'play'; dead = []; passes = 0; resignArmed = false; draw(); status('继续对局，原盘面与行棋方保留，请解决死活争议后再停着。'); scheduleAI();
  }
  function resign() {
    if (blocked() || phase !== 'play') return;
    if (!resignArmed) { resignArmed = true; draw(); status('再次点击“确认认输”将结束本局，其他落子或停着会取消确认。'); return; }
    var side = mode === 'ai' ? 1 : turn;
    endGame(3 - side, sideName(side) + '认输，' + sideName(3 - side) + '获胜。');
  }
  function undo() {
    if (blocked() || !history.length) return;
    cancelAI(); var previous;
    do { previous = history.pop(); } while (mode === 'ai' && previous.turn !== 1 && history.length);
    board = previous.board; turn = previous.turn; captures = previous.captures; passes = previous.passes; last = previous.last;
    positions = positions.slice(0, previous.length); phase = 'play'; dead = []; resignArmed = false;
    cursor = last >= 0 ? last : Math.floor(board.length / 2); draw(); status('已悔棋，提子、停着与重复局面记录一并恢复。'); scheduleAI();
  }
  function restart() {
    cancelAI(); resetState(); size = ['9','13','19'].indexOf(settings.option) >= 0 ? Number(settings.option) : 9; level = settings.level;
    board = Array(size * size).fill(0); turn = 1; history = []; positions = [hash(board)]; captures = [0,0];
    passes = 0; phase = 'play'; dead = []; last = -1; cursor = Math.floor(board.length / 2); resignArmed = false; scored = false;
    draw(); status('黑棋先行。可停一手；连续两次停着后标记死子并数子。');
  }
  function activate(index) { if (phase === 'counting') toggleDead(index); else place(index, false); }
  grid.addEventListener('click', function (event) { var cell = event.target.closest('[data-index]'); if (cell) { activate(Number(cell.dataset.index)); grid.focus(); } });
  grid.addEventListener('keydown', function (event) {
    if (blocked() || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    var offsets = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-size,ArrowDown:size};
    if (offsets[event.key]) {
      event.preventDefault(); var next = cursor + offsets[event.key];
      if (next >= 0 && next < board.length && (Math.abs(offsets[event.key]) !== 1 || Math.floor(next / size) === Math.floor(cursor / size))) cursor = next;
      draw(); grid.focus();
    } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) activate(cursor); }
  });
  document.querySelectorAll('[data-mode]').forEach(function (button) { button.addEventListener('click', function () {
    if (mode === button.dataset.mode) return; mode = button.dataset.mode === 'local' ? 'local' : 'ai'; save(key + ':mode', mode);
    restart(); ready = true; showCover(mode === 'ai' ? '人机对战' : '双人对弈', '黑棋先行，切换模式已开启新一局。', '开始游戏'); syncStart();
  }); });
  onPause = function () { resignArmed = false; cancelAI(); draw(); }; onResume = scheduleAI;
  onOption = function () { settings.level = levelSelect.value; save(key + ':settings', JSON.stringify(settings)); status('棋盘和电脑难度已保存，下一局生效。'); };
  document.getElementById('undo').addEventListener('click', undo);
  document.getElementById('pass').addEventListener('click', function () { passTurn(false); });
  document.getElementById('resign').addEventListener('click', resign);
  document.getElementById('confirm-score').addEventListener('click', confirmScore);
  document.getElementById('resume-play').addEventListener('click', continuePlay);
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


