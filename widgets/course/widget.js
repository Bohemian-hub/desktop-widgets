/**
 * 课程表组件
 * 5列滚动视图：基准日在第2列，前1后3，自动跳过休息日
 *
 * 数据来源：本文件夹下的 data.json（{ "courses": [...] }）
 * 图标来源：本文件夹下的 icon.svg
 */
window.CourseWidget = {
  id: 'course',
  name: '课程表',
  width: 600,
  height: 300,

  css: `
    /* 外层卡片背景透明度跟随全局设置（--widget-alpha） */
    .course-widget {
      background: rgba(255, 255, 255, var(--widget-alpha, 0.5));
    }
    .course-widget .viewport {
      overflow: hidden;
      height: 207px;
      position: relative;
    }
    .course-widget .days {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      height: 100%;
      transition: transform .28s cubic-bezier(.22,1,.36,1), opacity .22s ease;
    }
    .course-widget .days.is-anim-next {
      transform: translateX(-24px);
      opacity: 0;
    }
    .course-widget .days.is-anim-prev {
      transform: translateX(24px);
      opacity: 0;
    }
    .course-widget .day {
      min-width: 0;
      height: 100%;
      overflow: hidden;
      border: 1px solid rgba(226, 232, 240, 0.6);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.6);
      transition: border-color .2s, box-shadow .2s;
      display: flex;
      flex-direction: column;
    }
    .course-widget .day.is-today {
      border-color: var(--blue);
      box-shadow: 0 0 0 2px rgba(79,141,247,.15);
    }
    .course-widget .day-header {
      padding: 9px 8px 7px;
      border-bottom: 1px solid rgba(226, 232, 240, 0.5);
      background: rgba(234, 242, 255, 0.8);
      text-align: center;
      flex-shrink: 0;
    }
    .course-widget .day.is-today .day-header {
      background: rgba(219, 231, 255, 0.9);
    }
    .course-widget .day-name {
      display: block;
      color: #477bd1;
      font-size: 12px;
      font-weight: 750;
    }
    .course-widget .day-date {
      display: block;
      margin-top: 2px;
      color: #86a7dc;
      font-size: 10px;
    }
    .course-widget .courses {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 6px;
      padding: 7px;
      overflow-y: auto;
      min-height: 0;
    }
    .course-widget .courses::-webkit-scrollbar {
      width: 3px;
    }
    .course-widget .courses::-webkit-scrollbar-thumb {
      background: #d4e0f5;
      border-radius: 3px;
    }
    .course-widget .course {
      padding: 7px 7px 6px;
      border-radius: 9px;
      background: var(--green);
      line-height: 1.25;
    }
    .course-widget .course:nth-child(2n) { background: var(--pink); }
    .course-widget .course:nth-child(3n) { background: var(--yellow); }
    .course-widget .course-name {
      display: block;
      overflow: hidden;
      color: #475569;
      font-size: 11px;
      font-weight: 750;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .course-widget .course-meta {
      display: block;
      overflow: hidden;
      margin-top: 3px;
      color: #94a3b8;
      font-size: 9px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .course-widget .course-time {
      display: block;
      overflow: hidden;
      margin-top: 3px;
      color: #7f9ac2;
      font-size: 9px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .course-widget .empty {
      display: grid;
      height: 100%;
      place-items: center;
      color: #cbd5e1;
      font-size: 11px;
    }
    .course-widget .gap-hint {
      padding: 3px 8px 5px;
      font-size: 10px;
      color: #b8c8e0;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }
  `,

  html: `
    <div class="widget-header">
      <div class="heading">
        <span class="sparkle" data-role="icon"></span>
      </div>
      <div class="week-switcher">
        <button data-action="prevDay" type="button" title="前一天">‹</button>
        <button data-action="nextDay" type="button" title="后一天">›</button>
      </div>
    </div>
    <div class="viewport">
      <div class="days" data-role="days"></div>
    </div>
  `,

  // 数据从本组件文件夹的 data.json 读取（第二个参数 data）
  async init(root, data) {
    const courseData = (data && data.courses) || [];

    const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekTwoMonday = new Date(2026, 8, 7); // 第2周周一

    function parseWeekRange(weekText, selectedWeek) {
      return weekText.split(/[，,]/).some(part => {
        const [start, end = start] = part.trim().split('-').map(Number);
        return selectedWeek >= start && selectedWeek <= end;
      });
    }

    // 日期工具
    function dayStart(d) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    function addDays(d, n) {
      const r = new Date(d);
      r.setDate(r.getDate() + n);
      return r;
    }
    function getWeekNum(date) {
      const start = dayStart(weekTwoMonday);
      const diff = Math.floor((dayStart(date) - start) / (7 * 86400 * 1000));
      return 2 + diff;
    }
    function getDayName(date) {
      return weekNames[date.getDay()];
    }
    function hasCourses(date) {
      const w = getWeekNum(date);
      const day = getDayName(date);
      return courseData.some(c => c['星期几'] === day && parseWeekRange(c['周数'], w));
    }
    function coursesOn(date) {
      const w = getWeekNum(date);
      const day = getDayName(date);
      return courseData.filter(c => c['星期几'] === day && parseWeekRange(c['周数'], w));
    }

    // 从 base 往前找 n 个有课日
    function findPrevDays(base, n) {
      const result = [];
      let d = addDays(base, -1);
      let guard = 0;
      while (result.length < n && guard < 60) {
        if (hasCourses(d)) result.push(new Date(d));
        d = addDays(d, -1);
        guard++;
      }
      return result.reverse();
    }
    // 从 base 往后找 n 个有课日
    function findNextDays(base, n) {
      const result = [];
      let d = addDays(base, 1);
      let guard = 0;
      while (result.length < n && guard < 60) {
        if (hasCourses(d)) result.push(new Date(d));
        d = addDays(d, 1);
        guard++;
      }
      return result;
    }

    // 基准日 = 今天
    const today = dayStart(new Date());
    let anchorDate = today;

    const daysEl = root.querySelector('[data-role="days"]');
    let animating = false;

    function buildDayColumn(date, isAnchor, nextDate) {
      const courses = coursesOn(date);
      const courseHtml = courses.length ? courses.map(c => `
        <article class="course">
          <strong class="course-name">${c['课程名称']}</strong>
          <span class="course-time">${c['时间段']}</span>
          <span class="course-meta">${c['教室']} · ${c['教学班']}</span>
        </article>`).join('') : '<span class="empty">休息日</span>';

      // 计算和下一列之间跳过了几天休息日
      let gapHint = '';
      if (nextDate) {
        const gapDays = Math.round((dayStart(nextDate) - dayStart(date)) / 86400000) - 1;
        if (gapDays > 0) {
          const dots = '· '.repeat(gapDays);
          gapHint = `<div class="gap-hint">${dots}休息${gapDays}天！</div>`;
        }
      }

      return `
        <section class="day ${isAnchor ? 'is-today' : ''}">
          <header class="day-header">
            <span class="day-name">${getDayName(date)}</span>
            <span class="day-date">${date.getMonth() + 1}/${date.getDate()}</span>
          </header>
          <div class="courses">${courseHtml}</div>
          ${gapHint}
        </section>`;
    }

    function renderDays() {
      const prev = findPrevDays(anchorDate, 1);
      const next = findNextDays(anchorDate, 3);
      const all = [...prev, anchorDate, ...next];
      const anchorIdx = prev.length;

      daysEl.innerHTML = all.map((d, i) => {
        const nextD = all[i + 1];
        return buildDayColumn(d, i === anchorIdx, nextD);
      }).join('');
    }

    function animateAndRender(dir) {
      if (animating) return;
      animating = true;

      daysEl.classList.add(dir === 'next' ? 'is-anim-next' : 'is-anim-prev');

      setTimeout(() => {
        renderDays();
        daysEl.classList.remove('is-anim-next', 'is-anim-prev');
        // 触发重排，让新内容从对侧滑入
        void daysEl.offsetWidth;
        animating = false;
      }, 220);
    }

    root.querySelector('[data-action="prevDay"]').addEventListener('click', () => {
      anchorDate = addDays(anchorDate, -1);
      animateAndRender('prev');
    });
    root.querySelector('[data-action="nextDay"]').addEventListener('click', () => {
      anchorDate = addDays(anchorDate, 1);
      animateAndRender('next');
    });

    renderDays();
  }
};
