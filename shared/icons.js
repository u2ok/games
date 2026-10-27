/* 公共界面SVG图标；玩法图形由各游戏私有代码实现。 */
(function () {
  'use strict';
  var paths={info:'M12 11v6m0-10v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0','chevron-down':'m6 9 6 6 6-6',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',clock:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',puzzle:'M4 4h6c-2 5 6 5 4 0h6v6c-5-2-5 6 0 4v6h-6c2-5-6-5-4 0H4v-6c5 2 5-6 0-4Z',cup:'M6 3h12v6a6 6 0 0 1-12 0ZM6 5H3v3q0 5 5 5m10-8h3v3q0 5-5 5m-4 2v6m-5 0h10',arcade:'M5 5h14l2 14H3ZM9 15h1m5 0h1M8 8h8v4H8Z',external:'M8 5H4v15h15v-4M12 4h8v8m0-8L9 15',close:'m6 6 12 12M18 6 6 18',menu:'M4 6h16M4 12h16M4 18h16',left:'M20 12H4m6-6-6 6 6 6',right:'M4 12h16m-6-6 6 6-6 6',up:'M12 20V4m-6 6 6-6 6 6',down:'M12 4v16m-6-6 6 6 6-6',flag:'M5 21V3m0 1h14l-3 4 3 4H5',rotate:'M20 6v6h-6m6-1a8 8 0 1 0-1 6',heart:'M12 21 3 12C-3 3 7-1 12 6 17-1 27 3 21 12Z'};
  // 大厅分类使用独立语义图标，避免“全部”和“街机”共用图形、休闲误用奖杯。
  paths.collection='M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm11 0h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Zm11 0h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z';
  paths.coffee='M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Zm12 1h2a3 3 0 0 1 0 6h-2M3 22h16M7 3v2m4-3v3m4-2v2';
  paths.joystick='M12 10V6.5M14.5 4a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM5 12h14l2 8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Zm3 4h5m-3-2v4m7-2h.01';
  function svg(name,filled){return '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"'+(filled?' style="fill:currentColor"':'')+'><path d="'+(paths[name]||paths.star)+'"/></svg>';}
  window.GameIcons={svg:svg};
  var symbols={'⌕':'search','☆':'star','★':'star','◷':'clock','♧':'cup','✧':'puzzle','↗':'external','×':'close','☰':'menu','←':'left','→':'right','↑':'up','↓':'down','⚑':'flag','↻':'rotate','↶':'rotate','↷':'rotate','♥':'heart'};
  // 仅兼容旧界面按钮及通用生命标记；牌面花色由游戏自身绘制。
  function upgrade(root){
    if(!root||!root.parentNode)return;
    if(root.parentElement&&root.parentElement.closest('svg,script,style,textarea,canvas'))return;
    if(root.nodeType===1&&root.closest('svg,script,style,textarea,canvas'))return;
    if(root.nodeType===3){
      var value=root.nodeValue;if(!/[⌕☆★◷♧✧↗×☰←→↑↓⚑↻↶↷♥]/.test(value))return;
      // 仅独立关闭按钮中的乘号可转换；没有图标时不替换，避免观察器无限循环。
      var button=root.parentElement&&root.parentElement.closest('button');
      var closeIcon=button&&button.textContent.trim()==='×';
      function replaceable(ch){return symbols[ch]&&(ch!=='×'||closeIcon);}
      if(!Array.from(value).some(replaceable))return;
      var frag=document.createDocumentFragment();
      Array.from(value).forEach(function(ch){if(replaceable(ch)){var host=document.createElement('span');host.className='icon-inline';host.innerHTML=svg(symbols[ch],ch==='★'||ch==='♥');frag.appendChild(host);}else frag.appendChild(document.createTextNode(ch));});
      root.replaceWith(frag);return;
    }
    Array.from(root.childNodes).forEach(upgrade);
  }
  document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll("[data-icon]").forEach(function(node){node.innerHTML=svg(node.dataset.icon);});upgrade(document.body);new MutationObserver(function(records){records.forEach(function(record){if(record.type==='characterData')upgrade(record.target);else record.addedNodes.forEach(upgrade);});}).observe(document.body,{childList:true,characterData:true,subtree:true});});
}());

