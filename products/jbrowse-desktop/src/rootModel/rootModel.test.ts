// The autosave loop and the flush that has to land before a session is torn
// down. Both fail invisibly — the app keeps running, the writes just stop — so
// they are worth a test rather than only a comment. The autorun has already
// regressed once this way: factoring its body into an MST action (which runs
// untracked) left it with no dependencies, so it fired exactly once and quietly
// stopped autosaving.
import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from '../corePlugins.ts'
import { invokeIpc } from '../ipc.ts'
import sessionModelFactory from '../sessionModel/sessionModel.ts'
import rootModelFactory from './rootModel.ts'

jest.mock('../makeWorkerInstance.ts', () => ({
  __esModule: true,
  default: () => {},
}))
jest.mock('../ipc.ts', () => ({ invokeIpc: jest.fn() }))

const mockInvokeIpc = jest.mocked(invokeIpc)
const SESSION_PATH = '/sessions/test.jbrowse'

// the autosave's own delay, so the tests read in the same units the model does
const AUTOSAVE_DELAY_MS = 1000

function saveCount() {
  return mockInvokeIpc.mock.calls.filter(
    ([channel]) => channel === 'saveSession',
  ).length
}

// The app's own order (see pluginManagers.tsx): configure() comes after the
// root model exists and has been handed to the manager, because a plugin's
// configure reads pluginManager.rootModel — that is how plugin-menus adds its
// items to the Help menu, and configuring first left them off entirely.
function createRootModel() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  const root = rootModelFactory({ pluginManager, sessionModelFactory }).create(
    {
      // main-thread rpc, so creating the model doesn't try to start a worker
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      },
    },
    { pluginManager },
  )
  pluginManager.setRootModel(root)
  pluginManager.configure()
  root.setSessionPath(SESSION_PATH)
  root.setSession({ name: 'test' })
  return root
}

beforeEach(() => {
  jest.useFakeTimers()
  mockInvokeIpc.mockReset()
  mockInvokeIpc.mockResolvedValue(undefined)
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

test('the autosave fires again on the next change, not just once', async () => {
  const root = createRootModel()

  await jest.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
  expect(saveCount()).toBe(1)
  expect(mockInvokeIpc).toHaveBeenCalledWith(
    'saveSession',
    SESSION_PATH,
    expect.objectContaining({
      defaultSession: expect.objectContaining({ name: 'test' }),
    }),
  )

  root.session.setName('changed')
  await jest.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)

  // the one that regressed: an autorun whose reads moved into an action tracks
  // nothing and never reaches here
  expect(saveCount()).toBe(2)
  expect(mockInvokeIpc).toHaveBeenLastCalledWith(
    'saveSession',
    SESSION_PATH,
    expect.objectContaining({
      defaultSession: expect.objectContaining({ name: 'changed' }),
    }),
  )
})

test('a save that keeps failing does not feed itself', async () => {
  // A failed save reports through session.notifyError, and the autorun observes
  // the session — so if that report landed in the session's *props* it would
  // invalidate the autorun, which would save, fail, report again, once a second
  // forever. It lands in volatile state (SnackbarModel), which the snapshot does
  // not include, so a failing save stays one failing save per change.
  mockInvokeIpc.mockRejectedValue(new Error('no space left on device'))
  createRootModel()

  await jest.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
  expect(saveCount()).toBe(1)

  await jest.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 10)
  expect(saveCount()).toBe(1)
})

test('flushSession writes without waiting out the debounce', async () => {
  const root = createRootModel()

  await root.flushSession()

  // no timer advanced: quitting and returning to the start screen both destroy
  // the tree, so a flush that only scheduled a save would land nothing
  expect(saveCount()).toBe(1)
})

test('flushSession reports a failed save rather than rejecting', async () => {
  // it is awaited on the way out of the app; a rejection here would be an
  // unhandled one, and would strand the quit that is waiting on it
  mockInvokeIpc.mockRejectedValue(new Error('no space left on device'))
  const root = createRootModel()

  await expect(root.flushSession()).resolves.toBeUndefined()
  expect(root.session.snackbarMessages.length).toBe(1)
})

// The native Help menu that used to carry the update check is macOS-only —
// window.ts sets the application menu to null everywhere else — so this entry
// is the whole manual check on Windows and Linux. plugin-menus contributes
// About and Help into the same menu, so what is worth pinning is the merge:
// a second "Help" menu, or items landing in the wrong one, is how this stops
// being reachable without anything failing.
test('Check for updates sits above the plugin contributions in Help', () => {
  const root = createRootModel()
  const help = root.menus().filter(m => m.label === 'Help')

  expect(help.length).toBe(1)
  expect(
    help[0]!
      .menuItems()
      .map(item => ('label' in item ? item.label : item.type)),
  ).toEqual(['Check for updates...', 'divider', 'About', 'Help'])
})

test('the Help item asks the main process to check', () => {
  const root = createRootModel()
  const [check] = root
    .menus()
    .find(m => m.label === 'Help')!
    .menuItems()
  // narrowed rather than asserted: a divider or a submenu reaching the front of
  // this menu is exactly what the test above is about, and it should say so
  // here too rather than throw on a missing property
  if (!check || !('onClick' in check)) {
    throw new Error(`the first Help item is not clickable: ${check?.type}`)
  }
  check.onClick()

  expect(mockInvokeIpc).toHaveBeenCalledWith('checkForUpdates')
})

test('nothing is written for a session with no path to write to', async () => {
  const root = createRootModel()
  root.setSessionPath('')

  await jest.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)

  expect(saveCount()).toBe(0)
})
