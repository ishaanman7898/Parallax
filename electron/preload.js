// The small, fixed API the page gets in the desktop app: app info, desktop settings and updates.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("parallaxDesktop", {
  info: () => ipcRenderer.invoke("app:info"),
  set: (key, value) => ipcRenderer.invoke("app:set", key, value),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdate: (fn) => ipcRenderer.on("update:state", (_e, state) => fn(state))
});
