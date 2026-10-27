/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:solitaire';
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
  /* Klondike 接龙：牌堆始终保存真实顺序，选择只保存来源坐标。 */
  // 花色属于接龙牌面，不依赖公共界面图标或字符替换观察器。
  var suitPaths = ['M12 2C-5 14 1 22 10 16l-2 6h8l-2-6C23 22 29 14 12 2Z','M12 21 3 12C-3 3 7-1 12 6 17-1 27 3 21 12Z','M12 12C0-1 0 18 9 14c-9 10 12 10 3 0 10 5 14-12 0-2Zm0 3-3 7h6Z','m12 2 10 10-10 10L2 12Z'];
  function suitSVG(index) { return '<span class="icon-inline"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="fill:currentColor"><path d="' + suitPaths[index] + '"/></svg></span>'; }
  var suitNames = ['黑桃', '红桃', '梅花', '方块'];
  var stock = [];
  var waste = [];
  var tableau = [];
  var foundations = [[], [], [], []];
  var selected = null;
  var suggested = null;
  var history = [];
  var steps = 0;
  var elapsed = 0;
  var started = 0;
  var drawMode = settings.option;
  var best = number('best:' + drawMode, 0);
  var boardElement = document.getElementById('card-table');

  function red(card) { return card.suit === 1 || card.suit === 3; }
  function rank(card) { return ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][card.rank]; }
  function cardName(card) { return suitNames[card.suit] + rank(card); }
  function seconds() { return Math.floor((elapsed + (started ? Date.now() - started : 0)) / 1000); }
  function stopClock() { if (started) elapsed += Date.now() - started; started = 0; }
  function pile(source) { return source.kind === 'waste' ? waste : source.kind === 'foundation' ? foundations[source.col] : tableau[source.col]; }
  function sourceCards(source) {
    if (!source) return [];
    var cards = pile(source);
    if (source.index < 0 || source.index >= cards.length) return [];
    if (source.kind !== 'tableau' && source.index !== cards.length - 1) return [];
    var result = cards.slice(source.index);
    if (!result[0].up) return [];
    for (var i = 1; i < result.length; i += 1) if (!result[i].up || result[i - 1].rank !== result[i].rank + 1 || red(result[i - 1]) === red(result[i])) return [];
    return result;
  }
  function canMove(source, target) {
    var cards = sourceCards(source);
    if (!cards.length || (source.kind === target.kind && source.col === target.col)) return false;
    var destination = target.kind === 'foundation' ? foundations[target.col] : tableau[target.col];
    var top = destination[destination.length - 1];
    if (target.kind === 'foundation') return cards.length === 1 && cards[0].suit === target.col && cards[0].rank === (top ? top.rank + 1 : 1);
    return top ? top.up && top.rank === cards[0].rank + 1 && red(top) !== red(cards[0]) : cards[0].rank === 13;
  }
  function remember() {
    history.push(JSON.stringify({ stock: stock, waste: waste, tableau: tableau, foundations: foundations, steps: steps }));
    if (history.length > 200) history.shift();
    if (!started) started = Date.now();
  }
  function collected() { return foundations.reduce(function (sum, cards) { return sum + cards.length; }, 0); }
  function updateDetail() {
    updateScore(steps, best);
    document.getElementById('detail').textContent = '收牌 ' + collected() + '/52 · 用时 ' + seconds() + ' 秒';
  }
  function moveCards(source, target) {
    if (blocked() || !canMove(source, target)) return false;
    remember();
    var origin = pile(source);
    var moving = origin.splice(source.index);
    var destination = target.kind === 'foundation' ? foundations[target.col] : tableau[target.col];
    Array.prototype.push.apply(destination, moving);
    if (origin.length && source.kind === 'tableau') origin[origin.length - 1].up = true;
    steps += 1; selected = null; suggested = null; sound(550);
    if (collected() === 52) {
      stopClock(); var time = Math.max(1, seconds());
      if (!best || time < best) { best = time; save(key + ':best:' + drawMode, String(best)); }
      finish('接龙完成！' + steps + ' 步，用时 ' + time + ' 秒。');
      document.getElementById('status').dataset.tone = 'normal';
      showCover('全部收齐！', steps + ' 步 · ' + time + ' 秒', '再玩一局');
    } else status('移牌成功，继续整理牌堆。');
    draw(); return true;
  }
  function drawStock() {
    if (blocked() || (!stock.length && !waste.length)) return;
    remember(); selected = null; suggested = null;
    if (stock.length) {
      for (var n = 0; n < (drawMode === 'three' ? 3 : 1) && stock.length; n += 1) { var card = stock.pop(); card.up = true; waste.push(card); }
      status('点击废牌堆最上方的牌，再选择目标牌堆。');
    } else { stock = waste.reverse(); waste = []; stock.forEach(function (card) { card.up = false; }); status('废牌已收回，可继续翻牌。'); }
    steps += 1; sound(430); draw();
  }
  function undo() {
    if (ready || paused || dialog.open || !history.length) return;
    var snapshot = JSON.parse(history.pop());
    stock = snapshot.stock; waste = snapshot.waste; tableau = snapshot.tableau; foundations = snapshot.foundations; steps = snapshot.steps;
    if (ended) { ended = false; document.getElementById('pause').disabled = false; hideCover(); syncStart(); started = Date.now(); }
    selected = null; suggested = null; status('已撤销上一步，计时不回退。'); draw();
  }
  function allSources() {
    var sources = [];
    if (waste.length) sources.push({ kind: 'waste', col: 0, index: waste.length - 1 });
    tableau.forEach(function (cards, col) { cards.forEach(function (card, index) { if (card.up) sources.push({ kind: 'tableau', col: col, index: index }); }); });
    return sources;
  }
  function hint() {
    if (blocked()) return;
    var sources = allSources();
    for (var pass = 0; pass < 2; pass += 1) {
      var kind = pass === 0 ? 'foundation' : 'tableau';
      for (var i = 0; i < sources.length; i += 1) for (var col = 0; col < (pass === 0 ? 4 : 7); col += 1) {
        var target = { kind: kind, col: col };
        if (kind === 'tableau' && !tableau[col].length && sources[i].kind === 'tableau' && sources[i].index === 0) continue;
        if (canMove(sources[i], target)) { selected = sources[i]; suggested = target; status('可移动' + cardName(sourceCards(selected)[0]) + '到' + (kind === 'foundation' ? suitNames[col] + '收牌区。' : '第' + (col + 1) + '列。')); draw(); return; }
      }
    }
    status(stock.length || waste.length ? '可尝试翻牌或回收废牌；提示不保证当前局面一定可解。' : '暂未找到可用移牌，可撤销或重新开始。');
  }
  function sourceFrom(node) { return { kind: node.dataset.kind, col: Number(node.dataset.col), index: Number(node.dataset.index) }; }
  function choose(source) {
    if (!sourceCards(source).length) return;
    selected = selected && selected.kind === source.kind && selected.col === source.col && selected.index === source.index ? null : source;
    suggested = null; draw();
  }
  function autoFoundation(source) {
    if (blocked() || source.kind === 'foundation') return;
    var cards = sourceCards(source);
    if (!cards.length || !moveCards(source, { kind: 'foundation', col: cards[0].suit })) status('只有 A 或同花色的下一张牌可以进入收牌区，且每次只能收一张。');
  }
  function cardButton(card, source) {
    var button = document.createElement('button');
    var active = selected && selected.kind === source.kind && selected.col === source.col && source.index >= selected.index;
    button.className = 'playing-piece' + (card.up ? red(card) ? ' face red-card' : ' face' : ' back') + (active ? ' chosen' : '');
    button.dataset.kind = source.kind; button.dataset.col = source.col; button.dataset.index = source.index;
    button.setAttribute('aria-label', card.up ? cardName(card) : '背面牌');
    button.setAttribute('aria-pressed', String(Boolean(active)));
    if (card.up) {
      var corner = document.createElement('span'); corner.className = 'card-corner'; corner.innerHTML = rank(card) + suitSVG(card.suit);
      var center = document.createElement('span'); center.className = 'card-suit'; center.innerHTML = suitSVG(card.suit);
      button.appendChild(corner); button.appendChild(center); button.draggable = true;
    }
    return button;
  }
  function slot(kind, col, label) {
    var element = document.createElement('div');
    element.className = 'card-slot' + (suggested && suggested.kind === kind && suggested.col === col ? ' suggested' : '');
    element.dataset.target = kind; element.dataset.col = col;
    var empty = document.createElement('button'); empty.className = 'empty-slot';
    if (kind === 'foundation') empty.innerHTML = suitSVG(col); else empty.textContent = label;
    empty.setAttribute('aria-label', kind === 'foundation' ? suitNames[col] + '收牌区' : '第' + (col + 1) + '列空位，仅可放K');
    element.appendChild(empty);
    return element;
  }
  function fitStacks() {
    boardElement.querySelectorAll('.tableau-column').forEach(function (column) {
      var cards = column.querySelectorAll('.playing-piece');
      if (!cards.length) return;
      var cardHeight = cards[0].getBoundingClientRect().height;
      var step = cards.length > 1 ? Math.max(0, Math.min(cardHeight * .3, (column.clientHeight - cardHeight) / (cards.length - 1))) : 0;
      cards.forEach(function (card, index) { card.style.top = index * step + 'px'; });
    });
  }
  function draw() {
    boardElement.innerHTML = '';
    var top = document.createElement('div'); top.className = 'solitaire-top';
    var stockButton = document.createElement('button'); stockButton.className = 'stock-card' + (stock.length ? ' back' : '');
    stockButton.dataset.stock = 'true'; stockButton.textContent = stock.length ? String(stock.length) : '↻'; stockButton.setAttribute('aria-label', stock.length ? '翻牌，剩余' + stock.length + '张' : '回收废牌'); top.appendChild(stockButton);
    var wasteSlot = slot('waste', 0, '废牌');
    if (waste.length) wasteSlot.appendChild(cardButton(waste[waste.length - 1], { kind: 'waste', col: 0, index: waste.length - 1 }));
    top.appendChild(wasteSlot);
    var spacer = document.createElement('span'); spacer.className = 'card-spacer'; top.appendChild(spacer);
    foundations.forEach(function (cards, col) { var target = slot('foundation', col, suitNames[col]); if (cards.length) target.appendChild(cardButton(cards[cards.length - 1], { kind: 'foundation', col: col, index: cards.length - 1 })); top.appendChild(target); });
    boardElement.appendChild(top);
    var bottom = document.createElement('div'); bottom.className = 'solitaire-tableau';
    tableau.forEach(function (cards, col) {
      var column = slot('tableau', col, 'K'); column.className += ' tableau-column';
      cards.forEach(function (card, index) { var button = cardButton(card, { kind: 'tableau', col: col, index: index }); button.style.top = index * 8 + 'px'; column.appendChild(button); });
      bottom.appendChild(column);
    });
    boardElement.appendChild(bottom);
    document.getElementById('undo').disabled = !history.length;
    document.getElementById('rule-label').textContent = '经典接龙 · ' + (drawMode === 'three' ? '每次翻三张' : '每次翻一张') + ' · 无限回收';
    updateDetail(); requestAnimationFrame(fitStacks);
  }
  boardElement.addEventListener('click', function (event) {
    if (blocked()) return;
    if (event.target.closest('[data-stock]')) { drawStock(); return; }
    var card = event.target.closest('[data-index]');
    var target = event.target.closest('[data-target]');
    if (selected && target && target.dataset.target !== 'waste') {
      var destination = { kind: target.dataset.target, col: Number(target.dataset.col) };
      if (moveCards(selected, destination)) return;
    }
    if (card) choose(sourceFrom(card));
    else if (target) { selected = null; suggested = null; draw(); }
  });
  // 对面向重绘的点击使用自行计时双击，避免首次重绘让原生 dblclick 丢失目标。
  var lastTap = null;
  boardElement.addEventListener('pointerdown', function (event) {
    var card = event.target.closest('[data-index]');
    if (!card || blocked()) return;
    var source = sourceFrom(card); var now = Date.now();
    if (lastTap && now - lastTap.time < 320 && JSON.stringify(source) === JSON.stringify(lastTap.source)) {
      event.preventDefault(); lastTap = null; autoFoundation(source);
    } else lastTap = { source: source, time: now };
  });
  boardElement.addEventListener('dragstart', function (event) {
    var card = event.target.closest('[data-index]');
    if (!card || blocked()) { event.preventDefault(); return; }
    var source = sourceFrom(card);
    if (!sourceCards(source).length) { event.preventDefault(); return; }
    selected = source; suggested = null;
    event.dataTransfer.setData('text/plain', 'solitaire-card'); event.dataTransfer.effectAllowed = 'move';
  });
  boardElement.addEventListener('dragover', function (event) { if (selected && !blocked() && event.target.closest('[data-target]')) event.preventDefault(); });
  boardElement.addEventListener('drop', function (event) { var target = event.target.closest('[data-target]'); if (!target || !selected || blocked()) return; event.preventDefault(); if (target.dataset.target !== 'waste') moveCards(selected, { kind: target.dataset.target, col: Number(target.dataset.col) }); });
  boardElement.addEventListener('dragend', function () { draw(); });
  document.addEventListener('keydown', function (event) {
    if (dialog.open || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
    if (event.key === 'Escape' && !blocked()) { selected = null; suggested = null; draw(); }
  });
  document.getElementById('undo').addEventListener('click', undo);
  document.getElementById('hint').addEventListener('click', hint);
  document.getElementById('auto-collect').addEventListener('click', function () { if (selected) autoFoundation(selected); else status('请先选择废牌或列顶的一张牌，再点击收牌。'); });
  function restart() {
    stopClock(); resetState(); drawMode = settings.option; best = number('best:' + drawMode, 0);
    var deck = [];
    for (var suit = 0; suit < 4; suit += 1) for (var value = 1; value <= 13; value += 1) deck.push({ id: suit * 13 + value, suit: suit, rank: value, up: false });
    for (var i = deck.length - 1; i > 0; i -= 1) { var j = Math.floor(Math.random() * (i + 1)); var temp = deck[i]; deck[i] = deck[j]; deck[j] = temp; }
    tableau = [];
    for (var col = 0; col < 7; col += 1) { var cards = []; for (var row = 0; row <= col; row += 1) cards.push(deck.pop()); cards[cards.length - 1].up = true; tableau.push(cards); }
    stock = deck; waste = []; foundations = [[], [], [], []]; selected = null; suggested = null; history = []; steps = 0; elapsed = 0; started = 0; lastTap = null;
    draw(); status('红黑交替递减排列，A 起同花递增收牌，空列只放 K。');
  }
  document.getElementById('restart').addEventListener('click', restart);
  onPause = function () { stopClock(); selected = null; suggested = null; lastTap = null; draw(); };
  onResume = function () { if (steps || elapsed) started = Date.now(); status('继续整理纸牌。'); };
  onOption = function () { status('翻牌规则已保存，重新开始后生效。'); };
  window.addEventListener('resize', fitStacks);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fitStacks).observe(boardElement);
  setInterval(function () { if (!blocked()) updateDetail(); }, 250);
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


