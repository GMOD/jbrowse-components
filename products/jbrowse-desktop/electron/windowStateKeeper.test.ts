/**
 * @jest-environment node
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { app, screen } from 'electron'

import windowStateKeeper from './windowStateKeeper.ts'

jest.mock('electron', () => ({
  app: { getPath: jest.fn() },
  screen: { getAllDisplays: jest.fn() },
}))

const DEFAULTS = { defaultWidth: 1400, defaultHeight: 800 }

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'jb-winstate-'))
  jest.mocked(app.getPath).mockReturnValue(dir)
  // one 1920x1080 display at the origin; only `bounds` is read
  jest
    .mocked(screen.getAllDisplays)
    .mockReturnValue([
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    ] as Electron.Display[])
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function writeState(state: unknown) {
  fs.writeFileSync(path.join(dir, 'window-state.json'), JSON.stringify(state))
}

test('restores bounds that land on a display', () => {
  writeState({ x: 10, y: 20, width: 900, height: 600 })

  const keeper = windowStateKeeper(DEFAULTS)

  expect([keeper.x, keeper.y, keeper.width, keeper.height]).toEqual([
    10, 20, 900, 600,
  ])
})

test('drops bounds for a display that is no longer connected', () => {
  writeState({ x: 9000, y: 9000, width: 900, height: 600 })

  const keeper = windowStateKeeper(DEFAULTS)

  expect(keeper.x).toBeUndefined()
  expect([keeper.width, keeper.height]).toEqual([1400, 800])
})

// A maximized/fullscreen entry is accepted without usable bounds, and
// BrowserWindow handed an undefined width falls back to its own 800x600 rather
// than this app's default — which the user only discovers on unmaximize.
test('a maximized entry with no bounds still yields the app default size', () => {
  writeState({ isMaximized: true })

  const keeper = windowStateKeeper(DEFAULTS)

  expect([keeper.width, keeper.height]).toEqual([1400, 800])
})

test('a saved zero size is replaced by the default', () => {
  writeState({ isFullScreen: true, width: 0, height: 0 })

  const keeper = windowStateKeeper(DEFAULTS)

  expect([keeper.width, keeper.height]).toEqual([1400, 800])
})

test('no saved state at all is the default size', () => {
  const keeper = windowStateKeeper(DEFAULTS)

  expect([keeper.x, keeper.width, keeper.height]).toEqual([
    undefined,
    1400,
    800,
  ])
})
