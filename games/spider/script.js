/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:spider';
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
  // 新版重设难度梯度：首次升级进入入门局；音效与旧成绩保留，后续选择照常保存。
  if(read(key+':difficulty-version')!=='2'){settings.option='easy';option.value='easy';save(key+':settings',JSON.stringify(settings));save(key+':difficulty-version','2');}
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
  function hud(value,detail,rule){write('score',value);write('best',number('best:v2:'+activeOption+':'+stageIndex,0)||'—');write('detail',detail);write('rule-label',rule);}
  function record(value,minimum){var k=key+':best:v2:'+activeOption+':'+stageIndex,old=Number(read(k));if(!old||(minimum?value<old:value>old))save(k,String(value));}
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


  var columns=[],stock=[],history=[],selected=null,cursor=0,moves=0,completed=0,assisted=false,grid=document.getElementById('grid'),suitCount=1;
  var cursorIndex=-1,hintTarget=-1,guide={},practice=false,lastCollected=0;
  var ranks=['','A','2','3','4','5','6','7','8','9','10','J','Q','K'],suitNames=['黑桃','红心','梅花','方块'];
  function suitSVG(s){var shape=s===0?'<path d="M12 2 3 13q-4 9 7 7L8 25h8l-2-5q11 2 7-7Z"/>':s===1?'<path d="M12 6Q2-3 1 8q-1 7 11 15Q26 12 23 6q-3-8-11 0Z"/>':s===2?'<circle cx="12" cy="7" r="6"/><circle cx="6" cy="15" r="6"/><circle cx="18" cy="15" r="6"/><path d="m12 15-4 10h8Z"/>':'<path d="m12 1 11 12-11 12L1 13Z"/>';return '<svg viewBox="0 0 24 26" aria-hidden="true" fill="'+(s%2?'#ad5c50':'#334e40')+'">'+shape+'</svg>';}
  function movable(state,col,index){var c=state[col];if(!c||index<0||index>=c.length)return false;for(var i=index;i<c.length;i++){if(!c[i].face||i>index&&(c[i-1].rank!==c[i].rank+1||c[i-1].suit!==c[i].suit))return false;}return true;}
  function canPlace(state,from,index,to){if(from===to||!state[to]||!movable(state,from,index))return false;var dest=state[to];return !dest.length||dest[dest.length-1].face&&dest[dest.length-1].rank===state[from][index].rank+1;}
  function snapshot(){return {columns:clone(columns),stock:clone(stock),moves:moves,completed:completed};}
  function removeRuns(state){var count=0;state.forEach(function(c,col){while(c.length>=13&&c[c.length-13].rank===13&&c[c.length-1].rank===1&&movable(state,col,c.length-13)){c.splice(c.length-13,13);count++;if(c.length)c[c.length-1].face=true;}});return count;}
  function collectRuns(){lastCollected=removeRuns(columns);completed+=lastCollected;if(completed===8){if(!assisted)record(Math.max(0,500-moves+completed*100),false);complete('八组同花K至A全部收齐！');}}
  function move(from,index,to){if(blocked()||!canPlace(columns,from,index,to))return false;history.push(snapshot());var length=columns[from].length-index;columns[to]=columns[to].concat(columns[from].splice(index));if(columns[from].length)columns[from][columns[from].length-1].face=true;moves++;selected=null;hintTarget=-1;cursor=to;cursorIndex=-1;collectRuns();if(!ended)status(lastCollected?'收齐 '+lastCollected+' 组！已完成 '+completed+'/8组。':'已将 '+length+' 张移到第 '+(to+1)+' 列。');render();sound(lastCollected?880:520);return true;}
  function deal(){if(blocked()||stock.length<10)return false;if(columns.some(function(c){return !c.length;})){status('有空列时不能发牌，先填满各列。');return false;}history.push(snapshot());for(var i=0;i<10;i++){var c=stock.shift();c.face=true;columns[i].push(c);}moves++;selected=null;hintTarget=-1;cursorIndex=-1;collectRuns();if(!ended)status('已发一轮牌，先寻找同花连接与可翻开的背面牌。');render();return true;}
  function boardKey(state){return state.map(function(c){return c.map(function(v){return v.id+':'+(v.face?1:0);}).join(',');}).join('|');}
  function run(set,start,end){var a=[];for(var rank=start;rank>=end;rank--)a.push({id:set*13+rank,rank:rank,suit:0,face:true});return a;}
  // 入门不伪装成经典随机局：交换成对牌列的尾段，并记录经真实规则可回放的12步解。
  // 每对牌先借空列暂存，再各归一组，已收走的列不再参与后续路线。
  function practiceDeal(){
    var state=Array.from({length:10},function(){return [];}),route=[],order=shuffled([0,1,2,3,4,5,6,7]);
    for(var pair=0;pair<4;pair++){
      var a=3+Math.floor(Math.random()*6),b=a+1+Math.floor(Math.random()*2),l=order[pair*2],r=order[pair*2+1],s=pair*2;
      state[l]=run(s,13,a+1).concat(run(s+1,b,1));state[r]=run(s+1,13,b+1).concat(run(s,a,1));
      route.push({from:r,index:13-b,to:8},{from:l,index:13-a,to:r},{from:8,index:0,to:l});
    }
    var replay=clone(state),map={};route.forEach(function(m){
      if(!canPlace(replay,m.from,m.index,m.to))throw new Error('入门路线不合法');
      map[boardKey(replay)]={from:m.from,index:m.index,to:m.to,reason:'入门通关路线：借空列整理连续牌段'};
      replay[m.to]=replay[m.to].concat(replay[m.from].splice(m.index));removeRuns(replay);
    });
    return {columns:state,guide:map,route:route};
  }
  function candidates(state){
    var options=[];for(var a=0;a<10;a++)for(var i=0;i<state[a].length;i++)if(movable(state,a,i))for(var b=0;b<10;b++)if(canPlace(state,a,i,b)){
      if(!state[b].length&&i===0)continue; // 整列换空位没有整理收益，不作为自动建议。
      var src=state[a],dst=state[b],expose=i>0&&!src[i-1].face,same=dst.length&&dst[dst.length-1].suit===src[i].suit;
      var next=clone(state);next[b]=next[b].concat(next[a].splice(i));var groups=removeRuns(next),score=groups*1000+(expose?150:0)+(same?70:0)+(i===0?45:0)+(src.length-i);
      options.push({from:a,index:i,to:b,score:score,reason:groups?'收齐一组同花顺':expose?'翻开一张背面牌':same?'连接同花递减牌段':!dst.length?'借用空列整理':'衔接较大的牌'});
    }
    return options.sort(function(a,b){return b.score-a.score;});
  }
  function suggestion(){var guided=practice&&guide[boardKey(columns)];return guided&&canPlace(columns,guided.from,guided.index,guided.to)?guided:candidates(columns)[0]||null;}
  function rankHTML(card){return '<span class="card-corner"><strong>'+ranks[card.rank]+'</strong>'+suitSVG(card.suit)+'</span><span class="card-pip">'+suitSVG(card.suit)+'</span>';}
  function render(){
    grid.innerHTML='';
    var top=document.createElement('div');top.className='spider-top';top.innerHTML='<div class="spider-foundations" aria-label="已收齐'+completed+'组">'+Array.from({length:8},function(_,i){return '<span class="foundation'+(i<completed?' filled':'')+'">'+(i<completed?suitSVG(0):'<span>'+(i+1)+'</span>')+'</span>';}).join('')+'</div><span class="spider-stock">'+(practice?'明牌训练':stock.length/10+' 轮待发')+'</span>';grid.appendChild(top);
    columns.forEach(function(c,col){
      var lane=document.createElement('div'),available=selected&&selected.col!==col&&canPlace(columns,selected.col,selected.index,col);
      lane.className='spider-column'+(col===cursor?' cursor':'')+(available?' available':'')+(col===hintTarget?' hint-target':'');lane.dataset.col=col;lane.dataset.count=c.length;lane.setAttribute('aria-label','第'+(col+1)+'列，'+c.length+'张'+(!c.length?'，空位':''));
      lane.innerHTML='<span class="column-number">'+(col+1)+'</span>'+(!c.length?'<span class="empty-column">空位</span>':'');
      c.forEach(function(card,index){
        var el=document.createElement('button');el.dataset.col=col;el.dataset.card=index;el.className='spider-card'+(!card.face?' back':'')+(card.suit%2?' red':'')+(selected&&selected.col===col&&index>=selected.index?' selected':'')+(col===cursor&&index===cursorIndex?' key-cursor':'');
        el.setAttribute('aria-label',card.face?'第'+(col+1)+'列，第'+(index+1)+'张，'+suitNames[card.suit]+ranks[card.rank]: '第'+(col+1)+'列，第'+(index+1)+'张，背面牌');el.innerHTML=card.face?rankHTML(card):'<span class="card-back-pattern" aria-hidden="true"></span>';
        lane.appendChild(el);
      });grid.appendChild(lane);
    });
    hud(Math.max(0,500-moves+completed*100),'收齐 '+completed+'/8组 · '+moves+'步 · '+(practice?'两列空位可周转':'剩余发牌 '+stock.length/10+'轮')+(assisted?' · 辅助局':''),practice?'入门 · 单花色全明牌 · 可通关牌局':suitCount+'种花色 · 经典发牌');
    write('deal',practice?'无需发牌':'发牌');
    document.getElementById('deal').disabled=stock.length<10||ended;document.getElementById('undo').disabled=!history.length;
    document.getElementById('hint').disabled=ended;write('hint',hintTarget>=0?'按提示移牌':'提示');
    layoutCards();
  }
  // 用实际牌桌高度分配重叠距离，背面只露窄边，正面保留点数行；长牌列也不越界。
  function layoutCards(){
    if(!grid.querySelectorAll)return;
    Array.from(grid.querySelectorAll('.spider-column')).forEach(function(lane,col){
      if(!lane.getBoundingClientRect)return;var box=lane.getBoundingClientRect(),c=columns[col],cardHeight=Math.max(31,Math.min(90,box.width*1.4)),space=Math.max(0,box.height-cardHeight-20),weight=0;
      for(var i=0;i<c.length-1;i++)weight+=c[i].face?1:.45;
      var step=weight?Math.min(25,space/weight):0,y=20;
      Array.from(lane.querySelectorAll('.spider-card')).forEach(function(card,i){card.style.top=y+'px';card.style.height=cardHeight+'px';y+=step*(c[i].face?1:.45);});
    });
  }
  function activate(col,index){if(blocked()||!columns[col])return;cursor=col;cursorIndex=index;hintTarget=-1;if(selected&&selected.col!==col){if(!move(selected.col,selected.index,col))status('请选择高一阶的牌或标出的空列；蓝框为可放位置。');}else if(index>=0&&movable(columns,col,index))selected=selected&&selected.col===col&&selected.index===index?null:{col:col,index:index};else selected=null;render();}
  function classicDeal(){
    var deck=[];for(var set=0;set<8;set++)for(var rank=1;rank<=13;rank++)deck.push({id:set*13+rank,rank:rank,suit:set%suitCount,face:false});shuffled(deck);
    var state=Array.from({length:10},function(){return [];});for(var i=0;i<54;i++)state[i%10].push(deck.pop());state.forEach(function(c){c[c.length-1].face=true;});return {columns:state,stock:deck};
  }
  function restart(){
    resetState();practice=activeOption==='easy';suitCount={easy:1,normal:1,hard:2,expert:4}[activeOption]||1;guide={};
    if(practice){var p=practiceDeal();columns=p.columns;guide=p.guide;stock=[];}else{var game;for(var attempt=0;attempt<20;attempt++){game=classicDeal();if(candidates(game.columns).length)break;}columns=game.columns;stock=game.stock;}
    history=[];selected=null;cursor=0;cursorIndex=-1;hintTarget=-1;moves=0;completed=0;assisted=false;lastCollected=0;renderStages();render();status(practice?'先借空位整理。点“提示”查看通关步骤，再点“按提示移牌”可帮你走一步。':'从单花色开始：先连接同花牌段、翻开背面牌，尽量保留空列。');
  }
  function undo(){if(ready||paused||dialog.open||!history.length)return;var p=history.pop();columns=p.columns;stock=p.stock;moves=p.moves;completed=p.completed;selected=null;hintTarget=-1;ended=false;won=false;document.getElementById('pause').disabled=false;hideCover();syncStart();status('已撤销，牌列与发牌恢复到上一步。');render();}
  function help(auto){if(blocked())return;var m=suggestion();if(!m){status(stock.length?'暂无有收益的移牌，可撤销或发牌；有空列须先填满。':'暂无有收益的移牌，可撤销；入门模式更适合练习。');return;}assisted=true;if(auto){move(m.from,m.index,m.to);return;}selected={col:m.from,index:m.index};cursor=m.to;cursorIndex=-1;hintTarget=m.to;status('第 '+(m.from+1)+' 列 '+ranks[columns[m.from][m.index].rank]+' 起的牌段 → 第 '+(m.to+1)+' 列。'+m.reason+'。');render();}
  grid.addEventListener('click',function(e){var b=e.target.closest('[data-col]');if(b)activate(Number(b.dataset.col),b.dataset.card===undefined?-1:Number(b.dataset.card));});
  grid.addEventListener('keydown',function(e){if(blocked()||editing(e))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();cursor=Math.max(0,Math.min(9,cursor+(e.key==='ArrowLeft'?-1:1)));cursorIndex=columns[cursor].length-1;render();}else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();var current=cursorIndex<0?columns[cursor].length-1:cursorIndex;cursorIndex=Math.max(0,Math.min(columns[cursor].length-1,current+(e.key==='ArrowUp'?-1:1)));render();}else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)activate(cursor,cursorIndex<0?columns[cursor].length-1:cursorIndex);}});
  document.getElementById('deal').addEventListener('click',deal);document.getElementById('undo').addEventListener('click',undo);document.getElementById('hint').addEventListener('click',function(){help(hintTarget>=0);});
  window.addEventListener('resize',layoutCards);if(typeof ResizeObserver==='function')new ResizeObserver(layoutCards).observe(grid);
  stages(1);restart();


  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
