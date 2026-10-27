/* 界面适配：移动已有控件而非复制，保留游戏原有事件与状态。 */
(function () {
  'use strict';
  // 大手机横屏仅对横屏适配游戏启用，并以粗指针区分普通PC窗口。
  function mobileMedia() {
    return window.matchMedia('(max-width:850px)' + (document.body.hasAttribute('data-landscape') ? ', (min-width:851px) and (max-width:1200px) and (max-height:480px) and (orientation:landscape) and (pointer:coarse)' : ''));
  }
  /* 全站快捷键捕获层：先处理通用动作，未处理的按键继续交给玩法。 */
  function installGameShortcuts() {
    var start = document.getElementById('start');
    var pause = document.getElementById('pause');
    var restart = document.getElementById('restart');
    start.setAttribute('aria-keyshortcuts', 'Enter');
    pause.setAttribute('aria-keyshortcuts', 'P');
    restart.setAttribute('aria-keyshortcuts', 'Shift+Enter');
    pause.title = '暂停 / 继续（P）';
    restart.title = '重新开始（Shift + Enter）';
    var help = document.querySelector('.instructions');
    if (help) {
      var note = document.createElement('p');
      note.textContent = '通用快捷键：P 暂停／继续；Enter 开始／继续／再玩一局；Shift + Enter 重新开始。游戏进行中 Enter 保留原有选子、落子或发射功能。';
      help.appendChild(note);
    }
    document.addEventListener('keydown', function (event) {
      var target = event.target;
      if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (target && (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName))) return;
      if (document.querySelector('dialog[open]')) return;
      var action = null;
      if (event.key.toLowerCase() === 'p' && !event.shiftKey) {
        // 准备阶段不制造一次多余暂停；终局也由开始入口负责重开。
        if (pause.disabled || (!start.disabled && /开始/.test(start.textContent))) return;
        action = pause;
      } else if (event.key === 'Enter' && event.shiftKey) action = restart;
      else if (event.key === 'Enter' && !start.disabled && !(target && /^(BUTTON|A)$/.test(target.tagName))) action = start;
      if (!action || action.disabled) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      action.click();
    }, true);
  }
  installGameShortcuts();
  // 设置内容可滚动，标题与完成按钮独立占位；低高度窗口不再挤出确认按钮。
  var settingsDialog = document.getElementById('settings');
  var doneButton = document.getElementById('settings-close') || document.getElementById('close-settings');
  if (settingsDialog && doneButton) {
    var settingsBody = document.createElement('div');
    settingsBody.className = 'settings-content';
    Array.from(settingsDialog.children).forEach(function (node) {
      if (node !== doneButton && node.tagName !== 'FORM') settingsBody.appendChild(node);
    });
    settingsDialog.insertBefore(settingsBody, doneButton);
  }
  /* 手机双行摘要：原成绩节点与完整信息保留，精简状态只做只读投影。 */
  function installSummaryCard(media) {
    var card, head, metrics, essential, extra, toggle;
    // 移动端统一默认展开；横竖屏分别保留用户在本次会话中的选择。
    var open = true;
    var preference = {portrait:null,landscape:null};
    var activeMode;
    var landscapeMedia = window.matchMedia('(max-width:1200px) and (max-height:480px) and (orientation:landscape) and (pointer:coarse)');
    var detail = document.getElementById('detail');
    var status = document.getElementById('status');
    var pause = document.getElementById('pause');
    var sourceObserver;
    function syncEssential() {
      if (!essential) return;
      var text = status.textContent.trim();
      var important = status.dataset.tone === 'error' || /获胜|胜利|失败|游戏结束|通关|恭喜|成功|进洞/.test(text);
      var boardGame = /^(go|gomoku|xiangqi|jungle|junqi|halma|reversi)$/.test(document.body.dataset.game);
      var html = '';
      if (important || !detail || !detail.textContent.trim()) {
        if (essential.textContent !== text) essential.textContent = text;
      } else {
        if (boardGame) {
          html = detail.textContent.split('·').slice(0, 2).join(' · ').trim();
          if (/继续/.test(pause.textContent)) html = '已暂停 · ' + html;
          if (essential.textContent !== html) essential.textContent = html;
        } else {
          // 保留原HUD中的SVG生命标记，不把SVG转成空白文字。
          html = (/继续/.test(pause.textContent) ? '已暂停 · ' : '') + detail.innerHTML;
          if (essential.innerHTML !== html) essential.innerHTML = html;
        }
      }
      essential.dataset.tone = important ? status.dataset.tone || 'normal' : 'normal';
    }
    function render() {
      extra.hidden = !open;
      // 摘要只服务收起状态；展开后展示原节点，避免同一回合或提示重复。
      essential.hidden = open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('span').textContent = open ? '收起' : '展开';
      card.classList.toggle('summary-expanded', open);
    }
    function adaptSummaryMode() {
      if (!card || !media.matches) return;
      activeMode = landscapeMedia.matches ? 'landscape' : 'portrait';
      open = preference[activeMode] === null ? true : preference[activeMode];
      render();
      // 空间不足时才默认收起：横屏检查详情预算，竖屏检查剩余游戏区。
      // 长内容可正常滚动，不因内容长就收起；手动选择不再被自动覆盖。
      var stage = document.querySelector('.game-stage');
      var board = document.querySelector('.board,.board-wrap');
      var stageHeight = stage.clientHeight || board.getBoundingClientRect().height;
      var ratio = Number(board.getAttribute('data-board-ratio'));
      if (!(ratio > 0)) {
        var parts = getComputedStyle(board).aspectRatio.split('/').map(Number);
        ratio = parts.length === 2 && parts[0] > 0 && parts[1] > 0 ? parts[0] / parts[1] : 1;
      }
      var boardHeader = board.querySelector('[data-board-header]');
      var boardHeaderHeight = boardHeader ? boardHeader.getBoundingClientRect().height : 0;
      // 竖屏应尽量容纳按舞台宽度等比显示的棋盘，而非只保留一块最小可玩区域。
      // 超高棋盘以视口65%为预算，避免无论如何都无法满宽时一律收起。
      var boardBudget = Math.min(stage.clientWidth / ratio + boardHeaderHeight, window.innerHeight * .65);
      var limited = activeMode === 'landscape' ? card.clientHeight < 112 && card.scrollHeight > card.clientHeight + 1 : stageHeight + 2 < boardBudget;
      if (preference[activeMode] === null && limited) {
        open = false;
        render();
      }
      card.dataset.summaryDefaultReason = preference[activeMode] === null ? open ? activeMode + '-expanded' : 'limited-height' : 'preference';
    }
    landscapeMedia.addEventListener('change', adaptSummaryMode);
    window.addEventListener('resize', adaptSummaryMode);
    return function () {
      if (!media.matches) return;
      card = document.querySelector('.mobile-summary, .link-mobile-summary');
      if (!head) {
        card.classList.add('summary-card');
        card.dataset.foldable = 'true';
        head = document.createElement('div');
        head.className = 'summary-head';
        metrics = document.createElement('div');
        metrics.className = 'summary-metrics';
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'summary-toggle';
        toggle.innerHTML = '<span>展开</span>' + window.GameIcons.svg('chevron-down');
        toggle.setAttribute('aria-controls', 'summary-details');
        toggle.setAttribute('aria-label', '展开或收起对局详情');
        head.append(metrics, toggle);
        essential = document.createElement('p');
        essential.className = 'summary-essential';
        essential.setAttribute('role', 'status');
        essential.setAttribute('aria-live', 'polite');
        extra = document.createElement('div');
        extra.className = 'summary-details';
        extra.id = 'summary-details';
        card.append(head, essential, extra);
        toggle.addEventListener('click', function () { open = !open; preference[activeMode] = open; render(); });
        var spaceFrame = 0;
        sourceObserver = new MutationObserver(function () {
          syncEssential();
          // 暂停、回合或提示换行也会占用空间，不能只在窗口resize时判断。
          if (preference[activeMode] === null && !spaceFrame) spaceFrame = window.requestAnimationFrame(function () {
            spaceFrame = 0;
            adaptSummaryMode();
          });
        });
        [detail, status, pause].forEach(function (node) {
          if (node) sourceObserver.observe(node, { childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['data-tone'] });
        });
      }
      var scores = card.querySelector('.scores');
      var clock = card.querySelector('.link-clock');
      if (clock) metrics.appendChild(clock);
      if (scores) {
        metrics.appendChild(scores);
      }
      Array.from(card.children).forEach(function (node) {
        if (node !== head && node !== essential && node !== extra) extra.appendChild(node);
      });
      adaptSummaryMode();
      syncEssential();
      // 等首轮尺寸适配与字体布局完成再核对，避免用到旋转前或初始化前的舞台高度。
      window.requestAnimationFrame(adaptSummaryMode);
    };
  }
  /* 公共导航：保留原控件及设置保存入口，只切换它们的展示位置。 */
  function installResponsiveChrome(bottomButton) {
    var header = document.querySelector('.game-header');
    var menu = document.querySelector('.mobile-menu, .link-mobile-menu');
    var content = menu.querySelector('.mobile-menu-content');
    if (!content) {
      content = document.createElement('div');
      content.className = 'mobile-menu-content';
      menu.appendChild(content);
    }
    var mode = document.querySelector('.mode-switch');
    var level = document.getElementById('level-section');
    var rules = document.querySelector('.instructions');
    var settings = document.querySelector('.settings-button');
    var body = settingsDialog.querySelector('.settings-content');
    var config = document.createElement('div');
    config.className = 'header-config';
    config.setAttribute('aria-label', '游戏模式与配置');
    header.appendChild(config);
    // 桌面按效果图使用原生下拉。适配控件只转交原入口，不维护第二份业务状态。
    if (mode) {
      var modeField = document.createElement('label');
      modeField.className = 'header-mode';
      var modeCaption = document.createElement('span');
      modeCaption.textContent = '模式';
      modeCaption.dataset.compact = '模式';
      var modeSelect = document.createElement('select');
      modeSelect.setAttribute('aria-label', '模式');
      modeField.append(modeCaption, modeSelect);
      config.appendChild(modeField);
      var modeButtons = Array.from(mode.querySelectorAll('button[data-mode]'));
      modeButtons.forEach(function (button) {
        var option = document.createElement('option');
        option.value = button.dataset.mode;
        option.textContent = button.textContent;
        modeSelect.appendChild(option);
      });
      function syncMode() {
        modeButtons.forEach(function (button, index) {
          modeSelect.options[index].disabled = button.disabled;
          if (button.getAttribute('aria-pressed') === 'true') modeSelect.value = button.dataset.mode;
        });
      }
      modeSelect.addEventListener('change', function () {
        var button = modeButtons.find(function (item) { return item.dataset.mode === modeSelect.value; });
        if (button && !button.disabled) button.click();
        syncMode();
      });
      new MutationObserver(syncMode).observe(mode, { attributes:true, subtree:true, attributeFilter:['aria-pressed','disabled'] });
      syncMode();
    }
    // 旧游戏的单选配置在桌面投影为下拉，手机仍保留原设置控件。
    Array.from(body.querySelectorAll('fieldset')).forEach(function (fieldset) {
      var radios = Array.from(fieldset.querySelectorAll('input[type="radio"]'));
      if (!radios.length) return;
      var field = document.createElement('label');
      field.className = 'header-radio-field';
      var caption = document.createElement('span');
      caption.textContent = fieldset.querySelector('legend').textContent;
      var select = document.createElement('select');
      select.setAttribute('aria-label', caption.textContent);
      radios.forEach(function (radio) {
        var option = document.createElement('option');
        option.value = radio.value;
        option.textContent = radio.parentNode.textContent.trim();
        select.appendChild(option);
      });
      function syncRadios() {
        select.disabled = fieldset.disabled;
        radios.forEach(function (radio, index) {
          select.options[index].disabled = radio.disabled;
          if (radio.checked) select.value = radio.value;
        });
      }
      select.addEventListener('change', function (event) {
        event.stopPropagation();
        var radio = radios.find(function (item) { return item.value === select.value; });
        if (radio && !radio.disabled && !fieldset.disabled) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles:true }));
        }
        syncRadios();
      });
      fieldset.addEventListener('change', syncRadios);
      new MutationObserver(syncRadios).observe(fieldset, { attributes:true, subtree:true, attributeFilter:['disabled','checked'] });
      field.append(caption, select);
      fieldset.before(field);
      syncRadios();
    });
    Array.from(body.children).forEach(function (field) {
      if (field.tagName !== 'LABEL' || field.classList.contains('header-radio-field')) return;
      Array.from(field.childNodes).forEach(function (node) {
        if (node.nodeType !== 3 || !node.textContent.trim()) return;
        var text = document.createElement('span');
        text.className = 'setting-caption';
        text.textContent = node.textContent.trim();
        var input = field.querySelector('input, select');
        if (input && !input.hasAttribute('aria-label')) input.setAttribute('aria-label', text.textContent);
        var shortNames = { '棋盘路数':'路数', '电脑难度':'电脑' };
        text.dataset.compact = shortNames[text.textContent] || text.textContent;
        node.replaceWith(text);
      });
    });
    var boardOptions = Array.from(body.querySelectorAll('select option')).filter(function (option) {
      return /^\d+\s*路\s*·/.test(option.textContent.trim());
    });
    var settingsGroup = document.createElement('section');
    settingsGroup.className = 'menu-settings';
    var title = document.createElement('h3');
    title.textContent = '游戏设置';
    settingsGroup.appendChild(title);
    var top = document.createElement('button');
    top.type = 'button';
    top.className = 'header-more';
    top.textContent = '更多';
    top.setAttribute('aria-haspopup', 'dialog');
    top.setAttribute('aria-controls', 'game-more');
    header.appendChild(top);
    menu.id = 'game-more';
    menu.classList.add('game-more');
    menu.setAttribute('aria-label', '更多');
    menu.querySelector('h2').textContent = '更多';
    var close = menu.querySelector('form button');
    close.setAttribute('aria-label', '关闭更多');
    close.innerHTML = window.GameIcons.svg('close');
    var done = document.createElement('button');
    done.type = 'button';
    done.className = 'primary menu-done';
    done.textContent = '返回游戏';
    menu.appendChild(done);
    done.addEventListener('click', function () { menu.close(); });
    // 长关卡列表分页，减少手机弹层占高；游戏仍持有完整列表和原按钮。
    var levelList = document.getElementById('level-list');
    var pageIndex = 0;
    if (levelList) {
      var pager = document.createElement('nav');
      pager.className = 'level-pagination';
      pager.setAttribute('aria-label', '关卡分页');
      var previous = document.createElement('button');
      var next = document.createElement('button');
      var pageLabel = document.createElement('span');
      previous.type = next.type = 'button';
      previous.textContent = '上一页';
      next.textContent = '下一页';
      pageLabel.setAttribute('aria-live', 'polite');
      pager.append(previous, pageLabel, next);
      levelList.after(pager);
      var paginate = function () {
        var buttons = Array.from(levelList.children);
        var pages = Math.max(1, Math.ceil(buttons.length / 20));
        pageIndex = Math.min(pageIndex, pages - 1);
        buttons.forEach(function (button, index) { button.hidden = mq.matches && Math.floor(index / 20) !== pageIndex; });
        pager.hidden = !mq.matches || pages === 1;
        previous.disabled = pageIndex === 0;
        next.disabled = pageIndex === pages - 1;
        pageLabel.textContent = (pageIndex + 1) + ' / ' + pages;
      };
      previous.addEventListener('click', function () { pageIndex--; paginate(); });
      next.addEventListener('click', function () { pageIndex++; paginate(); });
      new MutationObserver(paginate).observe(levelList, { childList:true });
    }
    // 原弹层保留业务事件绑定，控件移出后转发一次change，避免两份设置状态。
    body.addEventListener('change', function () {
      settingsDialog.dispatchEvent(new Event('change'));
    });
    function pauseGame() {
      var pause = document.getElementById('pause');
      if (!pause.disabled && pause.textContent.trim() === '暂停') pause.click();
    }
    body.addEventListener('input', pauseGame, true);
    if (mode) mode.addEventListener('click', pauseGame, true);
    top.addEventListener('click', function () { pauseGame(); if (!menu.open) menu.showModal(); });
    settings.hidden = true;
    var oldTools = header.querySelector('.mobile-tools');
    if (oldTools) oldTools.hidden = true;
    var bottom = bottomButton || document.querySelector('.unified-more, .link-more');
    bottom.setAttribute('aria-haspopup', 'dialog');
    bottom.setAttribute('aria-controls', menu.id);
    function expanded() {
      [top, bottom].forEach(function (button) { button.setAttribute('aria-expanded', String(menu.open)); });
    }
    new MutationObserver(expanded).observe(menu, { attributes:true, attributeFilter:['open'] });
    var mq = mobileMedia();
    var adaptSummary = installSummaryCard(mq);
    function adaptChrome() {
      document.body.classList.toggle('mobile-layout', mq.matches);
      if (menu.open) menu.close();
      if (mq.matches) {
        if (level) content.appendChild(level);
        content.appendChild(settingsGroup);
        if (mode) settingsGroup.appendChild(mode);
        if (modeField) settingsGroup.appendChild(modeField);
        settingsGroup.appendChild(body);
        if (rules) { rules.open = document.body.dataset.rulesDefault !== 'collapsed'; content.appendChild(rules); }
        body.classList.remove('header-settings');
      } else {
        if (mode) config.appendChild(mode);
        if (modeField) config.insertBefore(modeField, config.firstChild);
        config.appendChild(body);
        body.classList.add('header-settings');
        if (rules) rules.open = true;
      }
      boardOptions.forEach(function (option) {
        if (mq.matches) option.removeAttribute('label');
        else option.label = option.textContent.split('·')[0].trim();
      });
      if (levelList) paginate();
      adaptSummary();
      expanded();
    }
    // 旧适配先恢复成绩/关卡的位置，再统一安放导航配置。
    mq.addEventListener('change', adaptChrome);
    adaptChrome();
    function measureHeader() {
      document.body.style.setProperty('--game-header-height', header.getBoundingClientRect().height + 'px');
    }
    new ResizeObserver(measureHeader).observe(header);
    measureHeader();
  }
  function initLinkmatchLayout() {
  var panel = document.querySelector('.game-panel');
  var controls = document.querySelector('.stage-controls');
  var header = document.querySelector('.game-header');
  var settings = document.getElementById('settings-open');
  header.appendChild(settings);
  document.querySelector('.panel-heading').hidden = true;
  document.getElementById('start').hidden = true;
  controls.insertBefore(document.getElementById('pause'), controls.firstChild);
  controls.appendChild(document.getElementById('restart'));
  document.getElementById('hint').textContent = '提示';
  document.getElementById('shuffle').textContent = '洗牌';
  document.getElementById('restart').textContent = '重开';
  var detail = document.getElementById('detail');
  panel.insertBefore(detail, document.getElementById('rule-label'));
  var title = document.createElement('h2');
  title.className = 'feedback-title';
  title.textContent = '当前提示';
  panel.insertBefore(title, document.getElementById('status'));
  document.querySelector('.instructions').open = true;
  var progress = document.createElement('progress');
  progress.id = 'pair-progress';
  progress.setAttribute('aria-label', '配对消除进度');
  panel.insertBefore(progress, detail);
  // 进度同步依据游戏实际输出，不另建一份计分状态。
  function sync() {
    var match = detail.textContent.match(/已消 (\d+)\/(\d+)/);
    if (match) {
      if (progress.max !== Number(match[2])) progress.max = Number(match[2]);
      if (progress.value !== Number(match[1])) progress.value = Number(match[1]);
    }
  }
  new MutationObserver(sync).observe(detail, { childList: true, characterData: true, subtree: true });
  sync();
  // 手机独立的信息层级：实际节点移动而非克隆，切回桌面按占位恢复。
  var layout = document.querySelector('.game-layout');
  var media = mobileMedia();
  var records = [];
  var compact = document.createElement('div');
  compact.className = 'link-mobile-summary';
  var pairCount = document.createElement('span');
  pairCount.className = 'mobile-pair-count';
  compact.appendChild(pairCount);
  // 手机使用独立的格式化时间展示，原成绩节点保留用于游戏更新和桌面恢复。
  var clock = document.createElement('div');
  clock.className = 'link-clock';
  clock.innerHTML = '<small>用时</small><span>00:00</span>';
  clock.setAttribute('aria-label', '用时');
  compact.appendChild(clock);
  function syncClock() {
    var seconds = Math.max(0, Number(document.getElementById('score').textContent) || 0);
    var formatted = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    clock.querySelector('span').textContent = formatted;
    clock.setAttribute('aria-label', '用时 ' + Math.floor(seconds / 60) + ' 分 ' + seconds % 60 + ' 秒');
  }
  new MutationObserver(syncClock).observe(document.getElementById('score'), { childList:true, characterData:true, subtree:true });
  syncClock();
  var more = document.createElement('button');
  more.textContent = '更多';
  more.className = 'link-more';
  controls.appendChild(more);
  var menu = document.createElement('dialog');
  menu.className = 'link-mobile-menu';
  menu.setAttribute('aria-label', '游戏信息与玩法');
  menu.innerHTML = '<form method="dialog"><div class="dialog-heading"><h2>游戏信息与玩法</h2><button aria-label="关闭游戏信息">关闭</button></div></form>';
  document.body.appendChild(menu);
  more.addEventListener('click', function () {
    var pause = document.getElementById('pause');
    if (!pause.disabled && pause.textContent === '暂停') pause.click();
    menu.showModal();
  });
  function relocate(node, parent) {
    var marker = document.createComment('桌面位置');
    node.parentNode.insertBefore(marker, node);
    records.push({ node:node, marker:marker });
    parent.appendChild(node);
  }
  function mobileCount() {
    var match = detail.textContent.match(/已消 (\d+)\/(\d+)/);
    var text = match ? '已消 ' + match[1] + '/' + match[2] + ' 对' : '';
    if (pairCount.textContent !== text) pairCount.textContent = text;
  }
  new MutationObserver(mobileCount).observe(detail, { childList:true });
  function adapt() {
    if (media.matches && !records.length) {
      layout.prepend(compact);
      relocate(document.querySelector('.scores'), compact);
      relocate(progress, compact);
      relocate(detail, compact);
      relocate(document.getElementById('rule-label'), compact);
      relocate(document.getElementById('status'), compact);
      [document.querySelector('.instructions')].forEach(function (node) { relocate(node, menu); });
      relocate(document.getElementById('storage'), compact);
      mobileCount();
    } else if (!media.matches && records.length) {
      if (menu.open) menu.close();
      records.forEach(function (record) { record.marker.parentNode.replaceChild(record.node, record.marker); });
      records = []; compact.remove();
    }
  }
  media.addEventListener('change', adapt);
  adapt();

  }
  // 专用适配器由同步脚本注入同一文件，连连看无需再维护第二个入口。
  if (document.body.dataset.game === 'linkmatch') { initLinkmatchLayout(); installResponsiveChrome(); return; }
  var layout = document.querySelector('.game-layout');
  var stage = document.querySelector('.game-stage');
  var board = document.querySelector('.board, .board-wrap');
  var toolbar = stage.querySelector('.toolbar');
  var stageControls = stage.querySelector('.stage-controls');
  var header = document.querySelector('.game-header');
  var panel = document.querySelector('.game-panel');
  // 道具状态会重写文本，必须与承载按钮的容器分离。
  if (stageControls && stageControls.tagName === 'P') {
    stageControls.classList.remove('stage-controls');
    panel.insertBefore(stageControls, document.getElementById('status'));
    stageControls = null;
  }
  var scores = document.querySelector('.scores');
  var pause = document.getElementById('pause');
  var restart = document.getElementById('restart');
  var settings = document.querySelector('.settings-button');
  var media = mobileMedia();
  var mobile = false;
  var homes = [];
  // 接龙与其他游戏使用同一页面骨架，横向比例只由牌桌内部样式决定。
  document.body.classList.add('unified-game');
  document.body.dataset.layout = document.querySelector('.touch-controls') ? 'touch' : 'board';
  // 所有游戏复用现有按钮，不复制状态或事件监听器。
  if (!stageControls) { stageControls = document.createElement('div'); stageControls.className = 'stage-controls'; stage.appendChild(stageControls); }
  stageControls.classList.add('unified-controls');
  stageControls.insertBefore(pause, stageControls.firstChild);
  stageControls.appendChild(restart);
  if (toolbar) {
    Array.from(toolbar.children).forEach(function (node) {
      if (node.tagName === 'BUTTON') stageControls.appendChild(node);
      else if (node.id) panel.insertBefore(node, document.getElementById('status'));
    });
    toolbar.hidden = true;
  }
  header.appendChild(settings);
  var heading = panel.querySelector('.panel-heading');
  if (heading) heading.hidden = true;
  var feedbackTitle = document.createElement('h2');
  feedbackTitle.className = 'feedback-title';
  feedbackTitle.textContent = '当前提示';
  panel.insertBefore(feedbackTitle, document.getElementById('status'));
  // 规则保持默认展开，移动端转入更多菜单后仍可直接阅读。
  var instructions = document.querySelector('.instructions');
  if (instructions) instructions.open = true;
  // 开始入口由棋盘遮罩统一提供，避免同屏出现两个主按钮。
  document.getElementById('start').classList.add('secondary-start');

  // 每个被移动的节点保留原位置，切回桌面时恢复，避免丢失事件绑定。
  function move(node, target) {
    if (!node) return;
    var marker = document.createComment('控件桌面位置');
    node.parentNode.insertBefore(marker, node);
    homes.push({ node: node, marker: marker });
    target.appendChild(node);
  }
  var tools = document.createElement('div');
  tools.className = 'mobile-tools';
  header.appendChild(tools);
  var menuButton = document.createElement('button');
  menuButton.className = 'icon-button';
  menuButton.type = 'button';
  menuButton.setAttribute('aria-label', '打开游戏菜单与玩法说明');
  menuButton.textContent = '☰';
  var menu = document.createElement('dialog');
  menu.className = 'mobile-menu';
  menu.setAttribute('aria-labelledby', 'mobile-menu-title');
  menu.innerHTML = '<form method="dialog"><div class="dialog-heading"><h2 id="mobile-menu-title">游戏菜单</h2><button class="icon-button" aria-label="关闭游戏菜单">×</button></div></form><div class="mobile-menu-content"></div>';
  document.body.appendChild(menu);
  var menuContent = menu.querySelector('.mobile-menu-content');
  var powerInfo = document.getElementById('power-status');
  var summary = document.createElement('div');
  summary.className = 'mobile-summary';
  layout.appendChild(summary);
  tools.appendChild(menuButton);
  var moreButton = document.createElement('button');
  moreButton.textContent = '更多';
  moreButton.className = 'unified-more';
  // 只统计直接操作按钮，数独数字键盘等嵌套专用控制区独立布局。
  function syncControlRows() {
    var count = Array.from(stageControls.children).filter(function (node) { return node.tagName === 'BUTTON' && !node.hidden; }).length;
    stageControls.classList.toggle('controls-multiline', count > 4);
  }
  new MutationObserver(syncControlRows).observe(stageControls, { childList:true, attributes:true, attributeFilter:['hidden'], subtree:true });
  syncControlRows();
  function openMenu() {
    if (!pause.disabled && pause.textContent.trim() === '暂停') pause.click();
    menu.showModal();
  }
  moreButton.addEventListener('click', openMenu);
  menuButton.addEventListener('click', function () {
    // 复用原暂停入口，保证计时器、配对等待和物理循环一起暂停。
    if (!pause.disabled && pause.textContent.trim() === '暂停') pause.click();
    menu.showModal();
  });
  restart.addEventListener('click', function () { if (menu.open) menu.close(); });

  function syncHeight() {
    // 多行操作和专用输入按实际高度为桌面棋盘留位。
    layout.style.setProperty('--extra-controls-height', Math.max(0, stageControls.getBoundingClientRect().height - 56) + 'px');
    // 操作栏以实际棋盘宽度为上限，避免专属样式的width:100%撑满整列。
    layout.style.setProperty('--actual-board-width', board.getBoundingClientRect().width + 'px');
    if (mobile) {
      layout.style.removeProperty('--panel-height');
      var captionHeight = toolbar && !toolbar.hidden ? toolbar.getBoundingClientRect().height + 8 : 0;
      if (stageControls && stageControls.parentNode === stage) captionHeight += stageControls.getBoundingClientRect().height + 8;
      // 舞台是固定视口的剩余空间，方向区独立占位，不依赖猜测屏幕尺寸。
      var declaredRatio = Number(board.getAttribute('data-board-ratio'));
      var ratio = declaredRatio > 0 && declaredRatio <= 2 ? declaredRatio : document.body.dataset.game === 'xiangqi' ? 520 / 600 : document.body.dataset.game === 'jungle' ? 7 / 9 : 1;
      // 横屏牌桌沿用CSS声明的比例以充分占高，不改变原竖屏尺寸策略。
      if (!declaredRatio && window.matchMedia('(max-height:480px) and (orientation:landscape) and (pointer:coarse)').matches) {
        var parts = getComputedStyle(board).aspectRatio.split('/').map(Number);
        if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) ratio = parts[0] / parts[1];
      }
      // 棋盘内的种子卡等输入区自然占高，剩余空间再按画布比例计算。
      var boardHeader = board.querySelector('[data-board-header]');
      var headerHeight = boardHeader ? boardHeader.getBoundingClientRect().height : 0;
      var size = Math.max(0, Math.min(stage.clientWidth, (stage.clientHeight - captionHeight - headerHeight) * ratio));
      layout.style.setProperty('--mobile-board-size', size + 'px');
    } else {
      layout.style.removeProperty('--mobile-board-size');
      layout.style.setProperty('--panel-height', board.getBoundingClientRect().height + 'px');
    }
  }
  function adapt() {
    if (media.matches && !mobile) {
      mobile = true;
      move(scores, summary);
      // 坦克的生命、波次和基地状态属于实时HUD，不能收进更多菜单。
      // 手机和PC展示同一批实时信息：移动原节点，切回桌面自动恢复。
      move(document.getElementById('rule-label'), summary);
      move(document.getElementById('detail'), summary);
      move(document.getElementById('status'), summary);
      if (powerInfo) move(powerInfo, summary);
      move(stageControls, layout);
      stageControls.appendChild(moreButton);
      tools.appendChild(menuButton);
      [panel.querySelector('.mode-switch'), document.getElementById('level-progress'), document.getElementById('storage')].forEach(function (node) { move(node, summary); });
      [document.getElementById('level-section'), document.querySelector('.instructions')].forEach(function (node) {
          move(node, menuContent);
        });
    } else if (!media.matches && mobile) {
      mobile = false;
      if (menu.open) menu.close();
      homes.forEach(function (home) {
        home.marker.parentNode.replaceChild(home.node, home.marker);
      });
      homes = [];
      moreButton.remove();
    }
    syncHeight();
  }
  var observer = new ResizeObserver(syncHeight);
  [layout, stage, board, toolbar, stageControls].forEach(function (node) { if (node) observer.observe(node); });
  media.addEventListener('change', adapt);
  window.addEventListener('resize', syncHeight);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', syncHeight);
  adapt();
  installResponsiveChrome(moreButton);
}());
