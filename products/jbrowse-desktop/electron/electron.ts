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

function findSessionPathArg(argv: readonly string[], cwd: string) {
  const arg = argv.slice(1).find(a => a.endsWith('.jbrowse'))
  return arg ? path.resolve(cwd, arg) : undefined
}

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
      resolve(findSessionPathArg(process.argv, process.cwd()))
    })
  })
}

function loadSession(win: BrowserWindow, sessionPath: string) {
  win.loadURL(buildAppUrl(DEV_SERVER_URL, sessionPath).href).catch(logError)
}

// Tracks the single main window. Concurrent ensureWindow calls during creation
// share the in-flight promise; the 'closed' handler nulls both bindings
// together so the next call rebuilds the window.
function createWindowManager() {
  let mainWindow: BrowserWindow | null = null
  let creating: Promise<BrowserWindow> | null = null

  async function startCreate(sessionPath: string | undefined) {
    const win = await createMainWindow(autoUpdater, DEV_SERVER_URL, sessionPath)
    mainWindow = win
    win.on('closed', () => {
      mainWindow = null
      creating = null
    })
    return win
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

      await initializeFileSystem(paths)

      app.on('second-instance', (_event, argv, workingDirectory) => {
        wm.ensureWindow(findSessionPathArg(argv, workingDirectory)).catch(
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

      await wm.ensureWindow(await initialSession)
    } catch (error) {
      showFatalError('Failed to initialize application', error)
    }
  })
}

if (app.requestSingleInstanceLock()) {
  runApp()
} else {
  app.quit()
}
