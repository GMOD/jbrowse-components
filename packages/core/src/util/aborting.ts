import { isElectron, isNode } from './environment.ts'
import { createTimeGate } from './timeGate.ts'

class AbortError extends Error {
  public code: string | undefined
}

export function makeAbortError() {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('aborted', 'AbortError')
  }
  const e = new AbortError('aborted')
  e.code = 'ERR_ABORTED'
  return e
}

/**
 * The one way a fetch's catch block answers a thrown error, shared by every
 * fetch family (FetchMixin's runFetch, the comparative installer, chord): an
 * abort is the ordinary end of a superseded or cancelled fetch and is
 * swallowed, and so is any failure of a fetch that is no longer the current
 * one — a superseded fetch's error is routinely its teardown's side effect,
 * and it must not overwrite the error slot (or the console) its successor
 * owns. Only a current fetch's real failure is logged and published. The
 * three sites used to spell this independently and had drifted on whether the
 * log was currency-guarded; the comparative family's pin ("does not let a
 * superseded fetch raise its error") is the semantic that was deliberate.
 */
export function handleFetchError(
  exception: unknown,
  isCurrent: () => boolean,
  setError: (e: unknown) => void,
) {
  if (!isAbortException(exception) && isCurrent()) {
    console.error(exception)
    setError(exception)
  }
}

/**
 * check if the given exception was caused by an operation being intentionally aborted
 * @param exception -
 */
export function isAbortException(exception: unknown): boolean {
  return (
    // The message test is for an abort whose name did not survive a boundary
    // (Electron IPC, RpcServer's message-only fallback). A timeout is a failure
    // even though Node words it "The operation was aborted due to timeout".
    exception instanceof Error &&
    exception.name !== 'TimeoutError' &&
    (exception.name === 'AbortError' ||
      // standard-ish non-DOM abort exception
      (exception instanceof AbortError && exception.code === 'ERR_ABORTED') ||
      /\b(aborted|aborterror)\b/i.test(exception.message))
  )
}

/**
 * Throw an AbortError if `signal` has aborted. A `signal.aborted` read, so it
 * is cheap enough for the body of a loop; place it after any await and in any
 * per-item callback a reader hands you.
 */
export function checkAbortSignal(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw makeAbortError()
  }
}

/**
 * Run an awaited stage under `signal`: checked before it starts, and again
 * once it settles. The check after is the one that gets left out when the two
 * are placed by hand — a stop landing during a long await otherwise goes
 * unseen until the next stage.
 */
export async function withAbortCheck<T>(
  signal: AbortSignal | undefined,
  fn: () => T | Promise<T>,
): Promise<T> {
  checkAbortSignal(signal)
  const result = await fn()
  checkAbortSignal(signal)
  return result
}

const YIELD_INTERVAL_MS = 50

/**
 * Give the event loop one turn. A worker learns of an abort through a posted
 * message, and a message is a task: an `await` on an already-settled promise
 * drains only microtasks and delivers nothing. A browser realm, Electron's
 * included, gets a MessageChannel task, which unlike `setTimeout` is not
 * clamped. Not `scheduler.yield`: Chromium runs its continuation ahead of a
 * posted message, so a worker loop yielding that way never sees the abort.
 * Plain Node and jsdom get the timer: a MessagePort turn there runs no due
 * timer, and under jest the abort is one.
 */
const yieldToEventLoop: () => Promise<void> = (() => {
  if ((isElectron || !isNode) && typeof MessageChannel !== 'undefined') {
    const channel = new MessageChannel()
    let resolvers: (() => void)[] = []
    channel.port1.onmessage = () => {
      const pending = resolvers
      resolvers = []
      for (const resolve of pending) {
        resolve()
      }
    }
    return () =>
      new Promise<void>(resolve => {
        resolvers.push(resolve)
        channel.port2.postMessage(0)
      })
  }
  return () =>
    new Promise<void>(resolve => {
      setTimeout(resolve, 0)
    })
})()

export interface AbortBreakpoint {
  /** True once every ~50 ms of wall time, otherwise a counter bump. */
  due(): boolean
  /** Yield a task so a posted abort can land, then throw if it did. */
  yield(): Promise<void>
}

/**
 * Cancellation for a loop that can run for seconds without awaiting — a
 * whole-genome projection, a matrix fill. A `signal.aborted` read inside such a
 * loop never changes, because the abort is a posted message; the loop has to
 * give the event loop a turn now and then. A loop bounded by the byte gate or
 * one region's features finishes before this would matter and only checks.
 *
 *     const breakpoint = createAbortBreakpoint(signal)
 *     for (const row of rows) {
 *       if (breakpoint.due()) {
 *         await breakpoint.yield()
 *       }
 *       …
 *     }
 *
 * Two calls rather than one because an `await` on a non-promise still costs a
 * microtask, about 60 ns against 2 ns for the `due()` read, and a loop over
 * every read in a pileup notices the difference.
 */
export function createAbortBreakpoint(signal?: AbortSignal): AbortBreakpoint {
  const gate = createTimeGate()
  return {
    due: () => gate(YIELD_INTERVAL_MS),
    async yield() {
      await yieldToEventLoop()
      checkAbortSignal(signal)
    },
  }
}
