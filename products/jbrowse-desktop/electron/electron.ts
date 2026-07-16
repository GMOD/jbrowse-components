import { app, dialog } from 'electron'
import contextMenu from 'electron-context-menu'
import debug from 'electron-debug'
import pkg from 'electron-updater'

import { setupAutoUpdater } from './autoUpdater.ts'
import { initializeFileSystem } from './fileSystemInit.ts'
import { registerAuthHandlers } from './ipc/authHandlers.ts'
import { registerBlatHandlers } from './ipc/blatHandlers.ts'
import { registerFileHandlers } from './ipc/fileHandlers.ts'
import { registerQuickstartHandlers } from './ipc/quickstartHandlers.ts'
import { registerSessionHandlers } from './ipc/sessionHandlers.ts'
import {
  JBROWSE_PROTOCOL,
  findLaunchTarget,
  parseProtocolUrl,
} from './launchTarget.ts'
import { initializePaths } from './paths.ts'
import { logError } from './util.ts'
import { buildAppUrl, createMainWindow } from './window.ts'

import type { LaunchTarget } from './launchTarget.ts'
import type { BrowserWindow } from 'electron'

const { autoUpdater } = pkg

contextMenu()
debug({ showDevTools: false, isEnabled: true })

const DEV_SERVER_URL = process.env.DEV_SERVER_URL

const HELP_TEXT = `JBrowse 2 desktop

Usage: jbrowse-desktop [options] [file | jbrowse://open?url=<JBrowse Web link>]

  file          Path to a session (.jbrowse) or configuration (config.json)
                file to open on launch

Options:
  --renderer <mode>  Force a rendering backend: "webgl" or "canvas" instead of
                     auto-detecting WebGPU. Useful over X11 / remote desktops
                     where WebGPU is unavailable.
  -h, --help         Print this help message and exit
  --version          Print the version number and exit

Documentation: https://jbrowse.org/jb2/docs/`

// Accepts either --renderer=webgl or --renderer webgl. The value is forwarded
// to the renderer as a ?renderer= query param and consumed by setGpuOverride.
function findRendererArg(argv: readonly string[]) {
  const args = argv.slice(1)
  const inline = args.find(a => a.startsWith('--renderer='))
  const flagIndex = args.indexOf('--renderer')
  return inline
    ? inline.slice('--renderer='.length)
    : flagIndex === -1
      ? undefined
      : args[flagIndex + 1]
}

// Text to print for an informational flag (--version/--help), or undefined when
// the app should launch normally.
function cliInfoOutput(argv: readonly string[]) {
  const args = argv.slice(1)
  return args.includes('--version')
    ? app.getVersion()
    : args.includes('--help') || args.includes('-h')
      ? HELP_TEXT
      : undefined
}

// Parsed once at launch; forwarded to every window/session load so a session
// reopened via second-instance keeps the same backend override.
const RENDERER_OVERRIDE = findRendererArg(process.argv)

function showFatalError(title: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const detail = error instanceof Error ? error.stack : undefined
  console.error(`${title}:`, error)
  dialog.showErrorBox(title, detail ? `${message}\n\n${detail}` : message)
  app.quit()
}

// Resolves to what should drive the first window: an argv argument (a file, or
// a jbrowse:// link on Windows/Linux), or the first 'open-file'/'open-url'
// event that fires before 'ready' (macOS delivers both that way on a cold
// launch). Resolves exactly once, when 'ready' fires.
function getInitialTarget(): Promise<LaunchTarget | undefined> {
  return new Promise(resolve => {
    const onOpenFile = (event: Electron.Event, filePath: string) => {
      event.preventDefault()
      resolve({ type: 'file', path: filePath })
    }
    const onOpenUrl = (event: Electron.Event, url: string) => {
      event.preventDefault()
      const link = parseProtocolUrl(url)
      if (link) {
        resolve({ type: 'link', url: link })
      }
    }
    app.once('open-file', onOpenFile)
    app.once('open-url', onOpenUrl)
    void app.whenReady().then(() => {
      app.off('open-file', onOpenFile)
      app.off('open-url', onOpenUrl)
      resolve(findLaunchTarget(process.argv, process.cwd()))
    })
  })
}

function loadTarget(win: BrowserWindow, target: LaunchTarget) {
  win
    .loadURL(buildAppUrl(DEV_SERVER_URL, target, RENDERER_OVERRIDE).href)
    .catch(logError)
}

// Tracks the single main window. Concurrent ensureWindow calls during creation
// share the in-flight promise; the 'closed' handler nulls both bindings
// together so the next call rebuilds the window.
function createWindowManager() {
  let mainWindow: BrowserWindow | null = null
  let creating: Promise<BrowserWindow> | null = null

  async function startCreate(target: LaunchTarget | undefined) {
    try {
      const win = await createMainWindow(
        autoUpdater,
        DEV_SERVER_URL,
        target,
        RENDERER_OVERRIDE,
      )
      mainWindow = win
      win.on('closed', () => {
        mainWindow = null
        creating = null
      })
      return win
    } catch (error) {
      // Clear the in-flight promise so a later ensureWindow can retry instead
      // of awaiting a permanently-rejected creating promise
      creating = null
      throw error
    }
  }

  async function ensureWindow(target?: LaunchTarget): Promise<BrowserWindow> {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
      if (target) {
        loadTarget(mainWindow, target)
      }
      return mainWindow
    }
    if (creating) {
      const win = await creating
      if (target) {
        loadTarget(win, target)
      }
      return win
    }
    creating = startCreate(target)
    return creating
  }

  return {
    ensureWindow,
    get current() {
      return mainWindow
    },
  }
}

function runApp() {
  const initialTarget = getInitialTarget()
  const wm = createWindowManager()

  // Claims the jbrowse:// scheme so an "open in Desktop" link resolves here.
  // An installed app is already registered by its packaging — Info.plist on
  // macOS (scripts/packaging/packager.ts), the NSIS installer on Windows, the
  // .desktop file on Linux — so this mainly covers a dev run, and re-asserts
  // the claim if another install took the scheme over.
  app.setAsDefaultProtocolClient(JBROWSE_PROTOCOL)

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  void app.whenReady().then(async () => {
    try {
      // app.getPath() is only reliable after 'ready'
      const paths = initializePaths()
      registerSessionHandlers(paths, () => wm.current)
      registerQuickstartHandlers(paths)
      registerFileHandlers(paths)
      registerAuthHandlers()
      registerBlatHandlers()
      setupAutoUpdater(autoUpdater, () => wm.current)

      // Register app-level event handlers before any await so a second-instance
      // launch or macOS open-file/open-url that fires during filesystem init is
      // not dropped for lack of a listener
      app.on('second-instance', (_event, argv, workingDirectory) => {
        // Windows/Linux hand a jbrowse:// link to the running instance here, as
        // an argv entry — the same path a file argument takes
        wm.ensureWindow(findLaunchTarget(argv, workingDirectory)).catch(
          logError,
        )
      })
      app.on('open-file', (event, filePath) => {
        event.preventDefault()
        wm.ensureWindow({ type: 'file', path: filePath }).catch(logError)
      })
      // macOS delivers a jbrowse:// link this way, whether or not the app is
      // already running
      app.on('open-url', (event, url) => {
        event.preventDefault()
        const link = parseProtocolUrl(url)
        if (link) {
          wm.ensureWindow({ type: 'link', url: link }).catch(logError)
        }
      })
      app.on('activate', () => {
        wm.ensureWindow().catch(logError)
      })

      await initializeFileSystem(paths)
      await wm.ensureWindow(await initialTarget)
    } catch (error) {
      showFatalError('Failed to initialize application', error)
    }
  })
}

// --version/--help print and exit before acquiring the single-instance lock so
// they never disturb an already-running window.
const infoOutput = cliInfoOutput(process.argv)
if (infoOutput !== undefined) {
  console.log(infoOutput)
  app.exit(0)
} else if (app.requestSingleInstanceLock()) {
  runApp()
} else {
  app.quit()
}
