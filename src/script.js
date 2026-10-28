/* 导航数据集中维护：新增游戏只需增加记录，ready 为 true 后才生成可进入的链接。 */
(function () {
  'use strict';
  var games = [
    {id:"stack-tower",name:"叠叠高楼",description:"看准时机叠起彩色楼层，完美落点让城市不断长高。",tags:["休闲","益智"],controls:"点击 · 拖动 · 键盘 · 触屏",ready:true},
    {id:"laser-mirrors",name:"激光折射",description:"限次旋转镜面，按编号接通能量点与接收器。",tags:["休闲","益智"],controls:"点击 · 拖动 · 键盘 · 触屏",ready:true},
    {id:"gear-drive",name:"齿轮传动",description:"用有限齿轮连接全部指定轴和终点，规划最短传动路线。",tags:["休闲","益智"],controls:"点击 · 拖动 · 键盘 · 触屏",ready:true},
    {id:"slingshot",name:"弹弓投射",description:"拉开弹弓，沿着抛物线击倒木箱高塔。",tags:["休闲","益智"],controls:"点击 · 拖动 · 键盘 · 触屏",ready:true},
    {id:"magnet-lab",name:"磁铁解谜",description:"拖动磁铁，借助吸引与排斥引导小球穿过机关。",tags:["休闲","益智"],controls:"点击 · 拖动 · 键盘 · 触屏",ready:true},
    {id:"rolling-maze",name:"滚珠迷宫",description:"轻轻倾斜木盘，带着钥匙滚向出口。",tags:["休闲","益智"],controls:"点击 · 拖动 · 键盘 · 触屏",ready:true},
    {id:"ring-toss",name:"套圈游戏",description:"拉开圆环，轻轻一抛，把小摊上的奖品套回家。",tags:["休闲","益智"],controls:"点击 · 拖动 · 键盘 · 触屏",ready:true},
    {id:"fruit-catch",name:"接水果",description:"移动藤编小篮，接住果实，躲开落下的小石头。",tags:["休闲","益智"],controls:"点击 · 拖动 · 键盘 · 触屏",ready:true},
    {id:"pull-the-pin",name:"拔针救球",description:"挑战接力、旁路供色与窄仓分批，规划不同拔针顺序。",tags:["休闲","益智"],controls:"点击 · 拖动 · 键盘 · 触屏",ready:true},
    {id:"block-fit",name:"消除方块",description:"把柔和彩块安放进棋盘，一次填满，多线连消。",tags:["休闲","益智"],controls:"点击 · 拖动 · 键盘 · 触屏",ready:true},
    {id:"word-trails",name:"单词寻踪",description:"在字母花园里连起单词，收集一页主题词汇。",tags:["休闲","益智"],controls:"点击 · 拖动 · 键盘 · 触屏",ready:true},
    {id:"sequence-memory",name:"节奏记忆",description:"看灯光，听短音，把一串节奏完整记住。",tags:["休闲","益智"],controls:"点击 · 拖动 · 键盘 · 触屏",ready:true},
    {id:"spot-difference",name:"找茬",description:"六个原创场景主题，36关细节对照，发现藏在风景里的不同。",tags:["休闲","益智"],controls:"点击 · 键盘 · 触屏",ready:true},
    {id:"jigsaw",name:"拼图",description:"拖动凹凸拼块，拼回林间小屋、海岸灯塔与星空营地。",tags:["休闲","益智"],controls:"拖动 · 键盘 · 触屏",ready:true},
    {id:"idiom",name:"成语挑战",description:"读释义、补成语、辨情境，连对点亮成语小书房。",tags:["益智","休闲"],controls:"点击 · 数字键1–4 · 触屏",ready:true},
    {id:"jump-hop",name:"跳一跳",description:"按住蓄力，松手跃上浮岛，连续正中挑战高分。",tags:["休闲","街机"],controls:"按住松手 · 空格 · 触屏",ready:true},
    {id:"tangram",name:"七巧板",description:"拖动、旋转七块拼板，拼出16幅不同轮廓。",tags:["益智","休闲"],controls:"拖动 · 旋转 · 翻面 · 键盘",ready:true},
    {id:"quiz",name:"知识答题",description:"随机抽取知识题，边答边学，看看你能答对几道。",tags:["益智","休闲"],controls:"点击 · 数字键1–4 · 触屏",ready:true},
    {"id": "one-stroke", "name": "一笔画", "description": "挑战60幅不同线路图，规划岔路，沿线一笔走完。", "tags": ["益智"], "controls": "点击 · 键盘 · 触屏", "ready": true},
    {"id": "lights-out", "name": "翻灯谜题", "description": "轻点灯阵，寻找全部熄灭的顺序。", "tags": ["益智"], "controls": "点击 · 键盘 · 触屏", "ready": true},
    {"id": "hanoi", "name": "河内塔", "description": "腾挪彩色圆盘，把整座塔搬到右边。", "tags": ["益智"], "controls": "点击 · 键盘 · 触屏", "ready": true},
    {"id": "merge-fruit", "name": "合成球", "description": "投下圆润彩球，同级碰撞合成更大一级。", "tags": ["休闲"], "controls": "点击 · 键盘 · 触屏", "ready": true},
    {"id": "zuma", "name": "祖玛", "description": "瞄准移动的球链，三连消除守住终点。", "tags": ["街机"], "controls": "点击 · 键盘 · 触屏", "ready": true},
    {"id": "pac-maze", "name": "吃豆迷宫", "description": "穿过回廊收集豆子，强化后反击追兵。", "tags": ["街机"], "controls": "点击 · 键盘 · 触屏", "ready": true},
    {"id": "gold-miner", "name": "黄金矿工", "description": "抓准摆钩时机，带回深处的闪亮矿藏。", "tags": ["街机"], "controls": "点击 · 键盘 · 触屏", "ready": true},
    {"id": "cut-rope", "name": "割绳子", "description": "看准摆动轨迹，让糖果落进收集杯。", "tags": ["休闲", "益智"], "controls": "点击 · 键盘 · 触屏", "ready": true},
    {"id": "hex-mines", "name": "六边扫雷", "description": "在六向相邻的蜂巢里推理安全格。", "tags": ["益智"], "controls": "点击 · 键盘 · 触屏", "ready": true},
    {"id": "kenken", "name": "肯肯算术棋", "description": "用行列与分区算式，拼出完整数字棋盘。", "tags": ["益智"], "controls": "点击 · 键盘 · 触屏", "ready": true},
    {"id": "battleship", "name": "战舰棋", "description": "结合行列数量，找出互不接触的隐藏舰队。", "tags": ["益智"], "controls": "点击 · 键盘 · 触屏", "ready": true},
    {"id": "dominoes", "name": "多米诺骨牌", "description": "匹配两端点数，抢先打完手中骨牌。", "tags": ["休闲", "益智"], "controls": "点击 · 键盘 · 触屏", "ready": true},
    {"id": "dice-score", "name": "掷骰计分棋", "description": "保留好骰子，选准每一轮的得分组合。", "tags": ["休闲", "益智"], "controls": "点击 · 键盘 · 触屏", "ready": true},

    {"id": "hashi", "name": "数桥", "description": "按数字架起桥梁，让所有岛屿连成一体。", "tags": ["益智"], "controls": "点击 · 方向键 · 触屏", "ready": true},
    {"id": "akari", "name": "点灯", "description": "点亮每个角落，让光线恰到好处。", "tags": ["益智"], "controls": "点击 · 方向键 · 触屏", "ready": true},
    {"id": "tents", "name": "帐篷与树", "description": "读懂行列数量，为每棵树安排帐篷。", "tags": ["益智"], "controls": "点击 · 方向键 · 触屏", "ready": true},
    {"id": "slitherlink", "name": "数回", "description": "沿着数字画线，围成一条完整回路。", "tags": ["益智"], "controls": "点击 · 拖画 · 键盘 · 触屏", "ready": true},
    {"id": "flow", "name": "彩线连连", "description": "Flow连线玩法，连接同号端点，用彩线铺满棋盘。", "tags": ["益智"], "controls": "拖动 · 点击 · 触屏", "ready": true},
    {"id": "klotski", "name": "华容道", "description": "腾挪木块，让曹操走出下方出口。", "tags": ["益智"], "controls": "拖动 · 方向键 · 触屏", "ready": true},
    {"id": "hex-blocks", "name": "六边形消除", "description": "摆放蜂巢拼块，连成直线，收获消除。", "tags": ["休闲"], "controls": "拖放 · 键盘 · 触屏", "ready": true},
    {"id": "pinball", "name": "弹珠台", "description": "翻动挡板，让弹珠在星光中反弹。", "tags": ["街机"], "controls": "方向键 / A·D · 按住 · 触屏", "ready": true},
    {"id": "mini-golf", "name": "迷你高尔夫", "description": "拖动瞄准，借助反弹，把小球送入洞口。", "tags": ["休闲"], "controls": "拖动瞄准 · 键盘 · 触屏", "ready": true},
    {"id": "bomber", "name": "炸弹人", "description": "炸墙、收集道具，击退敌人寻找出口。", "tags": ["街机"], "controls": "键盘 · 点击 · 触屏", "ready": true},
    {"id": "water-sort", "name": "水排序", "description": "分装彩色液体，整理出每管一种颜色。", "tags": ["益智"], "controls": "键盘 · 点击 · 触屏", "ready": true},
    {"id": "parking", "name": "仓库停车场", "description": "移动车辆，为红车清出出口。", "tags": ["益智"], "controls": "键盘 · 点击 · 触屏", "ready": true},
    {"id": "spider", "name": "蜘蛛纸牌", "description": "整理同花顺序，收齐八组K至A。", "tags": ["益智"], "controls": "键盘 · 点击 · 触屏", "ready": true},
    {"id": "flying", "name": "飞行棋", "description": "掷骰起飞，巧用跳跃抢先归航。", "tags": ["休闲"], "controls": "键盘 · 点击 · 触屏", "ready": true},
    {"id": "chess", "name": "国际象棋", "description": "调动棋子，将死对方国王。", "tags": ["益智"], "controls": "键盘 · 点击 · 触屏", "ready": true},
    {"id": "fishing", "name": "钓鱼游戏", "description": "把握咬钩时机，控制收线张力。", "tags": ["休闲"], "controls": "键盘 · 点击 · 触屏", "ready": true},
    {"id": "rhythm", "name": "节奏点击", "description": "跟随原创节拍，挑战精准连击。", "tags": ["街机"], "controls": "键盘 · 点击 · 触屏", "ready": true},
    {"id": "pipes", "name": "接水管", "description": "旋转管道，连通水源与出口。", "tags": ["益智"], "controls": "键盘 · 点击 · 触屏", "ready": true},
    {"id": "nurikabe", "name": "数墙", "description": "根据数字划分岛屿，连成黑色水域。", "tags": ["益智"], "controls": "键盘 · 点击 · 触屏", "ready": true},
    { id: 'tower-defense', name: '塔防守卫', description: '建造三类防御塔，迎战自动来袭的敌兵，闯过六道防线。', tags: ['益智', '街机'], controls: '点击 · 数字键 · 触屏', ready: true },
    { id: 'plants-vs-zombies', name: '植物大战僵尸', description: '种植植物、巧用道具，挑战十二关各具变化的僵尸防线。', tags: ['益智', '街机'], controls: '点击 · 数字键 · 触屏', ready: true },
    { id: 'junqi', name: '军棋', description: '排兵布阵或翻开暗棋，沿铁路出击，夺取对方军旗。', tags: ['益智'], controls: '点击 · 方向键 · 触屏', ready: true },
    { id: 'jungle', name: '斗兽棋', description: '八兽争先，巧用河流与陷阱，抢占对方兽穴。', tags: ['益智'], controls: '点击 · 方向键 · 触屏', ready: true },
    { id: 'match3', name: '三消游戏', description: '交换相邻图案，连成三块，享受下落与连锁消除。', tags: ['休闲', '益智'], controls: '点击 · 滑动 · 方向键 · 触屏', ready: true },
    { id: 'maze', name: '迷宫探险', description: '穿过蜿蜒通道，收集三颗宝石，寻找迷宫出口。', tags: ['益智', '休闲'], controls: '方向键 / WASD · 滑动 · 触屏', ready: true },
    { id: 'nonogram', name: '数织', description: '读懂行列数字，填色与留白，拼出隐藏的像素图案。', tags: ['益智'], controls: '点击 · 拖涂 · 触屏', ready: true },
    { id: 'go', name: '围棋', description: '黑白交替，围地提子，在方寸棋盘间经营全局。', tags: ['益智'], controls: '点击 · 方向键 · 触屏', ready: true },
    { id: 'reversi', name: '黑白棋', description: '落子夹击，翻转黑白，争夺棋盘的每一个角。', tags: ['益智'], controls: '点击 · 方向键 · 触屏', ready: true },
    { id: 'twenty-four', name: '算二十四点', description: '四个数字，加减乘除与括号，组合出恰好二十四。', tags: ['益智'], controls: '点击 · 触屏', ready: true },
    { id: 'whack-a-mole', name: '打地鼠', description: '抓准地鼠冒头的瞬间，连续命中，挑战一分钟高分。', tags: ['休闲', '街机'], controls: '点击 · 数字键1–9 · 触屏', ready: true },
    { id: 'halma', name: '跳棋', description: '六角星上连续跳跃，抢先将十枚棋子送入对营。', tags: ['益智'], controls: '点击 · 方向键 · 触屏', ready: true },
    { id: 'solitaire', name: '接龙纸牌', description: '红黑交替整理牌列，从 A 到 K 收齐四种花色。', tags: ['休闲', '益智'], controls: '点击 · 拖动 · 触屏', ready: true },
    { id: 'xiangqi', name: '中国象棋', description: '明棋与4×8翻棋，支持人机及本机双人对弈。', tags: ['益智'], controls: '点击 · 方向键 · 触屏', ready: true },
    { id: 'linkmatch', name: '连连看', description: '找出相同图案，两次转弯以内连线消除。', tags: ['休闲', '益智'], controls: '点击 · 触屏', ready: true },
    { id: 'bird', name: '小鸟飞行', description: '轻点拍翅，穿过管道，在起落之间找到节奏。', tags: ['休闲', '街机'], controls: '点击 · 空格 / ↑ · 触屏', ready: true },
    { id: 'gomoku', name: '五子棋', description: '黑白交替，五子连珠，与电脑或朋友对弈。', tags: ['益智'], controls: '点击 · 触屏 · 方向键', ready: true },
    { id: 'tanks', name: '坦克大战', description: '击破敌方坦克，守护基地，迎战六波敌军。', tags: ['街机'], controls: '方向键 / WASD · 鼠标 · 触屏', ready: true },
    { id: 'airbattle', name: '飞机大战', description: '驾驶战机穿越弹幕，自动射击，挑战生存纪录。', tags: ['街机'], controls: '方向键 / WASD · 鼠标 · 拖动', ready: true },
    { id: 'bubbles', name: '泡泡龙', description: '瞄准发射，同色三连，巧用反弹清空泡泡。', tags: ['休闲', '益智'], controls: '鼠标 · 方向键 · 触屏', ready: true },
    { id: 'tetris', name: '俄罗斯方块', description: '旋转下落的方块，填满横行，挑战消行纪录。', tags: ['街机', '益智'], controls: '方向键 / WASD · 触屏', ready: true },
    { id: 'sokoban', name: '推箱子', description: '绕到箱子背后，把每一个箱子推上目标。', tags: ['益智'], controls: '方向键 / WASD · 滑动 · 触屏', ready: true },
    { id: 'sudoku', name: '数独', description: '循着行列与九宫格的线索，填满每一个数字。', tags: ['益智'], controls: '键盘 · 点击 · 触屏', ready: true },
    { id: 'puzzle', name: '数字华容道', description: '移动数字与空格，将每一块拼回正确的位置。', tags: ['益智'], controls: '方向键 / WASD · 点击 · 滑动', ready: true },
    { id: 'snake', name: '贪吃蛇', description: '控制小蛇，吃到食物，挑战更高的分数。', tags: ['休闲', '街机'], controls: '方向键 / WASD · 触屏', ready: true },
    { id: '2048', name: '2048', description: '滑动合并相同数字，一步步拼出 2048。', tags: ['益智', '休闲'], controls: '方向键 · 滑动', ready: true },
    { id: 'mines', name: '扫雷', description: '寻找数字中的线索，发现所有安全格子。', tags: ['益智'], controls: '鼠标 · 触屏', ready: true },
    { id: 'memory', name: '记忆翻牌', description: '翻开卡片，找到每一对相同的图案。', tags: ['益智', '休闲'], controls: '鼠标 · 触屏', ready: true },
    { id: 'breakout', name: '打砖块', description: '接住小球，击碎砖块，享受每一次反弹。', tags: ['街机'], controls: '键盘 · 鼠标 · 触屏', ready: true }
  ];
  // 首页先展示效果图中的八款入门游戏，其余保持登记顺序；最近玩过仍按时间排序。
  var discoveryOrder = ['snake','2048','gomoku','tangram','stack-tower','solitaire','spot-difference','water-sort'];
  // 存储可能因隐私模式或浏览器权限失败；失败时保留内存状态，不影响浏览。
  function readList(key) { try { var value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value.filter(function (id) { return typeof id === 'string'; }).map(function (id) { return id === 'twenty' ? 'twenty-four' : id; }).filter(function (id, index, ids) { return ids.indexOf(id) === index; }) : []; } catch (error) { return []; } }
  function saveList(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* 无存储权限时仅在当前页面记忆。 */ } }
  var favorites = readList('mini-games:favorites');
  // 原生弹窗承载详细品牌说明，首页仅保留简短寓意。

  var aboutDialog = document.getElementById('about-u2ok');
  document.getElementById('about-open').addEventListener('click', function () {
    if (!aboutDialog.open) aboutDialog.showModal();
  });
  var recent = readList('mini-games:recent');
  var filter = 'all';
  var input = document.getElementById('search');
  var list = document.getElementById('game-list');
  // 数量统计当前登记游戏，不受搜索词影响；过期收藏与历史ID不计入。
  function updateFilterCounts() {
    document.querySelectorAll('[data-filter]').forEach(function (button) {
      var category = button.dataset.filter;
      var count = games.filter(function (game) {
        return category === 'all' || (category === 'favorites' ? favorites.indexOf(game.id) !== -1 : category === 'recent' ? recent.indexOf(game.id) !== -1 : game.tags.indexOf(category) !== -1);
      }).length;
      button.querySelector('.filter-count').textContent = count;
    });
  }
  function render() {
    updateFilterCounts();
    var query = input.value.trim().toLocaleLowerCase();
    var visible = games.filter(function (game) {
      var matchesFilter = filter === 'all' || (filter === 'favorites' ? favorites.indexOf(game.id) !== -1 : filter === 'recent' ? recent.indexOf(game.id) !== -1 : game.tags.indexOf(filter) !== -1);
      return matchesFilter && (game.name + game.description + game.tags.join(' ') + game.controls).toLocaleLowerCase().indexOf(query) !== -1;
    });
    if (filter !== 'recent') visible.sort(function (a, b) {
      var aRank = discoveryOrder.indexOf(a.id), bRank = discoveryOrder.indexOf(b.id);
      return (aRank < 0 ? discoveryOrder.length : aRank) - (bRank < 0 ? discoveryOrder.length : bRank);
    });
    if (filter === 'recent') visible.sort(function (a, b) { return recent.indexOf(a.id) - recent.indexOf(b.id); });
    list.innerHTML = '';
    visible.forEach(function (game) {
      var card = document.createElement('article');
      card.className = 'game-card';
      var selected = favorites.indexOf(game.id) !== -1;
      // 此处模板内容全部来自上方固定数据；用户输入仅参与筛选，不进入 HTML。
      card.innerHTML = '<div class="game-thumbnail" aria-hidden="true"><img src="games/' + game.id + '/logo.svg" width="112" height="112" alt="" loading="lazy" decoding="async"></div><div class="card-title"><h3 class="card-name">' + game.name + '</h3><button class="favorite" data-favorite="' + game.id + '" aria-label="' + (selected ? '取消收藏' : '收藏') + game.name + '" aria-pressed="' + selected + '">' + GameIcons.svg('star', selected) + '</button></div><p class="description">' + game.description + '</p><div class="card-meta"><p class="tags">' + game.tags.map(function (tag) { return '<span class="category-tag">' + tag + '</span>'; }).join('') + game.controls.split(' · ').map(function (control) { return '<span class="control-tag">' + control + '</span>'; }).join('') + '</p>' + (game.ready ? '<a class="button game-entry" data-play="' + game.id + '" href="games/' + game.id + '/index.html" title="' + game.controls + '">开始游戏 ' + GameIcons.svg('right') + '</a>' : '<button class="button game-entry" disabled>即将上线</button>') + '</div>';
      card.querySelector('.tags').title = game.tags.join(' · ') + ' · ' + game.controls;
      list.appendChild(card);
    });
    document.getElementById('result-count').textContent = visible.length + ' 款游戏';
    document.getElementById('clear-search').hidden = !input.value;
    document.getElementById('empty-state').hidden = visible.length !== 0;
    document.getElementById('empty-title').textContent = query ? '没有找到游戏' : filter === 'favorites' ? '还没有收藏的游戏' : filter === 'recent' ? '还没有玩过的游戏' : '没有找到游戏';
    document.getElementById('empty-description').textContent = query ? '试试其他名称或玩法关键词。' : filter === 'favorites' ? '点击游戏卡片上的星标，将喜欢的游戏留在这里。' : '选择一款游戏，开始轻松的一局。';
    document.getElementById('games-title').textContent = filter === 'favorites' ? '我的收藏' : filter === 'recent' ? '最近玩过' : '游戏列表';
    updateBackToTop();
  }
  document.getElementById('filters').addEventListener('click', function (event) { var button = event.target.closest('[data-filter]'); if (!button) return; filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(function (item) { var active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); }); render(); });
  list.addEventListener('click', function (event) {
    var star = event.target.closest('[data-favorite]');
    if (star) { var id = star.dataset.favorite; favorites = favorites.indexOf(id) === -1 ? favorites.concat(id) : favorites.filter(function (item) { return item !== id; }); saveList('mini-games:favorites', favorites); render(); var replacement = list.querySelector('[data-favorite="' + id + '"]'); if (replacement) replacement.focus(); }
    var play = event.target.closest('[data-play]');
    if (play) { recent = [play.dataset.play].concat(recent.filter(function (id) { return id !== play.dataset.play; })).slice(0, 20); saveList('mini-games:recent', recent); updateFilterCounts(); }
  });
  input.addEventListener('input', render);
  // 页面快捷搜索不抢占编辑、输入法、组合键或弹窗内的键盘操作。
  document.addEventListener('keydown', function (event) {
    if (event.key !== '/' || event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || document.querySelector('dialog[open]')) return;
    var target = event.target;
    if (target && (target.isContentEditable || target.closest('input,textarea,select,[role="textbox"]'))) return;
    event.preventDefault(); input.focus(); input.select();
  });
  document.getElementById('search-form').addEventListener('submit', function (event) { event.preventDefault(); });
  document.getElementById('clear-search').addEventListener('click', function () { input.value = ''; render(); input.focus(); });
  document.getElementById('reset-filters').addEventListener('click', function () { input.value = ''; document.querySelector('[data-filter="all"]').click(); });
  document.querySelectorAll('[data-filter]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.filter === filter)); });
  var backToTop = document.getElementById('back-to-top');
  var mainScroll = document.querySelector('.main-scroll');
  var mobileViewport = window.matchMedia('(max-width:850px)');
  // 手机滚动整页，PC滚动内容栏；断点切换后始终读取当前真正的滚动容器。
  function scrollTarget() { return mobileViewport.matches ? window : mainScroll; }
  function updateBackToTop() {
    if (!backToTop) return;
    var top = mobileViewport.matches ? window.scrollY : mainScroll.scrollTop;
    backToTop.hidden = top < 320;
  }
  window.addEventListener('scroll', updateBackToTop, { passive:true });
  mainScroll.addEventListener('scroll', updateBackToTop, { passive:true });
  window.addEventListener('resize', updateBackToTop);
  backToTop.addEventListener('click', function () {
    scrollTarget().scrollTo({ top:0, behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
    document.getElementById('intro-title').focus({ preventScroll:true });
  });
  render();
}());

