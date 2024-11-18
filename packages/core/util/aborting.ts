import { Observable, fromEvent } from 'rxjs'
import nextTickMod from './nextTick'

class AbortError extends Error {
  public code: string | undefined
}

/**
 * check if the given AbortSignal is aborted. per the standard, if the signal
 * reads as aborted, this function throws either a DOMException AbortError, or
 * a regular error with a `code` attribute set to `ERR_ABORTED`. for
 * convenience, passing `undefined` is a no-op
 */
export function checkAbortSignal(stopToken?: string): void {
  if (signal?.aborted) {
    throw makeAbortError()
  }
}

/**
 * Skips to the next tick, then runs `checkAbortSignal`. Await this to inside
 * an otherwise synchronous loop to provide a place to break when an abort
 * signal is received.
 */
export async function abortBreakPoint(stopToken?: string) {
  await nextTickMod()
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

export function observeAbortSignal(stopToken?: string): Observable<Event> {
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
