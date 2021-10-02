import electron, { dialog } from 'electron'
import debug from 'electron-debug'
import isDev from 'electron-is-dev'
import fs from 'fs'
import path from 'path'
import url from 'url'
import windowStateKeeper from 'electron-window-state'
import { autoUpdater } from 'electron-updater'

const { unlink, rename, readdir, readFile, writeFile } = fs.promises

const { app, ipcMain, shell, BrowserWindow, Menu } = electron

// manual auto-updates https://github.com/electron-userland/electron-builder/blob/docs/encapsulated%20manual%20update%20via%20menu.js
autoUpdater.autoDownload = false

autoUpdater.on('error', error => {
  dialog.showErrorBox(
    'Error: ',
    error == null ? 'unknown' : (error.stack || error).toString(),
  )
})

autoUpdater.on('update-available', () => {
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Found updates',
      message:
        'Found updates, do you want update now? Hit yes to download the update. No status will appear while the update downloads, but a dialog will appear once it completes downloading and you can restart the app after this to complete the update',
      buttons: ['Yes', 'No'],
    })
    .then(buttonIndex => {
      if (buttonIndex.response === 0) {
        autoUpdater.downloadUpdate()
      }
    })
})

debug({ showDevTools: false })

const devServerUrl = url.parse(
  process.env.DEV_SERVER_URL || 'http://localhost:3000',
)

const sessionDir = path.join(app.getPath('userData'), 'sessions')

function getPath(sessionName: string, ext = 'json') {
  return path.join(sessionDir, `${encodeURIComponent(sessionName)}.${ext}`)
}

try {
  fs.statSync(sessionDir)
} catch (error) {
  if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
    fs.mkdirSync(sessionDir, { recursive: true })
  } else {
    throw error
  }
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
      label: 'Help',
      role: 'help',
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
  return new Map(
    (await readdir(sessionDir))
      .filter(f => path.extname(f) === '.json')
      .map(f => {
        const base = path.basename(f, '.json')
        const json = path.join(sessionDir, base + '.json')
        const thumb = path.join(sessionDir, base + '.thumbnail')

        return [
          decodeURIComponent(base),
          {
            stats: fs.existsSync(json) ? fs.statSync(json) : undefined,
            screenshot: fs.existsSync(thumb)
              ? fs.readFileSync(thumb, 'utf8')
              : undefined,
          },
        ]
      }),
  )
})

ipcMain.handle('loadExternalConfig', (_event: unknown, sessionPath) => {
  return readFile(sessionPath, 'utf8')
})

ipcMain.handle('loadSession', (_event: unknown, sessionName: string) => {
  return readFile(getPath(sessionName), 'utf8')
})

ipcMain.handle('saveSession', async (_event: unknown, snap: SessionSnap) => {
  const page = await mainWindow?.capturePage()
  const name = snap.defaultSession.name
  if (page) {
    await writeFile(getPath(name, 'thumbnail'), page.toDataURL())
  }
  await writeFile(getPath(name), JSON.stringify(snap, null, 2))
})

ipcMain.handle(
  'renameSession',
  async (_event: unknown, oldName: string, newName: string) => {
    try {
      await rename(getPath(oldName, 'thumbnail'), getPath(newName, 'thumbnail'))
    } catch (e) {
      console.error('rename thumbnail failed', e)
    }

    const snap = JSON.parse(await readFile(getPath(oldName), 'utf8'))

    snap.defaultSession.name = newName
    await unlink(getPath(oldName))
    await writeFile(getPath(newName), JSON.stringify(snap, null, 2))
  },
)

ipcMain.handle('reset', async () => {
  await Promise.all(
    (await readdir(sessionDir)).map(f => unlink(path.join(sessionDir, f))),
  )
})

ipcMain.handle(
  'deleteSession',
  async (_event: unknown, sessionName: string) => {
    try {
      await unlink(getPath(sessionName, 'thumbnail'))
    } catch (e) {
      console.error('delete thumbnail failed', e)
    }
    return unlink(getPath(sessionName))
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
