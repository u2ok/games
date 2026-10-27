# 知识答题

直接打开index.html，或静态托管整个目录。所有题目、Logo和界面资源均在本目录，答题不联网。

## 玩法

128题，数学推理/科学常识/宇宙探索/地球自然各32题。可选综合随机或单一分类，每局5/10/15题，新局生效。题目及四个选项使用Fisher–Yates洗牌，一局不重复；优先抽取近期未出题，不足时用旧题补足，不承诺相邻两局完全不同。近期仅保存最多32个题号。

点击答案直接提交，或用数字1–4。每题只提交一次，正确10分，错误/跳过0分，无限时；答后锁定选择，显示正确答案、简短解析和来源。下一题由用户主动进入，不自动跳走。最后查看成绩及逐题回顾，回顾不再次计分；最佳成绩按分类和题量分别保存。

P暂停/继续，Enter开始/继续及答后下一题，Shift+Enter重开；原生按钮/选项保持Tab和Enter操作。失焦、页面隐藏、打开更多会暂停，回来手动继续。暂停时玩法区inert，按钮和数字输入不能答题；结束可查看回顾或再来一局。

问题进入与答对反馈使用短动画，遵循减少动态效果偏好；不使用倒计时、限时奖励或联网排名。

## 题库与来源

question-bank.js是本地题库，每题包含稳定ID、分类、原创中文题干、四个选项、正确选项索引、简短解释和来源键。这里是依据公开事实自行整理的科普练习，不是抓取或复制外部考试题库。数学题自行编写并附推导，其余事实依据下列资料，于2026-10-26核对；不采用易变新闻、卫星数量或未定义的排名。

- [NASA：行星概览](https://science.nasa.gov/solar-system/planets/)
- [NASA：火星事实](https://science.nasa.gov/mars/facts/)
- [NASA：金星事实](https://science.nasa.gov/venus/venus-facts/)
- [NASA：月球事实](https://science.nasa.gov/moon/facts/)
- [NASA：太阳事实](https://science.nasa.gov/sun/facts/)
- [BIPM：SI基本单位](https://www.bipm.org/en/measurement-units/si-base-units)
- [英国皇家化学学会：元素周期表](https://periodic-table.rsc.org/)
- [英国皇家化学学会：碳与化学术语](https://periodic-table.rsc.org/element/6/carbon)
- [NOAA：板块边界](https://oceanexplorer.noaa.gov/ocean-fact/plate-boundaries/)
- [NOAA：河口与盐度](https://oceanservice.noaa.gov/education/tutorial_estuaries/est01_whatis.html)
- [USGS：水循环](https://www.usgs.gov/special-topics/water-science-school/water-cycle)
- [USGS：水循环术语](https://www.usgs.gov/glossary/glossary-water-cycle-terms)
- [NOAA：全球海洋](https://oceanservice.noaa.gov/facts/howmanyoceans.html)
- [NOAA：最大海洋](https://oceanservice.noaa.gov/facts/biggestocean.html)
- [NOAA：珊瑚是动物](https://oceanexplorer.noaa.gov/ocean-fact/coral-animal/)
- [NOAA：潮汐](https://oceanservice.noaa.gov/facts/tidefrequency.html)

答后“查看知识来源”可主动打开原文，来源网站可能需要网络；题库本身离线可用。新增题目保持唯一ID、四个互异选项、唯一正确答案与明确限定条件，更新核对日期并跑专项测试。题库在客户端可查看答案，不适用于保密考试或防作弊认证。

## 保存与独立资源

本机保存设置、近期题号和各分类/题量最佳分；不保存未完成局。存储失败降级页内内存，损坏设置恢复默认。Logo为本地答题卡与铅笔SVG。../../shared/base.css/../../shared/interface.js/../../shared/icons.js由根公共源通过sync-interface.py同步，不直接编辑副本。

验证范围见根TEST-REPORT.md，浏览器视口/触屏模拟不等同真机验证。

移动横屏：触屏设备横屏、宽≤1200px且高≤480px时采用左棋盘、右导航/信息/操作；导航、普通操作和专用输入均复用竖屏移动规则，按可用宽度自然换行。PC与竖屏沿用原布局。shared/landscape.css为根目录唯一共享生成资源，不直接编辑；验证范围见根TEST-REPORT.md。

公共资源：本游戏直接引用shared/base.css、shared/interface.js、shared/icons.js、shared/landscape.css；目录内不保存公共副本。运行或部署须保留项目结构，单独复制游戏目录不再完整可用。详见根README.md。
