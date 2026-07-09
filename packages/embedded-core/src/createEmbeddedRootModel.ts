import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyManagerFactory, {
  assemblyConfigSchemaFactory,
} from '@jbrowse/core/assemblyManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { cast, types } from '@jbrowse/mobx-state-tree'
import { createConfigModel } from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { UriLocation } from '@jbrowse/core/util'
import type { IAnyModelType, SnapshotIn } from '@jbrowse/mobx-state-tree'

// every embedded session is composed from product-core's BaseSessionModel, which
// provides setName; requiring it here lets renameCurrentSession rename in place
// instead of rebuilding the session from a snapshot
interface SessionWithSetName {
  setName: (name: string) => void
}

/**
 * #stateModel EmbeddedRootModel
 * #category root
 * Root model shared by the single-view embedded products
 * (react-linear-genome-view, react-circular-genome-view). Each product supplies
 * its own model name, version, and session model, and may `.props()` on extra
 * fields (e.g. the LGV `disableAddTracks`/`drawerViewHeight`).
 */
export function createEmbeddedRootModel<
  SESSION extends IAnyModelType & { Type: SessionWithSetName },
>({
  name,
  version,
  pluginManager,
  sessionModelType,
  makeWorkerInstance,
}: {
  name: string
  version: string
  pluginManager: PluginManager
  sessionModelType: SESSION
  makeWorkerInstance?: () => Worker
}) {
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  return types
    .model(name, {
      /**
       * #property
       */
      config: createConfigModel(pluginManager, assemblyConfigSchema),
      /**
       * #property
       */
      session: sessionModelType,
      /**
       * #property
       */
      assemblyManager: types.optional(
        assemblyManagerFactory(assemblyConfigSchema, pluginManager),
        {},
      ),
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
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
        makeWorkerInstance,
        // when a worker factory is supplied, run RPC off the main thread by
        // default; config `defaultDriver` still overrides this
        defaultDriverName: makeWorkerInstance
          ? 'WebWorkerRpcDriver'
          : 'MainThreadRpcDriver',
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
      setSession(sessionSnapshot: SnapshotIn<SESSION>) {
        self.session = cast(sessionSnapshot)
      },
      /**
       * #action
       */
      renameCurrentSession(sessionName: string) {
        self.session.setName(sessionName)
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
}
