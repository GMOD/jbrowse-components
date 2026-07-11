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
  })
  return dbPromise
}

export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

let counter = 0

export async function storeFileHandle(handle: FileSystemFileHandle) {
  const handleId = `fh${Date.now()}-${counter++}`
  const db = await getDB()
  await db.put(STORE_NAME, handle, handleId)
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
