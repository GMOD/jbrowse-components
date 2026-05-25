import {
  JBrowseModelF,
  RootAppMenuMixin,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { Cable } from '@jbrowse/core/ui/Icons'
import { addDisposer, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
} from '@jbrowse/product-core'
import { PreferencesDialog } from '@jbrowse/web-core'
import AddIcon from '@mui/icons-material/Add'
import GetAppIcon from '@mui/icons-material/GetApp'
import PublishIcon from '@mui/icons-material/Publish'
import SettingsIcon from '@mui/icons-material/Settings'
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard'
import StorageIcon from '@mui/icons-material/Storage'
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

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
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
                {
                  label: 'Open track...',
                  icon: StorageIcon,
                  onClick: (session: SessionWithWidgets) => {
                    if (session.views.length === 0) {
                      session.notify('Please open a view to add a track first')
                    } else {
                      const widget = session.addWidget(
                        'AddTrackWidget',
                        'addTrackWidget',
                        { view: session.views[0]!.id },
                      )
                      session.showWidget(widget)
                      if (session.views.length > 1) {
                        session.notify(
                          'This will add a track to the first view. Note: if you want to open a track in a specific view open the track selector for that view and use the add track (plus icon) in the bottom right',
                        )
                      }
                    }
                  },
                },
                {
                  label: 'Open connection...',
                  icon: Cable,
                  onClick: (session: SessionWithWidgets) => {
                    const widget = session.addWidget(
                      'AddConnectionWidget',
                      'addConnectionWidget',
                    )
                    session.showWidget(widget)
                  },
                },
              ],
            },
            {
              label: 'Add',
              menuItems: [],
            },
            {
              label: 'Tools',
              menuItems: [
                {
                  label: 'Preferences',
                  icon: SettingsIcon,
                  onClick: () => {
                    self.session?.queueDialog((handleClose: () => void) => [
                      PreferencesDialog,
                      {
                        session: self.session,
                        pluginManager,
                        handleClose,
                      },
                    ])
                  },
                },
                {
                  label: 'Use workspaces',
                  icon: SpaceDashboardIcon,
                  type: 'checkbox',
                  checked: self.session?.useWorkspaces ?? false,
                  helpText:
                    'Workspaces allow you to organize views into tabs and tiles. You can drag views between tabs or split them side-by-side.',
                  onClick: () => {
                    self.session?.setUseWorkspaces(!self.session.useWorkspaces)
                  },
                },
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
