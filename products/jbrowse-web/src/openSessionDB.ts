import { openDB } from 'idb'

import type { SessionDB } from './types.ts'

// Single source of truth for the autosave IndexedDB schema. Both the root
// model's autosave autorun and the session loader open the DB through here so
// the name/version/object-stores can never drift between call sites.
export function openSessionDB() {
  return openDB<SessionDB>('sessionsDB', 2, {
    upgrade(db) {
      // conditional because upgrade() is entered from whatever version the
      // browser already has, not always from nothing: a store that is already
      // there makes createObjectStore throw ConstraintError, which aborts the
      // upgrade transaction and leaves the whole autosave DB unopenable. Costs
      // nothing today (the DB has only ever been version 2) and is what makes a
      // future version bump a one-line change rather than a trap.
      for (const store of ['metadata', 'sessions'] as const) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store)
        }
      }
    },
  })
}
