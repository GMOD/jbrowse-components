import { openDB } from 'idb'

import type { SessionDB } from './types.ts'
import type { IDBPDatabase } from 'idb'

// Single source of truth for the autosave IndexedDB schema. Both the root
// model's autosave autorun and the session loader open the DB through here so
// the name/version/object-stores can never drift between call sites.
export function openSessionDB({
  onLost,
}: {
  /**
   * Called when this connection has stopped being usable — see the `blocking`
   * and `terminated` callbacks below. Holders of a long-lived connection must
   * pass this and drop their handle; a one-shot read that closes immediately
   * has nothing to do here.
   */
  onLost?: () => void
} = {}) {
  // the handle is needed by `blocking`, which can only fire long after open()
  // has resolved, so filling it in from the resolution below is safe
  let handle: IDBPDatabase<SessionDB> | undefined
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
    // An older tab is holding the DB open at the previous version and did not
    // let go, so this open() will sit unresolved until it does. Every caller of
    // openSessionDB awaits it — including readSessionFromIDB, on the boot path
    // — so without a word in the console this reads as the app hanging with no
    // error at all.
    blocked(currentVersion, blockedVersion) {
      console.warn(
        `sessionsDB: waiting for another tab to close its connection (it holds v${currentVersion}, this tab wants v${blockedVersion}). Close other JBrowse tabs to continue.`,
      )
    },
    // The mirror image: this connection is the one holding an older version
    // open, and some other tab's upgrade is stuck behind it. Close so that
    // upgrade can run — a connection kept open here does not preserve
    // autosaving, it just hangs the other tab forever.
    blocking() {
      handle?.close()
      onLost?.()
    },
    // The browser closed the connection under us (storage cleared, a "delete
    // site data", the database dropped). Not called for our own close().
    terminated() {
      onLost?.()
    },
  }).then(db => {
    handle = db
    return db
  })
}
