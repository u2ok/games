/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:plants-vs-zombies';
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
  function read(name) { if (Object.prototype.hasOwnProperty.call(memoryStore, name)) return memoryStore[name]; try { return localStorage.getItem(name); } catch (error) { document.getElementById('storage').textContent = '存储不可用，数据仅在当前页面保留。'; return memoryStore[name] || null; } }
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



  // 全部时间均用秒；固定20毫秒物理步，暂停不消耗冷却、波次或阳光寿命。
  var specs={sunflower:{name:'向日葵',cost:50,hp:120,cool:4},pea:{name:'豌豆射手',cost:100,hp:120,cool:5},ice:{name:'寒冰射手',cost:175,hp:120,cool:7},wall:{name:'坚果墙',cost:50,hp:650,cool:10},cherry:{name:'樱桃炸弹',cost:150,hp:999,cool:25}};
  var types=Object.keys(specs),configs={easy:{speed:.8,gap:3.2,extra:0},normal:{speed:1,gap:2.7,extra:1},hard:{speed:1.12,gap:2.3,extra:2}};
  // 每关独立配置：植物解锁、路线、波次、天气资源、敌人和道具均为实际规则。
  var levels=[
    {name:'新芽守卫',waves:3,sun:150,sky:6,rows:[1,2,3],roster:['normal'],plants:['sunflower','pea','wall'],speed:.8,hp:1,gap:3.4,count:0,interval:32,items:[1,0,0],drop:8},
    {name:'路障来客',waves:4,sun:175,sky:6,rows:[0,1,2,3],roster:['normal','normal','cone'],plants:['sunflower','pea','wall'],speed:.86,hp:1,gap:3.1,count:0,interval:32,items:[1,1,0],drop:8},
    {name:'寒冰初试',waves:4,sun:200,sky:6,rows:[0,1,2,3,4],roster:['normal','cone'],plants:['sunflower','pea','ice','wall'],speed:.9,hp:1,gap:3,count:0,interval:32,items:[1,1,0],drop:8},
    {name:'爆破演练',waves:4,sun:200,sky:5.5,rows:[0,1,2,3,4],roster:['normal','cone','bucket'],plants:types,speed:.92,hp:1,gap:3,count:1,interval:32,items:[1,1,1],drop:9},
    {name:'暮色花园',waves:5,sun:250,sky:0,rows:[0,1,2,3,4],roster:['normal','normal','cone'],plants:types,speed:.9,hp:1,gap:3,count:0,interval:35,items:[2,1,1],drop:8},
    {name:'两翼夹击',waves:5,sun:175,sky:7,rows:[0,4],roster:['normal','cone','bucket'],plants:types,speed:1,hp:1.1,gap:2.8,count:1,interval:31,items:[1,2,1],drop:9},
    {name:'疾行先锋',waves:5,sun:225,sky:6,rows:[0,1,2,3,4],roster:['normal','cone','runner'],plants:types,speed:1,hp:1,gap:2.7,count:1,interval:30,items:[1,2,1],drop:9},
    {name:'铁桶围城',waves:6,sun:250,sky:5,rows:[0,1,2,3,4],roster:['cone','bucket','bucket'],plants:types,speed:.95,hp:1.1,gap:2.8,count:1,interval:32,items:[1,1,2],drop:10},
    {name:'漫漫长夜',waves:6,sun:300,sky:0,rows:[0,1,2,3,4],roster:['normal','cone','runner','bucket'],plants:types,speed:1,hp:1.1,gap:2.7,count:1,interval:33,items:[2,2,1],drop:8},
    {name:'急速警报',waves:6,sun:250,sky:5.5,rows:[0,1,2,3,4],roster:['normal','runner','runner','cone'],plants:types,speed:1.12,hp:1,gap:2.5,count:2,interval:29,items:[1,2,2],drop:10},
    {name:'重装突围',waves:7,sun:300,sky:5,rows:[0,1,2,3,4],roster:['cone','bucket','bucket','runner'],plants:types,speed:1.04,hp:1.2,gap:2.6,count:2,interval:30,items:[1,2,2],drop:10},
    {name:'终极防线',waves:8,sun:350,sky:6,rows:[0,1,2,3,4],roster:['normal','cone','bucket','runner'],plants:types,speed:1.1,hp:1.25,gap:2.4,count:3,interval:28,items:[2,2,2],drop:10}
  ];
  var itemNames={sun:'阳光补给',freeze:'全场冰冻',blast:'全场爆破'},itemOrder=['sun','freeze','blast'];
  var playMode=read(key+':mode')==='classic'?'classic':'campaign';
  var unlocked=Math.min(levels.length-1,Math.max(0,Math.floor(number('campaign:unlocked',0))));
  var levelIndex=Math.min(unlocked,Math.max(0,Math.floor(number('campaign:current',0)))),levelWon=false;
  var inventory={sun:0,freeze:0,blast:0},freezeLeft=0,dropCursor=0;
  function level(){return levels[levelIndex];}
  function totalWaves(){return playMode==='classic'?5:level().waves;}
  function available(t){return playMode==='classic'||level().plants.indexOf(t)>=0;}
  function bestKey(){return key+':best:'+difficulty+(playMode==='campaign'?':campaign:v1:'+levelIndex:'');}
  function renderLevels(){
    document.getElementById('level-section').hidden=playMode!=='campaign';
    document.getElementById('level-list').innerHTML=levels.map(function(l,i){return '<button data-level="'+i+'" aria-label="第'+(i+1)+'关 '+l.name+'" aria-pressed="'+(i===levelIndex)+'"'+(i>unlocked?' disabled':'')+'>'+(i+1)+'</button>';}).join('');
    write('level-hint','已解锁 '+(unlocked+1)+'/'+levels.length+' 关；切换关卡重新开始，难度系数在设置调整。');
    write('level-description',level().name+'：初始 '+level().sun+' 阳光，'+level().rows.map(function(r){return r+1;}).join('/')+' 行进攻，'+level().waves+' 波；'+(level().sky?'天空阳光每 '+level().sky+' 秒掉落':'夜间无天空阳光')+'。道具初始 '+level().items.join('/')+'（阳光/冰冻/爆破），每击退 '+level().drop+' 个敌人轮换补给。敌人：'+level().roster.filter(function(t,i,a){return a.indexOf(t)===i;}).map(function(t){return {normal:'普通',cone:'路障',bucket:'铁桶',runner:'疾行'}[t];}).join('、')+'；植物：'+level().plants.map(function(t){return specs[t].name;}).join('、')+'。');
    document.querySelectorAll('[data-mode]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.mode===playMode));});
  }
  function renderBank(){
    bank.innerHTML='';bank.classList.toggle('has-items',playMode==='campaign');
    var entries=types.concat('shovel').concat(playMode==='campaign'?itemOrder:[]);
    entries.forEach(function(t,i){var b=document.createElement('button');b.type='button';b.dataset.plant=t;
      var name=specs[t]?specs[t].name:t==='shovel'?'铲子':itemNames[t];
      var drawing=t==='sun'?'<circle cx="24" cy="24" r="12" fill="#eec36b"/><path d="M24 2v6m0 32v6M2 24h6m32 0h6M8 8l5 5m22 22 5 5M8 40l5-5m22-22 5-5" stroke="#cfa052" stroke-width="3"/>':t==='freeze'?'<path d="M24 3v42M6 13l36 22M6 35l36-22M18 8l6 6 6-6M18 40l6-6 6 6M7 19l9 1-1-9M41 29l-9-1 1 9M7 29l9-1-1 9M41 19l-9 1 1-9" fill="none" stroke="#79aebe" stroke-width="3"/>':t==='blast'?'<circle cx="23" cy="29" r="16" fill="#ba7260"/><path d="M28 14q-1-12 12-8" fill="none" stroke="#776348" stroke-width="3"/><path d="m40 1 1 6 5 2-6 1-2 6-2-6-5-2 6-1Z" fill="#dfb562"/>':t==='shovel'?'<path d="m31 5 9 9-7 7-9-9Z" fill="none" stroke="#846c50" stroke-width="4"/><path d="m28 17-14 15" stroke="#a17d51" stroke-width="5"/><path d="m7 28 15 14Q5 48 3 37Z" fill="#8faaa1"/>':'<path d="M8 18h32v24H8Z M17 18V9h14v9M8 28h32" fill="#d8c49b" stroke="#7c785c" stroke-width="3"/>';
      var art=specs[t]?sprite(t):'<svg viewBox="0 0 48 48" aria-hidden="true">'+drawing+'</svg>';
      b.innerHTML=art+'<span>'+name+'</span><small></small>';b.setAttribute('aria-label',name);bank.appendChild(b);
    });
  }
  function useItem(t){
    if(blocked()||playMode!=='campaign'||!Object.prototype.hasOwnProperty.call(itemNames,t))return false;
    if(inventory[t]<=0){status('当前没有'+itemNames[t]+'。');return false;}
    inventory[t]--;if(t==='sun')sun+=100;
    if(t==='freeze')freezeLeft=Math.max(freezeLeft,5);
    if(t==='blast'){zombies.forEach(function(z){if(z.dead)return;z.hp-=180;if(z.hp<=0)kill(z);});zombies=zombies.filter(function(z){return !z.dead;});effects.push({x:350,y:245,life:.45});}
    status('已使用'+itemNames[t]+(t==='sun'?'，获得100阳光。':t==='freeze'?'，僵尸停止移动和啃食5秒。':'，全部僵尸受到180伤害。'));update();render();return true;
  }
  function chooseLevel(index){if(!Number.isInteger(index)||index<0||index>=levels.length||index>unlocked)return false;levelIndex=index;restart();ready=true;showCover('第 '+(index+1)+' 关 · '+level().name,'准备好后开始本关防守。','开始游戏');syncStart();return true;}
  var plants=[],zombies=[],peas=[],suns=[],mowers=[],effects=[],cooldowns={},selected='sunflower',cursor=16;
  var sun=150,score=0,best=0,wave=0,remaining=0,spawnClock=0,waveClock=12,skyClock=4,time=0,kills=0,difficulty='normal',lastTick=Date.now(),accumulator=0,serial=0;
  var canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d'),bank=document.getElementById('seed-bank');
  function sprite(type){
    var body=type==='wall'?'<ellipse cx="24" cy="25" rx="15" ry="19" fill="#bb9162"/><path d="m15 15 3 6m15 12-3 6" stroke="#98744f" fill="none"/>':type==='cherry'?'<path d="M15 20Q21 4 29 10l7 11" stroke="#4a7951" fill="none" stroke-width="3"/><circle cx="15" cy="29" r="11" fill="#bd6253"/><circle cx="34" cy="29" r="11" fill="#d87861"/>':'<path d="M24 45V26m0 14Q7 29 9 42q7 5 15 1m0-2q17-17 17-2-7 7-17 4" fill="#71935a" stroke="#587b49" stroke-width="2"/>'+(type==='sunflower'?'<g fill="#e6b85f"><circle cx="24" cy="10" r="8"/><circle cx="11" cy="20" r="8"/><circle cx="16" cy="33" r="8"/><circle cx="32" cy="33" r="8"/><circle cx="37" cy="20" r="8"/></g><circle cx="24" cy="22" r="12" fill="#9a704c"/>':'<circle cx="23" cy="20" r="14" fill="'+(type==='ice'?'#83b9c9':'#7ea85c')+'"/><path d="M29 15h13v13H29" fill="'+(type==='ice'?'#a3d6df':'#9dbf73')+'"/><ellipse cx="42" cy="21" rx="3" ry="7" fill="#486a47"/>');
    return '<svg viewBox="0 0 48 48" aria-hidden="true">'+body+'<circle cx="19" cy="22" r="2" fill="#293d34"/>'+(type==='wall'||type==='sunflower'?'<circle cx="28" cy="22" r="2" fill="#293d34"/><path d="M19 28q5 4 9 0" stroke="#293d34" fill="none"/>':'')+'</svg>';
  }
  function write(id,text){var node=document.getElementById(id);if(String(node.textContent)!==String(text))node.textContent=text;}
  function update(){
    write('score',sun);write('best',best||'—');
    write('rule-label',({easy:'轻松',normal:'标准',hard:'挑战'})[difficulty]+' · '+(playMode==='classic'?'经典防守 · 5波':'第 '+(levelIndex+1)+' 关 '+level().name+' · '+totalWaves()+'波 · '+(level().sky?'白天':'夜间无天空阳光')));
    write('detail',(playMode==='campaign'?'第 '+(levelIndex+1)+' 关 · ':'')+'波次 '+wave+'/'+totalWaves()+' · 击退 '+kills+' · 得分 '+score+' · '+(remaining?'待出 '+remaining:wave<totalWaves()?'下波 '+Math.max(0,Math.ceil(waveClock))+'秒':'剩余 '+zombies.length)+(freezeLeft>0?' · 冰冻 '+Math.ceil(freezeLeft)+'秒':''));
    Array.from(bank.children).forEach(updateSeedCard);
  }
  function updateSeedCard(button){
    var type=button.dataset.plant,spec=specs[type],isPlant=!!spec;
    var cooldown=Math.ceil(cooldowns[type]||0),locked=isPlant&&!available(type);
    var pressed=String(type===selected);
    var unavailable=!!(locked||isPlant&&(sun<spec.cost||cooldown>0)||itemNames[type]&&inventory[type]<=0);
    var disabled=!!(locked||itemNames[type]&&inventory[type]<=0);
    var note=locked?'后续关卡解锁':isPlant?(cooldown?'冷却 '+cooldown+'秒':spec.cost+' 阳光'):itemNames[type]?'剩余 '+inventory[type]:'快捷键0';
    var label=(isPlant?spec.name:itemNames[type]||'铲子')+'，'+note;
    // 冷却以整秒显示；物理循环不应反复写相同属性，避免卡片重绘和辅助标签抖动。
    // 缓存属于当前按钮，重开/切换模式重建节点后自然失效，仍完整初始化新卡片。
    var previous=button._seedView||{};
    if(previous.pressed!==pressed)button.setAttribute('aria-pressed',pressed);
    if(previous.unavailable!==unavailable)button.classList.toggle('seed-unavailable',unavailable);
    if(previous.disabled!==disabled)button.disabled=disabled;
    if(previous.note!==note){var small=button.querySelector?button.querySelector('small'):null;if(small)small.textContent=note;}
    if(previous.label!==label)button.setAttribute('aria-label',label);
    if(previous.pressed!==pressed||previous.unavailable!==unavailable||previous.disabled!==disabled||previous.note!==note||previous.label!==label)button._seedView={pressed:pressed,unavailable:unavailable,disabled:disabled,note:note,label:label};
  }

  function choose(type){
    if(blocked())return;if(itemNames[type]){useItem(type);return;}
    if((!specs[type]&&type!=='shovel')||(specs[type]&&!available(type))){status('这株植物将在后续关卡解锁。');return;}
    selected=type;update();status(type==='shovel'?'选择要铲除的植物，不返还阳光。':'已选择'+specs[type].name+'，点击草坪空格种植。');
  }
  function cellAt(x,y){var c=Math.floor((x-42)/90),r=Math.floor((y-20)/90);return x>=42&&x<672&&y>=20&&y<470?r*7+c:-1;}
  function plantAt(index){return plants.find(function(p){return p.cell===index;});}
  function plant(index){
    if(blocked()||index<0||index>=35)return false;cursor=index;var old=plantAt(index);
    if(selected==='shovel'){if(!old){status('这里没有植物。');return false;}plants.splice(plants.indexOf(old),1);status('已铲除植物。');render();return true;}
    if(old){status('此格已有植物。');return false;}var spec=specs[selected];if(!available(selected))return false;
    if(cooldowns[selected]>0){status(spec.name+'还在冷却。');return false;}if(sun<spec.cost){status('阳光不足，需要 '+spec.cost+'。');return false;}
    sun-=spec.cost;cooldowns[selected]=spec.cool;plants.push({cell:index,row:Math.floor(index/7),x:87+(index%7)*90,type:selected,hp:spec.hp,timer:selected==='cherry'?.8:selected==='sunflower'?10:.5});
    status('已种植'+spec.name+'。');sound(550);update();render();return true;
  }
  function addSun(x,y){if(suns.length<12)suns.push({id:++serial,x:x,y:y,life:12});}
  function collect(id){if(blocked())return;var found=suns.filter(function(s){return id===undefined||s.id===id;});if(!found.length)return;sun+=found.length*25;suns=suns.filter(function(s){return found.indexOf(s)<0;});status('收集 '+found.length*25+' 阳光。');sound(750);update();render();}
  function spawnZombie(row,type){var hp=(type==='bucket'?300:type==='cone'?180:type==='runner'?80:100)*(playMode==='campaign'?level().hp:1);zombies.push({row:row,x:687,hp:hp,max:hp,type:type,slow:0,bite:0});}
  function kill(z){if(z.dead)return;z.dead=true;kills++;score+=z.type==='bucket'?30:z.type==='cone'?20:10;if(playMode==='campaign'&&kills%level().drop===0){var item=itemOrder[dropCursor++%3];inventory[item]=Math.min(3,inventory[item]+1);status('击退奖励：'+itemNames[item]+'一份。');}sound(320);}
  function endGame(won){
    if(ended)return;levelWon=won;if(won){score+=500;if(playMode==='campaign'){unlocked=Math.min(levels.length-1,Math.max(unlocked,levelIndex+1));save(key+':campaign:unlocked',String(unlocked));save(key+':campaign:completed:'+levelIndex,'1');renderLevels();}}
    if(score>best){best=score;save(bestKey(),String(best));}
    finish(won?'防守成功！得分 '+score+'。':'僵尸突破了防线，本局 '+score+' 分。');document.getElementById('status').dataset.tone=won?'normal':'error';showCover(won?'防守成功':'防线失守',won?'本关 '+totalWaves()+' 波僵尸全部被击退。':'合理搭配向日葵、射手和坚果，再试一次。',won&&playMode==='campaign'&&levelIndex<levels.length-1?'下一关':'重玩本关');syncStart();update();
  }
  function step(dt){
    if(blocked())return;time+=dt;freezeLeft=Math.max(0,freezeLeft-dt);types.forEach(function(t){cooldowns[t]=Math.max(0,(cooldowns[t]||0)-dt);});
    if(playMode==='classic'||level().sky>0){skyClock-=dt;if(skyClock<=0){addSun(75+Math.random()*550,55+Math.random()*45);skyClock=playMode==='classic'?6:level().sky;}}
    suns.forEach(function(s){s.life-=dt;});suns=suns.filter(function(s){return s.life>0;});
    // 波次按时间推进，不等待清场，以避免最后一只僵尸拖延导致资源无限积累。
    waveClock-=dt;if(wave<totalWaves()&&remaining===0&&waveClock<=0){wave++;remaining=4+wave*2+configs[difficulty].extra+(playMode==='campaign'?level().count:0);spawnClock=0;waveClock=playMode==='classic'?32:level().interval;status('第 '+wave+' 波来袭！');}
    if(remaining>0){spawnClock-=dt;if(spawnClock<=0){var kind=wave>=3&&Math.random()<.24?'bucket':wave>=2&&Math.random()<.4?'cone':'normal';var rows=playMode==='classic'?[0,1,2,3,4]:level().rows;if(playMode==='campaign')kind=level().roster[Math.floor(Math.random()*level().roster.length)];spawnZombie(rows[Math.floor(Math.random()*rows.length)],kind);remaining--;spawnClock=(playMode==='classic'?configs[difficulty].gap:level().gap*configs[difficulty].gap/2.7);}}
    plants.forEach(function(p){
      p.timer-=dt;
      if(p.type==='sunflower'&&p.timer<=0){addSun(p.x,65+p.row*90);p.timer=10;}
      else if(p.type==='cherry'&&p.timer<=0){zombies.forEach(function(z){if(!z.dead&&Math.abs(z.row-p.row)<=1&&Math.abs(z.x-p.x)<=145)kill(z);});effects.push({x:p.x,y:65+p.row*90,life:.45});p.hp=0;}
      else if((p.type==='pea'||p.type==='ice')&&p.timer<=0&&zombies.some(function(z){return !z.dead&&z.row===p.row&&z.x>p.x-15;})){peas.push({x:p.x+24,row:p.row,ice:p.type==='ice'});p.timer=p.type==='ice'?1.8:1.4;}
    });
    // 弹丸用扫掠区间碰撞，防止低帧率时越过僵尸；只命中同一行最近的敌人。
    peas=peas.filter(function(b){var next=b.x+270*dt;var hit=zombies.filter(function(z){return !z.dead&&z.row===b.row&&z.x+20>=b.x&&z.x-20<=next;}).sort(function(a,c){return a.x-c.x;})[0];if(hit){hit.hp-=20;if(b.ice)hit.slow=3;if(hit.hp<=0)kill(hit);return false;}b.x=next;return b.x<710;});
    zombies.forEach(function(z){
      if(z.dead||freezeLeft>0)return;z.slow=Math.max(0,z.slow-dt);
      var victim=plants.filter(function(p){return p.hp>0&&p.row===z.row&&z.x>=p.x-27&&z.x<=p.x+45;}).sort(function(a,b){return b.x-a.x;})[0];
      if(victim){victim.hp-=36*dt;return;}z.x-= (z.type==='bucket'?11:z.type==='runner'?22:14)*configs[difficulty].speed*(playMode==='campaign'?level().speed:1)*(z.slow>0?.5:1)*dt;
      if(z.x<32){if(mowers[z.row]){mowers[z.row]=false;zombies.forEach(function(other){if(!other.dead&&other.row===z.row)kill(other);});effects.push({x:330,y:65+z.row*90,life:.45});status('第 '+(z.row+1)+' 行割草机已使用。');}else endGame(false);}
    });
    zombies=zombies.filter(function(z){return !z.dead;});plants=plants.filter(function(p){return p.hp>0;});effects.forEach(function(e){e.life-=dt;});effects=effects.filter(function(e){return e.life>0;});
    if(!ended&&wave===totalWaves()&&!remaining&&!zombies.length)endGame(true);
  }
  function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
  function plantArt(p){var x=p.x,y=65+p.row*90;
    ellipse(x,y+30,31,8,'#344c3420');if(p.type==='wall'){ellipse(x,y,25,37,'#bb9162');ellipse(x-7,y-12,4,6,'#e3bf86');}
    else if(p.type==='cherry'){ctx.strokeStyle='#4c794b';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x-12,y);ctx.quadraticCurveTo(x,y-50,x+15,y);ctx.stroke();circle(x-13,y+8,18,'#bd6253');circle(x+14,y+8,18,'#d87b64');}
    else {ctx.fillStyle='#60894e';ctx.fillRect(x-4,y-5,8,36);ellipse(x-12,y+22,15,7,'#7d9e5a');ellipse(x+12,y+17,15,7,'#60894e');
      if(p.type==='sunflower'){for(var a=0;a<8;a++)circle(x+Math.cos(a*Math.PI/4)*23,y-10+Math.sin(a*Math.PI/4)*23,10,'#e9bc60');circle(x,y-10,21,'#9e754c');}
      else{circle(x-3,y-12,24,p.type==='ice'?'#84bfce':'#89af61');ctx.fillStyle=p.type==='ice'?'#acdae3':'#a5c77f';ctx.fillRect(x+6,y-21,28,20);ellipse(x+34,y-11,6,11,'#486a47');}}
    circle(x-9,y-13,3,'#263d33');if(p.type==='sunflower'||p.type==='wall'){circle(x+8,y-13,3,'#263d33');ctx.strokeStyle='#263d33';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-6,7,0,Math.PI);ctx.stroke();}
    if(p.hp<specs[p.type].hp){ctx.fillStyle='#e4d8b7';ctx.fillRect(x-24,y+39,48,4);ctx.fillStyle='#607c51';ctx.fillRect(x-24,y+39,48*Math.max(0,p.hp)/specs[p.type].hp,4);}
  }
  function render(){
    ctx.clearRect(0,0,700,500);ctx.fillStyle='#eaf0dc';ctx.fillRect(0,0,700,500);ctx.fillStyle='#d7e4c4';ctx.fillRect(0,14,700,462);
    for(var r=0;r<5;r++)for(var c=0;c<7;c++){ctx.fillStyle=(r+c)%2?'#b8cf9c':'#c7d9ad';ctx.fillRect(42+c*90,20+r*90,89,89);}
    ctx.fillStyle='#6a825b';ctx.font='16px sans-serif';ctx.textAlign='center';
    for(var i=0;i<5;i++){if(mowers[i]){ctx.fillStyle='#9a6c50';ctx.fillRect(4,50+i*90,31,21);circle(10,75+i*90,5,'#47584a');circle(29,75+i*90,5,'#47584a');}ctx.fillStyle='#607455';ctx.font='14px sans-serif';ctx.fillText(String(i+1),22,105+i*90);}
    ctx.strokeStyle='#5366d6';ctx.lineWidth=3;ctx.strokeRect(44+(cursor%7)*90,22+Math.floor(cursor/7)*90,85,85);
    plants.forEach(plantArt);
    zombies.forEach(function(z){var x=z.x,y=65+z.row*90;ellipse(x,y+33,25,7,'#344c3420');ctx.fillStyle='#657973';ctx.fillRect(x-14,y-3,28,29);ctx.fillStyle='#546278';ctx.fillRect(x-13,y+24,9,14);ctx.fillRect(x+5,y+24,9,14);circle(x,y-19,21,z.slow>0||freezeLeft>0?'#a4cbd0':'#a8b599');circle(x-7,y-24,5,'#fff9e9');circle(x+8,y-24,5,'#fff9e9');circle(x-7,y-23,2,'#35443c');circle(x+8,y-23,2,'#35443c');ctx.fillStyle='#56634d';ctx.fillRect(x-8,y-9,16,4);
      if(z.type==='runner'){ctx.fillStyle='#c98768';ctx.fillRect(x-22,y-37,44,7);}else if(z.type==='cone'){ctx.fillStyle='#d59a60';ctx.beginPath();ctx.moveTo(x-19,y-35);ctx.lineTo(x+3,y-69);ctx.lineTo(x+22,y-35);ctx.fill();}else if(z.type==='bucket'){ctx.fillStyle='#9ba9ad';ctx.fillRect(x-23,y-54,46,25);ctx.fillStyle='#d3d9d5';ctx.fillRect(x-25,y-32,50,5);}ctx.fillStyle='#e6e0c7';ctx.fillRect(x-22,y+44,44,4);ctx.fillStyle='#b67560';ctx.fillRect(x-22,y+44,44*z.hp/z.max,4);
    });
    peas.forEach(function(b){circle(b.x,55+b.row*90,7,b.ice?'#b7e7ef':'#659247');});
    effects.forEach(function(e){circle(e.x,e.y,70*(1-e.life/.5),'#e9bd67');});
    suns.forEach(function(s){for(var a=0;a<8;a++)circle(s.x+Math.cos(a*Math.PI/4)*22,s.y+Math.sin(a*Math.PI/4)*22,5,'#e1ad4c');circle(s.x,s.y,18,'#f3d77a');});
    ctx.fillStyle='#536b4b';ctx.font='18px sans-serif';ctx.fillText('选择植物，再点击草坪种植',350,495);ctx.font='14px sans-serif';
  }
  function restart(){resetState();difficulty=configs[settings.option]?settings.option:'normal';levelWon=false;plants=[];zombies=[];peas=[];suns=[];effects=[];mowers=[true,true,true,true,true];cooldowns={};sun=playMode==='classic'?150:level().sun;inventory={sun:0,freeze:0,blast:0};if(playMode==='campaign')itemOrder.forEach(function(t,i){inventory[t]=level().items[i];});freezeLeft=0;dropCursor=0;score=0;wave=0;remaining=0;waveClock=12;spawnClock=0;skyClock=4;time=0;kills=0;selected='sunflower';cursor=16;accumulator=0;lastTick=Date.now();best=Number(read(bestKey()))||0;save(key+':campaign:current',String(levelIndex));renderBank();renderLevels();update();render();status(playMode==='classic'?'经典防守，第一波12秒后到来。':'第 '+(levelIndex+1)+' 关 · '+level().name+'；'+(level().sky?'先积攒阳光，准备防线。':'夜间没有天空阳光，优先向日葵或使用补给。'));}
  document.getElementById('level-list').addEventListener('click',function(e){var b=e.target.closest('[data-level]');if(b)chooseLevel(Number(b.dataset.level));});
  document.querySelectorAll('[data-mode]').forEach(function(b){b.addEventListener('click',function(){if(b.dataset.mode===playMode)return;playMode=b.dataset.mode==='classic'?'classic':'campaign';save(key+':mode',playMode);restart();ready=true;showCover(playMode==='campaign'?'关卡闯关':'经典防守','切换模式已开启新一局。','开始游戏');syncStart();});});
  canvas.addEventListener('click',function(e){if(blocked())return;var rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*700/rect.width,y=(e.clientY-rect.top)*500/rect.height;var s=suns.find(function(v){return Math.hypot(v.x-x,v.y-y)<30;});if(s)collect(s.id);else plant(cellAt(x,y));canvas.focus();});
  bank.addEventListener('click',function(e){var b=e.target.closest('[data-plant]');if(b)choose(b.dataset.plant);});
  document.getElementById('collect-sun').addEventListener('click',function(){collect();});
  document.addEventListener('keydown',function(e){if(blocked()||e.repeat||e.isComposing||e.ctrlKey||e.altKey||e.metaKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(/^[0-5]$/.test(e.key)){e.preventDefault();choose(e.key==='0'?'shovel':types[Number(e.key)-1]);}else if({v:'sun',f:'freeze',b:'blast'}[e.key.toLowerCase()]){e.preventDefault();useItem({v:'sun',f:'freeze',b:'blast'}[e.key.toLowerCase()]);}else if(e.key.toLowerCase()==='c'){e.preventDefault();collect();}});
  canvas.addEventListener('keydown',function(e){if(blocked()||e.isComposing||e.ctrlKey||e.altKey||e.metaKey)return;var ds={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(ds[e.key]){e.preventDefault();var n=cursor+ds[e.key];if(n>=0&&n<35&&(Math.abs(ds[e.key])!==1||Math.floor(n/7)===Math.floor(cursor/7)))cursor=n;render();}else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)plant(cursor);}});
  onResume=function(){lastTick=Date.now();accumulator=0;};onPause=function(){accumulator=0;};onOption=function(){status('难度已保存，下一局生效。');};
  document.getElementById('restart').addEventListener('click',restart);
  setInterval(function(){var now=Date.now(),dt=Math.max(0,Math.min(.2,(now-lastTick)/1000));lastTick=now;if(blocked())return;accumulator+=dt;while(accumulator>=.02&&!ended){step(.02);accumulator-=.02;}update();render();},40);
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
    document.getElementById('start').textContent = paused ? '继续游戏' : ended ? (levelWon&&playMode==='campaign'&&levelIndex<levels.length-1?'下一关':'重玩本关') : '开始游戏';
    document.getElementById('start').disabled = !ready && !paused && !ended;
  }
  function startGame() {
    if (dialog.open) return;
    if (id === '打砖块') { launch(); syncStart(); return; }
    if (ended) {if(levelWon&&playMode==='campaign'&&levelIndex<levels.length-1)levelIndex++;restart();}
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


