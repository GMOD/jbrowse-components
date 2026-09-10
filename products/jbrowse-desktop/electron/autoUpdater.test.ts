import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { dialog, ipcMain, shell } from 'electron'

import {
  askAboutVersion,
  checkForUpdatesInBackground,
  checkForUpdatesManually,
  setupAutoUpdater,
} from './autoUpdater.ts'

import type { Updater } from './autoUpdater.ts'

jest.mock('electron', () => ({
  dialog: { showMessageBox: jest.fn() },
  shell: { openExternal: jest.fn() },
  ipcMain: { handle: jest.fn() },
}))

const showMessageBox = jest.mocked(dialog.showMessageBox)
const openExternal = jest.mocked(shell.openExternal)

function click(response: number) {
  showMessageBox.mockResolvedValueOnce({ response, checkboxChecked: false })
}

// Answers the OK dialogs the reporting paths raise, so a test that expects one
// is not the one that hangs when it never comes.
function clickThrough() {
  showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false })
}

const titles = () => showMessageBox.mock.calls.map(([options]) => options.title)

// The handlers are fire-and-forget async, so an emit returns before its dialog
// has been asked for. A macrotask is past every await chain here.
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

type UpdateEvent = 'update-available' | 'update-downloaded'
type VersionListener = (info: { version: string }) => void
type ProgressListener = (progress: { percent: number }) => void

// A tuple union rather than two parameters, so destructuring narrows the
// listener from the event name and neither store needs an assertion.
type Subscribe =
  | [event: UpdateEvent, listener: VersionListener]
  | [event: 'download-progress', listener: ProgressListener]

/**
 * A stand-in for the real updater — no cast anywhere, because `Updater` is the
 * surface the module under test actually drives, so an object carrying those
 * members is one. That the real `autoUpdater` is also one is proved at
 * electron.ts's call site rather than here.
 *
 * `fire` delivers an event to whatever setupAutoUpdater subscribed.
 */
type FakeUpdater = Updater & {
  fire: (event: UpdateEvent, version: string) => void
  report: (percent: number) => void
  checkForUpdates: jest.Mock<Promise<{ isUpdateAvailable: boolean } | null>, []>
  downloadUpdate: jest.Mock<Promise<string[]>, []>
  quitAndInstall: jest.Mock<void, [boolean, boolean]>
}

function fakeUpdater(): FakeUpdater {
  const versions = new Map<UpdateEvent, VersionListener[]>()
  const progress: ProgressListener[] = []
  return {
    autoDownload: true,
    disableWebInstaller: false,
    disableDifferentialDownload: false,
    forceDevUpdateConfig: false,
    logger: null,
    on(...args: Subscribe) {
      const [event, listener] = args
      if (event === 'download-progress') {
        progress.push(listener)
      } else {
        versions.set(event, [...(versions.get(event) ?? []), listener])
      }
    },
    fire(event, version) {
      for (const listener of versions.get(event) ?? []) {
        listener({ version })
      }
    },
    report(percent) {
      for (const listener of progress) {
        listener({ percent })
      }
    },
    checkForUpdates: jest.fn(),
    downloadUpdate: jest.fn<Promise<string[]>, []>().mockResolvedValue([]),
    quitAndInstall: jest.fn(),
  }
}

const available = (isUpdateAvailable: boolean) => ({ isUpdateAvailable })

let logDir: string
let logPath: string
let progress: number[]

function setup(autoUpdater: Updater) {
  setupAutoUpdater({
    autoUpdater,
    logPath,
    getProgressBar: () => ({
      setProgressBar: (fraction: number) => progress.push(fraction),
    }),
  })
}

beforeEach(() => {
  progress = []
  showMessageBox.mockReset()
  openExternal.mockReset()
  openExternal.mockResolvedValue(undefined)
  jest.mocked(ipcMain.handle).mockReset()
  delete process.env.CI
  delete process.env.JBROWSE_DEV_UPDATE_CONFIG
  logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jbrowse-updater-'))
  logPath = path.join(logDir, 'update.log')
})

afterEach(() => {
  fs.rmSync(logDir, { recursive: true, force: true })
})

const question = {
  version: '4.3.1',
  title: 'Found updates',
  message: 'Version 4.3.1 is available, do you want to update now?',
  buttons: ['Yes', 'No'] as [string, string],
}

test('the answers are the caller-supplied buttons, in order', async () => {
  click(0)
  expect(await askAboutVersion(question)).toBe(0)
  click(1)
  expect(await askAboutVersion(question)).toBe(1)
  expect(openExternal).not.toHaveBeenCalled()
  expect(showMessageBox.mock.calls[0]![0].buttons).toEqual([
    'Yes',
    'No',
    'Release notes',
  ])
})

// a message box has no clickable links, so the notes are a button — and since
// any button closes the box, it must come back rather than count as an answer
test('release notes open the browser and ask again', async () => {
  click(2)
  click(2)
  click(0)
  expect(await askAboutVersion(question)).toBe(0)
  expect(showMessageBox).toHaveBeenCalledTimes(3)
  expect(openExternal).toHaveBeenCalledTimes(2)
  expect(openExternal).toHaveBeenLastCalledWith(
    'https://github.com/GMOD/jbrowse-components/releases/tag/v4.3.1',
  )
})

// esc/close resolves to cancelId, which must be the decline, not the notes
test('dismissing the box declines', async () => {
  click(1)
  expect(await askAboutVersion(question)).toBe(1)
  expect(showMessageBox.mock.calls[0]![0].cancelId).toBe(1)
})

// A background check that finds nothing, or fails because the laptop is on a
// train, must say nothing at all — it is the one nobody asked for.
test('the startup check reports nothing, either way', async () => {
  const updater = fakeUpdater()
  updater.checkForUpdates.mockResolvedValue(available(false))
  checkForUpdatesInBackground(updater)
  await Promise.resolve()
  updater.checkForUpdates.mockRejectedValue(new Error('ENOTFOUND github.com'))
  // logging it is all the failure gets, and that log is expected here
  const logged = jest.spyOn(console, 'error').mockImplementation(() => {})
  checkForUpdatesInBackground(updater)
  await flush()
  expect(showMessageBox).not.toHaveBeenCalled()
  expect(logged).toHaveBeenCalled()
  logged.mockRestore()
})

// ...and the menu item reports all three, which is the whole reason it exists.
test('a manual check that finds nothing says so', async () => {
  const updater = fakeUpdater()
  updater.checkForUpdates.mockResolvedValue(available(false))
  clickThrough()
  await checkForUpdatesManually(updater)
  expect(titles()).toEqual(['Up to date'])
})

test('a manual check that fails says why, without a stack', async () => {
  const updater = fakeUpdater()
  updater.checkForUpdates.mockRejectedValue(
    Object.assign(new Error('request failed'), {
      stack: 'Error: net::ERR_INTERNET_DISCONNECTED',
    }),
  )
  clickThrough()
  await checkForUpdatesManually(updater)
  expect(titles()).toEqual(['Unable to check for updates'])
  expect(showMessageBox.mock.calls[0]![0].message).toContain(
    'check your internet connection',
  )
})

// checkForUpdates resolves null without emitting anything when the updater is
// inactive — an unpacked run, a Linux build that is not the AppImage. The menu
// item used to do nothing whatsoever there, and leave a latched flag behind for
// the next background check to answer with dialogs.
test('a manual check on a build that cannot update says that', async () => {
  const updater = fakeUpdater()
  updater.checkForUpdates.mockResolvedValue(null)
  clickThrough()
  await checkForUpdatesManually(updater)
  expect(titles()).toEqual(['Cannot check for updates'])
})

// An update the user found is announced the same way whichever check found it,
// so the offer hangs off the event rather than off either caller.
test('an available update is offered and downloaded on yes', async () => {
  const updater = fakeUpdater()
  setup(updater)
  click(0)
  updater.fire('update-available', '4.4.0')
  await flush()
  expect(titles()).toEqual(['Found updates'])
  expect(updater.downloadUpdate).toHaveBeenCalled()
})

test('declining the offer downloads nothing', async () => {
  const updater = fakeUpdater()
  setup(updater)
  click(1)
  updater.fire('update-available', '4.4.0')
  await flush()
  expect(updater.downloadUpdate).not.toHaveBeenCalled()
})

// The download the user said yes to is the one whose failure they have to hear
// about: it was silent, and a download that died looked exactly like having
// said no.
test('a download that fails after yes is reported', async () => {
  const updater = fakeUpdater()
  updater.downloadUpdate.mockRejectedValue(new Error('disk full'))
  setup(updater)
  click(0)
  clickThrough()
  updater.fire('update-available', '4.4.0')
  await flush()
  expect(titles()).toEqual(['Found updates', 'Update download failed'])
  expect(showMessageBox.mock.calls[1]![0].message).toContain('disk full')
})

test('restart now installs, later does not', async () => {
  const updater = fakeUpdater()
  setup(updater)
  click(1)
  updater.fire('update-downloaded', '4.4.0')
  await flush()
  expect(updater.quitAndInstall).not.toHaveBeenCalled()
  click(0)
  updater.fire('update-downloaded', '4.4.0')
  await flush()
  expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true)
})

// The e2e suite drives the packaged app, where a modal nobody can click is a
// hung job rather than a prompt.
test('under CI nothing opens a dialog', async () => {
  process.env.CI = 'true'
  const updater = fakeUpdater()
  updater.checkForUpdates.mockResolvedValue(available(false))
  setup(updater)
  jest.spyOn(console, 'log').mockImplementation(() => {})
  updater.fire('update-available', '4.4.0')
  updater.fire('update-downloaded', '4.4.0')
  checkForUpdatesInBackground(updater)
  await checkForUpdatesManually(updater)
  await flush()
  expect(showMessageBox).not.toHaveBeenCalled()
  expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
  jest.mocked(console.log).mockRestore()
})

// Without these three, electron-updater downloads before it has asked, warns on
// every Windows download about a web installer we do not build, and reaches for
// a .blockmap beside each artifact that no packager here writes.
test('the updater is configured before any event can arrive', () => {
  const updater = fakeUpdater()
  setup(updater)
  expect(updater.autoDownload).toBe(false)
  expect(updater.disableWebInstaller).toBe(true)
  expect(updater.disableDifferentialDownload).toBe(true)
})

// The renderer's menu bar is the only one Windows and Linux have, so without
// this channel two of the three platforms have no manual check at all.
test('the manual check is reachable from the renderer', () => {
  setup(fakeUpdater())
  expect(jest.mocked(ipcMain.handle).mock.calls[0]![0]).toBe('checkForUpdates')
})

// A quarter-gigabyte over a slow link is minutes in which nothing at all had
// happened since a dialog closed, which reads as an update that did not start.
test('a download draws on the taskbar icon and clears when it lands', async () => {
  const updater = fakeUpdater()
  setup(updater)
  updater.report(0)
  updater.report(42.5)
  updater.report(100)
  expect(progress).toEqual([0, 0.425, 1])

  click(1)
  updater.fire('update-downloaded', '4.4.0')
  await flush()
  expect(progress.at(-1)).toBe(-1)
})

// otherwise the bar sits at whatever fraction it died on, for the life of the
// window, describing a download that is not happening
test('a failed download clears the taskbar too', async () => {
  const updater = fakeUpdater()
  updater.downloadUpdate.mockRejectedValue(new Error('disk full'))
  setup(updater)
  click(0)
  clickThrough()
  updater.report(30)
  updater.fire('update-available', '4.4.0')
  await flush()
  expect(progress).toEqual([0.3, -1])
})

// A packaged app has no terminal, so the default console logger meant an update
// that went wrong on someone's machine left nothing to ask them for.
test('the updater writes to the log file it was given', () => {
  const updater = fakeUpdater()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  setup(updater)
  updater.logger!.info('checking for update')

  expect(fs.readFileSync(logPath, 'utf8')).toContain('checking for update')
  jest.mocked(console.log).mockRestore()
})

// isUpdaterActive() refuses anything unpackaged, so without this the whole path
// was unreachable from a dev run and could only be exercised by cutting a
// release.
test('a dev run can be pointed at a feed, and is not by default', () => {
  const off = fakeUpdater()
  setup(off)
  expect(off.forceDevUpdateConfig).toBe(false)

  process.env.JBROWSE_DEV_UPDATE_CONFIG = '1'
  const on = fakeUpdater()
  setup(on)
  expect(on.forceDevUpdateConfig).toBe(true)
})
