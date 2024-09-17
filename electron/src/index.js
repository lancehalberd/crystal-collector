const { app, BrowserWindow, ipcMain, session } = require('electron');
const process = require('node:process');
const path = require('path');
require('@dotenvx/dotenvx').config();
// Set this to true if building for steam
let steamworks;
let client;
let mainWindow;

if (typeof __dirname === 'undefined') {
    // eslint-disable-next-line no-unused-vars
    let __dirname;
    __dirname = path.dirname(process.argv[1]);
}

if (process.env.IS_STEAM === 'true') {
  steamworks = require('steamworks.js');

  try {
    client = steamworks.init();
  } catch (error) {
    console.log({error});
    client = steamworks.init(2560850);
    console.log('\n\n******\nForced app id\n******\n\n');
  }

  // console.log(client.localplayer.getName())
}

const isSteam = () => {
  if (process.env.IS_STEAM !== 'true') {
    console.log('STEAM IS NOT ENABLED');
    return false;
  }
  return true;
};

const hasClient = async (client) => {
  if (!client) {
    client = await steamworks.init(2560850);
    console.log('\n\n******\nSet app id\n******\n\n');
    return false;
  }
  return true;
};

const handleSteamLogUser = async (event) => {
  if (!isSteam() && !hasClient(client)) {
    return;
  }

  const result = await client.localplayer.getName();
  return result;
}

const handleFetchSteamAchievement = async (event, achievementName) => {
  if (!isSteam() && !hasClient(client)) {
    return;
  }
  return new Promise((resolve, reject) => {
    const result = client.achievement.isActivated(achievementName);
    resolve(result);
    reject('error', result);
  });
}

const handleSetSteamAchievement = async (event, achievementName) => {
  if (!isSteam() && !hasClient(client)) {
    return;
  }

  const result = await client.achievement.activate(achievementName);
  return result;
}

const handleClearSteamAchievement = async (event, achievementName) => {
  if (!isSteam() && !hasClient(client)) {
    return;
  }
  return new Promise((resolve, reject) => {
    const result = client.achievement.clear(achievementName);
    resolve(result);
    reject('error', result);
  })
}
// end steam code

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createMainWindow = () => {
  // add listener for the quit/close button
  ipcMain.on('close-app', handleCloseApp);
  // add listener for the steam user
  ipcMain.handle('steam-log-user', handleSteamLogUser);
  ipcMain.handle('steam-fetch-steam-achievements', async (event, message) => {
    return await handleFetchSteamAchievement(event, message)
      .then((data) => data)
      .catch((error) => 'Error Loading Steam Achievements');
  });
  ipcMain.handle('steam-set-steam-achievements', handleSetSteamAchievement);
  ipcMain.handle('steam-clear-steam-achievements', async (event, message) => {
    return await handleClearSteamAchievement(event, message)
      .then((data) => data)
      .catch((error) => 'Error Clearing Steam Achievements');
  });
  // ipcMain.on('steam-activate-overlay', (event) => {
  //   console.log({overlay: client.overlay});
  //   client.overlay.activateDialog(6);
  // });

  ipcMain.on('window-app', handleWindowApp);
  ipcMain.on('fullscreen-app', handleFullscreenApp);

  // Create the browser window.
  const creatingMainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: true,
    fullscreen: true,
    webPreferences: {
      // eslint-disable-next-line no-undef
      preload: path.join(__dirname, 'preload.js'),
      // set this to false to prevent players from using dev tools
      devTools: process.env.APP_ENV === 'test' || process.env.APP_ENV === 'dev' ? true : true,
    },
    icon: '/app-icons/icon.png',
  });

  // load the loading.html of the app
  // mainWindow.loadFile(path.join(__dirname, '../out-resources/loading.html'));

  // eslint-disable-next-line no-undef
  creatingMainWindow.loadFile(path.join(__dirname, '../out-resources/index.html'));
  if (process.env.APP_ENV === 'dev') {
    // Open the DevTools.
    creatingMainWindow.webContents.openDevTools();
  }

  return creatingMainWindow;
};

const handleCloseApp = (isClosed) => {
  if (isClosed) {
    app.quit();
  }
};

const handleWindowApp = (isWindowed) => {
  if (isWindowed && mainWindow) {
    mainWindow.setFullScreen(false);
    mainWindow.setBounds({width: 800, height: 600 })
    mainWindow.center();
    mainWindow.setAutoHideMenuBar(false);
    mainWindow.titleBarStyle = 'default';
    mainWindow.titleBarOverlay = true;
  }
};

const handleFullscreenApp = (isFullscreen) => {
  if (isFullscreen && mainWindow) {
    mainWindow.setFullScreen(true);
    mainWindow.setAutoHideMenuBar(true);
    mainWindow.titleBarStyle = 'hidden';
    mainWindow.titleBarOverlay = true;
  }
};

const secureSession = (session) => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        // style hash is auto generated by electron, use error message in app dev
        // screen to find newest hash when the inline style of index.html is updated
        'Content-Security-Policy': ['default-src \'self\';style-src \'sha256-v18N2MIJV3y0lVj7YzpzYtbQg0gu9Yzcow56Mp17tRo=\'']
      }
    })
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  mainWindow = createMainWindow();
  secureSession(session);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
    secureSession(session);
  }
});

// if (useSteam) steamworks.electronEnableSteamOverlay();
