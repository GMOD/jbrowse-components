import { dialog, shell } from 'electron'

import { logError } from './util.ts'

import type { AppUpdater } from 'electron-updater'

const RELEASE_NOTES_URL =
  'https://github.com/GMOD/jbrowse-components/releases/tag/v'

// Distinguishes a user-triggered check from the background startup check so
// update-not-available/error only shows a dialog when the user asked for it.
let manualCheckActive = false

const NETWORK_ERROR_PATTERNS = [
  'ERR_INTERNET_DISCONNECTED',
  'ERR_NETWORK',
  'ERR_NAME_NOT_RESOLVED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'net::',
]

function isNetworkError(error: Error) {
  const text = `${error.message} ${error.stack ?? ''}`
  return NETWORK_ERROR_PATTERNS.some(pattern => text.includes(pattern))
}

// A native message box draws its text as plain text on every platform, so a url
// in the message would not be clickable. The release notes get their own button
// that hands the url to the browser, and the dialog is shown again afterwards
// so that reading them is not the same as answering it.
const RELEASE_NOTES_ID = 2

export async function askAboutVersion({
  version,
  title,
  message,
  buttons,
}: {
  version: string
  title: string
  message: string
  buttons: [string, string]
}) {
  let response = RELEASE_NOTES_ID
  while (response === RELEASE_NOTES_ID) {
    const result = await dialog.showMessageBox({
      type: 'info',
      title,
      message,
      buttons: [...buttons, 'Release notes'],
      defaultId: 0,
      cancelId: 1,
    })
    response = result.response
    if (response === RELEASE_NOTES_ID) {
      shell.openExternal(`${RELEASE_NOTES_URL}${version}`).catch(logError)
    }
  }
  return response
}

export function checkForUpdatesManually(autoUpdater: AppUpdater) {
  manualCheckActive = true
  autoUpdater.checkForUpdates().catch(logError)
}

export function setupAutoUpdater(autoUpdater: AppUpdater) {
  autoUpdater.autoDownload = false

  autoUpdater.on('checking-for-update', () => {
    // console only: this used to also push a 'message' to the window, on a
    // channel that is not in IpcPushChannels and that no renderer has ever
    // listened for. The dialogs below are how a check reports itself.
    console.log('Checking for update...')
  })

  autoUpdater.on('error', async (error: Error) => {
    // A background startup check that fails (e.g. when offline) must stay
    // silent — only surface an error the user explicitly asked for, and show a
    // friendly message rather than a raw stack trace for connectivity issues.
    const wasManual = manualCheckActive
    manualCheckActive = false
    console.error('Auto-updater error:', error)
    if (wasManual && !process.env.CI) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Unable to check for updates',
        message: isNetworkError(error)
          ? 'Could not check for updates. Please check your internet connection and try again.'
          : `Could not check for updates: ${error.message}`,
        buttons: ['OK'],
      })
    }
  })

  autoUpdater.on('update-not-available', async () => {
    const wasManual = manualCheckActive
    manualCheckActive = false
    if (wasManual && !process.env.CI) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Up to date',
        message: 'You are on the latest version.',
        buttons: ['OK'],
      })
    }
  })

  autoUpdater.on('update-available', async info => {
    manualCheckActive = false
    if (process.env.CI) {
      console.log('Update available (CI mode, skipping dialog)')
    } else {
      const response = await askAboutVersion({
        version: info.version,
        title: 'Found updates',
        message: `Version ${info.version} is available, do you want to update now? Note: the update will download in the background, and a dialog will appear once complete`,
        buttons: ['Yes', 'No'],
      })

      if (response === 0) {
        autoUpdater.downloadUpdate().catch(logError)
      }
    }
  })

  autoUpdater.on('update-downloaded', async info => {
    if (process.env.CI) {
      console.log('Update downloaded (CI mode, skipping dialog)')
    } else {
      const response = await askAboutVersion({
        version: info.version,
        title: 'Update ready',
        message: `Version ${info.version} has been downloaded. Restart now to apply the update?`,
        buttons: ['Restart now', 'Later'],
      })

      if (response === 0) {
        autoUpdater.quitAndInstall(true, true)
      }
    }
  })
}
