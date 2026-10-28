/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:nonogram';
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




  var size=5, solution=[], cells=[], rowClues=[], colClues=[], history=[], cursor=0, markMode=false, errors=[];
  var elapsed=0, started=0, edited=false, assisted=false, best=0, stroke=null;
  var grid=document.getElementById('grid'), verified={}, lineCache={};
  var motifs=[['01010','11111','11111','01110','00100'],['00100','01110','11111','10001','11111'],['00100','01110','11111','00100','01110'],['00100','11110','11111','11110','00100'],['10001','10001','11111','01110','00100'],['00100','11111','00100','10101','01110']];
  function runs(line){var out=[],count=0;line.forEach(function(v){if(v===1)count++;else if(count){out.push(count);count=0;}});if(count)out.push(count);return out.length?out:[0];}
  function cluesFor(board,n){var rows=[],cols=[];for(var r=0;r<n;r++){rows.push(runs(board.slice(r*n,(r+1)*n)));var column=[];for(var c=0;c<n;c++)column.push(board[c*n+r]);cols.push(runs(column));}return {rows:rows,cols:cols};}
  // 枚举一条线的合法排布，位掩码仅用于最大15格的本游戏棋盘。
  function patterns(clues,n){
    var key=n+':'+clues.join(',');if(lineCache[key])return lineCache[key];
    if(clues.length===1&&clues[0]===0)return [0];
    var output=[];
    function put(k,start,bits){if(k===clues.length){output.push(bits);return;}var rest=clues.slice(k+1).reduce(function(a,b){return a+b;},0)+clues.length-k-1;for(var pos=start;pos<=n-clues[k]-rest;pos++)put(k+1,pos+clues[k]+1,bits|(((1<<clues[k])-1)<<pos));}
    put(0,0,0);lineCache[key]=output;return output;
  }
  // 行列候选交叉传播后回溯，找到两解即停止。超预算视为未验证，绝不当作唯一解。
  function countSolutions(rows,cols,n){
    var nodes=0,exhausted=false,answer=null,full=(1<<n)-1;
    function props(lines){return lines.map(function(options){return {all:options.reduce(function(a,b){return a&b;},full),any:options.reduce(function(a,b){return a|b;},0)};});}
    function search(rs,cs){
      if(++nodes>3000){exhausted=true;return 0;}
      var changed;
      do{
        changed=false;var cp=props(cs);
        for(var r=0;r<n;r++){var on=0,off=0;for(var c=0;c<n;c++){if(cp[c].all&(1<<r))on|=1<<c;if(!(cp[c].any&(1<<r)))off|=1<<c;}var filtered=rs[r].filter(function(v){return (v&on)===on&&!(v&off);});if(!filtered.length)return 0;if(filtered.length!==rs[r].length)changed=true;rs[r]=filtered;}
        var rp=props(rs);
        for(var c=0;c<n;c++){var on=0,off=0;for(var r=0;r<n;r++){if(rp[r].all&(1<<c))on|=1<<r;if(!(rp[r].any&(1<<c)))off|=1<<r;}var filtered=cs[c].filter(function(v){return (v&on)===on&&!(v&off);});if(!filtered.length)return 0;if(filtered.length!==cs[c].length)changed=true;cs[c]=filtered;}
      }while(changed);
      var axis=0,index=-1,min=Infinity;
      [rs,cs].forEach(function(lines,a){lines.forEach(function(options,i){if(options.length>1&&options.length<min){axis=a;index=i;min=options.length;}});});
      if(index<0){if(!answer)answer=rs.map(function(line){return line[0];});return 1;}
      var count=0,options=(axis?cs:rs)[index];
      for(var i=0;i<options.length&&!exhausted;i++){var nextR=rs.slice(),nextC=cs.slice();(axis?nextC:nextR)[index]=[options[i]];count+=search(nextR,nextC);if(count>=2)return 2;}
      return count;
    }
    var rs=rows.map(function(line){return patterns(line,n);}),cs=cols.map(function(line){return patterns(line,n);});
    if(rs.some(function(v){return !v.length;})||cs.some(function(v){return !v.length;}))return {count:0,exhausted:false};
    return {count:search(rs,cs),exhausted:exhausted,solution:answer};
  }
  function scale(motif,n){var factor=n/5;return Array.from({length:n*n},function(_,i){return Number(motif[Math.floor(Math.floor(i/n)/factor)][Math.floor((i%n)/factor)]);});}
  function transform(board,n,rotation,mirror){var out=Array(board.length);for(var y=0;y<n;y++)for(var x=0;x<n;x++){var nx=mirror?n-1-x:x,ny=y;for(var t=0;t<rotation;t++){var temp=nx;nx=n-1-ny;ny=temp;}out[ny*n+nx]=board[y*n+x];}return out;}
  function generate(n){
    if(!verified[n])verified[n]=motifs.map(function(m){return scale(m,n);}).filter(function(board){var clues=cluesFor(board,n),test=countSolutions(clues.rows,clues.cols,n);return test.count===1&&!test.exhausted;});
    var pool=verified[n];
    if(!pool.length){var mid=Math.floor(n/2);pool=[Array.from({length:n*n},function(_,i){return Math.floor(i/n)===mid||i%n===mid?1:0;})];}
    return transform(pool[Math.floor(Math.random()*pool.length)],n,Math.floor(Math.random()*4),Math.random()<.5);
  }
  function seconds(){return Math.floor((elapsed+(started?Date.now()-started:0))/1000);}
  function stopClock(){if(started)elapsed+=Date.now()-started;started=0;}
  function beginClock(){edited=true;if(!started)started=Date.now();}
  function solved(){return cells.every(function(v,i){return solution[i]?v===1:v!==1;});}
  function detail(){
    var value=String(ended?Math.max(1,seconds()):seconds()),record=best?String(best):'—';
    if(document.getElementById('score').textContent!==value)document.getElementById('score').textContent=value;
    if(document.getElementById('best').textContent!==record)document.getElementById('best').textContent=record;
    var text='填色 '+cells.filter(function(v){return v===1;}).length+' 格 · 标空 '+cells.filter(function(v){return v===2;}).length+' 格'+(assisted?' · 已辅助，不计纪录':'');
    if(document.getElementById('detail').textContent!==text)document.getElementById('detail').textContent=text;
  }
  function draw(){
    document.getElementById('puzzle-board').style.setProperty('--nono-size',size);
    grid.innerHTML='';grid.style.gridTemplateColumns='repeat('+size+',minmax(0,1fr))';grid.style.gridTemplateRows='repeat('+size+',minmax(0,1fr))';
    cells.forEach(function(value,index){var button=document.createElement('button');button.type='button';button.tabIndex=-1;button.dataset.index=index;button.className='nonogram-cell'+(value===1?' filled':'')+(index===cursor?' cell-cursor':'')+(errors.indexOf(index)>=0?' cell-error':'')+((index%size+1)%5===0&&index%size<size-1?' block-right':'')+((Math.floor(index/size)+1)%5===0&&index<size*(size-1)?' block-bottom':'');button.setAttribute('aria-label','第'+(Math.floor(index/size)+1)+'行第'+(index%size+1)+'列，'+(['未确定','填色','标空'][value]));if(value===2)button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>';grid.appendChild(button);});
    var current=cluesFor(cells.map(function(v){return v===1?1:0;}),size);
    ['row-clues','column-clues'].forEach(function(id){var row=id==='row-clues',host=document.getElementById(id),clues=row?rowClues:colClues;host.innerHTML='';host.style[row?'gridTemplateRows':'gridTemplateColumns']='repeat('+size+',minmax(0,1fr))';clues.forEach(function(line,i){var node=document.createElement('div');node.className='nonogram-clue'+(line.join(',')===(row?current.rows:current.cols)[i].join(',')?' complete':'');node.setAttribute('aria-label','第'+(i+1)+(row?'行':'列')+'提示：'+line.join('、'));line.forEach(function(n){var span=document.createElement('span');span.textContent=n;node.appendChild(span);});host.appendChild(node);});});
    var rowMax=Math.max.apply(null,rowClues.map(function(x){return x.length;})),colMax=Math.max.apply(null,colClues.map(function(x){return x.length;}));
    var hintSpace=100*(Math.max(rowMax,colMax)+.8)/(size+Math.max(rowMax,colMax)+.8)+'%';
    document.getElementById('puzzle-board').style.setProperty('--row-hint-space',hintSpace);document.getElementById('puzzle-board').style.setProperty('--col-hint-space',hintSpace);
    document.getElementById('paint-mode').textContent=markMode?'标空模式':'填色模式';document.getElementById('paint-mode').setAttribute('aria-pressed',String(markMode));document.getElementById('undo').disabled=!history.length;
    document.getElementById('rule-label').textContent=size+' × '+size+' · '+({'5':'入门','10':'标准','15':'挑战'}[size])+' · 唯一解';detail();
  }
  function checkWin(){if(blocked()||!solved())return;stopClock();var time=Math.max(1,seconds());if(!assisted&&(!best||time<best)){best=time;save(key+':best:'+size,String(best));}finish('图案完成！用时'+time+'秒。'+(assisted?'本局使用辅助，不计纪录。':''));showCover('图案完成！','用时'+time+'秒，所有填色段都与提示一致。','再玩一局');detail();}
  function change(index,target){if(blocked()||index<0||index>=cells.length||cells[index]===target)return false;beginClock();history.push(cells.slice());if(history.length>300)history.shift();cells[index]=target;cursor=index;errors=[];draw();checkWin();return true;}
  function beginStroke(index,target){if(blocked())return;endStroke(false);stroke={before:cells.slice(),target:target,changed:false};paint(index);}
  function paint(index){if(!stroke||blocked()||index<0||index>=cells.length||cells[index]===stroke.target)return;beginClock();cells[index]=stroke.target;stroke.changed=true;cursor=index;errors=[];draw();}
  function endStroke(check){if(!stroke)return;var previous=stroke;stroke=null;if(previous.changed){history.push(previous.before);if(history.length>300)history.shift();draw();if(check)checkWin();}}
  function undo(){if(blocked())return;endStroke(false);if(!history.length)return;cells=history.pop();errors=[];draw();status('已撤销上一步，拖涂按整次手势撤销；用时与辅助状态不回退。');}
  function checkBoard(){if(blocked())return;endStroke(false);assisted=true;errors=[];cells.forEach(function(v,i){if(v!==0&&((v===1)!==!!solution[i]))errors.push(i);});draw();status(errors.length?'发现 '+errors.length+' 处错误，红框已标出。':'已填写的格子均正确，未确定格仍需继续推理。');}
  function hint(){if(blocked())return;endStroke(false);var index=cursor;if(cells[index]===(solution[index]?1:2))index=cells.findIndex(function(v,i){return v!==(solution[i]?1:2);});if(index<0)return;assisted=true;change(index,solution[index]?1:2);if(!ended)status('已揭示一格，本局不计最快纪录。');}
  function restart(){endStroke(false);stopClock();resetState();size=['5','10','15'].indexOf(settings.option)>=0?Number(settings.option):5;solution=generate(size);var clues=cluesFor(solution,size);rowClues=clues.rows;colClues=clues.cols;cells=Array(size*size).fill(0);history=[];cursor=0;markMode=false;errors=[];elapsed=0;started=0;edited=false;assisted=false;best=number('best:'+size,0);draw();status('根据行列数字填色；数字之间至少隔一格，0表示整线留空。');}
  grid.addEventListener('pointerdown',function(event){if(event.button!==0&&event.button!==2||blocked())return;var cell=event.target.closest('[data-index]');if(!cell)return;event.preventDefault();var index=Number(cell.dataset.index),tool=event.button===2||event.shiftKey||markMode?2:1;beginStroke(index,cells[index]===tool?0:tool);if(grid.setPointerCapture)grid.setPointerCapture(event.pointerId);grid.focus();});
  grid.addEventListener('pointermove',function(event){if(!stroke)return;var node=document.elementFromPoint(event.clientX,event.clientY),cell=node&&node.closest('[data-index]');if(cell&&grid.contains(cell))paint(Number(cell.dataset.index));});
  grid.addEventListener('pointerup',function(){endStroke(true);});grid.addEventListener('pointercancel',function(){endStroke(true);});grid.addEventListener('lostpointercapture',function(){endStroke(true);});grid.addEventListener('contextmenu',function(event){event.preventDefault();});
  grid.addEventListener('keydown',function(event){if(blocked()||event.altKey||event.isComposing)return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo();return;}if(event.ctrlKey||event.metaKey)return;var offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-size,ArrowDown:size};if(offsets[event.key]){event.preventDefault();var next=cursor+offsets[event.key];if(next>=0&&next<cells.length&&(Math.abs(offsets[event.key])!==1||Math.floor(next/size)===Math.floor(cursor/size)))cursor=next;draw();}else if(['Enter',' ','x','X','Delete','Backspace'].indexOf(event.key)>=0){event.preventDefault();if(event.repeat)return;var tool=event.key==='Delete'||event.key==='Backspace'?0:event.key.toLowerCase()==='x'?2:markMode?2:1;change(cursor,cells[cursor]===tool?0:tool);}});
  document.getElementById('paint-mode').addEventListener('click',function(){if(blocked())return;endStroke(false);markMode=!markMode;draw();status(markMode?'当前标空工具，点击格子标记叉号。':'当前填色工具，点击格子填色。');});
  document.getElementById('undo').addEventListener('click',undo);document.getElementById('check').addEventListener('click',checkBoard);document.getElementById('hint').addEventListener('click',hint);document.getElementById('restart').addEventListener('click',restart);
  onPause=function(){endStroke(false);stopClock();};onResume=function(){if(edited)started=Date.now();};onOption=function(){status('棋盘尺寸已保存，下一局生效。');};
  setInterval(function(){if(!blocked()){detail();checkWin();}},250);restart();

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
