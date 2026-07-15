import { lazy } from 'react'

import {
  HistoryManagementMixin,
  RootAppMenuMixin,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { readConfObject } from '@jbrowse/core/configuration'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { DNA } from '@jbrowse/core/ui/Icons'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { AssemblyManager } from '@jbrowse/plugin-data-management'
import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
  openConnectionMenuItem,
  openTrackMenuItem,
  pluginStoreMenuItem,
  preferencesMenuItem,
  redoMenuItem,
  undoMenuItem,
  workspacesMenuItem,
} from '@jbrowse/product-core'
import AddIcon from '@mui/icons-material/Add'
import FileCopyIcon from '@mui/icons-material/FileCopy'
import GetAppIcon from '@mui/icons-material/GetApp'
import PublishIcon from '@mui/icons-material/Publish'
import StarIcon from '@mui/icons-material/Star'

import packageJSON from '../../package.json' with { type: 'json' }
import { gitCommit } from '../buildInfo.ts'
import jbrowseWebFactory from '../jbrowseModel.ts'
import makeWorkerInstance from '../makeWorkerInstance.ts'
import { setupSessionDB, setupSessionStorageAutosave } from './persistence.ts'
import { buildSessionListSubmenu } from './sessionMenus.ts'

import type { Session, SessionDB, SessionMetadata } from '../types.ts'
import type { Menu } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyType, Instance } from '@jbrowse/mobx-state-tree'
import type {
  AbstractWebRootModel,
  AbstractWebSessionDbRootModel,
} from '@jbrowse/web-core'
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

// Wraps an async saved-session-DB operation so any failure is logged and
// surfaced to the current session's snackbar, matching the autosave autorun's
// error handling.
async function withErrorNotify(
  self: {
    session?: { notifyError: (message: string, error?: unknown) => void }
  },
  fn: () => Promise<void>,
) {
  try {
    await fn()
  } catch (e) {
    console.error(e)
    self.session?.notifyError(`${e}`, e)
  }
}

/**
 * #stateModel JBrowseWebRootModel
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
      gitCommit,
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
          defaultDriverName: 'WebWorkerRpcDriver',
        },
      ),
      /**
       * #volatile
       */
      savedSessionMetadata: undefined as SessionMetadata[] | undefined,
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
      setPluginsUpdated() {
        self.pluginsUpdated = true
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
      async activateSession(id: string) {
        await withErrorNotify(self, async () => {
          const ret = await self.sessionDB?.get('sessions', id)
          if (ret) {
            self.setSession(ret)
          } else {
            self.session?.notifyError('Session not found')
          }
        })
      },
      /**
       * #action
       */
      async setSavedSessionFavorite(id: string, favorite: boolean) {
        await withErrorNotify(self, async () => {
          if (self.sessionDB) {
            const ret = await self.sessionDB.get('metadata', id)
            if (ret) {
              await self.sessionDB.put('metadata', { ...ret, favorite }, id)
              await self.fetchSessionMetadata()
            }
          }
        })
      },
      /**
       * #action
       */
      async deleteSavedSession(id: string) {
        await withErrorNotify(self, async () => {
          if (self.sessionDB) {
            await self.sessionDB.delete('metadata', id)
            await self.sessionDB.delete('sessions', id)
            await self.fetchSessionMetadata()
          }
        })
      },
      /**
       * #action
       */
      async renameSavedSession(id: string, name: string) {
        await withErrorNotify(self, async () => {
          // renaming the active session goes through the live model so the
          // autosave autorun rewrites both stores; otherwise edit IDB directly
          if (id === self.session?.id) {
            self.renameCurrentSession(name)
          } else if (self.sessionDB) {
            const meta = await self.sessionDB.get('metadata', id)
            const snap = await self.sessionDB.get('sessions', id)
            if (meta && snap) {
              await self.sessionDB.put('metadata', { ...meta, name }, id)
              await self.sessionDB.put('sessions', { ...snap, name }, id)
              await self.fetchSessionMetadata()
            }
          }
        })
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
        ) as { name: string; [key: string]: unknown }[] | undefined

        const ret: Menu[] = [
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
                      const { id, ...rest } = getSnapshot<Session>(self.session)
                      self.setSession(rest)
                    }
                  },
                },
                ...(preConfiguredSessions?.length
                  ? [
                      {
                        label: 'Pre-configured sessions...',
                        subMenu: preConfiguredSessions.map(r => ({
                          label: r.name,
                          onClick: () => {
                            self.setSession(r)
                          },
                        })),
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
                openTrackMenuItem(),
                openConnectionMenuItem(),
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
              undoMenuItem(self.history),
              redoMenuItem(self.history),
              { type: 'divider' },
              pluginStoreMenuItem(),
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

              preferencesMenuItem(pluginManager, PreferencesDialog),
              workspacesMenuItem(self.session),
            ],
          },
        ]

        return processMutableMenuActions(ret, self.mutableMenuActions)
      },
    }))
}

export type WebRootModelType = ReturnType<typeof RootModel>
export type WebRootModel = Instance<WebRootModelType>

// Verify WebRootModel satisfies the web session contracts at compile time. If
// this errors, the root model is missing something BaseWebSession expects
// (AbstractWebRootModel) or the management mixin expects
// (AbstractWebSessionDbRootModel).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _checkWebRootModel(
  m: WebRootModel,
): AbstractWebRootModel & AbstractWebSessionDbRootModel {
  return m
}
