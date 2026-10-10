/* ============================================
 * 组件渲染器：每个组件窗口加载一个 widgets/<folder>/widget.js
 * 通过 URL 参数 folder + key 指定，挂载后调用 init(root, data)
 * data 来自组件文件夹的 data.json
 * ============================================ */
(function () {
  const params = new URLSearchParams(location.search);
  const folder = params.get('folder');
  const key = params.get('key');
  if (!folder || !key) return;

  const script = document.createElement('script');
  script.src = '../widgets/' + encodeURIComponent(folder) + '/widget.js';

  script.onload = async () => {
    const def = window[key];
    if (!def) {
      console.error('组件未找到:', key);
      return;
    }

    // 注入组件私有 CSS
    if (def.css) {
      const style = document.createElement('style');
      style.textContent = def.css;
      document.head.appendChild(style);
    }

    // 创建组件容器（尺寸 = 窗口尺寸）
    const el = document.createElement('section');
    el.className = `widget ${def.id}-widget`;
    el.style.width = (def.width || 300) + 'px';
    el.style.height = (def.height || 200) + 'px';
    el.setAttribute('data-widget-id', def.id);
    el.innerHTML = def.html;

    // 注入图标：组件定义内嵌 icon 优先，否则从组件文件夹读 icon.svg
    const iconSlot = el.querySelector('[data-role="icon"]');
    if (iconSlot) {
      if (def.icon) {
        iconSlot.innerHTML = def.icon;
      } else {
        try {
          const resp = await fetch(`../widgets/${encodeURIComponent(folder)}/icon.svg`);
          if (resp.ok) iconSlot.innerHTML = await resp.text();
        } catch { /* 无图标文件，保持空白 */ }
      }
      // 点击左上角图标 = 隐藏本组件（Dock 图标同步变灰，可再点 Dock 恢复）
      iconSlot.title = '点击隐藏组件';
      iconSlot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.desktopAPI) window.desktopAPI.toggleWidget(def.id);
      });
    }

    document.body.appendChild(el);

    // 应用全局透明度（背景 CSS 变量）
    if (window.desktopAPI) {
      try {
        const alpha = await window.desktopAPI.getAlpha();
        el.style.setProperty('--widget-alpha', alpha);
        window.desktopAPI.onAlphaChanged(v =>
          el.style.setProperty('--widget-alpha', v)
        );
      } catch { /* 忽略 */ }
    }

    // 读取组件数据（widgets/<folder>/data.json）
    let data = null;
    try {
      data = await window.desktopAPI.readData(folder);
    } catch {
      data = null;
    }
    window.WidgetData = data; // 全局兜底，组件可直接读 window.WidgetData

    // 初始化组件逻辑（支持 async init）
    const ret = typeof def.init === 'function' ? def.init(el, data) : null;
    if (ret && typeof ret.then === 'function') await ret;

    // 报告实际尺寸：让 OS 窗口跟随组件内容（如 todo 自动增高）
    function reportSize() {
      if (!window.desktopAPI) return;
      window.desktopAPI.resize(el.offsetWidth, el.offsetHeight);
    }
    setTimeout(reportSize, 300);
    try {
      new ResizeObserver(reportSize).observe(el);
    } catch { /* 老内核忽略 */ }
  };

  script.onerror = () => console.error('加载组件脚本失败:', folder);
  document.body.appendChild(script);
})();
