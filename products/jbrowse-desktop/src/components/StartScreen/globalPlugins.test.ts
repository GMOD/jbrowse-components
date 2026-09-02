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
async function importFresh(search: string, marker?: string) {
  jest.resetModules()
  window.history.replaceState(null, '', search)
  if (marker === undefined) {
    localStorage.removeItem(LOADING_MARKER)
  } else {
    localStorage.setItem(LOADING_MARKER, marker)
  }
  return import('./globalPlugins.ts')
}

beforeEach(() => {
  jest.resetAllMocks()
  mockInvoke.mockResolvedValue(plugins)
  localStorage.clear()
})

test('loads the list and marks the attempt, then clears it on success', async () => {
  const g = await importFresh('/')
  expect(g.globalPluginSafeMode()).toBeUndefined()
  expect((await g.getGlobalPlugins()).plugins).toEqual(plugins)
  // still set, and naming what was about to run, so the launch after a crash
  // can say which plugins it was
  expect(JSON.parse(localStorage.getItem(LOADING_MARKER)!)).toEqual([
    'P (https://example.com/p.js)',
  ])
  g.markGlobalPluginLoadFinished()
  expect(localStorage.getItem(LOADING_MARKER)).toBeNull()
})

test('closing the window during the load clears the marker', async () => {
  const g = await importFresh('/')
  await g.getGlobalPlugins()
  expect(localStorage.getItem(LOADING_MARKER)).not.toBeNull()
  window.dispatchEvent(new Event('pagehide'))
  expect(localStorage.getItem(LOADING_MARKER)).toBeNull()
})

test('a reset forgets the crash along with the list it blamed', async () => {
  const g = await importFresh('/', JSON.stringify(['P (x)']))
  g.clearGlobalPluginLoadMarker()
  expect(localStorage.getItem(LOADING_MARKER)).toBeNull()
})

test('the launch after a crash can name what was loading', async () => {
  const g = await importFresh('/', JSON.stringify(['P (x)', 'Q (y)']))
  expect(g.globalPluginSafeMode()).toBe('previousLaunchFailed')
  expect(g.globalPluginSafeModeSuspects()).toEqual(['P (x)', 'Q (y)'])
})

test('a marker from a build that did not record names still means safe mode', async () => {
  const g = await importFresh('/', '1')
  expect(g.globalPluginSafeMode()).toBe('previousLaunchFailed')
  // nothing to accuse, which is the pre-upgrade behaviour and not an error
  expect(g.globalPluginSafeModeSuspects()).toEqual([])
})

test('nothing is accused when safe mode was asked for', async () => {
  const g = await importFresh('/?safeMode=1', JSON.stringify(['P (x)']))
  expect(g.globalPluginSafeModeSuspects()).toEqual([])
})

test('a disabled entry is kept but not loaded', async () => {
  const g = await importFresh('/')
  const off = {
    name: 'Off',
    umdUrl: 'https://example.com/off.js',
    disabled: true,
  }
  mockInvoke.mockResolvedValue([...plugins, off])
  // the dialog edits the whole list, so it has to see the entry it is going to
  // switch back on
  expect(await g.readGlobalPlugins()).toEqual([...plugins, off])
  expect((await g.getGlobalPlugins()).plugins).toEqual(plugins)
})

test('a list with everything switched off arms nothing', async () => {
  const g = await importFresh('/')
  mockInvoke.mockResolvedValue([{ ...plugins[0], disabled: true }])
  expect((await g.getGlobalPlugins()).plugins).toEqual([])
  // nothing ran, so a crash after this point is not theirs to answer for
  expect(localStorage.getItem(LOADING_MARKER)).toBeNull()
})

test('enabling drops the flag rather than writing false', async () => {
  const g = await importFresh('/')
  const entry = { name: 'P', umdUrl: 'https://example.com/p.js' }
  const off = g.withDisabled(entry, true)
  expect(off).toEqual({ ...entry, disabled: true })
  // so a list toggled twice is the same file as one never touched
  expect(g.withDisabled(off, false)).toEqual(entry)
  expect('disabled' in g.withDisabled(off, false)).toBe(false)
})

test('an empty list arms nothing, so an unrelated crash is not blamed on it', async () => {
  const g = await importFresh('/')
  mockInvoke.mockResolvedValue([])
  expect((await g.getGlobalPlugins()).plugins).toEqual([])
  expect(localStorage.getItem(LOADING_MARKER)).toBeNull()
})

test('?safeMode skips the list without touching it', async () => {
  const g = await importFresh('/?safeMode=1')
  expect(g.globalPluginSafeMode()).toBe('requested')
  expect((await g.getGlobalPlugins()).plugins).toEqual([])
  expect(mockInvoke).not.toHaveBeenCalled()
})

test('a valueless ?safeMode counts', async () => {
  const g = await importFresh('/?safeMode')
  expect(g.globalPluginSafeMode()).toBe('requested')
})

test('a launch that never finished loading them disables them next time', async () => {
  const g = await importFresh('/', '1')
  expect(g.globalPluginSafeMode()).toBe('previousLaunchFailed')
  expect((await g.getGlobalPlugins()).plugins).toEqual([])
  expect(mockInvoke).not.toHaveBeenCalled()
})

test('safe mode survives the launch it protected, rather than re-arming', async () => {
  const g = await importFresh('/', '1')
  await g.getGlobalPlugins()
  // nothing ran, so there is nothing to vouch for: clearing here would load the
  // plugins again next launch and crash on every other start
  g.markGlobalPluginLoadFinished()
  expect(localStorage.getItem(LOADING_MARKER)).toBe('1')
})

test('re-enabling is what turns it back off', async () => {
  const g = await importFresh('/', '1')
  // jsdom has no navigation, and says so on the virtual console
  jest.spyOn(console, 'error').mockImplementation(() => {})
  g.reloadWithGlobalPlugins()
  expect(localStorage.getItem(LOADING_MARKER)).toBeNull()
})

test('a failed read degrades to no global plugins rather than throwing', async () => {
  const g = await importFresh('/')
  mockInvoke.mockRejectedValue(new Error('EACCES'))
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const { plugins: loaded, readError } = await g.getGlobalPlugins()
  expect(loaded).toEqual([])
  // ...but not silently: the user's plugins have just vanished from every
  // session, and the caller has somewhere to say why
  expect(readError).toEqual(new Error('EACCES'))
  // but the editing path still reports it, so the dialog can't save over a
  // list it failed to read
  await expect(g.readGlobalPlugins()).rejects.toThrow('EACCES')
})
