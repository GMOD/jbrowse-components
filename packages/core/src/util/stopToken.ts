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

// How often checkStopToken2 actually performs the underlying check.
// SAB is a cheap atomic read; XHR is an expensive synchronous request.
const SAB_CHECK_EVERY_N_ITERS = 10
const XHR_CHECK_EVERY_N_ITERS = 100

// Minimum ms between XHR checks (also the linear backoff step)
const XHR_CHECK_INTERVAL_MS = 50

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

const useSharedArrayBuffer = (() => {
  try {
    return isSharedArrayBuffer(new SharedArrayBuffer(4))
  } catch {
    return false
  }
})()

if (useSharedArrayBuffer) {
  console.log('[stopToken] SharedArrayBuffer available, using fast atomic abort')
}

// ---------------------------------------------------------------------------
// Create / stop
// ---------------------------------------------------------------------------

export function createStopToken(): StopToken {
  if (useSharedArrayBuffer) {
    const buffer = new SharedArrayBuffer(4)
    new Int32Array(buffer)[0] = ABORT_FLAG_CLEAR
    return buffer
  }
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
      throw new Error('aborted')
    }
  } else if (typeof jest === 'undefined' && isWebWorker()) {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', stopToken, false)
    try {
      xhr.send(null)
    } catch {
      throw new Error('aborted')
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
  checkIters: number
  checkInterval: number
  backoff: boolean
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
    checkIters: sabView ? SAB_CHECK_EVERY_N_ITERS : XHR_CHECK_EVERY_N_ITERS,
    checkInterval: XHR_CHECK_INTERVAL_MS,
    backoff: true,
  }
}

export function checkStopToken2(checker?: StopTokenChecker) {
  if (!checker || checker.stopToken === undefined) {
    return
  }
  checker.iters++
  if (checker.iters % checker.checkIters !== 0) {
    return
  }

  // SAB: single atomic read
  if (checker.sabView) {
    if (Atomics.load(checker.sabView, 0) === ABORT_FLAG_SET) {
      throw new Error('aborted')
    }
    return
  }

  // XHR: gate on wall-clock time with linear backoff
  const now = Date.now()
  if (now - checker.time > checker.checkInterval) {
    checker.time = now
    checkStopToken(checker.stopToken)
    if (checker.backoff) {
      checker.checkInterval += XHR_CHECK_INTERVAL_MS
    }
  }
}

// Keep old name as alias for backwards compatibility in external consumers
export type LastStopTokenCheck = StopTokenChecker
