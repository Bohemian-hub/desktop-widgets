/**
 * 爱情纪念组件
 * 记录两个人的心动时刻与相守时长，每秒实时跳动
 *
 * 数据来源：本文件夹下的 data.json
 * {
 *   "couple": { "him": "小鹿", "her": "小星", "tagline": "遇见你，是我生命中最美的意外" },
 *   "milestones": [
 *     { "title": "第一次见面", "subtitle": "心动时刻", "date": "2026-03-14 15:30:00" },
 *     ... 任意多个节点
 *   ]
 * }
 * 日期格式：YYYY-MM-DD HH:mm:ss（显示的是“从该时刻起已经”的累计时间）
 */
window.LoveWidget = {
  id: 'hd-love',
  name: '爱情',
  width: 600,
  height: 300,

  css: `
    /* 整卡粉调渐变（透明度跟随全局设置 --widget-alpha，透出桌面壁纸） */
    .hd-love-widget {
      background: linear-gradient(160deg, rgba(255, 244, 248, var(--widget-alpha, 0.5)) 0%, rgba(255, 231, 239, var(--widget-alpha, 0.5)) 100%);
      border: 1px solid rgba(255, 182, 193, 0.5);
      box-shadow: 0 10px 36px rgba(224, 87, 138, .08);
    }
    .hd-love-widget .widget-header {
      height: 34px;
      margin-bottom: 6px;
    }
    /* 左上：图标 + 名字 */
    .love-left {
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .love-icon {
      display: grid;
      width: 27px;
      height: 27px;
      place-items: center;
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.8);
      color: #e0578a;
      box-shadow: 0 2px 10px rgba(224, 87, 138, .18);
    }
    .love-icon svg {
      display: block;
      animation: heartBeat 1.4s ease-in-out infinite;
    }
    @keyframes heartBeat {
      0%, 100% { transform: scale(1); }
      10% { transform: scale(1.18); }
      20% { transform: scale(1); }
      30% { transform: scale(1.12); }
      40% { transform: scale(1); }
    }
    .couple-name {
      font-size: 15px;
      font-weight: 800;
      color: #d94a7f;
      letter-spacing: .5px;
      white-space: nowrap;
    }
    .couple-name .sep {
      display: inline-block;
      margin: 0 6px;
      color: #f291b3;
      font-size: 12px;
      animation: heartBeat 1.4s ease-in-out infinite;
    }
    /* 右上：OUR LOVE STORY */
    .love-subtitle {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 3.5px;
      color: #d98aa8;
      white-space: nowrap;
    }
    .love-subtitle::before {
      content: '♥ ';
      color: #f291b3;
      letter-spacing: 0;
    }

    /* 主体 2×2 网格 */
    .milestones {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .ms-card {
      display: flex;
      flex-direction: column;
      padding: 8px 14px 8px;
      border: 1px solid rgba(255, 200, 216, .55);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.75);
      box-shadow: 0 4px 18px rgba(224, 87, 138, .07);
    }
    .ms-title {
      font-size: 13.5px;
      font-weight: 800;
      color: #d94a7f;
      letter-spacing: .5px;
    }
    .ms-sub {
      margin-top: 1px;
      font-size: 10px;
      color: #d98aa8;
    }
    .ms-date {
      margin-top: 2px;
      font-size: 9px;
      color: #c99fb1;
      font-variant-numeric: tabular-nums;
      letter-spacing: .3px;
    }
    .ms-count {
      display: flex;
      gap: 5px;
      margin-top: 6px;
    }
    .ms-num {
      flex: 1;
      padding: 3px 0 2px;
      border-radius: 9px;
      background: rgba(255, 226, 235, 0.65);
      text-align: center;
    }
    .ms-num b {
      display: block;
      font-size: 15px;
      font-weight: 800;
      color: #c9457c;
      font-variant-numeric: tabular-nums;
      line-height: 1.15;
    }
    .ms-num span {
      display: block;
      margin-top: 1px;
      font-size: 8px;
      color: #d98aa8;
      letter-spacing: 1px;
    }

    /* 底部文案 */
    .tagline {
      margin-top: 6px;
      text-align: center;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #c9487d;
      text-shadow: 0 1px 0 rgba(255, 255, 255, .6);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tagline::before, .tagline::after {
      content: '♥';
      margin: 0 7px;
      font-size: 9px;
      color: #f291b3;
    }
  `,

  html: `
    <div class="widget-header">
      <div class="love-left">
        <span class="love-icon" data-role="icon"></span>
        <span class="couple-name" data-role="couple"></span>
      </div>
      <div class="love-subtitle">OUR LOVE STORY</div>
    </div>
    <div class="milestones" data-role="milestones"></div>
    <div class="tagline" data-role="tagline"></div>
  `,

  async init(root, data) {
    const cfg = data || {};
    const couple = cfg.couple || {};
    const milestones = (cfg.milestones || []).map(m => ({
      title: m.title || '纪念日',
      subtitle: m.subtitle || '',
      dateText: m.date || '',
      time: new Date(String(m.date || '').replace(/-/g, '/')).getTime()
    })).filter(m => !isNaN(m.time));

    // 名字与文案
    const coupleEl = root.querySelector('[data-role="couple"]');
    coupleEl.innerHTML = `${couple.him || ''}<i class="sep">♥</i>${couple.her || ''}`;
    root.querySelector('[data-role="tagline"]').textContent = couple.tagline || '';

    // 渲染卡片
    const grid = root.querySelector('[data-role="milestones"]');
    if (!milestones.length) {
      grid.innerHTML = '<div class="ms-card" style="grid-column:1/-1;justify-content:center;align-items:center;color:#d98aa8;font-size:12px">在 data.json 里添加你们的纪念日吧 💗</div>';
      return;
    }
    grid.innerHTML = milestones.map(m => `
      <div class="ms-card">
        <div class="ms-title">${m.title}</div>
        <div class="ms-sub">${m.subtitle}</div>
        <div class="ms-date">${m.dateText}</div>
        <div class="ms-count">
          <div class="ms-num"><b data-k="d">0</b><span>天</span></div>
          <div class="ms-num"><b data-k="h">00</b><span>时</span></div>
          <div class="ms-num"><b data-k="m">00</b><span>分</span></div>
          <div class="ms-num"><b data-k="s">00</b><span>秒</span></div>
        </div>
      </div>
    `).join('');

    // 每秒刷新累计时间（从纪念日时刻起）
    function tick() {
      const now = Date.now();
      milestones.forEach((m, i) => {
        const diff = Math.max(0, now - m.time);
        const d = Math.floor(diff / 86400000);
        const h = Math.floor(diff % 86400000 / 3600000);
        const min = Math.floor(diff % 3600000 / 60000);
        const s = Math.floor(diff % 60000 / 1000);
        const card = grid.children[i];
        card.querySelector('[data-k="d"]').textContent = d;
        card.querySelector('[data-k="h"]').textContent = String(h).padStart(2, '0');
        card.querySelector('[data-k="m"]').textContent = String(min).padStart(2, '0');
        card.querySelector('[data-k="s"]').textContent = String(s).padStart(2, '0');
      });
    }
    tick();
    setInterval(tick, 1000);
  }
};
