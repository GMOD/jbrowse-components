import {
  RootAppMenuMixin,
  getOpenTrackMenuItem,
  getOpenConnectionMenuItem,
  getImportSessionMenuItem,
  getExportSessionMenuItem,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import type { Menu, SessionModelFactory } from '@jbrowse/app-core'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { addDisposer, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
} from '@jbrowse/product-core'
import AddIcon from '@mui/icons-material/Add'
import { autorun } from 'mobx'

import jbrowseWebFactory from '../jbrowseModel'
import { version } from '../version'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

type AssemblyConfig = ReturnType<typeof assemblyConfigSchemaFactory>

/**
 * #stateModel JBrowseReactAppRootModel
 *
 * composed of
 * - [BaseRootModel](../baserootmodel)
 * - [InternetAccountsMixin](../internetaccountsmixin)
 * - [RootAppMenuMixin](../rootappmenumixin)
 *
 * note: many properties of the root model are available through the session,
 * and we generally prefer using the session model (via e.g. getSession) over
 * the root model (via e.g. getRoot) in plugin code
 */
export default function RootModel({
  pluginManager,
  sessionModelFactory,
  makeWorkerInstance = () => {
    throw new Error('no makeWorkerInstance supplied')
  },
}: {
  pluginManager: PluginManager
  sessionModelFactory: SessionModelFactory
  makeWorkerInstance?: () => Worker
}) {
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  return types
    .compose(
      BaseRootModelFactory({
        pluginManager,
        jbrowseModelType: jbrowseWebFactory({
          pluginManager,
          assemblyConfigSchema,
        }),
        sessionModelType: sessionModelFactory({
          pluginManager,
          assemblyConfigSchema,
        }),
        assemblyConfigSchema,
      }),
      InternetAccountsRootModelMixin(pluginManager),
      RootAppMenuMixin(),
    )

    .volatile(self => ({
      /**
       * #volatile
       */
      version,
      /**
       * #volatile
       */
      pluginsUpdated: false,
      /**
       * #volatile
       */
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.configuration.rpc,
        {
          WebWorkerRpcDriver: {
            makeWorkerInstance,
          },
          MainThreadRpcDriver: {},
        },
      ),
      /**
       * #volatile
       */
      textSearchManager: new TextSearchManager(pluginManager),
      /**
       * #volatile
       */
      error: undefined as unknown,
    }))
    .actions(self => {
      return {
        afterCreate() {
          addDisposer(
            self,
            autorun(
              function pluginsUpdatedAutorun() {
                if (self.pluginsUpdated) {
                  // reload app to get a fresh plugin manager
                  window.location.reload()
                }
              },
              { name: 'PluginsUpdated' },
            ),
          )
        },
        /**
         * #action
         */
        setPluginsUpdated(flag: boolean) {
          self.pluginsUpdated = flag
        },
        /**
         * #action
         */
        setDefaultSession() {
          const { defaultSession } = self.jbrowse
          const { setSession } = self as unknown as {
            setSession: (arg: unknown) => void
          }
          setSession({
            ...defaultSession,
            name: `${defaultSession.name} ${new Date().toLocaleString()}`,
          })
        },
        /**
         * #action
         */
        renameCurrentSession(sessionName: string) {
          const { session } = self
          if (session) {
            const { setSession } = self as unknown as {
              setSession: (arg: unknown) => void
            }
            const snapshot = getSnapshot(session) as Record<string, unknown>
            setSession({
              ...snapshot,
              name: sessionName,
            })
          }
        },

        /**
         * #action
         */
        setError(error?: unknown) {
          self.error = error
        },
      }
    })
    .views(self => ({
      /**
       * #method
       */
      menus() {
        return processMutableMenuActions(
          [
            {
              label: 'File',
              menuItems: [
                {
                  label: 'New session',
                  icon: AddIcon,
                  onClick: () => {
                    self.setDefaultSession()
                  },
                },
                getImportSessionMenuItem(),
                getExportSessionMenuItem(),
                { type: 'divider' },
                getOpenTrackMenuItem(),
                getOpenConnectionMenuItem(),
              ],
            },
            {
              label: 'Add',
              menuItems: [],
            },
            {
              label: 'Tools',
              menuItems: [],
            },
          ],
          self.mutableMenuActions,
        )
      },
    }))
}

export type WebRootModelType = ReturnType<typeof RootModel>
export type WebRootModel = Instance<WebRootModelType>
