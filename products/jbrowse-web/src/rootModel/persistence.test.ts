import PluginManager from '@jbrowse/core/PluginManager'
import { destroy, isAlive } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'
import sessionModelFactory from '../sessionModel/index.ts'
import rootModelFactory from './rootModel.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// The autosave autorun is debounced, so nothing it writes lands during a test
// that doesn't wait. That is exactly the window under test: what a tab closed
// mid-debounce leaves behind for the next load to restore.
//
// Every root has to be destroyed, and before sessionStorage is cleared: a live
// one's debounced autorun fires ~400ms later and writes into whichever test is
// running by then.
type Root = ReturnType<ReturnType<typeof rootModelFactory>['create']>

const roots: Root[] = []

function makeRoot() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const root = rootModelFactory({ pluginManager, sessionModelFactory }).create({
    jbrowse: {
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
  root.setSession({ name: 'testSession' })
  roots.push(root)
  return root
}

function storedSessionName() {
  const raw = sessionStorage.getItem('current')
  return raw === null
    ? undefined
    : (JSON.parse(raw) as { session: { name: string } }).session.name
}

function unload() {
  window.dispatchEvent(new Event('beforeunload'))
}

afterEach(() => {
  for (const root of roots) {
    if (isAlive(root)) {
      destroy(root)
    }
  }
  roots.length = 0
  sessionStorage.clear()
  localStorage.clear()
})

test('unload writes the session even though the autosave is still debounced', () => {
  makeRoot()
  // nothing yet: the debounce has not elapsed
  expect(storedSessionName()).toBeUndefined()

  unload()

  expect(storedSessionName()).toBe('testSession')
})

test('unload writes the latest name, not the one from the last debounce tick', () => {
  const root = makeRoot()
  unload()
  expect(storedSessionName()).toBe('testSession')

  root.session!.setName('renamed since')
  unload()

  expect(storedSessionName()).toBe('renamed since')
})

test('a destroyed root model stops writing on unload', () => {
  const root = makeRoot()
  destroy(root)

  unload()

  // reloadPluginManager builds a replacement while the old model is torn down;
  // a listener left behind would write the dead model's session over the live one
  expect(storedSessionName()).toBeUndefined()
})

test('a replacement root model is the one that wins the unload write', () => {
  const first = makeRoot()
  first.session!.setName('old session')
  destroy(first)

  const second = makeRoot()
  second.session!.setName('new session')

  unload()

  expect(storedSessionName()).toBe('new session')
})
