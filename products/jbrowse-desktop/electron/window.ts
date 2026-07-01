import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { BrowserWindow, Menu, app, shell } from 'electron'

import { checkForUpdatesManually } from './autoUpdater.ts'
import { logError } from './util.ts'
import windowStateKeeper from './windowStateKeeper.ts'

import type { AppUpdater } from 'electron-updater'

const DEFAULT_WINDOW_WIDTH = 1400
const DEFAULT_WINDOW_HEIGHT = 800
const DEFAULT_DEV_SERVER_URL = 'http://localhost:3000'

export interface AuthWindowParams {
  internetAccountId: string
  data: { redirect_uri: string }
  url: string
}

export function buildAppUrl(
  devServerUrl: string | undefined,
  sessionPath?: string,
) {
  const url = app.isPackaged
    ? pathToFileURL(path.join(app.getAppPath(), 'index.html'))
    : new URL(devServerUrl ?? DEFAULT_DEV_SERVER_URL)
  if (sessionPath) {
    url.searchParams.set('config', sessionPath)
  }
  return url
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
          click: () => {
            shell.openExternal('https://jbrowse.org').catch(logError)
          },
        },
        {
          label: 'Check for updates...',
          click: () => {
            checkForUpdatesManually(autoUpdater)
          },
        },
      ],
    },
  ])
}

export async function createMainWindow(
  autoUpdater: AppUpdater,
  devServerUrl: string | undefined,
  initialSessionPath: string | undefined,
): Promise<BrowserWindow> {
  const mainWindowState = windowStateKeeper({
    defaultWidth: DEFAULT_WINDOW_WIDTH,
    defaultHeight: DEFAULT_WINDOW_HEIGHT,
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
      autoUpdater.checkForUpdatesAndNotify().catch(logError)
    })
  }

  await mainWindow.loadURL(buildAppUrl(devServerUrl, initialSessionPath).href)

  mainWindow.webContents.setWindowOpenHandler(edata => {
    shell.openExternal(edata.url).catch(logError)
    return { action: 'deny' }
  })

  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(createMenu(autoUpdater))
  } else {
    Menu.setApplicationMenu(null)
  }

  return mainWindow
}

export function createAuthWindow(
  params: AuthWindowParams,
): Promise<string | undefined> {
  const win = new BrowserWindow({
    width: 1000,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.title = `JBrowseAuthWindow-${params.internetAccountId}`

  win.loadURL(params.url).catch(logError)

  return new Promise(resolve => {
    win.webContents.on('will-redirect', details => {
      if (details.url.startsWith(params.data.redirect_uri)) {
        details.preventDefault()
        resolve(details.url)
        win.close()
      }
    })
    win.on('closed', () => {
      resolve(undefined)
    })
  })
}
