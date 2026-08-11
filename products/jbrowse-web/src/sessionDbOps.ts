import type { Session, SessionDB, SessionMetadata } from './types.ts'
import type { IDBPDatabase, IDBPObjectStore } from 'idb'

export type SessionDBHandle = IDBPDatabase<SessionDB>

const BOTH_STORES = ['sessions', 'metadata'] as const

type WritableStore<Name extends 'sessions' | 'metadata'> = IDBPObjectStore<
  SessionDB,
  typeof BOTH_STORES,
  Name,
  'readwrite'
>

/**
 * Runs `fn` against both object stores inside ONE readwrite transaction, and
 * does not resolve until that transaction has committed.
 *
 * Every mutation here goes through this, so "the two stores move together" is a
 * property of the shape of the code rather than of each call site remembering
 * to open the transaction the same way. See upsertSessionRows for what a
 * mutation split across two transactions cost.
 *
 * `fn` must await its own requests. An IDB transaction closes as soon as it has
 * nothing left to do once microtasks drain, so awaiting anything that is not
 * one of its own requests (a fetch, a timer, another transaction) between two
 * of them kills it — which surfaces as a TransactionInactiveError on the write
 * *after* the gap, not at the await that caused it.
 */
async function withBothStores<T>(
  db: SessionDBHandle,
  fn: (stores: {
    sessions: WritableStore<'sessions'>
    metadata: WritableStore<'metadata'>
  }) => Promise<T>,
) {
  const tx = db.transaction(BOTH_STORES, 'readwrite')
  try {
    const ret = await fn({
      sessions: tx.objectStore('sessions'),
      metadata: tx.objectStore('metadata'),
    })
    await tx.done
    return ret
  } catch (e) {
    // a failed request aborts the transaction, and `tx.done` rejects with it —
    // separately from the rejection we are about to rethrow. Nobody is left to
    // await it, so unobserved it lands in the console as an
    // unhandledrejection alongside the error the caller is already reporting.
    tx.done.catch(() => {})
    throw e
  }
}

/**
 * The metadata row an autosave writes, given whatever row was already there.
 *
 * Two fields are carried over rather than recomputed, and getting either wrong
 * is silent:
 *
 * - `favorite` lives only in this row, so a write that defaulted it to false
 *   would un-star a session on its next autosave tick.
 * - `createdAt` is pinned to the day the session first appeared. A session id
 *   survives reloads, so that date says nothing about whether the session is
 *   still in use; `updatedAt` is what the recent list, the pruner and the
 *   age-based delete all rank by.
 *
 * Pure, and separate from the transaction, because jsdom has no IndexedDB —
 * upsertSessionRows itself never executes under jest.
 */
export function nextSessionMetadata(
  prev: SessionMetadata | undefined,
  { id, name, configPath }: { id: string; name: string; configPath: string },
): SessionMetadata {
  const now = new Date()
  return {
    favorite: prev?.favorite ?? false,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    name,
    id,
    configPath,
  }
}

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
export function upsertSessionRows(
  db: SessionDBHandle,
  snap: Session,
  ident: { id: string; name: string; configPath: string },
) {
  const { id } = ident
  return withBothStores(db, async ({ sessions, metadata }) => {
    const meta = nextSessionMetadata(await metadata.get(id), ident)
    await Promise.all([sessions.put(snap, id), metadata.put(meta, id)])
    return meta
  })
}

export async function deleteSessionRows(db: SessionDBHandle, ids: string[]) {
  if (!ids.length) {
    return
  }
  await withBothStores(db, async ({ sessions, metadata }) => {
    await Promise.all(
      ids.flatMap(id => [sessions.delete(id), metadata.delete(id)]),
    )
  })
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
  await withBothStores(db, async ({ sessions, metadata }) => {
    // awaited one at a time, not Promise.all'd: awaiting the transaction's own
    // requests directly is the one pattern guaranteed to keep it open
    const snap = await sessions.get(id)
    const meta = await metadata.get(id)
    if (snap && meta) {
      await Promise.all([
        sessions.put({ ...snap, name }, id),
        metadata.put({ ...meta, name }, id),
      ])
    }
  })
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
