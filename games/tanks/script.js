/* 游戏私有规则、状态与存储；公共界面由shared入口处理，闭包隔离业务状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:tanks';
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
  /* 15×15 基地防守地图：0地面、1可破坏砖墙、2不可破坏钢墙。 */
  var CELL = 40;
  // 每关六波敌军；地图、增援数量与速度按关卡递进，第一关保留原版战场。
  var levels = [
    {name:'基地初战',brick:[],steel:[]},
    {name:'双翼防线',brick:[[4,1],[4,2],[4,12],[4,13],[8,4],[8,10]],steel:[]},
    {name:'中央堡垒',brick:[[4,6],[4,8],[6,6],[6,8],[8,6],[8,8]],steel:[[7,7]]},
    {name:'交叉火线',brick:[[4,4],[4,5],[4,9],[4,10],[8,1],[8,13]],steel:[[8,7]]},
    {name:'钢铁回廊',brick:[[4,2],[4,12],[8,4],[8,10]],steel:[[4,6],[4,8],[8,6],[8,8]]},
    {name:'南线告急',brick:[[10,1],[10,2],[10,4],[10,10],[10,12],[10,13]],steel:[[7,5],[7,9]]},
    {name:'三路突袭',brick:[[4,1],[4,3],[4,11],[4,13],[8,3],[8,11]],steel:[[4,5],[4,9],[8,5],[8,9]]},
    {name:'密林据点',brick:[[2,2],[2,3],[2,11],[2,12],[6,1],[6,2],[6,12],[6,13],[10,6],[10,8]],steel:[[7,6],[7,8]]},
    {name:'环形工事',brick:[[4,5],[4,6],[4,8],[4,9],[8,5],[8,6],[8,8],[8,9]],steel:[[5,5],[7,5],[5,9],[7,9]]},
    {name:'双塔要塞',brick:[[2,4],[2,10],[5,2],[5,12],[9,4],[9,10]],steel:[[4,4],[4,10],[8,4],[8,10],[10,7]]},
    {name:'纵深防御',brick:[[2,1],[2,3],[2,11],[2,13],[8,2],[8,4],[8,10],[8,12],[10,5],[10,9]],steel:[[4,5],[6,5],[8,5],[4,9],[6,9],[8,9]]},
    {name:'最后堡垒',brick:[[2,2],[2,4],[2,10],[2,12],[4,2],[4,12],[10,2],[10,4],[10,10],[10,12]],steel:[[4,6],[4,8],[6,6],[6,8],[8,4],[8,10],[10,7]]}
  ];
  var unlocked = Math.min(levels.length-1,Math.floor(number('unlocked',0)));
  var levelIndex = Math.min(unlocked,Math.floor(number('current',0)));
  var levelWon = false;
  var directions = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
  var map = [];
  var player;
  var enemies = [];
  var bullets = [];
  var base = { x:300, y:540, alive:true };
  var held = { up:false,down:false,left:false,right:false,fire:false };
  var score = 0;
  var lives = 3;
  var wave = 1;
  var spawned = 0;
  var defeated = 0;
  var spawnClock = 0;
  var previousFrame = 0;
  var difficulty = settings.option;
  var best = 0;
  // 所有效果使用游戏内秒数，暂停、菜单和页面隐藏时不会消耗剩余时间。
  var pickups = [];
  var effects = { rapid:0, freeze:0 };
  var killCount = 0;
  var hudClock = 0;
  var powerTypes = ['shield','life','rapid','freeze','bomb'];
  var powerNames = { shield:'护盾',life:'生命补给',rapid:'速射',freeze:'冻结',bomb:'爆破' };
  var powerSymbols = { shield:'护',life:'生',rapid:'速',freeze:'冻',bomb:'爆' };
  var canvas = document.getElementById('canvas');
  var context = canvas.getContext('2d');

  function quota() { return 3 + wave + Math.floor(levelIndex/3); }
  function bestKey() { return key+':best:'+difficulty+(levelIndex ? ':level:'+levelIndex : ''); }
  function renderLevels() {
    document.getElementById('panel-title').textContent='第 '+(levelIndex+1)+' 关 · '+levels[levelIndex].name;
    document.getElementById('level-list').innerHTML=levels.map(function(level,index){return '<button data-level="'+index+'" aria-pressed="'+(index===levelIndex)+'" aria-label="第'+(index+1)+'关 '+level.name+'"'+(index>unlocked?' disabled':'')+'>'+(index+1)+'</button>';}).join('');
    document.getElementById('level-hint').textContent='已解锁 '+(unlocked+1)+'/'+levels.length+' 关，每关六波。切换关卡会重开。';
  }
  function buildMap() {
    map = Array.from({length:15},function(){return Array(15).fill(0);});
    // 留出上下贯通路线及出生区，地图障碍只影响走位，不封死战场。
    [[3,3],[3,4],[3,10],[3,11],[5,6],[5,7],[5,8],[7,2],[7,3],[7,11],[7,12],[9,5],[9,9],[11,2],[11,3],[11,11],[11,12],[12,6],[12,7],[12,8],[13,6],[13,8]].forEach(function(p){map[p[0]][p[1]]=1;});
    [[6,4],[6,10],[9,2],[9,12]].forEach(function(p){map[p[0]][p[1]]=2;});
    levels[levelIndex].brick.forEach(function(p){if(map[p[0]][p[1]]!==2)map[p[0]][p[1]]=1;});
    levels[levelIndex].steel.forEach(function(p){map[p[0]][p[1]]=2;});
  }
  function near(a,b,distance) { return Math.abs(a.x-b.x)<distance&&Math.abs(a.y-b.y)<distance; }
  function terrain(x,y,radius) {
    if(x-radius<0||x+radius>600||y-radius<0||y+radius>600)return true;
    var left=Math.floor((x-radius)/CELL),right=Math.floor((x+radius-.01)/CELL);
    var top=Math.floor((y-radius)/CELL),bottom=Math.floor((y+radius-.01)/CELL);
    for(var r=top;r<=bottom;r++)for(var c=left;c<=right;c++)if(map[r][c])return true;
    return base.alive&&Math.abs(x-base.x)<radius+17&&Math.abs(y-base.y)<radius+17;
  }
  function canMove(tank,x,y) {
    if(terrain(x,y,14))return false;
    var candidate={x:x,y:y};
    if(tank!==player&&near(candidate,player,30))return false;
    return !enemies.some(function(other){return other!==tank&&near(candidate,other,30);});
  }
  function moveTank(tank,dt) {
    var delta=directions[tank.direction];
    var x=tank.x+delta[0]*tank.speed*dt;var y=tank.y+delta[1]*tank.speed*dt;
    if(!canMove(tank,x,y))return false;
    tank.x=x;tank.y=y;return true;
  }
  function fire(tank,enemy) {
    if(blocked()||tank.cooldown>0)return false;
    var delta=directions[tank.direction];
    bullets.push({x:tank.x+delta[0]*20,y:tank.y+delta[1]*20,dx:delta[0],dy:delta[1],enemy:enemy,speed:enemy?220:340});
    tank.cooldown=enemy?Math.max(.9,(difficulty==='easy'?2.4:1.7)-levelIndex*.035)+Math.random()*.6:(effects.rapid>0?.1:.28);
    if(!enemy)sound(480);
    return true;
  }
  function update() {
    if(score>best){best=score;save(bestKey(),String(best));}
    updateScore(score,best);
    document.getElementById('detail').textContent='第 '+(levelIndex+1)+' 关 · 生命 '+lives+' · 波次 '+wave+'/6 · 击破 '+defeated+'/'+quota();
    document.getElementById('rule-label').textContent=({easy:'轻松',normal:'标准',hard:'挑战'}[difficulty])+' · 基地'+(base.alive?'完好':'被毁')+' · 当前敌军 '+enemies.length;
    var buffs=[];
    if(player&&player.invulnerable>0)buffs.push('无敌 '+Math.ceil(player.invulnerable)+'秒');
    if(effects.rapid>0)buffs.push('速射 '+Math.ceil(effects.rapid)+'秒');
    if(effects.freeze>0)buffs.push('冻结 '+Math.ceil(effects.freeze)+'秒');
    document.getElementById('power-status').textContent=(buffs.length?buffs.join(' · '):'击破敌军可掉落道具，接触拾取')+(pickups.length?' · 场上 '+pickups.length+' 个':'');
  }
  function dropPower(enemy) {
    killCount+=1;
    // 第一次击破与每第三次击破必掉，其余有 30% 机会；最多同时存在三个。
    if(pickups.length>=3||!(killCount===1||killCount%3===0||Math.random()<.3))return;
    var type=powerTypes[Math.floor(Math.random()*powerTypes.length)];
    pickups.push({x:enemy.x,y:enemy.y,type:type,remaining:18});
  }
  function applyPower(type) {
    if(type==='shield')player.invulnerable=Math.max(player.invulnerable,8);
    else if(type==='life')lives=Math.min(5,lives+1);
    else if(type==='rapid'){effects.rapid=10;player.cooldown=0;}
    else if(type==='freeze')effects.freeze=6;
    else if(type==='bomb'){
      // 爆破击破当前已生成的敌军，正常计分但不继续掉落，避免连锁刷道具。
      score+=enemies.length*100;defeated+=enemies.length;enemies=[];
      bullets.forEach(function(b){if(b.enemy)b.removed=true;});
    }
    sound(880);status('拾取'+powerNames[type]+'！'+(type==='life'?'生命上限为 5 条。':''));update();
  }
  function powerStep(dt) {
    effects.rapid=Math.max(0,effects.rapid-dt);
    effects.freeze=Math.max(0,effects.freeze-dt);
    var remaining=[];
    pickups.forEach(function(item){
      item.remaining-=dt;
      if(item.remaining<=0)return;
      if(near(item,player,30))applyPower(item.type);
      else remaining.push(item);
    });
    pickups=remaining;
    hudClock+=dt;if(hudClock>=.2){hudClock=0;update();}
  }
  function clearInput(){Object.keys(held).forEach(function(key){held[key]=false;});}
  function lose(note){clearInput();finish(note);showCover('防守结束',note+' 本局 '+score+' 分。','再玩一局');update();}
  function hitPlayer() {
    if(player.invulnerable>0)return;
    lives-=1;
    if(lives<=0){lose('三条生命已用完。');return;}
    // 从空闲且不与敌军重叠的出生点复活，并清除附近子弹避免连续扣血。
    var points=[{x:220,y:540},{x:380,y:540},{x:220,y:580},{x:380,y:580}];
    var spawn=points.find(function(p){return !terrain(p.x,p.y,14)&&!enemies.some(function(e){return near(p,e,34);});});
    if(!spawn){lose('复活区域被敌军占领。');return;}
    player.x=spawn.x;player.y=spawn.y;player.direction='up';player.invulnerable=2.5;
    bullets.forEach(function(b){if(b.enemy&&near(b,player,90))b.removed=true;});
    status('损失一条生命，复活后短暂无敌。');update();
  }
  function spawnEnemy() {
    if(spawned>=quota()||enemies.length>=Math.min(4,3+Math.floor(levelIndex/6)))return;
    var points=[100,300,500].filter(function(x){return !enemies.some(function(e){return near({x:x,y:24},e,48);})&&!near({x:x,y:24},player,48);});
    if(!points.length)return;
    enemies.push({x:points[Math.floor(Math.random()*points.length)],y:24,direction:'down',speed:(difficulty==='easy'?42:difficulty==='hard'?68:54)+wave*2+levelIndex*1.5,cooldown:1.5,think:0,shield:1});
    spawned+=1;update();
  }
  function chooseDirection(enemy) {
    var target=Math.random()<.65?base:player;
    var horizontal=target.x<enemy.x?'left':'right';var vertical=target.y<enemy.y?'up':'down';
    var choices=Math.abs(target.y-enemy.y)>Math.abs(target.x-enemy.x)?[vertical,horizontal]:[horizontal,vertical];
    if(Math.random()<.25)choices=['up','down','left','right'].sort(function(){return Math.random()-.5;});
    var selected=choices.find(function(name){var d=directions[name];return canMove(enemy,enemy.x+d[0]*8,enemy.y+d[1]*8);});
    enemy.direction=selected||['up','down','left','right'][Math.floor(Math.random()*4)];
    enemy.think=.6+Math.random()*.8;
  }
  function bulletStep(bullet,dt) {
    bullet.x+=bullet.dx*bullet.speed*dt;bullet.y+=bullet.dy*bullet.speed*dt;
    if(bullet.x<0||bullet.x>=600||bullet.y<0||bullet.y>=600)return false;
    var row=Math.floor(bullet.y/CELL);var col=Math.floor(bullet.x/CELL);
    if(map[row][col]){if(map[row][col]===1)map[row][col]=0;return false;}
    // 玩家火力不会伤害基地，敌方子弹击中基地则立即结束。
    if(bullet.enemy&&base.alive&&near(bullet,base,19)){base.alive=false;lose('基地被摧毁。');return false;}
    if(bullet.enemy){if(near(bullet,player,16)){hitPlayer();return false;}}
    else {
      for(var i=0;i<enemies.length;i++)if(near(bullet,enemies[i],16)){
        if(enemies[i].shield>0)return false;
        var destroyed=enemies[i];enemies.splice(i,1);defeated+=1;score+=100;dropPower(destroyed);sound(700);update();return false;
      }
    }
    return true;
  }
  function physics(dt) {
    if(blocked())return;
    player.cooldown=Math.max(0,player.cooldown-dt);player.invulnerable=Math.max(0,player.invulnerable-dt);
    powerStep(dt);
    var active=['up','down','left','right'].filter(function(name){return held[name];});
    if(active.length){player.direction=active[active.length-1];moveTank(player,dt);}
    if(held.fire)fire(player,false);
    if(effects.freeze<=0)spawnClock-=dt;
    if(effects.freeze<=0&&spawnClock<=0){spawnEnemy();spawnClock=1.6;}
    enemies.forEach(function(enemy){
      if(effects.freeze>0)return;
      enemy.shield=Math.max(0,enemy.shield-dt);enemy.cooldown=Math.max(0,enemy.cooldown-dt);enemy.think-=dt;
      if(enemy.think<=0)chooseDirection(enemy);
      if(!moveTank(enemy,dt))enemy.think=0;
      if(enemy.cooldown<=0)fire(enemy,true);
    });
    // 小步长子弹检测；循环中不重新赋值 bullets，避免复活清弹影响迭代状态。
    var survivors=[];
    bullets.slice().forEach(function(bullet){if(ended||bullet.removed)return;if(bullet.enemy&&effects.freeze>0)survivors.push(bullet);else if(bulletStep(bullet,dt))survivors.push(bullet);});
    bullets=survivors.filter(function(bullet){return !bullet.removed;});
    if(!ended&&defeated>=quota()&&!enemies.length){
      if(wave===6){
        levelWon=true;unlocked=Math.min(levels.length-1,Math.max(unlocked,levelIndex+1));
        save(key+':unlocked',String(unlocked));save(key+':completed:'+levelIndex,'1');
        finish('本关六波敌军全部击退成功！');
        showCover(levelIndex===levels.length-1?'全部通关！':'关卡完成！',score+' 分 · 基地完好',levelIndex<levels.length-1?'下一关':'重玩本关');
        clearInput();renderLevels();syncStart();
      }
      else {wave+=1;spawned=0;defeated=0;spawnClock=2;bullets=[];status('第 '+wave+' 波即将到来，保护基地！');update();}
    }
  }
  function tankDraw(tank,color,shield) {
    context.save();context.translate(tank.x,tank.y);
    var rotation={up:0,right:Math.PI/2,down:Math.PI,left:-Math.PI/2}[tank.direction];context.rotate(rotation);
    context.fillStyle='#455548';context.fillRect(-16,-17,7,34);context.fillRect(9,-17,7,34);
    context.fillStyle=color;context.fillRect(-10,-13,20,26);context.fillRect(-3,-25,6,20);
    context.fillStyle='#fffefa77';context.fillRect(-6,-6,12,12);context.restore();
    if(shield>0){context.strokeStyle='#c39743';context.lineWidth=2;context.beginPath();context.arc(tank.x,tank.y,23,0,Math.PI*2);context.stroke();}
  }
  function draw() {
    context.fillStyle='#e3eadc';context.fillRect(0,0,600,600);
    map.forEach(function(row,r){row.forEach(function(type,c){
      if(!type)return;
      context.fillStyle=type===1?'#bc8b60':'#7d8b86';context.fillRect(c*CELL+1,r*CELL+1,38,38);
      context.strokeStyle=type===1?'#8d6545':'#52675d';context.lineWidth=2;
      if(type===1){context.strokeRect(c*CELL+2,r*CELL+2,36,18);context.strokeRect(c*CELL+2,r*CELL+20,18,18);}
      else context.strokeRect(c*CELL+7,r*CELL+7,26,26);
    });});
    context.fillStyle=base.alive?'#245c4a':'#a33e32';context.fillRect(283,523,34,34);
    context.fillStyle='#fffefa';context.font='22px sans-serif';context.textAlign='center';context.fillText(base.alive?'★':'×',300,548);
    pickups.forEach(function(item){
      context.fillStyle=item.remaining<4?'#f5dd9c':'#fff7df';context.fillRect(item.x-15,item.y-15,30,30);
      context.strokeStyle='#a47834';context.lineWidth=2;context.strokeRect(item.x-15,item.y-15,30,30);
      context.fillStyle='#725039';context.font='bold 18px "Microsoft YaHei",sans-serif';context.textAlign='center';context.fillText(powerSymbols[item.type],item.x,item.y+6);
    });
    tankDraw(player,'#245c4a',player.invulnerable);enemies.forEach(function(e){tankDraw(e,effects.freeze>0?'#648ca7':'#ad6861',e.shield);});
    bullets.forEach(function(b){context.fillStyle=b.enemy?'#a33e32':'#fffefa';context.beginPath();context.arc(b.x,b.y,4,0,Math.PI*2);context.fill();});
  }
  function frame(now) {
    var dt=previousFrame?Math.min((now-previousFrame)/1000,.05):0;previousFrame=now;
    if(!blocked()){var count=Math.max(1,Math.ceil(dt/(1/120)));for(var i=0;i<count&&!blocked();i++)physics(dt/count);draw();}
    requestAnimationFrame(frame);
  }
  function restart() {
    clearInput();resetState();difficulty=settings.option;levelWon=false;best=number('best:'+difficulty+(levelIndex?':level:'+levelIndex:''),0);
    score=0;lives=3;wave=1;spawned=0;defeated=0;spawnClock=1;previousFrame=0;enemies=[];bullets=[];base.alive=true;
    pickups=[];effects={rapid:0,freeze:0};killCount=0;hudClock=0;
    buildMap();player={x:220,y:540,direction:'up',speed:125,cooldown:0,invulnerable:2.5};
    save(key+':current',String(levelIndex));renderLevels();update();draw();status('第 '+(levelIndex+1)+' 关，保护星标基地并击退六波敌军。');
  }
  document.getElementById('level-list').addEventListener('click',function(event){
    var button=event.target.closest('[data-level]');if(!button)return;
    var index=Number(button.dataset.level);if(!Number.isInteger(index)||index<0||index>unlocked)return;
    levelIndex=index;restart();ready=true;showCover('第 '+(index+1)+' 关 · '+levels[index].name,'准备好后开始防守。','开始游戏');syncStart();
  });
  var keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right',j:'fire'};
  function keyboard(event,pressed){
    if(dialog.open||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
    var name=keys[event.key]||keys[event.key.toLowerCase()];
    if(event.code==='Space'&&!/BUTTON|A/.test(event.target.tagName))name='fire';
    if(!name)return;event.preventDefault();if(pressed&&blocked())return;held[name]=pressed;
  }
  document.addEventListener('keydown',function(e){keyboard(e,true);});document.addEventListener('keyup',function(e){keyboard(e,false);});
  document.querySelectorAll('[data-tank]').forEach(function(button){
    var name=button.dataset.tank;
    button.addEventListener('pointerdown',function(event){if(blocked())return;event.preventDefault();button.setPointerCapture(event.pointerId);held[name]=true;});
    ['pointerup','pointercancel','lostpointercapture'].forEach(function(type){button.addEventListener(type,function(){held[name]=false;});});
    // 键盘激活触屏按钮时，也能完成一次移动或发射。
    button.addEventListener('click',function(event){if(event.detail!==0||blocked())return;if(name==='fire')fire(player,false);else{player.direction=name;moveTank(player,.16);}draw();});
  });
  function aim(event){if(blocked())return;var rect=canvas.getBoundingClientRect();var x=(event.clientX-rect.left)/rect.width*600-player.x;var y=(event.clientY-rect.top)/rect.height*600-player.y;player.direction=Math.abs(x)>Math.abs(y)?x<0?'left':'right':y<0?'up':'down';}
  canvas.addEventListener('pointerdown',function(event){if(blocked())return;canvas.setPointerCapture(event.pointerId);aim(event);held.fire=true;});
  canvas.addEventListener('pointermove',function(event){if(held.fire)aim(event);});
  ['pointerup','pointercancel','lostpointercapture'].forEach(function(type){canvas.addEventListener(type,function(){held.fire=false;});});
  onPause=clearInput;onResume=function(){clearInput();status('继续防守，别让敌军击中基地。');};
  onOption=function(){status('难度设置已保存，新的一局生效。');};
  document.getElementById('restart').addEventListener('click',restart);
  restart();requestAnimationFrame(frame);

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
    document.getElementById('start').textContent = paused ? '继续游戏' : ended ? (levelWon&&levelIndex<levels.length-1?'下一关':'重玩本关') : '开始游戏';
    document.getElementById('start').disabled = !ready && !paused && !ended;
  }
  function startGame() {
    if (dialog.open) return;
    if (id === '打砖块') { launch(); syncStart(); return; }
    if (ended) { if(levelWon&&levelIndex<levels.length-1)levelIndex+=1; restart(); }
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


