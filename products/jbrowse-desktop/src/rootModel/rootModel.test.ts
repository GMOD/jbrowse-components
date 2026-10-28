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
// configure reads pluginManager.rootModel to add its menu items, and
// configuring first left them off entirely.
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
    expect.objectContaining({ views: 0 }),
  )

  root.session!.setName('changed')
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
    expect.objectContaining({ views: 0 }),
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
  expect(root.session!.snackbarMessages.length).toBe(1)
})

// The native Help menu is macOS-only, so on Windows and Linux this menu is the
// only route to the update check and the MCP setup text, which the main process
// builds from this install's own execPath and app path.
test('Help holds the app items, then two the main process acts on', () => {
  const root = createRootModel()
  const help = root.menus().filter(m => m.label === 'Help')
  expect(help.length).toBe(1)

  const items = help[0]!.menuItems()
  expect(items.map(item => ('label' in item ? item.label : item.type))).toEqual(
    ['About', 'Help', 'Check for updates...', 'Connect an AI agent...'],
  )
  for (const [index, channel] of [
    [2, 'checkForUpdates'],
    [3, 'showConnectAgent'],
  ] as const) {
    const item = items[index]
    if (!item || !('onClick' in item)) {
      throw new Error(`Help item ${index} is not clickable: ${item?.type}`)
    }
    item.onClick()
    expect(mockInvokeIpc).toHaveBeenCalledWith(channel)
  }
})

test('nothing is written for a session with no path to write to', async () => {
  const root = createRootModel()
  root.setSessionPath('')

  await jest.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)

  expect(saveCount()).toBe(0)
})

// OpenSequenceDialog's Cancel calls onClose() and chains .catch on the result,
// so a synchronous onClose here made every Cancel throw a TypeError
test('Open genome cancels through a promise and closes the dialog', async () => {
  const root = createRootModel()
  const item = root
    .menus()
    .find(m => m.label === 'File')!
    .menuItems()
    .find(m => 'label' in m && m.label === 'Open genome...')
  if (!item || !('onClick' in item)) {
    throw new Error('no clickable Open genome item')
  }
  item.onClick()
  const { onClose } = root.session!.DialogProps as {
    onClose: () => Promise<void>
  }
  await expect(onClose()).resolves.toBeUndefined()
  expect(root.session!.DialogComponent).toBeUndefined()
})

// the plugin store's add and remove drop setPluginsUpdated's promise, so a
// reload that fails has to say so itself
test('a plugin reload that fails is reported on the session it left open', async () => {
  const root = createRootModel()
  root.setOpenNewSessionCallback(async () => {
    throw new Error('plugin reload failed')
  })

  await root.setPluginsUpdated()

  expect(
    root.session!.snackbarMessages.map((m: { message: string }) => m.message),
  ).toEqual(['Error: plugin reload failed'])
})
