import { createRequireShim } from './requireShim.ts'

const invoke = jest.fn().mockResolvedValue('ok')
const requireShim = createRequireShim(invoke)

beforeEach(() => {
  invoke.mockClear()
})

// the exact shape the Apollo plugin uses to open its OAuth window:
//   const { ipcRenderer } = globalThis.require('electron')
test('require("electron") yields a working ipcRenderer.invoke', async () => {
  const { ipcRenderer } = requireShim('electron')
  await expect(ipcRenderer.invoke('openAuthWindow', { a: 1 })).resolves.toBe(
    'ok',
  )
  expect(invoke).toHaveBeenCalledWith('openAuthWindow', { a: 1 })
})

test('a registered channel with no args still relays', async () => {
  const { ipcRenderer } = requireShim('electron')
  await expect(ipcRenderer.invoke('userData')).resolves.toBe('ok')
  expect(invoke).toHaveBeenCalledWith('userData')
})

test('an unlisted channel is refused and never reaches the main process', async () => {
  const { ipcRenderer } = requireShim('electron')
  await expect(ipcRenderer.invoke('evilChannel')).rejects.toThrow(
    'unknown channel',
  )
  expect(invoke).not.toHaveBeenCalled()
})

// the point of the whole exercise: the renderer cannot reach the filesystem
test('no node module is reachable, however it is asked for', () => {
  for (const id of [
    'fs',
    'node:fs',
    'child_process',
    'path',
    'electron/main',
  ]) {
    expect(() => requireShim(id)).toThrow(`Cannot require("${id}")`)
  }
})

test('the refusal says where filesystem access does belong', () => {
  expect(() => requireShim('fs')).toThrow(/RPC worker/)
})
