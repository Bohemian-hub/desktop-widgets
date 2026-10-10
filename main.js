const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('桌面组件');

const WIDGETS_DIR = path.join(__dirname, 'widgets');
const STATE_FILE = path.join(app.getPath('userData'), 'widget-state.json');

const widgetWindows = new Map(); // widgetId -> BrowserWindow
const proxyWindows = new Map();  // widgetId -> 交互代理窗口（壁纸模式下接收鼠标/键盘）
let controlWin = null;
let dockWin = null;
let tray = null;

/* ================= 组件定义加载 =================
 * 每个组件一个文件夹：widgets/<name>/widget.js（定义）
 *   + data.json（数据，可选）+ icon.svg（图标，可选）
 * 在隔离的 fakeWindow 里执行 widget.js，提取
 * window.XxxWidget = { id, name, width, height, icon, css, html, init }
 */
function loadWidgetDefs() {
  const defs = [];
  let entries = [];
  try {
    entries = fs.readdirSync(WIDGETS_DIR, { withFileTypes: true });
  } catch (e) {
    console.warn('[widgets] 目录不存在:', WIDGETS_DIR, e.message);
    return defs;
  }

  for (const entry of entries) {
    // 只扫文件夹，_ 开头的（模板）跳过
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const folder = entry.name;
    const abs = path.join(WIDGETS_DIR, folder, 'widget.js');
    if (!fs.existsSync(abs)) continue;

    let code;
    try {
      code = fs.readFileSync(abs, 'utf8');
    } catch (e) {
      console.warn(`[widgets] 读取失败 ${folder}/widget.js:`, e.message);
      continue;
    }

    const fakeWindow = {};
    try {
      // 组件文件格式：window.XxxWidget = {...}
      new Function('window', code + '\n;return window;')(fakeWindow);
      const key = Object.keys(fakeWindow).find(k => {
        const v = fakeWindow[k];
        return v && typeof v === 'object' && v.id && typeof v.html === 'string' && typeof v.init === 'function';
      });
      if (key) {
        const def = { key, folder, ...fakeWindow[key] };
        // 组件文件夹里的 icon.svg 优先作为图标
        const iconPath = path.join(WIDGETS_DIR, folder, 'icon.svg');
        if (fs.existsSync(iconPath)) {
          try { def.icon = fs.readFileSync(iconPath, 'utf8'); } catch { /* 忽略 */ }
        }
        defs.push(def);
        console.log(`[widgets] 已加载 ${folder}/widget.js -> ${key} (${def.id})`);
      }
    } catch (e) {
      console.warn(`[widgets] 跳过 ${folder}:`, e.message);
    }
  }
  return defs;
}

/* ================= 状态持久化 ================= */
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) || {};
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.warn('保存状态失败:', e.message);
  }
}

function saveBounds(id, bounds) {
  const state = loadState();
  state[id] = { x: bounds.x, y: bounds.y };
  saveState(state);
}

/* ================= 全局透明度 =================
 * 统一控制所有组件外层卡片的背景透明度（0.15 ~ 1.0），
 * 持久化在 state 文件的 _alpha 键，实时广播给所有组件窗口。
 */
const DEFAULT_ALPHA = 0.5;

function getGlobalAlpha() {
  const a = parseFloat(loadState()._alpha);
  return isNaN(a) ? DEFAULT_ALPHA : a;
}

function setGlobalAlpha(value) {
  const v = Math.min(1, Math.max(0.15, parseFloat(value) || DEFAULT_ALPHA));
  const state = loadState();
  state._alpha = v;
  saveState(state);
  for (const win of widgetWindows.values()) {
    if (!win.isDestroyed()) win.webContents.send('alpha:set', v);
  }
  console.log('[alpha] 全局透明度 ->', v);
}

/* ================= 壁纸模式 + 交互锁定 =================
 * 两个独立开关，组合出四种桌面形态：
 *   壁纸模式 OFF + 交互锁定 OFF：普通窗口，可交互（默认）
 *   壁纸模式 OFF + 交互锁定 ON ：普通层级，但点击穿透到桌面（纯装饰）
 *   壁纸模式 ON  + 交互锁定 ON ：层级在桌面图标之下，纯背景展示
 *   壁纸模式 ON  + 交互锁定 OFF：层级在桌面图标之下（不遮挡图标），
 *                                 且通过「交互代理窗口」转发鼠标/键盘事件，
 *                                 组件照常可点击、输入、拖动 —— 置底与交互兼得
 * macOS 命中测试按窗口层级从上往下：低于桌面图标层的窗口收不到鼠标事件，
 * 所以「壁纸模式 + 可交互」需要一个同位置、完全透明的 normal 层代理窗口，
 * 它接收事件后转发给真正的组件窗口（webContents.sendInputEvent）。
 */
const DESKTOP_WINDOW_LEVEL = -2147483624; // 低于桌面图标层（kCGDesktopIconWindowLevel=-2147483623）
const PROXY_WINDOW_LEVEL = -1000;         // 代理层：低于所有 App 窗口(normal=0)、高于桌面图标层
const DRAG_THRESHOLD = 4;                 // 按住后位移超过该值才判定为拖动（原地点击转发为 click）

let dragState = null; // { widgetId, downX, downY, offsetX, offsetY, dragging }

function getDesktopMode() {
  return loadState()._desktopMode === true;
}

function getLockInteraction() {
  return loadState()._lockInteraction === true;
}

function applyModeToWindow(win) {
  if (win.isDestroyed()) return;
  if (getDesktopMode()) {
    // setAlwaysOnTop(true, 'normal', 大负数) => 最终窗口层级 = normal(0) + 偏移
    win.setAlwaysOnTop(true, 'normal', DESKTOP_WINDOW_LEVEL);
  } else {
    win.setAlwaysOnTop(false);
  }
}

/* —— 交互代理窗口 —— */
function createProxyFor(def, win) {
  const b = win.getBounds();
  const proxy = new BrowserWindow({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    focusable: false,     // 不抢焦点：点击后焦点给真正的组件窗口（中文输入/粘贴直达组件）
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'proxy-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  // 代理层放到 App 窗口之下、桌面图标层之上：
  // 桌面上点击组件区域 → 代理接收（组件可交互）；
  // 其他软件窗口打开时 → 窗口盖住代理层，正常操作软件，互不干扰。
  proxy.setAlwaysOnTop(true, 'normal', PROXY_WINDOW_LEVEL);
  proxy.loadFile(path.join(__dirname, 'renderer', 'proxy.html'));
  proxy.on('closed', () => proxyWindows.delete(def.id));
  proxyWindows.set(def.id, proxy);
}

function destroyProxy(widgetId) {
  const p = proxyWindows.get(widgetId);
  if (p && !p.isDestroyed()) p.close();
  proxyWindows.delete(widgetId);
}

function syncProxy(win) {
  // 组件窗口移动/改变大小时，代理窗口跟随对齐
  for (const [id, p] of proxyWindows) {
    if (p.isDestroyed()) { proxyWindows.delete(id); continue; }
    const w = widgetWindows.get(id);
    if (w && !w.isDestroyed()) p.setBounds(w.getBounds());
  }
}

/* 按两个开关的组合，应用每个组件的交互形态 */
function applyInteractionState(def, win) {
  if (win.isDestroyed()) return;
  const wallpaper = getDesktopMode();
  const locked = getLockInteraction();

  if (wallpaper && !locked) {
    // 壁纸模式 + 可交互：组件窗口置底，用透明代理窗口接收事件
    if (!proxyWindows.has(def.id) || proxyWindows.get(def.id).isDestroyed()) {
      createProxyFor(def, win);
    } else {
      syncProxy(win);
    }
  } else {
    destroyProxy(def.id);
  }

  // 窗口模式 + 交互锁定：点击穿透（窗口可见但事件透给桌面）
  if (!wallpaper) win.setIgnoreMouseEvents(locked);
  else win.setIgnoreMouseEvents(false);
}

function setDesktopMode(on) {
  const state = loadState();
  state._desktopMode = !!on;
  saveState(state);
  const defs = loadWidgetDefs();
  for (const def of defs) {
    const win = widgetWindows.get(def.id);
    if (!win) continue;
    applyModeToWindow(win);
    applyInteractionState(def, win);
  }
  console.log('[mode] 壁纸模式 ->', !!on);
}

function setLockInteraction(on) {
  const state = loadState();
  state._lockInteraction = !!on;
  saveState(state);
  const defs = loadWidgetDefs();
  for (const def of defs) {
    const win = widgetWindows.get(def.id);
    if (!win) continue;
    applyInteractionState(def, win);
  }
  console.log('[mode] 交互锁定 ->', !!on);
}

/* ================= 组件窗口 =================
 * 核心设计：每个组件一个独立窗口，尺寸 = 组件尺寸。
 * 窗口只占组件那一小块屏幕，其余屏幕区域天然交给
 * macOS 桌面 —— 文件夹/图标照常点击，组件区域网页可点击，
 * 从架构上解决 Plash「二选一」的痛点。
 */
const LAYOUT_GAP = 30; // 积木布局：组件之间统一 30px 间距

/* 积木布局：按宽度分组，同宽组件上下堆叠、不同宽左右拼接，
 * 组内 30px 间距，组间 30px 间距，天然互不重叠。 */
function layoutWidgets() {
  const defs = loadWidgetDefs();
  const { workArea } = screen.getPrimaryDisplay();
  const groups = {}; // width -> defs
  for (const def of defs) {
    const w = Math.round(def.width || 300);
    (groups[w] = groups[w] || []).push(def);
  }
  const widths = Object.keys(groups).map(Number).sort((a, b) => a - b);

  let x = workArea.x + 40;
  for (const w of widths) {
    let y = workArea.y + 60;
    for (const def of groups[w]) {
      const win = widgetWindows.get(def.id);
      if (!win || win.isDestroyed()) continue;
      const H = Math.round(def.height || 200);
      win.setPosition(Math.round(x), Math.round(y));
      saveBounds(def.id, win.getBounds());
      syncProxy(win); // 积木布局后，代理窗口跟随对齐
      y += H + LAYOUT_GAP;
    }
    x += w + LAYOUT_GAP;
  }
}

function createWidgetWindow(def, index) {
  const state = loadState();
  const saved = state[def.id];
  const { workArea } = screen.getPrimaryDisplay();

  const W = Math.round(def.width || 300);
  const H = Math.round(def.height || 200);
  // 默认位置：横向错开（每行 620px 步进），避免组件互相重叠
  const x = saved ? saved.x : workArea.x + 180 + (index % 2) * 620;
  const y = saved ? saved.y : workArea.y + 140 + Math.floor(index / 2) * 300;

  const win = new BrowserWindow({
    width: W,
    height: H,
    x,
    y,
    transparent: true,       // 透明窗口：组件卡片圆角之外是透明像素
    frame: false,            // 无边框
    resizable: false,
    hasShadow: false,
    icon: path.join(__dirname, 'assets', 'app-icon.png'),
    backgroundColor: '#00000000',
    show: false,             // 等内容就绪再显示，避免白闪
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'widget.html'), {
    query: { folder: def.folder, key: def.key }
  });

  win.once('ready-to-show', () => {
    win.show();
    applyModeToWindow(win);        // 应用当前模式（壁纸模式时窗口置于桌面图标之下）
    applyInteractionState(def, win); // 按 壁纸模式×交互锁定 组合创建/移除代理窗口
    // 窗口真正显示后再通知 Dock/控制台刷新（避免启动时序读到未显示状态）
    broadcastWidgetsChanged();
  });

  win.on('moved', () => {
    if (!win.isDestroyed()) {
      saveBounds(def.id, win.getBounds());
      syncProxy(win);
    }
  });
  win.on('closed', () => {
    widgetWindows.delete(def.id);
    destroyProxy(def.id);
  });

  widgetWindows.set(def.id, win);
}

function buildAllWidgets() {
  const defs = loadWidgetDefs();
  defs.forEach((def, i) => createWidgetWindow(def, i));
}

/* ================= 控制台窗口 ================= */
function createControlWindow() {
  if (controlWin && !controlWin.isDestroyed()) {
    controlWin.show();
    controlWin.focus();
    return;
  }
  controlWin = new BrowserWindow({
    width: 340,
    height: 460,
    title: '桌面组件控制台',
    resizable: false,
    icon: path.join(__dirname, 'assets', 'app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  controlWin.loadFile(path.join(__dirname, 'renderer', 'control.html'));
  controlWin.on('closed', () => { controlWin = null; });
}

/* ================= Dock 窗口 =================
 * 固定在桌面右下角的竖排图标栏：显示中的组件蓝色，隐藏的灰色
 */
const DOCK_W = 58;                 // 窗口宽 = 图标 38 + 左右 padding 20
const DOCK_ITEM_H = 48;            // 每个图标占位高度
const DOCK_MARGIN = 24;            // 距屏幕右下角边距

function dockSize() {
  const count = loadWidgetDefs().length;
  return { width: DOCK_W, height: count * DOCK_ITEM_H + 20 };
}

function repositionDock() {
  if (!dockWin || dockWin.isDestroyed()) return;
  const { workArea } = screen.getPrimaryDisplay();
  const { width, height } = dockSize();
  dockWin.setBounds({
    x: workArea.x + workArea.width - width - DOCK_MARGIN,
    y: workArea.y + workArea.height - height - DOCK_MARGIN,
    width,
    height
  });
}

function createDockWindow() {
  if (dockWin && !dockWin.isDestroyed()) return;
  const { width, height } = dockSize();
  dockWin = new BrowserWindow({
    width,
    height,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  dockWin.loadFile(path.join(__dirname, 'renderer', 'dock.html'));
  dockWin.on('closed', () => { dockWin = null; });
  repositionDock();
}

function broadcastWidgetsChanged() {
  if (dockWin && !dockWin.isDestroyed()) dockWin.webContents.send('widgets:changed');
  if (controlWin && !controlWin.isDestroyed()) controlWin.webContents.send('widgets:changed');
}

/* ================= 托盘 ================= */
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const icon = nativeImage.createFromPath(iconPath);
  // macOS 模板图像：按系统外观自动着色（深色菜单栏=白色、浅色=深色），保证始终可见
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('桌面组件');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开控制台', click: createControlWindow },
    { label: '重新排列组件（积木布局）', click: layoutWidgets },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]));
}

/* ================= IPC ================= */
ipcMain.on('widget:resize', (e, { width, height }) => {
  // 组件内容自适应（如 todo 组件自动增高），窗口跟随
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win && !win.isDestroyed()) {
    win.setSize(
      Math.max(80, Math.round(width)),
      Math.max(60, Math.round(height))
    );
  }
});

ipcMain.handle('widgets:list', () =>
  loadWidgetDefs().map(d => ({
    id: d.id,
    name: d.name,
    folder: d.folder,
    icon: d.icon || '',
    visible: widgetWindows.has(d.id) && widgetWindows.get(d.id).isVisible()
  }))
);

ipcMain.handle('widget:toggle', (e, id) => {
  const win = widgetWindows.get(id);
  if (win && !win.isDestroyed()) {
    if (win.isVisible()) win.hide();
    else win.show();
    // 代理窗口跟随组件显示状态
    const proxy = proxyWindows.get(id);
    if (proxy && !proxy.isDestroyed()) {
      if (win.isVisible()) proxy.show();
      else proxy.hide();
    }
  }
  broadcastWidgetsChanged();
  return true;
});

ipcMain.handle('widgets:reload', () => {
  for (const [id, win] of widgetWindows) {
    if (!win.isDestroyed()) win.close();
    widgetWindows.delete(id);
  }
  for (const [id, p] of proxyWindows) {
    if (!p.isDestroyed()) p.close();
    proxyWindows.delete(id);
  }
  buildAllWidgets();
  broadcastWidgetsChanged();
  return true;
});

ipcMain.on('app:quit', () => app.quit());

/* 全局透明度：读（invoke）/ 写（send，实时广播） */
ipcMain.handle('alpha:get', () => getGlobalAlpha());
ipcMain.on('alpha:set', (e, value) => setGlobalAlpha(value));

/* 壁纸模式：读（invoke）/ 写（send，实时应用到所有组件窗口） */
ipcMain.handle('mode:get', () => getDesktopMode());
ipcMain.on('mode:set', (e, on) => setDesktopMode(!!on));

/* 交互锁定：读（invoke）/ 写（send） */
ipcMain.handle('lock:get', () => getLockInteraction());
ipcMain.on('lock:set', (e, on) => setLockInteraction(!!on));

/* 交互代理事件：代理窗口的鼠标 → 注入给真正的组件窗口。
 * 拖动判定：按下后不立即决定，位移超过阈值才进入拖动（标题栏里的按钮
 * 如课表翻页/图标点击照常可点）；原地点击则补发 down+up 让组件收到 click，
 * 并把键盘焦点交给组件窗口（中文输入/粘贴由系统直达组件）。 */
ipcMain.on('proxy:event', (e, evt) => {
  const proxy = BrowserWindow.fromWebContents(e.sender);
  if (!proxy || proxy.isDestroyed()) return;
  let widgetId = null;
  for (const [id, p] of proxyWindows) {
    if (p === proxy) { widgetId = id; break; }
  }
  if (!widgetId) return;
  const win = widgetWindows.get(widgetId);
  if (!win || win.isDestroyed()) return;

  if (evt.t === 'down') {
    const cursor = screen.getCursorScreenPoint();
    dragState = {
      widgetId,
      downX: cursor.x,
      downY: cursor.y,
      offsetX: evt.x,
      offsetY: evt.y,
      dragging: false
    };
  } else if (evt.t === 'move') {
    if (dragState && dragState.widgetId === widgetId) {
      const cursor = screen.getCursorScreenPoint();
      if (!dragState.dragging) {
        const dx = cursor.x - dragState.downX;
        const dy = cursor.y - dragState.downY;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
          dragState.dragging = true; // 位移超过阈值 → 判定为拖动
        }
      }
      if (dragState.dragging) {
        win.setPosition(
          Math.round(cursor.x - dragState.offsetX),
          Math.round(cursor.y - dragState.offsetY)
        );
        syncProxy(win);
        saveBounds(widgetId, win.getBounds());
      }
    } else {
      win.webContents.sendInputEvent({
        type: 'mouseMove', x: evt.x, y: evt.y, movementX: 0, movementY: 0
      });
    }
  } else if (evt.t === 'up') {
    if (dragState && dragState.widgetId === widgetId) {
      const wasDragging = dragState.dragging;
      dragState = null;
      if (!wasDragging) {
        // 原地点击：补发 down+up，组件收到完整 click
        win.webContents.sendInputEvent({
          type: 'mouseDown', x: evt.x, y: evt.y,
          button: evt.button === 2 ? 'right' : 'left', clickCount: 1
        });
        win.webContents.sendInputEvent({
          type: 'mouseUp', x: evt.x, y: evt.y,
          button: evt.button === 2 ? 'right' : 'left', clickCount: 1
        });
        // 把键盘焦点交给组件窗口：中文输入法 / Cmd+V 粘贴由系统直达组件
        win.focus();
      }
    } else {
      win.webContents.sendInputEvent({
        type: 'mouseUp', x: evt.x, y: evt.y,
        button: evt.button === 2 ? 'right' : 'left', clickCount: 1
      });
    }
  } else if (evt.t === 'wheel') {
    win.webContents.sendInputEvent({
      type: 'mouseWheel',
      x: evt.x, y: evt.y,
      deltaX: evt.deltaX, deltaY: evt.deltaY,
      canScroll: true,
      modifiers: evt.ctrl ? ['control'] : []
    });
  } else if (evt.t === 'keydown' || evt.t === 'keyup' || evt.t === 'char') {
    // 兜底转发：正常路径下键盘焦点已在组件窗口（点击后 win.focus()），
    // 这里仅在焦点未成功转移时兜底，避免键盘事件丢失
    if (evt.t === 'char') {
      win.webContents.sendInputEvent({ type: 'char', keyCode: evt.key });
    } else {
      win.webContents.sendInputEvent({
        type: evt.t === 'keydown' ? 'keyDown' : 'keyUp',
        keyCode: evt.key,
        modifiers: modifiersFrom(evt)
      });
    }
  }
});

/* 把代理事件的修饰键布尔值转成 Electron 修饰键数组 */
function modifiersFrom(evt) {
  const m = [];
  if (evt.ctrl) m.push('control');
  if (evt.shift) m.push('shift');
  if (evt.alt) m.push('alt');
  if (evt.meta) m.push('meta');
  return m;
}

/* ================= 组件数据读写 =================
 * 数据存放在组件自己的文件夹里：widgets/<folder>/data.json
 */
const FOLDER_RE = /^[a-zA-Z0-9_-]+$/;

function safeWidgetFolder(folder) {
  return typeof folder === 'string' && FOLDER_RE.test(folder) ? folder : null;
}

ipcMain.handle('data:read', (e, folder) => {
  const f = safeWidgetFolder(folder);
  if (!f) return null;
  const p = path.join(WIDGETS_DIR, f, 'data.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
});

ipcMain.on('data:write', (e, folder, json) => {
  const f = safeWidgetFolder(folder);
  if (!f || !json) return;
  const p = path.join(WIDGETS_DIR, f, 'data.json');
  try {
    fs.writeFileSync(p, JSON.stringify(json, null, 2));
  } catch (err) {
    console.warn('[data] 写入失败', folder, err.message);
  }
});

/* ================= 启动 ================= */
app.whenReady().then(() => {
  // 软件图标：Dock 显示蓝色应用图标（assets/app-icon.png）
  const appIcon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'app-icon.png'));
  if (process.platform === 'darwin' && app.dock && !appIcon.isEmpty()) {
    app.dock.setIcon(appIcon);
  }
  createTray();
  buildAllWidgets();
  createDockWindow();
  // 屏幕分辨率/工作区变化时，Dock 自动重新贴右下角
  screen.on('display-metrics-changed', repositionDock);
});

app.on('activate', () => createControlWindow());

// 组件窗口全关闭也保持后台运行（托盘退出）
app.on('window-all-closed', () => { /* 保持运行 */ });
