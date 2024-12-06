import { lazy } from 'react'

import { HistoryManagementMixin } from '@jbrowse/app-core'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
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
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import GetAppIcon from '@mui/icons-material/GetApp'
import PublishIcon from '@mui/icons-material/Publish'
import RedoIcon from '@mui/icons-material/Redo'
import SettingsIcon from '@mui/icons-material/Settings'
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
import {
  appendMenu,
  appendToMenu,
  appendToSubMenu,
  insertInMenu,
  insertInSubMenu,
  insertMenu,
} from './menus'

import type { SavedSession, SessionDB } from '../types'
import type { Menu } from './menus'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
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

interface InsertInSubMenuAction {
  type: 'insertInSubMenu'
  menuPath: string[]
  menuItem: MenuItem
  position: number
}
interface InsertInMenuAction {
  type: 'insertInMenu'
  menuName: string
  menuItem: MenuItem
  position: number
}
interface AppendToMenuAction {
  type: 'appendToMenu'
  menuName: string
  menuItem: MenuItem
}
interface AppendToSubMenuAction {
  type: 'appendToSubMenu'
  menuPath: string[]
  menuItem: MenuItem
}
interface AppendMenuAction {
  type: 'appendMenu'
  menuName: string
}
interface InsertMenuAction {
  type: 'insertMenu'
  menuName: string
  position: number
}
interface SetMenusAction {
  type: 'setMenus'
  newMenus: Menu[]
}

export type MenuAction =
  | InsertMenuAction
  | AppendMenuAction
  | AppendToSubMenuAction
  | AppendToMenuAction
  | InsertInMenuAction
  | InsertInSubMenuAction
  | SetMenusAction

/**
 * #stateModel JBrowseWebRootModel
 *
 * composed of
 * - [BaseRootModel](../baserootmodel)
 * - [InternetAccountsMixin](../internetaccountsmixin)
 * - [HistoryManagementMixin](../historymanagementmixin)
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
      savedSessions: undefined as undefined | SavedSession[],
      /**
       * #volatile
       */
      textSearchManager: new TextSearchManager(pluginManager),
      /**
       * #volatile
       */
      error: undefined as unknown,

      /**
       * #volatile
       * older jbrowse versions allowed directly mutating the menus structure.
       * this was difficult to reconcile with observable data structures. it
       * now records the series of mutations to this array, and applies them
       * sequentially
       */
      mutableMenuActions: [] as MenuAction[],
    }))
    .actions(self => ({
      /**
       * #action
       */
      setMenus(newMenus: Menu[]) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'setMenus', newMenus },
        ]
      },
      /**
       * #action
       * Add a top-level menu
       *
       * @param menuName - Name of the menu to insert.
       *
       */
      appendMenu(menuName: string) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'appendMenu', menuName },
        ]
      },
      /**
       * #action
       * Insert a top-level menu
       *
       * @param menuName - Name of the menu to insert.
       *
       * @param position - Position to insert menu. If negative, counts from th
       * end, e.g. `insertMenu('My Menu', -1)` will insert the menu as the
       * second-to-last one.
       *
       */
      insertMenu(menuName: string, position: number) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          {
            type: 'insertMenu',
            menuName,
            position,
          },
        ]
      },
      /**
       * #action
       * Add a menu item to a top-level menu
       *
       * @param menuName - Name of the top-level menu to append to.
       *
       * @param menuItem - Menu item to append.
       */
      appendToMenu(menuName: string, menuItem: MenuItem) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          {
            type: 'appendToMenu',
            menuName,
            menuItem,
          },
        ]
      },
      /**
       * #action
       * Insert a menu item into a top-level menu
       *
       * @param menuName - Name of the top-level menu to insert into
       *
       * @param menuItem - Menu item to insert
       *
       * @param position - Position to insert menu item. If negative, counts
       * from the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as
       * the second-to-last one.
       */
      insertInMenu(menuName: string, menuItem: MenuItem, position: number) {
        self.mutableMenuActions.push({
          type: 'insertInMenu',
          menuName,
          menuItem,
          position,
        })
      },
      /**
       * #action
       * Add a menu item to a sub-menu
       *
       * @param menuPath - Path to the sub-menu to add to, starting with the
       * top-level menu (e.g. `['File', 'Insert']`).
       *
       * @param menuItem - Menu item to append.
       *
       * @returns The new length of the sub-menu
       */
      appendToSubMenu(menuPath: string[], menuItem: MenuItem) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          {
            type: 'appendToSubMenu',
            menuPath,
            menuItem,
          },
        ]
      },
      /**
       * #action
       * Insert a menu item into a sub-menu
       *
       * @param menuPath - Path to the sub-menu to add to, starting with the
       * top-level menu (e.g. `['File', 'Insert']`).
       *
       * @param menuItem - Menu item to insert.
       *
       * @param position - Position to insert menu item. If negative, counts
       * from the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as
       * the second-to-last one.
       */
      insertInSubMenu(
        menuPath: string[],
        menuItem: MenuItem,
        position: number,
      ) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          {
            type: 'insertInSubMenu',
            menuPath,
            menuItem,
            position,
          },
        ]
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setSavedSessions(sessions: SavedSession[]) {
        self.savedSessions = sessions
      },

      /**
       * #action
       */
      async fetchSavedSessions() {
        if (self.sessionDB) {
          const savedSessions = await self.sessionDB.getAll('metadata')
          this.setSavedSessions(
            savedSessions.sort((a, b) => +b.createdAt - +a.createdAt),
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
            const m = 'sessionsMetadata'
            const sessionDB = await openDB<SessionDB>(m, 1, {
              upgrade(db) {
                db.createObjectStore('sessionsMetadata', {
                  keyPath: 'id',
                })
                db.createObjectStore('sessions', {
                  keyPath: 'id',
                })
              },
            })
            self.setSessionDB(sessionDB)

            addDisposer(
              self,
              autorun(
                async () => {
                  if (self.session) {
                    try {
                      const { id } = self.session
                      await sessionDB.put(
                        'sessions',
                        getSnapshot(self.session),
                        id,
                      )
                      await sessionDB.put(
                        'metadata',
                        {
                          id: self.session.id,
                          createdAt: new Date(),
                          configPath: self.configPath || '',
                          favorite: false,
                        },
                        id,
                      )

                      await self.fetchSavedSessions()
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
      activateSession(id: string) {
        const r = self.savedSessions?.find(f => f.session.id === id)
        if (r) {
          this.setSession(r.session)
        } else {
          self.session.notify('Session not found')
        }
      },
      /**
       * #action
       */
      async favoriteSavedSession(id: string) {
        if (self.sessionDB) {
          await self.sessionDB.put('metadata', {
            ...self.savedSessions.find(f => f.id === id),
            favorite: true,
          })
          await self.fetchSavedSessions()
        }
      },
      /**
       * #action
       */
      async unfavoriteSavedSession(id: string) {
        if (self.sessionDB) {
          await self.sessionDB.put('metadata', {
            ...self.savedSessions?.find(f => f.id === id),
            favorite: false,
          })
          await self.fetchSavedSessions()
        }
      },
      /**
       * #action
       */
      async deleteSavedSession(id: string) {
        if (self.sessionDB) {
          await self.sessionDB.delete('metadata', id)
          await self.sessionDB.delete('sessions', id)
          await self.fetchSavedSessions()
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
        let ret = [
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
                label: 'Recent sessions...',
                type: 'subMenu',
                subMenu: self.savedSessions?.length
                  ? [
                      ...self.savedSessions.slice(0, 5).map(r => ({
                        label: `${r.session.name} (${r.session.id === self.session.id ? 'current' : formatDistanceToNow(r.createdAt, { addSuffix: true })})`,
                        disabled: r.session.id === self.session.id,
                        onClick: () => {
                          self.setSession(r.session)
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

        for (const action of self.mutableMenuActions) {
          if (action.type === 'setMenus') {
            ret = action.newMenus
          } else if (action.type === 'appendMenu') {
            appendMenu({ menus: ret, ...action })
          } else if (action.type === 'insertMenu') {
            insertMenu({ menus: ret, ...action })
          } else if (action.type === 'insertInSubMenu') {
            insertInSubMenu({ menus: ret, ...action })
          } else if (action.type === 'appendToSubMenu') {
            appendToSubMenu({ menus: ret, ...action })
          } else if (action.type === 'appendToMenu') {
            appendToMenu({ menus: ret, ...action })
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          } else if (action.type === 'insertInMenu') {
            insertInMenu({ menus: ret, ...action })
          }
        }
        return ret
      },
    }))
}

export type WebRootModelType = ReturnType<typeof RootModel>
export type WebRootModel = Instance<WebRootModelType>
