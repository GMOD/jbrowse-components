import { openDB } from 'idb'

import type { SessionDB } from './types.ts'

// Single source of truth for the autosave IndexedDB schema. Both the root
// model's autosave autorun and the session loader open the DB through here so
// the name/version/object-stores can never drift between call sites.
export function openSessionDB() {
  return openDB<SessionDB>('sessionsDB', 2, {
    upgrade(db) {
      db.createObjectStore('metadata')
      db.createObjectStore('sessions')
    },
  })
}
