/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:water-sort';
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


  var tubes=[],history=[],selected=-1,moves=0,cursor=0,assisted=false,plan=[],colors=['#d67f82','#6eabd0','#e1bd62','#8dbb91','#a88ac4','#e69c68','#63b9b1'];
  var pouring=null;
  var grid=document.getElementById('grid');
  function done(state){return state.every(function(t){return !t.length||t.length===4&&t.every(function(c){return c===t[0];});});}
  function pour(state,a,b){if(a===b||!state[a]||!state[b]||!state[a].length||state[b].length===4)return null;var src=state[a],dst=state[b],c=src[src.length-1];if(dst.length&&dst[dst.length-1]!==c)return null;var n=0;for(var i=src.length-1;i>=0&&src[i]===c;i--)n++;n=Math.min(n,4-dst.length);var next=clone(state);for(var k=0;k<n;k++)next[b].push(next[a].pop());return next;}
  function generate(count,steps){var state=Array.from({length:count},function(_,i){return [i,i,i,i];}).concat([[],[]]),route=[];for(var turn=0;turn<steps;turn++){var found=false;for(var attempt=0;attempt<200;attempt++){var a=Math.floor(Math.random()*state.length),b=Math.floor(Math.random()*state.length);if(a===b||!state[a].length||state[b].length===4)continue;var c=state[a][state[a].length-1],run=0;for(var k=state[a].length-1;k>=0&&state[a][k]===c;k--)run++;var n=1+Math.floor(Math.random()*Math.min(run,4-state[b].length)),next=clone(state);for(var j=0;j<n;j++)next[b].push(next[a].pop());var reverse=pour(next,b,a);if(reverse&&JSON.stringify(reverse)===JSON.stringify(state)){state=next;route.unshift([b,a]);found=true;break;}}if(!found)break;}return {state:state,route:route};}
  function solve(state){var visited=new Set(),budget=50000;function search(s,depth){if(depth>120)return null;if(done(s))return [];if(--budget<=0)return null;var key=s.map(function(t){return t.join('');}).sort().join('|');if(visited.has(key))return null;visited.add(key);for(var a=0;a<s.length;a++)for(var b=0;b<s.length;b++){if(!s[b].length&&s[a].every(function(c){return c===s[a][0];}))continue;var next=pour(s,a,b);if(next){var result=search(next,depth+1);if(result)return [[a,b]].concat(result);}}return null;}return search(state,0);}
  // 合并连续同色的显示带，仍保留数字标识，色觉差异也能辨认。
  function bands(t){var out=[];t.forEach(function(c){var last=out[out.length-1];if(last&&last.color===c)last.units++;else out.push({color:c,units:1});});return out;}
  function liquidHTML(groups){return groups.filter(function(g){return g.units>.001;}).map(function(g){return '<span class="liquid" style="--water:'+colors[g.color]+';--fill:'+(g.units*25)+'%">'+(g.units>=.5?'<em>'+ (g.color+1) +'</em>':'')+'</span>';}).join('');}
  function syncActions(){document.getElementById('undo').disabled=!!pouring||!history.length||ended;document.getElementById('hint').disabled=!!pouring||ended;}
  function render(){
    grid.innerHTML='';grid.style.setProperty('--tube-cols',Math.ceil(tubes.length/2));
    tubes.forEach(function(t,i){
      var b=document.createElement('button'),full=t.length===4&&t.every(function(c){return c===t[0];});
      b.className='tube'+(selected===i?' selected':'')+(cursor===i?' cursor':'')+(full?' complete':'');b.dataset.tube=i;b.dataset.colors=t.join(',');
      b.setAttribute('aria-pressed',String(selected===i));
      b.setAttribute('aria-label','第'+(i+1)+'管，'+(t.length?'从底到顶：'+t.map(function(c){return c+1;}).join('、'):'空管')+(full?'，已归位':''));
      b.innerHTML='<span class="glass" aria-hidden="true"><span class="liquid-well">'+liquidHTML(bands(t))+'</span></span><span class="tube-label" aria-hidden="true">'+(i+1)+' · '+(selected===i?'已选':full?'归位':t.length?'试管':'空管')+'</span>';
      grid.appendChild(b);
    });
    hud(moves,'第 '+(stageIndex+1)+' 关 · '+(assisted?'提示局':'独立解题'),'容量4 · '+(tubes.length-2)+'色 · 同色液体归入一管');syncActions();
  }
  function stopFrame(p){if(p&&p.frame!==null){window.cancelAnimationFrame(p.frame);p.frame=null;}}
  function clearPour(){var p=pouring;if(!p)return;stopFrame(p);if(p.overlay)p.overlay.remove();if(p.source)p.source.classList.remove('is-source');pouring=null;grid.setAttribute('aria-busy','false');}
  // 一次倒水作为原子操作：动画结束才写盘面/历史/成绩，重开会丢弃未提交动作。
  function commitPour(p){
    if(pouring!==p)return;
    clearPour();history.push(p.before);tubes=p.next;moves++;selected=-1;cursor=p.to;
    if(done(tubes)){if(!assisted)record(moves,true);complete('全部颜色归位，使用 '+moves+' 步。');}
    else status('已倒入第 '+(p.to+1)+' 管，继续整理颜色。');
    render();var target=grid.querySelector&&grid.querySelector('[data-tube="'+p.to+'"]');if(target)target.classList.add('settled');sound(520+p.color*55);
  }
  function measurePour(p){
    var board=grid.parentNode.getBoundingClientRect(),from=p.source.querySelector('.glass').getBoundingClientRect(),to=p.target.querySelector('.glass').getBoundingClientRect(),well=p.target.querySelector('.liquid-well').getBoundingClientRect();
    p.width=board.width;p.height=board.height;
    p.fromBox={x:from.x-board.x+from.width/2,y:from.y-board.y,w:from.width,h:from.height};
    p.toBox={x:to.x-board.x+to.width/2,y:to.y-board.y,w:to.width,h:to.height,wellY:well.y-board.y,wellH:well.height};
  }
  function ease(t){return t*t*(3-2*t);}
  function mix(a,b,t){return a+(b-a)*t;}
  function polygonArea(points){var sum=0;points.forEach(function(p,i){var n=points[(i+1)%points.length];sum+=p.x*n.y-n.x*p.y;});return Math.abs(sum)/2;}
  function belowLine(points,y){
    var out=[];points.forEach(function(a,i){var b=points[(i+1)%points.length],inside=a.y>=y,next=b.y>=y;if(inside)out.push(a);if(inside!==next){var t=(y-a.y)/(b.y-a.y);out.push({x:mix(a.x,b.x,t),y:y});}});return out;
  }
  // 倾斜玻璃的截面按面积找水平液面，避免液体像色块一样随瓶身斜转。
  function waterLevel(points,fraction){
    var ys=points.map(function(p){return p.y;}),low=Math.min.apply(null,ys),high=Math.max.apply(null,ys),area=polygonArea(points)*Math.max(0,Math.min(1,fraction));
    for(var i=0;i<22;i++){var mid=(low+high)/2;if(polygonArea(belowLine(points,mid))>area)low=mid;else high=mid;}return (low+high)/2;
  }
  function paintPour(p){
    measurePour(p);
    var progress=Math.min(1,p.elapsed/p.duration),from=p.fromBox,to=p.toBox;
    var transfer=Math.max(0,Math.min(1,(progress-.24)/.52)),q=ease(transfer),dir=to.x>p.width/2?1:-1,tilt=dir*Math.PI*.32;
    var lift=progress<.24?ease(progress/.24):progress>.76?1-ease((progress-.76)/.24):1;
    var endX=to.x-Math.cos(tilt)*dir*from.w/2,endY=Math.max(from.w*.6+5,to.y-12-Math.abs(Math.sin(tilt))*from.w/2);
    var angle=tilt*lift,ox=mix(from.x,endX,lift),oy=mix(from.y,endY,lift),cos=Math.cos(angle),sin=Math.sin(angle);
    function point(x,y){return {x:ox+x*cos-y*sin,y:oy+x*sin+y*cos};}
    var w=from.w-5,h=from.h-5,shape=[[-w/2,6],[w/2,6]];
    for(var arc=0;arc<=12;arc++){var theta=arc*Math.PI/12;shape.push([Math.cos(theta)*w/2,h-w*.35+Math.sin(theta)*w*.35]);}
    var points=shape.map(function(v){return point(v[0],v[1]);});
    var polygon=points.map(function(v){return v.x.toFixed(2)+','+v.y.toFixed(2);}).join(' '),groups=bands(p.before[p.from]);groups[groups.length-1].units-=p.amount*q;
    var cumulative=0,water='';groups.forEach(function(g){if(g.units<=.001)return;var bottom=waterLevel(points,cumulative/4);cumulative+=g.units;var top=waterLevel(points,cumulative/4);water+='<rect x="0" y="'+top+'" width="'+p.width+'" height="'+(bottom-top+.25)+'" fill="'+colors[g.color]+'"/><path d="M0 '+top+'H'+p.width+'" stroke="#ffffff70" stroke-width="1.5"/>';});
    var dest=bands(p.before[p.to]);if(q>0){var last=dest[dest.length-1];if(last&&last.color===p.color)last.units+=p.amount*q;else dest.push({color:p.color,units:p.amount*q});}
    p.target.querySelector('.liquid-well').innerHTML=liquidHTML(dest);
    var mouth=point(dir*w/2,2),surface=to.wellY+to.wellH*(1-(p.before[p.to].length+p.amount*q)/4),stream='';
    if(progress>=.24&&progress<=.76){
      var sw=Math.max(2,Math.min(6,w*.1)),ripple=3+Math.abs(Math.sin(q*45))*to.w*.12;
      var d='M'+mouth.x+' '+mouth.y+' Q'+to.x+' '+mouth.y+' '+to.x+' '+(to.y+8)+' L'+to.x+' '+surface;
      stream='<path d="'+d+'" fill="none" stroke="'+colors[p.color]+'" stroke-width="'+sw+'" stroke-linecap="round"/><path d="'+d+'" fill="none" stroke="#ffffff70" stroke-width="'+(sw*.25)+'"/><ellipse cx="'+to.x+'" cy="'+surface+'" rx="'+ripple+'" ry="2.3" fill="none" stroke="#ffffffa0" stroke-width="1.5"/>';
    }
    var outline=[points[0]].concat(points.slice(1).reverse()).map(function(v,i){return (i?'L':'M')+v.x+' '+v.y;}).join(' '),shineA=point(-w*.35,10),shineB=point(-w*.35,h-w*.4);
    p.overlay.innerHTML='<svg viewBox="0 0 '+p.width+' '+p.height+'" aria-hidden="true"><defs><clipPath id="water-pour-clip"><polygon points="'+polygon+'"/></clipPath></defs><g class="pour-glass"><polygon points="'+polygon+'" fill="#f5faf866"/><g clip-path="url(#water-pour-clip)">'+water+'</g><path d="'+outline+'" fill="none" stroke="#9db2b6" stroke-width="2.2" stroke-linejoin="round"/><path d="M'+shineA.x+' '+shineA.y+'L'+shineB.x+' '+shineB.y+'" stroke="#ffffff80" stroke-width="3" stroke-linecap="round"/><ellipse cx="'+ox+'" cy="'+oy+'" rx="'+(w/2+2)+'" ry="3" transform="rotate('+(angle*180/Math.PI)+' '+ox+' '+oy+')" fill="#f5faf866" stroke="#9db2b6" stroke-width="1.6"/></g>'+stream+'</svg>';
  }
  function pourFrame(now){
    var p=pouring;if(!p)return;p.frame=null;if(blocked()){p.last=0;return;}
    if(p.last)p.elapsed+=Math.min(50,Math.max(0,now-p.last));p.last=now;
    if(p.elapsed>=p.duration){commitPour(p);return;}paintPour(p);p.frame=window.requestAnimationFrame(pourFrame);
  }
  function startPour(from,to,next){
    var p={from:from,to:to,before:clone(tubes),next:next,color:tubes[from][tubes[from].length-1],amount:tubes[from].length-next[from].length,elapsed:0,last:0,duration:1100,frame:null};
    pouring=p;
    // 减少动态效果偏好直接完成，不依赖动画回调推进规则；无绘图环境同样可运行。
    if(typeof window.requestAnimationFrame!=='function'||window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){commitPour(p);return;}
    p.source=grid.querySelector('[data-tube="'+from+'"]');p.target=grid.querySelector('[data-tube="'+to+'"]');
    p.overlay=document.createElement('div');p.overlay.className='pour-overlay';p.overlay.setAttribute('aria-hidden','true');grid.parentNode.appendChild(p.overlay);
    measurePour(p);p.source.classList.add('is-source');grid.setAttribute('aria-busy','true');syncActions();
    status('正在将第 '+(from+1)+' 管倒向第 '+(to+1)+' 管。');paintPour(p);p.frame=window.requestAnimationFrame(pourFrame);
  }
  function activate(i){
    if(blocked()||pouring||!Number.isInteger(i)||i<0||i>=tubes.length)return;
    if(selected<0){if(tubes[i].length)selected=i;}
    else {var next=pour(tubes,selected,i);if(next){startPour(selected,i,next);return;}else{selected=selected===i?-1:tubes[i].length?i:-1;status('只能倒入空管或顶层颜色相同且有空间的管。');}}
    cursor=i;render();
  }
  function restart(){clearPour();resetState();moves=0;history=[];selected=-1;cursor=0;assisted=false;var n={easy:3,normal:5,hard:7}[activeOption]||5,g;for(var t=0;t<20;t++){g=generate(n,30+stageIndex*6);if(!done(g.state))break;}tubes=g.state;plan=g.route;renderStages();render();status('先选源管，再选目标管；一次自动倾倒连续同色液体。');}
  grid.addEventListener('click',function(e){var b=e.target.closest('[data-tube]');if(b)activate(Number(b.dataset.tube));});
  grid.addEventListener('keydown',function(e){if(pouring){if(/^(Arrow|Enter| )/.test(e.key))e.preventDefault();return;}gridKey(e,Math.ceil(tubes.length/2),tubes.length,activate);});
  document.getElementById('undo').addEventListener('click',function(){if(blocked()||pouring||!history.length)return;tubes=history.pop();moves--;selected=-1;render();});
  document.getElementById('hint').addEventListener('click',function(){if(blocked()||pouring)return;var route=history.length?solve(tubes):plan;if(!route||!route.length){status('搜索预算内未找到路线，可撤销或重开。');return;}assisted=true;selected=route[0][0];cursor=route[0][1];status('将第 '+(selected+1)+' 管倒向第 '+(cursor+1)+' 管。');render();});
  onPause=function(){if(pouring){stopFrame(pouring);pouring.last=0;}};
  onResume=function(){if(pouring){measurePour(pouring);pouring.last=0;pouring.frame=window.requestAnimationFrame(pourFrame);}};
  window.addEventListener('resize',function(){if(pouring){measurePour(pouring);paintPour(pouring);}});
  stages(20);restart();


  function showCover(title,note,action){var c=document.getElementById('game-cover');c.hidden=false;write('cover-title',title);write('cover-note',note);write('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){write('start',paused?'继续游戏':ended?(won&&stageIndex<stageCount-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(won&&stageIndex<stageCount-1)stageIndex++;restart();}if(paused)resume();ready=false;hideCover();syncStart();status('游戏进行中。');onStart();}
  document.getElementById('start').addEventListener('click',startGame);
  document.getElementById('cover-action').addEventListener('click',startGame);
  document.getElementById('restart').addEventListener('click',function(){restart();syncStart();});
  ready=true;showCover('准备好了吗？','点击开始游戏，享受轻松一局。','开始游戏');syncStart();
}());
