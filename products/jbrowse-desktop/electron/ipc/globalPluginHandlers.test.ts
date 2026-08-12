/**
 * @jest-environment node
 *
 * Node, not the default jsdom: this is main-process code.
 */

import fs from 'node:fs'

import { registerGlobalPluginHandlers } from './globalPluginHandlers.ts'
import { captureHandlers, makeTestPaths } from './testUtil.ts'

import type { AppPaths } from '../paths.ts'

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
}))

let dir: string
let paths: AppPaths
let invoke: ReturnType<typeof captureHandlers>

beforeEach(() => {
  ;({ dir, paths } = makeTestPaths())
  invoke = captureHandlers(() => {
    registerGlobalPluginHandlers(paths)
  })
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const plugins = [{ name: 'P', umdUrl: 'https://example.com/p.js' }]

test('round trips the list', async () => {
  await invoke('setGlobalPlugins', plugins)
  expect(await invoke('getGlobalPlugins')).toEqual(plugins)
})

test('a missing file is an error, not an empty list', async () => {
  // initializeFileSystem seeds it, so its absence means something is wrong with
  // the user data directory rather than that they have no global plugins — and
  // the dialog must not save over a list it never read
  await expect(invoke('getGlobalPlugins')).rejects.toThrow()
})

test('a file that parses but is not a list is refused here', async () => {
  // rather than downstream, where it reaches the renderer and is spread into a
  // plugin list — a TypeError naming neither the file nor what is wrong with it
  fs.writeFileSync(paths.globalPluginsPath, '{"not":"a list"}')
  await expect(invoke('getGlobalPlugins')).rejects.toThrow(
    /does not contain a list of plugins/,
  )
})
