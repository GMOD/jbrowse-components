// Safe mode is the way out of a global plugin that crashes the app: skip the
// list this launch, without discarding it. Both triggers are checked here
// because the crash-marker one fires with no user involved at all.

const mockInvoke = jest.fn()
jest.mock('electron', () => ({ ipcRenderer: { invoke: mockInvoke } }), {
  virtual: true,
})
Object.defineProperty(window, 'require', {
  value: () => ({ ipcRenderer: { invoke: mockInvoke } }),
  writable: true,
})

const LOADING_MARKER = 'jbrowse-desktop-global-plugins-loading'
const plugins = [{ name: 'P', umdUrl: 'https://example.com/p.js' }]

// safe mode is decided once, when the module is first imported, so each test
// sets up the url/marker it wants and then imports a fresh copy
async function importFresh(search: string, marker: string) {
  jest.resetModules()
  window.history.replaceState(null, '', search)
  localStorage.setItem(LOADING_MARKER, marker)
  return import('./globalPlugins.ts')
}

beforeEach(() => {
  jest.resetAllMocks()
  mockInvoke.mockResolvedValue(plugins)
  localStorage.clear()
})

test('loads the list and marks the attempt, then clears it on success', async () => {
  const g = await importFresh('/', '')
  expect(g.globalPluginSafeMode()).toBeUndefined()
  expect(await g.getGlobalPlugins()).toEqual(plugins)
  // still set: the plugins have been fetched but not yet run
  expect(localStorage.getItem(LOADING_MARKER)).toBe('1')
  g.markGlobalPluginLoadSucceeded()
  expect(localStorage.getItem(LOADING_MARKER)).toBe('')
})

test('an empty list arms nothing, so an unrelated crash is not blamed on it', async () => {
  const g = await importFresh('/', '')
  mockInvoke.mockResolvedValue([])
  expect(await g.getGlobalPlugins()).toEqual([])
  expect(localStorage.getItem(LOADING_MARKER)).toBe('')
})

test('?safeMode skips the list without touching it', async () => {
  const g = await importFresh('/?safeMode=1', '')
  expect(g.globalPluginSafeMode()).toBe('requested')
  expect(await g.getGlobalPlugins()).toEqual([])
  expect(mockInvoke).not.toHaveBeenCalled()
})

test('a valueless ?safeMode counts', async () => {
  const g = await importFresh('/?safeMode', '')
  expect(g.globalPluginSafeMode()).toBe('requested')
})

test('a launch that never finished loading them disables them next time', async () => {
  const g = await importFresh('/', '1')
  expect(g.globalPluginSafeMode()).toBe('previousLaunchFailed')
  expect(await g.getGlobalPlugins()).toEqual([])
  expect(mockInvoke).not.toHaveBeenCalled()
})

test('safe mode survives the launch it protected, rather than re-arming', async () => {
  const g = await importFresh('/', '1')
  await g.getGlobalPlugins()
  // nothing ran, so there is nothing to vouch for: clearing here would load the
  // plugins again next launch and crash on every other start
  g.markGlobalPluginLoadSucceeded()
  expect(localStorage.getItem(LOADING_MARKER)).toBe('1')
})

test('re-enabling is what turns it back off', async () => {
  const g = await importFresh('/', '1')
  // jsdom has no navigation, and says so on the virtual console
  jest.spyOn(console, 'error').mockImplementation(() => {})
  g.reloadWithGlobalPlugins()
  expect(localStorage.getItem(LOADING_MARKER)).toBe('')
})

test('a failed read degrades to no global plugins rather than throwing', async () => {
  const g = await importFresh('/', '')
  mockInvoke.mockRejectedValue(new Error('EACCES'))
  jest.spyOn(console, 'error').mockImplementation(() => {})
  expect(await g.getGlobalPlugins()).toEqual([])
  // but the editing path still reports it, so the dialog can't save over a
  // list it failed to read
  await expect(g.readGlobalPlugins()).rejects.toThrow('EACCES')
})
