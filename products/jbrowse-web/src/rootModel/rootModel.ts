import { lazy } from 'react'

import {
  HistoryManagementMixin,
  RootAppMenuMixin,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { readConfObject } from '@jbrowse/core/configuration'
import { DNA } from '@jbrowse/core/ui/Icons'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { AssemblyManager } from '@jbrowse/plugin-data-management'
import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
  exportSessionMenuItem,
  importSessionMenuItem,
  newSessionMenuItem,
  openConnectionMenuItem,
  openTrackMenuItem,
  pluginStoreMenuItem,
  preferencesMenuItem,
  redoMenuItem,
  undoMenuItem,
  workspacesMenuItem,
} from '@jbrowse/product-core'
import { sessionLastUsed } from '@jbrowse/web-core'
import FileCopyIcon from '@mui/icons-material/FileCopy'

import packageJSON from '../../package.json' with { type: 'json' }
import { gitCommit } from '../buildInfo.ts'
import jbrowseWebFactory from '../jbrowseModel.ts'
import makeWorkerInstance from '../makeWorkerInstance.ts'
import {
  deleteSessionRows,
  renameSessionRows,
  setSessionFavoriteRow,
} from '../sessionDbOps.ts'
import { setupSessionDB, setupSessionStorageAutosave } from './persistence.ts'
import { savedSessionMenuItems } from './sessionMenus.ts'

import type { SessionDBHandle } from '../sessionDbOps.ts'
import type { Session, SessionMetadata } from '../types.ts'
import type { MenuDefinition } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyType, Instance } from '@jbrowse/mobx-state-tree'
import type {
  AbstractWebRootModel,
  AbstractWebSessionDbRootModel,
} from '@jbrowse/web-core'

// lazies
const SetDefaultSession = lazy(
  () => import('../components/SetDefaultSession.tsx'),
)
const PreferencesDialog = lazy(
  () => import('../components/PreferencesDialog.tsx'),
)
const TrustedPluginsDialog = lazy(
  () => import('../components/TrustedPluginsDialog.tsx'),
)

type AssemblyConfig = ReturnType<typeof assemblyConfigSchemaFactory>
type SessionModelFactory = (args: {
  pluginManager: PluginManager
  assemblyConfigSchema: AssemblyConfig
}) => IAnyType

interface SessionDbHost {
  sessionDB?: SessionDBHandle
  session?: { notifyError: (message: string, error?: unknown) => void }
}

// Every saved-session action is fired off with `void` from a menu or a grid
// cell, so a rejection has nowhere to land: log it and surface it on the current
// session's snackbar, matching the autosave autorun's error handling.
async function withErrorNotify(
  self: SessionDbHost,
  fn: () => Promise<void> | void,
) {
  try {
    await fn()
  } catch (e) {
    console.error(e)
    self.session?.notifyError(`${e}`, e)
  }
}

// The same, for the actions that need the database itself. Skipped entirely
// until setupSessionDB has opened it — nothing offers these before then, since
// the menus and the manager widget are both built from savedSessionMetadata,
// which only exists once it is open.
async function withSessionDB(
  self: SessionDbHost,
  fn: (sessionDB: SessionDBHandle) => Promise<void>,
) {
  await withErrorNotify(self, async () => {
    if (self.sessionDB) {
      await fn(self.sessionDB)
    }
  })
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
        rpcManagerOptions: {
          makeWorkerInstance,
          defaultDriverName: 'WebWorkerRpcDriver',
        },
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
    .volatile(() => ({
      /**
       * #volatile
       */
      adminMode,
      /**
       * #volatile
       */
      sessionDB: undefined as SessionDBHandle | undefined,
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
       * Re-reads the whole `metadata` store. For anything that changes rows this
       * model didn't just write itself (first load, pruning, favorite, rename,
       * delete) — the autosave path uses `upsertSessionMetadata` instead.
       */
      async fetchSessionMetadata() {
        if (self.sessionDB) {
          const ret = await self.sessionDB.getAll('metadata')
          this.setSavedSessionMetadata(
            ret
              .filter(f => f.configPath === (self.configPath ?? ''))
              .sort((a, b) => +sessionLastUsed(b) - +sessionLastUsed(a)),
          )
        }
      },
      /**
       * #action
       * Merges a row this model has just written into the in-memory list. The
       * autosave autorun writes exactly one row on every debounced session edit
       * — every 400ms for as long as you keep panning — and already holds its
       * contents, so re-reading every session's metadata to learn what it just
       * stored is the expensive way to move one row to the top.
       */
      upsertSessionMetadata(meta: SessionMetadata) {
        // a row for another config belongs to a different bucket of the list
        if (meta.configPath === (self.configPath ?? '')) {
          this.setSavedSessionMetadata(
            [
              meta,
              ...(self.savedSessionMetadata ?? []).filter(
                m => m.id !== meta.id,
              ),
            ].sort((a, b) => +sessionLastUsed(b) - +sessionLastUsed(a)),
          )
        }
      },
      /**
       * #action
       */
      setSessionDB(sessionDB: SessionDBHandle) {
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
        await withSessionDB(self, async sessionDB => {
          const ret = await sessionDB.get('sessions', id)
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
        await withSessionDB(self, async sessionDB => {
          await setSessionFavoriteRow(sessionDB, id, favorite)
          await self.fetchSessionMetadata()
        })
      },
      /**
       * #action
       */
      async deleteSavedSession(id: string) {
        // the open session is the one the autosave autorun rewrites every 400ms,
        // so deleting its rows only makes it vanish from the list until the next
        // edit puts it back — with its favorite flag reset, since that lives in
        // the row just deleted. Say so instead of doing that.
        if (id === self.session?.id) {
          // not wrapped in withErrorNotify: the only thing it does on failure
          // is push a snackbar, which is the call being made here
          self.session.notify(
            'Cannot delete the session that is currently open',
            'info',
          )
          return
        }
        await withSessionDB(self, async sessionDB => {
          await deleteSessionRows(sessionDB, [id])
          await self.fetchSessionMetadata()
        })
      },
      /**
       * #action
       */
      async renameSavedSession(id: string, name: string) {
        // renaming the active session goes through the live model so the
        // autosave autorun rewrites both stores; otherwise edit IDB directly
        if (id === self.session?.id) {
          await withErrorNotify(self, () => {
            self.renameCurrentSession(name)
          })
          return
        }
        await withSessionDB(self, async sessionDB => {
          await renameSessionRows(sessionDB, id, name)
          await self.fetchSessionMetadata()
        })
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      menus() {
        const preConfiguredSessions:
          | { name: string; [key: string]: unknown }[]
          | undefined = readConfObject(self.jbrowse, 'preConfiguredSessions')

        const ret: MenuDefinition[] = [
          {
            label: 'File',
            menuItems: () => [
              newSessionMenuItem(self),
              importSessionMenuItem(),
              exportSessionMenuItem(),
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
              ...savedSessionMenuItems(self),
              { type: 'divider' },
              openTrackMenuItem(),
              openConnectionMenuItem(),
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
                label: 'Trusted plugins...',
                onClick: () => {
                  self.session?.queueDialog((onClose: () => void) => [
                    TrustedPluginsDialog,
                    { onClose },
                  ])
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
