/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:tower-defense';
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

  var canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');
  var types={arrow:{name:'箭塔',cost:60,damage:14,range:145,interval:.5,color:'#536e9b'},cannon:{name:'炮塔',cost:100,damage:34,range:130,interval:1.5,color:'#ac7659'},frost:{name:'冰塔',cost:80,damage:7,range:125,interval:.8,color:'#589baf'}};
  // 十列十行固定路线；距离按真实折线路程推进，不会抄近路穿过弯角。
  var path=[[0,1],[1,1],[2,1],[3,1],[3,2],[3,3],[2,3],[1,3],[1,4],[1,5],[2,5],[3,5],[4,5],[5,5],[5,4],[5,3],[5,2],[5,1],[6,1],[7,1],[8,1],[8,2],[8,3],[8,4],[8,5],[8,6],[7,6],[6,6],[5,6],[4,6],[4,7],[4,8],[5,8],[6,8],[7,8],[8,8],[9,8]];
  // 关卡路线由正交拐点展开，绘制、移动与命中共用同一份格坐标。
  function expandRoute(points){var route=[points[0].slice()];for(var i=1;i<points.length;i++){var previous=route[route.length-1],x=previous[0],y=previous[1],target=points[i];while(x!==target[0]||y!==target[1]){if(x!==target[0])x+=Math.sign(target[0]-x);else y+=Math.sign(target[1]-y);route.push([x,y]);}}return route;}
  var originalPath=path;
  var riverPath=expandRoute([[0,1],[7,1],[7,3],[2,3],[2,6],[8,6],[8,8],[9,8]]);
  var passPath=expandRoute([[0,1],[2,1],[2,7],[5,7],[5,2],[8,2],[8,8],[9,8]]);
  var levels=[
    {name:'草原前哨',route:originalPath,hp:1,gold:220,life:20,gap:.65,rest:8,note:'曲折长路，熟悉三类防御塔。'},
    {name:'河湾防线',route:riverPath,hp:1.12,gold:250,life:20,gap:.62,rest:8,note:'折返河湾，利用炮塔覆盖平行道路。'},
    {name:'山隘急行',route:passPath,hp:1.24,gold:280,life:18,gap:.58,rest:7,note:'狭长山隘，快速敌兵出现得更频繁。'},
    {name:'暮色回廊',route:originalPath.map(function(p){return [p[0],9-p[1]];}),hp:1.38,gold:300,life:18,gap:.55,rest:7,note:'道路上下翻转，重甲敌兵增多。'},
    {name:'霜河守卫',route:riverPath.map(function(p){return [p[0],9-p[1]];}),hp:1.52,gold:330,life:16,gap:.5,rest:6,note:'密集进攻，搭配冰塔与炮塔延缓推进。'},
    {name:'王城决战',route:passPath.map(function(p){return [p[0],9-p[1]];}),hp:1.7,gold:360,life:15,gap:.46,rest:6,note:'最终防线，第十波双首领，谨慎分配金币。'}
  ];
  var unlocked=Math.min(levels.length-1,Math.floor(number('unlocked',0)));
  var levelIndex=Math.min(unlocked,Math.floor(number('current',0))),levelWon=false;
  function recordKey(){return key+':best:'+difficulty+':level:'+levelIndex;}
  function renderLevels(){document.getElementById('level-list').innerHTML=levels.map(function(level,index){return '<button data-level="'+index+'" aria-pressed="'+(index===levelIndex)+'" aria-label="第'+(index+1)+'关 '+level.name+'"'+(index>unlocked?' disabled':'')+'>'+(index+1)+'</button>';}).join('');text('level-hint','已解锁 '+(unlocked+1)+'/'+levels.length+' 关；切换关卡重置本局。');text('level-description',levels[levelIndex].name+' · '+levels[levelIndex].note);}
  function selectLevel(index){if(!Number.isInteger(index)||index<0||index>unlocked||index>=levels.length)return false;levelIndex=index;save(key+':current',String(index));restart();return true;}
  function completeLevel(){levelWon=true;unlocked=Math.min(levels.length-1,Math.max(unlocked,levelIndex+1));save(key+':unlocked',String(unlocked));save(key+':completed:'+levelIndex,'1');renderLevels();finish('成功守住'+levels[levelIndex].name+'！'+(levelIndex<levels.length-1?'已解锁下一关。':'全部六关已通关！'));showCover(levelIndex<levels.length-1?'关卡通过':'全部通关',document.getElementById('status').textContent,levelIndex<levels.length-1?'下一关':'再玩一局');}
  var configs={easy:{hp:.8,life:25,gold:240},normal:{hp:1,life:20,gold:220},hard:{hp:1.3,life:15,gold:200}};
  var difficulty='normal',gold=0,life=20,wave=0,towers=[],enemies=[],effects=[],queue=0,spawnClock=0,active=false,selected=-1,cursor={x:4,y:4},last=Date.now(),best=0,intermission=10,visualTime=0;
  function text(node,value){var n=document.getElementById(node);if(n.textContent!==String(value))n.textContent=value;}
  function road(x,y){return path.some(function(p){return p[0]===x&&p[1]===y;});}
  function point(distance){var n=Math.min(path.length-2,Math.floor(distance/60)),f=Math.min(1,(distance-n*60)/60);return {x:30+(path[n][0]+(path[n+1][0]-path[n][0])*f)*60,y:30+(path[n][1]+(path[n+1][1]-path[n][1])*f)*60};}
  function stats(t){var b=types[t.type];return {damage:b.damage*(1+(t.level-1)*.75),range:b.range+(t.level-1)*12,interval:b.interval,upgrade:Math.round(b.cost*(.7+t.level*.35))};}
  function update(){text('score',gold);text('best',best||'—');text('detail','生命 '+life+' · '+(levelIndex+1)+'关 '+wave+'/10波 · '+(active?'敌人 '+(enemies.length+queue):ended?'战斗结束':'来袭 '+Math.ceil(intermission)+' 秒'));text('rule-label',({easy:'轻松',normal:'标准',hard:'挑战'}[difficulty])+' · '+levels[levelIndex].name+' · 十波防守');var t=towers[selected];text('upgrade',t?'升级 '+(t.level<3?stats(t).upgrade:'已满级'):'升级');document.getElementById('upgrade').disabled=blocked()||!t||t.level>=3||gold<stats(t).upgrade;document.getElementById('sell').disabled=blocked()||!t;}
  function buildAt(x,y){if(blocked())return false;cursor={x:x,y:y};var i=towers.findIndex(function(t){return t.x===x&&t.y===y;});if(i>=0){selected=i;status(types[towers[i].type].name+' · '+towers[i].level+'级；可升级或出售。');update();draw();return true;}selected=-1;var type=document.getElementById('tower-type').value;if(!types[type])type='arrow';if(x<0||x>9||y<0||y>9||road(x,y)){status('道路不能建塔，请选择草地。');return false;}if(gold<types[type].cost){status('金币不足，击败敌人或出售防御塔获得金币。');return false;}gold-=types[type].cost;towers.push({x:x,y:y,type:type,level:1,spent:types[type].cost,cooldown:0,angle:-Math.PI/2,recoil:0,born:visualTime});selected=towers.length-1;status('已建造'+types[type].name+'，敌兵将自动来袭。');sound(560);update();draw();return true;}
  function upgradeSelected(){if(blocked()||!towers[selected])return false;var t=towers[selected],cost=stats(t).upgrade;if(t.level>=3||gold<cost)return false;gold-=cost;t.spent+=cost;t.level++;status(types[t.type].name+'升级至'+t.level+'级。');update();draw();return true;}
  function sellSelected(){if(blocked()||!towers[selected])return false;var t=towers[selected],refund=Math.floor(t.spent*.7);gold+=refund;towers.splice(selected,1);selected=-1;status('已出售，返还 '+refund+' 金币。');update();draw();return true;}
  function nextWave(){if(blocked()||active||wave>=10)return false;wave++;queue=8+wave*2;spawnClock=0;active=true;intermission=0;status('第 '+wave+' 波来袭'+(wave%5===0?'，注意重甲首领。':'。'));update();return true;}
  function spawnEnemy(){var boss=wave%5===0&&queue===1,kind=(boss||(levelIndex===5&&wave===10&&queue===2))?'boss':queue%(levelIndex===3?3:4)===0?'armor':queue%(levelIndex===2?2:3)===0?'runner':'normal';var hp=(30+wave*17)*configs[difficulty].hp*levels[levelIndex].hp*(kind==='boss'?7:kind==='armor'?1.7:kind==='runner'?.65:1);enemies.push({distance:0,hp:hp,maxHp:hp,kind:kind,speed:kind==='boss'?30:kind==='runner'?68:kind==='armor'?35:45,armor:kind==='armor'||kind==='boss'?5:0,slow:0,reward:kind==='boss'?60:9+Math.floor(wave/2),damage:kind==='boss'?4:1,dead:false});queue--;}
  function damageEnemy(e,damage){if(e.dead)return;e.hp-=Math.max(1,damage-e.armor);e.flash=.14;if(e.hp<=0){e.dead=true;gold+=e.reward;var p=point(e.distance);effects.push({kind:'burst',x:p.x,y:p.y,color:'#deb26a',left:.45,total:.45});}}
  function shoot(t){var s=stats(t),origin={x:t.x*60+30,y:t.y*60+30};var targets=enemies.filter(function(e){var p=point(e.distance);return !e.dead&&Math.hypot(p.x-origin.x,p.y-origin.y)<=s.range;}).sort(function(a,b){return b.distance-a.distance;});if(!targets.length)return;var target=targets[0],p=point(target.distance);t.angle=Math.atan2(p.y-origin.y,p.x-origin.x);t.recoil=1;effects.push({kind:'shot',type:t.type,x:origin.x,y:origin.y,tx:p.x,ty:p.y,color:types[t.type].color,left:.24,total:.24});if(t.type==='cannon')effects.push({kind:'ring',x:p.x,y:p.y,color:'#d9a66a',left:.4,total:.4});if(t.type==='cannon'){enemies.forEach(function(e){var q=point(e.distance);if(Math.hypot(q.x-p.x,q.y-p.y)<=75)damageEnemy(e,s.damage);});}else{damageEnemy(target,s.damage);if(t.type==='frost')target.slow=2;}t.cooldown=s.interval;}
  function advance(dt){if(blocked())return;dt=Math.max(0,Math.min(.1,dt));visualTime+=dt;towers.forEach(function(t){t.recoil=Math.max(0,(t.recoil||0)-dt*6);});effects=effects.filter(function(e){e.left-=dt;return e.left>0;});if(!active&&wave<10){intermission=Math.max(0,intermission-dt);if(intermission<=0)nextWave();}if(active){spawnClock-=dt;if(queue>0&&spawnClock<=0){spawnEnemy();spawnClock=levels[levelIndex].gap;}towers.forEach(function(t){t.cooldown-=dt;if(t.cooldown<=0)shoot(t);});enemies.forEach(function(e){if(e.dead)return;e.flash=Math.max(0,(e.flash||0)-dt);e.distance+=e.speed*(e.slow>0?.5:1)*dt;e.slow=Math.max(0,e.slow-dt);if(e.distance>=(path.length-1)*60){e.dead=true;life=Math.max(0,life-e.damage);}});enemies=enemies.filter(function(e){return !e.dead;});if(life<=0){finish('城堡失守，到达第 '+wave+' 波。');}else if(queue===0&&enemies.length===0){active=false;gold+=30+wave*5;if(wave>best){best=wave;save(recordKey(),String(best));}if(wave===10)completeLevel();else{intermission=levels[levelIndex].rest;status('第 '+wave+' 波守住了！'+intermission+'秒后自动来袭，抓紧布防。');}}}update();draw();}
  function disk(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function routeStroke(width,color){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();path.forEach(function(p,i){if(i)ctx.lineTo(p[0]*60+30,p[1]*60+30);else ctx.moveTo(-30,p[1]*60+30);});ctx.lineTo(630,path[path.length-1][1]*60+30);ctx.stroke();}
  function draw(){
    ctx.clearRect(0,0,600,600);ctx.fillStyle='#dce7ce';ctx.fillRect(0,0,600,600);
    // 固定装饰位置，不在每帧随机，避免草地闪烁。道路多层描边形成柔和厚度。
    for(var i=0;i<145;i++){var gx=(i*137+19)%600,gy=(i*83+17)%600;if(!road(Math.floor(gx/60),Math.floor(gy/60))){disk(gx,gy,2+i%3,i%3?'#c9d9b6':'#edf2df');}}
    routeStroke(49,'#b7b993');routeStroke(43,'#e5d3aa');routeStroke(32,'#eddcba');
    for(i=0;i<path.length;i++){var pp=path[i];disk(pp[0]*60+18,pp[1]*60+39,1.6,'#d0bb92');}
    // 入口旗与出口城堡均为画布物件，不依赖文字图标或字体。
    ctx.save();ctx.translate(0,path[0][1]*60-60);ctx.fillStyle='#7a775d';ctx.fillRect(8,49,3,40);ctx.fillStyle='#b97560';ctx.beginPath();ctx.moveTo(11,49);ctx.lineTo(34,55);ctx.lineTo(11,65);ctx.fill();ctx.restore();ctx.save();ctx.translate(0,path[path.length-1][1]*60-480);
    ctx.fillStyle='rgba(67,79,55,.15)';ctx.beginPath();ctx.ellipse(568,531,27,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a59a7c';ctx.fillRect(547,486,42,42);ctx.fillStyle='#d9ceaf';ctx.fillRect(550,480,36,42);ctx.fillStyle='#87927a';for(i=0;i<3;i++)ctx.fillRect(546+i*16,471,12,17);ctx.fillStyle='#56644e';ctx.fillRect(563,504,12,18);ctx.fillStyle='#c38b61';ctx.fillRect(565,449,3,23);ctx.beginPath();ctx.moveTo(568,449);ctx.lineTo(587,455);ctx.lineTo(568,462);ctx.fill();ctx.restore();
    var current=towers[selected];if(current){var st=stats(current);disk(current.x*60+30,current.y*60+30,st.range,'rgba(83,102,214,.075)');ctx.strokeStyle='rgba(83,102,214,.35)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(current.x*60+30,current.y*60+30,st.range,0,Math.PI*2);ctx.stroke();}
    towers.forEach(function(t,index){var x=t.x*60+30,y=t.y*60+30,b=types[t.type],age=Math.min(1,Math.max(0,(visualTime-(t.born||0))/.22)),scale=.8+.2*age;ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle='rgba(49,65,46,.18)';ctx.beginPath();ctx.ellipse(2,19,25,9,0,0,Math.PI*2);ctx.fill();disk(0,5,23,'#a4ae94');disk(0,1,21,'#ece6d2');disk(0,-1,16,b.color);disk(-4,-6,7,t.type==='frost'?'#a6d9de':t.type==='cannon'?'#cb9a75':'#91a5bd');ctx.save();ctx.rotate(t.angle===undefined?-Math.PI/2:t.angle);ctx.translate(-(t.recoil||0)*4,0);if(t.type==='arrow'){ctx.strokeStyle='#374c69';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(4,-13);ctx.lineTo(15,0);ctx.lineTo(4,13);ctx.stroke();ctx.strokeStyle='#f3e2b9';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(24,0);ctx.stroke();}else if(t.type==='cannon'){ctx.fillStyle='#574f4b';ctx.fillRect(0,-8,26,16);ctx.fillStyle='#a8a29a';ctx.fillRect(21,-9,6,18);}else{ctx.fillStyle='#d8f1ed';ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(24,0);ctx.lineTo(0,10);ctx.lineTo(-6,0);ctx.closePath();ctx.fill();}ctx.restore();for(var l=0;l<t.level;l++)disk((l-(t.level-1)/2)*8,17,2.5,'#fdf9e8');if(index===selected){ctx.strokeStyle='#5366d6';ctx.lineWidth=2;ctx.strokeRect(-27,-27,54,54);}ctx.restore();});
    enemies.forEach(function(e){var p=point(e.distance),r=e.kind==='boss'?1.3:1,step=Math.sin(e.distance*.19)*3;ctx.save();ctx.translate(p.x,p.y);ctx.scale(r,r);ctx.fillStyle='rgba(65,57,45,.18)';ctx.beginPath();ctx.ellipse(1,11,14,6,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#5b514a';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-5,4);ctx.lineTo(-6+step,13);ctx.moveTo(5,4);ctx.lineTo(6-step,13);ctx.stroke();disk(0,-1,11,e.flash>0?'#f8e8ca':e.slow>0?'#82b7bf':e.kind==='armor'?'#818a8d':e.kind==='boss'?'#876984':'#b7775d');disk(0,-10,8,'#e4bb90');ctx.fillStyle=e.kind==='runner'?'#be965a':e.kind==='boss'?'#654e68':'#68756a';ctx.fillRect(-9,-18,18,8);if(e.kind==='armor'||e.kind==='boss'){ctx.fillStyle='#c1c3b3';ctx.fillRect(-11,-2,9,13);ctx.fillStyle='#939c92';ctx.fillRect(-9,0,5,9);}ctx.restore();ctx.fillStyle='#b3bca1';ctx.fillRect(p.x-17,p.y-29*r,34,4);ctx.fillStyle=e.hp/e.maxHp<.3?'#bd785f':'#64875f';ctx.fillRect(p.x-17,p.y-29*r,34*Math.max(0,e.hp/e.maxHp),4);});
    effects.forEach(function(e){var f=1-e.left/(e.total||.24);ctx.save();ctx.globalAlpha=Math.min(1,e.left*8);if(e.kind==='shot'){var x=e.x+(e.tx-e.x)*Math.min(1,f*1.5),y=e.y+(e.ty-e.y)*Math.min(1,f*1.5);disk(x,y-(e.type==='cannon'?Math.sin(f*Math.PI)*30:0),e.type==='cannon'?5:3,e.color);}else if(e.kind==='ring'){ctx.strokeStyle=e.color;ctx.lineWidth=4*(1-f);ctx.beginPath();ctx.arc(e.x,e.y,8+f*65,0,Math.PI*2);ctx.stroke();}else{for(var j=0;j<7;j++){var a=j*Math.PI*2/7;disk(e.x+Math.cos(a)*f*25,e.y+Math.sin(a)*f*25,3*(1-f)+1,e.color);}}ctx.restore();});
    // 仅选格时显示柔和边界，整张棋盘不铺高对比网格。
    ctx.strokeStyle='rgba(83,102,214,.5)';ctx.lineWidth=1.5;ctx.strokeRect(cursor.x*60+4,cursor.y*60+4,52,52);
    if(!active&&!ended&&!ready){ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(171,12,258,38);ctx.fillStyle='#53634f';ctx.font='600 17px sans-serif';ctx.textAlign='center';ctx.fillText('第 '+(wave+1)+' 波 · '+Math.ceil(intermission)+' 秒后自动来袭',300,37);}
  }
  function restart(){resetState();difficulty=configs[settings.option]?settings.option:'normal';gold=configs[difficulty].gold+levels[levelIndex].gold-220;life=Math.max(5,configs[difficulty].life+levels[levelIndex].life-20);path=levels[levelIndex].route;levelWon=false;wave=0;towers=[];enemies=[];effects=[];queue=0;active=false;selected=-1;intermission=10;visualTime=0;cursor={x:4,y:4};best=number('best:'+difficulty+':level:'+levelIndex,levelIndex===0?number('best:'+difficulty,0):0);renderLevels();last=Date.now();ready=true;status('开始后有10秒布防，敌兵随后自动来袭。');showCover('准备好了吗？','三种防御塔，守住十波敌人。','开始游戏');syncStart();update();draw();}
  canvas.addEventListener('click',function(e){var r=canvas.getBoundingClientRect();buildAt(Math.floor((e.clientX-r.left)*10/r.width),Math.floor((e.clientY-r.top)*10/r.height));});
  document.getElementById('upgrade').addEventListener('click',upgradeSelected);document.getElementById('sell').addEventListener('click',sellSelected);
  document.addEventListener('keydown',function(e){if(blocked()||e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;var dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(dirs[e.key]){e.preventDefault();cursor.x=Math.max(0,Math.min(9,cursor.x+dirs[e.key][0]));cursor.y=Math.max(0,Math.min(9,cursor.y+dirs[e.key][1]));draw();}else if(e.key==='Enter'){e.preventDefault();buildAt(cursor.x,cursor.y);}else if(/^[123]$/.test(e.key)){document.getElementById('tower-type').value=['arrow','cannon','frost'][Number(e.key)-1];}else if(e.key.toLowerCase()==='u')upgradeSelected();else if(e.key.toLowerCase()==='x')sellSelected();});
  document.getElementById('level-list').addEventListener('click',function(e){var button=e.target.closest('button[data-level]');if(button)selectLevel(Number(button.dataset.level));});
  onResume=function(){last=Date.now();update();};onOption=function(){status('难度已保存，新一局生效。');};
  function showCover(title,note,action){document.getElementById('game-cover').hidden=false;text('cover-title',title);text('cover-note',note);text('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){text('start',paused?'继续游戏':ended?(levelWon&&levelIndex<levels.length-1?'下一关':'再玩一局'):'开始游戏');document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended){if(levelWon&&levelIndex<levels.length-1)selectLevel(levelIndex+1);else restart();}if(paused)resume();ready=false;hideCover();syncStart();status(active?'游戏进行中。':'敌兵将在 '+Math.ceil(intermission)+' 秒后自动来袭，抓紧建塔。');update();}
  document.getElementById('start').addEventListener('click',startGame);document.getElementById('cover-action').addEventListener('click',startGame);document.getElementById('restart').addEventListener('click',restart);
  // 单一动画循环；暂停冻结战斗、倒计时与装饰动画，限制后台恢复时的时间跳跃。
  function frame(){var now=Date.now(),dt=(now-last)/1000;last=now;advance(dt);requestAnimationFrame(frame);}
  restart();requestAnimationFrame(frame);
}());
