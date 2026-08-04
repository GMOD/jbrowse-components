// type-only, so it is erased before the stub below runs — but it is also what
// makes this file a module, keeping `mockInvoke` out of the global scope the
// other electron-stubbing test files share
import type { invokeIpc as InvokeIpc } from './ipc.ts'

// invokeIpc's real job is compile-time — it makes the channel name, the
// arguments and the return type checkable against the same IpcChannels the main
// process registers handlers under. What is worth pinning at runtime is the
// wiring underneath: it destructures window.require('electron') at module
// scope, which is what lets every test in this package stub the main process by
// replacing window.require before importing.

const mockInvoke = jest.fn()
jest.mock('electron', () => ({ ipcRenderer: { invoke: mockInvoke } }), {
  virtual: true,
})
Object.defineProperty(window, 'require', {
  value: () => ({ ipcRenderer: { invoke: mockInvoke } }),
  writable: true,
})

// imported dynamically: the module reads window.require at import time, and a
// static import would be hoisted above the stub above
let invokeIpc: typeof InvokeIpc
beforeAll(async () => {
  ;({ invokeIpc } = await import('./ipc.ts'))
})

beforeEach(() => {
  mockInvoke.mockReset()
})

test('forwards the channel and its arguments unchanged', async () => {
  mockInvoke.mockResolvedValue(undefined)
  await invokeIpc('renameSession', '/tmp/a.jbrowse', 'new name')
  expect(mockInvoke).toHaveBeenCalledWith(
    'renameSession',
    '/tmp/a.jbrowse',
    'new name',
  )
})

test('forwards a channel that takes no arguments', async () => {
  mockInvoke.mockResolvedValue('/home/user/.config/JBrowse')
  await expect(invokeIpc('userData')).resolves.toBe(
    '/home/user/.config/JBrowse',
  )
  expect(mockInvoke).toHaveBeenCalledWith('userData')
})

test('rejects when the main-process handler throws', async () => {
  mockInvoke.mockRejectedValue(new Error('ENOENT'))
  await expect(invokeIpc('loadSession', '/gone.jbrowse')).rejects.toThrow(
    'ENOENT',
  )
})
