import { RootAppMenuMixin, processMutableMenuActions } from '@jbrowse/app-core'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { Cable } from '@jbrowse/core/ui/Icons'
import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
} from '@jbrowse/product-core'
import AddIcon from '@mui/icons-material/Add'
import GetAppIcon from '@mui/icons-material/GetApp'
import PublishIcon from '@mui/icons-material/Publish'
import StorageIcon from '@mui/icons-material/Storage'
import { autorun } from 'mobx'
import { addDisposer, cast, getSnapshot, getType, types } from 'mobx-state-tree'

import jbrowseWebFactory from '../jbrowseModel'
import { filterSessionInPlace } from '../util'
import { version } from '../version'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { SessionWithWidgets } from '@jbrowse/core/util'
import type { BaseSessionType } from '@jbrowse/product-core'
import type {
  IAnyStateTreeNode,
  IAnyType,
  Instance,
  SnapshotIn,
} from 'mobx-state-tree'

export interface Menu {
  label: string
  menuItems: MenuItem[]
}

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
            autorun(() => {
              if (self.pluginsUpdated) {
                // reload app to get a fresh plugin manager
                window.location.reload()
              }
            }),
          )
        },
        /**
         * #action
         */
        setSession(sessionSnapshot?: SnapshotIn<BaseSessionType>) {
          const oldSession = self.session
          self.session = cast(sessionSnapshot)
          if (self.session) {
            // validate all references in the session snapshot
            try {
              filterSessionInPlace(self.session, getType(self.session))
            } catch (error) {
              // throws error if session filtering failed
              self.session = oldSession
              throw error
            }
          }
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
          this.setSession({
            ...defaultSession,
            name: `${defaultSession.name} ${new Date().toLocaleString()}`,
          })
        },
        /**
         * #action
         */
        renameCurrentSession(sessionName: string) {
          if (self.session) {
            this.setSession({
              ...getSnapshot(self.session),
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

                  onClick: (session: any) => {
                    session.setDefaultSession()
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
                    // eslint-disable-next-line @typescript-eslint/no-deprecated
                    const { saveAs } = await import('file-saver-es')

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
                    } else if (session.views.length > 0) {
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
