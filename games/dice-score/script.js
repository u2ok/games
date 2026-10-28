/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:dice-score';
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

  var dice=[1,2,3,4,5],held=[false,false,false,false,false],sheet=Array(13).fill(null),rolls=0,rolling=0,pending=[],category=-1,totalScore=0,round=1;
  var names=['一点','二点','三点','四点','五点','六点','三同','四同','葫芦','小顺','大顺','五同','机会'];
  function values(a){var counts=Array(7).fill(0);a.forEach(function(v){counts[v]++;});var sum=a.reduce(function(s,v){return s+v;},0),unique=Array.from(new Set(a)).sort().join('');return counts.slice(1).map(function(c,i){return c*(i+1);}).concat([Math.max(...counts)>=3?sum:0,Math.max(...counts)>=4?sum:0,counts.includes(3)&&counts.includes(2)?25:0,unique.includes('1234')||unique.includes('2345')||unique.includes('3456')?30:0,unique==='12345'||unique==='23456'?40:0,counts.includes(5)?50:0,sum]);}
  function tally(){var upper=sheet.slice(0,6).reduce(function(a,v){return a+(v||0);},0);return sheet.reduce(function(a,v){return a+(v||0);},0)+(upper>=63?35:0);}
  function roll(){if(blocked()||rolling||rolls>=3)return;if(rolls&&held.every(Boolean)){status('所有骰子已保留，可取消保留后再掷，或直接计分。');return;}pending=dice.map(function(v,i){return held[i]?v:1+Math.floor(Math.random()*6);});rolling=.65;rolls++;category=-1;status('骰子翻滚中……');sound(620);render();}
  function bank(){if(blocked()||rolling||!rolls)return;if(category<0||sheet[category]!==null){status('先在棋盘上选择一个尚未填写的计分项。');return;}var value=values(dice)[category];sheet[category]=value;burst(300,180,gold);totalScore=tally();if(sheet.every(function(v){return v!==null;})){record(totalScore,false);complete('13轮完成，总分 '+totalScore+'；本档参考目标 '+({easy:150,normal:200,hard:250}[activeOption]||200)+' 分。');}else{round++;rolls=0;held=held.map(function(){return false;});category=-1;status('计入 '+value+' 分。下一轮开始，先掷骰。');}render();}
  function step(dt){if(rolling){rolling=Math.max(0,rolling-dt);if(!rolling){dice=pending.slice();status('本次 '+dice.join('、')+'；点击骰子保留，再掷或选择计分项。');render();}}}
  function render(){hud(totalScore,'第 '+round+'/13 轮 · 已掷 '+rolls+'/3 次 · 上区 '+sheet.slice(0,6).reduce(function(a,v){return a+(v||0);},0)+'/63','目标 '+({easy:150,normal:200,hard:250}[activeOption]||200)+' 分 · 上区达63奖励35');write('roll-dice',rolling?'翻滚中…':rolls>=3?'本轮已掷三次':'掷骰（'+(3-rolls)+'次）');document.getElementById('roll-dice').disabled=!!rolling||rolls>=3;document.getElementById('bank').disabled=!!rolling||!rolls;}
  function restart(){begin();dice=[1,2,3,4,5];held=Array(5).fill(false);sheet=Array(13).fill(null);rolls=0;rolling=0;pending=[];category=-1;totalScore=0;round=1;render();status('先掷骰，点击想保留的骰子；每轮最多三次，然后选一项计分。');}
  function dots(v,x,y,s){var patterns=[[],[[0,0]],[[-1,-1],[1,1]],[[-1,-1],[0,0],[1,1]],[[-1,-1],[1,-1],[-1,1],[1,1]],[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]];patterns[v].forEach(function(p){circle(x+p[0]*s*.24,y+p[1]*s*.24,s*.065,ink);});}
  function draw(){base('掷出组合，规划得分','点击骰子保留 · 点击计分项预览，再确认');dice.forEach(function(v,i){var x=65+i*100,y=100,rot=rolling&&!held[i]&&!reduce?Math.sin(rolling*42+i)*.2:0;ctx.save();ctx.translate(x+35,y+35);ctx.rotate(rot);ctx.shadowColor='#25304720';ctx.shadowBlur=8;rect(-35,-35,70,70,held[i]?'#e4e9fc':'#fff',13);ctx.shadowBlur=0;dots(rolling&&!held[i]&&!reduce?1+Math.floor(anim*28+i)%6:v,0,0,64);ctx.restore();text(held[i]?'保留':'点击保留',x+35,190,14,held[i]?accent:muted);});var preview=values(dice);names.forEach(function(name,i){var col=i<6?0:1,row=i<6?i:i-6,x=35+col*275,y=222+row*48,filled=sheet[i]!==null;rect(x,y,255,42,i===category?'#e7ecff':filled?'#edf1ed':'#fff',7);text(name,x+14,y+21,17,filled?muted:ink,'left');text(filled?sheet[i]:rolls&&!rolling?preview[i]:'—',x+228,y+21,20,filled?green:accent);});text('已填 '+sheet.filter(function(v){return v!==null;}).length+'/13 项 · 总分 '+totalScore,300,580,17,muted);}
  canvas.addEventListener('click',function(e){if(blocked()||rolling)return;var p=point(e);if(p.y>=90&&p.y<=200){var i=Math.floor((p.x-50)/100);if(i>=0&&i<5&&rolls){held[i]=!held[i];sound(400);}}else if(p.y>=222&&p.y<558&&rolls){var col=p.x<300?0:1,row=Math.floor((p.y-222)/48),i=col?row+6:row;if(row>=0&&row<(col?7:6)&&sheet[i]===null){category=i;status(names[i]+' 将计 '+values(dice)[i]+' 分，按确认计分提交。');}}});listen('roll-dice',roll);listen('bank',bank);keyInput(function(e){if(e.key===' '){e.preventDefault();roll();}if(/^[1-5]$/.test(e.key)&&rolls&&!rolling)held[+e.key-1]=!held[+e.key-1];if(e.key==='Enter')bank();});restart();

  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
