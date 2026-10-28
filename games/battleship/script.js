/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:battleship';
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
  var previous=0;
  function frame(now){var dt=previous?Math.min(.035,(now-previous)/1000):0;previous=now;if(!blocked())tick(dt);else if(ended&&!paused&&!dialog.open)effects(dt);draw();drawEffects();requestAnimationFrame(frame);}
  requestAnimationFrame(frame);

  var waterFX=[],scanTime=0;
  var n=6,cells=[],answer=[],fleet=[],rows=[],cols=[],history=[],cursor=0,flash=[];
  function components(a){var seen=new Set(),out=[];for(var i=0;i<a.length;i++){if(a[i]!==1||seen.has(i))continue;var q=[i];seen.add(i);for(var h=0;h<q.length;h++){var v=q[h];[v%n?v-1:-1,v%n<n-1?v+1:-1,v-n,v+n].forEach(function(j){if(j>=0&&j<n*n&&a[j]===1&&!seen.has(j)){seen.add(j);q.push(j);}});}out.push(q);}return out;}
  function valid(a){if(rows.some(function(v,y){return a.slice(y*n,y*n+n).filter(function(x){return x===1;}).length!==v;})||cols.some(function(v,x){return a.filter(function(c,i){return i%n===x&&c===1;}).length!==v;}))return false;var groups=components(a);if(groups.some(function(g){return !g.every(function(i){return Math.floor(i/n)===Math.floor(g[0]/n);})&&!g.every(function(i){return i%n===g[0]%n;});}))return false;for(var i=0;i<a.length;i++)if(a[i]===1){var x=i%n,y=Math.floor(i/n);for(var dx of [-1,1])for(var dy of [-1,1])if(x+dx>=0&&x+dx<n&&y+dy>=0&&y+dy<n&&a[(y+dy)*n+x+dx]===1)return false;}return groups.map(function(g){return g.length;}).sort().join()===fleet.slice().sort().join();}
  function generate(){fleet=activeOption==='hard'?[4,3,2,2,1,1]:activeOption==='easy'?[3,2,1]:[3,2,2,1];for(var attempt=0;attempt<500;attempt++){var a=Array(n*n).fill(0),ok=true;for(var len of fleet){var choices=[];for(var i=0;i<n*n;i++)for(var d of [1,n]){var ids=Array.from({length:len},function(_,k){return i+k*d;});if(ids.some(function(j){return j>=n*n||d===1&&Math.floor(j/n)!==Math.floor(i/n);}))continue;if(ids.some(function(j){var x=j%n,y=Math.floor(j/n);for(var dx=-1;dx<=1;dx++)for(var dy=-1;dy<=1;dy++)if(x+dx>=0&&x+dx<n&&y+dy>=0&&y+dy<n&&a[(y+dy)*n+x+dx])return true;return false;}))continue;choices.push(ids);}if(!choices.length){ok=false;break;}choices[Math.floor(Math.random()*choices.length)].forEach(function(i){a[i]=1;});}if(ok){answer=a;break;}}if(!answer.length)throw Error('舰队布局生成失败');rows=Array.from({length:n},function(_,y){return answer.slice(y*n,y*n+n).filter(Boolean).length;});cols=Array.from({length:n},function(_,x){return answer.filter(function(v,i){return i%n===x&&v;}).length;});cells=Array(n*n).fill(0);}
  function activate(i){if(blocked()||i<0||i>=cells.length)return;history.push(cells.slice());cells[i]=(cells[i]+1)%3;cursor=i;flash=[];if(!reduce)waterFX.push({i:i,t:.5,life:.5});sound(cells[i]===1?460:330);if(valid(cells)){burst(320,330,green);win('舰队布局满足全部线索，用时 '+Math.ceil(elapsed)+' 秒。',Math.max(1,Math.ceil(elapsed)),true);}render();}
  function render(){hud(cells.filter(function(v){return v===1;}).length,'第 '+(stageIndex+1)+' 关 · '+(assisted?'辅助局':'独立推理'),n+' × '+n+' · 舰船不可接触（含对角）');document.getElementById('undo').disabled=!history.length;canvas.setAttribute('aria-label','战舰棋，第'+(stageIndex+1)+'关。当前第'+(Math.floor(cursor/n)+1)+'行，第'+(cursor%n+1)+'列，'+['未知','舰船','海水'][cells[cursor]]+'。');}
  function restart(){begin();n={easy:6,normal:7,hard:8}[activeOption]||7;answer=[];generate();history=[];cursor=0;flash=[];waterFX=[];scanTime=0;renderStages();render();status('按行列数量摆放舰队。点击循环：未知、舰船、海水。');}
  function step(dt){scanTime=Math.max(0,scanTime-dt);waterFX=waterFX.filter(function(f){f.t-=dt;return f.t>0;});}
  function hull(x,y,length,width,vertical){
    ctx.save();ctx.translate(x,y);if(vertical)ctx.rotate(Math.PI/2);
    // 一个连通直舰只画一条连续船体，艏、甲板与艉不再逐格重复。
    var l=length/2,w=width/2;
    ctx.beginPath();ctx.moveTo(-l,-w*.6);ctx.quadraticCurveTo(-l,-w,-l+7,-w);ctx.lineTo(l-width*.6,-w);ctx.quadraticCurveTo(l,-w*.55,l,0);ctx.quadraticCurveTo(l,w*.55,l-width*.6,w);ctx.lineTo(-l+7,w);ctx.quadraticCurveTo(-l,w,-l,w*.6);ctx.closePath();ctx.fillStyle='#526f7c';ctx.fill();ctx.strokeStyle='#344f60';ctx.lineWidth=1.5;ctx.stroke();
    line(-l+7,-w+3,l-width*.6,-w+3,'#b0c6c7',2);
    rect(-length*.2,-width*.28,Math.max(8,length*.3),width*.56,'#96adb1',3);
    rect(-length*.12,-width*.19,Math.max(5,Math.min(16,length*.18)),width*.38,'#dbe5dd',2);
    line(length*.12,0,length*.32,0,'#cedbd4',3);
    if(length>width*2){circle(-length*.32,0,3,'#becdca');circle(length*.32,0,3,'#becdca');}
    ctx.restore();
  }
  function wave(x,y,size,color){ctx.beginPath();ctx.moveTo(x-size,y);ctx.quadraticCurveTo(x-size*.5,y-4,x,y);ctx.quadraticCurveTo(x+size*.5,y+4,x+size,y);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();}
  function clue(x,y,filled,target){
    var ok=filled===target,over=filled>target;
    rect(x-22,y-17,44,34,over?'#f7ded7':ok?'#dae9df':'#f5f7ee',8);
    text(filled+'/'+target,x,y,16,over?'#a33e32':ok?'#3d6956':'#435e70');
    if(ok)line(x-7,y+12,x+7,y+12,'#638976',2);
    if(over){line(x+15,y-12,x+19,y-8,'#a33e32',1.5);line(x+19,y-12,x+15,y-8,'#a33e32',1.5);}
  }
  function draw(){
    ctx.clearRect(0,0,600,600);rect(0,0,600,600,'#eaf1f2',0);
    rect(19,15,562,62,'#f8faf5',12);text('第 '+(stageIndex+1)+' 关 · 舰队海图',35,34,18,'#385569','left');
    text('待布舰队',36,60,12,'#647c87','left');
    var hx=109;fleet.forEach(function(len){var w=16+len*10;hull(hx+w/2,59,w,12,false);text(len,hx+w+8,59,12,'#466375');hx+=w+25;});
    var s=440/n;
    // 海图、标水波纹与坐标始终使用原棋盘命中区域。
    rect(94,116,452,452,'#b6cdd5',9);
    cells.forEach(function(v,i){var x=100+i%n*s,y=122+Math.floor(i/n)*s;
      rect(x+1,y+1,s-2,s-2,v===2?'#d3e7ed':v===1?'#c2d9df':'#edf5f4',1);
      if(v===2){var drift=reduce?0:Math.sin(anim*1.4+i)*1.4;wave(x+s*.5,y+s*.45+drift,s*.18,'#75a2b5');wave(x+s*.5,y+s*.6+drift,s*.12,'#96bac7');}
      ctx.strokeStyle='#b4ccd3';ctx.lineWidth=1;ctx.strokeRect(x,y,s,s);
    });
    components(cells).forEach(function(g){
      var min=Math.min(...g),max=Math.max(...g),horizontal=g.every(function(i){return Math.floor(i/n)===Math.floor(min/n);}),vertical=g.every(function(i){return i%n===min%n;});
      if(horizontal||vertical){var x=100+(min%n+.5)*s,y=122+(Math.floor(min/n)+.5)*s;if(horizontal)x+=(g.length-1)*s/2;else y+=(g.length-1)*s/2;hull(x,y,g.length*s-s*.25,s*.52,!horizontal);}
      else g.forEach(function(i){hull(100+(i%n+.5)*s,122+(Math.floor(i/n)+.5)*s,s*.72,s*.5,false);});
    });
    // 游标四角与错误交叉独立于船色，键盘定位和矛盾提示不只依赖颜色。
    var x=100+cursor%n*s,y=122+Math.floor(cursor/n)*s;
    [[x+3,y+3,1,1],[x+s-3,y+3,-1,1],[x+3,y+s-3,1,-1],[x+s-3,y+s-3,-1,-1]].forEach(function(p){line(p[0],p[1],p[0]+p[2]*9,p[1],'#5366d6',2.5);line(p[0],p[1],p[0],p[1]+p[3]*9,'#5366d6',2.5);});
    flash.forEach(function(i){var x=100+i%n*s,y=122+Math.floor(i/n)*s;ctx.strokeStyle='#b35949';ctx.lineWidth=2.5;ctx.strokeRect(x+3,y+3,s-6,s-6);line(x+s-14,y+7,x+s-7,y+14,'#b35949',2);line(x+s-7,y+7,x+s-14,y+14,'#b35949',2);});
    waterFX.forEach(function(f){var t=1-f.t/f.life;ctx.globalAlpha=1-t;ctx.beginPath();ctx.ellipse(100+(f.i%n+.5)*s,122+(Math.floor(f.i/n)+.5)*s,s*(.15+t*.3),s*(.09+t*.2),0,0,Math.PI*2);ctx.strokeStyle='#5a9aa8';ctx.lineWidth=2;ctx.stroke();ctx.globalAlpha=1;});
    if(scanTime&&!reduce){ctx.globalAlpha=scanTime/.65*.25;rect(100,122+(1-scanTime/.65)*428,440,10,'#88b9ac',3);ctx.globalAlpha=1;}
    rows.forEach(function(v,y){clue(70,122+(y+.5)*s,cells.slice(y*n,y*n+n).filter(function(x){return x===1;}).length,v);});
    cols.forEach(function(v,x){clue(100+(x+.5)*s,98,cells.filter(function(v,i){return i%n===x&&v===1;}).length,v);});
    text('数字：已放 / 目标 · 点击：未知 → 舰船 → 海水',300,584,13,'#536e7c');
  }
  canvas.addEventListener('click',function(e){var p=point(e),s=440/n,x=Math.floor((p.x-100)/s),y=Math.floor((p.y-122)/s);if(x>=0&&x<n&&y>=0&&y<n)activate(y*n+x);});listen('undo',function(){if(history.length){cells=history.pop();assisted=true;flash=[];waterFX=[];render();}});listen('check',function(){flash=[];scanTime=.65;rows.forEach(function(v,y){var ids=cells.map(function(c,i){return Math.floor(i/n)===y&&c===1?i:-1;}).filter(function(i){return i>=0;});if(ids.length>v)flash.push(...ids);});cols.forEach(function(v,x){var ids=cells.map(function(c,i){return i%n===x&&c===1?i:-1;}).filter(function(i){return i>=0;});if(ids.length>v)flash.push(...ids);});cells.forEach(function(v,i){if(v!==1)return;var x=i%n,y=Math.floor(i/n);for(var dx of [-1,1])for(var dy of [-1,1])if(x+dx>=0&&x+dx<n&&y+dy>=0&&y+dy<n){var j=(y+dy)*n+x+dx;if(cells[j]===1)flash.push(i,j);}});components(cells).forEach(function(g){if(g.length>Math.max(...fleet)||!g.every(function(i){return i%n===g[0]%n;})&&!g.every(function(i){return Math.floor(i/n)===Math.floor(g[0]/n);}))flash.push(...g);});status(flash.length?'红色格存在行列超额、船体弯曲/过长或对角接触。':'暂未发现数量超限或非法接触；继续核对舰队长度与行列数量。');});listen('hint',function(){var i=cells.findIndex(function(v,i){return v!==(answer[i]?1:2);});if(i>=0){history.push(cells.slice());cells[i]=answer[i]?1:2;cursor=i;if(!reduce)waterFX.push({i:i,t:.5,life:.5});useHint('已按参考布局补一格；参考布局不是唯一合法答案，辅助局不写独立纪录。');if(valid(cells))complete('舰队已完成。');render();}});keyInput(function(e){gridKey(e,n,n*n,activate);});stages(12);restart();

  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
