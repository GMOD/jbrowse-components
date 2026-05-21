import { app, dialog } from 'electron'
import contextMenu from 'electron-context-menu'
import debug from 'electron-debug'
import pkg from 'electron-updater'

import { setupAutoUpdater } from './autoUpdater.ts'
import { initializeFileSystem } from './fileSystemInit.ts'
import { registerAuthHandlers } from './ipc/authHandlers.ts'
import { registerFileHandlers } from './ipc/fileHandlers.ts'
import { registerQuickstartHandlers } from './ipc/quickstartHandlers.ts'
import { registerSessionHandlers } from './ipc/sessionHandlers.ts'
import { initializePaths } from './paths.ts'
import { createMainWindow } from './window.ts'

import type { AppPaths } from './paths.ts'
import type { BrowserWindow } from 'electron'

const { autoUpdater } = pkg

contextMenu()
debug({ showDevTools: false, isEnabled: true })

const DEV_SERVER_URL = process.env.DEV_SERVER_URL

let mainWindow: BrowserWindow | null = null
let paths!: AppPaths

function showFatalError(title: string, error: unknown, shouldQuit = true) {
  const message = error instanceof Error ? error.message : String(error)
  const detail = error instanceof Error ? error.stack : undefined
  console.error(`${title}:`, error)
  dialog.showErrorBox(title, detail ? `${message}\n\n${detail}` : message)
  if (shouldQuit) {
    app.quit()
  }
}

async function initialize() {
  await initializeFileSystem(paths)
  mainWindow = await createMainWindow(autoUpdater, DEV_SERVER_URL)
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerIpcHandlers() {
  registerSessionHandlers(paths, () => mainWindow)
  registerQuickstartHandlers(paths)
  registerFileHandlers(paths)
  registerAuthHandlers()
}

setupAutoUpdater(autoUpdater, () => mainWindow)

app.on('ready', async () => {
  try {
    // app.getPath() is only reliable after 'ready'
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
