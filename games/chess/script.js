/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:chess';
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
  function read(name) { if(Object.prototype.hasOwnProperty.call(memoryStore,name))return memoryStore[name]; try { return localStorage.getItem(name); } catch (error) { document.getElementById('storage').textContent = '存储不可用，数据仅在当前页面保留。'; return memoryStore[name] || null; } }
  function save(name, value) { memoryStore[name] = value; try { localStorage.setItem(name, value); } catch (error) { document.getElementById('storage').textContent = '存储不可用，数据仅在当前页面保留。'; } }
  function status(text) { document.getElementById('status').textContent = text; }
  function number(name, fallback) { var value = Number(read(key + ':' + name)); return Number.isFinite(value) && value > 0 ? value : fallback; }
  function sound(frequency) {
    if (!settings.sound) return;
    try { var Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return; if (!audio) audio = new Audio(); if (audio.state === 'suspended') audio.resume().catch(function () {}); var oscillator = audio.createOscillator(); var gain = audio.createGain(); oscillator.connect(gain); gain.connect(audio.destination); oscillator.frequency.value = frequency || 600; gain.gain.setValueAtTime(.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .12); oscillator.start(); oscillator.stop(audio.currentTime + .12); } catch (error) { /* 声音失败时游戏继续运行。 */ }
  }
  function pause(reason) { if (paused || ended) return; paused = true; document.getElementById('pause').textContent = '继续游戏'; onPause(); showCover('已暂停', '准备好后继续刚才的一局。', '继续游戏'); syncStart(); status(reason || '已暂停，点击继续恢复游戏。'); }
  function resume() { if (!paused || ended || dialog.open) return; paused = false; document.getElementById('pause').textContent = '暂停'; onResume(); hideCover(); syncStart(); }
  function resetState() { activeOption=settings.option; document.getElementById('status').dataset.tone = 'normal'; ready = false; won=false; hideCover(); paused = false; ended = false; document.getElementById('pause').disabled = false; document.getElementById('pause').textContent = '暂停'; }
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



  var activeOption=settings.option;
  var stageIndex=0,unlocked=0,stageCount=1,won=false,onStart=function(){};
  function write(name,value){var n=document.getElementById(name);if(String(n.textContent)!==String(value))n.textContent=value;}
  function hud(value,detail,rule){write('score',value);write('best',number('best:'+activeOption+':'+stageIndex,0)||'—');write('detail',detail);write('rule-label',rule);}
  function record(value,minimum){var k=key+':best:'+activeOption+':'+stageIndex,old=Number(read(k));if(!old||(minimum?value<old:value>old))save(k,String(value));}
  function stages(count){stageCount=count;unlocked=Math.min(count-1,Math.max(0,Math.floor(number('unlocked',0))));stageIndex=Math.min(unlocked,Math.max(0,Math.floor(number('current',0))));renderStages();}
  function renderStages(){document.getElementById('level-section').hidden=stageCount===1;document.getElementById('level-list').innerHTML=Array.from({length:stageCount},function(_,i){return '<button data-stage="'+i+'" aria-pressed="'+(i===stageIndex)+'"'+(i>unlocked?' disabled':'')+'>'+ (i+1) +'</button>';}).join('');write('level-hint','已解锁 '+(unlocked+1)+'/'+stageCount+' 关；切换会重开。');save(key+':current',String(stageIndex));}
  function complete(note){won=true;unlocked=Math.min(stageCount-1,Math.max(unlocked,stageIndex+1));save(key+':unlocked',String(unlocked));renderStages();finish('成功！'+note);showCover('挑战完成',note,stageIndex<stageCount-1?'下一关':'再玩一局');syncStart();}
  document.getElementById('level-list').addEventListener('click',function(e){var b=e.target.closest('[data-stage]');if(!b)return;var n=Number(b.dataset.stage);if(!Number.isInteger(n)||n<0||n>unlocked)return;stageIndex=n;restart();ready=true;showCover('第 '+(n+1)+' 关','准备好后开始。','开始游戏');syncStart();});
  onOption=function(){status('设置已保存，下一局生效。');};
  function editing(e){return e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.target&& (e.target.isContentEditable||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))||document.querySelectorAll('dialog[open]').length;}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function shuffled(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
  function clock(fn){var last=Date.now();onResume=function(){last=Date.now();};setInterval(function(){var now=Date.now(),dt=Math.max(0,Math.min(.1,(now-last)/1000));last=now;if(!blocked())fn(dt);},40);}
  function gridKey(e,cols,count,activate){if(blocked()||editing(e))return;var d={ArrowLeft:-1,ArrowRight:1,ArrowUp:-cols,ArrowDown:cols}[e.key];if(d){e.preventDefault();var n=cursor+d;if(n>=0&&n<count&&(Math.abs(d)!==1||cols===1||Math.floor(n/cols)===Math.floor(cursor/cols)))cursor=n;render();}else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)activate(cursor);}}


  var promotion=document.getElementById('promotion');
  var savedPromotion=read(key+':promotion');if(['5','4','3','2'].indexOf(savedPromotion)>=0)promotion.value=savedPromotion;
  promotion.addEventListener('change',function(){save(key+':promotion',promotion.value);});
  var boardState,history=[],positions=[],selected=-1,cursor=52,lastMove=null,mode=read(key+':mode')==='local'?'local':'ai',aiTimer=null,revision=0;
  var grid=document.getElementById('grid'),values=[0,100,320,330,500,900,20000],names=['','兵','马','象','车','后','王'];
  function initial(){return {board:[-4,-2,-3,-5,-6,-3,-2,-4].concat(Array(8).fill(-1),Array(32).fill(0),Array(8).fill(1),[4,2,3,5,6,3,2,4]),turn:1,rights:'KQkq',ep:-1,half:0,full:1};}
  function attacked(s,index,by){var x=index%8,y=Math.floor(index/8),a=s.board;for(var i=0;i<64;i++){if(Math.sign(a[i])!==by)continue;var type=Math.abs(a[i]),dx=x-i%8,dy=y-Math.floor(i/8),ax=Math.abs(dx),ay=Math.abs(dy);if(type===1&&dy===-by&&ax===1)return true;if(type===2&&(ax===1&&ay===2||ax===2&&ay===1))return true;if(type===6&&Math.max(ax,ay)===1)return true;if(type===3&&ax===ay&&ax||type===4&&(dx===0||dy===0)&&(ax+ay)||type===5&&(ax===ay&&ax||(dx===0||dy===0)&&(ax+ay))){var sx=Math.sign(dx),sy=Math.sign(dy),cx=i%8+sx,cy=Math.floor(i/8)+sy,clear=true;while(cx!==x||cy!==y){if(a[cy*8+cx]){clear=false;break;}cx+=sx;cy+=sy;}if(clear)return true;}}return false;}
  function inCheck(s,side){var k=s.board.indexOf(side*6);return k<0||attacked(s,k,-side);}
  function pseudo(s){var out=[],side=s.turn,a=s.board;function add(f,t,extra){if(t<0||t>=64||Math.sign(a[t])===side||Math.abs(a[t])===6)return;var m={f:f,t:t};if(extra)Object.keys(extra).forEach(function(k){m[k]=extra[k];});out.push(m);}
    a.forEach(function(p,i){if(Math.sign(p)!==side)return;var type=Math.abs(p),x=i%8,y=Math.floor(i/8);
      if(type===1){var ny=y-side;function pawn(to,ep){if(ny===0||ny===7)[5,4,3,2].forEach(function(v){add(i,to,{p:v,ep:!!ep});});else add(i,to,{ep:!!ep});}if(ny>=0&&ny<8){if(!a[ny*8+x]){pawn(ny*8+x,false);if(y===(side===1?6:1)&&!a[(y-side*2)*8+x])add(i,(y-side*2)*8+x);}[-1,1].forEach(function(dx){var nx=x+dx,to=ny*8+nx;if(nx<0||nx>=8)return;if(Math.sign(a[to])===-side)pawn(to,false);else if(to===s.ep&&!a[to]&&a[to+side*8]===-side)pawn(to,true);});}return;}
      if(type===2){[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]].forEach(function(d){var nx=x+d[0],ny=y+d[1];if(nx>=0&&nx<8&&ny>=0&&ny<8)add(i,ny*8+nx);});return;}
      var dirs=type===3?[[1,1],[-1,1],[1,-1],[-1,-1]]:type===4?[[1,0],[-1,0],[0,1],[0,-1]]:[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
      dirs.forEach(function(d){var nx=x+d[0],ny=y+d[1];while(nx>=0&&nx<8&&ny>=0&&ny<8){var to=ny*8+nx;add(i,to);if(a[to]||type===6)break;nx+=d[0];ny+=d[1];}});
      if(type===6){var start=side===1?60:4;if(i!==start||inCheck(s,side))return;[{right:side===1?'K':'k',rook:start+3,empty:[start+1,start+2],pass:[start+1,start+2],to:start+2},{right:side===1?'Q':'q',rook:start-4,empty:[start-1,start-2,start-3],pass:[start-1,start-2],to:start-2}].forEach(function(c){if(s.rights.indexOf(c.right)>=0&&a[c.rook]===side*4&&c.empty.every(function(j){return !a[j];})&&c.pass.every(function(j){return !attacked(s,j,-side);}))add(i,c.to,{castle:true});});}
    });return out;
  }
  function apply(s,m){var n=clone(s),p=n.board[m.f],side=s.turn,capture=m.ep?m.t+side*8:m.t,taken=n.board[capture];n.board[m.f]=0;if(m.ep)n.board[capture]=0;n.board[m.t]=m.p?side*m.p:p;
    if(m.castle){var rook=m.t>m.f?m.f+3:m.f-4,to=m.t>m.f?m.f+1:m.f-1;n.board[to]=n.board[rook];n.board[rook]=0;}
    if(Math.abs(p)===6)n.rights=n.rights.replace(side===1?/[KQ]/g:/[kq]/g,'');[[63,'K'],[56,'Q'],[7,'k'],[0,'q']].forEach(function(r){if(m.f===r[0]||capture===r[0]&&taken)n.rights=n.rights.replace(r[1],'');});
    n.ep=Math.abs(p)===1&&Math.abs(m.t-m.f)===16?(m.t+m.f)/2:-1;n.half=Math.abs(p)===1||taken?0:s.half+1;n.turn=-side;n.full=s.full+(side===-1?1:0);return n;
  }
  function legal(s){return pseudo(s).filter(function(m){return !inCheck(apply(s,m),s.turn);});}
  function positionKey(s){var ep=s.ep>=0&&legal(s).some(function(m){return m.ep;})?s.ep:-1;return s.board.join(',')+':'+s.turn+':'+s.rights+':'+ep;}
  function insufficient(s){var material=[];s.board.forEach(function(p,i){if(p&&Math.abs(p)!==6)material.push({type:Math.abs(p),color:(i%8+Math.floor(i/8))%2});});if(!material.length)return true;if(material.some(function(p){return p.type===1||p.type===4||p.type===5;}))return false;if(material.length===1)return true;return material.every(function(p){return p.type===3&&p.color===material[0].color;});}
  function outcome(s,repeats){var ms=legal(s);if(!ms.length)return {winner:inCheck(s,s.turn)?-s.turn:0,reason:inCheck(s,s.turn)?'将死':'逼和'};if(s.half>=100)return {winner:0,reason:'五十回合未动兵或吃子'};if(repeats>=3)return {winner:0,reason:'同一局面三次重复'};if(insufficient(s))return {winner:0,reason:'子力不足'};return null;}
  function evaluate(s,side){var score=0;s.board.forEach(function(p,i){if(!p)return;var type=Math.abs(p),advance=Math.sign(p)===1?6-Math.floor(i/8):Math.floor(i/8)-1;score+=Math.sign(p)* (values[type]+(type===1?advance*8:Math.max(0,4-Math.abs(3.5-i%8))*3));});return score*side;}
  function chooseAI(s,level){var options=legal(s);if(!options.length)return null;if(level==='easy')return options[Math.floor(Math.random()*options.length)];var nodes=0,deadline=Date.now()+(level==='hard'?650:250),budget=level==='hard'?16000:5000;
    function search(pos,depth,alpha,beta){if(++nodes>budget||Date.now()>deadline||!depth)return evaluate(pos,pos.turn);var ms=legal(pos);if(!ms.length)return inCheck(pos,pos.turn)?-100000-depth:0;if(pos.half>=100||insufficient(pos))return 0;ms.sort(function(a,b){return values[Math.abs(pos.board[b.t])]-values[Math.abs(pos.board[a.t])];});var best=-Infinity;for(var i=0;i<ms.length;i++){var v=-search(apply(pos,ms[i]),depth-1,-beta,-alpha);best=Math.max(best,v);alpha=Math.max(alpha,v);if(alpha>=beta)break;}return best;}
    var best=-Infinity,result=[];options.sort(function(a,b){return values[Math.abs(s.board[b.t])]-values[Math.abs(s.board[a.t])];});options.forEach(function(m){var v=-search(apply(s,m),level==='hard'?2:1,-Infinity,Infinity);if(v>best){best=v;result=[m];}else if(v===best)result.push(m);});return result[Math.floor(Math.random()*result.length)];
  }
  function pieceSVG(p,square){var white=p>0,type=Math.abs(p),id='chess-piece-'+(square===undefined?(white?'w':'b')+type:square),stroke=white?'#6f6858':'#202f39',highlight=white?'#fffef9':'#9caeb7',shape;
    if(type===1)shape='<circle cx="32" cy="18" r="8"/><path d="M26 27h12l4 17H22Z"/><path d="M23 43h18l3 5H20Z"/>';
    else if(type===2)shape='<path d="M20 48c-5-13 4-22 14-26l-13 5-8-6 13-10 2-6 7 4h6c9 13 9 25 3 39Z"/><path d="M42 17q5 18-6 27M18 21l7 1" fill="none"/><circle cx="34" cy="16" r="2" fill="'+stroke+'" stroke="none"/>';
    else if(type===3)shape='<path d="M32 6C15 17 19 29 27 32l-3 12h16l-3-12C46 27 48 17 32 6Z"/><path d="m35 13-6 9" fill="none" stroke-width="3"/><path d="M23 44h18l3 4H20Z"/>';
    else if(type===4)shape='<path d="M24 25h17l3 21H21Z"/><path d="M16 9h9v8h5V9h7v8h5V9h7v17H16Z"/><path d="M21 29h23M22 43h21" fill="none"/>';
    else if(type===5)shape='<path d="m18 20 8 8 6-15 6 15 9-8-7 25H25Z"/><circle cx="18" cy="17" r="3"/><circle cx="32" cy="9" r="4"/><circle cx="47" cy="17" r="3"/><path d="M24 41h17v6H24Z"/>';
    else shape='<path d="M29 5h6v6h6v5h-6v7h-6v-7h-6v-5h6Z"/><path d="M22 27q10-10 20 0l-4 17H26Z"/><path d="M23 43h18l3 5H20Z"/>';
    return '<svg class="chess-piece" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="'+(white?'#fffef5':'#617481')+'"/><stop offset="1" stop-color="'+(white?'#d7cbae':'#293b46')+'"/></linearGradient></defs><ellipse cx="32" cy="60" rx="22" ry="2.5" fill="#20322b" opacity=".2"/><g fill="url(#'+id+')" stroke="'+stroke+'" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+shape+'<path d="M19 47h26l4 5H15Z"/><path d="M15 53h34l3 6H12Z"/><path d="M19 55h26" fill="none" stroke="'+highlight+'" stroke-opacity=".65"/></g></svg>';
  }
  function render(animateTo){grid.innerHTML='';var ms=selected<0?[]:legal(boardState).filter(function(m){return m.f===selected;}),checked=inCheck(boardState,boardState.turn);boardState.board.forEach(function(p,i){var b=document.createElement('button'),target=ms.some(function(m){return m.t===i;}),last=lastMove&&(lastMove.f===i||lastMove.t===i);b.dataset.cell=i;b.className='chess-cell'+((i%8+Math.floor(i/8))%2?' dark':' light')+(i===selected?' selected':'')+(i===cursor?' cursor':'')+(last?' last-square':'')+(checked&&p===boardState.turn*6?' check':'')+(animateTo===i&&p?' arriving':'');b.innerHTML=p?pieceSVG(p,i):target?'<svg class="move-dot" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="7" fill="#314b40" fill-opacity=".4"/></svg>':'';if(target&&p)b.className+=' target';if(i%8===0)b.innerHTML+='<span class="rank-label" aria-hidden="true">'+(8-Math.floor(i/8))+'</span>';if(i>=56)b.innerHTML+='<span class="file-label" aria-hidden="true">'+String.fromCharCode(97+i%8)+'</span>';b.setAttribute('aria-label',String.fromCharCode(97+i%8)+(8-Math.floor(i/8))+'，'+(p?(p>0?'白':'黑')+names[Math.abs(p)]:'空格')+(target?(p?'，可吃子':'，可走'):'')+(checked&&p===boardState.turn*6?'，被将军':''));b.setAttribute('aria-pressed',String(i===selected));grid.appendChild(b);});var totals=[0,0];boardState.board.forEach(function(p){if(p&&Math.abs(p)!==6)totals[p>0?0:1]+=[0,1,3,3,5,9][Math.abs(p)];});write('score',totals[0]);write('best',totals[1]);write('detail','第 '+boardState.full+' 回合 · '+(boardState.turn===1?'白':'黑')+'方行棋'+(checked?' · 将军':''));write('rule-label','8 × 8 · '+(mode==='ai'?'人机':'双人')+' · '+({easy:'轻松',normal:'标准',hard:'挑战'}[activeOption]||'标准'));document.querySelectorAll('[data-mode]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});document.getElementById('undo').disabled=!history.length||ended;}
  function cancelAI(){if(aiTimer!==null)clearTimeout(aiTimer);aiTimer=null;revision++;}
  function scheduleAI(){if(blocked()||mode!=='ai'||boardState.turn!==-1||aiTimer!==null)return;var token=revision;aiTimer=setTimeout(function(){aiTimer=null;if(token!==revision||blocked()||mode!=='ai'||boardState.turn!==-1)return;var m=chooseAI(boardState,activeOption);if(m)move(m,true);},260);}
  function move(m,computer){if(blocked()||mode==='ai'&&(boardState.turn===-1)!==!!computer)return false;var candidate=legal(boardState).find(function(v){return v.f===m.f&&v.t===m.t&&(!v.p||v.p===(m.p||5));});if(!candidate){status('这步不合法，不能让自己的王处于攻击中。');return false;}cancelAI();history.push({state:clone(boardState),positions:positions.slice(),last:lastMove});boardState=apply(boardState,candidate);lastMove=candidate;selected=-1;cursor=m.t;var hash=positionKey(boardState);positions.push(hash);var result=outcome(boardState,positions.filter(function(k){return k===hash;}).length);if(result){if(result.winner)complete((result.winner===1?'白方':'黑方')+'将死获胜。');else{finish('和棋：'+result.reason+'。');document.getElementById('status').dataset.tone='normal';showCover('和棋',result.reason,'再玩一局');}}else status((boardState.turn===1?'白方':'黑方')+(inCheck(boardState,boardState.turn)?'被将军，请应将。':'行棋。'));sound(540);render(m.t);scheduleAI();return true;}
  function activate(i){if(blocked()||mode==='ai'&&boardState.turn===-1)return;if(Math.sign(boardState.board[i])===boardState.turn){selected=selected===i?-1:i;cursor=i;render();}else if(selected>=0)move({f:selected,t:i,p:Number(document.getElementById('promotion').value)||5},false);}
  function undo(){if(blocked()||!history.length)return;cancelAI();var old;do{old=history.pop();}while(mode==='ai'&&old.state.turn!==1&&history.length);boardState=old.state;positions=old.positions;lastMove=old.last;selected=-1;render();status('已悔棋。');scheduleAI();}
  function restart(){cancelAI();resetState();boardState=initial();history=[];selected=-1;cursor=52;lastMove=null;positions=[positionKey(boardState)];renderStages();render();status('白方先行，选择棋子查看可走格；升变种类在设置中选择。');}
  grid.addEventListener('click',function(e){var b=e.target.closest('[data-cell]');if(b){activate(Number(b.dataset.cell));grid.focus();}});grid.addEventListener('keydown',function(e){gridKey(e,8,64,activate);});document.getElementById('undo').addEventListener('click',undo);document.getElementById('resign').addEventListener('click',function(){if(blocked()||mode==='ai'&&boardState.turn===-1)return;finish((boardState.turn===1?'白方':'黑方')+'认输。');render();});document.querySelectorAll('[data-mode]').forEach(function(b){b.addEventListener('click',function(){if(mode===b.dataset.mode)return;mode=b.dataset.mode==='local'?'local':'ai';save(key+':mode',mode);restart();ready=true;showCover('模式已切换','白方先行。','开始游戏');syncStart();});});onPause=cancelAI;onResume=scheduleAI;onStart=scheduleAI;stages(1);restart();


  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
