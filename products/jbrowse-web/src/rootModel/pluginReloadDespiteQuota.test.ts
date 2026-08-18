import PluginManager from '@jbrowse/core/PluginManager'
import { destroy, isAlive } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'
import sessionModelFactory from '../sessionModel/index.ts'
import rootModelFactory from './rootModel.ts'

jest.mock('../makeWorkerInstance', () => () => {})

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

afterEach(() => {
  for (const root of roots) {
    if (isAlive(root)) {
      destroy(root)
    }
  }
  roots.length = 0
  jest.restoreAllMocks()
  sessionStorage.clear()
  localStorage.clear()
})

// The sessionStorage mirror and the plugin reload share one autorun, and the
// reload used to sit inside the mirror's try. So an exceeded quota — the very
// failure the catch beside it exists to report — also ate the reload request:
// the plugin the user just installed never loaded, and the only thing said out
// loud was an auto-save error that reads as unrelated. Nothing about the reload
// depends on that write, since the replacement app boots from the snapshot
// handed to the callback rather than from sessionStorage.
test('a plugin install still reloads when sessionStorage is full', async () => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('exceeded the quota')
  })
  const root = makeRoot()
  const reloads: Record<string, unknown>[] = []
  root.setReloadPluginManagerCallback((_config, session) => {
    reloads.push(session)
  })

  root.setPluginsUpdated()
  // the autosave autorun is debounced 400ms
  await new Promise(r => {
    setTimeout(r, 800)
  })

  expect(reloads).toHaveLength(1)
  expect(reloads[0]).toEqual(expect.objectContaining({ name: 'testSession' }))
})
