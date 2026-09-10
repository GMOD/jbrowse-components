import { dialog, shell } from 'electron'

import { ipcHandle } from './ipc/channels.ts'
import { logError } from './util.ts'

import type { AppUpdater } from 'electron-updater'

const RELEASE_NOTES_URL =
  'https://github.com/GMOD/jbrowse-components/releases/tag/v'

// CI runs the packaged app with nobody to click anything, so a modal there is a
// hung job rather than a prompt. Stated once; every prompt below asks.
const interactive = () => !process.env.CI

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

function isNetworkError(error: unknown) {
  const text =
    error instanceof Error ? `${error.message} ${error.stack ?? ''}` : ''
  return NETWORK_ERROR_PATTERNS.some(pattern => text.includes(pattern))
}

// A connectivity failure is the common one and its stack says nothing the user
// can act on, so it gets a sentence instead.
function describeFailure(error: unknown) {
  return isNetworkError(error)
    ? 'Please check your internet connection and try again.'
    : error instanceof Error
      ? error.message
      : String(error)
}

async function say(title: string, message: string) {
  if (interactive()) {
    await dialog.showMessageBox({
      type: 'info',
      title,
      message,
      buttons: ['OK'],
    })
  }
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

async function offerUpdate(autoUpdater: AppUpdater, version: string) {
  if (!interactive()) {
    console.log(`Update ${version} available (CI mode, skipping dialog)`)
    return
  }
  const response = await askAboutVersion({
    version,
    title: 'Found updates',
    message: `Version ${version} is available, do you want to update now? Note: the update will download in the background, and a dialog will appear once complete`,
    buttons: ['Yes', 'No'],
  })
  if (response === 0) {
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      // The user asked for this download, so its failure is theirs to hear
      // about: saying Yes to one that dies was otherwise indistinguishable
      // from saying No.
      await say(
        'Update download failed',
        `Version ${version} could not be downloaded. ${describeFailure(error)}`,
      )
    }
  }
}

async function offerRestart(autoUpdater: AppUpdater, version: string) {
  if (!interactive()) {
    console.log(`Update ${version} downloaded (CI mode, skipping dialog)`)
    return
  }
  const response = await askAboutVersion({
    version,
    title: 'Update ready',
    message: `Version ${version} has been downloaded. Restart now to apply the update?`,
    buttons: ['Restart now', 'Later'],
  })
  if (response === 0) {
    autoUpdater.quitAndInstall(true, true)
  }
}

/**
 * The startup check. Silent whatever happens: an offline launch must not open a
 * dialog nobody asked for, and an update it does find announces itself through
 * the update-available handler. electron-updater logs the failure itself.
 */
export function checkForUpdatesInBackground(autoUpdater: AppUpdater) {
  if (interactive()) {
    autoUpdater.checkForUpdates().catch(logError)
  }
}

/**
 * The check behind the menu item, which reports every outcome — that is the
 * whole difference from the background one, and the reason it reads the
 * returned result rather than the update-not-available and error events. Those
 * fire for the startup check too, and `checkForUpdates` resolves `null` without
 * firing either when the updater is inactive (an unpacked run, a Linux build
 * that is not the AppImage): the menu item then did nothing at all, and left a
 * "this check was manual" flag latched on for the next background check to
 * answer with dialogs.
 *
 * Never rejects.
 */
export async function checkForUpdatesManually(autoUpdater: AppUpdater) {
  try {
    const result = await autoUpdater.checkForUpdates()
    if (!result) {
      await say(
        'Cannot check for updates',
        'This build of JBrowse Desktop does not update itself. Download the latest release from jbrowse.org.',
      )
    } else if (!result.isUpdateAvailable) {
      await say('Up to date', 'You are on the latest version.')
    }
  } catch (error) {
    await say(
      'Unable to check for updates',
      `Could not check for updates. ${describeFailure(error)}`,
    )
  }
}

export function setupAutoUpdater(autoUpdater: AppUpdater) {
  // The user is asked before any bytes are fetched.
  autoUpdater.autoDownload = false
  // One full installer per platform is all we publish; leaving this false only
  // earns a warning on every Windows download.
  autoUpdater.disableWebInstaller = true
  // Differential download reads a `.blockmap` beside each artifact and the
  // packagers here write none, so it cost two doomed requests and an
  // error-level log before every update fell back to the full download anyway.
  autoUpdater.disableDifferentialDownload = true

  autoUpdater.on('update-available', info => {
    offerUpdate(autoUpdater, info.version).catch(logError)
  })

  autoUpdater.on('update-downloaded', info => {
    offerRestart(autoUpdater, info.version).catch(logError)
  })

  // The menu bar the renderer draws is the only one Windows and Linux have —
  // window.ts sets a native menu on macOS alone — so for two of the three
  // platforms the manual check reaches the user through here and nowhere else.
  ipcHandle('checkForUpdates', () => {
    checkForUpdatesManually(autoUpdater).catch(logError)
  })
}
