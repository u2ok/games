# 项目维护约定

新增或修改游戏前，阅读 [GAME-STANDARD.md](GAME-STANDARD.md)，它是当前技术、布局、样式、配色、Logo和交互规范的唯一主入口。用户当前明确指示优先。

- 不使用构建工具、框架、ES6 Modules或外部运行依赖；保留shared公共资源及项目结构后可直接运行。
- 公共布局、组件和快捷键修改根 `shared/base.css`、`shared/interface.js`，各游戏直接引用shared公共文件，不保存副本；运行 `node scripts/build-shared-css.cjs`更新共享横屏CSS。
- 私有CSS仅承载棋盘、玩法和必要输入区，不为某个游戏另造导航、信息卡、按钮或面板主题。PC、手机和横屏规则必须明确区分。
- 每款游戏有README和本地物件式SVG Logo；新增游戏同步导航登记和规范中的游戏清单。
- 界面图标统一使用本地SVG：所有页面直接引用shared/icons.js，不使用字符图标、Emoji或图标字体。
- 新增与修改规范只维护 `GAME-STANDARD.md`；项目介绍维护根README，玩法维护各游戏README，测试证据维护 `TEST-REPORT.md`，避免再建立重复规范入口。
- 运行资源布局检查、规则回归、快捷键测试；涉及布局时做实际浏览器检查，特别检查信息裁切和操作区越界。
- 报告准确区分模拟DOM、浏览器视口模拟、真机及完整通关验证，不夸大覆盖范围。
