/**
 * ============================================================
 * 新组件模板 —— 复制整个 _template 文件夹并改名为你的组件（如 clock）
 * ============================================================
 *
 * 组件文件夹结构（一个组件 = 一个文件夹）：
 *   widgets/clock/
 *   ├── widget.js   组件定义（必填）：id / name / width / height / css / html / init
 *   ├── data.json   组件数据（可选）：存放组件需要的数据，运行时可用 API 读写
 *   └── icon.svg    组件图标（可选）：有则自动加载，没有则 Dock 显示空白
 *
 * 数据读写（运行在组件页面里）：
 *   const data = await window.desktopAPI.readData('clock')  // 读 data.json -> 对象或 null
 *   window.desktopAPI.writeData('clock', { ... })           // 写回 data.json
 *   init(root, data) 的第二个参数 data 就是 readData 的结果（已自动传入）
 *
 * 开发步骤：
 *   1. 复制 _template 文件夹 -> widgets/clock/
 *   2. 改 widget.js 里的 id / name / width / height / html / css / init
 *   3. 需要的数据填进 data.json，图标换成 icon.svg
 *   4. 控制台点「重新加载组件」（或重启 App）即可，无需改主进程代码
 *
 * 注意：
 *   - .widget-header 是拖拽把手，必须保留在最外层
 *   - 按钮用 data-action="xxx" 标记，避免触发拖拽
 *   - 文件夹名以 _ 开头会被当作模板跳过（不加载）
 * ============================================================
 */
window.ClockWidget = {
  // 唯一标识（英文，用于状态存储与数据文件）
  id: 'clock',

  // 组件名称（Dock 悬浮提示 / 控制台显示）
  name: '我的新组件',

  // 组件尺寸（px）
  width: 300,
  height: 200,

  // 组件样式 —— 所有类名建议加前缀避免冲突
  css: `
    .clock-widget .content {
      padding: 10px;
      font-size: 14px;
      color: #475569;
    }
  `,

  // 组件 HTML 结构（.widget-header 拖拽把手必须在最外层）
  html: `
    <div class="widget-header">
      <div class="heading">
        <span class="sparkle" data-role="icon"></span>
      </div>
    </div>
    <div class="content" data-role="content">
      这是一个新组件
    </div>
  `,

  // 初始化函数 —— 组件的所有逻辑都写在这里
  // root: 组件根 DOM 元素；data: data.json 的内容（没有则为 null）
  async init(root, data) {
    // 示例：显示 data.json 里的数据
    // root.querySelector('[data-role="content"]').textContent =
    //   JSON.stringify(data || {});

    // 示例：定时刷新
    // setInterval(() => { ... }, 1000);
  }
};
