// eslint-disable-next-line import/no-extraneous-dependencies
const electron = require('electron')
const { ipcMain } = require('electron-better-ipc-extra')
const fs = require('fs')
const { promisify } = require('util')
const fetch = require('node-fetch')

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
    BrowserWindow.getAllWindows().forEach(win => win.close())
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

ipcMain.on('createWindowWorker', event => {
  const workerWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: isDev
        ? path.join(app.getAppPath(), 'public/preload.js')
        : `file://${path.join(app.getAppPath(), 'public/../build/preload.js')}`,
    },
  })
  workerWindow.loadURL(
    isDev
      ? 'http://localhost:3000/worker.html'
      : `file://${path.join(app.getAppPath(), 'public/../build/worker.html')}`,
  )
  // workerWindow.webContents.openDevTools()
  event.returnValue = workerWindow.id
})

ipcMain.answerRenderer('fetch', async (...args) => {
  const response = await fetch(...args)
  const serializableResponse = {}
  serializableResponse.headers = Array.from(response.headers)
  serializableResponse.url = response.url
  serializableResponse.status = response.status
  serializableResponse.statusText = response.statusText
  serializableResponse.buffer = await response.buffer()
  return serializableResponse
})

ipcMain.answerRenderer('read', async (...args) => {
  return fsRead(...args)
})

ipcMain.answerRenderer('readFile', async (...args) => {
  return fsReadFile(...args)
})

ipcMain.answerRenderer('stat', async (...args) => {
  return fsFStat(...args)
})

ipcMain.answerRenderer('open', async (...args) => {
  return fsOpen(...args)
})
