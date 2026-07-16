import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { BrowserWindow, Menu, app, shell } from 'electron'

import { checkForUpdatesManually } from './autoUpdater.ts'
import { logError } from './util.ts'
import windowStateKeeper from './windowStateKeeper.ts'

import type { LaunchTarget } from './launchTarget.ts'
import type { AppUpdater } from 'electron-updater'

const DEFAULT_WINDOW_WIDTH = 1400
const DEFAULT_WINDOW_HEIGHT = 800
const DEFAULT_DEV_SERVER_URL = 'http://localhost:3000'

export interface AuthWindowParams {
  internetAccountId: string
  data: { redirect_uri: string }
  url: string
}

// The renderer is told what to open through its own query string: `config` for
// a local session/config file, `specLink` for a JBrowse Web link that arrived
// over the jbrowse:// protocol. Both are read by the Loader on startup.
export function buildAppUrl(
  devServerUrl: string | undefined,
  target?: LaunchTarget,
  renderer?: string,
) {
  const url = app.isPackaged
    ? pathToFileURL(path.join(app.getAppPath(), 'index.html'))
    : new URL(devServerUrl ?? DEFAULT_DEV_SERVER_URL)
  if (target?.type === 'file') {
    url.searchParams.set('config', target.path)
  }
  if (target?.type === 'link') {
    url.searchParams.set('specLink', target.url)
  }
  if (renderer) {
    url.searchParams.set('renderer', renderer)
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
  initialTarget: LaunchTarget | undefined,
  renderer: string | undefined,
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

  await mainWindow.loadURL(
    buildAppUrl(devServerUrl, initialTarget, renderer).href,
  )

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

/**
 * Open genome.ucsc.edu (or any BLAT server) in a window so the user can solve
 * the Cloudflare Turnstile CAPTCHA that now fronts hgBlat. This window shares
 * the default session cookie jar with the app, so once solved the cf_clearance
 * cookie is available to subsequent main-process BLAT requests. Resolves true
 * when the clearance cookie appears, false if the user closes the window first.
 */
export function createChallengeWindow(url: string): Promise<boolean> {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'Solve CAPTCHA to enable BLAT',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.loadURL(url).catch(logError)

  return new Promise(resolve => {
    let settled = false
    const finish = (ok: boolean) => {
      if (!settled) {
        settled = true
        resolve(ok)
        if (!win.isDestroyed()) {
          win.close()
        }
      }
    }
    // scope the cookie lookup to the challenge host: cf_clearance is
    // domain-bound, and an unfiltered lookup would match a cf_clearance left by
    // any other Cloudflare site and finish(true) before the user solves this one
    const timer = setInterval(() => {
      win.webContents.session.cookies
        .get({ url, name: 'cf_clearance' })
        .then(cookies => {
          if (cookies.length) {
            finish(true)
          }
        })
        .catch(logError)
    }, 1000)
    win.on('closed', () => {
      clearInterval(timer)
      if (!settled) {
        settled = true
        resolve(false)
      }
    })
  })
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
