import { Observable, fromEvent } from 'rxjs'

class AbortError extends Error {
  public code: string | undefined
}

/**
 * properly check if the given AbortSignal is aborted. per the standard, if the
 * signal reads as aborted, this function throws either a DOMException
 * AbortError, or a regular error with a `code` attribute set to `ERR_ABORTED`.
 *
 * for convenience, passing `undefined` is a no-op
 *
 * @param signal -
 * @returns nothing
 */
export function checkAbortSignal(signal?: AbortSignal): void {
  if (!signal) {
    return
  }

  if (!(signal instanceof AbortSignal)) {
    throw new TypeError('must pass an AbortSignal')
  }

  if (signal.aborted) {
    throw makeAbortError()
  }
}

function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
/**
 * Skips to the next tick, then runs `checkAbortSignal`.
 * Await this to inside an otherwise synchronous loop to
 * provide a place to break when an abort signal is received.
 */
export async function abortBreakPoint(signal?: AbortSignal) {
  // it was observed that an actual timeout is needed to get the aborting (wrap
  // hicrenderer in a try catch, console.error the error, and rethrow the error
  // to see). using await Promise.resolve() did not appear to allow aborting to
  // occur
  await timeout(1)
  checkAbortSignal(signal)
}

export function makeAbortError() {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('aborted', 'AbortError')
  }
  const e = new AbortError('aborted')
  e.code = 'ERR_ABORTED'
  return e
}

export function observeAbortSignal(signal?: AbortSignal): Observable<Event> {
  if (!signal) {
    return new Observable()
  }
  return fromEvent(signal, 'abort')
}

/**
 * check if the given exception was caused by an operation being intentionally aborted
 * @param exception -
 */
export function isAbortException(exception: unknown): boolean {
  return (
    exception instanceof Error &&
    // DOMException
    (exception.name === 'AbortError' ||
      // standard-ish non-DOM abort exception
      (exception as AbortError).code === 'ERR_ABORTED' ||
      // message contains aborted for bubbling through RPC
      // things we have seen that we want to catch here
      // Error: aborted
      // AbortError: aborted
      // AbortError: The user aborted a request.
      !!/\b(aborted|aborterror)\b/i.test(exception.message))
  )
}
