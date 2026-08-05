import { addDisposer, getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'
import { sessionLastUsed } from '@jbrowse/web-core'
import { autorun } from 'mobx'

import { openSessionDB } from '../openSessionDB.ts'
import { deleteSessionRows, upsertSessionRows } from '../sessionDbOps.ts'

import type { SessionDBHandle } from '../sessionDbOps.ts'
import type { Session } from '../types.ts'
import type { WebRootModel } from './rootModel.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// Autosaves accumulate in IndexedDB forever otherwise: every distinct session
// leaves a full snapshot behind, eventually risking the storage quota. Keep all
// favorites plus the most recent non-favorites; the active session is never
// pruned.
const MAX_AUTOSAVED_SESSIONS = 100

async function pruneOldSessions(
  sessionDB: SessionDBHandle,
  activeId: string | undefined,
) {
  const metadata = await sessionDB.getAll('metadata')
  const stale = metadata
    .filter(m => !m.favorite && m.id !== activeId)
    .sort((a, b) => +sessionLastUsed(b) - +sessionLastUsed(a))
    .slice(MAX_AUTOSAVED_SESSIONS)
  await deleteSessionRows(
    sessionDB,
    stale.map(m => m.id),
  )
}

// Opens the IndexedDB for autosave persistence, then mirrors session changes
// + metadata into idb on each session edit (debounced 400ms). Skipped when
// indexedDB is unavailable (tests, restricted environments).
export async function setupSessionDB(self: WebRootModel) {
  try {
    const sessionDB = await openSessionDB()
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
          if (self.session) {
            try {
              // careful not to access self.savedSessionMetadata in the tracked
              // head of this autorun, or else it can create an infinite loop —
              // the list this writes is the list it would be observing.
              // (upsertSessionMetadata below reads it, but from inside an MST
              // action past an await, so neither is tracked.) Capture
              // id/name/snapshot synchronously so the reactive reads are tracked
              // and the async tail never touches a possibly-destroyed node.
              const { id, name } = self.session
              const snap = getSnapshot<Session>(self.session)
              const configPath = self.configPath ?? ''
              const meta = await upsertSessionRows(sessionDB, snap, {
                id,
                name,
                configPath,
              })
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
