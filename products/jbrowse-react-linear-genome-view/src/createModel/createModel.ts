import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyManagerFactory, {
  assemblyConfigSchemaFactory,
} from '@jbrowse/core/assemblyManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { cast, getSnapshot, types } from 'mobx-state-tree'

import createConfigModel from './createConfigModel'
import createSessionModel from './createSessionModel'
import { version } from '../version'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { UriLocation } from '@jbrowse/core/util'
import type { Instance, SnapshotIn } from 'mobx-state-tree'

/**
 * #stateModel JBrowseReactLinearGenomeViewRootModel
 */
export default function createModel({
  pluginManager,
  makeWorkerInstance = () => {
    throw new Error('no makeWorkerInstance supplied')
  },
}: {
  pluginManager: PluginManager
  makeWorkerInstance?: () => Worker
}) {
  const Session = createSessionModel(pluginManager)
  const assemblyConfig = assemblyConfigSchemaFactory(pluginManager)
  const AssemblyManager = assemblyManagerFactory(assemblyConfig, pluginManager)
  const rootModel = types
    .model('ReactLinearGenomeView', {
      /**
       * #property
       */
      config: createConfigModel(pluginManager, assemblyConfig),
      /**
       * #property
       */
      session: Session,
      /**
       * #property
       */
      assemblyManager: types.optional(AssemblyManager, {}),
      /**
       * #property
       */
      disableAddTracks: types.optional(types.boolean, false),
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
      /**
       * #volatile
       */
      adminMode: false,
      /**
       * #volatile
       */
      version,
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
        this.setSession({
          ...JSON.parse(JSON.stringify(getSnapshot(self.session))),
          name: sessionName,
        })
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
      addInternetAccount(acct: SnapshotIn<(typeof self.internetAccounts)[0]>) {
        self.internetAccounts.push(acct)
      },
      /**
       * #action
       */
      findAppropriateInternetAccount(location: UriLocation) {
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
    }))

  return rootModel
}

export type ViewStateModel = ReturnType<typeof createModel>
export type ViewModel = Instance<ViewStateModel>
