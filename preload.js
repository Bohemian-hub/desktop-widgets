const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  // 组件页面：报告实际渲染尺寸，让窗口跟随内容
  resize: (width, height) => ipcRenderer.send('widget:resize', { width, height }),
  // 控制台 / Dock 页面
  listWidgets: () => ipcRenderer.invoke('widgets:list'),
  toggleWidget: (id) => ipcRenderer.invoke('widget:toggle', id),
  reloadWidgets: () => ipcRenderer.invoke('widgets:reload'),
  quit: () => ipcRenderer.send('app:quit'),
  // 组件数据读写（widgets/<folder>/data.json）
  readData: (folder) => ipcRenderer.invoke('data:read', folder),
  writeData: (folder, json) => ipcRenderer.send('data:write', folder, json),
  // 组件显示状态变化时主进程推送通知
  onWidgetsChanged: (callback) => ipcRenderer.on('widgets:changed', () => callback()),
  // 全局透明度：读当前值 / 设置新值（实时广播到所有组件）/ 监听变化
  getAlpha: () => ipcRenderer.invoke('alpha:get'),
  setAlpha: (value) => ipcRenderer.send('alpha:set', value),
  onAlphaChanged: (callback) => ipcRenderer.on('alpha:set', (e, v) => callback(v)),
  // 壁纸模式：组件层级降到桌面图标之下（背景展示，不可交互）
  getDesktopMode: () => ipcRenderer.invoke('mode:get'),
  setDesktopMode: (on) => ipcRenderer.send('mode:set', !!on),
  // 交互锁定：锁定后组件不响应鼠标/键盘（点击穿透到桌面）
  getLockInteraction: () => ipcRenderer.invoke('lock:get'),
  setLockInteraction: (on) => ipcRenderer.send('lock:set', !!on)
});
