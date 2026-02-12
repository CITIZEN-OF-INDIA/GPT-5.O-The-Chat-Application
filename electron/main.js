const { app, BrowserWindow, net, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const Store = require("electron-store").default;

const store = new Store();
let mainWindow;

const PROD_UI_URL = process.env.PROD_UI_URL || "";
const VERSION_URL = process.env.VERSION_URL || "";

function isValidRemoteUrl(value) {
  if (!value) return false;
  if (value.includes("yourdomain.com")) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

// ---------- INTERNET CHECK ----------
async function hasInternet() {
  if (!isValidRemoteUrl(VERSION_URL)) return false;
  return new Promise((resolve) => {
    try {
      const req = net.request({
        method: "HEAD",
        url: VERSION_URL,
      });
      req.on("response", () => resolve(true));
      req.on("error", () => resolve(false));
      req.end();
    } catch {
      resolve(false);
    }
  });
}

function getBundledUiPath() {
  const candidates = [
    path.resolve(app.getAppPath(), "../apps/web/dist/index.html"),
    path.resolve(process.cwd(), "../apps/web/dist/index.html"),
    path.resolve(process.cwd(), "apps/web/dist/index.html"),
    path.resolve(process.resourcesPath || "", "apps/web/dist/index.html"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function loadBundledUi() {
  const uiPath = getBundledUiPath();
  if (!uiPath) {
    throw new Error("Bundled UI not found (apps/web/dist/index.html).");
  }
  await mainWindow.loadFile(uiPath);
  return uiPath;
}

async function tryLoadRemote(label) {
  if (!isValidRemoteUrl(PROD_UI_URL)) {
    console.log(`${label}: skipped (invalid PROD_UI_URL)`);
    return false;
  }
  try {
    await mainWindow.loadURL(PROD_UI_URL);
    store.set("last_remote_loaded_ok", true);
    store.set("last_ui_source", "remote");
    console.log(`${label}: success`);
    return true;
  } catch (error) {
    console.log(`${label}: failed (${error.message})`);
    return false;
  }
}

// ---------- WINDOW ----------
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  Menu.setApplicationMenu(null);

  // 🔍 DEBUG (SAFE)

  const online = await hasInternet();

  let loadedSource = "bundled";

  // 1) ONLINE -> load deployed frontend
  if (online) {
    console.log("Online: trying remote UI");
    const remoteLoaded = await tryLoadRemote("Remote online load");
    if (remoteLoaded) loadedSource = "remote";
  }

  // 2) OFFLINE or remote failed -> try cached remote UI
  const hadRemoteBefore = store.get("last_remote_loaded_ok", false);
  if (loadedSource !== "remote" && hadRemoteBefore) {
    console.log("Fallback: trying cached remote UI");
    const cachedLoaded = await tryLoadRemote("Remote cached load");
    if (cachedLoaded) loadedSource = "cached-remote";
  }

  // 3) last fallback -> bundled UI
  if (loadedSource === "bundled") {
    const bundledPath = await loadBundledUi();
    store.set("last_ui_source", "bundled");
    console.log(`Loaded bundled UI from: ${bundledPath}`);
  }

  // 🔁 VERSION CHECK (ONLY WHEN ONLINE)
  mainWindow.webContents.on("did-finish-load", async () => {
    if (!online || loadedSource === "bundled") return;

    try {
      const currentVersion =
        await mainWindow.webContents.executeJavaScript(
          "window.__UI_VERSION__"
        );

      const savedVersion = store.get("ui_version");

      if (savedVersion !== currentVersion) {
        store.set("ui_version", currentVersion);
        mainWindow.reload();
      }
    } catch {
      console.log("Version check skipped");
    }
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
