import path from 'node:path'

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
import { initializePaths } from './paths.ts'
import { logError } from './util.ts'
import { buildAppUrl, createMainWindow } from './window.ts'

import type { BrowserWindow } from 'electron'

const { autoUpdater } = pkg

contextMenu()
debug({ showDevTools: false, isEnabled: true })

const DEV_SERVER_URL = process.env.DEV_SERVER_URL

// A launch argument may be a saved session (.jbrowse) or a hand-written /
// CLI-generated config (config.json); both are JSON snapshots loaded the same
// way, and the start screen's "Open config.json or .jbrowse file" accepts the
// same pair.
const LAUNCH_FILE_EXTENSIONS = ['.jbrowse', '.json']

const HELP_TEXT = `JBrowse 2 desktop

Usage: jbrowse-desktop [options] [file]

  file          Path to a session (.jbrowse) or configuration (config.json)
                file to open on launch

Options:
  --renderer <mode>  Force a rendering backend: "webgl" or "canvas" instead of
                     auto-detecting WebGPU. Useful over X11 / remote desktops
                     where WebGPU is unavailable.
  -h, --help         Print this help message and exit
  --version          Print the version number and exit

Documentation: https://jbrowse.org/jb2/docs/`

function findLaunchFileArg(argv: readonly string[], cwd: string) {
  const arg = argv
    .slice(1)
    .find(a => LAUNCH_FILE_EXTENSIONS.some(ext => a.endsWith(ext)))
  return arg ? path.resolve(cwd, arg) : undefined
}

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

// Resolves to the .jbrowse path that should drive the first window: either an
// argv argument, or the first 'open-file' event that fires before 'ready'
// (macOS Open-With launch). Resolves exactly once, when 'ready' fires.
function getInitialSession(): Promise<string | undefined> {
  return new Promise(resolve => {
    const onOpenFile = (event: Electron.Event, filePath: string) => {
      event.preventDefault()
      resolve(filePath)
    }
    app.once('open-file', onOpenFile)
    void app.whenReady().then(() => {
      app.off('open-file', onOpenFile)
      resolve(findLaunchFileArg(process.argv, process.cwd()))
    })
  })
}

function loadSession(win: BrowserWindow, sessionPath: string) {
  win
    .loadURL(buildAppUrl(DEV_SERVER_URL, sessionPath, RENDERER_OVERRIDE).href)
    .catch(logError)
}

// Tracks the single main window. Concurrent ensureWindow calls during creation
// share the in-flight promise; the 'closed' handler nulls both bindings
// together so the next call rebuilds the window.
function createWindowManager() {
  let mainWindow: BrowserWindow | null = null
  let creating: Promise<BrowserWindow> | null = null

  async function startCreate(sessionPath: string | undefined) {
    try {
      const win = await createMainWindow(
        autoUpdater,
        DEV_SERVER_URL,
        sessionPath,
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

  async function ensureWindow(sessionPath?: string): Promise<BrowserWindow> {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
      if (sessionPath) {
        loadSession(mainWindow, sessionPath)
      }
      return mainWindow
    }
    if (creating) {
      const win = await creating
      if (sessionPath) {
        loadSession(win, sessionPath)
      }
      return win
    }
    creating = startCreate(sessionPath)
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
  const initialSession = getInitialSession()
  const wm = createWindowManager()

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
      // launch or macOS open-file that fires during filesystem init is not
      // dropped for lack of a listener
      app.on('second-instance', (_event, argv, workingDirectory) => {
        wm.ensureWindow(findLaunchFileArg(argv, workingDirectory)).catch(
          logError,
        )
      })
      app.on('open-file', (event, filePath) => {
        event.preventDefault()
        wm.ensureWindow(filePath).catch(logError)
      })
      app.on('activate', () => {
        wm.ensureWindow().catch(logError)
      })

      await initializeFileSystem(paths)
      await wm.ensureWindow(await initialSession)
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
