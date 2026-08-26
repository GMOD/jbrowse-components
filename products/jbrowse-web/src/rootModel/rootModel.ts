import { lazy } from 'react'

import {
  HistoryManagementMixin,
  RootAppMenuMixin,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { readConfObject } from '@jbrowse/core/configuration'
import { DNA } from '@jbrowse/core/ui/Icons'
import { indexedDBAvailable } from '@jbrowse/core/util'
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
import {
  saveSessionSnapshot,
  setupSessionDB,
  setupSessionStorageAutosave,
} from './persistence.ts'
import { savedSessionMenuItems } from './sessionMenus.ts'

import type { SessionDBHandle } from '../sessionDbOps.ts'
import type { Session, SessionMetadata } from '../types.ts'
import type { MenuDefinition, SessionModelFactory } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
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
const PermanentPluginsDialog = lazy(
  () => import('../components/PermanentPluginsDialog.tsx'),
)

interface SessionDbHost {
  sessionDB?: SessionDBHandle
  session?: {
    id: string
    notifyError: (message: string, error?: unknown) => void
  }
}

/**
 * Whether `id` names the session that is currently open, which is never an
 * ordinary row in the saved-session list. Four of the actions below have to ask
 * — deleting it, bulk-deleting it, re-opening it and renaming it all mean
 * something different for the open session — so the question is asked by name
 * rather than by four repetitions of the comparison.
 *
 * The autosave autorun rewrites that row every 400ms, and everything follows
 * from it: deleting it only makes it vanish until the next edit puts it back
 * (minus its star, which lived in the row just deleted), and re-opening it from
 * IndexedDB can only lose whatever the last tick has not written yet.
 */
function isOpenSession(self: SessionDbHost, id: string) {
  return id === self.session?.id
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
       * What has to stop the moment the React host lets go of this root — the
       * `beforeunload` listener and the autoruns that write to sessionStorage
       * and IndexedDB, i.e. everything reaching outside the tree.
       *
       * Deliberately not `addDisposer`, which fires only on destroy, because
       * destroy is what this root cannot do at detach time: React is still
       * holding its views and widgets in the outgoing props of the same
       * passive-effect flush. The destroy follows on a later task, so an
       * `addDisposer` here would run late rather than never — but "the moment
       * the host lets go" is the contract these want. See `detach` and
       * SessionLoader's disposePluginManager.
       */
      detachDisposers: [] as (() => void)[],
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

    .actions(self => {
      // Which fetchSessionMetadata call is allowed to publish. The read is
      // async and several actions trigger one, so two can be in flight at once
      // — and then whichever `getAll` happens to resolve LAST wins, which is
      // not necessarily the one that saw the most writes. That reinstates a row
      // the user just deleted, or un-stars one they just starred, until
      // something else happens to refresh the list. Only the newest call wins.
      let latestFetch = 0
      return {
        /**
         * #action
         */
        setSavedSessionMetadata(sessions: SessionMetadata[]) {
          self.savedSessionMetadata = sessions
        },

        /**
         * #action
         * Re-reads the whole `metadata` store. For anything that changes rows
         * this model didn't just write itself (first load, pruning, favorite,
         * rename, delete) — the autosave path uses `upsertSessionMetadata`
         * instead.
         */
        async fetchSessionMetadata() {
          if (self.sessionDB) {
            const token = ++latestFetch
            const ret = await self.sessionDB.getAll('metadata')
            if (token !== latestFetch) {
              return
            }
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
         * autosave autorun writes exactly one row on every debounced session
         * edit — every 400ms for as long as you keep panning — and already
         * holds its contents, so re-reading every session's metadata to learn
         * what it just stored is the expensive way to move one row to the top.
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
        setSessionDB(sessionDB: SessionDBHandle | undefined) {
          self.sessionDB = sessionDB
        },
      }
    })
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
        if (!indexedDBAvailable()) {
          // no autosave database here (jsdom, a locked-down browser profile).
          // An empty list rather than `undefined`, which means "still opening"
          // — the session manager would otherwise sit on its loading message
          // forever waiting for an open that is never going to happen.
          self.setSavedSessionMetadata([])
        } else {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          setupSessionDB(model)
        }
      },
      /**
       * #action
       * Register something that must stop when the React host detaches this
       * root. See the `detachDisposers` volatile for why this is not
       * `addDisposer`.
       */
      addDetachDisposer(disposer: () => void) {
        self.detachDisposers.push(disposer)
      },
      /**
       * #action
       * The React host has let go of this root: stop everything of ours that
       * reaches outside the tree — the worker pool, the `beforeunload`
       * listener, the sessionStorage and IndexedDB autoruns — and leave the
       * tree itself alone.
       *
       * Half the teardown. The caller destroys the tree on a later task
       * (`scheduleDetachedDestroy`), which is what runs the `beforeDestroy`
       * hooks in it — a plugin-facing contract, so skipping it is not an
       * option. What this action does is take everything that reaches outside
       * the tree off that deferral, so nothing keeps running in the window
       * between the two. ADR-069.
       */
      detach() {
        // rpcManager is a plain object on a volatile, so MST teardown never
        // reached it and the pool outlived every plugin install
        self.rpcManager.destroy()
        const disposers = self.detachDisposers
        self.detachDisposers = []
        for (const disposer of disposers) {
          disposer()
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
        // reloading the open session from IDB can only lose work — the row is
        // up to one autosave tick behind the live model
        if (isOpenSession(self, id)) {
          return
        }
        await withSessionDB(self, async sessionDB => {
          const ret = await sessionDB.get('sessions', id)
          if (!ret) {
            self.session?.notifyError('Session not found')
            return
          }
          // The autosave autorun is debounced, so the outgoing session's last
          // edits may not have landed yet — and once setSession swaps it out,
          // the pending tick reads the *new* session and they are lost for
          // good. Flush it here so switching sessions never costs the last
          // thing you did to the one you are leaving.
          if (self.session) {
            self.upsertSessionMetadata(
              await saveSessionSnapshot(
                sessionDB,
                self.session,
                self.configPath,
              ),
            )
          }
          self.setSession(ret)
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
        // aimed at one row, so say why that row is not going anywhere rather
        // than silently doing nothing (see isOpenSession)
        if (isOpenSession(self, id) && self.session) {
          // not wrapped in withErrorNotify: the only thing it does on failure
          // is push a snackbar, which is the call being made here
          self.session.notify(
            'Cannot delete the session that is currently open',
            'info',
          )
          return
        }
        await this.deleteSavedSessions([id])
      },
      /**
       * #action
       * Deletes a batch of saved sessions in ONE transaction, and re-reads the
       * metadata once at the end. Looping `deleteSavedSession` instead is both
       * N transactions and N full `getAll('metadata')` scans, and — because
       * those interleave — leaves `savedSessionMetadata` holding whichever scan
       * happened to resolve last, so already-deleted rows stay on screen until
       * something else refreshes the list.
       *
       * The open session is skipped rather than reported on, since a bulk
       * delete is not aimed at any one row (see deleteSavedSession).
       */
      async deleteSavedSessions(ids: string[]) {
        const toDelete = ids.filter(id => !isOpenSession(self, id))
        if (!toDelete.length) {
          return
        }
        await withSessionDB(self, async sessionDB => {
          await deleteSessionRows(sessionDB, toDelete)
          await self.fetchSessionMetadata()
        })
      },
      /**
       * #action
       */
      async renameSavedSession(id: string, name: string) {
        // renaming the active session goes through the live model so the
        // autosave autorun rewrites both stores; otherwise edit IDB directly
        if (isOpenSession(self, id)) {
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
                label: 'Permanent plugins...',
                onClick: () => {
                  self.session?.queueDialog((onClose: () => void) => [
                    PermanentPluginsDialog,
                    { onClose },
                  ])
                },
              },
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
