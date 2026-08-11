import { addDisposer, getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'
import { sessionLastUsed } from '@jbrowse/web-core'
import { autorun } from 'mobx'

import { openSessionDB } from '../openSessionDB.ts'
import { deleteSessionRows, upsertSessionRows } from '../sessionDbOps.ts'

import type { SessionDBHandle } from '../sessionDbOps.ts'
import type { Session, SessionMetadata } from '../types.ts'
import type { WebRootModel } from './rootModel.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { IStateTreeNode, IType } from '@jbrowse/mobx-state-tree'

// Autosaves accumulate in IndexedDB forever otherwise: every distinct session
// leaves a full snapshot behind, eventually risking the storage quota. Keep all
// favorites plus the most recent non-favorites; the active session is never
// pruned.
const MAX_AUTOSAVED_SESSIONS = 100

/**
 * Which autosaved sessions the pruner deletes: everything past the newest
 * MAX_AUTOSAVED_SESSIONS non-favorites. Favorites and the open session are
 * never candidates, whatever their age.
 *
 * Split out from pruneOldSessions rather than left inline because this is the
 * one decision here that destroys a user's work when it is wrong, and it is
 * also the only part testable without an IndexedDB — jsdom has none, so the
 * transaction code around it never runs under jest at all.
 */
export function staleSessionIds(
  metadata: SessionMetadata[],
  activeId: string | undefined,
) {
  return metadata
    .filter(m => !m.favorite && m.id !== activeId)
    .sort((a, b) => +sessionLastUsed(b) - +sessionLastUsed(a))
    .slice(MAX_AUTOSAVED_SESSIONS)
    .map(m => m.id)
}

async function pruneOldSessions(
  sessionDB: SessionDBHandle,
  activeId: string | undefined,
) {
  const metadata = await sessionDB.getAll('metadata')
  await deleteSessionRows(sessionDB, staleSessionIds(metadata, activeId))
}

/**
 * Writes a session's snapshot and its metadata row to the autosave database,
 * and returns the row that landed.
 *
 * The point of the helper is the *synchronous head*: id, name and the snapshot
 * are read before anything is awaited. That is what keeps the autosave autorun
 * tracking them (an MST action or a read past an await runs untracked — see the
 * MST notes in CLAUDE.md), and what keeps the async tail from touching a node
 * that may have been destroyed in the meantime. It has to be right in two
 * places now — the autorun and the flush activateSession does on its way out —
 * so it is one function rather than two copies of the same three lines.
 */
export function saveSessionSnapshot(
  db: SessionDBHandle,
  // IStateTreeNode, never IAnyStateTreeNode — the latter resolves to `any` and
  // would stop checking that a caller passed something with an id and a name
  session: IStateTreeNode<IType<any, Session, any>> & {
    id: string
    name: string
  },
  configPath: string | undefined,
) {
  const { id, name } = session
  const snap = getSnapshot<Session>(session)
  return upsertSessionRows(db, snap, { id, name, configPath: configPath ?? '' })
}

// Opens the IndexedDB for autosave persistence, then mirrors session changes
// + metadata into idb on each session edit (debounced 400ms). Skipped when
// indexedDB is unavailable (tests, restricted environments).
export async function setupSessionDB(self: WebRootModel) {
  try {
    const sessionDB = await openSessionDB({
      // The connection is gone: another tab is upgrading the schema and we had
      // to close so its upgrade could run, or the browser terminated us. Drop
      // the handle — the autorun below reads it off the model each tick, so it
      // stops writing rather than throwing an InvalidStateError every 400ms,
      // and would pick a replacement handle straight back up.
      onLost: () => {
        if (isAlive(self)) {
          self.setSessionDB(undefined)
          self.session?.notify(
            'Session auto-save to this browser stopped, likely because another JBrowse tab is updating its storage. Reload this tab to resume.',
            'warning',
          )
        }
      },
    })
    // a plugin-install rebuild can destroy this root while the open (and the
    // two awaits below) are in flight. addDisposer on a dead node never fires,
    // so the autorun would be installed and never torn down — left writing a
    // destroyed session's snapshot for the life of the tab.
    if (!isAlive(self)) {
      sessionDB.close()
      return
    }
    self.setSessionDB(sessionDB)
    await pruneOldSessions(sessionDB, self.session?.id)
    await self.fetchSessionMetadata()
    if (!isAlive(self)) {
      return
    }

    // notifyError always pushes a fresh snackbar — its "report" action defeats
    // the duplicate-message check in pushSnackbarMessage — and this autorun
    // re-runs every 400ms for as long as the session keeps changing. So a
    // failure that persists (quota exceeded, a connection the browser closed
    // under us) would stack an unbounded pile of identical error toasts. Report
    // the first, then stay quiet until it works again, exactly as
    // setupSessionStorageAutosave does below.
    let savingFailed = false
    addDisposer(
      self,
      autorun(
        async () => {
          // read off the model rather than closing over the handle from the
          // open above: onLost clears it, and this is what makes that stick
          const db = self.sessionDB
          if (self.session && db) {
            try {
              // careful not to access self.savedSessionMetadata in the tracked
              // head of this autorun, or else it can create an infinite loop —
              // the list this writes is the list it would be observing.
              // (upsertSessionMetadata below reads it, but from inside an MST
              // action past an await, so neither is tracked.) saveSessionSnapshot
              // does its reads synchronously, which is what keeps them tracked.
              const meta = await saveSessionSnapshot(
                db,
                self.session,
                self.configPath,
              )
              if (isAlive(self)) {
                // the one row that changed is the one we just wrote, so merge it
                // in rather than re-reading every session's metadata on each
                // debounce tick (see upsertSessionMetadata)
                self.upsertSessionMetadata(meta)
                if (savingFailed) {
                  savingFailed = false
                  self.session?.notify('Session auto-saving restored', 'info')
                }
              }
            } catch (e) {
              console.error(e)
              if (!savingFailed) {
                savingFailed = true
                self.session?.notifyError(`${e}`, e)
              }
            }
          }
        },
        { delay: 400 },
      ),
    )
  } catch (e) {
    console.error(e)
    if (isAlive(self)) {
      // the list stays `undefined` on this path otherwise, which every reader
      // takes to mean "still opening" — the session manager would sit on its
      // loading message for the life of the tab rather than say there is
      // nothing to show
      self.setSavedSessionMetadata([])
      self.session?.notifyError(`${e}`, e)
    }
  }
}

// The one place the session snapshot is written. Takes the snapshot rather than
// the session so each caller does its own getSnapshot — which is what keeps the
// autorun below tracking it (see the MST notes in CLAUDE.md).
function writeSessionSnapshot(sessionSnap: unknown) {
  sessionStorage.setItem(
    'current',
    JSON.stringify({
      session: sessionSnap,
      createdAt: new Date(),
    }),
  )
}

// The autorun below is debounced, so the snapshot on disk trails the session by
// up to that delay and a tab closed inside the window loses the difference.
// Writing once more on the way out means the delay only trades write frequency
// against staleness-while-running, never against what a reload restores — so it
// can be tuned for cost alone.
//
// Safe to do synchronously here, which is why this is worth doing at all:
// sessionStorage.setItem is synchronous, so unlike an async save there is nothing
// to await and no way to wedge the unload. Errors are swallowed rather than
// reported — the page is going away, and a quota failure has already been
// surfaced by the autorun.
function setupUnloadFlush(self: WebRootModel) {
  const flush = () => {
    const session = self.session as AbstractSessionModel | undefined
    // isAlive because reading a destroyed node's props throws, and throwing out
    // of an unload handler is a bad way to find out
    if (session && isAlive(self)) {
      try {
        writeSessionSnapshot(getSnapshot(session))
      } catch {
        // nothing useful left to do with it
      }
    }
  }
  window.addEventListener('beforeunload', flush)
  // Every reloadPluginManager builds a replacement root model, so a listener left
  // behind accumulates one per reload for the life of the tab. It is the leak this
  // prevents, not a bad write — the isAlive check above already covers that, and
  // the two are deliberately redundant.
  addDisposer(self, () => {
    window.removeEventListener('beforeunload', flush)
  })
}

// Mirrors the current session into sessionStorage on every change so a tab
// reload restores it. Also triggers reloadPluginManager when pluginsUpdated
// flips — the snapshot must be written FIRST so the new plugin manager can
// restore it.
export function setupSessionStorageAutosave(self: WebRootModel) {
  setupUnloadFlush(self)
  let savingFailed = false
  // pluginsUpdated latches true and this rootModel lives on until the
  // replacement one mounts, so without this any session edit landing in that
  // window would request a second reload — off a loader that is already being
  // torn down. Kept local rather than clearing pluginsUpdated, which the
  // autorun observes and would re-trigger itself by writing.
  let reloadRequested = false
  addDisposer(
    self,
    autorun(
      () => {
        if (self.session) {
          const s = self.session as AbstractSessionModel
          const sessionSnap = getSnapshot(s)
          try {
            writeSessionSnapshot(sessionSnap)
            if (savingFailed) {
              savingFailed = false
              s.notify('Auto-saving restored', 'info')
            }
            if (self.pluginsUpdated && !reloadRequested) {
              reloadRequested = true
              self.reloadPluginManagerCallback(
                structuredClone(getSnapshot(self.jbrowse)),
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
}
