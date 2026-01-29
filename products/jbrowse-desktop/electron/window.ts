import path from 'path'
import url, { pathToFileURL } from 'url'

import electron, { BrowserWindow, Menu, app, shell } from 'electron'

import windowStateKeeper from './windowStateKeeper.ts'

import type { AppUpdater } from 'electron-updater'

const DEFAULT_WINDOW_SIZE = {
  width: 1400,
  height: 800,
}

const DEFAULT_DEV_SERVER_URL = 'http://localhost:3000'

function getAppUrl(devServerUrl: URL): URL {
  if (app.isPackaged) {
    // When packaged with @electron/packager, the build directory IS the app root
    return pathToFileURL(path.join(app.getAppPath(), 'index.html'))
  }
  return devServerUrl
}

function setupWindowHandlers(mainWindow: BrowserWindow) {
  mainWindow.webContents.setWindowOpenHandler(edata => {
    shell.openExternal(edata.url).catch((e: unknown) => {
      console.error(e)
    })
    return {
      action: 'deny',
    }
  })
}

function createMenu(autoUpdater: AppUpdater) {
  return Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'Visit jbrowse.org',
          click: () => electron.shell.openExternal('https://jbrowse.org'),
        },
        {
          label: 'Check for updates...',
          click: () => autoUpdater.checkForUpdates(),
        },
      ],
    },
  ])
}

export async function createMainWindow(
  autoUpdater: AppUpdater,
  devServerUrl?: string,
): Promise<BrowserWindow> {
  const mainWindowState = windowStateKeeper({
    defaultWidth: DEFAULT_WINDOW_SIZE.width,
    defaultHeight: DEFAULT_WINDOW_SIZE.height,
  })

  const { x, y, width, height } = mainWindowState

  const mainWindow = new BrowserWindow({
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

  // This ready-to-show handler must be attached before the loadURL
  // Skip auto-update check in CI environments to avoid blocking dialogs
  if (!process.env.CI) {
    mainWindow.once('ready-to-show', () => {
      autoUpdater.checkForUpdatesAndNotify().catch((e: unknown) => {
        console.error(e)
      })
    })
  }

  const serverUrl = new URL(devServerUrl || DEFAULT_DEV_SERVER_URL)
  const appUrl = getAppUrl(serverUrl)

  // Handle opening .jbrowse files from command line
  const lastArg = process.argv.at(-1)
  if (lastArg?.endsWith('.jbrowse')) {
    appUrl.searchParams.append('config', lastArg)
  }

  await mainWindow.loadURL(url.format(appUrl))

  setupWindowHandlers(mainWindow)

  const mainMenu = createMenu(autoUpdater)
  const isMac = process.platform === 'darwin'

  if (isMac) {
    Menu.setApplicationMenu(mainMenu)
  } else {
    Menu.setApplicationMenu(null)
  }

  return mainWindow
}

export function createAuthWindow(params: {
  internetAccountId: string
  data: { redirect_uri: string }
  url: string
}) {
  const win = new BrowserWindow({
    width: 1000,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  win.title = `JBrowseAuthWindow-${params.internetAccountId}`

  win.loadURL(params.url).catch((e: unknown) => {
    console.error(e)
  })

  return new Promise(resolve => {
    win.webContents.on(
      // @ts-expect-error unclear why this is needed
      'will-redirect',
      (event: Event, redirectUrl: string) => {
        if (redirectUrl.startsWith(params.data.redirect_uri)) {
          event.preventDefault()
          resolve(redirectUrl)
          win.close()
        }
      },
    )
  })
}
