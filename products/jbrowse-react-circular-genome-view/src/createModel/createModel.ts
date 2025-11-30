import PluginManager from '@jbrowse/core/PluginManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyManagerFactory, {
  assemblyConfigSchemaFactory,
} from '@jbrowse/core/assemblyManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { cast, getSnapshot, types } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins'
import createConfigModel from './createConfigModel'
import createSessionModel from './createSessionModel'
import { version } from '../version'

import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { UriLocation } from '@jbrowse/core/util'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel JBrowseReactCircularGenomeViewRootModel
 */
export default function createModel(
  runtimePlugins: PluginConstructor[],
  makeWorkerInstance: () => Worker = () => {
    throw new Error('no makeWorkerInstance supplied')
  },
) {
  const pluginManager = new PluginManager(
    [...corePlugins, ...runtimePlugins].map(P => new P()),
  )
  pluginManager.createPluggableElements()
  const Session = createSessionModel(pluginManager)
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  const assemblyManagerType = assemblyManagerFactory(
    assemblyConfigSchema,
    pluginManager,
  )
  const rootModel = types
    .model('ReactCircularGenomeView', {
      /**
       * #property
       */
      config: createConfigModel(pluginManager, assemblyConfigSchema),
      /**
       * #property
       */
      session: Session,
      /**
       * #property
       */
      assemblyManager: types.optional(assemblyManagerType, {}),
      /**
       * #property
       */
      internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      ),
    })
    .volatile(self => ({
      /**
       * #volatile
       */
      error: undefined as unknown,
      /**
       * #volatile
       */
      adminMode: false,
      /**
       * #volatile
       */
      version,
      /**
       * #volatile
       */
      rpcManager: new RpcManager(pluginManager, self.config.configuration.rpc, {
        WebWorkerRpcDriver: {
          makeWorkerInstance,
        },
        MainThreadRpcDriver: {},
      }),

      /**
       * #volatile
       */
      textSearchManager: new TextSearchManager(pluginManager),
    }))
    .actions(self => ({
      /**
       * #action
       */
      setSession(sessionSnapshot: SnapshotIn<typeof Session>) {
        self.session = cast(sessionSnapshot)
      },
      /**
       * #action
       */
      renameCurrentSession(sessionName: string) {
        const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
        snapshot.name = sessionName
        this.setSession(snapshot)
      },
      /**
       * #action
       */
      setError(error: unknown) {
        self.error = error
      },
      /**
       * #action
       */
      addInternetAccount(
        internetAccount: SnapshotIn<(typeof self.internetAccounts)[0]>,
      ) {
        self.internetAccounts.push(internetAccount)
      },
      /**
       * #action
       */
      findAppropriateInternetAccount(location: UriLocation) {
        // find the existing account selected from menu
        const selectedId = location.internetAccountId
        if (selectedId) {
          const selectedAccount = self.internetAccounts.find(
            a => a.internetAccountId === selectedId,
          )
          if (selectedAccount) {
            return selectedAccount
          }
        }

        // if no existing account or not found, try to find working account
        for (const account of self.internetAccounts) {
          const handleResult = account.handlesLocation(location)
          if (handleResult) {
            return account
          }
        }

        // no available internet accounts
        return null
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get jbrowse() {
        return self.config
      },
      /**
       * #getter
       */
      get pluginManager() {
        return pluginManager
      },
    }))
  return { model: rootModel, pluginManager }
}

export type ViewStateModel = ReturnType<typeof createModel>['model']
export type ViewModel = Instance<ViewStateModel>
