const { app, BrowserWindow, shell, ipcMain, utilityProcess } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");

let origin = null;
let server = null;

// Desktop only settings, kept next to the app's other data. Everything else lives in the page.
const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
const DEFAULTS = { windowMode: "maximized", autoUpdate: true };
let settings = { ...DEFAULTS };

function loadSettings() {
  try {
    settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) };
  } catch {
    settings = { ...DEFAULTS };
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error("could not save settings:", err.message);
  }
}

function applyWindowMode(win, mode) {
  if (mode === "fullscreen") return win.setFullScreen(true);
  if (win.isFullScreen()) win.setFullScreen(false);
  if (mode === "maximized") win.maximize();
  else win.unmaximize();
}

// Starts the same server as the website, in a separate process on a random local port.
function startServer() {
  return new Promise((resolve, reject) => {
    server = utilityProcess.fork(path.join(__dirname, "server-process.js"), [app.getPath("userData")], { serviceName: "Parallax server" });
    server.once("message", (m) => (m.port ? resolve(m.port) : reject(new Error(m.error))));
    server.once("exit", (code) => {
      server = null;
      origin = null;
      reject(new Error(`server exited with code ${code}`));
    });
  });
}

function stopServer() {
  server?.kill();
  server = null;
}

// Loads the page from the local server, starting it first if needed.
async function createWindow() {
  if (!origin) origin = `http://127.0.0.1:${await startServer()}`;

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 600,
    show: false,
    backgroundColor: "#000000",
    title: "Parallax",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, preload: path.join(__dirname, "preload.js") }
  });

  // Shows the window at its launch size straight away, so the startup animation plays full size.
  win.once("ready-to-show", () => {
    applyWindowMode(win, settings.windowMode);
    win.show();
  });
  win.loadURL(origin + "/");

  // Article links open in the system browser instead of a new app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(origin)) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  // F11 toggles full screen, Escape leaves it.
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    } else if (input.key === "Escape" && win.isFullScreen()) {
      win.setFullScreen(false);
    }
  });
}

// ---------- over the air updates from GitHub Releases ----------
let update = { status: "idle", version: null, progress: 0, error: null, checkedAt: null };

function setUpdate(patch) {
  update = { ...update, ...patch };
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send("update:state", update);
}

async function checkForUpdates() {
  if (!app.isPackaged) return setUpdate({ status: "dev" });
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    setUpdate({ status: "error", error: err.message });
  }
}

function setupUpdates() {
  autoUpdater.autoDownload = settings.autoUpdate;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => setUpdate({ status: "checking", error: null }));
  autoUpdater.on("update-available", (info) => setUpdate({ status: autoUpdater.autoDownload ? "downloading" : "available", version: info.version, progress: 0 }));
  autoUpdater.on("update-not-available", () => setUpdate({ status: "current", checkedAt: new Date().toISOString() }));
  autoUpdater.on("download-progress", (p) => setUpdate({ status: "downloading", progress: Math.round(p.percent) }));
  autoUpdater.on("update-downloaded", (info) => setUpdate({ status: "ready", version: info.version, progress: 100, checkedAt: new Date().toISOString() }));
  autoUpdater.on("error", (err) => setUpdate({ status: "error", error: err.message }));
  checkForUpdates();
  setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
}

ipcMain.handle("app:info", () => ({ version: app.getVersion(), packaged: app.isPackaged, platform: process.platform, dataDir: app.getPath("userData"), settings, update }));
ipcMain.handle("app:open-data", () => shell.openPath(app.getPath("userData")));
ipcMain.handle("app:set", (e, key, value) => {
  if (!(key in DEFAULTS)) return settings;
  settings[key] = value;
  saveSettings();
  if (key === "autoUpdate") autoUpdater.autoDownload = !!value;
  if (key === "windowMode") {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) applyWindowMode(win, value);
  }
  return settings;
});
ipcMain.handle("update:check", () => checkForUpdates());
ipcMain.handle("update:download", () => autoUpdater.downloadUpdate().catch((err) => setUpdate({ status: "error", error: err.message })));
// Answers the click first, stops the server so no process holds the app's files, then runs
// the installer quietly and reopens the app when it finishes.
ipcMain.handle("update:install", () => {
  setImmediate(() => {
    stopServer();
    autoUpdater.quitAndInstall(true, true);
  });
});

app.whenReady().then(() => {
  loadSettings();
  createWindow();
  setupUpdates();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", stopServer);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
