import { dialog, shell } from 'electron'

import { ipcHandle } from './ipc/channels.ts'
import { createUpdateLog } from './updateLog.ts'
import { logError } from './util.ts'

import type { Logger } from 'electron-updater'

/**
 * The part of electron-updater's `AppUpdater` this module drives. Named rather
 * than taken whole because `AppUpdater` is an abstract class over a typed
 * EventEmitter, so a double for it can only be built by casting one through
 * `unknown`. electron.ts and window.ts hand over the real thing, which is where
 * a signature drifting upstream fails.
 */
export interface Updater {
  autoDownload: boolean
  disableWebInstaller: boolean
  disableDifferentialDownload: boolean
  forceDevUpdateConfig: boolean
  logger: Logger | null
  on(
    event: 'update-available' | 'update-downloaded',
    listener: (info: { version: string }) => void,
  ): unknown
  on(
    event: 'download-progress',
    listener: (progress: { percent: number }) => void,
  ): unknown
  checkForUpdates(): Promise<{ isUpdateAvailable: boolean } | null>
  downloadUpdate(): Promise<string[]>
  quitAndInstall(isSilent: boolean, isForceRunAfter: boolean): void
}

/**
 * Where a download's progress is drawn: the dock on macOS, the taskbar button
 * on Windows, the launcher on Unity. A fraction, or -1 to clear it.
 *
 * Narrowed to the one call rather than taking a BrowserWindow, so this module
 * still says what it drives and the tests still need no electron.
 */
export interface ProgressBar {
  setProgressBar(fraction: number): void
}

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

async function offerUpdate(
  autoUpdater: Updater,
  getProgressBar: () => ProgressBar | null,
  version: string,
) {
  if (!interactive()) {
    console.log(`Update ${version} available (CI mode, skipping dialog)`)
    return
  }
  const response = await askAboutVersion({
    version,
    title: 'Found updates',
    message: `Version ${version} is available, do you want to update now? Note: the update downloads in the background — the progress is on the app's taskbar icon, and a dialog appears once it is complete`,
    buttons: ['Yes', 'No'],
  })
  if (response === 0) {
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      // The user asked for this download, so its failure is theirs to hear
      // about: saying Yes to one that dies was otherwise indistinguishable
      // from saying No.
      getProgressBar()?.setProgressBar(-1)
      await say(
        'Update download failed',
        `Version ${version} could not be downloaded. ${describeFailure(error)}`,
      )
    }
  }
}

async function offerRestart(autoUpdater: Updater, version: string) {
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
export function checkForUpdatesInBackground(autoUpdater: Updater) {
  if (interactive()) {
    autoUpdater.checkForUpdates().catch(logError)
  }
}

/**
 * The check behind the menu item, which reports every outcome — the whole
 * difference from the background one, and why it reads the returned result
 * rather than the events, which fire for that one too. `checkForUpdates`
 * resolves `null` firing nothing at all when the updater is inactive: an
 * unpacked run, or a Linux build that is not the AppImage. Never rejects.
 */
export async function checkForUpdatesManually(autoUpdater: Updater) {
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

export function setupAutoUpdater({
  autoUpdater,
  logPath,
  getProgressBar,
}: {
  autoUpdater: Updater
  logPath: string
  /** the main window, when there is one — a check can precede it, and outlive it */
  getProgressBar: () => ProgressBar | null
}) {
  autoUpdater.logger = createUpdateLog(logPath)

  // isUpdaterActive() refuses anything unpackaged, so a dev run cannot exercise
  // any of this. Put a dev-app-update.yml beside this package's package.json
  // naming a feed — `provider: generic` over `python3 -m http.server`, holding
  // one latest-<platform>.yml and the artifact it names — and set this.
  autoUpdater.forceDevUpdateConfig = Boolean(
    process.env.JBROWSE_DEV_UPDATE_CONFIG,
  )

  // ask before fetching any bytes
  autoUpdater.autoDownload = false
  // we build no web installer, and false only warns on every Windows download
  autoUpdater.disableWebInstaller = true
  // no packager here writes a `.blockmap`, so this only cost two doomed
  // requests and an error log before falling back to the full download
  autoUpdater.disableDifferentialDownload = true

  autoUpdater.on('update-available', info => {
    offerUpdate(autoUpdater, getProgressBar, info.version).catch(logError)
  })

  // A quarter-gigabyte over a slow link is minutes in which the only thing that
  // had happened was a dialog closing, which reads as an update that did not
  // start — and quitting to "try again" is what actually loses it.
  autoUpdater.on('download-progress', ({ percent }) => {
    getProgressBar()?.setProgressBar(percent / 100)
  })

  autoUpdater.on('update-downloaded', info => {
    getProgressBar()?.setProgressBar(-1)
    offerRestart(autoUpdater, info.version).catch(logError)
  })

  // window.ts sets a native menu on macOS alone, so on the other two platforms
  // the renderer's own menu bar is the only route to a manual check.
  ipcHandle('checkForUpdates', () => {
    checkForUpdatesManually(autoUpdater).catch(logError)
  })
}
