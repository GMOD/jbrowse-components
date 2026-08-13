import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import { InternetAccountType } from '@jbrowse/core/pluggableElementTypes'
import {
  BaseInternetAccountConfig,
  InternetAccount,
} from '@jbrowse/core/pluggableElementTypes/models'
import { isAlive, types } from '@jbrowse/mobx-state-tree'

import corePlugins from '../../corePlugins.ts'
import rootModelFactory from '../../rootModel/rootModel.ts'
import sessionModelFactory from '../../sessionModel/sessionModel.ts'
import { destroyPluginManager } from './util.tsx'

jest.mock('../../makeWorkerInstance.ts', () => ({
  __esModule: true,
  default: () => {},
}))
jest.mock('../../ipc.ts', () => ({ invokeIpc: jest.fn() }))

// The same contract jbrowse-web pins in tests/pluginLifecycleHooks.test.tsx, at
// desktop's own teardown call site. Kept as its own small account rather than
// importing web's fixture, because the two products share no test module and a
// cross-product relative import would be the only way to.
//
// Desktop reaches this on four routes — Open session, Open link, Return to start
// screen, and a launch target (a jbrowse:// link, an OS open-file, a
// second-instance argv) — all of which land in `replacePluginManager`.
const record = {
  socketOpen: false,
  listenerAttached: false,
  aborted: false,
  hookRan: false,
}

const apolloShapedConfigSchema = ConfigurationSchema(
  'ApolloShapedInternetAccount',
  {},
  { baseConfiguration: BaseInternetAccountConfig, explicitlyTyped: true },
)

// a socket on a volatile, a window listener and an AbortController — the three
// things MST teardown cannot reach on its own, which is why Apollo releases them
// from beforeDestroy rather than relying on the node dying
const apolloShapedInternetAccount = InternetAccount.named(
  'ApolloShapedInternetAccount',
)
  .props({
    type: types.literal('ApolloShapedInternetAccount'),
    configuration: ConfigurationReference(apolloShapedConfigSchema),
  })
  .volatile(() => ({
    controller: new AbortController(),
    onUnload: () => {},
    socketHandlers: new Map<string, () => void>(),
  }))
  .actions(self => ({
    afterCreate() {
      globalThis.addEventListener('beforeunload', self.onUnload)
      self.socketHandlers.set('COMMON', () => {})
      record.listenerAttached = true
      record.socketOpen = true
    },
    beforeDestroy() {
      globalThis.removeEventListener('beforeunload', self.onUnload)
      self.controller.abort()
      self.socketHandlers.clear()
      record.listenerAttached = false
      record.aborted = true
      record.socketOpen = false
      record.hookRan = true
    },
  }))

class ApolloShapedPlugin extends Plugin {
  name = 'ApolloShapedPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addInternetAccountType(
      () =>
        new InternetAccountType({
          name: 'ApolloShapedInternetAccount',
          configSchema: apolloShapedConfigSchema,
          stateModel: apolloShapedInternetAccount,
        }),
    )
  }
}

function createPluginManager() {
  const pluginManager = new PluginManager([
    ...corePlugins.map(P => new P()),
    new ApolloShapedPlugin(),
  ])
  pluginManager.createPluggableElements()
  const root = rootModelFactory({ pluginManager, sessionModelFactory }).create(
    {
      jbrowse: {
        // main-thread rpc, so creating the model doesn't try to start a worker
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
        internetAccounts: [
          {
            type: 'ApolloShapedInternetAccount',
            internetAccountId: 'apolloShaped',
            name: 'Apollo-shaped account',
          },
        ],
      },
    },
    { pluginManager },
  )
  pluginManager.setRootModel(root)
  pluginManager.configure()
  root.setSession({ name: 'test' })
  return { pluginManager, root }
}

beforeEach(() => {
  record.socketOpen = false
  record.listenerAttached = false
  record.aborted = false
  record.hookRan = false
})

test('replacing a plugin manager runs a plugin beforeDestroy', async () => {
  const { pluginManager, root } = createPluginManager()
  expect(root.internetAccounts).toHaveLength(1)
  expect(record.socketOpen).toBe(true)
  expect(record.listenerAttached).toBe(true)

  destroyPluginManager(pluginManager)

  // detach is synchronous; the destroy that runs the hooks is a task later, so
  // the swap that follows sees a live tree (ADR-069)
  expect(isAlive(root)).toBe(true)
  await new Promise(resolve => setTimeout(resolve, 0))

  expect(record.socketOpen).toBe(false)
  expect(record.listenerAttached).toBe(false)
  expect(record.aborted).toBe(true)
  expect(record.hookRan).toBe(true)
  expect(isAlive(root)).toBe(false)
})

test('the worker pool stops at the detach, not at the deferred destroy', () => {
  const { pluginManager, root } = createPluginManager()
  const destroySpy = jest.spyOn(root.rpcManager, 'destroy')

  destroyPluginManager(pluginManager)

  // the whole reason detach exists as a separate step: everything reaching
  // outside the tree has to stop when the Loader lets go, not a task later
  expect(destroySpy).toHaveBeenCalledTimes(1)
  expect(root.detachDisposers).toHaveLength(0)
})
