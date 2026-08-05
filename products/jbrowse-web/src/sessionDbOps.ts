import type { Session, SessionDB, SessionMetadata } from './types.ts'
import type { IDBPDatabase } from 'idb'

export type SessionDBHandle = IDBPDatabase<SessionDB>

const BOTH_STORES = ['sessions', 'metadata'] as const

/**
 * The autosave write: the session snapshot plus the metadata row that indexes
 * it, in ONE readwrite transaction.
 *
 * Two properties come from that, and both were bugs when this was a sequence of
 * separate transactions:
 *
 * - the stores stay in step. A `sessions` row whose `metadata` row never landed
 *   is invisible to the recent list *and* to the pruner (which walks metadata),
 *   so it would sit in IndexedDB forever.
 * - the read-modify-write of the metadata row is atomic against the other
 *   writers of that row. Favoriting the *current* session used to be lost:
 *   read-false / user's write-true / autosave's write-false, all within the
 *   400ms autosave tick, and the star silently popped back off.
 */
export async function upsertSessionRows(
  db: SessionDBHandle,
  snap: Session,
  { id, name, configPath }: { id: string; name: string; configPath: string },
) {
  const tx = db.transaction(BOTH_STORES, 'readwrite')
  const metadata = tx.objectStore('metadata')
  const prev = await metadata.get(id)
  const meta: SessionMetadata = {
    favorite: prev?.favorite ?? false,
    // a session id survives reloads, so createdAt is pinned to the day the
    // session first appeared and says nothing about whether it is still in use.
    // updatedAt is what the recent list, the pruner and the age-based delete all
    // rank by.
    createdAt: prev?.createdAt ?? new Date(),
    updatedAt: new Date(),
    name,
    id,
    configPath,
  }
  await Promise.all([
    tx.objectStore('sessions').put(snap, id),
    metadata.put(meta, id),
    tx.done,
  ])
  return meta
}

export async function deleteSessionRows(db: SessionDBHandle, ids: string[]) {
  if (!ids.length) {
    return
  }
  const tx = db.transaction(BOTH_STORES, 'readwrite')
  const sessions = tx.objectStore('sessions')
  const metadata = tx.objectStore('metadata')
  await Promise.all([
    ...ids.flatMap(id => [sessions.delete(id), metadata.delete(id)]),
    tx.done,
  ])
}

/**
 * Renames a session that is not the open one — the name lives in both the
 * snapshot and its metadata row, so both are rewritten together.
 */
export async function renameSessionRows(
  db: SessionDBHandle,
  id: string,
  name: string,
) {
  const tx = db.transaction(BOTH_STORES, 'readwrite')
  const sessions = tx.objectStore('sessions')
  const metadata = tx.objectStore('metadata')
  // awaited one at a time, not Promise.all'd: an IDB transaction closes as soon
  // as it has nothing left to do once microtasks drain, so awaiting its own
  // requests directly is the one pattern guaranteed to keep it open
  const snap = await sessions.get(id)
  const meta = await metadata.get(id)
  if (snap && meta) {
    await Promise.all([
      sessions.put({ ...snap, name }, id),
      metadata.put({ ...meta, name }, id),
    ])
  }
  await tx.done
}

/**
 * Read-modify-write of one metadata row. In its own transaction so the autosave
 * tick can't interleave between the read and the write (see upsertSessionRows).
 */
export async function setSessionFavoriteRow(
  db: SessionDBHandle,
  id: string,
  favorite: boolean,
) {
  const tx = db.transaction('metadata', 'readwrite')
  const metadata = tx.objectStore('metadata')
  const meta = await metadata.get(id)
  if (meta) {
    await metadata.put({ ...meta, favorite }, id)
  }
  await tx.done
}
