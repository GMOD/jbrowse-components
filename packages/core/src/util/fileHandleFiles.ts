import { observable, runInAction } from 'mobx'

import type { FileHandleLocation } from './types/data.ts'

/**
 * The File each stored FileSystemFileHandle last yielded, by handleId.
 *
 * openLocation is synchronous, so the async `handle.getFile()` is resolved
 * ahead of time and kept here. A File is a snapshot: once the file changes on
 * disk the browser refuses to read it, so the handles are kept too and asked
 * for a fresh File whenever the window regains focus, which is when a file
 * edited in another program comes back to be looked at.
 *
 * Observable because the File is part of an adapter's identity
 * ({@link fileHandleBlobId}): a track's rpcSessionId moves to a new adapter,
 * with a new chunk cache, when its file is restored, re-picked or edited.
 */
const fileHandleCache = observable.map<string, File>()
const handles = new Map<string, FileSystemFileHandle>()

/**
 * Every handleId this page has been asked about, resolved or not. A location
 * naming one must be converted, or refused, before an RPC carries it: the
 * worker has no handles, and an adapter built over an unresolved location
 * opens nothing until its first read, so it would be cached broken.
 */
const namedHandleIds = new Set<string>()

let refreshesOnFocus = false

export function getFileFromCache(handleId: string) {
  return fileHandleCache.get(handleId)
}

export function setFileInCache(
  handleId: string,
  file: File,
  handle?: FileSystemFileHandle,
) {
  namedHandleIds.add(handleId)
  if (handle) {
    handles.set(handleId, handle)
    refreshOnFocus()
  }
  runInAction(() => {
    fileHandleCache.set(handleId, file)
  })
}

export function clearFileFromCache(handleId: string) {
  handles.delete(handleId)
  runInAction(() => {
    fileHandleCache.delete(handleId)
  })
}

export function noteFileHandleId(handleId: string) {
  namedHandleIds.add(handleId)
}

/**
 * Whether any RPC might carry a FileHandleLocation, so the arguments need the
 * walk that converts them.
 */
export function hasFileHandlesInCache() {
  return namedHandleIds.size > 0
}

/**
 * The BlobLocation id a FileHandleLocation crosses to the worker as. It names
 * the File's version, so an edited or re-picked file is a different adapter
 * and a different chunk-cache key from the snapshot it replaces.
 */
export function fileHandleBlobId(handleId: string) {
  const file = fileHandleCache.get(handleId)
  return file
    ? `fh-blob-${handleId}@${file.lastModified}:${file.size}`
    : `fh-blob-${handleId}`
}

export function fileForHandleLocation(location: FileHandleLocation) {
  const file = fileHandleCache.get(location.handleId)
  if (!file) {
    throw new Error(
      `file ("${location.name}") requires permission. Please reopen the file from track settings`,
    )
  }
  return file
}

async function refreshFile(handleId: string, handle: FileSystemFileHandle) {
  try {
    const file = await handle.getFile()
    const held = fileHandleCache.get(handleId)
    if (held?.lastModified !== file.lastModified || held.size !== file.size) {
      setFileInCache(handleId, file, handle)
    }
  } catch {
    clearFileFromCache(handleId)
  }
}

export async function refreshFileHandleFiles() {
  await Promise.all(
    [...handles].map(([handleId, handle]) => refreshFile(handleId, handle)),
  )
}

function refreshOnFocus() {
  if (!refreshesOnFocus && typeof window !== 'undefined') {
    refreshesOnFocus = true
    window.addEventListener('focus', () => {
      void refreshFileHandleFiles()
    })
  }
}
