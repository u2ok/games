/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
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
  /* Fisher–Yates 洗牌；不匹配的两张牌由剩余等待时间驱动，暂停与重开不遗留回调。 */
  var symbols = ['❀', '☀', '☂', '♫', '★', '☘', '☾', '◆']; var cards = []; var selected = []; var matched = []; var steps = 0; var pairs = 0; var best = number('best', 0); var started = 0; var elapsed = 0; var remaining = 0; var last = Date.now(); var grid = document.getElementById('grid');
  document.getElementById('score-label').textContent = '步数'; document.getElementById('best-label').textContent = '最少步数';
  function time() { return Math.floor((elapsed + (started ? Date.now() - started : 0)) / 1000); }
  function stopClock() { if (started) elapsed += Date.now() - started; started = 0; }
  function detail() { document.getElementById('detail').textContent = '配对 ' + pairs + '/8 · 用时 ' + time() + ' 秒'; }

  // 所有图案在32单位画布内居中，实际轮廓经光学归一化。
  var memoryPaths = ['<path d="M16 13C3-3 0 15 12 16-3 27 15 33 16 20c9 15 20-1 4-4C35 7 17-3 16 13Z"/><circle cx="16" cy="16" r="3" fill="white"/>','<circle cx="16" cy="16" r="7"/><path d="M16 2v3m0 22v3M2 16h3m22 0h3M6 6l2 2m16 16 2 2M6 26l2-2M24 8l2-2" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>','<path d="M2 17a14 14 0 0 1 28 0q-4-4-7 0-4-4-7 0-4-4-7 0-4-4-7 0Z"/><path d="M16 4v21q0 7-5 3" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>','<path d="M12 23V8l15-4v16M12 12l15-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><ellipse cx="8" cy="25" rx="5" ry="4"/><ellipse cx="23" cy="22" rx="5" ry="4"/>','<path d="m16 2 4.2 9 9.8 1.3-7.2 7 1.8 10L16 24l-8.6 5.3 1.8-10-7.2-7 9.8-1.3Z"/>','<path d="M16 15C-2-2 0 18 13 16-2 31 18 34 16 19c17 16 18-4 3-3C35 0 15-3 16 15Z"/>','<path d="M23 3C3 0-3 25 17 29q8 0 12-7C12 29 6 10 23 3Z"/>','<path d="m16 3 12 13-12 13L4 16Z"/><path d="m10 15 6-7" fill="none" stroke="white" stroke-width="2" opacity=".6"/>','<path d="M16 1q2 13 15 15-13 2-15 15Q14 18 1 16 14 14 16 1Z"/>'];
  function draw() { grid.innerHTML = ''; cards.forEach(function (symbol, index) { var shown = selected.indexOf(index) !== -1 || matched.indexOf(index) !== -1; var button = document.createElement('button'); button.className = 'memory-card' + (shown ? ' revealed' : '') + (matched.indexOf(index) !== -1 ? ' matched' : ''); button.innerHTML = '<svg class="memory-symbol" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' + memoryPaths[shown ? symbols.indexOf(symbol) : 8] + '</svg>'; button.dataset.index = index; button.setAttribute('aria-label', '第' + (index + 1) + '张，' + (shown ? symbol : '未翻开')); button.setAttribute('aria-pressed', String(shown)); grid.appendChild(button); }); updateScore(steps, best); detail(); }
  grid.addEventListener('click', function (event) { var button = event.target.closest('[data-index]'); if (!button || blocked() || remaining > 0) return; var index = Number(button.dataset.index); if (selected.indexOf(index) !== -1 || matched.indexOf(index) !== -1) return; if (!started) started = Date.now(); selected.push(index); sound(550); if (selected.length === 2) { steps += 1; if (cards[selected[0]] === cards[selected[1]]) { matched = matched.concat(selected); selected = []; pairs += 1; if (pairs === 8) { stopClock(); if (!best || steps < best) { best = steps; save(key + ':best', String(best)); } finish('全部配对成功！' + steps + ' 步，用时 ' + time() + ' 秒。'); } } else { remaining = Number(settings.option); last = Date.now(); } } draw(); });
  setInterval(function () { var now = Date.now(); var delta = now - last; last = now; if (blocked()) return; if (remaining > 0) { remaining -= delta; if (remaining <= 0) { remaining = 0; selected = []; draw(); } } detail(); }, 50);
  function restart() { resetState(); cards = symbols.concat(symbols); for (var i = cards.length - 1; i > 0; i -= 1) { var j = Math.floor(Math.random() * (i + 1)); var temp = cards[i]; cards[i] = cards[j]; cards[j] = temp; } selected = []; matched = []; steps = 0; pairs = 0; elapsed = 0; started = 0; remaining = 0; last = Date.now(); draw(); status('翻开两张卡片，寻找相同的图案。'); }
  onPause = function () { stopClock();  }; onResume = function () { if (steps || selected.length || pairs) started = Date.now(); last = Date.now(); grid.style.visibility = ''; status('继续寻找相同图案。'); };
  document.getElementById('restart').addEventListener('click', function () { grid.style.visibility = ''; restart(); }); restart();

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
