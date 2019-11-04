// eslint-disable-next-line import/no-extraneous-dependencies
const electron = require('electron')
const { ipcMain } = require('electron-better-ipc-extra')
const debug = require('electron-debug')
const isDev = require('electron-is-dev')
const fs = require('fs')
const fetch = require('node-fetch')
const path = require('path')
const url = require('url')
const { promisify } = require('util')

const fsCopyFile = promisify(fs.copyFile)
const fsFStat = promisify(fs.fstat)
const fsOpen = promisify(fs.open)
const fsRead = promisify(fs.read)
const fsReaddir = promisify(fs.readdir)
const fsReadFile = promisify(fs.readFile)
const fsRename = promisify(fs.rename)
const fsStat = promisify(fs.stat)
const fsUnlink = promisify(fs.unlink)
const fsWriteFile = promisify(fs.writeFile)

const { app, BrowserWindow, Menu } = electron

debug()

const devServerUrl = url.parse(
  process.env.DEV_SERVER_URL || 'http://localhost:3000',
)

const configLocation = path.join(app.getPath('userData'), 'config.json')
const sessionDirectory = path.join(app.getPath('userData'), 'sessions')
try {
  fs.statSync(sessionDirectory)
} catch (error) {
  if (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    fs.mkdirSync(sessionDirectory, { recursive: true })
  else throw error
}

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    webPreferences: {
      preload: isDev
        ? path.join(app.getAppPath(), 'public', 'preload.js')
        : `${path.join(app.getAppPath(), 'build', 'preload.js')}`,
    },
  })
  mainWindow.loadURL(
    isDev
      ? url.format(devServerUrl)
      : `file://${path.join(app.getAppPath(), 'build', 'index.html')}`,
  )
  Menu.setApplicationMenu(null)
  // if (isDev) {
  // Open the DevTools.
  // BrowserWindow.addDevToolsExtension('<location to your react chrome extension>');
  // mainWindow.webContents.openDevTools()
  // }
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
        ? path.join(app.getAppPath(), 'public', 'preload.js')
        : `${path.join(app.getAppPath(), 'build', 'preload.js')}`,
    },
  })
  workerWindow.loadURL(
    isDev
      ? url.format({ ...devServerUrl, pathname: 'worker.html' })
      : `file://${path.join(app.getAppPath(), 'build', 'worker.html')}`,
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
      const configTemplateLocation = isDev
        ? path.join(app.getAppPath(), 'public', 'test_data', 'config.json')
        : `${path.join(app.getAppPath(), 'build', 'test_data', 'config.json')}`
      await fsCopyFile(configTemplateLocation, configLocation)
      configJSON = await fsReadFile(configLocation, { encoding: 'utf8' })
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
    if (path.extname(sessionFile) === '.thumbnail')
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
    if (path.extname(sessionFile) === '.thumbnail') {
      const sessionName = decodeURIComponent(
        path.basename(sessionFile, '.thumbnail'),
      )
      if (!sessions[sessionName]) sessions[sessionName] = {}
      sessions[sessionName].screenshot = data[idx]
    } else if (path.extname(sessionFile) === '.json') {
      const sessionName = decodeURIComponent(
        path.basename(sessionFile, '.json'),
      )
      if (!sessions[sessionName]) sessions[sessionName] = {}
      sessions[sessionName].stats = data[idx]
    }
  })
  return sessions
})

ipcMain.answerRenderer('loadSession', async sessionName => {
  return fsReadFile(
    path.join(sessionDirectory, `${encodeURIComponent(sessionName)}.json`),
    { encoding: 'utf8' },
  )
})

ipcMain.answerRenderer(
  'saveSession',
  async (sessionSnapshot, sessionScreenshot) => {
    await fsWriteFile(
      path.join(
        sessionDirectory,
        `${encodeURIComponent(sessionSnapshot.name)}.thumbnail`,
      ),
      sessionScreenshot,
    )
    return fsWriteFile(
      path.join(
        sessionDirectory,
        `${encodeURIComponent(sessionSnapshot.name)}.json`,
      ),
      JSON.stringify(sessionSnapshot),
    )
  },
)

ipcMain.answerRenderer('renameSession', async (oldName, newName) => {
  try {
    await fsRename(
      path.join(sessionDirectory, `${encodeURIComponent(oldName)}.thumbnail`),
      path.join(sessionDirectory, `${encodeURIComponent(newName)}.thumbnail`),
    )
  } catch {
    // ignore
  }
  await fsRename(
    path.join(sessionDirectory, `${encodeURIComponent(oldName)}.json`),
    path.join(sessionDirectory, `${encodeURIComponent(newName)}.json`),
  )
})

ipcMain.answerRenderer('reset', async () => {
  const configTemplateLocation = isDev
    ? path.join(app.getAppPath(), 'public', 'test_data', 'config.json')
    : `${path.join(app.getAppPath(), 'build', 'test_data', 'config.json')}`
  await fsCopyFile(configTemplateLocation, configLocation)
  const sessionFiles = await fsReaddir(sessionDirectory)
  const unlinkCommands = []
  for (const sessionFile of sessionFiles) {
    unlinkCommands.push(fsUnlink(path.join(sessionDirectory, sessionFile)))
  }
  await Promise.all(unlinkCommands)
})

ipcMain.answerRenderer('deleteSession', async sessionName => {
  try {
    await fsUnlink(
      path.join(
        sessionDirectory,
        `${encodeURIComponent(sessionName)}.thumbnail`,
      ),
    )
  } catch {
    // ignore
  }
  return fsUnlink(
    path.join(sessionDirectory, `${encodeURIComponent(sessionName)}.json`),
  )
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
  args[0] = path.resolve(app.getAppPath(), isDev ? 'public' : 'build', args[0])
  return fsReadFile(...args)
})

ipcMain.answerRenderer('stat', async (...args) => {
  return fsFStat(...args)
})

ipcMain.answerRenderer('open', async (...args) => {
  args[0] = path.resolve(app.getAppPath(), isDev ? 'public' : 'build', args[0])
  return fsOpen(...args)
})
