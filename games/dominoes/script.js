/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:dominoes';
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



  var canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d'),W=600,H=600,anim=0,elapsed=0,assisted=false;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ink='#253047',muted='#64718a',accent='#5366d6',green='#789680',coral='#c87969',gold='#d6ad65';
  var particles=[],pointer={x:300,y:300};
  function point(e){var r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*600/r.width,y:(e.clientY-r.top)*600/r.height};}
  function rect(x,y,w,h,color,r){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r||8);ctx.fill();}
  function text(s,x,y,size,color,align){ctx.fillStyle=color||ink;ctx.font='600 '+(size||20)+'px system-ui';ctx.textAlign=align||'center';ctx.textBaseline='middle';ctx.fillText(String(s),x,y);}
  function line(x,y,a,b,color,width){ctx.strokeStyle=color||ink;ctx.lineWidth=width||3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.stroke();}
  function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function base(title,note){ctx.clearRect(0,0,600,600);rect(0,0,600,600,'#f8fafc');text(title,300,32,22);if(note)text(note,300,63,15,muted);}
  function burst(x,y,color){if(reduce)return;for(var i=0;i<16;i++){var a=i*Math.PI/8;particles.push({x:x,y:y,vx:Math.cos(a)*80,vy:Math.sin(a)*80,t:.55,c:color||gold});}sound(720);}
  function effects(dt){particles=particles.filter(function(p){p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=100*dt;return p.t>0;});}
  function drawEffects(){particles.forEach(function(p){ctx.globalAlpha=Math.max(0,p.t/.55);circle(p.x,p.y,3,p.c);});ctx.globalAlpha=1;}
  function listen(id,fn){document.getElementById(id).addEventListener('click',function(){if(!blocked())fn();});}
  function keyInput(fn){document.addEventListener('keydown',function(e){if(blocked()||editing(e)||e.repeat)return;fn(e);});}
  function useHint(note){assisted=true;status(note);}
  function win(note,value,minimum){if(!assisted)record(value,minimum);complete(note);}
  function begin(){elapsed=0;anim=0;particles=[];assisted=false;resetState();}
  function tick(dt){if(blocked())return;elapsed+=dt;anim+=dt;step(dt);effects(dt);}
  stages(1);
  var previous=0;
  function frame(now){var dt=previous?Math.min(.035,(now-previous)/1000):0;previous=now;if(!blocked())tick(dt);else if(ended&&!paused&&!dialog.open)effects(dt);draw();drawEffects();requestAnimationFrame(frame);}
  requestAnimationFrame(frame);

  var hands=[[],[]],stock=[],chain=[],turn=0,selected=-1,passes=0,aiWait=0,score=0,fly=null;
  function can(tile,side){if(!chain.length)return true;return tile.includes(side==='left'?chain[0][0]:chain[chain.length-1][1]);}
  function legal(hand){return hand.some(function(t){return can(t,'left')||can(t,'right');});}
  function total(hand){return hand.reduce(function(a,t){return a+t[0]+t[1];},0);}
  function settle(winner,note){score=winner===0?Math.max(1,total(hands[1])-total(hands[0])+30):0;if(winner===0)win(note+'，得分 '+score+'。',score,false);else finish(note+'；你的剩余点数 '+total(hands[0])+'，电脑 '+total(hands[1])+'。');render();}
  function nextTurn(){selected=-1;if(!hands[turn].length){settle(turn,turn===0?'你已出完手牌':'电脑出完手牌');return;}if(passes>=2){var a=total(hands[0]),b=total(hands[1]);if(a===b){finish('双方堵牌，剩余点数相同，本局平局。');render();}else settle(a<b?0:1,'双方堵牌，低点数获胜');return;}turn=1-turn;aiWait=.75;status(turn?'电脑正在思考。':'轮到你，先选手牌，再选择连接的一端。');render();}
  function play(index,side){if(blocked())return false;if(!hands[turn][index]){status('先点击一张手牌，再选择接左端或接右端。');return false;}var tile=hands[turn][index];if(!can(tile,side)){status('这张牌与所选端点不匹配，请换另一端或另一张牌。');return false;}tile=tile.slice();hands[turn].splice(index,1);if(!chain.length)chain.push(tile);else if(side==='left'){if(tile[1]!==chain[0][0])tile.reverse();chain.unshift(tile);}else{if(tile[0]!==chain[chain.length-1][1])tile.reverse();chain.push(tile);}passes=0;fly={t:0,side:side};sound(570);nextTurn();return true;}
  function drawOne(){if(blocked())return;if(legal(hands[turn])){status('有可出的牌，必须先出牌。');return;}if(!stock.length){status('牌堆已空，当前无可出牌时可跳过。');return;}hands[turn].push(stock.pop());sound(430);render();status(turn?'电脑摸牌。':legal(hands[0])?'摸到可用骨牌，请选择并接到端点。':'仍无可出牌，可再摸一张。');}
  function skip(){if(legal(hands[turn])||stock.length){status('有牌可出或牌堆未空，不能跳过。');return;}passes++;nextTurn();}
  function step(dt){if(fly){fly.t+=dt;if(fly.t>.3)fly=null;}if(turn===1){aiWait-=dt;if(aiWait<=0){var options=[];hands[1].forEach(function(t,i){['left','right'].forEach(function(s){if(can(t,s))options.push({i:i,s:s,v:t[0]+t[1]});});});if(options.length){if(activeOption==='easy')shuffled(options);else options.sort(function(a,b){function value(o){var tile=hands[1][o.i],support=hands[1].filter(function(t){return t.includes(tile[0])||t.includes(tile[1]);}).length;return o.v+(activeOption==='hard'?support*2:0);}return value(b)-value(a);});play(options[0].i,options[0].s);}else if(stock.length){drawOne();aiWait=.45;}else skip();}}}
  function render(){hud(score,'你 '+hands[0].length+' 张 · 电脑 '+hands[1].length+' 张 · 牌堆 '+stock.length,(turn?'电脑回合':'你的回合')+' · 接点 '+(chain.length?chain[0][0]+' / '+chain[chain.length-1][1]:'任意开局'));write('draw-tile','摸一张（'+stock.length+'）');document.getElementById('play-left').disabled=!!turn||selected<0||!can(hands[0][selected],'left');document.getElementById('play-right').disabled=!!turn||selected<0||!can(hands[0][selected],'right');document.getElementById('draw-tile').disabled=!!turn||legal(hands[0])||!stock.length;document.getElementById('pass').disabled=!!turn||!!stock.length||legal(hands[0]);}
  function restart(){begin();var all=[];for(var a=0;a<=6;a++)for(var b=a;b<=6;b++)all.push([a,b]);shuffled(all);hands=[all.splice(0,7),all.splice(0,7)];stock=all;chain=[];turn=0;selected=-1;passes=0;score=0;aiWait=0;fly=null;render();status('你先出。选择手牌，再按接左端或接右端；空场可出任意牌。');}
  var pipPatterns=[[],[[0,0]],[[-1,-1],[1,1]],[[-1,-1],[0,0],[1,1]],[[-1,-1],[1,-1],[-1,1],[1,1]],[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]];
  // 点数按每个半牌的短边缩放，不能用整牌宽度决定上下点位。
  function pips(v,box){
    var s=Math.min(box.w,box.h),cx=box.x+box.w/2,cy=box.y+box.h/2;
    pipPatterns[v].forEach(function(p){circle(cx+p[0]*s*.24,cy+p[1]*s*.24,s*.075,ink);});
  }
  function tile(t,x,y,w,h,chosen){
    var horizontal=w>h,pad=Math.min(w,h)*.1,r=Math.min(w,h)*.13;
    ctx.save();ctx.shadowColor=chosen?'#5366d62b':'#2530471a';ctx.shadowBlur=reduce?0:chosen?6:3;ctx.shadowOffsetY=2;
    rect(x,y,w,h,chosen?'#edf0ff':'#fffdf6',r);ctx.restore();
    ctx.beginPath();ctx.roundRect(x+.5,y+.5,w-1,h-1,r);ctx.strokeStyle=chosen?accent:'#bfc8c2';ctx.lineWidth=chosen?2:1;ctx.stroke();
    if(horizontal){
      line(x+w/2,y+pad,x+w/2,y+h-pad,'#cdd5ce',1);
      pips(t[0],{x:x+pad,y:y+pad,w:w/2-2*pad,h:h-2*pad});
      pips(t[1],{x:x+w/2+pad,y:y+pad,w:w/2-2*pad,h:h-2*pad});
    }else{
      line(x+pad,y+h/2,x+w-pad,y+h/2,'#cdd5ce',1);
      pips(t[0],{x:x+pad,y:y+pad,w:w-2*pad,h:h/2-2*pad});
      pips(t[1],{x:x+pad,y:y+h/2+pad,w:w-2*pad,h:h/2-2*pad});
    }
  }
  function rackRects(){
    var rows=Math.max(1,Math.ceil(hands[0].length/7)),h=Math.min(92,Math.floor((188-(rows-1)*8)/rows));
    return hands[0].map(function(_,i){var x=75+i%7*66,y=405+Math.floor(i/7)*(h+8);return {x:x,y:y,w:54,h:h,face:{x:x+(54-h/2)/2,y:y,w:h/2,h:h}};});
  }
  // 牌链以蛇形连续排列；反向行仅反转显示，不改写逻辑端点。
  function chainRects(){return chain.map(function(_,i){var row=Math.floor(i/7),reverse=!!(row%2),col=i%7;return {x:62+(reverse?6-col:col)*68,y:146+row*52,w:68,h:34,reverse:reverse};});}
  function draw(){
    base('点数相接，先出完获胜',turn?'电脑思考中':'选择手牌，再接到左端或右端');
    rect(30,90,540,280,'#e3ebe1',18);text('电脑 '+hands[1].length+' 张 · 牌堆 '+stock.length,300,110,16,muted);
    var table=chainRects();
    table.forEach(function(r,i){if(i&&i%7===0){var prev=table[i-1],x=r.reverse?r.x+r.w:r.x;line(x,prev.y+prev.h/2,x,r.y+r.h/2,'#a5bba8',5);}});
    chain.forEach(function(t,i){var r=table[i];tile(r.reverse?[t[1],t[0]]:t,r.x,r.y,r.w,r.h,false);});
    if(!chain.length)text('空场可出任意牌',300,230,22,green);
    else text('左端 '+chain[0][0]+' · 右端 '+chain[chain.length-1][1],300,354,15,green);
    if(fly&&!reduce){ctx.globalAlpha=1-fly.t/.3;rect(fly.side==='left'?34:546,140,12,205,gold,6);ctx.globalAlpha=1;}
    var rects=rackRects();
    hands[0].forEach(function(t,i){var r=rects[i].face;tile(t,r.x,r.y,r.w,r.h,i===selected);});
    if(hands[0].length>14&&selected>=0){tile(hands[0][selected],12,416,48,96,true);text('已选',36,531,13,accent);}
    text('你的手牌 · 剩余点数 '+total(hands[0]),300,390,17,muted);
  }
  canvas.addEventListener('click',function(e){if(blocked()||turn)return;var p=point(e);selected=rackRects().findIndex(function(r){return p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h;});if(selected>=0)status('已选 '+hands[0][selected].join('—')+'，点击可用的接牌端点。');render();});listen('play-left',function(){if(!turn)play(selected,'left');});listen('play-right',function(){if(!turn)play(selected,'right');});listen('draw-tile',function(){if(!turn)drawOne();});listen('pass',function(){if(!turn)skip();});keyInput(function(e){if(turn)return;if(e.key==='ArrowLeft'){e.preventDefault();selected=(selected+hands[0].length-1)%hands[0].length;}if(e.key==='ArrowRight'){e.preventDefault();selected=(selected+1)%hands[0].length;}if(e.key==='l')play(selected,'left');if(e.key==='r'||e.key==='Enter')play(selected,'right');render();});restart();

  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
