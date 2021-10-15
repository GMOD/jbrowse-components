import electron, { dialog } from 'electron'
import debug from 'electron-debug'
import isDev from 'electron-is-dev'
import fs from 'fs'
import path from 'path'
import url from 'url'
import windowStateKeeper from 'electron-window-state'
import { autoUpdater } from 'electron-updater'
import fetch from 'node-fetch'

const { unlink, readFile, copyFile, readdir, rename, writeFile } = fs.promises

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

const userData = app.getPath('userData')
const recentSessionsPath = path.join(userData, 'recent_sessions.json')
const quickstartDir = path.join(userData, 'quickstart')
const thumbnailDir = path.join(userData, 'thumbnails')
const unsavedPath = path.join(userData, 'unsaved.jbrowse')
const jbrowseDocDir = path.join(app.getPath('documents'), 'JBrowse')
const defaultSavePath = path.join(jbrowseDocDir, 'untitled.jbrowse')

const fileFilters = [
  { name: 'JBrowse Session', extensions: ['jbrowse'] },
  { name: 'All Files', extensions: ['*'] },
]

function getQuickstartPath(sessionName: string, ext = 'json') {
  return path.join(quickstartDir, `${encodeURIComponent(sessionName)}.${ext}`)
}

function getThumbnailPath(name: string) {
  return path.join(thumbnailDir, `${encodeURIComponent(name)}.data`)
}

if (!fs.existsSync(recentSessionsPath)) {
  fs.writeFileSync(recentSessionsPath, stringify([]), 'utf8')
}

if (!fs.existsSync(quickstartDir)) {
  fs.mkdirSync(quickstartDir, { recursive: true })
}

if (!fs.existsSync(thumbnailDir)) {
  fs.mkdirSync(thumbnailDir, { recursive: true })
}

if (!fs.existsSync(jbrowseDocDir)) {
  fs.mkdirSync(jbrowseDocDir, { recursive: true })
}

interface SessionSnap {
  defaultSession: {
    name: string
  }

  [key: string]: unknown
}

let mainWindow: electron.BrowserWindow | null

async function promptSave() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const choice = await dialog.showMessageBox(mainWindow!, {
    message: 'Would you like to save this session?',
    detail: "Your changes will be lost if you don't save them",
    type: 'warning',
    buttons: ["Don't save", 'Cancel', 'Save as…'],
    defaultId: 2,
    cancelId: 1,
  })
  if (choice.response === 0) {
    await unlink(unsavedPath)
    return true
  }
  if (choice.response === 2) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const savePath = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: path.join(defaultSavePath),
      filters: fileFilters,
    })
    if (savePath.filePath) {
      const page = await mainWindow?.capturePage()
      const rows = JSON.parse(await readFile(recentSessionsPath, 'utf8')) as [
        { path: string; updated: number },
      ]
      const png = page?.resize({ width: 500 }).toDataURL()
      const snap = JSON.parse(await readFile(unsavedPath, 'utf-8'))
      const entry = {
        path: savePath.filePath,
        updated: +Date.now(),
        name: snap.defaultSession?.name,
      }
      rows.unshift(entry)
      await Promise.all([
        ...(png ? [writeFile(getThumbnailPath(savePath.filePath), png)] : []),
        writeFile(recentSessionsPath, stringify(rows)),
        rename(unsavedPath, savePath.filePath),
      ])
      return true
    }
  }
  return false
}

async function createWindow() {
  const response = await fetch('https://jbrowse.org/genomes/sessions.json')
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`)
  }
  const data = await response.json()
  Object.entries(data).forEach(([key, value]) => {
    // if there is not a 'gravestone' (.deleted file), then repopulate it on
    // startup, this allows the user to delete even defaults if they want to
    if (!fs.existsSync(getQuickstartPath(key) + '.deleted')) {
      fs.writeFileSync(
        getQuickstartPath(key),
        JSON.stringify(value, null, 2),
        'utf8',
      )
    }
  })

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

  mainWindow.on('close', async event => {
    const hasUnsaved = fs.existsSync(unsavedPath)
    if (!hasUnsaved) {
      return
    }
    event.preventDefault()
    const continueClose = await promptSave()
    if (continueClose) {
      mainWindow?.close()
    }
  })

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

ipcMain.handle('quit', () => {
  app.quit()
})

ipcMain.handle('listSessions', async (_event: unknown) => {
  const sessions = JSON.parse(await readFile(recentSessionsPath, 'utf8')) as {
    path: string
  }[]

  return sessions
})

ipcMain.handle('loadExternalConfig', (_event: unknown, sessionPath) => {
  return readFile(sessionPath, 'utf8')
})

ipcMain.handle('loadSession', async (_event: unknown, sessionPath: string) => {
  return JSON.parse(await readFile(sessionPath, 'utf8'))
})

ipcMain.handle(
  'addToQuickstartList',
  async (_event: unknown, sessionPath: string, sessionName: string) => {
    await copyFile(sessionPath, getQuickstartPath(sessionName))
  },
)

ipcMain.handle('listQuickstarts', async (_event: unknown) => {
  return (await readdir(quickstartDir))
    .filter(f => path.extname(f) === '.json')
    .map(f => decodeURIComponent(path.basename(f, '.json')))
})

ipcMain.handle('deleteQuickstart', async (_event: unknown, name: string) => {
  fs.unlinkSync(getQuickstartPath(name))

  // add a gravestone '.deleted' file when we delete a session, so that if it
  // comes from the https://jbrowse.org/genomes/sessions.json, we don't
  // recreate it
  fs.writeFileSync(getQuickstartPath(name) + '.deleted', '', 'utf8')
})

ipcMain.handle(
  'renameQuickstart',
  async (_event: unknown, oldName: string, newName: string) => {
    return fs.renameSync(getQuickstartPath(oldName), getQuickstartPath(newName))
  },
)

ipcMain.handle('getQuickstart', async (_event: unknown, name: string) => {
  return JSON.parse(await readFile(getQuickstartPath(name), 'utf8'))
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
      win.webContents.on('will-redirect', (event, redirectUrl) => {
        if (redirectUrl.startsWith(data.redirect_uri)) {
          event.preventDefault()
          resolve(redirectUrl)
          win.close()
        }
      })
    })
  },
)

// creates an "unsaved" file
ipcMain.handle(
  'createUnsavedFile',
  async (_event: unknown, snap: SessionSnap) => {
    await writeFile(unsavedPath, stringify(snap))

    return unsavedPath
  },
)

// snapshots page and saves to path
ipcMain.handle(
  'saveSession',
  async (_event: unknown, path: string, snap: SessionSnap) => {
    const isUnsaved = path === unsavedPath
    if (isUnsaved) {
      await writeFile(path, stringify(snap))
      return
    }
    try {
      await unlink(unsavedPath)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (!('code' in error)) {
        throw error
      }
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
    const page = await mainWindow?.capturePage()
    const rows = JSON.parse(await readFile(recentSessionsPath, 'utf8')) as [
      { path: string; updated: number },
    ]
    const idx = rows.findIndex(r => r.path === path)
    const png = page?.resize({ width: 500 }).toDataURL()
    const entry = {
      path,
      updated: +Date.now(),
      name: snap.defaultSession?.name,
    }
    if (idx === -1) {
      rows.unshift(entry)
    } else {
      rows[idx] = entry
    }
    await Promise.all([
      ...(png ? [writeFile(getThumbnailPath(path), png)] : []),
      writeFile(recentSessionsPath, stringify(rows)),
      writeFile(path, stringify(snap)),
    ])
  },
)

ipcMain.handle('loadThumbnail', (_event: unknown, name: string) => {
  const path = getThumbnailPath(name)
  if (fs.existsSync(path)) {
    return readFile(path, 'utf8')
  }
  return undefined
})

ipcMain.handle('promptOpenFile', async (_event: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const choice = await dialog.showOpenDialog(mainWindow!, {
    defaultPath: jbrowseDocDir,
    filters: fileFilters,
  })

  return choice.filePaths[0]
})

ipcMain.handle('promptSaveBeforeQuit', async (_event: unknown) => {
  return promptSave()
})

ipcMain.handle('promptSessionSaveAs', async (_event: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const choice = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: path.join(defaultSavePath),
    filters: fileFilters,
  })

  if (choice.filePath && !choice.filePath.endsWith('.jbrowse')) {
    choice.filePath = `${choice.filePath}.jbrowse`
  }
  return choice.filePath
})

ipcMain.handle(
  'deleteSession',
  async (_event: unknown, sessionPath: string) => {
    const sessions = JSON.parse(await readFile(recentSessionsPath, 'utf8')) as {
      path: string
      name: string
    }[]

    const idx = sessions.findIndex(row => row.path === sessionPath)
    if (idx !== -1) {
      sessions.splice(idx, 1)
    } else {
      throw new Error(`Session at ${path} not found`)
    }

    await Promise.all([
      writeFile(recentSessionsPath, stringify(sessions)),
      unlink(sessionPath).catch(e => console.error(e)),
    ])
  },
)

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

/// from https://github.com/iffy/electron-updater-example/blob/master/main.js
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
