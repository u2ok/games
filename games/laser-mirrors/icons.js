/* 公共SVG图标；仅导出无状态渲染接口，游戏目录保留本地副本。 */
(function () {
  'use strict';
  var paths={stone:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0','chevron-down':'m6 9 6 6 6-6',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',clock:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',puzzle:'M4 4h6c-2 5 6 5 4 0h6v6c-5-2-5 6 0 4v6h-6c2-5-6-5-4 0H4v-6c5 2 5-6 0-4Z',cup:'M6 3h12v6a6 6 0 0 1-12 0ZM6 5H3v3q0 5 5 5m10-8h3v3q0 5-5 5m-4 2v6m-5 0h10',arcade:'M5 5h14l2 14H3ZM9 15h1m5 0h1M8 8h8v4H8Z',external:'M8 5H4v15h15v-4M12 4h8v8m0-8L9 15',close:'m6 6 12 12M18 6 6 18',menu:'M4 6h16M4 12h16M4 18h16',left:'M20 12H4m6-6-6 6 6 6',right:'M4 12h16m-6-6 6 6-6 6',up:'M12 20V4m-6 6 6-6 6 6',down:'M12 4v16m-6-6 6 6 6-6',flag:'M5 21V3m0 1h14l-3 4 3 4H5',rotate:'M20 6v6h-6m6-1a8 8 0 1 0-1 6',heart:'M12 21 3 12C-3 3 7-1 12 6 17-1 27 3 21 12Z',diamond:'m12 2 10 10-10 10L2 12Z',club:'M12 12C0-1 0 18 9 14c-9 10 12 10 3 0 10 5 14-12 0-2Zm0 3-3 7h6Z',spade:'M12 2C-5 14 1 22 10 16l-2 6h8l-2-6C23 22 29 14 12 2Z'};
  function svg(name,filled){return '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"'+(filled?' style="fill:currentColor"':'')+'><path d="'+(paths[name]||paths.star)+'"/></svg>';}
  window.GameIcons={svg:svg};
  var symbols={'⌕':'search','☆':'star','★':'star','◷':'clock','♧':'cup','✧':'puzzle','↗':'external','×':'close','☰':'menu','←':'left','→':'right','↑':'up','↓':'down','⚑':'flag','↻':'rotate','↶':'rotate','↷':'rotate','♥':'heart','♦':'diamond','♣':'club','♠':'spade'};
  // 兼容旧按钮及动态牌面。文字仍为文字；只替换明确的图标字符，不碰SVG/Canvas。
  function upgrade(root){
    if(!root||!root.parentNode)return;
    if(root.parentElement&&root.parentElement.closest('svg,script,style,textarea,canvas'))return;
    if(root.nodeType===1&&root.closest('svg,script,style,textarea,canvas'))return;
    if(root.nodeType===3){
      var value=root.nodeValue;if(!/[⌕☆★◷♧✧↗×☰←→↑↓⚑↻↶↷♥♦♣♠]/.test(value))return;
      // 仅独立关闭按钮中的乘号可转换；没有图标时不替换，避免观察器无限循环。
      var button=root.parentElement&&root.parentElement.closest('button');
      var closeIcon=button&&button.textContent.trim()==='×';
      function replaceable(ch){return symbols[ch]&&(ch!=='×'||closeIcon);}
      if(!Array.from(value).some(replaceable))return;
      var frag=document.createDocumentFragment();
      Array.from(value).forEach(function(ch){if(replaceable(ch)){var host=document.createElement('span');host.className='icon-inline';host.innerHTML=svg(symbols[ch],ch==='★'||/[♥♦♣♠]/.test(ch));frag.appendChild(host);}else frag.appendChild(document.createTextNode(ch));});
      root.replaceWith(frag);return;
    }
    Array.from(root.childNodes).forEach(upgrade);
  }
  document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll("[data-icon]").forEach(function(node){node.innerHTML=svg(node.dataset.icon);});upgrade(document.body);new MutationObserver(function(records){records.forEach(function(record){if(record.type==='characterData')upgrade(record.target);else record.addedNodes.forEach(upgrade);});}).observe(document.body,{childList:true,characterData:true,subtree:true});});
}());
