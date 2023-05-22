import { lazy } from 'react'
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
import { observable, autorun } from 'mobx'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import { AbstractSessionModel, SessionWithWidgets } from '@jbrowse/core/util'
import { MenuItem } from '@jbrowse/core/ui'

// icons
import AddIcon from '@mui/icons-material/Add'
import SettingsIcon from '@mui/icons-material/Settings'
import AppsIcon from '@mui/icons-material/Apps'
import FileCopyIcon from '@mui/icons-material/FileCopy'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import GetAppIcon from '@mui/icons-material/GetApp'
import PublishIcon from '@mui/icons-material/Publish'
import ExtensionIcon from '@mui/icons-material/Extension'
import StorageIcon from '@mui/icons-material/Storage'
import SaveIcon from '@mui/icons-material/Save'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import { Cable } from '@jbrowse/core/ui/Icons'

// other
import makeWorkerInstance from '../makeWorkerInstance'
import jbrowseWebFactory from '../jbrowseModel'
import { filterSessionInPlace } from '../util'
import packageJSON from '../../package.json'
import {
  BaseSession,
  BaseSessionType,
  SessionWithDialogs,
  InternetAccountsRootModelMixin,
  BaseRootModelFactory,
} from '@jbrowse/product-core'
import { HistoryManagementMixin, RootAppMenuMixin } from '@jbrowse/app-core'

const PreferencesDialog = lazy(() => import('../components/PreferencesDialog'))

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
 * #stateModel JBrowseWebRootModel
 *
 * composed of
 * - BaseRootModel
 * - InternetAccountsMixin
 *
 * note: many properties of the root model are available through the session,
 * and we generally prefer using the session model (via e.g. getSession) over
 * the root model (via e.g. getRoot) in plugin code
 */
export default function RootModel({
  pluginManager,
  sessionModelFactory,
  adminMode = false,
}: {
  pluginManager: PluginManager
  sessionModelFactory: SessionModelFactory
  adminMode?: boolean
}) {
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  const jbrowseModelType = jbrowseWebFactory({
    pluginManager,
    assemblyConfigSchema,
  })
  const sessionModelType = sessionModelFactory({
    pluginManager,
    assemblyConfigSchema,
  })
  return types
    .compose(
      BaseRootModelFactory({
        pluginManager,
        jbrowseModelType,
        sessionModelType,
        assemblyConfigSchema,
      }),
      InternetAccountsRootModelMixin(pluginManager),
      HistoryManagementMixin(),
      RootAppMenuMixin(),
    )
    .props({
      /**
       * #property
       */
      configPath: types.maybe(types.string),
    })
    .volatile(self => ({
      version: packageJSON.version,
      isAssemblyEditing: false,
      isDefaultSessionEditing: false,
      pluginsUpdated: false,
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.configuration.rpc,
        {
          WebWorkerRpcDriver: { makeWorkerInstance },
          MainThreadRpcDriver: {},
        },
      ),
      savedSessionsVolatile: observable.map<
        string,
        { name: string; [key: string]: unknown }
      >({}),
      textSearchManager: new TextSearchManager(pluginManager),
      error: undefined as unknown,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get savedSessions() {
        return [...self.savedSessionsVolatile.values()]
      },
      /**
       * #method
       */
      localStorageId(name: string) {
        return `localSaved-${name}-${self.configPath}`
      },
      /**
       * #getter
       */
      get autosaveId() {
        return `autosave-${self.configPath}`
      },
      /**
       * #getter
       */
      get previousAutosaveId() {
        return `previousAutosave-${self.configPath}`
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get savedSessionNames() {
        return self.savedSessions.map(session => session.name)
      },
      /**
       * #getter
       */
      get currentSessionId() {
        const locationUrl = new URL(window.location.href)
        const params = new URLSearchParams(locationUrl.search)
        return params?.get('session')?.split('local-')[1]
      },
    }))

    .actions(self => ({
      afterCreate() {
        for (const [key, val] of Object.entries(localStorage)
          .filter(([key, _val]) => key.startsWith('localSaved-'))
          .filter(([key]) => key.includes(self.configPath || 'undefined'))) {
          try {
            const { session } = JSON.parse(val)
            self.savedSessionsVolatile.set(key, session)
          } catch (e) {
            console.error('bad session encountered', key, val)
          }
        }
        addDisposer(
          self,
          autorun(() => {
            for (const [, val] of self.savedSessionsVolatile.entries()) {
              try {
                const key = self.localStorageId(val.name)
                localStorage.setItem(key, JSON.stringify({ session: val }))
              } catch (e) {
                // @ts-expect-error
                if (e.code === '22' || e.code === '1024') {
                  alert(
                    'Local storage is full! Please use the "Open sessions" panel to remove old sessions',
                  )
                }
              }
            }
          }),
        )

        addDisposer(
          self,
          autorun(
            () => {
              if (!self.session) {
                return
              }
              const snapshot = getSnapshot(self.session as BaseSession) || {
                name: 'empty',
              }
              const s = JSON.stringify
              sessionStorage.setItem('current', s({ session: snapshot }))
              localStorage.setItem(
                `autosave-${self.configPath}`,
                s({
                  session: {
                    ...snapshot,
                    name: `${snapshot.name}-autosaved`,
                  },
                }),
              )
            },
            { delay: 400 },
          ),
        )

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
          const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
          snapshot.name = sessionName
          this.setSession(snapshot)
        }
      },
      /**
       * #action
       */
      addSavedSession(session: { name: string }) {
        const key = self.localStorageId(session.name)
        self.savedSessionsVolatile.set(key, session)
      },
      /**
       * #action
       */
      removeSavedSession(session: { name: string }) {
        const key = self.localStorageId(session.name)
        localStorage.removeItem(key)
        self.savedSessionsVolatile.delete(key)
      },
      /**
       * #action
       */
      duplicateCurrentSession() {
        if (self.session) {
          const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
          let newSnapshotName = `${self.session.name} (copy)`
          if (self.savedSessionNames.includes(newSnapshotName)) {
            let newSnapshotCopyNumber = 2
            do {
              newSnapshotName = `${self.session.name} (copy ${newSnapshotCopyNumber})`
              newSnapshotCopyNumber += 1
            } while (self.savedSessionNames.includes(newSnapshotName))
          }
          snapshot.name = newSnapshotName
          this.setSession(snapshot)
        }
      },
      /**
       * #action
       */
      activateSession(name: string) {
        const localId = self.localStorageId(name)
        const newSessionSnapshot = localStorage.getItem(localId)
        if (!newSessionSnapshot) {
          throw new Error(
            `Can't activate session ${name}, it is not in the savedSessions`,
          )
        }

        this.setSession(JSON.parse(newSessionSnapshot).session)
      },
      /**
       * #action
       */
      saveSessionToLocalStorage() {
        if (self.session) {
          const key = self.localStorageId(self.session.name)
          self.savedSessionsVolatile.set(key, getSnapshot(self.session))
        }
      },
      loadAutosaveSession() {
        const previousAutosave = localStorage.getItem(self.previousAutosaveId)
        const autosavedSession = previousAutosave
          ? JSON.parse(previousAutosave).session
          : {}
        const { name } = autosavedSession
        autosavedSession.name = `${name.replace('-autosaved', '')}-restored`
        this.setSession(autosavedSession)
      },
      /**
       * #action
       */
      setError(error?: unknown) {
        self.error = error
      },
    }))
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
                const lastAutosave = localStorage.getItem(self.autosaveId)
                if (lastAutosave) {
                  localStorage.setItem(self.previousAutosaveId, lastAutosave)
                }
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
                self.saveSessionToLocalStorage()
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
        ...(adminMode
          ? [
              {
                label: 'Admin',
                menuItems: [
                  {
                    label: 'Open assembly manager',
                    onClick: () => self.setAssemblyEditing(true),
                  },
                  {
                    label: 'Set default session',
                    onClick: () => self.setDefaultSessionEditing(true),
                  },
                ],
              },
            ]
          : []),
        {
          label: 'Add',
          menuItems: [],
        },
        {
          label: 'Tools',
          menuItems: [
            {
              label: 'Undo',
              icon: UndoIcon,
              onClick: () => {
                if (self.history.canUndo) {
                  self.history.undo()
                }
              },
            },
            {
              label: 'Redo',
              icon: RedoIcon,
              onClick: () => {
                if (self.history.canRedo) {
                  self.history.redo()
                }
              },
            },
            { type: 'divider' },
            {
              label: 'Plugin store',
              icon: ExtensionIcon,
              onClick: () => {
                if (self.session) {
                  const widget = self.session.addWidget(
                    'PluginStoreWidget',
                    'pluginStoreWidget',
                  )
                  self.session.showWidget(widget)
                }
              },
            },
            {
              label: 'Preferences',
              icon: SettingsIcon,
              onClick: () => {
                if (self.session) {
                  ;(self.session as SessionWithDialogs).queueDialog(
                    handleClose => [
                      PreferencesDialog,
                      {
                        session: self.session,
                        handleClose,
                      },
                    ],
                  )
                }
              },
            },
          ],
        },
      ] as Menu[],
      adminMode,
    }))
}

export type WebRootModelType = ReturnType<typeof RootModel>
export type WebRootModel = Instance<WebRootModelType>
