const { app, BrowserWindow, net, Menu, Tray, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const Store = require("electron-store").default;

const store = new Store();
let mainWindow;
let tray;

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
  store.set("last_ui_source", "bundled");
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

async function loadInitialPage() {
  if (!mainWindow) return "bundled";

  const online = await hasInternet();
  let loadedSource = "bundled";

  if (online) {
    const remoteLoaded = await tryLoadRemote("Initial remote load");
    if (remoteLoaded) loadedSource = "remote";
  }

  const hadRemoteBefore = store.get("last_remote_loaded_ok", false);
  if (loadedSource !== "remote" && hadRemoteBefore) {
    const cachedLoaded = await tryLoadRemote("Initial cached remote load");
    if (cachedLoaded) loadedSource = "cached-remote";
  }

  if (loadedSource === "bundled") {
    await loadBundledUi();
  }

  mainWindow.show();
  mainWindow.focus();
  return loadedSource;
}

function createWhiteTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <rect x="0" y="0" width="16" height="16" fill="#FFFFFF"/>
    </svg>
  `.trim();

  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  );
  image.setTemplateImage(false);
  return image;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.setSkipTaskbar(true);

  tray = new Tray(createWhiteTrayIcon());
  tray.setToolTip("My Chat App");

  const trayMenu = Menu.buildFromTemplate([
    { label: "Show", click: async () => loadInitialPage() },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
  tray.setContextMenu(trayMenu);

  tray.on("click", async () => {
    await loadInitialPage();
  });

  tray.on("right-click", async () => {
    await loadInitialPage();
    tray.popUpContextMenu(trayMenu);
  });

  mainWindow.on("minimize", (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  const initialSource = await loadInitialPage();
  const online = await hasInternet();

  mainWindow.webContents.on("did-finish-load", async () => {
    if (!online || initialSource === "bundled") return;

    try {
      const currentVersion = await mainWindow.webContents.executeJavaScript(
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
