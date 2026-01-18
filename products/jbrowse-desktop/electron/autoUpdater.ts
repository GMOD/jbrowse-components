import { dialog } from 'electron'

import type { AppUpdater } from 'electron-updater'

function sendStatusToWindow(
  mainWindow: Electron.BrowserWindow | null,
  text: string,
) {
  console.error(text)
  if (mainWindow) {
    mainWindow.webContents.send('message', text)
  }
}

export function setupAutoUpdater(
  autoUpdater: AppUpdater,
  getMainWindow: () => Electron.BrowserWindow | null,
) {
  autoUpdater.autoDownload = false

  autoUpdater.on('error', (error: Error) => {
    // Skip dialogs in CI environments to avoid blocking tests
    if (process.env.CI) {
      console.error('Auto-updater error (CI mode, skipping dialog):', error)
      return
    }
    dialog.showErrorBox(
      'Error: ',
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      error == null ? 'unknown' : (error.stack || error).toString(),
    )
  })

  autoUpdater.on('update-available', async () => {
    // Skip dialogs in CI environments
    if (process.env.CI) {
      console.log('Update available (CI mode, skipping dialog)')
      return
    }
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Found updates',
      message:
        'Found updates, do you want update now? Note: the update will download in the background, and a dialog will appear once complete',
      buttons: ['Yes', 'No'],
    })

    if (result.response === 0) {
      autoUpdater.downloadUpdate().catch((e: unknown) => {
        console.error(e)
      })
    }
  })

  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow(getMainWindow(), 'Checking for update...')
  })

  autoUpdater.on('error', (err: Error) => {
    sendStatusToWindow(getMainWindow(), `Error in auto-updater: ${err}`)
  })

  autoUpdater.on('update-downloaded', () => {
    // Skip dialogs in CI environments
    if (process.env.CI) {
      console.log('Update downloaded (CI mode, skipping dialog)')
      return
    }
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update completed',
        message:
          'Update downloaded, the update will take place when you restart the app. Once you close the app, wait a minute or so before re-launching because it will be doing a reinstall in the background',
        buttons: ['OK'],
      })
      .catch((e: unknown) => {
        console.error(e)
      })
  })
}
