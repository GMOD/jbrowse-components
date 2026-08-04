import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { ipcMain } from 'electron'

import type { AppPaths } from '../paths.ts'
import type { IpcChannels } from './channels.ts'
import type { IpcMainInvokeEvent } from 'electron'

// Test-only helpers for the IPC handler modules. A handler is only reachable
// through ipcMain.handle, so a test has to mock `electron`, capture what each
// register* function registers, and call it the way ipcRenderer.invoke would.
//
// Every test file using this needs its own `jest.mock('electron', ...)` — the
// mock has to be hoisted into that file's module registry, so it cannot live
// here.

type Handler = Parameters<typeof ipcMain.handle>[1]

// every handler these helpers reach ignores its event argument
const NO_EVENT = {} as IpcMainInvokeEvent

/**
 * Runs `register` with ipcMain.handle stubbed, and returns a typed invoke for the
 * channels it registered.
 */
export function captureHandlers(register: () => void) {
  const captured = new Map<string, Handler>()
  jest.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
    captured.set(channel, handler)
  })
  register()
  return <K extends keyof IpcChannels>(
    channel: K,
    ...args: IpcChannels[K]['args']
  ) => captured.get(channel)!(NO_EVENT, ...args)
}

/** A fresh temp directory and the AppPaths rooted at it. */
export function makeTestPaths() {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'jb-ipc-'))
  const paths: AppPaths = {
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
  return { dir, paths }
}
