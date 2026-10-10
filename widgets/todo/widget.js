/**
 * 待办事项组件
 * 淡粉色可爱风，输入回车添加
 *
 * 数据来源：本文件夹下的 data.json（{ "todos": [...] }）
 * 每次增删改都会写回 data.json —— 数据独立存放，不依赖浏览器 localStorage
 */
window.TodoWidget = {
  id: 'todo',
  name: '待办事项',
  width: 300,
  height: 630, // 固定高度：与右侧两行组件对齐（300+30+300）

  css: `
    .todo-widget {
      display: flex;
      flex-direction: column;
      background: rgba(255, 245, 248, var(--widget-alpha, 0.5));
      border: 1px solid rgba(255, 224, 234, 0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .todo-widget .widget-header {
      height: 36px;
      margin-bottom: 8px;
    }
    .todo-widget .heading .sparkle {
      width: 28px;
      height: 28px;
      border-radius: 9px;
      background: rgba(255, 214, 229, 0.6);
      color: #e07090;
    }
    .todo-widget .week-switcher {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 3px;
      border: 1px solid rgba(255, 214, 229, 0.6);
      border-radius: 999px;
      background: rgba(255, 240, 245, 0.6);
    }
    .todo-widget .week-switcher button {
      display: grid;
      width: 26px;
      height: 24px;
      padding: 0;
      place-items: center;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: #d48098;
      cursor: pointer;
    }
    .todo-widget .week-switcher button:hover {
      background: rgba(255, 214, 229, 0.8);
      color: #e07090;
    }
    .todo-widget .input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border: 1px solid #ffd6e5;
      border-radius: 14px;
      background: #fff0f5;
      transition: border-color .2s;
    }
    .todo-widget .input-row:focus-within {
      border-color: #ffb6c1;
    }
    .todo-widget .todo-input {
      flex: 1;
      border: 0;
      outline: 0;
      background: transparent;
      font-size: 13px;
      color: #8b5a6b;
    }
    .todo-widget .todo-input::placeholder {
      color: #d4a5b5;
    }
    .todo-widget .list {
      display: flex;
      flex: 1; /* 撑满剩余高度，固定 630 时列表区域自适应 */
      flex-direction: column;
      gap: 8px;
      margin-top: 10px;
      overflow-y: auto;
      padding: 0 2px 10px 0; /* 底部留 10px 空隙，避免最后一项贴住外层卡片 */
    }
    .todo-widget .list.is-empty {
      justify-content: center; /* 空状态垂直居中 */
    }
    .todo-widget .list::-webkit-scrollbar {
      width: 2px;
    }
    .todo-widget .list::-webkit-scrollbar-thumb {
      background: rgba(255, 182, 193, 0.4);
      border-radius: 2px;
    }
    .todo-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #ffffff;
      transition: opacity .2s;
      animation: todoIn .25s ease;
    }
    @keyframes todoIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .todo-check {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      margin-top: 1px;
      border: 1.5px solid #ffb6c1;
      border-radius: 50%;
      background: #fff;
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: all .2s;
    }
    .todo-check svg {
      width: 10px;
      height: 10px;
      color: #fff;
      opacity: 0;
      transition: opacity .15s;
    }
    .todo-item.done .todo-check {
      background: #ffb6c1;
      border-color: #ffb6c1;
    }
    .todo-item.done .todo-check svg {
      opacity: 1;
    }
    .todo-body {
      flex: 1;
      min-width: 0;
    }
    .todo-text {
      font-size: 13px;
      color: #6b4455;
      line-height: 1.4;
      word-break: break-all;
      transition: all .2s;
    }
    .todo-item.done .todo-text {
      color: #c9a0b0;
      text-decoration: line-through;
    }
    .todo-time {
      margin-top: 3px;
      font-size: 10px;
      color: #d4a5b5;
    }
    .todo-del {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #e8b4c4;
      font-size: 14px;
      cursor: pointer;
      opacity: 0;
      transition: opacity .15s, background .15s;
      display: grid;
      place-items: center;
    }
    .todo-item:hover .todo-del {
      opacity: 1;
    }
    .todo-del:hover {
      background: #ffe0ea;
      color: #e07090;
    }
    .todo-empty {
      padding: 24px 0;
      text-align: center;
      font-size: 12px;
      color: #d4a5b5;
    }
  `,

  html: `
    <div class="widget-header">
      <div class="heading">
        <span class="sparkle" data-role="icon"></span>
      </div>
      <div class="week-switcher">
        <button data-action="export" type="button" title="导出 JSON 文件">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <button data-action="import" type="button" title="导入 JSON 文件">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </button>
      </div>
    </div>
    <input type="file" data-role="fileInput" accept=".json" hidden />
    <div class="input-row">
      <input class="todo-input" data-role="input" type="text" placeholder="写点什么，回车添加…" />
    </div>
    <div class="list" data-role="list"></div>
  `,

  async init(root) {
    const input = root.querySelector('[data-role="input"]');
    const listEl = root.querySelector('[data-role="list"]');

    // 数据存/取：本组件文件夹的 data.json
    let todos = [];
    try {
      const data = await window.desktopAPI.readData('todo');
      todos = (data && data.todos) || [];
    } catch { todos = []; }

    function save() {
      window.desktopAPI.writeData('todo', { todos });
    }

    function fmtTime(ts) {
      const d = new Date(ts);
      const m = d.getMonth() + 1;
      const day = d.getDate();
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${m}/${day} ${h}:${min}`;
    }

    function render() {
      listEl.classList.toggle('is-empty', !todos.length);
      if (!todos.length) {
        listEl.innerHTML = '<div class="todo-empty">暂无待办，上面输入框加一条吧～</div>';
      } else {
        listEl.innerHTML = todos.map((t, i) => `
          <div class="todo-item ${t.done ? 'done' : ''}" data-idx="${i}">
            <div class="todo-check" data-act="toggle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div class="todo-body">
              <div class="todo-text">${t.text.replace(/</g, '&lt;')}</div>
              <div class="todo-time">${fmtTime(t.ts)}</div>
            </div>
            <button class="todo-del" data-act="del" title="删除">×</button>
          </div>
        `).join('');
      }
    }

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && input.value.trim()) {
        todos.unshift({
          text: input.value.trim(),
          done: false,
          ts: Date.now()
        });
        input.value = '';
        save();
        render();
      }
    });

    listEl.addEventListener('click', e => {
      const item = e.target.closest('.todo-item');
      if (!item) return;
      const idx = +item.dataset.idx;
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'toggle') {
        todos[idx].done = !todos[idx].done;
        save();
        render();
      } else if (act === 'del') {
        todos.splice(idx, 1);
        save();
        render();
      }
    });

    // 导出 JSON
    root.querySelector('[data-action="export"]').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(todos, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'todos.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    // 导入 JSON
    const fileInput = root.querySelector('[data-role="fileInput"]');
    root.querySelector('[data-action="import"]').addEventListener('click', () => {
      fileInput.click();
    });
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (Array.isArray(data)) {
            todos = data;
            save();
            render();
          }
        } catch { alert('文件格式不对，请选择 todos.json'); }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });

    render();
  }
};
