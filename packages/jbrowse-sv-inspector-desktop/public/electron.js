// eslint-disable-next-line import/no-extraneous-dependencies
const electron = require('electron')
const { ipcMain } = require('electron-better-ipc')
const fs = require('fs')
const { promisify } = require('util')

const fsOpen = promisify(fs.open)
const fsRead = promisify(fs.read)
const fsFStat = promisify(fs.fstat)
const fsReadFile = promisify(fs.readFile)

const { app } = electron
const { BrowserWindow } = electron

const path = require('path')
const isDev = require('electron-is-dev')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    webPreferences: {
      preload: isDev
        ? path.join(app.getAppPath(), 'public/preload.js')
        : `file://${path.join(app.getAppPath(), 'public/../build/preload.js')}`,
    },
  })
  mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(app.getAppPath(), 'public/../build/index.html')}`,
  )
  if (isDev) {
    // Open the DevTools.
    // BrowserWindow.addDevToolsExtension('<location to your react chrome extension>');
    mainWindow.webContents.openDevTools()
  }
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

ipcMain.answerRenderer('read', async args => {
  return fsRead(...args)
})

ipcMain.answerRenderer('readFile', async args => {
  return fsReadFile(...args)
})

ipcMain.answerRenderer('stat', async args => {
  return fsFStat(...args)
})

ipcMain.answerRenderer('open', async args => {
  return fsOpen(...args)
})
