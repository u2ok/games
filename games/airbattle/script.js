/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:airbattle';
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
  /* 飞机大战：600×600 逻辑坐标，渲染尺寸由统一界面缩放。 */
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var player = { x: 300, y: 510 };
  var bullets = [];
  var enemies = [];
  var hostile = [];
  var particles = [];
  var supplies = [];
  var weapon = 'straight';
  var firepower = 1;
  var rapidTime = 0;
  var supplyClock = 6;
  var kills = 0;
  var supplyIndex = 0;
  var weaponNames = { straight: '直射弹', spread: '散射弹', pierce: '贯穿弹' };
  var supplyTypes = ['power', 'spread', 'rapid', 'pierce', 'heal', 'straight'];
  var supplyNames = { power: '火力升级', spread: '散射弹', rapid: '速射', pierce: '贯穿弹', heal: '维修', straight: '直射弹' };
  var supplyMarks = { power: '火', spread: '散', rapid: '速', pierce: '穿', heal: '修', straight: '直' };
  var held = { left: false, right: false, up: false, down: false };
  var pointer = null;
  var lives = 3;
  var score = 0;
  var best = 0;
  var difficulty;
  var elapsed = 0;
  var invincible = 0;
  var shotClock = 0;
  var spawnClock = 0;
  var spawned = 0;
  var accumulator = 0;
  var lastFrame = 0;
  var levels = { easy: { label: '轻松', speed: 75, interval: 1.05 }, normal: { label: '标准', speed: 100, interval: .8 }, hard: { label: '挑战', speed: 130, interval: .65 } };

  // 道具版独立计分，保留旧版纪录，避免不同规则混用。
  function bestKey() { return key + ':best:arsenal:' + difficulty; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function hit(x, y, radius, object) { return Math.abs(x - object.x) < object.w / 2 + radius && Math.abs(y - object.y) < object.h / 2 + radius; }
  function update() {
    updateScore(score, best);
    document.getElementById('rule-label').textContent = levels[difficulty].label + ' · 自动射击 · 3 条生命';
    document.getElementById('detail').textContent = '生命 ' + '♥'.repeat(lives) + ' · 生存 ' + Math.floor(elapsed) + ' 秒';
    document.getElementById('weapon-hud').textContent = weaponNames[weapon] + ' · 火力 ' + firepower + '/3' + (rapidTime > 0 ? ' · 速射 ' + Math.ceil(rapidTime) + '秒' : '');
  }
  function award(value) {
    score += value;
    if (score > best) { best = score; save(bestKey(), String(best)); }
    update();
  }
  function burst(x, y, color) {
    for (var i = 0; i < 10; i += 1) {
      var angle = Math.random() * Math.PI * 2;
      particles.push({ x: x, y: y, vx: Math.cos(angle) * 80, vy: Math.sin(angle) * 80, life: .45, color: color });
    }
    if (particles.length > 120) particles.splice(0, particles.length - 120);
  }
  function damage() {
    if (invincible > 0 || blocked()) return;
    lives -= 1;
    firepower = Math.max(1, firepower - 1);
    burst(player.x, player.y, '#c77953');
    sound(170);
    invincible = 1.6;
    hostile = []; // 受击清除敌弹，留出恢复空间；短暂无敌避免连续扣命。
    update();
    if (!lives) {
      finish('本局 ' + score + ' 分，生存 ' + Math.floor(elapsed) + ' 秒。');
      showCover('任务结束', '得分 ' + score + ' · 生存 ' + Math.floor(elapsed) + ' 秒', '再玩一局');
    }
  }
  function spawnEnemy() {
    spawned += 1;
    var heavy = spawned % 5 === 0;
    enemies.push({ x: 28 + Math.random() * 544, y: -30, w: heavy ? 48 : 32, h: heavy ? 46 : 32,
      hp: heavy ? 3 : 1, heavy: heavy, speed: levels[difficulty].speed * (heavy ? .65 : 1) + Math.min(70, elapsed * .3),
      fire: heavy ? 1 : 1.8 + Math.random(), dead: false });
  }
  function shootAtPlayer(enemy) {
    var dx = player.x - enemy.x; var dy = player.y - enemy.y;
    var length = Math.max(1, Math.hypot(dx, dy));
    var speed = difficulty === 'hard' ? 190 : 145;
    hostile.push({ x: enemy.x, y: enemy.y + enemy.h / 2, vx: dx / length * speed, vy: dy / length * speed, dead: false });
  }
  function dropSupply(x, y) {
    // 按固定轮转投放，确保每种道具都有机会出现，且同屏数量受限。
    var type = supplyTypes[supplyIndex % supplyTypes.length];
    supplyIndex += 1;
    supplies.push({ x: clamp(x, 22, 578), y: Math.max(24, y), type: type, w: 32, h: 32, dead: false });
    if (supplies.length > 6) supplies.shift();
  }
  function collect(type) {
    var fullRepair = type === 'heal' && lives === 3;
    if (type === 'power') firepower = Math.min(3, firepower + 1);
    else if (type === 'rapid') rapidTime = Math.min(20, rapidTime + 8);
    else if (type === 'heal') { if (lives < 3) lives += 1; else award(50); }
    else weapon = type;
    shotClock = 0; // 拾取后下一帧即可感受新武器。
    sound(880); update();
    status('已拾取' + supplyNames[type] + (fullRepair ? '，生命已满，转为 50 分。' : '。'));
  }
  function fire() {
    var count = weapon === 'spread' ? 2 * firepower + 1 : firepower;
    for (var i = 0; i < count; i += 1) {
      var angle = weapon === 'spread' ? (i - (count - 1) / 2) * .13 : 0;
      bullets.push({ x: player.x + (weapon === 'spread' ? 0 : (i - (count - 1) / 2) * 12), y: player.y - 25,
        vx: Math.sin(angle) * 500, vy: -Math.cos(angle) * 500,
        damage: weapon === 'pierce' ? firepower + 1 : firepower === 3 ? 2 : 1,
        pierce: weapon === 'pierce', hits: [], dead: false });
    }
  }
  function physics(dt) {
    elapsed += dt; invincible = Math.max(0, invincible - dt);
    rapidTime = Math.max(0, rapidTime - dt);
    supplyClock -= dt;
    if (supplyClock <= 0) { dropSupply(40 + Math.random() * 520, 24); supplyClock += 12; }
    var dx = Number(held.right) - Number(held.left);
    var dy = Number(held.down) - Number(held.up);
    var length = Math.hypot(dx, dy) || 1;
    player.x = clamp(player.x + dx / length * 300 * dt, 22, 578);
    player.y = clamp(player.y + dy / length * 300 * dt, 28, 572);
    shotClock -= dt; spawnClock -= dt;
    if (shotClock <= 0) { fire(); shotClock += rapidTime > 0 ? .09 : .18; }
    if (spawnClock <= 0) { spawnEnemy(); spawnClock += Math.max(.28, levels[difficulty].interval - elapsed * .002); }
    bullets.forEach(function (bullet) { bullet.x += (bullet.vx || 0) * dt; bullet.y += (bullet.vy || -500) * dt; });
    supplies.forEach(function (supply) { supply.y += 65 * dt; });
    enemies.forEach(function (enemy) {
      enemy.y += enemy.speed * dt;
      enemy.fire -= dt;
      if (enemy.fire <= 0 && enemy.y > 20 && enemy.y < 500) { shootAtPlayer(enemy); enemy.fire = enemy.heavy ? 1.1 : 2.8; }
    });
    hostile.forEach(function (bullet) { bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; });
    // 固定小步长判定，每颗我方子弹只击中一架敌机。
    bullets.forEach(function (bullet) {
      if (bullet.dead) return;
      for (var i = 0; i < enemies.length; i += 1) {
        var enemy = enemies[i];
          if (enemy.dead || (bullet.hits && bullet.hits.indexOf(enemy) !== -1) || !hit(bullet.x, bullet.y, 3, enemy)) continue;
          if (!bullet.hits) bullet.hits = [];
          bullet.hits.push(enemy);
          bullet.dead = !bullet.pierce; enemy.hp -= bullet.damage || 1;
          if (enemy.hp <= 0) {
            enemy.dead = true; kills += 1;
            award(enemy.heavy ? 30 : 10); burst(enemy.x, enemy.y, '#d69962'); sound(650);
            if (enemy.heavy || kills % 4 === 0) dropSupply(enemy.x, enemy.y);
          }
          if (!bullet.pierce) break;
      }
    });
    enemies.forEach(function (enemy) {
      if (!enemy.dead && hit(player.x, player.y, 10, enemy)) { enemy.dead = true; burst(enemy.x, enemy.y, '#d69962'); damage(); }
    });
    for (var n = 0; n < hostile.length && !ended; n += 1) {
      var bullet = hostile[n];
      if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < 14) { bullet.dead = true; damage(); }
    }
    // 只有游戏仍进行时才结算拾取，不允许结束后维修“复活”。
    if (!ended) supplies.forEach(function (supply) { if (!supply.dead && hit(player.x, player.y, 16, supply)) { supply.dead = true; collect(supply.type); } });
    supplies = supplies.filter(function (supply) { return !supply.dead && supply.y < 630; });
    bullets = bullets.filter(function (bullet) { return !bullet.dead && bullet.y > -20 && bullet.x > -20 && bullet.x < 620; });
    enemies = enemies.filter(function (enemy) { return !enemy.dead && enemy.y < 650; });
    hostile = hostile.filter(function (bullet) { return !bullet.dead && bullet.y < 630 && bullet.y > -30 && bullet.x > -30 && bullet.x < 630; });
    particles.forEach(function (particle) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; });
    particles = particles.filter(function (particle) { return particle.life > 0; });
    update();
  }
  function plane(x, y, scale, color, enemy) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, enemy ? -scale : scale);
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(8, -4); ctx.lineTo(24, 10); ctx.lineTo(23, 17);
    ctx.lineTo(7, 12); ctx.lineTo(7, 21); ctx.lineTo(12, 26); ctx.lineTo(-12, 26); ctx.lineTo(-7, 21);
    ctx.lineTo(-7, 12); ctx.lineTo(-23, 17); ctx.lineTo(-24, 10); ctx.lineTo(-8, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff4d6'; ctx.fillRect(-3, -10, 6, 14); ctx.restore();
  }
  function draw() {
    ctx.fillStyle = '#e3eadc'; ctx.fillRect(0, 0, 600, 600);
    ctx.strokeStyle = '#cdd9c3'; ctx.lineWidth = 1;
    var offset = elapsed * 35 % 40;
    for (var y = offset - 40; y < 600; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(600, y); ctx.stroke(); }
    for (var x = 40; x < 600; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 600); ctx.stroke(); }
    bullets.forEach(function (bullet) { ctx.fillStyle = bullet.pierce ? '#8b5b91' : '#245c4a'; ctx.fillRect(bullet.x - (bullet.pierce ? 3 : 2), bullet.y - (bullet.pierce ? 12 : 7), bullet.pierce ? 6 : 4, bullet.pierce ? 24 : 14); });
    supplies.forEach(function (supply) {
      ctx.fillStyle = supply.type === 'heal' ? '#dfeede' : '#fff3d3'; ctx.fillRect(supply.x - 16, supply.y - 16, 32, 32);
      ctx.strokeStyle = '#9d7f4f'; ctx.strokeRect(supply.x - 16, supply.y - 16, 32, 32);
      ctx.fillStyle = '#624a36'; ctx.font = 'bold 19px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(supplyMarks[supply.type], supply.x, supply.y);
    });
    hostile.forEach(function (bullet) { ctx.fillStyle = '#a75438'; ctx.beginPath(); ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2); ctx.fill(); });
    enemies.forEach(function (enemy) { plane(enemy.x, enemy.y, enemy.heavy ? .9 : .65, enemy.heavy ? '#9b684f' : '#b58b69', true); });
    if (!invincible || Math.floor(invincible * 10) % 2 === 0) plane(player.x, player.y, 1, '#245c4a', false);
    particles.forEach(function (particle) { ctx.globalAlpha = particle.life / .45; ctx.fillStyle = particle.color; ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4); });
    ctx.globalAlpha = 1;
  }
  function clearInput() { Object.keys(held).forEach(function (name) { held[name] = false; }); pointer = null; }
  function restart() {
    resetState(); difficulty = settings.option; best = number('best:arsenal:' + difficulty, 0);
    lives = 3; score = 0; elapsed = 0; invincible = 0; shotClock = 0; spawnClock = .5; spawned = 0; accumulator = 0;
    player = { x: 300, y: 510 }; bullets = []; enemies = []; hostile = []; particles = []; clearInput();
    supplies = []; weapon = 'straight'; firepower = 1; rapidTime = 0; supplyClock = 6; kills = 0; supplyIndex = 0;
    update(); draw(); status('自动射击，移动战机躲避敌机与子弹。');
  }
  function frame(now) {
    var delta = lastFrame ? Math.min((now - lastFrame) / 1000, .05) : 0; lastFrame = now;
    if (!blocked()) {
      accumulator += delta;
      while (accumulator >= 1 / 120 && !blocked()) { physics(1 / 120); accumulator -= 1 / 120; }
    } else accumulator = 0;
    draw(); requestAnimationFrame(frame);
  }
  var keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
  function input(event, down) {
    if (dialog.open || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
    var direction = keys[event.key] || keys[event.key.toLowerCase()];
    if (direction) { event.preventDefault(); held[direction] = down && !blocked(); }
    if (down && event.code === 'Space' && !event.repeat && !/BUTTON|A/.test(event.target.tagName)) { event.preventDefault(); if (paused || ready || ended) startGame(); else pause(); }
  }
  document.addEventListener('keydown', function (event) { input(event, true); });
  document.addEventListener('keyup', function (event) { input(event, false); });
  canvas.addEventListener('pointerdown', function (event) {
    if (blocked() || pointer) return;
    canvas.setPointerCapture(event.pointerId);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointermove', function (event) {
    if (blocked()) return;
    var rect = canvas.getBoundingClientRect();
    if (pointer && pointer.id === event.pointerId) {
      player.x = clamp(player.x + (event.clientX - pointer.x) / rect.width * 600, 22, 578);
      player.y = clamp(player.y + (event.clientY - pointer.y) / rect.height * 600, 28, 572);
      pointer.x = event.clientX; pointer.y = event.clientY;
    } else if (event.pointerType === 'mouse') {
      player.x = clamp((event.clientX - rect.left) / rect.width * 600, 22, 578);
      player.y = clamp((event.clientY - rect.top) / rect.height * 600, 28, 572);
    }
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) { canvas.addEventListener(type, function (event) { if (pointer && pointer.id === event.pointerId) pointer = null; }); });
  onPause = clearInput;
  onResume = function () { status('继续飞行，自动射击中。'); };
  onOption = function () { status('难度已保存，重新开始后生效。'); };
  document.getElementById('restart').addEventListener('click', restart);
  restart(); requestAnimationFrame(frame);

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


