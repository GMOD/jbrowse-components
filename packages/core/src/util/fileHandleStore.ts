import { openDB } from 'idb'

import type { DBSchema, IDBPDatabase } from 'idb'

const DB_NAME = 'jbrowse-file-handles'
const DB_VERSION = 1
const STORE_NAME = 'handles'

interface FileHandleDB extends DBSchema {
  handles: {
    key: string
    value: {
      handle: FileSystemFileHandle
      name: string
      createdAt: number
    }
  }
}

let dbPromise: Promise<IDBPDatabase<FileHandleDB>> | undefined

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<FileHandleDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

export function isFileSystemAccessSupported() {
  const supported =
    typeof window !== 'undefined' && 'showOpenFilePicker' in window
  console.log('[FileHandleStore] isFileSystemAccessSupported:', supported)
  return supported
}

let counter = 0

export async function storeFileHandle(handle: FileSystemFileHandle) {
  const handleId = `fh${Date.now()}-${counter++}`
  console.log(
    '[FileHandleStore] storeFileHandle: storing handle with id',
    handleId,
    'name:',
    handle.name,
  )
  const db = await getDB()
  await db.put(
    STORE_NAME,
    {
      handle,
      name: handle.name,
      createdAt: Date.now(),
    },
    handleId,
  )
  console.log('[FileHandleStore] storeFileHandle: successfully stored in IDB')
  return handleId
}

export async function getFileHandle(handleId: string) {
  console.log('[FileHandleStore] getFileHandle: looking up handleId', handleId)
  const db = await getDB()
  const entry = await db.get(STORE_NAME, handleId)
  console.log(
    '[FileHandleStore] getFileHandle: found entry?',
    !!entry,
    entry ? `name: ${entry.name}` : '',
  )
  return entry?.handle
}

export async function removeFileHandle(handleId: string) {
  console.log('[FileHandleStore] removeFileHandle:', handleId)
  const db = await getDB()
  await db.delete(STORE_NAME, handleId)
}

export async function verifyPermission(
  handle: FileSystemFileHandle,
  requestPermission = false,
) {
  const options: FileSystemHandlePermissionDescriptor = { mode: 'read' }
  const currentPermission = await handle.queryPermission(options)
  console.log(
    '[FileHandleStore] verifyPermission: current permission for',
    handle.name,
    'is',
    currentPermission,
    'requestPermission:',
    requestPermission,
  )
  if (currentPermission === 'granted') {
    return true
  }
  if (requestPermission) {
    const newPermission = await handle.requestPermission(options)
    console.log(
      '[FileHandleStore] verifyPermission: after request, permission is',
      newPermission,
    )
    if (newPermission === 'granted') {
      return true
    }
  }
  return false
}

export async function cleanupStaleHandles(maxAgeMs: number) {
  const db = await getDB()
  const now = Date.now()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  let cursor = await store.openCursor()

  while (cursor) {
    if (now - cursor.value.createdAt > maxAgeMs) {
      await cursor.delete()
    }
    cursor = await cursor.continue()
  }

  await tx.done
}
