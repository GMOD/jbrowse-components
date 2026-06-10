import {
  JBrowseModelF,
  RootAppMenuMixin,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { addDisposer, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
  openConnectionMenuItem,
  openTrackMenuItem,
  preferencesMenuItem,
  workspacesMenuItem,
} from '@jbrowse/product-core'
import { PreferencesDialog } from '@jbrowse/web-core'
import AddIcon from '@mui/icons-material/Add'
import GetAppIcon from '@mui/icons-material/GetApp'
import PublishIcon from '@mui/icons-material/Publish'
import { autorun } from 'mobx'

import { version } from '../version.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { SessionWithWidgets } from '@jbrowse/core/util'
import type {
  IAnyStateTreeNode,
  IAnyType,
  Instance,
} from '@jbrowse/mobx-state-tree'

type AssemblyConfig = ReturnType<typeof assemblyConfigSchemaFactory>
type SessionModelFactory = (args: {
  pluginManager: PluginManager
  assemblyConfigSchema: AssemblyConfig
}) => IAnyType

/**
 * #stateModel JBrowseReactAppRootModel
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
        jbrowseModelType: JBrowseModelF({
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
          makeWorkerInstance,
        },
      ),
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
        setPluginsUpdated() {
          self.pluginsUpdated = true
        },
        /**
         * #action
         * BaseRootModel's setDefaultSession reuses defaultSession's literal
         * name; react-app instead timestamps it so multiple "new sessions"
         * don't collide.
         */
        setDefaultSession() {
          const { defaultSession } = self.jbrowse
          self.setSession({
            ...defaultSession,
            name: `${defaultSession.name} ${new Date().toLocaleString()}`,
          })
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
                {
                  label: 'Import session…',
                  icon: PublishIcon,
                  onClick: (session: SessionWithWidgets) => {
                    const widget = session.addWidget(
                      'ImportSessionWidget',
                      'importSessionWidget',
                    )
                    session.showWidget(widget)
                  },
                },
                {
                  label: 'Export session',
                  icon: GetAppIcon,
                  onClick: async (session: IAnyStateTreeNode) => {
                    const { saveAs } = await import('@jbrowse/core/util')

                    saveAs(
                      new Blob(
                        [
                          JSON.stringify(
                            { session: getSnapshot(session) },
                            null,
                            2,
                          ),
                        ],
                        { type: 'text/plain;charset=utf-8' },
                      ),
                      'session.json',
                    )
                  },
                },

                { type: 'divider' },
                openTrackMenuItem(),
                openConnectionMenuItem(),
              ],
            },
            {
              label: 'Add',
              menuItems: [],
            },
            {
              label: 'Tools',
              menuItems: [
                preferencesMenuItem(pluginManager, PreferencesDialog),
                workspacesMenuItem(self.session),
              ],
            },
          ],
          self.mutableMenuActions,
        )
      },
    }))
}

export type WebRootModelType = ReturnType<typeof RootModel>
export type WebRootModel = Instance<WebRootModelType>
