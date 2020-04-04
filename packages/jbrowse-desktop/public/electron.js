// eslint-disable-next-line import/no-extraneous-dependencies
const electron = require('electron')
const debug = require('electron-debug')
const isDev = require('electron-is-dev')
const fs = require('fs')
const fetch = require('node-fetch')
const path = require('path')
const url = require('url')
const { promisify } = require('util')

const fsFStat = promisify(fs.fstat)
const fsOpen = promisify(fs.open)
const fsRead = promisify(fs.read)
const fsReaddir = promisify(fs.readdir)
const fsReadFile = promisify(fs.readFile)
const fsRename = promisify(fs.rename)
const fsStat = promisify(fs.stat)
const fsUnlink = promisify(fs.unlink)
const fsWriteFile = promisify(fs.writeFile)

const { app, ipcMain, shell, BrowserWindow, Menu } = electron

debug({ showDevTools: false })

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
  mainWindow.webContents.on('new-window', (event, outboundUrl) => {
    event.preventDefault()
    shell.openExternal(outboundUrl)
  })

  const isMac = process.platform === 'darwin'

  const template = [
    // { role: 'appMenu' }
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideothers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [{ role: 'startspeaking' }, { role: 'stopspeaking' }],
              },
            ]
          : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]),
      ],
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' },
            ]
          : [{ role: 'close' }]),
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await electron.shell.openExternal('https://jbrowse.org')
          },
        },
      ],
    },
  ]
  const mainMenu = Menu.buildFromTemplate(template)

  if (isMac) {
    Menu.setApplicationMenu(mainMenu)
  } else {
    Menu.setApplicationMenu(null)
  }
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
      webSecurity: false,
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

ipcMain.handle('getMainWindowId', async () => mainWindow.id)

// // merge function to get stuff from a development config into a production one
// // limited functionality, difficult to use existing merge-deep/mixin-deep type
// // things for this
// function mergeConfigs(A, B) {
//   const merged = merge(A, B)
//   if (B.defaultSession) merged.defaultSession = B.defaultSession
//   else if (A.defaultSession) merged.defaultSession = A.defaultSession
//   return merged
// }

ipcMain.handle('loadConfig', async () => {
  try {
    return JSON.parse(await fsReadFile(configLocation, { encoding: 'utf8' }))
  } catch (error) {
    if (error.code === 'ENOENT') {
      // make a config file since one does not exist yet
      const configTemplateLocation = isDev
        ? path.join(app.getAppPath(), 'public', 'test_data', 'config.json')
        : path.join(app.getAppPath(), 'build', 'test_data', 'config.json')
      const config = JSON.parse(
        await fsReadFile(configTemplateLocation, { encoding: 'utf8' }),
      )

      await fsWriteFile(configLocation, JSON.stringify(config, null, 2))
      return config
    }
    throw error
  }
})

ipcMain.on('saveConfig', async (event, configSnapshot) => {
  fsWriteFile(configLocation, JSON.stringify(configSnapshot, null, 2))
})

ipcMain.handle('listSessions', async () => {
  try {
    const sessionFiles = await fsReaddir(sessionDirectory)
    const sessionFilesData = []
    for (const sessionFile of sessionFiles) {
      if (path.extname(sessionFile) === '.thumbnail')
        sessionFilesData.push(
          fsReadFile(path.join(sessionDirectory, sessionFile), {
            encoding: 'utf8',
          }),
        )
      else
        sessionFilesData.push(fsStat(path.join(sessionDirectory, sessionFile)))
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
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return []
    }
    throw error
  }
})

ipcMain.handle('loadSession', async (event, sessionName) => {
  return fsReadFile(
    path.join(sessionDirectory, `${encodeURIComponent(sessionName)}.json`),
    { encoding: 'utf8' },
  )
})

ipcMain.on('saveSession', async (event, sessionSnapshot, sessionScreenshot) => {
  fsWriteFile(
    path.join(
      sessionDirectory,
      `${encodeURIComponent(sessionSnapshot.name)}.thumbnail`,
    ),
    sessionScreenshot,
  )
  fsWriteFile(
    path.join(
      sessionDirectory,
      `${encodeURIComponent(sessionSnapshot.name)}.json`,
    ),
    JSON.stringify(sessionSnapshot, null, 2),
  )
})

ipcMain.handle('renameSession', async (event, oldName, newName) => {
  try {
    await fsRename(
      path.join(sessionDirectory, `${encodeURIComponent(oldName)}.thumbnail`),
      path.join(sessionDirectory, `${encodeURIComponent(newName)}.thumbnail`),
    )
  } catch {
    // ignore
  }
  const sessionJson = await fsReadFile(
    path.join(sessionDirectory, `${encodeURIComponent(oldName)}.json`),
    { encoding: 'utf8' },
  )
  const sessionSnapshot = JSON.parse(sessionJson)
  sessionSnapshot.name = newName
  await fsUnlink(
    path.join(sessionDirectory, `${encodeURIComponent(oldName)}.json`),
  )
  await fsWriteFile(
    path.join(sessionDirectory, `${encodeURIComponent(newName)}.json`),
    JSON.stringify(sessionSnapshot, null, 2),
  )
})

ipcMain.handle('reset', async () => {
  const sessionFiles = await fsReaddir(sessionDirectory)
  const unlinkCommands = [fsUnlink(configLocation)]
  for (const sessionFile of sessionFiles) {
    unlinkCommands.push(fsUnlink(path.join(sessionDirectory, sessionFile)))
  }
  await Promise.all(unlinkCommands)
})

ipcMain.handle('deleteSession', async (event, sessionName) => {
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

ipcMain.handle('fetch', async (event, ...args) => {
  const response = await fetch(...args)
  const serializableResponse = {}
  serializableResponse.headers = Array.from(response.headers)
  serializableResponse.url = response.url
  serializableResponse.status = response.status
  serializableResponse.statusText = response.statusText
  serializableResponse.buffer = await response.buffer()
  return serializableResponse
})

ipcMain.handle('read', async (event, ...args) => {
  return fsRead(...args)
})

ipcMain.handle('readFile', async (event, ...args) => {
  args[0] = path.resolve(app.getAppPath(), isDev ? 'public' : 'build', args[0])
  return fsReadFile(...args)
})

ipcMain.handle('stat', async (event, ...args) => {
  return fsFStat(...args)
})

ipcMain.handle('open', async (event, ...args) => {
  args[0] = path.resolve(app.getAppPath(), isDev ? 'public' : 'build', args[0])
  return fsOpen(...args)
})
