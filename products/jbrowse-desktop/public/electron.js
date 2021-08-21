const electron = require('electron')
const debug = require('electron-debug')
const isDev = require('electron-is-dev')
const windowStateKeeper = require('electron-window-state')
const fs = require('fs')
const path = require('path')
const url = require('url')

const fsPromises = fs.promises

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
  if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
    fs.mkdirSync(sessionDirectory, { recursive: true })
  } else {
    throw error
  }
}

let mainWindow

async function createWindow() {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1400,
    defaultHeight: 800,
  })
  const { x, y, width, height } = mainWindowState
  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    webPreferences: {
      webSecurity: false,
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      contextIsolation: false,
    },
  })
  mainWindowState.manage(mainWindow)
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

ipcMain.handle('loadConfig', async () => {
  try {
    return JSON.parse(
      await fsPromises.readFile(configLocation, { encoding: 'utf8' }),
    )
  } catch (error) {
    if (error.code === 'ENOENT') {
      // make a config file since one does not exist yet
      const configTemplateLocation = isDev
        ? path.join(app.getAppPath(), 'public', 'test_data', 'config.json')
        : path.join(app.getAppPath(), 'build', 'test_data', 'config.json')
      const config = JSON.parse(
        await fsPromises.readFile(configTemplateLocation, { encoding: 'utf8' }),
      )

      await fsPromises.writeFile(
        configLocation,
        JSON.stringify(config, null, 2),
      )
      return config
    }
    throw error
  }
})

ipcMain.handle('saveConfig', async (event, configSnapshot) => {
  return fsPromises.writeFile(
    configLocation,
    JSON.stringify(configSnapshot, null, 2),
  )
})

ipcMain.handle('listSessions', async () => {
  try {
    const sessionFiles = await fsPromises.readdir(sessionDirectory)
    const sessionFilesData = []
    for (const sessionFile of sessionFiles) {
      if (path.extname(sessionFile) === '.thumbnail') {
        sessionFilesData.push(
          fsPromises.readFile(path.join(sessionDirectory, sessionFile), {
            encoding: 'utf8',
          }),
        )
      } else {
        sessionFilesData.push(
          fsPromises.stat(path.join(sessionDirectory, sessionFile)),
        )
      }
    }
    const data = await Promise.all(sessionFilesData)
    const sessions = {}
    sessionFiles.forEach((sessionFile, idx) => {
      const ext = path.extname(sessionFile)
      const basename = path.basename(sessionFile, ext)
      if (ext === '.thumbnail') {
        const sessionName = decodeURIComponent(basename)
        if (!sessions[sessionName]) {
          sessions[sessionName] = {}
        }
        sessions[sessionName].screenshot = data[idx]
      } else if (ext === '.json') {
        const sessionName = decodeURIComponent(basename)
        if (!sessions[sessionName]) {
          sessions[sessionName] = {}
        }
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
  return fsPromises.readFile(
    path.join(sessionDirectory, `${encodeURIComponent(sessionName)}.json`),
    { encoding: 'utf8' },
  )
})

ipcMain.on('saveSession', async (event, sessionSnapshot) => {
  const sessionScreenshot = (await mainWindow.capturePage()).toDataURL()
  fsPromises.writeFile(
    path.join(
      sessionDirectory,
      `${encodeURIComponent(sessionSnapshot.name)}.thumbnail`,
    ),
    sessionScreenshot,
  )
  fsPromises.writeFile(
    path.join(
      sessionDirectory,
      `${encodeURIComponent(sessionSnapshot.name)}.json`,
    ),
    JSON.stringify(sessionSnapshot, null, 2),
  )
})

ipcMain.handle('renameSession', async (event, oldName, newName) => {
  try {
    await fsPromises.rename(
      path.join(sessionDirectory, `${encodeURIComponent(oldName)}.thumbnail`),
      path.join(sessionDirectory, `${encodeURIComponent(newName)}.thumbnail`),
    )
  } catch {
    // ignore
  }
  const sessionJson = await fsPromises.readFile(
    path.join(sessionDirectory, `${encodeURIComponent(oldName)}.json`),
    { encoding: 'utf8' },
  )
  const sessionSnapshot = JSON.parse(sessionJson)
  sessionSnapshot.name = newName
  await fsPromises.unlink(
    path.join(sessionDirectory, `${encodeURIComponent(oldName)}.json`),
  )
  await fsPromises.writeFile(
    path.join(sessionDirectory, `${encodeURIComponent(newName)}.json`),
    JSON.stringify(sessionSnapshot, null, 2),
  )
})

ipcMain.handle('reset', async () => {
  const sessionFiles = await fsPromises.readdir(sessionDirectory)
  const unlinkCommands = [fsPromises.unlink(configLocation)]
  for (const sessionFile of sessionFiles) {
    unlinkCommands.push(
      fsPromises.unlink(path.join(sessionDirectory, sessionFile)),
    )
  }
  await Promise.all(unlinkCommands)
})

ipcMain.handle('deleteSession', async (event, sessionName) => {
  try {
    await fsPromises.unlink(
      path.join(
        sessionDirectory,
        `${encodeURIComponent(sessionName)}.thumbnail`,
      ),
    )
  } catch {
    // ignore
  }
  return fsPromises.unlink(
    path.join(sessionDirectory, `${encodeURIComponent(sessionName)}.json`),
  )
})
