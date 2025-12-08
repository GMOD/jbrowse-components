import { pathToFileURL } from 'url'

import { app, ipcMain, net, protocol } from 'electron'
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

import type { BrowserWindow } from 'electron'

const { autoUpdater } = pkg

// Register custom protocol scheme before app is ready
// This allows fetch() to work with jbfile:// URLs
// See https://www.electronjs.org/docs/latest/api/protocol#protocolhandlescheme-handler
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'jbfile',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
    },
  },
])

// Enable context menu and debug features
contextMenu()
debug({ showDevTools: false, isEnabled: true })

// Environment variables
const DEV_SERVER_URL = process.env.DEV_SERVER_URL

// Initialize paths once
const paths = initializePaths()

// Main window reference
let mainWindow: BrowserWindow | null = null

function getMainWindow() {
  return mainWindow
}

/**
 * Creates the main window and initializes the application
 */
async function initialize() {
  try {
    await initializeFileSystem(paths)
    mainWindow = await createMainWindow(autoUpdater, DEV_SERVER_URL)

    mainWindow.on('closed', () => {
      mainWindow = null
    })
  } catch (error) {
    console.error('Failed to initialize application:', error)
    throw error
  }
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

// Setup auto-updater
setupAutoUpdater(autoUpdater, getMainWindow)

// Register IPC handlers
registerIpcHandlers()

// App lifecycle handlers
app.on('ready', async () => {
  // Register protocol handler for jbfile:// URLs
  // This allows the renderer to fetch local files via jbfile:///path/to/file
  // Uses net.fetch which supports file:// URLs in the main process
  protocol.handle('jbfile', request => {
    // Convert jbfile:///path/to/file to file:///path/to/file
    const filePath = request.url.slice('jbfile://'.length)
    return net.fetch(pathToFileURL(filePath).href)
  })

  await initialize()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', async () => {
  if (mainWindow === null) {
    await initialize()
  }
})
