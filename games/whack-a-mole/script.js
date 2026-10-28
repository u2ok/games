/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
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

  /* 仅一个固定循环推进剩余时间与出没事件；暂停时冻结逻辑时间。 */
  var configs={easy:{life:1400,gap:850},normal:{life:1000,gap:650},hard:{life:750,gap:480}};
  var difficulty='normal',holes=[],score=0,combo=0,hits=0,misses=0,left=60000,spawnIn=0,last=Date.now(),best=0;
  var grid=document.getElementById('grid');
  var mole='<svg viewBox="0 0 80 80" aria-hidden="true"><ellipse cx="40" cy="69" rx="31" ry="9" fill="#735344"/><circle cx="23" cy="29" r="10" fill="#9e795d"/><circle cx="57" cy="29" r="10" fill="#9e795d"/><path d="M15 66V44c0-37 50-37 50 0v22" fill="#b58c67"/><ellipse cx="40" cy="53" rx="19" ry="13" fill="#f4d9af"/><circle cx="30" cy="39" r="3" fill="#332a25"/><circle cx="50" cy="39" r="3" fill="#332a25"/><ellipse cx="40" cy="49" rx="5" ry="4" fill="#62433b"/><path d="M34 57q6 5 12 0" fill="none" stroke="#62433b" stroke-width="2"/></svg>';
  for(var i=0;i<9;i++){
    var button=document.createElement('button');button.className='mole-hole';button.dataset.hole=i;
    button.innerHTML='<span class="mole-body">'+mole+'</span><span class="hole-number">'+(i+1)+'</span>';
    grid.appendChild(button);
  }
  function update(){
    updateScore(score,best);
    var text='剩余 '+Math.ceil(left/1000)+' 秒 · 连击 '+combo+' · 命中 '+hits+' · 漏击 '+misses;
    var detail=document.getElementById('detail');if(detail.textContent!==text)detail.textContent=text;
    Array.from(grid.children).forEach(function(button,index){var active=holes[index]>0;button.classList.toggle('is-up',active);button.setAttribute('aria-label','洞口'+(index+1)+(active?'，地鼠出现':'，空洞'));});
  }
  function spawn(){
    var empty=[];holes.forEach(function(time,index){if(time<=0)empty.push(index);});
    if(empty.length)holes[empty[Math.floor(Math.random()*empty.length)]]=configs[difficulty].life;
  }
  function hit(index){
    if(blocked()||index<0||index>=9)return;
    if(holes[index]<=0){combo=0;status('打空了，连击重置。');update();return;}
    holes[index]=0;hits++;combo++;var points=10+Math.min(20,Math.floor((combo-1)/5)*5);score+=points;
    if(score>best){best=score;save(key+':best:'+difficulty,String(best));}
    sound(650);status('命中！+'+points+' 分，连续命中 '+combo+' 次。');update();
  }
  function advance(delta){
    if(blocked())return;
    // 到达结束时间后不再生成或接收新目标；事件仅在本局时间窗口内推进。
    delta=Math.min(Math.max(0,delta),left);left-=delta;
    holes=holes.map(function(time){if(time>0&&time<=delta){misses++;combo=0;}return Math.max(0,time-delta);});
    spawnIn-=delta;
    if(left>0&&spawnIn<=0){spawn();spawnIn=configs[difficulty].gap;}
    if(left<=0){holes=Array(9).fill(0);finish('挑战结束！得分 '+score+'，命中 '+hits+' 次。');}
    update();
  }
  function restart(){
    resetState();difficulty=configs[settings.option]?settings.option:'normal';best=number('best:'+difficulty,0);
    holes=Array(9).fill(0);score=0;combo=0;hits=0;misses=0;left=60000;spawnIn=0;last=Date.now();
    document.getElementById('rule-label').textContent=({easy:'轻松',normal:'标准',hard:'挑战'})[difficulty]+' · 60秒 · 九宫格';
    update();status('点击冒出的地鼠；数字键1–9对应从左到右、从上到下的洞口。');
  }
  grid.addEventListener('click',function(event){var button=event.target.closest('[data-hole]');if(button)hit(Number(button.dataset.hole));});
  document.addEventListener('keydown',function(event){if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;if(/^[1-9]$/.test(event.key)){event.preventDefault();hit(Number(event.key)-1);}});
  onResume=function(){last=Date.now();};onOption=function(){status('难度已保存，重新开始后生效。');};
  document.getElementById('restart').addEventListener('click',restart);
  setInterval(function(){var now=Date.now(),delta=now-last;last=now;advance(delta);},40);
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
