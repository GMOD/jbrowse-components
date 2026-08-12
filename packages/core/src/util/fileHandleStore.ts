import { openDB } from 'idb'

import type { DBSchema, IDBPDatabase } from 'idb'

declare global {
  interface FileSystemFileHandle {
    queryPermission(options: {
      mode: 'read' | 'readwrite'
    }): Promise<PermissionState>
    requestPermission(options: {
      mode: 'read' | 'readwrite'
    }): Promise<PermissionState>
  }
}

const DB_NAME = 'jbrowse-file-handles'
const DB_VERSION = 1
const STORE_NAME = 'handles'

interface FileHandleDB extends DBSchema {
  handles: {
    key: string
    value: FileSystemFileHandle
  }
}

let dbPromise: Promise<IDBPDatabase<FileHandleDB>> | undefined

function getDB() {
  dbPromise ??= openDB<FileHandleDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME)
    },
  }).catch((error: unknown) => {
    // drop the rejected promise, so a transient open failure (a blocked
    // upgrade, a storage prompt the user has since answered) doesn't make every
    // later call replay the same error for the life of the page
    dbPromise = undefined
    throw error
  })
  return dbPromise
}

export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

let counter = 0

/**
 * Handles accumulated here forever: every pick wrote a row, nothing ever
 * deleted one, and re-picking a file the session already had wrote a second row
 * for the same file. Bounded the way the autosaved sessions are — keep the
 * newest N, drop the rest.
 *
 * Losing an old handle costs a re-pick, which is the same thing that happens
 * when the browser drops its permission, and never the data: a FileHandleLocation
 * that cannot be resolved is reported by ensureFileHandleReady and offered back
 * to the user through the restore banner.
 */
const MAX_STORED_HANDLES = 200

/** the `Date.now()` a `fh<ms>-<n>` id was minted at, or 0 for anything else */
function handleIdTime(id: string) {
  return +(/^fh(\d+)-/.exec(id)?.[1] ?? 0)
}

/**
 * Which stored handles the pruner drops: everything past the newest
 * MAX_STORED_HANDLES.
 *
 * Split out and exported for the same reason staleSessionIds is — jsdom has no
 * IndexedDB, so the transaction around it never runs under jest, and this is the
 * one part of the decision that is testable at all.
 */
export function staleHandleIds(keys: string[]) {
  return keys.length <= MAX_STORED_HANDLES
    ? []
    : [...keys]
        .sort((a, b) => handleIdTime(b) - handleIdTime(a))
        .slice(MAX_STORED_HANDLES)
}

async function pruneHandles(db: IDBPDatabase<FileHandleDB>) {
  const stale = staleHandleIds(await db.getAllKeys(STORE_NAME))
  if (!stale.length) {
    return
  }
  const tx = db.transaction(STORE_NAME, 'readwrite')
  await Promise.all([...stale.map(k => tx.store.delete(k)), tx.done])
}

/**
 * The id an equivalent handle is already stored under, if there is one.
 *
 * Re-picking a file the session already holds is the common case — the restore
 * banner asks for exactly that — and without this each re-pick minted a fresh
 * id, so the row count grew with the number of times a user reopened the same
 * files rather than with the number of files.
 */
async function findStoredHandleId(
  db: IDBPDatabase<FileHandleDB>,
  handle: FileSystemFileHandle,
) {
  // one transaction, so the keys and the values it indexes cannot come from two
  // different states of the store. Both requests are issued before either is
  // awaited, which is what keeps the transaction from closing between them.
  const tx = db.transaction(STORE_NAME, 'readonly')
  const [keys, stored] = await Promise.all([
    tx.store.getAllKeys(),
    tx.store.getAll(),
  ])
  // settled per comparison rather than thrown: isSameEntry rejects for a handle
  // the browser can no longer resolve, and one dead row must not stop the pick
  const matches = await Promise.all(
    stored.map(s => handle.isSameEntry(s).catch(() => false)),
  )
  return keys[matches.indexOf(true)]
}

export async function storeFileHandle(handle: FileSystemFileHandle) {
  const db = await getDB()
  const existing = await findStoredHandleId(db, handle)
  if (existing) {
    return existing
  }
  const handleId = `fh${Date.now()}-${counter++}`
  await db.put(STORE_NAME, handle, handleId)
  await pruneHandles(db)
  return handleId
}

export async function getFileHandle(handleId: string) {
  const db = await getDB()
  return db.get(STORE_NAME, handleId)
}

export async function verifyPermission(
  handle: FileSystemFileHandle,
  requestPermission = false,
) {
  const options = { mode: 'read' } as const
  const currentPermission = await handle.queryPermission(options)
  if (currentPermission === 'granted') {
    return true
  }
  if (requestPermission) {
    const newPermission = await handle.requestPermission(options)
    if (newPermission === 'granted') {
      return true
    }
  }
  return false
}
