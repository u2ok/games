/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:xiangqi';
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
  /* 棋子编码：红方大写、黑方小写，K将帅/A士仕/E象相/H马/R车/C炮/P卒兵。 */
  var board = [];
  var turn = 'red';
  var mode = read(key+':mode') === 'local' ? 'local' : 'ai';
  var variant=read(key+':variant')==='dark'?'dark':'classic';
  document.getElementById('variant').value=variant;
  var darkBoard=[],darkOpen=[],darkColors=[null,null],darkTurn=0,darkTaken=[],darkLast=null,darkQuiet=0,darkRepeats={};
  var difficulty = settings.option;
  var selected = -1;
  var cursor = 76;
  var history = [];
  var lastMove = null;
  var quietMoves = 0;
  var repetitions = {};
  var aiTimer = null;
  var redWins = number('wins:'+mode+':red',0);
  var blackWins = number('wins:'+mode+':black',0);
  var canvas = document.getElementById('canvas');
  var context = canvas.getContext('2d');
  var labels = { K:'帅',A:'仕',E:'相',H:'马',R:'车',C:'炮',P:'兵',k:'将',a:'士',e:'象',h:'马',r:'车',c:'炮',p:'卒' };
  var values = {K:100000,R:900,C:450,H:400,E:200,A:200,P:100};
  function side(piece) { return !piece ? null : piece === piece.toUpperCase() ? 'red' : 'black'; }
  function other(color) { return color==='red'?'black':'red'; }
  function inside(row,col) { return row>=0&&row<10&&col>=0&&col<9; }
  function palace(row,col,color) { return col>=3&&col<=5&&(color==='red'?row>=7&&row<=9:row>=0&&row<=2); }
  function between(position,from,to) {
    var fr=Math.floor(from/9),fc=from%9,tr=Math.floor(to/9),tc=to%9;
    if(fr!==tr&&fc!==tc)return -1;
    var step=fr===tr?(tc>fc?1:-1):(tr>fr?9:-9);var count=0;
    for(var p=from+step;p!==to;p+=step)if(position[p])count+=1;
    return count;
  }
  function pseudo(position,from,to) {
    if(from===to||from<0||to<0||from>=90||to>=90||!position[from])return false;
    var piece=position[from],color=side(piece),target=position[to];
    if(side(target)===color)return false;
    var fr=Math.floor(from/9),fc=from%9,tr=Math.floor(to/9),tc=to%9;
    var dr=tr-fr,dc=tc-fc,ar=Math.abs(dr),ac=Math.abs(dc),type=piece.toUpperCase();
    if(type==='K') {
      if(target&&target.toUpperCase()==='K'&&fc===tc&&between(position,from,to)===0)return true;
      return ar+ac===1&&palace(tr,tc,color);
    }
    if(type==='A')return ar===1&&ac===1&&palace(tr,tc,color);
    if(type==='E')return ar===2&&ac===2&&(color==='red'?tr>=5:tr<=4)&&!position[(fr+dr/2)*9+fc+dc/2];
    if(type==='H') {
      if(ar===2&&ac===1)return !position[(fr+Math.sign(dr))*9+fc];
      if(ar===1&&ac===2)return !position[fr*9+fc+Math.sign(dc)];
      return false;
    }
    if(type==='R')return (fr===tr||fc===tc)&&between(position,from,to)===0;
    if(type==='C')return (fr===tr||fc===tc)&&between(position,from,to)===(target?1:0);
    if(type==='P') {
      var forward=color==='red'?-1:1;
      if(dr===forward&&dc===0)return true;
      return dr===0&&ac===1&&(color==='red'?fr<=4:fr>=5);
    }
    return false;
  }
  function inCheck(position,color) {
    var king=position.indexOf(color==='red'?'K':'k');
    if(king===-1)return true;
    for(var i=0;i<90;i++)if(side(position[i])===other(color)&&pseudo(position,i,king))return true;
    return false;
  }
  function moved(position,from,to) { var next=position.slice();next[to]=next[from];next[from]=null;return next; }
  function legal(position,from,to,color) { return side(position[from])===color&&pseudo(position,from,to)&&!inCheck(moved(position,from,to),color); }
  function moves(position,color) {
    var result=[];
    // 按棋子几何生成候选，仍用同一legal校验马腿/炮架/将帅安全。
    for(var from=0;from<90;from++)if(side(position[from])===color){
      var piece=position[from].toUpperCase(),row=Math.floor(from/9),col=from%9,dest=[];
      function add(r,c){if(inside(r,c))dest.push(r*9+c);}
      if(piece==='R'||piece==='C'||piece==='K'){
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){for(var k=1;k<10;k++){var r=row+d[0]*k,c=col+d[1]*k;if(!inside(r,c))break;add(r,c);}});
      }else if(piece==='H')[[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(function(d){add(row+d[0],col+d[1]);});
      else if(piece==='E'||piece==='A'){var step=piece==='E'?2:1;[[-1,-1],[-1,1],[1,-1],[1,1]].forEach(function(d){add(row+d[0]*step,col+d[1]*step);});}
      else if(piece==='P'){add(row+(color==='red'?-1:1),col);add(row,col-1);add(row,col+1);}
      dest.forEach(function(to){if(legal(position,from,to,color))result.push({from:from,to:to});});
    }
    return result;
  }
  function signature() { return board.map(function(p){return p||'.';}).join('')+turn; }
  function cancelAI() { if(aiTimer!==null){clearTimeout(aiTimer);aiTimer=null;} }
  function update() {
    if(variant==='dark'){darkUpdate();return;}
    updateScore(redWins,blackWins);
    document.getElementById('score-label').textContent=mode==='ai'?'我方胜局':'红方胜局';
    document.getElementById('best-label').textContent=mode==='ai'?'电脑胜局':'黑方胜局';
    document.getElementById('rule-label').textContent=(mode==='ai'?'人机 · 执红先行':'双人 · 红方先行')+' · '+(turn==='red'?'红方':'黑方')+'行棋';
    document.getElementById('detail').textContent='已走 '+history.length+' 手'+(!ended&&inCheck(board,turn)?' · 将军！':'');
    document.getElementById('undo').disabled=history.length===0||ready||paused||ended;
    document.querySelectorAll('[data-mode]').forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.mode===mode));});
    canvas.setAttribute('aria-label','中国象棋棋盘，'+(turn==='red'?'红方':'黑方')+'行棋。方向键选择位置，回车选子或走棋。');
  }
  function gameResult(winner,note) {
    cancelAI();
    if(variant==='dark'){darkResult(winner,note);return;}
    if(winner==='red')redWins+=1;
    if(winner==='black')blackWins+=1;
    if(winner){save(key+':wins:'+mode+':red',String(redWins));save(key+':wins:'+mode+':black',String(blackWins));}
    finish(note);document.getElementById('status').dataset.tone='normal';showCover(winner?(winner==='red'?'红方获胜':'黑方获胜'):'和棋',note,'再下一局');update();draw();
  }
  function play(from,to) {
    if(blocked()||!legal(board,from,to,turn))return false;
    cancelAI();
    history.push({board:board.slice(),turn:turn,lastMove:lastMove,quietMoves:quietMoves,repetitions:Object.assign({},repetitions)});
    var captured=board[to];
    board=moved(board,from,to);lastMove={from:from,to:to};quietMoves=captured?0:quietMoves+1;selected=-1;cursor=to;
    var mover=turn;turn=other(turn);sound(captured?420:620);
    if(!board.some(function(p){return p&&(p===(turn==='red'?'K':'k'));})){gameResult(mover,'对方将帅被吃。');return true;}
    var available=moves(board,turn);
    if(!available.length){gameResult(mover,inCheck(board,turn)?'将死，对方无合法应将。':'困毙，对方无合法着法。');return true;}
    var code=signature();repetitions[code]=(repetitions[code]||0)+1;
    // 休闲版简化和棋，不实现比赛规则中的长将、长捉责任裁定。
    if(repetitions[code]>=3||quietMoves>=120){gameResult(null,repetitions[code]>=3?'同一局面出现三次，判和。':'连续120手无吃子，判和。');return true;}
    update();draw();status(inCheck(board,turn)?'将军！请先解除将军。':(turn==='red'?'红方':'黑方')+'行棋。');scheduleAI();return true;
  }
  function evaluate(position,color) {
    var material=position.reduce(function(v,p){return v+(p&&/^[RHCrhc]$/.test(p)?values[p.toUpperCase()]:0);},0);
    return position.reduce(function(total,p,index){
      if(!p)return total;
      var type=p.toUpperCase(),own=side(p),row=Math.floor(index/9),col=index%9;
      var advance=own==='red'?9-row:row,central=4-Math.abs(col-4),value=values[type];
      if(type==='P')value+=advance*9+(advance>=5?50+central*7:0)+(material<1600?advance*5:0);
      if(type==='H'){
        value+=central*8+Math.min(advance,6)*4;
        [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(function(d){if(inside(row+d[0],col+d[1])&&pseudo(position,index,(row+d[0])*9+col+d[1]))value+=3;});
      }
      if(type==='R'||type==='C'){
        value+=central*(type==='C'?4:2);
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var open=0;for(var k=1;k<10;k++){var r=row+d[0]*k,c=col+d[1]*k;if(!inside(r,c)||position[r*9+c])break;open++;}value+=Math.min(open,6)*(type==='R'?3:1);});
      }
      if(type==='K'){
        value-=Math.abs(col-4)*12;
        for(var i=0;i<90;i++)if(side(position[i])===own&&/^[AEae]$/.test(position[i]))value+=material>2000?8:3;
      }
      return total+(own===color?value:-value);
    },0);
  }
  var searchBudget=null,searchInterrupted={},transpositions=null,killers=[],searchPath=[];
  function visit(){if(searchBudget){searchBudget.nodes++;if(searchBudget.nodes>searchBudget.limit||Date.now()>searchBudget.deadline)throw searchInterrupted;}}
  function positionCode(position,color){return position.map(function(p){return p||'.';}).join('')+color;}
  function ordered(position,color,preferred,ply){
    var list=moves(position,color);
    function priority(m){var capture=position[m.to],p=position[m.from];return preferred&&m.from===preferred.from&&m.to===preferred.to?10000000:capture?100000+values[capture.toUpperCase()]*10-values[p.toUpperCase()]:killers[ply]&&killers[ply].from===m.from&&killers[ply].to===m.to?50000:0;}
    return list.sort(function(a,b){return priority(b)-priority(a);});
  }
  // 静态搜索延长吃子交换；被将军时必须应将，不把尚未化解的将军当静态局面。
  function quietSearch(position,color,alpha,beta,remaining,ply){
    visit();
    if(position.indexOf(color==='red'?'K':'k')<0)return -1000000+ply;
    if(position.indexOf(color==='red'?'k':'K')<0)return 1000000-ply;
    var checked=inCheck(position,color),options=ordered(position,color,null,ply);
    if(!options.length)return -1000000+ply;
    var stand=evaluate(position,color);
    if(remaining<=0)return stand-(checked?80:0);
    if(!checked){if(stand>=beta)return stand;alpha=Math.max(alpha,stand);options=options.filter(function(m){return !!position[m.to];});}
    for(var i=0;i<options.length;i++){var m=options[i],value=-quietSearch(moved(position,m.from,m.to),other(color),-beta,-alpha,remaining-1,ply+1);if(value>=beta)return value;alpha=Math.max(alpha,value);}
    return alpha;
  }
  function search(position,color,depth,alpha,beta,ply){
    ply=ply||0;visit();
    if(position.indexOf(color==='red'?'K':'k')<0)return -1000000+ply;
    if(position.indexOf(color==='red'?'k':'K')<0)return 1000000-ply;
    var code=positionCode(position,color);
    if(searchPath.indexOf(code)>=0)return 0;
    if(depth<=0)return quietSearch(position,color,alpha,beta,3,ply);
    var cached=transpositions&&transpositions.get(code),originalAlpha=alpha;
    if(cached&&cached.depth>=depth&&Math.abs(cached.value)<900000){if(cached.flag==='exact')return cached.value;if(cached.flag==='lower')alpha=Math.max(alpha,cached.value);else beta=Math.min(beta,cached.value);if(alpha>=beta)return cached.value;}
    var options=ordered(position,color,cached&&cached.move,ply);if(!options.length)return -1000000+ply;
    var best=-Infinity,bestMove=options[0];searchPath.push(code);
    try{for(var i=0;i<options.length;i++){var m=options[i],value=-search(moved(position,m.from,m.to),other(color),depth-1,-beta,-alpha,ply+1);if(value>best){best=value;bestMove=m;}alpha=Math.max(alpha,value);if(alpha>=beta){if(!position[m.to])killers[ply]=m;break;}}}finally{searchPath.pop();}
    if(transpositions&&transpositions.size<16000&&Math.abs(best)<900000)transpositions.set(code,{depth:depth,value:best,move:bestMove,flag:best<=originalAlpha?'upper':best>=beta?'lower':'exact'});
    return best;
  }
  // 只在接近当前最佳评价的候选中变化，避免为了随机而故意送掉大子。
  // roll 参数仅供规则测试注入随机值；真实对局使用 Math.random。
  function chooseNear(scored,windowSize,roll) {
    var best=Math.max.apply(null,scored.map(function(item){return item.value;}));
    var candidates=scored.filter(function(item){return item.value>=best-windowSize;});
    var random=roll===undefined?Math.random():roll;
    return candidates[Math.min(candidates.length-1,Math.floor(random*candidates.length))].move;
  }
  function chooseAI() {
    var options=ordered(board,'black');
    if(!options.length)return null;
    var config=({easy:{depth:2,time:180,nodes:4000,range:40},normal:{depth:3,time:450,nodes:16000,range:18},hard:{depth:4,time:850,nodes:36000,range:8}}[difficulty]);
    var scored=options.map(function(m){return {move:m,value:evaluate(moved(board,m.from,m.to),'black')};});
    // 先完整计算一层，后续使用迭代加深；超时则保留上一次完整结果，
    // 不混用深浅不同的分数，以免偏爱较早遍历到的走法。
    transpositions=new Map();killers=[];searchPath=[];searchBudget={nodes:0,limit:config.nodes,deadline:Date.now()+config.time};
    try {
      for(var depth=1;depth<=config.depth;depth++){
        options.sort(function(a,b){var av=scored.find(function(v){return v.move.from===a.from&&v.move.to===a.to;}).value,bv=scored.find(function(v){return v.move.from===b.from&&v.move.to===b.to;}).value;return bv-av;});var iteration=[];
        for(var i=0;i<options.length;i++){
          var m=options[i],next=moved(board,m.from,m.to);
          var value=-search(next,'red',depth-1,-Infinity,Infinity,1);
          // 根节点明确检查将死与困毙，优先选择能够直接获胜的走法。
          if(next.indexOf('K')===-1||!moves(next,'red').length)value=1000000;
          var repetition=next.map(function(p){return p||'.';}).join('')+'red';
          if(value<900000)value-=Math.min(120,(repetitions[repetition]||0)*45);
          iteration.push({move:m,value:value});
        }
        scored=iteration;
        if(Math.max.apply(null,scored.map(function(item){return item.value;}))>=900000)break;
      }
    } catch(error){if(error!==searchInterrupted)throw error;}
    finally { searchBudget=null;transpositions=null;killers=[];searchPath=[]; }
    return chooseNear(scored,config.range);
  }
  function scheduleAI() {
    cancelAI();
    if(variant==='dark'){darkSchedule();return;}
    if(mode!=='ai'||turn!=='black'||blocked())return;
    status('电脑正在思考……');
    aiTimer=setTimeout(function(){aiTimer=null;if(blocked()||turn!=='black'||mode!=='ai')return;var move=chooseAI();if(move)play(move.from,move.to);},280);
  }
  // 翻棋与明棋共用公共界面、暂停和计时入口，棋盘/历史/规则各自隔离。
  var darkRanks={K:7,A:6,E:5,R:4,H:3,C:2,P:1};
  function darkPublic(){return darkBoard.map(function(p,i){return p?(darkOpen[i]?p:'?'):null;});}
  function darkCan(position,from,to,color){
    if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>=32||to<0||to>=32)return false;
    var p=position[from],target=position[to];if(!p||p==='?'||side(p)!==color||target==='?'||side(target)===color||from===to)return false;
    var fr=Math.floor(from/8),fc=from%8,tr=Math.floor(to/8),tc=to%8,adj=Math.abs(fr-tr)+Math.abs(fc-tc)===1;
    if(!target)return adj;
    var type=p.toUpperCase(),victim=target.toUpperCase();
    if(type==='C'){
      if(fr!==tr&&fc!==tc)return false;var d=fr===tr?(to>from?1:-1):(to>from?8:-8),screens=0;
      for(var i=from+d;i!==to;i+=d)if(position[i])screens++;return screens===1;
    }
    return adj&&(type==='P'&&victim==='K'||!(type==='K'&&victim==='P')&&darkRanks[type]>=darkRanks[victim]);
  }
  function darkMoves(position,color){var out=[];for(var i=0;i<32;i++)if(position[i]&&position[i]!=='?'&&side(position[i])===color)for(var j=0;j<32;j++)if(darkCan(position,i,j,color))out.push({from:i,to:j});return out;}
  function darkCode(){return darkPublic().map(function(p){return p||'.';}).join('')+darkTurn;}
  function darkName(seat){return mode==='ai'?(seat===0?'你':'电脑'):(seat===0?'玩家一':'玩家二');}
  function darkColorName(seat){return darkColors[seat]==='red'?'红方':darkColors[seat]==='black'?'黑方':'待定色';}
  function darkUpdate(){
    updateScore(redWins,blackWins);document.getElementById('score-label').textContent=mode==='ai'?'我方胜局':'玩家一胜局';document.getElementById('best-label').textContent=mode==='ai'?'电脑胜局':'玩家二胜局';
    document.getElementById('rule-label').textContent='翻棋 · '+darkName(0)+' '+darkColorName(0)+' / '+darkName(1)+' '+darkColorName(1);
    document.getElementById('detail').textContent='第 '+(history.length+1)+' 手 · '+darkName(darkTurn)+'行动 · 暗子 '+darkOpen.filter(function(v,i){return darkBoard[i]&&!v;}).length;
    document.getElementById('undo').disabled=!history.length||blocked();
    document.querySelectorAll('[data-mode]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
    var p=darkPublic()[cursor];canvas.setAttribute('aria-label','翻棋棋盘，第'+(Math.floor(cursor/8)+1)+'行第'+(cursor%8+1)+'列，'+(p==='?'?'暗子':p?labels[p]:'空位')+'。'+darkName(darkTurn)+'行动。');
  }
  function darkResult(winner,note){
    if(winner==='red')redWins++;if(winner==='black')blackWins++;
    if(winner){save(key+':wins:dark:'+mode+':red',String(redWins));save(key+':wins:dark:'+mode+':black',String(blackWins));}
    finish(note);showCover(winner?(winner==='red'?darkName(0):darkName(1))+'获胜':'和棋',note,'再下一局');darkUpdate();darkDraw();
  }
  function darkSnapshot(){return {board:darkBoard.slice(),open:darkOpen.slice(),colors:darkColors.slice(),turn:darkTurn,taken:darkTaken.slice(),last:darkLast,quiet:darkQuiet,repeats:Object.assign({},darkRepeats)};}
  function darkAct(action){
    if(blocked())return false;var p=darkPublic(),seat=darkTurn,flipping=action.flip!==undefined,captured=null;
    if(flipping){if(!Number.isInteger(action.flip)||action.flip<0||action.flip>=32||!darkBoard[action.flip]||darkOpen[action.flip])return false;}
    else if(!darkColors[seat]||!darkCan(p,action.from,action.to,darkColors[seat]))return false;
    cancelAI();history.push(darkSnapshot());
    if(flipping){var i=action.flip;darkOpen[i]=true;if(!darkColors[0]){darkColors[seat]=side(darkBoard[i]);darkColors[1-seat]=other(darkColors[seat]);}cursor=i;darkLast={from:i,to:i,flip:true};darkQuiet=0;}
    else{captured=darkBoard[action.to];if(captured)darkTaken.push(captured);darkBoard[action.to]=darkBoard[action.from];darkOpen[action.to]=true;darkBoard[action.from]=null;darkOpen[action.from]=false;cursor=action.to;darkLast={from:action.from,to:action.to,flip:false};darkQuiet=captured?0:darkQuiet+1;}
    selected=-1;darkTurn=1-seat;sound(captured?420:620);
    var enemy=darkColors[darkTurn];
    // 尚有暗子时仍可翻棋，不能因当前明子无走法而提前判负。
    if(!darkBoard.some(function(v){return v&&side(v)===enemy;})||!darkPublic().includes('?')&&!darkMoves(darkPublic(),enemy).length){gameResult(seat===0?'red':'black',darkName(darkTurn)+'已无可用棋子或合法走法。');return true;}
    var code=darkCode();darkRepeats[code]=(darkRepeats[code]||0)+1;
    if(darkRepeats[code]>=3||darkQuiet>=80){gameResult(null,darkQuiet>=80?'80手未吃子或翻子，判和。':'相同局面出现三次，判和。');return true;}
    darkUpdate();darkDraw();status(flipping?'已翻出'+labels[darkBoard[cursor]]+'。'+darkName(darkTurn)+'（'+darkColorName(darkTurn)+'）行动。':captured?'吃掉'+labels[captured]+'。'+darkName(darkTurn)+'行动。':darkName(darkTurn)+'行动。');scheduleAI();return true;
  }
  function darkSelect(index){
    if(blocked()||index<0||index>=32||mode==='ai'&&darkTurn===1)return;cursor=index;
    if(darkBoard[index]&&!darkOpen[index]){darkAct({flip:index});return;}
    if(darkBoard[index]&&side(darkBoard[index])===darkColors[darkTurn]){selected=selected===index?-1:index;darkUpdate();darkDraw();return;}
    if(selected>=0){if(!darkAct({from:selected,to:index})){status('此步不能走：相邻移动或按等级吃子；炮吃子须隔一子，暗子需先翻开。');darkDraw();}}else{darkUpdate();darkDraw();}
  }
  function darkValue(p){return ({K:700,A:600,E:500,R:400,H:300,C:450,P:180})[p.toUpperCase()];}
  function darkEvaluate(position,color){var total=0;position.forEach(function(p,i){if(!p||p==='?')return;var value=darkValue(p)+(3.5-Math.abs(i%8-3.5))*3;total+=side(p)===color?value:-value;});return total;}
  // 电脑只接收公开棋盘，暗子全部为?；搜索从不读取其真实身份。
  function darkChoose(publicBoard,color,level){
    var options=darkMoves(publicBoard,color),hidden=[];publicBoard.forEach(function(p,i){if(p==='?')hidden.push(i);});
    if(!color)return hidden.length?{flip:hidden[Math.floor(Math.random()*hidden.length)]}:null;
    var budget=level==='hard'?220:level==='normal'?120:60,deadline=Date.now()+budget,nodes=0,limit=level==='hard'?3500:level==='normal'?1800:600,stop={};
    function future(position,who,depth,alpha,beta){if(++nodes>limit||Date.now()>deadline)throw stop;var ms=darkMoves(position,who);if(!ms.length)return position.includes('?')?darkEvaluate(position,who):-50000;var stand=darkEvaluate(position,who);if(!depth)return stand;var best=position.includes('?')?stand:-Infinity;ms.sort(function(a,b){return (position[b.to]?darkValue(position[b.to]):0)-(position[a.to]?darkValue(position[a.to]):0);});for(var i=0;i<ms.length;i++){var m=ms[i],next=position.slice();next[m.to]=next[m.from];next[m.from]=null;best=Math.max(best,-future(next,other(who),depth-1,-beta,-alpha));alpha=Math.max(alpha,best);if(alpha>=beta)break;}return best;}
    var depth=level==='hard'?3:level==='normal'?2:1;
    function scoreMove(m,d){var next=publicBoard.slice();next[m.to]=next[m.from];next[m.from]=null;var value=d?-future(next,other(color),d-1,-Infinity,Infinity):darkEvaluate(next,color);var code=next.map(function(p){return p||'.';}).join('')+(1-darkTurn);value-=Math.min(90,(darkRepeats[code]||0)*45);return {action:m,value:value};}
    var scored=options.map(function(m){return scoreMove(m,0);});
    try{for(var d=1;d<=depth;d++){var iteration=options.map(function(m){return scoreMove(m,d);});scored=iteration;}}catch(e){if(e!==stop)throw e;}
    // 翻子按公开邻域的安全性选位，不按隐藏子力挑选。
    hidden.forEach(function(i){var threat=0;[i%8?i-1:-1,i%8<7?i+1:-1,i-8,i+8].forEach(function(j){if(j>=0&&j<32&&publicBoard[j]&&publicBoard[j]!=='?')threat+=side(publicBoard[j])===color?8:-15;});scored.push({action:{flip:i},value:darkEvaluate(publicBoard,color)+12+threat});});
    if(!scored.length)return null;var best=Math.max.apply(null,scored.map(function(v){return v.value;})),range=level==='easy'?45:level==='normal'?16:8,candidates=scored.filter(function(v){return v.value>=best-range;});return candidates[Math.floor(Math.random()*candidates.length)].action;
  }
  function darkSchedule(){if(mode!=='ai'||darkTurn!==1||blocked())return;status('电脑正在观察明子与暗子位置……');aiTimer=setTimeout(function(){aiTimer=null;if(blocked()||variant!=='dark'||mode!=='ai'||darkTurn!==1)return;var m=darkChoose(darkPublic(),darkColors[1],difficulty);if(m)darkAct(m);},300);}
  function darkUndo(){if(blocked()||!history.length)return;cancelAI();var count=mode==='ai'&&darkTurn===0?2:1,state;while(count--&&history.length)state=history.pop();darkBoard=state.board;darkOpen=state.open;darkColors=state.colors;darkTurn=state.turn;darkTaken=state.taken;darkLast=state.last;darkQuiet=state.quiet;darkRepeats=state.repeats;selected=-1;cursor=0;darkUpdate();darkDraw();status('已悔棋，翻开状态与定色一并恢复。');scheduleAI();}
  function darkRestart(){cancelAI();resetState();difficulty=settings.option;var pieces='KAAEEHHRRCCPPPPP';darkBoard=(pieces+pieces.toLowerCase()).split('');for(var i=31;i>0;i--){var j=Math.floor(Math.random()*(i+1)),p=darkBoard[i];darkBoard[i]=darkBoard[j];darkBoard[j]=p;}darkOpen=Array(32).fill(false);darkColors=[null,null];darkTurn=0;darkTaken=[];darkLast=null;darkQuiet=0;darkRepeats={};selected=-1;cursor=0;history=[];redWins=number('wins:dark:'+mode+':red',0);blackWins=number('wins:dark:'+mode+':black',0);darkRepeats[darkCode()]=1;darkUpdate();darkDraw();status('先翻任意一枚暗子，首枚颜色属于'+darkName(0)+'；每回合翻子或走子一次。');}
  function darkKey(e){var row=Math.floor(cursor/8),col=cursor%8;if(e.key==='ArrowUp')row=Math.max(0,row-1);else if(e.key==='ArrowDown')row=Math.min(3,row+1);else if(e.key==='ArrowLeft')col=Math.max(0,col-1);else if(e.key==='ArrowRight')col=Math.min(7,col+1);else if(e.key==='Enter'||e.code==='Space'||e.key===' '){e.preventDefault();darkSelect(cursor);return;}else return;e.preventDefault();cursor=row*8+col;darkUpdate();darkDraw();}
  // 两种玩法共用物件绘制：同一木框、棋面、字体、轮廓和交互标记。
  function woodBoard(x,y,w,h,inset){
    context.fillStyle='#936d46';context.fillRect(x,y,w,h);
    context.fillStyle='#b28b5c';context.fillRect(x+4,y+4,w-8,h-8);
    context.fillStyle='#efdcb6';context.fillRect(x+inset,y+inset,w-inset*2,h-inset*2);
    context.strokeStyle='#9f774810';context.lineWidth=1;
    for(var grain=0;grain<Math.floor((h-inset*2)/11);grain++){var gy=y+inset+6+grain*11;context.beginPath();context.moveTo(x+inset+2,gy);context.bezierCurveTo(x+w*.33,gy+Math.sin(grain)*4,x+w*.67,gy-3,x+w-inset-2,gy+1);context.stroke();}
  }
  function drawPiece(p,x,y,covered){
    context.save();context.textAlign='center';context.textBaseline='middle';
    context.shadowColor='#593b2c50';context.shadowBlur=4;context.shadowOffsetY=3;
    context.fillStyle='#b68e55';context.beginPath();context.arc(x,y+1,24,0,Math.PI*2);context.fill();
    context.shadowColor='transparent';context.shadowBlur=0;context.shadowOffsetY=0;
    context.fillStyle=covered?'#d7b681':'#fff0ce';context.beginPath();context.arc(x,y-1,22,0,Math.PI*2);context.fill();
    context.strokeStyle=covered?'#87653e':side(p)==='red'?'#a33e32':'#314238';context.lineWidth=1.5;context.stroke();
    context.strokeStyle=covered?'#a17d4d':side(p)==='red'?'#bf766255':'#52664c55';context.lineWidth=.8;context.beginPath();context.arc(x,y-1,18.5,0,Math.PI*2);context.stroke();
    if(covered){
      // 棋背为统一雕纹，不读取棋子身份或颜色。
      context.strokeStyle='#8e6c3f';context.lineWidth=1.5;context.beginPath();context.moveTo(x,y-12);context.lineTo(x+11,y-1);context.lineTo(x,y+10);context.lineTo(x-11,y-1);context.closePath();context.stroke();
      context.beginPath();context.moveTo(x-5,y-1);context.lineTo(x+5,y-1);context.moveTo(x,y-6);context.lineTo(x,y+4);context.stroke();
    }else{context.fillStyle=side(p)==='red'?'#a33e32':'#24352d';context.font='bold 29px "KaiTi","STKaiti","Microsoft YaHei",serif';context.fillText(labels[p],x,y);}
    context.restore();
  }
  function pieceMark(x,y,kind){
    context.save();
    if(kind==='empty'){context.fillStyle='#245c4aa0';context.beginPath();context.arc(x,y,6,0,Math.PI*2);context.fill();}
    else if(kind==='cursor'){context.strokeStyle='#a47734';context.lineWidth=2;context.setLineDash([3,3]);context.strokeRect(x-26,y-26,52,52);}
    else{context.strokeStyle=kind==='selected'?'#245c4a':'#b33b30';context.lineWidth=3;if(kind==='capture')context.setLineDash([5,4]);context.beginPath();context.arc(x,y,26,0,Math.PI*2);context.stroke();}
    context.restore();
  }
  function moveTrace(from,to){
    context.save();context.strokeStyle='#b18a45';context.lineWidth=2;context.setLineDash([4,4]);context.beginPath();context.moveTo(from.x,from.y);context.lineTo(to.x,to.y);context.stroke();
    [from,to].forEach(function(p){context.fillStyle='#c1944528';context.fillRect(p.x-25,p.y-25,50,50);});context.restore();
  }
  function darkDraw(){
    context.clearRect(0,0,520,600);context.fillStyle='#f6f3ec';context.fillRect(0,0,520,600);context.textAlign='center';context.textBaseline='middle';context.fillStyle='#85613a';context.font='600 24px system-ui';context.fillText('翻棋 · 随机定色',260,45);
    context.font='14px system-ui';context.fillStyle='#64718a';context.fillText(darkColors[0]?darkName(0)+'执'+darkColorName(0)+' · '+darkName(1)+'执'+darkColorName(1):'先翻一子定颜色，每回合翻子或走子一次',260,80);
    woodBoard(27,161,466,242,9);
    context.strokeStyle='#8d653e';context.lineWidth=2.5;context.strokeRect(35,169,450,226);
    var targets=selected>=0?darkMoves(darkPublic(),darkColors[darkTurn]).filter(function(m){return m.from===selected;}).map(function(m){return m.to;}):[];
    function center(i){return {x:64+i%8*56,y:198+Math.floor(i/8)*56};}
    for(var row=0;row<=4;row++){context.strokeStyle='#87683f';context.lineWidth=1.2;context.beginPath();context.moveTo(36,170+row*56);context.lineTo(484,170+row*56);context.stroke();}
    for(var col=0;col<=8;col++){context.beginPath();context.moveTo(36+col*56,170);context.lineTo(36+col*56,394);context.stroke();}
    if(darkLast)moveTrace(center(darkLast.from),center(darkLast.to));
    for(var i=0;i<32;i++){var pos=center(i),p=darkBoard[i];
      if(p)drawPiece(darkOpen[i]?p:null,pos.x,pos.y,!darkOpen[i]);
      if(i===selected)pieceMark(pos.x,pos.y,'selected');
      if(targets.includes(i))pieceMark(pos.x,pos.y,p?'capture':'empty');
      if(document.activeElement===canvas&&i===cursor)pieceMark(pos.x,pos.y,'cursor');
    }
    context.fillStyle='#85613a';context.font='600 16px system-ui';context.fillText(darkName(darkTurn)+'（'+darkColorName(darkTurn)+'）行动',260,126);
    context.font='14px system-ui';context.fillStyle='#64718a';context.fillText('将 > 士 > 象 > 车 > 马 > 炮 > 兵',260,448);context.fillText('兵能吃将 · 将不能吃兵 · 炮隔一子吃明子',260,480);context.fillText('暗子先翻开 · 相邻走一格 · 无将军限制',260,511);context.fillText('已吃 '+darkTaken.length+' 子 · 已走 '+history.length+' 手',260,554);
  }
  function select(index) {
    if(variant==='dark'){darkSelect(index);return;}
    if(blocked()||(mode==='ai'&&turn==='black'))return;
    cursor=index;
    if(side(board[index])===turn){selected=index;draw();return;}
    if(selected!==-1&&!play(selected,index))status('该步不合法，注意蹩马腿、塞象眼、炮架与将军。');
  }
  function undo() {
    if(variant==='dark'){darkUndo();return;}
    if(blocked()||!history.length)return;
    cancelAI();var count=mode==='ai'&&turn==='red'?2:1;
    var state;
    while(count--&&history.length)state=history.pop();
    board=state.board;turn=state.turn;lastMove=state.lastMove;quietMoves=state.quietMoves;repetitions=state.repetitions;selected=-1;
    update();draw();status('已悔棋。');scheduleAI();
  }
  function draw() {
    if(variant==='dark'){darkDraw();return;}
    // 裁去旧方形画布左右冗余，保留原等距坐标；不缩放棋子或网格。
    context.save();context.translate(-40,0);
    // 统一棋盘坐标保持不变，视觉升级不会改变点击落点与键盘位置。
    var step=54,x0=84,y0=57;
    context.fillStyle='#f6f3ec';context.fillRect(0,0,600,600);
    woodBoard(46,16,508,568,18);
    context.strokeStyle='#8d653e';context.lineWidth=2.5;context.strokeRect(77,50,446,500);
    context.strokeStyle='#87683f';context.lineWidth=1.2;
    for(var r=0;r<10;r++){context.beginPath();context.moveTo(x0,y0+r*step);context.lineTo(x0+8*step,y0+r*step);context.stroke();}
    for(var c=0;c<9;c++){
      context.beginPath();context.moveTo(x0+c*step,y0);
      if(c===0||c===8)context.lineTo(x0+c*step,y0+9*step);
      else {context.lineTo(x0+c*step,y0+4*step);context.moveTo(x0+c*step,y0+5*step);context.lineTo(x0+c*step,y0+9*step);}
      context.stroke();
    }
    [0,7].forEach(function(row){context.beginPath();context.moveTo(x0+3*step,y0+row*step);context.lineTo(x0+5*step,y0+(row+2)*step);context.moveTo(x0+5*step,y0+row*step);context.lineTo(x0+3*step,y0+(row+2)*step);context.stroke();});
    // 炮位和兵卒位标记，边线处仅绘制朝向棋盘内部的一侧。
    [19,25,27,29,31,33,35,54,56,58,60,62,64,70].forEach(function(index){
      var col=index%9,x=x0+col*step,y=y0+Math.floor(index/9)*step;
      [-1,1].forEach(function(dx){if((dx<0&&col===0)||(dx>0&&col===8))return;[-1,1].forEach(function(dy){context.beginPath();context.moveTo(x+dx*5,y+dy*12);context.lineTo(x+dx*5,y+dy*5);context.lineTo(x+dx*12,y+dy*5);context.stroke();});});
    });
    context.fillStyle='#85613a';context.font='26px "KaiTi","STKaiti",serif';context.textAlign='center';context.textBaseline='middle';context.fillText('楚 河',192,300);context.fillText('汉 界',408,300);
    context.font='12px "Microsoft YaHei",sans-serif';
    '１２３４５６７８９'.split('').forEach(function(label,col){context.fillText(label,x0+col*step,29);});
    '九八七六五四三二一'.split('').forEach(function(label,col){context.fillText(label,x0+col*step,571);});
    if(lastMove)moveTrace({x:x0+lastMove.from%9*step,y:y0+Math.floor(lastMove.from/9)*step},{x:x0+lastMove.to%9*step,y:y0+Math.floor(lastMove.to/9)*step});
    var checkedKing=!ended&&inCheck(board,turn)?board.indexOf(turn==='red'?'K':'k'):-1;
    board.forEach(function(p,index){
      if(!p)return;var x=x0+index%9*step,y=y0+Math.floor(index/9)*step;
      drawPiece(p,x,y,false);
      if(index===checkedKing)pieceMark(x,y,'check');
    });
    if(selected!==-1){
      pieceMark(x0+selected%9*step,y0+Math.floor(selected/9)*step,'selected');
      for(var to=0;to<90;to++)if(legal(board,selected,to,turn))pieceMark(x0+to%9*step,y0+Math.floor(to/9)*step,board[to]?'capture':'empty');
    }
    if(document.activeElement===canvas)pieceMark(x0+cursor%9*step,y0+Math.floor(cursor/9)*step,'cursor');
    context.restore();
  }
  function restart() {
    variant=read(key+':variant')==='dark'?'dark':'classic';
    cancelAI();
    if(variant==='dark'){darkRestart();return;}resetState();difficulty=settings.option;turn='red';selected=-1;cursor=76;history=[];lastMove=null;quietMoves=0;repetitions={};
    board=Array(90).fill(null);
    'rheakaehr'.split('').forEach(function(p,c){board[c]=p;board[81+c]=p.toUpperCase();});
    [19,25].forEach(function(p){board[p]='c';board[89-p]='C';});
    [27,29,31,33,35].forEach(function(p){board[p]='p';board[89-p]='P';});
    repetitions[signature()]=1;redWins=number('wins:'+mode+':red',0);blackWins=number('wins:'+mode+':black',0);
    update();draw();status(mode==='ai'?'你执红先行，点击棋子查看合法走法。':'红方先行，本机轮流对弈。');
  }
  canvas.addEventListener('pointerdown',function(event){if(variant==='dark'){var b=canvas.getBoundingClientRect(),x=(event.clientX-b.left)/b.width*520,y=(event.clientY-b.top)/b.height*600,c=Math.floor((x-36)/56),r=Math.floor((y-170)/56);if(c>=0&&c<8&&r>=0&&r<4)darkSelect(r*8+c);return;}var rect=canvas.getBoundingClientRect();var x=(event.clientX-rect.left)/rect.width*520+40,y=(event.clientY-rect.top)/rect.height*600;var c=Math.round((x-84)/54),r=Math.round((y-57)/54);if(inside(r,c)&&Math.abs(x-84-c*54)<=27&&Math.abs(y-57-r*54)<=27)select(r*9+c);});
  canvas.addEventListener('keydown',function(event){if(blocked())return;if(variant==='dark'){darkKey(event);return;}var r=Math.floor(cursor/9),c=cursor%9;if(event.key==='ArrowUp')r=Math.max(0,r-1);else if(event.key==='ArrowDown')r=Math.min(9,r+1);else if(event.key==='ArrowLeft')c=Math.max(0,c-1);else if(event.key==='ArrowRight')c=Math.min(8,c+1);else if(event.key==='Enter'||event.code==='Space'){event.preventDefault();select(cursor);return;}else return;event.preventDefault();cursor=r*9+c;draw();});
  canvas.addEventListener('focus',draw);canvas.addEventListener('blur',draw);
  document.getElementById('undo').addEventListener('click',undo);
  document.getElementById('restart').addEventListener('click',restart);
  document.querySelectorAll('[data-mode]').forEach(function(button){button.addEventListener('click',function(){var next=button.dataset.mode;if(next===mode)return;mode=next==='local'?'local':'ai';save(key+':mode',mode);restart();ready=true;showCover('中国象棋',variant==='dark'?'先翻一枚暗子，确定双方颜色。':mode==='ai'?'你执红先行，电脑执黑。':'本机红黑双方轮流行棋。','开始游戏');syncStart();});});
  onPause=cancelAI;onResume=function(){scheduleAI();if(variant==='dark'){darkUpdate();return;}status((turn==='red'?'红方':'黑方')+'行棋。');};
  onOption=function(){save(key+':variant',document.getElementById('variant').value==='dark'?'dark':'classic');status('玩法和电脑难度已保存，新的一局生效。');};
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


