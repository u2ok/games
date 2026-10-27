/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:match3';
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






  var grid=document.getElementById('grid'), board=[], selected=-1, cursor=0, hintedPair=[];
  var score=0,best=0,moves=28,target=2200,colors=5,difficulty='normal',assisted=false;
  var phase='',remaining=0,chain=0,cleared=[],last=Date.now(),origin=null,suppressClick=0;
  // 图案越多，连锁越少；按可得分机会校准目标，而非仅逐档抬高分数。
  var modes={easy:{colors:4,moves:35,target:1200,name:'轻松'},normal:{colors:5,moves:28,target:2200,name:'标准'},hard:{colors:6,moves:26,target:1900,name:'挑战'},master:{colors:7,moves:24,target:1500,name:'大师'}};
  function recordKey(){return 'best:v2:'+difficulty;}
  var gemColors=['#be6c64','#4e8e90','#b78937','#718552','#7e75ad','#b46f8e','#bf8749'];
  var gemNames=['红色圆形','蓝色菱形','金色星形','绿色叶形','紫色方形','粉色六边形','橙色三角形'];
  var gemPaths=['<circle cx="16" cy="16" r="12"/><path d="M9 13q1-5 6-5"/>','<path d="m16 2 12 14-12 14L4 16Z"/><path d="m16 7-6 8"/>','<path d="m16 2 4.1 8.7 9.5 1.3-7 6.7 1.7 9.5L16 23.7l-8.3 4.5 1.7-9.5-7-6.7 9.5-1.3Z"/>','<path d="M6 26C-2 7 13 3 28 4c1 15-4 29-22 22Z"/><path d="m8 24 13-13"/>','<rect x="4" y="4" width="24" height="24" rx="5"/><path d="M10 12V9h7"/>','<path d="m9 3 14 0 7 13-7 13H9L2 16Z"/><path d="m9 11 3-4h7"/>','<path d="m16 3 14 25H2Z"/><path d="m15 10-5 10"/>'];
  function adjacent(a,b){return a>=0&&b>=0&&a<64&&b<64&&Math.abs(a%8-b%8)+Math.abs(Math.floor(a/8)-Math.floor(b/8))===1;}
  // 行列分别扫描，交叉位置用集合去重；空位不参与匹配。
  function matches(cells){
    var found={};
    for(var axis=0;axis<2;axis++)for(var line=0;line<8;line++){
      var run=[];
      for(var pos=0;pos<=8;pos++){
        var index=axis?pos*8+line:line*8+pos;
        if(pos<8&&cells[index]>=0&&(!run.length||cells[index]===cells[run[0]])){run.push(index);continue;}
        if(run.length>=3)run.forEach(function(i){found[i]=true;});
        run=pos<8&&cells[index]>=0?[index]:[];
      }
    }
    return Object.keys(found).map(Number);
  }
  function findMove(cells){
    for(var i=0;i<64;i++)for(var d=0;d<2;d++){
      var j=i+(d?8:1);if(!adjacent(i,j)||cells[i]===cells[j])continue;
      var trial=cells.slice(),temp=trial[i];trial[i]=trial[j];trial[j]=temp;
      if(matches(trial).length)return [i,j];
    }
    return null;
  }
  function stableBoard(count){
    for(var attempt=0;attempt<40;attempt++){
      var cells=[];
      for(var i=0;i<64;i++){
        var allowed=[];for(var color=0;color<count;color++)if(!(i%8>=2&&cells[i-1]===color&&cells[i-2]===color)&&!(i>=16&&cells[i-8]===color&&cells[i-16]===color))allowed.push(color);
        cells.push(allowed[Math.floor(Math.random()*allowed.length)]);
      }
      if(findMove(cells))return cells;
    }
    // 明确植入一个合法交换；随机源异常时也不无限生成或产出死局。
    var fallback=Array.from({length:64},function(_,i){return (Math.floor(i/8)*2+i%8)%count;});
    fallback[0]=0;fallback[1]=1;fallback[2]=0;fallback[9]=0;return fallback;
  }
  function reshuffle(cells){
    for(var attempt=0;attempt<100;attempt++){
      var trial=cells.slice();for(var i=63;i>0;i--){var j=Math.floor(Math.random()*(i+1)),v=trial[i];trial[i]=trial[j];trial[j]=v;}
      if(!matches(trial).length&&findMove(trial))return trial;
    }
    // 优先保留图案数量；若无有效重排，重建稳定且有可走组合的棋盘。
    return stableBoard(colors);
  }
  function collapse(cells,count){
    for(var col=0;col<8;col++){
      var write=7;
      for(var row=7;row>=0;row--)if(cells[row*8+col]>=0){cells[write*8+col]=cells[row*8+col];write--;}
      while(write>=0){cells[write*8+col]=Math.floor(Math.random()*count);write--;}
    }
  }
  function setText(id,text){var node=document.getElementById(id);text=String(text);if(node.textContent!==text)node.textContent=text;}
  function draw(focus){
    var hadFocus=document.activeElement&&grid.contains(document.activeElement);
    grid.innerHTML='';grid.setAttribute('aria-busy',String(!!phase));
    board.forEach(function(value,index){
      var button=document.createElement('button');button.className='match3-tile'+(hintedPair.indexOf(index)>=0?' hinted':'')+(phase==='clear'&&cleared.indexOf(index)>=0?' clearing':'');
      button.dataset.index=index;button.tabIndex=index===cursor?0:-1;
      button.setAttribute('aria-label','第'+(Math.floor(index/8)+1)+'行第'+(index%8+1)+'列，'+gemNames[value]+(hintedPair.indexOf(index)>=0?'，可交换提示':''));
      button.setAttribute('aria-pressed',String(selected===index));
      button.innerHTML='<svg class="match3-gem" viewBox="0 0 32 32" aria-hidden="true" focusable="false" style="color:'+gemColors[value]+'">'+gemPaths[value]+'</svg>';
      grid.appendChild(button);
    });
    setText('score',score);setText('best',best||'—');
    setText('detail','剩余 '+moves+' 步 · 目标 '+target+' 分'+(chain>1?' · '+chain+'连锁':'')+(assisted?' · 已用提示':''));
    document.getElementById('hint').disabled=!!phase||ended;
    document.getElementById('shuffle').disabled=!!phase||ended;
    if(focus||hadFocus){var button=document.querySelector('.match3-tile[data-index="'+cursor+'"]');if(button)button.focus();}
  }
  function settle(){
    phase='';remaining=0;cleared=[];
    if(score>=target||moves<=0){
      if(!assisted&&score>best){best=score;save(key+':'+recordKey(),String(best));}
      var won=score>=target;
      finish((won?'成功达成目标！':'步数已用完。')+'本局'+score+'分。'+(assisted?'使用提示，不计最佳纪录。':''));
      document.getElementById('status').dataset.tone=won?'normal':'error';
      showCover(won?'目标达成！':'再试一次',score+' / '+target+'分'+(assisted?' · 已用提示':''),'再玩一局');
    }else if(!findMove(board)){
      board=reshuffle(board);status('没有可消除的交换，已自动重排，不扣步。');
    }else status('本次消除结束，继续交换相邻图案。');
    draw();
  }
  function swap(a,b){
    if(blocked()||phase||!adjacent(a,b))return false;
    var old=board.slice(),value=board[a];board[a]=board[b];board[b]=value;
    var hit=matches(board);selected=-1;hintedPair=[];
    if(!hit.length){board=old;status('这次交换不能消除，不扣步数。');draw();return false;}
    moves--;chain=1;cleared=hit;phase='clear';remaining=220;last=Date.now();
    status('连成'+hit.length+'块，正在消除。');draw();return true;
  }
  function choose(index){
    if(blocked()||phase||index<0||index>=64)return;
    cursor=index;
    if(selected===index)selected=-1;
    else if(selected>=0&&adjacent(selected,index)){swap(selected,index);return;}
    else selected=index;
    hintedPair=[];draw(true);
  }
  // 按阶段推进，暂停不减少等待时间；重开清除阶段，不残留异步回调。
  function advance(ms){
    if(blocked()||!phase)return;
    remaining-=ms;if(remaining>0)return;
    if(phase==='clear'){
      score+=cleared.length*10*chain;
      cleared.forEach(function(index){board[index]=-1;});collapse(board,colors);
      phase='fall';remaining=180;sound(480+Math.min(chain,8)*60);draw();
    }else{
      var hit=matches(board);
      if(hit.length&&chain<30){chain++;cleared=hit;phase='clear';remaining=220;draw();}
      else {if(hit.length)board=stableBoard(colors);settle();}
    }
  }
  function hint(){
    if(blocked()||phase)return;
    var pair=findMove(board);
    if(!pair){board=reshuffle(board);pair=findMove(board);}
    assisted=true;hintedPair=pair||[];selected=-1;status('虚线标出可交换的一对，不扣步。本局使用提示，不计最佳纪录。');draw();
  }
  function shuffle(){
    if(blocked()||phase)return;
    board=reshuffle(board);selected=-1;hintedPair=[];moves--;chain=0;
    if(!moves)settle();else {status('已洗牌，消耗1步。');draw();}
  }
  function restart(){
    resetState();difficulty=modes[settings.option]?settings.option:'normal';var mode=modes[difficulty];
    colors=mode.colors;moves=mode.moves;target=mode.target;board=stableBoard(colors);
    score=0;best=number(recordKey(),0);selected=-1;cursor=0;hintedPair=[];assisted=false;phase='';remaining=0;chain=0;cleared=[];origin=null;suppressClick=0;last=Date.now();
    setText('rule-label',mode.name+' · 8 × 8 · '+colors+'种图案');draw();status(moves+'步内达到'+target+'分，点击相邻图案交换。');
  }
  grid.addEventListener('click',function(event){if(Date.now()<suppressClick)return;var tile=event.target.closest('[data-index]');if(tile)choose(Number(tile.dataset.index));});
  grid.addEventListener('keydown',function(event){
    if(blocked()||phase||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return;
    var tile=event.target.closest('[data-index]');if(!tile)return;var index=Number(tile.dataset.index),next=index;
    if(event.key==='ArrowLeft'&&index%8>0)next--;
    else if(event.key==='ArrowRight'&&index%8<7)next++;
    else if(event.key==='ArrowUp'&&index>=8)next-=8;
    else if(event.key==='ArrowDown'&&index<56)next+=8;
    else if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(index);return;}
    else if(event.key==='Escape'){event.preventDefault();selected=-1;draw(true);return;}
    else return;
    event.preventDefault();cursor=next;draw(true);
  });
  grid.addEventListener('pointerdown',function(event){var tile=event.target.closest('[data-index]');if(!tile||blocked()||phase||!event.isPrimary)return;origin={index:Number(tile.dataset.index),x:event.clientX,y:event.clientY,id:event.pointerId};grid.setPointerCapture(event.pointerId);});
  grid.addEventListener('pointerup',function(event){
    if(!origin||origin.id!==event.pointerId)return;var start=origin;origin=null;suppressClick=Date.now()+250;
    var dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(Math.max(Math.abs(dx),Math.abs(dy))<12){choose(start.index);return;}
    var next=start.index+(Math.abs(dx)>Math.abs(dy)?dx>0?1:-1:dy>0?8:-8);cursor=start.index;swap(start.index,next);
  });
  grid.addEventListener('pointercancel',function(){origin=null;});grid.addEventListener('lostpointercapture',function(){origin=null;});
  document.getElementById('hint').addEventListener('click',hint);document.getElementById('shuffle').addEventListener('click',shuffle);
  document.getElementById('restart').addEventListener('click',restart);
  onPause=function(){origin=null;};onResume=function(){last=Date.now();status(phase?'继续处理本次连锁消除。':'继续交换相邻图案。');};
  setInterval(function(){var now=Date.now(),delta=Math.min(250,Math.max(0,now-last));last=now;advance(delta);},50);
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
  ready = true; showCover('准备好了吗？', '交换相邻图案，连成三个即可消除。', '开始游戏');
  syncStart();

}());
