/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:maze';
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




  var canvas = document.getElementById('canvas'), ctx = canvas.getContext('2d');
  var size = 11, maze = [], player = 0, exit = 0, gems = [], collected = [], visited = [];
  var steps = 0, best = 0, elapsed = 0, started = 0, hinted = false, hintPath = [], origin = null;
  var directions = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
  var names = { 11:'轻松', 15:'标准', 21:'挑战' };
  // 迭代回溯只连接尚未访问的房间，产生连通且无环的迷宫，避免递归栈溢出。
  function generate(n) {
    var map = Array(n*n).fill(0), stack = [n+1]; map[n+1] = 1;
    while (stack.length) {
      var current = stack[stack.length-1], x = current%n, y = Math.floor(current/n), candidates = [];
      Object.keys(directions).forEach(function (name) {
        var d = directions[name], nx = x+d[0]*2, ny = y+d[1]*2;
        if (nx>0 && ny>0 && nx<n-1 && ny<n-1 && !map[ny*n+nx]) candidates.push([ny*n+nx, (y+d[1])*n+x+d[0]]);
      });
      if (!candidates.length) { stack.pop(); continue; }
      var next = candidates[Math.floor(Math.random()*candidates.length)]; map[next[0]]=1; map[next[1]]=1; stack.push(next[0]);
    }
    return map;
  }
  function neighbors(index) {
    var x=index%size,y=Math.floor(index/size), result=[];
    Object.keys(directions).forEach(function(name){var d=directions[name],nx=x+d[0],ny=y+d[1];if(nx>=0&&ny>=0&&nx<size&&ny<size&&maze[ny*size+nx])result.push(ny*size+nx);});
    return result;
  }
  // BFS返回包括起终点的最短可行路径；不可达返回空数组。
  function route(from, to) {
    if (!maze[from] || !maze[to]) return [];
    var queue=[from], previous=Array(size*size).fill(-1);previous[from]=from;
    for(var head=0;head<queue.length;head++) {
      var current=queue[head];if(current===to)break;
      neighbors(current).forEach(function(next){if(previous[next]===-1){previous[next]=current;queue.push(next);}});
    }
    if(previous[to]===-1)return [];
    var path=[to];while(path[path.length-1]!==from)path.push(previous[path[path.length-1]]);
    return path.reverse();
  }
  function seconds(){return Math.floor((elapsed+(started?Date.now()-started:0))/1000);}
  function stopClock(){if(started)elapsed+=Date.now()-started;started=0;origin=null;}
  function setText(id,text){var node=document.getElementById(id);text=String(text);if(node.textContent!==text)node.textContent=text;}
  function detail(){
    setText('score',steps);setText('best',best||'—');
    setText('detail','宝石 '+collected.length+'/3 · 用时 '+(ended?Math.max(1,seconds()):seconds())+' 秒'+(hinted?' · 已用提示':''));
  }
  function draw(){
    var unit=600/size;
    ctx.clearRect(0,0,600,600);ctx.fillStyle='#6d8067';ctx.fillRect(0,0,600,600);
    maze.forEach(function(open,index){if(!open)return;var x=index%size*unit,y=Math.floor(index/size)*unit;ctx.fillStyle='#faf8ed';ctx.fillRect(x,y,unit+.3,unit+.3);if(visited[index]){ctx.fillStyle='#c9d2c0';ctx.beginPath();ctx.arc(x+unit/2,y+unit/2,unit*.08,0,Math.PI*2);ctx.fill();}});
    if(hintPath.length>1){ctx.strokeStyle='#d6a14a';ctx.lineWidth=unit*.16;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();hintPath.forEach(function(index,i){var x=(index%size+.5)*unit,y=(Math.floor(index/size)+.5)*unit;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();}
    // 出口旗帜、宝石菱形和玩家圆形具有不同轮廓，不只依赖颜色识别。
    var ex=(exit%size+.5)*unit,ey=(Math.floor(exit/size)+.5)*unit;
    ctx.strokeStyle='#355f52';ctx.lineWidth=unit*.08;ctx.beginPath();ctx.moveTo(ex-unit*.2,ey+unit*.3);ctx.lineTo(ex-unit*.2,ey-unit*.3);ctx.stroke();
    ctx.fillStyle=collected.length===3?'#527b60':'#9aa88e';ctx.beginPath();ctx.moveTo(ex-unit*.15,ey-unit*.3);ctx.lineTo(ex+unit*.3,ey-unit*.15);ctx.lineTo(ex-unit*.15,ey);ctx.closePath();ctx.fill();
    gems.forEach(function(index){if(collected.indexOf(index)!==-1)return;var x=(index%size+.5)*unit,y=(Math.floor(index/size)+.5)*unit;ctx.fillStyle='#c88d34';ctx.beginPath();ctx.moveTo(x,y-unit*.32);ctx.lineTo(x+unit*.25,y);ctx.lineTo(x,y+unit*.32);ctx.lineTo(x-unit*.25,y);ctx.closePath();ctx.fill();ctx.strokeStyle='#fff5cc';ctx.lineWidth=unit*.05;ctx.stroke();});
    var px=(player%size+.5)*unit,py=(Math.floor(player/size)+.5)*unit;
    ctx.fillStyle='#5366d6';ctx.beginPath();ctx.arc(px,py,unit*.31,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=unit*.07;ctx.stroke();
    canvas.setAttribute('aria-label','迷宫'+size+'行'+size+'列，第'+(Math.floor(player/size)+1)+'行第'+(player%size+1)+'列，已收集'+collected.length+'颗宝石，共3颗。方向键或WASD移动。');
    detail();
  }
  function move(name){
    if(blocked()||!directions[name])return false;
    var d=directions[name],x=player%size+d[0],y=Math.floor(player/size)+d[1];
    if(x<0||y<0||x>=size||y>=size||!maze[y*size+x]){status('前方是墙，换个方向试试。');return false;}
    if(!started)started=Date.now();player=y*size+x;steps++;visited[player]=true;hintPath=[];
    if(gems.indexOf(player)!==-1&&collected.indexOf(player)===-1){collected.push(player);sound(760);status('找到一颗宝石！已收集'+collected.length+'/3。');}
    else status(collected.length===3?'宝石已收齐，前往旗帜出口。':'继续探索，收集全部3颗宝石。');
    if(player===exit){
      if(collected.length<3)status('找到出口了，还差'+(3-collected.length)+'颗宝石。');
      else {stopClock();var time=Math.max(1,seconds());if(!hinted&&(!best||time<best)){best=time;save(key+':best:'+size,String(best));}finish('成功走出迷宫！'+steps+'步，用时'+time+'秒。'+(hinted?'本局使用提示，不计纪录。':''));showCover('探险成功！','收齐3颗宝石，'+steps+'步走出迷宫。','再探一局');}
    }
    draw();return true;
  }
  function hint(){
    if(blocked())return;
    var targets=gems.filter(function(index){return collected.indexOf(index)===-1;});if(!targets.length)targets=[exit];
    hintPath=[];targets.forEach(function(target){var path=route(player,target);if(path.length&&(!hintPath.length||path.length<hintPath.length))hintPath=path;});
    hinted=true;status('金色线指向'+(collected.length===3?'出口':'最近的未收集宝石')+'，移动后隐藏。本局不计最快纪录。');draw();
  }
  function restart(){
    stopClock();resetState();size=[11,15,21].indexOf(Number(settings.option))!==-1?Number(settings.option):11;
    maze=generate(size);player=size+1;exit=(size-2)*size+size-2;steps=0;elapsed=0;started=0;hinted=false;hintPath=[];collected=[];visited=Array(size*size).fill(false);visited[player]=true;
    var floors=[];maze.forEach(function(open,index){if(open&&index!==player&&index!==exit)floors.push(index);});
    for(var i=floors.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=floors[i];floors[i]=floors[j];floors[j]=t;}gems=floors.slice(0,3);
    best=number('best:'+size,0);setText('rule-label',names[size]+' · '+size+' × '+size+' · 收集3颗宝石');draw();status('收集3颗宝石，再到达旗帜出口。');
  }
  var keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
  document.addEventListener('keydown',function(event){if(event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||blocked()||/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)||event.target.isContentEditable)return;var direction=keys[event.key]||keys[event.key.toLowerCase()];if(direction){event.preventDefault();move(direction);}});
  document.querySelectorAll('[data-direction]').forEach(function(button){button.addEventListener('click',function(){move(button.dataset.direction);});});
  function swipeDirection(dx,dy){if(Math.max(Math.abs(dx),Math.abs(dy))<16)return null;return Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';}
  canvas.addEventListener('pointerdown',function(event){if(blocked()||!event.isPrimary)return;origin={x:event.clientX,y:event.clientY,id:event.pointerId};canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointerup',function(event){if(!origin||origin.id!==event.pointerId)return;var dx=event.clientX-origin.x,dy=event.clientY-origin.y;origin=null;var direction=swipeDirection(dx,dy);if(direction)move(direction);});
  canvas.addEventListener('pointercancel',function(){origin=null;});
  canvas.addEventListener('lostpointercapture',function(){origin=null;});
  document.getElementById('hint').addEventListener('click',hint);
  document.getElementById('restart').addEventListener('click',restart);
  onPause=stopClock;onResume=function(){if(steps)started=Date.now();status('继续探索迷宫。');};
  setInterval(function(){if(!blocked())detail();},250);
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
    if (ended) restart();
    if (paused) resume();
    ready = false;
    hideCover(); syncStart(); status('游戏进行中。');
  }
  document.getElementById('start').addEventListener('click', startGame);
  var coverAction = document.getElementById('cover-action');
  if (coverAction) coverAction.addEventListener('click', startGame);
  document.getElementById('restart').addEventListener('click', function () { syncStart(); });
  ready = true; showCover('准备好了吗？', '收集3颗宝石，找到迷宫出口。', '开始游戏');
  syncStart();

}());
