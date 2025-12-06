import { lazy } from 'react'

import {
  filterSessionInPlace,
  getExportSessionMenuItem,
  getImportSessionMenuItem,
  getOpenConnectionMenuItem,
  getOpenTrackMenuItem,
  getPluginStoreMenuItem,
  getRedoMenuItem,
  getUndoMenuItem,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyManagerFactory from '@jbrowse/core/assemblyManager'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { DNA } from '@jbrowse/core/ui/Icons'
import TimeTraveller from '@jbrowse/core/util/TimeTraveller'
import {
  addDisposer,
  cast,
  getSnapshot,
  getType,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import { AssemblyManager } from '@jbrowse/plugin-data-management'
import AddIcon from '@mui/icons-material/Add'
import FileCopyIcon from '@mui/icons-material/FileCopy'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import SettingsIcon from '@mui/icons-material/Settings'
import StarIcon from '@mui/icons-material/Star'
import { formatDistanceToNow } from 'date-fns'
import { openDB } from 'idb'
import { autorun } from 'mobx'

import packageJSON from '../../package.json'
import jbrowseWebFactory from '../jbrowseModel'
import makeWorkerInstance from '../makeWorkerInstance'
import sessionModelFactory from '../sessionModel'

import type { WebSessionModelType } from '../sessionModel'
import type { SessionDB, SessionMetadata } from '../types'
import type { Menu, MenuAction } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  AbstractSessionModel,
  SessionWithWidgets,
  UriLocation,
} from '@jbrowse/core/util'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type { SessionWithDialogs } from '@jbrowse/product-core'
import type { IDBPDatabase } from 'idb'

// lazies
const SetDefaultSession = lazy(() => import('../components/SetDefaultSession'))
const PreferencesDialog = lazy(() => import('../components/PreferencesDialog'))

/**
 * #stateModel JBrowseWebRootModel
 *
 * note: many properties of the root model are available through the session,
 * and we generally prefer using the session model (via e.g. getSession) over
 * the root model (via e.g. getRoot) in plugin code
 */
export default function RootModel({
  pluginManager,
  adminMode = false,
}: {
  pluginManager: PluginManager
  adminMode?: boolean
}) {
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  const jbrowseModelType = jbrowseWebFactory({
    pluginManager,
    assemblyConfigSchema,
  })
  const sessionModelType: WebSessionModelType = sessionModelFactory({
    pluginManager,
    assemblyConfigSchema,
  })
  return types
    .model('JBrowseWebRootModel', {
      /**
       * #property
       */
      jbrowse: jbrowseModelType,
      /**
       * #property
       */
      session: types.maybe(sessionModelType),
      /**
       * #property
       */
      sessionPath: types.optional(types.string, ''),
      /**
       * #property
       */
      assemblyManager: types.optional(
        assemblyManagerFactory(assemblyConfigSchema, pluginManager),
        {},
      ),
      /**
       * #property
       */
      internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      ),
      /**
       * #property
       */
      history: types.optional(TimeTraveller, { targetPath: '../session' }),
      /**
       * #property
       */
      configPath: types.maybe(types.string),
    })
    .volatile(self => ({
      /**
       * #volatile
       */
      pluginManager,
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
      /**
       * #volatile
       */
      reloadPluginManagerCallback: (
        _configSnapshot: Record<string, unknown>,
        _sessionSnapshot: Record<string, unknown>,
      ) => {
        console.error('reloadPluginManagerCallback unimplemented')
      },
      /**
       * #volatile
       */
      mutableMenuActions: [] as MenuAction[],
    }))

    .actions(self => ({
      /**
       * #action
       */
      setSession(sessionSnapshot?: SnapshotIn<WebSessionModelType>) {
        const oldSession = self.session
        self.session = cast(sessionSnapshot)
        if (self.session) {
          try {
            filterSessionInPlace(self.session, getType(self.session))
          } catch (error) {
            self.session = oldSession
            throw error
          }
        }
      },
      /**
       * #action
       */
      setSessionPath(path: string) {
        self.sessionPath = path
      },
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
              .filter(f => f.configPath === (self.configPath || ''))
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
      /**
       * #action
       */
      initializeInternetAccount(
        internetAccountConfig: AnyConfigurationModel,
        initialSnapshot = {},
      ) {
        const internetAccountType = pluginManager.getInternetAccountType(
          internetAccountConfig.type,
        )
        if (!internetAccountType) {
          throw new Error(
            `unknown internet account type ${internetAccountConfig.type}`,
          )
        }

        const length = self.internetAccounts.push({
          ...initialSnapshot,
          type: internetAccountConfig.type,
          configuration: internetAccountConfig,
        })
        return self.internetAccounts[length - 1]
      },
      /**
       * #action
       */
      createEphemeralInternetAccount(
        internetAccountId: string,
        initialSnapshot: Record<string, unknown>,
        url: string,
      ) {
        let hostUri: string | undefined

        try {
          hostUri = new URL(url).origin
        } catch {
          // ignore
        }
        const internetAccountSplit = internetAccountId.split('-')
        const configuration = {
          type: internetAccountSplit[0]!,
          internetAccountId: internetAccountId,
          name: internetAccountSplit.slice(1).join('-'),
          description: '',
          domains: hostUri ? [hostUri] : [],
        }
        const type = pluginManager.getInternetAccountType(configuration.type)!
        const internetAccount = type.stateModel.create({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
        })
        self.internetAccounts.push(internetAccount)
        return internetAccount
      },
      /**
       * #action
       */
      findAppropriateInternetAccount(location: UriLocation) {
        const selectedId = location.internetAccountId
        if (selectedId) {
          const selectedAccount = self.internetAccounts.find(account => {
            return account.internetAccountId === selectedId
          })
          if (selectedAccount) {
            return selectedAccount
          }
        }

        for (const account of self.internetAccounts) {
          const handleResult = account.handlesLocation(location)
          if (handleResult) {
            return account
          }
        }

        return selectedId
          ? this.createEphemeralInternetAccount(selectedId, {}, location.uri)
          : null
      },
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
       */
      appendMenu(menuName: string) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'appendMenu', menuName },
        ]
      },
      /**
       * #action
       */
      insertMenu(menuName: string, position: number) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'insertMenu', menuName, position },
        ]
      },
      /**
       * #action
       */
      appendToMenu(menuName: string, menuItem: MenuItem) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'appendToMenu', menuName, menuItem },
        ]
      },
      /**
       * #action
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
       */
      appendToSubMenu(menuPath: string[], menuItem: MenuItem) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'appendToSubMenu', menuPath, menuItem },
        ]
      },
      /**
       * #action
       */
      insertInSubMenu(
        menuPath: string[],
        menuItem: MenuItem,
        position: number,
      ) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'insertInSubMenu', menuPath, menuItem, position },
        ]
      },
    }))
    .actions(self => {
      const keydownListener = (e: KeyboardEvent) => {
        if (
          self.history.canRedo &&
          (((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ') ||
            (e.ctrlKey && !e.shiftKey && e.code === 'KeyY')) &&
          document.activeElement?.tagName.toUpperCase() !== 'INPUT'
        ) {
          self.history.redo()
        }
        if (
          self.history.canUndo &&
          (e.ctrlKey || e.metaKey) &&
          !e.shiftKey &&
          e.code === 'KeyZ' &&
          document.activeElement?.tagName.toUpperCase() !== 'INPUT'
        ) {
          self.history.undo()
        }
      }

      return {
        afterCreate() {
          document.addEventListener('keydown', keydownListener)
          addDisposer(
            self,
            autorun(
              function historyInitAutorun() {
                if (self.session) {
                  self.history.initialize()
                }
              },
              { name: 'HistoryInit' },
            ),
          )

          addDisposer(
            self,
            autorun(
              function internetAccountsAutorun() {
                for (const internetAccount of self.jbrowse.internetAccounts) {
                  self.initializeInternetAccount(internetAccount)
                }
              },
              { name: 'InternetAccounts' },
            ),
          )

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
                        const s = self.session

                        if (self.sessionDB) {
                          const snap = getSnapshot(s)!
                          await sessionDB.put(
                            'sessions',
                            { ...snap, name: snap.name, id: snap.id },
                            s.id,
                          )
                          if (!isAlive(self)) {
                            return
                          }

                          const ret = await self.sessionDB.get('metadata', s.id)
                          await sessionDB.put(
                            'metadata',
                            {
                              ...ret,
                              favorite: ret?.favorite || false,
                              name: s.name,
                              id: s.id,
                              createdAt: new Date(),
                              configPath: self.configPath || '',
                            },
                            s.id,
                          )
                        }
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

            let savingFailed = false
            addDisposer(
              self,
              autorun(
                () => {
                  if (self.session) {
                    const s = self.session
                    const sessionSnap = getSnapshot(s)
                    try {
                      sessionStorage.setItem(
                        'current',
                        JSON.stringify({
                          session: sessionSnap,
                          createdAt: new Date(),
                        }),
                      )
                      if (savingFailed) {
                        savingFailed = false
                        s.notify('Auto-saving restored', 'info')
                      }

                      if (self.pluginsUpdated) {
                        self.reloadPluginManagerCallback(
                          structuredClone(getSnapshot(self.jbrowse)),
                          // @ts-expect-error
                          structuredClone(sessionSnap),
                        )
                      }
                    } catch (e) {
                      console.error(e)
                      const msg = `${e}`
                      if (!savingFailed) {
                        savingFailed = true
                        if (msg.includes('quota')) {
                          s.notifyError(
                            'Unable to auto-save session, exceeded sessionStorage quota. This may be because a very large feature was stored in session',
                            e,
                          )
                        } else {
                          s.notifyError(msg, e)
                        }
                      }
                    }
                  }
                },
                { delay: 400 },
              ),
            )
          })()
        },
        beforeDestroy() {
          document.removeEventListener('keydown', keydownListener)
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
          if (self.session) {
            self.setSession({
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
        const { preConfiguredSessions } = self.jbrowse

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

              return [
                {
                  label: 'New session',
                  icon: AddIcon,
                  onClick: () => {
                    self.setDefaultSession()
                  },
                },
                getImportSessionMenuItem(),
                getExportSessionMenuItem(),
                {
                  label: 'Duplicate session',
                  icon: FileCopyIcon,
                  onClick: () => {
                    // @ts-expect-error
                    const { id, ...rest } = getSnapshot(self.session)
                    self.setSession(rest)
                  },
                },
                ...(preConfiguredSessions.length
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
                        subMenu: [
                          ...favs.slice(0, 5).map(r => ({
                            label: `${r.name} (${r.id === self.session?.id ? 'current' : formatDistanceToNow(r.createdAt, { addSuffix: true })})`,
                            disabled: r.id === self.session?.id,
                            icon: StarIcon,
                            onClick: () => {
                              // eslint-disable-next-line @typescript-eslint/no-floating-promises
                              ;(async () => {
                                try {
                                  await self.activateSession(r.id)
                                } catch (e) {
                                  self.session?.notifyError(`${e}`, e)
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
                        ],
                      },
                    ]
                  : []),
                {
                  label: 'Recent sessions...',
                  type: 'subMenu',
                  subMenu: rest?.length
                    ? [
                        ...rest.map(r => ({
                          label: `${r.name} (${r.id === self.session?.id ? 'current' : formatDistanceToNow(r.createdAt, { addSuffix: true })})`,
                          disabled: r.id === self.session?.id,
                          onClick: () => {
                            // eslint-disable-next-line @typescript-eslint/no-floating-promises
                            ;(async () => {
                              try {
                                await self.activateSession(r.id)
                              } catch (e) {
                                self.session?.notifyError(`${e}`, e)
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
                getOpenTrackMenuItem(),
                getOpenConnectionMenuItem(),
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
              getUndoMenuItem(() => self.history),
              getRedoMenuItem(() => self.history),
              { type: 'divider' },
              getPluginStoreMenuItem(() => self.session),
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
                    self.session.queueDialog(handleClose => [
                      PreferencesDialog,
                      {
                        session: self.session,
                        handleClose,
                      },
                    ])
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
