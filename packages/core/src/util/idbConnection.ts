import { openDB } from 'idb'

import type { DBSchema, IDBPDatabase, StoreNames } from 'idb'

/**
 * One connection to an IndexedDB database per page, opened on first use and
 * shared by every caller.
 *
 * Forgotten, so that the next call reopens, when the open fails, when the
 * browser closes it (site data cleared while the page was open), and when
 * another tab's upgrade to a newer version is waiting on this one to close —
 * holding it open there would hang that tab without keeping anything working
 * here.
 *
 * `upgrade` creates only the stores that are missing, because it runs from
 * whatever version the browser already has: creating a store that exists throws
 * and aborts the upgrade, leaving the database unopenable.
 */
export function idbConnection<DB extends DBSchema>(
  name: string,
  version: number,
  stores: StoreNames<DB>[],
) {
  let connection: Promise<IDBPDatabase<DB>> | undefined

  function forget(opening: Promise<IDBPDatabase<DB>>) {
    if (connection === opening) {
      connection = undefined
    }
  }

  function open() {
    const opening: Promise<IDBPDatabase<DB>> = openDB<DB>(name, version, {
      upgrade(db) {
        for (const store of stores) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store)
          }
        }
      },
      // the open waits, with no error, until an older tab lets go, which
      // otherwise reads as the app hanging
      blocked(currentVersion, blockedVersion) {
        console.warn(
          `${name}: waiting for another tab to close its connection (it holds v${currentVersion}, this tab wants v${blockedVersion}). Close other JBrowse tabs to continue.`,
        )
      },
      blocking() {
        forget(opening)
        void opening.then(db => {
          db.close()
        })
      },
      terminated() {
        forget(opening)
      },
    })
    opening.catch(() => {
      forget(opening)
    })
    return opening
  }

  return () => {
    connection ??= open()
    return connection
  }
}
