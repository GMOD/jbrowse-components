import { lazy } from 'react'

import {
  HistoryManagementMixin,
  RootAppMenuMixin,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { readConfObject } from '@jbrowse/core/configuration'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { Cable, DNA } from '@jbrowse/core/ui/Icons'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { AssemblyManager } from '@jbrowse/plugin-data-management'
import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
} from '@jbrowse/product-core'
import AddIcon from '@mui/icons-material/Add'
import ExtensionIcon from '@mui/icons-material/Extension'
import FileCopyIcon from '@mui/icons-material/FileCopy'
import GetAppIcon from '@mui/icons-material/GetApp'
import PublishIcon from '@mui/icons-material/Publish'
import RedoIcon from '@mui/icons-material/Redo'
import SettingsIcon from '@mui/icons-material/Settings'
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard'
import StarIcon from '@mui/icons-material/Star'
import StorageIcon from '@mui/icons-material/Storage'
import UndoIcon from '@mui/icons-material/Undo'

import packageJSON from '../../package.json' with { type: 'json' }
import jbrowseWebFactory from '../jbrowseModel.ts'
import makeWorkerInstance from '../makeWorkerInstance.ts'
import { setupSessionDB, setupSessionStorageAutosave } from './persistence.ts'
import { buildSessionListSubmenu } from './sessionMenus.ts'

import type { SessionDB, SessionMetadata } from '../types.ts'
import type { Menu } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyType, Instance } from '@jbrowse/mobx-state-tree'
import type { BaseSession } from '@jbrowse/product-core'
import type { WebRootModelInterface } from '@jbrowse/web-core'
import type { IDBPDatabase } from 'idb'

// lazies
const SetDefaultSession = lazy(
  () => import('../components/SetDefaultSession.tsx'),
)
const PreferencesDialog = lazy(
  () => import('../components/PreferencesDialog.tsx'),
)

type AssemblyConfig = ReturnType<typeof assemblyConfigSchemaFactory>
type SessionModelFactory = (args: {
  pluginManager: PluginManager
  assemblyConfigSchema: AssemblyConfig
}) => IAnyType

/**
 * #stateModel JBrowseWebRootModel
 *
 * composed of
 * - [BaseRootModel](../baserootmodel)
 * - [InternetAccountsMixin](../internetaccountsmixin)
 * - [HistoryManagementMixin](../historymanagementmixin)
 * - [RootAppMenuMixin](../rootappmenumixin)
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
    adminMode,
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
      /**
       * #volatile
       */
      adminMode,
      /**
       * #volatile
       */
      sessionDB: undefined as IDBPDatabase<SessionDB> | undefined,
      /**
       * #volatile
       */
      version: `${packageJSON.version} (${process.env.BUILD_GIT_HASH ?? 'dev'})`,
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
          WebWorkerRpcDriver: { makeWorkerInstance },
          MainThreadRpcDriver: {},
        },
      ),
      /**
       * #volatile
       */
      savedSessionMetadata: undefined as SessionMetadata[] | undefined,
      /**
       * #volatile
       */
      textSearchManager: new TextSearchManager(pluginManager),
      /**
       * #volatile
       */
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      error: undefined as unknown,
      /**
       * #volatile
       */
      reloadPluginManagerCallback: (
        _configSnapshot: Record<string, unknown>,
        _sessionSnapshot: Record<string, unknown>,
      ) => {
        console.error('reloadPluginManagerCallback unimplemented')
      },
    }))

    .actions(self => ({
      /**
       * #action
       */
      setSavedSessionMetadata(sessions: SessionMetadata[]) {
        self.savedSessionMetadata = sessions
      },

      /**
       * #action
       */
      async fetchSessionMetadata() {
        if (self.sessionDB) {
          const ret = await self.sessionDB.getAll('metadata')
          this.setSavedSessionMetadata(
            ret
              .filter(f => f.configPath === (self.configPath ?? ''))
              .sort((a, b) => +b.createdAt - +a.createdAt),
          )
        }
      },
      /**
       * #action
       */
      setSessionDB(sessionDB: IDBPDatabase<SessionDB>) {
        self.sessionDB = sessionDB
      },
    }))
    .actions(self => ({
      /**
       * #aftercreate
       */
      afterCreate() {
        // Cast: self here is the partial type at this point in the MST chain
        // and doesn't yet include actions defined later in this same block,
        // but the helpers only touch fields/actions already composed in.
        const model = self as unknown as WebRootModel
        setupSessionStorageAutosave(model)
        if (typeof indexedDB !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          setupSessionDB(model)
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
      setReloadPluginManagerCallback(
        callback: (
          configSnapshot: Record<string, unknown>,
          sessionSnapshot: Record<string, unknown>,
        ) => void,
      ) {
        self.reloadPluginManagerCallback = callback
      },
      /**
       * #action
       */
      setDefaultSession() {
        const { defaultSession } = self.jbrowse
        self.setSession({
          ...defaultSession,
          name: `${defaultSession.name || 'New session'} ${new Date().toLocaleString()}`,
        })
      },
      /**
       * #action
       */
      async activateSession(id: string) {
        const ret = await self.sessionDB?.get('sessions', id)
        if (ret) {
          self.setSession(ret)
        } else {
          self.session?.notifyError('Session not found')
        }
      },
      /**
       * #action
       */
      async setSavedSessionFavorite(id: string, favorite: boolean) {
        if (self.sessionDB) {
          const ret = self.savedSessionMetadata?.find(f => f.id === id)
          if (ret) {
            await self.sessionDB.put('metadata', { ...ret, favorite }, ret.id)
            await self.fetchSessionMetadata()
          }
        }
      },
      /**
       * #action
       */
      async deleteSavedSession(id: string) {
        if (self.sessionDB) {
          await self.sessionDB.delete('metadata', id)
          await self.sessionDB.delete('sessions', id)
          await self.fetchSessionMetadata()
        }
      },
      /**
       * #action
       */
      setError(error?: unknown) {
        self.error = error
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      menus() {
        const preConfiguredSessions = readConfObject(
          self.jbrowse,
          'preConfiguredSessions',
        )

        const ret = [
          {
            label: 'File',
            menuItems: () => {
              const favs = self.savedSessionMetadata
                ?.filter(f => f.favorite)
                .slice(0, 5)
              const rest = self.savedSessionMetadata
                ?.filter(f => !f.favorite)
                .slice(0, 5)
              const sessionMenuActions = {
                activate: (id: string) => self.activateSession(id),
                notifyError: (msg: string, e: unknown) => {
                  self.session?.notifyError(msg, e)
                },
                showMore: () => {
                  const widget = self.session?.addWidget(
                    'SessionManager',
                    'sessionManager',
                  )
                  if (widget) {
                    self.session?.showWidget(widget)
                  }
                },
              }

              return [
                {
                  label: 'New session',
                  icon: AddIcon,
                  onClick: () => {
                    self.setDefaultSession()
                  },
                },
                {
                  label: 'Import session...',
                  icon: PublishIcon,
                  onClick: () => {
                    const widget = self.session?.addWidget(
                      'ImportSessionWidget',
                      'importSessionWidget',
                    )
                    if (widget) {
                      self.session?.showWidget(widget)
                    }
                  },
                },
                {
                  label: 'Export session',
                  icon: GetAppIcon,
                  onClick: async () => {
                    if (self.session) {
                      const { saveAs } = await import('@jbrowse/core/util')

                      saveAs(
                        new Blob(
                          [
                            JSON.stringify(
                              { session: getSnapshot(self.session) },
                              null,
                              2,
                            ),
                          ],
                          { type: 'text/plain;charset=utf-8' },
                        ),
                        'session.json',
                      )
                    }
                  },
                },
                {
                  label: 'Duplicate session',
                  icon: FileCopyIcon,
                  onClick: () => {
                    if (self.session) {
                      // @ts-expect-error
                      const { id, ...rest } = getSnapshot(self.session)
                      self.setSession(rest)
                    }
                  },
                },
                ...(preConfiguredSessions?.length
                  ? [
                      {
                        label: 'Pre-configured sessions...',
                        subMenu: preConfiguredSessions.map(
                          (r: { name: string }) => ({
                            label: r.name,
                            onClick: () => {
                              self.setSession(r)
                            },
                          }),
                        ),
                      },
                    ]
                  : []),
                ...(favs?.length
                  ? [
                      {
                        label: 'Favorite sessions...',
                        subMenu: buildSessionListSubmenu({
                          sessions: favs,
                          currentSessionId: self.session?.id,
                          actions: sessionMenuActions,
                          itemIcon: StarIcon,
                        }),
                      },
                    ]
                  : []),
                {
                  label: 'Recent sessions...',
                  type: 'subMenu',
                  subMenu: buildSessionListSubmenu({
                    sessions: rest,
                    currentSessionId: self.session?.id,
                    actions: sessionMenuActions,
                    emptyLabel: 'No autosaves found',
                  }),
                },
                { type: 'divider' },
                {
                  label: 'Open track...',
                  icon: StorageIcon,
                  onClick: () => {
                    if (self.session) {
                      if (self.session.views.length === 0) {
                        self.session.notify(
                          'Please open a view to add a track first',
                        )
                      } else {
                        const widget = self.session.addWidget(
                          'AddTrackWidget',
                          'addTrackWidget',
                          { view: self.session.views[0]!.id },
                        )
                        self.session.showWidget(widget)
                        if (self.session.views.length > 1) {
                          self.session.notify(
                            'This will add a track to the first view. Note: if you want to open a track in a specific view open the track selector for that view and use the add track (plus icon) in the bottom right',
                          )
                        }
                      }
                    }
                  },
                },
                {
                  label: 'Open connection...',
                  icon: Cable,
                  onClick: () => {
                    const widget = self.session?.addWidget(
                      'AddConnectionWidget',
                      'addConnectionWidget',
                    )
                    if (widget) {
                      self.session?.showWidget(widget)
                    }
                  },
                },
              ]
            },
          },
          ...(adminMode
            ? [
                {
                  label: 'Admin',
                  menuItems: [
                    {
                      label: 'Set default session',
                      onClick: () => {
                        self.session?.queueDialog((onClose: () => void) => [
                          SetDefaultSession,
                          {
                            rootModel: self,
                            onClose,
                          },
                        ])
                      },
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
                    self.session.showWidget(
                      self.session.addWidget(
                        'PluginStoreWidget',
                        'pluginStoreWidget',
                      ),
                    )
                  }
                },
              },
              {
                label: 'Assembly manager',
                icon: DNA,
                onClick: () => {
                  self.session?.queueDialog((onClose: () => void) => [
                    AssemblyManager,
                    {
                      onClose,
                      session: self.session,
                      rootModel: self,
                    },
                  ])
                },
              },

              {
                label: 'Preferences',
                icon: SettingsIcon,
                onClick: () => {
                  if (self.session) {
                    const session = self.session as BaseSession
                    session.queueDialog(
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
              {
                label: 'Use workspaces',
                icon: SpaceDashboardIcon,
                type: 'checkbox',
                checked: self.session?.useWorkspaces ?? false,
                helpText:
                  'Workspaces allow you to organize views into tabs and tiles. There are a variety of unique features, for instance, you can drag views between tabs or split them side-by-side. Try clicking and dragging the tab header to create a new split',
                onClick: () => {
                  self.session?.setUseWorkspaces(!self.session.useWorkspaces)
                },
              },
            ],
          },
        ] as Menu[]

        return processMutableMenuActions(ret, self.mutableMenuActions)
      },
    }))
}

export type WebRootModelType = ReturnType<typeof RootModel>
export type WebRootModel = Instance<WebRootModelType>

// Verify WebRootModel satisfies WebRootModelInterface at compile time.
// If this errors, the root model is missing something BaseWebSession expects.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _checkWebRootModel(m: WebRootModel): WebRootModelInterface {
  return m
}
