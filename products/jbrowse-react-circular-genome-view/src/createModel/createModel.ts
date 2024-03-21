import React from 'react'
import assemblyManagerFactory, {
  assemblyConfigSchemaFactory,
} from '@jbrowse/core/assemblyManager'
import { PluginConstructor } from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import { UriLocation } from '@jbrowse/core/util'
import { cast, getSnapshot, Instance, SnapshotIn, types } from 'mobx-state-tree'
import corePlugins from '../corePlugins'
import createConfigModel from './createConfigModel'
import createSessionModel from './createSessionModel'
import { version } from '../version'

/**
 * #stateModel JBrowseReactCircularGenomeViewRootModel
 */
export default function createModel(
  runtimePlugins: PluginConstructor[],
  makeWorkerInstance: () => Worker = () => {
    throw new Error('no makeWorkerInstance supplied')
  },
  hydrateFn?: (
    container: Element | Document,
    initialChildren: React.ReactNode,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any,
  createRootFn?: (elt: Element | DocumentFragment) => {
    render: (node: React.ReactElement) => unknown
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
      assemblyManager: types.optional(assemblyManagerType, {}),

      /**
       * #property
       */
      config: createConfigModel(pluginManager, assemblyConfigSchema),

      /**
       * #property
       */
      internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      ),

      /**
       * #property
       */
      session: Session,
    })
    .volatile(() => ({
      adminMode: false,
      error: undefined as unknown,
      version,
    }))
    .actions(self => ({
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
          const selectedAccount = self.internetAccounts.find(account => {
            return account.internetAccountId === selectedId
          })
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

      /**
       * #action
       */
      renameCurrentSession(sessionName: string) {
        if (self.session) {
          const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
          snapshot.name = sessionName
          this.setSession(snapshot)
        }
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
      setSession(sessionSnapshot: SnapshotIn<typeof Session>) {
        self.session = cast(sessionSnapshot)
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
    .volatile(self => ({
      createRootFn,
      hydrateFn,
      rpcManager: new RpcManager(pluginManager, self.config.configuration.rpc, {
        MainThreadRpcDriver: {},
        WebWorkerRpcDriver: {
          makeWorkerInstance,
        },
      }),
      textSearchManager: new TextSearchManager(pluginManager),
    }))
  return { model: rootModel, pluginManager }
}

export type ViewStateModel = ReturnType<typeof createModel>['model']
export type ViewModel = Instance<ViewStateModel>
