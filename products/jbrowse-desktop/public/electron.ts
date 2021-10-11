import electron, { dialog } from 'electron'
import debug from 'electron-debug'
import isDev from 'electron-is-dev'
import fs from 'fs'
import path from 'path'
import url from 'url'
import windowStateKeeper from 'electron-window-state'
import { autoUpdater } from 'electron-updater'

const { unlink, readFile, writeFile } = fs.promises

const { app, ipcMain, shell, BrowserWindow, Menu } = electron

function stringify(obj: unknown) {
  return JSON.stringify(obj, null, 2)
}

// manual auto-updates https://github.com/electron-userland/electron-builder/blob/docs/encapsulated%20manual%20update%20via%20menu.js
autoUpdater.autoDownload = false

autoUpdater.on('error', error => {
  dialog.showErrorBox(
    'Error: ',
    error == null ? 'unknown' : (error.stack || error).toString(),
  )
})

autoUpdater.on('update-available', async () => {
  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'Found updates',
    message:
      'Found updates, do you want update now? Note: the update will download in the background, and a dialog will appear once complete',
    buttons: ['Yes', 'No'],
  })

  if (result.response === 0) {
    autoUpdater.downloadUpdate()
  }
})

debug({ showDevTools: false })

const devServerUrl = url.parse(
  process.env.DEV_SERVER_URL || 'http://localhost:3000',
)

const recentSessionsPath = path.join(
  app.getPath('userData'),
  'recent_sessions.json',
)

if (!fs.existsSync(recentSessionsPath)) {
  fs.writeFileSync(recentSessionsPath, stringify([]), 'utf8')
}

interface SessionSnap {
  defaultSession: {
    name: string
  }

  [key: string]: unknown
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

  // open url in a browser and prevent default
  // also has <base target="_blank"> in <head> to redirect links by default
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const isMac = process.platform === 'darwin'

  // @ts-ignore
  const mainMenu = Menu.buildFromTemplate([
    // { role: 'appMenu' }
    // @ts-ignore
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
    {
      label: 'File',
      // @ts-ignore
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        // @ts-ignore
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
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        // @ts-ignore
        { role: 'toggledevtools' },
        { type: 'separator' },
        // @ts-ignore
        { role: 'zoomin' },
        // @ts-ignore
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        // @ts-ignore
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
      label: 'Help',
      role: 'help',
      // @ts-ignore
      submenu: [
        {
          label: 'Learn More',
          click: () => electron.shell.openExternal('https://jbrowse.org'),
        },
        {
          label: 'Check for updates...',
          click: () => autoUpdater.checkForUpdates(),
        },
      ],
    },
  ])

  if (isMac) {
    Menu.setApplicationMenu(mainMenu)
  } else {
    Menu.setApplicationMenu(null)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.once('ready-to-show', () => {
    autoUpdater.checkForUpdatesAndNotify()
  })
}

function sendStatusToWindow(text: string) {
  console.error(text)
  if (mainWindow) {
    mainWindow.webContents.send('message', text)
  }
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

ipcMain.handle('listSessions', async () => {
  return JSON.parse(await readFile(recentSessionsPath, 'utf8'))
})

ipcMain.handle('loadExternalConfig', (_event: unknown, sessionPath) => {
  return readFile(sessionPath, 'utf8')
})

ipcMain.handle('loadSession', async (_event: unknown, sessionPath: string) => {
  return JSON.parse(await readFile(sessionPath, 'utf8'))
})

ipcMain.handle(
  'openAuthWindow',
  (_event: unknown, { internetAccountId, data, url }) => {
    const win = new BrowserWindow({
      width: 1000,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    })
    win.title = `JBrowseAuthWindow-${internetAccountId}`
    win.loadURL(url)

    return new Promise(resolve => {
      win.webContents.on(
        'will-redirect',
        function (event: Event, redirectUrl: string) {
          if (redirectUrl.startsWith(data.redirect_uri)) {
            event.preventDefault()
            resolve(redirectUrl)
            win.close()
          }
        },
      )
    })
  },
)
ipcMain.handle(
  'saveSession',
  async (_event: unknown, path: string, snap: SessionSnap) => {
    const page = await mainWindow?.capturePage()
    const rows = JSON.parse(fs.readFileSync(recentSessionsPath, 'utf8')) as [
      { path: string; updated: number },
    ]
    const idx = rows.findIndex(r => r.path === path)
    const screenshot = page?.resize({ width: 250 }).toDataURL()
    const entry = {
      path,
      screenshot,
      updated: +Date.now(),
      name: snap.defaultSession?.name,
    }
    if (idx === -1) {
      rows.unshift(entry)
    } else {
      rows[idx] = entry
    }
    await Promise.all([
      writeFile(recentSessionsPath, stringify(rows)),
      writeFile(path, stringify(snap)),
    ])
  },
)

ipcMain.handle('promptSessionSaveAs', async (_event: unknown) => {
  const toLocalPath = path.join(app.getPath('desktop'), `jbrowse_session.json`)
  const choice = await dialog.showSaveDialog({
    defaultPath: toLocalPath,
  })

  return choice.filePath
})

ipcMain.handle(
  'deleteSession',
  async (_event: unknown, sessionPath: string) => {
    return unlink(sessionPath)
  },
)

/// from https://github.com/iffy/electron-updater-example/blob/master/main.js
//
autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Checking for update...')
})

autoUpdater.on('error', err => {
  sendStatusToWindow('Error in auto-updater. ' + err)
})

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update completed',
    message:
      'Update downloaded, the update will take place when you restart the app',
    buttons: ['OK'],
  })
})

ipcMain.handle(
  'renameSession',
  async (_event: unknown, path: string, newName: string) => {
    const sessions = JSON.parse(await readFile(recentSessionsPath, 'utf8')) as {
      path: string
      name: string
    }[]
    const session = JSON.parse(await readFile(path, 'utf8'))
    const idx = sessions.findIndex(row => row.path === path)
    if (idx !== -1) {
      sessions[idx].name = newName
      session.defaultSession.name = newName
    } else {
      throw new Error(`Session at ${path} not found`)
    }

    await Promise.all([
      writeFile(recentSessionsPath, stringify(sessions)),
      writeFile(path, stringify(session)),
    ])
  },
)
