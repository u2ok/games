/* 通用界面逻辑随游戏一起保存，不引用导航站资源；闭包隔离全部状态。 */
(function () {
  'use strict';
  var id = document.title.split(' · ')[0];
  var key = 'mini-games:junqi';
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
  var names=['军旗','工兵','排长','连长','营长','团长','旅长','师长','军长','司令','炸弹','地雷'];
  var pool=[9,8,7,7,6,6,5,5,4,4,3,3,3,2,2,2,1,1,1,11,11,11,10,10,0];
  var values=[0,130,80,105,145,195,260,350,480,650,290,110];
  var camps=[11,13,17,21,23,36,38,42,46,48],headquarters=[1,3,56,58];
  var board=[],mode=read(key+':mode')==='flip'?'flip':'layout',difficulty='normal',phase='setup';
  var turn=0,humanColor=1,selected=-1,cursor=57,moves=0,quiet=0,repetitions={},timer=0,revision=0,lastMove=null,battleNote='',moveMemory={1:[],2:[]},flipRun={1:0,2:0};
  function shuffle(items){for(var i=items.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),v=items[i];items[i]=items[j];items[j]=v;}return items;}
  function row(i){return Math.floor(i/5);} function col(i){return i%5;}
  function camp(i){return camps.indexOf(i)!==-1;} function hq(i){return headquarters.indexOf(i)!==-1;}
  function piece(side,rank,hidden){return {side:side,rank:rank,hidden:!!hidden};}
  function validPlacement(p,i){var r=row(i);return !camp(i)&&(p.side===1?r>=6:r<6)&&(p.rank!==0||hq(i))&&(p.rank!==11||(p.side===1?r>=10:r<=1))&&(p.rank!==10||(p.side===1?r!==6:r!==5));}
  // 先放旗雷和受限炸弹，剩余棋子随机填入；不会把机动子力锁在另一座大本营。
  function formation(side){
    var result=Array(60).fill(null),slots=[];for(var i=side===1?30:0;i<(side===1?60:30);i++)if(!camp(i))slots.push(i);
    var homes=shuffle((side===1?[56,58]:[1,3]).slice());result[homes[0]]=piece(side,0);result[homes[1]]=piece(side,11);
    var mineSlots=shuffle(slots.filter(function(i){return !result[i]&&validPlacement(piece(side,11),i);}));
    result[mineSlots[0]]=piece(side,11);result[mineSlots[1]]=piece(side,11);
    var bombSlots=shuffle(slots.filter(function(i){return !result[i]&&validPlacement(piece(side,10),i);}));
    result[bombSlots[0]]=piece(side,10);result[bombSlots[1]]=piece(side,10);
    var rest=shuffle(pool.filter(function(rank){return rank!==0&&rank!==11&&rank!==10;}));
    slots.forEach(function(i){if(!result[i])result[i]=piece(side,rest.pop());});return result;
  }
  function initializeBeliefs(map){
    map.forEach(function(p,i){if(!p)return;p.origin=i;p.moved=false;p.revealed=false;p.beliefs={};[1,2].forEach(function(observer){p.beliefs[observer]=Array.from(new Set(pool)).filter(function(rank){return validPlacement(piece(p.side,rank),i);});});});return map;
  }
  function rankVisible(p,observer){return !!p&&(mode==='flip'?!p.hidden:p.side===observer||p.revealed||ended);}
  function newBoard(){
    if(mode==='layout'){var red=formation(1),blue=formation(2);return initializeBeliefs(red.map(function(p,i){return p||blue[i];}));}
    var pieces=shuffle(pool.map(function(r){return piece(1,r,true);}).concat(pool.map(function(r){return piece(2,r,true);})));
    return Array.from({length:60},function(_,i){return camp(i)?null:pieces.pop();});
  }
  function railEdge(a,b){
    var ar=row(a),br=row(b),ac=col(a),bc=col(b);
    return ar===br&&Math.abs(ac-bc)===1&&[1,5,6,10].indexOf(ar)!==-1 || ac===bc&&Math.abs(ar-br)===1&&((ac===0||ac===4)&&Math.min(ar,br)>=1&&Math.max(ar,br)<=10||ac===2&&Math.min(ar,br)===5);
  }
  function roadEdge(a,b){
    var dr=Math.abs(row(a)-row(b)),dc=Math.abs(col(a)-col(b));
    if(dr+dc===1)return !(Math.min(row(a),row(b))===5&&dr===1&&(col(a)===1||col(a)===3));
    return dr===1&&dc===1&&(camp(a)||camp(b));
  }
  // 棋盘模型是线路、绘制、路径提示和命中测试的共同数据源。
  var geometry={width:600,height:800,points:[],roads:[],rails:[],roadEdges:[],railEdges:[],distance:[]};
  var roads=geometry.roads,rails=geometry.rails;
  for(var a=0;a<60;a++){
    geometry.points[a]={x:60+col(a)*120,y:38+row(a)*58+(row(a)>=6?86:0),kind:camp(a)?'camp':hq(a)?'headquarters':'station'};
    roads[a]=[];rails[a]=[];
    for(var b=0;b<60;b++){
      if(roadEdge(a,b)){roads[a].push(b);if(a<b)geometry.roadEdges.push([a,b]);}
      if(railEdge(a,b)){rails[a].push(b);if(a<b)geometry.railEdges.push([a,b]);}
    }
  }
  for(var origin=0;origin<60;origin++){
    var distances=Array(60).fill(99),queue=[origin];distances[origin]=0;
    for(var head=0;head<queue.length;head++)roads[queue[head]].forEach(function(next){if(distances[next]===99){distances[next]=distances[queue[head]]+1;queue.push(next);}});
    geometry.distance[origin]=distances;
  }
  function stationAt(x,y){
    for(var i=0;i<geometry.points.length;i++){var p=geometry.points[i];if(Math.abs(x-p.x)<=52&&Math.abs(y-p.y)<=26)return i;}return -1;
  }
  function pointerStation(clientX,clientY,rect){return rect.width>0&&rect.height>0?stationAt((clientX-rect.left)*geometry.width/rect.width,(clientY-rect.top)*geometry.height/rect.height):-1;}
  function routesFrom(map,from){
    var p=map[from];if(!p||p.hidden||p.rank===0||p.rank===11)return [];
    var targets={};
    function land(i){var q=map[i];return !q||!q.hidden&&q.side!==p.side&&!camp(i)&&(mode!=='flip'||combat(p.rank,q.rank)>=0);}
    roads[from].forEach(function(i){if(land(i))targets[i]=[from,i];});
    if(p.rank===1){
      var queue=[from],paths={};paths[from]=[from];
      for(var k=0;k<queue.length;k++)rails[queue[k]].forEach(function(i){if(paths[i])return;paths[i]=paths[queue[k]].concat(i);if(land(i)&&(!targets[i]||targets[i].length>paths[i].length))targets[i]=paths[i];if(!map[i])queue.push(i);});
    }else{
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var current=from,path=[from];
        while(true){var r=row(current)+d[0],c=col(current)+d[1];if(r<0||r>=12||c<0||c>=5)break;var next=r*5+c;if(!railEdge(current,next))break;path=path.concat(next);if(land(next))targets[next]=path;if(map[next])break;current=next;}
      });
    }
    return Object.keys(targets).map(function(to){return {to:Number(to),path:targets[to]};});
  }
  function destinations(map,from){return routesFrom(map,from).map(function(route){return route.to;});}
  function movePath(map,from,to){var route=routesFrom(map,from).find(function(r){return r.to===to;});return route?route.path:[];}
  // 1：进攻方存活；-1：防守方存活；0：同归于尽。夺旗胜负独立于存活判定。
  function combat(attacker,defender){if(attacker===10||defender===10)return 0;if(defender===0)return 1;if(defender===11)return attacker===1?1:-1;return attacker===defender?0:attacker>defender?1:-1;}
  function allMoves(map,side){var out=[];map.forEach(function(p,i){if(p&&!p.hidden&&p.side===side)destinations(map,i).forEach(function(to){out.push({from:i,to:to});});});return out;}
  function applyMove(map,action){var next=map.slice(),p=map[action.from],q=map[action.to],outcome=q?combat(p.rank,q.rank):1;next[action.from]=null;next[action.to]=outcome===1?p:outcome===-1?q:null;return next;}
  function hasHidden(map){return map.some(function(p){return p&&p.hidden;});}
  // AI的唯一棋盘输入：翻棋暗子只保留障碍；布局敌子只保留阵营和公开推断。
  function publicBoard(map,observer){
    observer=observer||colorFor(1);
    return map.map(function(p){
      if(!p)return null;if(p.hidden)return piece(0,-1,true);
      if(mode!=='layout'||p.side===observer||p.revealed)return piece(p.side,p.rank);
      return {side:p.side,rank:-1,hidden:false,candidates:(p.beliefs&&p.beliefs[observer]||Array.from(new Set(pool))).slice(),moved:!!p.moved};
    });
  }
  function captureValue(map,m){var a=map[m.from],b=map[m.to];if(!b)return 0;if(b.rank===0)return 100000;var v=combat(a.rank,b.rank);return (v>=0?values[b.rank]:0)-(v<=0?values[a.rank]:0);}
  function positionValue(map,p,i){
    if(!p||p.hidden||p.rank===0||p.rank===11)return 0;
    var value=(mode==='layout'?(p.side===1?11-row(i):row(i))*1.8:0)+(camp(i)?12:0)+(rails[i].length?4:0),approach=0;
    map.forEach(function(q,j){
      if(!q||q.hidden||q.side===p.side||q.rank<0)return;
      var distance=geometry.distance[i][j];
      if(q.rank===0)approach=Math.max(approach,70/(distance+1));
      else if(!camp(j)&&combat(p.rank,q.rank)>=0){var reward=q.rank===11&&p.rank===1?40:12+Math.min(values[q.rank],values[p.rank])*.08;approach=Math.max(approach,reward/(distance+1));}
    });return value+approach;
  }
  function evaluate(map,side){
    var score=0,flags=[];
    map.forEach(function(p,i){if(!p||p.hidden)return;var sign=p.side===side?1:-1;if(p.rank===0){flags.push([i,p.side]);return;}score+=sign*(values[p.rank]+positionValue(map,p,i));});
    flags.forEach(function(f){roads[f[0]].forEach(function(i){var p=map[i];if(p&&!p.hidden&&p.side===f[1])score+=(f[1]===side?1:-1)*10;});});
    var ours=allMoves(map,side),theirs=allMoves(map,3-side);score+=(ours.length-theirs.length)*.65;
    var danger=theirs.reduce(function(v,m){return Math.max(v,captureValue(map,m));},0),opportunity=ours.reduce(function(v,m){return Math.max(v,captureValue(map,m));},0);
    return score+.48*(opportunity-danger);
  }
  function movePenalty(map,m,side){
    if(map[m.to])return 0;var history=moveMemory[side]||[],penalty=0,last=history[history.length-1];
    if(last&&last.from===m.to&&last.to===m.from)penalty+=24;
    var resulting=mapKey(applyMove(map,m),3-side);
    history.forEach(function(old){if(old.to===m.to)penalty+=5;if(old.from===m.from&&old.to===m.to)penalty+=8;if(old.position===resulting)penalty+=48;});return penalty;
  }
  // 从真实公路/铁路走法反向传播目标价值；暗子和友军仍然挡路，不追逐不可达目标。
  function purposeField(map,from,deadline){
    var p=map[from],scratch=map.slice(),reverse=Array.from({length:60},function(){return [];}),potential=Array(60).fill(0),used=Array(60).fill(false);
    scratch[from]=null;
    map.forEach(function(q,i){
      if(!q||q.hidden||q.side===p.side||q.rank<0||camp(i))return;
      var outcome=combat(p.rank,q.rank),gain=outcome>0?values[q.rank]:outcome===0?values[q.rank]-values[p.rank]:-values[p.rank];
      if(q.rank===0)potential[i]=1000;
      else if(outcome>=0&&gain>=0)potential[i]=16+Math.min(120,gain*.4)+(q.rank===11&&p.rank===1?30:0);
    });
    for(var i=0;i<60;i++){
      if(Date.now()>deadline)return null;
      if(scratch[i])continue;
      scratch[i]=p;
      destinations(scratch,i).forEach(function(to){reverse[to].push(i);});
      scratch[i]=null;
    }
    // 每消耗一手降低未来收益；优先更近、更值钱的目标，而非单纯向棋盘中心走。
    for(var step=0;step<60;step++){
      var best=-1;for(var j=0;j<60;j++)if(!used[j]&&potential[j]>0&&(best<0||potential[j]>potential[best]))best=j;
      if(best<0)break;used[best]=true;
      reverse[best].forEach(function(previous){potential[previous]=Math.max(potential[previous],potential[best]*.76);});
    }
    return potential;
  }
  function movementPurpose(map,side,deadline){
    var fields={},threats={};
    function danger(position){
      var key=mapKey(position,side);
      if(threats[key]===undefined){
        var targets=Array(60).fill(0);
        allMoves(position,3-side).forEach(function(m){targets[m.to]=Math.max(targets[m.to],captureValue(position,m));});
        threats[key]={targets:targets,total:targets.reduce(function(sum,value){return sum+value;},0)};
      }
      return threats[key];
    }
    return function(m){
      var after=applyMove(map,m),beforeDanger=danger(map),afterDanger=danger(after),beforeRisk=beforeDanger.targets[m.from],afterRisk=after[m.to]&&after[m.to].side===side?afterDanger.targets[m.to]:0;
      if(fields[m.from]===undefined)fields[m.from]=purposeField(map,m.from,deadline);
      var field=fields[m.from],progress=field&&!map[m.to]?field[m.to]-field[m.from]:0;
      var rescue=Math.max(0,beforeRisk-afterRisk),teamRescue=Math.max(0,beforeDanger.total-afterDanger.total),bonus=progress*.55+rescue*.28-afterRisk*.22+Math.min(3000,teamRescue*.12);
      if(!map[m.to]&&progress<=0&&rescue===0)bonus-=8;
      // 战术上有收益的回撤不因历史记录被一刀切禁止；无收益重复局面则重罚。
      var occupation=!map[m.to]&&afterRisk===0&&positionValue(map,map[m.from],m.to)-positionValue(map,map[m.from],m.from)>=6;
      return {bonus:bonus,penalty:movePenalty(map,m,side)*(Math.max(rescue,teamRescue)>40?.12:1),progress:progress,useful:progress>0||teamRescue>0||rescue>0||captureValue(map,m)>0||occupation};
    };
  }
  function orderedMoves(map,side){return allMoves(map,side).map(function(m){return {action:m,value:captureValue(map,m)+positionValue(map,map[m.from],m.to)-positionValue(map,map[m.from],m.from)};}).sort(function(a,b){return b.value-a.value;});}
  function mapKey(map,side){return side+':'+map.map(function(p){return !p?'.':p.hidden?'?':p.side+'-'+p.rank;}).join(',');}
  // 翻子也消耗一个回合：先计算对手应手，再评估局部信息收益，不能无视被吃风险。
  function flipOptions(map,side){
    var baseline=evaluate(map,side),reply=orderedMoves(map,3-side).slice(0,12),waiting=baseline;
    reply.forEach(function(item){var m=item.action,q=map[m.to];waiting=Math.min(waiting,q&&q.rank===0?-100000:evaluate(applyMove(map,m),side));});
    var mobile=map.filter(function(p,i){return p&&!p.hidden&&p.side===side&&destinations(map,i).length;}).length;
    var information=mobile===0?24:mobile===1?8:mobile===2?0:-7;
    information-=Math.min(30,(flipRun[side]||0)*10);
    return map.reduce(function(result,p,i){
      if(!p||!p.hidden)return result;
      var support=0,opens=0;roads[i].forEach(function(j){var q=map[j];if(q&&!q.hidden){support+=q.side===side?2:-3;if(q.side===side&&q.rank>0&&q.rank<11)opens++;}});
      // 优先打开铁路堵点及能解放己方机动子的邻站；大本营不再额外限制出动。
      var benefit=information+support+Math.min(8,opens*3)+(rails[i].length?2:0);result.push({action:{flip:i},value:waiting+benefit,benefit:benefit});return result;
    },[]);
  }
  function chooseKnownAI(map,side,level){
    var config=level==='hard'?{depth:4,ms:300,nodes:9000,beam:16}:level==='easy'?{depth:1,ms:60,nodes:1000,beam:10}:{depth:3,ms:160,nodes:4500,beam:13};
    var deadline=Date.now()+config.ms,nodes=0,aborted=false,cache={},evaluation={};
    function staticValue(position,color){var k=mapKey(position,color);if(evaluation[k]===undefined)evaluation[k]=evaluate(position,color);return evaluation[k];}
    function search(position,color,depth,alpha,beta,flipsLeft){
      if(++nodes>config.nodes||Date.now()>deadline){aborted=true;return staticValue(position,color);}
      if(!depth)return staticValue(position,color);
      var key=mapKey(position,color)+':'+flipsLeft,old=cache[key],alphaBefore=alpha,betaBefore=beta;
      if(old&&old.depth>=depth){if(old.bound==='exact')return old.value;if(old.bound==='lower')alpha=Math.max(alpha,old.value);else beta=Math.min(beta,old.value);if(alpha>=beta)return old.value;}
      var actions=orderedMoves(position,color);if(!actions.length&&!flipsLeft)return hasHidden(position)?staticValue(position,color):-90000-depth;
      // 搜索不猜暗子身份，但保留翻一次子消耗一回合的节奏；暗子总数限制抽象翻子次数。
      var best=flipsLeft?-search(position,3-color,depth-1,-beta,-alpha,flipsLeft-1)-2:-Infinity;alpha=Math.max(alpha,best);
      for(var i=0;i<Math.min(actions.length,config.beam);i++){
        var m=actions[i].action,q=position[m.to],value=q&&q.rank===0?100000+depth:-search(applyMove(position,m),3-color,depth-1,-beta,-alpha,flipsLeft);
        best=Math.max(best,value);alpha=Math.max(alpha,value);if(alpha>=beta||aborted)break;
      }
      if(!aborted)cache[key]={depth:depth,value:best,bound:best<=alphaBefore?'upper':best>=betaBefore?'lower':'exact'};return best;
    }
    var root=orderedMoves(map,side),hiddenCount=map.filter(function(p){return p&&p.hidden;}).length;
    var win=root.find(function(item){var q=map[item.action.to];return q&&q.rank===0;});if(win)return win.action;
    var purpose=mode==='flip'?movementPurpose(map,side,deadline):null;
    root.forEach(function(item){var plan=purpose?purpose(item.action):{bonus:0,penalty:movePenalty(map,item.action,side),progress:0,useful:true};item.adjustment=plan.bonus-plan.penalty;item.useful=plan.useful;item.value+=item.adjustment;});
    root.sort(function(a,b){return b.value-a.value;});root=root.slice(0,36);
    var waitingScore=null;
    var scores=root.map(function(item){return {action:item.action,value:staticValue(applyMove(map,item.action),side)+item.adjustment};});
    for(var depth=1;depth<=config.depth&&root.length;depth++){
      var next=[];for(var i=0;i<root.length;i++){
        var m=root[i].action,value=-search(applyMove(map,m),3-side,depth-1,-Infinity,Infinity,hiddenCount)+root[i].adjustment;
        next.push({action:m,value:value});if(aborted)break;
      }
      var waiting=hiddenCount&&!aborted?-search(map,3-side,depth-1,-Infinity,Infinity,hiddenCount-1):null;
      if(aborted)break;scores=next;waitingScore=waiting;
      root.sort(function(a,b){return next.find(function(v){return v.action===b.action;}).value-next.find(function(v){return v.action===a.action;}).value;});
    }
    var flips=hiddenCount?flipOptions(map,side):[];if(waitingScore!==null)flips.forEach(function(item){item.value=Math.min(item.value,waitingScore+item.benefit);});
    var enemyThreat=allMoves(map,3-side).reduce(function(v,m){return Math.max(v,captureValue(map,m));},0);
    if(enemyThreat>80){
      var defenses=scores.filter(function(item){if(captureValue(map,item.action)<0)return false;var after=applyMove(map,item.action),remaining=allMoves(after,3-side).reduce(function(v,m){return Math.max(v,captureValue(after,m));},0);return remaining<enemyThreat*.5;});
      // 确实能救子时不靠翻子赌运气；允许收益超过当前损失的反击。
      if(defenses.length)scores=scores.filter(function(item){return defenses.indexOf(item)!==-1||captureValue(map,item.action)>=enemyThreat;});
      else if(hiddenCount)scores=scores.concat(flips);
    }else if(hiddenCount)scores=scores.concat(flips);
    if(!scores.length)return null;
    if(mode==='flip'&&scores.some(function(item){return item.action.flip!==undefined;})){
      scores=scores.filter(function(item){var origin=root.find(function(candidate){return candidate.action===item.action;});return !origin||origin.useful;});
    }
    scores.sort(function(a,b){return b.value-a.value;});var best=scores[0].value;
    // 翻子与走棋分开打破平局：有相近的有效行棋时，不靠随机数继续翻子。
    var moving=scores.filter(function(item){return item.action.flip===undefined&&item.value>=best-3;});
    var choices=moving.length?moving:scores.filter(function(item){return item.value>=best-5;});return choices[Math.floor(Math.random()*choices.length)].action;
  }
  // 暗棋仅从观察者可知的候选军衔采样，不把真实敌棋对象交给搜索。
  function candidateRanks(p){var ranks=p.candidates||Array.from(new Set(pool));return ranks.filter(function(rank){return !p.moved||rank!==0&&rank!==11;});}
  function expectedCapture(map,m){
    var a=map[m.from],b=map[m.to];if(!b)return 0;if(b.rank>=0)return captureValue(map,m);
    var ranks=candidateRanks(b),sum=0,total=0;
    ranks.forEach(function(rank){var weight=pool.filter(function(r){return r===rank;}).length,outcome=combat(a.rank,rank);sum+=weight*((rank===0?1600:outcome>=0?values[rank]:0)-(outcome<=0?values[a.rank]:0));total+=weight;});return total?sum/total:0;
  }
  function sampleWorld(map){
    var world=map.map(function(p){return p&&p.rank>=0?piece(p.side,p.rank):null;}),remaining={1:{},2:{}},unknown=[];
    [1,2].forEach(function(side){pool.forEach(function(rank){remaining[side][rank]=(remaining[side][rank]||0)+1;});});
    map.forEach(function(p,i){if(!p)return;if(p.rank>=0)remaining[p.side][p.rank]--;else unknown.push(i);});
    var visits=0;
    function assign(left){
      if(!left.length)return true;if(++visits>500)return false;
      var sorted=left.map(function(i){return {index:i,ranks:candidateRanks(map[i]).filter(function(rank){return remaining[map[i].side][rank]>0;})};}).sort(function(a,b){return a.ranks.length-b.ranks.length;});
      var pick=sorted[0];if(!pick.ranks.length)return false;var i=pick.index,side=map[i].side,ranks=shuffle(pick.ranks.slice()),rest=left.filter(function(j){return j!==i;});
      // 按剩余可用数量加权排列，回溯确保不会采出多面军旗或超额司令。
      ranks=ranks.map(function(rank){return {rank:rank,key:-Math.log(Math.max(.0000001,Math.random()))/remaining[side][rank]};}).sort(function(a,b){return a.key-b.key;}).map(function(item){return item.rank;});
      for(var k=0;k<ranks.length;k++){var rank=ranks[k];remaining[side][rank]--;world[i]=piece(side,rank);if(assign(rest))return true;remaining[side][rank]++;world[i]=null;}return false;
    }
    return assign(unknown)?world:null;
  }
  function chooseDarkAI(map,side,level){
    var config=level==='hard'?{samples:20,ms:300,reply:12,counter:3,roots:22}:level==='easy'?{samples:6,ms:60,reply:0,counter:0,roots:24}:{samples:12,ms:160,reply:9,counter:0,roots:20};
    var deadline=Date.now()+config.ms,ranked=allMoves(map,side).map(function(m){return {action:m,prior:expectedCapture(map,m)+positionValue(map,map[m.from],m.to)-positionValue(map,map[m.from],m.from),sum:0,count:0,worst:0};}).sort(function(a,b){return b.prior-a.prior;}).slice(0,config.roots);
    if(!ranked.length)return null;var flag=ranked.find(function(item){var q=map[item.action.to];return q&&q.rank===0;});if(flag)return flag.action;
    for(var sample=0;sample<config.samples;sample++){
      var world=sampleWorld(map);if(!world)continue;var baseline=evaluate(world,side),round=[],complete=true;
      for(var i=0;i<ranked.length;i++){
        if(Date.now()>deadline){complete=false;break;}
        var item=ranked[i],m=item.action,q=world[m.to],after=applyMove(world,m),value=q&&q.rank===0?100000:evaluate(after,side)-baseline;
        if(config.reply&&value<90000){
          var replies=orderedMoves(after,3-side).slice(0,config.reply),worst=Infinity;
          if(!replies.length)worst=90000;
          for(var j=0;j<replies.length;j++){
            var reply=replies[j].action,target=after[reply.to],response=applyMove(after,reply);
            var score=target&&target.rank===0?-100000:evaluate(response,side)-baseline;
            if(config.counter&&target&&score>-90000){var counters=orderedMoves(response,side).filter(function(v){return response[v.action.to];}).slice(0,config.counter);counters.forEach(function(v){var t=response[v.action.to];score=Math.max(score,t&&t.rank===0?100000:evaluate(applyMove(response,v.action),side)-baseline);});}
            worst=Math.min(worst,score);if(Date.now()>deadline){complete=false;break;}
          }value=.15*value+.85*worst;
        }
        if(!complete)break;round.push(value);
      }
      // 未完成的整轮丢弃，所有候选使用相同数量的样本，不偏爱先搜索的走法。
      if(!complete)break;
      ranked.forEach(function(item,i){item.sum+=round[i];item.count++;item.worst=Math.min(item.worst,round[i]);});
    }
    ranked.forEach(function(item){item.value=(item.count?item.sum/item.count+.08*item.worst:item.prior)-movePenalty(map,item.action,side);});
    ranked.sort(function(a,b){return b.value-a.value;});var near=ranked.filter(function(item){return item.value>=ranked[0].value-6;});return near[Math.floor(Math.random()*near.length)].action;
  }
  function chooseAI(map,side,level){return map.some(function(p){return p&&!p.hidden&&p.rank<0;})?chooseDarkAI(map,side,level):chooseKnownAI(map,side,level);}
  // 只用公开走法和碰子结果收窄敌棋范围；双方各自保留自己的判断，互不泄露。
  function recordMovement(from,to){
    var p=board[from];if(mode!=='layout')return;
    var observer=3-p.side,ranks=p.beliefs&&p.beliefs[observer]||Array.from(new Set(pool));
    var allowed=ranks.filter(function(rank){var map=board.slice();map[from]=piece(p.side,rank);return destinations(map,from).indexOf(to)!==-1;});
    if(!p.beliefs)p.beliefs={};p.beliefs[observer]=allowed;p.moved=true;
  }
  function recordCollision(attacker,target,outcome){
    if(mode!=='layout'||!target)return;
    var survivor=outcome===1?attacker:outcome===-1?target:null;if(!survivor)return;
    var observer=3-survivor.side,ranks=survivor.beliefs&&survivor.beliefs[observer]||Array.from(new Set(pool));
    // 观察者知道自己阵亡棋子的军衔，因此可从裁判结果排除不可能的敌棋。
    var allowed=ranks.filter(function(rank){return outcome===1?combat(rank,target.rank)===1:combat(attacker.rank,rank)===-1;});
    if(!survivor.beliefs)survivor.beliefs={};survivor.beliefs[observer]=allowed;
  }
  function colorFor(actor){return actor===0?humanColor:3-humanColor;}
  function cancelAI(){revision++;if(timer)clearTimeout(timer);timer=0;}
  function scheduleAI(){
    cancelAI();if(blocked()||phase!=='battle'||turn!==1)return;var token=revision;status((battleNote?battleNote+' ':'')+'电脑正在思考……');
    timer=setTimeout(function(){timer=0;if(token!==revision||blocked()||turn!==1)return;var action=chooseAI(publicBoard(board,colorFor(1)),colorFor(1),difficulty);if(token!==revision||blocked())return;if(action)perform(action);else conclude(0,'电脑无合法行动，你赢了。');},280+Math.floor(Math.random()*160));
  }
  function text(id,value){var node=document.getElementById(id),s=String(value);if(node.textContent!==s)node.textContent=s;}
  function detail(){
    var colors=['待定','红方','蓝方'];text('detail',phase==='setup'?'调整红方布局，完成后开始对局。':'你执'+colors[humanColor]+' · 第 '+moves+' 步 · '+(turn===0?'轮到你':'电脑行动'));
    text('rule-label',(mode==='layout'?'布局暗棋':'混排翻棋')+' · '+({easy:'轻松',normal:'标准',hard:'挑战'}[difficulty])+'电脑');
    text('score',number('wins:'+(mode==='layout'?'layout-dark':mode)+':'+difficulty,0));text('best',number('losses:'+(mode==='layout'?'layout-dark':mode)+':'+difficulty,0));
    document.getElementById('deploy').hidden=phase!=='setup';document.getElementById('random-layout').hidden=phase!=='setup';document.getElementById('resign').disabled=phase!=='battle'||ended;
    document.querySelectorAll('[data-mode]').forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.mode===mode));});
  }
  function positionKey(){return turn+':'+humanColor+':'+board.map(function(p){return !p?'.':p.hidden?'?':p.side+'-'+p.rank;}).join(',');}
  function conclude(winner,message){cancelAI();if(winner!==null){var field=winner===0?'wins':'losses',k=field+':'+(mode==='layout'?'layout-dark':mode)+':'+difficulty;save(key+':'+k,String(number(k,0)+1));}finish(message);detail();draw();}
  function revealFlag(side){board.forEach(function(p){if(p&&p.side===side&&p.rank===0){p.hidden=false;p.revealed=true;}});battleNote+=(side===1?' 红':' 蓝')+'司令阵亡，亮旗。';}
  function nextTurn(capture,flipped){
    var actionMessage=turn===1?(flipped?'电脑翻开了一枚棋子。':'电脑移动了棋子。'):'';
    selected=-1;moves++;quiet=capture||flipped?0:quiet+1;turn=1-turn;detail();draw();
    var k=positionKey();repetitions[k]=(repetitions[k]||0)+1;
    if(repetitions[k]>=3||quiet>=100){conclude(null,'本局和棋：'+(quiet>=100?'连续100步没有吃子或翻棋。':'同一局面第三次出现。'));return;}
    if(!hasHidden(board)&&!allMoves(board,colorFor(turn)).length){conclude(1-turn,turn===1?'电脑无棋可走，你赢了。':'你已无棋可走，电脑获胜。');return;}
    status(actionMessage+(battleNote?battleNote+' ':'')+(turn===0?(mode==='flip'&&hasHidden(board)?'轮到你，可走棋或翻子。':'轮到你，请走棋。'):'电脑正在思考……'));scheduleAI();
  }
  function perform(action){
    if(blocked()||phase!=='battle')return false;
    if(action.flip!==undefined){if(mode!=='flip')return false;var p=board[action.flip];if(!p||!p.hidden)return false;battleNote='';p.hidden=false;if(!humanColor)humanColor=p.side;flipRun[colorFor(turn)]=(flipRun[colorFor(turn)]||0)+1;sound(580);nextTurn(false,true);return true;}
    var attacker=board[action.from],target=board[action.to];if(!attacker||attacker.side!==colorFor(turn)||destinations(board,action.from).indexOf(action.to)===-1)return false;
    var outcome=target?combat(attacker.rank,target.rank):1,flag=target&&target.rank===0;
    recordMovement(action.from,action.to);recordCollision(attacker,target,outcome);
    battleNote=target?(outcome===0?'双方同归于尽。':(outcome===1?attacker.side:target.side)===humanColor?'我方获胜。':'敌方获胜。'):battleNote;
    var route=movePath(board,action.from,action.to);board=applyMove(board,action);lastMove={from:action.from,to:action.to,side:attacker.side,path:route};moveMemory[attacker.side].push({from:action.from,to:action.to,position:mode==='flip'?mapKey(board,3-attacker.side):null});if(moveMemory[attacker.side].length>8)moveMemory[attacker.side].shift();flipRun[attacker.side]=0;
    if(target&&target.rank===9&&outcome>=0)revealFlag(target.side);if(attacker.rank===9&&outcome<=0)revealFlag(attacker.side);
    sound(target?340:620);if(flag){moves++;selected=-1;conclude(turn,turn===0?'夺取军旗，你赢了！':'军旗被夺，电脑获胜。');return true;}
    nextTurn(!!target,false);return true;
  }
  function activate(i){
    if(blocked())return;cursor=i;
    if(phase==='setup'){
      var p=board[i];if(!p||p.side!==1){status('请选择下方红方棋子进行交换。');return;}
      if(selected<0){selected=i;status('再选择另一枚红棋交换位置。');}
      else if(selected===i)selected=-1;
      else if(validPlacement(board[selected],i)&&validPlacement(p,selected)){var temp=board[selected];board[selected]=p;board[i]=temp;selected=-1;status('布局已调整，可继续交换或完成布局。');}
      else status('摆放不合法：军旗在大本营，地雷在后两排，炸弹不能在最前排。');draw();return;
    }
    if(turn!==0)return;
    var q=board[i];if(mode==='flip'&&q&&q.hidden){perform({flip:i});return;}
    if(selected>=0&&perform({from:selected,to:i}))return;
    if(q&&q.side===humanColor){selected=selected===i?-1:i;status(q.rank===0||q.rank===11?'军旗和地雷不能移动。':'已选'+names[q.rank]+'，请选择标记的落点。');}else selected=-1;draw();
  }
  function deploy(){if(blocked()||phase!=='setup')return;initializeBeliefs(board);phase='battle';selected=-1;repetitions[positionKey()]=1;status('红方先行。点击棋子查看可行落点。');detail();draw();}
  function restart(){cancelAI();resetState();difficulty=['easy','normal','hard'].indexOf(settings.option)!==-1?settings.option:'normal';board=newBoard();phase=mode==='layout'?'setup':'battle';turn=0;humanColor=mode==='layout'?1:0;selected=-1;cursor=57;moves=0;quiet=0;repetitions={};lastMove=null;battleNote='';moveMemory={1:[],2:[]};flipRun={1:0,2:0};ready=true;detail();draw();status(mode==='layout'?'先调整己方布局，再开始对局。':'翻开第一枚棋子决定你的阵营。');showCover('准备好了吗？',mode==='layout'?'布好旗雷，调兵出击。':'先翻一子，决定你的阵营。',mode==='layout'?'开始布局':'开始翻棋');syncStart();}
  function center(i){return geometry.points[i];}
  function round(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function drawSurface(){
    ctx.clearRect(0,0,600,800);ctx.fillStyle='#d4bc8c';ctx.fillRect(0,0,600,800);
    // 固定纹理不消耗玩法随机数，重绘不会改变电脑采样与布阵。
    for(var grain=0;grain<56;grain++){var gx=grain*11;ctx.strokeStyle=grain%3?'#bba47730':'#f6e4b638';ctx.lineWidth=grain%3+1;ctx.beginPath();ctx.moveTo(gx,4);ctx.bezierCurveTo(gx-12,260,gx+17,520,gx-4,796);ctx.stroke();}
    ctx.strokeStyle='#8b7553';ctx.lineWidth=6;ctx.strokeRect(3,3,594,794);ctx.strokeStyle='#b19b70';ctx.lineWidth=1;ctx.strokeRect(10,10,580,780);ctx.lineCap='round';
  }
  function drawConnections(){
    geometry.roadEdges.forEach(function(edge){var a=center(edge[0]),b=center(edge[1]);ctx.strokeStyle='#887653';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();});
    geometry.railEdges.forEach(function(edge){var a=center(edge[0]),b=center(edge[1]);ctx.strokeStyle='#344638';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle='#f9f4df';ctx.lineWidth=3;ctx.setLineDash([8,7]);ctx.stroke();ctx.setLineDash([]);});
    ctx.textAlign='center';ctx.textBaseline='middle';
    [180,420].forEach(function(x){ctx.fillStyle='#d8c89e';ctx.beginPath();ctx.arc(x,400,28,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8a9263';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(x,400,23,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#65734c';ctx.font='18px sans-serif';ctx.fillText('山界',x,400);});
    [60,300,540].forEach(function(x){ctx.fillStyle='#e4d7b6';ctx.fillRect(x-23,389,46,22);ctx.strokeStyle='#596d4e';ctx.lineWidth=2;ctx.strokeRect(x-23,389,46,22);ctx.fillStyle='#536346';ctx.font='15px sans-serif';ctx.fillText('前线',x,400);});
  }
  function drawStations(){
    for(var i=0;i<60;i++){
      var c=center(i);ctx.fillStyle=camp(i)?'#d7dba3':hq(i)?'#dcc28e':'#788c50';ctx.strokeStyle=camp(i)?'#6e8248':'#4d6846';ctx.lineWidth=2;
      if(camp(i)){ctx.beginPath();ctx.arc(c.x,c.y,24,0,Math.PI*2);}else round(c.x-(hq(i)?48:30),c.y-(hq(i)?20:13),hq(i)?96:60,hq(i)?40:26,hq(i)?13:2);ctx.fill();ctx.stroke();
      if(!board[i]&&(camp(i)||hq(i))){ctx.fillStyle=hq(i)?'#7f4c2c':'#556d3e';ctx.font=(hq(i)?'19':'17')+'px sans-serif';ctx.fillText(camp(i)?'行营':'大本营',c.x,c.y);}
    }
  }
  function drawTravelPath(){
    var preview=selected>=0&&phase==='battle'?movePath(board,selected,cursor):[];
    var path=preview.length?preview:lastMove&&lastMove.path;if(!path||path.length<2)return;
    ctx.strokeStyle=preview.length?'#5366d6':'#ac762e';ctx.lineWidth=preview.length?4:3;ctx.setLineDash(preview.length?[7,5]:[]);ctx.beginPath();
    path.forEach(function(i,index){var p=center(i);if(index)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.stroke();ctx.setLineDash([]);
  }
  function drawPieces(){
    board.forEach(function(p,i){
      if(!p)return;var c=center(i),visible=rankVisible(p,humanColor||1),back=!visible;
      ctx.fillStyle='#89744e';round(c.x-45,c.y-16,90,39,4);ctx.fill();ctx.fillStyle=back?'#6d8248':p.side===1?'#f4ddae':'#dce6d3';ctx.strokeStyle=back?'#3f6040':p.side===1?'#aa7541':'#53755e';ctx.lineWidth=2;round(c.x-45,c.y-21,90,39,4);ctx.fill();ctx.stroke();
      ctx.strokeStyle=back?'#a8b876':'#f6edcc';ctx.lineWidth=1;round(c.x-40,c.y-17,80,30,2);ctx.stroke();ctx.font='bold 25px sans-serif';
      if(visible){ctx.fillStyle=p.side===1?'#914b2f':'#315b50';ctx.fillText(names[p.rank],c.x,c.y-1);}else{ctx.strokeStyle='#a9b979';ctx.lineWidth=2;round(c.x-27,c.y-10,54,18,1);ctx.stroke();}
    });
    headquarters.forEach(function(i){var c=center(i);ctx.fillStyle='#795331';ctx.font='14px sans-serif';ctx.fillText('大本营',c.x,c.y+(row(i)===0?-28:28));});
  }
  function drawHighlights(){
    var legal=selected>=0&&phase==='battle'?destinations(board,selected):[];
    legal.forEach(function(i){var c=center(i);ctx.fillStyle='#5366d6';ctx.beginPath();ctx.arc(c.x,c.y,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();});
    if(selected>=0){var s=center(selected);ctx.strokeStyle='#5366d6';ctx.lineWidth=5;round(s.x-49,s.y-27,98,51,8);ctx.stroke();}
    if(document.activeElement===canvas){var f=center(cursor);ctx.strokeStyle='#253047';ctx.lineWidth=2;ctx.setLineDash([5,4]);round(f.x-52,f.y-29,104,55,8);ctx.stroke();ctx.setLineDash([]);}
    if(lastMove){[lastMove.from,lastMove.to].forEach(function(i){var p=center(i);ctx.strokeStyle='#ac762e';ctx.lineWidth=2;round(p.x-48,p.y-24,96,46,5);ctx.stroke();});}
  }
  function draw(){
    drawSurface();drawConnections();drawStations();drawTravelPath();drawPieces();drawHighlights();
    var focus=board[cursor],description=!focus?'空站':!rankVisible(focus,humanColor||1)?(mode==='layout'?'敌方暗棋':'未翻棋子'):(focus.side===1?'红方':'蓝方')+names[focus.rank];
    canvas.setAttribute('aria-label','军棋棋盘，第'+(row(cursor)+1)+'排第'+(col(cursor)+1)+'列，'+description+'。方向键选择，回车或空格操作。');
  }
  canvas.addEventListener('click',function(event){var i=pointerStation(event.clientX,event.clientY,canvas.getBoundingClientRect());if(i>=0)activate(i);});
  canvas.addEventListener('keydown',function(event){if(blocked())return;var r=row(cursor),c=col(cursor);if(event.key==='ArrowUp')r--;else if(event.key==='ArrowDown')r++;else if(event.key==='ArrowLeft')c--;else if(event.key==='ArrowRight')c++;else if(event.key==='Enter'||event.key===' '){event.preventDefault();activate(cursor);return;}else if(event.key==='Escape'){selected=-1;draw();return;}else return;event.preventDefault();cursor=Math.max(0,Math.min(11,r))*5+Math.max(0,Math.min(4,c));draw();});
  canvas.addEventListener('focus',draw);canvas.addEventListener('blur',draw);
  document.getElementById('deploy').addEventListener('click',deploy);
  document.getElementById('random-layout').addEventListener('click',function(){if(blocked()||phase!=='setup')return;var red=formation(1);for(var i=30;i<60;i++)board[i]=red[i];initializeBeliefs(board);selected=-1;draw();status('已随机布阵，可继续交换棋子。');});
  document.getElementById('resign').addEventListener('click',function(){if(!blocked()&&phase==='battle')conclude(1,'你已认输，电脑获胜。');});
  document.getElementById('restart').addEventListener('click',restart);
  document.querySelectorAll('[data-mode]').forEach(function(button){button.addEventListener('click',function(){if(button.dataset.mode===mode)return;mode=button.dataset.mode;save(key+':mode',mode);restart();});});
  onPause=cancelAI;onResume=function(){detail();status(phase==='setup'?'继续调整布局。':turn===0?'轮到你。':'电脑正在思考……');scheduleAI();};
  onOption=function(){status('难度已保存，重新开始后生效。');};
  function showCover(title,note,action){document.getElementById('game-cover').hidden=false;text('cover-title',title);text('cover-note',note);text('cover-action',action);}
  function hideCover(){document.getElementById('game-cover').hidden=true;}
  function syncStart(){document.getElementById('start').textContent=paused?'继续游戏':ended?'再玩一局':mode==='layout'?'开始布局':'开始翻棋';document.getElementById('start').disabled=!ready&&!paused&&!ended;}
  function startGame(){if(dialog.open)return;if(ended)restart();if(paused){ready=false;resume();return;}ready=false;hideCover();syncStart();status(phase==='setup'?'点击两枚红棋交换位置，完成后开始对局。':'翻开一枚暗子，决定你的阵营。');}
  document.getElementById('start').addEventListener('click',startGame);document.getElementById('cover-action').addEventListener('click',startGame);
  restart();
}());
