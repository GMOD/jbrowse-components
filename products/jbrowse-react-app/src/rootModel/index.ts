import {
  addDisposer,
  cast,
  getSnapshot,
  getType,
  types,
  IAnyStateTreeNode,
  SnapshotIn,
  Instance,
  IAnyType,
} from 'mobx-state-tree'
import { saveAs } from 'file-saver'
import { autorun } from 'mobx'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import { AbstractSessionModel, SessionWithWidgets } from '@jbrowse/core/util'
import { MenuItem } from '@jbrowse/core/ui'
import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
  BaseSessionType,
} from '@jbrowse/product-core'

// icons
import AddIcon from '@mui/icons-material/Add'
import AppsIcon from '@mui/icons-material/Apps'
import FileCopyIcon from '@mui/icons-material/FileCopy'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import GetAppIcon from '@mui/icons-material/GetApp'
import PublishIcon from '@mui/icons-material/Publish'
import StorageIcon from '@mui/icons-material/Storage'
import SaveIcon from '@mui/icons-material/Save'
import { Cable } from '@jbrowse/core/ui/Icons'

// other
import jbrowseWebFactory from '../jbrowseModel'
import { filterSessionInPlace } from '../util'
import { RootAppMenuMixin } from '@jbrowse/app-core'

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
 * - BaseRootModelFactory
 * - InternetAccountsMixin
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
      isAssemblyEditing: false,
      isDefaultSessionEditing: false,
      pluginsUpdated: false,
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

      textSearchManager: new TextSearchManager(pluginManager),
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
        setAssemblyEditing(flag: boolean) {
          self.isAssemblyEditing = flag
        },
        /**
         * #action
         */
        setDefaultSessionEditing(flag: boolean) {
          self.isDefaultSessionEditing = flag
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
          const newSession = {
            ...defaultSession,
            name: `${defaultSession.name} ${new Date().toLocaleString()}`,
          }

          this.setSession(newSession)
        },
        /**
         * #action
         */
        renameCurrentSession(sessionName: string) {
          if (self.session) {
            const snapshot = JSON.parse(
              JSON.stringify(getSnapshot(self.session)),
            )
            snapshot.name = sessionName
            this.setSession(snapshot)
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
    .volatile(self => ({
      menus: [
        {
          label: 'File',
          menuItems: [
            {
              label: 'New session',
              icon: AddIcon,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
              onClick: (session: IAnyStateTreeNode) => {
                const sessionBlob = new Blob(
                  [JSON.stringify({ session: getSnapshot(session) }, null, 2)],
                  { type: 'text/plain;charset=utf-8' },
                )
                saveAs(sessionBlob, 'session.json')
              },
            },
            {
              label: 'Open session…',
              icon: FolderOpenIcon,
              onClick: (session: SessionWithWidgets) => {
                const widget = session.addWidget(
                  'SessionManager',
                  'sessionManager',
                )
                session.showWidget(widget)
              },
            },
            {
              label: 'Save session',
              icon: SaveIcon,
              onClick: (session: SessionWithWidgets) => {
                session.notify(`Saved session "${session.name}"`, 'success')
              },
            },
            {
              label: 'Duplicate session',
              icon: FileCopyIcon,
              onClick: (session: AbstractSessionModel) => {
                if (session.duplicateCurrentSession) {
                  session.duplicateCurrentSession()
                }
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
                    { view: session.views[0].id },
                  )
                  session.showWidget(widget)
                  if (session.views.length > 1) {
                    session.notify(
                      `This will add a track to the first view. Note: if you want to open a track in a specific view open the track selector for that view and use the add track (plus icon) in the bottom right`,
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
            { type: 'divider' },
            {
              label: 'Return to splash screen',
              icon: AppsIcon,
              onClick: () => self.setSession(undefined),
            },
          ],
        },
        {
          label: 'Add',
          menuItems: [],
        },
      ] as Menu[],
    }))
}

export type WebRootModelType = ReturnType<typeof RootModel>
export type WebRootModel = Instance<WebRootModelType>
