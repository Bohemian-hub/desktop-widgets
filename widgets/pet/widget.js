/**
 * ============================================================
 * 桌面宠物组件（macOS 桌面宠物）
 * ============================================================
 * - 300×300 透明窗口，Q 版卡通宠物（角色照片头部 + 卡通身体）
 * - 五种姿态：爬行（常态循环动画）/ 压扁 / 跳跃 / 吃饭 / 睡觉
 * - 点击宠物：轮流触发 吃饭→睡觉→跳跃→压扁（回弹）互动，并随机对白
 * - 空闲时：随机说出「我爱你」等有趣中文对白（不透明气泡，不遮挡角色）
 * - 右键菜单：吃饭 / 睡觉 / 跳跃 / 压扁 / 说我爱你
 * - 姿态素材在 assets/*.png（透明 PNG），对白文案在 data.json
 * ============================================================
 */
window.PetWidget = {
  id: 'pet',
  name: '桌面宠物',
  width: 300,
  height: 300,

  css: `
    /* 主题色：浅绿色系（覆盖通用蓝色标题栏图标） */
    .pet-widget .sparkle {
      background: #e6f4ec;
      color: #4c9a72;
    }
    .pet-widget .pet-stage {
      position: relative;
      height: calc(100% - 57px);   /* 300 - padding - header(45+12) */
      display: flex;
      align-items: flex-end;
      justify-content: center;
      user-select: none;
      cursor: pointer;
    }
    .pet-widget .pet-body {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      height: 100%;
      width: 100%;
    }
    .pet-widget .pet-img {
      max-width: 92%;
      max-height: 100%;
      object-fit: contain;
      pointer-events: none;
      transform-origin: 50% 100%;
      filter: drop-shadow(0 6px 10px rgba(0,0,0,.14));
    }
    /* 爬行常态：轻微摇摆 + 起伏 */
    @keyframes pet-walk {
      0%, 100% { transform: translateY(0) translateX(-5px) rotate(-1deg); }
      50%      { transform: translateY(-8px) translateX(5px) rotate(1.5deg); }
    }
    .pet-widget .anim-crawl { animation: pet-walk 2.6s ease-in-out infinite; }
    /* 跳跃：腾空弹跳 */
    @keyframes pet-jump {
      0%   { transform: translateY(0) scale(1,1); }
      30%  { transform: translateY(-52px) scale(.94,1.06); }
      55%  { transform: translateY(-36px) scale(1,1); }
      75%  { transform: translateY(0) scale(1.06,.92); }
      100% { transform: translateY(0) scale(1,1); }
    }
    .pet-widget .anim-jump { animation: pet-jump .95s ease-out; }
    /* 压扁回弹 */
    @keyframes pet-squash {
      0%   { transform: scale(1,1); }
      35%  { transform: scale(1.14,.78); }
      55%  { transform: scale(.8,1.16); }
      75%  { transform: scale(1.06,.9); }
      100% { transform: scale(1,1); }
    }
    .pet-widget .anim-squash { animation: pet-squash 1.15s ease-in-out; }
    /* 对话气泡：背景不透明、位于角色上方、不遮挡角色 */
    .pet-widget .pet-bubble {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%) translateY(-8px);
      max-width: 236px;
      padding: 8px 14px;
      background: #ffffff;          /* 不透明 */
      border: 1px solid #d5ecdf;
      border-radius: 13px;
      box-shadow: 0 4px 16px rgba(0,0,0,.12);
      color: #334155;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: .2px;
      white-space: nowrap;
      opacity: 0;
      transition: opacity .28s ease, transform .28s ease;
      z-index: 5;
      pointer-events: none;
    }
    .pet-widget .pet-bubble.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    .pet-widget .pet-bubble::after {
      content: '';
      position: absolute;
      bottom: -7px;
      left: 50%;
      margin-left: -6px;
      width: 0;
      height: 0;
      border-left: 7px solid transparent;
      border-right: 7px solid transparent;
      border-top: 7px solid #ffffff;
    }
    /* 右键菜单 */
    .pet-widget .pet-menu {
      position: absolute;
      min-width: 118px;
      padding: 6px;
      background: #ffffff;
      border-radius: 13px;
      box-shadow: 0 10px 30px rgba(0,0,0,.18);
      border: 1px solid #f0f2f5;
      opacity: 0;
      transform: scale(.92);
      transform-origin: top left;
      transition: opacity .15s ease, transform .15s ease;
      pointer-events: none;
      z-index: 10;
    }
    .pet-widget .pet-menu.show {
      opacity: 1;
      transform: scale(1);
      pointer-events: auto;
    }
    .pet-widget .pet-menu-item {
      padding: 7px 12px;
      border-radius: 9px;
      font-size: 13px;
      color: #334155;
      cursor: pointer;
      transition: background .12s ease, color .12s ease;
    }
    .pet-widget .pet-menu-item:hover {
      background: #e6f4ec;
      color: #4c9a72;
    }
    .pet-widget .pet-name {
      font-size: 14px;
      font-weight: 700;
      color: #3f8f66;
      letter-spacing: .5px;
    }
  `,

  html: `
    <div class="widget-header">
      <div class="heading">
        <span class="sparkle" data-role="icon"></span>
        <span class="pet-name">桌面宠物</span>
      </div>
    </div>
    <div class="pet-stage" data-role="stage">
      <div class="pet-bubble" data-role="bubble"></div>
      <div class="pet-body" data-role="body">
        <img class="pet-img" data-role="img" src="../widgets/pet/assets/crawl.png" alt="宠物">
      </div>
    </div>
    <div class="pet-menu" data-role="menu">
      <div class="pet-menu-item" data-action="eat">吃饭</div>
      <div class="pet-menu-item" data-action="sleep">睡觉</div>
      <div class="pet-menu-item" data-action="jump">跳跃</div>
      <div class="pet-menu-item" data-action="squash">压扁</div>
      <div class="pet-menu-item" data-action="love">说我爱你</div>
    </div>
  `,

  async init(root, data) {
    const stage = root.querySelector('[data-role="stage"]');
    const body = root.querySelector('[data-role="body"]');
    const img = root.querySelector('[data-role="img"]');
    const bubble = root.querySelector('[data-role="bubble"]');
    const menu = root.querySelector('[data-role="menu"]');

    const d = data || {};
    const lines = {
      idle:   d.idle   || ['我爱你呀~ ♥', '今天也要加油哦！', '想你啦，摸摸头～', '忙完记得休息哦'],
      eat:    d.eat    || ['好香啊～！', '干饭人干饭魂！', '这一碗我承包了！'],
      sleep:  d.sleep  || ['晚安啦～', '呼…呼…', 'zzZ 别吵醒我'],
      jump:   d.jump   || ['耶！起飞！', '蹦蹦跳跳真开心！', '看我跳得多高！'],
      squash: d.squash || ['呜啊——被压扁了！', '快…快回弹！', '扁扁的我也可爱吧？'],
      love:   d.love   || ['我爱你 ♥', '遇见你真好', '你是我生命里最美的意外 ♥']
    };
    const states = {
      crawl: '../widgets/pet/assets/crawl.png',
      squashed: '../widgets/pet/assets/squashed.png',
      jump: '../widgets/pet/assets/jump.png',
      eat: '../widgets/pet/assets/eat.png',
      sleep: '../widgets/pet/assets/sleep.png'
    };
    const seq = ['eat', 'sleep', 'jump', 'squash'];
    let seqIdx = -1;
    let stateTimer = null;
    let bubbleTimer = null;
    let idleTimer = null;

    const random = (arr) => arr[Math.floor(Math.random() * arr.length)];

    function showBubble(text, ms = 3500) {
      bubble.textContent = text;
      bubble.classList.add('show');
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
    }

    function setState(name, anim) {
      clearTimeout(stateTimer);
      img.classList.remove('anim-crawl', 'anim-jump', 'anim-squash');
      img.src = states[name] || states.crawl;
      if (anim) img.classList.add(anim);
    }

    function goIdle() {
      setState('crawl', 'anim-crawl');
    }

    function act(name) {
      switch (name) {
        case 'eat':
          setState('eat');
          showBubble(random(lines.eat));
          stateTimer = setTimeout(goIdle, 2700);
          break;
        case 'sleep':
          setState('sleep');
          showBubble(random(lines.sleep));
          stateTimer = setTimeout(goIdle, 3300);
          break;
        case 'jump':
          setState('jump', 'anim-jump');
          showBubble(random(lines.jump));
          stateTimer = setTimeout(goIdle, 1600);
          break;
        case 'squash':
          setState('squashed', 'anim-squash');
          showBubble(random(lines.squash));
          stateTimer = setTimeout(goIdle, 1500);
          break;
        case 'love':
          showBubble(random(lines.love), 4200);
          break;
      }
    }

    // 点击角色：轮流触发互动（吃饭→睡觉→跳跃→压扁）
    body.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.remove('show');
      seqIdx = (seqIdx + 1) % seq.length;
      act(seq[seqIdx]);
    });

    // 空闲时随机说一句（12~32 秒随机）
    function scheduleIdle() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        showBubble(random(lines.idle));
        scheduleIdle();
      }, 12000 + Math.random() * 20000);
    }
    scheduleIdle();

    // 右键菜单
    stage.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      let x = e.clientX - r.left;
      let y = e.clientY - r.top;
      menu.style.left = Math.min(x, r.width - 126) + 'px';
      menu.style.top = Math.min(y, r.height - 196) + 'px';
      menu.classList.add('show');
    });
    menu.querySelectorAll('.pet-menu-item').forEach((item) => {
      item.addEventListener('click', () => {
        menu.classList.remove('show');
        act(item.getAttribute('data-action'));
      });
    });
    stage.addEventListener('click', () => menu.classList.remove('show'));

    // 初始：爬行常态
    goIdle();
  }
};
