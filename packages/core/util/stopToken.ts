import { isWebWorker } from './isWebWorker'

/**
 * source https://github.com/panstromek/zebra-rs/blob/82d616225930b3ad423a2c6d883c79b94ee08ba6/webzebra/src/stopToken.ts#L34C1-L57C16
 *
 * blogpost https://yoyo-code.com/how-to-stop-synchronous-web-worker/
 *
 * license "I explicitly added MIT license to the stopToken file to make it more
 * permissive"
 *
 * Copyright (c) 2022 Matyáš Racek
 *
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

// export type StopToken = string | SharedArrayBuffer
export type StopToken = string

// Check if SharedArrayBuffer is available (requires cross-origin isolation)
// function isSharedArrayBufferAvailable() {
//   try {
//     // Need to actually try to use it, not just check typeof
//     return (
//       typeof SharedArrayBuffer !== 'undefined' &&
//       new SharedArrayBuffer(4).byteLength === 4
//     )
//   } catch {
//     return false
//   }
// }

// const useSharedArrayBuffer = isSharedArrayBufferAvailable()

export function createStopTokenChecker(stopToken: StopToken | undefined) {
  return {
    time: Date.now(),
    iters: 0,
    stopToken,
  }
}

export function createStopToken(): StopToken {
  // URL not available in jest and can't properly mock it
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return URL.createObjectURL?.(new Blob()) || `${Math.random()}`
}

// unused SharedArrayBuffer
// export function createStopToken(): StopToken {
//   // Prefer SharedArrayBuffer when available (faster, just memory access)
//   if (useSharedArrayBuffer) {
//     const buffer = new SharedArrayBuffer(4)
//     new Int32Array(buffer)[0] = 0 // Initialize to not-aborted
//     return buffer
//   } else {
//     // Fallback to blob URL approach
//     // URL not available in jest and can't properly mock it
//     // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
//     return URL.createObjectURL?.(new Blob()) || `${Math.random()}`
//   }
// }

// Safely check if a value is a SharedArrayBuffer
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

export function stopStopToken(stopToken?: StopToken) {
  if (stopToken !== undefined) {
    if (isSharedArrayBuffer(stopToken)) {
      // Set abort flag
      Atomics.store(new Int32Array(stopToken), 0, 1)
    } else {
      // Revoke blob URL
      // URL not available in jest and can't properly mock it
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      URL.revokeObjectURL?.(stopToken)
    }
  }
}

export function checkStopToken(stopToken: StopToken | undefined) {
  if (stopToken === undefined) {
    return
  }

  if (isSharedArrayBuffer(stopToken)) {
    // Fast path: just check memory
    if (Atomics.load(new Int32Array(stopToken), 0) === 1) {
      throw new Error('aborted')
    }
  } else if (typeof jest === 'undefined' && isWebWorker()) {
    // Slow path: synchronous XHR (avoid on main thread)
    const xhr = new XMLHttpRequest()
    xhr.open('GET', stopToken, false)
    try {
      xhr.send(null)
    } catch {
      throw new Error('aborted')
    }
  }
}

export interface LastStopTokenCheck {
  time: number
  iters: number
  backoff?: boolean
  checkInterval?: number
  checkIters?: number
  stopToken?: StopToken
}
export function checkStopToken2(lastCheck?: LastStopTokenCheck) {
  if (!lastCheck) {
    return
  }
  const {
    stopToken,
    backoff = true,
    checkInterval = 50,
    checkIters = 100,
  } = lastCheck
  lastCheck.iters++
  if (stopToken === undefined) {
    return
  }
  if (lastCheck.iters % checkIters !== 0) {
    return
  }

  // SharedArrayBuffer is cheap, always check
  if (isSharedArrayBuffer(stopToken)) {
    checkStopToken(stopToken)
  }

  // Sync XHR is expensive, throttle to every 10ms
  const now = Date.now()
  if (now - lastCheck.time > checkInterval) {
    lastCheck.time = now
    checkStopToken(stopToken)
    if (backoff) {
      // initialize if not exist
      lastCheck.checkInterval ??= checkInterval
      // add backoff
      lastCheck.checkInterval += checkInterval
    }
  }
}

export function forEachWithStopTokenCheck<T>(
  iter: Iterable<T>,
  stopToken: StopToken | undefined,
  arg: (arg: T, idx: number) => void,
  durationMs = 400,
  checkIters = 100,
  backoff = true,
) {
  const lastCheck = {
    time: Date.now(),
    iters: 0,
    checkInterval: durationMs,
    backoff,
    checkIters,
    stopToken,
  }
  let iters = 0
  for (const t of iter) {
    arg(t, iters++)
    checkStopToken2(lastCheck)
  }
}
