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
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

let counter = 0

export async function storeFileHandle(handle: FileSystemFileHandle) {
  const handleId = `fh${Date.now()}-${counter++}`
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
  return handleId
}

export async function getFileHandle(handleId: string) {
  const db = await getDB()
  const entry = await db.get(STORE_NAME, handleId)
  return entry?.handle
}

export async function removeFileHandle(handleId: string) {
  const db = await getDB()
  await db.delete(STORE_NAME, handleId)
}

export async function verifyPermission(
  handle: FileSystemFileHandle,
  requestPermission = false,
) {
  const options: FileSystemHandlePermissionDescriptor = { mode: 'read' }
  if ((await handle.queryPermission(options)) === 'granted') {
    return true
  }
  if (requestPermission) {
    if ((await handle.requestPermission(options)) === 'granted') {
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
