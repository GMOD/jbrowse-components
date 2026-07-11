import { makeAbortError } from './aborting.ts'
import { isWebWorker } from './isWebWorker.ts'

/**
 * Stop tokens allow the main thread to cancel long-running synchronous work
 * in web workers.
 *
 * Two strategies are supported:
 *
 * 1. SharedArrayBuffer (preferred) — The main thread sets an atomic flag that
 *    workers read via Atomics.load. Requires cross-origin isolation headers.
 *
 * 2. Blob URL (fallback) — The main thread revokes a blob URL; workers detect
 *    this via a synchronous XHR that fails. Expensive, so heavily throttled.
 *
 * Based on https://yoyo-code.com/how-to-stop-synchronous-web-worker/
 * Original code copyright (c) 2022 Matyáš Racek, MIT license.
 */

export type StopToken = string | SharedArrayBuffer

// Atomic flag values stored in the Int32Array view of the SharedArrayBuffer
const ABORT_FLAG_CLEAR = 0
const ABORT_FLAG_SET = 1

// How often the SAB fast path performs its (cheap) atomic read. The XHR
// fallback does NOT gate on an iteration count — it gates purely on wall-clock
// time (see checkStopToken2), so a heavy/low-iteration loop stays cancellable.
const SAB_CHECK_EVERY_N_ITERS = 10

// XHR fallback: minimum ms between checks (also the linear-backoff step), and a
// cap so cancel latency stays bounded on a long-running loop.
const XHR_CHECK_INTERVAL_MS = 50
const XHR_CHECK_INTERVAL_MAX_MS = 500

function isSharedArrayBuffer(value: unknown): value is SharedArrayBuffer {
  try {
    return (
      typeof SharedArrayBuffer !== 'undefined' &&
      value instanceof SharedArrayBuffer
    )
  } catch {
    return false
  }
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
// Create / stop
// ---------------------------------------------------------------------------

export function createStopToken(): StopToken {
  if (hasSharedArrayBuffer) {
    const buffer = new SharedArrayBuffer(4)
    new Int32Array(buffer)[0] = ABORT_FLAG_CLEAR
    return buffer
  }
  // Fallback token: a revocable blob URL the worker probes by XHR. When
  // createObjectURL is unavailable we return a bare random string instead —
  // a non-abortable dummy, so checkStopToken only XHR-probes `blob:` URLs
  // (probing the dummy would 404 and spuriously abort on the first check).
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return URL.createObjectURL?.(new Blob()) || `${Math.random()}`
}

export function stopStopToken(stopToken?: StopToken) {
  if (stopToken === undefined) {
    return
  }
  if (isSharedArrayBuffer(stopToken)) {
    Atomics.store(new Int32Array(stopToken), 0, ABORT_FLAG_SET)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    URL.revokeObjectURL?.(stopToken)
  }
}

// ---------------------------------------------------------------------------
// One-shot check (use at async boundaries)
// ---------------------------------------------------------------------------

export function checkStopToken(stopToken: StopToken | undefined) {
  if (stopToken === undefined) {
    return
  }
  if (isSharedArrayBuffer(stopToken)) {
    if (Atomics.load(new Int32Array(stopToken), 0) === ABORT_FLAG_SET) {
      throw makeAbortError()
    }
  } else if (
    typeof jest === 'undefined' &&
    isWebWorker() &&
    stopToken.startsWith('blob:')
  ) {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', stopToken, false)
    try {
      xhr.send(null)
    } catch {
      throw makeAbortError()
    }
  }
}

// ---------------------------------------------------------------------------
// Throttled check (use inside tight loops)
// ---------------------------------------------------------------------------

export interface StopTokenChecker {
  stopToken?: StopToken
  sabView?: Int32Array
  iters: number
  time: number
  // iteration mask for the SAB fast path only; the XHR path is time-gated
  checkIters: number
  checkInterval: number
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
    time: Date.now(),
    checkIters: SAB_CHECK_EVERY_N_ITERS,
    checkInterval: XHR_CHECK_INTERVAL_MS,
  }
}

export function checkStopToken2(checker?: StopTokenChecker) {
  if (checker?.stopToken === undefined) {
    return
  }
  checker.iters++

  // SAB fast path: a cheap atomic read, gated by a small iteration mask.
  if (checker.sabView) {
    if (
      checker.iters % checker.checkIters === 0 &&
      Atomics.load(checker.sabView, 0) === ABORT_FLAG_SET
    ) {
      throw makeAbortError()
    }
    return
  }

  // XHR fallback: an expensive synchronous request, gated purely on wall-clock
  // time — never an iteration count, so a loop with few but heavy iterations
  // stays cancellable (the same reason createProgressReporter time-gates its
  // emits; an iteration mask froze low-count/heavy phases at 0%). Linear
  // backoff thins checks over a long loop, capped so cancel latency stays
  // bounded.
  const now = Date.now()
  if (now - checker.time > checker.checkInterval) {
    checker.time = now
    checkStopToken(checker.stopToken)
    checker.checkInterval = Math.min(
      checker.checkInterval + XHR_CHECK_INTERVAL_MS,
      XHR_CHECK_INTERVAL_MAX_MS,
    )
  }
}

// Keep old name as alias for backwards compatibility in external consumers
export type LastStopTokenCheck = StopTokenChecker
