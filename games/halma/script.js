/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:halma';
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
  /* 六角星棋盘采用轴坐标。中心61孔加六个10孔营地，共121孔。 */
  var cells = [];
  var indexByKey = {};
  var camps = [];
  var directions = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
  function addCell(q,r) {
    var code=q+','+r;
    if(indexByKey[code]!==undefined)return indexByKey[code];
    var index=cells.length;indexByKey[code]=index;cells.push({q:q,r:r,x:300+32*(q+r/2),y:300+Math.sqrt(3)*16*r});return index;
  }
  for(var r=-4;r<=4;r++)for(var q=-4;q<=4;q++)if(Math.abs(q+r)<=4)addCell(q,r);
  for(var arm=0;arm<6;arm++){
    var camp=[];
    for(var row=-8;row<=-5;row++)for(var col=-row-4;col<=4;col++){
      var aq=col,ar=row;
      for(var rotation=0;rotation<arm;rotation++){var nextQ=-ar;ar=aq+ar;aq=nextQ;}
      camp.push(addCell(aq,ar));
    }
    camps.push(camp);
  }
  var board = [];
  var turn = 1; // 1红方，2蓝方。
  var selected = -1;
  var cursor = camps[3][0];
  var chain = null;
  var history = [];
  var turns = 0;
  var repetitions = {};
  var lastPath = [];
  var aiTimer = null;
  var aiThinking = false;
  var planningCache = null;
  var routePreview = [];
  var mode = read(key+':mode')==='local'?'local':'ai';
  var difficulty = settings.option;
  var canvas = document.getElementById('canvas');
  var context = canvas.getContext('2d');
  function target(color){return color===1?camps[0]:camps[3];}
  function at(q,r){var index=indexByKey[q+','+r];return index===undefined?-1:index;}
  function goalAllowed(from,to,color){return target(color).indexOf(from)===-1||target(color).indexOf(to)!==-1;}
  function adjacent(position,from,color){
    var p=cells[from];
    return directions.map(function(d){return at(p.q+d[0],p.r+d[1]);}).filter(function(to){return to!==-1&&!position[to]&&goalAllowed(from,to,color);});
  }
  function jumps(position,from,color,visited){
    var p=cells[from];var result=[];
    directions.forEach(function(d){var middle=at(p.q+d[0],p.r+d[1]),to=at(p.q+d[0]*2,p.r+d[1]*2);if(middle!==-1&&to!==-1&&position[middle]&&!position[to]&&visited.indexOf(to)===-1&&goalAllowed(from,to,color))result.push(to);});
    return result;
  }
  function jumpPaths(position,from,color){
    var queue=[{at:from,path:[from]}],seen={};seen[from]=true;var result=[];
    for(var i=0;i<queue.length;i++){
      var state=queue[i],sim=position.slice();sim[from]=0;sim[state.at]=color;
      jumps(sim,state.at,color,state.path).forEach(function(to){if(seen[to])return;seen[to]=true;var path=state.path.concat(to);result.push(path);queue.push({at:to,path:path});});
    }
    return result;
  }
  function moves(position,color){
    var result=[];
    position.forEach(function(piece,from){if(piece!==color)return;adjacent(position,from,color).forEach(function(to){result.push({from:from,to:to,path:[from,to],jump:false});});jumpPaths(position,from,color).forEach(function(path){result.push({from:from,to:path[path.length-1],path:path,jump:true});});});
    return result;
  }
  function won(color){return target(color).every(function(index){return board[index]===color;});}
  function cancelAI(){if(aiTimer!==null){clearTimeout(aiTimer);aiTimer=null;}aiThinking=false;}
  function snapshot(){history.push({board:board.slice(),turn:turn,turns:turns,repetitions:Object.assign({},repetitions),lastPath:lastPath.slice()});}
  function signature(){return board.join('')+':'+turn;}
  function update(){
    document.getElementById('score-label').textContent='红方归位';document.getElementById('best-label').textContent='蓝方归位';
    updateScore(target(1).filter(function(i){return board[i]===1;}).length,target(2).filter(function(i){return board[i]===2;}).length);
    document.getElementById('best').textContent=target(2).filter(function(i){return board[i]===2;}).length;
    document.getElementById('rule-label').textContent=(mode==='ai'?'人机 · 你执红':'双人 · 红方先行')+' · '+(turn===1?'红方':'蓝方')+'行动';
    document.getElementById('detail').textContent=aiThinking?'电脑正在规划路线……':'第 '+(turns+1)+' 回合'+(chain?' · 连跳 '+(chain.visited.length-1)+' 次，可继续或结束':' · '+(turn===1?'红方':'蓝方')+'行动');
    document.getElementById('end-turn').disabled=!chain||blocked();
    document.getElementById('undo').disabled=!history.length||blocked();
    var canPass=!blocked()&&!chain&&moves(board,turn).length===0;
    document.getElementById('pass').disabled=!canPass;
    document.getElementById('pass').hidden=!canPass;
    document.getElementById('end-turn').textContent=chain?'结束连跳（'+(chain.visited.length-1)+'次）':'结束回合';
    document.querySelectorAll('[data-mode]').forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.mode===mode));});
    canvas.setAttribute('aria-label','跳棋，'+(turn===1?'红方':'蓝方')+'行动，点击棋子及提示落点。连跳后可点结束回合。');
  }
  function gameResult(winner,note){cancelAI();chain=null;if(winner){var name='wins:'+mode+':'+winner;save(key+':'+name,String(number(name,0)+1));}finish(note);document.getElementById('status').dataset.tone='normal';showCover(winner?(winner===1?'红方获胜':'蓝方获胜'):'和棋',note,'再下一局');update();draw();}
  function endTurn(){
    if(blocked())return;
    if(won(turn)){gameResult(turn,'10枚棋子全部进入对面营地！');return;}
    chain=null;selected=-1;routePreview=[];turn=turn===1?2:1;turns+=1;
    var code=signature();repetitions[code]=(repetitions[code]||0)+1;
    if(repetitions[code]>=3){gameResult(null,'同一局面出现三次，判为和棋。');return;}
    update();draw();status((turn===1?'红方':'蓝方')+'行动，可移步或跳跃。');scheduleAI();
  }
  function select(index){
    if(blocked()||(mode==='ai'&&turn===2))return;
    cursor=index;
    routePreview=[];
    if(!chain&&board[index]===turn){selected=selected===index?-1:index;draw();status(selected===-1?'已取消选子。':'实心点为移步，圆环为跳跃，虚线为连续跳路线。');return;}
    if(selected===-1||board[index])return;
    var options=chain?jumps(board,selected,turn,chain.visited):jumps(board,selected,turn,[selected]);
    var isJump=options.indexOf(index)!==-1;
    if(!isJump&&(chain||adjacent(board,selected,turn).indexOf(index)===-1)){status('请选择提示落点。跳跃需要中间有棋子，落点为空。');return;}
    if(!chain){snapshot();lastPath=[selected];}
    board[selected]=0;board[index]=turn;lastPath.push(index);selected=index;sound(650);
    if(isJump){
      if(!chain)chain={visited:lastPath.slice()};else chain.visited.push(index);
      if(won(turn)||!jumps(board,index,turn,chain.visited).length){endTurn();return;}
      update();draw();status('可继续连跳，或点击“结束回合”。');
    }else endTurn();
  }
  function progress(index,color){return color===1?-cells[index].r:cells[index].r;}
  function hexDistance(a,b){var dq=cells[a].q-cells[b].q,dr=cells[a].r-cells[b].r;return Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr));}
  // 匈牙利算法：将全部棋子分配到不同目标孔，避免只顾向前而堵住营口。
  // 距离仅用于估值，不改变实际移步/跳跃规则。
  function assignmentCost(position,color){
    var pieces=[];position.forEach(function(piece,index){if(piece===color)pieces.push(index);});
    var goals=target(color),n=pieces.length;if(!n)return 0;
    var u=Array(n+1).fill(0),v=Array(goals.length+1).fill(0),p=Array(goals.length+1).fill(0),way=Array(goals.length+1).fill(0);
    for(var i=1;i<=n;i++){
      p[0]=i;var j0=0,minv=Array(goals.length+1).fill(Infinity),used=Array(goals.length+1).fill(false);
      do{
        used[j0]=true;var i0=p[j0],delta=Infinity,j1=0;
        for(var j=1;j<=goals.length;j++)if(!used[j]){var cur=hexDistance(pieces[i0-1],goals[j-1])-u[i0]-v[j];if(cur<minv[j]){minv[j]=cur;way[j]=j0;}if(minv[j]<delta){delta=minv[j];j1=j;}}
        for(var k=0;k<=goals.length;k++){if(used[k]){u[p[k]]+=delta;v[k]-=delta;}else minv[k]-=delta;}
        j0=j1;
      }while(p[j0]!==0);
      do{var previous=way[j0];p[j0]=p[previous];j0=previous;}while(j0!==0);
    }
    return -v[0];
  }
  function positionValue(position,color){
    var code=position.join('')+':'+color;
    if(planningCache&&planningCache[code]!==undefined)return planningCache[code];
    var goals=target(color),home=color===1?camps[3]:camps[0],placed=0,remainingHome=0,depth=0;
    position.forEach(function(piece,index){if(piece!==color)return;if(goals.indexOf(index)!==-1){placed++;depth+=progress(index,color);}if(home.indexOf(index)!==-1)remainingHome++;});
    var value=placed===10?100000:placed*38-assignmentCost(position,color)*12-remainingHome*5+depth*2;
    if(planningCache)planningCache[code]=value;return value;
  }
  function afterMove(position,m,color){var next=position.slice();next[m.from]=0;next[m.to]=color;return next;}
  function repetitionPenalty(position,nextTurn){return (repetitions[position.join('')+':'+nextTurn]||0)*18;}
  function chooseAI(){
    var candidates=moves(board,2);if(!candidates.length)return null;
    planningCache={};var deadline=Date.now()+(difficulty==='hard'?350:180);
    var scored=candidates.map(function(m){var next=afterMove(board,m,2);var value;
      if(difficulty==='easy')value=(progress(m.to,2)-progress(m.from,2))*12+(target(2).indexOf(m.to)!==-1?45:0);
      else value=positionValue(next,2)-positionValue(next,1)*.4;
      if(target(2).every(function(i){return next[i]===2;}))value=1000000;
      return {move:m,value:value-repetitionPenalty(next,1)};
    }).sort(function(a,b){return b.value-a.value;});
    if(difficulty==='hard'&&scored[0].value<900000){
      // 有限候选对手应手分析，控制主线程计算量；超预算时使用已完成候选。
      var refined=[];
      for(var i=0;i<Math.min(12,scored.length)&&Date.now()<deadline;i++){
        var next=afterMove(board,scored[i].move,2);
        var replies=moves(next,1).map(function(m){var state=afterMove(next,m,1);return {state:state,value:positionValue(state,1)};}).sort(function(a,b){return b.value-a.value;}).slice(0,5);
        var worst=positionValue(next,2)-positionValue(next,1)*.4;
        replies.forEach(function(reply){var value=reply.value>=100000?-1000000:positionValue(reply.state,2)-reply.value*.4;worst=Math.min(worst,value);});
        refined.push({move:scored[i].move,value:worst-repetitionPenalty(next,1)});
      }
      if(refined.length)scored=refined;
    }
    var best=Math.max.apply(null,scored.map(function(s){return s.value;}));
    var top=scored.filter(function(s){return s.value>=best-(difficulty==='easy'?20:difficulty==='hard'?3:7);});
    planningCache=null;return top[Math.floor(Math.random()*top.length)].move;
  }
  function runAI(){
    if(blocked()||mode!=='ai'||turn!==2)return;
    var m=chooseAI();snapshot();
    if(m){board[m.from]=0;board[m.to]=2;lastPath=m.path.slice();sound(500);}else lastPath=[];
    endTurn();
  }
  function scheduleAI(){cancelAI();if(mode==='ai'&&turn===2&&!blocked()){aiThinking=true;update();aiTimer=setTimeout(function(){aiTimer=null;aiThinking=false;runAI();},320);}}
  function undo(){
    if(blocked()||!history.length)return;cancelAI();
    var count=chain?1:mode==='ai'&&turn===1?2:1,state;
    while(count--&&history.length)state=history.pop();
    board=state.board;turn=state.turn;turns=state.turns;repetitions=state.repetitions;lastPath=state.lastPath;chain=null;selected=-1;routePreview=[];
    update();draw();status('已悔棋。');scheduleAI();
  }
  function draw(){
    context.fillStyle='#f3eddf';context.fillRect(0,0,600,600);
    var campColors=['#e1c3bb','#e4d9b6','#d5dfc1','#c6d9e3','#dbcee1','#ead1b5'];
    // 用每个营地的三个极点绘制淡色三角，明确六角星轮廓和双方归营方向。
    camps.forEach(function(camp,c){var corners=camp.filter(function(index){var p=cells[index];return directions.filter(function(d){return camp.indexOf(at(p.q+d[0],p.r+d[1]))!==-1;}).length===2;});context.fillStyle=campColors[c];context.globalAlpha=.38;context.beginPath();corners.forEach(function(index,i){var p=cells[index];if(i===0)context.moveTo(p.x,p.y);else context.lineTo(p.x,p.y);});context.closePath();context.fill();context.globalAlpha=1;});
    context.lineWidth=1;context.strokeStyle='#c9bea7';
    cells.forEach(function(cell,index){directions.slice(0,3).forEach(function(d){var next=at(cell.q+d[0],cell.r+d[1]);if(next!==-1){context.beginPath();context.moveTo(cell.x,cell.y);context.lineTo(cells[next].x,cells[next].y);context.stroke();}});context.fillStyle='#e7dfcd';camps.forEach(function(camp,c){if(camp.indexOf(index)!==-1)context.fillStyle=campColors[c];});context.beginPath();context.arc(cell.x,cell.y,12,0,Math.PI*2);context.fill();});
    if(lastPath.length){context.strokeStyle='#bd9857';context.lineWidth=3;context.setLineDash([4,4]);context.beginPath();lastPath.forEach(function(index,i){if(i===0)context.moveTo(cells[index].x,cells[index].y);else context.lineTo(cells[index].x,cells[index].y);});context.stroke();context.setLineDash([]);}
    board.forEach(function(piece,index){if(!piece)return;var p=cells[index];context.fillStyle='#68523c33';context.beginPath();context.arc(p.x,p.y+2,12,0,Math.PI*2);context.fill();context.fillStyle=piece===1?'#a9584e':'#497b9b';context.beginPath();context.arc(p.x,p.y,11,0,Math.PI*2);context.fill();context.fillStyle='#fffefa88';context.beginPath();context.arc(p.x-3,p.y-4,3,0,Math.PI*2);context.fill();});
    if(selected!==-1){
      var p=cells[selected];context.strokeStyle='#245c4a';context.lineWidth=3;context.beginPath();context.arc(p.x,p.y,15,0,Math.PI*2);context.stroke();
      // 实心点代表一步移步，空心环代表下一跳；不把远处连跳终点误画成可直接点击的孔。
      if(!chain)adjacent(board,selected,turn).forEach(function(index){context.fillStyle='#245c4a';context.beginPath();context.arc(cells[index].x,cells[index].y,4,0,Math.PI*2);context.fill();});
      jumps(board,selected,turn,chain?chain.visited:[selected]).forEach(function(index){context.beginPath();context.arc(cells[index].x,cells[index].y,7,0,Math.PI*2);context.stroke();});
    }
    if(routePreview.length){
      context.strokeStyle='#996a2e';context.lineWidth=2;context.setLineDash([5,4]);context.beginPath();routePreview.forEach(function(index,i){var p=cells[index];if(!i)context.moveTo(p.x,p.y);else context.lineTo(p.x,p.y);});context.stroke();context.setLineDash([]);
      context.font='bold 12px sans-serif';routePreview.slice(1).forEach(function(index,i){var p=cells[index];context.fillStyle='#fffaf0';context.beginPath();context.arc(p.x,p.y,9,0,Math.PI*2);context.fill();context.fillStyle='#805221';context.textAlign='center';context.fillText(String(i+1),p.x,p.y+4);});
    }
    if(document.activeElement===canvas){context.strokeStyle='#a47734';context.lineWidth=2;context.strokeRect(cells[cursor].x-15,cells[cursor].y-15,30,30);}
    context.fillStyle='#667060';context.font='14px "Microsoft YaHei",sans-serif';context.textAlign='center';context.fillText('红方目标',300,36);context.fillText('蓝方目标',300,566);
  }
  // 提示只展示路线，不自动落子。连跳中排除已经访问的孔，保持与实际规则一致。
  function hintRoute(){
    if(blocked()||(mode==='ai'&&turn===2))return;
    if(selected===-1){status('请先选择一枚己方棋子，再查看路线。');return;}
    var paths=jumpPaths(board,selected,turn).filter(function(path){return !chain||path.slice(1).every(function(index){return chain.visited.indexOf(index)===-1;});});
    paths.sort(function(a,b){return (progress(b[b.length-1],turn)-progress(b[0],turn))-(progress(a[a.length-1],turn)-progress(a[0],turn))||a.length-b.length;});
    routePreview=paths.length?paths[0]:[];draw();status(paths.length?'按数字顺序逐孔点击，虚线仅为路线参考，可随时选择其它合法落点。':'这枚棋子没有可用跳路，请选择实心点移步或更换棋子。');
  }
  function restart(){cancelAI();resetState();difficulty=settings.option;board=Array(cells.length).fill(0);camps[3].forEach(function(i){board[i]=1;});camps[0].forEach(function(i){board[i]=2;});turn=1;selected=-1;chain=null;history=[];turns=0;lastPath=[];routePreview=[];repetitions={};repetitions[signature()]=1;update();draw();status('红方先行，移步或跳跃，不吃子。');}
  canvas.addEventListener('pointerdown',function(event){var rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*600,y=(event.clientY-rect.top)/rect.height*600;var index=-1,dist=Infinity;cells.forEach(function(cell,i){var d=Math.pow(x-cell.x,2)+Math.pow(y-cell.y,2);if(d<dist){dist=d;index=i;}});if(dist<=16*16)select(index);});
  canvas.addEventListener('keydown',function(event){if(blocked())return;var delta=event.key==='ArrowLeft'?[-1,0]:event.key==='ArrowRight'?[1,0]:event.key==='ArrowUp'?[0,-1]:event.key==='ArrowDown'?[0,1]:null;if(delta){event.preventDefault();var next=at(cells[cursor].q+delta[0],cells[cursor].r+delta[1]);if(next!==-1)cursor=next;draw();}else if(event.key==='Enter'||event.code==='Space'){event.preventDefault();select(cursor);}});
  document.getElementById('end-turn').addEventListener('click',function(){if(chain)endTurn();});
  document.getElementById('hint-route').addEventListener('click',hintRoute);
  document.getElementById('pass').addEventListener('click',function(){if(blocked()||chain||moves(board,turn).length)return;snapshot();lastPath=[];endTurn();});
  document.getElementById('undo').addEventListener('click',undo);document.getElementById('restart').addEventListener('click',restart);
  document.querySelectorAll('[data-mode]').forEach(function(button){button.addEventListener('click',function(){if(mode===button.dataset.mode)return;mode=button.dataset.mode==='local'?'local':'ai';save(key+':mode',mode);restart();ready=true;showCover('跳棋',mode==='ai'?'你执红，电脑执蓝。':'红蓝双方轮流对弈。','开始游戏');syncStart();});});
  onPause=function(){cancelAI();update();};onResume=function(){update();scheduleAI();};onOption=function(){status('电脑难度已保存，新的一局生效。');};
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


