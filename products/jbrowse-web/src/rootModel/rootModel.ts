import { lazy } from 'react'

import {
  AssemblyManager,
  HistoryManagementMixin,
  RootAppMenuMixin,
  aboutMenuItem,
  helpMenuItem,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { sessionLoading } from '@jbrowse/core/ui/AppReadyMarker'
import { DNA } from '@jbrowse/core/ui/Icons'
import { indexedDBAvailable } from '@jbrowse/core/util'
import { getSnapshot, isAlive, types } from '@jbrowse/mobx-state-tree'
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
} from '@jbrowse/product-core'
import { byLastUsedDesc } from '@jbrowse/web-core'
import FileCopyIcon from '@mui/icons-material/FileCopy'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'

import packageJSON from '../../package.json' with { type: 'json' }
import { gitCommit } from '../buildInfo.ts'
import jbrowseWebFactory from '../jbrowseModel.ts'
import makeWorkerInstance from '../makeWorkerInstance.ts'
import { takeWorker } from '../prewarmedWorker.ts'
import {
  deleteSessionRows,
  renameSessionRows,
  patchSessionMetadataRow,
} from '../sessionDbOps.ts'
import { claimSessionId, sessionIdsHeldElsewhere } from '../sessionLock.ts'
import { renderSessionThumbnail } from '../sessionThumbnail.ts'
import {
  saveSessionSnapshot,
  setupSessionDB,
  setupSessionLock,
  setupSessionStorageAutosave,
} from './persistence.ts'

import type { SessionDBHandle } from '../sessionDbOps.ts'
import type productSessionModelFactory from '../sessionModel/index.ts'
import type { Session, SessionMetadata } from '../types.ts'
import type { Menu } from '@jbrowse/app-core'
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

// roots with an export in flight: a slow one would otherwise pile up behind
// itself
const capturingThumbnail = new WeakSet<object>()

// per session node, the snapshot its last picture shows, so hiding the tab
// again without an edit in between draws nothing
const thumbnailSnapshots = new WeakMap<object, unknown>()

const OPEN_ELSEWHERE =
  'That session is open in another tab, so change it from that tab'

// Whether a row belongs in this root's recent lists: saved against this config,
// and edited at some point rather than only written as it booted (see
// saveSessionSnapshot)
function isListed(self: { configPath?: string }, m: SessionMetadata) {
  return m.configPath === (self.configPath ?? '') && m.edited !== false
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
 * Holds JBrowse Web's top-level state: the loaded config, the session,
 * internet accounts, undo history, the app menus and the saved sessions kept
 * in the browser.
 *
 * Many properties of the root model are available through the session, and
 * we generally prefer using the session model (via e.g. `getSession`) over the
 * root model (via e.g. `getRoot`) in plugin code.
 */
export default function RootModel({
  pluginManager,
  sessionModelFactory,
  adminMode = false,
}: {
  pluginManager: PluginManager
  sessionModelFactory: typeof productSessionModelFactory
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
          makeWorkerInstance: () => takeWorker(makeWorkerInstance),
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
              ret.filter(m => isListed(self, m)).sort(byLastUsedDesc),
            )
          }
        },
        /**
         * #action
         * Merges a row this model has just written into the in-memory list. The
         * autosave autorun writes exactly one row on every throttled session
         * edit — every 400ms for as long as you keep panning — and already
         * holds its contents, so re-reading every session's metadata to learn
         * what it just stored is the expensive way to move one row to the top.
         */
        upsertSessionMetadata(meta: SessionMetadata) {
          if (isListed(self, meta)) {
            this.setSavedSessionMetadata(
              [
                meta,
                ...(self.savedSessionMetadata ?? []).filter(
                  m => m.id !== meta.id,
                ),
              ].sort(byLastUsedDesc),
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
        setupSessionLock(model)
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
          // The autosave autorun is throttled, so the outgoing session's last
          // edits may not have landed yet — and once setSession swaps it out,
          // the pending tick reads the *new* session and they are lost for
          // good. Flush it here so switching sessions never costs the last
          // thing you did to the one you are leaving.
          const flushed =
            self.session &&
            (await saveSessionSnapshot(
              sessionDB,
              self.session,
              self.configPath,
            ))
          if (flushed) {
            self.upsertSessionMetadata(flushed)
          }
          // the export blocks the main thread while the switch repaints the
          // app anyway. An export of a session still loading waits on its fetch.
          if (self.session && !sessionLoading(self.session)) {
            await this.captureSessionThumbnail()
          }
          await self.pluginManager.preloadSessionTypes(ret)
          // another tab is autosaving this id, and sharing it would have the
          // two overwrite one row (sessionLock.ts)
          if ((await claimSessionId(id)) === 'held-elsewhere') {
            const { id: _id, ...copy } = ret
            self.setSession({ ...copy, name: `${ret.name} (copy)` })
            self.session?.notify(
              'That session is open in another tab, so a copy was opened here',
              'info',
            )
          } else {
            self.setSession(ret)
          }
        })
      },
      /**
       * #action
       * Opens a session snapshot under a fresh id, so it autosaves beside the
       * session it came from rather than over it.
       */
      async openSessionCopy(snap: Record<string, unknown>) {
        const { id: _id, ...rest } = snap
        await withErrorNotify(self, async () => {
          await self.pluginManager.preloadSessionTypes(rest)
          self.setSession(rest)
        })
      },
      /**
       * #action
       */
      async setSavedSessionFavorite(id: string, favorite: boolean) {
        await withSessionDB(self, async sessionDB => {
          await patchSessionMetadataRow(sessionDB, id, { favorite })
          await self.fetchSessionMetadata()
        })
      },
      /**
       * #action
       * Pictures the open session for the session manager. Silent on failure,
       * since the usual ones are normal states (a view still on its import
       * form, a fetch outlasting the export's bound, a session swapped out
       * mid-export), and the row keeps its previous picture.
       */
      async captureSessionThumbnail() {
        const { session, sessionDB } = self
        if (!session || !sessionDB || capturingThumbnail.has(self)) {
          return
        }
        const snap = getSnapshot(session)
        if (thumbnailSnapshots.get(session) === snap) {
          return
        }
        capturingThumbnail.add(self)
        try {
          const { id } = session
          const thumbnail = await renderSessionThumbnail(session.views)
          thumbnailSnapshots.set(session, snap)
          const meta =
            thumbnail &&
            (await patchSessionMetadataRow(sessionDB, id, { thumbnail }))
          if (meta && isAlive(self)) {
            self.upsertSessionMetadata(meta)
          }
        } catch {
          // see above
        } finally {
          capturingThumbnail.delete(self)
        }
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
        if ((await sessionIdsHeldElsewhere([id])).size) {
          self.session?.notify(OPEN_ELSEWHERE, 'info')
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
       * delete is not aimed at any one row (see deleteSavedSession). Resolves
       * to the number deleted: 0 when the transaction failed, which has
       * already been reported.
       */
      async deleteSavedSessions(ids: string[]) {
        const elsewhere = await sessionIdsHeldElsewhere(ids)
        const toDelete = ids.filter(
          id => !isOpenSession(self, id) && !elsewhere.has(id),
        )
        let deleted = 0
        if (toDelete.length) {
          await withSessionDB(self, async sessionDB => {
            await deleteSessionRows(sessionDB, toDelete)
            deleted = toDelete.length
            await self.fetchSessionMetadata()
          })
        }
        return deleted
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
        if ((await sessionIdsHeldElsewhere([id])).size) {
          self.session?.notify(OPEN_ELSEWHERE, 'info')
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
        const { preConfiguredSessions } = self.jbrowse

        const ret: Menu[] = [
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
                    const snap = getSnapshot<Session>(self.session)
                    void self.openSessionCopy({
                      ...snap,
                      name: `${snap.name} (copy)`,
                    })
                  }
                },
              },
              ...(preConfiguredSessions.length
                ? [
                    {
                      label: 'Pre-configured sessions...',
                      subMenu: preConfiguredSessions.map(r => ({
                        label: r.name,
                        onClick: () => {
                          void self.openSessionCopy(r)
                        },
                      })),
                    },
                  ]
                : []),
              {
                label: 'Recent sessions...',
                icon: FolderOpenIcon,
                onClick: () => {
                  self.session?.openWidget('SessionManager', 'sessionManager')
                },
              },
              { type: 'divider' },
              openTrackMenuItem(),
              openConnectionMenuItem(),
            ],
          },
          ...(adminMode
            ? [
                {
                  label: 'Admin',
                  menuItems: () => [
                    {
                      label: 'Save track settings to config',
                      helpText:
                        'Write the track settings edited in this session into the config.json every visitor is served',
                      disabled: !self.session?.promotableTrackIds.length,
                      onClick: () => {
                        self.session?.promoteTrackConfigDeltas()
                      },
                    },
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
            menuItems: () => [],
          },
          {
            label: 'Tools',
            menuItems: () => [
              undoMenuItem(self.history),
              redoMenuItem(self.history),
              { type: 'divider' },
              pluginStoreMenuItem(),
              {
                label: 'Assembly manager',
                icon: DNA,
                onClick: () => {
                  const { session } = self
                  session?.queueDialog((onClose: () => void) => [
                    AssemblyManager,
                    { onClose, session, rootModel: self },
                  ])
                },
              },

              preferencesMenuItem(pluginManager),
            ],
          },
          {
            label: 'Help',
            menuItems: () => [aboutMenuItem(), helpMenuItem()],
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
