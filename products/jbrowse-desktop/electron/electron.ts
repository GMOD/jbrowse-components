import { app, dialog, ipcMain } from 'electron'
import contextMenu from 'electron-context-menu'
import debug from 'electron-debug'
import pkg from 'electron-updater'

import { setupAutoUpdater } from './autoUpdater.ts'
import { initializeFileSystem } from './fileSystemInit.ts'
import { registerFileHandlers } from './ipc/fileHandlers.ts'
import { registerQuickstartHandlers } from './ipc/quickstartHandlers.ts'
import { registerSessionHandlers } from './ipc/sessionHandlers.ts'
import { initializePaths } from './paths.ts'
import { createAuthWindow, createMainWindow } from './window.ts'

import type { AppPaths } from './paths.ts'
import type { BrowserWindow } from 'electron'

const { autoUpdater } = pkg

// Enable context menu and debug features
contextMenu()
debug({ showDevTools: false, isEnabled: true })

// Environment variables
const DEV_SERVER_URL = process.env.DEV_SERVER_URL

// Main window reference
let mainWindow: BrowserWindow | null = null

// Paths - initialized after app is ready
let paths: AppPaths

function getMainWindow() {
  return mainWindow
}

/**
 * Shows an error dialog to the user and optionally quits the app
 */
function showFatalError(title: string, error: unknown, shouldQuit = true) {
  const message = error instanceof Error ? error.message : String(error)
  const detail = error instanceof Error ? error.stack : undefined
  console.error(`${title}:`, error)

  dialog.showErrorBox(title, detail ? `${message}\n\n${detail}` : message)

  if (shouldQuit) {
    app.quit()
  }
}

/**
 * Creates the main window and initializes the application
 */
async function initialize() {
  await initializeFileSystem(paths)
  mainWindow = await createMainWindow(autoUpdater, DEV_SERVER_URL)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * Register all IPC handlers
 */
function registerIpcHandlers() {
  registerSessionHandlers(paths, getMainWindow)
  registerQuickstartHandlers(paths)
  registerFileHandlers(paths)

  ipcMain.handle(
    'openAuthWindow',
    (
      _event: unknown,
      params: {
        internetAccountId: string
        data: { redirect_uri: string }
        url: string
      },
    ) => {
      return createAuthWindow(params)
    },
  )
}

// Setup auto-updater (just registers event listeners, safe before ready)
setupAutoUpdater(autoUpdater, getMainWindow)

// App lifecycle handlers
app.on('ready', async () => {
  try {
    // Initialize paths after app is ready to ensure app.getPath() works reliably
    paths = initializePaths()
    registerIpcHandlers()
    await initialize()
  } catch (error) {
    showFatalError('Failed to initialize application', error)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', async () => {
  if (mainWindow === null) {
    try {
      await initialize()
    } catch (error) {
      showFatalError('Failed to create window', error)
    }
  }
})
