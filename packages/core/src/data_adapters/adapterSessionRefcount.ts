/**
 * Counts how many live track models are using each rpcSessionId, so the
 * worker-side dataAdapterCache can be told when the last one goes away.
 *
 * ## Why a refcount and not just "track closed"
 *
 * An rpcSessionId is derived from the *adapter config* (BaseTrackModel's
 * `rpcSessionId` getter is `adapterConfigCacheKey(adapter)`), so it is shared by
 * every track model with that config — the same track shown in two linear genome
 * views is two model instances with one id, as is a pair of tracks configured
 * alike. Freeing on any close would evict an adapter the other view is still
 * querying. The count is incremented per track model and the free only fires at
 * zero.
 *
 * Counting here rather than walking the state tree at teardown keeps it exact:
 * during a session teardown the tree is already coming apart, and "is any other
 * track still using this?" is not a question worth asking of a half-destroyed
 * tree.
 *
 * ## Why a WeakMap keyed on the rpcManager
 *
 * The counts belong to one session. Keying them on the session's own RpcManager
 * means a discarded session's counts are collected with it, with no reset call
 * for anyone to forget. This is the case the adapter cache itself cannot use —
 * see dataAdapterCache — because here the key is a main-thread object whose
 * lifetime already matches, rather than a string that crossed a worker boundary.
 */

/**
 * The slice of RpcManager this needs. Structural rather than the concrete class
 * so that the partial stubs the model tests build satisfy it, and so that
 * adapter-lifetime bookkeeping does not depend on the RPC transport.
 */
interface RpcCaller {
  freeSession(sessionId: string): Promise<void>
}

const refcounts = new WeakMap<RpcCaller, Map<string, number>>()

/**
 * Whether there is an rpcManager to key counts on and to send a free to. A
 * session model assembled without one — which model unit tests do routinely —
 * should not make opening a track throw over what is only a cache hint, so both
 * entry points degrade to no-ops. It also has to be an object before it can be
 * a WeakMap key at all.
 */
function isUsable(rpcManager: RpcCaller | undefined): rpcManager is RpcCaller {
  return typeof rpcManager?.freeSession === 'function'
}

function countsFor(rpcManager: RpcCaller) {
  let counts = refcounts.get(rpcManager)
  if (!counts) {
    counts = new Map()
    refcounts.set(rpcManager, counts)
  }
  return counts
}

/** Record that a track model is using `sessionId`. Pair with release. */
export function retainAdapterSession(
  rpcManager: RpcCaller | undefined,
  sessionId: string,
) {
  if (!isUsable(rpcManager)) {
    return
  }
  const counts = countsFor(rpcManager)
  counts.set(sessionId, (counts.get(sessionId) ?? 0) + 1)
}

/**
 * Give up one claim on `sessionId`. When the last one goes, ask the worker to
 * drop the adapters cached under it — which is the only thing that ever makes
 * them collectable, since the cache is a strong reference rooted in module
 * scope.
 *
 * The free lands on the same driver the track's queries ran on, because every
 * call in the app runs on the one the session resolved — and, under a worker
 * pool, on the same worker, without booting one for a session that never
 * dispatched anything. See `BaseRpcDriver.freeSession`.
 *
 * Errors are swallowed on purpose. This runs on teardown, where a worker
 * already terminated by a session switch is the expected case rather than a
 * fault, and nothing downstream could act on the failure anyway.
 *
 * Closing and immediately reopening the same track can race: the free is in
 * flight while the reopened track re-retains, and the eviction lands on the
 * adapter the new track just claimed. It costs that track one re-setup and
 * heals itself on the next query, because an evicted adapter is only ever a
 * cold cache. Sequencing it away would mean generation counters on a cache,
 * which is a poor trade for a mis-click.
 */
export async function releaseAdapterSession(
  rpcManager: RpcCaller | undefined,
  sessionId: string,
) {
  if (!isUsable(rpcManager)) {
    return
  }
  const counts = countsFor(rpcManager)
  // a release with no matching retain floors at zero and frees, rather than
  // going negative and silently suppressing the next real free
  const remaining = (counts.get(sessionId) ?? 1) - 1
  if (remaining > 0) {
    counts.set(sessionId, remaining)
    return
  }
  counts.delete(sessionId)
  try {
    await rpcManager.freeSession(sessionId)
  } catch {
    // teardown; see above
  }
}
