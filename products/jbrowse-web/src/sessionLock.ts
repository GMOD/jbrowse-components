// Each tab holds a Web Lock named after its open session's id, so a tab about
// to adopt an id can ask whether another live tab is already autosaving it.
// IndexedDB is shared across tabs, and two tabs on one id overwrite each
// other's row every autosave tick.
//
// `navigator.locks` exists only in secure contexts, and JBrowse is often served
// over plain http on an intranet; there, and under jest, every answer is
// 'unsupported' and callers keep their pre-lock behaviour.

export type SessionClaim = 'claimed' | 'held-elsewhere' | 'unsupported'

// how long a booting tab waits for a reload's outgoing document to release the
// lock before reading the id as open in another tab
export const RELOAD_LOCK_WAIT_MS = 1500

const held = new Map<string, () => void>()

function lockName(id: string) {
  return `jbrowse-session:${id}`
}

function locksAvailable() {
  return typeof navigator !== 'undefined' && !!navigator.locks
}

/**
 * Takes the lock for `id` and keeps it until `releaseSessionIdsExcept` lets it
 * go. `waitMs` 0 answers at once; the boot path passes a wait, because a
 * reloading tab's previous document can still be letting go of the same lock.
 */
export function claimSessionId(
  id: string,
  { waitMs = 0 }: { waitMs?: number } = {},
): Promise<SessionClaim> {
  if (!locksAvailable()) {
    return Promise.resolve('unsupported')
  }
  if (held.has(id)) {
    return Promise.resolve('claimed')
  }
  return new Promise(resolve => {
    navigator.locks
      .request(
        lockName(id),
        waitMs
          ? { signal: AbortSignal.timeout(waitMs) }
          : { ifAvailable: true },
        lock => {
          if (!lock) {
            resolve('held-elsewhere')
            return undefined
          }
          return new Promise<void>(release => {
            held.set(id, release)
            resolve('claimed')
          })
        },
      )
      .catch(() => {
        resolve('held-elsewhere')
      })
  })
}

/**
 * The ids among `ids` another live tab holds. That tab autosaves its session
 * every tick, so deleting or renaming the row here would be undone by its next
 * write.
 */
export async function sessionIdsHeldElsewhere(ids: string[]) {
  if (!locksAvailable()) {
    return new Set<string>()
  }
  const { held: locks = [] } = await navigator.locks.query()
  const names = new Set(locks.map(l => l.name))
  return new Set(ids.filter(id => !held.has(id) && names.has(lockName(id))))
}

export function releaseSessionIdsExcept(keep: string | undefined) {
  for (const [id, release] of held) {
    if (id !== keep) {
      held.delete(id)
      release()
    }
  }
}
