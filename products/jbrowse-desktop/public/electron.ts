import electron from 'electron'
import debug from 'electron-debug'
import isDev from 'electron-is-dev'
import windowStateKeeper from 'electron-window-state'
import fs from 'fs'
import path from 'path'
import url from 'url'

const { unlink, rename, readdir, readFile, writeFile, stat } = fs.promises

const { app, ipcMain, shell, BrowserWindow, Menu } = electron

debug({ showDevTools: false })

const devServerUrl = url.parse(
  process.env.DEV_SERVER_URL || 'http://localhost:3000',
)

const configLocation = path.join(app.getPath('userData'), 'config.json')
const sessionDir = path.join(app.getPath('userData'), 'sessions')
try {
  fs.statSync(sessionDir)
} catch (error) {
  if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
    fs.mkdirSync(sessionDir, { recursive: true })
  } else {
    throw error
  }
}

let mainWindow: electron.BrowserWindow | null

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

  const mainMenu = Menu.buildFromTemplate([
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
  ] as any)

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
    return JSON.parse(await readFile(configLocation, { encoding: 'utf8' }))
  } catch (error) {
    if (error.code === 'ENOENT') {
      // make a config file since one does not exist yet
      const part = isDev ? 'public' : 'build'
      const config = JSON.parse(
        await readFile(
          path.join(app.getAppPath(), part, 'test_data', 'config.json'),
          'utf8',
        ),
      )

      await writeFile(configLocation, JSON.stringify(config, null, 2))
      return config
    }
    throw error
  }
})

ipcMain.handle('saveConfig', async (_event: any, configSnapshot: any) => {
  return writeFile(configLocation, JSON.stringify(configSnapshot, null, 2))
})

ipcMain.handle('listSessions', async () => {
  try {
    const sessionFiles = await readdir(sessionDir)
    const sessionFilesData = [] as any
    for (const sessionFile of sessionFiles) {
      if (path.extname(sessionFile) === '.thumbnail') {
        sessionFilesData.push(
          readFile(path.join(sessionDir, sessionFile), 'utf8'),
        )
      } else {
        sessionFilesData.push(stat(path.join(sessionDir, sessionFile)))
      }
    }
    const data = await Promise.all(sessionFilesData)
    const sessions = {} as { [key: string]: any }
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

ipcMain.handle('loadSession', async (_event: any, sessionName: string) => {
  return readFile(
    path.join(sessionDir, `${encodeURIComponent(sessionName)}.json`),
    { encoding: 'utf8' },
  )
})

interface SessionSnap {
  name: string
  [key: string]: any
}

ipcMain.on('saveSession', async (_event: any, sessionSnapshot: SessionSnap) => {
  const page = await mainWindow?.capturePage()
  if (page) {
    const sessionScreenshot = page.toDataURL()
    writeFile(
      path.join(
        sessionDir,
        `${encodeURIComponent(sessionSnapshot.name)}.thumbnail`,
      ),
      sessionScreenshot,
    )
    writeFile(
      path.join(sessionDir, `${encodeURIComponent(sessionSnapshot.name)}.json`),
      JSON.stringify(sessionSnapshot, null, 2),
    )
  }
})

ipcMain.handle(
  'renameSession',
  async (_event: any, oldName: string, newName: string) => {
    try {
      await rename(
        path.join(sessionDir, `${encodeURIComponent(oldName)}.thumbnail`),
        path.join(sessionDir, `${encodeURIComponent(newName)}.thumbnail`),
      )
    } catch {
      // ignore
    }
    const sessionJson = await readFile(
      path.join(sessionDir, `${encodeURIComponent(oldName)}.json`),
      'utf8',
    )
    const sessionSnapshot = JSON.parse(sessionJson)
    sessionSnapshot.name = newName
    await unlink(path.join(sessionDir, `${encodeURIComponent(oldName)}.json`))
    await writeFile(
      path.join(sessionDir, `${encodeURIComponent(newName)}.json`),
      JSON.stringify(sessionSnapshot, null, 2),
    )
  },
)

ipcMain.handle('reset', async () => {
  const sessionFiles = await readdir(sessionDir)
  await unlink(configLocation)
  return Promise.all(
    sessionFiles.map(sessionFile => unlink(path.join(sessionDir, sessionFile))),
  )
})

ipcMain.handle('deleteSession', async (_event: any, sessionName: string) => {
  try {
    await unlink(
      path.join(sessionDir, `${encodeURIComponent(sessionName)}.thumbnail`),
    )
  } catch (e) {
    console.log('received delete session warning', e)
    // ignore
  }
  return unlink(
    path.join(sessionDir, `${encodeURIComponent(sessionName)}.json`),
  )
})
