import electron, { dialog } from 'electron'
import debug from 'electron-debug'
import isDev from 'electron-is-dev'
import fs from 'fs'
import path from 'path'
import url from 'url'
import windowStateKeeper from 'electron-window-state'
import fetch from 'node-fetch'
import { getFileStream } from './generateFastaIndex'
import { generateFastaIndex } from '@gmod/faidx'

import { autoUpdater } from 'electron-updater'

const { unlink, readFile, copyFile, readdir, writeFile } = fs.promises

const { app, ipcMain, shell, BrowserWindow, Menu } = electron

interface RecentSession {
  path: string
  updated: number
  name: string
}

function stringify(obj: unknown) {
  return JSON.stringify(obj, null, 2)
}

async function readRecentSessions(): Promise<RecentSession[]> {
  let data = ''
  try {
    data = await readFile(recentSessionsPath, 'utf8')
    return JSON.parse(data)
  } catch (e) {
    console.error(
      `Failed to parse existing recentSessionsPath, data was ${data}`,
      e,
    )
    return []
  }
}

async function readSession(
  sessionPath: string,
): Promise<{ assemblies?: unknown[] }> {
  let data = ''
  try {
    data = await readFile(sessionPath, 'utf8')
    return JSON.parse(data)
  } catch (e) {
    console.error(
      `Failed to parse session at "${sessionPath}", data was ${data}`,
      e,
    )
    return {}
  }
}

async function readQuickstart(quickstartPath: string): Promise<unknown> {
  let data = ''
  try {
    data = await readFile(quickstartPath, 'utf8')
    return JSON.parse(data)
  } catch (e) {
    console.error(
      `Failed to parse quickstart at "${quickstartPath}", data was ${data}`,
      e,
    )
    return {}
  }
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
    // unsure how to handle
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
const faiDir = path.join(userData, 'fai')
const autosaveDir = path.join(userData, 'autosaved')
const jbrowseDocDir = path.join(app.getPath('documents'), 'JBrowse')
const defaultSavePath = path.join(jbrowseDocDir, 'untitled.jbrowse')

const fileFilters = [
  { name: 'JBrowse Session', extensions: ['jbrowse'] },
  { name: 'All Files', extensions: ['*'] },
]

function getQuickstartPath(sessionName: string, ext = 'json') {
  return path.join(quickstartDir, `${encodeURIComponent(sessionName)}.${ext}`)
}

function getThumbnailPath(sessionPath: string) {
  return path.join(thumbnailDir, `${encodeURIComponent(sessionPath)}.data`)
}

function getAutosavePath(sessionName: string, ext = 'json') {
  return path.join(autosaveDir, `${encodeURIComponent(sessionName)}.${ext}`)
}

function getFaiPath(name: string) {
  return path.join(faiDir, `${encodeURIComponent(name)}.fai`)
}

if (!fs.existsSync(recentSessionsPath)) {
  fs.writeFileSync(recentSessionsPath, stringify([]), 'utf8')
}

if (!fs.existsSync(quickstartDir)) {
  fs.mkdirSync(quickstartDir, { recursive: true })
}

if (!fs.existsSync(faiDir)) {
  fs.mkdirSync(faiDir, { recursive: true })
}

if (!fs.existsSync(thumbnailDir)) {
  fs.mkdirSync(thumbnailDir, { recursive: true })
}

if (!fs.existsSync(autosaveDir)) {
  fs.mkdirSync(autosaveDir, { recursive: true })
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

async function updatePreconfiguredSessions() {
  try {
    const response = await fetch('https://jbrowse.org/genomes/sessions.json')
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`)
    }
    const data = await response.json()
    Object.entries(data).forEach(([key, value]) => {
      // if there is not a 'gravestone' (.deleted file), then repopulate it on
      // startup, this allows the user to delete even defaults if they want to
      if (!fs.existsSync(getQuickstartPath(key) + '.deleted')) {
        fs.writeFileSync(getQuickstartPath(key), JSON.stringify(value, null, 2))
      }
    })
  } catch (e) {
    // just console.error
    console.error('Failed to fetch sessions.json', e)
  }
}

async function createWindow() {
  // no need to await, just update in background
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  updatePreconfiguredSessions()

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

  // this ready-to-show handler must be attached before the loadURL
  mainWindow.once('ready-to-show', () => {
    // unsure how to error handle
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    autoUpdater.checkForUpdatesAndNotify()
  })

  await mainWindow.loadURL(
    isDev
      ? url.format(devServerUrl)
      : `file://${path.join(app.getAppPath(), 'build', 'index.html')}`,
  )

  mainWindow.webContents.setWindowOpenHandler(details => {
    // unsure how to handle
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const isMac = process.platform === 'darwin'

  const mainMenu = Menu.buildFromTemplate([
    // { role: 'appMenu' }
    // @ts-expect-error
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
      // @ts-expect-error
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
        // @ts-expect-error
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
        // @ts-expect-error
        { role: 'toggledevtools' },
        { type: 'separator' },
        // @ts-expect-error
        { role: 'zoomin' },
        // @ts-expect-error
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
        // @ts-expect-error
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
      // @ts-expect-error
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
    // unsure how to handle error
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    createWindow()
  }
})

ipcMain.handle('quit', () => {
  app.quit()
})

ipcMain.handle('userData', () => {
  return userData
})

ipcMain.handle(
  'indexFasta',
  async (event: unknown, location: { uri: string } | { localPath: string }) => {
    const filename = 'localPath' in location ? location.localPath : location.uri
    const faiPath = getFaiPath(`${path.basename(filename)}${+Date.now()}.fai`)
    const stream = await getFileStream(location)
    const write = fs.createWriteStream(faiPath)

    // @ts-expect-error
    await generateFastaIndex(write, stream)
    return faiPath
  },
)

ipcMain.handle(
  'listSessions',
  async (_event: unknown, showAutosaves: boolean) => {
    const sessions = await readRecentSessions()

    return showAutosaves
      ? sessions
      : sessions.filter(f => !f.path.startsWith(autosaveDir))
  },
)

ipcMain.handle('loadExternalConfig', (_event: unknown, sessionPath) => {
  return readFile(sessionPath, 'utf8')
})

ipcMain.handle('loadSession', async (_event: unknown, sessionPath: string) => {
  const sessionSnapshot = await readSession(sessionPath)
  if (!sessionSnapshot.assemblies) {
    throw new Error(
      `File at ${sessionPath} does not appear to be a JBrowse session. It does not contain any assemblies.`,
    )
  }
  return sessionSnapshot
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
  return readQuickstart(getQuickstartPath(name))
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

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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

// creates an initial entry in autosave folder
ipcMain.handle(
  'createInitialAutosaveFile',
  async (_event: unknown, snap: SessionSnap) => {
    const rows = await readRecentSessions()
    const idx = rows.findIndex(r => r.path === path)
    const path = getAutosavePath(`${+Date.now()}`)
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
      writeFile(recentSessionsPath, stringify(rows)),
      writeFile(path, stringify(snap)),
    ])

    return path
  },
)

// snapshots page and saves to path
ipcMain.handle(
  'saveSession',
  async (_event: unknown, path: string, snap: SessionSnap) => {
    const [page, rows] = await Promise.all([
      mainWindow?.capturePage(),
      readRecentSessions(),
    ])
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
  const choice = await dialog.showOpenDialog({
    defaultPath: jbrowseDocDir,
    filters: fileFilters,
  })

  return choice.filePaths[0]
})

ipcMain.handle('promptSessionSaveAs', async (_event: unknown) => {
  const choice = await dialog.showSaveDialog({
    defaultPath: path.join(defaultSavePath),
    filters: fileFilters,
  })

  if (choice.filePath && !choice.filePath.endsWith('.jbrowse')) {
    choice.filePath = `${choice.filePath}.jbrowse`
  }
  return choice.filePath
})

ipcMain.handle(
  'deleteSessions',
  async (_event: unknown, sessionPaths: string[]) => {
    const sessions = await readRecentSessions()
    const indices = sessions
      .map((r, i) => (sessionPaths.includes(r.path) ? i : undefined))
      .filter((f): f is number => f !== undefined)

    for (let i = indices.length - 1; i >= 0; i--) {
      sessions.splice(indices[i], 1)
    }

    await Promise.all([
      writeFile(recentSessionsPath, stringify(sessions)),
      ...sessionPaths.map(sessionPath =>
        unlink(getThumbnailPath(sessionPath)).catch(e => console.error(e)),
      ),
      ...sessionPaths.map(sessionPath =>
        unlink(sessionPath).catch(e => console.error(e)),
      ),
    ])
  },
)

ipcMain.handle(
  'renameSession',
  async (_event: unknown, path: string, newName: string) => {
    const sessions = await readRecentSessions()
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
  sendStatusToWindow(`Error in auto-updater: ${err}`)
})

autoUpdater.on('update-downloaded', () => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  dialog.showMessageBox({
    type: 'info',
    title: 'Update completed',
    message:
      'Update downloaded, the update will take place when you restart the app. Once you close the app, wait a minute or so before re-launching because it will be doing a reinstall in the background',
    buttons: ['OK'],
  })
})
