// eslint-disable-next-line import/no-extraneous-dependencies
const electron = require('electron')
const { ipcMain } = require('electron-better-ipc-extra')
const fs = require('fs')
const { promisify } = require('util')
const fetch = require('node-fetch')

const fsCopyFile = promisify(fs.copyFile)
const fsFStat = promisify(fs.fstat)
const fsOpen = promisify(fs.open)
const fsRead = promisify(fs.read)
const fsReaddir = promisify(fs.readdir)
const fsReadFile = promisify(fs.readFile)
const fsStat = promisify(fs.stat)
const fsUnlink = promisify(fs.unlink)
const fsWriteFile = promisify(fs.writeFile)

const { app } = electron
const { BrowserWindow } = electron

const path = require('path')
const isDev = require('electron-is-dev')

const configLocation = path.join(app.getPath('userData'), 'config.json')
const sessionDirectory = path.join(app.getPath('userData'), 'sessions')
try {
  fs.statSync(sessionDirectory)
} catch (error) {
  if (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    fs.mkdirSync(sessionDirectory)
  else throw error
}

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
    // mainWindow.webContents.openDevTools()
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

ipcMain.answerRenderer('loadConfig', async () => {
  let configJSON
  try {
    configJSON = await fsReadFile(configLocation, { encoding: 'utf8' })
  } catch (error) {
    if (error.code === 'ENOENT') {
      // make a config file since one does not exist yet
      configJSON = '{}'
      await fsWriteFile(configLocation, configJSON)
    } else throw error
  }
  return JSON.parse(configJSON)
})

ipcMain.answerRenderer('saveConfig', async configSnapshot => {
  return fsWriteFile(configLocation, JSON.stringify(configSnapshot))
})

ipcMain.answerRenderer('listSessions', async () => {
  const sessionFiles = await fsReaddir(sessionDirectory)
  const sessionFilesData = []
  for (const sessionFile of sessionFiles) {
    if (sessionFile.endsWith('.thumbnail'))
      sessionFilesData.push(
        fsReadFile(path.join(sessionDirectory, sessionFile), {
          encoding: 'utf8',
        }),
      )
    else sessionFilesData.push(fsStat(path.join(sessionDirectory, sessionFile)))
  }
  const data = await Promise.all(sessionFilesData)
  const sessions = {}
  sessionFiles.forEach((sessionFile, idx) => {
    if (sessionFile.endsWith('.thumbnail')) {
      const sessionName = sessionFile.slice(0, -10)
      if (!sessions[sessionName]) sessions[sessionName] = {}
      sessions[sessionName].screenshot = data[idx]
    } else if (sessionFile.endsWith('.json')) {
      const sessionName = sessionFile.slice(0, -5)
      if (!sessions[sessionName]) sessions[sessionName] = {}
      sessions[sessionName].stats = data[idx]
    }
  })
  return sessions
})

ipcMain.answerRenderer('loadSession', async sessionName => {
  return fsReadFile(path.join(sessionDirectory, `${sessionName}.json`), {
    encoding: 'utf8',
  })
})

ipcMain.answerRenderer(
  'saveSession',
  async (sessionSnapshot, sessionScreenshot) => {
    await fsWriteFile(
      path.join(sessionDirectory, `${sessionSnapshot.name}.thumbnail`),
      sessionScreenshot,
    )
    return fsWriteFile(
      path.join(sessionDirectory, `${sessionSnapshot.name}.json`),
      JSON.stringify(sessionSnapshot),
    )
  },
)

ipcMain.answerRenderer('renameSession', async (oldName, newName) => {
  try {
    await fsCopyFile(
      path.join(sessionDirectory, `${oldName}.thumbnail`),
      path.join(sessionDirectory, `${newName}.thumbnail`),
    )
    await fsUnlink(path.join(sessionDirectory, `${oldName}.thumbnail`))
  } catch {
    // ignore
  }
  await fsCopyFile(
    path.join(sessionDirectory, `${oldName}.json`),
    path.join(sessionDirectory, `${newName}.json`),
  )
  await fsUnlink(path.join(sessionDirectory, `${oldName}.json`))
})

ipcMain.answerRenderer('deleteSession', async sessionName => {
  try {
    await fsUnlink(path.join(sessionDirectory, `${sessionName}.thumbnail`))
  } catch {
    // ignore
  }
  return fsUnlink(path.join(sessionDirectory, `${sessionName}.json`))
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
