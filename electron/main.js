const { app, BrowserWindow, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { start } = require("../server");

let origin = null;

// Runs the same server as the website on a random local port, then loads it.
async function createWindow() {
  if (!origin) {
    const { port } = await start(0, "127.0.0.1");
    origin = `http://127.0.0.1:${port}`;
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 600,
    backgroundColor: "#1b1c1d",
    title: "Parallax",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
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
}

// Checks GitHub Releases for a newer version, downloads it quietly and offers a restart.
function checkForUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.on("update-downloaded", async info => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      title: "Update ready",
      message: `Parallax ${info.version} has been downloaded.`,
      detail: "Restart to finish updating."
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on("error", err => console.error("update check failed:", err.message));
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
  createWindow();
  checkForUpdates();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
