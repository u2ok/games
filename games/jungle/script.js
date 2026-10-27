/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:jungle';
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


  var names=['','鼠','猫','狗','狼','豹','虎','狮','象'];
  var board=[],turn=1,history=[],seen=[],quiet=0,selected=-1,cursor=56,last=-1;
  var mode=read(key+':mode')==='local'?'local':'ai', difficulty=settings.option,aiTimer=null,revision=0;
  var grid=document.getElementById('grid'), directions=[[0,-1],[1,0],[0,1],[-1,0]];
  function side(p){return p>0?1:p<0?2:0;}
  function sideName(s){return s===1?'红方':'蓝方';}
  function water(i){var x=i%7,y=Math.floor(i/7);return y>=3&&y<=5&&(x===1||x===2||x===4||x===5);}
  function den(i){return i===3?2:i===59?1:0;}
  function trap(i){return [2,4,10].indexOf(i)>=0?2:[58,60,52].indexOf(i)>=0?1:0;}
  function rank(p,i){return trap(i)&&trap(i)!==side(p)?0:Math.abs(p);}
  // 水陆边界禁止吃子；陷阱降为0优先于鼠象例外，离开陷阱即恢复。
  function canCapture(state,from,to){
    var a=state[from],b=state[to];if(!b)return true;if(side(a)===side(b)||water(from)!==water(to))return false;
    var ar=rank(a,from),br=rank(b,to);if(!br)return true;if(!ar)return false;
    if(Math.abs(a)===1&&Math.abs(b)===8)return true;
    if(Math.abs(a)===8&&Math.abs(b)===1)return false;
    return ar>=br;
  }
  // 以坐标检查四邻，狮虎越过连续河格，途中任一棋子（合法局面仅鼠）阻挡。
  function movesFrom(state,from){
    var p=state[from],result=[];if(!p)return result;
    directions.forEach(function(d){
      var x=from%7+d[0],y=Math.floor(from/7)+d[1];if(x<0||x>6||y<0||y>8)return;
      var to=y*7+x;
      if(water(to)&&Math.abs(p)!==1){
        if(Math.abs(p)!==6&&Math.abs(p)!==7)return;
        while(water(to)){if(state[to])return;x+=d[0];y+=d[1];to=y*7+x;}
      }
      if(den(to)===side(p)||!canCapture(state,from,to))return;
      result.push({from:from,to:to});
    });return result;
  }
  function legalMoves(state,s){var out=[];state.forEach(function(p,i){if(side(p)===s)out=out.concat(movesFrom(state,i));});return out;}
  function apply(state,m){var next=state.slice();next[m.to]=next[m.from];next[m.from]=0;return next;}
  function hash(state,s){return state.join(',')+':'+s;}
  function outcome(state,nextTurn,noncapture,repetitions){
    if(side(state[3])===1)return 1;if(side(state[59])===2)return 2;
    if(!legalMoves(state,nextTurn).length)return 3-nextTurn;
    if(noncapture>=100||repetitions>=3)return 3;return 0;
  }
  function evaluate(state,s){
    var value=0;state.forEach(function(p,i){if(!p)return;var team=side(p),target=team===1?3:59,dist=Math.abs(i%7-target%7)+Math.abs(Math.floor(i/7)-Math.floor(target/7));
      value+=(team===s?1:-1)*(80+Math.abs(p)*35+(12-dist)*7-(rank(p,i)===0?90:0));});return value;
  }
  function chooseAI(state,s,level){
    var options=legalMoves(state,s);if(!options.length)return null;
    if(level==='easy')return options[Math.floor(Math.random()*options.length)];
    var nodes=0,budget=level==='hard'?12000:4000;
    // 限深负极大和剪枝仅用于走法选择，节点预算限制思考开销。
    function search(pos,player,depth,alpha,beta){
      nodes++;var win=outcome(pos,player,0,0);if(win)return win===player?100000+depth: -100000-depth;
      if(!depth||nodes>=budget)return evaluate(pos,player);
      var ms=legalMoves(pos,player);ms.sort(function(a,b){return Math.abs(pos[b.to])-Math.abs(pos[a.to]);});var best=-Infinity;
      for(var i=0;i<ms.length;i++){var v=-search(apply(pos,ms[i]),3-player,depth-1,-beta,-alpha);best=Math.max(best,v);alpha=Math.max(alpha,v);if(alpha>=beta)break;}return best;
    }
    options.sort(function(a,b){return Math.abs(state[b.to])-Math.abs(state[a.to]);});var best=-Infinity,candidates=[];
    options.forEach(function(m){var v=-search(apply(state,m),3-s,level==='hard'?2:1,-Infinity,Infinity);if(v>best){best=v;candidates=[m];}else if(v===best)candidates.push(m);});
    return candidates[Math.floor(Math.random()*candidates.length)];
  }
  function draw(){
    var allowed=selected<0?[]:movesFrom(board,selected).map(function(m){return m.to;});grid.innerHTML='';
    board.forEach(function(p,i){
      var button=document.createElement('button'),target=allowed.indexOf(i)>=0,t=trap(i),d=den(i);
      button.type='button';button.tabIndex=-1;button.dataset.index=i;
      button.className='jungle-cell'+(water(i)?' river':'')+(t?' trap trap-'+t:'')+(d?' den den-'+d:'')+(i===selected?' selected':'')+(i===cursor?' cursor':'')+(target?' legal':'')+(i===last?' last':'');
      var terrain=water(i)?'河流':t?sideName(t)+'陷阱':d?sideName(d)+'兽穴':'陆地';
      button.setAttribute('aria-label',String.fromCharCode(65+i%7)+(Math.floor(i/7)+1)+'，'+terrain+(p?'，'+sideName(side(p))+names[Math.abs(p)]+'，兽阶'+rank(p,i):'，空格')+(target?'，可走':''));
      if(p)button.innerHTML='<span class="animal team-'+side(p)+'"><span>'+names[Math.abs(p)]+'</span><small>'+rank(p,i)+'</small></span>';
      else if(water(i))button.innerHTML='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 19q6-7 12 0t12 0t12 0M6 29q6-7 12 0t12 0t12 0" fill="none" stroke="#739ca7" stroke-width="2" opacity=".5"/></svg>';
      else if(t)button.innerHTML='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 8 16 16-16 16L8 24Z M18 18l12 12m0-12L18 30" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
      else if(d)button.innerHTML='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 38V23L24 9l17 14v15H7Z" fill="currentColor" opacity=".4"/><path d="M18 38V27a6 6 0 0 1 12 0v11" fill="none" stroke="currentColor" stroke-width="3"/></svg>';
      grid.appendChild(button);
    });
    document.getElementById('score-label').textContent='红方剩余';document.getElementById('best-label').textContent='蓝方剩余';
    document.getElementById('score').textContent=board.filter(function(p){return p>0;}).length;document.getElementById('best').textContent=board.filter(function(p){return p<0;}).length;
    document.getElementById('rule-label').textContent='7 × 9 · '+(mode==='ai'?'人机 · '+({easy:'轻松',normal:'标准',hard:'挑战'}[difficulty]||'标准'):'双人对弈')+' · 红方先行';
    document.getElementById('detail').textContent='第 '+(history.length+1)+' 手 · '+sideName(turn)+'行棋 · 连续 '+quiet+' 手未吃子';
    document.getElementById('undo').disabled=!history.length||ended;
    document.querySelectorAll('[data-mode]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
    grid.setAttribute('aria-label','斗兽棋棋盘，'+sideName(turn)+'行棋。方向键选择，回车选子或走棋。');
  }
  // 暂停/重开使旧回调失效；恢复时仅为仍在行棋的电脑重新排队。
  function cancelAI(){if(aiTimer!==null)clearTimeout(aiTimer);aiTimer=null;revision++;}
  function scheduleAI(){if(blocked()||mode!=='ai'||turn!==2||aiTimer!==null)return;var token=revision;
    aiTimer=setTimeout(function(){aiTimer=null;if(token!==revision||blocked()||mode!=='ai'||turn!==2)return;var m=chooseAI(board,turn,difficulty);if(m)move(m,true);},320);}
  function move(m,computer){
    if(blocked()||(mode==='ai'&&(turn===2)!==!!computer)||side(board[m.from])!==turn||!movesFrom(board,m.from).some(function(v){return v.to===m.to;}))return false;
    cancelAI();history.push({board:board.slice(),turn:turn,quiet:quiet,seen:seen.slice(),last:last});
    quiet=board[m.to]?0:quiet+1;board=apply(board,m);turn=3-turn;selected=-1;last=cursor=m.to;seen.push(hash(board,turn));
    var result=outcome(board,turn,quiet,seen.filter(function(h){return h===hash(board,turn);}).length);
    if(result){var text=result===3?'和棋':sideName(result)+'获胜';if(result!==3)save(key+':wins:'+mode+':'+result,String(number('wins:'+mode+':'+result,0)+1));finish(text+'。');document.getElementById('status').dataset.tone='normal';showCover(text,result===3?'局面三次重复或连续100手未吃子。':'已占领敌方兽穴，或对方已无合法走法。','再玩一局');}
    else status(sideName(turn)+(mode==='ai'&&turn===2?'（电脑）思考中。':'行棋，请选择己方棋子。'));
    draw();sound(620);scheduleAI();return true;
  }
  function select(i){if(blocked()||(mode==='ai'&&turn===2))return;
    if(side(board[i])===turn){selected=selected===i?-1:i;cursor=i;status(selected<0?'已取消选子。':sideName(turn)+names[Math.abs(board[i])]+'，兽阶'+rank(board[i],i)+'；选择标记位置走棋。');draw();}
    else if(selected>=0&&!move({from:selected,to:i},false))status('这里不能走，请选择标记的位置。');
  }
  function undo(){if(blocked()||!history.length)return;cancelAI();var prev;do{prev=history.pop();}while(mode==='ai'&&prev.turn!==1&&history.length);
    board=prev.board;turn=prev.turn;quiet=prev.quiet;seen=prev.seen;last=prev.last;selected=-1;draw();status('已悔棋，请重新走棋。');scheduleAI();}
  function restart(){cancelAI();resetState();difficulty=settings.option;board=Array(63).fill(0);
    [[0,-7],[6,-6],[8,-3],[12,-2],[14,-1],[16,-5],[18,-4],[20,-8],[42,8],[44,4],[46,5],[48,1],[50,2],[54,3],[56,6],[62,7]].forEach(function(p){board[p[0]]=p[1];});
    turn=1;history=[];quiet=0;selected=-1;cursor=56;last=-1;seen=[hash(board,turn)];draw();status('红方先行，选择棋子后查看可走位置。');}
  grid.addEventListener('click',function(e){var b=e.target.closest('[data-index]');if(b){select(Number(b.dataset.index));grid.focus();}});
  grid.addEventListener('keydown',function(e){if(blocked()||e.ctrlKey||e.altKey||e.metaKey||e.isComposing)return;
    var ds={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(ds[e.key]){e.preventDefault();var n=cursor+ds[e.key];if(n>=0&&n<63&&(Math.abs(ds[e.key])!==1||Math.floor(n/7)===Math.floor(cursor/7)))cursor=n;draw();}
    else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)select(cursor);}else if(e.key==='Escape'){selected=-1;draw();}});
  document.querySelectorAll('[data-mode]').forEach(function(b){b.addEventListener('click',function(){if(mode===b.dataset.mode)return;mode=b.dataset.mode==='local'?'local':'ai';save(key+':mode',mode);restart();ready=true;showCover('准备好了吗？','模式已切换，红方先行。','开始游戏');syncStart();});});
  onPause=cancelAI;onResume=scheduleAI;onOption=function(){status('难度已保存，下一局生效。');};
  document.getElementById('undo').addEventListener('click',undo);document.getElementById('restart').addEventListener('click',restart);restart();
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


