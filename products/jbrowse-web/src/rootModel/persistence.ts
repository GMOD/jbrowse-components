import { addDisposer, getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'
import { openDB } from 'idb'
import { autorun } from 'mobx'

import type { WebRootModel } from './rootModel.ts'
import type { SessionDB } from '../types.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// Opens the IndexedDB for autosave persistence, then mirrors session changes
// + metadata into idb on each session edit (debounced 400ms). Skipped when
// indexedDB is unavailable (tests, restricted environments).
export async function setupSessionDB(self: WebRootModel) {
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
              // careful not to access self.savedSessionMetadata in here, or
              // else it can create an infinite loop
              const s = self.session
              if (self.sessionDB) {
                await sessionDB.put('sessions', getSnapshot(s), s.id)
                if (!isAlive(self)) {
                  return
                }
                const ret = await self.sessionDB.get('metadata', s.id)
                if (!isAlive(self)) {
                  return
                }
                await sessionDB.put(
                  'metadata',
                  {
                    ...ret,
                    favorite: ret?.favorite ?? false,
                    name: s.name,
                    id: s.id,
                    createdAt: ret?.createdAt ?? new Date(),
                    configPath: self.configPath ?? '',
                  },
                  s.id,
                )
              }
              if (!isAlive(self)) {
                return
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
}

// Mirrors the current session into sessionStorage on every change so a tab
// reload restores it. Also triggers reloadPluginManager when pluginsUpdated
// flips — the snapshot must be written FIRST so the new plugin manager can
// restore it.
export function setupSessionStorageAutosave(self: WebRootModel) {
  let savingFailed = false
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
            if (self.pluginsUpdated) {
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
