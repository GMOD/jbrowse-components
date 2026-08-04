/**
 * @jest-environment node
 *
 * Node, not the default jsdom: this is main-process code, and under jsdom an fs
 * error is not `instanceof` the realm's Error — readSession's ENOENT branch would
 * silently take the wrong path in the test while being correct in the app.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { ipcMain } from 'electron'

import { getLegacyThumbnailPath, getThumbnailPath } from '../paths.ts'
import { registerSessionHandlers } from './sessionHandlers.ts'

import type { AppPaths } from '../paths.ts'
import type { IpcChannels } from './channels.ts'
import type { IpcMainInvokeEvent } from 'electron'

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  shell: { showItemInFolder: jest.fn() },
}))

type Handler = Parameters<typeof ipcMain.handle>[1]

// every handler under test ignores its event argument
const NO_EVENT = {} as IpcMainInvokeEvent

// registerSessionHandlers hands each handler to ipcMain.handle, so capture them
// there and invoke one the way the renderer's ipcRenderer.invoke would
function registerAndCapture(paths: AppPaths) {
  const captured = new Map<string, Handler>()
  jest.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
    captured.set(channel, handler)
  })
  // null window: captureThumbnail skips, which is what a headless test wants
  registerSessionHandlers(paths, () => null)
  return <K extends keyof IpcChannels>(
    channel: K,
    ...args: IpcChannels[K]['args']
  ) => captured.get(channel)!(NO_EVENT, ...args)
}

function makePaths(dir: string): AppPaths {
  return {
    userData: dir,
    recentSessionsPath: path.join(dir, 'recent_sessions.json'),
    globalPluginsPath: path.join(dir, 'globalPlugins.json'),
    quickstartDir: path.join(dir, 'quickstart'),
    thumbnailDir: path.join(dir, 'thumbnails'),
    faiDir: path.join(dir, 'fai'),
    autosaveDir: path.join(dir, 'autosaved'),
    jbrowseDocDir: path.join(dir, 'JBrowse'),
    defaultSavePath: path.join(dir, 'JBrowse', 'untitled.jbrowse'),
  }
}

let dir: string
let paths: AppPaths
let invoke: ReturnType<typeof registerAndCapture>
let consoleError: jest.SpyInstance

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'jb-sessions-'))
  paths = makePaths(dir)
  fs.mkdirSync(paths.thumbnailDir, { recursive: true })
  fs.writeFileSync(paths.recentSessionsPath, '[]')
  invoke = registerAndCapture(paths)
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
  fs.rmSync(dir, { recursive: true, force: true })
})

function writeSession(name: string) {
  const sessionPath = path.join(dir, name)
  fs.writeFileSync(
    sessionPath,
    JSON.stringify({ assemblies: [], defaultSession: { name } }),
  )
  fs.writeFileSync(
    paths.recentSessionsPath,
    JSON.stringify([{ path: sessionPath, updated: 1, name }]),
  )
  return sessionPath
}

test('deleteSessions removes the session, its entry, and both thumbnail names', async () => {
  const sessionPath = writeSession('a.jbrowse')
  // a pre-sha256 install can still hold the legacy-named thumbnail: loadThumbnail
  // only migrates one when its card is viewed, so deleting the current name alone
  // orphaned the legacy file forever
  const current = getThumbnailPath(paths, sessionPath)
  const legacy = getLegacyThumbnailPath(paths, sessionPath)
  fs.writeFileSync(current, 'data:image/png;base64,AAA')
  fs.writeFileSync(legacy, 'data:image/png;base64,BBB')

  await invoke('deleteSessions', [sessionPath])

  expect(fs.existsSync(sessionPath)).toBe(false)
  expect(fs.existsSync(current)).toBe(false)
  expect(fs.existsSync(legacy)).toBe(false)
  expect(JSON.parse(fs.readFileSync(paths.recentSessionsPath, 'utf8'))).toEqual(
    [],
  )
})

test('deleteSessions is silent for a session that never had a thumbnail', async () => {
  const sessionPath = writeSession('b.jbrowse')

  await invoke('deleteSessions', [sessionPath])

  expect(fs.existsSync(sessionPath)).toBe(false)
  // a missing thumbnail is normal (the session was never saved with a window
  // up), so it must not log — every delete used to print an ENOENT
  expect(consoleError).not.toHaveBeenCalled()
})

test('listSessions flags the entries that live in the autosave dir', async () => {
  const autosave = path.join(paths.autosaveDir, '1.json')
  fs.writeFileSync(
    paths.recentSessionsPath,
    JSON.stringify([
      { path: autosave, updated: 2 },
      { path: path.join(dir, 'saved.jbrowse'), updated: 1 },
    ]),
  )

  expect(await invoke('listSessions')).toEqual([
    { path: autosave, updated: 2, isAutosave: true },
    { path: path.join(dir, 'saved.jbrowse'), updated: 1, isAutosave: false },
  ])
})

test('loadSession rejects a file with no assemblies', async () => {
  const sessionPath = path.join(dir, 'notasession.json')
  fs.writeFileSync(sessionPath, JSON.stringify({ hello: 'world' }))

  await expect(invoke('loadSession', sessionPath)).rejects.toThrow(
    /does not contain any assemblies/,
  )
})

test('loadSession names the file when it is gone', async () => {
  await expect(
    invoke('loadSession', path.join(dir, 'missing.jbrowse')),
  ).rejects.toThrow(/no longer exists/)
})
