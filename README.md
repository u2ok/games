# U2OK · 轻量小游戏平台

**U2OK，You too, OK. 愿你也有好状态。** 随时来一局，快乐刚刚好。

汇集休闲、益智与街机玩法，电脑手机都能玩，无需下载，打开即玩。原生 HTML、CSS、JavaScript 实现的79款小游戏，不使用构建工具、框架或 ES6 Modules。

直接打开根目录 `index.html`，或由静态服务器托管项目根目录。导航站资源在 `src/`；移动资源不改变首页地址及游戏入口。

## 已实现游戏（79款）

以下清单与导航登记一致；点击游戏名称进入游戏，玩法与操作详见对应目录的README。数字华容道（`puzzle`）与经典木块华容道（`klotski`）是两款不同游戏。

| 游戏 | 分类 | 玩法简介 |
|---|---|---|
| [叠叠高楼](games/stack-tower/index.html) | 休闲、益智 | 看准时机叠起彩色楼层，完美落点让城市不断长高。 |
| [激光折射](games/laser-mirrors/index.html) | 休闲、益智 | 限次旋转镜面，按编号接通能量点与接收器。 |
| [齿轮传动](games/gear-drive/index.html) | 休闲、益智 | 用有限齿轮连接全部指定轴和终点，规划最短传动路线。 |
| [弹弓投射](games/slingshot/index.html) | 休闲、益智 | 拉开弹弓，沿着抛物线击倒木箱高塔。 |
| [磁铁解谜](games/magnet-lab/index.html) | 休闲、益智 | 拖动磁铁，借助吸引与排斥引导小球穿过机关。 |
| [滚珠迷宫](games/rolling-maze/index.html) | 休闲、益智 | 轻轻倾斜木盘，带着钥匙滚向出口。 |
| [套圈游戏](games/ring-toss/index.html) | 休闲、益智 | 拉开圆环，轻轻一抛，把小摊上的奖品套回家。 |
| [接水果](games/fruit-catch/index.html) | 休闲、益智 | 移动藤编小篮，接住果实，躲开落下的小石头。 |
| [拔针救球](games/pull-the-pin/index.html) | 休闲、益智 | 挑战接力、旁路供色与窄仓分批，规划不同拔针顺序。 |
| [消除方块](games/block-fit/index.html) | 休闲、益智 | 把柔和彩块安放进棋盘，一次填满，多线连消。 |
| [单词寻踪](games/word-trails/index.html) | 休闲、益智 | 在字母花园里连起单词，收集一页主题词汇。 |
| [节奏记忆](games/sequence-memory/index.html) | 休闲、益智 | 看灯光，听短音，把一串节奏完整记住。 |
| [找茬](games/spot-difference/index.html) | 休闲、益智 | 六主题36关、5–7处差异，双图对照、放大、位置提示和独立最快纪录。 |
| [拼图](games/jigsaw/index.html) | 休闲、益智 | 三幅原创风景，6/12/20块凹凸拼图，拖动吸附与成图欣赏。 |
| [成语挑战](games/idiom/index.html) | 益智、休闲 | 32条常用成语，释义寻词、补全与情境辨义，连对有奖。 |
| [跳一跳](games/jump-hop/index.html) | 休闲、街机 | 按住蓄力、松手跃上浮岛，连续正中挑战高分。 |
| [七巧板](games/tangram/index.html) | 益智、休闲 | 拖动、旋转和翻面七块拼板，挑战16幅固定轮廓。 |
| [知识答题](games/quiz/index.html) | 益智、休闲 | 128题四类题库，随机抽题与选项，答后看解析及本局回顾。 |
| [一笔画](games/one-stroke/index.html) | 益智 | 挑战60幅不同线路图，规划岔路，沿线一笔走完。 |
| [翻灯谜题](games/lights-out/index.html) | 益智 | 轻点灯阵，寻找全部熄灭的顺序。 |
| [河内塔](games/hanoi/index.html) | 益智 | 腾挪彩色圆盘，把整座塔搬到右边。 |
| [合成球](games/merge-fruit/index.html) | 休闲 | 投下圆润彩球，同级碰撞合成更大一级。 |
| [祖玛](games/zuma/index.html) | 街机 | 瞄准移动的球链，三连消除守住终点。 |
| [吃豆迷宫](games/pac-maze/index.html) | 街机 | 穿过回廊收集豆子，强化后反击追兵。 |
| [黄金矿工](games/gold-miner/index.html) | 街机 | 抓准摆钩时机，带回深处的闪亮矿藏。 |
| [割绳子](games/cut-rope/index.html) | 休闲、益智 | 看准摆动轨迹，让糖果落进收集杯。 |
| [六边扫雷](games/hex-mines/index.html) | 益智 | 在六向相邻的蜂巢里推理安全格。 |
| [肯肯算术棋](games/kenken/index.html) | 益智 | 用行列与分区算式，拼出完整数字棋盘。 |
| [战舰棋](games/battleship/index.html) | 益智 | 结合行列数量，找出互不接触的隐藏舰队。 |
| [多米诺骨牌](games/dominoes/index.html) | 休闲、益智 | 匹配两端点数，抢先打完手中骨牌。 |
| [掷骰计分棋](games/dice-score/index.html) | 休闲、益智 | 保留好骰子，选准每一轮的得分组合。 |
| [数桥](games/hashi/index.html) | 益智 | 按数字架起桥梁，让所有岛屿连成一体。 |
| [点灯](games/akari/index.html) | 益智 | 点亮每个角落，让光线恰到好处。 |
| [帐篷与树](games/tents/index.html) | 益智 | 读懂行列数量，为每棵树安排帐篷。 |
| [数回](games/slitherlink/index.html) | 益智 | 沿着数字画线，围成一条完整回路。 |
| [彩线连连](games/flow/index.html) | 益智 | Flow连线玩法，连接同号端点，用彩线铺满棋盘。 |
| [华容道](games/klotski/index.html) | 益智 | 腾挪木块，让曹操走出下方出口。 |
| [六边形消除](games/hex-blocks/index.html) | 休闲 | 摆放蜂巢拼块，连成直线，收获消除。 |
| [弹珠台](games/pinball/index.html) | 街机 | 翻动挡板，让弹珠在星光中反弹。 |
| [迷你高尔夫](games/mini-golf/index.html) | 休闲 | 拖动瞄准，借助反弹，把小球送入洞口。 |
| [炸弹人](games/bomber/index.html) | 街机 | 炸墙、收集道具，击退敌人寻找出口。 |
| [水排序](games/water-sort/index.html) | 益智 | 分装彩色液体，整理出每管一种颜色。 |
| [仓库停车场](games/parking/index.html) | 益智 | 移动车辆，为红车清出出口。 |
| [蜘蛛纸牌](games/spider/index.html) | 益智 | 整理同花顺序，收齐八组K至A。 |
| [飞行棋](games/flying/index.html) | 休闲 | 掷骰起飞，巧用跳跃抢先归航。 |
| [国际象棋](games/chess/index.html) | 益智 | 调动棋子，将死对方国王。 |
| [钓鱼游戏](games/fishing/index.html) | 休闲 | 把握咬钩时机，控制收线张力。 |
| [节奏点击](games/rhythm/index.html) | 街机 | 跟随原创节拍，挑战精准连击。 |
| [接水管](games/pipes/index.html) | 益智 | 旋转管道，连通水源与出口。 |
| [数墙](games/nurikabe/index.html) | 益智 | 根据数字划分岛屿，连成黑色水域。 |
| [塔防守卫](games/tower-defense/index.html) | 益智、街机 | 建造三类防御塔，迎战自动来袭的敌兵，闯过六道防线。 |
| [植物大战僵尸](games/plants-vs-zombies/index.html) | 益智、街机 | 种植植物、巧用道具，挑战十二关各具变化的僵尸防线。 |
| [军棋](games/junqi/index.html) | 益智 | 排兵布阵或翻开暗棋，沿铁路出击，夺取对方军旗。 |
| [斗兽棋](games/jungle/index.html) | 益智 | 八兽争先，巧用河流与陷阱，抢占对方兽穴。 |
| [三消游戏](games/match3/index.html) | 休闲、益智 | 交换相邻图案，连成三块，享受下落与连锁消除。 |
| [迷宫探险](games/maze/index.html) | 益智、休闲 | 穿过蜿蜒通道，收集三颗宝石，寻找迷宫出口。 |
| [数织](games/nonogram/index.html) | 益智 | 读懂行列数字，填色与留白，拼出隐藏的像素图案。 |
| [围棋](games/go/index.html) | 益智 | 黑白交替，围地提子，在方寸棋盘间经营全局。 |
| [黑白棋](games/reversi/index.html) | 益智 | 落子夹击，翻转黑白，争夺棋盘的每一个角。 |
| [算二十四点](games/twenty-four/index.html) | 益智 | 四个数字，加减乘除与括号，组合出恰好二十四。 |
| [打地鼠](games/whack-a-mole/index.html) | 休闲、街机 | 抓准地鼠冒头的瞬间，连续命中，挑战一分钟高分。 |
| [跳棋](games/halma/index.html) | 益智 | 六角星上连续跳跃，抢先将十枚棋子送入对营。 |
| [接龙纸牌](games/solitaire/index.html) | 休闲、益智 | 红黑交替整理牌列，从 A 到 K 收齐四种花色。 |
| [中国象棋](games/xiangqi/index.html) | 益智 | 明棋与4×8翻棋，支持人机及本机双人对弈。 |
| [连连看](games/linkmatch/index.html) | 休闲、益智 | 找出相同图案，两次转弯以内连线消除。 |
| [小鸟飞行](games/bird/index.html) | 休闲、街机 | 轻点拍翅，穿过管道，在起落之间找到节奏。 |
| [五子棋](games/gomoku/index.html) | 益智 | 黑白交替，五子连珠，与电脑或朋友对弈。 |
| [坦克大战](games/tanks/index.html) | 街机 | 击破敌方坦克，守护基地，迎战六波敌军。 |
| [飞机大战](games/airbattle/index.html) | 街机 | 驾驶战机穿越弹幕，自动射击，挑战生存纪录。 |
| [泡泡龙](games/bubbles/index.html) | 休闲、益智 | 瞄准发射，同色三连，巧用反弹清空泡泡。 |
| [俄罗斯方块](games/tetris/index.html) | 街机、益智 | 旋转下落的方块，填满横行，挑战消行纪录。 |
| [推箱子](games/sokoban/index.html) | 益智 | 绕到箱子背后，把每一个箱子推上目标。 |
| [数独](games/sudoku/index.html) | 益智 | 循着行列与九宫格的线索，填满每一个数字。 |
| [数字华容道](games/puzzle/index.html) | 益智 | 移动数字与空格，将每一块拼回正确的位置。 |
| [贪吃蛇](games/snake/index.html) | 休闲、街机 | 控制小蛇，吃到食物，挑战更高的分数。 |
| [2048](games/2048/index.html) | 益智、休闲 | 滑动合并相同数字，一步步拼出 2048。 |
| [扫雷](games/mines/index.html) | 益智 | 寻找数字中的线索，发现所有安全格子。 |
| [记忆翻牌](games/memory/index.html) | 益智、休闲 | 翻开卡片，找到每一对相同的图案。 |
| [打砖块](games/breakout/index.html) | 街机 | 接住小球，击碎砖块，享受每一次反弹。 |

## 目录

- `index.html`：导航入口。
- `src/`：导航站 `style.css`、`script.js`、`logo.svg`。
- `games/`：79款游戏，各目录保存玩法资源并直接引用根公共代码，具体规则和操作见各自README。
- `game-base.css`、`game-interface.js`：页面直接引用的公共样式与界面文件。
- `scripts/`：共享横屏CSS生成等开发维护工具。
- `tests/`：结构检查、全站静态检查、快捷键与游戏规则回归。
- `game-icons.js`：公共SVG图标入口，大厅及所有游戏直接引用。

## 维护与规范

| 文档 | 职责 |
|---|---|
| [统一规范](GAME-STANDARD.md) | 技术、布局、样式、Logo、交互与新游戏接入，唯一规范正文 |
| [项目维护约定](AGENTS.md) | 开发代理的执行入口与维护约束 |
| 各游戏目录README | 独立启动、具体玩法、操作、设置及限制 |
| [测试记录](TEST-REPORT.md) | 历史测试范围、修复记录与验证边界 |

新增和修改游戏遵循 [GAME-STANDARD.md](GAME-STANDARD.md)，项目约定见 [AGENTS.md](AGENTS.md)，验证范围与限制见 [TEST-REPORT.md](TEST-REPORT.md)。
## 维护检查

在项目根目录执行（开发检查只需要Node.js，游戏运行不需要）：

```text
node scripts/build-shared-css.cjs
node tests/layout.cjs
node tests/check.cjs
node tests/shortcuts.cjs
```

所有页面直接引用根公共文件，不再生成游戏目录内副本。布局检查验证共享文件引用、无遗留副本及共享横屏CSS是否最新；规则和快捷键检查范围见测试记录。

全站79款游戏已接入触屏横屏布局：左棋盘、右侧紧凑导航与信息操作，导航和操作沿用竖屏移动规则并自然换行；鼠标PC与手机竖屏沿用原布局。game-landscape.css为根目录唯一的共享横屏补充资源，由开发维护脚本汇总公共移动样式及按游戏限定的私有移动规则。
## 公共代码直接引用

全部游戏直接引用项目根目录的公共文件，不再在各游戏目录保存副本：

| 公共文件 | 职责 |
|---|---|
| `game-base.css` | 公共布局、配色、按钮、信息卡和弹窗 |
| `game-interface.js` | 公共快捷键、导航、菜单和移动端适配 |
| `game-icons.js` | 大厅与所有游戏共用的SVG图标 |
| `game-landscape.css` | 大手机横屏补充规则，按游戏隔离私有选择器 |

游戏页面使用`../../game-base.css`等相对路径，按公共基础CSS、游戏私有style.css、公共game-landscape.css的顺序加载样式；图标脚本先于玩法脚本，公共界面脚本最后加载。

可以直接打开根index.html或games/<游戏>/index.html，也可静态托管；必须保留项目目录结构。**只复制一个游戏子目录不再能够完整运行**，部署时应携带根公共文件并保留上述相对路径，或自行调整资源引用。

修改公共JS/CSS后所有游戏立即共用该修改，无需同步副本。修改game-base.css或游戏私有style.css后，运行`node scripts/build-shared-css.cjs`更新根game-landscape.css；`node scripts/build-shared-css.cjs --check`可只读检查生成资源是否最新。该脚本无外部依赖，不是游戏启动步骤。

可选实际浏览器检查：开发机提供Playwright和Edge后运行node tests/shared-browser.cjs，可用PLAYWRIGHT_PATH指定测试包。该检查遍历79款游戏的PC、竖屏、横屏、图标加载、菜单和操作区边界，不属于游戏运行依赖。
