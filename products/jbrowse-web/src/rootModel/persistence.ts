import { addDisposer, getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { openSessionDB } from '../openSessionDB.ts'

import type { Session, SessionDB } from '../types.ts'
import type { WebRootModel } from './rootModel.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { IDBPDatabase } from 'idb'

// Autosaves accumulate in IndexedDB forever otherwise: every distinct session
// leaves a full snapshot behind, eventually risking the storage quota. Keep all
// favorites plus the most recent non-favorites; the active session is never
// pruned.
const MAX_AUTOSAVED_SESSIONS = 100

async function pruneOldSessions(
  sessionDB: IDBPDatabase<SessionDB>,
  activeId: string | undefined,
) {
  const metadata = await sessionDB.getAll('metadata')
  const stale = metadata
    .filter(m => !m.favorite && m.id !== activeId)
    .sort((a, b) => +b.createdAt - +a.createdAt)
    .slice(MAX_AUTOSAVED_SESSIONS)
  await Promise.all(
    stale.flatMap(m => [
      sessionDB.delete('sessions', m.id),
      sessionDB.delete('metadata', m.id),
    ]),
  )
}

// Opens the IndexedDB for autosave persistence, then mirrors session changes
// + metadata into idb on each session edit (debounced 400ms). Skipped when
// indexedDB is unavailable (tests, restricted environments).
export async function setupSessionDB(self: WebRootModel) {
  try {
    const sessionDB = await openSessionDB()
    self.setSessionDB(sessionDB)
    await pruneOldSessions(sessionDB, self.session?.id)
    await self.fetchSessionMetadata()

    addDisposer(
      self,
      autorun(
        async () => {
          if (self.session) {
            try {
              // careful not to access self.savedSessionMetadata in here, or
              // else it can create an infinite loop. Capture id/name/snapshot
              // synchronously so the reactive reads are tracked and the async
              // tail never touches a possibly-destroyed node.
              const { id, name } = self.session
              const snap = getSnapshot<Session>(self.session)
              const configPath = self.configPath ?? ''
              await sessionDB.put('sessions', snap, id)
              const ret = await sessionDB.get('metadata', id)
              await sessionDB.put(
                'metadata',
                {
                  favorite: ret?.favorite ?? false,
                  createdAt: ret?.createdAt ?? new Date(),
                  name,
                  id,
                  configPath,
                },
                id,
              )
              if (isAlive(self)) {
                await self.fetchSessionMetadata()
              }
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
}

// Mirrors the current session into sessionStorage on every change so a tab
// reload restores it. Also triggers reloadPluginManager when pluginsUpdated
// flips — the snapshot must be written FIRST so the new plugin manager can
// restore it.
export function setupSessionStorageAutosave(self: WebRootModel) {
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
