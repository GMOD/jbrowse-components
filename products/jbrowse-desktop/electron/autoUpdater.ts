import { dialog } from 'electron'

import { logError } from './util.ts'

import type { AppUpdater } from 'electron-updater'

// Distinguishes a user-triggered check from the background startup check so
// update-not-available only shows a dialog when the user asked for it.
let manualCheckActive = false

export function checkForUpdatesManually(autoUpdater: AppUpdater) {
  manualCheckActive = true
  autoUpdater.checkForUpdates().catch(logError)
}

export function setupAutoUpdater(
  autoUpdater: AppUpdater,
  getMainWindow: () => Electron.BrowserWindow | null,
) {
  autoUpdater.autoDownload = false

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...')
    getMainWindow()?.webContents.send('message', 'Checking for update...')
  })

  autoUpdater.on('error', (error: Error) => {
    console.error('Auto-updater error:', error)
    if (!process.env.CI) {
      dialog.showErrorBox('Update Error', error.stack ?? error.toString())
    }
  })

  autoUpdater.on('update-not-available', async () => {
    if (!manualCheckActive || process.env.CI) {
      manualCheckActive = false
      return
    }
    manualCheckActive = false
    await dialog.showMessageBox({
      type: 'info',
      title: 'Up to date',
      message: 'You are on the latest version.',
      buttons: ['OK'],
    })
  })

  autoUpdater.on('update-available', async () => {
    manualCheckActive = false
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
      autoUpdater.downloadUpdate().catch(logError)
    }
  })

  autoUpdater.on('update-downloaded', async () => {
    if (process.env.CI) {
      console.log('Update downloaded (CI mode, skipping dialog)')
      return
    }
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message:
        'A new version has been downloaded. Restart now to apply the update?',
      buttons: ['Restart now', 'Later'],
    })

    if (result.response === 0) {
      autoUpdater.quitAndInstall(true, true)
    }
  })
}
