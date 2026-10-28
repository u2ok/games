/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:sudoku';
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
  /* 9×9 数独：题目与用户填写分离，固定数字永远不能被覆盖。 */
  var values = [];
  var givens = [];
  var notes = [];
  var selected = -1;
  var noteMode = false;
  var history = [];
  var difficulty = settings.option;
  var best = number('best:' + difficulty, 0);
  var started = 0;
  var elapsed = 0;
  var grid = document.getElementById('grid');
  var names = { easy: '入门', normal: '标准', hard: '挑战' };
  var targets = { easy: 42, normal: 34, hard: 28 };

  function shuffled(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = copy[i]; copy[i] = copy[j]; copy[j] = temp;
    }
    return copy;
  }
  function peers(a, b) {
    return Math.floor(a / 9) === Math.floor(b / 9) || a % 9 === b % 9 ||
      (Math.floor(a / 27) === Math.floor(b / 27) && Math.floor(a % 9 / 3) === Math.floor(b % 9 / 3));
  }
  function candidates(board, index) {
    var used = 0;
    for (var i = 0; i < 81; i += 1) if (i !== index && board[i] && peers(i, index)) used |= 1 << board[i];
    var result = [];
    for (var value = 1; value <= 9; value += 1) if (!(used & (1 << value))) result.push(value);
    return result;
  }
  // 最少候选优先回溯，最多计到两解；生成过程只保留恰好一解的删数结果。
  function countSolutions(input) {
    var board = input.slice();
    for (var a = 0; a < 81; a += 1) {
      if (!Number.isInteger(board[a]) || board[a] < 0 || board[a] > 9) return 0;
      if (board[a]) for (var b = a + 1; b < 81; b += 1) if (board[a] === board[b] && peers(a, b)) return 0;
    }
    var total = 0;
    function search() {
      if (total >= 2) return;
      var index = -1; var options = null;
      for (var i = 0; i < 81; i += 1) {
        if (board[i]) continue;
        var choices = candidates(board, i);
        if (!choices.length) return;
        if (!options || choices.length < options.length) { index = i; options = choices; }
        if (options.length === 1) break;
      }
      if (index === -1) { total += 1; return; }
      for (var n = 0; n < options.length && total < 2; n += 1) { board[index] = options[n]; search(); }
      board[index] = 0;
    }
    search();
    return total;
  }
  function generate(level) {
    var bands = shuffled([0, 1, 2]);
    var stacks = shuffled([0, 1, 2]);
    var rows = []; var cols = [];
    bands.forEach(function (band) { shuffled([0, 1, 2]).forEach(function (row) { rows.push(band * 3 + row); }); });
    stacks.forEach(function (stack) { shuffled([0, 1, 2]).forEach(function (col) { cols.push(stack * 3 + col); }); });
    var digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    var puzzle = [];
    rows.forEach(function (row) { cols.forEach(function (col) { puzzle.push(digits[(row * 3 + Math.floor(row / 3) + col) % 9]); }); });
    var remaining = 81;
    shuffled(Array.from({ length: 81 }, function (_, i) { return i; })).forEach(function (index) {
      if (remaining <= targets[level]) return;
      var value = puzzle[index]; puzzle[index] = 0;
      if (countSolutions(puzzle) === 1) remaining -= 1; else puzzle[index] = value;
    });
    return puzzle;
  }
  function conflicts(index) {
    return values[index] && values.some(function (value, other) { return other !== index && value === values[index] && peers(index, other); });
  }
  function solved() { return values.every(Boolean) && !values.some(function (_, index) { return conflicts(index); }); }
  function seconds() { return Math.floor((elapsed + (started ? Date.now() - started : 0)) / 1000); }
  function stopClock() { if (started) elapsed += Date.now() - started; started = 0; }
  function updateDetail() {
    updateScore(seconds(), best);
    document.getElementById('detail').textContent = '已填 ' + values.filter(Boolean).length + '/81 · ' + (noteMode ? '笔记模式' : '数字模式');
  }
  function draw() {
    grid.innerHTML = '';
    // 固定题目数字和用户填写数字都参与匹配；空格和候选笔记不触发同值高亮。
    var selectedValue = selected >= 0 ? values[selected] : 0;
    values.forEach(function (value, index) {
      var cell = document.createElement('button');
      cell.className = 'sudoku-cell' + (givens[index] ? ' given' : '') +
        (selected === index ? ' selected' : selected >= 0 && peers(index, selected) ? ' related' : '') +
        (selectedValue && value === selectedValue ? ' same-value' : '') +
        (conflicts(index) && document.getElementById('conflict-check').checked ? ' conflict' : '');
      cell.dataset.index = index;
      cell.dataset.row = Math.floor(index / 9);
      cell.dataset.col = index % 9;
      cell.setAttribute('aria-pressed', String(index === selected));
      var noteText = [];
      if (value) cell.textContent = value;
      else if (notes[index]) {
        var list = document.createElement('span'); list.className = 'cell-notes';
        for (var n = 1; n <= 9; n += 1) {
          var mark = document.createElement('span');
          mark.textContent = notes[index] & (1 << n) ? n : '';
          if (mark.textContent) noteText.push(n);
          list.appendChild(mark);
        }
        cell.appendChild(list);
      }
      cell.setAttribute('aria-label', '第' + (Math.floor(index / 9) + 1) + '行第' + (index % 9 + 1) + '列，' + (value || '空格') + (givens[index] ? '，题目数字' : '') + (noteText.length ? '，笔记' + noteText.join('、') : '') + (conflicts(index) ? '，数字冲突' : ''));
      grid.appendChild(cell);
    });
    document.getElementById('note-mode').setAttribute('aria-pressed', String(noteMode));
    document.getElementById('undo').disabled = !history.length;
    // 已放数字（含题目）参与计数，候选笔记不计；错误超填时最低显示零。
    var counts = Array(10).fill(0);
    values.forEach(function (value) { if (value) counts[value] += 1; });
    document.getElementById('number-pad').querySelectorAll('[data-number]').forEach(function (button) {
      var digit = Number(button.dataset.number);
      var remaining = Math.max(0, 9 - counts[digit]);
      button.dataset.remaining = remaining;
      button.setAttribute('aria-label', '输入数字' + digit + '，还剩' + remaining + '个未填');
    });
    document.getElementById('rule-label').textContent = '9 × 9 · ' + names[difficulty] + ' · ' + givens.filter(Boolean).length + ' 个提示数';
    updateDetail();
  }
  function remember() {
    history.push({ values: values.slice(), notes: notes.slice(), selected: selected });
    if (history.length > 200) history.shift();
  }
  function enter(value) {
    if (blocked() || selected < 0) return;
    if (givens[selected]) { status('题目数字不能修改，请选择空白格。'); return; }
    if (!noteMode && values[selected] === value && (!value ? !notes[selected] : true)) return;
    if (!started) started = Date.now();
    remember();
    if (noteMode && value) {
      values[selected] = 0;
      notes[selected] ^= 1 << value;
    } else {
      values[selected] = value; notes[selected] = 0;
      // 填入确定数字后移除同行、列和宫中同值笔记；撤销会完整恢复。
      if (value) notes.forEach(function (_, index) { if (peers(selected, index)) notes[index] &= ~(1 << value); });
    }
    sound(550);
    if (solved()) {
      stopClock();
      var time = Math.max(1, seconds());
      if (!best || time < best) { best = time; save(key + ':best:' + difficulty, String(best)); }
      finish('数独完成！用时 ' + time + ' 秒。');
      document.getElementById('status').dataset.tone = 'normal';
      showCover('数独完成！', '用时 ' + time + ' 秒，每一行都恰到好处。', '再玩一局');
    } else status(conflicts(selected) ? '存在重复数字，请检查所在行、列与九宫格。' : noteMode ? '笔记已更新，切回数字模式填写答案。' : '继续填写，行、列与每个宫内数字不能重复。');
    draw();
  }
  function undo() {
    if (blocked() || !history.length) return;
    var previous = history.pop(); values = previous.values; notes = previous.notes; selected = previous.selected;
    draw(); status('已撤销上一步；用时不会回退。');
  }
  function restart() {
    stopClock(); resetState(); difficulty = settings.option;
    givens = generate(difficulty); values = givens.slice(); notes = Array(81).fill(0);
    history = []; selected = -1; noteMode = false; elapsed = 0; started = 0;
    best = number('best:' + difficulty, 0);
    draw(); status('选择空格后输入数字，首次编辑开始计时。');
  }
  grid.addEventListener('click', function (event) {
    var cell = event.target.closest('[data-index]');
    if (!cell || blocked()) return;
    // 重复点击当前格可取消选中，同时清除同值和同行/列/宫高亮。
    var index = Number(cell.dataset.index);
    selected = selected === index ? -1 : index;
    draw();
  });
  document.getElementById('number-pad').addEventListener('click', function (event) {
    var button = event.target.closest('[data-number]');
    if (button) enter(Number(button.dataset.number));
  });
  document.getElementById('erase').addEventListener('click', function () { enter(0); });
  document.getElementById('undo').addEventListener('click', undo);
  document.getElementById('note-mode').addEventListener('click', function () { if (blocked()) return; noteMode = !noteMode; draw(); });
  document.getElementById('conflict-check').addEventListener('change', function () { save(key + ':conflicts', String(this.checked)); draw(); });
  document.getElementById('conflict-check').checked = read(key + ':conflicts') !== 'false';
  document.addEventListener('keydown', function (event) {
    if (blocked() || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.altKey) return;
    if (event.ctrlKey || event.metaKey) { if (event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); } return; }
    if (/^[1-9]$/.test(event.key)) { event.preventDefault(); enter(Number(event.key)); }
    else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') { event.preventDefault(); enter(0); }
    else if (event.key.toLowerCase() === 'n') { event.preventDefault(); noteMode = !noteMode; draw(); }
    else {
      var offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 };
      if (!offsets[event.key]) return;
      event.preventDefault();
      if (selected < 0) selected = values.indexOf(0);
      else {
        var next = selected + offsets[event.key];
        if (next >= 0 && next < 81 && (Math.abs(offsets[event.key]) !== 1 || Math.floor(next / 9) === Math.floor(selected / 9))) selected = next;
      }
      draw();
    }
  });
  onPause = stopClock;
  onResume = function () { if (history.length || elapsed) started = Date.now(); status('继续填写数独。'); };
  onOption = function () { status('难度已保存，重新开始后生效。'); };
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


