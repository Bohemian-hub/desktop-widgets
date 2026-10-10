// 交互代理窗口 preload：把页面的鼠标/键盘事件转发给主进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proxyApi', {
  send: (evt) => ipcRenderer.send('proxy:event', evt)
});
