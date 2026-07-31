import { makeAbortError } from './aborting.ts'
import { isWebWorker } from './isWebWorker.ts'
import { nanoid } from './nanoid.ts'
import { createTimeGate } from './timeGate.ts'

import type { TimeGate } from './timeGate.ts'

/**
 * Stop tokens cancel long-running work wherever an RPC method runs — a web
 * worker, or in-band on the main thread under `MainThreadRpcDriver`.
 *
 * Stopping a token records its id locally and posts it to every booted worker,
 * whose `RpcServer` records it too, so a check is a set lookup — free, exact,
 * and asking nothing of the deployment. A worker delivers that message whenever
 * it yields, so this covers any check reached after a *macrotask-yielding*
 * await; awaiting an already-resolved promise only drains microtasks, which is
 * the same distinction `abortBreakPoint` in `aborting.ts` exists for.
 *
 * A loop that never yields can be interrupted only by something it can read
 * *synchronously*, which the message path by definition cannot offer. Two
 * mechanisms cover that, in {@link checkStopTokenThrottled}:
 *
 * - an atomic flag in a `SharedArrayBuffer` token, where the page happens to be
 *   cross-origin isolated. Cheap, but never assume it: SAB needs COOP/COEP on
 *   the top-level document, which an embeddable library cannot require of its
 *   host page.
 * - otherwise a revocable blob URL probed by synchronous XHR, throttled because
 *   it is expensive (https://yoyo-code.com/how-to-stop-synchronous-web-worker/,
 *   (c) 2022 Matyáš Racek, MIT).
 *
 * **The blob probe was deleted once and had to be restored — don't repeat it.**
 * `website/scripts/cancel-bench.ts` measured it at zero (median 513 ms settle
 * either way over a 2000x BAM cancel burst) and that measurement was sound but
 * scoped: every loop on the alignments path is already chunked by awaits at
 * region granularity, so there was nothing there for an intra-loop probe to
 * interrupt. The counter-example is `getLDMatrix.ts`'s O(n²) Float32Array fill —
 * millions of pair computations with no await anywhere, where this probe is the
 * only thing that can stop the work, and which that bench never exercises. Any
 * future attempt to delete this needs a cancel measurement on an
 * await-free workload (LD or multi-sample-variant), not on a pileup.
 */

export type StopToken = string | SharedArrayBuffer

// Atomic flag values stored in the Int32Array view of the SharedArrayBuffer
const ABORT_FLAG_CLEAR = 0
const ABORT_FLAG_SET = 1

// How often the SAB path performs its (cheap) atomic read.
const SAB_CHECK_EVERY_N_ITERS = 10

// Minimum ms between a string token's in-loop checks (also the linear-backoff
// step), and a cap so cancel latency stays bounded on a long-running loop. The
// gate exists for the synchronous XHR probe, which is far too expensive per
// item; the free set lookup rides along inside it.
const STRING_CHECK_INTERVAL_MS = 50
const STRING_CHECK_INTERVAL_MAX_MS = 500

function isSharedArrayBuffer(value: unknown): value is SharedArrayBuffer {
  return (
    typeof SharedArrayBuffer !== 'undefined' &&
    value instanceof SharedArrayBuffer
  )
}

/**
 * Narrow an untyped RPC argument to a StopToken, so a caller holding
 * `Record<string, unknown>` can check one without a cast.
 */
export function isStopToken(value: unknown): value is StopToken {
  return typeof value === 'string' || isSharedArrayBuffer(value)
}

// Browser support for SharedArrayBuffer requires cross-origin isolation
// headers (COOP/COEP). Exported so diagnostic surfaces (about widget,
// error stack trace) can show whether the page actually got the fast path.
export const hasSharedArrayBuffer = (() => {
  try {
    return isSharedArrayBuffer(new SharedArrayBuffer(4))
  } catch {
    return false
  }
})()

// ---------------------------------------------------------------------------
// Stopped-id registry (the message path)
// ---------------------------------------------------------------------------

// Retention for a stopped id. An entry is only useful while work carrying that
// token could still check it, and work unwinds within moments of its own
// cancellation, so this is bounded by *age* rather than by a count: a count cap
// silently drops a still-live token's stopped-ness once enough other operations
// have been cancelled, and answering "not stopped" for a stopped token is a lost
// cancellation, not a slow one. Age bounds memory by cancellation *rate*
// instead, and no plausible check arrives minutes after its own stop.
const STOPPED_ID_TTL_MS = 5 * 60 * 1000

// Sweep only once the map is big enough that retention could matter, so the
// common case is a plain insert.
const STOPPED_ID_SWEEP_AT = 256

const stoppedIds = new Map<string, number>()

const signalControllers = new Map<string, Set<AbortController>>()

/**
 * Record that a string token has been stopped, and abort any {@link
 * stopTokenSignal} taken against it. Called locally by {@link stopStopToken},
 * and in a worker by `RpcServer` when the main thread posts a stopped id.
 */
export function markStopTokenStopped(id: string) {
  const now = Date.now()
  stoppedIds.set(id, now)
  if (stoppedIds.size > STOPPED_ID_SWEEP_AT) {
    // a Map iterates in insertion order, and timestamps only increase, so this
    // can stop at the first entry still inside the window
    for (const [key, stoppedAt] of stoppedIds) {
      if (now - stoppedAt < STOPPED_ID_TTL_MS) {
        break
      }
      stoppedIds.delete(key)
    }
  }
  const controllers = signalControllers.get(id)
  if (controllers) {
    signalControllers.delete(id)
    for (const controller of controllers) {
      controller.abort(makeAbortError())
    }
  }
}

type StopTokenBroadcaster = (id: string) => void

const broadcasters = new Set<StopTokenBroadcaster>()

/**
 * Register a transport that forwards a stopped token's id to wherever the work
 * is running. Drivers owning a worker pool register at construction and drop it
 * on destroy; `MainThreadRpcDriver` needs none — its work shares this module
 * instance and reads `stoppedIds` directly, which is why main-thread RPC gets
 * exact cancellation without any message at all.
 */
export function registerStopTokenBroadcaster(fn: StopTokenBroadcaster) {
  broadcasters.add(fn)
  return () => {
    broadcasters.delete(fn)
  }
}

// ---------------------------------------------------------------------------
// Create / stop
// ---------------------------------------------------------------------------

export function createStopToken(): StopToken {
  // A fresh SharedArrayBuffer is already zeroed, i.e. ABORT_FLAG_CLEAR.
  return hasSharedArrayBuffer ? new SharedArrayBuffer(4) : createStringToken()
}

function createStringToken() {
  // A blob URL serves as both the token's unique id (which is all the message
  // path needs) and the thing the sync probe fails against once revoked. Where
  // createObjectURL is unavailable a bare id still gives full await-boundary
  // cancellation — it just has no sync probe. That is a real degradation but no
  // longer the old hole, where such a token could never be cancelled at all.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return URL.createObjectURL === undefined
    ? nanoid()
    : URL.createObjectURL(new Blob())
}

/**
 * Stop a token: every check against it now throws, every {@link
 * stopTokenSignal} taken against it aborts, and workers are told so their
 * in-flight calls do the same.
 *
 * Call it when an operation ends, not only when cancelling one — a completed
 * fetch's token otherwise pins its signal controllers until the next fetch
 * supersedes it.
 */
export function stopStopToken(stopToken?: StopToken) {
  if (stopToken !== undefined) {
    if (isSharedArrayBuffer(stopToken)) {
      const view = new Int32Array(stopToken)
      Atomics.store(view, 0, ABORT_FLAG_SET)
      // wakes the waitAsync watcher stopTokenSignal installs; free when there
      // is none waiting
      Atomics.notify(view, 0)
    } else {
      markStopTokenStopped(stopToken)
      for (const broadcast of broadcasters) {
        broadcast(stopToken)
      }
      // revoking is what makes the sync probe start failing, so this is load
      // bearing for in-loop cancellation and not just cleanup
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      URL.revokeObjectURL?.(stopToken)
    }
  }
}

/**
 * The production {@link SyncStopProbe}: a synchronous XHR against the token's
 * blob URL, which succeeds while the URL is live and throws once the main thread
 * has revoked it.
 *
 * Returns false rather than probing when it cannot tell — outside a worker
 * (synchronous XHR there is deprecated and would block the UI) or on a
 * non-`blob:` id (probing one would 404 and abort on the first check). jsdom is
 * not a worker global, so this is inert under jest; see {@link SyncStopProbe}
 * for what that cost us and how tests work around it.
 */
function probeBlobUrl(stopToken: string) {
  let stopped = false
  if (isWebWorker() && stopToken.startsWith('blob:')) {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', stopToken, false)
    try {
      xhr.send(null)
    } catch {
      stopped = true
    }
  }
  return stopped
}

// ---------------------------------------------------------------------------
// One-shot check (use at async boundaries)
// ---------------------------------------------------------------------------

/**
 * Whether this token has been stopped, without throwing. Prefer {@link
 * checkStopToken} where an abort should unwind the operation; use this to bail
 * out cleanly instead of throwing and catching one frame up.
 */
export function isStopped(stopToken?: StopToken) {
  return stopToken === undefined
    ? false
    : isSharedArrayBuffer(stopToken)
      ? Atomics.load(new Int32Array(stopToken), 0) === ABORT_FLAG_SET
      : stoppedIds.has(stopToken)
}

/**
 * Throw an AbortError if this token has been stopped. Place at await
 * boundaries; this costs an atomic load or a set lookup, never a probe.
 */
export function checkStopToken(stopToken?: StopToken) {
  if (isStopped(stopToken)) {
    throw makeAbortError()
  }
}

// ---------------------------------------------------------------------------
// AbortSignal bridge (for aborting in-flight network requests)
// ---------------------------------------------------------------------------

export interface StopTokenSignal {
  signal: AbortSignal
  dispose: () => void
}

/**
 * An `AbortSignal` wired to a stop token, so a canceled operation drops its
 * in-flight HTTP reads at the socket instead of downloading them to completion
 * and discarding the result. Call it where the work runs (worker-side for
 * worker RPC) and pass `signal` down through `BaseOptions`, which the gmod
 * readers already forward to `fetch`.
 *
 * No polling and no synchronous probe: a string token aborts off the same
 * posted id the await-boundary check reads, and a SharedArrayBuffer token off
 * `Atomics.waitAsync`, woken by the `Atomics.notify` in {@link stopStopToken}
 * — that one lands a turn or two after the notify rather than synchronously
 * with it, which costs nothing when the point is to stop a download.
 *
 * `dispose()` in a `finally` — an undisposed entry pins its controller until
 * the token is stopped.
 */
export function stopTokenSignal(stopToken?: StopToken): StopTokenSignal {
  const controller = new AbortController()
  let dispose = () => {}
  if (isStopped(stopToken)) {
    controller.abort(makeAbortError())
  } else if (stopToken !== undefined) {
    if (isSharedArrayBuffer(stopToken)) {
      // waitAsync is specified alongside SharedArrayBuffer, but it postdates it
      // in browsers, so treat it as optional rather than assumed: without it a
      // SAB deployment simply keeps today's behavior of not aborting sockets.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (Atomics.waitAsync !== undefined) {
        const wait = Atomics.waitAsync(
          new Int32Array(stopToken),
          0,
          ABORT_FLAG_CLEAR,
        )
        let disposed = false
        dispose = () => {
          disposed = true
        }
        const onWake = () => {
          if (!disposed) {
            controller.abort(makeAbortError())
          }
        }
        if (wait.async) {
          void wait.value.then(onWake)
        } else {
          // 'not-equal' — the flag moved between the isStopped read above and
          // here, so it is already set
          onWake()
        }
      }
    } else {
      const controllers = signalControllers.get(stopToken)
      if (controllers) {
        controllers.add(controller)
      } else {
        signalControllers.set(stopToken, new Set([controller]))
      }
      dispose = () => {
        const set = signalControllers.get(stopToken)
        if (set) {
          set.delete(controller)
          if (set.size === 0) {
            signalControllers.delete(stopToken)
          }
        }
      }
    }
  }
  return { signal: controller.signal, dispose }
}

/**
 * Run `fn` with an `AbortSignal` wired to this stop token, releasing the signal
 * afterwards however `fn` settles. The shape to reach for at an adapter's read
 * call — {@link stopTokenSignal} directly is for the rare case that outlives one
 * awaited call, and it then owns remembering to dispose.
 */
export async function withStopTokenSignal<T>(
  stopToken: StopToken | undefined,
  fn: (signal: AbortSignal) => Promise<T>,
) {
  const { signal, dispose } = stopTokenSignal(stopToken)
  try {
    return await fn(signal)
  } finally {
    dispose()
  }
}

// ---------------------------------------------------------------------------
// Throttled check (use inside tight synchronous loops)
// ---------------------------------------------------------------------------

/**
 * Detects synchronously whether a string token has been stopped, for use where
 * no message can be delivered. Returns false when it cannot tell.
 *
 * A seam on the checker rather than a bare call, because the production
 * implementation only works in a worker on a `blob:` token, and is therefore
 * **inert under jest**. That inertness is not hypothetical: it let a deletion of
 * this whole mechanism pass all 6000+ unit tests. Overriding
 * `checker.syncProbe` is how a test asserts the loop consults it at all.
 */
export type SyncStopProbe = (stopToken: string) => boolean

export interface StopTokenChecker {
  stopToken?: StopToken
  sabView?: Int32Array
  iters: number
  // iteration mask for the SAB path only; the string path is time-gated
  checkIters: number
  checkInterval: number
  checkDue: TimeGate
  syncProbe: SyncStopProbe
}

export function createStopTokenChecker(
  stopToken: StopToken | undefined,
): StopTokenChecker {
  const sabView =
    stopToken !== undefined && isSharedArrayBuffer(stopToken)
      ? new Int32Array(stopToken)
      : undefined
  return {
    stopToken,
    sabView,
    iters: 0,
    checkIters: SAB_CHECK_EVERY_N_ITERS,
    checkInterval: STRING_CHECK_INTERVAL_MS,
    checkDue: createTimeGate(),
    syncProbe: probeBlobUrl,
  }
}

/**
 * The in-loop counterpart to {@link checkStopToken}, throttled so a
 * million-iteration loop doesn't pay per item.
 *
 * Reads the stopped-id set *and* the synchronous probe, because a loop that
 * awaits between items can see the first and a loop that never yields can only
 * see the second. Both are behind the same wall-clock gate, so the per-item cost
 * is one counter bump.
 */
export function checkStopTokenThrottled(checker?: StopTokenChecker) {
  // narrowed into a local because a checker's `sabView` and its token type move
  // together but are separate properties, so the branch below can't discriminate
  // on `sabView` alone
  const stopToken = checker?.stopToken
  if (checker !== undefined && stopToken !== undefined) {
    checker.iters++

    if (typeof stopToken === 'string') {
      if (checker.checkDue(checker.checkInterval)) {
        if (stoppedIds.has(stopToken) || checker.syncProbe(stopToken)) {
          throw makeAbortError()
        }
        // Linear backoff, capped, so probe cost thins over a long loop while
        // cancel latency stays bounded. Advances only past a probe that ran.
        checker.checkInterval = Math.min(
          checker.checkInterval + STRING_CHECK_INTERVAL_MS,
          STRING_CHECK_INTERVAL_MAX_MS,
        )
      }
      // SAB path: a cheap atomic read, gated by a small iteration mask.
    } else if (
      checker.sabView &&
      checker.iters % checker.checkIters === 0 &&
      Atomics.load(checker.sabView, 0) === ABORT_FLAG_SET
    ) {
      throw makeAbortError()
    }
  }
}

/** @deprecated use {@link checkStopTokenThrottled} */
export const checkStopToken2 = checkStopTokenThrottled

// Keep old name as alias for backwards compatibility in external consumers
export type LastStopTokenCheck = StopTokenChecker
