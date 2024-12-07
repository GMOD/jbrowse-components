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
import { AssemblyManager } from '@jbrowse/plugin-data-management'
import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
} from '@jbrowse/product-core'
import AddIcon from '@mui/icons-material/Add'
import AppsIcon from '@mui/icons-material/Apps'
import ExtensionIcon from '@mui/icons-material/Extension'
import FileCopyIcon from '@mui/icons-material/FileCopy'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import GetAppIcon from '@mui/icons-material/GetApp'
import PublishIcon from '@mui/icons-material/Publish'
import RedoIcon from '@mui/icons-material/Redo'
import SettingsIcon from '@mui/icons-material/Settings'
import StarIcon from '@mui/icons-material/Star'
import StorageIcon from '@mui/icons-material/Storage'
import UndoIcon from '@mui/icons-material/Undo'
import { formatDistanceToNow } from 'date-fns'
import { saveAs } from 'file-saver'
import { openDB } from 'idb'
import { autorun } from 'mobx'
import { addDisposer, cast, getSnapshot, getType, types } from 'mobx-state-tree'
import { createRoot, hydrateRoot } from 'react-dom/client'

// other
import packageJSON from '../../package.json'
import jbrowseWebFactory from '../jbrowseModel'
import makeWorkerInstance from '../makeWorkerInstance'
import { filterSessionInPlace } from '../util'

import type { SessionDB, SessionMetadata } from '../types'
import type { Menu } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { SessionWithWidgets } from '@jbrowse/core/util'
import type { BaseSessionType, SessionWithDialogs } from '@jbrowse/product-core'
import type { IDBPDatabase } from 'idb'
import type {
  IAnyStateTreeNode,
  IAnyType,
  Instance,
  SnapshotIn,
} from 'mobx-state-tree'

// lazies
const SetDefaultSession = lazy(() => import('../components/SetDefaultSession'))
const PreferencesDialog = lazy(() => import('../components/PreferencesDialog'))

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
      version: packageJSON.version,
      /**
       * #volatile
       */
      hydrateFn: hydrateRoot,
      /**
       * #volatile
       */
      createRootFn: createRoot,
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
      error: undefined as unknown,
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
              .filter(f => f.configPath === self.configPath)
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
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const sessionDB = await openDB<SessionDB>('sessionsDB', 2, {
              upgrade(db) {
                db.createObjectStore('metadata')
                db.createObjectStore('sessions')
              },
            })
            self.setSessionDB(sessionDB)

            addDisposer(
              self,
              autorun(
                async () => {
                  if (self.session) {
                    try {
                      await sessionDB.put(
                        'sessions',
                        getSnapshot(self.session),
                        self.session.id,
                      )
                      await sessionDB.put(
                        'metadata',
                        {
                          name: self.session.name,
                          id: self.session.id,
                          createdAt: new Date(),
                          configPath: self.configPath || '',
                          favorite: false,
                        },
                        self.session.id,
                      )

                      await self.fetchSessionMetadata()
                    } catch (e) {
                      console.error(e)
                      self.session?.notifyError(`${e}`, e)
                    }
                  }
                },
                { delay: 400 },
              ),
            )
          } catch (e) {
            console.error(e)
            self.session?.notifyError(`${e}`, e)
          }

          addDisposer(
            self,
            autorun(
              async () => {
                if (self.session) {
                  sessionStorage.setItem(
                    'current',
                    JSON.stringify({
                      session: getSnapshot(self.session),
                      createdAt: new Date(),
                    }),
                  )

                  // this check is not able to be modularized into it's own
                  // autorun at current time because it depends on session
                  // storage snapshot being set above
                  if (self.pluginsUpdated) {
                    window.location.reload()
                  }
                }
              },
              { delay: 400 },
            ),
          )
        })()
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
      async activateSession(id: string) {
        const ret = await self.sessionDB?.get('sessions', id)
        if (ret) {
          this.setSession(ret)
        } else {
          self.session.notifyError('Session not found')
        }
      },
      /**
       * #action
       */
      async favoriteSavedSession(id: string) {
        if (self.sessionDB) {
          const ret = self.savedSessionMetadata!.find(f => f.id === id)
          if (ret) {
            await self.sessionDB.put(
              'metadata',
              {
                ...ret,
                favorite: true,
              },
              ret.id,
            )
            await self.fetchSessionMetadata()
          }
        }
      },
      /**
       * #action
       */
      async unfavoriteSavedSession(id: string) {
        if (self.sessionDB) {
          const ret = self.savedSessionMetadata!.find(f => f.id === id)
          if (ret) {
            await self.sessionDB.put(
              'metadata',
              {
                ...ret,
                favorite: false,
              },
              ret.id,
            )
          }
          await self.fetchSessionMetadata()
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
      renameCurrentSession(sessionName: string) {
        this.setSession({
          ...getSnapshot(self.session),
          name: sessionName,
        })
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
        const favs = self.savedSessionMetadata
          ?.filter(f => f.favorite)
          .slice(0, 5)
        const rest = self.savedSessionMetadata
          ?.filter(f => !f.favorite)
          .slice(0, 5)

        const ret = [
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
                label: 'Import session...',
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
              {
                label: 'Duplicate session',
                icon: FileCopyIcon,
                onClick: () => {
                  // @ts-expect-error
                  const { id, ...rest } = getSnapshot(self.session)
                  self.setSession(rest)
                },
              },
              ...(preConfiguredSessions
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
                      subMenu: favs.map(r => ({
                        label: `${r.name} (${r.id === self.session.id ? 'current' : formatDistanceToNow(r.createdAt, { addSuffix: true })})`,
                        disabled: r.id === self.session.id,
                        icon: StarIcon,
                        onClick: () => {
                          // eslint-disable-next-line @typescript-eslint/no-floating-promises
                          ;(async () => {
                            try {
                              await self.activateSession(r.id)
                            } catch (e) {
                              self.session.notifyError(`${e}`, e)
                            }
                          })()
                        },
                      })),
                    },
                  ]
                : []),
              {
                label: 'Recent sessions...',
                type: 'subMenu',
                subMenu: rest?.length
                  ? [
                      ...rest.map(r => ({
                        label: `${r.name} (${r.id === self.session.id ? 'current' : formatDistanceToNow(r.createdAt, { addSuffix: true })})`,
                        disabled: r.id === self.session.id,
                        onClick: () => {
                          // eslint-disable-next-line @typescript-eslint/no-floating-promises
                          ;(async () => {
                            try {
                              await self.activateSession(r.id)
                            } catch (e) {
                              self.session.notifyError(`${e}`, e)
                            }
                          })()
                        },
                      })),
                      {
                        label: 'More...',
                        icon: FolderOpenIcon,
                        onClick: (session: SessionWithWidgets) => {
                          const widget = session.addWidget(
                            'SessionManager',
                            'sessionManager',
                          )
                          session.showWidget(widget)
                        },
                      },
                    ]
                  : [{ label: 'No autosaves found', onClick: () => {} }],
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
                  session.showWidget(
                    session.addWidget(
                      'AddConnectionWidget',
                      'addConnectionWidget',
                    ),
                  )
                },
              },
              { type: 'divider' },
              {
                label: 'Return to splash screen',
                icon: AppsIcon,
                onClick: () => {
                  self.setSession(undefined)
                },
              },
            ],
          },
          ...(adminMode
            ? [
                {
                  label: 'Admin',
                  menuItems: [
                    {
                      label: 'Set default session',
                      onClick: () => {
                        self.session.queueDialog((onClose: () => void) => [
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
                  self.session.queueDialog((onClose: () => void) => [
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
        ] as Menu[]

        return processMutableMenuActions(ret, self.mutableMenuActions)
      },
    }))
}

export type WebRootModelType = ReturnType<typeof RootModel>
export type WebRootModel = Instance<WebRootModelType>
