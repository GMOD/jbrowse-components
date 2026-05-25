import { dialog } from 'electron'

import type { AppUpdater } from 'electron-updater'

function sendStatusToWindow(
  mainWindow: Electron.BrowserWindow | null,
  text: string,
) {
  // eslint-disable-next-line no-console
  console.log(text)
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
    sendStatusToWindow(getMainWindow(), `Error in auto-updater: ${error}`)
    if (process.env.CI) {
      console.error('Auto-updater error (CI mode, skipping dialog):', error)
      return
    }
    dialog.showErrorBox('Update Error', error.stack ?? error.toString())
  })

  autoUpdater.on('update-available', async () => {
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
