import type { JBrowseConfig } from './types.ts'

// fetchConfig is the single door a config the user did not open from disk comes
// through — a jbrowse:// link, or a start-screen favorite's url. Both are
// reachable by someone other than the user, so the plugin gate lives there
// rather than at each caller. These pin that it is actually wired up: an
// ungated caller would hand PluginLoader remote javascript to require() into a
// renderer with Node.

const mockInvoke = jest.fn()
jest.mock('electron', () => ({ ipcRenderer: { invoke: mockInvoke } }), {
  virtual: true,
})
// fetchConfig.ts reaches electron through window.require, not an import
Object.defineProperty(window, 'require', {
  value: () => ({ ipcRenderer: { invoke: mockInvoke } }),
  writable: true,
})

// stub the network rather than mocking @jbrowse/core/util: spreading that
// module's namespace to keep its other exports evaluates every getter on it,
// including ones with import side effects that blow up under jest. fetchJson is
// a thin wrapper over global fetch, so this reaches the same seam.
const mockFetch = jest.fn()
globalThis.fetch = mockFetch
const respondWith = (body: unknown) => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  })
}

const mockCheckPlugins = jest.fn()
jest.mock('@jbrowse/core/checkPlugins', () => ({
  checkPlugins: (...args: unknown[]) => mockCheckPlugins(...args),
}))

// imported dynamically, not statically: fetchConfig.ts destructures
// window.require('electron') at module scope, and a static import is hoisted
// above the stub above, so it would evaluate first and throw
let fetchConfig: (url: string) => Promise<JBrowseConfig>
beforeAll(async () => {
  ;({ fetchConfig } = await import('./fetchConfig.ts'))
})

const url = 'https://example.org/config.json'
const unknownPlugin = { name: 'Evil', umdUrl: 'https://evil.example/p.js' }

beforeEach(() => {
  mockInvoke.mockReset()
  mockCheckPlugins.mockReset()
  mockFetch.mockReset()
})

test('a remote config with unknown plugins asks the user first', async () => {
  respondWith({ plugins: [unknownPlugin], tracks: [] })
  mockCheckPlugins.mockResolvedValue(false)
  mockInvoke.mockResolvedValue(true)

  await fetchConfig(url)

  expect(mockInvoke).toHaveBeenCalledWith('confirmUntrustedPlugins', [
    { description: 'UMD plugin Evil', url: 'https://evil.example/p.js' },
  ])
})

test('declining leaves the config unusable rather than loading it', async () => {
  respondWith({ plugins: [unknownPlugin], tracks: [] })
  mockCheckPlugins.mockResolvedValue(false)
  mockInvoke.mockResolvedValue(false)

  await expect(fetchConfig(url)).rejects.toThrow(/not trusted/)
})

test('a store-known plugin loads without bothering the user', async () => {
  respondWith({ plugins: [unknownPlugin], tracks: [] })
  mockCheckPlugins.mockResolvedValue(true)

  await expect(fetchConfig(url)).resolves.toMatchObject({
    plugins: [unknownPlugin],
  })
  expect(mockInvoke).not.toHaveBeenCalled()
})

// the common case: jbrowse.org demo configs, favorites with no plugins at all
test('a config with no plugins needs neither a check nor a prompt', async () => {
  respondWith({ tracks: [] })

  await fetchConfig(url)

  expect(mockCheckPlugins).not.toHaveBeenCalled()
  expect(mockInvoke).not.toHaveBeenCalled()
})
