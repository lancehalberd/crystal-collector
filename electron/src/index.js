const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createMainWindow = () => {
  // add listener for the quit/close button
  ipcMain.on('close-app', handleCloseApp);

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: '/app-icons/icon.png',
  });
  mainWindow.hide();
  mainWindow.show();

  // load the loading.html of the app
  mainWindow.loadFile(path.join(__dirname, '../out-resources/loading.html'));

  // load the index.html of the app.
  // setTimeout(() => {
    mainWindow.loadFile(path.join(__dirname, '../out-resources/index.html'));
  // }, 10);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

const handleCloseApp = (isClosed) => {
  if (isClosed) {
    app.quit();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createMainWindow();
});

// This method displays a loading screen, then shows the main screen
// after it has finished loading. Use this if loading the main game is too slow.
// https://interactiveknowledge.com/insights/create-electron-app-loading-screen
// const createMainWindow = () => new BrowserWindow();
// app.on('ready', () => {
//   const window = createMainWindow();
//   window.loadFile('loading.html');
//   setTimeout(() => window.loadFile('index.html'), 3000);
// })

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
    createMainWindow();
  }
});
