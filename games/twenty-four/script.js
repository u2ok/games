/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:twenty-four';
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
  function read(name) { try { var value = localStorage.getItem(name); if (value === null && name.indexOf('mini-games:twenty-four:') === 0) value = localStorage.getItem(name.replace('mini-games:twenty-four:', 'mini-games:twenty:')); return value; } catch (error) { document.getElementById('storage').textContent = '存储不可用，数据仅在当前页面保留。'; return memoryStore[name] || null; } }
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


  // 采用约分后的有理数做精确计算，不用浮点近似判定24，也不执行用户表达式。
  function fraction(n, d) {
    if (!d) return null;
    if (d < 0) { n = -n; d = -d; }
    var a = Math.abs(n), b = d;
    while (b) { var t = a % b; a = b; b = t; }
    return { n: n / a, d: d / a };
  }
  function combine(a, b, op) {
    if (op === '+') return fraction(a.n * b.d + b.n * a.d, a.d * b.d);
    if (op === '-') return fraction(a.n * b.d - b.n * a.d, a.d * b.d);
    if (op === '*') return fraction(a.n * b.n, a.d * b.d);
    if (op === '/') return b.n ? fraction(a.n * b.d, a.d * b.n) : null;
    return null;
  }
  function label(v) { return v.d === 1 ? String(v.n) : v.n + '/' + v.d; }
  var signs = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  function card(n) { return { n: n, d: 1, expression: String(n) }; }
  function merged(a, b, op) {
    var value = combine(a, b, op);
    if (value) value.expression = '(' + a.expression + ' ' + signs[op] + ' ' + b.expression + ')';
    return value;
  }
  // 枚举所有二元合并顺序，覆盖括号组合及有方向的减法/除法。
  function solve(items) {
    if (items.length === 1) return items[0].n === 24 * items[0].d ? items[0].expression : null;
    for (var i = 0; i < items.length; i++) for (var j = 0; j < items.length; j++) {
      if (i === j) continue;
      var rest = items.filter(function (_, k) { return k !== i && k !== j; });
      for (var k = 0; k < 4; k++) {
        var next = merged(items[i], items[j], ['+', '-', '*', '/'][k]);
        if (!next) continue;
        var answer = solve(rest.concat([next]));
        if (answer) return answer;
      }
    }
    return null;
  }
  function generate(max) {
    // 生成预算有上限；回退题同样有效，避免随机源异常造成无限循环。
    for (var attempt = 0; attempt < 100; attempt++) {
      var numbers = Array.from({ length: 4 }, function () { return 1 + Math.floor(Math.random() * max); });
      if (solve(numbers.map(card))) return numbers;
    }
    return [2, 3, 4, 5];
  }
  var cards = [], original = [], selected = [], history = [];
  var best = 0, elapsed = 0, started = 0, range = 9, hinted = false;
  var cardsElement = document.getElementById('cards');
  document.getElementById('score-label').textContent = '用时 / 秒';
  document.getElementById('best-label').textContent = '最快 / 秒';
  function seconds() { return Math.floor((elapsed + (started ? Date.now() - started : 0)) / 1000); }
  function stopClock() { if (started) elapsed += Date.now() - started; started = 0; }
  function detail() {
    var text = String(ended ? Math.max(1, seconds()) : seconds());
    // 用时未跨秒时，终局仍可能产生新纪录；两个字段分别按值更新。
    if (document.getElementById('score').textContent !== text) document.getElementById('score').textContent = text;
    var bestText = best ? String(best) : '—';
    if (document.getElementById('best').textContent !== bestText) document.getElementById('best').textContent = bestText;
    var progress = '已合并 ' + (4 - cards.length) + '/3 次' + (hinted ? ' · 已查看提示' : ' · 独立解题');
    if (document.getElementById('detail').textContent !== progress) document.getElementById('detail').textContent = progress;
  }
  function draw() {
    cardsElement.innerHTML = '';
    cards.forEach(function (item, index) {
      var button = document.createElement('button');
      button.className = 'twenty-four-card'; button.dataset.index = index;
      button.setAttribute('aria-pressed', String(selected.indexOf(index) !== -1));
      button.setAttribute('aria-label', '第' + (index + 1) + '张，' + label(item) + '，算式' + item.expression);
      var value = document.createElement('strong'); value.textContent = label(item);
      var expression = document.createElement('span'); expression.textContent = item.expression;
      button.appendChild(value); button.appendChild(expression); cardsElement.appendChild(button);
    });
    document.getElementById('selection').textContent = selected.length ? '已选：' + selected.map(function (i) { return label(cards[i]); }).join('，然后 ') : '依次选两张数字牌，再选择运算';
    document.getElementById('operators').querySelectorAll('[data-op]').forEach(function (button) { button.disabled = selected.length !== 2 || blocked(); });
    document.getElementById('undo').disabled = !history.length || ended;
    document.getElementById('rule-label').textContent = '四个数字 · 1–' + range + ' · 目标24';
    detail();
  }
  function operate(op) {
    if (blocked() || selected.length !== 2) return;
    var a = cards[selected[0]], b = cards[selected[1]], value = merged(a, b, op);
    if (!value) { status('不能除以零，请选择其他运算。'); return; }
    history.push(cards.slice());
    cards = cards.filter(function (_, i) { return selected.indexOf(i) === -1; }).concat([value]);
    selected = [];
    document.getElementById('calculation').textContent = value.expression + ' = ' + label(value);
    sound(600);
    if (cards.length === 1 && value.n === 24 * value.d) {
      stopClock(); var time = Math.max(1, seconds());
      if (!hinted && (!best || time < best)) { best = time; save(key + ':best:24:' + range, String(best)); }
      finish('成功算出24！用时' + time + '秒。' + (hinted ? '本局使用提示，不计纪录。' : ''));
      showCover('算对了！', value.expression + ' = 24', '再玩一局');
    } else status(cards.length === 1 ? '结果不是24，撤销后试试其他组合。' : '继续选择两张牌进行运算。');
    draw();
  }
  cardsElement.addEventListener('click', function (event) {
    var button = event.target.closest('[data-index]'); if (!button || blocked()) return;
    var index = Number(button.dataset.index), position = selected.indexOf(index);
    if (position >= 0) selected.splice(position, 1);
    else if (selected.length < 2) selected.push(index);
    else { status('已选两张，先选择运算或再次点击取消。'); return; }
    if (!started) started = Date.now(); draw();
  });
  document.getElementById('operators').addEventListener('click', function (event) {
    var button = event.target.closest('[data-op]'); if (button) operate(button.dataset.op);
  });
  document.getElementById('undo').addEventListener('click', function () {
    if (blocked() || !history.length) return;
    cards = history.pop(); selected = []; document.getElementById('calculation').textContent = '';
    status('已撤销上一步。'); draw();
  });
  document.getElementById('hint').addEventListener('click', function () {
    if (blocked()) return; hinted = true;
    status('原题参考解法：' + solve(original.map(card)) + ' = 24。本局不计最快纪录。'); draw();
  });
  function restart() {
    stopClock(); resetState(); range = settings.option === '13' ? 13 : 9;
    original = generate(range); cards = original.map(card); selected = []; history = [];
    elapsed = 0; started = 0; hinted = false; best = number('best:24:' + range, 0);
    document.getElementById('calculation').textContent = '';
    updateScore(0, best); draw(); status('每张数字牌用一次，试着算出24。');
  }
  onPause = function () { stopClock(); draw(); };
  onResume = function () { if (history.length || selected.length || elapsed) started = Date.now(); status('继续计算，减法与除法按选择顺序。'); draw(); };
  document.getElementById('restart').addEventListener('click', restart);
  setInterval(function () { if (!blocked()) detail(); }, 250);
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
