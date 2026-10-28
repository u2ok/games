/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:sokoban';
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
  /* 关卡符号：#墙、空格地面、.目标、$箱子、@角色、*目标上的箱子、+目标上的角色。 */
  var levels = [
    { name: "第一步", map: ["#######","#     #","# .   #","# $   #","# @   #","#     #","#######"] },
    { name: "左右开弓", map: ["#######","# . . #","# $ $ #","#  @  #","#     #","#######"] },
    { name: "十字调度", map: ["#######","#  .  #","#  $  #","# .$. #","#  $  #","#  @  #","#######"] },
    { name: "绕过石墙", map: ["########","# .  . #","# $  $ #","#  ##  #","#  @   #","#      #","########"] },
    { name: "转角运输", map: ["########","#  . . #","#  #   #","# $$   #","#   @  #","#      #","########"] },
    { name: "三箱归位", map: ["########","# . . .#","#      #","# $ $ $#","#   @  #","#      #","########"] },
    { name: "回身取位", map: ["########","#      #","# $  $ #","#  # . #","#      #","#   .  #","#@     #","########"] },
    { name: "错位双箱", map: ["########","#      #","# .#   #","# @    #","# . #  #","#   $$ #","#      #","########"] },
    { name: "中庭绕行", map: ["########","#      #","# #..# #","#    @ #","#  $   #","#  # $ #","#      #","########"] },
    { name: "双柱之间", map: ["########","#   @  #","#      #","# ##.  #","# $.   #","# $ #  #","#      #","########"] },
    { name: "转角接力", map: ["########","#      #","# $ $  #","#  # . #","#   .. #","#   $  #","#@     #","########"] },
    { name: "交叉运输", map: ["########","#      #","#  # $ #","# $    #","#  .#. #","# $ .  #","#  @   #","########"] },
    { name: "三点汇聚", map: ["########","#      #","# #. # #","# .. $ #","#  $ $ #","#  # @ #","#      #","########"] },
    { name: "回廊调度", map: ["########","#      #","#  $ . #","# ##+  #","#   .$ #","# $ #  #","#      #","########"] },
    { name: "先退后进", map: ["########","#      #","#  $ $ #","#  #. @#","#      #","# ..$  #","#      #","########"] },
    { name: "两翼穿行", map: ["########","#      #","# $#@. #","# .    #","# $ #  #","# $.   #","#      #","########"] },
    { name: "绕柱归仓", map: ["########","#   @  #","# #..# #","#    $ #","#      #","# .#$$ #","#      #","########"] },
    { name: "中路让行", map: ["########","#      #","# $. . #","# ## . #","#      #","# $ #$ #","#@     #","########"] },
    { name: "三箱换位", map: ["########","#    @ #","#  $.$ #","# $#.  #","#   .  #","#      #","#      #","########"] },
    { name: "仓库终章", map: ["########","#      #","# $# $ #","#   .  #","#   #. #","#  .@$ #","#      #","########"] }
  ];
  var unlocked = Math.max(0, Math.min(levels.length - 1, Math.floor(number('unlocked', 0))));
  // 扩充关卡后根据已保存的通关纪录补齐解锁，旧版全通关玩家可直接进入第 7 关。
  for (var completedLevel = 0; completedLevel < levels.length - 1; completedLevel += 1) {
    if (number('best:' + completedLevel, 0) > 0) unlocked = Math.max(unlocked, completedLevel + 1);
  }
  var levelIndex = Math.max(0, Math.min(unlocked, Math.floor(number('current', 0))));
  var width = 0;
  var height = 0;
  var walls = [];
  var goals = [];
  var boxes = [];
  var player = 0;
  var steps = 0;
  var pushes = 0;
  var best = 0;
  var history = [];
  var grid = document.getElementById('grid');
  var directions = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function nextCell(position, dx, dy) {
    var x = position % width + dx;
    var y = Math.floor(position / width) + dy;
    return x < 0 || y < 0 || x >= width || y >= height ? -1 : y * width + x;
  }
  function wall(position) { return position < 0 || walls.indexOf(position) !== -1; }
  function won() { return boxes.every(function (position) { return goals.indexOf(position) !== -1; }); }
  function renderLevels() {
    document.getElementById('level-list').innerHTML = levels.map(function (level, index) {
      return '<button data-level="' + index + '" aria-pressed="' + (index === levelIndex) + '" aria-label="第' + (index + 1) + '关 ' + level.name + '"' + (index > unlocked ? ' disabled' : '') + '>' + (index + 1) + '</button>';
    }).join('');
    document.getElementById('level-hint').textContent = '已解锁 ' + (unlocked + 1) + '/' + levels.length + ' 关；切换关卡将重置当前局。';
  }
  function draw() {
    grid.innerHTML = '';
    // 非正方形地图补齐到正方形舞台，所有地块保持等宽等高。
    var side = Math.max(width, height);
    grid.style.setProperty('--map-size', side);
    for (var row = 0; row < side; row += 1) for (var col = 0; col < side; col += 1) {
      var position = row * width + col;
      var outside = row >= height || col >= width;
      var isWall = outside || wall(position);
      var goal = !outside && goals.indexOf(position) !== -1;
      var box = !outside && boxes.indexOf(position) !== -1;
      var person = !outside && player === position;
      var cell = document.createElement('div');
      cell.className = 'sokoban-cell' + (isWall ? ' wall' : ' floor') + (goal ? ' goal' : '') + (box ? ' box' : '') + (person ? ' player' : '');
      cell.setAttribute('role', 'img');
      cell.setAttribute('aria-label', isWall ? '墙' : (goal ? '目标点，' : '') + (box ? '箱子' : person ? '角色' : '地面'));
      if (person) cell.innerHTML = '<span class="person" aria-hidden="true"></span>';
      else if (box) cell.innerHTML = '<span class="crate" aria-hidden="true">' + (goal ? '✓' : '') + '</span>';
      grid.appendChild(cell);
    }
    updateScore(steps, best);
    var placed = boxes.filter(function (position) { return goals.indexOf(position) !== -1; }).length;
    document.getElementById('rule-label').textContent = '第 ' + (levelIndex + 1) + ' 关 · ' + levels[levelIndex].name;
    document.getElementById('detail').textContent = '归位 ' + placed + '/' + boxes.length + ' · 推箱 ' + pushes + ' 次';
    document.getElementById('undo').disabled = history.length === 0 || ready || paused;
  }
  function move(direction) {
    if (blocked() || !directions[direction]) return false;
    var delta = directions[direction];
    var next = nextCell(player, delta[0], delta[1]);
    if (wall(next)) return false;
    var boxIndex = boxes.indexOf(next);
    var beyond = nextCell(next, delta[0], delta[1]);
    if (boxIndex !== -1 && (wall(beyond) || boxes.indexOf(beyond) !== -1)) return false;
    // 每次有效移动保存完整快照，撤销时角色、箱子、步数和推箱次数一并恢复。
    history.push({ player: player, boxes: boxes.slice(), steps: steps, pushes: pushes });
    player = next;
    steps += 1;
    if (boxIndex !== -1) { boxes[boxIndex] = beyond; pushes += 1; }
    sound(boxIndex === -1 ? 400 : 600);
    status('箱子只能推，不能拉。卡住时可撤销或重玩。');
    if (won()) {
      if (!best || steps < best) { best = steps; save(key + ':best:' + levelIndex, String(best)); }
      unlocked = Math.min(levels.length - 1, Math.max(unlocked, levelIndex + 1));
      save(key + ':unlocked', String(unlocked));
      finish('全部箱子归位成功！共 ' + steps + ' 步，推箱 ' + pushes + ' 次。');
      showCover(levelIndex === levels.length - 1 ? '全部通关！' : '本关完成！', steps + ' 步 · 推箱 ' + pushes + ' 次', levelIndex < levels.length - 1 ? '下一关' : '重玩本关');
      renderLevels();
    } else if (boxIndex !== -1 && goals.indexOf(beyond) === -1) {
      var left = wall(nextCell(beyond, -1, 0));
      var right = wall(nextCell(beyond, 1, 0));
      var up = wall(nextCell(beyond, 0, -1));
      var down = wall(nextCell(beyond, 0, 1));
      if ((left || right) && (up || down)) status('箱子进入非目标墙角，可撤销一步恢复。');
    }
    draw();
    return true;
  }
  function undo() {
    if (ready || paused || dialog.open || !history.length) return;
    var previous = history.pop();
    player = previous.player; boxes = previous.boxes; steps = previous.steps; pushes = previous.pushes;
    ended = false;
    document.getElementById('pause').disabled = false;
    document.getElementById('status').dataset.tone = 'normal';
    hideCover(); syncStart(); draw(); status('已撤销一步。');
  }
  function restart() {
    resetState();
    width = levels[levelIndex].map[0].length; height = levels[levelIndex].map.length;
    walls = []; goals = []; boxes = []; history = []; steps = 0; pushes = 0;
    levels[levelIndex].map.forEach(function (row, y) {
      row.split('').forEach(function (symbol, x) {
        var position = y * width + x;
        if (symbol === '#') walls.push(position);
        if (symbol === '.' || symbol === '*' || symbol === '+') goals.push(position);
        if (symbol === '$' || symbol === '*') boxes.push(position);
        if (symbol === '@' || symbol === '+') player = position;
      });
    });
    best = number('best:' + levelIndex, 0);
    save(key + ':current', String(levelIndex));
    renderLevels(); draw();
    status('方向键 / WASD 或触屏方向按钮，将箱子推到圆点上。');
  }
  function prepareLevel(index) {
    levelIndex = index;
    restart(); ready = true; draw();
    showCover('第 ' + (index + 1) + ' 关 · ' + levels[index].name, '将所有箱子推到目标点。', '开始游戏');
    syncStart();
  }
  document.getElementById('level-list').addEventListener('click', function (event) {
    var button = event.target.closest('[data-level]');
    if (!button) return;
    var index = Number(button.dataset.level);
    if (index >= 0 && index <= unlocked && index < levels.length) prepareLevel(index);
  });
  document.getElementById('undo').addEventListener('click', undo);
  document.getElementById('restart').addEventListener('click', restart);
  document.querySelectorAll('[data-direction]').forEach(function (button) {
    button.addEventListener('click', function () { move(button.dataset.direction); });
  });
  var keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
  document.addEventListener('keydown', function (event) {
    if (dialog.open || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
    var direction = keys[event.key] || keys[event.key.toLowerCase()];
    if (direction) { event.preventDefault(); move(direction); }
    else if (event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
  });
  var origin;
  grid.addEventListener('pointerdown', function (event) { origin = { x: event.clientX, y: event.clientY }; grid.setPointerCapture(event.pointerId); });
  grid.addEventListener('pointerup', function (event) {
    if (!origin) return;
    var dx = event.clientX - origin.x; var dy = event.clientY - origin.y; origin = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
    move(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up');
  });
  grid.addEventListener('pointercancel', function () { origin = null; });
  onPause = draw;
  onResume = function () { draw(); status('继续推箱子，留意角色能否绕到箱子背后。'); };
  onOption = function () { grid.classList.toggle('show-targets', settings.option); };
  grid.classList.toggle('show-targets', settings.option);
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
    document.getElementById('start').textContent = paused ? '继续游戏' : ended ? (levelIndex < levels.length - 1 ? '下一关' : '重玩本关') : '开始游戏';
    document.getElementById('start').disabled = !ready && !paused && !ended;
  }
  function startGame() {
    if (dialog.open) return;
    if (id === '打砖块') { launch(); syncStart(); return; }
    if (ended) { if (levelIndex < levels.length - 1) levelIndex += 1; restart(); }
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


